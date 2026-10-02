-- =============================================================================
-- Core schema: types, tables, constraints, indexes.
-- See docs/database.md. RLS is enabled here; policies live in the next migration.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('CUSTOMER', 'FARMER', 'PLATFORM_ADMIN');
create type public.cycle_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED');
create type public.order_status as enum (
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'
);
create type public.delivery_method as enum ('DELIVERY', 'PICKUP');
create type public.notification_status as enum ('PENDING', 'SENT', 'FAILED');

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
create table public.tenants (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(name) between 1 and 120),
  slug                 text not null unique
                         check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                                and char_length(slug) between 3 and 50),
  description          text check (char_length(description) <= 2000),
  logo_path            text check (char_length(logo_path) <= 500),
  phone                text check (char_length(phone) <= 30),
  email                text check (char_length(email) <= 254),
  address              text check (char_length(address) <= 300),
  delivery_information text check (char_length(delivery_information) <= 2000),
  pickup_information   text check (char_length(pickup_information) <= 1000),
  delivery_enabled     boolean not null default true,
  pickup_enabled       boolean not null default true,
  delivery_fee         numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  currency             char(3) not null default 'ALL' check (currency ~ '^[A-Z]{3}$'),
  timezone             text not null default 'Europe/Tirane',
  enforce_inventory    boolean not null default true,
  next_order_number    integer not null default 1001 check (next_order_number > 0),
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tenants_fulfilment_method_check check (delivery_enabled or pickup_enabled)
);

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  role                public.app_role not null default 'CUSTOMER',
  first_name          text not null check (char_length(first_name) between 1 and 80),
  last_name           text not null default '' check (char_length(last_name) <= 80),
  phone               text check (char_length(phone) <= 30),
  email               text not null check (char_length(email) <= 254),
  preferred_locale    text not null default 'sq' check (preferred_locale in ('sq', 'en')),
  privacy_accepted_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- tenant_members (farmer <-> farm)
-- -----------------------------------------------------------------------------
create table public.tenant_members (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, profile_id)
);
create index tenant_members_profile_id_idx on public.tenant_members (profile_id);

-- -----------------------------------------------------------------------------
-- customers (person <-> farm)
-- -----------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete restrict,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  farmer_notes text check (char_length(farmer_notes) <= 2000),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, profile_id),
  unique (tenant_id, id)
);
create index customers_profile_id_idx on public.customers (profile_id);

-- -----------------------------------------------------------------------------
-- addresses (profile-owned, private to the customer)
-- -----------------------------------------------------------------------------
create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  label        text check (char_length(label) <= 50),
  address_line text not null check (char_length(address_line) between 1 and 300),
  city         text not null check (char_length(city) between 1 and 100),
  notes        text check (char_length(notes) <= 500),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index addresses_profile_id_idx on public.addresses (profile_id);
create unique index addresses_one_default_per_profile
  on public.addresses (profile_id) where is_default;

-- -----------------------------------------------------------------------------
-- units (global reference data)
-- -----------------------------------------------------------------------------
create table public.units (
  code         text primary key check (code ~ '^[a-z]+$'),
  default_step numeric(10, 3) not null check (default_step > 0),
  sort_order   smallint not null
);

insert into public.units (code, default_step, sort_order) values
  ('kg',    0.5, 1),
  ('g',     100, 2),
  ('piece', 1,   3),
  ('l',     0.5, 4),
  ('box',   1,   5),
  ('dozen', 1,   6);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete restrict,
  name          text not null check (char_length(name) between 1 and 120),
  description   text check (char_length(description) <= 1000),
  category      text check (char_length(category) <= 50),
  unit_code     text not null references public.units (code),
  quantity_step numeric(10, 3) not null check (quantity_step > 0),
  image_path    text check (char_length(image_path) <= 500),
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index products_tenant_name_uniq on public.products (tenant_id, lower(name));
create index products_tenant_active_idx on public.products (tenant_id, active, sort_order);

-- -----------------------------------------------------------------------------
-- weekly_cycles
-- -----------------------------------------------------------------------------
create table public.weekly_cycles (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete restrict,
  week_start     date not null check (extract(isodow from week_start) = 1),
  week_end       date generated always as (week_start + 6) stored,
  order_deadline timestamptz not null,
  status         public.cycle_status not null default 'DRAFT',
  message        text check (char_length(message) <= 500),
  published_at   timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, week_start)
);
create unique index weekly_cycles_one_published_per_tenant
  on public.weekly_cycles (tenant_id) where status = 'PUBLISHED';

