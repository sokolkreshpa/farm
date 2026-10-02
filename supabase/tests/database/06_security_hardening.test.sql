-- Regression tests for the Phase 7 security review (D-71 … D-76).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

-- A farm B customer id, looked up as superuser (farmer A cannot see it).
create table pg_temp.farm_b_customer as
select id from public.customers where tenant_id = '10000000-0000-4000-a000-00000000000b' limit 1;
grant select on pg_temp.farm_b_customer to authenticated;

-- Farmer A writes a private note about Ana.
insert into public.customer_notes (tenant_id, customer_id, notes)
select tenant_id, id, 'Paguan gjithmonë me vonesë'
from public.customers
where tenant_id = '10000000-0000-4000-a000-00000000000a'
  and profile_id = '00000000-0000-4000-a000-000000000101';

-- ------------------------------------------------------------- D-71 notes
select pg_temp.login('00000000-0000-4000-a000-000000000101'); -- Ana
select is((select count(*)::int from public.customer_notes), 0,
  'a customer cannot read the farmer''s notes about them');
select throws_ok($$ select farmer_notes from public.customers $$, '42703', null,
  'farmer notes are no longer on the customer-readable table');

select pg_temp.login('00000000-0000-4000-a000-000000000002'); -- farmer A
select is((select count(*)::int from public.customer_notes), 1,
  'the farmer reads their own notes');
select throws_ok(
  $$ insert into public.customer_notes (tenant_id, customer_id, notes)
     select '10000000-0000-4000-a000-00000000000b', id, 'x' from pg_temp.farm_b_customer $$,
  '42501', null, 'farmer A cannot write notes for farm B customers');

select pg_temp.login('00000000-0000-4000-a000-000000000003'); -- farmer B
select is((select count(*)::int from public.customer_notes), 0,
  'farmer B cannot read farm A notes');

-- ------------------------------------------------------- D-72 order counter
select pg_temp.login_anon();
select throws_ok($$ select next_order_number from public.tenants $$, '42501', null,
  'anon cannot read the order counter');
select lives_ok($$ select name, slug, delivery_fee from public.tenants $$,
  'anon can still read public farm details');

-- ---------------------------------------------- D-73 confirmed sign-ups only
reset role;
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000999',
  'authenticated', 'authenticated', 'spam@example.com',
  '{"first_name": "Spam", "tenant_slug": "ferma-kodra"}', now(), now(), '', '', '', '');
select is(
  (select count(*)::int from public.customers where profile_id = '00000000-0000-4000-a000-000000000999'), 0,
  'an unconfirmed sign-up is not linked to the farm');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-a000-000000000999';
select is(
  (select count(*)::int from public.customers where profile_id = '00000000-0000-4000-a000-000000000999'), 1,
  'confirming the e-mail links the customer to the farm');

-- --------------------------------------------- D-74 admin cannot be demoted
select throws_ok(
  $$ select public.create_farm_with_owner('X', 'ferma-x', '', '', '00000000-0000-4000-a000-000000000001') $$,
  'P0001', 'OWNER_IS_ADMIN', 'a platform admin cannot become a farm owner by accident');
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok(
  $$ select public.create_farm_with_owner('X', 'ferma-x', '', '', '00000000-0000-4000-a000-000000000002') $$,
  '42501', null, 'farmers cannot create farms');

-- ------------------------------------------------------ D-75 image paths
select throws_ok(
  $$ update public.products set image_path = '../../evil.png'
     where tenant_id = '10000000-0000-4000-a000-00000000000a' $$,
  '23514', null, 'image paths outside the farm folder are rejected');
select lives_ok(
  $$ update public.products
     set image_path = '10000000-0000-4000-a000-00000000000a/' || gen_random_uuid() || '.jpg'
     where id = '20000000-0000-4000-a000-000000000001' $$,
  'image paths inside the farm folder are accepted');

select * from finish();
rollback;
