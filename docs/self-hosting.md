# Self-hosting Cheque Tracker

Self-hosting is free, with every feature. You need:

- Node.js 20 or newer
- A [Supabase](https://supabase.com) project (the free tier is enough)
- Somewhere to host a static site, such as [Vercel](https://vercel.com)

If you'd rather not run anything yourself, use the hosted version at [chequetracker.com](https://chequetracker.com).

## 1. Get the code

```bash
git clone https://github.com/vikashpatel04/cheque-tracker.git
cd cheque-tracker
npm install
cp .env.example .env.local
```

## 2. Configure

Edit `.env.local`:

| Variable | Required | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase → Settings → API → publishable (or legacy anon) key |
| `VITE_APP_NAME` | No | The name shown in the app, page title and web manifest |
| `VITE_APP_TAGLINE` | No | One line shown in the page description and manifest |
| `VITE_APP_LOGO` | No | An image shown instead of the built-in logo, e.g. `/icons/my-logo.svg` (put it in `public/`) |
| `VITE_SITE_URL` | No | Your site's address |
| `VITE_SOURCE_URL` | If you change the code | Where your users can get your version's source code (see [below](#if-you-change-the-code)) |

Only put public values in `VITE_*` variables. They're bundled into the browser code.

## 3. Set up the database

Apply the migrations in `supabase/migrations/` in order, from `001` to the latest:

- **CLI:** `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push`
- **Dashboard:** paste each file into the SQL Editor and run it

They create the tables, row-level security, SQL functions and the single `instance_config` row, and grant table privileges explicitly. You can therefore turn off **Automatically expose new tables** when you create the project, as Supabase recommends, and turn on **Enable automatic RLS**. Leave `instance_config.billing_enabled` set to `false`; that's what makes an instance self-hosted. See [editions.md](./editions.md).

## 4. Create your login

Self-hosted copies have no sign-up page. Add a user under Supabase → **Authentication → Users**, then sign in with that email and password.

On a hosted Supabase project, also turn off **Allow new users to sign up** (Authentication → Sign In / Providers). Otherwise anyone with your public key could create an account through the API.

## 5. First sign-in

You'll be asked which country you use cheques in. That sets your currency, number and date formats, time zone and how long cheques stay valid. Change any of them later in **Settings → Region**. See [regions.md](./regions.md).

## 6. Auto-pass (optional)

You only need this if you turn on **Auto-pass funded cheques** in Settings. The app also runs auto-pass when you open it, so this is only for passing cheques when nobody has the app open.

1. Deploy the function:
   ```bash
   npx supabase functions deploy auto-pass --project-ref <your-project-ref>
   ```
2. Optional: set a fallback time zone for users who haven't picked a region yet (UTC otherwise):
   ```bash
   npx supabase secrets set DEFAULT_TIME_ZONE=Asia/Kolkata --project-ref <your-project-ref>
   ```
3. Schedule it in the SQL Editor, replacing the two placeholders:
   ```sql
   select cron.schedule(
     'auto-pass-cheques',
     '*/15 * * * *',
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/auto-pass',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <your-publishable-or-anon-key>'
       ),
       body := jsonb_build_object('scheduled', true)
     );
     $$
   );
   ```

The job runs every 15 minutes and checks each user's auto-pass time in that user's own time zone. To stop it, run `select cron.unschedule('auto-pass-cheques');`.

## 7. Deploy

On Vercel:
1. Import the repository.
2. Add the variables from step 2.
3. Deploy.

Vercel detects Vite, and `vercel.json` handles client-side routing and cache headers. Any static host works if it:

- serves `index.html` for unknown paths, and
- serves `sw.js` and `index.html` with `Cache-Control: no-cache`, so installed apps find new versions. Files in `assets/` never change and can be cached for a year.

The app installs on phones and computers (it's a PWA) and starts without a connection once it has been opened. Each build makes its own `sw.js` from `pwa/service-worker.js`; the dev server has none.

## Upgrading

Apply any new migration files in order, then deploy the new version. Migrations are additive, so existing data is kept. Follow the release tags if you want stable versions.

### From Cheque Tracker v0

Your database already has migrations `001` to `009`.

1. Apply `010_region_settings.sql` and `011_editions.sql`.
2. Deploy this version. On your next sign-in, pick your country. Your cheques, parties and history are untouched.
3. If you use scheduled auto-pass, redeploy the `auto-pass` function. Until you've signed in once, it uses `DEFAULT_TIME_ZONE`.

Two things look different:
- **Funded:** the *Deposited* status now shows as *Funded*. The stored value is unchanged, so cheque-mcp and Cheque Watch keep working.
- **History notes:** notes written by the database now use ISO dates (`2026-09-20`), which the app shows in your date format.

## If you change the code

The AGPL-3.0 requires you to offer your users the source code of the version you run, if you let others use it over a network:
- Publish your changes, for example as a public fork.
- Set `VITE_SOURCE_URL` to that repository. The app then links to it from the sidebar and the sign-in page; without it, no link is shown.
- If you offer your copy to others, use your own name and logo; see [TRADEMARKS.md](../TRADEMARKS.md).

## Development

```bash
npm run dev       # dev server (also on your LAN)
npm run lint
npm test          # formatter tests, plus every migration applied with RLS checks
npm run build     # type-check and production build
```

Use a separate Supabase project for development, or run one locally with `npx supabase start` (needs Docker). Never develop against a database with real data.
