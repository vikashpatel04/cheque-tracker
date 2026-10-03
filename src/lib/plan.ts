import type { Entitlement } from '@/types'

/**
 * Plans on instances with billing on (see docs/editions.md). The database
 * decides who may change data (has_write_access); the app only reflects it.
 */

/** Why an account got no free trial at sign-up (migration 021). */
export type TrialRefusal = 'used' | 'throwaway' | 'no_email'

export interface PlanState {
  /** Off on self-hosted instances: every feature is free and there are no plans. */
  billingEnabled: boolean
  /** Whether the user can add and change data. Always true when billing is off. */
  hasAccess: boolean
  /** The active plan that lasts longest, if any. */
  current: Entitlement | null
  /** With no active plan, the one that ended last, if any. */
  ended: Entitlement | null
  /**
   * When access ends, counting packs that start as the earlier ones end. Null
   * without access, or with a plan that never ends.
   */
  until: string | null
  /**
   * Has a bought pack, or a grant from the operator, that hasn't ended. Free
   * trials don't count. Importing an export needs it.
   */
  paid: boolean
  /** Why there was no free trial at sign-up, if there wasn't one. */
  trialRefused: TrialRefusal | null
  /**
   * A demo (an anonymous sign-in, migration 023): its one-day grant is its
   * only access, whatever the edition, and it can't buy or import.
   */
  demo: boolean
}

function isActive(e: Entitlement, now: number): boolean {
  return Date.parse(e.starts_at) <= now && (!e.expires_at || Date.parse(e.expires_at) > now)
}

/** Plans that never end first, then the one that runs longest. */
function lastsLonger(a: Entitlement, b: Entitlement): number {
  if (!a.expires_at) return -1
  if (!b.expires_at) return 1
  return Date.parse(b.expires_at) - Date.parse(a.expires_at)
}

/** When access that's active now ends, following plans that start by then. */
function accessEnds(current: Entitlement, entitlements: Entitlement[]): string | null {
  if (!current.expires_at) return null
  let end = Date.parse(current.expires_at)
  for (;;) {
    const next = entitlements.filter((e) => Date.parse(e.starts_at) <= end && (!e.expires_at || Date.parse(e.expires_at) > end))
    if (next.some((e) => !e.expires_at)) return null
    if (!next.length) return new Date(end).toISOString()
    end = Math.max(...next.map((e) => Date.parse(e.expires_at!)))
  }
}

/**
 * The plan at a moment, from the user's entitlements. A demo's day counts
 * only for the demo itself, as in the database (has_write_access).
 */
export function planAt(
  billingEnabled: boolean,
  entitlements: Entitlement[],
  now: number,
  trialRefused: TrialRefusal | null = null,
  demo = false
): PlanState {
  const grants = entitlements.filter((e) => (e.source === 'demo') === demo)
  const current = grants.filter((e) => isActive(e, now)).sort(lastsLonger)[0] ?? null
  const ended = current
    ? null
    : (grants
        .filter((e) => e.expires_at && Date.parse(e.expires_at) <= now)
        .sort((a, b) => Date.parse(b.expires_at!) - Date.parse(a.expires_at!))[0] ?? null)
  const until = current ? accessEnds(current, grants) : null
  const paid = grants.some((e) => (e.source === 'purchase' || e.source === 'comp') && (!e.expires_at || Date.parse(e.expires_at) > now))
  const hasAccess = demo ? !!current : !billingEnabled || !!current
  return { billingEnabled, hasAccess, current, ended, until, paid, trialRefused, demo }
}

/**
 * When the plan next changes by itself: a plan ending, or a bought one
 * starting after the current one. Null when nothing is due to change.
 */
export function nextPlanChange(entitlements: Entitlement[], now: number): number | null {
  const moments = entitlements
    .flatMap((e) => [Date.parse(e.starts_at), e.expires_at ? Date.parse(e.expires_at) : NaN])
    .filter((t) => t > now)
  return moments.length ? Math.min(...moments) : null
}

/** Whole days until a plan ends (at least 0). */
export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 86_400_000))
}

