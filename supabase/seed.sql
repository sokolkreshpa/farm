-- =============================================================================
-- Local / staging seed data. NEVER run in production.
-- Password for every seeded user: Password123
--
-- Orders are created through the real place_order() / set_order_status()
-- functions (impersonating users via request.jwt.claims), so the seed also
-- exercises the business rules.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users (auth.users -> trigger creates profiles; tenant_slug links customers)
-- -----------------------------------------------------------------------------
create temporary table seed_users (
  id uuid, email text, first_name text, last_name text, phone text, locale text, tenant_slug text
);

insert into seed_users values
  ('00000000-0000-4000-a000-000000000001', 'admin@example.com',    'Platform', 'Admin',   null,          'en', null),
  ('00000000-0000-4000-a000-000000000002', 'farmer.a@example.com', 'Arben',    'Kodra',   '0691112233',  'sq', null),
  ('00000000-0000-4000-a000-000000000003', 'farmer.b@example.com', 'Besnik',   'Fusha',   '0692223344',  'sq', null),
  ('00000000-0000-4000-a000-000000000101', 'ana@example.com',      'Ana',      'Hoxha',   '0681234567',  'sq', 'ferma-kodra'),
  ('00000000-0000-4000-a000-000000000102', 'bledi@example.com',    'Bledi',    'Shehu',   '0672345678',  'sq', 'ferma-kodra'),
  ('00000000-0000-4000-a000-000000000103', 'drita@example.com',    'Drita',    'Leka',    '0693456789',  'en', 'ferma-kodra'),
  ('00000000-0000-4000-a000-000000000104', 'erion@example.com',    'Erion',    'Marku',   '0684567890',  'sq', 'ferma-kodra'),
  ('00000000-0000-4000-a000-000000000105', 'fatjona@example.com',  'Fatjona',  'Dervishi','0695678901',  'sq', 'ferma-kodra'),
  ('00000000-0000-4000-a000-000000000106', 'gent@example.com',     'Gent',     'Prifti',  '0696789012',  'sq', 'ferma-fusha');

-- Tenants first, so the sign-up trigger can link customers by slug.
insert into public.tenants (
  id, name, slug, description, phone, email, address,
  delivery_information, pickup_information, delivery_fee
) values
  ('10000000-0000-4000-a000-00000000000a',
   'Ferma Kodra e Gjelbër', 'ferma-kodra',
   'Perime dhe fruta të freskëta nga kodrat e Petrelës. Pa kimikate, të vjela çdo javë.',
   '0691112233', 'ferma.kodra@example.com', 'Petrelë, Tiranë',
   'Dërgojmë të shtunën në mëngjes në Tiranë (08:00–12:00).',
   'Merreni në fermë të premten 16:00–19:00 ose të shtunën 09:00–12:00.',
   200),
  ('10000000-0000-4000-a000-00000000000b',
   'Ferma Fusha', 'ferma-fusha',
   'Bulmet dhe vezë nga fusha e Myzeqesë.',
   '0692223344', 'ferma.fusha@example.com', 'Fier',
   'Dërgesë në Fier të enjten.', null,
   150);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Password123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'first_name', u.first_name, 'last_name', u.last_name, 'phone', u.phone,
    'preferred_locale', u.locale, 'privacy_accepted', true, 'tenant_slug', u.tenant_slug
  )),
  now(), now(), '', '', '', ''
from seed_users u;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from seed_users u;

-- Roles and memberships (normally done by the platform admin with the service role).
update public.profiles set role = 'PLATFORM_ADMIN' where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set role = 'FARMER'
  where id in ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003');

insert into public.tenant_members (tenant_id, profile_id) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000002'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-000000000003');

-- Erion is a customer of both farms (multi-farm ready).
insert into public.customers (tenant_id, profile_id)
values ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-000000000104');

