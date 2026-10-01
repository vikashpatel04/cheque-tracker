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
- **73.** The code stays open source under the AGPL-3.0, next to the paid hosted service, as `docs/editions.md` describes (reconfirmed 2026-09-29 after weighing a private repo). The name and logo stay unlicensed (`TRADEMARKS.md`), and outside contributions wait for a CLA.
- **74.** One list of bank accounts (2026-09-29): given cheques pick their bank from Your bank accounts, the same list received cheques are deposited into. The separate "Banks you write cheques on" list goes from Settings; `settings.banks` stays in the database, unused, since changes stay additive.
- **75.** A guide in the app (2026-09-29): "Learn how cheques work" in the sidebar, with the life cycle of given and received cheques and answers to other questions. Where something might confuse, a question links to its answer.
  - Built the same day: /learn (under More on phones), eleven topics in `src/lib/guide.ts` with answers in `src/components/guide/GuideTopics.tsx`, and `HelpLink`, which opens an answer beside the page (so a form in progress isn't lost). Question links sit in Add funds, Funds added today, both cheque details, the security-cheque choice, the deposit panel, auto-pass, Region, the Reports overview, the returned and bounced views, and the party ledger. Add a topic there, and a link where the confusion is.

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
- [x] **14.** Build the new layout, then the received-cheque screens on it. Done 2026-09-29, web version first, in this order:
  - [x] 1. Colours, fonts and the frame: sidebar, bottom tabs, New menu, search, notifications. The installed app (PWA) keeps working: icons, offline start, updates.
    - Done 2026-09-28. Passbook tokens (light and dark) in `src/index.css`; IBM Plex bundled; restyled buttons, fields, cards, dialogs, menus and tabs; status chips with icons.
    - Frame: sidebar and top bar (search, New, bell, account) on desktop; bottom tabs with a raised + and a More sheet on phones. The New menu, search (Ctrl K, by cheque number, party or amount), Add funds and the cheque detail open from any page. The bell lists recent changes. Appearance (device, light, dark) is in the account menu and More.
    - Installed app: new icons from the logo (including maskable and Apple ones), a manifest in the Passbook colours, a service worker built per release that starts the app offline and offers "A new version is ready" instead of switching under you, an install option, and an offline notice. Checked with `npm run preview`: installs, starts offline, updates.
    - Kept for now: Returned stays in the menu until it becomes a saved view (step 3); the old dashboard sits under the new Today title until step 2; a basic Calendar page reuses the old calendar until step 5. Screens not yet rebuilt still have some fixed colours, which suit light more than dark.
  - [x] 2. Today in all three views.
    - Done 2026-09-28. Today replaces the dashboard: All, Given and Received views (switch in the page, default from Settings → What you track), the three numbers, the week strip, to-dos with one action each, and the chart for each view, at desktop and phone width. The sidebar's Today shows how many things there are to do.
    - The figures and to-dos are pure functions in `src/lib/today.ts`, tested in `tests/today.test.ts`. Today loads only open cheques and a window of dates, page by page, so it isn't capped at 1,000 rows.
    - Migration 017 adds `settings.tracks` (given, received or both; both by default). Pushed and applied to the dev project on 2026-09-29; the regenerated `src/types/database.ts` matched the lines added by hand.
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
  - [x] 5. Add funds, Calendar, Parties, Reports, Settings and onboarding. Done 2026-09-29.
    - Add funds done: one panel (design board Add-funds-phone): the amount, date and note, the pending cheques it covers ticked for you as you type (soonest due, smallest or largest first), what's added, covered and left over, and "Add funds and mark N funded". It says that today's total starts from zero each day. The old two-step dialog is gone.
    - Calendar done: its own month grid (money in and out per day, dots for what needs you or went wrong, grey when done), Month and Agenda, All / Given / Received, and the chosen day's cheques with Add funds or Deposit; month, day and view live in the address bar. Today's week strip opens the day here. The react-big-calendar library and the old day dialog are gone. Month logic tested in `tests/calendar.test.ts`.
    - Parties done (2026-09-29): the list shows, per party, what you still pay, what you still collect, the net in words ("₹X to collect" / "to pay", no minus), bounces and the next date, with search, All / You pay / Pay you, four orders and "Show inactive", all in the address bar; a table on desktop, cards on phones and tablets, totals underneath. Logic in `src/lib/parties.ts`, tested in `tests/parties.test.ts`.
    - Party ledger done (2026-09-29), replacing the old party detail: name, contact, a phone link and a WhatsApp link (a number written without a country code gets the one from the user's region preset, `callingCode` in `src/config/regions.ts`); Edit (the party form, restyled like the cheque forms, with Active and Delete); New cheque for this party (received cheque, series, given cheque, several given cheques; follows What you track); tiles for what you gave, what they gave, the net still due and bounces; All / Given / Received with counts and a status filter; every cheque with its next step (the Cheques table with the bank in place of the party, or cards led by the cheque number).
    - Ledger choices: open cheques first, soonest due, then finished ones newest first (the brief says newest first; this puts what needs doing on top). No running "net so far" column, because given amounts carry no minus (70). "Send a reminder" from the brief waits for the maintainer's review of the receiving side; the WhatsApp link opens the chat meanwhile.
    - Fixed on the way: the party cards on phones were wider than the screen; the parties list flashed back to loading after every save; the party form reopened with the old values after an edit.
    - Reports done (2026-09-29; checked at desktop and phone width, and every tab's PDF and Excel export): design board Reports-desktop. Filters that stay in view (due dates, direction, party, bank or account, status; the same address-bar names as Cheques, and a sheet on phones), seven tabs in the address bar, and "Export this tab" (PDF or Excel, filters written at the top). Logic in `src/lib/reports.ts`, tab contents and tables in `src/lib/reportTables.ts`, both tested in `tests/reports.test.ts`; export in `src/lib/reportExport.ts`.
      - Overview: received, given, still to collect, still to pay; money in and out by month; where the cheques stand (amount and count per status); biggest parties.
      - Cash flow: needed today, the next and last 14 days, the 28-day chart and day-by-day table, running total for 30 days, the given six-month trend (both moved from the old dashboard), month by month.
      - Collections: still to collect, in clearing, bounced, bounce rate; ageing in 0–30 / 31–60 / 61–90 / 90+ days; who owes most; oldest first.
      - Payments: given, passed, still to pay, returned at some point; month by month with a chart; every status.
      - Parties: top eight both ways, and every party with net in words.
      - Bounces: both ways, by reason and by party, bank charges, and every cheque that came back with where it stands now.
      - Accounts and funds: funds added, cheque payments, received by account, given by bank, funds against payments by day and month.
    - Report choices: cheques group by due date everywhere, like the filter (the old monthly report used the issue date). Cancelled, written-off, handed-back and replaced cheques, and security cheques still held, stay out of totals (`countsAsGiven` / `countsAsReceived` in `chequeList.ts`; Parties uses the same rules now). "Around today" figures and charts ignore the dates filter. Changes that were undone don't count as returned or passed. Net and shortfalls are words, not minus signs (70).
      - Fixed while checking: Biggest parties keeps to Party, Given, Received and Net as on the board; empty days in Day by day show a dash; the funds chart puts running totals on their own right-hand scale (the daily bars were flattened); bounced amounts show without a plus; small tables fit half-width cards; the monthly bars open on the latest months on phones; PDF headings line up with their numbers.
    - Settings done (2026-09-29; checked at desktop and phone width): design board Settings-desktop. A list of sections beside them (a scrolling row on phones) that follows where you are, and an address for each (/settings#region, #sample-data…). What you track; Region as a summary with Change; Your bank accounts (Edit, with Remove inside); Cheques you give (auto-pass and its time, the order Add funds covers cheques in, your banks), each saved as you change it; Appearance (this device); Plan (hidden when self-hosted); Your data (export everything, import an export, sample data, delete all with a typed phrase); Profile and sign-in. The board's Reminders section waits for reminders themselves (41). Sample data actions are in `useSampleData`, for onboarding to reuse.
    - Also added: a page that crashes now says so inside the frame and recovers when you move to another page, instead of blanking the whole app (`ErrorBoundary` in `Layout`).
    - Onboarding done (2026-09-29; checked on the phone through a preview, since the maintainer's account is set up): boards Onboarding-region-phone and Onboarding-track-phone. Three steps after the first sign-in: where you use cheques (countries, the one from your time zone first, search, and how amounts and dates will look), what you use them for (give, receive or both), and your bank accounts (the brief's optional step 4, which has no board; skippable). Region and choice are saved together at the end, so leaving halfway starts again. `Onboarding` replaces `RegionSetup`.
    - Today's first-run checklist (board Today-first-run-phone): region, what you track, a bank account, your cheques, with Add buttons, until it's all done or hidden on that device, and "Try with sample data" while there are no cheques. The board's "Turn on reminders" step waits for reminders (41).
    - The sign-in screen takes the Signup-phone board's look. Creating an account, password reset and Google stay with 52.

- [x] **76.** Bring the last screens in the old look into Passbook: Several given cheques (`BulkAdd`), the Excel upload dialogs for cheques and parties, "Present it again" (`RePresentDrawer`) and the return-reason dialog (`StatusActions`). Added 2026-09-29, after 14.
  - Done 2026-10-01:
    - **Several given cheques:** a card per cheque with the given form's labels, and a remove button you can always see (it used to show only on mouse hover). A bar under the list shows the count and total, with Add another and Save. After a save with details missing, each cheque says what it still needs.
    - **Excel imports** (cheques and parties): three steps (template, account, file) with a shared `ExcelFileChooser`, then a list of every row: ready, skipped (and why), or a warning.
    - **Cheque imports and accounts:** they now save on an account: "From your account" (your default first), or "The bank in each row" with no account, as before accounts.
    - **"It came back unpaid"** (was "Mark cheque as Returned"): the cheque's number, party and amount, a "Why" field suggesting common reasons (`src/lib/returnReasons.ts`, shared with the received side's bounce), and the guide's question link.
    - **"Present it again"** is now `PresentAgainDialog`, a dialog instead of a side sheet. A checkbox ("The money for it is already in the bank") replaces the split Save button and its menu. The stale warning uses the attention colour.
    - **Also:**
      - The write-off dialog's wording now matches the received side ("Write it off", "Why").
      - The unused `ChequeStatusActions` panel is gone (lint warnings 5 → 2).
      - Shared dialogs have one column that can't grow past the screen (a long account name in a Select did), start at the top on full-screen phone dialogs, and have left-aligned titles.
      - `AlertDialog` has the Passbook scrim, surface and corners, with a margin on phones.
    - **Checked** at phone width with the maintainer's data (imports fed made-up files; nothing saved) and Several given cheques at desktop width. The dev data has no ordinary returned cheque, so "Present it again" was checked with a made-up cheque rendered on its own.
- After 14, the maintainer reviews the whole redesign, then picks what's next from the backlog.
- From the maintainer's first review on the phone (2026-09-29), in this order:
  - [x] **77.** Given cheques are drawn on one of your accounts, not just a bank. Two accounts at the same bank show as one line today (screenshot 3), so you can't pick the second one. Migration 018 adds `cheques.bank_account_id` (nullable, additive; a trigger checks the account is yours); the given form and Several given cheques pick an account, showing its name and last four digits, and still fill `bank_name` from it for the companions. Older cheques keep their bank name until edited.
  - [x] **78.** Add funds says which account the money went into (migration 018 adds `daily_deposits.bank_account_id`, and `record_deposit` takes the account). The default account is chosen first; the cheques it ticks and lists are the ones drawn on that account, and older cheques without an account are listed after them.
  - [x] **79.** The Add funds list gets dividers as you scroll: Overdue, Today, Tomorrow, then Later.
  - Built 2026-09-30 (77–79), committed by the maintainer as `29532f0` and pushed before a browser check, for them to test on another PC; migration 018 is on the dev project: migration 018 (tested in `tests/accounts.test.ts`), `AccountPicker` (the account gets its own full-width row in the given form), Add funds' "Into which account?" with `suggestForAccount` and `dueGroup` (tested in `tests/allocation.test.ts`), and the account in the given cheque's details. `src/types/database.ts` was regenerated on 2026-09-30. Checked in the browser on 2026-10-01 at phone width, with the maintainer's own data: two accounts at the same bank are separate choices, a new cheque starts on the default account, Add funds ticks by account and marks cheques with no account, and its divider stays under the header as you scroll. Only Later had cheques that day; the other groups are unit-tested.
  - [x] **80.** Pickers on phones (party, bank): when the keyboard opens, the list jumps above the field and its search box goes off-screen (screenshots 4 and 5). On phones, open pickers as a sheet with the search at the top. The bank list is also as narrow as its field, which cuts off names (screenshot 3).
  - Built 2026-10-01 in `Combobox`, so every picker gets it:
    - Below `sm` (`useIsPhone` in `src/hooks/useMediaQuery.ts`, the width where dialogs fill the screen), it opens as a sheet from the bottom, titled by a new `title` prop.
    - Lists of 8 or more (parties, time zones) get a tall sheet with the search at the top, where the keyboard can't cover it. The keyboard opens only when you tap the search. Shorter lists (your accounts) are a compact sheet to tap, without a search.
    - On phones only the chosen option is highlighted. The chosen option opens in view, e.g. your time zone among 418.
    - On desktop the list is at least 18rem wide, so names aren't cut off in narrow fields (Several given cheques).
    - Checked at phone width (account, party with search, time zone) and at desktop width (Several given cheques).
  - [x] **81.** Suggest the next cheque number from the chosen account's own cheque book. Today the given form and Several given cheques suggest the last cheque *added* plus one, across all accounts, so after adding an older cheque, or with two cheque books, they suggest a number that's already used (seen 2026-10-01). Proposed:
    - Suggest one after the latest-issued cheque on that account (ties: the highest number).
    - Older cheques with no account count for the default account.
    - Skip numbers already used on that account.
    - Suggest again when the account changes.
    - An account with no cheques yet gets no suggestion.
    - Also: "Already used" and "Repeated in another row" count only the same cheque book, since two books can share a number.
    - Built 2026-10-01:
      - The rule is `suggestChequeNumber` in `src/lib/chequeNumbers.ts`, tested in `tests/chequeNumbers.test.ts`. It reads your latest 500 given cheques (`loadRecentChequeNumbers`).
      - The given form suggests again when you switch account, unless you typed the number.
      - In Several given cheques, a new row continues the row above: the same account and its next free number. Choosing another account renumbers a row, unless you typed its number.
      - Checked at phone width with the maintainer's data: 789874 instead of the used 789803; the second account, which has no cheques yet, suggests nothing; a typed number is kept; "Already used" shows only for the same book.
  - [x] **82.** On phones, the back button or back gesture closes the open dialog, sheet, menu or picker, one at a time, instead of leaving the page. Asked by the maintainer on 2026-10-01: many phone users never tap the close button. Keep modals; don't turn them into pages.
    - Approach: Chrome on Android, and the installed app, send the back button to `CloseWatcher` as a close request. Each overlay's root (a shared wrapper in `src/components/ui`) holds a watcher while it's open, so Back closes the top one.
    - Unlike pushing a history entry per modal, it doesn't touch the address bar, so it can't undo the phone Filters sheet's changes (those rewrite the URL while the sheet is open).
    - Radix cancels the Esc keydown it handles, so on desktop Esc isn't handled twice.
    - Where there's no CloseWatcher (iPhones have no back button; some other Android browsers), Back works as before.
    - Built 2026-10-01:
      - `useCloseOnBack` and `closesOnBack` in `src/hooks/useCloseOnBack.ts`.
      - The roots of Dialog, Sheet, AlertDialog, Popover, DropdownMenu and Select in `src/components/ui` are wrapped, so every overlay gets it with no change where it's used. The wrapper keeps the open state itself for uncontrolled ones.
      - Checked in the pane's Chromium, which has CloseWatcher, by calling `requestClose()` as Back does:
        - the + sheet closes and the page stays;
        - form, then account picker: one Back closes the picker, the next the form;
        - the date field's calendar, the Add funds account Select and a row's ⋯ menu each close on their own;
        - Esc closes only the top layer and doesn't fire the watcher;
        - with nothing open, no watcher is left, so Back navigates as usual.
      - Still to check on a real Android phone.
  - Order agreed on 2026-10-01: 81, then 76, then 82. All three are done.

## Layout and navigation

Why: the dashboard stacks about ten blocks, and four of them show the same "what's due". The header only has Add funds. The cheque list is a 9-column table that scrolls sideways on phones. Returned is its own page, and colours are hardcoded.

- [x] **15.** Main sections: Today, Cheques, Calendar, Parties, Reports, Settings.
  - Done in 14, step 1. Returned stays under them until 19.
- [x] **16.** Always visible: a New button (received cheque, given cheque, series, add funds, import), search by cheque number, party or amount (Ctrl K), and notifications.
  - Built in 14, step 1, for given cheques. Received cheques and series joined the New menu and search in step 4. The bell shows recent changes; reminders themselves are 41.
- [x] **17.** Today: three numbers first (in clearing, due, net), then to-dos with one action each, then one in/out chart. People who only give or only receive see only their half.
  - Done in 14, step 2. The received actions open their screens once step 4 builds them.
- [x] **18.** Cheques: All / Received / Given tabs, plus saved views: To deposit, In clearing, Bounced, Security, Series.
  - Done in 14, step 3, with given views too (needs funds, funded, overdue, returned).
- [x] **19.** Returned stops being a page and becomes a saved view and a to-do. Bulk add moves under New.
  - Done in 14, steps 1 to 3.
- [x] **20.** Parties: a two-way ledger per party, showing given, received, net and bounces.
  - Done in 14, step 5 (2026-09-29): the Parties list and the party ledger.
- [ ] **21.** Settings: profile, region, bank accounts, notifications, plan and billing, data.
  - Built in 14, step 5 (2026-09-29), all but notifications, which come with reminders (41). Buying a pack comes with billing.
- [x] **22.** Mobile: bottom tabs (Today · Cheques · + · Parties · More), cards instead of tables, swipe to deposit or confirm, and full-screen forms.
  - Bottom tabs (step 1), cheque cards with swipe and a full-screen detail (step 3), and full-screen forms (steps 4 and 5) are done. The screens still in the old look are 76.
- [ ] **23.** Reports:
  - Sticky filters: dates, direction, party, account, status.
  - Tabs: Overview, Cash flow, Collections (ageing in 0–30 / 31–60 / 61–90 / 90+ day buckets, and bounce rate), Payments, Parties, Bounces, and Accounts and funds.
  - Each tab exports with its filters applied.
  - Built in 14, step 5 (2026-09-29); see its notes.
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
  - 2026-10-01: the maintainer wants Google sign-in and sign-up in it. Order: after 69. Google needs an OAuth client that the maintainer creates in Google Cloud and enters in Supabase's Auth settings themselves (its secret never comes through us).
  - 2026-10-01: the maintainer set up the dev project. Google's OAuth client is in Testing with their account as a test user. Email sign-up needs a confirmation email, the minimum password length is 8, and anonymous sign-ins are off on purpose.
  - Built 2026-10-01:
    - Sign in, Create account, Forgot password and Set a new password (`/login`, `/signup`, `/forgot-password`, `/reset-password`).
    - On large screens they share `AuthLayout`: a product panel (tagline, a preview of Today with made-up cheques, three things the app does) beside the form. Phones get the form alone, as on the Signup-phone board.
    - `useAuthOptions` reads Supabase's public auth settings, so the Google button and "Create account" show only when the project allows them.
    - Supabase's messages go through `authMessage`. Links from emails that failed come back to sign-in with the reason.
  - Still to do:
    - ~~The maintainer tries email sign-up, Google and a password reset.~~ Verified by the maintainer on 2026-10-01.
    - Before launch: CAPTCHA, custom SMTP (Supabase's own email only reaches the organization's members), leaked-password protection (Pro plan), Google brand verification (until then Google names the Supabase project, not the app), "Try it free for N days" when billing is on, and the terms and privacy line once item 57 has the pages.
    - 2026-10-01, with 84: the CAPTCHA (Cloudflare Turnstile) and the trial line are built. The CAPTCHA is on only when `VITE_TURNSTILE_SITE_KEY` is set; the maintainer then turns on Supabase's CAPTCHA setting with the matching secret, in that order (`docs/editions.md`). The trial line reads "Free for N days, then choose a pack. One free trial per person." from `instance_config`, only with billing on.
- [ ] **53.** Payments: Razorpay checkout, and a webhook Edge Function that verifies each payment and inserts a `purchase` entitlement. A new pack starts when the current one ends, so buying early loses nothing.
  - Built 2026-10-01, not yet pushed; waiting for the maintainer's Razorpay test keys to try a real (test-mode) payment. Setup and how it works: `docs/payments.md`.
  - **Database:** migration 020 adds:
    - `packs`, with prices in paise and an optional tax per pack; the total is computed. The operator adds the rows in the project's SQL editor, so prices never enter the repo.
    - `payment_orders`.
    - a unique `entitlements.payment_ref`.
    - `record_payment()`, service role only: idempotent, and it chains a new pack after current access (a trial or packs bought earlier).

    Tested in `tests/payments.test.ts`.
  - **Edge Function `payments`:** `/checkout` creates the Razorpay order; `/confirm` checks Checkout's signature, fetches the payment (capturing it if only authorised) and records it; `/webhook` handles `order.paid` with the webhook secret, for when the browser never confirms. `verify_jwt` is off in `supabase/config.toml`; the user routes check the token themselves. Signature checks are in `razorpay.ts`, tested in `tests/paymentsFunction.test.ts`.
  - **App:** Settings → Plan shows how long you're covered (following packs queued after a trial), the packs with price, tax, price a month and the saving against the shortest pack, a Pay button per pack, and your payments. Razorpay's script loads only when you pay. Read-only accounts can still buy, because writes through server functions aren't held back. Checked in the browser with made-up data in the page: the card at phone and desktop width, a failed checkout's message, and a whole purchase with a stand-in Checkout (the pack starts when the trial ends, and the payment is listed).
  - `src/types/database.ts` got the new tables by hand; regenerate it once 020 is on the dev project.
  - **To finish:** the maintainer pushes. Then:
    1. Get Razorpay test-mode keys and set the three secrets.
    2. Deploy `payments`.
    3. Add the webhook.
    4. Add packs to the dev project.
    5. Turn billing on there for the test.
    6. Make one test payment.
- [ ] **54.** Renewal reminders before a pack ends.
- [x] **55.** Read-only UI: expired accounts stay readable and can still export, and actions that write are disabled. On the given side, a refused change currently says "Cheque not found".
  - Built 2026-10-01, not yet pushed.
  - **Database:** migration 019 makes the given-side functions say "Your plan has ended. Renew it to make changes.", like the received side. It adds `internal.require_write_access()` and calls it first in `change_cheque_status`, `represent_cheque`, `write_off_cheque`, `rollback_cheque_status` and `record_deposit`; each body is otherwise the latest one, unchanged. Jobs with no signed-in user (auto-pass, the companions) are unaffected. Tested in `tests/migrations.test.ts`; the test helper now clears the signed-in user after each query, as the service role has none.
  - **App:** `PlanProvider` (in `App.tsx`, around onboarding and the app) loads the plan once and recomputes it when a plan ends or a bought pack starts, and when the app comes back into view. On a read-only account, every button that would change data opens a "Your plan has ended" / "Your free trial has ended" dialog with a button to Settings → Plan, instead of a disabled button. Viewing, search and export work as before. `usePlan().guard` wraps the actions (app-wide actions, status changes, undo, edit, delete, Add several, parties, bank accounts, import, sample data, Delete all data); `requireWrite()` covers the rest.
  - **Safety net:** once the app knows the account is read-only, the Supabase client answers writes itself with the same message, so no save quietly does nothing (an update blocked by row-level security would otherwise "succeed" with no rows). Reads, settings, sign-in and server functions (such as paying, item 53) always go through. `src/lib/plan.ts`, tested in `tests/plan.test.ts`.
  - Checked in the browser by faking a lapsed trial in the page only (billing on, a trial that ended 15 Sep): the banner, the sidebar card, New, a to-do's Deposit, a row's Mark funded, the cheque detail's Mark funded and Delete (the detail stays open behind the dialog), Add party, and "Choose a pack" leading to Settings → Plan. Writes from the app's client came back with the plan message and none reached the network. With the real settings (billing off) nothing changed.
  - **For 57:** Delete all data is refused on a read-only account, because the database blocks the soft-delete. Account deletion (57) should work without a plan.
  - **For 53:** Settings → Plan says the trial or plan ended but has no packs yet; the dialog's button leads there.
- [x] **84.** One free trial per person, so nobody keeps using the app free by signing up again with new addresses and importing their export (the maintainer's question, 2026-10-01). Decided A to E; the maintainer's idea of tying each export to its account goes with item 10, when exports get IDs anyway.
  - Built 2026-10-01, not yet pushed. Migration 021, tested in `tests/trials.test.ts`.
  - **A. One trial per email address.** `internal.trial_claims` keeps a hash of each address that got a trial, with no user id, so it outlives deleted accounts. Addresses that already had a trial were added.
    - Names play no part.
    - Two addresses count as one only when the provider delivers them to one inbox: case never; Gmail dots and "+anything"; "+anything" at Outlook, iCloud, Proton, Fastmail and Yandex.
    - On other domains, such as a company's own, every address is its own person. The maintainer asked on 2026-10-01 that different people with the same name never be turned away.
  - **B. No trial for throwaway mail.** `internal.throwaway_email_domains` starts with about 70 well-known services (subdomains count). The full public list can be added (`docs/editions.md`).
  - Neither blocks the sign-up: the account opens without a trial, `trial_refusals` says why, and the app explains in the banner, the dialogs and Settings → Plan. A pack can be bought straight away. `PlanProvider` moved above onboarding, so its bank-account step explains too.
  - **C. Importing an export comes with a pack.** During a trial, Settings → Import from an export says so instead of opening the file; a pack bought for later already unlocks it. The Excel template stays open, as that's how new users bring their records. It's a speed bump in the app only: anyone can add rows through the API during their trial, so A and B do the real work.
  - **D. CAPTCHA** on sign-up, sign-in, the password reset and "send it again": see 52.
  - **E.** The sign-up page says "One free trial per person"; the terms (57) must say it too.
  - Checked in the browser: with Cloudflare's always-pass test key (in a temporary local env file, since removed), Turnstile loaded, passed without asking, and its token went with the reset and sign-up requests (intercepted, so nothing was sent or created); after a failed attempt a fresh check re-enabled the button. With made-up data in the page: the throwaway banner and dialog, and the import rule during a trial and after buying.
- [ ] **56.** A small `/admin` for accounts and plans only, showing counts and never cheque data. Admins are marked by a role in `app_metadata`, and every admin action is logged.
- [ ] **57.** Legal and privacy: terms, privacy policy and refund policy; India's DPDP Act and the GDPR; data export and account deletion.
  - Found on 2026-10-01 (55, 53, 84):
    - **Terms:** one free trial per person, and trials created to get around that can be ended (84).
    - **Privacy policy:** a hash of each address that had a trial is kept, even after deletion, to prevent repeat trials (84). Payments go through Razorpay (53).
    - **Account deletion has to work without a plan:** read-only accounts can't even "Delete all data" today (55).
    - **Deleting a user is blocked by the database.** `settings`, `parties`, `cheques`, `daily_deposits`, `bank_accounts` and `received_cheques` reference `auth.users` without `ON DELETE CASCADE`, so their rows must go first, or a migration adds the cascades.
    - **Payment records:** `payment_orders` are deleted with the user today. Decide whether tax rules need them kept.
- [ ] **58.** End-to-end tests with Playwright, and error tracking.
- [ ] **59.** A production Supabase project that deploys from a release branch or tags, and tagged releases for self-hosters.
- [ ] **60.** The maintainer's own data moves from their personal instance to the hosted service as a normal account. Item 9 helps.
- [ ] **61.** The companions (cheque-mcp, Cheque Watch) get per-user tokens before they use a shared database. Until then, they stay on the maintainer's personal instance.

## Loose ends

- [ ] **62.** Dependabot: check CI on #1 and #2 (GitHub Actions) and #3 (grouped updates); the maintainer merges the ones that pass. Hold the major upgrades and do them together later: #4 and #6 (plugin-react 6 and Vite 8, which fail CI today), #5 (react-day-picker 10) and #7 (Vitest 5).
  - 2026-10-01: CI on `main` had failed since 2026-09-29 (CI #15). Two test files import modules that create the Supabase client as they load, and CI has no `.env.local`, so it threw "supabaseUrl is required". Fixed with placeholder Supabase settings in `vitest.config.ts`.
  - Dependabot pull requests opened before the fix failed for the same reason: comment `@dependabot rebase` on each to run CI again.
  - CI also warns that `actions/checkout@v4` and `actions/setup-node@v4` run on Node 20, which is deprecated; #1 and #2 update them.
- [ ] **63.** auto-pass: declare it in `supabase/config.toml` so the integration deploys it, and schedule its cron job on the dev project.
- [ ] **64.** Translations: move UI text into translation files, for other languages and the US spelling "check".
- [ ] **83.** Installing on phones. Raised by the maintainer on 2026-10-01 (later, not now): Windows Chrome offers to install, but their phone shows no Install button.
  - What's there: More (phones) and the account menu (desktop) show Install only when the device can install (`useInstallOption` in `src/lib/pwa.ts`).
  - **Android:** Chrome has to offer the install first (`beforeinstallprompt`). It does that only over HTTPS, with the production build's service worker (the dev server has none, so a phone on the local network never gets it), a valid manifest, and once Chrome's own engagement checks pass.
    - Check on the HTTPS deployment first.
    - If it still doesn't show, show steps instead: Chrome's menu, then "Install app" or "Add to Home screen".
  - **iPhone and iPad:** Apple gives websites no install button. The only way is Safari's Share, then "Add to Home Screen", and More already shows those steps there. A button can open the steps, but it can't install.
- [x] **69.** Load less up front: the app is one 2.5 MB script (750 kB compressed). Load Excel and PDF export, charts and the calendar only when they're needed, so the app opens faster on phones.
  - Done 2026-10-01:
    - Pages load the first time they're opened (`React.lazy` in `src/App.tsx`), with "Loading…" in the frame meanwhile. Today and Login come with the app. Cheques and Parties download in the background 2.5 s after the app shows, so the bottom tabs don't wait.
    - Excel and PDF load on first use (`src/lib/lazyLibs.ts`: exports, templates and imports), and the date picker's calendar when it first opens. Charts come with Reports.
    - The first download went from 2,534 kB (756 kB compressed) to 1,048 kB (302 kB).
    - The service worker still saves every file when it installs, so the installed app works offline as before.
    - Checked: every page module and library loads, a PDF and an Excel file build in memory, and, signed in, every page shows, Reports draws its charts and the date picker's calendar opens.

## The maintainer's decisions

These are kept outside this repo. Ask the maintainer.

- [ ] **65.** Free trial length.
- [ ] **66.** International pricing, and whether to sell abroad through a merchant of record.
- [ ] **67.** Where the private business plan lives.
