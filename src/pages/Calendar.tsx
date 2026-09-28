import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addMonths, format, parseISO } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Landmark, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RowStatus } from '@/components/cheques/RowChips'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAppActions } from '@/hooks/useAppActions'
import { useChequeListData } from '@/hooks/useChequeListData'
import { useSettings } from '@/hooks/useSettings'
import { dayCell, monthCells, type DayCell } from '@/lib/calendar'
import { inTab, type DirectionTab, type ListRow } from '@/lib/chequeList'
import { currencySymbol, formatLongDate, formatMoney, formatMoneyShort, formatShortDate, formatSigned, todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { cn } from '@/lib/utils'

const TABS: DirectionTab[] = ['all', 'given', 'received']
const TAB_LABELS: Record<DirectionTab, string> = { all: 'All', given: 'Given', received: 'Received' }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Segmented<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('grid h-11 gap-1 rounded-xl bg-track p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-[9px] px-2 text-sm font-semibold', value === o.value ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A day's cheques, each opening its detail. */
function DayRows({ rows, onOpen }: { rows: ListRow[]; onOpen: (row: ListRow) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onOpen(row)}
          className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-xl border bg-surface p-3 text-left transition-colors hover:bg-hover"
        >
          <span
            aria-label={row.direction === 'in' ? 'Received' : 'Given'}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full', row.direction === 'in' ? 'bg-money-in-soft text-money-in' : 'bg-money-out-soft text-money-out')}
          >
            {row.direction === 'in' ? <ArrowDownLeft className="h-4 w-4" strokeWidth={2.4} /> : <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[15px] font-semibold">{row.party}</span>
            <span className="font-cheque text-[13px] text-ink-quiet">{row.number}</span>
            <span>
              <RowStatus row={row} />
            </span>
          </span>
          <span className={cn('text-[15px] font-semibold tabular-nums', row.direction === 'in' ? 'text-money-in' : 'text-money-out')}>
            {row.amount === null ? '' : formatSigned(row.amount, row.direction)}
          </span>
        </button>
      ))}
    </div>
  )
}

function totalsLine(cell: DayCell) {
  if (!cell.count) return 'Nothing due'
  return [cell.in ? `${formatSigned(cell.in, 'in')} in` : null, cell.out ? `${formatMoney(cell.out)} out` : null].filter(Boolean).join(' · ')
}

