-- Notification outbox: written in the same transaction as the order, leased by
-- claim_notifications(), never readable or claimable by clients.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- Two fresh pending notifications (seeded ones are already SENT).
insert into public.notifications (tenant_id, event, recipient, payload)
select '10000000-0000-4000-a000-00000000000a', 'ORDER_PLACED_CUSTOMER', 'a@example.com', '{}'::jsonb
from generate_series(1, 2);

select is(
  (select count(*)::int from public.claim_notifications(10)), 2,
  'claim returns the due notifications');
select is(
  (select count(*)::int from public.notifications where status = 'PENDING' and attempts = 1), 2,
  'claiming increments attempts');
select is(
  (select count(*)::int from public.claim_notifications(10)), 0,
  'leased notifications are not claimed twice');

update public.notifications set next_attempt_at = now() - interval '1 second' where status = 'PENDING';
select is(
  (select count(*)::int from public.claim_notifications(1)), 1,
  'claim respects the limit');

select pg_temp.login('00000000-0000-4000-a000-000000000002'); -- farmer A
select throws_ok($$ select * from public.claim_notifications(10) $$, '42501', null,
  'clients cannot claim notifications');
select throws_ok($$ select * from public.notifications $$, '42501', null,
  'clients cannot read the outbox');
select throws_ok(
  $$ insert into public.notifications (tenant_id, event, recipient)
     values ('10000000-0000-4000-a000-00000000000a', 'X', 'x@example.com') $$,
  '42501', null, 'clients cannot write to the outbox');

select * from finish();
rollback;
