-- Spice Market schema
create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('manager', 'client', 'seller');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'approved', 'fulfilled', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.supply_status as enum ('pending', 'accepted', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '',
  email text,
  locale text not null default 'he' check (locale in ('he', 'en', 'ru')),
  credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_he text not null,
  name_en text not null,
  name_ru text not null,
  image_path text not null,
  sell_price numeric(12, 2) not null default 0 check (sell_price >= 0),
  buy_price numeric(12, 2) not null default 0 check (buy_price >= 0),
  unit text not null default 'kg',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  status public.order_status not null default 'pending',
  total numeric(12, 2) not null default 0 check (total >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status public.supply_status not null default 'pending',
  total numeric(12, 2) not null default 0 check (total >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supply_items (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supplies (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid references public.profiles (id),
  amount numeric(12, 2) not null,
  reason text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists orders_client_id_idx on public.orders (client_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists supplies_seller_id_idx on public.supplies (seller_id);
create index if not exists supplies_status_idx on public.supplies (status);
create index if not exists notifications_user_id_idx on public.notifications (user_id, read);
create index if not exists credit_ledger_client_id_idx on public.credit_ledger (client_id);

-- Helpers
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  );
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'locale', 'he')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow RPC / service-role writers; block clients from self-editing role or balance.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_manager() then
    new.role := old.role;
    new.credit_balance := old.credit_balance;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles on public.profiles;
create trigger protect_profiles
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists supplies_touch on public.supplies;
create trigger supplies_touch before update on public.supplies
  for each row execute function public.touch_updated_at();

-- Place client order (deduct credits atomically)
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
  v_balance numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12, 3);
  v_manager record;
begin
  if v_client_id is null then
    raise exception 'Not authenticated';
  end if;

  select role, credit_balance into v_role, v_balance
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
  end loop;

  if v_balance < v_total then
    raise exception 'Insufficient credit balance';
  end if;

  insert into public.orders (client_id, status, total, note)
  values (v_client_id, 'pending', v_total, p_note)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_product.sell_price);
  end loop;

  update public.profiles
    set credit_balance = credit_balance - v_total
    where id = v_client_id;

  insert into public.credit_ledger (client_id, amount, reason, order_id)
  values (v_client_id, -v_total, 'order', v_order_id);

  for v_manager in select id from public.profiles where role = 'manager'
  loop
    insert into public.notifications (user_id, type, title, body, ref_id)
    values (
      v_manager.id,
      'order',
      'New client order',
      'A client placed an order for ₪' || v_total::text,
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;

-- Place seller supply
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
begin
  if v_seller_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_seller_id;
  if v_role <> 'seller' then
    raise exception 'Only sellers can place supplies';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Supply must have items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active = true;
    if not found then
      raise exception 'Product not found';
    end if;
    v_qty := (v_item->>'quantity')::numeric;
    v_price := coalesce((v_item->>'unit_price')::numeric, v_product.buy_price);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;
    v_total := v_total + round(v_qty * v_price, 2);
  end loop;

  insert into public.supplies (seller_id, status, total, note)
  values (v_seller_id, 'pending', v_total, p_note)
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

-- Grant credits (manager only)
create or replace function public.grant_credits(
  p_client_id uuid,
  p_amount numeric,
  p_reason text default 'credit grant'
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
  values (p_client_id, v_manager_id, p_amount, coalesce(p_reason, 'credit grant'));

  insert into public.notifications (user_id, type, title, body)
  values (
    p_client_id,
    'credit',
    'Credits added',
    '₪' || p_amount::text || ' added to your balance'
  );

  return v_new_balance;
end;
$$;

-- Update order status (manager); refund on reject
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

  if p_status = 'rejected' and v_order.status in ('pending', 'approved') then
    update public.profiles
      set credit_balance = credit_balance + v_order.total
      where id = v_order.client_id;
    insert into public.credit_ledger (client_id, manager_id, amount, reason, order_id)
    values (v_order.client_id, auth.uid(), v_order.total, 'order refund', p_order_id);
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
begin
  if not public.is_manager() then
    raise exception 'Only managers can update supplies';
  end if;

  select * into v_supply from public.supplies where id = p_supply_id for update;
  if not found then
    raise exception 'Supply not found';
  end if;

  update public.supplies set status = p_status where id = p_supply_id;

  insert into public.notifications (user_id, type, title, body, ref_id)
  values (
    v_supply.seller_id,
    'supply_status',
    'Supply ' || p_status::text,
    'Your supply status is now ' || p_status::text,
    p_supply_id
  );
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.supplies enable row level security;
alter table public.supply_items enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.notifications enable row level security;

-- profiles
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'profiles_select_own_or_manager') then
    create policy profiles_select_own_or_manager on public.profiles
      for select using (auth.uid() = id or public.is_manager());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles
      for update using (auth.uid() = id or public.is_manager())
      with check (auth.uid() = id or public.is_manager());
  end if;
end $$;

-- products
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'products_select_authenticated') then
    create policy products_select_authenticated on public.products
      for select to authenticated using (active = true or public.is_manager());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'products_manager_write') then
    create policy products_manager_write on public.products
      for all using (public.is_manager()) with check (public.is_manager());
  end if;
end $$;

-- orders
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'orders_select') then
    create policy orders_select on public.orders
      for select using (client_id = auth.uid() or public.is_manager());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'order_items_select') then
    create policy order_items_select on public.order_items
      for select using (
        exists (
          select 1 from public.orders o
          where o.id = order_id and (o.client_id = auth.uid() or public.is_manager())
        )
      );
  end if;
end $$;

