import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { TopicAnswer } from '@/components/guide/GuideTopics'
import { PageHeader } from '@/components/shared/PageHeader'
import { goToSection, useCurrentSection } from '@/hooks/useCurrentSection'
import { GUIDE_SECTIONS, GUIDE_TOPICS } from '@/lib/guide'
import { cn } from '@/lib/utils'

/**
 * "Learn how cheques work" (plan item 75): both life cycles and answers to
 * common questions, in the Settings layout (the topics beside them on desktop,
 * above them on phones). Each answer has an address, e.g. /learn#add-funds,
 * and the questions elsewhere in the app open the same answers.
 */
export default function Learn() {
  const location = useLocation()
  const ids = useMemo(() => GUIDE_TOPICS.map((t) => t.id), [])
  const current = useCurrentSection(ids)

  // Arriving at /learn#… goes to that answer.
  useEffect(() => {
    const id = location.hash.slice(1)
    if (!id) return
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [location.hash])

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    goToSection(id)
  }

  const topics = (
    <>
      {GUIDE_SECTIONS.map((section) => (
        <div key={section} className="flex flex-col gap-0.5">
          <span className="pb-1 text-xs font-bold uppercase tracking-[0.07em] text-ink-quiet lg:px-3">{section}</span>
          {GUIDE_TOPICS.filter((t) => t.section === section).map((t) => {
            const active = t.id === current
            return (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={go(t.id)}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'flex min-h-9 items-center rounded-lg text-[15px] transition-colors lg:px-3',
                  active ? 'font-semibold text-brand lg:bg-brand-soft' : 'text-ink-nav hover:text-ink lg:hover:bg-hover'
                )}
              >
                {t.short}
              </a>
            )
          })}
        </div>
      ))}
    </>
  )

  return (
    <div>
      <PageHeader title="How cheques work" />
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-[92px]">
          {/* Phones: folded, so the answers start on the first screen. Desktop: always there, beside them. */}
          <details className="group mb-5 rounded-xl border bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              Jump to a question
              <ChevronDown className="h-4 w-4 text-ink-quiet transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <nav aria-label="Topics" className="flex flex-col gap-3 px-4 pb-4">
              {topics}
            </nav>
          </details>
          <nav aria-label="Topics" className="hidden flex-col gap-3 lg:flex">
            {topics}
          </nav>
        </div>

        <div className="flex max-w-[820px] min-w-0 flex-col gap-4">
          <p className="text-[15px] leading-6 text-ink-quiet">
            How a cheque moves from written or received to paid, both ways, and answers to questions people often have. Wherever you see a
            question with a <span className="font-semibold text-brand">?</span> in the app, it opens one of these answers.
          </p>
          {GUIDE_SECTIONS.map((section) => (
            <div key={section} className="flex flex-col gap-4">
              <h2 className="pt-2 font-title text-2xl">{section}</h2>
              {GUIDE_TOPICS.filter((t) => t.section === section).map((t) => (
                <section
                  key={t.id}
                  id={t.id}
                  aria-labelledby={`${t.id}-title`}
                  className="flex scroll-mt-4 flex-col gap-4 rounded-xl border bg-surface p-4 sm:p-[22px] lg:scroll-mt-[92px]"
                >
                  <h3 id={`${t.id}-title`} className="text-lg font-semibold">
                    {t.question}
                  </h3>
                  <TopicAnswer id={t.id} />
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
