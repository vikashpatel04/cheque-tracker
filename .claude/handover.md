# Handover

Status on 2026-10-04, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file and the ticks in [plan.md](plan.md). Keep both free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

The agreed plan and its progress are in `.claude/plan.md`. Work through its **Order of work** from the first unticked item, one at a time. Check with me before anything that changes Supabase settings or data.

## Done on 2026-10-04

- **The website** (`../cheque-tracker-website`):
  - light only;
  - Business in four lengths (1, 3, 6 or 12 months, prices confirmed), and Enterprise as coming soon;
  - its plan lists what's next (`.claude/plan.md`, "Next, in order").
- **A new landing design** on the canvas, in the row "Landing, redesigned": boards `Landing-v2-desktop` and `Landing-v2-phone`. I like it better than the first; the hero's right side is next.
- **Docs here:** the four lengths, and the decisions of 2026-10-04.

## Done on 2026-10-03

I asked for the demo with its security taken care of, and for the two-site setup, with the website in my existing private repo, started afresh.

- **86, the demo:** built and committed (`61b6062`); plan item 86 has the details. The database keeps anonymous sessions in bounds, even with billing off.
- **87, the app's part:** built and committed (`9720370`): the `ct_signed_in` flag, "Back to website", the terms line, safe headers, and `docs/hosting.md`.
- **87, the website:** `../cheque-tracker-website`.
  - The old open-source family site was removed (`b10683d`), and the new site built from the Landing board (`a2b5f65`).
  - Its own `CLAUDE.md` and `.claude/plan.md` say how it works and what's left before launch. The legal pages are drafts until my details are in its `src/config.ts`.

## Where things stand

- **Code:** all work is committed on `main`; nothing is pushed since `c164418`. 215 tests pass; lint (0 errors, 2 known warnings) and build are clean.
- **Unpushed commits** (oldest first):
  - `e2d4b20`: the CI fix;
  - `0eeeb41`: 69, loading less up front;
  - `9972c3b`, `bccfe2f`: 52, sign-up, Google and password reset;
  - `43dec27`: the "+" on Today;
  - `8b683cd`: 55, first version;
  - `132f353`: 53, payments;
  - `38913db`, `1134f38`: 84, one trial per person;
  - `8f7f487`, `7b2389e`, `3e3d753`: the Free and Business plans;
  - `1435d56`, `817f17f`: 85, the tour;
  - `61b6062`: 86, the demo;
  - `9720370`: 87, the app's part of the two sites.
- **Unpushed migrations:**
  - `019_free_plan.sql`: the Free plan; rewritten before it was ever pushed, replacing the first `019_plan_ended_message.sql`.
  - `020_payments.sql`: plan lengths, orders and `record_payment()`.
  - `021_one_trial_per_person.sql`.
  - `022_tour.sql`.
  - `023_demo.sql`: the demo. `020_payments.sql` also changed before it was ever pushed: a bought plan's start ignores a demo's day.

  Pushing applies them to the dev project. Then regenerate `src/types/database.ts` with the Supabase MCP tool: the new tables and columns were added to it by hand.
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Deploy to production" is on for `main`, with working directory `.`, so pushing new files in `supabase/migrations/` applies them. Migrations 001–018 are applied.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - My account has a settings row (region India). `instance_config.billing_enabled` is false, so everything is unlocked and no plan rules apply.
  - My v0 data is imported there: 97 parties, 82 given cheques and 7 funds added. The only received cheques are the made-up sample set (parties named "(sample)"). Settings → Your data → Remove sample data still removes it; that row shows only while the set is there.
  - Google sign-in is set up (OAuth client in Testing). Email confirmation is on, the minimum password length is 8, and anonymous sign-ins read as off: keep them off until 023 is pushed.
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
  6. **Demo (86):** after pushing 023, allow anonymous sign-ins in Supabase and check their rate limit (`docs/editions.md`, "Turning on the demo").
  7. **Two sites (87),** in `docs/hosting.md`:
     - the website on Cloudflare, on the apex with `www` redirecting (Cloudflare, not Vercel: see 2026-10-04);
     - this app on `app.`, with `VITE_SITE_URL` and `VITE_COOKIE_DOMAIN` set;
     - Supabase's Site URL and redirect URLs;
     - Google's origin and consent-screen links;
     - Turnstile's hostname;
     - email from a subdomain with SPF, DKIM and DMARC, and the `support@` mailbox.
  8. **The website repo:**
     - push it (five commits: `b10683d` to `ae9437d`);
     - fill in my details in its `src/config.ts`;
     - review its legal drafts. Its plan, "Before launch", lists the proposals to confirm, such as the refund rules.
