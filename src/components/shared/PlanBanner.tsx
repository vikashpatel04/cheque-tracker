import { AlertTriangle, Clock } from 'lucide-react'
import { daysLeft, usePlan } from '@/hooks/usePlan'

/** How many days before a trial ends to start reminding the user. */
const TRIAL_REMINDER_DAYS = 3

/**
 * Plan notices on instances with billing on. Renders nothing on self-hosted
 * instances.
 */
export function PlanBanner() {
  const plan = usePlan()
  if (plan.loading || !plan.billingEnabled) return null

  if (!plan.hasAccess) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 border-b bg-attention-soft px-4 py-2 text-sm text-attention lg:px-10"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Your plan has ended. Your cheques are safe and you can still view and export them. Renew to add or
        change anything.
      </div>
    )
  }

  const { current } = plan
  if (current?.source === 'trial' && current.expires_at) {
    const days = daysLeft(current.expires_at)
    if (days <= TRIAL_REMINDER_DAYS) {
      return (
        <div
          role="status"
          className="flex items-center gap-2 border-b bg-waiting-soft px-4 py-2 text-sm text-waiting lg:px-10"
        >
          <Clock className="h-4 w-4 shrink-0" />
          {days === 0 ? 'Your free trial ends today.' : `Your free trial ends in ${days} day${days === 1 ? '' : 's'}.`}
        </div>
      )
    }
  }

  return null
}
