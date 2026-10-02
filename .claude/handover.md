# Handover

Status on 2026-10-02, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file and the ticks in [plan.md](plan.md). Keep both free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

The agreed plan and its progress are in `.claude/plan.md`. Work through its **Order of work** from the first unticked item, one at a time. Check with me before anything that changes Supabase settings or data.

## Where things stand

- **Code:** all work is committed on `main`; nothing is pushed since `c164418`. 193 tests pass; lint (0 errors, 2 known warnings) and build are clean.
- **Unpushed commits** (oldest first):
  - `e2d4b20`: the CI fix;
  - `0eeeb41`: 69, loading less up front;
  - `9972c3b`, `bccfe2f`: 52, sign-up, Google and password reset;
  - `43dec27`: the "+" on Today;
  - `8b683cd`: 55, first version;
  - `132f353`: 53, payments;
  - `38913db`, `1134f38`: 84, one trial per person;
  - `8f7f487`, `7b2389e`, `3e3d753`: the Free and Business plans;
  - `1435d56`, `817f17f`: 85, the tour.
- **Unpushed migrations:**
  - `019_free_plan.sql`: the Free plan; rewritten before it was ever pushed, replacing the first `019_plan_ended_message.sql`.
  - `020_payments.sql`: plan lengths, orders and `record_payment()`.
  - `021_one_trial_per_person.sql`.
  - `022_tour.sql`.

  Pushing applies them to the dev project. Then regenerate `src/types/database.ts` with the Supabase MCP tool: the new tables and columns were added to it by hand.
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Deploy to production" is on for `main`, with working directory `.`, so pushing new files in `supabase/migrations/` applies them. Migrations 001–018 are applied.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - My account has a settings row (region India). `instance_config.billing_enabled` is false, so everything is unlocked and no plan rules apply.
  - My v0 data is imported there: 97 parties, 82 given cheques and 7 funds added. The only received cheques are the made-up sample set (parties named "(sample)"). Settings → Sample data removes it; remove it before item 86 takes that button away.
  - Google sign-in is set up (OAuth client in Testing). Email confirmation is on, the minimum password length is 8, and anonymous sign-ins are off (item 86 needs them on).
  - `.env.local` points at it.
- **Running the app:** `.claude/launch.json` starts `npm run dev` ("dev") for the browser pane. I sign in myself.
  - `http://127.0.0.1:5173` is a separate, signed-out address: use it to look at the sign-in pages without signing me out.
  - To test the installed app (service worker, offline start, updates), run `npm run build`, then the "preview" configuration (port 4173). The dev server has no service worker on purpose.
  - Plan rules only show with billing on. To check them without changing Supabase, fake `instance_config` and `entitlements` in the page by wrapping `window.fetch`, and intercept every change request, so my real data isn't touched. That's how items 55, 53, 84 and the Free plan were checked; their plan notes say how.
- **Waiting on me** (each needs my go-ahead or my accounts; never done for me):
  1. Push. Then the types get regenerated.
  2. **Payments (53):**
     - Razorpay test-mode keys;
     - the three secrets;
     - deploy the `payments` function;
     - the webhook;
     - plan lengths and prices in the `packs` table;
     - billing on in dev for one test payment.

     Steps in `docs/payments.md`.
  3. **CAPTCHA:**
     - a Cloudflare Turnstile widget;
     - `VITE_TURNSTILE_SITE_KEY` in Vercel, deployed first;
     - only then CAPTCHA protection in Supabase with the secret key.

     The order matters: `docs/editions.md`, "Sign-up protection".
  4. **Throwaway-mail list (84):** I can load the full public list myself (SQL in `docs/editions.md`), or say yes to Claude downloading `disposable_email_blocklist.conf` from github.com/disposable-email-domains into a migration.
  5. **To try the Free plan for real:** `trial_days = 30` and billing on in dev. That puts my own account on Free, unless I give myself a comp grant.
  6. **Demo (86):** turn on anonymous sign-ins in Supabase.
  7. **Two sites (87):** Vercel domains, Supabase Site URL and redirect URLs on `app.chequetracker.com`, Google's authorized origins, Turnstile hostnames, and email sending from a subdomain with SPF, DKIM and DMARC.
- **Design:**
  - The Passbook design is approved and built: 27 boards on a private Claude Design canvas, https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG. Keep it exactly.
  - `docs/design-brief.md` has the fonts, colour tokens, status chips and layout rules. `docs/feature-map.md` lists every feature.
  - To read a board's markup, use the Artifact tool's `read` on the canvas, `project/<Board>.dc.html`.
- **Folders:** this repo is `C:\Users\vikas\projects\cheque-tracker`, and v0 is `../Cheque-Tracker-v0`. If a tracked file ever goes missing, `git show HEAD:<file>` has it. The website (item 87) will be a new private repo in a new folder next to this one, such as `chequetracker-site`.

