# Cheque Tracker

[![CI](https://github.com/vikashpatel04/cheque-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/vikashpatel04/cheque-tracker/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Cheque Tracker keeps every post-dated cheque in one place. Each morning it tells you which cheques are due, how much has to be in the bank and what's overdue. It also keeps track of the parties you deal with, the money you add to the bank, and anything that bounces.

It works in any country. Currency, number and date formats, time zone and cheque rules are settings that each user picks; India is simply the first preset.

## Two ways to use it

| | Hosted | Self-hosted |
|---|---|---|
| Where | [chequetracker.com](https://chequetracker.com) | Your own Supabase project and any static host |
| Price | Paid plans | Free |
| Features | Everything | Everything |
| Setup, updates and backups | Done for you | Up to you |

Both run the same code from this repository; only the configuration differs. [How one codebase serves both](./docs/editions.md).

> **Status:** this is the new version of Cheque Tracker and is in active development. The first version (v0) remains at [vikashpatel04/cheque-tracker-v0](https://github.com/vikashpatel04/cheque-tracker-v0) under the MIT License.

**Contents:** [Features](#features) · [Cheque life cycle](#cheque-life-cycle) · [Roadmap](#roadmap) · [Self-hosting](#self-hosting) · [Companion projects](#companion-projects) · [Tech stack](#tech-stack) · [Project structure](#project-structure) · [Contributing](#contributing) · [License](#license)

---

## Features

### Dashboard
- **Cash needed today:** the total of today's *Pending* cheques plus any overdue *Pending* ones. *Funded* cheques already have money in the bank, so they're listed but not counted.
- **Next 7 days:** each day's cheque count, total and pending/funded split. Tap a day to see its cheques.
- **Summary cards:** total outstanding, due this week, overdue and returned.
- **Calendar and charts:** month and agenda views of every due date, a 30-day forecast, status breakdown, a 6-month trend and top parties.
- **Recent activity:** the latest status changes.

### Cheques
- Add, edit and delete cheques with party, bank, cheque number, amount, issue date and due date.
- Search, filter by status, party and bank, and sort by due date, issue date, amount or party.
- **Status actions:** *Pending → Funded → Passed*, plus *Returned* (with a reason) and *Cancelled*. A one-step *Funded & Passed* shortcut records both.
- **Bulk entry:** a multi-row Bulk Add page, and Excel upload with a template in your own date format.
- **Export** to PDF or Excel. Every change is kept in an append-only history.

### Funds and allocation
- **Add funds** records money you put in the bank. The app suggests which pending cheques it covers (oldest first, or by amount), you adjust the selection, and the ticked cheques become *Funded* in one database transaction.

### Returned cheques
- **Re-present** the same cheque with a new date. The app warns when the date is past the cheque's validity period for your region.
- **Write off** a cheque that can't be used, then issue a linked replacement.
- **Roll back** the latest status change on any cheque; the undo is recorded too.

### Parties, reports and settings
- **Parties:** contacts with their cheques, totals, and Excel import.
- **Reports:** daily cash flow, monthly, party-wise, bank-wise, funds added and status views for any date range.
- **Region:** country, currency, number format, date format, time zone, week start and how long cheques stay valid. See [docs/regions.md](./docs/regions.md).
- **Auto-pass** (optional): funded cheques are marked *Passed* after a time you choose, in your time zone.
- **Export all data** to one Excel workbook, and a guarded *delete all data* option.

### Everywhere
- Amounts, dates and "today" follow your region.
- Installs as an app on phones and computers (a PWA), starts offline, and has light and dark looks.
- Row-level security keeps each user's data separate.

---

## Cheque life cycle

```
PENDING   ──► FUNDED ──► PASSED
PENDING   ──► RETURNED | CANCELLED
FUNDED    ──► RETURNED | CANCELLED
RETURNED  ──► re-present ──► PENDING or FUNDED   (same cheque, new date)
RETURNED  ──► write off  ──► WRITTEN_OFF         (a replacement can be issued)
```

- *Funded* is stored as `DEPOSITED`, which keeps the companion projects working.
- PASSED, CANCELLED and WRITTEN_OFF are final, and any change can be rolled back one step at a time.
- Every transition runs inside the database (`change_cheque_status`, `represent_cheque`, `write_off_cheque`, `rollback_cheque_status`) and writes a history row.

---

## Roadmap

- **Received cheques** (in progress): track cheques other people give you, with deposits, clearing, bounces, security cheques and series. The database side is done and tested ([docs/received-cheques.md](./docs/received-cheques.md)); the screens come with the redesign.
- A redesigned dashboard and reports covering both directions.
- Sign-up and onboarding.
- Plans and payments for the hosted edition.
- Reminders by email and push notification.

---

## Self-hosting

```bash
git clone https://github.com/vikashpatel04/cheque-tracker.git
cd cheque-tracker
npm install
cp .env.example .env.local   # add your Supabase URL and publishable key
npm run dev
```

Then apply the migrations in `supabase/migrations/` and create your login. The full guide, including auto-pass, deployment and upgrading from v0, is in [docs/self-hosting.md](./docs/self-hosting.md).

---

## Companion projects

| Project | What it is |
|---|---|
| [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) | An MCP server that lets AI assistants such as Claude Desktop query and update your cheques in plain English. |
| [Cheque Watch](https://github.com/vikashpatel04/cheque-watch) | A read-only Wear OS app and tile showing today's cheques and the amount needed. |

Both read the same database with the Supabase service-role key, so use them only with your own self-hosted instance. Never point them at a database that holds other people's data.

---

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, Sonner toasts |
| Routing and forms | React Router v7, React Hook Form + Zod |
| Dates and formats | date-fns, the `Intl` APIs, react-day-picker, react-big-calendar |
| Charts and tables | Recharts, TanStack Table |
| Export and import | jsPDF + jspdf-autotable, SheetJS (xlsx) |
| Backend | Supabase: Postgres, Auth, row-level security, SQL functions, Edge Functions, pg_cron |
| Tests | Vitest, with PGlite running every migration |
| Build and deploy | Vite, TypeScript, Cloudflare Workers |

---

## Project structure

```
src/
  config/           brand (name, links) and region presets
  pages/            Dashboard, Cheques, BulkAdd, Parties, Returned, Reports, Settings, Login, RegionSetup
  components/
    cheques/        list, form, detail, status actions, re-present, write-off, rollback, Excel upload
    deposit/        "Add funds" and the allocation dialog
    parties/        list, form, detail, Excel upload
    settings/       region and plan cards
    shared/         layout, settings provider, today panel, 7-day strip, calendar, plan banner
    ui/             shadcn/ui components
  hooks/            data hooks (cheques, parties, deposits, settings, plan, auth)
  lib/              Supabase client, region and formatters, RPC wrappers, allocation, exports
  types/            app and database types
supabase/
  migrations/       001–014: schema, RLS, functions, regions, editions, received cheques, grants
  functions/        auto-pass Edge Function
tests/              formatter, schedule and migration/RLS tests
docs/               editions, self-hosting, regions, received cheques
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first; it covers setup, the checks to run, the DCO sign-off and database conventions. Everyone taking part is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Report security problems privately, as described in [SECURITY.md](./SECURITY.md).

## License

Copyright © 2026 Vikash Patel.

Cheque Tracker is free software under the [GNU Affero General Public License v3.0](./LICENSE). If you run a modified copy as a service for others, you must offer them its source code; the app links to its source for this reason.

The name and logo aren't covered by the license; see [TRADEMARKS.md](./TRADEMARKS.md).
