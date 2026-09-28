import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { RowStatus, RowTags } from '@/components/cheques/RowChips'
import { groupByDay, rowTags, type DayGroup, type ListRow } from '@/lib/chequeList'
import { formatSigned, formatShortDate } from '@/lib/formatters'
import type { AlertRules } from '@/lib/receivedSchedule'
import { cn } from '@/lib/utils'

/** What a swipe offers on a row, if anything. */
export interface SwipeAction {
  label: string
  icon: LucideIcon
  run: () => void
}

interface ChequeCardsProps {
  rows: ListRow[]
  today: string
  rules: AlertRules
  /** Group by day (the "upcoming" order); otherwise one flat list in the chosen order. */
  grouped: boolean
  onOpen: (row: ListRow) => void
  swipeAction: (row: ListRow) => SwipeAction | null
}

const ACTION_WIDTH = 96

function groupLabel(group: DayGroup, today: string) {
  switch (group.kind) {
    case 'overdue':
      return { text: 'Overdue', className: 'text-problem' }
    case 'today':
      return { text: `Today · ${formatShortDate(today)}`, className: 'text-attention' }
    case 'day':
      return { text: formatShortDate(group.value), className: 'text-ink-quiet' }
    case 'month': {
      return { text: format(parseISO(`${group.value}-01`), 'MMMM yyyy'), className: 'text-ink-quiet' }
    }
  }
}

function groupTotal(group: DayGroup) {
  const parts = []
  if (group.in) parts.push(formatSigned(group.in, 'in'))
  if (group.out) parts.push(formatSigned(group.out, 'out'))
  return parts.join(' · ')
}

/** One cheque as a card. Swipe left to reveal its main action. */
function Card({ row, today, rules, onOpen, action }: { row: ListRow; today: string; rules: AlertRules; onOpen: () => void; action: SwipeAction | null }) {
  const [shift, setShift] = useState(0)
  const gesture = useRef<{ x: number; y: number; from: number; swiping: boolean } | null>(null)
  const justSwiped = useRef(false)
  const tags = rowTags(row, today, rules)
  const Icon = action?.icon

  const onTouchStart = (e: React.TouchEvent) => {
    if (!action) return
    const t = e.touches[0]
    gesture.current = { x: t.clientX, y: t.clientY, from: shift, swiping: false }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current
    if (!g) return
    const t = e.touches[0]
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y
    if (!g.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) g.swiping = true
    if (g.swiping) setShift(Math.max(-ACTION_WIDTH, Math.min(0, g.from + dx)))
  }
  const onTouchEnd = () => {
    const g = gesture.current
    gesture.current = null
    if (!g?.swiping) return
    justSwiped.current = true
    setShift((s) => (s < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0))
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl', shift && 'bg-brand')}>
      {action && Icon && (
        <button
          type="button"
          tabIndex={shift ? 0 : -1}
          aria-hidden={!shift}
          onClick={() => {
            setShift(0)
            action.run()
          }}
          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 text-[13px] font-semibold text-brand-ink"
          style={{ width: ACTION_WIDTH }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (justSwiped.current) {
            justSwiped.current = false
            return
          }
          if (shift) setShift(0)
          else onOpen()
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${shift}px)`, touchAction: 'pan-y' }}
        className={cn(
          'relative grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-surface p-3.5 text-left',
          gesture.current ? '' : 'transition-transform duration-200'
        )}
      >
        <span
          aria-label={row.direction === 'in' ? 'Received' : 'Given'}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            row.direction === 'in' ? 'bg-money-in-soft text-money-in' : 'bg-money-out-soft text-money-out'
          )}
        >
          {row.direction === 'in' ? (
            <ArrowDownLeft className="h-[18px] w-[18px]" strokeWidth={2.3} aria-hidden="true" />
          ) : (
            <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.3} aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="truncate text-base font-semibold">{row.party}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-quiet">
            <span className="font-cheque shrink-0">{row.number}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{row.bank}</span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            {tags.length && row.open ? <RowTags tags={tags} limit={1} /> : <RowStatus row={row} />}
          </span>
        </span>
        <span
          className={cn(
            'text-[17px] font-semibold tabular-nums',
            row.direction === 'in' ? 'text-money-in' : 'text-money-out'
          )}
        >
          {row.amount === null ? <span className="text-sm font-normal text-ink-quiet">No amount</span> : formatSigned(row.amount, row.direction)}
        </span>
      </button>
    </div>
  )
}

/** The cheque list on phones: cards, grouped by day when in upcoming order. */
export function ChequeCards({ rows, today, rules, grouped, onOpen, swipeAction }: ChequeCardsProps) {
  const card = (row: ListRow) => (
    <Card key={row.key} row={row} today={today} rules={rules} onOpen={() => onOpen(row)} action={swipeAction(row)} />
  )
  if (!grouped) return <div className="flex flex-col gap-2">{rows.map(card)}</div>
  return (
    <div className="flex flex-col gap-4">
      {groupByDay(rows, today).map((group) => {
        const label = groupLabel(group, today)
        return (
          <section key={group.key} className="flex flex-col gap-2" aria-label={label.text}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn('text-[13px] font-bold uppercase tracking-[0.06em]', label.className)}>{label.text}</span>
              <span className="text-[13px] tabular-nums text-ink-quiet">{groupTotal(group)}</span>
            </div>
            {group.rows.map(card)}
          </section>
        )
      })}
    </div>
  )
}
