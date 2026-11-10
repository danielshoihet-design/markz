alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

update public.profiles
set username = lower(split_part(email, '@', 1))
where username is null and email is not null and email <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, full_name, role, locale)
  values (
    new.id,
    new.email,
    nullif(lower(coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )), ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'locale', 'he')
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.profiles.username),
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;
