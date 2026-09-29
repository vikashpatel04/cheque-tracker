# Handover

Status on 2026-09-29, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file and the ticks in [plan.md](plan.md). Keep both free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

The agreed plan and its progress are in `.claude/plan.md`. Work through its **Order of work** from the first unticked item, one at a time. Check with me before anything that changes Supabase settings or data.

## Where things stand

- **Code:** all work is committed on `main`. 119 tests pass; lint (0 errors, 5 known warnings) and build are clean.
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Deploy to production" is on for `main`, with working directory `.`, so pushing new files in `supabase/migrations/` applies them. Migrations 001–016 are applied.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - My account has a settings row (region India). `instance_config.billing_enabled` is false, so everything is unlocked.
  - My v0 data is imported there as sample data: 97 parties, 82 given cheques and 7 funds added. The only received cheques are the made-up sample set (parties named "(sample)"); Settings → Sample data removes it.
  - `.env.local` points at it.
- **Running the app:** `.claude/launch.json` starts `npm run dev` ("dev") for the browser pane. I sign in myself. If the pane can't load `localhost:5173`, open `http://127.0.0.1:5173` instead; a sign-in on one address doesn't carry over to the other.
  - To test the installed app (service worker, offline start, updates), run `npm run build`, then the "preview" configuration (port 4173). The dev server has no service worker on purpose.
- **Redesign:**
  - The design is done and approved: 27 boards on a private Claude Design canvas, https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG. I liked the "Passbook" look: warm paper, cheque-ink blue, green only for money in, IBM Plex fonts. Keep it exactly.
  - **Building it (item 14) started on 2026-09-28, web version first.** Step 1 is done: the Passbook colours (light and dark), fonts, the new frame (sidebar and top bar on desktop, bottom tabs on phones, New menu, search, activity bell, appearance), and the installed app (icons, offline start, update prompt, install option). `CLAUDE.md` says where each piece lives.
  - Step 2 is done: Today in the All, Given and Received views, replacing the dashboard. Its logic is `src/lib/today.ts`. Settings has "What you track", which needs migration 017 (see below).
  - Step 3 is done: the Cheques list (tabs, saved views, filters, table and phone cards with swipe, export) and the cheque detail panel. Returned is now a saved view.
  - Step 4 is done: the received-cheque screens (form, deposit, detail and every action, search) and Settings → Sample data. One sample set is on the dev project (I said yes on 2026-09-29); remove it any time in Settings. I'll review the receiving side's wording and signs later.
  - Step 5 is in progress: Add funds (one panel), the Calendar (own month grid and agenda), Parties (the list and the two-way party ledger, with phone and WhatsApp links), Reports (seven tabs, filters that stay in view, PDF and Excel export per tab) and Settings (the board's sections, each saved as it changes) are done. Onboarding is next. The plan's step 5 notes say what each part does and what was left for later.
  - `docs/design-brief.md` describes it. Its "Chosen: Passbook" section has the exact fonts, colour tokens (light and dark), status-chip families and layout rules to build from.
  - `docs/feature-map.md` lists every current feature and where it goes, so nothing gets dropped. Its "Views" section says what Today shows in each view.
  - To read a board's markup, use the Artifact tool's `read` on the canvas, `project/<Board>.dc.html`.
- **Next:** continue item 14, step 5:
  1. ~~Tokens, fonts and the new frame~~ (done).
  2. ~~Today in all three views~~ (done).
  3. ~~Cheques and cheque detail~~ (done).
  4. ~~The received-cheque screens~~ (done).
  5. ~~Add funds, Calendar, Parties, Reports, Settings~~ (done), then onboarding.

  Tick the feature map off as you go, and check every screen at desktop and phone width. Items 10 and 11 were moved; see their notes in the plan.
- **Not pushed yet:** commits from `a403464` onward: docs, then the redesign so far. Step 2 adds migration `017_tracks.sql` (one new column, `settings.tracks`, default "both"); pushing applies it to the dev project. Then regenerate `src/types/database.ts` with the Supabase MCP tools and check it matches the hand-added `tracks` lines.
- **Folders:** this repo is `C:\Users\vikas\projects\cheque-tracker`, and v0 is `../Cheque-Tracker-v0`. On 2026-09-26 some of this repo's files were accidentally moved into the v0 folder; they're back. If a tracked file ever goes missing, `git show HEAD:<file>` has it.

## Decided on 2026-09-28

- After reviewing steps 1 to 3 (plan items 70–72): cheques you give show no minus sign; each cheque's next step is a button (Pending → Mark funded, Funded → Mark passed, Returned → decide); Add funds is only the daily batch for money put into the bank today, which funds the ticked cheques at once and starts from zero each day, and the app says so. I'll review the receiving side's wording and signs later.
- My own logo is the app's logo: `public/logo.webp` and the icons in `public/icons/`, made from it.
- Build the web version (the PWA) first; I decide about native apps once it's done. Keep the Passbook look exactly as designed.
- Fonts are bundled with the app instead of loaded from Google, so the installed app works offline and makes no third-party requests.
- Light or dark follows the device unless you pick one under Appearance; the choice is saved per device.
- Until their screens are rebuilt: Returned stays in the menu (it becomes a saved view in step 3), and the old dashboard sits under the new Today title (step 2).

## Decided on 2026-09-27

- The app shows no source-code link unless a deployment sets `VITE_SOURCE_URL`. Before merging the first outside contribution, adopt a CLA or set the link on the hosted edition; see `docs/editions.md`.
- The plan in `plan.md` was approved as written. Later the same day: item 10 (IDs in the export) moved to go with 57, and item 11 (sample data) with the received screens in 14.
- Which cheques someone sees (given, received or both) is only a view. Settings sets the default, and Today and Cheques have an All / Given / Received switch.
- The redesign keeps every existing feature (`docs/feature-map.md`).
