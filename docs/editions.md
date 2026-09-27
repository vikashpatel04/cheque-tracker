# Open source and hosted: one codebase, two editions

Cheque Tracker is open source under the AGPL-3.0 and is also offered as a paid hosted service at [chequetracker.com](https://chequetracker.com). Both run the same code from this repository. What differs is configuration, secrets and data, never the code.

This is the usual model for open-source products with a paid cloud: anyone can self-host for free, and people who'd rather not run servers pay for the hosted service.

## What's different

| | Self-hosted (default) | Hosted (chequetracker.com) |
|---|---|---|
| `instance_config.billing_enabled` | `false` | `true` |
| Plans and limits | None. Every feature is free. | Adding or changing data needs an active plan |
| Free trial | Not applicable | `instance_config.trial_days` |
| Sign-ups | Off by default | Open |
| Name and logo | Your own (see [TRADEMARKS.md](../TRADEMARKS.md)) | Cheque Tracker |
| Supabase project, keys, data | Yours | The operator's |

## How it works

### `instance_config`

A table with exactly one row, created by migration `011_editions.sql`:

| Column | Meaning |
|---|---|
| `billing_enabled` | `false` (default): self-hosted, no plans. `true`: plans are enforced. |
| `trial_days` | Free days for new sign-ups when billing is on. `0` means no trial. |
| `default_country_code` | Country pre-selected at first sign-in when the browser doesn't reveal one. |

Anyone can read it and nobody can change it through the API. It can only be changed with the service role or in the SQL editor.

### `entitlements`

One row per grant of access: a `trial`, a `purchase` (with the payment provider's id in `payment_ref`), or a `comp` (complimentary) grant from the operator. A row with `expires_at` empty never expires.

Users can read their own rows. Only the service role can create or change them: the payment webhook, or an operator in the SQL editor. The schema is public, so this matters. No API call can grant someone a plan.

### Read-only accounts

`has_write_access()` is true when billing is off, or when the signed-in user has an active entitlement. Restrictive row-level security policies on `parties`, `cheques`, `cheque_history`, `daily_deposits`, `received_cheques`, `received_cheque_history` and `bank_accounts` require it for inserts, updates and deletes:
- **Reads are never blocked.** A user whose plan ends keeps seeing and exporting everything.
- **Settings stay writable.**
- **Self-hosted instances are unaffected,** because `has_write_access()` is always true there.

The database is the source of truth. The app only reflects it:
- `usePlan()` reads the plan.
- `PlanBanner` shows a notice when an account is read-only or a trial is ending.
- `PlanCard` in Settings shows the current plan.

With billing off, all three render nothing.

### Tests

`tests/migrations.test.ts` applies every migration to an in-memory Postgres and checks both editions as real users: writes allowed with billing off, trials at sign-up, read-only accounts, comp grants, expired purchases, and that users can't write entitlements. It runs on every pull request.

## Running the hosted edition

### Environments

| Environment | Supabase project | Frontend |
|---|---|---|
| Production | Its own project, used for nothing else | Vercel project deploying `main` (or release tags) |
| Development | A separate project, or `npx supabase start` locally | `npm run dev` |
| The maintainer's personal copy | Its own project until it moves to production as a normal account | Its own deployment, pinned to a stable tag |

Never develop against production, and never point development tools at it.

### Switching billing on

Run this in the production SQL editor. Do it once the payment flow below exists.

```sql
update instance_config
set billing_enabled = true,
    trial_days = 14,            -- or 0 for no trial
    default_country_code = 'IN';
```

Accounts created before this have no entitlement and become read-only. Give them one, for example with a comp grant.

### Granting a plan by hand

```sql
-- Complimentary, never expires (the owner, beta testers, support goodwill)
insert into entitlements (user_id, source, note)
values ('<auth user id>', 'comp', 'Owner');

-- A fixed period, e.g. a manual payment
insert into entitlements (user_id, source, expires_at, payment_ref, note)
values ('<auth user id>', 'purchase', now() + interval '6 months', '<payment id>', '6-month pack');
```

### Still needed before billing goes live

- **Payment flow:** checkout, and a webhook Edge Function that verifies the payment and inserts a `purchase` entitlement. A new pack should start when the current one ends, so buying early loses nothing.
- **Sign-up and onboarding:** email verification and password reset. Also CAPTCHA on sign-up, and a custom SMTP provider for auth emails.
- **Read-only UI:** hide or disable actions that write when the account is read-only. The database already refuses them, but some errors currently read "Cheque not found".
- **Renewal reminders** before a pack ends.
- **Legal pages:** terms, privacy policy, and refund and cancellation policy.

## What never goes in this repository

- **Keys and secrets:** the Supabase service-role key, payment keys and webhook secrets. They belong in Supabase and Vercel secrets. Anything in a `VITE_*` variable ends up in the browser.
- **Customer data:** exports, screenshots and logs with real cheque, party or bank details.
- **Business documents:** pricing experiments, customer lists, and runbooks with production details. Keep them in a private place.

## Releases and upgrades

- Migrations are numbered and additive, so any self-hosted database can upgrade by applying new files in order. CI applies all of them on every pull request.
- Tag releases (`v1.0.0`, `v1.1.0`, …) with notes. Self-hosters upgrade from tags; the hosted edition deploys `main` or the latest tag.
- The cheque-mcp and Cheque Watch companions read the same tables. Schema changes must not break them, or they must ship alongside an update to them.

## Licence obligations (AGPL-3.0)

- The app shows a source link, in the sidebar and on the sign-in page, only when `VITE_SOURCE_URL` is set.
- Anyone who runs a modified copy as a network service must offer its users the source of that version: publish the fork and set `VITE_SOURCE_URL` to it.
- People who self-host without changing the code have nothing to set.
- The hosted edition leaves it unset. The maintainer holds the copyright in all of the code, and the licence's conditions don't bind the copyright holder.

## Contributions

Contributions are accepted under the AGPL-3.0 with a [DCO](https://developercertificate.org/) sign-off; see [CONTRIBUTING.md](../CONTRIBUTING.md). The hosted edition shows no source link, which relies on the maintainer holding the copyright in all of the code. So *before* merging the first outside contribution, either move to a contributor licence agreement (CLA) that lets the maintainer run contributions in the hosted edition without the AGPL's conditions, or set `VITE_SOURCE_URL` there. A CLA is also what relicensing, or selling licences with different terms, would need.

## Name and logo

The code is open, but the name and logo are not part of the licence. Copies offered to others must use their own branding, which only takes a few environment variables; see [TRADEMARKS.md](../TRADEMARKS.md).
