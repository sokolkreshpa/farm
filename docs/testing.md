# Testing

Three layers, each run in CI on every push and pull request (`.github/workflows/ci.yml`).

| Layer      | Tool                                  | Where                      | What it proves                                                                                                                                      |
| ---------- | ------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database   | pgTAP (`npm run db:test`)             | `supabase/tests/database/` | RLS, column grants, tenant isolation, business rules in `place_order()` and friends — against the real schema, as real JWT roles                    |
| Unit       | Vitest (`npm test`)                   | `tests/unit/`              | Pure logic: cart maths, repeat order, totals aggregation, week/timezone maths, formatting, validation, redirects, notification outbox and templates |
| End-to-end | Playwright (`npm run test:e2e:fresh`) | `tests/e2e/`               | Real browser (Pixel 7 + desktop Chrome) against the production build and local Supabase: customer, farmer, admin, e-mail and accessibility flows    |

## Running locally

```bash
npm run db:start            # once (Docker)
npm run check               # typecheck + lint + format + unit tests
npm run db:reset && npm run db:test
npm run build && CI=1 npm run test:e2e:fresh   # e2e need freshly seeded data
```

Local e-mails (sign-up confirmation, order notifications) land in Mailpit at http://127.0.0.1:54324; e2e tests read them through its API.

## Spec §29 coverage map

| Requirement                                 | Tests                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login / logout / protected routes           | `e2e/auth.spec.ts` (role landing, `next` return, open-redirect guard, logout, wrong password, `/farm` `/admin` `/account` redirects)                                      |
| Registration + e-mail confirmation          | `e2e/auth.spec.ts` (Mailpit link), `unit/auth-validation.test.ts`                                                                                                         |
| Farmer A cannot see farmer B data           | `db/01_farmer_tenant_isolation` (27 assertions: reads, writes, functions, storage), `e2e/farmer.spec.ts` (farm B order → 404)                                             |
| Customer A cannot see customer B orders     | `db/02_customer_and_anon_isolation`, `e2e/customer.spec.ts` (other customer's order → 404)                                                                                |
| Create order, calculate totals              | `db/03_place_order`, `unit/cart-math.test.ts`, `e2e/customer.spec.ts` (pickup 340 Lekë, delivery +200)                                                                    |
| Preserve historical prices                  | `db/03_place_order` (price change keeps 180 on old order), seed (220 → 250), `e2e/customer.spec.ts` ("tani 250 Lekë")                                                     |
| Prevent ordering unavailable products       | `db/03_place_order` (other week, other farm, unlisted, closed, past deadline)                                                                                             |
| Prevent exceeding available quantity        | `db/03_place_order` (`INSUFFICIENT_STOCK`, max per customer, enforcement off), `e2e/ordering-edge-cases.spec.ts` (stock runs out during checkout → one-tap fix)           |
| Repeat previous order, unavailable products | `unit/repeat-order.test.ts`, `e2e/customer.spec.ts` (Mollë "nuk ofrohet këtë javë")                                                                                       |
| Weekly availability                         | `db/04_cycles_and_status` (copy, publish, close, one open week, stock guard), `unit/weeks.test.ts`, `e2e/farmer.spec.ts` (copy → edit price → publish → customers see it) |
| Aggregation                                 | `unit/aggregate.test.ts`, `e2e/farmer.spec.ts` (totals tab)                                                                                                               |
| Order status                                | `db/04_cycles_and_status` (forward only, final states, cancel releases stock, history), `e2e/farmer.spec.ts`                                                              |
| Notifications                               | `unit/notifications.test.ts`, `db/05_notifications`, `e2e/notifications.spec.ts` (order → customer + farmer e-mails → confirm → status e-mail)                            |
| Security review regressions                 | `db/06_security_hardening` (private notes, order counter, unconfirmed sign-ups, admin demotion, image paths)                                                              |
| Accessibility (WCAG 2.1 AA, automated)      | `e2e/accessibility.spec.ts` — shop, auth, privacy, cart drawer, checkout, order history and all farmer screens: no serious/critical axe violations                        |

## Usability targets (spec §19)

Measured by `e2e/ordering-edge-cases.spec.ts` and the farmer flow tests:

- **Returning customer:** farm page → "Përsërit porosinë" → "Vazhdo te porosia" → "Dërgo porosinë" = **3 taps, 3 screens**.
- **New order from scratch:** one tap per product ("Shto"), then cart → checkout → send. Address and phone are prefilled after the first order.
- **Farmer publishing next week:** "Kopjo javën e kaluar" → change the quantities/prices that differ (autosave on blur) → "Publiko javën" → confirm. For 12 products with ~4 changes that is ~10 taps.

## Conventions

- E2E tests that change shared state (publishing, stock, statuses) run on the desktop project only and serially; customer specs use farm A, state-changing farmer specs use farm B.
- Money in assertions uses the app's own formatter (`lib/format.ts`; "250 Lekë" contains a no-break space).
- New tables / functions need pgTAP tests (see CLAUDE.md).
