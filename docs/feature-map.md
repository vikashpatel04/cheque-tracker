# Feature map

What the app does today, and where each feature goes in the redesign ([design-brief.md](design-brief.md), plan items 68 and 14). Use it as the checklist while designing and building. Nothing here is dropped unless the maintainer says so.

## Everywhere

| Today | In the redesign |
|---|---|
| Sign in with email and password | Sign-in screen. Sign-up, password reset and Google come with item 52 |
| First-run region setup, with a preview of amounts, dates and time zone, and sign out | Onboarding, step 2 |
| Header: "Funds added today ₹…" and an Add funds button | Today in the given view, and New → Add funds. Until step 2 it sits beside the Today title |
| Plan banner: trial ending, read-only | Banner at the top, and Settings → Plan and billing |
| Menu: Dashboard, Cheques, Parties, Returned, Reports, Settings | Today, Cheques, Calendar, Parties, Reports, Settings. Returned becomes a saved view |
| Installs as an app on phones (PWA) | Kept and improved: new icons, starts offline, offers updates and installing (built in 14, step 1) |
| Auto-pass: funded cheques become Passed at a set time on their due date | Unchanged; its setting lives in Settings → Preferences |

## Dashboard → Today, Calendar and Reports

Built in 14, step 2 (2026-09-28): the dashboard is gone and every row below has its place. Until Reports is rebuilt (step 5), the running-total chart sits in Reports → Daily Cash Flow and the six-month trend in Reports → Monthly.

| Today | In the redesign |
|---|---|
| Today panel: the date, an overdue badge, "Cash needed today", today's cheques, overdue cheques ("Overdue", "Overdue · Funded") | Today, given view: "Needed today" and the to-dos |
| Next 7 days strip; tapping a day lists its cheques | Today, given and received views: a 7-day strip that opens the same day list |
| Tiles: total outstanding (and how many are due this month), due this week, overdue, returned | Today's numbers in the given view, and Reports → Overview |
| Monthly calendar with month and agenda views, status colours, and tapping a cheque or a day | Calendar (built in 14, step 5): its own month grid and agenda, with the chosen day's cheques |
| Day list: every cheque due on a day | Calendar's day panel; the 7-day strip opens it |
| 30-day outflow forecast, pending vs funded | Today, given view: the chart |
| Cumulative outflow curve | Reports → Cash flow |
| Status breakdown by amount | Reports → Overview |
| 6-month trend: issued, due, cleared | Reports → Cash flow |
| Top outstanding by party | Parties, sorted by outstanding, and Reports → Parties |
| Recent activity | The notifications and activity panel (the bell) |

## Given cheques

Built in 14, step 3 (2026-09-28): the Cheques list, its views and filters, the row menu, swipe, export and the cheque detail. Add cheque and Add several keep their current forms until step 4. Re-present and write-off keep their dialogs, now opened from the detail and the row menu.

| Today | In the redesign |
|---|---|
| Search by cheque number or party; filter by status (several at once), party and bank; sort by due date, issue date, amount or party, up or down | Cheques: search, filters, sort |
| Columns: cheque no., party, bank, amount, issue date, due date, status, days until due | Table columns on desktop, card lines on the phone. Days until due reads "in 3 days" or "2 days overdue" |
| Row menu: mark Funded, Passed, Returned (with a reason) or Cancelled; Funded and Passed in one step; Edit; Undo | The next step as a button on every row and card (Mark funded, Mark passed, Decide); everything else in the row menu and cheque detail; swipe on the phone |
| Export the list as PDF or Excel | Cheques → Export, with the filters applied |
| Add a cheque: party, cheque no., bank, amount, issue date, due date, notes | Add cheque, given |
| Bulk add page: many rows at once, cheque numbers counting up, also for one party | New → Add several, and "Add cheques" in a party's ledger |
| Bulk upload from an Excel template | New → Import → Excel template |
| Cheque detail: status, dates, tags (Re-presented ×N, Replacement), notes, history with who made each change (you, auto-pass, add funds, rollback, the assistant, import) | Cheque detail |
| Re-present a returned cheque: new due date, notes, optionally funded straight away; shows when it was last presented, the return reason and how many times it was re-presented | Bounce resolution, given |
| Write off, with a reason | Bounce resolution |
| Issue a new cheque in place of a written-off one: the form is pre-filled and linked | Bounce resolution and cheque detail |
| Undo the last change, after confirming what it undoes | Cheque detail → Undo last change |
| Edit, and delete (kept, but hidden) | Cheque detail menu |
| Returned page: still owed on returned cheques, what needs action, older re-presented entries | The "Returned" saved view, a to-do on Today, and Reports → Bounces |

## Add funds

