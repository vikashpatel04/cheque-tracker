import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlan } from '@/hooks/usePlan'
import { useSignOut } from '@/hooks/useSignOut'

/**
 * In the demo (plan item 86): what this is, and the way to a real account.
 * Creating one ends the demo first, so the made-up cheques never come along.
 */
export function DemoBar() {
  const plan = usePlan()
  const leave = useSignOut()
  if (!plan.demo) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-brand-soft px-4 py-2 text-sm text-ink lg:px-10">
      <FlaskConical className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {plan.hasAccess
          ? "You're in the demo. Changes are cleared when you sign out."
          : 'This demo has ended. A demo lasts a day.'}
      </span>
      <Button size="sm" onClick={() => void leave('/signup')}>
        Create an account
      </Button>
    </div>
  )
}
