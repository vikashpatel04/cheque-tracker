import type { DirectionTab, ListRow } from './chequeList'
import { daysBetween } from './receivedSchedule'
import {
  AGE_BUCKETS,
  aroundToday,
  bounceRate,
  bouncedCheques,
  bouncesByParty,
  bouncesByReason,
  cashFlowDays,
  collectionAgeing,
  fundsAndPayments,
  fundsByMonth,
  givenByBank,
  givenReturned,
  givenTrend,
  monthlyFlow,
  overviewFigures,
  partyLines,
  paymentMonths,
  receivedByAccount,
  runningTotals,
  standing,
  stillToCollect,
  type AccountLine,
  type AgeTotal,
  type AroundToday,
  type BankLine,
  type BounceGroup,
  type BounceItem,
  type BounceRate,
  type CashDay,
  type FundsDay,
  type FundsMonth,
  type MonthFlow,
  type OverviewFigures,
  type PartyLine,
  type PaymentMonth,
  type RunningDay,
  type StatusTotal,
  type TrendMonth,
} from './reports'
import { STATUS_LABELS, type ChequeStatus, type DailyDeposit } from '@/types'
import { RECEIVED_STATUS_LABELS, type BankAccount, type ReceivedStatus } from '@/types/received'

/**
 * What each Reports tab shows: its figures and chart series, and its tables,
 * which the screen draws and "Export this tab" writes to PDF or Excel. Pure;
 * amounts stay numbers until they're drawn or written.
 */

export type ReportTab = 'overview' | 'cash' | 'collections' | 'payments' | 'parties' | 'bounces' | 'accounts'

export const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cash', label: 'Cash flow' },
  { key: 'collections', label: 'Collections' },
  { key: 'payments', label: 'Payments' },
  { key: 'parties', label: 'Parties' },
  { key: 'bounces', label: 'Bounces' },
  { key: 'accounts', label: 'Accounts and funds' },
]

/**
 * `net`: an amount that can go either way, written in words, e.g. "₹5,000 to
 * collect" / "₹2,000 to pay" (no minus signs, plan item 70). Its `words` are
 * the positive and negative phrases. Spreadsheets get the signed number.
 */
export type ColumnKind = 'text' | 'money' | 'count' | 'date' | 'month' | 'percent' | 'net'

export interface ReportColumn {
  label: string
  kind: ColumnKind
  words?: [positive: string, negative: string]
  /** A negative `net` is a problem (a shortfall), not just the other way. */
  alarm?: boolean
}

export type ReportCell = string | number | null

/** Where a row leads when tapped: a party's ledger or a cheque. */
export type RowTarget = { party: string } | { cheque: ListRow } | null

export interface ReportTable {
  key: string
  title: string
  note?: string
  columns: ReportColumn[]
  rows: ReportCell[][]
  targets?: RowTarget[]
  /** A last row of totals. */
  total?: ReportCell[]
}

export interface ReportInput {
  dir: DirectionTab
  /** Rows with every filter applied. */
  rows: ListRow[]
  /** Rows with every filter but the dates, for views tied to today. */
  undated: ListRow[]
  /** Funds added within the dates, and all of them. */
  deposits: DailyDeposit[]
  allDeposits: DailyDeposit[]
  accounts: BankAccount[]
  /** Given cheques that were returned at some point (from their history). */
  everReturned: Set<string>
  /** When given cheques passed (yyyy-MM-dd), from their history. */
  passedOn: Map<string, string>
  today: string
  /** The months the dates cover (`reportMonths`). */
  months: string[]
}

const showsIn = (dir: DirectionTab) => dir !== 'given'
const showsOut = (dir: DirectionTab) => dir !== 'received'

export function statusLabel(direction: 'in' | 'out', status: string): string {
  return direction === 'out' ? STATUS_LABELS[status as ChequeStatus] ?? status : RECEIVED_STATUS_LABELS[status as ReceivedStatus] ?? status
}

