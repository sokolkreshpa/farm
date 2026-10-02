-- One-off: promote an existing account to platform admin (run in the Supabase
-- SQL editor of the target project, as postgres). The person first signs up
-- normally at /register and confirms their e-mail. There is deliberately no
-- UI path to become admin (docs/architecture.md §5).

update public.profiles
set role = 'PLATFORM_ADMIN'
where email = lower('admin@your-domain.example')  -- ← change me
returning id, email, role;
