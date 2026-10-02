-- =============================================================================
-- Security hardening from the Phase 7 review (D-71 … D-77).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D-71: farmer notes are private to the farm. They lived on `customers`, which
-- the customer can read (own row). Move them to a members-only table.
-- -----------------------------------------------------------------------------
create table public.customer_notes (
  tenant_id   uuid not null,
  customer_id uuid not null,
  notes       text not null check (char_length(notes) <= 2000),
  updated_at  timestamptz not null default now(),
  primary key (customer_id),
  foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id) on delete cascade
);
create index customer_notes_tenant_idx on public.customer_notes (tenant_id);

create trigger set_updated_at before update on public.customer_notes
  for each row execute function private.set_updated_at();

insert into public.customer_notes (tenant_id, customer_id, notes)
select tenant_id, id, farmer_notes from public.customers
where farmer_notes is not null and farmer_notes <> '';

alter table public.customers drop column farmer_notes;

alter table public.customer_notes enable row level security;
grant select, delete on public.customer_notes to authenticated;
grant insert (tenant_id, customer_id, notes) on public.customer_notes to authenticated;
grant update (notes) on public.customer_notes to authenticated;

create policy customer_notes_select_member on public.customer_notes
  for select to authenticated
  using (private.is_tenant_member(tenant_id) or private.is_platform_admin());
create policy customer_notes_insert_member on public.customer_notes
  for insert to authenticated with check (private.is_tenant_member(tenant_id));
create policy customer_notes_update_member on public.customer_notes
  for update to authenticated
  using (private.is_tenant_member(tenant_id))
  with check (private.is_tenant_member(tenant_id));
create policy customer_notes_delete_member on public.customer_notes
  for delete to authenticated using (private.is_tenant_member(tenant_id));

-- Column grant for customers no longer includes farmer_notes (dropped above).
revoke update on public.customers from authenticated;
grant update (active) on public.customers to authenticated;

-- -----------------------------------------------------------------------------
-- D-72: don't expose each farm's order counter (business volume) publicly.
-- -----------------------------------------------------------------------------
revoke select on public.tenants from anon, authenticated;
grant select (
  id, name, slug, description, logo_path, phone, email, address,
  delivery_information, pickup_information, delivery_enabled, pickup_enabled,
  delivery_fee, currency, timezone, enforce_inventory, active, created_at, updated_at
) on public.tenants to anon, authenticated;

-- -----------------------------------------------------------------------------
-- D-73: only confirmed sign-ups become a farm's customers.
-- -----------------------------------------------------------------------------
create function private.link_customer_from_signup(p_user auth.users)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if p_user.email_confirmed_at is null
     or not coalesce(p_user.raw_user_meta_data, '{}'::jsonb) ? 'tenant_slug' then
    return;
  end if;
  select id into v_tenant_id
  from public.tenants
  where slug = p_user.raw_user_meta_data ->> 'tenant_slug' and active;
  if v_tenant_id is not null then
    insert into public.customers (tenant_id, profile_id)
    values (v_tenant_id, p_user.id)
    on conflict (tenant_id, profile_id) do nothing;
  end if;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text := v_meta ->> 'preferred_locale';
begin
  insert into public.profiles (
    id, first_name, last_name, phone, email, preferred_locale, privacy_accepted_at
  ) values (
    new.id,
    left(coalesce(nullif(trim(v_meta ->> 'first_name'), ''), split_part(new.email, '@', 1)), 80),
    left(coalesce(trim(v_meta ->> 'last_name'), ''), 80),
    left(nullif(trim(v_meta ->> 'phone'), ''), 30),
    coalesce(new.email, ''),
    case when v_locale in ('sq', 'en') then v_locale else 'sq' end,
    case when (v_meta ->> 'privacy_accepted')::boolean is true then now() end
  );
  perform private.link_customer_from_signup(new);
  return new;
end;
$$;

create function private.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.link_customer_from_signup(new);
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.handle_user_confirmed();

