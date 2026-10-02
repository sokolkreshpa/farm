# Architecture

Status: **Phase 1 draft — awaiting product-owner review.**
Related: [database.md](database.md) · [user-flows.md](user-flows.md) · [decisions.md](decisions.md) · [spec.md](spec.md)

---

## 1. Overview

A **modular monolith**: one Next.js 16 application deployed on Vercel, talking to one Supabase project (Postgres + Auth + Storage).
There is no separate backend service.

```text
 Browser (mobile-first UI, sq/en)
   │  HTML / RSC payloads, Server Action POSTs
   ▼
 Next.js on Vercel (fra1)
   ├─ proxy.ts ............ locale routing + Supabase session cookie refresh (no authorization here)
   ├─ Server Components ... read data through the Data Access Layer (DAL)
   ├─ Server Actions ...... mutations: Zod-validate → authorize in DAL → call DB
   ├─ Route Handlers ...... /api/auth/confirm, /api/cron/*, /api/health
   └─ lib/ ................ business logic, DAL, notifications (server-only)
   │  supabase-js with the *user's* JWT  → every query passes through RLS
   │  supabase-js with service role      → only for platform-admin + notification jobs, server-only
   ▼
 Supabase (EU region)
   ├─ Postgres: tables, RLS policies, SECURITY DEFINER functions (place_order, …)
   ├─ Auth: email + password, email confirmation, password reset
   └─ Storage: product-images bucket (public read, tenant-scoped write)
```

### Layers and responsibilities

| Layer                   | Location                           | Responsibility                                                                                                                   |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| UI                      | `app/[locale]/**`, `components/**` | Rendering, forms, client cart state. No business rules, no direct DB calls from client components.                               |
| Server Actions          | `app/**/actions.ts`                | Thin: parse input with Zod → call `lib/<domain>` → `revalidatePath`/`redirect`. Return typed, minimal results.                   |
| Domain logic            | `lib/<domain>/`                    | Pure functions (totals, repeat-order merge, aggregation formatting, week math) + domain services that call the DAL.              |
| Data Access Layer (DAL) | `lib/dal/`                         | `import "server-only"`. Session lookup (`getViewer()`), role/tenant checks (`requireFarmer()`), Supabase queries returning DTOs. |
| Database                | `supabase/migrations/`             | Source of truth for integrity: constraints, composite tenant FKs, RLS, and transactional functions for multi-row writes.         |

**Rule of thumb:** anything that must be true for _every_ client (stock limits, prices, tenant isolation, order totals) is enforced in Postgres. Next.js adds a second, friendlier layer (Zod messages, redirects), never the only one.

## 2. Frontend

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui (Radix).
- Server Components by default. Client Components only for interactivity: quantity steppers, cart drawer, forms.
- **i18n:** `next-intl`, locales `sq` (default, unprefixed) and `en` (`/en/...`). All UI text in `messages/*.json`; a unit test enforces key parity. Units, statuses and roles are translated by code (`Units.kg`, `OrderStatus.PLACED`).
- **Money and quantities** are formatted with `Intl.NumberFormat` using the tenant's `currency` and the active locale. ALL is shown without decimals.
- **Cart:** client-side (`localStorage`, keyed by tenant + cycle). It holds only `{availabilityItemId, quantity}`; prices shown are from the server-rendered offer and recomputed by the DB on submit. Cart lines that are no longer in the open week are dropped on load.
- **Forms:** React Hook Form + the same Zod schema used by the Server Action (`lib/validation/`).
- **Images:** Supabase Storage public URLs through `next/image` (remote pattern for the Supabase host).
- **Design:** warm cream background, leaf-green primary, Fraunces headings + Inter body, generous whitespace, large tap targets (≥ 44 px), product photos on simple cards.

## 3. Backend (inside Next.js)

