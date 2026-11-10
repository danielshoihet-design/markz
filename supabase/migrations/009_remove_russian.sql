-- Russian is no longer offered: the app is Hebrew and English only.
-- products.name_ru is left in place (unused) so no product data is destroyed.

update public.profiles set locale = 'he' where locale not in ('he', 'en');

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check check (locale in ('he', 'en'));
