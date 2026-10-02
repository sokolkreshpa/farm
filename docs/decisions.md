# Decisions Log

Clarifications and amendments to [spec.md](spec.md). **Where this file and the spec differ, this file wins.**
Add new decisions at the bottom with a date; never silently rewrite old ones (mark them superseded instead).

---

## Product decisions (confirmed by product owner, 2026-10-02)

| ID   | Decision                                                                                                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | **UI languages: Albanian (`sq`, default) and English (`en`).** Use `next-intl` from day one. No hard-coded user-facing strings in components. Product names/descriptions entered by the farmer are single-language (not translated) in the MVP.                                                                |
| D-02 | **Inventory enforcement is ON.** Ordering may not exceed `available_quantity`. Stock is reserved atomically inside a Postgres function (row lock), never by read-then-write in application code. Implemented as a per-tenant setting (`tenants.enforce_inventory`, default `true`) so it can be relaxed later. |
| D-03 | **Customers cannot edit or cancel an order after placing it.** Only the farmer can change status (including `CANCELLED`). Cancelling releases the reserved stock. The UI tells customers to contact the farmer for changes (show farm phone).                                                                  |
| D-04 | **Authentication: email + password** (Supabase Auth). Email confirmation enabled; password reset flow required. No magic link / phone OTP in the MVP.                                                                                                                                                          |

