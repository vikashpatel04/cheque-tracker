# Design brief: the Cheque Tracker redesign

This brief is for designing the new layout and screens (items 13–14 of the plan in `.claude/plan.md`). It's self-contained: a designer doesn't need to read the code. Every feature the app has today is listed in [feature-map.md](feature-map.md), with where it goes; the redesign must keep all of them.

## What the product is

Cheque Tracker is an app for anyone who manages cheques. It covers both directions:

- **Cheques you give:** know what's due, put money in your account in time ("add funds"), and see when each cheque is passed or returned.
- **Cheques you receive:** deposit them on time, check they cleared, and decide what to do when one bounces.

It's for individuals, landlords, lenders and businesses: people who pay rent or loan instalments by cheque, landlords holding rent and security cheques, lenders collecting instalments, businesses paying and getting paid by post-dated cheques. Never present it as a tool for shops, stores or retail.

It's a PWA used on desktop and phone equally, and it comes in two editions from the same design:

- **Hosted** at chequetracker.com: sign-up, a free trial, prepaid packs.
- **Self-hosted:** no sign-up marketing and no billing screens.

Don't mention "open source" in the product or on the landing page.

### Many countries, India first

Currency, number grouping, date format, week start, how long a cheque stays valid, and how long clearing takes all come from the user's region. Mock-ups can use Indian examples (₹, 1,23,456.00, DD/MM/YYYY), but every layout must also work with $, 123,456.00 and MM/DD/YYYY. The interface is English now and will be translated later (the US says "check"), so leave room for longer words.

## Who uses it, and what they ask

| Person | Mostly | Their questions |
|---|---|---|
| Pays rent, instalments or bills by cheque | Gives | What's due this week? Is there enough in my account? |
| Landlord | Receives | Which rent cheques do I deposit today? Did last month's clear? Which security cheques do I hold? |
| Lender | Receives | Whose instalment bounced, and what now? |
| Business | Both | What comes in and goes out over the next weeks? Who owes me, and whom do I owe? |

Which half someone sees is a view, not an account type. They choose given, received or both in Settings, and can switch with All / Given / Received on Today and Cheques. Each view of Today answers its own questions; see "Views" in [feature-map.md](feature-map.md).

## Principles

1. **Today first.** Open on what needs doing, each item with one clear action.
2. **One place for all cheques,** in both directions, with filters and saved views instead of separate pages.
3. **Direction is always obvious.** Money in is green with ↙. Money out is neutral ink with a minus sign and ↗.
4. **Calm colour.** Red only for problems, amber only for things needing attention. A status is always an icon plus text, never colour alone.
5. **Numbers are the product.** Tabular figures. Compact in summary tiles (₹1.2L), full in tables (₹1,23,456.00), grouped the way the user's region writes them.
6. **The phone is as good as the desktop:** bottom tabs, cards instead of tables, swipe for common actions, full-screen forms.

## Words to use

- **Parties:** the people and businesses you deal with. Not "customers", "vendors" or "suppliers".
- **Given cheques** (cheques you give) and **received cheques** (cheques you receive).
- **Add funds:** money you put into your account to cover given cheques. Cheques it covers become **Funded**.
- **Deposit:** taking received cheques to the bank.
- **Security cheque:** held rather than deposited, often undated and blank, reviewed on a date (end of a lease or loan).
- **Series:** a run of post-dated cheques, for example 12 monthly rent cheques.
- **Bounced** (received) and **Returned** (given) both mean the cheque came back unpaid.

## Life cycles

The screens must offer exactly these actions.

**Given cheques**

| Status | Meaning | Actions |
|---|---|---|
| Pending | Issued, not yet covered | Add funds (marks it Funded), Cancel, Mark returned |
| Funded | Money is in the account for it | Mark passed (automatic on the due date if auto-pass is on), Mark returned, Cancel |
| Passed | Paid | None |
| Returned | Came back unpaid | Re-present (same cheque, new date), Write off |
| Written off | Can't be used | Issue a new cheque in its place |
| Cancelled | Closed | None |

**Received cheques**

