/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Branding overrides. See src/config/brand.ts and TRADEMARKS.md. */
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_TAGLINE?: string
  readonly VITE_APP_LOGO?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_SOURCE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
