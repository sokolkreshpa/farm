-- Farmer A must never read or change Farmer B's data (spec §21).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixtures (seed.sql): farm A / farmer A, farm B / farmer B.
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.farm_a() returns uuid language sql immutable as $$ select '10000000-0000-4000-a000-00000000000a'::uuid $$;
create function pg_temp.farm_b() returns uuid language sql immutable as $$ select '10000000-0000-4000-a000-00000000000b'::uuid $$;
create function pg_temp.farmer_a() returns uuid language sql immutable as $$ select '00000000-0000-4000-a000-000000000002'::uuid $$;

-- A DRAFT week for farm B (not public) to prove drafts are hidden.
insert into public.weekly_cycles (tenant_id, week_start, order_deadline)
values (pg_temp.farm_b(), date_trunc('week', now())::date + 28, now() + interval '30 days');
insert into public.availability_items (tenant_id, cycle_id, product_id, price, available_quantity)
select pg_temp.farm_b(), c.id, p.id, 1, 1
from public.weekly_cycles c, public.products p
where c.tenant_id = pg_temp.farm_b() and c.status = 'DRAFT' and p.tenant_id = pg_temp.farm_b()
limit 1;

grant execute on all functions in schema pg_temp to authenticated;

select pg_temp.login(pg_temp.farmer_a());

-- ---------------------------------------------------------------- reads
select is((select count(*)::int from public.products where tenant_id = pg_temp.farm_a()), 14,
  'farmer A sees all of farm A''s products');
select is((select count(*)::int from public.orders where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B orders');
select is((select count(*)::int from public.orders), 13,
  'farmer A sees exactly farm A''s 13 orders');
select is((select count(*)::int from public.order_items where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B order items');
select is((select count(*)::int from public.order_status_history where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B order history');
select is((select count(*)::int from public.customers where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B customer records');
select is((select count(*)::int from public.customers), 5,
  'farmer A sees farm A''s 5 customers');
select is((select count(*)::int from public.profiles where email = 'gent@example.com'), 0,
  'farmer A cannot see profiles of farm B-only customers');
select is((select count(*)::int from public.weekly_cycles where tenant_id = pg_temp.farm_b() and status = 'DRAFT'), 0,
  'farmer A cannot see farm B draft weeks');
select is((select count(*)::int from public.availability_items ai
           join public.weekly_cycles c on c.id = ai.cycle_id
           where ai.tenant_id = pg_temp.farm_b() and c.status = 'DRAFT'), 0,
  'farmer A cannot see items of farm B draft weeks');
select is((select count(*)::int from public.farmer_cycle_product_totals where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B aggregated totals');
select is((select count(*)::int from public.tenant_members where tenant_id = pg_temp.farm_b()), 0,
  'farmer A cannot see farm B memberships');

-- ---------------------------------------------------------------- writes
update public.products set name = 'Hacked' where tenant_id = pg_temp.farm_b();
update public.tenants set name = 'Hacked' where id = pg_temp.farm_b();
update public.customers set active = false where tenant_id = pg_temp.farm_b();
delete from public.availability_items where tenant_id = pg_temp.farm_b();

select throws_ok(
  $$ insert into public.products (tenant_id, name, unit_code, quantity_step)
     values ('10000000-0000-4000-a000-00000000000b', 'Intruder', 'kg', 1) $$,
  '42501', null, 'farmer A cannot insert a product into farm B');

select throws_ok(
  $$ select public.set_order_status(
       (select id from public.orders where tenant_id = '10000000-0000-4000-a000-00000000000b' limit 1),
       'CONFIRMED') $$,
  'P0001', 'ORDER_NOT_FOUND', 'farmer A cannot change the status of a farm B order');

select throws_ok(
  $$ select public.publish_cycle(
       (select id from public.weekly_cycles where tenant_id = '10000000-0000-4000-a000-00000000000b' and status = 'PUBLISHED')) $$,
  'P0001', 'CYCLE_NOT_FOUND', 'farmer A cannot publish/modify farm B weeks');

select throws_ok(
  $$ select public.copy_cycle(
       (select id from public.weekly_cycles where tenant_id = '10000000-0000-4000-a000-00000000000b' and status = 'PUBLISHED'),
       date_trunc('week', now())::date + 35) $$,
  'P0001', 'CYCLE_NOT_FOUND', 'farmer A cannot copy farm B weeks');

select throws_ok(
  $$ update public.tenants set active = false where id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'farmer cannot (de)activate their own farm');

select throws_ok(
  $$ update public.tenants set next_order_number = 1 where id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'farmer cannot change the order number counter');

select throws_ok(
  $$ update public.availability_items set ordered_quantity = 0 where tenant_id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'farmer cannot write ordered_quantity directly');

select throws_ok(
  $$ update public.orders set status = 'DELIVERED' where tenant_id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'farmer cannot update orders directly (only via set_order_status)');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('product-images', '10000000-0000-4000-a000-00000000000b/x.jpg') $$,
  '42501', null, 'farmer A cannot upload into farm B''s storage folder');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('product-images', '10000000-0000-4000-a000-00000000000a/x.jpg') $$,
  'farmer A can upload into farm A''s storage folder');

select lives_ok(
  $$ update public.products set description = 'Updated' where tenant_id = '10000000-0000-4000-a000-00000000000a' $$,
  'farmer A can update farm A''s products');

-- Verify as superuser that the silent (0-row) writes changed nothing.
reset role;
select is((select count(*)::int from public.products where name = 'Hacked'), 0,
  'farm B products unchanged');
select is((select count(*)::int from public.tenants where name = 'Hacked'), 0,
  'farm B tenant unchanged');
select is((select count(*)::int from public.customers where tenant_id = pg_temp.farm_b() and not active), 0,
  'farm B customers unchanged');
select ok((select count(*) from public.availability_items where tenant_id = pg_temp.farm_b()) >= 3,
  'farm B availability items not deleted');

select * from finish();
rollback;
