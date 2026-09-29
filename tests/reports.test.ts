import { describe, expect, it } from 'vitest'
import { givenRow, receivedRow } from '@/lib/chequeList'
import { formatCurrencyCode } from '@/lib/formatters'
import { pdfCell, sheetCell } from '@/lib/reportExport'
import {
  ageBucket,
  aroundToday,
  bounceRate,
  bouncedCheques,
  bouncesByReason,
  cashFlowDays,
  collectionAgeing,
  fundsAndPayments,
  fundsByMonth,
  givenByBank,
  givenTrend,
  monthlyFlow,
  overviewFigures,
  paymentMonths,
  receivedByAccount,
  reportMonths,
  runningTotals,
  standing,
} from '@/lib/reports'
import { cashReport, overviewReport, type ReportInput } from '@/lib/reportTables'
import type { Cheque, ChequeStatus, DailyDeposit } from '@/types'
import type { BankAccount, ReceivedCheque, ReceivedStatus } from '@/types/received'

const TODAY = '2026-09-29'
let n = 0

function given(status: ChequeStatus, due: string, amount: number, extra: Partial<Cheque> = {}) {
  n++
  return givenRow({
    id: `g${n}`, user_id: 'u', party_id: 'p1', cheque_number: `${n}`, bank_name: 'First Bank', amount, issue_date: '2026-09-01', due_date: due,
    status, return_reason: null, auto_transition_blocked: false, notes: null, original_due_date: null, represent_count: 0,
    write_off_reason: null, replaces_cheque_id: null, deleted_at: null, created_at: '', updated_at: '',
    party: { id: extra.party_id ?? 'p1', name: 'Party' } as Cheque['party'], ...extra,
  })
}

function received(status: ReceivedStatus, due: string, amount: number | null, extra: Partial<ReceivedCheque> = {}) {
  n++
  return receivedRow({
    id: `r${n}`, user_id: 'u', party_id: 'p2', kind: 'REGULAR', cheque_number: `${n}`, bank_name: 'Other Bank', amount, received_on: '2026-09-01',
    cheque_date: due, due_date: due, status, deposit_account_id: null, deposited_on: null, cleared_on: null, bounced_on: null,
    bounce_reason: null, bank_charges: null, settled_on: null, settled_via: null, settlement_ref: null, close_reason: null,
    redeposit_count: 0, replaces_id: null, series_id: null, series_index: null, notes: null, deleted_at: null, created_at: '',
    updated_at: '', ...extra,
  })
}

const deposit = (date: string, amount: number): DailyDeposit => ({ id: `d${date}${amount}`, user_id: 'u', amount, deposit_date: date, notes: null, created_at: '' })

