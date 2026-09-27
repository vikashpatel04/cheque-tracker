# Plan

The agreed plan for Cheque Tracker v2, approved by the maintainer on 2026-09-27, and the tracker for it. Notes from the latest session are in [handover.md](handover.md).

## How to use this file

- Every item keeps its number for good. Add new items at the end of the section they belong to, numbered from 68 up, and never renumber.
- `[x]` is done, with the commit that finished it. `[ ]` is to do. The item being worked on says **In progress**.
- Tick an item in the same commit that finishes it.
- To drop an item, strike it through and say why. Don't delete it.
- Work through **Order of work** from the top unless the maintainer says otherwise. The other sections are the backlog it draws from.
- Ask the maintainer before anything that changes Supabase settings or data. Business decisions (prices, trial length, international pricing) stay out of this public repo.

## Decided

- **1.** Received cheques have their own tables. *Built in migration 012.*
- **2.** One user per account for v1, with no team workspaces.
- **3.** Several countries from day one, India first, with nothing country-specific in the code (see `docs/regions.md`).
- **4.** The given side says "Funded" instead of "Deposited" (the database value stays `DEPOSITED`), and the word "Parties" stays.
- **5.** The hosted service sells prepaid packs through Razorpay.
- **6.** PWA only for now; native apps later.

## Order of work

- [ ] **7.** Check the dev database's security, read-only, with the Supabase MCP tools. **In progress**
  - Migrations 001–014 are listed, and the tables exist.
  - Privileges: anon can only read `instance_config`, and signed-in users have no DELETE or TRUNCATE.
  - Every table has row-level security, and anon can't run `SECURITY DEFINER` functions.
  - The maintainer's account has a settings row.
  - `get_advisors`, both security and performance.
  - Fix real findings in migration 015, with tests.
- [ ] **8.** Regenerate `src/types/database.ts`, which predates regions, editions and received cheques, and fix the type errors it reveals.
- [ ] **9.** Import from an export. Settings → Import reads a Cheque Tracker export and shows a preview, then brings in parties, given cheques with their real status and dates, and funds added. If anything fails, nothing is saved.
  - Read both formats. v0's export has the sheets Parties, Cheques, History and Deposits. The current one has Parties, Given cheques, Given history, Funds added, Received cheques, Received history and Bank accounts.
  - Statuses are exported as labels and dates in the user's format, so map both back.
  - The cheque sheets have no ID column, so history can't be linked to its cheque. Give each imported cheque one "Imported" history entry.
- [ ] **10.** Add cheque IDs to the export, so a later import brings history back too.
- [ ] **11.** Made-up sample data for both sides, since a v0 export has no received cheques. Later it can become a "try with sample data" option for new sign-ups. Real cheque, party or bank data never goes in the repo or the tests.
- [ ] **12.** Try the app with the maintainer, who signs in themselves: region setup, Settings, then the main screens. Fix what breaks.
- [ ] **13.** Write the brief for Claude Design from this plan, covering screens 30–40.
- [ ] **14.** Build the new layout, then the received-cheque screens on it.

## Layout and navigation

Why: the dashboard stacks about ten blocks, and four of them show the same "what's due". The header only has Add funds. The cheque list is a 9-column table that scrolls sideways on phones. Returned is its own page, and colours are hardcoded.

- [ ] **15.** Main sections: Today, Cheques, Calendar, Parties, Reports, Settings.
- [ ] **16.** Always visible: a New button (received cheque, given cheque, series, add funds, import), search by cheque number, party or amount (Ctrl K), and notifications.
- [ ] **17.** Today: three numbers first (in clearing, due, net), then to-dos with one action each, then one in/out chart. People who only give or only receive see only their half.
- [ ] **18.** Cheques: All / Received / Given tabs, plus saved views: To deposit, In clearing, Bounced, Security, Series.
- [ ] **19.** Returned stops being a page and becomes a saved view and a to-do. Bulk add moves under New.
- [ ] **20.** Parties: a two-way ledger per party, showing given, received, net and bounces.
- [ ] **21.** Settings: profile, region, bank accounts, notifications, plan and billing, data.
- [ ] **22.** Mobile: bottom tabs (Today · Cheques · + · Parties · More), cards instead of tables, swipe to deposit or confirm, and full-screen forms.
- [ ] **23.** Reports:
  - Sticky filters: dates, direction, party, account, status.
  - Tabs: Overview, Cash flow, Collections (ageing in 0–30 / 31–60 / 61–90 / 90+ day buckets, and bounce rate), Payments, Parties, Bounces, and Accounts and funds.
  - Each tab exports with its filters applied.
