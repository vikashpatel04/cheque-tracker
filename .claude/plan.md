# Plan

The agreed plan for Cheque Tracker v2, approved by the maintainer on 2026-09-27, and the tracker for it. Notes from the latest session are in [handover.md](handover.md).

## How to use this file

- Every item keeps its number for good. New items take the next free number (68 up) and go where they belong in their section. Never renumber.
- `[x]` is done and `[ ]` is to do. The item being worked on says **In progress**.
- Tick an item in the commit that finishes it, so this file's history shows when each one was done.
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
  - Reconfirmed on 2026-09-28: rework the web version (the PWA) first. The maintainer decides about native apps once it's done.
- **70.** Cheques you give show their amount without a minus sign (decided 2026-09-28). People who give cheques think about when money is needed, not about signs; the figures that matter are for today ("Needed in the bank today"). Received amounts keep their "+" until the maintainer reviews the receiving side.
- **71.** Every cheque shows its next step as a button (decided 2026-09-28): Pending → Mark funded, Funded → Mark passed, Returned → decide what happens. "Add funds" isn't a per-cheque action: it's the daily batch for money put into the bank today, where you tick the cheques it covers and they're all marked funded at once. Its total starts at zero again each day, and the app says so where you add funds.
- **72.** The maintainer's own logo replaces the drawn mark (2026-09-28): `public/logo.webp` in the app, and icons made from it in `public/icons/`.

## Order of work

- [x] **7.** Check the dev database's security, read-only, with the Supabase MCP tools.
  - Migrations 001–014 are listed, and the tables exist.
  - Privileges: anon can only read `instance_config`, and signed-in users have no DELETE or TRUNCATE.
  - Every table has row-level security, and anon can't run `SECURITY DEFINER` functions.
  - The maintainer's account has a settings row.
  - `get_advisors`, both security and performance.
  - Fix real findings in migration 015, with tests.
  - Findings (2026-09-27): privileges and RLS were right. 015 makes the policies call `auth.uid()`, `has_write_access()` and `current_setting()` once per statement, indexes five foreign keys, and stops anyone calling Supabase's `rls_auto_enable()`. Tests now guard all three. With 015 deployed, the advisors list only leaked-password protection, which needs the Pro plan (see 52), and "unused index" notes, which only mean the database is new.
- [x] **8.** Regenerate `src/types/database.ts`, which predates regions, editions and received cheques, and fix the type errors it reveals.
  - The Supabase client now uses these types (`createClient<Database>`), so table, column and function names are checked at build time. Regenerate after every schema change.
  - The app's own row types in `src/types` stay stricter (known statuses, columns with defaults never null), and hooks cast query results to them.
- [x] **9.** Import from an export. Settings → Import reads a Cheque Tracker export and shows a preview, then brings in parties, given cheques with their real status and dates, and funds added. If anything fails, nothing is saved.
  - Read both formats. v0's export has the sheets Parties, Cheques, History and Deposits. The current one has Parties, Given cheques, Given history, Funds added, Received cheques, Received history and Bank accounts.
  - Statuses are exported as labels and dates in the user's format, so map both back.
  - The cheque sheets have no ID column, so history can't be linked to its cheque. Give each imported cheque one "Imported" history entry.
  - Built:
    - Migration 016's `import_data()` checks every value and saves all or nothing. It only imports into an account with no parties or cheques, and skips funds added that are already there.
    - The parser in `src/lib/importPlan.ts`, and a Settings → Import card with a preview.
    - Rollback won't undo an import entry. The dashboard leaves import entries out of recent activity and "passed" dates, and Reports counts re-presented cheques as returned.
  - On 2026-09-27 the maintainer's v0 export went into the dev project: 97 parties, 82 given cheques and 7 funds added. The card still needs a look at phone width, as part of 12.
- [ ] **10.** Add cheque IDs to the export, so a later import brings history back too.
  - Moved on 2026-09-27: do it with 57. IDs alone don't bring history back; the export also needs exact times and the data that undo relies on.
- [x] **11.** Made-up sample data for both sides, since a v0 export has no received cheques. Later it can become a "try with sample data" option for new sign-ups. Real cheque, party or bank data never goes in the repo or the tests.
  - Done in 14, step 4: Settings → Sample data (`src/lib/sampleData.ts`). Onboarding (step 5) can offer the same button to new sign-ups.
  - Moved on 2026-09-27: build it with the received screens in 14. Received cheques have no screens yet, so sample ones would be invisible.
- [x] **12.** Try the app with the maintainer, who signs in themselves: region setup, Settings, then the main screens. Fix what breaks.
  - On 2026-09-27 the maintainer went through the screens with the imported data, and everything showed properly. The layout problems in 15–24 are for the redesign.