const money = (label: string): ReportColumn => ({ label, kind: 'money' })
const count = (label: string): ReportColumn => ({ label, kind: 'count' })
const text = (label: string): ReportColumn => ({ label, kind: 'text' })
const sum = <T>(items: T[], value: (item: T) => number) => items.reduce((s, item) => s + value(item), 0)
const share = (part: number, whole: number) => (whole ? part / whole : 0)

/* ---------- Overview ---------- */

export interface OverviewReport {
  figures: OverviewFigures
  months: MonthFlow[]
  received: StatusTotal[]
  given: StatusTotal[]
  parties: PartyLine[]
  tables: ReportTable[]
}

export function overviewReport(input: ReportInput): OverviewReport {
  const { dir, rows, today } = input
  const figures = overviewFigures(rows)
  const months = monthlyFlow(rows, input.months)
  const received = showsIn(dir) ? standing(rows, 'in') : []
  const given = showsOut(dir) ? standing(rows, 'out') : []
  const parties = partyLines(rows, today).slice(0, 5)

  const totals: ReportCell[][] = []
  if (showsIn(dir)) {
    totals.push(['Received', figures.received.amount, figures.received.count])
    totals.push(['Still to collect', figures.toCollect.amount, figures.toCollect.count])
  }
  if (showsOut(dir)) {
    totals.push(['Given', figures.given.amount, figures.given.count])
    totals.push(['Still to pay', figures.toPay.amount, figures.toPay.count])
  }

  const byMonthColumns: ReportColumn[] = [{ label: 'Month', kind: 'month' }]
  if (showsIn(dir)) byMonthColumns.push(money('In'), count('Cheques in'), money('Cleared'))
  if (showsOut(dir)) byMonthColumns.push(money('Out'), count('Cheques out'), money('Passed'))
  const byMonthRow = (m: MonthFlow): ReportCell[] => [
    m.month,
    ...(showsIn(dir) ? [m.in, m.inCount, m.cleared] : []),
    ...(showsOut(dir) ? [m.out, m.outCount, m.passed] : []),
  ]

  const stand = [
    ...received.map((s): ReportCell[] => ['Received', statusLabel('in', s.status), s.count, s.amount]),
    ...given.map((s): ReportCell[] => ['Given', statusLabel('out', s.status), s.count, s.amount]),
  ]

  return {
    figures,
    months,
    received,
    given,
    parties,
    tables: [
      { key: 'totals', title: 'Totals', columns: [text('Figure'), money('Amount'), count('Cheques')], rows: totals },
      { key: 'months', title: 'Money in and out by month', columns: byMonthColumns, rows: months.map(byMonthRow) },
      { key: 'stand', title: 'Where the cheques stand', columns: [text('Direction'), text('Status'), count('Cheques'), money('Amount')], rows: stand },
      {
        key: 'biggest',
        title: 'Biggest parties',
        columns: [
          text('Party'),
          ...(showsOut(dir) ? [money('Given')] : []),
          ...(showsIn(dir) ? [money('Received')] : []),
          ...(dir === 'all' ? [{ label: 'Net still due', kind: 'net' as const, words: ['to collect', 'to pay'] as [string, string] }] : []),
        ],
        rows: parties.map((p) => [
          p.party,
          ...(showsOut(dir) ? [p.gave.amount] : []),
          ...(showsIn(dir) ? [p.got.amount] : []),
          ...(dir === 'all' ? [p.net] : []),
        ]),
        targets: parties.map((p) => ({ party: p.partyId })),
      },
    ],
  }
}

/* ---------- Cash flow ---------- */

export interface CashReport {
  days: CashDay[]
  around: AroundToday
  running: RunningDay[]
  trend: TrendMonth[]
  months: MonthFlow[]
  tables: ReportTable[]
}

