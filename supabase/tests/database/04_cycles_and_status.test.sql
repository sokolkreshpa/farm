-- Weekly cycles (copy / publish / close) and order status rules (spec §29 Farmer).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.cycle() returns uuid language sql stable as $$
  select id from public.weekly_cycles
  where tenant_id = '10000000-0000-4000-a000-00000000000a' and status = 'PUBLISHED'
$$;
create function pg_temp.order_id(p_number int) returns uuid language sql stable as $$
  select id from public.orders
  where tenant_id = '10000000-0000-4000-a000-00000000000a' and order_number = p_number
$$;
create table pg_temp.vars (k text primary key, v text);
grant all on pg_temp.vars to authenticated;
grant execute on all functions in schema pg_temp to authenticated;

select pg_temp.login('00000000-0000-4000-a000-000000000002'); -- farmer A

-- ================================================================ Copy last week
insert into pg_temp.vars
select 'next_week', ((select week_start from public.weekly_cycles where id = pg_temp.cycle()) + 7)::text;
insert into pg_temp.vars
select 'new_cycle', public.copy_cycle(pg_temp.cycle(), (select v::date from pg_temp.vars where k = 'next_week'))::text;

create function pg_temp.new_cycle() returns uuid language sql stable as $$
  select v::uuid from pg_temp.vars where k = 'new_cycle'
$$;
grant execute on function pg_temp.new_cycle() to authenticated;

select is((select status::text from public.weekly_cycles where id = pg_temp.new_cycle()), 'DRAFT',
  'copied week starts as DRAFT');
select is((select count(*)::int from public.availability_items where cycle_id = pg_temp.new_cycle()), 13,
  'all 13 items of this week are copied');
select is((select sum(ordered_quantity) from public.availability_items where cycle_id = pg_temp.new_cycle()), 0.000::numeric,
  'copied items start with nothing ordered');
select is(
  (select price from public.availability_items ai join public.products p on p.id = ai.product_id
   where ai.cycle_id = pg_temp.new_cycle() and p.name = 'Domate'),
  250.00::numeric, 'prices are copied');
select is(
  (select to_char(order_deadline at time zone 'Europe/Tirane', 'ID HH24:MI') from public.weekly_cycles where id = pg_temp.new_cycle()),
  (select to_char(order_deadline at time zone 'Europe/Tirane', 'ID HH24:MI') from public.weekly_cycles where id = pg_temp.cycle()),
  'deadline keeps the same weekday and local time');
select throws_ok(
  $$ select public.copy_cycle(pg_temp.cycle(), (select v::date from pg_temp.vars where k = 'next_week')) $$,
  'P0001', 'CYCLE_EXISTS', 'cannot create the same week twice');
select throws_ok(
  $$ select public.copy_cycle(pg_temp.cycle(), (select v::date + 1 from pg_temp.vars where k = 'next_week')) $$,
  'P0001', 'INVALID_WEEK_START', 'weeks start on Monday');

-- ================================================================ Draft is private, status only via functions
select throws_ok(
  $$ update public.weekly_cycles set status = 'PUBLISHED' where id = pg_temp.new_cycle() $$,
  '42501', null, 'status cannot be changed by a direct update');
select throws_ok(
  $$ insert into public.weekly_cycles (tenant_id, week_start, order_deadline, status)
     values ('10000000-0000-4000-a000-00000000000a', '2030-01-07', now() + interval '1 day', 'PUBLISHED') $$,
  '42501', null, 'a week cannot be inserted as already published');

-- ================================================================ Publish
update public.weekly_cycles set order_deadline = now() - interval '1 hour' where id = pg_temp.new_cycle();
select throws_ok($$ select public.publish_cycle(pg_temp.new_cycle()) $$,
  'P0001', 'DEADLINE_IN_PAST', 'cannot publish with a deadline in the past');
update public.weekly_cycles set order_deadline = now() + interval '8 days' where id = pg_temp.new_cycle();

insert into pg_temp.vars select 'old_cycle', pg_temp.cycle()::text;
select lives_ok($$ select public.publish_cycle(pg_temp.new_cycle()) $$, 'farmer publishes next week');
select is((select status::text from public.weekly_cycles where id = (select v::uuid from pg_temp.vars where k = 'old_cycle')),
  'CLOSED', 'publishing next week closes the previous week');
select is((select count(*)::int from public.weekly_cycles
           where tenant_id = '10000000-0000-4000-a000-00000000000a' and status = 'PUBLISHED'), 1,
  'only one published week per farm');

-- ================================================================ Stock guard
reset role;
update public.availability_items set ordered_quantity = 5
where cycle_id = pg_temp.new_cycle()
  and product_id = (select id from public.products where name = 'Domate' and tenant_id = '10000000-0000-4000-a000-00000000000a');
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok(
  $$ update public.availability_items set available_quantity = 4
     where cycle_id = pg_temp.new_cycle()
       and product_id = (select id from public.products where name = 'Domate'
                         and tenant_id = '10000000-0000-4000-a000-00000000000a') $$,
  'P0001', 'AVAILABLE_BELOW_ORDERED', 'cannot set available below what is already ordered');

-- ================================================================ Order status
select lives_ok($$ select public.set_order_status(pg_temp.order_id(1011), 'READY') $$,
  'farmer can skip forward (PLACED -> READY)');
select throws_ok($$ select public.set_order_status(pg_temp.order_id(1011), 'CONFIRMED') $$,
  'P0001', 'INVALID_STATUS_TRANSITION', 'status cannot move backwards');
select lives_ok($$ select public.set_order_status(pg_temp.order_id(1011), 'DELIVERED') $$,
  'farmer marks an order delivered');
select throws_ok($$ select public.set_order_status(pg_temp.order_id(1011), 'CANCELLED') $$,
  'P0001', 'ORDER_FINAL', 'delivered orders are final');

select lives_ok($$ select public.set_order_status(pg_temp.order_id(1012), 'CANCELLED', 'Customer called') $$,
  'farmer cancels an order');
select is(
  (select ordered_quantity from public.availability_items ai join public.products p on p.id = ai.product_id
   where ai.cycle_id = (select v::uuid from pg_temp.vars where k = 'old_cycle') and p.name = 'Karota'),
  0.000::numeric, 'cancelling releases the reserved stock');
select is(
  (select string_agg(coalesce(from_status::text, '-') || '>' || to_status::text, ',' order by created_at, to_status)
   from public.order_status_history where order_id = pg_temp.order_id(1011)),
  '->PLACED,PLACED>READY,READY>DELIVERED', 'status history is recorded');

reset role;
select is(
  (select count(*)::int from public.notifications where status = 'PENDING' and event = 'ORDER_STATUS_CHANGED'), 3,
  'READY, DELIVERED and CANCELLED each queue a customer notification');

select * from finish();
rollback;
