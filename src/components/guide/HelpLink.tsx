import { CircleHelp } from 'lucide-react'
import { useAppActions } from '@/hooks/useAppActions'
import { guideTopic, type GuideTopicId } from '@/lib/guide'
import { cn } from '@/lib/utils'

/**
 * A question where something might confuse, e.g. "What is a security
 * cheque?". It opens the answer from the guide beside the page, so a form in
 * progress isn't lost.
 */
export function HelpLink({ topic, children, className }: { topic: GuideTopicId; children?: React.ReactNode; className?: string }) {
  const { openHelp } = useAppActions()
  return (
    <button
      type="button"
      onClick={() => openHelp(topic)}
      className={cn('inline-flex items-center gap-1.5 text-left text-sm font-medium text-brand hover:underline', className)}
    >
      <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
      {children ?? guideTopic(topic).question}
    </button>
  )
}