- [x] **13.** Write the brief for Claude Design from this plan, covering screens 30–40.
  - The brief is `docs/design-brief.md`.
- [x] **68.** Design screens 30–40 from the brief on a Claude Design canvas. The maintainer reviews them before 14.
  - Approved on 2026-09-28: build them, keeping the Passbook look exactly as designed.
  - Canvas (private to the maintainer): https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG
  - Round 1, 2026-09-27: the "Passbook" direction (warm paper, cheque-ink blue for actions, green only for money in, IBM Plex Sans / Serif / Mono). It covers the system sheet, Today and Cheques at desktop and phone width, and cheque detail, add cheque and deposit on the phone. Waiting for the maintainer's review.
  - The maintainer liked the colours and fonts. On their request, `docs/feature-map.md` now lists every current feature with its place in the redesign; it's the checklist for 68 and 14.
  - Round 1b: Today for people who only give and for people who only receive, at desktop and phone width, plus an All / Given / Received switch. The choice is only a view, not an account type.
  - Round 2, done: Add funds (phone), Calendar (desktop and phone), Parties and the two-way party ledger, Reports overview, and Settings, including "What you track".
  - Round 3, done:
    - Sign-up.
    - Onboarding in three steps: region, what you track, and a first-run Today with a checklist and "Try with sample data".
    - Re-presenting a returned cheque.
    - Dark mode for Today and Cheques on the phone, derived from the light screens with a fixed colour map.
    - The landing and pricing page, with placeholders for prices and trial length.
  - 27 boards in all. Not designed: the pack checkout (with 53), and desktop versions of the phone-only screens, which follow the same patterns.