- **Reads:** Server Components call DAL functions such as `getOpenWeekOffer(slug)` and `getFarmerOrderTotals(cycleId)`. DAL functions are wrapped in React `cache()` per request.
- **Writes:** Server Actions. Multi-row or invariant-sensitive writes call a Postgres function via `supabase.rpc()`:
  - `place_order`
  - `set_order_status`
  - `publish_cycle`, `close_cycle`
  - `copy_cycle`
    Simple single-row writes (product edit, profile edit) use normal table updates, which are still protected by RLS and column grants.
- **Route Handlers:**
  - `GET /api/auth/confirm`: email confirmation, password-reset token exchange.
  - `POST /api/cron/notifications`: Vercel Cron, retries failed notifications, protected by `CRON_SECRET`.
  - `GET /api/health`.
- **Server-only boundaries:** `lib/dal/**`, `lib/db/admin.ts` (service role) and `lib/notifications/**` import `server-only`, so importing them into a client bundle fails the build.

## 4. Database

Postgres via Supabase. Full schema in [database.md](database.md). Key points:

- **Shared schema, `tenant_id` column** on every tenant-owned table, so there is one database for all farms.
- **Composite tenant foreign keys**, e.g. `(tenant_id, product_id) → products(tenant_id, id)`. The database itself makes it impossible for a row of farm A to reference a row of farm B, even if application code has a bug.
- Price is stored on the **weekly availability item**, not on the product, so prices can change weekly. Order items **snapshot** name, unit and unit price.
- Stock is tracked as `available_quantity` and `ordered_quantity` on each availability item. `ordered_quantity` changes only inside `place_order()` and `set_order_status(... CANCELLED)`, under a row lock.
- Money: `numeric(12,2)`. Quantities: `numeric(10,3)`. Never floating point.
- All timestamps are `timestamptz`. Week dates are `date` values interpreted in the tenant's `timezone` (`Europe/Tirane`).

## 5. Authentication

- **Supabase Auth, email + password**, with email confirmation and password reset (D-04).
- `@supabase/ssr` stores the session in HTTP-only cookies. `proxy.ts` refreshes the session on each request, and Server Components and Actions read it through `createServerClient`.
- On sign-up a database trigger creates a `profiles` row with role `CUSTOMER`. Role can never come from the client: the trigger ignores any role in metadata, and `profiles.role` is not updatable by `authenticated`.
- If sign-up starts from a farm page (`/f/[slug]/...`), the farm slug is passed in sign-up metadata. The trigger links the new profile to that farm as a customer, but only if the farm exists and is active.
- **Farmers** do not self-register. A platform admin creates the farm and invites the farmer by email (`auth.admin.inviteUserByEmail`, service role, server-side). The farmer sets their password from the invite link.
- **Platform admins** are created by a one-off SQL/CLI step. There is no UI path to become admin.
- **Consent:** registration requires accepting the privacy notice, and `profiles.privacy_accepted_at` is recorded (D-23).

## 6. Authorization

Three independent layers, each sufficient to block cross-tenant access on its own:

1. **Postgres RLS + grants** (the security boundary). The browser holds the public anon key and the user's JWT, so anyone can call the Supabase REST API directly. RLS policies and column-level grants must therefore be complete without help from Next.js.
2. **DAL checks in every Server Action / Route Handler.** For example, `requireFarmer()` resolves the farmer's tenant from `tenant_members` and never from a request parameter. `requireCustomer(slug)` resolves the tenant from the URL slug and the customer from the session.
3. **Route protection in layouts.** The `(farmer)`, `(admin)` and `(customer)` layouts redirect unauthenticated or wrong-role users, for UX only. `proxy.ts` makes no authorization decisions (per Next.js guidance).

