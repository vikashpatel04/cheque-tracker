# Regions

Nothing in Cheque Tracker is fixed to one country. Each user has a **region** in their settings, and every amount, date and "today" in the app follows it. The country presets fill in sensible defaults, and India is simply the first of them.

## What a region contains

| Setting | Column in `settings` | Used for |
|---|---|---|
| Country | `country_code` (ISO 3166-1, e.g. `IN`) | Picking defaults. Empty until the user chooses; the app asks at first sign-in. |
| Currency | `currency_code` (ISO 4217, e.g. `INR`) | Every amount, chart axis and export |
| Number format | `locale` (e.g. `en-IN`) | Digit grouping (1,00,000 vs 100,000), decimal mark, month names |
| Date format | `date_format` (e.g. `dd/MM/yyyy`) | How dates are shown and typed, Excel templates and import |
| Time zone | `timezone` (IANA, e.g. `Asia/Kolkata`) | What "today" is, timestamps, and the auto-pass time |
| Week start | `week_starts_on` (0 Sunday, 1 Monday, 6 Saturday) | "This week" totals and calendars |
| Cheque validity | `cheque_validity_months` | Stale-cheque warnings |
| Clearing time | `clearing_days` | When to ask whether a deposited cheque has cleared |

`currency_symbol` is still filled in, from the currency, for older clients.

## Presets

Defined in `src/config/regions.ts`:

| Country | Currency | Date format | Week starts | Cheques valid for | Clearing |
|---|---|---|---|---|---|
| India | INR | dd/MM/yyyy | Monday | 3 months | 2 days |
| United Arab Emirates | AED | dd/MM/yyyy | Monday | 6 months | 2 days |
| Singapore | SGD | dd/MM/yyyy | Monday | 6 months | 2 days |
| United Kingdom | GBP | dd/MM/yyyy | Monday | 6 months | 2 days |
| United States | USD | MM/dd/yyyy | Sunday | 6 months | 2 days |
| Canada | CAD | yyyy-MM-dd | Sunday | 6 months | 2 days |
| Australia | AUD | dd/MM/yyyy | Monday | 15 months | 3 days |

Validity and clearing times follow usual bank practice in each country. Confirm them with someone local before promoting the app there. A user whose country isn't listed picks the closest one and adjusts each setting.

## Adding a country

1. Add an entry to `REGION_PRESETS` in `src/config/regions.ts`: currency, locale, time zones, date format, week start, cheque validity, clearing time, suggested banks and the calling code (used for WhatsApp links to phone numbers written without one).
2. Check the rules with someone who uses cheques there.
3. If its formats are unusual, add a case to `tests/formatters.test.ts`, then run `npm test`.

No other code should need to change. If something does, it has a hardcoded assumption that should move into the region.

## Rules for code

- **Money:** use `formatCurrency`, `formatCurrencyCompact` (charts) or `formatCurrencyCode` (PDFs, whose fonts lack symbols like ₹). Never hardcode a symbol or call `toLocaleString` with a fixed locale.
- **Typed amounts:** use `formatAmountInput` and `parseAmount`, which follow the user's grouping and decimal mark.
- **Dates:**
  - Store and pass them as ISO `yyyy-MM-dd`.
  - Display them with `formatDate`, `formatDateTime` or `formatDayMonth`.
  - Parse spreadsheet cells with `parseFlexibleDate`.
- **Today:** use `todayISO()` or `todayDate()`, which use the user's time zone. Don't use `new Date()` for calendar logic.
- **Weeks:** use `getActiveRegion().weekStartsOn`.
- **Text written by the database:**
  - Use ISO dates in notes; the app shows them in the user's format (`localizeIsoDates`).
  - Server jobs use `settings.timezone`.

All of these live in `src/lib/formatters.ts` and `src/lib/region.ts`. `SettingsProvider` sets the active region when settings load, and remounts the app when it changes.

## Not done yet

- The interface is English only. Strings will be extracted for translation with the redesign, which also brings the US spelling "check".
- Bank holidays and working days, needed for clearing dates on received cheques, will become part of the region.
