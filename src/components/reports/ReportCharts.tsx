import { useEffect, useRef } from 'react'
import { parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Key } from '@/components/reports/ReportParts'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import type { Direction } from '@/lib/chequeList'
import { formatCurrencyCompact, formatDayMonth, formatMoney, formatMoneyShort, formatMonthLabel, formatNumber, formatSigned } from '@/lib/formatters'
import { statusLabel } from '@/lib/reportTables'
import {
  AGE_BUCKETS,
  type AgeBucket,
  type AgeTotal,
  type CashDay,
  type FundsDay,
  type MonthFlow,
  type PaymentMonth,
  type RunningDay,
  type StatusTotal,
  type TrendMonth,
} from '@/lib/reports'
import { cn } from '@/lib/utils'

/* Colours come from the Passbook tokens (src/index.css), so charts follow light and dark. */

const IN_COLORS: Record<string, string> = {
  CLEARED: 'var(--money-in)',
  SETTLED: 'var(--status-cleared)',
  DEPOSITED: 'var(--status-progress)',
  IN_HAND: 'var(--status-waiting)',
  BOUNCED: 'var(--status-problem)',
  REPLACED: 'var(--ink-faint)',
  HANDED_BACK: 'var(--ink-faint)',
  WRITTEN_OFF: 'var(--line-strong)',
}

const OUT_COLORS: Record<string, string> = {
  PASSED: 'var(--status-done)',
  DEPOSITED: 'var(--status-progress)',
  PENDING: 'var(--status-attention-strong)',
  RETURNED: 'var(--status-problem)',
  CANCELLED: 'var(--ink-faint)',
  WRITTEN_OFF: 'var(--line-strong)',
}

const AGE_COLORS: Record<AgeBucket, string> = {
  not_due: 'var(--status-waiting)',
  d0_30: 'var(--status-attention-strong)',
  d31_60: 'var(--status-attention)',
  d61_90: 'var(--status-problem)',
  d90_plus: 'var(--status-problem)',
}

const TICK = { fontSize: 11, fill: 'var(--ink-quiet)' }
const GRID = { strokeDasharray: '3 3', stroke: 'var(--line)', vertical: false }
const dayLabel = (date: string) => formatDayMonth(parseISO(date))

function yAxis() {
  return <YAxis tickFormatter={(v: number) => formatCurrencyCompact(v)} tick={TICK} width={58} axisLine={false} tickLine={false} />
}

const cursor = { fill: 'var(--line-soft)' }

/** A dot only on days when funds were added, so empty days don't dot the baseline. */
function fundsDot({ cx, cy, value, index }: { cx?: number; cy?: number; value?: number; index?: number }) {
  return value ? <circle key={index} cx={cx} cy={cy} r={2.5} fill="var(--brand)" /> : <g key={index} />
}

/** Money in and out per month, as a pair of bars each (design board Reports-desktop). */
export function MonthBars({ months, showIn, showOut }: { months: MonthFlow[]; showIn: boolean; showOut: boolean }) {
  const max = Math.max(1, ...months.map((m) => Math.max(showIn ? m.in : 0, showOut ? m.out : 0)))
  // When the months don't fit (phones), start at the latest ones.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [months.length])
  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div className="grid gap-3 lg:gap-4" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(64px, 1fr))` }}>
        {months.map((m) => {
          const values = [showIn && m.in ? formatSigned(m.in, 'in', formatMoneyShort) : null, showOut && m.out ? formatMoneyShort(m.out) : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <div key={m.month} className="flex min-w-0 flex-col items-center gap-1.5">
              <div className="flex h-40 w-full items-end justify-center gap-1.5 border-b-2 border-line-strong" aria-hidden="true">
                {showIn && <div className="w-[40%] max-w-7 rounded-t-[5px] bg-money-in" style={{ height: `${(m.in / max) * 100}%` }} />}
                {showOut && <div className="w-[40%] max-w-7 rounded-t-[5px] bg-money-out" style={{ height: `${(m.out / max) * 100}%` }} />}
              </div>
              <span className="text-[13px] font-semibold">{formatMonthLabel(m.month)}</span>
              <span className="text-center text-xs tabular-nums text-ink-quiet">{values || '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** One direction's cheques by status as a single stacked bar, with a key under it. */
export function StandBar({ direction, parts }: { direction: Direction; parts: StatusTotal[] }) {
  const colors = direction === 'in' ? IN_COLORS : OUT_COLORS
  const total = parts.reduce((s, p) => s + p.amount, 0)
  return (
    <div className="flex flex-col gap-2">
      <span className="flex justify-between gap-3 text-sm font-semibold">
        <span>{direction === 'in' ? 'Received' : 'Given'}</span>
        <span className={cn('tabular-nums', direction === 'in' && 'text-money-in')}>{formatSigned(total, direction)}</span>
      </span>
      <span className="flex h-3.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        {total > 0 &&
          parts.map((p) => <span key={p.status} style={{ width: `${(p.amount / total) * 100}%`, background: colors[p.status] }} />)}
      </span>
      {parts.length ? (
        <span className="flex flex-wrap gap-x-3.5 gap-y-1.5">
          {parts.map((p) => (
            <Key key={p.status} color={colors[p.status]}>
              <span className="text-ink-nav">{statusLabel(direction, p.status)}</span>
              <span className="tabular-nums">
                {formatMoneyShort(p.amount)} · {formatNumber(p.count)}
              </span>
            </Key>
          ))}
        </span>
      ) : (
        <span className="text-[13px] text-ink-quiet">No cheques with these filters.</span>
      )}
    </div>
  )
}

export interface BarItem {
  key: string
  label: string
  value: number
  note?: string
  color?: string
  onClick?: () => void
}

/** Ranked horizontal bars, e.g. banks or reasons. */
export function RankBars({ items, color }: { items: BarItem[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="text-sm text-ink-quiet">Nothing here with these filters.</p>
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
          {item.onClick ? (
            <button type="button" onClick={item.onClick} className="truncate text-left font-medium hover:underline">
              {item.label}
            </button>
          ) : (
            <span className="truncate font-medium">{item.label}</span>
          )}
          <span className="h-3 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? color }} />
          </span>
          <span className="col-start-2 tabular-nums text-ink-quiet sm:col-start-auto sm:text-right">
            {formatMoney(item.value)}
            {item.note ? ` · ${item.note}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Money still to collect by age: one bar per bucket. */
