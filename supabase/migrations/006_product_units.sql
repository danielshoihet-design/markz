alter table public.products
  add column if not exists qty_step numeric(12, 3) not null default 0.5
  check (qty_step > 0);

-- Whole kilograms only (no halves)
update public.products
set unit = 'kg', qty_step = 1
where slug in (
  'salt',
  'citric-acid',
  'turmeric',
  'saffron',
  'ground-black-pepper',
  'cardamom',
  'paprika',
  'lemon-juice',
  'lemon-peel',
  'button-mushrooms',
  'whole-black-peppercorns',
  'oregano'
);

-- Sold by piece / unit, not kg
update public.products
set unit = 'unit', qty_step = 1
where slug in ('dill', 'parsley', 'cinnamon', 'cloves');

-- Enforce quantity steps in place_order / place_supply
create or replace function public.assert_product_qty(
  p_product public.products,
  p_qty numeric
)
returns void
language plpgsql
as $$
begin
  if p_qty is null or p_qty <= 0 or p_qty > 10000 then
    raise exception 'Invalid quantity';
  end if;
  if abs(round(p_qty / p_product.qty_step) * p_product.qty_step - p_qty) > 0.0001 then
    raise exception 'Quantity must be in steps of %', p_product.qty_step;
  end if;
  if p_product.unit = 'unit' and p_qty <> trunc(p_qty) then
    raise exception 'Quantity must be a whole number of units';
  end if;
end;
$$;

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
  v_unit text;
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
    perform public.assert_product_qty(v_product, v_qty);
    v_total := v_total + round(v_qty * v_product.sell_price, 2);
    v_unit := case when v_product.unit = 'unit' then ' יח׳' else ' ק״ג' end;
    v_lines := v_lines || coalesce(v_product.name_he, v_product.name_en) || ': ' || v_qty::text || v_unit || ', ';
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
  v_seller_name text;
  v_total numeric(12, 2) := 0;
  v_supply_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12, 3);
  v_price numeric(12, 2);
  v_manager record;
  v_lines text := '';
  v_count int;
  v_unit text;
begin
  if v_seller_id is null then
    raise exception 'Not authenticated';
  end if;

  select role, full_name into v_role, v_seller_name
  from public.profiles where id = v_seller_id;

  if v_role <> 'seller' then
    raise exception 'Only sellers can submit supplies';
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
    perform public.assert_product_qty(v_product, v_qty);
    v_price := coalesce((v_item->>'unit_price')::numeric, v_product.buy_price);
    if v_price is null or v_price < 0 or v_price > 1000000 then
      raise exception 'Invalid unit price';
    end if;
    v_total := v_total + round(v_qty * v_price, 2);
    v_unit := case when v_product.unit = 'unit' then ' יח׳' else ' ק״ג' end;
    v_lines := v_lines || coalesce(v_product.name_he, v_product.name_en) || ': ' || v_qty::text || v_unit || ', ';
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
      'אספקה חדשה מ' || coalesce(left(v_seller_name, 80), 'ספק'),
      left(trim(trailing ', ' from v_lines) || ' | סה״כ ₪' || v_total::text, 500),
      v_supply_id
    );
  end loop;

  return v_supply_id;
end;
$$;