| Today | In the redesign |
|---|---|
| Enter the amount put into the bank today, with a note | Add funds, step 1 |
| It suggests which pending cheques that covers, in the chosen order (due date first, smallest first, largest first). Tick or untick; it shows allocated, remaining, and how much over | Add funds, step 2 |
| Saves the deposit and marks the ticked cheques Funded, all at once | Same |
| Total of funds added today | Today, given view |

## Parties

| Today | In the redesign |
|---|---|
| List: search; name, contact, phone, bank, active cheques, outstanding; sortable | Parties, with given, received and net for each |
| Add or edit a party (name, contact person, phone, bank, notes, active); delete | Party form |
| Bulk upload parties from an Excel template | New → Import |
| Party detail: info, totals (issued, paid, outstanding, returned and still owed), their cheques with a status filter, add cheques for this party | Party ledger, both directions |

Built in 14, step 5 (2026-09-29): the Parties list (still to pay, still to collect, net, bounces and next date for each, sortable and searchable) and the party ledger (contact with phone and WhatsApp links, the four totals, every cheque both ways with a direction and status filter and its next step, new cheques and several given cheques for the party). The party form now has the look of the cheque forms; Active and Delete are in it. Import parties from Excel stays on the Parties page for now.

## Reports

| Today | In the redesign |
|---|---|
| Date range filter, and clear filters | The filter bar that stays in view |
| Tiles: total issued, paid, still to pay, returned, number of cheques | Overview |
| Daily cash flow: today, next 14 days, past 14 days needed vs funds added, a 28-day chart, a day-by-day table | Cash flow |
| Monthly: comparison, still to pay, monthly table | Cash flow and Payments |
| By party: top parties stacked, and a table | Parties |
| By bank: outflow by bank, bank rankings | Accounts and funds |
| Deposits: funds added vs cheque payments, and a trend | Accounts and funds |
| Status: by amount and by count | Overview |
| New: Collections and Bounces tabs, and export on every tab | |

## Settings

| Today | In the redesign |
|---|---|
| Preferences: auto-pass on or off and its time; Add funds order; the bank list used for suggestions | Settings → Preferences |
| Region: country, currency, number format, date format, time zone, week start, validity in months, clearing days | Settings → Region |
| Plan | Settings → Plan and billing |
| Export everything (Excel) | Settings → Data |
| Import from an export | Settings → Data, and New → Import |
| Delete all data, after typing a confirmation | Settings → Data |
| New: what you track (given, received or both), bank accounts, notifications, profile | |

## Received cheques

Built in 14, step 4 (2026-09-28): the form (one, security or a series), the deposit panel, the cheque detail with every action and undo, bank accounts in Settings, search, and sample data to try it.

| Capability | In the redesign |
|---|---|
| Add a received cheque: regular or security, party, number, bank it's drawn on, amount, received on, cheque date, deposit-by date, account, notes | Add cheque, received |
| A series: weekly, monthly, quarterly or yearly, numbers counting up | Add cheque → series |
| Deposit several at once into one of your accounts | Deposit |
| Mark cleared (several at once); bounced (reason, bank charges); deposit again (now or later); paid another way (cash, transfer, other, reference); hand back (reason); write off (reason); replaced (a new cheque, linked); undo | Cheque detail and bounce resolution |
| Alerts: deposit today or overdue, going stale, stale, did it clear?, review a security cheque, needs a decision | Today, received view: the to-dos |
| Bank accounts: name, bank, last four digits, default | Settings → Bank accounts |

## Views: given, received and both

Which cheques you track is a view, not an account type. Changing it never changes the account or its data.

- **Settings → "What you track"** picks the default: given, received, or both. It hides the other half in menus, the New menu and Reports.
- **Today and Cheques** have an All / Given / Received switch.
- **Given view of Today:**
  - Numbers:
    - "Needed in the bank today", with the Add funds button on it.
    - "Due in the next 7 days", with how much isn't funded.
    - "Outstanding".
  - Funds added today.
  - "Going out this week": a 7-day strip, each day with a bar of funded vs not funded.
  - To-dos: did it pass?, add funds, returned.
  - A 30-day chart of money going out, funded vs not.
- **Received view of Today:**
  - Numbers:
    - "To deposit now", with the Deposit button on it.
    - "In clearing", which flags the slow ones.
    - "Coming in, next 30 days", plus the security cheques held.
  - "To deposit this week": a 7-day strip with stale warnings.
  - To-dos: deposit, did it clear?, bounced, going stale, security review.
  - A weekly chart of money coming in.
- **All:**
  - Numbers: in clearing; due in 7 days, with how much isn't funded; net for 7 days.
  - The to-dos of both sides.
  - A weekly chart of money in and out.
