-- Payment + debt (credit owed by client) model
-- credit_balance = how much the client still owes the manager

do $$ begin
  create type public.payment_status as enum ('unpaid', 'partial', 'paid');
exception when duplicate_object then null;
end $$;

alter table public.orders
  add column if not exists payment_status public.payment_status,
  add column if not exists amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0);

-- Existing fulfilled orders without payment info: treat as unpaid until manager sets
update public.orders
set payment_status = 'unpaid'
where payment_status is null;

-- Place order: no prepaid deduction — just create order + notify manager
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
begin
  if v_client_id is null then
    raise exception 'Not authenticated';
  end if;

  select role, full_name into v_role, v_client_name
  from public.profiles where id = v_client_id;

  if v_role <> 'client' then
    raise exception 'Only clients can place orders';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active = true;
    if not found then
      raise exception 'Product not found';
    end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;
    v_total := v_total + round(v_qty * v_product.sell_price, 2);
    v_lines := v_lines || coalesce(v_product.name_he, v_product.name_en) || ': ' || v_qty::text || 'kg, ';
  end loop;

  insert into public.orders (client_id, status, total, note, payment_status, amount_paid)
  values (v_client_id, 'pending', v_total, p_note, null, 0)
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
      'הזמנה חדשה מ' || coalesce(v_client_name, 'לקוח'),
      trim(trailing ', ' from v_lines) || ' | סה״כ ₪' || v_total::text,
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;

-- Manager records how much was paid for an order; unpaid remainder becomes client credit (debt)
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount_paid numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_paid numeric(12, 2);
  v_due numeric(12, 2);
  v_prev_due numeric(12, 2);
  v_status public.payment_status;
begin
  if not public.is_manager() then
    raise exception 'Only managers can record payment';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  v_paid := greatest(0, least(coalesce(p_amount_paid, 0), v_order.total));
  v_due := round(v_order.total - v_paid, 2);
  v_prev_due := round(v_order.total - coalesce(v_order.amount_paid, 0), 2);

  -- If payment was already recorded, reverse previous debt first
  if v_order.payment_status is not null then
    update public.profiles
      set credit_balance = greatest(0, credit_balance - v_prev_due)
      where id = v_order.client_id;
    insert into public.credit_ledger (client_id, manager_id, amount, reason, order_id)
    values (v_order.client_id, auth.uid(), -v_prev_due, 'payment adjustment reverse', p_order_id);
  end if;

  if v_paid <= 0 then
    v_status := 'unpaid';
  elsif v_paid >= v_order.total then
    v_status := 'paid';
    v_paid := v_order.total;
    v_due := 0;
  else
    v_status := 'partial';
  end if;

  update public.orders
  set
    amount_paid = v_paid,
    payment_status = v_status,
    status = case when status = 'pending' then 'fulfilled'::public.order_status else status end
  where id = p_order_id;

  if v_due > 0 then
    update public.profiles
      set credit_balance = credit_balance + v_due
      where id = v_order.client_id;
    insert into public.credit_ledger (client_id, manager_id, amount, reason, order_id)
    values (v_order.client_id, auth.uid(), v_due, 'order on credit', p_order_id);
  end if;

  insert into public.notifications (user_id, type, title, body, ref_id)
  values (
    v_order.client_id,
    'payment',
    'עדכון תשלום להזמנה',
    case v_status
      when 'paid' then 'ההזמנה שולמה במלואה'
      when 'partial' then 'שולם חלקית ₪' || v_paid::text || ', קרדיט ₪' || v_due::text
      else 'ההזמנה בקרדיט — טרם שולם'
    end,
    p_order_id
  );
end;
$$;

-- Client pays down existing credit debt later
create or replace function public.settle_credit(
  p_client_id uuid,
  p_amount numeric,
  p_reason text default 'credit payment'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(12, 2);
  v_pay numeric(12, 2);
begin
  if not public.is_manager() then
    raise exception 'Only managers can settle credit';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if not exists (select 1 from public.profiles where id = p_client_id and role = 'client') then
    raise exception 'Client not found';
  end if;

  select least(credit_balance, p_amount) into v_pay
  from public.profiles where id = p_client_id;

  update public.profiles
    set credit_balance = credit_balance - v_pay
    where id = p_client_id
    returning credit_balance into v_new_balance;

  insert into public.credit_ledger (client_id, manager_id, amount, reason)
  values (p_client_id, auth.uid(), -v_pay, coalesce(p_reason, 'credit payment'));

  insert into public.notifications (user_id, type, title, body)
  values (
    p_client_id,
    'credit',
    'תשלום על קרדיט',
    'שולם ₪' || v_pay::text || ' על הקרדיט. יתרה: ₪' || v_new_balance::text
  );

  return v_new_balance;
end;
$$;

-- Keep grant_credits as increasing debt (open credit without order) for manual adjustments
create or replace function public.grant_credits(
  p_client_id uuid,
  p_amount numeric,
  p_reason text default 'manual credit'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_id uuid := auth.uid();
  v_new_balance numeric(12, 2);
begin
  if not public.is_manager() then
    raise exception 'Only managers can grant credits';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if not exists (select 1 from public.profiles where id = p_client_id and role = 'client') then
    raise exception 'Client not found';
  end if;

  update public.profiles
    set credit_balance = credit_balance + p_amount
    where id = p_client_id
    returning credit_balance into v_new_balance;

  insert into public.credit_ledger (client_id, manager_id, amount, reason)
  values (p_client_id, v_manager_id, p_amount, coalesce(p_reason, 'manual credit'));

  insert into public.notifications (user_id, type, title, body)
  values (
    p_client_id,
    'credit',
    'קרדיט עודכן',
    'נוסף קרדיט ₪' || p_amount::text || '. יתרת חוב: ₪' || v_new_balance::text
  );

  return v_new_balance;
end;
$$;

-- Reject order: no prepaid refund anymore
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_manager() then
    raise exception 'Only managers can update orders';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = p_status then
    return;
  end if;

  -- If rejecting after payment recorded with debt, reverse unpaid portion
  if p_status = 'rejected' and v_order.payment_status is not null then
    declare
      v_due numeric(12, 2) := round(v_order.total - coalesce(v_order.amount_paid, 0), 2);
    begin
      if v_due > 0 then
        update public.profiles
          set credit_balance = greatest(0, credit_balance - v_due)
          where id = v_order.client_id;
        insert into public.credit_ledger (client_id, manager_id, amount, reason, order_id)
        values (v_order.client_id, auth.uid(), -v_due, 'order rejected credit reverse', p_order_id);
      end if;
    end;
  end if;

  update public.orders set status = p_status where id = p_order_id;

  insert into public.notifications (user_id, type, title, body, ref_id)
  values (
    v_order.client_id,
    'order_status',
    'Order ' || p_status::text,
    'Your order status is now ' || p_status::text,
    p_order_id
  );
end;
$$;

grant execute on function public.record_order_payment(uuid, numeric) to authenticated;
grant execute on function public.settle_credit(uuid, numeric, text) to authenticated;
