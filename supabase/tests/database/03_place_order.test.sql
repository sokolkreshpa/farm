-- place_order(): totals, snapshots, stock, validation, idempotency (spec §29 Orders).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Current open week of farm A and its items, looked up by product name.
create function pg_temp.cycle() returns uuid language sql stable as $$
  select id from public.weekly_cycles
  where tenant_id = '10000000-0000-4000-a000-00000000000a' and status = 'PUBLISHED'
$$;
create function pg_temp.prev_cycle() returns uuid language sql stable as $$
  select id from public.weekly_cycles
  where tenant_id = '10000000-0000-4000-a000-00000000000a' and status = 'CLOSED'
$$;
create function pg_temp.item(p_name text) returns uuid language sql stable as $$
  select ai.id from public.availability_items ai
  join public.products p on p.id = ai.product_id
  where ai.cycle_id = pg_temp.cycle() and p.name = p_name
$$;
create function pg_temp.items(p_name text, p_qty numeric) returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('availability_item_id', pg_temp.item(p_name), 'quantity', p_qty))
$$;
create function pg_temp.pickup(p_items jsonb, p_key uuid default gen_random_uuid()) returns integer
language sql volatile as $$
  select order_number from public.place_order(
    p_tenant_slug => 'ferma-kodra', p_cycle_id => pg_temp.cycle(), p_items => p_items,
    p_delivery_method => 'PICKUP', p_phone => '0695678901', p_idempotency_key => p_key)
$$;

create table pg_temp.vars (k text primary key, v text);
grant all on pg_temp.vars to authenticated;
grant execute on all functions in schema pg_temp to authenticated;

-- ================================================================ Fatjona (no saved address)
select pg_temp.login('00000000-0000-4000-a000-000000000105');

insert into pg_temp.vars values ('key', gen_random_uuid()::text);
insert into pg_temp.vars
select 'n1', pg_temp.pickup(pg_temp.items('Domate', 1.5), (select v::uuid from pg_temp.vars where k = 'key'))::text;

select is((select v from pg_temp.vars where k = 'n1'), '1014', 'order numbers continue per farm (1014)');
select is(
  (select total from public.orders where order_number = 1014), 375.00::numeric,
  'total = 1.5 kg x 250 ALL, no fee for pickup');
select is(
  (select unit_price from public.order_items oi join public.orders o on o.id = oi.order_id where o.order_number = 1014),
  250.00::numeric, 'unit price is taken from this week''s availability');
select is(
  (select product_name_snapshot || '/' || unit_snapshot from public.order_items oi
   join public.orders o on o.id = oi.order_id where o.order_number = 1014),
  'Domate/kg', 'product name and unit are snapshotted');
select is(
  (select ordered_quantity from public.availability_items where id = pg_temp.item('Domate')),
  12.000::numeric, 'stock reserved: 10.5 already ordered + 1.5');
select is(
  pg_temp.pickup(pg_temp.items('Domate', 1.5), (select v::uuid from pg_temp.vars where k = 'key')), 1014,
  'same idempotency key returns the same order');
select is(
  (select count(*)::int from public.orders where customer_email = 'fatjona@example.com'), 3,
  'no duplicate order was created by the retry');
select is(
  (select ordered_quantity from public.availability_items where id = pg_temp.item('Domate')),
  12.000::numeric, 'retry did not reserve stock twice');

select throws_ok($$ select pg_temp.pickup(pg_temp.items('Vaj ulliri', 25)) $$,
  'P0001', 'INSUFFICIENT_STOCK', 'cannot order more than the remaining stock');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Domate', 0.3)) $$,
  'P0001', 'INVALID_QUANTITY', 'quantity must be a multiple of the product step');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Domate', 0)) $$,
  'P0001', 'INVALID_QUANTITY', 'quantity must be positive');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Vezë fshati', 4)) $$,
  'P0001', 'ABOVE_MAXIMUM', 'per-customer maximum is enforced');
select throws_ok(
  $$ select pg_temp.pickup(jsonb_build_array(jsonb_build_object(
       'availability_item_id', (select id from public.availability_items where tenant_id = '10000000-0000-4000-a000-00000000000b' limit 1),
       'quantity', 1))) $$,
  'P0001', 'ITEM_NOT_AVAILABLE', 'cannot order another farm''s item');
select throws_ok(
  $$ select pg_temp.pickup(jsonb_build_array(jsonb_build_object(
       'availability_item_id', (select ai.id from public.availability_items ai join public.products p on p.id = ai.product_id
                                where ai.cycle_id = pg_temp.prev_cycle() and p.name = 'Mollë'),
       'quantity', 1))) $$,
  'P0001', 'ITEM_NOT_AVAILABLE', 'cannot order an item from another week (Mollë not offered now)');
select throws_ok(
  $$ select order_number from public.place_order('ferma-kodra', pg_temp.prev_cycle(),
       pg_temp.items('Domate', 1), 'PICKUP', '1', gen_random_uuid()) $$,
  'P0001', 'CYCLE_CLOSED', 'cannot order in a closed week');
select throws_ok(
  $$ select order_number from public.place_order('ferma-kodra', pg_temp.cycle(),
       pg_temp.items('Domate', 1), 'DELIVERY', '1', gen_random_uuid()) $$,
  'P0001', 'ADDRESS_REQUIRED', 'delivery needs an address');
