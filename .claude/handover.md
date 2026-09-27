# Handover

Status on 2026-09-27, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file and the ticks in [plan.md](plan.md). Keep both free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

The agreed plan and its progress are in `.claude/plan.md`. Work through its **Order of work** from the first unticked item, one at a time. Check with me before anything that changes Supabase settings or data.

## Where things stand

- **Code:** all work is committed on `main`. 57 tests pass; lint (0 errors) and build are clean.
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Deploy to production" is on for `main`, with working directory `.`, so pushing new files in `supabase/migrations/` applies them. Migrations 001–014 are applied.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - My account has a settings row. `instance_config.billing_enabled` is false, so everything is unlocked.
  - `.env.local` points at it.
- **Running the app:** `.claude/launch.json` starts `npm run dev` for the browser pane. I sign in myself.
- **Screens:** there are no screens for received cheques yet. They come with the redesign (plan items 13–14).
- **Folders:** this repo is `C:\Users\vikas\projects\cheque-tracker`, and v0 is `../Cheque-Tracker-v0`. On 2026-09-26 some of this repo's files were accidentally moved into the v0 folder; they're back. If a tracked file ever goes missing, `git show HEAD:<file>` has it.

## Decided on 2026-09-27

- The app shows no source-code link unless a deployment sets `VITE_SOURCE_URL`. Before merging the first outside contribution, adopt a CLA or set the link on the hosted edition; see `docs/editions.md`.
- The plan in `plan.md` was approved as written.
