import { useMemo } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import { formatChartCurrency, formatMonthLabel } from '@/lib/chartUtils'
import { formatDayMonth, todayISO } from '@/lib/formatters'
import { plusDays } from '@/lib/today'
import type { Cheque } from '@/types'

/*
 * Two charts that were on the old dashboard (moved here in plan item 14, step 2)
 * until Reports gets its Cash flow tab (step 5).
 */

const TICK = { fontSize: 10, fill: 'var(--ink-quiet)' }
const isOpen = (c: Cheque) => c.status === 'PENDING' || c.status === 'DEPOSITED'

/** Running total of what goes out over the next 30 days. */
export function CumulativeOutflowChart({ cheques }: { cheques: Cheque[] }) {
  const data = useMemo(() => {
    const today = todayISO()
    let running = 0
    return Array.from({ length: 30 }, (_, i) => {
      const date = plusDays(today, i)
      running += cheques.filter((c) => isOpen(c) && c.due_date === date).reduce((s, c) => s + Number(c.amount), 0)
      return { label: formatDayMonth(parseISO(date)), cumulative: running }
    })
  }, [cheques])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Running total, next 30 days</CardTitle>
        <CardDescription>How much will have gone out by each day</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={TICK} interval={4} />
            <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={TICK} width={55} />
            <Tooltip content={<CurrencyTooltip />} />
            <Area type="monotone" dataKey="cumulative" stroke="var(--brand)" fill="url(#cumulative-fill)" name="Running total" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/**
 * The last six months: issued, due, and cleared. A cheque counts as cleared
 * in the month it passed (`passedAt`, from its history), or its due month if
 * that isn't known.
 */
export function SixMonthTrendChart({ cheques, passedAt }: { cheques: Cheque[]; passedAt: Map<string, string> }) {
  const data = useMemo(() => {
    const start = format(subDays(parseISO(todayISO()), 180), 'yyyy-MM-dd')
    const months: Record<string, { issued: number; due: number; cleared: number }> = {}
    const add = (month: string, key: 'issued' | 'due' | 'cleared', amount: number) => {
      months[month] ??= { issued: 0, due: 0, cleared: 0 }
      months[month][key] += amount
    }
    for (const c of cheques) {
      const amount = Number(c.amount)
      if (c.issue_date >= start) add(c.issue_date.slice(0, 7), 'issued', amount)
      if (c.due_date >= start) add(c.due_date.slice(0, 7), 'due', amount)
      if (c.status === 'PASSED') {
        const passed = passedAt.get(c.id)
        add(passed ? format(parseISO(passed), 'yyyy-MM') : c.due_date.slice(0, 7), 'cleared', amount)
      }
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, totals]) => ({ month: formatMonthLabel(month), ...totals }))
  }, [cheques, passedAt])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Six-month trend</CardTitle>
        <CardDescription>Issued, due and cleared, by month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ ...TICK, fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={TICK} width={55} />
            <Tooltip content={<CurrencyTooltip />} />
            <Legend />
            <Bar dataKey="issued" fill="var(--brand)" name="Issued" barSize={16} radius={[3, 3, 0, 0]} />
            <Bar dataKey="due" fill="var(--status-attention-strong)" name="Due" barSize={16} radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="cleared" stroke="var(--money-in)" strokeWidth={2} dot={{ r: 3 }} name="Cleared" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
