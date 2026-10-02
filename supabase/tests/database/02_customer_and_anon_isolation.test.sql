-- Customer A must not see Customer B's private orders; anonymous visitors see
-- only the public shop (spec §21).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- A hidden DRAFT week for farm A.
insert into public.weekly_cycles (tenant_id, week_start, order_deadline)
values ('10000000-0000-4000-a000-00000000000a', date_trunc('week', now())::date + 28, now() + interval '30 days');

-- ============================================================== Customer Ana
select pg_temp.login('00000000-0000-4000-a000-000000000101');

select is((select count(*)::int from public.orders), 3,
  'Ana sees only her own 3 orders');
select is((select count(*)::int from public.orders where customer_email <> 'ana@example.com'), 0,
  'Ana cannot see other customers'' orders');
select is((select count(*)::int from public.order_items oi
           join public.orders o on o.id = oi.order_id), (select count(*)::int from public.order_items),
  'every order item Ana can see belongs to an order she can see');
select is((select count(*)::int from public.order_items), 9,
  'Ana sees only the 9 items of her own orders');
select is((select count(*)::int from public.order_status_history h
           where not exists (select 1 from public.orders o where o.id = h.order_id)), 0,
  'Ana sees history only for her own orders');
select is((select count(*)::int from public.profiles), 1,
  'Ana sees only her own profile');
select is((select count(*)::int from public.customers), 1,
  'Ana sees only her own customer record');
select is((select count(*)::int from public.addresses), 1,
  'Ana sees only her own address');
select is((select count(*)::int from public.weekly_cycles where status = 'DRAFT'), 0,
  'Ana cannot see draft weeks');
select is((select count(*)::int from public.tenant_members), 0,
  'Ana cannot see farm memberships');
select is(
  (select total_quantity from public.farmer_cycle_product_totals t
   join public.weekly_cycles c on c.id = t.cycle_id
   where c.status = 'PUBLISHED' and t.tenant_id = '10000000-0000-4000-a000-00000000000a'
     and t.product_name = 'Domate'),
  5.000::numeric,
  'aggregated totals only include Ana''s own quantities');

select throws_ok(
  $$ insert into public.orders (tenant_id, cycle_id, customer_id, order_number, delivery_method,
       subtotal, delivery_fee, total, currency, customer_name, customer_phone, customer_email, idempotency_key)
     select tenant_id, cycle_id, customer_id, 9999, 'PICKUP', 0, 0, 0, 'ALL', 'x', '1', 'x', gen_random_uuid()
     from public.orders limit 1 $$,
  '42501', null, 'customer cannot insert orders directly');
select throws_ok(
  $$ update public.orders set total = 0 $$,
  '42501', null, 'customer cannot modify orders');
select throws_ok(
  $$ update public.profiles set role = 'PLATFORM_ADMIN' where id = '00000000-0000-4000-a000-000000000101' $$,
  '42501', null, 'customer cannot change their own role');
select throws_ok(
  $$ select public.set_order_status((select id from public.orders limit 1), 'CANCELLED') $$,
  'P0001', 'ORDER_NOT_FOUND', 'customer cannot cancel or change their order (D-03)');
select throws_ok(
  $$ insert into public.addresses (profile_id, address_line, city)
     values ('00000000-0000-4000-a000-000000000102', 'x', 'y') $$,
  '42501', null, 'customer cannot add an address to another profile');
select throws_ok(
  $$ select * from public.notifications $$,
  '42501', null, 'customers cannot read the notification outbox');

-- ============================================================== Customer Gent (farm B only)
select pg_temp.login('00000000-0000-4000-a000-000000000106');
select is((select count(*)::int from public.orders), 1,
  'Gent sees only his own farm B order');

-- ============================================================== Anonymous visitor
select pg_temp.login_anon();

select is((select count(*)::int from public.products), 17,
  'anon sees active products of active farms');
select is((select count(*)::int from public.weekly_cycles), 3,
  'anon sees published/closed weeks only');
select is((select count(*)::int from public.availability_items ai
           join public.weekly_cycles c on c.id = ai.cycle_id where c.status = 'DRAFT'), 0,
  'anon cannot see draft availability');
select throws_ok($$ select * from public.orders $$, '42501', null, 'anon cannot read orders');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.customers $$, '42501', null, 'anon cannot read customers');
select throws_ok(
  $$ select public.place_order('ferma-kodra', gen_random_uuid(), '[]'::jsonb, 'PICKUP', '1', gen_random_uuid()) $$,
  '42501', null, 'anon cannot call place_order');

select * from finish();
rollback;