export function cashReport(input: ReportInput): CashReport {
  const { dir, undated, today } = input
  const days = cashFlowDays(undated, input.allDeposits, today)
  const around = aroundToday(days)
  const running = runningTotals(undated, today)
  const trend = showsOut(dir) ? givenTrend(undated, input.passedOn, today) : []
  const months = monthlyFlow(input.rows, input.months)

  const dayColumns: ReportColumn[] = [{ label: 'Date', kind: 'date' }]
  if (showsOut(dir)) {
    dayColumns.push(money('Pending'), money('Funded'), money('Needed'), money('Funds added'), {
      label: 'Funds against need',
      kind: 'net',
      words: ['spare', 'short'],
      alarm: true,
    })
  }
  if (showsIn(dir)) dayColumns.push(money('Expected in'), money('Cleared'))
  // Most days have nothing in most columns: blanks read more easily than rows of zeros.
  const blank = (value: number) => value || null
  const dayRow = (d: CashDay): ReportCell[] => [
    d.date,
    ...(showsOut(dir) ? [blank(d.pending), blank(d.funded), blank(d.needed), blank(d.fundsAdded), d.needed || d.fundsAdded ? d.gap : null] : []),
    ...(showsIn(dir) ? [blank(d.expected), blank(d.cleared)] : []),
  ]

  const runningColumns: ReportColumn[] = [{ label: 'Date', kind: 'date' }]
  if (showsOut(dir)) runningColumns.push(money('Out by then'))
  if (showsIn(dir)) runningColumns.push(money('In by then'))

  const monthColumns: ReportColumn[] = [{ label: 'Month', kind: 'month' }]
  if (showsIn(dir)) monthColumns.push(money('In'), money('Cleared'))
  if (showsOut(dir)) monthColumns.push(money('Out'), money('Passed'))
  if (dir === 'all') monthColumns.push({ label: 'In against out', kind: 'net', words: ['more in', 'more out'] })

  const tables: ReportTable[] = [
    {
      key: 'days',
      title: 'Day by day',
      note: 'The 14 days before today and the 14 from today, whatever the dates filter says. Past days show what passed; today and later show what still needs money.',
      columns: dayColumns,
      rows: days.map(dayRow),
    },
    {
      key: 'running',
      title: 'Running total, next 30 days',
      note: 'How much will have gone out and come in by each day. Overdue cheques count from today.',
      columns: runningColumns,
      rows: running.map((d) => [d.date, ...(showsOut(dir) ? [d.out] : []), ...(showsIn(dir) ? [d.in] : [])]),
    },
  ]
  if (showsOut(dir)) {
    tables.push({
      key: 'trend',
      title: 'Given cheques, last six months',
      note: 'Written by issue date, due by due date, passed by the day they passed.',
      columns: [{ label: 'Month', kind: 'month' }, money('Written'), money('Due'), money('Passed')],
      rows: trend.map((m) => [m.month, m.issued, m.due, m.cleared]),
    })
  }
  tables.push({
    key: 'months',
    title: 'Month by month',
    columns: monthColumns,
    rows: months.map((m) => [
      m.month,
      ...(showsIn(dir) ? [m.in, m.cleared] : []),
      ...(showsOut(dir) ? [m.out, m.passed] : []),
      ...(dir === 'all' ? [m.in - m.out] : []),
    ]),
  })
  return { days, around, running, trend, months, tables }
}

/* ---------- Collections ---------- */

export interface CollectionsReport {
  toCollect: { amount: number; count: number }
  clearing: { amount: number; count: number }
  bounced: { amount: number; count: number }
  rate: BounceRate
  ageing: AgeTotal[]
  open: ListRow[]
  owers: { partyId: string; party: string; count: number; amount: number; oldest: string }[]
  tables: ReportTable[]
}

