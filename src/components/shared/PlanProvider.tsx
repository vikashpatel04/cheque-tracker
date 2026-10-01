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
import { nextPlanChange, planAt, readOnlyWording, setReadOnly } from '@/lib/plan'
import { supabase } from '@/lib/supabase'
import type { Entitlement } from '@/types'

/** The longest a browser timer can wait. A later change is picked up on the next look. */
const MAX_TIMER = 2 ** 31 - 1

interface Loaded {
  billingEnabled: boolean
  entitlements: Entitlement[]
}

async function loadPlan(): Promise<Loaded | null> {
  const [config, entitlements] = await Promise.all([
    supabase.from('instance_config').select('billing_enabled').maybeSingle(),
    supabase.from('entitlements').select('*'),
  ])
  // A database without the editions migration behaves like a self-hosted one.
  const billingEnabled = !config.error && !!config.data?.billing_enabled
  // Unknown isn't read-only: the database still decides.
  if (billingEnabled && entitlements.error) return null
  return { billingEnabled, entitlements: (entitlements.data ?? []) as Entitlement[] }
}

/**
 * Loads the plan once for the app and keeps it current: it changes by itself
 * when a plan ends or a bought one starts (plan item 55). On a read-only
 * account, `guard` turns anything that changes data into the "plan has
 * ended" dialog, and the Supabase client refuses changes (lib/plan.ts).
 */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [asking, setAsking] = useState(false)

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

  const state = useMemo(() => (loaded ? planAt(loaded.billingEnabled, loaded.entitlements, now) : null), [loaded, now])
  const readOnly = !!state && state.billingEnabled && !state.hasAccess

  useEffect(() => {
    setReadOnly(readOnly)
    return () => setReadOnly(false)
  }, [readOnly])

  const requireWrite = useCallback(() => {
    if (readOnly) setAsking(true)
    return !readOnly
  }, [readOnly])

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
      readOnly,
      guard,
      requireWrite,
      refresh,
    }),
    [state, readOnly, guard, requireWrite, refresh]
  )

  const wording = readOnlyWording(plan.ended)

  return (
    <PlanContext.Provider value={plan}>
      {children}
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{wording.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Your cheques are safe. You can still view, search and export everything. To add or change anything,{' '}
              {wording.action === 'Renew' ? 'renew your plan' : 'choose a pack'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/settings#plan')}>{wording.action}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlanContext.Provider>
  )
}