| Status | Meaning | Actions |
|---|---|---|
| In hand | You have it, not deposited | Deposit (several at once, into one of your accounts), Paid another way, Hand back, Write off, Replace |
| In clearing | Deposited, waiting | Mark cleared (several at once), Mark bounced (reason, bank charges) |
| Bounced | Returned unpaid | Deposit again (now or on a date), Paid another way (cash, transfer, other), Write off, Replace |
| Cleared, Settled, Handed back, Written off, Replaced | Final | None |

Every change can be undone one step at a time, and every cheque keeps a timeline of its changes.

**What needs attention**

- Received cheques:
  - Deposit today
  - Deposit overdue
  - Going stale (7 days before it expires)
  - Stale (banks will refuse it)
  - Did it clear? (longer than the region's usual clearing time)
  - Review (a security cheque's date has come)
  - Needs a decision (bounced)
- Given cheques:
  - Due today or soon and not yet funded
  - Overdue (past due, not passed)
  - Returned (needs a decision)

## Navigation

**Desktop**

- A left sidebar with **Today, Cheques, Calendar, Parties, Reports, Settings**.
- A top bar, always visible, with:
  - Search across cheque number, party and amount (Ctrl K).
  - A **New** menu: Received cheque, Given cheque, Series, Add funds, Import.
  - Notifications.

**Phone**

- Bottom tabs: **Today · Cheques · + · Parties · More**. More holds Calendar, Reports and Settings.
- The + opens the New menu as a sheet.
- Search sits at the top of Cheques and Parties.

Today's Returned page becomes a saved view and a to-do. Bulk add moves under New.

## Visual system

### Chosen: "Passbook" (approved 2026-09-27)

The designs are on the canvas linked from plan item 68. Build from these values.

In the code (plan item 14, step 1): the tokens are CSS variables in `src/index.css`, light under `:root` and dark under `.dark`, and Tailwind colours by the same meaning: `ground`, `surface`, `line`, `line-strong`, `line-field`, `line-soft`, `ink`, `ink-quiet`, `ink-nav`, `ink-faint`, `brand`, `brand-soft`, `track`, `thumb`, `money-in`, `money-out`, and each status as `waiting`, `progress`, `cleared`, `done`, `attention` and `problem`, with a `-soft` background. shadcn/ui's own names point at them. Light or dark follows the device, or the choice under Appearance (account menu on desktop, More on phones), saved per device.

**Fonts** (bundled with the app through Fontsource rather than loaded from Google, so the installed app works offline and makes no third-party requests; Latin and Latin Extended only for now):

- IBM Plex Serif 600 for page titles and the wordmark.
- IBM Plex Sans 400–700 for everything else, with tabular figures for amounts.
- IBM Plex Mono 500 for cheque numbers and the last four digits of accounts.

Plex has sister faces for Devanagari and other scripts, for when translations come.

**Colour tokens:**

| Token | Light | Dark |
|---|---|---|
| Ground (paper) | `#F6F4EE` | `#10161D` |
| Surface | `#FFFFFF` | `#18212B` |
| Line / strong line | `#E3DFD4` / `#CFC9BA` | `#2A3543` / `#3A4656` |
| Ink / quiet ink | `#1A1D21` / `#4A4F57` | `#E8EBEF` / `#A9B1BB` |
| Brand, "cheque ink" (primary buttons, links, focus) | `#1F3A5F`, white text | `#9DB8E0`, text `#0E141B` |
| Money in | `#0B7A4B` | `#5CCB8F` |
| Waiting: text on background | `#2F4B75` on `#E7EDF6` | `#B8CCEA` on `#22314A` |
| On its way | `#0E5F76` on `#D9F0F4` | `#7FD3E0` on `#133B45` |
| Cleared | `#0B6B41` on `#E0F2E7` | `#5CCB8F` on `#16352A` |
| Done | `#475467` on `#EEF0F3` | `#B6BEC8` on `#262F3A` |
| Attention | `#8A4B00` on `#FFF0D1` | `#F4B650` on `#3A2E14` |
| Problem | `#B42318` on `#FDE8E5` | `#F28B82` on `#3D1F1D` |

Sidebar `#FBFAF6`, segmented-control track `#ECE8DE`.

**Status chips:**

| Family | Given | Received | Tags |
|---|---|---|---|
| Waiting | Pending | In hand | |
| On its way | Funded | In clearing | |
| Cleared | | Cleared | |
| Done | Passed, Cancelled, Written off | Settled, Handed back, Written off, Replaced | |
| Problem | Returned | Bounced | Overdue, Stale |
| Attention | | | Due today, Needs funds, Going stale, Cleared? |
| Outline | | | Security, Series |

**Rules the designs follow:**

- **Primary buttons:** only the main daily action is a solid button: Deposit, or Add funds. Everything else is outlined.
- **Next step on every cheque** (2026-09-28): each row, card and to-do has one outlined button for its next step: Mark funded, Mark passed, Decide; Deposit or Mark cleared on the receiving side. Swiping a card offers the same step.
- **No minus signs for cheques you give** (2026-09-28): their amounts are plain; the question that matters is what's needed today. Received amounts keep "+" for now. Only net figures, which can go either way, carry a sign.
- **Add funds is the daily batch** (2026-09-28): money put into the bank today, then tick the cheques it covers and they're all funded at once. "Funds added today" starts from zero each day, and an info button next to it says so.
- **Dates:** shown with month names ("Thu 24 Sep"), so DD/MM vs MM/DD can't confuse anyone. Date fields use the region's format.
- **Sizes:** body text is 16px on the phone; key numbers are 34–36px on desktop and 21px in phone tiles.
- **Corners:** 10px for controls, 12–14px for cards, fully round for chips.
- **Logo:** the maintainer's own logo since 2026-09-28: a cream cheque card on a navy backing, with a navy badge holding a cream tick. It's `public/logo.webp` in the app and `public/icons/` for the installed app and browser tabs (made from the original with sharp). The canvas boards still show the earlier drawn mark.

What else is decided:

- **Colour tokens by meaning:** `--money-in`, `--money-out`, `--status-waiting`, `--status-attention`, `--status-problem`, `--status-done`, plus the brand colour and neutrals.
- **Light and dark mode** from the same tokens.
- **Typography:** a UI sans with tabular figures and a good ₹ glyph, with a clear type scale.
- **Density:** comfortable by default, compact as an option for long tables.
- **Icons:** Lucide.
- **Accessibility:** WCAG AA contrast, 44 px touch targets, visible focus.
- **Status chips:** one style, with an icon, a label and a colour from the status token.
- **Empty states** for every list, each with the next step.
- **A first-run checklist:** choose region, add a party, add a cheque or import from Excel, add a bank account.

The app is built with React, Tailwind and shadcn/ui (Radix), so designs should map onto those components.

## Screens

Design each at desktop width (1440) and phone width (390), with empty and loading states where they matter. Use fictional data only.

### 30. Landing and pricing (hosted only)

- **Hero:** track every cheque you give and receive, and never miss a date.
- **Features:**
  - Today's to-dos
  - Reminders
  - Planning funds for cheques you give
  - Depositing and clearing cheques you receive
  - Bounces
  - Party ledger
  - Reports
  - Works in your country's currency and formats
- **Trust:** your data is private and you can export it any time.
- **Pricing:** Business, prepaid for 1, 3, 6 or 12 months, tax extra, a free trial, and Enterprise coming soon. Real prices and the trial length come separately, so use placeholders.
- **FAQ and sign-up.**

### 31. Sign-up and onboarding

1. Sign up with email and password or Google, then verify the email.
2. **Region setup:** pick a country. That sets currency, number and date format, time zone, cheque validity and clearing days, with a live preview such as "₹1,23,456.00 · 27/09/2026".
3. "What do you use cheques for?": **give, receive, or both**. This decides which half of the app is shown, and can be changed later.
4. Optionally add bank accounts (a name, the bank, and the last four digits).
5. Land on Today with the first-run checklist.

### 32. Today (desktop and phone)

- **Three numbers:**
  - **In clearing:** received cheques on their way.
  - **Due:** given cheques due in the next 7 days, meaning money that must be in the account.
  - **Net:** expected in minus out over the period. It can switch between 7 and 30 days.
- **To-dos,** grouped as Overdue, Today and This week. Each has one action button: Deposit, Add funds, Cleared?, Decide. Examples:
  - "Deposit 3 cheques · ₹75,000"
  - "Add ₹1,20,000 by Friday for 2 cheques"
  - "Rent cheque from R. Iyer bounced · Decide"
- **One chart:** money in and out per week over the coming weeks.
- **Variants:** people who only give or only receive, and a calm "all clear" state.

### 33. Cheques list

- **Tabs:** All / Received / Given.
- **Saved views as chips:** To deposit, In clearing, Bounced, Security, Series.
- **Filters:** dates, party, account, status.
- **Desktop table:** direction, due date, party, cheque number, bank, amount (signed and coloured), status chip.
- **Phone cards:** swipe to Deposit (in hand) or Mark cleared (in clearing).
- **Selecting several** enables Deposit for received cheques and Add funds for given cheques.

### 34. Cheque detail

- **Header:** party, amount, direction and status.
- **Dates:**
  - Received on or issued on
  - Cheque date
  - Due date
  - Deposited, cleared, bounced
- **Other details:**
  - Bank and deposit account
  - Notes
  - A place for a photo later
- **Actions** for the current status, from the tables above, plus Undo last change, Edit and Delete.
- **Timeline:** every change, who made it and when. An imported cheque starts with "Imported as Passed".
- **Variants:** a security cheque (no amount or date yet, a review date instead), and a cheque in a series ("3 of 12", with a link to the series).

### 35. Add cheque

- A **Received / Given** switch at the top.
- **Fields:** party (search, or create inline), cheque number, bank, amount, cheque date, due date and notes.
- **Received only:** received on, regular or security, and deposit account.
- **Series mode:** the first cheque, how many, and how often (weekly, monthly, quarterly, yearly), then a preview of the generated cheques with dates and numbers.
- **Layout:** full screen on the phone, a dialog or side panel on desktop.

### 36. Deposit batch

- Choose received cheques in hand. The ones due today or overdue are preselected.
- Set a deposit date and the account.
- A running total, then confirm.
- Warn about cheques going stale or already stale.

### 37. Bounce resolution

**Received:** show the bounce reason and bank charges (they add up across bounces). Then choose:

- Deposit again, now or on a date
- Paid another way
- Replaced by a new cheque
- Write off

**Given:** Re-present or Write off, and after a write-off, Issue a new cheque.

Leave room for a later reminder of legal deadlines in countries that have them. India's Section 138 comes first, presented as reminders, not legal advice.

### 38. Party ledger

- **Header:** name, contact, phone, and a WhatsApp link.
- **Totals:** given, received, net, and bounces.
- **All cheques with the party,** both directions, newest first.
- **Actions:** new cheque for this party, and send a reminder.

### 39. Reports overview

- **Filters that stay in view:** dates, direction, party, account, status.
- **Tabs:** Overview, Cash flow, Collections, Payments, Parties, Bounces, Accounts and funds.
  - Collections shows ageing in 0–30 / 31–60 / 61–90 / 90+ day buckets, and the bounce rate.
- **The Overview tab:** key numbers and a few charts.
- **Export** on every tab, with its filters applied.

### 40. Settings and billing

Sections:

- Profile
- Region
- Bank accounts
- Notifications (email, or push on the phone)
- Plan and billing (current pack, when it ends, buy or extend a pack, receipts). Hidden when self-hosted.
- Data: export, import, and delete everything

## Deliverables

- Screens 30–40 at desktop and phone width.
- Today and the Cheques list in both light and dark mode.
- A component sheet: buttons, status chips, amount display (in, out, compact, full), cards, form fields, the New menu, tabs and chips, empty states, the first-run checklist.
- Tokens: colours (light and dark), type scale, spacing, radii.

## Not in this round

Scanning a cheque, legal follow-up, a party trust score and bank statement matching. Leave room for them, but don't design them yet.
