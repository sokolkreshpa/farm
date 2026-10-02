-- =============================================================================
-- Business functions and auth triggers. See docs/database.md §6.
--
-- All business functions are SECURITY DEFINER and re-check the caller.
-- Errors are raised with a stable code in MESSAGE (e.g. 'CYCLE_CLOSED') and
-- optional context in DETAIL; the UI translates the code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auth: create a profile for every new auth user (role is always CUSTOMER).
-- If sign-up started on a farm page, link the profile to that farm.
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text := v_meta ->> 'preferred_locale';
  v_tenant_id uuid;
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

  if v_meta ? 'tenant_slug' then
    select id into v_tenant_id
    from public.tenants
    where slug = v_meta ->> 'tenant_slug' and active;

    if v_tenant_id is not null then
      insert into public.customers (tenant_id, profile_id)
      values (v_tenant_id, new.id)
      on conflict (tenant_id, profile_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_updated();

-- -----------------------------------------------------------------------------
-- place_order: the only way to create an order (D-21, D-33).
-- p_items: [{"availability_item_id": "<uuid>", "quantity": 2.5}, ...]
-- -----------------------------------------------------------------------------
create function public.place_order(
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

-- -----------------------------------------------------------------------------
-- set_order_status: farmer moves an order forward or cancels it (D-40).
-- Enum order PLACED < CONFIRMED < PREPARING < READY < DELIVERED is used for
-- "forward only"; DELIVERED and CANCELLED are final. Cancel releases stock.
-- -----------------------------------------------------------------------------
create function public.set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders%rowtype;
  v_locale text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.is_tenant_member(v_order.tenant_id) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_status = v_order.status then
    return;
  end if;
  if v_order.status in ('DELIVERED', 'CANCELLED') then
    raise exception 'ORDER_FINAL' using errcode = 'P0001';
  end if;
  if p_status <> 'CANCELLED' and p_status < v_order.status then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001';
  end if;

  if p_status = 'CANCELLED' then
    perform 1
    from public.availability_items ai
    where ai.id in (select oi.availability_item_id from public.order_items oi where oi.order_id = p_order_id)
    order by ai.id
    for update;

    update public.availability_items ai
    set ordered_quantity = greatest(ai.ordered_quantity - oi.quantity, 0)
    from public.order_items oi
    where oi.order_id = p_order_id and ai.id = oi.availability_item_id;
  end if;

  update public.orders
  set status = p_status, status_changed_at = now()
  where id = p_order_id;

  insert into public.order_status_history (tenant_id, order_id, from_status, to_status, changed_by, note)
  values (v_order.tenant_id, p_order_id, v_order.status, p_status, auth.uid(),
          left(nullif(trim(p_note), ''), 500));

  if p_status in ('CONFIRMED', 'READY', 'DELIVERED', 'CANCELLED') then
    select p.preferred_locale into v_locale
    from public.customers c
    join public.profiles p on p.id = c.profile_id
    where c.id = v_order.customer_id;

    insert into public.notifications (tenant_id, event, recipient, locale, payload)
    values (
      v_order.tenant_id, 'ORDER_STATUS_CHANGED', v_order.customer_email, coalesce(v_locale, 'sq'),
      jsonb_build_object('order_id', p_order_id, 'status', p_status)
    );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- publish_cycle: open a week for ordering; closes any other open week (D-34).
-- -----------------------------------------------------------------------------
create function public.publish_cycle(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.weekly_cycles%rowtype;
begin
  select * into v_cycle from public.weekly_cycles where id = p_cycle_id for update;
  if not found or not private.is_tenant_member(v_cycle.tenant_id) then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_cycle.status = 'PUBLISHED' then
    return;
  end if;
  if v_cycle.order_deadline <= now() then
    raise exception 'DEADLINE_IN_PAST' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.availability_items
    where cycle_id = p_cycle_id and listed
  ) then
    raise exception 'NO_LISTED_ITEMS' using errcode = 'P0001';
  end if;

  update public.weekly_cycles
  set status = 'CLOSED', closed_at = now()
  where tenant_id = v_cycle.tenant_id and status = 'PUBLISHED';

  update public.weekly_cycles
  set status = 'PUBLISHED', published_at = now(), closed_at = null
  where id = p_cycle_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- close_cycle: stop taking orders before the deadline.
-- -----------------------------------------------------------------------------
create function public.close_cycle(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.weekly_cycles%rowtype;
begin
  select * into v_cycle from public.weekly_cycles where id = p_cycle_id for update;
  if not found or not private.is_tenant_member(v_cycle.tenant_id) then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_cycle.status <> 'PUBLISHED' then
    raise exception 'CYCLE_NOT_PUBLISHED' using errcode = 'P0001';
  end if;

  update public.weekly_cycles
  set status = 'CLOSED', closed_at = now()
  where id = p_cycle_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- copy_cycle: "Copy last week". New DRAFT for p_week_start with the same
-- deadline weekday/time (in the farm's timezone) and the same items for
-- products that are still active. Returns the new cycle id.
-- -----------------------------------------------------------------------------
create function public.copy_cycle(p_source_cycle_id uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source   public.weekly_cycles%rowtype;
  v_timezone text;
  v_deadline timestamptz;
  v_new_id   uuid;
begin
  select * into v_source from public.weekly_cycles where id = p_source_cycle_id;
  if not found or not private.is_tenant_member(v_source.tenant_id) then
    raise exception 'CYCLE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'INVALID_WEEK_START' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.weekly_cycles
    where tenant_id = v_source.tenant_id and week_start = p_week_start
  ) then
    raise exception 'CYCLE_EXISTS' using errcode = 'P0001';
  end if;

  select timezone into v_timezone from public.tenants where id = v_source.tenant_id;

  -- Shift the deadline by whole days in local time (DST-safe).
  v_deadline := (
    (v_source.order_deadline at time zone v_timezone)
    + (p_week_start - v_source.week_start) * interval '1 day'
  ) at time zone v_timezone;

  insert into public.weekly_cycles (tenant_id, week_start, order_deadline, message)
  values (v_source.tenant_id, p_week_start, v_deadline, v_source.message)
  returning id into v_new_id;

  insert into public.availability_items (
    tenant_id, cycle_id, product_id, price, available_quantity,
    minimum_quantity, maximum_quantity, listed, sort_order
  )
  select
    ai.tenant_id, v_new_id, ai.product_id, ai.price, ai.available_quantity,
    ai.minimum_quantity, ai.maximum_quantity, ai.listed, ai.sort_order
  from public.availability_items ai
  join public.products p on p.id = ai.product_id
  where ai.cycle_id = p_source_cycle_id and p.active;

  return v_new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: business functions are for signed-in users only.
-- -----------------------------------------------------------------------------
revoke all on function public.place_order(text, uuid, jsonb, public.delivery_method, text, uuid, uuid, text, text) from public, anon;
revoke all on function public.set_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.publish_cycle(uuid) from public, anon;
revoke all on function public.close_cycle(uuid) from public, anon;
revoke all on function public.copy_cycle(uuid, date) from public, anon;

grant execute on function public.place_order(text, uuid, jsonb, public.delivery_method, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.publish_cycle(uuid) to authenticated;
grant execute on function public.close_cycle(uuid) to authenticated;
grant execute on function public.copy_cycle(uuid, date) to authenticated;
