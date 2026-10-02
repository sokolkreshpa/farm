-- =============================================================================
-- Row Level Security: helper functions, grants and policies.
-- RLS decides WHICH ROWS; column-level grants decide WHICH COLUMNS (D-32).
-- See docs/database.md §7.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lock down defaults. Supabase grants ALL on public tables to anon/authenticated
-- by default; we grant explicitly per table instead.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Policies call helpers in `private` as the requesting role. The schema is not
-- exposed through the Data API, so these are not callable over REST.
grant usage on schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER: read without recursing through RLS)
-- -----------------------------------------------------------------------------
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'PLATFORM_ADMIN'
  );
$$;

create function private.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id and profile_id = (select auth.uid())
  );
$$;

create function private.is_tenant_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tenants where id = p_tenant_id and active);
$$;

create function private.my_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.customers where profile_id = (select auth.uid());
$$;

create function private.is_my_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.customers c on c.id = o.customer_id
    where o.id = p_order_id and c.profile_id = (select auth.uid())
  );
$$;

-- True when the profile is a customer of a farm the caller is a member of.
create function private.is_customer_of_my_tenant(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers c
    join public.tenant_members m on m.tenant_id = c.tenant_id
    where c.profile_id = p_profile_id and m.profile_id = (select auth.uid())
  );
$$;

create function private.cycle_status_of(p_cycle_id uuid)
returns public.cycle_status
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.weekly_cycles where id = p_cycle_id;
$$;

grant execute on all functions in schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
grant select on public.tenants to anon, authenticated;
grant update (
  name, description, logo_path, phone, email, address,
  delivery_information, pickup_information, delivery_enabled, pickup_enabled,
  delivery_fee, enforce_inventory
) on public.tenants to authenticated;

create policy tenants_select on public.tenants
  for select to anon, authenticated
  using (active or private.is_tenant_member(id) or private.is_platform_admin());

create policy tenants_update_member on public.tenants
  for update to authenticated
  using (private.is_tenant_member(id))
  with check (private.is_tenant_member(id));

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, preferred_locale) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.is_customer_of_my_tenant(id)
    or private.is_platform_admin()
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- tenant_members (writes: service role only)
-- -----------------------------------------------------------------------------
grant select on public.tenant_members to authenticated;

create policy tenant_members_select on public.tenant_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_platform_admin());

-- -----------------------------------------------------------------------------
-- customers (inserted by the sign-up trigger or place_order)
-- -----------------------------------------------------------------------------
grant select on public.customers to authenticated;
grant update (farmer_notes, active) on public.customers to authenticated;

create policy customers_select on public.customers
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.is_tenant_member(tenant_id)
    or private.is_platform_admin()
  );

create policy customers_update_member on public.customers
  for update to authenticated
  using (private.is_tenant_member(tenant_id))
  with check (private.is_tenant_member(tenant_id));

-- -----------------------------------------------------------------------------
-- addresses (private to the owning profile)
-- -----------------------------------------------------------------------------
grant select, delete on public.addresses to authenticated;
grant insert (profile_id, label, address_line, city, notes, is_default)
  on public.addresses to authenticated;
grant update (label, address_line, city, notes, is_default)
  on public.addresses to authenticated;

create policy addresses_select_own on public.addresses
  for select to authenticated using (profile_id = (select auth.uid()));
