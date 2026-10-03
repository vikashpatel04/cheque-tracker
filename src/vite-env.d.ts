/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Branding overrides. See src/config/brand.ts and TRADEMARKS.md. */
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_TAGLINE?: string
  readonly VITE_APP_LOGO?: string
  /** The website: "Back to website", and its /terms and /privacy on sign-up. */
  readonly VITE_SITE_URL?: string
  /** The parent domain the app and the website share, for the signed-in flag (src/lib/siteCookie.ts). */
  readonly VITE_COOKIE_DOMAIN?: string
  readonly VITE_SOURCE_URL?: string
  /** Cloudflare Turnstile site key: turns on the check on the sign-in pages. See docs/editions.md. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
