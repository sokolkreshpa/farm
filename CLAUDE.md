# Farm Weekly Ordering Platform

Multi-tenant SaaS that replaces a farmer's email-based weekly ordering with a structured flow:
**farmer publishes weekly availability → customers order → farmer sees aggregated totals → prepares → fulfils.**
Multi-tenant from day one; first deployment serves one farmer. Not a marketplace.

## Source of truth

- `docs/spec.md` — full product spec (what to build). Read the relevant section before starting a feature.
- `docs/decisions.md` — decisions that **override** the spec. Check it before designing anything; append new decisions there.
- `docs/architecture.md`, `docs/database.md`, `docs/user-flows.md` — design docs (created in Phase 1; keep in sync with the code).

## Stack

Next.js (App Router, TypeScript strict) · Tailwind · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · next-intl (`sq` default, `en`) · Resend · Vitest · Playwright · Vercel. Package manager: npm.
No separate backend service, no microservices.

## Commands

_Fill in as they are created in Phase 0._

```bash
npm run dev            # Next.js dev server
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # Vitest unit tests
npm run test:e2e       # Playwright (needs local Supabase running)
npx supabase start     # local Supabase (Docker)
npx supabase db reset  # re-apply migrations + seed
npx supabase test db   # pgTAP RLS / tenant-isolation tests
npm run db:types       # regenerate types/database.ts from local schema
```

## Layout

```text
app/[locale]/(public|customer|farmer|admin)/   routes;  app/api/  route handlers/webhooks
components/ui/  shadcn;  components/<domain>/   small presentational components
lib/<domain>/   business logic + data access (auth, tenants, products, cycles, orders, notifications)
lib/validation/ Zod schemas shared by forms and server actions
messages/sq.json, messages/en.json   all UI strings
supabase/migrations/  supabase/seed.sql  supabase/tests/ (pgTAP)
tests/unit/  tests/e2e/
```

## Non-negotiable rules

**Security / tenancy**
- Every tenant-owned table has `tenant_id` and RLS enabled with explicit policies. No table ships without RLS.
- Never trust a client-supplied `tenant_id`, `customer_id`, price or total. Resolve tenant from the route slug + session on the server; prices come from the DB.
- Authorize on the server in every server action and route handler (role + tenant membership), not just in layouts or UI.
- Order placement only via the `place_order()` DB function (stock reservation is atomic).
- Service-role key is server-only (`lib/db/admin.ts`, `import 'server-only'`); never in `NEXT_PUBLIC_*`.
- Validate all external input with Zod.
- Schema changes only via new migration files; never edit an applied migration.
- Tenant-isolation tests (Farmer A ≠ Farmer B products/orders; Customer A ≠ Customer B orders) must stay green.

**Code**
- Business logic in `lib/`, not in components. Components stay small.
- TypeScript strict; no `any` without a comment explaining why. Use generated DB types.
- No hard-coded user-facing strings — use `next-intl` messages (both `sq` and `en`).
- No hard-coded units or currencies in the frontend.
- Don't add dependencies without a reason; don't build anything in spec §32 ("What NOT to build").
- Fix errors; don't suppress them (`@ts-ignore`, `eslint-disable`) without justification.

**UX**
- Mobile-first. Customer orders in < 3 min; farmer publishes a week in < 5 min.
- Plain language, no technical terms. Simple cards, whitespace, natural/fresh aesthetic — not a supermarket template.

## Workflow

- Work phase by phase (spec §23–§30). At the end of each phase: typecheck, lint, tests pass → update the tracker below → summarize and name the next phase.
- After Phase 1, **stop for product-owner review** before writing migrations.
- Small, logically separated commits on feature branches; don't commit secrets (`.env*` except `.env.example`).

## Phase tracker

| Phase | Status |
|---|---|
| 0 — Scaffold (Next.js, tooling, Supabase init, CI) | not started |
| 1 — Architecture docs (review gate) | not started |
| 2 — Database: schema, RLS, `place_order()`, seed, pgTAP | not started |
| 3 — Auth & role-based access | not started |
| 4 — Customer MVP | not started |
| 5 — Farmer MVP (+ minimal admin) | not started |
| 6 — Notifications | not started |
| 7 — Testing (unit + e2e) | not started |
| 8 — Deployment (Vercel + Supabase prod) | not started |