export function collectionsReport(input: ReportInput): CollectionsReport {
  const { rows, today } = input
  const open = stillToCollect(rows)
  const ageing = collectionAgeing(rows, today)
  const rate = bounceRate(rows)
  const pick = (status: string) => {
    const matching = open.filter((r) => r.status === status)
    return { amount: sum(matching, (r) => r.amount ?? 0), count: matching.length }
  }
  const owerMap = new Map<string, CollectionsReport['owers'][number]>()
  for (const r of open) {
    const ower = owerMap.get(r.partyId) ?? { partyId: r.partyId, party: r.party, count: 0, amount: 0, oldest: r.due }
    ower.count++
    ower.amount += r.amount ?? 0
    if (r.due < ower.oldest) ower.oldest = r.due
    owerMap.set(r.partyId, ower)
  }
  const owers = [...owerMap.values()].sort((a, b) => b.amount - a.amount || a.party.localeCompare(b.party))
  const totalOpen = sum(ageing, (a) => a.amount)

  return {
    toCollect: { amount: totalOpen, count: open.length },
    clearing: pick('DEPOSITED'),
    bounced: pick('BOUNCED'),
    rate,
    ageing,
    open,
    owers,
    tables: [
      {
        key: 'ageing',
        title: 'Ageing',
        note: "Money still to collect, by how many days past the cheque's date it is.",
        columns: [text('Age'), count('Cheques'), money('Amount'), { label: 'Share', kind: 'percent' }],
        rows: ageing.map((a) => [AGE_BUCKETS.find((b) => b.key === a.bucket)!.label, a.count, a.amount, share(a.amount, totalOpen)]),
        total: ['Total', open.length, totalOpen, totalOpen ? 1 : 0],
      },
      {
        key: 'owers',
        title: 'Who owes most',
        columns: [text('Party'), count('Cheques'), money('Still to collect'), { label: 'Oldest date', kind: 'date' }],
        rows: owers.map((o) => [o.party, o.count, o.amount, o.oldest]),
        targets: owers.map((o) => ({ party: o.partyId })),
      },
      {
        key: 'open',
        title: 'Still to collect, oldest first',
        columns: [{ label: 'Date', kind: 'date' }, text('Party'), text('Cheque no.'), text('Status'), count('Days past date'), money('Amount')],
        rows: open.map((r) => {
          const late = daysBetween(r.due, today)
          return [r.due, r.party, r.number, statusLabel('in', r.status), late >= 0 ? late : null, r.amount ?? 0]
        }),
        targets: open.map((r) => ({ cheque: r })),
      },
      {
        key: 'rate',
        title: 'Bounce rate',
        note: 'Of the cheques you deposited, how many bounced at least once.',
        columns: [text('Measure'), count('Deposited'), count('Bounced'), { label: 'Rate', kind: 'percent' }],
        rows: [
          ['Cheques', rate.deposited, rate.bounced, share(rate.bounced, rate.deposited)],
          ['Amount', rate.depositedAmount, rate.bouncedAmount, share(rate.bouncedAmount, rate.depositedAmount)],
        ],
      },
    ],
  }
}

/* ---------- Payments ---------- */

export interface PaymentsReport {
  given: { amount: number; count: number }
  passed: number
  toPay: { amount: number; notFunded: number }
  returned: { amount: number; count: number }
  months: PaymentMonth[]
  statuses: StatusTotal[]
  tables: ReportTable[]
}

export function paymentsReport(input: ReportInput): PaymentsReport {
  const { rows, everReturned } = input
  const figures = overviewFigures(rows)
  const months = paymentMonths(rows, input.months, everReturned)
  const statuses = standing(rows, 'out', true)
  const returned = rows.filter((r) => givenReturned(r, everReturned))
  const monthTotal = (key: keyof Omit<PaymentMonth, 'month'>) => sum(months, (m) => m[key])
  return {
    given: { amount: figures.given.amount, count: figures.given.count },
    passed: figures.given.passed,
    toPay: { amount: figures.toPay.amount, notFunded: figures.toPay.notFunded },
    returned: { amount: sum(returned, (r) => r.amount ?? 0), count: returned.length },
    months,
    statuses,
    tables: [
      {
        key: 'months',
        title: 'Month by month',
        note: 'Given cheques by due month. Returned counts any that came back, even if paid later.',
        columns: [{ label: 'Month', kind: 'month' }, count('Cheques'), money('Given'), money('Passed'), money('Returned'), money('Still to pay')],
        rows: months.map((m) => [m.month, m.count, m.given, m.passed, m.returned, m.stillToPay]),
        total: ['Total', monthTotal('count'), monthTotal('given'), monthTotal('passed'), monthTotal('returned'), monthTotal('stillToPay')],
      },
      {
        key: 'statuses',
        title: 'By status',
        columns: [text('Status'), count('Cheques'), money('Amount')],
        rows: statuses.map((s) => [statusLabel('out', s.status), s.count, s.amount]),
      },
    ],
  }
}

