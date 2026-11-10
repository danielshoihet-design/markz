-- In-app chat: every client and supplier has one conversation with the manager.
-- Clients and suppliers cannot message each other.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  -- The client or supplier this conversation belongs to. The other side is
  -- always "the manager", whichever manager account answers.
  thread_user_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  from_manager boolean not null,
  body text not null check (char_length(body) between 1 and 2000),
  -- Set when the receiving side opens the conversation.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx
  on public.chat_messages (thread_user_id, created_at desc);
create index if not exists chat_messages_unread_idx
  on public.chat_messages (thread_user_id, from_manager) where read_at is null;
create index if not exists chat_messages_sender_idx
  on public.chat_messages (sender_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Read only: all writes go through the functions below.
revoke all on table public.chat_messages from anon, authenticated;
grant select on table public.chat_messages to authenticated;

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (
    thread_user_id = (select auth.uid())
    or (select public.is_manager())
  );

create or replace function public.send_chat_message(
  p_thread_user_id uuid,
  p_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_thread_role public.user_role;
  v_body text;
  v_recent int;
  v_row public.chat_messages;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Not authenticated';
  end if;

  if v_role = 'manager' then
    select role into v_thread_role from public.profiles where id = p_thread_user_id;
    if v_thread_role is null or v_thread_role = 'manager' then
      raise exception 'Conversation not found';
    end if;
  elsif p_thread_user_id is distinct from v_uid then
    raise exception 'Not allowed';
  end if;

  -- Drop control characters (line breaks and tabs stay).
  v_body := btrim(
    regexp_replace(coalesce(p_body, ''), '[\x01-\x08\x0B-\x1F\x7F]', '', 'g'),
    E' \t\n'
  );
  if v_body = '' then
    raise exception 'Message is empty';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Message too long';
  end if;

  select count(*) into v_recent
  from public.chat_messages
  where sender_id = v_uid and created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'Too many messages, try again in a minute';
  end if;

  insert into public.chat_messages (thread_user_id, sender_id, from_manager, body)
  values (p_thread_user_id, v_uid, v_role = 'manager', v_body)
  returning * into v_row;

  return v_row;
end;
$$;

-- Marks the messages the caller received in a conversation as read.
create or replace function public.mark_chat_read(p_thread_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_manager() then
    update public.chat_messages
      set read_at = now()
      where thread_user_id = p_thread_user_id
        and not from_manager
        and read_at is null;
  elsif p_thread_user_id = v_uid then
    update public.chat_messages
      set read_at = now()
      where thread_user_id = v_uid
        and from_manager
        and read_at is null;
  else
    raise exception 'Not allowed';
  end if;
end;
$$;

-- Manager's conversation list: every client and supplier, with the latest
-- message and how many of their messages are still unread.
create or replace function public.chat_threads()
returns table (
  user_id uuid,
  full_name text,
  username text,
  role public.user_role,
  last_body text,
  last_at timestamptz,
  last_from_manager boolean,
  unread int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.role,
    m.body,
    m.created_at,
    m.from_manager,
    coalesce(u.unread, 0)::int
  from public.profiles p
  left join lateral (
    select c.body, c.created_at, c.from_manager
    from public.chat_messages c
    where c.thread_user_id = p.id
    order by c.created_at desc
    limit 1
  ) m on true
  left join lateral (
    select count(*) as unread
    from public.chat_messages c
    where c.thread_user_id = p.id and not c.from_manager and c.read_at is null
  ) u on true
  where public.is_manager() and p.role in ('client', 'seller')
  order by (coalesce(u.unread, 0) > 0) desc, m.created_at desc nulls last, p.full_name;
$$;

revoke execute on function public.send_chat_message(uuid, text) from anon, public;
revoke execute on function public.mark_chat_read(uuid) from anon, public;
revoke execute on function public.chat_threads() from anon, public;
grant execute on function public.send_chat_message(uuid, text) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.chat_threads() to authenticated;

-- Live delivery
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