-- -----------------------------------------------------------------------------
-- D-74: create a farm and its owner atomically; never demote an admin.
-- -----------------------------------------------------------------------------
create function public.create_farm_with_owner(
  p_name text,
  p_slug text,
  p_phone text,
  p_email text,
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_tenant_id uuid;
begin
  select role into v_role from public.profiles where id = p_owner_id for update;
  if v_role is null then
    raise exception 'OWNER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_role = 'PLATFORM_ADMIN' then
    raise exception 'OWNER_IS_ADMIN' using errcode = 'P0001';
  end if;

  insert into public.tenants (name, slug, phone, email)
  values (p_name, p_slug, nullif(p_phone, ''), nullif(p_email, ''))
  returning id into v_tenant_id;

  update public.profiles set role = 'FARMER' where id = p_owner_id;
  insert into public.tenant_members (tenant_id, profile_id) values (v_tenant_id, p_owner_id);
  return v_tenant_id;
end;
$$;

revoke all on function public.create_farm_with_owner(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_farm_with_owner(text, text, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- D-75: image paths must point into the farm's own storage folder.
-- -----------------------------------------------------------------------------
alter table public.products add constraint products_image_path_in_tenant_folder
  check (image_path is null
         or image_path ~ ('^' || tenant_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));
alter table public.tenants add constraint tenants_logo_path_in_tenant_folder
  check (logo_path is null
         or logo_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));

-- -----------------------------------------------------------------------------
-- D-77: members can list their own folder (needed to delete replaced photos).
-- -----------------------------------------------------------------------------
create policy product_images_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_tenant_member(private.storage_tenant_id(name))
  );

-- -----------------------------------------------------------------------------
-- D-76: place_order only locks stock rows of the requested farm and week.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_tenant_slug     text,
  p_cycle_id        uuid,
  p_items           jsonb,
  p_delivery_method public.delivery_method,
  p_phone           text,
  p_idempotency_key uuid,
  p_address_id      uuid default null,
  p_delivery_notes  text default null,
  p_notes           text default null
)
returns table (order_id uuid, order_number integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid          uuid := auth.uid();
  v_tenant       public.tenants%rowtype;
  v_profile      public.profiles%rowtype;
  v_customer     public.customers%rowtype;
  v_cycle        public.weekly_cycles%rowtype;
  v_address      public.addresses%rowtype;
  v_existing     public.orders%rowtype;
  v_phone        text := nullif(trim(p_phone), '');
  v_order_id     uuid;
  v_order_number integer;
  v_subtotal     numeric(12, 2) := 0;
  v_fee          numeric(12, 2);
  v_line         record;
  v_line_count   integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_tenant from public.tenants where slug = p_tenant_slug and active;
  if not found then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  -- Find or create the customer record for this farm.
  insert into public.customers (tenant_id, profile_id)
  values (v_tenant.id, v_uid)
  on conflict (tenant_id, profile_id) do nothing;

  select * into v_customer
  from public.customers
  where tenant_id = v_tenant.id and profile_id = v_uid;

  if not v_customer.active then
    raise exception 'CUSTOMER_INACTIVE' using errcode = 'P0001';
  end if;

  -- Idempotency: serialise calls with the same key, return the existing order.
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_customer.id::text || ':' || p_idempotency_key::text, 0)
  );
  select * into v_existing
  from public.orders o
  where o.customer_id = v_customer.id and o.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.order_number;
    return;
  end if;

  -- The week must be open.
  select * into v_cycle
  from public.weekly_cycles c
  where c.id = p_cycle_id and c.tenant_id = v_tenant.id
  for share;
  if not found then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_cycle.status <> 'PUBLISHED' or now() >= v_cycle.order_deadline then
    raise exception 'CYCLE_CLOSED' using errcode = 'P0001';
  end if;

  -- Contact and delivery.
  if v_phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_phone) > 30 then
    raise exception 'PHONE_INVALID' using errcode = 'P0001';
  end if;

  if p_delivery_method = 'DELIVERY' then
    if not v_tenant.delivery_enabled then
      raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode = 'P0001';
    end if;
    select * into v_address
    from public.addresses a
    where a.id = p_address_id and a.profile_id = v_uid;
    if not found then
      raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001';
    end if;
    v_fee := v_tenant.delivery_fee;
  else
    if not v_tenant.pickup_enabled then
      raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode = 'P0001';
    end if;
    v_fee := 0;
  end if;

  -- Items: shape checks.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'P0001';
  end if;

  select count(*) into v_line_count
  from (
    select distinct r.availability_item_id
    from jsonb_to_recordset(p_items) as r (availability_item_id uuid, quantity numeric)
  ) d;
  if v_line_count <> jsonb_array_length(p_items) then
    raise exception 'DUPLICATE_ITEM' using errcode = 'P0001';
  end if;

  -- Lock the requested stock rows in a stable order to avoid deadlocks.
  perform 1
  from public.availability_items ai
  where ai.id in (
    select r.availability_item_id
    from jsonb_to_recordset(p_items) as r (availability_item_id uuid, quantity numeric)
  )
    and ai.tenant_id = v_tenant.id
    and ai.cycle_id = v_cycle.id
  order by ai.id
  for update;

  -- Validate every line and compute the subtotal from DB prices.
  for v_line in
    select
      r.availability_item_id as requested_id,
      r.quantity,
      ai.id                 as item_id,
      ai.price,
      ai.available_quantity,
      ai.ordered_quantity,
      ai.minimum_quantity,
      ai.maximum_quantity,
      ai.listed,
      p.active              as product_active,
      p.quantity_step
    from jsonb_to_recordset(p_items) as r (availability_item_id uuid, quantity numeric)
    left join public.availability_items ai
      on ai.id = r.availability_item_id
     and ai.cycle_id = v_cycle.id
     and ai.tenant_id = v_tenant.id
    left join public.products p
      on p.id = ai.product_id and p.tenant_id = v_tenant.id
  loop
    if v_line.item_id is null or not v_line.listed or not v_line.product_active then
      raise exception 'ITEM_NOT_AVAILABLE'
        using errcode = 'P0001', detail = coalesce(v_line.requested_id::text, '');
    end if;
    if v_line.quantity is null or v_line.quantity <= 0
       or v_line.quantity <> round(v_line.quantity, 3)
       or mod(v_line.quantity, v_line.quantity_step) <> 0 then
      raise exception 'INVALID_QUANTITY'
        using errcode = 'P0001', detail = v_line.item_id::text;
    end if;
    if v_line.minimum_quantity is not null and v_line.quantity < v_line.minimum_quantity then
      raise exception 'BELOW_MINIMUM'
        using errcode = 'P0001', detail = v_line.item_id::text;
    end if;
    if v_line.maximum_quantity is not null and v_line.quantity > v_line.maximum_quantity then
      raise exception 'ABOVE_MAXIMUM'
        using errcode = 'P0001', detail = v_line.item_id::text;
    end if;
    if v_tenant.enforce_inventory
       and v_line.ordered_quantity + v_line.quantity > v_line.available_quantity then
      raise exception 'INSUFFICIENT_STOCK'
        using errcode = 'P0001',
              detail = v_line.item_id::text || ':'
                       || greatest(v_line.available_quantity - v_line.ordered_quantity, 0)::text;
    end if;

    v_subtotal := v_subtotal + round(v_line.quantity * v_line.price, 2);
  end loop;

  -- Next per-tenant order number (row lock serialises numbering per farm).
  update public.tenants t
  set next_order_number = t.next_order_number + 1
  where t.id = v_tenant.id
  returning t.next_order_number - 1 into v_order_number;

  insert into public.orders (
    tenant_id, cycle_id, customer_id, order_number, status, delivery_method,
    subtotal, delivery_fee, total, currency,
    customer_name, customer_phone, customer_email,
    delivery_address, delivery_city, delivery_notes, notes, idempotency_key
  ) values (
    v_tenant.id, v_cycle.id, v_customer.id, v_order_number, 'PLACED', p_delivery_method,
    v_subtotal, v_fee, v_subtotal + v_fee, v_tenant.currency,
    trim(v_profile.first_name || ' ' || v_profile.last_name), v_phone, v_profile.email,
    case when p_delivery_method = 'DELIVERY' then v_address.address_line end,
    case when p_delivery_method = 'DELIVERY' then v_address.city end,
    left(nullif(trim(concat_ws(E'\n',
      case when p_delivery_method = 'DELIVERY' then nullif(trim(v_address.notes), '') end,
      nullif(trim(p_delivery_notes), ''))), ''), 500),
    left(nullif(trim(p_notes), ''), 1000),
    p_idempotency_key
  )
  returning id into v_order_id;

  insert into public.order_items (
    tenant_id, order_id, availability_item_id, product_id,
    product_name_snapshot, unit_snapshot, quantity, unit_price, total_price
  )
  select
    v_tenant.id, v_order_id, ai.id, p.id,
    p.name, p.unit_code, r.quantity, ai.price, round(r.quantity * ai.price, 2)
  from jsonb_to_recordset(p_items) as r (availability_item_id uuid, quantity numeric)
  join public.availability_items ai on ai.id = r.availability_item_id
  join public.products p on p.id = ai.product_id;

  update public.availability_items ai
  set ordered_quantity = ai.ordered_quantity + r.quantity
  from jsonb_to_recordset(p_items) as r (availability_item_id uuid, quantity numeric)
  where ai.id = r.availability_item_id;

  insert into public.order_status_history (tenant_id, order_id, from_status, to_status, changed_by)
  values (v_tenant.id, v_order_id, null, 'PLACED', v_uid);

  -- Outbox: confirmation to the customer, alert to every farmer of the farm.
  insert into public.notifications (tenant_id, event, recipient, locale, payload)
  values (
    v_tenant.id, 'ORDER_PLACED_CUSTOMER', v_profile.email, v_profile.preferred_locale,
    jsonb_build_object('order_id', v_order_id)
  );
  insert into public.notifications (tenant_id, event, recipient, locale, payload)
  select v_tenant.id, 'ORDER_PLACED_FARMER', fp.email, fp.preferred_locale,
         jsonb_build_object('order_id', v_order_id)
  from public.tenant_members m
  join public.profiles fp on fp.id = m.profile_id
  where m.tenant_id = v_tenant.id;

  return query select v_order_id, v_order_number;
end;
$$;
