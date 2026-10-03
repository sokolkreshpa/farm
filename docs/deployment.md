# Deployment

Production setup for Vercel + Supabase + Resend. Follow the steps in order; each ends with a check.
Everything here is done once; afterwards a merge to `main` deploys automatically.

```text
GitHub (main)
  ├─ CI ............ typecheck · lint · unit · pgTAP · build · Playwright e2e
  ├─ migrate.yml ... supabase db push → staging, then production (approval)
  └─ Vercel ........ Production deploy (main)  ──► Supabase PRODUCTION (eu-central-1)
                     Preview deploys (PRs)    ──► Supabase STAGING    (eu-central-1)
                                                   │
                                Resend (SMTP for auth e-mails, API for order e-mails)
```

> **Secrets:** never paste keys or passwords into chats, issues or commits. Enter them only in the Vercel, GitHub and Supabase dashboards. If a production key is ever exposed, rotate it immediately (Supabase → Settings → API keys; Resend → API keys).

---

## 1. Supabase projects (≈10 min)

Create **two** projects at [supabase.com/dashboard](https://supabase.com/dashboard):

|             | Staging                                                 | Production                                                      |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Name        | `farm-staging`                                          | `farm-production`                                               |
| Region      | **Central EU (Frankfurt)** — GDPR / Law 124/2024 (D-23) | same                                                            |
| Plan        | Free is fine                                            | **Pro recommended**: daily backups, no pausing after inactivity |
| DB password | generate, store in a password manager                   | generate, store in a password manager                           |

Note each project's **ref** (the 20 letters in the dashboard URL) and, under _Settings → API keys_, the **publishable** key and the **secret** key.

**Check:** both projects show "Healthy".

## 2. Database schema via GitHub Actions (≈10 min)

GitHub → repository → _Settings_:

1. _Secrets and variables → Actions → New repository secret_: `SUPABASE_ACCESS_TOKEN` — create at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. _Environments → New environment_ `staging`: variable `SUPABASE_PROJECT_REF` = staging ref; secret `SUPABASE_DB_PASSWORD`.
3. _Environments → New environment_ `production`: same with the production values, and enable **Required reviewers** (you), so production migrations wait for approval.
4. _Actions → Database migrations → Run workflow_.

The seed is **never** applied by this workflow. (Staging can optionally get demo data with `supabase db push --include-seed` from your machine — it creates users with the public password `Password123`, so never on production.)

**Check:** the workflow is green; in the production project's _Table editor_ you see `tenants`, `products`, `orders`, … and _Storage_ shows the `product-images` bucket.

Alternative from your machine: `npx supabase link --project-ref <ref>` then `npx supabase db push`.

## 3. Resend (≈15 min, DNS may take longer)

1. Create an account at [resend.com](https://resend.com) (EU region if offered).
2. _Domains → Add domain_ (e.g. `porosi.yourfarm.al`) and add the DNS records it shows (SPF, DKIM; add DMARC `v=DMARC1; p=none`). Wait for **Verified**.
3. _API keys → Create_ with "Sending access". This value is `RESEND_API_KEY`.
4. Choose the sender, e.g. `Ferma Kodra <porosi@porosi.yourfarm.al>` → `EMAIL_FROM`.

**Check:** Resend shows the domain as verified.

## 4. Supabase Auth settings (each project, ≈10 min)

_Authentication →_

| Setting                           | Value                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL Configuration → Site URL      | Production: `https://<your-domain>` · Staging: your staging/preview URL                                                                                                                                                                                                                                                                                                              |
| URL Configuration → Redirect URLs | `https://<your-domain>/**` (production) · `https://*-<vercel-team>.vercel.app/**` (staging, for previews)                                                                                                                                                                                                                                                                            |
| Sign In / Providers → Email       | Enabled, **Confirm email ON**                                                                                                                                                                                                                                                                                                                                                        |
| Passwords                         | Minimum length **8**, require **letters and digits** (matches the app's validation)                                                                                                                                                                                                                                                                                                  |
| Emails → SMTP Settings            | Enable custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender = `EMAIL_FROM` address/name                                                                                                                                                                                                                                                 |
| Emails → Templates                | Paste the bilingual templates from the repo:<br>• Confirm signup ← `supabase/templates/confirmation.html`, subject "Konfirmo email-in / Confirm your email"<br>• Reset password ← `supabase/templates/recovery.html`, subject "Ndrysho fjalëkalimin / Reset your password"<br>• Invite user ← `supabase/templates/invite.html`, subject "Ferma juaj është gati / Your farm is ready" |

The templates link to `/api/auth/confirm` (token-hash flow). Without them, confirmation links won't log users in.

**Check:** _Emails → Templates_ shows the Albanian text; SMTP test e-mail arrives.

## 5. Vercel project (≈10 min)

1. [vercel.com/new](https://vercel.com/new) → import `sokolkreshpa/farm`. Framework: Next.js (auto). Region is pinned to `fra1` by `vercel.json`.
2. _Settings → Environment Variables_:

| Variable                               | Production                          | Preview                                              |
| -------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<prod-ref>.supabase.co`    | `https://<staging-ref>.supabase.co`                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | prod publishable key                | staging publishable key                              |
| `SUPABASE_SECRET_KEY` (**sensitive**)  | prod secret key                     | staging secret key                                   |
| `NEXT_PUBLIC_SITE_URL`                 | `https://<your-domain>`             | staging URL (used in e-mail links)                   |
| `RESEND_API_KEY` (**sensitive**)       | Resend key                          | Resend key (or leave empty: e-mails are only logged) |
| `EMAIL_FROM`                           | `Ferma Kodra <porosi@…>`            | same                                                 |
| `CRON_SECRET` (**sensitive**)          | random, e.g. `openssl rand -hex 32` | different random value                               |
| `DEFAULT_TENANT_SLUG`                  | the farm's slug (after step 6)      | `ferma-kodra` if staging was seeded                  |

Do **not** set `MAILPIT_URL` on Vercel (local only).

> **The build fails if the `NEXT_PUBLIC_*` values are missing** — they are baked in at build time. Add them for _both_ Production and Preview, then **Redeploy** (env changes never apply to an existing build). If you used Vercel's Supabase integration, its `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are accepted as fallbacks, and `NEXT_PUBLIC_SITE_URL` defaults to the Vercel production / branch URL — set it explicitly once you have a custom domain (it is used in e-mail links).

3. Deploy. _Settings → Domains_: add your domain, then update Supabase **Site URL** (step 4) to match.
4. Cron: `vercel.json` retries undelivered e-mails daily (Hobby limit). On Pro change the schedule to `*/10 * * * *`. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

**Check:** `npm run smoke -- https://<your-domain> <slug>` — the farm-page check passes once the farm exists (step 6); everything else passes immediately.

## 6. First admin, first farm (≈15 min)

1. Open `https://<your-domain>/register`, sign up with your own e-mail and confirm it.
2. Supabase (production) → _SQL editor_ → run `supabase/snippets/make-platform-admin.sql` with your e-mail.
3. Log in → you land on `/admin` → **Fermë e re**: farm name, web address (slug, e.g. `ferma-kodra`), the farmer's name and e-mail → _Krijo fermën dhe dërgo ftesën_.
4. The farmer opens the invite e-mail, chooses a password and lands on `/farm`:
   - _Cilësimet_: phone, address, delivery fee, delivery/pick-up texts.
   - _Produktet_: products with photos.
   - _Java_: _Fillo bosh_, add products with quantities and prices, set the deadline, **Publiko javën**.
5. Vercel: set `DEFAULT_TENANT_SLUG` to the slug and redeploy, so `/` opens the farm directly.

**Check:** `npm run smoke -- https://<your-domain> <slug>` → all checks pass.

## 7. Go-live checklist

- [ ] Smoke test passes on production.
- [ ] Register a test customer from the farm page, confirm e-mail, place an order → customer and farmer e-mails arrive (check spam folders; DMARC/DKIM ok).
- [ ] Farmer confirms the order → customer receives "Konfirmuar". Cancel it afterwards.
- [ ] Privacy notice (`/privacy`) reviewed by a lawyer and the "Draft" note removed (`messages/*.json` → `Privacy.draftNotice`).
- [ ] Supabase backups enabled (Pro) and the production DB password stored safely.
- [ ] GitHub `production` environment requires approval.
- [ ] Farm link shared with the first customers.

---

## Operations

**Deploying changes.** Merge to `main`: CI runs, Vercel deploys, `migrate.yml` applies new migrations (staging, then production after approval). Migrations and code deploy independently, so migrations must be **backward compatible**: add first (expand), deploy code, remove later (contract). Never edit an applied migration.

**Rollback.** Code: Vercel → Deployments → _Instant Rollback_. Database: write a new forward migration; restore from backup / PITR (Pro) only for data loss.

**Monitoring.**

- Vercel → Logs (server errors; the error page shows a reference digest that matches the logs).
- Undelivered e-mails: `select event, recipient, attempts, last_error from notifications where status <> 'SENT' order by created_at desc;`
- Supabase → Logs / Advisors (run the security and performance advisors after schema changes).

**Account deletion requests (GDPR).** Listed on `/admin`. Process each one with `supabase/snippets/anonymize-customer.sql` (orders keep amounts but lose personal data; the login is disabled; people without orders are deleted completely), then reply to the person.

**Rotating secrets.** Supabase secret key → update `SUPABASE_SECRET_KEY` in Vercel and redeploy. Resend key → update Vercel and Supabase SMTP. `CRON_SECRET` → update Vercel (the cron picks it up on the next deploy).

**Adding another farm.** `/admin` → _Fermë e re_. Each farm gets `https://<your-domain>/f/<slug>`. Leave `DEFAULT_TENANT_SLUG` pointing at the main farm or remove it to show the neutral landing page.