select throws_ok(
  $$ select order_number from public.place_order('ferma-kodra', pg_temp.cycle(),
       pg_temp.items('Domate', 1), 'DELIVERY', '1', gen_random_uuid(),
       (select id from public.addresses where profile_id = '00000000-0000-4000-a000-000000000101')) $$,
  'P0001', 'ADDRESS_REQUIRED', 'cannot use another customer''s address');
select throws_ok($$ select pg_temp.pickup('[]'::jsonb) $$,
  'P0001', 'EMPTY_ORDER', 'empty orders are rejected');
select throws_ok(
  $$ select pg_temp.pickup(pg_temp.items('Domate', 1) || pg_temp.items('Domate', 1)) $$,
  'P0001', 'DUPLICATE_ITEM', 'duplicate lines are rejected');
select throws_ok(
  $$ select order_number from public.place_order('ferma-kodra', pg_temp.cycle(),
       pg_temp.items('Domate', 1), 'PICKUP', '   ', gen_random_uuid()) $$,
  'P0001', 'PHONE_REQUIRED', 'phone is required');
select throws_ok(
  $$ select order_number from public.place_order('ferma-fusha', pg_temp.cycle(),
       pg_temp.items('Domate', 1), 'PICKUP', '1', gen_random_uuid()) $$,
  'P0001', 'CYCLE_NOT_FOUND', 'cannot place a farm A week''s order through farm B''s slug');

-- ================================================================ Farmer changes price and listing
select pg_temp.login('00000000-0000-4000-a000-000000000002');
update public.availability_items set price = 300 where id = pg_temp.item('Kastravec');
update public.availability_items set listed = false where id = pg_temp.item('Speca');

select pg_temp.login('00000000-0000-4000-a000-000000000105');
select is(
  (select unit_price from public.order_items oi join public.orders o on o.id = oi.order_id
   where o.order_number = 1013 and oi.product_name_snapshot = 'Kastravec'),
  180.00::numeric, 'historical order keeps the price actually paid after a price change');
select pg_temp.pickup(pg_temp.items('Kastravec', 1));
select is(
  (select unit_price from public.order_items where product_name_snapshot = 'Kastravec'
   and order_id = (select id from public.orders where customer_email = 'fatjona@example.com' order by order_number desc limit 1)),
  300.00::numeric, 'a new order uses the new price');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Speca', 1)) $$,
  'P0001', 'ITEM_NOT_AVAILABLE', 'unlisted items cannot be ordered');

-- ================================================================ Ana: delivery fee
select pg_temp.login('00000000-0000-4000-a000-000000000101');
insert into pg_temp.vars
select 'ana_order', order_number::text from public.place_order('ferma-kodra', pg_temp.cycle(),
  pg_temp.items('Patate', 2), 'DELIVERY', '0681234567', gen_random_uuid(),
  (select id from public.addresses limit 1));
select is(
  (select total - subtotal from public.orders
   where order_number = (select v::int from pg_temp.vars where k = 'ana_order')),
  200.00::numeric, 'delivery adds the farm''s delivery fee');
select is(
  (select delivery_address from public.orders where customer_email = 'ana@example.com' order by order_number desc limit 1),
  'Rr. Myslym Shyri 12', 'delivery address is snapshotted onto the order');

-- ================================================================ Inventory enforcement off
reset role;
update public.tenants set enforce_inventory = false where slug = 'ferma-kodra';
select pg_temp.login('00000000-0000-4000-a000-000000000105');
select lives_ok($$ select pg_temp.pickup(pg_temp.items('Vaj ulliri', 30)) $$,
  'overselling is allowed when the farm disables inventory enforcement');
reset role;
update public.tenants set enforce_inventory = true where slug = 'ferma-kodra';

-- ================================================================ Inactive customer
select pg_temp.login('00000000-0000-4000-a000-000000000002');
update public.customers set active = false
where profile_id = '00000000-0000-4000-a000-000000000105';
select pg_temp.login('00000000-0000-4000-a000-000000000105');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Domate', 1)) $$,
  'P0001', 'CUSTOMER_INACTIVE', 'a deactivated customer cannot order');

-- ================================================================ Deadline passed
reset role;
update public.customers set active = true where profile_id = '00000000-0000-4000-a000-000000000105';
update public.weekly_cycles set order_deadline = now() - interval '1 minute' where id = pg_temp.cycle();
select pg_temp.login('00000000-0000-4000-a000-000000000105');
select throws_ok($$ select pg_temp.pickup(pg_temp.items('Domate', 1)) $$,
  'P0001', 'CYCLE_CLOSED', 'cannot order after the deadline even if the week is still published');

-- ================================================================ First order from a new farm
reset role;
update public.weekly_cycles set order_deadline = now() + interval '1 day' where id = pg_temp.cycle();
select pg_temp.login('00000000-0000-4000-a000-000000000106'); -- Gent: customer of farm B only
select lives_ok($$ select pg_temp.pickup(pg_temp.items('Domate', 1)) $$,
  'a person can order from a second farm (customer record is created)');
select is((select count(*)::int from public.customers), 2,
  'Gent now has customer records at both farms');

reset role;
select is(
  (select count(*)::int from public.notifications where status = 'PENDING' and event = 'ORDER_PLACED_FARMER'), 5,
  'each new order queues a farmer notification');

select * from finish();
rollback;
