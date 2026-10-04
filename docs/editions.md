# Open source and hosted: one codebase, two editions

Cheque Tracker is open source under the AGPL-3.0 and is also offered as a paid hosted service at [chequetracker.com](https://chequetracker.com). Both run the same code from this repository. What differs is configuration, secrets and data, never the code.

This is the usual model for open-source products with a paid cloud: anyone can self-host for free, and people who'd rather not run servers pay for the hosted service.

## What's different

| | Self-hosted (default) | Hosted (chequetracker.com) |
|---|---|---|
| `instance_config.billing_enabled` | `false` | `true` |
| Plans | None. Every feature is free. | A free trial, then Business, or the Free plan |
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

### Plans: trial, Business and Free

On the hosted edition there are three states, and `entitlements.plan` names the paid one `business`:

| | What it is | What you can do |
|---|---|---|
| **Free trial** | `trial_days` from sign-up (30 on chequetracker.com), no card | Everything Business can, except importing an export |
| **Business** | Bought for 1, 3, 6 or 12 months, paid once, renewed by choice. Prices are the operator's `packs` rows | Everything |
| **Free** | What an account is on once its trial or plan ends | Move its cheques along and export, nothing new |

An **Enterprise** plan with AI features may come later. Nothing checks for it yet: any active entitlement gives full access.

### The Free plan

`has_write_access()` is true when billing is off, or when the signed-in user has an active entitlement. Without it, the account is on the Free plan (migration 019).

**Still works:**
- every status change on both sides, through the status functions: fund, pass, return, present again, write off, deposit, clear, bounce, re-deposit, paid another way, hand back;
- undo;
- adding funds for the cheques they cover;
- editing a cheque's notes;
- reading and exporting everything;
- settings.

**Needs Business:**
- adding cheques, parties, bank accounts or a replacement cheque;
- changing anything else on a cheque, or a party;
- deleting;
- importing an export.

**How it works:**
- The status functions mark their own transaction as a lifecycle change (`app.given_lifecycle`, `app.received_lifecycle`), so history and funds added are accepted inside them.
- The `RESTRICTIVE` insert policies keep anything new out.
- A trigger (`internal.free_plan_update_guard`) lets the Free plan change a cheque's notes only, and says why when it refuses.
- Jobs with no signed-in user, such as auto-pass and the companions using the service role, aren't limited by plans.

**Reminders:** reminders by email, WhatsApp or push (plan items 41 and 42) go only to accounts on a trial or Business. The Free plan keeps its records and Today's to-do list, but the app stops watching its dates.

The database is the source of truth. The app only reflects it:
- `PlanProvider` loads the plan once and keeps it current: it changes by itself when a plan ends or a bought one starts. `usePlan()` reads it, and `usePlan().lapsed` means the Free plan.
- **Guards:**
  - Buttons for what the Free plan can't do are wrapped in `usePlan().guard` (or check `requireWrite()`). They open a dialog that leads to Settings → Plan.
  - On the Free plan, Edit opens a notes-only dialog.
  - Moving cheques along isn't guarded.
- **No silent saves:** the Supabase client refuses new rows, and changes to parties, bank accounts and funds added, itself (`src/lib/plan.ts`). Otherwise row-level security would make those saves quietly do nothing. Reads, settings, sign-in and server functions (such as paying) are never held back.
- `PlanBanner` shows a notice on the Free plan and when a trial is ending. `PlanCard` in Settings shows the plan, the lengths you can buy Business for, and your payments.

With billing off, none of this shows or holds anything back.

### Free trials: one per person

With billing on and `trial_days` above 0, a new account gets a free trial at sign-up (migration 021). To stop people signing up again and again for more trials:

- **One trial per email address, ever.** A hash of each address that got a trial is kept in `internal.trial_claims`, even after the account is deleted. Names play no part; sign-up doesn't ask for one.
  - Two addresses count as one only when the provider delivers both to the same inbox, so no one else can own the other.
  - Case never matters.
  - Gmail ignores dots and "+anything".
  - Outlook, iCloud, Proton, Fastmail and Yandex ignore "+anything".
  - On any other domain, such as a company's own, every address counts as a different person.
  - A shared inbox, such as `accounts@` handed to a new colleague, gets one trial in all. You can give the newcomer one by hand (below).
- **No trial for throwaway mail.** Addresses at a domain in `internal.throwaway_email_domains`, or one of its subdomains, get no trial.
- **No sign-up is refused.** Such an account opens without a trial and can buy Business straight away. `trial_refusals` records why, and the app explains it.
- **Importing an export needs Business.** A free trial can't import an export (`import_data()` refuses, migration 019). The Excel template stays open, because that's how new users bring in their records.
- **The sign-up page says** "One free trial per person", and the terms should too.

Only a hash of the address is kept, never the address itself. Say so in the privacy policy.

### The demo

Visitors can try the app without signing up (plan item 86, migration 023). "Try the demo" on the sign-in and sign-up pages, or a link to `/demo`, signs them in with Supabase's anonymous sign-in. That gives each visitor a private account of their own, which `start_demo()` fills with made-up parties and cheques in every state, in the region their browser suggests. Ending the demo (signing out, or "Create an account") deletes the account and everything in it (`end_demo()`). Visitors never share data.

An anonymous session is a real signed-in session, so the database keeps demos in bounds, not the app:

- **A day, whatever the edition.** An anonymous account can change data only during its one-day `demo` grant, even where billing is off. Signing in anonymously without starting the demo gives an empty account that can't add anything.
- **Once, and only for anonymous accounts.** `start_demo()` gives the grant once per account, and never to a real one.
- **No trial, no buying, no importing.** Demos get no free trial and leave no trace in `trial_claims`. The `payments` function refuses them, and so does `import_data()`.
- **Small.** A demo holds at most 50 parties, 5 bank accounts, 100 cheques each way, 30 funds added and 300 history entries each way, with each row at most 2 kB. It can't be used as free storage.
- **Few at a time.** `instance_config.demos_per_hour` (50 to start) caps how many demos start in an hour across the instance. Setting it to 0 turns the demo off at once.
- **Gone after a day.** Demos more than a day old are deleted as new ones start. Where pg_cron is installed (Supabase has it), migration 023 also schedules the `remove-expired-demos` job to delete them every hour.
- **Made into a real account through the API** (the app never does this), a demo loses its day and gets no trial.

In the demo, the app shows a bar saying so, says "End the demo" instead of "Sign out", and offers an account instead of plans or importing.

### Tests

`tests/migrations.test.ts` applies every migration to an in-memory Postgres and checks both editions as real users: writes allowed with billing off, trials at sign-up, read-only accounts, comp grants, expired purchases, and that users can't write entitlements. `tests/demo.test.ts` checks the demo the same way, with anonymous users. They run on every pull request.

## Running the hosted edition

### Environments

| Environment | Supabase project | Frontend |
|---|---|---|
| Production | Its own project, used for nothing else | Vercel project deploying `main` (or release tags) |
| Development | A separate project, or `npx supabase start` locally | `npm run dev` |
| The maintainer's personal copy | Its own project until it moves to production as a normal account | Its own deployment, pinned to a stable tag |

Never develop against production, and never point development tools at it.

### Selling Business

Business is bought in Settings → Plan, through Razorpay and the `payments` Edge Function. Each length on sale (1, 3, 6 or 12 months) is a row in the `packs` table. Setting it up (the lengths and their prices, keys, the webhook) is in [payments.md](./payments.md). Prices live only in the hosted project's database.

### Switching billing on

Run this in the production SQL editor, once payments are set up.

```sql
update instance_config
set billing_enabled = true,
    trial_days = 30,            -- or 0 for no trial
    default_country_code = 'IN';
```

Accounts created before this have no entitlement and become read-only. Give them one, for example with a comp grant.

### Sign-up protection

- **Throwaway-mail domains.** Migration 021 starts the list with about 70 well-known services. For far wider coverage, add the public list from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (`disposable_email_blocklist.conf`, one domain per line). Paste its contents between the `$$` marks:

  ```sql
  insert into internal.throwaway_email_domains (domain)
  select distinct lower(d) from regexp_split_to_table($$<paste the file here>$$, '\s+') as d
  where lower(d) ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
  on conflict do nothing;
  ```

  To let one address have another trial, delete its row from `internal.trial_claims`: `where email_hash = internal.email_hash('<address>')`. Or give the account a trial by hand (below).
- **CAPTCHA.** The sign-in pages can run Cloudflare Turnstile, which usually passes without asking anything:
  1. Create a Turnstile widget for your domain in Cloudflare.
  2. Set its site key as `VITE_TURNSTILE_SITE_KEY` in the app's environment, and deploy.
  3. Then, in Supabase, go to Authentication → Attack Protection, turn on CAPTCHA protection, choose Turnstile, and enter the secret key.

  Keep that order. Once Supabase requires a CAPTCHA, sign-up, sign-in, password resets and the demo fail for any version of the app that doesn't send one. Google sign-in isn't affected.

### Turning on the demo

1. Push migration 023 first. Until then, an anonymous sign-in on an instance with billing off would have full access.
2. In Supabase, go to Authentication → Sign In / Providers and allow anonymous sign-ins. New sign-ups must be allowed too.
3. Under Authentication → Rate Limits, check the limit for anonymous sign-ins per IP address. Supabase starts at 30 an hour.
4. With CAPTCHA protection on (above), every anonymous sign-in needs a Turnstile token. The `/demo` page sends one.
5. Choose how many demos may start in an hour: `update instance_config set demos_per_hour = 50;`. Set it to 0 to turn the demo off without touching Supabase's settings.
6. Check the clean-up job: `select jobname, schedule from cron.job where jobname = 'remove-expired-demos';`.

Self-hosted copies: Supabase keeps anonymous sign-ins off unless you allow them, so there's no demo there by default.

### Granting a plan by hand

```sql
-- Complimentary, never expires (the owner, beta testers, support goodwill)
insert into entitlements (user_id, source, note)
values ('<auth user id>', 'comp', 'Owner');

-- A fixed period, e.g. a manual payment
insert into entitlements (user_id, source, expires_at, payment_ref, note)
values ('<auth user id>', 'purchase', now() + interval '6 months', '<payment id>', '6 months');

-- A free trial for an account that didn't get one (support goodwill)
insert into entitlements (user_id, source, expires_at, note)
values ('<auth user id>', 'trial', now() + interval '30 days', 'Free trial');
```

### Still needed before billing goes live

- **Sign-up:** a custom SMTP provider for auth emails, and CAPTCHA switched on (see Sign-up protection).
- **Renewal reminders** before Business ends.
- **The website and its legal pages:** chequetracker.com as a separate site, with the app at `app.chequetracker.com` (plan item 87). Terms (including one free trial per person), privacy policy (including the trial email hashes), and refund and cancellation policy. Razorpay's account activation and Google's brand verification both need them, so they come before payments go live.
- **Account deletion** that works on any plan, including Free (plan item 57).

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
