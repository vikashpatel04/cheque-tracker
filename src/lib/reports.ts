import { addMonths, format, parseISO } from 'date-fns'
import { countsAsGiven, countsAsReceived, isHeldSecurity, isStillDue, type Direction, type ListRow } from './chequeList'
import { summarizeParties, type PartySummary } from './parties'
import { daysBetween } from './receivedSchedule'
import { plusDays } from './today'
import type { DailyDeposit } from '@/types'
import type { BankAccount } from '@/types/received'

/**
 * Reports: the figures and series behind each Reports tab, as pure functions
 * of the Cheques list's rows (already filtered), funds added and today
 * (yyyy-MM-dd). Cheques group by due date, the same date the filter uses.
 * Totals leave out cheques that never moved money (`countsAsGiven`,
 * `countsAsReceived`).
 */

const amountOf = (row: ListRow) => row.amount ?? 0
const monthOf = (day: string) => day.slice(0, 7)

/* ---------- Months ---------- */

export function shiftMonth(month: string, by: number): string {
  return format(addMonths(parseISO(`${month}-01`), by), 'yyyy-MM')
}

/** yyyy-MM keys from one month (or day) to another, inclusive. */
export function monthKeys(from: string, to: string): string[] {
  const keys: string[] = []
  for (let month = monthOf(from); month <= monthOf(to); month = shiftMonth(month, 1)) keys.push(month)
  return keys
}

/**
 * The months a report shows: those in the date filter, or the six up to this
 * month when there's none. At most `max`, the latest ones.
 */
export function reportMonths(from: string | null, to: string | null, today: string, max = 12): string[] {
  const thisMonth = monthOf(today)
  const end = to ? monthOf(to) : from && monthOf(from) > thisMonth ? monthOf(from) : thisMonth
  const start = from ? monthOf(from) : shiftMonth(end, -5)
  return start > end ? [] : monthKeys(start, end).slice(-max)
}

/* ---------- Overview ---------- */

export interface OverviewFigures {
  received: { amount: number; count: number; cleared: number }
  given: { amount: number; count: number; passed: number }
  toCollect: { amount: number; count: number; clearing: number; bounced: number }
  toPay: { amount: number; count: number; notFunded: number; returned: number }
  /** Security cheques still held, which the totals leave out. */
  securityHeld: number
}

export function overviewFigures(rows: ListRow[]): OverviewFigures {
  const f: OverviewFigures = {
    received: { amount: 0, count: 0, cleared: 0 },
    given: { amount: 0, count: 0, passed: 0 },
    toCollect: { amount: 0, count: 0, clearing: 0, bounced: 0 },
    toPay: { amount: 0, count: 0, notFunded: 0, returned: 0 },
    securityHeld: 0,
  }
  for (const r of rows) {
    const amount = amountOf(r)
    if (isHeldSecurity(r)) f.securityHeld++
    if (countsAsReceived(r)) {
      f.received.amount += amount
      f.received.count++
      if (r.status === 'CLEARED') f.received.cleared += amount
    } else if (countsAsGiven(r)) {
      f.given.amount += amount
      f.given.count++
      if (r.status === 'PASSED') f.given.passed += amount
    }
    if (!isStillDue(r)) continue
    if (r.received) {
      f.toCollect.amount += amount
      f.toCollect.count++
      if (r.status === 'DEPOSITED') f.toCollect.clearing += amount
      if (r.status === 'BOUNCED') f.toCollect.bounced += amount
    } else {
      f.toPay.amount += amount
      f.toPay.count++
      if (r.status === 'PENDING') f.toPay.notFunded += amount
      if (r.status === 'RETURNED') f.toPay.returned += amount
    }
  }
  return f
}

export interface MonthFlow {
  month: string
  in: number
  inCount: number
  cleared: number
  out: number
  outCount: number
  passed: number
}

/** Money in and out by due month. */
export function monthlyFlow(rows: ListRow[], months: string[]): MonthFlow[] {
  const byMonth = new Map(months.map((month) => [month, { month, in: 0, inCount: 0, cleared: 0, out: 0, outCount: 0, passed: 0 }]))
  for (const r of rows) {
    const m = byMonth.get(monthOf(r.due))
    if (!m) continue
    if (countsAsReceived(r)) {
      m.in += amountOf(r)
      m.inCount++
      if (r.status === 'CLEARED') m.cleared += amountOf(r)
    } else if (countsAsGiven(r)) {
      m.out += amountOf(r)
      m.outCount++
      if (r.status === 'PASSED') m.passed += amountOf(r)
    }
  }
  return [...byMonth.values()]
}

