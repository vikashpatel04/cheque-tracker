# Handover

Status on 2026-09-26, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file. Keep it free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

Then work through **Next steps** below, one at a time. Check with me before anything that changes Supabase settings or data.

## Where things stand

- **Code:** all work is committed on `main`.
  - It covers the v0 import, the v2 foundation (regions, editions, brand, AGPL docs, Vitest + PGlite tests) and migrations 012–014: received cheques, explicit grants, and a settings backfill.
  - 57 tests pass; lint (0 errors) and build are clean.
  - GitHub had everything up to `dc38e2a`; the commit adding this file still needed pushing.
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - `.env.local` points at it.
- **The dev database is still empty.** Pushes to `main` didn't deploy: no migration history table exists, and GitHub shows no Supabase check.
  - The likely cause is that **Deploy to production** is off in Project Settings → Integrations → GitHub. Supabase's docs confirm the integration works on the free plan.
  - My login already exists under Authentication → Users. Migration 014 will give it a settings row when the migrations run.
- **Screens:** there are no screens for received cheques yet. They come with the redesign.

## Next steps

1. **Get the migrations applied.**
   - Ask me to turn on Deploy to production, with production branch `main` and working directory `.`, and then to push.
   - Follow progress with `list_migrations`.
   - If nothing deploys, check the integration settings with me. An empty commit re-triggers a deploy, and `npx supabase db push` from my machine is the fallback (I run it).
   - Don't apply migrations through the MCP tools.
2. **Verify, read-only, with the Supabase MCP tools:**
   - migrations 001–014 are listed, and the tables exist
   - privileges: anon can only read `instance_config`, and signed-in users have no DELETE or TRUNCATE
   - my account has a settings row
   - `get_advisors`, both security and performance

   Fix real findings in migration 015, with tests.
3. **Regenerate `src/types/database.ts`.** It predates regions, editions and received cheques. Fix any type errors this reveals.
4. **Try the app.** Run `npm run dev` and open it in the browser pane, and I'll sign in. Go through region setup and Settings, and fix anything that errors.
5. **Write the brief for Claude Design** from the plan below, then build the received-cheque screens on the new layout.

## Product plan (agreed)

**Decisions:**
- Received cheques get their own tables.
- One user per account for v1, with no workspaces.
- Several countries from day one, India first.
- The given side says "Funded", and the word "Parties" stays.
- The hosted service sells prepaid packs through Razorpay.
- PWA only for now.

### Received cheques

- **In the database now (012):**
  - Actions: deposit (in batches), confirm cleared, bounce with a reason and bank charges, deposit again, replacement cheque, settled another way, hand back, write off, and undo.
  - Security cheques, series, bank accounts, and computed alerts.
- **Next:**
  - Reminders, by email by default, with PWA push as an option.
  - A WhatsApp nudge to the payer through a `wa.me` link.
  - Cheque photos, stored in a private bucket.
  - When a received cheque clears into an account, offer to use that money for given cheques on the same account.
  - A combined in/out forecast per account, plus a deposit-list PDF.
- **Later:**
  - Scan a cheque to fill in the form.
  - Bounce follow-up with legal deadlines where a country has them. India's Section 138 comes first, presented as reminders, not legal advice.
  - A party trust score.
  - Bank statement matching and export to accounting software.

### Layout

- **Problems today:**
  - The dashboard stacks about ten blocks, and four of them show the same "what's due" data.
  - The header has only Add funds.
  - The cheque list is a 9-column table that scrolls sideways on phones.
  - Returned is its own page.
  - Colours are hardcoded.
- **Navigation:**
  - **Today:** a to-do list.
  - **Cheques:** All / Received / Given tabs, plus saved views: To deposit, In clearing, Bounced, Security, Series.
  - **Calendar.**
  - **Parties:** a two-way ledger showing given, received, net and bounces.
  - **Reports.**
  - **Settings:** profile, region, bank accounts, notifications, plan and billing, data.
  - Always visible: a New button (received cheque, given cheque, series, add funds, import), search by cheque number, party or amount (Ctrl K), and notifications.
  - Returned becomes a saved view and a to-do. Bulk add moves under New.
- **Today:**
  - First three numbers: in clearing, due, and net.
  - Then to-dos, each with one action.
  - Then one in/out chart.
  - People who only give or only receive see only their half.
- **Mobile:**
  - Bottom tabs: Today · Cheques · + · Parties · More.
  - Cards instead of tables.
  - Swipe to deposit or confirm.
  - Full-screen forms.
- **Reports:**
  - Sticky filters: dates, direction, party, account, status.
  - Tabs: Overview, Cash flow, Collections (ageing in 0–30 / 31–60 / 61–90 / 90+ day buckets, bounce rate), Payments, Parties, Bounces, and Accounts and funds.
  - Each tab exports with its filters applied.
  - Totals move into SQL. Today Dashboard and Reports load every cheque into the browser, and the totals silently go wrong past 1,000 rows.
- **Visual rules:**
  - Money in is green (↙). Money out is neutral ink with a minus sign (↗).
  - Red is only for problems and amber for attention. Status shows as an icon plus text, never colour alone.
  - Amounts use tabular figures: compact in tiles, full in tables, grouped by region.
  - Semantic tokens (`--money-in`, `--money-out`, `--status-*`) replace hardcoded colours, which also gives dark mode.
  - Also needed: brand colour, typeface, logo, a density setting, empty states, and a first-run checklist.
- **Screens for the brief:**
  - landing and pricing
  - sign-up and onboarding, including region setup
  - Today, on desktop and mobile
  - Cheques list
  - cheque detail, with timeline and actions
  - Add cheque, for both directions and for series
  - deposit batch
  - bounce resolution
  - party ledger
  - Reports overview
  - Settings and billing

### Before the hosted service launches

- **Sign-up:** email and password with verification, Google sign-in, password reset, CAPTCHA, and custom SMTP.
- **Billing:**
  - A Razorpay webhook Edge Function verifies each payment and inserts a `purchase` entitlement.
  - A new pack starts when the current one ends, so buying early loses nothing.
  - Send renewal reminders before a pack ends.
  - Expired accounts stay readable and can still export.
- **Read-only UI:** disable actions that write. On the given side, a refused change currently says "Cheque not found".
- **Admin section:** a small `/admin` for accounts and plans only, showing counts and never cheque data.
  - Admins are marked by a role in `app_metadata`.
  - Every admin action is logged.
- **Legal and privacy:**
  - terms, privacy policy and refund policy
  - India's DPDP Act and the GDPR
  - data export and account deletion
- **Quality:** end-to-end tests with Playwright, and error tracking.
- **Production:** a production Supabase project that deploys from a release branch or tags.
- **Companions:** they need per-user tokens before they can use a shared database. Until then, they stay on the maintainer's personal instance.
- **Business decisions:** prices, trial length and international pricing stay out of this public repo. Ask me for them.

## Loose ends

- **Dependabot:**
  - Check CI on #1 and #2 (GitHub Actions) and #3 (grouped updates), and merge the ones that pass.
  - Hold the major upgrades and do them together later: #4 and #6 (plugin-react 6 and Vite 8, which fail CI today), #5 (react-day-picker 10) and #7 (Vitest 5).
- **auto-pass:** it isn't declared in `supabase/config.toml`, so the integration won't deploy it. Its cron job also isn't scheduled on the dev project.
- **Translations:** UI text isn't in translation files yet. That's needed for other languages and for the US "check" spelling.
