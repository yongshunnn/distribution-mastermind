# Changelog

## 0.1.0 — 2026-10-26

Milestones 1–8 built; milestone 9 (data pulls) scaffolded. Verified in demo mode: 87 unit tests, 19 Playwright tests at 375×667, RLS test on a local Postgres.

- **M1 Foundation** — Next.js 16 + Tailwind 4, Supabase magic-link auth with an email allowlist, `proxy.ts` session refresh, RLS on all 46 tables, mobile bottom nav / desktop sidebar, PWA manifest, icons and service worker. Migrations for every §5 table.
- **M2 Seed + explain layer** — glossary, tracked values with history, `<Num>` with popover/bottom sheet (meaning, formula, drill-down breakdown, source and freshness, sensitivity, levers, edit). Singapore, Malaysia and Myanmar seeded per §12. Markets list and detail (overview, data).
- **M3 Principal setup + catalogue** — six-step wizard with missing-field flags and dated snapshots; families → SKU configurations → pack levels; bulk family edit; compare two configurations; SKU CSV/XLSX import with a new/changed/conflict preview, a template download and a label-artwork zip.
- **M4 Calc engine + plays** — §8 functions with tests; plays ranked by return on cash; play detail with waterfall, break-even, price build-back, live sensitivity sliders and per-play overrides.
- **M5 Stage tracker** — 7-stage templates, items with status/owner/due/evidence, gate locks and written overrides, expansion trackers, watch-out library, pipeline board on Home.
- **M6 Competition + partners** — mobile store-audit form (photo, offline queue), price bands / mainstream cluster / attribute and facing shares, competitor cards, range-gap check, partner directory, asks vs benchmark (Golden Land 15% flagged), proposal export (Markdown / print-to-PDF).
- **M7 Supply chain 3D** — staircase of cost layers per stage, volume tubes, stock footprints, moving goods (respects reduced motion), unit switch, route compare, restacking sliders, 2D fallback, disabled Globe toggle.
- **M8 Scenarios, scorecard, market watch** — ranked plan under capital/WC/people/pallet limits with monthly cash need; editable score weights; watch notes that flag plays, gates and market status.
- **M9 Data pulls (scaffold)** — cron routes for data.gov.sg outlet counts and UN Comtrade; never overwrite measured/quoted values. Untested against the live APIs (unreachable from the build sandbox).