create policy addresses_insert_own on public.addresses
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy addresses_update_own on public.addresses
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy addresses_delete_own on public.addresses
  for delete to authenticated using (profile_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- units (reference data)
-- -----------------------------------------------------------------------------
grant select on public.units to anon, authenticated;

create policy units_select on public.units
  for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
grant select on public.products to anon, authenticated;
grant insert (
  tenant_id, name, description, category, unit_code, quantity_step,
  image_path, active, sort_order
) on public.products to authenticated;
grant update (
  name, description, category, unit_code, quantity_step, image_path, active, sort_order
) on public.products to authenticated;
grant delete on public.products to authenticated;

create policy products_select on public.products
  for select to anon, authenticated
  using (
    (active and private.is_tenant_active(tenant_id))
    or private.is_tenant_member(tenant_id)
    or private.is_platform_admin()
  );

create policy products_insert_member on public.products
  for insert to authenticated with check (private.is_tenant_member(tenant_id));
create policy products_update_member on public.products
  for update to authenticated
  using (private.is_tenant_member(tenant_id))
  with check (private.is_tenant_member(tenant_id));
create policy products_delete_member on public.products
  for delete to authenticated using (private.is_tenant_member(tenant_id));

-- -----------------------------------------------------------------------------
-- weekly_cycles (status changes only via publish_cycle / close_cycle)
-- -----------------------------------------------------------------------------
grant select on public.weekly_cycles to anon, authenticated;
grant insert (tenant_id, week_start, order_deadline, message)
  on public.weekly_cycles to authenticated;
grant update (order_deadline, message) on public.weekly_cycles to authenticated;
grant delete on public.weekly_cycles to authenticated;

create policy weekly_cycles_select on public.weekly_cycles
  for select to anon, authenticated
  using (
    (status in ('PUBLISHED', 'CLOSED') and private.is_tenant_active(tenant_id))
    or private.is_tenant_member(tenant_id)
    or private.is_platform_admin()
  );

create policy weekly_cycles_insert_member on public.weekly_cycles
  for insert to authenticated
  with check (private.is_tenant_member(tenant_id) and status = 'DRAFT');
create policy weekly_cycles_update_member on public.weekly_cycles
  for update to authenticated
  using (private.is_tenant_member(tenant_id))
  with check (private.is_tenant_member(tenant_id));
create policy weekly_cycles_delete_member on public.weekly_cycles
  for delete to authenticated
  using (private.is_tenant_member(tenant_id) and status = 'DRAFT');

-- -----------------------------------------------------------------------------
-- availability_items (ordered_quantity only via DB functions)
-- -----------------------------------------------------------------------------
grant select on public.availability_items to anon, authenticated;
grant insert (
  tenant_id, cycle_id, product_id, price, available_quantity,
  minimum_quantity, maximum_quantity, listed, sort_order
) on public.availability_items to authenticated;
grant update (
  price, available_quantity, minimum_quantity, maximum_quantity, listed, sort_order
) on public.availability_items to authenticated;
grant delete on public.availability_items to authenticated;

create policy availability_items_select on public.availability_items
  for select to anon, authenticated
  using (
    (listed
      and private.cycle_status_of(cycle_id) in ('PUBLISHED', 'CLOSED')
      and private.is_tenant_active(tenant_id))
    or private.is_tenant_member(tenant_id)
    or private.is_platform_admin()
  );

create policy availability_items_insert_member on public.availability_items
  for insert to authenticated
  with check (
    private.is_tenant_member(tenant_id)
    and private.cycle_status_of(cycle_id) <> 'CLOSED'
  );
create policy availability_items_update_member on public.availability_items
  for update to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and private.cycle_status_of(cycle_id) <> 'CLOSED'
  )
  with check (private.is_tenant_member(tenant_id));
create policy availability_items_delete_member on public.availability_items
  for delete to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and private.cycle_status_of(cycle_id) <> 'CLOSED'
  );

-- -----------------------------------------------------------------------------
-- orders / order_items / order_status_history: read-only for clients.
-- Writes happen only in place_order() and set_order_status() (D-33).
-- -----------------------------------------------------------------------------
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_status_history to authenticated;

create policy orders_select on public.orders
  for select to authenticated
  using (
    customer_id in (select private.my_customer_ids())
    or private.is_tenant_member(tenant_id)
    or private.is_platform_admin()
  );

create policy order_items_select on public.order_items
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    or private.is_my_order(order_id)
    or private.is_platform_admin()
  );

create policy order_status_history_select on public.order_status_history
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    or private.is_my_order(order_id)
    or private.is_platform_admin()
  );

-- notifications: no grants, no policies -> service role only.

-- -----------------------------------------------------------------------------
-- Aggregated totals per product and week ("How much do I need to prepare?").
-- security_invoker: the caller's RLS applies to the underlying tables.
-- -----------------------------------------------------------------------------
create view public.farmer_cycle_product_totals
with (security_invoker = true)
as
select
  oi.tenant_id,
  o.cycle_id,
  oi.product_id,
  min(oi.product_name_snapshot) as product_name,
  min(oi.unit_snapshot)         as unit_code,
  sum(oi.quantity)              as total_quantity,
  count(distinct o.id)          as order_count,
  sum(oi.total_price)           as total_amount
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status <> 'CANCELLED'
group by oi.tenant_id, o.cycle_id, oi.product_id;

grant select on public.farmer_cycle_product_totals to authenticated;