const RECEIVED_ORDER = ['CLEARED', 'SETTLED', 'DEPOSITED', 'IN_HAND', 'BOUNCED', 'REPLACED', 'HANDED_BACK', 'WRITTEN_OFF']
const GIVEN_ORDER = ['PASSED', 'DEPOSITED', 'PENDING', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF']

export interface StatusTotal {
  status: string
  amount: number
  count: number
}

/**
 * One direction's cheques by status, in a fixed order. By default only those
 * that count in totals; `everything` adds cancelled, handed back and the like.
 */
export function standing(rows: ListRow[], direction: Direction, everything = false): StatusTotal[] {
  const order = direction === 'in' ? RECEIVED_ORDER : GIVEN_ORDER
  const totals = new Map(order.map((status) => [status, { status, amount: 0, count: 0 }]))
  for (const r of rows) {
    if (r.direction !== direction) continue
    if (!everything && !(direction === 'in' ? countsAsReceived(r) : countsAsGiven(r))) continue
    const total = totals.get(r.status)
    if (!total) continue
    total.amount += amountOf(r)
    total.count++
  }
  return [...totals.values()].filter((t) => t.count > 0)
}

/* ---------- Parties ---------- */

export interface PartyLine extends PartySummary {
  partyId: string
  party: string
}

/** Each party's totals both ways (see `summarizeParty`), the most business first. */
export function partyLines(rows: ListRow[], today: string): PartyLine[] {
  const names = new Map(rows.map((r) => [r.partyId, r.party]))
  return [...summarizeParties(rows, today)]
    .map(([partyId, s]) => ({ partyId, party: names.get(partyId) ?? '', ...s }))
    .filter((p) => p.gave.count || p.got.count || p.pay.count || p.collect.count)
    .sort((a, b) => b.gave.amount + b.got.amount - (a.gave.amount + a.got.amount) || a.party.localeCompare(b.party))
}

/* ---------- Cash flow ---------- */

export interface CashDay {
  date: string
  isPast: boolean
  isToday: boolean
  outCount: number
  inCount: number
  pending: number
  funded: number
  passed: number
  returned: number
  /** Past days: what passed. Today and later: what's still to fund or pass. */
  needed: number
  fundsAdded: number
  /** Funds added minus what was needed; below zero is a shortfall. */
  gap: number
  /** Received cheques due that day still to come in (in hand or in clearing). */
  expected: number
  cleared: number
}

/** Day by day around today: `before` days back and `after` days from today on. */
export function cashFlowDays(rows: ListRow[], deposits: DailyDeposit[], today: string, before = 14, after = 14): CashDay[] {
  const funds = new Map<string, number>()
  for (const d of deposits) funds.set(d.deposit_date, (funds.get(d.deposit_date) ?? 0) + Number(d.amount))
  const days = new Map<string, CashDay>()
  for (let i = -before; i < after; i++) {
    const date = plusDays(today, i)
    days.set(date, {
      date,
      isPast: date < today,
      isToday: date === today,
      outCount: 0,
      inCount: 0,
      pending: 0,
      funded: 0,
      passed: 0,
      returned: 0,
      needed: 0,
      fundsAdded: funds.get(date) ?? 0,
      gap: 0,
      expected: 0,
      cleared: 0,
    })
  }
  for (const r of rows) {
    const day = days.get(r.due)
    if (!day) continue
    const amount = amountOf(r)
    if (countsAsGiven(r)) {
      day.outCount++
      if (r.status === 'PENDING') day.pending += amount
      else if (r.status === 'DEPOSITED') day.funded += amount
      else if (r.status === 'PASSED') day.passed += amount
      else if (r.status === 'RETURNED') day.returned += amount
    } else if (countsAsReceived(r)) {
      day.inCount++
      if (r.status === 'CLEARED') day.cleared += amount
      else if (r.status === 'IN_HAND' || r.status === 'DEPOSITED') day.expected += amount
    }
  }
  for (const day of days.values()) {
    day.needed = day.isPast ? day.passed : day.pending + day.funded
    day.gap = day.fundsAdded - day.needed
  }
  return [...days.values()]
}

export interface AroundToday {
  neededToday: number
  fundsToday: number
  next: { out: number; outCount: number; in: number; inCount: number }
  past: { paid: number; funds: number; cleared: number }
}

/** Today, the days ahead and the days behind, from `cashFlowDays`. */
export function aroundToday(days: CashDay[]): AroundToday {
  const t: AroundToday = {
    neededToday: 0,
    fundsToday: 0,
    next: { out: 0, outCount: 0, in: 0, inCount: 0 },
    past: { paid: 0, funds: 0, cleared: 0 },
  }
  for (const d of days) {
    if (d.isToday) {
      t.neededToday = d.needed
      t.fundsToday = d.fundsAdded
    }
    if (d.isPast) {
      t.past.paid += d.passed
      t.past.funds += d.fundsAdded
      t.past.cleared += d.cleared
    } else {
      t.next.out += d.needed
      t.next.outCount += d.outCount
      t.next.in += d.expected
      t.next.inCount += d.inCount
    }
  }
  return t
}

export interface RunningDay {
  date: string
  out: number
  in: number
}

/**
 * How much will have gone out and come in by each of the next `days` days:
 * given cheques still to pass and received ones still to come in. Anything
 * already overdue counts from today.
 */
export function runningTotals(rows: ListRow[], today: string, days = 30): RunningDay[] {
  const last = plusDays(today, days - 1)
  const outOn = new Map<string, number>()
  const inOn = new Map<string, number>()
  for (const r of rows) {
    if (!isStillDue(r) || r.due > last) continue
    const on = r.due < today ? today : r.due
    if (r.given && (r.status === 'PENDING' || r.status === 'DEPOSITED')) outOn.set(on, (outOn.get(on) ?? 0) + amountOf(r))
    if (r.received && (r.status === 'IN_HAND' || r.status === 'DEPOSITED')) inOn.set(on, (inOn.get(on) ?? 0) + amountOf(r))
  }
  let out = 0
  let money = 0
  return Array.from({ length: days }, (_, i) => {
    const date = plusDays(today, i)
    out += outOn.get(date) ?? 0
    money += inOn.get(date) ?? 0
    return { date, out, in: money }
  })
}

export interface TrendMonth {
  month: string
  issued: number
  due: number
  cleared: number
}

/**
 * Given cheques over the six months up to this one: written (by issue date),
 * due, and passed (in the month they passed, from `passedOn`, else their due month).
 */
export function givenTrend(rows: ListRow[], passedOn: Map<string, string>, today: string): TrendMonth[] {
  const months = monthKeys(shiftMonth(monthOf(today), -5), today)
  const byMonth = new Map(months.map((month) => [month, { month, issued: 0, due: 0, cleared: 0 }]))
  const add = (day: string, key: 'issued' | 'due' | 'cleared', amount: number) => {
    const m = byMonth.get(monthOf(day))
    if (m) m[key] += amount
  }
  for (const r of rows) {
    if (!countsAsGiven(r)) continue
    const amount = amountOf(r)
    add(r.issued, 'issued', amount)
    add(r.due, 'due', amount)
    if (r.status === 'PASSED') add(passedOn.get(r.id) ?? r.due, 'cleared', amount)
  }
  return [...byMonth.values()]
}

/* ---------- Collections ---------- */

export type AgeBucket = 'not_due' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus'

export const AGE_BUCKETS: { key: AgeBucket; label: string }[] = [
  { key: 'not_due', label: 'Not due yet' },
  { key: 'd0_30', label: '0–30 days' },
  { key: 'd31_60', label: '31–60 days' },
  { key: 'd61_90', label: '61–90 days' },
  { key: 'd90_plus', label: 'Over 90 days' },
]

/** The bucket for a cheque this many days past its date (negative: not due yet). */
export function ageBucket(daysPastDue: number): AgeBucket {
  if (daysPastDue < 0) return 'not_due'
  if (daysPastDue <= 30) return 'd0_30'
  if (daysPastDue <= 60) return 'd31_60'
  if (daysPastDue <= 90) return 'd61_90'
  return 'd90_plus'
}

export interface AgeTotal {
  bucket: AgeBucket
  amount: number
  count: number
}

/** Received money still to collect, by how far past its date each cheque is. */
export function collectionAgeing(rows: ListRow[], today: string): AgeTotal[] {
  const totals = new Map(AGE_BUCKETS.map((b) => [b.key, { bucket: b.key, amount: 0, count: 0 }]))
  for (const r of rows) {
    if (!r.received || !isStillDue(r)) continue
    const total = totals.get(ageBucket(daysBetween(r.due, today)))!
    total.amount += amountOf(r)
    total.count++
  }
  return [...totals.values()]
}

/** Received cheques still to collect, oldest date first. */
export function stillToCollect(rows: ListRow[]): ListRow[] {
  return rows
    .filter((r) => r.received && isStillDue(r))
    .sort((a, b) => a.due.localeCompare(b.due) || amountOf(b) - amountOf(a))
}

/** A received cheque that bounced at least once. */
export function receivedBounced(row: ListRow): boolean {
  const c = row.received
  return !!c && (c.status === 'BOUNCED' || c.redeposit_count > 0 || !!c.bounced_on)
}

/** A given cheque that came back at least once: returned now, presented again, or returned in its history. */
export function givenReturned(row: ListRow, everReturned: Set<string>): boolean {
  const g = row.given
  return !!g && (g.status === 'RETURNED' || g.represent_count > 0 || everReturned.has(g.id))
}

export interface BounceRate {
  deposited: number
  bounced: number
  depositedAmount: number
  bouncedAmount: number
}

/** Of the received cheques ever deposited, how many bounced at least once. */
export function bounceRate(rows: ListRow[]): BounceRate {
  const rate: BounceRate = { deposited: 0, bounced: 0, depositedAmount: 0, bouncedAmount: 0 }
  for (const r of rows) {
    const c = r.received
    if (!c || !(c.deposited_on || c.status === 'DEPOSITED' || c.status === 'CLEARED' || c.status === 'BOUNCED')) continue
    rate.deposited++
    rate.depositedAmount += amountOf(r)
    if (receivedBounced(r)) {
      rate.bounced++
      rate.bouncedAmount += amountOf(r)
    }
  }
  return rate
}

/* ---------- Payments ---------- */

export interface PaymentMonth {
  month: string
  count: number
  given: number
  passed: number
  returned: number
  stillToPay: number
}

/** Given cheques by due month: written, passed, returned at some point, and still to pay. */
export function paymentMonths(rows: ListRow[], months: string[], everReturned: Set<string>): PaymentMonth[] {
  const byMonth = new Map(months.map((month) => [month, { month, count: 0, given: 0, passed: 0, returned: 0, stillToPay: 0 }]))
  for (const r of rows) {
    if (!r.given) continue
    const m = byMonth.get(monthOf(r.due))
    if (!m) continue
    const amount = amountOf(r)
    if (givenReturned(r, everReturned)) m.returned += amount
    if (!countsAsGiven(r)) continue
    m.count++
    m.given += amount
    if (r.status === 'PASSED') m.passed += amount
    if (isStillDue(r)) m.stillToPay += amount
  }
  return [...byMonth.values()]
}

/* ---------- Bounces ---------- */

export interface BounceItem {
  row: ListRow
  reason: string | null
  /** Still owed: returned and not yet settled (given), or bounced and not yet collected (received). */
  open: boolean
  /** Bank charges recorded for it (received cheques). */
  charges: number
}

/** Every cheque that came back, both ways, latest date first. */
export function bouncedCheques(rows: ListRow[], everReturned: Set<string>): BounceItem[] {
  const items: BounceItem[] = []
  for (const r of rows) {
    if (r.given && givenReturned(r, everReturned)) {
      items.push({ row: r, reason: r.given.return_reason, open: r.open && r.status === 'RETURNED', charges: 0 })
    } else if (r.received && receivedBounced(r)) {
      items.push({ row: r, reason: r.received.bounce_reason, open: r.status === 'BOUNCED', charges: Number(r.received.bank_charges ?? 0) })
    }
  }
  return items.sort((a, b) => b.row.due.localeCompare(a.row.due))
}

export interface BounceGroup {
  key: string
  label: string
  count: number
  amount: number
  /** Still owed, either way. */
  open: number
}

function groupBounces(items: BounceItem[], keyOf: (item: BounceItem) => { key: string; label: string }): BounceGroup[] {
  const groups = new Map<string, BounceGroup>()
  for (const item of items) {
    const { key, label } = keyOf(item)
    const group = groups.get(key) ?? { key, label, count: 0, amount: 0, open: 0 }
    group.count++
    group.amount += amountOf(item.row)
    if (item.open) group.open += amountOf(item.row)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.amount - a.amount || a.label.localeCompare(b.label))
}

export function bouncesByParty(items: BounceItem[]): BounceGroup[] {
  return groupBounces(items, (item) => ({ key: item.row.partyId, label: item.row.party }))
}

/** By the reason the bank gave. An empty label means none was noted; that group comes last. */
export function bouncesByReason(items: BounceItem[]): BounceGroup[] {
  const groups = groupBounces(items, (item) => {
    const reason = item.reason?.trim() ?? ''
    return { key: reason.toLowerCase(), label: reason }
  })
  return [...groups.filter((g) => g.label), ...groups.filter((g) => !g.label)]
}

/* ---------- Accounts and funds ---------- */

export interface BankLine {
  bank: string
  count: number
  amount: number
  passed: number
  stillToPay: number
}

/** Given cheques by the bank they're drawn on, the largest first. */
export function givenByBank(rows: ListRow[]): BankLine[] {
  const banks = new Map<string, BankLine>()
  for (const r of rows) {
    if (!countsAsGiven(r)) continue
    const bank = r.bank.trim()
    const line = banks.get(bank) ?? { bank, count: 0, amount: 0, passed: 0, stillToPay: 0 }
    line.count++
    line.amount += amountOf(r)
    if (r.status === 'PASSED') line.passed += amountOf(r)
    if (isStillDue(r)) line.stillToPay += amountOf(r)
    banks.set(bank, line)
  }
  return [...banks.values()].sort((a, b) => b.amount - a.amount || a.bank.localeCompare(b.bank))
}

export interface AccountLine {
  account: BankAccount | null
  accountId: string
  count: number
  deposited: number
  cleared: number
  clearing: number
  bounced: number
}

/** Received cheques by the account they were deposited into. */
export function receivedByAccount(rows: ListRow[], accounts: BankAccount[]): AccountLine[] {
  const lines = new Map<string, AccountLine>()
  for (const r of rows) {
    const c = r.received
    if (!c?.deposit_account_id || !(c.deposited_on || c.status === 'DEPOSITED' || c.status === 'CLEARED' || c.status === 'BOUNCED')) continue
    const id = c.deposit_account_id
    const line = lines.get(id) ?? {
      account: accounts.find((a) => a.id === id) ?? null,
      accountId: id,
      count: 0,
      deposited: 0,
      cleared: 0,
      clearing: 0,
      bounced: 0,
    }
    line.count++
    line.deposited += amountOf(r)
    if (c.status === 'CLEARED') line.cleared += amountOf(r)
    if (c.status === 'DEPOSITED') line.clearing += amountOf(r)
    if (receivedBounced(r)) line.bounced += amountOf(r)
    lines.set(id, line)
  }
  return [...lines.values()].sort((a, b) => b.deposited - a.deposited)
}

export interface FundsDay {
  date: string
  funds: number
  payments: number
  totalFunds: number
  totalPayments: number
}

/**
 * Funds added and given cheques funded or passed, by day: the latest `limit`
 * days with either, with running totals over those days.
 */
export function fundsAndPayments(rows: ListRow[], deposits: DailyDeposit[], limit = 60): FundsDay[] {
  const byDate = new Map<string, { funds: number; payments: number }>()
  const entry = (date: string) => {
    const e = byDate.get(date) ?? { funds: 0, payments: 0 }
    byDate.set(date, e)
    return e
  }
  for (const d of deposits) entry(d.deposit_date).funds += Number(d.amount)
  for (const r of rows) {
    if (countsAsGiven(r) && (r.status === 'PASSED' || r.status === 'DEPOSITED')) entry(r.due).payments += amountOf(r)
  }
  let totalFunds = 0
  let totalPayments = 0
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([date, e]) => {
      totalFunds += e.funds
      totalPayments += e.payments
      return { date, ...e, totalFunds, totalPayments }
    })
}

export interface FundsMonth {
  month: string
  funds: number
  /** Days with funds added. */
  days: number
  payments: number
}

/** Funds added and given cheques funded or passed, by month. */
export function fundsByMonth(rows: ListRow[], deposits: DailyDeposit[], months: string[]): FundsMonth[] {
  const byMonth = new Map(months.map((month) => [month, { month, funds: 0, days: 0, payments: 0, dates: new Set<string>() }]))
  for (const d of deposits) {
    const m = byMonth.get(monthOf(d.deposit_date))
    if (!m) continue
    m.funds += Number(d.amount)
    m.dates.add(d.deposit_date)
  }
  for (const r of rows) {
    if (!countsAsGiven(r) || (r.status !== 'PASSED' && r.status !== 'DEPOSITED')) continue
    const m = byMonth.get(monthOf(r.due))
    if (m) m.payments += amountOf(r)
  }
  return [...byMonth.values()].map(({ dates, ...m }) => ({ ...m, days: dates.size }))
}