-- Saved delivery addresses.
insert into public.addresses (profile_id, label, address_line, city, notes, is_default) values
  ('00000000-0000-4000-a000-000000000101', 'Shtëpia', 'Rr. Myslym Shyri 12', 'Tiranë', 'Kati 3, zilja "Hoxha"', true),
  ('00000000-0000-4000-a000-000000000102', 'Shtëpia', 'Rr. e Kavajës 45',    'Tiranë', null, true),
  ('00000000-0000-4000-a000-000000000103', 'Home',    'Rr. Ibrahim Rugova 7','Tiranë', 'Near the pharmacy', true),
  ('00000000-0000-4000-a000-000000000104', 'Puna',    'Bulevardi Zogu I 30', 'Tiranë', null, true),
  ('00000000-0000-4000-a000-000000000106', 'Shtëpia', 'Lagjja Apollonia, P. 4', 'Fier', null, true);

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
insert into public.products (id, tenant_id, name, description, category, unit_code, quantity_step, sort_order) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a', 'Domate',            'Domate fshati, të pjekura në diell.',      'Perime',          'kg',    0.5,  1),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000a', 'Kastravec',         'Kastravecë të freskët, të vjelë sot.',     'Perime',          'kg',    0.5,  2),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000a', 'Sallatë jeshile',   'Marule e butë.',                           'Perime',          'piece', 1,    3),
  ('20000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-00000000000a', 'Speca',             'Speca të ëmbël jeshilë dhe të kuq.',       'Perime',          'kg',    0.5,  4),
  ('20000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-00000000000a', 'Patate',            'Patate të verdha për çdo gatim.',          'Perime',          'kg',    1,    5),
  ('20000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-00000000000a', 'Qepë',              'Qepë të kuqe.',                            'Perime',          'kg',    0.5,  6),
  ('20000000-0000-4000-a000-000000000007', '10000000-0000-4000-a000-00000000000a', 'Karota',            'Karota të ëmbla.',                         'Perime',          'kg',    0.5,  7),
  ('20000000-0000-4000-a000-000000000008', '10000000-0000-4000-a000-00000000000a', 'Mollë',             'Mollë Golden nga Korça.',                  'Fruta',           'kg',    0.5,  8),
  ('20000000-0000-4000-a000-000000000009', '10000000-0000-4000-a000-00000000000a', 'Dardha',            'Dardha të lëngshme.',                      'Fruta',           'kg',    0.5,  9),
  ('20000000-0000-4000-a000-000000000010', '10000000-0000-4000-a000-00000000000a', 'Vezë fshati',       'Vezë nga pula që kullotin lirshëm.',       'Bulmet dhe vezë', 'dozen', 1,    10),
  ('20000000-0000-4000-a000-000000000011', '10000000-0000-4000-a000-00000000000a', 'Djathë i bardhë',   'Djathë dhie, i kripur lehtë.',             'Bulmet dhe vezë', 'kg',    0.25, 11),
  ('20000000-0000-4000-a000-000000000012', '10000000-0000-4000-a000-00000000000a', 'Gjizë',             'Gjizë e freskët.',                         'Bulmet dhe vezë', 'kg',    0.5,  12),
  ('20000000-0000-4000-a000-000000000013', '10000000-0000-4000-a000-00000000000a', 'Mjaltë mali',       'Kavanoz 500 g, mjaltë lulesh mali.',       'Të tjera',        'piece', 1,    13),
  ('20000000-0000-4000-a000-000000000014', '10000000-0000-4000-a000-00000000000a', 'Vaj ulliri',        'Vaj ulliri ekstra i virgjër, i shtrydhur në të ftohtë.', 'Të tjera', 'l', 0.5, 14),
  ('20000000-0000-4000-a000-000000000101', '10000000-0000-4000-a000-00000000000b', 'Qumësht lope',      'Qumësht i freskët.',                       'Bulmet dhe vezë', 'l',     1,    1),
  ('20000000-0000-4000-a000-000000000102', '10000000-0000-4000-a000-00000000000b', 'Vezë',              'Vezë fshati.',                             'Bulmet dhe vezë', 'dozen', 1,    2),
  ('20000000-0000-4000-a000-000000000103', '10000000-0000-4000-a000-00000000000b', 'Kos',               'Kos shtëpie.',                             'Bulmet dhe vezë', 'kg',    0.5,  3);

-- -----------------------------------------------------------------------------
-- Helper: place an order as a customer. Items: [["Product name", qty], ...]
-- -----------------------------------------------------------------------------
create function pg_temp.seed_place(
  p_email text, p_slug text, p_cycle uuid, p_method text, p_items text
) returns void
language plpgsql
as $$
declare
  v_profile uuid;
  v_address uuid;
  v_items   jsonb;
