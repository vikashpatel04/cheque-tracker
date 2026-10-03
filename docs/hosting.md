# Hosting: the website and the app

The hosted edition runs as two sites on one domain (plan item 87):

| Address | What | Where it comes from |
|---|---|---|
| `chequetracker.com` | The website: home, pricing, FAQ, terms, privacy, refunds, contact | A static site in its own private repository |
| `www.chequetracker.com` | Redirects to `chequetracker.com` | The same Vercel project as the website |
| `app.chequetracker.com` | This app | This repository |

Self-hosted copies need none of this: they run the app alone, on any address.

## Why two sites

- The installed app's service worker answers every page on its own address, so a landing page there would never reach visitors once they've used the app.
- A static page loads fast and ranks better in search.
- Prices and other business material stay out of this public repository.
- Scripts on the website (analytics, say) can never read the app's sign-in tokens, which live on another origin.
- Each can be changed and deployed without the other.

## DNS

At the domain's registrar, point the three names at Vercel. Use the exact records Vercel shows when each domain is added to a project:

- the apex (`chequetracker.com`): an A record (or ALIAS);
- `www` and `app`: CNAME records.

## Vercel

**The app** (this repository):
- **Domain:** `app.chequetracker.com`.
- **Environment variables** (Production):
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the production Supabase project.
  - `VITE_SITE_URL=https://chequetracker.com`: "Back to website" on the sign-in pages, and the terms and privacy links on sign-up and the demo.
  - `VITE_COOKIE_DOMAIN=.chequetracker.com`: the signed-in flag (below).
  - `VITE_TURNSTILE_SITE_KEY`: the CAPTCHA ([editions.md](./editions.md), "Sign-up protection").
- **Headers:** `vercel.json` sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: DENY` with every page. Vercel adds `Strict-Transport-Security` itself.

**The website** (its own repository):
- **Domains:** `chequetracker.com`, with `www.chequetracker.com` redirecting to it.
- Its own `vercel.json` sets its headers.

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
- **Redirect URLs:** `https://app.chequetracker.com/**`. Add a Vercel preview pattern only if previews use this project, which they shouldn't.

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
- **Receiving:** `support@chequetracker.com`, on the apex, for the contact page and replies.

## The demo

The website's "Try the demo" links to `https://app.chequetracker.com/demo`. Turning the demo on is in [editions.md](./editions.md), "Turning on the demo".

## Order

1. **The website,** with its terms, privacy policy and refund policy. Razorpay's activation and Google's brand verification both look for them.
2. **The app on `app.`:** the domain and its environment variables.
3. **Supabase's URLs,** Google's origins and consent screen, and Turnstile's hostname.
4. **Email sending** from the subdomain.
5. **Payments:** see [payments.md](./payments.md).

## Next: a Content Security Policy

A CSP would also block any script the app doesn't expect. It has to allow:
- Supabase: `https://<ref>.supabase.co`, and `wss://` for live updates if they're ever used;
- Turnstile: `https://challenges.cloudflare.com`, for its script and frame;
- Razorpay Checkout: `https://checkout.razorpay.com` for the script, `https://api.razorpay.com` for its frame and calls.

Try it as `Content-Security-Policy-Report-Only` on a preview deployment first. Go through sign-up, the CAPTCHA and a test payment with the browser console open, and enforce it only once nothing is reported.