export interface PlanWording {
  title: string
  /** A sentence or two after the title, for dialogs and Settings. */
  text: string
  /** One short line for the banner. */
  banner: string
  /** The button that leads to the Business plan. */
  action: string
  /** In the demo, the button leaves it to create an account instead. */
  demo?: boolean
}

/** What the Free plan still allows, said once. */
const ON_FREE =
  "You're on the Free plan: you can still move your cheques along, undo, add funds, edit notes and export. Upgrade to Business to add or change anything else."
const ON_FREE_SHORT = 'You can still move your cheques along and export them.'

/**
 * How to explain the Free plan (after a trial or plan ends, plan item 55), and
 * the button that leads to Business.
 */
export function lapsedWording({
  ended,
  trialRefused,
  demo,
}: Pick<PlanState, 'ended' | 'trialRefused'> & { demo?: boolean }): PlanWording {
  if (demo) {
    return {
      title: 'This demo has ended',
      text: 'A demo lasts a day. Create an account to keep track of your own cheques.',
      banner: 'Create an account to keep going.',
      action: 'Create an account',
      demo: true,
    }
  }
  if (ended?.source === 'trial') {
    return { title: 'Your free trial has ended', text: ON_FREE, banner: ON_FREE_SHORT, action: 'Upgrade to Business' }
  }
  if (ended) return { title: 'Your Business plan has ended', text: ON_FREE, banner: ON_FREE_SHORT, action: 'Renew Business' }
  if (trialRefused === 'used') {
    return {
      title: 'Free trial already used',
      text: 'This email address has had a free trial before, and trials are one per person. Choose Business to start adding cheques.',
      banner: 'Trials are one per email address. Choose Business to start adding cheques.',
      action: 'Choose Business',
    }
  }
  if (trialRefused === 'throwaway') {
    return {
      title: 'Free trials need your usual email',
      text: 'This address is at a throwaway-mail service. Choose Business to start, or sign up with your usual email or with Google.',
      banner: 'This address is at a throwaway-mail service.',
      action: 'Choose Business',
    }
  }
  return { title: "You're on the Free plan", text: ON_FREE, banner: ON_FREE_SHORT, action: 'Upgrade to Business' }
}

/** Why importing an export waits for Business (it isn't part of the free trial). */
export const IMPORT_NEEDS_BUSINESS: PlanWording = {
  title: 'Importing an export comes with Business',
  text: 'During the free trial, add cheques one at a time, as a series, or from the Excel template.',
  banner: 'Importing an export comes with Business.',
  action: 'Choose Business',
}

/** Why the demo has no import: its data is made up, and it's deleted within a day. */
export const DEMO_CANT_IMPORT: PlanWording = {
  title: "The demo can't import",
  text: 'Create an account to bring in an export of your own cheques.',
  banner: "The demo can't import.",
  action: 'Create an account',
  demo: true,
}

/*
 * Whether the signed-in account is on the Free plan after a trial or plan
 * ended (plan item 55). PlanProvider keeps this current, and the Supabase
 * client reads it to refuse new rows before sending them. The database
 * refuses them too (migration 019); this saves the trip, and makes sure no
 * save quietly changes nothing.
 */

/** The same words the database uses when it refuses a change. */
export const FREE_PLAN_MESSAGE = "You're on the Free plan. Upgrade to Business to make changes."

let lapsed = false

export function setLapsed(value: boolean) {
  lapsed = value
}

export function isLapsed(): boolean {
  return lapsed
}

/**
 * Whether a request to Supabase is one the Free plan can't make, so it can be
 * answered without sending it:
 * - adding rows to any table but settings;
 * - changing parties, bank accounts or funds added (row-level security would
 *   quietly change nothing).
 *
 * Changes to cheques and the status functions go through: the database allows
 * what the Free plan may do and explains the rest. Sign-in and server
 * functions (such as paying) are never held back.
 */
export function needsPlan(url: string, method: string): boolean {
  if (method !== 'POST' && method !== 'PATCH') return false
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  const table = path.match(/\/rest\/v1\/([^/]+)$/)?.[1]
  if (!table || table === 'rpc' || table === 'settings') return false
  if (method === 'POST') return true
  return ['parties', 'bank_accounts', 'daily_deposits'].includes(table)
}
