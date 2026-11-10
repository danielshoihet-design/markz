delete from public.order_items
where product_id in (select id from public.products where slug in ('lemon', 'ginger'));

delete from public.supply_items
where product_id in (select id from public.products where slug in ('lemon', 'ginger'));

delete from public.products where slug in ('lemon', 'ginger');