-- supplies
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'supplies_select') then
    create policy supplies_select on public.supplies
      for select using (seller_id = auth.uid() or public.is_manager());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'supply_items_select') then
    create policy supply_items_select on public.supply_items
      for select using (
        exists (
          select 1 from public.supplies s
          where s.id = supply_id and (s.seller_id = auth.uid() or public.is_manager())
        )
      );
  end if;
end $$;

-- credit ledger
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'credit_ledger_select') then
    create policy credit_ledger_select on public.credit_ledger
      for select using (client_id = auth.uid() or public.is_manager());
  end if;
end $$;

-- notifications
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'notifications_select_own') then
    create policy notifications_select_own on public.notifications
      for select using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'notifications_update_own') then
    create policy notifications_update_own on public.notifications
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.products to authenticated;
grant all on public.products to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.supplies to authenticated;
grant select on public.supply_items to authenticated;
grant select on public.credit_ledger to authenticated;
grant select, update on public.notifications to authenticated;
grant execute on function public.place_order(jsonb, text) to authenticated;
grant execute on function public.place_supply(jsonb, text) to authenticated;
grant execute on function public.grant_credits(uuid, numeric, text) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.update_supply_status(uuid, public.supply_status) to authenticated;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.supplies;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- Seed products (local public paths; manager can replace with Storage URLs later)
insert into public.products (slug, name_he, name_en, name_ru, image_path, sell_price, buy_price, sort_order)
values
  ('salt', 'מלח', 'Salt', 'Соль', '/products/01-salt-3fa67eef-6241-45b8-a89b-ef16bd3b8f68.jpg', 12, 6, 1),
  ('citric-acid', 'חומצת לימון', 'Citric Acid', 'Лимонная кислота', '/products/02-citric-acid-64ab8ee6-f1bc-404a-901b-5d56e116b42b.jpg', 28, 14, 2),
  ('turmeric', 'כורכום', 'Turmeric', 'Куркума', '/products/03-turmeric-a6609bea-32f0-41be-8ebe-1f1058fc148c.jpg', 45, 22, 3),
  ('saffron', 'זעפרן', 'Saffron', 'Шафран', '/products/04-saffron-4cc539cd-a0ea-4767-ab1f-8ba20f720392.jpg', 850, 500, 4),
  ('ground-black-pepper', 'פלפל שחור טחון', 'Ground Black Pepper', 'Молотый чёрный перец', '/products/05-ground-black-pepper-12e0d74a-ccc0-4c89-90e9-bcff60d5b584.jpg', 55, 28, 5),
  ('parsley', 'פטרוזיליה', 'Parsley', 'Петрушка', '/products/06-parsley-2024fd82-4d99-41ed-b235-2568c8cb9908.jpg', 35, 18, 6),
  ('dill', 'שמיר', 'Dill', 'Укроп', '/products/07-dill-794a4b4c-240f-4ce5-a35d-27f0d749309f.jpg', 35, 18, 7),
  ('cinnamon', 'קינמון', 'Cinnamon', 'Корица', '/products/08-cinnamon-638f1eec-5c90-4ca5-adfe-bf419716ef3c.jpg', 60, 30, 8),
  ('cardamom', 'הל', 'Cardamom', 'Кардамон', '/products/09-cardamom-7578f214-bf4c-43f7-aa7e-440cc6a7be1a.jpg', 120, 70, 9),
  ('paprika', 'פפריקה', 'Paprika', 'Паприка', '/products/10-paprika-68e4284b-a8de-405d-8c8b-5f7038123fcd.jpg', 40, 20, 10),
  ('lemon', 'לימון', 'Lemon', 'Лимон', '/products/11-lemon-82ec996c-1816-4719-813c-fc9f64221525.jpg', 18, 9, 11),
  ('lemon-juice', 'מיץ לימון', 'Lemon Juice', 'Лимонный сок', '/products/12-lemon-juice-03a811cd-b2bd-4ada-b123-51713b130e50.jpg', 22, 11, 12),
  ('lemon-peel', 'קליפת לימון', 'Lemon Peel', 'Цедра лимона', '/products/13-lemon-peel-4ba1c169-f2da-4990-9116-2f481bc4840d.jpg', 48, 24, 13),
  ('button-mushrooms', 'פטריות', 'Button Mushrooms', 'Шампиньоны', '/products/14-button-mushrooms-59cb112b-aa0b-4d47-8d19-9f628f6eea4e.jpg', 30, 15, 14),
  ('whole-black-peppercorns', 'פלפל שחור שלם', 'Whole Black Peppercorns', 'Чёрный перец горошком', '/products/15-whole-black-peppercorns-e8281f4d-fb96-4bca-b58d-56924898491f.jpg', 50, 25, 15),
  ('oregano', 'אורגנו', 'Oregano', 'Орегано', '/products/16-oregano-3470d961-2361-4b9d-99f5-bba16a75d717.jpg', 42, 21, 16),
  ('cloves', 'ציפורן', 'Cloves', 'Гвоздика', '/products/17-cloves-bfcc6d92-6c72-4af9-8f54-8fbcd444155a.jpg', 70, 35, 17),
  ('ginger', 'ג''ינג''ר', 'Ginger', 'Имбирь', '/products/18-ginger-32901993-90d9-4101-96fb-8d46034042ec.jpg', 38, 19, 18)
on conflict (slug) do update set
  name_he = excluded.name_he,
  name_en = excluded.name_en,
  name_ru = excluded.name_ru,
  image_path = excluded.image_path,
  sell_price = excluded.sell_price,
  buy_price = excluded.buy_price,
  sort_order = excluded.sort_order;
