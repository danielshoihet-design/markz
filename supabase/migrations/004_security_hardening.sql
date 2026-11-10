-- Security hardening: tighter RLS, revoke excess grants, secure RPCs

-- Revoke broad table privileges; re-grant least privilege
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.supplies from anon, authenticated;
revoke all on table public.supply_items from anon, authenticated;
revoke all on table public.credit_ledger from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.products to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.supplies to authenticated;
grant select on table public.supply_items to authenticated;
grant select on table public.credit_ledger to authenticated;
grant select, update on table public.notifications to authenticated;

-- Manager product writes via RLS (need insert/update/delete grants)
grant insert, update, delete on table public.products to authenticated;

-- Drop overly permissive product write if any anon policies
do $$ begin
  drop policy if exists "products_anon" on public.products;
exception when undefined_object then null;
end $$;

-- Profiles: clients may only update locale (and full_name) on themselves — role/balance protected by trigger
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id or public.is_manager())
  with check (auth.uid() = id or public.is_manager());

-- No inserts into profiles from clients (only trigger/service role)
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert_deny on public.profiles
  for insert
  with check (false);

-- Notifications: users cannot insert/delete their own (only RPCs / security definer)
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_delete on public.notifications;

-- Ensure RPCs run with fixed search_path (re-assert)
alter function public.is_manager() set search_path = public;
alter function public.current_role() set search_path = public;
alter function public.place_order(jsonb, text) set search_path = public;
alter function public.place_supply(jsonb, text) set search_path = public;
alter function public.grant_credits(uuid, numeric, text) set search_path = public;
alter function public.settle_credit(uuid, numeric, text) set search_path = public;
alter function public.record_order_payment(uuid, numeric) set search_path = public;
alter function public.update_order_status(uuid, public.order_status) set search_path = public;
alter function public.update_supply_status(uuid, public.supply_status) set search_path = public;
alter function public.protect_profile_fields() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Cap order/supply item counts to reduce abuse
create or replace function public.place_order(
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_role public.user_role;
  v_client_name text;
  v_total numeric(12, 2) := 0;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12, 3);
  v_manager record;
  v_lines text := '';
  v_count int;
begin
  if v_client_id is null then
    raise exception 'Not authenticated';
  end if;

  select role, full_name into v_role, v_client_name
  from public.profiles where id = v_client_id;

  if v_role <> 'client' then
    raise exception 'Only clients can place orders';
  end if;

  if p_items is null then
    raise exception 'Order must have items';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count is null or v_count < 1 or v_count > 50 then
    raise exception 'Invalid item count';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note too long';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'product_id') is null or (v_item->>'product_id') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Invalid product id';
    end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active = true;
    if not found then
      raise exception 'Product not found';
    end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 10000 then
      raise exception 'Invalid quantity';
    end if;
    v_total := v_total + round(v_qty * v_product.sell_price, 2);
    v_lines := v_lines || coalesce(v_product.name_he, v_product.name_en) || ': ' || v_qty::text || 'kg, ';
  end loop;

  if v_total <= 0 or v_total > 1000000 then
    raise exception 'Invalid order total';
  end if;

  insert into public.orders (client_id, status, total, note, payment_status, amount_paid)
  values (v_client_id, 'pending', v_total, left(p_note, 500), null, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_product.sell_price);
  end loop;

  for v_manager in select id from public.profiles where role = 'manager'
  loop
    insert into public.notifications (user_id, type, title, body, ref_id)
    values (
      v_manager.id,
      'order',
      'הזמנה חדשה מ' || coalesce(left(v_client_name, 80), 'לקוח'),
      left(trim(trailing ', ' from v_lines) || ' | סה״כ ₪' || v_total::text, 500),
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;

create or replace function public.place_supply(
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid := auth.uid();
  v_role public.user_role;
  v_total numeric(12, 2) := 0;
  v_supply_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12, 3);
  v_price numeric(12, 2);
  v_manager record;
  v_count int;
begin
  if v_seller_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_seller_id;
  if v_role <> 'seller' then
    raise exception 'Only sellers can place supplies';
  end if;

  if p_items is null then
    raise exception 'Supply must have items';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count is null or v_count < 1 or v_count > 50 then
    raise exception 'Invalid item count';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note too long';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'product_id') is null or (v_item->>'product_id') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Invalid product id';
    end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active = true;
    if not found then
      raise exception 'Product not found';
    end if;
    v_qty := (v_item->>'quantity')::numeric;
    v_price := coalesce((v_item->>'unit_price')::numeric, v_product.buy_price);
    if v_qty is null or v_qty <= 0 or v_qty > 10000 then
      raise exception 'Invalid quantity';
    end if;
    if v_price is null or v_price < 0 or v_price > 100000 then
      raise exception 'Invalid unit price';
    end if;
    v_total := v_total + round(v_qty * v_price, 2);
  end loop;

  if v_total <= 0 or v_total > 1000000 then
    raise exception 'Invalid supply total';
  end if;

  insert into public.supplies (seller_id, status, total, note)
  values (v_seller_id, 'pending', v_total, left(p_note, 500))
  returning id into v_supply_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    v_price := coalesce((v_item->>'unit_price')::numeric, v_product.buy_price);
    insert into public.supply_items (supply_id, product_id, quantity, unit_price)
    values (v_supply_id, v_product.id, v_qty, v_price);
  end loop;

  for v_manager in select id from public.profiles where role = 'manager'
  loop
    insert into public.notifications (user_id, type, title, body, ref_id)
    values (
      v_manager.id,
      'supply',
      'New seller supply',
      'A seller offered supply for ₪' || v_total::text,
      v_supply_id
    );
  end loop;

  return v_supply_id;
end;
$$;

grant execute on function public.place_order(jsonb, text) to authenticated;
grant execute on function public.place_supply(jsonb, text) to authenticated;

-- Block anon from executing business RPCs
revoke execute on function public.place_order(jsonb, text) from anon, public;
revoke execute on function public.place_supply(jsonb, text) from anon, public;
revoke execute on function public.grant_credits(uuid, numeric, text) from anon, public;
revoke execute on function public.settle_credit(uuid, numeric, text) from anon, public;
revoke execute on function public.record_order_payment(uuid, numeric) from anon, public;
revoke execute on function public.update_order_status(uuid, public.order_status) from anon, public;
revoke execute on function public.update_supply_status(uuid, public.supply_status) from anon, public;
revoke execute on function public.is_manager() from anon, public;
revoke execute on function public.current_role() from anon, public;

grant execute on function public.place_order(jsonb, text) to authenticated;
grant execute on function public.place_supply(jsonb, text) to authenticated;
grant execute on function public.grant_credits(uuid, numeric, text) to authenticated;
grant execute on function public.settle_credit(uuid, numeric, text) to authenticated;
grant execute on function public.record_order_payment(uuid, numeric) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.update_supply_status(uuid, public.supply_status) to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.current_role() to authenticated;
