# Handover

Status on 2026-10-05, written for the next Claude Code chat. Start that chat in this repository's folder so `CLAUDE.md` loads, then paste everything below the line.

When you hand over again, update this file and the ticks in [plan.md](plan.md). Keep both free of prices, secrets and anything else `CLAUDE.md` keeps out of the repo.

---

Continue building Cheque Tracker in this repository. Read `CLAUDE.md` first and follow it. In particular:
- no AI attribution in commits
- commit, but never push
- no shop or store wording
- no hardcoded country values

The agreed plan and its progress are in `.claude/plan.md`. Work through its **Order of work** from the first unticked item, one at a time. Check with me before anything that changes Supabase settings or data.

## Done on 2026-10-05

- **The website's home page,** rebuilt from the Landing-v2 design once I approved it (`9739328` in the website).
  - It has every section of the boards, the two-lane opening included. Business's length picker needs no script.
  - The video section is built, and stays out until my video is set as `productVideo` in its `src/config.ts`.
  - Checked at desktop and phone widths, and under `wrangler dev` with the Content Security Policy enforced.
  - Its plan, "Next" item 3, lists the small changes from the boards and why.

## Done on 2026-10-04

- **The landing hero** on the canvas (Version 15), on both `Landing-v2` boards, approved on 2026-10-05. It has two lanes, "Cheques you receive" and "Cheques you give", with a cheque slip at each step.
  - A lane's next-step buttons are tapped, then its slips step down together: the last drops into "Money in" or "Paid", and a new one comes in at the top.
  - The lanes take turns every 2 seconds. It's one seamless 16-second CSS loop, and stands still with reduced motion.
  - The website's plan, "Next" item 1, says how to build it there.
- **Both sites on Cloudflare** (`6f4a143` here, `bcfcd94` in the website):
  - `wrangler.jsonc` and `public/_headers` replace `vercel.json`;
  - `docs/hosting.md` has the dashboard steps;
  - checked with `wrangler dev`.
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

