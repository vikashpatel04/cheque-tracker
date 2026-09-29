import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { TopicAnswer } from '@/components/guide/GuideTopics'
import { guideTopic, type GuideTopicId } from '@/lib/guide'

/** One answer from the guide, beside whatever page you're on. Opened by `HelpLink`. */
export function HelpSheet({ topic, onClose }: { topic: GuideTopicId | null; onClose: () => void }) {
  const location = useLocation()
  const where = location.pathname + location.hash
  // Where it was opened; following a link inside the answer (to Settings, or the whole guide) closes it.
  const openedAt = useRef<string | null>(null)
  useEffect(() => {
    if (!topic) {
      openedAt.current = null
      return
    }
    if (openedAt.current === null) openedAt.current = where
    else if (openedAt.current !== where) onClose()
  }, [topic, where, onClose])

  const current = topic ? guideTopic(topic) : null
  return (
    <Sheet open={!!topic} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px] [&>button:last-child]:hidden">
        <div className="sticky top-0 z-10 flex min-h-[60px] shrink-0 items-center gap-1 border-b bg-background/95 px-2 py-2 backdrop-blur">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
          <SheetTitle className="text-lg font-semibold leading-6">{current?.question}</SheetTitle>
          <SheetDescription className="sr-only">An answer from the guide to how cheques work.</SheetDescription>
        </div>
        {topic && (
          <div className="flex flex-col gap-4 px-4 py-5">
            <TopicAnswer id={topic} />
            <Link
              to={`/learn#${topic}`}
              className="mt-2 inline-flex items-center gap-2 self-start text-sm font-semibold text-brand hover:underline"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              See the whole guide
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
