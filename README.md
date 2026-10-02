# Farm weekly orders

A mobile-first web app that replaces a farmer's messy e-mail ordering with a simple weekly flow:

**farmer publishes this week's products → customers order → farmer sees totals → prepares → delivers**

Multi-tenant from day one (one deployment can serve many farms), Albanian by default with English, built with Next.js 16, Supabase and Tailwind/shadcn.

## Features

- **Customers:** browse this week's products, steppers that respect stock and limits, cart, one-page checkout (pick-up or delivery), order history, **repeat last order** (unavailable products flagged), account and address book, e-mail notifications.
- **Farmers:** dashboard, **copy last week** and adjust quantities/prices (autosave), publish/close weeks, **totals per product** ("how much do I prepare?"), order list with bulk actions, one-tap status changes, products with photos, customers with private notes, farm settings.
- **Platform admin:** create farms and invite farmers, activate/deactivate farms, GDPR deletion requests.
- **Security:** tenant isolation enforced by Postgres RLS and column grants, orders only through validated database functions, server-side authorization on every action — covered by 126 pgTAP assertions.

## Quick start (local)

Requirements: Node 22, Docker.

```bash
npm install
npm run db:start                 # local Supabase (Postgres, Auth, Storage, Mailpit)
npx supabase status -o env       # copy API_URL / PUBLISHABLE_KEY / SECRET_KEY
cp .env.example .env.local       # fill in the values above
npm run dev                      # http://localhost:3000
```

Demo logins (password `Password123`): `farmer.a@example.com`, `admin@example.com`, customers `ana@example.com`, `bledi@example.com`, … Local e-mails appear in Mailpit at http://127.0.0.1:54324.

## Scripts

| Command                                     |                                                   |
| ------------------------------------------- | ------------------------------------------------- |
| `npm run dev` / `build` / `start`           | Next.js                                           |
| `npm run check`                             | typecheck + lint + format check + unit tests      |
| `npm run db:reset` / `db:test` / `db:types` | re-seed local DB / pgTAP tests / regenerate types |
| `npm run test:e2e:fresh`                    | reset DB and run Playwright (mobile + desktop)    |
| `npm run smoke -- <url> [slug]`             | post-deployment smoke test                        |

## Documentation

- [docs/spec.md](docs/spec.md) — product specification
- [docs/decisions.md](docs/decisions.md) — decisions that refine the spec
- [docs/architecture.md](docs/architecture.md) · [docs/database.md](docs/database.md) · [docs/user-flows.md](docs/user-flows.md)
- [docs/testing.md](docs/testing.md) — test strategy and coverage
- [docs/deployment.md](docs/deployment.md) — Vercel + Supabase + Resend setup, go-live checklist, operations
