-- Suppliers are always paid in full on accept — no credit for sellers.
-- accepted supplies = manager expense.

alter table public.supplies
  add column if not exists amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0);

create or replace function public.update_supply_status(
  p_supply_id uuid,
  p_status public.supply_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supply public.supplies%rowtype;
  v_seller_name text;
begin
  if not public.is_manager() then
    raise exception 'Only managers can update supplies';
  end if;

  select * into v_supply from public.supplies where id = p_supply_id for update;
  if not found then
    raise exception 'Supply not found';
  end if;

  select full_name into v_seller_name from public.profiles where id = v_supply.seller_id;

  update public.supplies
  set
    status = p_status,
    amount_paid = case
      when p_status = 'accepted' then v_supply.total
      when p_status = 'rejected' then 0
      else amount_paid
    end
  where id = p_supply_id;

  insert into public.notifications (user_id, type, title, body, ref_id)
  values (
    v_supply.seller_id,
    'supply_status',
    case
      when p_status = 'accepted' then 'האספקה התקבלה ושולמה'
      when p_status = 'rejected' then 'האספקה נדחתה'
      else 'Supply ' || p_status::text
    end,
    case
      when p_status = 'accepted' then 'שולם לך ₪' || v_supply.total::text
      else 'סטטוס האספקה: ' || p_status::text
    end,
    p_supply_id
  );
end;
$$;