/* ---------- Parties ---------- */

function partiesTable(lines: PartyLine[], dir: DirectionTab, title: string, key: string): ReportTable {
  const columns: ReportColumn[] = [text('Party')]
  if (showsOut(dir)) columns.push(money('Given'), money('Passed'), money('Still to pay'))
  if (showsIn(dir)) columns.push(money('Received'), money('Cleared'), money('Still to collect'))
  if (dir === 'all') columns.push({ label: 'Net still due', kind: 'net', words: ['to collect', 'to pay'] })
  columns.push(count('Bounces'))
  return {
    key,
    title,
    columns,
    rows: lines.map((p) => [
      p.party,
      ...(showsOut(dir) ? [p.gave.amount, p.gave.passed, p.pay.amount] : []),
      ...(showsIn(dir) ? [p.got.amount, p.got.cleared, p.collect.amount] : []),
      ...(dir === 'all' ? [p.net] : []),
      p.bounces,
    ]),
    targets: lines.map((p) => ({ party: p.partyId })),
  }
}

export interface PartiesReport {
  lines: PartyLine[]
  tables: ReportTable[]
}

export function partiesReport(input: ReportInput): PartiesReport {
  const lines = partyLines(input.rows, input.today)
  return { lines, tables: [partiesTable(lines, input.dir, 'Every party', 'parties')] }
}

/* ---------- Bounces ---------- */

export interface BouncesReport {
  items: BounceItem[]
  given: { count: number; amount: number; open: number }
  received: { count: number; amount: number; open: number; charges: number }
  rate: BounceRate
  byParty: BounceGroup[]
  byReason: BounceGroup[]
  tables: ReportTable[]
}

export function bouncesReport(input: ReportInput): BouncesReport {
  const items = bouncedCheques(input.rows, input.everReturned)
  const side = (direction: 'in' | 'out') => items.filter((i) => i.row.direction === direction)
  const totals = (list: BounceItem[]) => ({
    count: list.length,
    amount: sum(list, (i) => i.row.amount ?? 0),
    open: sum(list, (i) => (i.open ? i.row.amount ?? 0 : 0)),
  })
  const byParty = bouncesByParty(items)
  const byReason = bouncesByReason(items)
  const groupColumns = (first: string): ReportColumn[] => [text(first), count('Times'), money('Amount'), money('Still owed')]
  return {
    items,
    given: totals(side('out')),
    received: { ...totals(side('in')), charges: sum(side('in'), (i) => i.charges) },
    rate: bounceRate(input.rows),
    byParty,
    byReason,
    tables: [
      {
        key: 'cheques',
        title: 'Cheques that came back',
        note: 'Given cheques returned unpaid and received cheques that bounced, latest first. "Now" is where each one stands today.',
        columns: [
          { label: 'Date', kind: 'date' },
          text('Party'),
          text('Direction'),
          text('Cheque no.'),
          money('Amount'),
          text('Reason'),
          text('Now'),
        ],
        rows: items.map((i) => [
          i.row.due,
          i.row.party,
          i.row.direction === 'in' ? 'Received' : 'Given',
          i.row.number,
          i.row.amount ?? 0,
          i.reason?.trim() || '',
          statusLabel(i.row.direction, i.row.status),
        ]),
        targets: items.map((i) => ({ cheque: i.row })),
      },
      {
        key: 'parties',
        title: 'By party',
        columns: groupColumns('Party'),
        rows: byParty.map((g) => [g.label, g.count, g.amount, g.open]),
        targets: byParty.map((g) => ({ party: g.key })),
      },
      {
        key: 'reasons',
        title: 'By reason',
        columns: groupColumns('Reason'),
        rows: byReason.map((g) => [g.label || 'No reason noted', g.count, g.amount, g.open]),
      },
    ],
  }
}