describe('report months', () => {
  it('are the six up to this month without dates, or those in the dates', () => {
    expect(reportMonths(null, null, TODAY)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(reportMonths('2026-08-15', '2026-10-02', TODAY)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(reportMonths('2027-01-01', null, TODAY)).toEqual(['2027-01'])
  })

  it('keep the latest twelve of a long range', () => {
    const months = reportMonths('2024-01-01', '2026-09-30', TODAY)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2025-10')
    expect(months[11]).toBe('2026-09')
  })
})

describe('overview', () => {
  const rows = [
    given('PENDING', '2026-10-02', 40000),
    given('DEPOSITED', '2026-09-30', 10000),
    given('PASSED', '2026-09-10', 25000),
    given('RETURNED', '2026-09-20', 5000),
    given('CANCELLED', '2026-09-05', 9000),
    // An old-style re-presentment: the returned original doesn't count, its copy does.
    given('RETURNED', '2026-08-20', 7000, { notes: '[RE_PRESENTED] 2026-08-25' }),
    received('CLEARED', '2026-09-12', 30000),
    received('DEPOSITED', '2026-09-27', 20000, { deposited_on: '2026-09-27' }),
    received('IN_HAND', '2026-10-05', 15000),
    received('BOUNCED', '2026-09-15', 8000, { deposited_on: '2026-09-14', bounced_on: '2026-09-16' }),
    received('HANDED_BACK', '2026-09-01', 50000),
    received('IN_HAND', '2026-12-01', 90000, { kind: 'SECURITY' }),
  ]

  it('adds up both ways, leaving out cheques that never moved money', () => {
    const f = overviewFigures(rows)
    expect(f.given).toEqual({ amount: 80000, count: 4, passed: 25000 })
    expect(f.toPay).toEqual({ amount: 55000, count: 3, notFunded: 40000, returned: 5000 })
    expect(f.received).toEqual({ amount: 73000, count: 4, cleared: 30000 })
    expect(f.toCollect).toEqual({ amount: 43000, count: 3, clearing: 20000, bounced: 8000 })
    expect(f.securityHeld).toBe(1)
  })

  it('splits money by due month, and by status in a fixed order', () => {
    const [aug, sep, oct] = monthlyFlow(rows, ['2026-08', '2026-09', '2026-10'])
    expect(aug).toMatchObject({ in: 0, out: 0 })
    expect(sep).toMatchObject({ in: 58000, inCount: 3, cleared: 30000, out: 40000, outCount: 3, passed: 25000 })
    expect(oct).toMatchObject({ in: 15000, out: 40000 })
    expect(standing(rows, 'out').map((s) => s.status)).toEqual(['PASSED', 'DEPOSITED', 'PENDING', 'RETURNED'])
    expect(standing(rows, 'out', true).map((s) => s.status)).toEqual(['PASSED', 'DEPOSITED', 'PENDING', 'RETURNED', 'CANCELLED'])
    expect(standing(rows, 'in').map((s) => s.status)).toEqual(['CLEARED', 'DEPOSITED', 'IN_HAND', 'BOUNCED'])
  })

  it('shows one direction only when asked', () => {
    const input: ReportInput = {
      dir: 'given', rows: rows.filter((r) => r.direction === 'out'), undated: [], deposits: [], allDeposits: [], accounts: [],
      everReturned: new Set(), passedOn: new Map(), today: TODAY, months: ['2026-09'],
    }
    const report = overviewReport(input)
    expect(report.tables.find((t) => t.key === 'totals')!.rows.map((r) => r[0])).toEqual(['Given', 'Still to pay'])
    expect(report.tables.find((t) => t.key === 'biggest')!.columns.map((c) => c.label)).not.toContain('Net still due')
  })
})

describe('cash flow', () => {
  const rows = [
    given('PASSED', '2026-09-25', 10000),
    given('PENDING', '2026-09-29', 4000),
    given('DEPOSITED', '2026-09-29', 6000),
    given('PENDING', '2026-10-03', 3000),
    given('PENDING', '2026-09-20', 2000), // overdue, still to pay
    received('CLEARED', '2026-09-26', 7000),
    received('IN_HAND', '2026-10-01', 9000),
  ]
  const deposits = [deposit('2026-09-25', 8000), deposit('2026-09-29', 6000)]

  it('shows what passed on past days and what is still needed from today', () => {
    const days = cashFlowDays(rows, deposits, TODAY)
    expect(days).toHaveLength(28)
    const past = days.find((d) => d.date === '2026-09-25')!
    expect(past).toMatchObject({ needed: 10000, fundsAdded: 8000, gap: -2000 })
    const today = days.find((d) => d.isToday)!
    expect(today).toMatchObject({ needed: 10000, fundsAdded: 6000, gap: -4000 })
    expect(days.find((d) => d.date === '2026-10-01')!.expected).toBe(9000)
    const around = aroundToday(days)
    expect(around.neededToday).toBe(10000)
    expect(around.next).toEqual({ out: 13000, outCount: 3, in: 9000, inCount: 1 })
    expect(around.past).toEqual({ paid: 10000, funds: 8000, cleared: 7000 })
  })

  it('runs totals forward, counting overdue cheques from today', () => {
    const running = runningTotals(rows, TODAY, 5)
    expect(running.map((d) => d.out)).toEqual([12000, 12000, 12000, 12000, 15000])
    expect(running.map((d) => d.in)).toEqual([0, 0, 9000, 9000, 9000])
  })

  it('puts a passed cheque in the month it passed', () => {
    const late = given('PASSED', '2026-08-28', 5000, { issue_date: '2026-07-01' })
    const trend = givenTrend([late], new Map([[late.id, '2026-09-02']]), TODAY)
    expect(trend.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(trend.find((m) => m.month === '2026-07')!.issued).toBe(5000)
    expect(trend.find((m) => m.month === '2026-08')!.due).toBe(5000)
    expect(trend.find((m) => m.month === '2026-09')!.cleared).toBe(5000)
  })

  it('gives 28 day rows in its table, with a shortfall as words', () => {
    const input: ReportInput = {
      dir: 'all', rows, undated: rows, deposits, allDeposits: deposits, accounts: [], everReturned: new Set(),
      passedOn: new Map(), today: TODAY, months: ['2026-09'],
    }
    const days = cashReport(input).tables.find((t) => t.key === 'days')!
    expect(days.rows).toHaveLength(28)
    const gap = days.columns.findIndex((c) => c.label === 'Funds against need')
    const todayRow = days.rows.find((r) => r[0] === TODAY)!
    expect(pdfCell(days.columns[gap], todayRow[gap])).toBe(`${formatCurrencyCode(4000)} short`)
    expect(sheetCell(days.columns[gap], todayRow[gap])).toBe(-4000)
  })
})

describe('collections', () => {
  it('ages money still to collect by days past its date', () => {
    expect([-1, 0, 30, 31, 60, 61, 90, 91].map(ageBucket)).toEqual([
      'not_due', 'd0_30', 'd0_30', 'd31_60', 'd31_60', 'd61_90', 'd61_90', 'd90_plus',
    ])
    const rows = [
      received('IN_HAND', '2026-10-10', 1000),
      received('IN_HAND', '2026-09-20', 2000),
      received('BOUNCED', '2026-06-01', 3000, { deposited_on: '2026-06-01', bounced_on: '2026-06-03' }),
      received('CLEARED', '2026-05-01', 4000),
      received('IN_HAND', '2026-01-01', 5000, { kind: 'SECURITY' }),
    ]
    const ageing = collectionAgeing(rows, TODAY)
    expect(ageing.map((a) => [a.bucket, a.amount])).toEqual([
      ['not_due', 1000], ['d0_30', 2000], ['d31_60', 0], ['d61_90', 0], ['d90_plus', 3000],
    ])
  })

  it('works out the bounce rate from cheques that were deposited', () => {
    const rows = [
      received('CLEARED', '2026-09-01', 10000, { deposited_on: '2026-09-01' }),
      received('CLEARED', '2026-09-02', 5000, { deposited_on: '2026-09-02', redeposit_count: 1, bounced_on: '2026-09-04' }),
      received('SETTLED', '2026-09-03', 2000, { deposited_on: '2026-09-03', bounced_on: '2026-09-05' }),
      received('IN_HAND', '2026-10-01', 7000),
      received('SETTLED', '2026-09-04', 1000),
    ]
    expect(bounceRate(rows)).toEqual({ deposited: 3, bounced: 2, depositedAmount: 17000, bouncedAmount: 7000 })
  })
})

describe('payments and bounces', () => {
  it('counts a returned cheque that was paid later as returned, and not still to pay', () => {
    const paidLater = given('PASSED', '2026-09-10', 6000)
    const rows = [paidLater, given('RETURNED', '2026-09-12', 4000, { return_reason: 'Funds insufficient' }), given('PENDING', '2026-09-30', 1000)]
    const [sep] = paymentMonths(rows, ['2026-09'], new Set([paidLater.id]))
    expect(sep).toEqual({ month: '2026-09', count: 3, given: 11000, passed: 6000, returned: 10000, stillToPay: 5000 })

    const items = bouncedCheques(rows, new Set([paidLater.id]))
    expect(items.map((i) => [i.row.id, i.open])).toEqual([
      [rows[1].id, true],
      [paidLater.id, false],
    ])
    expect(bouncesByReason(items).map((g) => [g.label, g.count, g.open])).toEqual([
      ['Funds insufficient', 1, 4000],
      ['', 1, 0],
    ])
  })
})

describe('accounts and funds', () => {
  const account: BankAccount = { id: 'a1', user_id: 'u', name: 'Main', bank_name: 'Home Bank', last4: '0000', is_default: true, deleted_at: null, created_at: '' }

  it('totals given cheques by bank and received ones by the account they went into', () => {
    const rows = [
      given('PASSED', '2026-09-10', 6000, { bank_name: 'First Bank' }),
      given('PENDING', '2026-09-30', 1000, { bank_name: 'Second Bank' }),
      given('PENDING', '2026-10-30', 3000, { bank_name: 'First Bank' }),
      received('CLEARED', '2026-09-10', 5000, { deposit_account_id: 'a1', deposited_on: '2026-09-10' }),
      received('DEPOSITED', '2026-09-28', 2000, { deposit_account_id: 'a1', deposited_on: '2026-09-28' }),
      // Planned for the account but not deposited yet.
      received('IN_HAND', '2026-10-10', 9000, { deposit_account_id: 'a1' }),
    ]
    expect(givenByBank(rows)).toEqual([
      { bank: 'First Bank', count: 2, amount: 9000, passed: 6000, stillToPay: 3000 },
      { bank: 'Second Bank', count: 1, amount: 1000, passed: 0, stillToPay: 1000 },
    ])
    const [line] = receivedByAccount(rows, [account])
    expect(line).toMatchObject({ accountId: 'a1', count: 2, deposited: 7000, cleared: 5000, clearing: 2000, bounced: 0 })
    expect(line.account?.name).toBe('Main')
  })

  it('lines up funds added with cheque payments, day by day and month by month', () => {
    const rows = [given('PASSED', '2026-09-10', 6000), given('DEPOSITED', '2026-09-12', 4000), given('PENDING', '2026-09-15', 9000)]
    const deposits = [deposit('2026-09-10', 5000), deposit('2026-09-10', 1000), deposit('2026-09-11', 4000)]
    expect(fundsAndPayments(rows, deposits)).toEqual([
      { date: '2026-09-10', funds: 6000, payments: 6000, totalFunds: 6000, totalPayments: 6000 },
      { date: '2026-09-11', funds: 4000, payments: 0, totalFunds: 10000, totalPayments: 6000 },
      { date: '2026-09-12', funds: 0, payments: 4000, totalFunds: 10000, totalPayments: 10000 },
    ])
    expect(fundsByMonth(rows, deposits, ['2026-09'])).toEqual([{ month: '2026-09', funds: 10000, days: 2, payments: 10000 }])
  })
})
