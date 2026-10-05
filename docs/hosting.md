# Hosting: the website and the app

The hosted edition runs as two sites on one domain (plan item 87), both on Cloudflare's free plan:

| Address | What | Where it comes from |
|---|---|---|
| `chequetracker.com` | The website: home, pricing, FAQ, terms, privacy, refunds, contact | A static site in its own private repository, on a Worker of its own |
| `www.chequetracker.com` | Redirects to `chequetracker.com` | A redirect rule in Cloudflare |
| `app.chequetracker.com` | This app | This repository, on a Worker of its own |

Self-hosted copies need none of this: they run the app alone, on any address ([self-hosting.md](./self-hosting.md)).

## Why two sites

- The installed app's service worker answers every page on its own address, so a landing page there would never reach visitors once they've used the app.
- A static page loads fast and ranks better in search.
- Prices and other business material stay out of this public repository.
- Scripts on the website (analytics, say) can never read the app's sign-in tokens, which live on another origin.
- Each can be changed and deployed without the other.

## Why Cloudflare

Decided on 2026-10-04:
- Cloudflare's free plan allows commercial use, and requests for static files are free and unlimited.
- Vercel's free Hobby plan is for non-commercial use only, and selling plans is commercial.

Both sites are Workers with static assets only, so no server code runs. Each repository keeps its own settings in `wrangler.jsonc` and `public/_headers`.

## The domain

1. **Add `chequetracker.com` to Cloudflare** on the free plan, then change the nameservers at the registrar to the two that Cloudflare shows. Moving the domain to Cloudflare's own registrar works too.
2. **Turn on Always Use HTTPS,** under SSL/TLS → Edge Certificates.

Cloudflare adds the DNS records for the apex and `app` itself, when they're added to the Workers below. Only `www` needs a record by hand.

## The app's Worker

**In this repository:**
- **`wrangler.jsonc`** serves `dist/` as static assets. Addresses that aren't files get `index.html`, so the app's own router takes over.
- **`public/_headers`** sends these with every response:
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `X-Frame-Options: DENY`;
  - `Strict-Transport-Security`.
- **Caching** stays at Cloudflare's default, `public, max-age=0, must-revalidate`:
  - Every load checks for a new version, so installed apps find updates at once.
  - The service worker keeps the files for offline use.
  - Built files get no longer life. A missing file gets the app's page, as every unknown address does, and a browser must never keep that page under a script's name.

**In the Cloudflare dashboard,** under Workers & Pages → Create → Import a repository:
1. **Repository:** `vikashpatel04/cheque-tracker`, production branch `main`.
2. **Worker name:** `cheque-tracker`, the `name` in `wrangler.jsonc`.
3. **Build command:** `npm run build`. **Deploy command:** `npx wrangler deploy`, the default.
4. **Builds for other branches:** off. They would be built with the production variables.
5. **Build variables,** under Settings → Build → Build variables and secrets. They're read when the app is built and end up in the browser, so they're never secrets:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the production Supabase project.
   - `VITE_SITE_URL=https://chequetracker.com`: "Back to website" on the sign-in pages, and the terms and privacy links on sign-up and the demo.
   - `VITE_COOKIE_DOMAIN=.chequetracker.com`: the signed-in flag (below).
   - `VITE_TURNSTILE_SITE_KEY`: the CAPTCHA ([editions.md](./editions.md), "Sign-up protection").
6. **Custom domain,** under Settings → Domains & Routes → Add → Custom domain: `app.chequetracker.com`. Cloudflare adds its DNS record and certificate.
7. **One address:** once the app works on `app.`, turn off its `workers.dev` address on the same page.

A changed build variable takes effect with the next build: push, or retry the latest build.

**To try it locally:** run `npm run build`, then `npx wrangler@4 dev` (the "cloudflare" configuration in `.claude/launch.json`). It serves `dist/` on http://localhost:8787, with the same routing and headers.

## The website's Worker

The website's repository has its own `wrangler.jsonc` and `public/_headers`. They set its pages, its not-found page and its headers, including a strict Content Security Policy.

