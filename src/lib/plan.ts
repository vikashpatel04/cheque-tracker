import type { Entitlement } from '@/types'

/**
 * Plans on instances with billing on (see docs/editions.md). The database
 * decides who may change data (has_write_access); the app only reflects it.
 */

export interface PlanState {
  /** Off on self-hosted instances: every feature is free and there are no plans. */
  billingEnabled: boolean
  /** Whether the user can add and change data. Always true when billing is off. */
  hasAccess: boolean
  /** The active plan that lasts longest, if any. */
  current: Entitlement | null
  /** With no active plan, the one that ended last, if any. */
  ended: Entitlement | null
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

/** The plan at a moment, from the user's entitlements. */
export function planAt(billingEnabled: boolean, entitlements: Entitlement[], now: number): PlanState {
  const current = entitlements.filter((e) => isActive(e, now)).sort(lastsLonger)[0] ?? null
  const ended = current
    ? null
    : (entitlements
        .filter((e) => e.expires_at && Date.parse(e.expires_at) <= now)
        .sort((a, b) => Date.parse(b.expires_at!) - Date.parse(a.expires_at!))[0] ?? null)
  return { billingEnabled, hasAccess: !billingEnabled || !!current, current, ended }
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

/** What to call a read-only account, and the button that ends it. */
export function readOnlyWording(ended: Entitlement | null): { title: string; action: string } {
  if (!ended) return { title: 'No active plan', action: 'Choose a pack' }
  if (ended.source === 'trial') return { title: 'Your free trial has ended', action: 'Choose a pack' }
  return { title: 'Your plan has ended', action: 'Renew' }
}

/*
 * Whether the signed-in account is read-only (plan item 55): billing is on and
 * no plan is active. PlanProvider keeps this current, and the Supabase client
 * reads it to refuse changes before sending them. The database refuses them
 * too; this saves the trip, and makes sure no save quietly does nothing.
 */

/** The same words the database uses when it refuses a change. */
export const PLAN_ENDED_MESSAGE = 'Your plan has ended. Renew it to make changes.'

let readOnly = false

export function setReadOnly(value: boolean) {
  readOnly = value
}

export function isReadOnly(): boolean {
  return readOnly
}

/**
 * Whether a request to Supabase changes data that needs a plan: anything but a
 * read sent to the database API. Your settings stay yours to change, and
 * sign-in and server functions (such as paying) aren't affected.
 */
export function needsPlan(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return false
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  const match = path.match(/\/rest\/v1\/(.+)$/)
  return !!match && match[1] !== 'settings'
}
