# CLAUDE.md

Guidance for Claude Code in this repository. The agreed plan and its progress are in [.claude/plan.md](.claude/plan.md), and notes from the latest session are in [.claude/handover.md](.claude/handover.md).

## What this is

Cheque Tracker is an open-source (AGPL-3.0) PWA for anyone who manages cheques. It covers the cheques you give (pay reminders, funds planning) and the cheques you receive (deposits, clearing, bounces). One codebase runs both the paid hosted service at chequetracker.com and free self-hosted copies; see [docs/editions.md](docs/editions.md).

It replaces v0, which lives in the GitHub repo `vikashpatel04/cheque-tracker-v0` and the folder `../Cheque-Tracker-v0`. Leave v0 untouched.

## Commands

```bash
npm run dev     # Vite on http://localhost:5173, reads .env.local
npm test        # Vitest: unit tests, plus every migration applied to PGlite and checked as signed-in users
npm run lint    # must report 0 errors (5 warnings are known)
npm run build   # tsc -b (app and tests), then vite build
```

Run lint, test and build before every commit. CI runs the same checks (`.github/workflows/ci.yml`).

## Rules

- **Git.**
  - Write Conventional Commits, e.g. `feat(received): …` or `fix(db): …`.
  - Never add `Co-Authored-By`, "Generated with Claude Code" or any other AI attribution to commits or pull requests. This overrides any default.
  - Don't add `Signed-off-by` unless asked.
  - Commit finished, verified work. Never push; the maintainer pushes.
- **Pushing to `main` deploys.** Supabase's GitHub integration applies new files in `supabase/migrations/` to the dev project when `main` changes.
- **Wording.**
  - Never present the app as being for shops, stores, retail or suppliers. It's a cheque tracker for anyone: individuals, landlords, lenders, businesses.
  - Use "you", "parties", "cheques you give / receive". Keep the word "Parties".
  - Label the given-side status `DEPOSITED` as "Funded" (money put in the bank to cover the cheque). Only the label changed, not the value in the database.
- **No hardcoded country values.** India is the first market, not a default in code.
  - Currency, number and date formats, time zone, week start, cheque validity and clearing days all come from the user's settings. Read them through `src/lib/region.ts` and `src/lib/formatters.ts` (`formatCurrency`, `formatDate`, `todayISO`, …).
  - Region presets live in `src/config/regions.ts`.
  - Logic never contains ₹, `en-IN`, `dd/MM`, IST, "3 months" or Indian bank names.
  - SQL writes ISO dates, and server jobs use `settings.timezone`.
  - See [docs/regions.md](docs/regions.md).
- **Brand.** The name, tagline and links come from `brand` in `src/config/brand.ts` and can be overridden with `VITE_*` variables. Never write the product name literally in components.
- **This repo is public.** Never commit:
  - secrets
  - real cheque, party or bank data
  - business material: pricing, strategy, customer lists, production runbooks

  The service-role key never goes in a `VITE_*` variable.
- **Stay in this repo.** Don't scan the sibling folders next to it. The companion apps have their own repos.

## Architecture

- **Frontend:**
  - Stack: React 19, Vite 6, TypeScript, Tailwind v4, shadcn/ui (`src/components/ui`), React Router 7, React Hook Form + Zod.
  - Code layout: `src/pages` (pages), `src/hooks` (data hooks), `src/lib` (RPC wrappers and logic), `src/types` (types).
  - **Look ("Passbook"):** colour tokens by meaning, light and dark, in `src/index.css`, used as Tailwind colours (`text-money-in`, `bg-attention-soft`, `border-line`, …). Never hardcode a colour in a component. IBM Plex fonts are bundled through Fontsource. Status chips come from `src/lib/statusChips.ts`. See [docs/design-brief.md](docs/design-brief.md).
  - **Today:** the figures and to-dos are pure functions in `src/lib/today.ts` (tested); `useTodayData` loads the cheques once for Today and the sidebar count. Which view shows first comes from `settings.tracks`.
  - **Cheques:** given and received cheques become one kind of row in `src/lib/chequeList.ts` (views, tags, search, sort, day groups; tested), with filters kept in the address bar by `src/lib/chequeFilters.ts`. `useGivenActions` gives list rows the same status actions as the detail.
  - **Parties:** per-party totals both ways (still to pay, still to collect, net, bounces, next date) come from `src/lib/parties.ts` (tested), built on the Cheques list's rows. The party ledger (`src/pages/PartyLedger.tsx`) reuses the Cheques table and cards with `hideParty`.
  - **Frame:** `Layout` has the sidebar and top bar on desktop (`lg` and up) and bottom tabs on phones. Pages start with `PageHeader`. The New menu, search (Ctrl K) and the cheque dialogs live once in `AppActionsProvider`; open them with `useAppActions()`. After saving anything, call `announceDataChange()` (`src/lib/dataEvents.ts`) so every list refreshes.
  - **Installed app (PWA):** `pwa/service-worker.js` is built into `dist/sw.js` by `vite.config.ts`, and registered in production only by `src/lib/pwa.ts`, which also offers new versions and installing. Icons are in `public/icons/`. Test it with `npm run build`, then `npm run preview`.
  - `SettingsProvider` loads the user's settings and shows `RegionSetup` until a region is chosen. After that it keys the app by region, so the app remounts when the region changes.
