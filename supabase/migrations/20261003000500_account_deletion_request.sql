-- GDPR: a customer can request deletion of their account from "My account"
-- (D-52). The platform admin processes requests; orders are kept anonymised
-- for the farm's bookkeeping.

alter table public.profiles
  add column deletion_requested_at timestamptz;

grant update (deletion_requested_at) on public.profiles to authenticated;