-- -----------------------------------------------------------------------------
-- availability_items (product offered in a week: price + stock)
-- -----------------------------------------------------------------------------
create table public.availability_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  cycle_id           uuid not null,
  product_id         uuid not null,
  price              numeric(12, 2) not null check (price >= 0),
  available_quantity numeric(10, 3) not null check (available_quantity >= 0),
  ordered_quantity   numeric(10, 3) not null default 0 check (ordered_quantity >= 0),
  minimum_quantity   numeric(10, 3) check (minimum_quantity > 0),
  maximum_quantity   numeric(10, 3) check (maximum_quantity > 0),
  listed             boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  unique (cycle_id, product_id),
  foreign key (tenant_id, cycle_id)
    references public.weekly_cycles (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint availability_items_min_max_check
    check (minimum_quantity is null or maximum_quantity is null
           or minimum_quantity <= maximum_quantity)
);
create index availability_items_product_id_idx on public.availability_items (tenant_id, product_id);

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  cycle_id          uuid not null,
  customer_id       uuid not null,
  order_number      integer not null,
  status            public.order_status not null default 'PLACED',
  delivery_method   public.delivery_method not null,
  subtotal          numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee      numeric(12, 2) not null check (delivery_fee >= 0),
  total             numeric(12, 2) not null,
  currency          char(3) not null,
  customer_name     text not null check (char_length(customer_name) <= 200),
  customer_phone    text not null check (char_length(customer_phone) between 1 and 30),
  customer_email    text not null check (char_length(customer_email) <= 254),
  delivery_address  text check (char_length(delivery_address) <= 300),
  delivery_city     text check (char_length(delivery_city) <= 100),
  delivery_notes    text check (char_length(delivery_notes) <= 500),
  notes             text check (char_length(notes) <= 1000),
  idempotency_key   uuid not null,
  placed_at         timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, order_number),
  unique (customer_id, idempotency_key),
  foreign key (tenant_id, cycle_id)
    references public.weekly_cycles (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id) on delete restrict,
  constraint orders_total_check check (total = subtotal + delivery_fee),
  constraint orders_address_required_for_delivery
    check (delivery_method = 'PICKUP' or delivery_address is not null)
);
create index orders_tenant_cycle_status_idx on public.orders (tenant_id, cycle_id, status);
create index orders_customer_placed_idx on public.orders (customer_id, placed_at desc);

-- -----------------------------------------------------------------------------
-- order_items (snapshots of name, unit and price actually paid)
-- -----------------------------------------------------------------------------
create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  order_id              uuid not null,
  availability_item_id  uuid not null,
  product_id            uuid not null,
  product_name_snapshot text not null,
  unit_snapshot         text not null,
  quantity              numeric(10, 3) not null check (quantity > 0),
  unit_price            numeric(12, 2) not null check (unit_price >= 0),
  total_price           numeric(12, 2) not null,
  unique (order_id, availability_item_id),
  foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, availability_item_id)
    references public.availability_items (tenant_id, id) on delete restrict,
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint order_items_total_check check (total_price = round(quantity * unit_price, 2))
);
create index order_items_availability_item_idx on public.order_items (availability_item_id);
create index order_items_tenant_product_idx on public.order_items (tenant_id, product_id);

-- -----------------------------------------------------------------------------
-- order_status_history (audit trail)
-- -----------------------------------------------------------------------------
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  order_id    uuid not null,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- notifications (outbox; service role only)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  event           text not null,
  channel         text not null default 'email',
  recipient       text not null,
  locale          text not null default 'sq' check (locale in ('sq', 'en')),
  payload         jsonb not null default '{}'::jsonb,
  status          public.notification_status not null default 'PENDING',
  attempts        smallint not null default 0,
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_pending_idx on public.notifications (status, next_attempt_at);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.tenants
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.addresses
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.weekly_cycles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.availability_items
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Stock guard: available_quantity may not drop below ordered_quantity
-- when the tenant enforces inventory.
-- -----------------------------------------------------------------------------
create function private.availability_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.available_quantity < new.ordered_quantity
     and new.available_quantity is distinct from old.available_quantity
     and (select t.enforce_inventory from public.tenants t where t.id = new.tenant_id)
  then
    raise exception 'AVAILABLE_BELOW_ORDERED'
      using errcode = 'P0001',
            detail = format('ordered=%s', new.ordered_quantity);
  end if;
  return new;
end;
$$;

create trigger availability_items_guard before update on public.availability_items
  for each row execute function private.availability_items_guard();

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere (policies in the next migration).
-- -----------------------------------------------------------------------------
alter table public.tenants              enable row level security;
alter table public.profiles             enable row level security;
alter table public.tenant_members       enable row level security;
alter table public.customers            enable row level security;
alter table public.addresses            enable row level security;
alter table public.units                enable row level security;
alter table public.products             enable row level security;
alter table public.weekly_cycles        enable row level security;
alter table public.availability_items   enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.notifications        enable row level security;