## Model decisions (proposed by Claude, accepted with restructure, 2026-10-02)

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-10 | Role names: `CUSTOMER`, `FARMER`, `PLATFORM_ADMIN` (spec §6 previously said `ADMIN`).                                                                                                                                                                                                                                                                                                                                    |
| D-11 | Identity model: `profiles` (1:1 with `auth.users`, holds global `role` and name/phone) + `tenant_members` (farmer ↔ tenant) + `customers` (profile ↔ tenant, per-farm customer record). This replaces `users.tenant_id` and the undefined `farmers` table, and lets a customer later order from several farmers without schema changes. A customer joins a tenant by registering from `/f/[slug]`.                       |
| D-12 | Weekly availability is split into **`weekly_cycles`** (tenant, `week_start`, `week_end`, `order_deadline`, `status` = `DRAFT`/`PUBLISHED`/`CLOSED`) and **`availability_items`** (cycle, product, `price`, `available_quantity`, `reserved_quantity`, `minimum_quantity`, `maximum_quantity`). Publishing and deadline are per cycle, not per product row. "Copy last week" clones a cycle. Orders reference `cycle_id`. |
| D-13 | Order statuses: `PLACED`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`. **`DRAFT` is dropped** — the cart lives client-side until submission.                                                                                                                                                                                                                                                             |
| D-14 | `orders` additionally has `cycle_id`, `delivery_method` (`DELIVERY`/`PICKUP`), `delivery_notes`, and snapshots of `customer_name`, `customer_phone`, `delivery_address`.                                                                                                                                                                                                                                                 |
| D-15 | `order_items` additionally has `tenant_id` (simpler RLS) and `availability_item_id`, alongside the name/unit/price snapshots.                                                                                                                                                                                                                                                                                            |
| D-16 | `addresses`: `id, tenant_id, customer_id, label, address_line, city, notes, is_default, timestamps`.                                                                                                                                                                                                                                                                                                                     |
| D-17 | Money: stored as `numeric(12,2)` with `tenants.currency` (default `ALL`); displayed without decimals for ALL. Quantities: `numeric(10,3)`; each unit has a `step` (e.g. kg 0.5, piece 1). Units live in a `units` reference table, not hard-coded in the frontend.                                                                                                                                                       |
| D-18 | Time: every tenant has a `timezone` (default `Europe/Tirane`); week boundaries and deadlines are evaluated in that zone.                                                                                                                                                                                                                                                                                                 |
| D-19 | Delivery fee: flat `tenants.delivery_fee`; pickup is free. Payment: **cash on delivery/pickup only** in the MVP — no payment provider.                                                                                                                                                                                                                                                                                   |
| D-20 | Order numbers: sequential per tenant, starting at 1001.                                                                                                                                                                                                                                                                                                                                                                  |
| D-21 | Order placement goes through a single `place_order()` Postgres function (SECURITY DEFINER, validates caller, cycle published, deadline not passed, product availability, min/max, stock; snapshots prices; computes totals) — the only write path for orders.                                                                                                                                                            |
| D-22 | Email provider: **Resend**, behind a `NotificationChannel` interface. Notifications are sent after the DB transaction commits; a send failure never fails the order.                                                                                                                                                                                                                                                     |
| D-23 | Privacy (GDPR / Albanian Law 124/2024): Supabase project in an EU region, Vercel functions in `fra1`, privacy notice + consent checkbox at registration, customer can request account/data deletion. Minimise personal data collected.                                                                                                                                                                                   |
| D-24 | Package manager: **npm**.                                                                                                                                                                                                                                                                                                                                                                                                |

## Technical decisions (Phase 0, 2026-10-02)

- **D-25** — Locale routing: `localePrefix: "as-needed"` (Albanian URLs unprefixed, English under `/en`) and **`localeDetection: false`**. Many Albanian users run English-language phones; we never auto-switch on `Accept-Language`. The user's explicit choice is stored in the next-intl cookie.
- **D-26** — Next.js **16** (scaffolded 16.3). Request interception lives in `proxy.ts` (Next 16 renamed `middleware` → `proxy`); request APIs (`params`, `cookies()`, `headers()`) are async only. Proxy is used for locale routing and Supabase session refresh only — never as the authorization layer.
- **D-27** — shadcn/ui on the Radix base (`radix-nova` style), Tailwind v4 CSS-first config in `app/globals.css`. Fonts: Fraunces (headings) + Inter (body), both with `latin-ext` for Albanian characters (ë, ç). Light theme only for the MVP.
- **D-28** — `docs/spec.md` is excluded from Prettier so the product owner's original text stays as written.

## Architecture decisions (Phase 1, 2026-10-02 — pending product-owner review)

- **D-16 superseded by D-29.**
- **D-29** — Addresses belong to the **profile**, not to a tenant. They are private to the customer; the farmer sees the address snapshotted on each order. One address book works across farms.
- **D-30** — `profiles.id` is `auth.users.id` (no separate `auth_user_id`). `profiles.email` is mirrored from `auth.users` by trigger so farmers can contact customers.
- **D-31** — **Composite tenant foreign keys** (`(tenant_id, x_id) → x(tenant_id, id)`) on every tenant-owned child table, so a cross-tenant reference cannot exist at the database level.
- **D-32** — **Column-level grants** complement RLS: RLS picks rows, grants pick columns (e.g. no client can write `ordered_quantity`, `next_order_number`, `profiles.role`, `tenants.active`).
- **D-33** — Orders and order status are written **only** through `place_order()` / `set_order_status()`; `authenticated` has no insert/update on `orders` or `order_items`.
- **D-34** — At most one PUBLISHED week per farm (partial unique index). Publishing a new week closes the previous one. Ordering is open while `status = PUBLISHED and now() < order_deadline`, so no cron job is needed to close weeks.
- **D-35** — `place_order()` takes an **idempotency key** (unique per customer) to stop duplicate orders from double taps or retries.
- **D-36** — Customers may place **several orders per week** (they cannot edit an order, D-03, so a second order is how they add something).
- **D-37** — Anonymous visitors can browse the farm page and this week's products; login is required only at checkout.
- **D-38** — Farmers never self-register: a platform admin creates the farm and invites the farmer by email.
- **D-39** — Notifications use an **outbox table** written in the same transaction, sent via `after()`, retried by Vercel Cron.
- **D-40** — Order status may jump forward (e.g. PLACED → READY); DELIVERED and CANCELLED are final; cancelling releases stock.
- **D-41** — Product images stored as Storage paths (`{tenant_id}/{uuid}.ext`) in a public-read bucket; only tenant members can write their folder.
- **D-42** — Optional env `DEFAULT_TENANT_SLUG` redirects `/` to the single farm for the first deployment.

## Database decisions (Phase 2, 2026-10-03)

- **D-43** — Default privileges on schema `public` are revoked for `anon`/`authenticated`; every table and function is granted explicitly (see CLAUDE.md rules).
- **D-44** — The seed creates orders through `place_order()` / `set_order_status()` (impersonating users via `request.jwt.claims`), so `db reset` also exercises the business rules.
- **D-45** — Errors from DB functions use `errcode P0001` with a stable code in MESSAGE and context in DETAIL (e.g. `INSUFFICIENT_STOCK` / `<item id>:<remaining>`).
- **D-46** — `profiles.last_name` may be empty (invited farmers or sign-ups without a last name); `first_name` falls back to the e-mail local part.

## Auth decisions (Phase 3, 2026-10-03)

- **D-47** — Supabase **publishable / secret API keys** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) instead of the legacy anon / service-role keys.
- **D-48** — Session identity is read with `supabase.auth.getClaims()` (verified JWT), never `getSession()`. `getViewer()` (React `cache`) loads the profile; `requireFarmer()` resolves the farm from `tenant_members` only.
- **D-49** — Auth e-mails use the `token_hash` flow through `GET /api/auth/confirm` with a same-origin `next` (open-redirect safe). Templates are bilingual, selected by `{{ .Data.preferred_locale }}`.
- **D-50** — Sign-up answers identically whether or not the e-mail already exists (no account enumeration); password-reset always reports success.
- **D-51** — Server-action form errors are translation keys (`ErrorKey`); unknown codes fall back to `generic`. Actions return non-secret submitted values so forms refill after React 19's automatic form reset.
- **D-52** — The privacy notice (`/privacy`) is a **draft pending legal review**. It promises account deletion from "My account" — to be built in Phase 4.

## Customer MVP decisions (Phase 4, 2026-10-03)

- **D-53** — Money and quantities use a **deterministic formatter** (`lib/format.ts`), not `Intl` currency formatting: ICU data differs between Node ("250 Lekë") and Chromium ("ALL 250"), which caused hydration mismatches. Dates are formatted only in Server Components, with `hourCycle: "h23"` (Albania uses the 24-hour clock).
- **D-54** — The cart is reconciled with the current offer **during render** (`useOfferCart`): items no longer offered are dropped and quantities clamped; the customer sees a notice until they change the cart.
- **D-55** — Data-access queries **throw** on database errors (error boundary) instead of returning empty results; an embed mistake had silently shown "no orders".
- **D-56** — Order → farm data is embedded through `weekly_cycles` (orders only have composite FKs, so PostgREST cannot embed `tenants` directly).
- **D-57** — Checkout keeps its idempotency key in `sessionStorage` per farm + week until the order succeeds, so retries and reloads never create duplicates.
- **D-58** — Anonymous visitors who press "Continue to order" go to sign-up (with `farm` and `next`), then return to checkout with the cart intact.
- **D-59** — Product placeholders (no photo yet) are coloured tiles with the product's initial; photos are uploaded by the farmer in Phase 5.
