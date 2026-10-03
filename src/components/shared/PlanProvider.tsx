import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PlanContext, type Plan } from '@/hooks/usePlan'
import { useSignOut } from '@/hooks/useSignOut'
import {
  DEMO_CANT_IMPORT,
  IMPORT_NEEDS_BUSINESS,
  lapsedWording,
  nextPlanChange,
  planAt,
  setLapsed,
  type PlanWording,
  type TrialRefusal,
} from '@/lib/plan'
import { supabase } from '@/lib/supabase'
import type { Entitlement } from '@/types'

/** The longest a browser timer can wait. A later change is picked up on the next look. */
const MAX_TIMER = 2 ** 31 - 1

interface Loaded {
  billingEnabled: boolean
  entitlements: Entitlement[]
  trialRefused: TrialRefusal | null
  /** An anonymous sign-in: the demo (plan item 86). */
  demo: boolean
}

async function loadPlan(): Promise<Loaded | null> {
  const [config, entitlements, refusal, session] = await Promise.all([
    supabase.from('instance_config').select('billing_enabled').maybeSingle(),
    supabase.from('entitlements').select('*'),
    supabase.from('trial_refusals').select('reason').maybeSingle(),
    supabase.auth.getSession(),
  ])
  const demo = !!session.data.session?.user.is_anonymous
  // A database without the editions migration behaves like a self-hosted one.
  const billingEnabled = !config.error && !!config.data?.billing_enabled
  // Unknown isn't read-only: the database still decides.
  if ((billingEnabled || demo) && entitlements.error) return null
  return {
    billingEnabled,
    entitlements: (entitlements.data ?? []) as Entitlement[],
    trialRefused: (refusal.data?.reason as TrialRefusal | undefined) ?? null,
    demo,
  }
}

/**
 * Loads the plan once for the app and keeps it current: it changes by itself
 * when a plan ends or a bought one starts (plan item 55). On the Free plan,
 * `guard` turns what the Free plan can't do (adding, editing beyond notes,
 * deleting) into a dialog that explains, and the Supabase client refuses new
 * rows (lib/plan.ts). Moving cheques along isn't guarded.
 * It sits above onboarding too (App.tsx), so the first steps know the plan.
 */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const leave = useSignOut()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // The dialog explaining why something waits for a pack, while it's open.
  const [asking, setAsking] = useState<PlanWording | null>(null)

  const refresh = useCallback(async () => {
    const next = await loadPlan()
    if (next) setLoaded(next)
    setNow(Date.now())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Look again when a plan ends or starts, and whenever the app comes back into view.
  useEffect(() => {
    if (!loaded) return
    const at = nextPlanChange(loaded.entitlements, now)
    const timer = at === null ? undefined : setTimeout(() => setNow(Date.now()), Math.min(at - now + 1000, MAX_TIMER))
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loaded, now])

  const state = useMemo(
    () => (loaded ? planAt(loaded.billingEnabled, loaded.entitlements, now, loaded.trialRefused, loaded.demo) : null),
    [loaded, now]
  )
  // A demo whose day is over is like the Free plan, whatever the edition.
  const lapsed = !!state && (state.billingEnabled || state.demo) && !state.hasAccess

  useEffect(() => {
    setLapsed(lapsed)
    return () => setLapsed(false)
  }, [lapsed])

  const requireWrite = useCallback(() => {
    if (lapsed && state) setAsking(lapsedWording(state))
    return !lapsed
  }, [lapsed, state])

  // Importing an export isn't part of the free trial (see docs/editions.md).
  const requirePaid = useCallback(() => {
    if (!requireWrite()) return false
    if (state?.demo) {
      setAsking(DEMO_CANT_IMPORT)
      return false
    }
    if (!state?.billingEnabled || state.paid) return true
    setAsking(IMPORT_NEEDS_BUSINESS)
    return false
  }, [requireWrite, state])

  const guard = useCallback<Plan['guard']>(
    (action) =>
      (...args) => {
        if (requireWrite()) void action(...args)
      },
    [requireWrite]
  )

  const plan = useMemo<Plan>(
    () => ({
      loading: !state,
      billingEnabled: state?.billingEnabled ?? false,
      hasAccess: state?.hasAccess ?? true,
      current: state?.current ?? null,
      ended: state?.ended ?? null,
      until: state?.until ?? null,
      paid: state?.paid ?? false,
      trialRefused: state?.trialRefused ?? null,
      demo: state?.demo ?? false,
      lapsed,
      guard,
      requireWrite,
      requirePaid,
      refresh,
    }),
    [state, lapsed, guard, requireWrite, requirePaid, refresh]
  )

  return (
    <PlanContext.Provider value={plan}>
      {children}
      <AlertDialog open={!!asking} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{asking?.title}</AlertDialogTitle>
            <AlertDialogDescription>{asking?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => (asking?.demo ? void leave('/signup') : navigate('/settings#plan'))}>
              {asking?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlanContext.Provider>
  )
}
