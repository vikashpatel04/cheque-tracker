import { useCallback, useEffect, useState, useMemo } from 'react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDayMonth, todayISO } from '@/lib/formatters'
import { countsAsIssued, isStillToPay } from '@/lib/chequeTags'
import { useDeposits } from '@/hooks/useDeposits'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import { STATUS_COLORS, CHART_COLORS, formatChartCurrency, formatMonthLabel } from '@/lib/chartUtils'
import { STATUS_LABELS, type Cheque, type ChequeStatus } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { CumulativeOutflowChart, SixMonthTrendChart } from '@/components/reports/OutlookCharts'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Area,
  RadialBarChart,
  RadialBar,
  ReferenceLine,
} from 'recharts'

export default function Reports() {
  const { deposits } = useDeposits()
  const [cheques, setCheques] = useState<Cheque[]>([])
  // Cheques that bounced at least once (from history), even if later
  // re-presented and paid — their current status no longer says RETURNED.
  // Imported cheques have no such history, so re-presented ones count too.
  const [everReturned, setEverReturned] = useState<Set<string>>(new Set())
  // When each cheque passed, for the six-month trend.
  const [passedAt, setPassedAt] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('cheques').select('*, party:parties(*)').is('deleted_at', null),
      supabase.from('cheque_history').select('cheque_id').eq('to_status', 'RETURNED'),
      // Imports aren't when a cheque passed.
      supabase.from('cheque_history').select('cheque_id, created_at').eq('to_status', 'PASSED').neq('changed_by', 'import'),
    ]).then(([chequesRes, returnedRes, passedRes]) => {
      if (chequesRes.data) setCheques(chequesRes.data as Cheque[])
      if (returnedRes.data) setEverReturned(new Set(returnedRes.data.map((h) => h.cheque_id as string)))
      if (passedRes.data) setPassedAt(new Map(passedRes.data.map((h) => [h.cheque_id as string, h.created_at as string])))
      setLoading(false)
    })
  }, [])

  const wasReturned = useCallback(
    (c: Cheque) => c.status === 'RETURNED' || everReturned.has(c.id) || c.represent_count > 0,
    [everReturned]
  )

  const filtered = useMemo(() => {
    return cheques.filter((c) => {
      if (dateFrom && c.issue_date < dateFrom) return false
      if (dateTo && c.issue_date > dateTo) return false
      return true
    })
  }, [cheques, dateFrom, dateTo])

  const monthlyData = useMemo(() => {
    const months: Record<string, { issued: number; paid: number; returned: number; stillToPay: number; count: number }> = {}
    filtered.forEach((c) => {
      const month = c.issue_date.slice(0, 7)
      if (!months[month]) months[month] = { issued: 0, paid: 0, returned: 0, stillToPay: 0, count: 0 }
      if (wasReturned(c)) months[month].returned += Number(c.amount)
      if (!countsAsIssued(c)) return
      months[month].issued += Number(c.amount)
      months[month].count++
      if (c.status === 'PASSED') months[month].paid += Number(c.amount)
      if (isStillToPay(c)) months[month].stillToPay += Number(c.amount)
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: formatMonthLabel(month),
        monthKey: month,
        ...data,
      }))
  }, [filtered, wasReturned])

  const partyData = useMemo(() => {
    const parties: Record<string, { name: string; issued: number; paid: number; returned: number; stillToPay: number }> = {}
    filtered.forEach((c) => {
      const id = c.party_id
      if (!parties[id]) parties[id] = { name: c.party?.name ?? 'Unknown', issued: 0, paid: 0, returned: 0, stillToPay: 0 }
      if (wasReturned(c)) parties[id].returned += Number(c.amount)
      if (!countsAsIssued(c)) return
      parties[id].issued += Number(c.amount)
      if (c.status === 'PASSED') parties[id].paid += Number(c.amount)
      if (isStillToPay(c)) parties[id].stillToPay += Number(c.amount)
    })
    return Object.values(parties).sort((a, b) => b.stillToPay - a.stillToPay)
  }, [filtered, wasReturned])

  const topPartyChart = partyData.slice(0, 8).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
    'Still to pay': p.stillToPay,
    Paid: p.paid,
  }))

  const bankData = useMemo(() => {
    const banks: Record<string, number> = {}
    filtered.forEach((c) => {
      banks[c.bank_name] = (banks[c.bank_name] ?? 0) + Number(c.amount)
    })
    return Object.entries(banks)
      .map(([bank, total]) => ({ bank, total, name: bank }))
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  const statusData = useMemo(() => {
    const statuses: Record<string, { count: number; amount: number }> = {}
    cheques.forEach((c) => {
      if (!statuses[c.status]) statuses[c.status] = { count: 0, amount: 0 }
      statuses[c.status].count++
      statuses[c.status].amount += Number(c.amount)
    })
    return Object.entries(statuses).map(([status, data]) => ({
      status,
      name: STATUS_LABELS[status as ChequeStatus] ?? status,
      ...data,
      fill: STATUS_COLORS[status] ?? CHART_COLORS[0],
    }))
  }, [cheques])

  const statusCountData = statusData.map((s) => ({ ...s, value: s.count }))

  const depositVsOutflow = useMemo(() => {
    const byDate: Record<string, { deposits: number; outflow: number }> = {}

    deposits.forEach((d) => {
      if (!byDate[d.deposit_date]) byDate[d.deposit_date] = { deposits: 0, outflow: 0 }
      byDate[d.deposit_date].deposits += Number(d.amount)
    })

    cheques
      .filter((c) => ['PASSED', 'DEPOSITED'].includes(c.status))
      .forEach((c) => {
        const date = c.due_date
        if (!byDate[date]) byDate[date] = { deposits: 0, outflow: 0 }
        byDate[date].outflow += Number(c.amount)
      })

    let cumDeposits = 0
    let cumOutflow = 0
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([date, data]) => {
        cumDeposits += data.deposits
        cumOutflow += data.outflow
        return {
          date: formatDate(date),
          deposits: data.deposits,
          outflow: data.outflow,
          cumDeposits,
          cumOutflow,
        }
      })
  }, [deposits, cheques])

  const summaryStats = useMemo(() => {
    const issued = filtered.filter(countsAsIssued)
    const sum = (list: Cheque[]) => list.reduce((s, c) => s + Number(c.amount), 0)
    return {
      totalIssued: sum(issued),
      totalPaid: sum(issued.filter((c) => c.status === 'PASSED')),
      totalStillToPay: sum(issued.filter(isStillToPay)),
      totalReturned: sum(filtered.filter(wasReturned)),
      count: issued.length,
    }
  }, [filtered, wasReturned])

  /**
   * 28-day rolling daily cash flow — 14 days back + 14 days forward.
   * Each row aggregates cheque liabilities and deposits made on that date.
   */
  const dailyCashFlow = useMemo(() => {
    const todayStr = todayISO()
    const today = parseISO(todayStr)

    // Pre-index deposits by deposit_date for O(1) lookup
    const depositsByDate: Record<string, number> = {}
    deposits.forEach((d) => {
      depositsByDate[d.deposit_date] = (depositsByDate[d.deposit_date] ?? 0) + Number(d.amount)
    })

    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(subDays(today, 14), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const isPast = dateStr < todayStr
      const isToday = dateStr === todayStr
      const dayCheques = cheques.filter((c) => c.due_date === dateStr)

      const pending = dayCheques
        .filter((c) => c.status === 'PENDING')
        .reduce((s, c) => s + Number(c.amount), 0)
      const deposited = dayCheques
        .filter((c) => c.status === 'DEPOSITED')
        .reduce((s, c) => s + Number(c.amount), 0)
      const passed = dayCheques
        .filter((c) => c.status === 'PASSED')
        .reduce((s, c) => s + Number(c.amount), 0)
      const returned = dayCheques
        .filter((c) => c.status === 'RETURNED')
        .reduce((s, c) => s + Number(c.amount), 0)

      const totalCheques = pending + deposited + passed + returned
      const depositLog = depositsByDate[dateStr] ?? 0
      // Gap = cash needed for the day minus cash logged as deposited that day.
      // For past dates: liability = passed (actually paid that day).
      // For future dates: liability = pending + deposited (still need funds).
      const cashRequired = isPast ? passed : pending + deposited
      const gap = depositLog - cashRequired

      return {
        date: dateStr,
        label: formatDayMonth(date),
        weekday: format(date, 'EEE'),
        isPast,
        isToday,
        count: dayCheques.length,
        pending,
        deposited,
        passed,
        returned,
        totalCheques,
        depositLog,
        cashRequired,
        gap,
      }
    })
  }, [cheques, deposits])

  const dailySummary = useMemo(() => {
    const todayStr = todayISO()
    const upcoming = dailyCashFlow.filter((d) => d.date >= todayStr)
    const past = dailyCashFlow.filter((d) => d.date < todayStr)
    return {
      next14Required: upcoming.reduce((s, d) => s + d.cashRequired, 0),
      next14Cheques: upcoming.reduce((s, d) => s + d.count, 0),
      past14Required: past.reduce((s, d) => s + d.cashRequired, 0),
      past14Deposited: past.reduce((s, d) => s + d.depositLog, 0),
      todayRequired: dailyCashFlow.find((d) => d.isToday)?.cashRequired ?? 0,
      todayDeposited: dailyCashFlow.find((d) => d.isToday)?.depositLog ?? 0,
    }
  }, [dailyCashFlow])

  const todayLabel = useMemo(() => dailyCashFlow.find((d) => d.isToday)?.label, [dailyCashFlow])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" subtitle="Detailed analytics and export-ready summaries" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-[240px] w-full rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Detailed analytics and export-ready summaries" />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Issued', value: formatCurrency(summaryStats.totalIssued) },
          { label: 'Paid (cleared)', value: formatCurrency(summaryStats.totalPaid) },
          { label: 'Still to pay', value: formatCurrency(summaryStats.totalStillToPay) },
          { label: 'Returned (bounced)', value: formatCurrency(summaryStats.totalReturned) },
          { label: 'Cheques', value: String(summaryStats.count) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>Date range</Label>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => { setDateFrom(from); setDateTo(to) }}
            placeholder="All dates"
            className="w-64"
          />
        </div>
        <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear filters</Button>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="daily">Daily Cash Flow</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="party">Party-wise</TabsTrigger>
          <TabsTrigger value="bank">Bank-wise</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4 mt-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Today',
                value: formatCurrency(dailySummary.todayRequired),
                sub: `${formatCurrency(dailySummary.todayDeposited)} funds added`,
                tone:
                  dailySummary.todayRequired > 0 &&
                  dailySummary.todayDeposited < dailySummary.todayRequired
                    ? 'danger'
                    : undefined,
              },
              {
                label: 'Next 14 days',
                value: formatCurrency(dailySummary.next14Required),
                sub: `${dailySummary.next14Cheques} cheques`,
              },
              {
                label: 'Past 14 days — required',
                value: formatCurrency(dailySummary.past14Required),
                sub: 'cleared cheques',
              },
              {
                label: 'Past 14 days — funds added',
                value: formatCurrency(dailySummary.past14Deposited),
                sub: 'logged deposits',
              },
            ].map(({ label, value, sub, tone }) => (
              <Card key={label} className={tone === 'danger' ? 'border-red-300/70' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={cn(
                      'text-lg font-semibold mt-0.5 tabular-nums',
                      tone === 'danger' && 'text-red-600'
                    )}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Combined 28-day chart */}
          <Card>
            <CardHeader>
              <CardTitle>28-Day Cash Flow</CardTitle>
              <CardDescription>
                Cheque liability vs deposits logged — past 14 days and next 14 days, with today marked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={dailyCashFlow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} interval={1} />
                  <YAxis
                    tickFormatter={(v) => formatChartCurrency(v)}
                    tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }}
                    width={55}
                  />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend />
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke="var(--status-problem)"
                      strokeDasharray="3 3"
                      label={{ value: 'Today', fill: 'var(--status-problem)', fontSize: 10, position: 'top' }}
                    />
                  )}
                  <Bar dataKey="pending" stackId="cheques" fill={STATUS_COLORS.PENDING} name="Pending" />
                  <Bar
                    dataKey="deposited"
                    stackId="cheques"
                    fill={STATUS_COLORS.DEPOSITED}
                    name="Funded"
                  />
                  <Bar
                    dataKey="passed"
                    stackId="cheques"
                    fill={STATUS_COLORS.PASSED}
                    name="Passed"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="depositLog"
                    stroke="var(--money-in)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Funds Added"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Day-by-day table */}
          <Card>
            <CardHeader>
              <CardTitle>Day-by-day Breakdown</CardTitle>
              <CardDescription>
                Past 14 days show cleared amounts; next 14 days show cash you'll need
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Date</TableHead>
                    <TableHead className="p-3 text-foreground">Day</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cheques</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Pending</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Funded</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Required</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Funds Added</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyCashFlow.map((d) => {
                    const shortfall = d.cashRequired > 0 && d.depositLog < d.cashRequired
                    return (
                      <TableRow
                        key={d.date}
                        className={cn(
                          d.isToday && 'bg-primary/5 font-medium',
                          d.isPast && 'text-muted-foreground'
                        )}
                      >
                        <TableCell className="p-3">
                          {formatDate(d.date)}
                          {d.isToday && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-semibold">
                              Today
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="p-3">{d.weekday}</TableCell>
                        <TableCell className="p-3 text-right tabular-nums">{d.count || '—'}</TableCell>
                        <TableCell className="p-3 text-right tabular-nums">
                          {d.pending > 0 ? formatCurrency(d.pending) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right tabular-nums">
                          {d.deposited > 0 ? formatCurrency(d.deposited) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right font-medium tabular-nums">
                          {d.cashRequired > 0 ? formatCurrency(d.cashRequired) : '—'}
                        </TableCell>
                        <TableCell className="p-3 text-right tabular-nums text-emerald-600">
                          {d.depositLog > 0 ? formatCurrency(d.depositLog) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'p-3 text-right tabular-nums font-medium',
                            d.gap < 0 && shortfall && 'text-red-600',
                            d.gap > 0 && 'text-emerald-600'
                          )}
                        >
                          {d.cashRequired === 0 && d.depositLog === 0
                            ? '—'
                            : formatCurrency(d.gap)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <CumulativeOutflowChart cheques={cheques} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Comparison</CardTitle>
                <CardDescription>Cheques we issued, paid, and that bounced — by issue month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--ink-quiet)' }} />
                    <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} width={55} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend />
                    <Bar dataKey="issued" fill="var(--brand)" name="Issued" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paid" fill="var(--money-in)" name="Paid" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="returned" fill="var(--status-problem)" name="Returned" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Still to Pay</CardTitle>
                <CardDescription>Amount from each month's cheques not yet paid (pending, funded or returned)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--ink-quiet)' }} />
                    <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} width={55} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="stillToPay" fill="var(--status-attention-strong)" stroke="var(--status-attention-strong)" fillOpacity={0.15} name="Still to pay" />
                    <Line type="monotone" dataKey="issued" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3 }} name="Issued" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Monthly Data Table</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Month</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Cheques</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Issued</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Paid</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Returned</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Still to pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((m) => (
                    <TableRow key={m.monthKey}>
                      <TableCell className="p-3 font-medium">{m.month}</TableCell>
                      <TableCell className="p-3 text-right">{m.count}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(m.issued)}</TableCell>
                      <TableCell className="p-3 text-right text-green-600">{formatCurrency(m.paid)}</TableCell>
                      <TableCell className="p-3 text-right text-red-600">{formatCurrency(m.returned)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(m.stillToPay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <SixMonthTrendChart cheques={cheques} passedAt={passedAt} />
        </TabsContent>

        <TabsContent value="party" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Parties — Stacked Breakdown</CardTitle>
              <CardDescription>Still to pay and paid, for the 8 parties we owe most</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topPartyChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'var(--ink-quiet)' }} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend />
                  <Bar dataKey="Still to pay" stackId="a" fill={STATUS_COLORS.PENDING} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Paid" stackId="a" fill={STATUS_COLORS.PASSED} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="p-3 text-foreground">Party</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Issued</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Paid</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Returned</TableHead>
                    <TableHead className="p-3 text-right text-foreground">Still to pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partyData.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="p-3 font-medium">{p.name}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.issued)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.paid)}</TableCell>
                      <TableCell className="p-3 text-right">{formatCurrency(p.returned)}</TableCell>
                      <TableCell className="p-3 text-right font-medium">{formatCurrency(p.stillToPay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Outflow Distribution</CardTitle>
                <CardDescription>Share of total cheque amounts by bank</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={bankData} dataKey="total" nameKey="bank" cx="50%" cy="50%" outerRadius={100} label={({ bank, percent }) => `${bank} (${(percent * 100).toFixed(0)}%)`}>
                      {bankData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CurrencyTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bank Rankings</CardTitle>
                <CardDescription>Total outflow per bank account</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bankData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} />
                    <YAxis type="category" dataKey="bank" width={100} tick={{ fontSize: 11, fill: 'var(--ink-quiet)' }} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Bar dataKey="total" fill="var(--brand)" name="Total Outflow" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deposits" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Funds Added vs Cheque Payments</CardTitle>
              <CardDescription>Money we added to the bank compared to our cheques funded or paid</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={depositVsOutflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} width={55} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend />
                  <Bar dataKey="deposits" fill="var(--money-in)" name="Funds added" barSize={8} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="outflow" fill="var(--status-attention-strong)" name="Cheque payments" barSize={8} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumDeposits" stroke="var(--money-in)" strokeWidth={2} dot={false} name="Cum. funds added" />
                  <Line type="monotone" dataKey="cumOutflow" stroke="var(--status-attention)" strokeWidth={2} dot={false} name="Cum. payments" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funds Added Trend</CardTitle>
              <CardDescription>Money added to the bank to cover cheques, over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={depositVsOutflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tickFormatter={(v) => formatChartCurrency(v)} tick={{ fontSize: 10, fill: 'var(--ink-quiet)' }} width={55} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area type="monotone" dataKey="deposits" fill="var(--money-in)" stroke="var(--money-in)" fillOpacity={0.2} name="Funds added" />
                  <Line type="monotone" dataKey="deposits" stroke="var(--money-in)" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status by Amount</CardTitle>
                <CardDescription>Donut chart of current cheque values</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status by Count</CardTitle>
                <CardDescription>Number of cheques in each status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={statusCountData} startAngle={180} endAngle={0}>
                    <RadialBar background dataKey="value" cornerRadius={4}>
                      {statusCountData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </RadialBar>
                    <Legend />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusData.map((s) => (
              <Card key={s.status}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.fill }} />
                    <p className="font-medium text-sm">{s.name}</p>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(s.amount)}</p>
                  <p className="text-xs text-muted-foreground">{s.count} cheques</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