/** Calendar (design screens Calendar-desktop and Calendar-phone): the month, and the chosen day's cheques. */
export default function CalendarPage() {
  const { settings } = useSettings()
  const app = useAppActions()
  const { rows, loading } = useChequeListData()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const { weekStartsOn } = getActiveRegion()

  const tracks = settings.tracks ?? 'both'
  const defaultTab: DirectionTab = tracks === 'both' ? 'all' : tracks
  const askedTab = params.get('dir') as DirectionTab | null
  const dir = askedTab && TABS.includes(askedTab) ? askedTab : defaultTab
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? `${params.get('month')}-01` : `${selected.slice(0, 7)}-01`
  const view = params.get('view') === 'agenda' ? 'agenda' : 'month'

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const goMonth = (offset: number) => set({ month: format(addMonths(parseISO(month), offset), 'yyyy-MM') })

  const visible = useMemo(() => rows.filter((r) => inTab(r, dir)), [rows, dir])
  const cells = useMemo(() => monthCells(month, weekStartsOn, visible, today), [month, weekStartsOn, visible, today])
  const dayRows = visible.filter((r) => r.due === selected)
  const day = dayCell(selected, visible, today)
  const weekdays = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStartsOn + i) % 7])
  const monthRows = visible
    .filter((r) => r.due.slice(0, 7) === month.slice(0, 7))
    .sort((a, b) => a.due.localeCompare(b.due))
  const agendaDays = [...new Set(monthRows.map((r) => r.due))]

  const open = (row: ListRow) => (row.given ? app.openCheque(row.id) : app.openReceivedCheque(row.id))
  const needsFunds = dayRows.some((r) => r.status === 'PENDING')
  const toDeposit = dayRows.filter((r) => r.received?.status === 'IN_HAND' && r.received.kind === 'REGULAR')

  const dayPanel = (
    <section aria-labelledby="calendar-day" className="flex flex-col gap-3.5 rounded-xl border bg-surface p-4 lg:p-[18px]">
      <div className="flex flex-col gap-1">
        <h2 id="calendar-day" className="text-[19px] font-semibold">
          {formatLongDate(selected)}
        </h2>
        <span className="text-sm tabular-nums text-ink-quiet">{totalsLine(day)}</span>
      </div>
      {dayRows.length > 0 && <DayRows rows={dayRows} onOpen={open} />}
      {(needsFunds || toDeposit.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {needsFunds && (
            <Button variant="outline" onClick={() => app.addFunds()}>
              <Wallet />
              Add funds
            </Button>
          )}
          {toDeposit.length > 0 && (
            <Button variant="outline" onClick={() => app.depositReceived(toDeposit.map((r) => r.id))}>
              <Landmark />
              Deposit
            </Button>
          )}
        </div>
      )}
    </section>
  )

  return (
    <div>
      <PageHeader
        title={format(parseISO(month), 'MMMM yyyy')}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goMonth(1)}>
              <ChevronRight />
            </Button>
            <Button variant="outline" onClick={() => set({ month: null, date: null })}>
              Today
            </Button>
            <Segmented
              label="Calendar view"
              value={view}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'agenda', label: 'Agenda' },
              ]}
              onChange={(v) => set({ view: v === 'month' ? null : v })}
              className="w-[180px]"
            />
            <Segmented
              label="Show cheques"
              value={dir}
              options={TABS.map((t) => ({ value: t, label: TAB_LABELS[t] }))}
              onChange={(v) => set({ dir: v === defaultTab ? null : v })}
              className="w-full sm:w-[270px]"
            />
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-[520px] rounded-xl" />
      ) : view === 'agenda' ? (
        <div className="flex max-w-[760px] flex-col gap-4">
          {agendaDays.length === 0 && <p className="rounded-xl border bg-surface p-5 text-ink-quiet">No cheques due this month.</p>}
          {agendaDays.map((date) => {
            const cell = dayCell(date, visible, today)
            return (
              <section key={date} className="flex flex-col gap-2" aria-label={formatShortDate(date)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn('text-[13px] font-bold uppercase tracking-[0.06em]', date === today ? 'text-attention' : 'text-ink-quiet')}>
                    {date === today ? `Today · ${formatShortDate(date)}` : formatShortDate(date)}
                  </span>
                  <span className="text-[13px] tabular-nums text-ink-quiet">{totalsLine(cell)}</span>
                </div>
                <DayRows rows={monthRows.filter((r) => r.due === date)} onOpen={open} />
              </section>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
          <section aria-label={format(parseISO(month), 'MMMM yyyy')} className="overflow-hidden rounded-xl border bg-surface">
            <div className="grid grid-cols-7 border-b bg-sidebar">
              {weekdays.map((w) => (
                <span key={w} className="px-1 py-2 text-center text-xs font-semibold text-ink-quiet lg:px-3 lg:py-2.5 lg:text-left lg:text-[13px]">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const isToday = cell.date === today
                const isSelected = cell.date === selected
                const muted = cell.done || !cell.inMonth
                return (
                  <button
                    key={cell.date}
                    type="button"
                    aria-label={`${formatShortDate(cell.date)}: ${totalsLine(cell)}`}
                    aria-pressed={isSelected}
                    onClick={() => set({ date: cell.date, month: cell.inMonth ? params.get('month') : cell.date.slice(0, 7) })}
                    className={cn(
                      'flex h-14 flex-col items-center gap-1 border-b border-r border-line-soft p-1 text-left transition-colors lg:h-[118px] lg:items-stretch lg:gap-[3px] lg:px-2.5 lg:py-2',
                      !cell.inMonth ? 'bg-sidebar' : isSelected ? 'bg-brand-soft/60' : 'bg-surface hover:bg-hover/60',
                      isToday && 'shadow-[inset_0_0_0_2px_var(--brand)]',
                      isSelected && !isToday && 'shadow-[inset_0_0_0_2px_var(--line-strong)]'
                    )}
                  >
                    <span className="flex w-full items-center justify-center gap-1 lg:justify-between">
                      <span className={cn('text-sm', isToday || isSelected ? 'font-bold' : 'font-medium', isToday ? 'text-brand' : !cell.inMonth ? 'text-ink-faint' : 'text-ink')}>
                        {format(parseISO(cell.date), cell.date.endsWith('-01') && !cell.inMonth ? 'd MMM' : 'd')}
                      </span>
                      {cell.flag && (
                        <span
                          aria-label={cell.flag === 'problem' ? 'Problem' : 'Needs you'}
                          className={cn('h-[9px] w-[9px] rounded-full max-lg:hidden', cell.flag === 'problem' ? 'bg-problem' : 'bg-attention-strong')}
                        />
                      )}
                    </span>
                    {/* Phones: dots. Wider screens: the amounts. */}
                    <span className="flex gap-1 lg:hidden" aria-hidden="true">
                      {cell.in > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', muted ? 'bg-ink-faint' : 'bg-money-in')} />}
                      {cell.out > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', muted ? 'bg-ink-faint' : 'bg-money-out')} />}
                      {cell.flag && <span className={cn('h-1.5 w-1.5 rounded-full', cell.flag === 'problem' ? 'bg-problem' : 'bg-attention-strong')} />}
                    </span>
                    {cell.in > 0 && (
                      <span className={cn('text-[13px] font-semibold tabular-nums max-lg:hidden', muted ? 'text-ink-faint' : 'text-money-in')}>
                        {formatSigned(cell.in, 'in', formatMoneyShort)}
                      </span>
                    )}
                    {cell.out > 0 && (
                      <span className={cn('text-[13px] font-semibold tabular-nums max-lg:hidden', muted ? 'text-ink-faint' : 'text-money-out')}>
                        {formatMoneyShort(cell.out)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-1 border-t px-3.5 py-3 text-[13px] text-ink-quiet">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-money-in">+</span>money in
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-money-out">{currencySymbol()}</span>money out
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-full bg-attention-strong" aria-hidden="true" />
                needs you
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-full bg-problem" aria-hidden="true" />
                problem
              </span>
              <span>Grey: done</span>
            </div>
          </section>
          {dayPanel}
        </div>
      )}
    </div>
  )
}