| Role            | Can read                                                                                               | Can write                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| anonymous       | active farms; active products; listed items of **published** weeks                                     | nothing (sign-up only)                                                                                   |
| CUSTOMER        | the above + own profile, own addresses, own customer records, own orders and their items               | own profile/addresses; orders **only via `place_order()`**; cannot edit or cancel orders (D-03)          |
| FARMER (member) | everything belonging to their tenant(s), including their customers' basic profile (name, phone, email) | their tenant's settings, products, weeks/items, customer notes; order status via `set_order_status()`    |
| PLATFORM_ADMIN  | read-only across tenants for support                                                                   | tenants and farmer invites through server actions using the service role, after `requirePlatformAdmin()` |

## 7. Tenant isolation

How a request is scoped to a tenant:

- **Public and customer routes:** the tenant comes from the URL slug (`/f/[slug]`), looked up as an active tenant. The slug only _selects_ what to display. Access is still decided by RLS and by the customer record linked to `auth.uid()`.
- **Farmer routes:** the tenant comes from `tenant_members` for `auth.uid()`. Client-supplied tenant IDs are never accepted. If a farmer belongs to several farms (future), the selected one is stored in a cookie and re-validated against membership on every request.
- **In the database:** helper functions in a non-exposed `private` schema (`private.is_tenant_member(tid)`, `private.is_platform_admin()`, …) are used by every policy. Composite FKs stop cross-tenant references. SECURITY DEFINER functions re-check the caller's membership or ownership before doing anything.
- **Tests (Phase 2 + 7):** pgTAP tests run as real JWT-authenticated roles. Farmer A gets zero rows and errors on farm B's products, weeks, orders and customers. Customer A cannot see customer B's orders. Anonymous users cannot see draft weeks. Direct inserts and updates on `orders` are rejected.

## 8. Application routes

The locale prefix is optional (`/en/...` for English). Everything below lives under `app/[locale]/` except `api/`.

### Public — `(public)`

| Route       | Purpose                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | Platform landing. If `DEFAULT_TENANT_SLUG` is set (first deployment), redirects to that farm.                                                               |
| `/f/[slug]` | **Farm page and weekly shop in one:** farm header, "This week's fresh products", "Your last order" card when logged in, how ordering works, about the farm. |
| `/privacy`  | Privacy notice (GDPR / Law 124/2024).                                                                                                                       |

### Auth — `(auth)`

| Route                                 | Purpose                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| `/login?next=`                        | Email + password login for all roles; redirect by role or to `next`. |
| `/register?farm=[slug]&next=`         | Customer sign-up (name, phone, email, password, consent).            |
| `/forgot-password`, `/reset-password` | Password reset.                                                      |

### Customer — `(customer)` (requires login)

| Route                  | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `/f/[slug]/checkout`   | One page: cart review, pickup/delivery, address, phone, notes, place order. |
| `/account/orders`      | Order history (all farms, newest first) with "Repeat" on each.              |
| `/account/orders/[id]` | Order detail; also the post-checkout confirmation (`?placed=1`).            |
| `/account`             | Profile, saved addresses, language, delete-account request.                 |

### Farmer — `(farmer)` (requires FARMER + tenant membership)