begin
  select id into v_profile from public.profiles where email = p_email;
  select id into v_address from public.addresses where profile_id = v_profile and is_default;

  select jsonb_agg(jsonb_build_object('availability_item_id', ai.id, 'quantity', (e ->> 1)::numeric))
  into v_items
  from jsonb_array_elements(p_items::jsonb) e
  join public.products p on p.name = e ->> 0
  join public.availability_items ai on ai.product_id = p.id and ai.cycle_id = p_cycle;

  perform set_config('request.jwt.claims', json_build_object('sub', v_profile, 'role', 'authenticated')::text, false);
  perform public.place_order(
    p_tenant_slug     => p_slug,
    p_cycle_id        => p_cycle,
    p_items           => v_items,
    p_delivery_method => p_method::public.delivery_method,
    p_phone           => (select phone from public.profiles where id = v_profile),
    p_idempotency_key => gen_random_uuid(),
    p_address_id      => case when p_method = 'DELIVERY' then v_address end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Weeks, availability and orders
-- -----------------------------------------------------------------------------
do $$
declare
  c_tz       constant text := 'Europe/Tirane';
  c_farm_a   constant uuid := '10000000-0000-4000-a000-00000000000a';
  c_farm_b   constant uuid := '10000000-0000-4000-a000-00000000000b';
  c_farmer_a constant uuid := '00000000-0000-4000-a000-000000000002';
  c_farmer_b constant uuid := '00000000-0000-4000-a000-000000000003';
  v_this_monday date := date_trunc('week', (now() at time zone c_tz))::date;
  v_week        date;
  v_prev_cycle  uuid;
  v_cycle       uuid;
  v_b_cycle     uuid;
  v_order       record;
  v_spec        record;
begin
  -- The "current" week is the one whose Thursday 20:00 deadline is still ahead.
  if now() < ((v_this_monday + 3) + time '20:00') at time zone c_tz then
    v_week := v_this_monday;
  else
    v_week := v_this_monday + 7;
  end if;

  -- Last week: created open so real orders can be placed, then closed.
  insert into public.weekly_cycles (tenant_id, week_start, order_deadline, message)
  values (c_farm_a, v_week - 7, now() + interval '1 hour', 'Dërgesa të shtunën në mëngjes.')
  returning id into v_prev_cycle;

  insert into public.availability_items (tenant_id, cycle_id, product_id, price, available_quantity, maximum_quantity, sort_order)
  select c_farm_a, v_prev_cycle, p.id, x.price, x.qty, x.max_qty, p.sort_order
  from public.products p
  join (values
    ('Domate', 220, 100, null), ('Kastravec', 180, 50, null), ('Sallatë jeshile', 100, 80, null),
    ('Speca', 200, 40, null), ('Patate', 90, 150, null), ('Qepë', 80, 60, null),
    ('Karota', 120, 40, null), ('Mollë', 150, 80, null), ('Vezë fshati', 400, 30, 3),
    ('Djathë i bardhë', 900, 15, 2), ('Mjaltë mali', 1200, 20, null)
  ) as x (name, price, qty, max_qty) on x.name = p.name
  where p.tenant_id = c_farm_a;

  -- This week: tomatoes went up 220 -> 250 (historical orders keep 220).
  insert into public.weekly_cycles (tenant_id, week_start, order_deadline, message)
  values (c_farm_a, v_week, ((v_week + 3) + time '20:00') at time zone c_tz,
          'Dërgesa të shtunën në mëngjes. Kjo javë: dardhat e para të sezonit!')
  returning id into v_cycle;

  insert into public.availability_items (tenant_id, cycle_id, product_id, price, available_quantity, maximum_quantity, sort_order)
  select c_farm_a, v_cycle, p.id, x.price, x.qty, x.max_qty, p.sort_order
  from public.products p
  join (values
    ('Domate', 250, 100, null), ('Kastravec', 180, 50, null), ('Sallatë jeshile', 100, 80, null),
    ('Speca', 220, 40, null), ('Patate', 90, 150, null), ('Qepë', 80, 60, null),
    ('Karota', 120, 40, null), ('Dardha', 180, 50, null), ('Vezë fshati', 400, 30, 3),
    ('Djathë i bardhë', 950, 12, 2), ('Gjizë', 500, 10, null), ('Mjaltë mali', 1200, 20, null),
    ('Vaj ulliri', 1100, 25, null)
  ) as x (name, price, qty, max_qty) on x.name = p.name
  where p.tenant_id = c_farm_a;
  -- Note: "Mollë" is not offered this week (demonstrates "no longer available").

  -- Farm B: one open week (used by tenant-isolation tests).
  insert into public.weekly_cycles (tenant_id, week_start, order_deadline)
  values (c_farm_b, v_week, ((v_week + 3) + time '20:00') at time zone c_tz)
  returning id into v_b_cycle;

  insert into public.availability_items (tenant_id, cycle_id, product_id, price, available_quantity)
  select c_farm_b, v_b_cycle, p.id, x.price, x.qty
  from public.products p
  join (values ('Qumësht lope', 120, 100), ('Vezë', 380, 40), ('Kos', 250, 30)) as x (name, price, qty)
    on x.name = p.name
  where p.tenant_id = c_farm_b;

  -- Publish last week (as farmer A) so orders can be placed on it.
  perform set_config('request.jwt.claims', json_build_object('sub', c_farmer_a, 'role', 'authenticated')::text, false);
  perform public.publish_cycle(v_prev_cycle);

  -- Last week's orders: (customer email, method, final status, items)
  for v_spec in
    select * from (values
      ('ana@example.com',     'DELIVERY', 'DELIVERED', '[["Domate",5],["Kastravec",2],["Sallatë jeshile",3],["Mollë",2]]'),
      ('bledi@example.com',   'PICKUP',   'DELIVERED', '[["Patate",5],["Qepë",2],["Vezë fshati",2]]'),
      ('drita@example.com',   'DELIVERY', 'DELIVERED', '[["Domate",3],["Speca",1.5],["Djathë i bardhë",1]]'),
      ('erion@example.com',   'DELIVERY', 'DELIVERED', '[["Mollë",3],["Karota",2],["Mjaltë mali",1]]'),
      ('fatjona@example.com', 'PICKUP',   'DELIVERED', '[["Domate",2],["Kastravec",1],["Sallatë jeshile",2]]'),
      ('ana@example.com',     'PICKUP',   'CANCELLED', '[["Vezë fshati",1]]'),
      ('bledi@example.com',   'PICKUP',   'DELIVERED', '[["Domate",4],["Mollë",2]]'),
      ('drita@example.com',   'PICKUP',   'DELIVERED', '[["Patate",3],["Karota",1]]')
    ) as s (email, method, final_status, items)
  loop
    perform pg_temp.seed_place(v_spec.email, 'ferma-kodra', v_prev_cycle, v_spec.method, v_spec.items);
  end loop;

  -- Move last week's orders to their final status as farmer A.
  perform set_config('request.jwt.claims', json_build_object('sub', c_farmer_a, 'role', 'authenticated')::text, false);
  for v_order in
    select o.id, row_number() over (order by o.order_number) as rn
    from public.orders o where o.cycle_id = v_prev_cycle
  loop
    perform public.set_order_status(v_order.id, case when v_order.rn = 6 then 'CANCELLED' else 'DELIVERED' end::public.order_status);
  end loop;

  -- Publish this week (closes last week automatically).
  perform public.publish_cycle(v_cycle);

  -- Close last week properly in the past.
  update public.weekly_cycles
  set order_deadline = ((v_week - 7 + 3) + time '20:00') at time zone c_tz,
      published_at = ((v_week - 7 - 2) + time '18:00') at time zone c_tz,
      closed_at = ((v_week - 7 + 3) + time '20:00') at time zone c_tz
  where id = v_prev_cycle;

  -- This week's orders.
  for v_spec in
    select * from (values
      ('ana@example.com',     'DELIVERY', '[["Domate",5],["Kastravec",2],["Sallatë jeshile",3],["Dardha",2]]'),
      ('bledi@example.com',   'PICKUP',   '[["Patate",5],["Qepë",2],["Vezë fshati",2],["Gjizë",1]]'),
      ('drita@example.com',   'DELIVERY', '[["Domate",2.5],["Speca",1],["Djathë i bardhë",0.75],["Vaj ulliri",1]]'),
      ('erion@example.com',   'DELIVERY', '[["Karota",2],["Mjaltë mali",2],["Dardha",1.5]]'),
      ('fatjona@example.com', 'PICKUP',   '[["Domate",3],["Kastravec",1.5],["Sallatë jeshile",2]]')
    ) as s (email, method, items)
  loop
    perform pg_temp.seed_place(v_spec.email, 'ferma-kodra', v_cycle, v_spec.method, v_spec.items);
  end loop;

  -- Two of this week's orders already confirmed by the farmer.
  perform set_config('request.jwt.claims', json_build_object('sub', c_farmer_a, 'role', 'authenticated')::text, false);
  for v_order in
    select o.id from public.orders o where o.cycle_id = v_cycle order by o.order_number limit 2
  loop
    perform public.set_order_status(v_order.id, 'CONFIRMED');
  end loop;

  -- Farm B: publish and one order from Gent.
  perform set_config('request.jwt.claims', json_build_object('sub', c_farmer_b, 'role', 'authenticated')::text, false);
  perform public.publish_cycle(v_b_cycle);
  perform pg_temp.seed_place('gent@example.com', 'ferma-fusha', v_b_cycle, 'DELIVERY', '[["Qumësht lope",4],["Vezë",1],["Kos",1]]');

  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- Seeded notifications are not real; never send them.
update public.notifications set status = 'SENT', sent_at = now();

