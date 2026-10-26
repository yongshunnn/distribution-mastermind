# Distribution Mastermind

Internal planning tool for a brand-agnostic distribution business. It answers one question for any product, channel and market:

> Which product, through which channel, to which customer segment, in which market, still makes money after every cost — and what has to be done to get there?

The central unit is **the play**: SKU configuration × channel × segment × market. Every number in the UI opens a card explaining what it means, how it is calculated, what it is made of, where it came from and how fresh it is.

Built from `distribution-mastermind-build-spec.md` (27 Oct 2026). Defaults chosen during the build, and the questions still open for the owner, are listed in [DECISIONS.md](DECISIONS.md).

## Run it locally (demo mode — no database needed)

```bash
npm install
npm run build && npm start      # http://localhost:3000
```

Without Supabase environment variables, the app runs on an in-memory copy of the seed (Singapore, Malaysia, Myanmar, SG KEON) with no login. A banner shows this, and edits reset on restart.

## Trial mode

A separate sample copy of the data for looking around, without touching the live database.

- **Turn it on:** the login page has a **Try trial mode with sample data** button. Enter an allowlisted email (no email is sent). Signed-in members can use **Switch to trial mode** in the sidebar or on the More page.
- **Turn it off:** **Exit trial** in the banner (this browser only). To disable trial mode for everyone, set `TRIAL_MODE=off` in Vercel and redeploy.
- **Reset sample data** in the banner puts everything back.
- **Data:** the starter seed plus clearly fictional sample activity (Malaysia shelf audit, two sample distributors, six months of Singapore sales, a mixed fee model, market scores, a market-watch note). All of it is tagged placeholder and sourced "Trial sample (fictional)".
- Trial edits live in server memory. They can reset when Vercel recycles an instance, and separate instances may show different edits.
- The trial cookie is HMAC-signed with `TRIAL_SECRET` (or `CRON_SECRET`). Without a secret, trial mode stays off in production.

## Tests

```bash
npm test            # Vitest: calc engine (§8.10), seed checks, "no raw numbers" guard
npm run test:e2e    # Playwright at 375×667: explain coverage, milestones 2–8 smoke flows
npm run test:rls    # Throwaway local Postgres: migrations + seed, then anon/stranger see 0 rows
```

`test:e2e` builds and starts the app in demo mode itself (or reuses one on `E2E_PORT`, default 3100, started with `DM_ALLOW_RESET=1`).

## Deploy (Vercel + Supabase) — spec §15

**Status (26 Oct 2026):** the Supabase project **distribution-mastermind** (`joeeqfrpgudikomwhamy`, Singapore) exists with all three migrations applied and `yongshun@staffgo.sg` allowlisted. The data is loaded from inside the app: sign in, then press **Load starter data** on Home (it only runs while the workspace is empty). What remains: push to GitHub, import into Vercel, set the auth URLs.


1. **Supabase** — create a project in region *Southeast Asia (Singapore)*.
   - Apply `supabase/migrations/*.sql` in order: `supabase link --project-ref <ref> && supabase db push`, or paste them into the SQL editor.
   - Load the seed: paste `supabase/seed.sql` into the SQL editor, or run `npm run seed` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set.
   - **Auth → Providers → Email:** enable magic link. **Auth → URL configuration:** set Site URL to the Vercel domain and add `https://<domain>/auth/callback` to the redirect URLs.
   - Allowlist teammates: `insert into allowed_users (email) values ('name@company.com');` (or Settings → Users once `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel).
2. **Vercel** — import the repo (framework: Next.js) and set these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — cron routes and Settings → Users)
   - `CRON_SECRET` (any long random string; Vercel Cron sends it automatically)
   - `COMTRADE_API_KEY` (optional)

   `vercel.json` pins the region to `sin1` and schedules the daily data pulls.
3. **Phone** — open the Vercel URL → Share → *Add to Home Screen*.

## Where things are

| Path | What |
| --- | --- |
| `lib/calc/` | Pure calculation engine (landed cost, contribution, break-even, build-back, score, R, fees, scenarios, audit, range gaps). Every function returns `Traced`. |
| `components/num.tsx`, `components/explain-card.tsx` | The only way numbers render; popover on desktop, bottom sheet on phones. |
| `lib/db/` | Store (memory or Supabase), per-request loaders, play assembly (`plays.ts`). |
| `seed/*.json`, `lib/seed/build.ts` | Seed data (every figure tagged and sourced) and the builder. |
| `supabase/migrations/` | Schema, RLS, `set_tracked_value()` (edit = new row, old row kept as history), storage bucket. |
| `components/supply-chain-3d/` | Stylised 3D chain (react-three-fiber, lazy-loaded) with a 2D waterfall fallback. |
| `app/(app)/` | Screens: Home, Plays, Markets (8 tabs), Principals (wizard, catalogue, contracts, P&L, chain), Catalogue + import, Supply chain, Partners, Scenarios, Market watch, Store audit, Settings. |