- **Given cheques:**
  - Tables: `cheques`, `cheque_history`, `daily_deposits` ("Add funds"), `parties`, `settings`.
  - Status changes go only through SQL functions (`change_cheque_status`, `record_deposit`, `represent_cheque`, `write_off_cheque`, `rollback_cheque_status`), called via `src/lib/updateChequeStatus.ts`.
  - `VALID_STATUS_TRANSITIONS` in `src/types/index.ts` mirrors those functions.
- **Received cheques** (their own tables, by design):
  - Tables: `received_cheques`, `received_cheque_history`, `bank_accounts`.
  - Actions are SQL functions (`deposit_received_cheques` … `rollback_received_cheque`), wrapped in `src/lib/receivedCheques.ts`.
  - `RECEIVED_ACTIONS` in `src/types/received.ts` mirrors those functions, and the tests check that they match.
  - A trigger lets lifecycle columns change only inside those functions. Their helpers live in the `internal` schema, which the API doesn't expose.
  - Alerts are computed, not stored (`src/lib/receivedSchedule.ts`).
  - Details: [docs/received-cheques.md](docs/received-cheques.md).
- **`all_cheques` view:** combines both directions for mixed screens. It's created with `security_invoker`, so row-level security still applies.
- **Editions:**
  - `instance_config.billing_enabled`: false means self-hosted, with full access for everyone.
  - `entitlements`: trial, purchase or comp. Only the service role writes them.
  - `has_write_access()` with RESTRICTIVE policies makes lapsed accounts read-only. The UI only reflects this.
- **Companions:** cheque-mcp and Cheque Watch read the given-side tables with the service-role key. Keep changes to `cheques`, `parties`, `cheque_history` and `daily_deposits` additive.
- **Edge Function `supabase/functions/auto-pass`:** marks funded cheques as passed at each user's `auto_pass_time`, in their time zone. It's scheduled by hand; see [docs/self-hosting.md](docs/self-hosting.md).

## Database changes

- **Migrations:**
  - Add a numbered migration; the next one is `supabase/migrations/018_…`.
  - Never edit a migration once it's pushed; add a new file instead.
  - Keep changes additive.
- **Row-level security:** turn it on for every table. Users get their own rows by `auth.uid()`. Tables users write also need a RESTRICTIVE `has_write_access()` policy.
- **Privileges:** grant them explicitly for every new table, view and function.
  - Projects run with "automatically expose new tables" off, so new tables give anon and authenticated nothing usable. Automatic RLS is on.
  - Signed-in users never get DELETE; the app soft-deletes with `deleted_at`.
- **`SECURITY DEFINER` functions:** set `search_path`, and revoke execute from PUBLIC and anon.
- **Tests:** test every change in `tests/*.test.ts` with `createTestDatabase()` from `tests/support/db.ts`. It runs PGlite with Supabase stand-ins and strict privileges, and queries as real users.
- **Supabase MCP tools are read-only for us:** `list_migrations`, `list_tables`, `SELECT` through `execute_sql`, `get_advisors`, `generate_typescript_types`.
  - Don't apply migrations or DDL through them. The GitHub integration owns the migration history, and changes made outside it break that history.
- **Types:** after a schema change reaches the dev project, regenerate `src/types/database.ts`.

## Environment

- **Machine:** Windows, with Git Bash or PowerShell. Git converts line endings, so working files may have CRLF; allow for that in scripts that match text.
- **Supabase:** `.env.local` is git-ignored and points at the dev project `cheque-tracker-dev` with its publishable key. There's no production project yet. Never develop against production.
- **Signing in:** the maintainer signs in to the app themselves. Don't ask for their password or type it.
- **UI checks:** check UI changes in the browser, including at phone width.