Set it up the same way:
- **Repository:** `vikashpatel04/cheque-tracker-website`, production branch `master` (that repository's main branch).
- **Worker name:** `cheque-tracker-website`.
- **Build command:** `npm run build`. It needs no variables.
- **Custom domain:** `chequetracker.com`.

## `www`

`www.chequetracker.com` only redirects to the apex:
1. **DNS:** an `AAAA` record named `www`, with the address `100::`, proxied. The address is a placeholder: Cloudflare answers before it would ever be used.
2. **Rules → Redirect Rules,** a new rule:
   - **When** the wildcard pattern `https://www.chequetracker.com/*` matches;
   - **Then** go to `https://chequetracker.com/${1}`, with status 301, keeping the query string.

## The signed-in flag

Signing in to the app sets a cookie the website can read, so its home page can send signed-in visitors straight on to the app (`src/lib/siteCookie.ts`):

- **Name and value:** `ct_signed_in=1`. It's only a flag: never a token, an email address or anything else about the person.
- **Where:** `Domain=.chequetracker.com` (from `VITE_COOKIE_DOMAIN`), `Path=/`, `Secure`, `SameSite=Lax`, for a year.
- **When:**
  - It's set when a session starts, and checked again each time the app opens.
  - It's cleared on sign-out, or when the app finds no session.
  - A demo never sets it.
- **What the website does with it:** only its home page redirects. Pricing, the FAQ and the legal pages stay readable when signed in. The flag can be out of date (a session that ended while the app was closed), and the app then shows its sign-in page, which is fine.

Without `VITE_COOKIE_DOMAIN`, as on self-hosted copies, nothing is set.

## Supabase Auth

In the production project, under Authentication → URL Configuration:

- **Site URL:** `https://app.chequetracker.com`. Confirmation and password-reset emails link there.
- **Redirect URLs:** `https://app.chequetracker.com/**`. Don't add the `workers.dev` address: only the app's own address should receive sign-ins.

## Google sign-in

In Google Cloud, on the OAuth client:

- **Authorized JavaScript origins:** `https://app.chequetracker.com`.
- **Authorized redirect URI:** unchanged, Supabase's own callback (`https://<project-ref>.supabase.co/auth/v1/callback`).

On the OAuth consent screen:
- **Home page:** `https://chequetracker.com`.
- **Privacy policy:** `https://chequetracker.com/privacy`.
- **Terms:** `https://chequetracker.com/terms`.
- **Authorized domain:** `chequetracker.com`.

Google's brand verification checks these pages, so the website goes live first.

## Turnstile (CAPTCHA)

The widget's hostnames: `app.chequetracker.com`. The website needs no CAPTCHA: it has no forms that sign in or send email.

## Email

- **Sending:** Supabase's auth emails (confirmations, password resets) go through your own SMTP provider. Send from a subdomain, such as `mail.chequetracker.com`, so its reputation stays apart from the main domain. The provider gives the SPF and DKIM records for it. Add a DMARC record too, starting with `p=none` while you watch the reports.
- **Receiving:** `support@chequetracker.com`, on the apex, for the contact page and replies. Cloudflare's Email Routing, which is free, can forward it to an inbox you already have, and adds its own records.

## The demo

The website's "Try the demo" links to `https://app.chequetracker.com/demo`. Turning the demo on is in [editions.md](./editions.md), "Turning on the demo".

## Order

1. **The domain** on Cloudflare.
2. **The website,** with its terms, privacy policy and refund policy, and the `www` redirect. Razorpay's activation and Google's brand verification both look for them.
3. **The app on `app.`:** its Worker, build variables and custom domain.
4. **Supabase's URLs,** Google's origins and consent screen, and Turnstile's hostname.
5. **Email:** sending from the subdomain, and `support@`.
6. **Payments:** see [payments.md](./payments.md).

## Next: a Content Security Policy

A CSP would also block any script the app doesn't expect. It has to allow:
- Supabase: `https://<ref>.supabase.co`, and `wss://` for live updates if they're ever used;
- Turnstile: `https://challenges.cloudflare.com`, for its script and frame;
- Razorpay Checkout: `https://checkout.razorpay.com` for the script, `https://api.razorpay.com` for its frame and calls.

Add it to `public/_headers` as `Content-Security-Policy-Report-Only` first, which only reports. Go through sign-up, the CAPTCHA and a test payment with the browser console open, and enforce it only once nothing is reported.