export function AgeingBars({ ageing }: { ageing: AgeTotal[] }) {
  return (
    <RankBars
      color="var(--status-waiting)"
      items={ageing.map((a) => ({
        key: a.bucket,
        label: AGE_BUCKETS.find((b) => b.key === a.bucket)!.label,
        value: a.amount,
        note: `${formatNumber(a.count)} cheque${a.count === 1 ? '' : 's'}`,
        color: AGE_COLORS[a.bucket],
      }))}
    />
  )
}

/** Given and received side by side per party. */
export function PartyBars({
  items,
  showIn,
  showOut,
}: {
  items: { key: string; label: string; in: number; out: number; onClick: () => void }[]
  showIn: boolean
  showOut: boolean
}) {
  const max = Math.max(1, ...items.map((i) => Math.max(showIn ? i.in : 0, showOut ? i.out : 0)))
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <button type="button" onClick={item.onClick} className="truncate text-left font-medium hover:underline">
            {item.label}
          </button>
          <span className="flex flex-col gap-1">
            {showIn && (
              <span className="flex items-center gap-2">
                <span className="h-2.5 rounded-full bg-money-in" style={{ width: `${(item.in / max) * 100}%` }} aria-hidden="true" />
                <span className="shrink-0 text-xs tabular-nums text-money-in">{item.in ? formatSigned(item.in, 'in', formatMoneyShort) : ''}</span>
              </span>
            )}
            {showOut && (
              <span className="flex items-center gap-2">
                <span className="h-2.5 rounded-full bg-money-out" style={{ width: `${(item.out / max) * 100}%` }} aria-hidden="true" />
                <span className="shrink-0 text-xs tabular-nums text-ink-quiet">{item.out ? formatMoneyShort(item.out) : ''}</span>
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The 28 days around today: what went or goes out (stacked by status), what comes in, and funds added. */
export function CashChart({ days, showIn, showOut }: { days: CashDay[]; showIn: boolean; showOut: boolean }) {
  const data = days.map((d) => ({ ...d, label: dayLabel(d.date) }))
  const today = data.find((d) => d.isToday)?.label
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {showOut && (
          <>
            <Key color={OUT_COLORS.PENDING}>Pending</Key>
            <Key color={OUT_COLORS.DEPOSITED}>Funded</Key>
            <Key color={OUT_COLORS.PASSED}>Passed</Key>
            <Key color="var(--brand)">Funds added</Key>
          </>
        )}
        {showIn && (
          <>
            <Key color="var(--money-in-soft)">Expected in</Key>
            <Key color="var(--money-in)">Cleared</Key>
          </>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={16} />
          {yAxis()}
          <Tooltip content={<CurrencyTooltip />} cursor={cursor} />
          {today && (
            <ReferenceLine
              x={today}
              stroke="var(--status-problem)"
              strokeDasharray="3 3"
              label={{ value: 'Today', fill: 'var(--status-problem)', fontSize: 11, position: 'top' }}
            />
          )}
          {showOut && <Bar dataKey="pending" stackId="out" fill={OUT_COLORS.PENDING} name="Pending" />}
          {showOut && <Bar dataKey="funded" stackId="out" fill={OUT_COLORS.DEPOSITED} name="Funded" />}
          {showOut && <Bar dataKey="passed" stackId="out" fill={OUT_COLORS.PASSED} name="Passed" radius={[3, 3, 0, 0]} />}
          {showIn && <Bar dataKey="expected" stackId="in" fill="var(--money-in-soft)" stroke="var(--money-in)" name="Expected in" />}
          {showIn && <Bar dataKey="cleared" stackId="in" fill="var(--money-in)" name="Cleared" radius={[3, 3, 0, 0]} />}
          {showOut && <Line type="monotone" dataKey="fundsAdded" stroke="var(--brand)" strokeWidth={2} dot={fundsDot} name="Funds added" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** How much will have gone out and come in by each of the next 30 days. */
export function RunningChart({ running, showIn, showOut }: { running: RunningDay[]; showIn: boolean; showOut: boolean }) {
  const data = running.map((d) => ({ ...d, label: dayLabel(d.date) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {showOut && <Key color="var(--money-out)">Out by then</Key>}
        {showIn && <Key color="var(--money-in)">In by then</Key>}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={20} />
          {yAxis()}
          <Tooltip content={<CurrencyTooltip />} />
          {showOut && <Area type="monotone" dataKey="out" stroke="var(--money-out)" fill="var(--money-out)" fillOpacity={0.08} strokeWidth={2} name="Out by then" />}
          {showIn && <Area type="monotone" dataKey="in" stroke="var(--money-in)" fill="var(--money-in)" fillOpacity={0.12} strokeWidth={2} name="In by then" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Given cheques over six months: written, due, and passed. */
export function TrendChart({ trend }: { trend: TrendMonth[] }) {
  const data = trend.map((m) => ({ ...m, label: formatMonthLabel(m.month) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--brand)">Written</Key>
        <Key color="var(--status-attention-strong)">Due</Key>
        <Key color="var(--status-done)">Passed</Key>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
          {yAxis()}
          <Tooltip content={<CurrencyTooltip />} cursor={cursor} />
          <Bar dataKey="issued" fill="var(--brand)" name="Written" barSize={16} radius={[3, 3, 0, 0]} />
          <Bar dataKey="due" fill="var(--status-attention-strong)" name="Due" barSize={16} radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="cleared" stroke="var(--status-done)" strokeWidth={2} dot={{ r: 3 }} name="Passed" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Given cheques by month: written, passed and returned, and what's still to pay. */
export function PaymentsChart({ months }: { months: PaymentMonth[] }) {
  const data = months.map((m) => ({ ...m, label: formatMonthLabel(m.month) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--brand)">Given</Key>
        <Key color="var(--status-done)">Passed</Key>
        <Key color="var(--status-problem)">Returned</Key>
        <Key color="var(--status-attention-strong)">Still to pay</Key>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
          {yAxis()}
          <Tooltip content={<CurrencyTooltip />} cursor={cursor} />
          <Bar dataKey="given" fill="var(--brand)" name="Given" radius={[3, 3, 0, 0]} />
          <Bar dataKey="passed" fill="var(--status-done)" name="Passed" radius={[3, 3, 0, 0]} />
          <Bar dataKey="returned" fill="var(--status-problem)" name="Returned" radius={[3, 3, 0, 0]} />
          <Bar dataKey="stillToPay" fill="var(--status-attention-strong)" name="Still to pay" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Funds added and cheque payments by day, with running totals. */
export function FundsChart({ days }: { days: FundsDay[] }) {
  const data = days.map((d) => ({ ...d, label: dayLabel(d.date) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--money-in)">Funds added</Key>
        <Key color="var(--money-out)">Cheque payments</Key>
        <span className="text-[13px] text-ink-quiet">Lines: the totals so far, on the right-hand scale</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={20} />
          {/* Each day on the left scale; the running totals, far larger, on their own scale on the right. */}
          <YAxis yAxisId="day" tickFormatter={(v: number) => formatCurrencyCompact(v)} tick={TICK} width={58} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="total"
            orientation="right"
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
            tick={TICK}
            width={58}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CurrencyTooltip />} cursor={cursor} />
          <Bar yAxisId="day" dataKey="funds" fill="var(--money-in)" name="Funds added" maxBarSize={10} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="day" dataKey="payments" fill="var(--money-out)" name="Cheque payments" maxBarSize={10} radius={[2, 2, 0, 0]} />
          <Line yAxisId="total" type="monotone" dataKey="totalFunds" stroke="var(--money-in)" strokeWidth={2} dot={false} name="Funds added so far" />
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="totalPayments"
            stroke="var(--money-out)"
            strokeDasharray="4 3"
            strokeWidth={2}
            dot={false}
            name="Payments so far"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
