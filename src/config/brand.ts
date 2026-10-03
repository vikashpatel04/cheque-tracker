/**
 * Product identity. Every value can be overridden at build time with a VITE_*
 * variable, so a self-hosted copy can run under its own name (see
 * TRADEMARKS.md). The same defaults are used for index.html and the web
 * manifest in vite.config.ts.
 */
const env = import.meta.env

export const brand = {
  name: env.VITE_APP_NAME || 'Cheque Tracker',
  tagline: env.VITE_APP_TAGLINE || 'Track every cheque. Never miss a date.',
  /**
   * The website, for "Back to website" and the terms and privacy links on
   * sign-up (plan item 87). Unset by default, so a self-hosted copy links to
   * no one else's terms.
   */
  siteUrl: env.VITE_SITE_URL?.replace(/\/+$/, '') || undefined,
  /** The logo image in the app. Replace public/logo.webp, or point this at another image in public/. */
  logoUrl: env.VITE_APP_LOGO || '/logo.webp',
  /**
   * Where users of this deployment can get its source code. Unset by default,
   * so no link is shown. The AGPL (section 13) requires offering the source to
   * everyone who uses a modified copy over a network, so a fork run for others
   * sets this to its own repository.
   */
  sourceUrl: env.VITE_SOURCE_URL || undefined,
}

/** The name as a file-name-friendly slug, e.g. "cheque_tracker". */
export function brandSlug(): string {
  return brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'export'
}