- **Design:**
  - The Passbook design is approved and built: 27 boards on a private Claude Design canvas, https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG. Keep it exactly.
  - `docs/design-brief.md` has the fonts, colour tokens, status chips and layout rules. `docs/feature-map.md` lists every feature.
  - To read a board's markup, use the Artifact tool's `read` on the canvas, `project/<Board>.dc.html`.
- **Folders:** this repo is `C:\Users\vikas\projects\cheque-tracker`, and v0 is `../Cheque-Tracker-v0`. If a tracked file ever goes missing, `git show HEAD:<file>` has it. The website is the private repo `vikashpatel04/cheque-tracker-website`, in `../cheque-tracker-website`, with its own `CLAUDE.md` and plan.

## What's next

In this order unless I say otherwise:
1. **The landing hero on the canvas** (https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG).
   - On `Landing-v2-desktop` and `Landing-v2-phone`, replace the right side's floating cheque and phone with something in continuous motion that explains the app's flow, with perfect loops where needed.
   - Keep it calm and on-brand, and still for reduced motion.
   - Both boards have the same markup apart from `<title>` and `$preview`: read the desktop one, change it, and write both.
   - Follow the canvas's `SKILL.md`: read the artifact with `read` before publishing, and don't render it unless I ask.
2. **Move both sites to Cloudflare** (approved).
   - **This app:** `vercel.json` becomes Cloudflare's config, Workers with static assets in `wrangler.jsonc`:
     - the SPA fallback;
     - `public/_headers` for the same caching and security headers;
     - `sw.js` and `index.html` never cached.

     Then rewrite `docs/hosting.md` for Cloudflare: DNS, Workers Builds from GitHub, environment variables, custom domains, and the `www` redirect. Check `docs/editions.md` and `CLAUDE.md` for Vercel mentions.
   - **The website:** the same steps; its plan has them.
3. **Rebuild the website's home page** from the approved design, by its plan's notes. Its Content Security Policy blocks inline styles and scripts, so no `style` attributes there.
4. **88, a faster start,** whenever I ask. The main file is 1,068 kB (it was 1,048 kB after 69); look at that too.
5. **The website's launch steps,** with me: its own plan, "Before launch".
6. **Notifications (plan item 41),** which I asked for on 2026-10-04:
   - notification options in Settings → Notifications;
   - a time I choose for a short daily brief of what needs doing;
   - email or push;
   - trial and Business only.
   The plan's item 41 has the details.

After that:
- **Before launch:**
  - 54: renewal reminders;
  - 56: admin;
  - 57: account deletion in the app, and a final review of the website's legal drafts; the plan lists what they need;
  - 58: end-to-end tests;
  - 59: the production project;
  - the 52 leftovers: SMTP, leaked-password protection, Google brand verification.
- **Features:** 41 and 42, reminders, for trial and Business only.

83 (installing on phones) is for later. Tick the feature map off as you go, and check every screen at desktop and phone width.

## Decided on 2026-10-04

- **The website is light only:** no dark mode there. The app keeps its own light and dark.
- **The plans shown** are Business, now, and Enterprise, coming soon with AI features and longer plans. Free is only what an account keeps after a trial or plan ends.
- **Business comes in four lengths:** 1, 3, 6 or 12 months, prices confirmed (they live only in the website repo and the `packs` table).
- **The landing page gets a new design on the canvas,** to approve before it's built: more attractive, minimal motion, explanations where they help, and room for a product video I'll provide.
- **Hosting:** Cloudflare's free plan for both sites (I said yes). Vercel's Hobby plan is for non-commercial use only, and selling plans is commercial.
- **The landing hero:** I want continuous motion that explains the app's flow, with perfect loops, instead of the floating cheque and phone.
- **Notifications:** options in Settings, including a time I choose for a short daily brief (plan item 41).

## Decided on 2026-10-03

- **The website** lives in my existing private repo `cheque-tracker-website`. The old site for the open-source family was deleted and the new one started there; the old one stays in its history.
- **Anonymous sign-ins** for the demo are allowed only with the database keeping them in bounds (86): a day, once, small, few per hour, never paid or imported, and deleted after.

## Decided on 2026-10-02

- **Plans:**
  - a 30-day free trial, with no card;
  - **Business**, prepaid for 1, 6 or 12 months (auto-renew later; 3 months added on 2026-10-04);
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
