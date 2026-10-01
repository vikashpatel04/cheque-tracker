import { createContext, useContext } from 'react'
import type { PlanState } from '@/lib/plan'

export { daysLeft } from '@/lib/plan'

export interface Plan extends PlanState {
  loading: boolean
  /** Billing is on and no plan is active: everything stays readable, nothing can change. */
  readOnly: boolean
  /**
   * Wraps something that changes data, such as opening a form or marking a
   * cheque. On a read-only account it explains why it can't, instead.
   */
  guard: <A extends unknown[]>(action: (...args: A) => unknown) => (...args: A) => void
  /** For code that can't be wrapped: whether changes are allowed. When not, it explains why. */
  requireWrite: () => boolean
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
  readOnly: false,
  guard:
    (action) =>
    (...args) =>
      void action(...args),
  requireWrite: () => true,
  refresh: async () => {},
}

/**
 * The signed-in user's plan, from PlanProvider (components/shared). See
 * docs/editions.md. The database enforces it; this decides what to show.
 */
export function usePlan(): Plan {
  return useContext(PlanContext) ?? NO_PROVIDER
}
