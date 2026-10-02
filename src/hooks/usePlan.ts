import { createContext, useContext } from 'react'
import type { PlanState } from '@/lib/plan'

export { daysLeft } from '@/lib/plan'

export interface Plan extends PlanState {
  loading: boolean
  /**
   * On the Free plan, after a trial or plan ended (billing on, nothing
   * active): cheques can still move along and their notes change, but nothing
   * can be added, edited or deleted.
   */
  lapsed: boolean
  /**
   * Wraps something the Free plan can't do, such as adding a cheque, editing
   * one or deleting. On the Free plan it explains why, instead.
   */
  guard: <A extends unknown[]>(action: (...args: A) => unknown) => (...args: A) => void
  /** For code that can't be wrapped: whether changes are allowed. When not, it explains why. */
  requireWrite: () => boolean
  /**
   * Whether something that isn't part of the free trial (importing an export)
   * is allowed. When not, it explains why.
   */
  requirePaid: () => boolean
  /** Loads the plan again, e.g. after paying. */
  refresh: () => Promise<void>
}

export const PlanContext = createContext<Plan | null>(null)

/** Outside PlanProvider (e.g. onboarding): nothing is shown and nothing is held back. */
const NO_PROVIDER: Plan = {
  loading: true,
  billingEnabled: false,
  hasAccess: true,
  current: null,
  ended: null,
  until: null,
  paid: false,
  trialRefused: null,
  lapsed: false,
  guard:
    (action) =>
    (...args) =>
      void action(...args),
  requireWrite: () => true,
  requirePaid: () => true,
  refresh: async () => {},
}

/**
 * The signed-in user's plan, from PlanProvider (components/shared). See
 * docs/editions.md. The database enforces it; this decides what to show.
 */
export function usePlan(): Plan {
  return useContext(PlanContext) ?? NO_PROVIDER
}
