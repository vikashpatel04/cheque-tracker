import { parseISO } from 'date-fns'
import { formatDayMonth, formatMoney, formatMoneyShort, formatShortDate } from '@/lib/formatters'
import type { GivenDay, ReceivedWeek, WeekTotals } from '@/lib/today'

function ChartCard({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3.5 rounded-xl border bg-surface p-4 lg:px-[22px] lg:py-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-[17px] font-semibold lg:text-[19px]">
          {title}
        </h2>
        <span className="text-sm text-ink-quiet">{subtitle}</span>
      </div>
      {children}
    </section>
  )
}

const dayMonth = (date: string) => formatDayMonth(parseISO(date))

/** Next 30 days of given cheques: each day's bar, funded (ink) under not funded (amber). */
export function OutgoingChart({ days }: { days: GivenDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.funded + d.notFunded))
  const funded = days.reduce((s, d) => s + d.funded, 0)
  const notFunded = days.reduce((s, d) => s + d.notFunded, 0)
  const ticks = [0, 10, 20, days.length - 1]
  return (
    <ChartCard id="outgoing-chart" title="Next 30 days" subtitle="What goes out each day, and how much is funded">
      <div
        role="img"
        aria-label={`Next 30 days: ${formatMoney(funded + notFunded)} going out, ${formatMoney(notFunded)} not funded yet.`}
        className="flex h-[150px] items-end gap-[3px] border-b-2 border-line-strong pb-0.5"
      >
        {days.map((d) => {
          const height = (value: number) => `${Math.round((value / max) * 146)}px`
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${formatShortDate(d.date)}: ${formatMoney(d.funded + d.notFunded)}${d.notFunded ? `, ${formatMoney(d.notFunded)} not funded` : ''}`}
            >
              {d.notFunded > 0 && <div className="rounded-t-[3px] bg-attention-strong" style={{ height: height(d.notFunded) }} />}
              {d.funded > 0 && (
                <div className={d.notFunded ? 'bg-money-out' : 'rounded-t-[3px] bg-money-out'} style={{ height: height(d.funded) }} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-ink-quiet" aria-hidden="true">
        {ticks.map((i) => (
          <span key={i}>{dayMonth(days[i].date)}</span>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-sm">
        <span className="text-ink-quiet">30-day total</span>
        <span className="font-semibold tabular-nums">
          {formatMoney(funded + notFunded)}
          {notFunded > 0 && ` · ${formatMoney(notFunded)} not funded`}
        </span>
      </div>
    </ChartCard>
  )
}

/** Cheques in hand by the week they're due. */
export function IncomingChart({ weeks }: { weeks: ReceivedWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.in))
  return (
    <ChartCard id="incoming-chart" title="Coming in" subtitle="Cheques to deposit, by the week they're due">
      <div className="grid grid-cols-4 gap-3" role="img" aria-label={weeks.map((w) => `From ${dayMonth(w.start)}: ${formatMoney(w.in)}`).join('. ')}>
        {weeks.map((w) => (
          <div key={w.start} className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums text-money-in">{w.in ? formatMoneyShort(w.in) : '—'}</span>
            <div className="flex h-[140px] w-full items-end justify-center border-b-2 border-line-strong">
              <div className="w-[30px] rounded-t-md bg-money-in" style={{ height: `${Math.round((w.in / max) * 136)}px` }} />
            </div>
            <span className="text-xs text-ink-quiet lg:text-[13px]">
              <span className="max-lg:hidden">From </span>
              {dayMonth(w.start)}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

/** Money in above the line, money out below it, by week. */
export function InOutChart({ weeks }: { weeks: WeekTotals[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.in, w.out]))
  // Bars are a share of their half, so they fit the phone's shorter chart too.
  const bar = (value: number) => `${Math.round((value / max) * 96)}%`
  return (
    <ChartCard id="inout-chart" title="Money in and out" subtitle="By week, next 4 weeks">
      <div className="flex gap-4 text-[13px] text-ink-quiet">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-money-in" aria-hidden="true" />
          In
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-money-out" aria-hidden="true" />
          Out
        </span>
      </div>
      <div
        className="grid grid-cols-4 gap-2 lg:gap-3"
        role="img"
        aria-label={weeks.map((w) => `From ${dayMonth(w.start)}: ${formatMoney(w.in)} in, ${formatMoney(w.out)} out`).join('. ')}
      >
        {weeks.map((w) => (
          <div key={w.start} className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums text-money-in max-lg:hidden">{w.in ? formatMoneyShort(w.in) : '—'}</span>
            <div className="flex h-16 w-full flex-col items-center justify-end lg:h-[110px]">
              <div className="w-[22px] rounded-t-[5px] bg-money-in lg:w-[30px] lg:rounded-t-md" style={{ height: bar(w.in) }} />
            </div>
            <div className="h-0.5 w-full bg-line-strong" />
            <div className="flex h-16 w-full flex-col items-center lg:h-[110px]">
              <div className="w-[22px] rounded-b-[5px] bg-money-out lg:w-[30px] lg:rounded-b-md" style={{ height: bar(w.out) }} />
            </div>
            <span className="text-xs font-semibold tabular-nums max-lg:hidden">{w.out ? formatMoneyShort(w.out) : '—'}</span>
            <span className="text-xs text-ink-quiet lg:text-[13px]">
              <span className="max-lg:hidden">From </span>
              {dayMonth(w.start)}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