/* ---------- Accounts and funds ---------- */

export interface AccountsReport {
  funds: { amount: number; days: number }
  payments: number
  banks: BankLine[]
  accounts: AccountLine[]
  days: FundsDay[]
  months: FundsMonth[]
  tables: ReportTable[]
}

export function accountName(line: Pick<AccountLine, 'account'>): string {
  if (!line.account) return 'Removed account'
  return line.account.last4 ? `${line.account.name} ···${line.account.last4}` : line.account.name
}

export function accountsReport(input: ReportInput): AccountsReport {
  const { dir, rows, deposits } = input
  const banks = showsOut(dir) ? givenByBank(rows) : []
  const accounts = showsIn(dir) ? receivedByAccount(rows, input.accounts) : []
  const days = showsOut(dir) ? fundsAndPayments(rows, deposits) : []
  const months = showsOut(dir) ? fundsByMonth(rows, deposits, input.months) : []
  const bankTotal = sum(banks, (b) => b.amount)
  const tables: ReportTable[] = []
  if (showsOut(dir)) {
    tables.push({
      key: 'banks',
      title: 'Given cheques by bank',
      columns: [text('Bank'), count('Cheques'), money('Amount'), { label: 'Share', kind: 'percent' }, money('Passed'), money('Still to pay')],
      rows: banks.map((b) => [b.bank || 'No bank noted', b.count, b.amount, share(b.amount, bankTotal), b.passed, b.stillToPay]),
    })
  }
  if (showsIn(dir)) {
    tables.push({
      key: 'accounts',
      title: 'Received cheques by account',
      note: 'Cheques deposited into each of your accounts.',
      columns: [text('Account'), count('Cheques'), money('Deposited'), money('Cleared'), money('In clearing'), money('Bounced')],
      rows: accounts.map((a) => [accountName(a), a.count, a.deposited, a.cleared, a.clearing, a.bounced]),
    })
  }
  if (showsOut(dir)) {
    tables.push(
      {
        key: 'fund-months',
        title: 'Funds added and cheque payments by month',
        note: 'Payments are given cheques funded or passed, by due date.',
        columns: [{ label: 'Month', kind: 'month' }, money('Funds added'), count('Days with funds added'), money('Cheque payments')],
        rows: months.map((m) => [m.month, m.funds, m.days, m.payments]),
      },
      {
        key: 'fund-days',
        title: 'Funds added and cheque payments by day',
        note: 'The latest 60 days with either, with running totals over them.',
        columns: [{ label: 'Date', kind: 'date' }, money('Funds added'), money('Cheque payments'), money('Funds added so far'), money('Payments so far')],
        rows: days.map((d) => [d.date, d.funds, d.payments, d.totalFunds, d.totalPayments]),
      }
    )
  }
  return {
    funds: { amount: sum(deposits, (d) => Number(d.amount)), days: new Set(deposits.map((d) => d.deposit_date)).size },
    payments: sum(months, (m) => m.payments),
    banks,
    accounts,
    days,
    months,
    tables,
  }
}

/* ---------- Any tab ---------- */

export function reportTables(tab: ReportTab, input: ReportInput): ReportTable[] {
  switch (tab) {
    case 'overview':
      return overviewReport(input).tables
    case 'cash':
      return cashReport(input).tables
    case 'collections':
      return collectionsReport(input).tables
    case 'payments':
      return paymentsReport(input).tables
    case 'parties':
      return partiesReport(input).tables
    case 'bounces':
      return bouncesReport(input).tables
    case 'accounts':
      return accountsReport(input).tables
  }
}
