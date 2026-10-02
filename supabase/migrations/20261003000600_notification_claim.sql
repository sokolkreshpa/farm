-- =============================================================================
-- Notification outbox processing (D-39).
-- claim_notifications() leases up to p_limit due notifications: it bumps
-- attempts and pushes next_attempt_at forward so concurrent workers (the
-- after() hook and the retry cron) never send the same message twice.
-- Service role only.
-- =============================================================================

create function public.claim_notifications(p_limit integer default 20)
returns setof public.notifications
language sql
security definer
set search_path = ''
as $$
  update public.notifications n
  set attempts = n.attempts + 1,
      next_attempt_at = now() + interval '5 minutes'
  where n.id in (
    select id
    from public.notifications
    where status = 'PENDING' and next_attempt_at <= now()
    order by created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning n.*;
$$;

revoke all on function public.claim_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