| Route                                                         | Purpose                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/farm`                                                       | Dashboard: this week's orders, products, expected sales; two big buttons.                       |
| `/farm/week`                                                  | Edit the current or next week: one editable table, Copy last week, Publish/Close.               |
| `/farm/weeks`, `/farm/weeks/[id]`                             | Past and future weeks.                                                                          |
| `/farm/orders`                                                | **Totals tab (default)**: quantity to prepare per product. Orders tab: list with status filter. |
| `/farm/orders/[id]`                                           | Order detail, customer contact, delivery info, next-status button.                              |
| `/farm/products`, `/farm/products/new`, `/farm/products/[id]` | Product catalogue.                                                                              |
| `/farm/customers`, `/farm/customers/[id]`                     | Customer list, contact, order history, private notes, deactivate.                               |
| `/farm/settings`                                              | Farm profile, delivery fee, pickup/delivery options, inventory enforcement.                     |

### Admin — `(admin)` (requires PLATFORM_ADMIN)

| Route                                                   | Purpose                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `/admin`                                                | Platform counts: farms, customers, orders this week. |
| `/admin/farms`, `/admin/farms/new`, `/admin/farms/[id]` | List, create, invite farmer, activate/deactivate.    |

### API — `app/api/`

| Route                          | Purpose                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| `GET /api/auth/confirm`        | Verifies `token_hash` from Supabase emails and redirects.             |
| `POST /api/cron/notifications` | Retries pending or failed notifications (Vercel Cron, `CRON_SECRET`). |
| `GET /api/health`              | Liveness for uptime checks.                                           |

**Future custom domains and subdomains:** `proxy.ts` will map `Host` → slug and rewrite `farm-a.example.com/*` to `/f/farm-a/*`. All tenant pages are already slug-addressed, so no route changes are needed.

## 9. Notifications

- `lib/notifications/` defines `NotificationChannel { send(message) }` with an `EmailChannel` (Resend) implementation. SMS, WhatsApp and push can be added later as more channels.
- **Outbox pattern:** domain events insert rows into `notifications` in the same transaction as the business change (e.g. inside `place_order`). After the response, `after()` from `next/server` processes them. Vercel Cron retries failures with backoff. A failed email never fails an order, and nothing is silently lost.
- Events in the MVP:
  - `ORDER_PLACED`: sent to both farmer and customer.
  - `ORDER_STATUS_CHANGED`: sent to the customer for CONFIRMED, READY, DELIVERED and CANCELLED.
- Templates are rendered in the recipient's `preferred_locale`.

## 10. Deployment

- **Vercel:** Git-connected. Preview deployment per PR, production from `main`, functions in `fra1` (Frankfurt, close to the EU database).
- **Supabase:** a production project in an EU region (Frankfurt), plus a separate **staging** project used by preview deployments. Previews never touch production data.
- **Migrations:** `supabase/migrations/*.sql` are applied with `supabase db push`, through a GitHub Action on merge to `main` (staging on PR) or manually during the MVP. Applied migrations are never edited.
- **Env vars:** see `.env.example`. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CRON_SECRET` are server-only Vercel secrets.
- **CI** (GitHub Actions):
  - typecheck, lint, format, unit tests, build
  - from Phase 2: a job that starts local Supabase and runs pgTAP RLS tests
  - from Phase 7: Playwright e2e tests against local Supabase

## 11. Future scalability considerations

| Concern                                   | Why it is fine now / what to do later                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order-number counter locks the tenant row | Serialises order placement per farm only. Fine up to thousands of orders per week; later move to a dedicated counter table.                      |
| RLS cost on large tables                  | Policies use `(select auth.uid())` (evaluated once per query) and indexed `tenant_id`. Add a custom JWT claim with tenant memberships if needed. |
| Public farm page traffic                  | Cache the offer with `cacheTag(tenant)` and `revalidateTag` on publish or stock changes. Storage images come from the CDN.                       |
| Customer ordering from many farms         | Already supported: `customers` is a profile ↔ tenant link, addresses belong to the profile, `/account/orders` spans farms.                       |
| Marketplace / discovery                   | Add a public directory over `tenants`; no schema change.                                                                                         |
| Multiple farms per organisation           | Add `organizations` above `tenants`; `tenant_members` already allows one person in several tenants.                                              |
| Subscriptions / recurring orders          | New tables referencing `customers` and `products`. `place_order()` is the single entry point a scheduler would call.                             |
| Delivery zones                            | Replace `tenants.delivery_fee` with a `delivery_zones` table. Orders already snapshot `delivery_fee`.                                            |
| Payments                                  | Add `payments` linked to `orders`. Statuses stay separate from payment state.                                                                    |
| Traceability (field → batch → customer)   | Add `batches` referenced by `availability_items`. Order items already link to the availability item they were bought from.                       |
| Many tenants on one database              | Shared schema with indexed `tenant_id` is fine for hundreds to thousands of small farms.                                                         |