- [ ] **24.** Move totals into SQL. Today Dashboard and Reports load every cheque into the browser, and the totals silently go wrong past 1,000 rows.

## Visual rules

- [ ] **25.** Money in is green (↙). Money out is neutral ink with a minus sign (↗).
- [ ] **26.** Red is only for problems and amber for attention. Status shows as an icon plus text, never colour alone.
- [ ] **27.** Amounts use tabular figures: compact in tiles, full in tables, grouped the way the region writes numbers.
- [ ] **28.** Semantic tokens (`--money-in`, `--money-out`, `--status-*`) replace hardcoded colours, which also gives dark mode.
- [ ] **29.** Still to choose: brand colour, typeface, logo, a density setting, empty states, and a first-run checklist.

## Screens for the design brief

- [ ] **30.** Landing and pricing
- [ ] **31.** Sign-up and onboarding, including region setup
- [ ] **32.** Today, on desktop and mobile
- [ ] **33.** Cheques list
- [ ] **34.** Cheque detail, with timeline and actions
- [ ] **35.** Add cheque: received, given and series
- [ ] **36.** Deposit batch
- [ ] **37.** Bounce resolution
- [ ] **38.** Party ledger
- [ ] **39.** Reports overview
- [ ] **40.** Settings and billing

## Received cheques

Already in the database (migration 012; see `docs/received-cheques.md`): deposit (in batches), confirm cleared, bounce with a reason and bank charges, deposit again, replacement cheque, settled another way, hand back, write off, and undo. Also security cheques, series, bank accounts and computed alerts.

Next:

- [ ] **41.** Reminders, by email by default, with PWA push as an option.
- [ ] **42.** A WhatsApp nudge to the payer through a `wa.me` link.
- [ ] **43.** Cheque photos, stored in a private bucket.
- [ ] **44.** When a received cheque clears into an account, offer to use that money for given cheques on the same account.
- [ ] **45.** A combined in/out forecast per account, plus a deposit-list PDF.
- [ ] **46.** Given cheques use the same bank accounts, for a per-account view of money in and out.
- [ ] **47.** Bank holidays and working days in the region, for clearing dates.

Later:

- [ ] **48.** Scan a cheque to fill in the form.
- [ ] **49.** Bounce follow-up with legal deadlines where a country has them. India's Section 138 comes first, presented as reminders, not legal advice.
- [ ] **50.** A party trust score.
- [ ] **51.** Bank statement matching, and export to accounting software.

## Before the hosted service launches

See also "Still needed before billing goes live" in `docs/editions.md`.

- [ ] **52.** Sign-up: email and password with verification, Google sign-in, password reset, CAPTCHA, and custom SMTP.
- [ ] **53.** Payments: Razorpay checkout, and a webhook Edge Function that verifies each payment and inserts a `purchase` entitlement. A new pack starts when the current one ends, so buying early loses nothing.
- [ ] **54.** Renewal reminders before a pack ends.
- [ ] **55.** Read-only UI: expired accounts stay readable and can still export, and actions that write are disabled. On the given side, a refused change currently says "Cheque not found".
- [ ] **56.** A small `/admin` for accounts and plans only, showing counts and never cheque data. Admins are marked by a role in `app_metadata`, and every admin action is logged.
- [ ] **57.** Legal and privacy: terms, privacy policy and refund policy; India's DPDP Act and the GDPR; data export and account deletion.
- [ ] **58.** End-to-end tests with Playwright, and error tracking.
- [ ] **59.** A production Supabase project that deploys from a release branch or tags, and tagged releases for self-hosters.
- [ ] **60.** The maintainer's own data moves from their personal instance to the hosted service as a normal account. Item 9 helps.
- [ ] **61.** The companions (cheque-mcp, Cheque Watch) get per-user tokens before they use a shared database. Until then, they stay on the maintainer's personal instance.

## Loose ends

- [ ] **62.** Dependabot: check CI on #1 and #2 (GitHub Actions) and #3 (grouped updates); the maintainer merges the ones that pass. Hold the major upgrades and do them together later: #4 and #6 (plugin-react 6 and Vite 8, which fail CI today), #5 (react-day-picker 10) and #7 (Vitest 5).
- [ ] **63.** auto-pass: declare it in `supabase/config.toml` so the integration deploys it, and schedule its cron job on the dev project.
- [ ] **64.** Translations: move UI text into translation files, for other languages and the US spelling "check".

## The maintainer's decisions

These are kept outside this repo. Ask the maintainer.

- [ ] **65.** Free trial length.
- [ ] **66.** International pricing, and whether to sell abroad through a merchant of record.
- [ ] **67.** Where the private business plan lives.
