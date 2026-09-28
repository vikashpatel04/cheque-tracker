import { format, parseISO } from 'date-fns'
import { formatDayMonth, formatMoney, formatMoneyShort, formatShortDate } from '@/lib/formatters'
import type { GivenDay, ReceivedDay } from '@/lib/today'
import { cn } from '@/lib/utils'

/** "Today · Sun 27" for the first card ("Today" on phones), "Mon 28" for the rest. */
function dayLabel(date: string, isToday: boolean) {
  const label = format(parseISO(date), 'EEE d')
  if (!isToday) return label
  return (
    <>
      Today<span className="max-lg:hidden"> · {label}</span>
    </>
  )
}

const plural = (n: number) => `${n} cheque${n === 1 ? '' : 's'}`

function DayCard({
  date,
  isToday,
  onClick,
  children,
}: {
  date: string
  isToday: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  const className = cn(
    'flex w-[104px] shrink-0 flex-col gap-1.5 rounded-xl bg-surface p-3 text-left lg:w-auto lg:p-3.5',
    isToday ? 'border-2 border-brand' : 'border',
    onClick && 'transition-colors hover:bg-hover'
  )
  const label = (
    <span className={cn('text-xs font-semibold lg:text-[13px]', isToday ? 'text-brand' : 'text-ink-quiet')}>
      {dayLabel(date, isToday)}
    </span>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={className} aria-label={`Cheques due ${formatShortDate(date)}`}>
      {label}
      {children}
    </button>
  ) : (
    <div className={className}>
      {label}
      {children}
    </div>
  )
}

/** A row of seven days that scrolls sideways on phones. */
function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-7 lg:gap-2.5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  )
}

/** Going out this week: what's due each day, and how much of it is funded. */
export function GivenWeekStrip({ days, onSelectDay }: { days: GivenDay[]; onSelectDay: (date: string) => void }) {
  return (
    <section aria-labelledby="given-strip" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="given-strip" className="text-[17px] font-semibold lg:text-[19px]">
          Going out this week
        </h2>
        <div className="flex gap-4 text-[13px] text-ink-quiet">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-money-out" aria-hidden="true" />
            Funded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-attention-strong" aria-hidden="true" />
            Not funded yet
          </span>
        </div>
      </div>
      <Strip>
        {days.map((day, i) => {
          const amount = day.funded + day.notFunded
          const fundedPct = amount ? Math.round((day.funded / amount) * 100) : 0
          return (
            <DayCard key={day.date} date={day.date} isToday={i === 0} onClick={() => onSelectDay(day.date)}>
              <span className={cn('text-base font-semibold tabular-nums lg:text-lg', !amount && 'text-ink-faint')}>
                {amount ? (
                  <>
                    <span className="lg:hidden">{formatMoneyShort(amount)}</span>
                    <span className="max-lg:hidden">{formatMoney(amount)}</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="text-xs text-ink-quiet max-lg:hidden lg:text-[13px]">
                {amount ? plural(day.count) : 'Nothing due'}
              </span>
              <span className="flex h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
                {amount > 0 && (
                  <>
                    <span className="bg-money-out" style={{ width: `${fundedPct}%` }} />
                    <span className="bg-attention-strong" style={{ width: `${100 - fundedPct}%` }} />
                  </>
                )}
              </span>
            </DayCard>
          )
        })}
      </Strip>
    </section>
  )
}

/** To deposit this week: cheques due each day, with overdue and soon-stale notes. */
export function ReceivedWeekStrip({ days }: { days: ReceivedDay[] }) {
  return (
    <section aria-labelledby="received-strip" className="flex flex-col gap-3">
      <h2 id="received-strip" className="text-[17px] font-semibold lg:text-[19px]">
        To deposit this week
      </h2>
      <Strip>
        {days.map((day, i) => (
          <DayCard key={day.date} date={day.date} isToday={i === 0}>
            <span className={cn('text-base font-semibold tabular-nums lg:text-lg', day.amount ? 'text-money-in' : 'text-ink-faint')}>
              {day.amount ? (
                <>
                  <span className="lg:hidden">{formatMoneyShort(day.amount)}</span>
                  <span className="max-lg:hidden">{formatMoney(day.amount)}</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="text-xs text-ink-quiet lg:text-[13px]">{day.amount ? plural(day.count) : 'Nothing due'}</span>
            {day.overdue > 0 && (
              <span className="self-start rounded-full bg-attention-soft px-2 py-0.5 text-xs font-medium text-attention">
                + {formatMoneyShort(day.overdue)} overdue
              </span>
            )}
            {day.staleOn && (
              <span className="self-start rounded-full bg-attention-soft px-2 py-0.5 text-xs font-medium text-attention">
                Stale on {formatDayMonth(parseISO(day.staleOn))}
              </span>
            )}
          </DayCard>
        ))}
      </Strip>
    </section>
  )
}
