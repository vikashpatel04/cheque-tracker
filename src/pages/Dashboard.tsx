import { useEffect, useState, useMemo, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addDays,
  startOfWeek,
  endOfWeek,
  parseISO,
  format,
  subDays,
} from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { isLegacyRepresented } from '@/lib/chequeTags'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, formatDayMonth, todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'

import { ChequeDetail } from '@/components/cheques/ChequeDetail'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { ChequeCalendar } from '@/components/shared/ChequeCalendar'
import { CurrencyTooltip } from '@/components/shared/ChartTooltip'
import { TodayPanel } from '@/components/shared/TodayPanel'
import { Next7DaysStrip } from '@/components/shared/Next7DaysStrip'
import { DayChequesDialog } from '@/components/shared/DayChequesDialog'
import { STATUS_COLORS, CHART_COLORS, formatChartCurrency, formatMonthLabel } from '@/lib/chartUtils'
import { STATUS_LABELS, type Cheque, type ChequeHistory, type ChequeStatus } from '@/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from 'recharts'

export default function Dashboard() {

  const [cheques, setCheques] = useState<Cheque[]>([])
  const [history, setHistory] = useState<ChequeHistory[]>([])
  // cheque_id -> when it was marked PASSED (from history), for the cleared chart
  const [passedAt, setPassedAt] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  // Cheque-level interactions
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editCheque, setEditCheque] = useState<Cheque | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Shared day-modal — driven from TodayPanel, Next7DaysStrip, and Calendar
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    const [chequesRes, historyRes, passedRes] = await Promise.all([
      supabase.from('cheques').select('*, party:parties(*)').is('deleted_at', null),
      // Imports aren't activity, and their date isn't when the cheque passed.
      supabase.from('cheque_history').select('*, cheque:cheques(*, party:parties(*))').neq('changed_by', 'import').order('created_at', { ascending: false }).limit(10),
      supabase.from('cheque_history').select('cheque_id, created_at').eq('to_status', 'PASSED').neq('changed_by', 'import'),
    ])
    if (chequesRes.data) setCheques(chequesRes.data as Cheque[])
    if (historyRes.data) setHistory(historyRes.data as ChequeHistory[])
    if (passedRes.data) {
      setPassedAt(new Map(passedRes.data.map((h) => [h.cheque_id as string, h.created_at as string])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const todayStr = todayISO()
  const today = useMemo(() => parseISO(todayStr), [todayStr])
  const { weekStartsOn } = getActiveRegion()

  const outstanding = cheques
    .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount), 0)

  const weekStart = startOfWeek(today, { weekStartsOn })
  const weekEnd = endOfWeek(today, { weekStartsOn })
  const monthEnd = addDays(today, 30)

  const dueThisWeek = cheques.filter((c) => {
    if (!['PENDING', 'DEPOSITED'].includes(c.status)) return false
    const d = parseISO(c.due_date)
    return d >= weekStart && d <= weekEnd
  })

  const dueThisMonth = cheques.filter((c) => {
    if (!['PENDING', 'DEPOSITED'].includes(c.status)) return false
    const d = parseISO(c.due_date)
    return d >= today && d <= monthEnd
  })

  // Bounced cheques still waiting for a decision (re-present or write off).
  // Old-style re-presented ones were settled through a separate entry.
  const returnedCount = cheques.filter((c) => c.status === 'RETURNED' && !isLegacyRepresented(c)).length

  const overdueCount = useMemo(
    () => cheques.filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status) && c.due_date < todayStr).length,
    [cheques, todayStr]
  )

  const calendarDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayCheques = cheques.filter(
        (c) => c.due_date === dateStr && ['PENDING', 'DEPOSITED'].includes(c.status)
      )
      const pending = dayCheques.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0)
      const deposited = dayCheques.filter((c) => c.status === 'DEPOSITED').reduce((s, c) => s + Number(c.amount), 0)
      const total = pending + deposited
      return { date: dateStr, label: formatDayMonth(date), pending, deposited, total, count: dayCheques.length }
    })
  }, [cheques, today])

  const cumulativeData = useMemo(() => {
    let running = 0
    return calendarDays.map((d) => {
      running += d.total
      return { ...d, cumulative: running }
    })
  }, [calendarDays])

  const statusBreakdown = useMemo(() => {
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
      fill: STATUS_COLORS[status] ?? '#6b7280',
    }))
  }, [cheques])

  const monthlyTrend = useMemo(() => {
    const months: Record<string, { issued: number; due: number; cleared: number }> = {}
    const start = subDays(today, 180)
    cheques.forEach((c) => {
      const issueMonth = c.issue_date.slice(0, 7)
      const dueMonth = c.due_date.slice(0, 7)
      if (parseISO(c.issue_date) >= start) {
        if (!months[issueMonth]) months[issueMonth] = { issued: 0, due: 0, cleared: 0 }
        months[issueMonth].issued += Number(c.amount)
      }
      if (parseISO(c.due_date) >= start) {
        if (!months[dueMonth]) months[dueMonth] = { issued: 0, due: 0, cleared: 0 }
        months[dueMonth].due += Number(c.amount)
      }
      if (c.status === 'PASSED') {
        // Month it was actually cleared. updated_at changes on any edit, so
        // don't use it; fall back to the due date if no history row exists.
        const passedTs = passedAt.get(c.id)
        const clearMonth = passedTs ? format(parseISO(passedTs), 'yyyy-MM') : c.due_date.slice(0, 7)
        if (!months[clearMonth]) months[clearMonth] = { issued: 0, due: 0, cleared: 0 }
        months[clearMonth].cleared += Number(c.amount)
      }
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month: formatMonthLabel(month), ...data }))
  }, [cheques, passedAt, today])

  const topParties = useMemo(() => {
    const parties: Record<string, { name: string; outstanding: number }> = {}
    cheques
      .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
      .forEach((c) => {
        const id = c.party_id
        if (!parties[id]) parties[id] = { name: c.party?.name ?? 'Unknown', outstanding: 0 }
        parties[id].outstanding += Number(c.amount)
      })
    return Object.values(parties)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 6)
  }, [cheques])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Cash flow overview and upcoming cheque liabilities
        </p>
      </div>

      {/* HERO — answers: how much cash do I need today? */}
      {loading ? (
        <Card className="border-2">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-40" />
              </div>
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <TodayPanel
          cheques={cheques}
          onSelectCheque={setDetailId}
        />
      )}

      {/* 7-day forward strip */}
      {loading ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
          ))}
        </div>
      ) : (
        <Next7DaysStrip
          cheques={cheques}
          onDayClick={setSelectedDay}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        ) : [
          {
            label: 'Total Outstanding',
            value: formatCurrency(outstanding),
            sub: `${dueThisMonth.length} due this month`,
          },
          {
            label: `Due This Week (${format(weekStart, 'EEE')}–${format(weekEnd, 'EEE')})`,
            value: formatCurrency(dueThisWeek.reduce((s, c) => s + Number(c.amount), 0)),
            sub: `${dueThisWeek.length} cheques`,
          },
          {
            label: 'Overdue',
            value: String(overdueCount),
            sub: overdueCount > 0 ? 'review immediately' : 'all clear',
            tone: overdueCount > 0 ? 'danger' : undefined,
          },
          {
            label: 'Returned',
            value: String(returnedCount),
            sub: returnedCount > 0 ? 're-present or write off' : 'none pending',
          },
        ].map(({ label, value, sub, tone }) => (
          <Card key={label} className={tone === 'danger' ? 'border-red-300/70' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={`text-xl font-semibold mt-0.5 ${
                  tone === 'danger' ? 'text-red-600' : ''
                }`}
              >
                {value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly calendar — uses lifted day modal */}
      {loading ? (
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <ChequeCalendar
          cheques={cheques}
          onSelectCheque={setDetailId}
          onDayClick={setSelectedDay}
          title="Monthly Cheque Calendar"
        />
      )}

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {loading ? (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-[280px] w-full rounded" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-[280px] w-full rounded" />
              </CardContent>
            </Card>
          </>
        ) : (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">30-Day Liability Forecast</CardTitle>
            <CardDescription>Stacked daily outflow — pending vs funded</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={calendarDays}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis
                  tickFormatter={(v) => formatChartCurrency(v)}
                  tick={{ fontSize: 10 }}
                  width={55}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.PENDING} name="Pending" />
                <Bar dataKey="deposited" stackId="a" fill={STATUS_COLORS.DEPOSITED} name="Funded" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumulative Liability Curve</CardTitle>
            <CardDescription>Running total of upcoming outflows over 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis
                  tickFormatter={(v) => formatChartCurrency(v)}
                  tick={{ fontSize: 10 }}
                  width={55}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#3b82f6"
                  fill="url(#cumGradient)"
                  name="Cumulative"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </>
        )}
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-[240px] w-full rounded" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-[240px] w-full rounded" />
              </CardContent>
            </Card>
          </>
        ) : (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
            <CardDescription>By amount across all cheques</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">6-Month Cash Flow Trend</CardTitle>
            <CardDescription>Issued vs due vs cleared amounts by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => formatChartCurrency(v)}
                  tick={{ fontSize: 10 }}
                  width={55}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Bar dataKey="issued" fill="#3b82f6" name="Issued" barSize={16} radius={[3, 3, 0, 0]} />
                <Bar dataKey="due" fill="#f59e0b" name="Due" barSize={16} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="cleared" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Cleared" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </>
        )}
      </div>

      {/* Top parties */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-[180px] w-full rounded" />
          </CardContent>
        </Card>
      ) : topParties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Outstanding by Party</CardTitle>
            <CardDescription>Largest pending + funded amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, topParties.length * 40)}>
              <BarChart data={topParties} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatChartCurrency(v)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="outstanding" fill="#8b5cf6" name="Outstanding" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-2 w-2 rounded-full mt-2 shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent activity</p>
          ) : (
            history.map((h) => {
              const cheque = h.cheque as Cheque | undefined
              const partyName = cheque?.party?.name ?? 'Unknown'
              const amount = cheque ? formatCurrency(Number(cheque.amount)) : ''
              const via =
                h.changed_by === 'deposit_allocation'
                  ? ' via Add funds'
                  : h.changed_by === 'auto'
                  ? ' (auto)'
                  : h.changed_by === 'rollback'
                  ? ' (rolled back)'
                  : h.from_status === 'RETURNED' && h.to_status === 'PENDING'
                  ? ' (re-presented)'
                  : ''
              return (
                <div
                  key={h.id}
                  className="flex items-start gap-3 text-sm border-b pb-2 last:border-0"
                >
                  <span
                    className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[h.to_status] ?? CHART_COLORS[0] }}
                  />
                  <p>
                    <span className="font-medium">{amount}</span> cheque to {partyName} marked{' '}
                    {STATUS_LABELS[h.to_status] ?? h.to_status}
                    {via} —{' '}
                    <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  </p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Shared day-modal — driven by TodayPanel/Strip/Calendar */}
      <DayChequesDialog
        cheques={cheques}
        date={selectedDay}
        onChangeDate={setSelectedDay}
        onClose={() => setSelectedDay(null)}
        onSelectCheque={setDetailId}
      />

      <ChequeDetail
        chequeId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(c) => {
          setDetailId(null)
          setEditCheque(c)
          setFormOpen(true)
        }}
        onRefresh={loadDashboardData}
      />

      <ChequeForm
        open={formOpen || !!editCheque}
        onOpenChange={(o) => {
          if (!o) {
            setFormOpen(false)
            setEditCheque(null)
          }
        }}
        cheque={editCheque}
        onSubmit={async (data) => {
          if (!editCheque) return
          const { error } = await supabase.from('cheques').update(data).eq('id', editCheque.id)
          if (error) {
            toast.error(`Failed to save cheque: ${error.message}`)
            return false
          }
          toast.success('Cheque updated')
          loadDashboardData()
        }}
        onStatusChange={loadDashboardData}
      />
    </div>
  )
}
