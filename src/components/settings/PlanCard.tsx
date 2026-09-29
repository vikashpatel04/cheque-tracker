import { SettingsSection } from '@/components/settings/SettingsSection'
import { usePlan } from '@/hooks/usePlan'
import { formatDate } from '@/lib/formatters'
import type { Entitlement } from '@/types'

function describe(current: Entitlement): string {
  if (!current.expires_at) return 'Active, with no end date.'
  const until = formatDate(current.expires_at)
  return current.source === 'trial'
    ? `Free trial, ends ${until}. After that, everything stays readable and you can still export.`
    : `Active until ${until}.`
}

/** Settings → Plan, on instances with billing on. Hidden on self-hosted instances. */
export function PlanCard() {
  const plan = usePlan()
  if (plan.loading || !plan.billingEnabled) return null

  return (
    <SettingsSection
      id="plan"
      title="Plan"
      description={
        plan.current
          ? describe(plan.current)
          : 'No active plan. Your account is read-only: everything stays visible and can be exported.'
      }
    >
      {plan.current?.note && <p className="text-sm text-ink-quiet">{plan.current.note}</p>}
    </SettingsSection>
  )
}
