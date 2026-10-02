-- GDPR / Law 124/2024: process an account deletion request (listed on /admin).
-- Run in the Supabase SQL editor as postgres. Set the profile id below.
--
-- Orders are kept for the farm's bookkeeping but stripped of personal data;
-- the login is disabled and the e-mail freed. A person without orders is
-- deleted completely.

do $$
declare
  v_profile uuid := '00000000-0000-0000-0000-000000000000';  -- ← profile id from /admin
  v_email   text;
  v_alias   text;
begin
  select email into v_email from public.profiles where id = v_profile;
  if v_email is null then
    raise exception 'profile % not found', v_profile;
  end if;
  v_alias := 'deleted+' || v_profile || '@invalid.local';

  -- Order snapshots: keep quantities and money, drop personal data.
  update public.orders o
  set customer_name    = 'Klient i fshirë',
      customer_phone   = '-',
      customer_email   = v_alias,
      delivery_address = case when o.delivery_address is null then null else '(fshirë)' end,
      delivery_city    = null,
      delivery_notes   = null,
      notes            = null
  from public.customers c
  where c.id = o.customer_id and c.profile_id = v_profile;

  delete from public.notifications where recipient = v_email;
  delete from public.addresses where profile_id = v_profile;
  delete from public.customer_notes n
  using public.customers c
  where c.id = n.customer_id and c.profile_id = v_profile;
  update public.customers set active = false where profile_id = v_profile;

  if exists (
    select 1 from public.orders o
    join public.customers c on c.id = o.customer_id
    where c.profile_id = v_profile
  ) then
    -- Keep the (now anonymous) records the orders point to; disable login.
    update public.profiles
    set first_name = 'Klient', last_name = 'i fshirë', phone = null,
        deletion_requested_at = null
    where id = v_profile;
    update auth.users
    set email = v_alias, phone = null, raw_user_meta_data = '{}'::jsonb,
        banned_until = 'infinity'
    where id = v_profile;  -- trigger syncs profiles.email
    delete from auth.identities where user_id = v_profile;
  else
    delete from public.customers where profile_id = v_profile;
    delete from auth.users where id = v_profile;  -- cascades to profiles
  end if;
end $$;