- [ ] **14.** Build the new layout, then the received-cheque screens on it. **In progress** (started 2026-09-28), web version first, in this order:
  - [x] 1. Colours, fonts and the frame: sidebar, bottom tabs, New menu, search, notifications. The installed app (PWA) keeps working: icons, offline start, updates.
    - Done 2026-09-28. Passbook tokens (light and dark) in `src/index.css`; IBM Plex bundled; restyled buttons, fields, cards, dialogs, menus and tabs; status chips with icons.
    - Frame: sidebar and top bar (search, New, bell, account) on desktop; bottom tabs with a raised + and a More sheet on phones. The New menu, search (Ctrl K, by cheque number, party or amount), Add funds and the cheque detail open from any page. The bell lists recent changes. Appearance (device, light, dark) is in the account menu and More.
    - Installed app: new icons from the logo (including maskable and Apple ones), a manifest in the Passbook colours, a service worker built per release that starts the app offline and offers "A new version is ready" instead of switching under you, an install option, and an offline notice. Checked with `npm run preview`: installs, starts offline, updates.
    - Kept for now: Returned stays in the menu until it becomes a saved view (step 3); the old dashboard sits under the new Today title until step 2; a basic Calendar page reuses the old calendar until step 5. Screens not yet rebuilt still have some fixed colours, which suit light more than dark.
  - [x] 2. Today in all three views.
    - Done 2026-09-28. Today replaces the dashboard: All, Given and Received views (switch in the page, default from Settings → What you track), the three numbers, the week strip, to-dos with one action each, and the chart for each view, at desktop and phone width. The sidebar's Today shows how many things there are to do.
    - The figures and to-dos are pure functions in `src/lib/today.ts`, tested in `tests/today.test.ts`. Today loads only open cheques and a window of dates, page by page, so it isn't capped at 1,000 rows.
    - Migration 017 adds `settings.tracks` (given, received or both; both by default). Until it's pushed, the app treats everyone as both and saving the setting fails politely. After it's on the dev project, regenerate `src/types/database.ts` (the `tracks` lines were added by hand to match).
    - Nothing from the dashboard is lost: its running-total chart is now in Reports → Daily Cash Flow and its six-month trend in Reports → Monthly, until Reports is rebuilt (step 5). Recent activity is the bell. The old calendar is the Calendar page.
    - Received to-dos and the Deposit button are wired to placeholders that say the screens are coming; step 4 connects them.
  - [x] 3. Cheques and cheque detail.
    - Done 2026-09-28. Cheques shows both directions: All / Received / Given tabs with counts, saved views with counts (to deposit, needs funds, in clearing, funded, overdue, returned, bounced, security, series), filter pills for due dates, party, bank or account, status and order, search by number, party or amount, and totals. Desktop has a table with selection (add funds, mark passed, or deposit several at once) and a row menu with every status change, edit and undo. Phones get cards grouped by day with swipe for the main action, and a filter sheet. Export to PDF or Excel keeps the filters. Filters live in the address bar, so Today can open a view.
    - The cheque detail is a panel (full screen on phones): who it's to, the amount, status and tags, one card with the next step (add funds, did it pass, present again or write off, issue a replacement), details, the party with a link to its ledger, and the history with undo. Edit, cancel and delete are in its menu.
    - Returned is now the "Returned" view; /returned redirects there. The old list, Returned page and badge helpers are gone. The list's logic is tested in `tests/chequeList.test.ts`.
    - Received rows already show here; opening, depositing and swiping them use the step 4 placeholders.
    - Revised after the maintainer's review (2026-09-28, items 70–72): every row, card and to-do shows its next step as a button (Mark funded, Mark passed, Decide), and the same step on swipe; per-cheque "Add funds" is gone; given amounts have no minus sign; Add funds explains that it records today's money and starts from zero each day. The table shows from 1280px wide, cards (two columns on tablets) below that. The new logo is in.
  - [x] 4. The received-cheque screens, with made-up received cheques (11).
    - Done so far (2026-09-28): Settings → Bank accounts (add, edit, default, remove; `src/lib/bankAccounts.ts`, `useBankAccounts`); `PartyPicker` (choose or add a party inside a form); the received-cheque form (one cheque, a security cheque or a series, and editing), opened from New → Received cheque or Series, with the "I received it / I gave it" switch (the given form got the same look); the New menu follows What you track.
    - Also done (2026-09-28): the deposit panel (date, account, tick cheques, deposit all at once); the received cheque detail with its next step and every action (mark cleared, bounced, deposit again now or later, paid another way, got a new cheque, hand back, write off, undo, edit, delete); "Mark cleared" and "Deposit" work from rows, cards, swipe and Today; received cheques in search; Settings → Sample data ("Try with sample data" adds made-up parties named "(sample)", an account and received cheques in every state, plus given ones for an account without any; "Remove sample data" takes it all away). Plan tested in `tests/sampleData.test.ts`.
    - Checked 2026-09-29 with the sample data (the maintainer said yes to adding it): Today's Received view, the deposit panel, the received detail and its dialogs, and the received list on phones all work. Fixed on the way: the sample could be added twice (now one set at a time), "goes stale" showed for dates months away (now only within a week), short dates read "05 Oct" (now "5 Oct"), and cheques in clearing sat under "Overdue" in the phone list (now their own group). One sample set is on the dev project; Settings → Sample data removes it.
    - The maintainer will review the receiving side's wording and signs later (they said so on 2026-09-28).
  - [ ] 5. Add funds, Calendar, Parties, Reports, Settings and onboarding. **In progress** (2026-09-29).
    - Add funds done: one panel (design board Add-funds-phone): the amount, date and note, the pending cheques it covers ticked for you as you type (soonest due, smallest or largest first), what's added, covered and left over, and "Add funds and mark N funded". It says that today's total starts from zero each day. The old two-step dialog is gone.
    - Calendar done: its own month grid (money in and out per day, dots for what needs you or went wrong, grey when done), Month and Agenda, All / Given / Received, and the chosen day's cheques with Add funds or Deposit; month, day and view live in the address bar. Today's week strip opens the day here. The react-big-calendar library and the old day dialog are gone. Month logic tested in `tests/calendar.test.ts`.
    - Parties done (2026-09-29): the list shows, per party, what you still pay, what you still collect, the net in words ("₹X to collect" / "to pay", no minus), bounces and the next date, with search, All / You pay / Pay you, four orders and "Show inactive", all in the address bar; a table on desktop, cards on phones and tablets, totals underneath. Logic in `src/lib/parties.ts`, tested in `tests/parties.test.ts`.
    - Party ledger done (2026-09-29), replacing the old party detail: name, contact, a phone link and a WhatsApp link (a number written without a country code gets the one from the user's region preset, `callingCode` in `src/config/regions.ts`); Edit (the party form, restyled like the cheque forms, with Active and Delete); New cheque for this party (received cheque, series, given cheque, several given cheques; follows What you track); tiles for what you gave, what they gave, the net still due and bounces; All / Given / Received with counts and a status filter; every cheque with its next step (the Cheques table with the bank in place of the party, or cards led by the cheque number).
    - Ledger choices: open cheques first, soonest due, then finished ones newest first (the brief says newest first; this puts what needs doing on top). No running "net so far" column, because given amounts carry no minus (70). "Send a reminder" from the brief waits for the maintainer's review of the receiving side; the WhatsApp link opens the chat meanwhile.
    - Fixed on the way: the party cards on phones were wider than the screen; the parties list flashed back to loading after every save; the party form reopened with the old values after an edit.
    - Next: Reports, Settings, onboarding.

## Layout and navigation

Why: the dashboard stacks about ten blocks, and four of them show the same "what's due". The header only has Add funds. The cheque list is a 9-column table that scrolls sideways on phones. Returned is its own page, and colours are hardcoded.

- [x] **15.** Main sections: Today, Cheques, Calendar, Parties, Reports, Settings.
  - Done in 14, step 1. Returned stays under them until 19.
- [ ] **16.** Always visible: a New button (received cheque, given cheque, series, add funds, import), search by cheque number, party or amount (Ctrl K), and notifications.
  - Built in 14, step 1, for given cheques. Received cheques and series join the New menu and search in step 4.
- [x] **17.** Today: three numbers first (in clearing, due, net), then to-dos with one action each, then one in/out chart. People who only give or only receive see only their half.
  - Done in 14, step 2. The received actions open their screens once step 4 builds them.
- [x] **18.** Cheques: All / Received / Given tabs, plus saved views: To deposit, In clearing, Bounced, Security, Series.
  - Done in 14, step 3, with given views too (needs funds, funded, overdue, returned).
- [x] **19.** Returned stops being a page and becomes a saved view and a to-do. Bulk add moves under New.
  - Done in 14, steps 1 to 3.
- [x] **20.** Parties: a two-way ledger per party, showing given, received, net and bounces.
  - Done in 14, step 5 (2026-09-29): the Parties list and the party ledger.
- [ ] **21.** Settings: profile, region, bank accounts, notifications, plan and billing, data.
- [ ] **22.** Mobile: bottom tabs (Today · Cheques · + · Parties · More), cards instead of tables, swipe to deposit or confirm, and full-screen forms.
  - Bottom tabs (step 1), cheque cards with swipe and a full-screen detail (step 3) are done. Forms go full screen with their redesign (steps 4 and 5).
- [ ] **23.** Reports:
  - Sticky filters: dates, direction, party, account, status.
  - Tabs: Overview, Cash flow, Collections (ageing in 0–30 / 31–60 / 61–90 / 90+ day buckets, and bounce rate), Payments, Parties, Bounces, and Accounts and funds.
  - Each tab exports with its filters applied.
- [ ] **24.** Move totals into SQL. Today Dashboard and Reports load every cheque into the browser, and the totals silently go wrong past 1,000 rows.
  - Today no longer has the problem (14, step 2: it pages through only the cheques it needs). Reports, the cheque list and parties still load everything in one request.

## Visual rules

- [ ] **25.** Money in is green (↙). Money out is neutral ink with a minus sign (↗).
  - Changed by 70: money out is neutral ink with no minus sign.
- [ ] **26.** Red is only for problems and amber for attention. Status shows as an icon plus text, never colour alone.
- [ ] **27.** Amounts use tabular figures: compact in tiles, full in tables, grouped the way the region writes numbers.
- [ ] **28.** Semantic tokens (`--money-in`, `--money-out`, `--status-*`) replace hardcoded colours, which also gives dark mode.
  - Tokens and dark mode are in (14, step 1). The fixed colours left in Today, the cheque list and Reports go as each screen is rebuilt.
- [ ] **29.** Still to choose: brand colour, typeface, logo, a density setting, empty states, and a first-run checklist.
  - Chosen with Passbook (68): brand colour, typefaces and logo. The first-run checklist is designed (onboarding). Still open: density and empty states.

## Screens for the design brief

All designed on the canvas (68). Building them is 14.

- [x] **30.** Landing and pricing
- [x] **31.** Sign-up and onboarding, including region setup
- [x] **32.** Today, on desktop and mobile
- [x] **33.** Cheques list
- [x] **34.** Cheque detail, with timeline and actions
- [x] **35.** Add cheque: received, given and series
- [x] **36.** Deposit batch
- [x] **37.** Bounce resolution
- [x] **38.** Party ledger
- [x] **39.** Reports overview
- [x] **40.** Settings and billing

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

- [ ] **52.** Sign-up: email and password with verification, Google sign-in, password reset, CAPTCHA, and custom SMTP. Turn on leaked-password protection in Auth settings; it needs the Pro plan.
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
- [ ] **69.** Load less up front: the app is one 2.5 MB script (750 kB compressed). Load Excel and PDF export, charts and the calendar only when they're needed, so the app opens faster on phones.

## The maintainer's decisions

These are kept outside this repo. Ask the maintainer.

- [ ] **65.** Free trial length.
- [ ] **66.** International pricing, and whether to sell abroad through a merchant of record.
- [ ] **67.** Where the private business plan lives.