## What's next

In this order unless I say otherwise:
1. **86, the demo account,** once I've turned on anonymous sign-ins. The design is in the plan's item 86.
2. **87, the app's part of the two sites:**
   - the `ct_signed_in` cookie;
   - "Back to website", and the terms and privacy links on sign-up;
   - `docs/hosting.md`.

   Then the website itself, in its own repo, with its own plan.
3. **88, a faster start,** whenever I ask. The main file has grown from 1,048 kB to 1,072 kB since 69 (payments, plans, CAPTCHA); look at that too.

After that:
- **Before launch:**
  - 54: renewal reminders;
  - 56: admin;
  - 57: legal pages and account deletion; the plan lists what it needs;
  - 58: end-to-end tests;
  - 59: the production project;
  - the 52 leftovers: SMTP, leaked-password protection, Google brand verification.
- **Features:** 41 and 42, reminders, for trial and Business only.

83 (installing on phones) is for later. Tick the feature map off as you go, and check every screen at desktop and phone width.

## Decided on 2026-10-02

- **Plans:**
  - a 30-day free trial, with no card;
  - **Business**, prepaid for 1, 6 or 12 months (auto-renew later);
  - **Free** once a trial or plan ends;
  - **Enterprise** later, with AI features.
- **The Free plan:**
  - **Still works:** cheques keep moving (every status change, undo, funds for ticked cheques), notes can be edited, and everything can be read and exported.
  - **Needs Business:** adding, other edits, deleting and importing.
- **Rejected:** a cheque-count limit. People pay for the hosting, since the same app is free to self-host.
- **Reminders:** only trial and Business accounts get them.
- **Importing an export:** needs Business, not a trial.
- **The email checks** from 84 stay, and the CAPTCHA.
- **A short tour** after the first cheque, ending with an offer of "Learn how cheques work" (85, built).
- **The demo:**
  - Sample data goes. Each visitor gets a private demo: an anonymous sign-in, seeded in one request.
  - Signing out discards it, and a daily cleanup removes abandoned demos.
  - Demos get a one-day Business grant, can't buy or import, and see a bar inviting them to sign up (86).
- **The domain:**
  - `chequetracker.com` and `www` are a static website in a private repo (Astro on Vercel): home, pricing, FAQ, terms, privacy, refunds, contact.
  - `app.chequetracker.com` is this app.
  - The website's header has Sign in and "Start free trial", and its home page sends signed-in visitors to the app (87).
  - The legal pages come before payments go live.
- **Pricing:** stays as decided, and is reviewed once reminders exist. Prices never go in the repo.

## Decided on 2026-10-01

- **One trial per email address, never by name** (84). Two addresses count as one only when the provider delivers them to the same inbox. On a company's own domain, every address is its own person.
- **My idea of tying each export to its account** goes with item 10, when exports get IDs anyway.

## Decided on 2026-09-29

- The code stays open source (AGPL-3.0) next to the paid hosted service; I weighed a private repo and kept it as it is (plan item 73).
- One list of bank accounts: given cheques pick their bank from it, and "Banks you write cheques on" goes (74).
- A "Learn how cheques work" guide in the sidebar, with question links where things might confuse (75).

## Decided on 2026-09-28

- After reviewing steps 1 to 3 (plan items 70–72): cheques you give show no minus sign; each cheque's next step is a button (Pending → Mark funded, Funded → Mark passed, Returned → decide); Add funds is only the daily batch for money put into the bank today, which funds the ticked cheques at once and starts from zero each day, and the app says so. I'll review the receiving side's wording and signs later.
- My own logo is the app's logo: `public/logo.webp` and the icons in `public/icons/`, made from it.
- Build the web version (the PWA) first; I decide about native apps once it's done. Keep the Passbook look exactly as designed.
- Fonts are bundled with the app instead of loaded from Google, so the installed app works offline and makes no third-party requests.
- Light or dark follows the device unless you pick one under Appearance; the choice is saved per device.
- Until their screens are rebuilt: Returned stays in the menu (it becomes a saved view in step 3), and the old dashboard sits under the new Today title (step 2).

## Decided on 2026-09-27

- The app shows no source-code link unless a deployment sets `VITE_SOURCE_URL`. Before merging the first outside contribution, adopt a CLA or set the link on the hosted edition; see `docs/editions.md`.
- The plan in `plan.md` was approved as written. Later the same day: item 10 (IDs in the export) moved to go with 57, and item 11 (sample data) with the received screens in 14.
- Which cheques someone sees (given, received or both) is only a view. Settings sets the default, and Today and Cheques have an All / Given / Received switch.
- The redesign keeps every existing feature (`docs/feature-map.md`).