- **Code:** everything is pushed, in both repositories. I pushed most of it; Claude pushed the last commits on 2026-10-05, at my request. 215 tests pass; lint (0 errors, 2 known warnings) and build are clean.
- **Migrations 019–023 are applied** to the dev project (checked on 2026-10-05). `src/types/database.ts` still has their tables and columns added by hand: regenerate it (What's next, item 1).
- **Supabase:** the dev project `cheque-tracker-dev` (Mumbai, free plan) is connected to this repo through Supabase's GitHub integration.
  - "Deploy to production" is on for `main`, with working directory `.`, so pushing new files in `supabase/migrations/` applies them. Migrations 001–023 are applied.
  - "Automatically expose new tables" is off, and automatic RLS is on.
  - My account has a settings row (region India). `instance_config.billing_enabled` is false, so everything is unlocked and no plan rules apply.
  - My v0 data is imported there: 97 parties, 82 given cheques and 7 funds added. The only received cheques are the made-up sample set (parties named "(sample)"). Settings → Your data → Remove sample data still removes it; that row shows only while the set is there.
  - Google sign-in is set up (OAuth client in Testing). Email confirmation is on, the minimum password length is 8, and anonymous sign-ins read as off. 023 is applied, so they can be turned on for the demo (Waiting on me, 6).
  - `.env.local` points at it.
- **Running the app:** `.claude/launch.json` starts `npm run dev` ("dev") for the browser pane. I sign in myself.
  - `http://127.0.0.1:5173` is a separate, signed-out address: use it to look at the sign-in pages without signing me out.
  - To test the installed app (service worker, offline start, updates), run `npm run build`, then the "preview" configuration (port 4173). The dev server has no service worker on purpose.
  - To check the Cloudflare setup (routing and headers), run `npm run build`, then the "cloudflare" configuration (`wrangler dev`, port 8787).
  - Plan rules only show with billing on. To check them without changing Supabase, fake `instance_config` and `entitlements` in the page by wrapping `window.fetch`, and intercept every change request, so my real data isn't touched. That's how items 55, 53, 84 and the Free plan were checked; their plan notes say how.
- **Waiting on me** (each needs my go-ahead or my accounts; never done for me):
  1. **Pushing:** both repositories are pushed (2026-10-05). From now on I push, as before.
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
     - `VITE_TURNSTILE_SITE_KEY` in the app Worker's build variables, deployed first;
     - only then CAPTCHA protection in Supabase with the secret key.

     The order matters: `docs/editions.md`, "Sign-up protection".
  4. **Throwaway-mail list (84):** I can load the full public list myself (SQL in `docs/editions.md`), or say yes to Claude downloading `disposable_email_blocklist.conf` from github.com/disposable-email-domains into a migration.
  5. **To try the Free plan for real:** `trial_days = 30` and billing on in dev. That puts my own account on Free, unless I give myself a comp grant.
  6. **Demo (86):** 023 is applied, so allow anonymous sign-ins in Supabase and check their rate limit (`docs/editions.md`, "Turning on the demo").
  7. **Two sites (87),** in `docs/hosting.md`:
     - the domain on Cloudflare, with Always Use HTTPS;
     - the website's Worker on the apex, with `www` redirecting;
     - this app's Worker on `app.`, with its build variables, `VITE_SITE_URL` and `VITE_COOKIE_DOMAIN` included;
     - Supabase's Site URL and redirect URLs;
     - Google's origin and consent-screen links;
     - Turnstile's hostname;
     - email from a subdomain with SPF, DKIM and DMARC, and the `support@` mailbox.
  8. **The website repo:**
     - its Worker on Cloudflare, from its branch `master` (`docs/hosting.md`);
     - the product video, when it's ready: under 25 MiB to serve it from the site (its `src/config.ts`, `productVideo`);
     - fill in my details in its `src/config.ts`;
     - review its legal drafts. Its plan, "Before launch", lists the proposals to confirm, such as the refund rules.
- **Design:**
  - The Passbook design is approved and built: 27 boards on a private Claude Design canvas, https://claude.ai/artifact/VWTn8hQaU45E8bVUsy4jdG. Keep it exactly.
  - `docs/design-brief.md` has the fonts, colour tokens, status chips and layout rules. `docs/feature-map.md` lists every feature.
  - To read a board's markup, use the Artifact tool's `read` on the canvas, `project/<Board>.dc.html`.
- **Folders:** this repo is `C:\Users\vikas\projects\cheque-tracker`, and v0 is `../Cheque-Tracker-v0`. If a tracked file ever goes missing, `git show HEAD:<file>` has it. The website is the private repo `vikashpatel04/cheque-tracker-website`, in `../cheque-tracker-website`, with its own `CLAUDE.md` and plan.

## What's next

In this order unless I say otherwise:
1. **Regenerate `src/types/database.ts`** with the Supabase MCP tool (`generate_typescript_types`, which only reads), now that 019–023 are applied. Then lint, test, build and commit.
2. **88, a faster start,** whenever I ask. The main file is 1,068 kB (it was 1,048 kB after 69); look at that too.
3. **The website's launch steps,** with me: its own plan, "Before launch", and `docs/hosting.md` here for Cloudflare.
4. **Notifications (plan item 41),** which I asked for on 2026-10-04:
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

## Decided on 2026-10-05

- **The landing design is approved,** the two-lane hero included, and the website's home page is built from it.
- **Claude pushed both repositories once,** because I was away from my computer. The rule stays: Claude commits, and I push.
- **I'll host the website on `chequetracker.com` through Cloudflare** (`docs/hosting.md`).

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
  - `chequetracker.com` and `www` are a static website in a private repo (Astro on Vercel, then Cloudflare from 2026-10-04): home, pricing, FAQ, terms, privacy, refunds, contact.
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
