import { extractTags, isLegacyRepresented } from './chequeTags'
import { daysBetween, lastValidDay, receivedAlerts, type AlertRules } from './receivedSchedule'
import { plusDays } from './today'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

/**
 * The Cheques list: given and received cheques as one kind of row, the saved
 * views, the tags that say what needs doing, search, sorting and the phone's
 * day groups. Pure functions of the cheques and today's date (yyyy-MM-dd).
 */

export type Direction = 'in' | 'out'
export type DirectionTab = 'all' | 'given' | 'received'

export interface ListRow {
  /** Unique across both directions. */
  key: string
  id: string
  direction: Direction
  partyId: string
  party: string
  number: string
  /** Given: your bank. Received: the bank it's drawn on. */
  bank: string
  /** Received: the account it was deposited into. */
  accountId: string | null
  /** Null only for a blank security cheque. */
  amount: number | null
  due: string
  /** Given: issue date. Received: the day you got it. */
  issued: string
  status: string
  /** Still in play: something can still happen to it. */
  open: boolean
  given?: Cheque
  received?: ReceivedCheque
}

const GIVEN_OPEN = new Set(['PENDING', 'DEPOSITED', 'RETURNED'])
const RECEIVED_OPEN = new Set(['IN_HAND', 'DEPOSITED', 'BOUNCED'])

export function givenRow(c: Cheque): ListRow {
  return {
    key: `out:${c.id}`,
    id: c.id,
    direction: 'out',
    partyId: c.party_id,
    party: c.party?.name ?? 'Unknown party',
    number: c.cheque_number,
    bank: c.bank_name,
    accountId: null,
    amount: Number(c.amount),
    due: c.due_date,
    issued: c.issue_date,
    status: c.status,
    open: GIVEN_OPEN.has(c.status) && !isLegacyRepresented(c),
    given: c,
  }
}

export function receivedRow(c: ReceivedCheque): ListRow {
  return {
    key: `in:${c.id}`,
    id: c.id,
    direction: 'in',
    partyId: c.party_id,
    party: c.party?.name ?? 'Unknown party',
    number: c.cheque_number,
    bank: c.bank_name,
    accountId: c.deposit_account_id,
    amount: c.amount === null ? null : Number(c.amount),
    due: c.due_date,
    issued: c.received_on,
    status: c.status,
    open: RECEIVED_OPEN.has(c.status),
    received: c,
  }
}

export function inTab(row: ListRow, tab: DirectionTab): boolean {
  return tab === 'all' || (tab === 'given' ? row.direction === 'out' : row.direction === 'in')
}

/* ---------- Saved views ---------- */

export type ListView =
  | 'to_deposit'
  | 'needs_funds'
  | 'in_clearing'
  | 'funded'
  | 'overdue'
  | 'returned'
  | 'bounced'
  | 'problems'
  | 'security'
  | 'series'

export const VIEWS_BY_TAB: Record<DirectionTab, ListView[]> = {
  all: ['to_deposit', 'needs_funds', 'in_clearing', 'overdue', 'problems'],
  given: ['needs_funds', 'funded', 'overdue', 'returned'],
  received: ['to_deposit', 'in_clearing', 'bounced', 'security', 'series'],
}

export const VIEW_LABELS: Record<ListView, string> = {
  to_deposit: 'To deposit',
  needs_funds: 'Needs funds',
  in_clearing: 'In clearing',
  funded: 'Funded',
  overdue: 'Overdue',
  returned: 'Returned',
  bounced: 'Bounced',
  problems: 'Returned or bounced',
  security: 'Security',
  series: 'Series',
}

const stillValid = (c: ReceivedCheque, today: string, rules: AlertRules) =>
  !c.cheque_date || lastValidDay(c.cheque_date, rules.chequeValidityMonths) >= today

export function inView(row: ListRow, view: ListView, today: string, rules: AlertRules): boolean {
  const g = row.given
  const r = row.received
  switch (view) {
    case 'to_deposit':
      return !!r && r.status === 'IN_HAND' && r.kind === 'REGULAR' && r.due_date <= today && stillValid(r, today, rules)
    case 'needs_funds':
      return !!g && g.status === 'PENDING' && g.due_date <= plusDays(today, 6)
    case 'in_clearing':
      return !!r && r.status === 'DEPOSITED'
    case 'funded':
      return !!g && g.status === 'DEPOSITED'
    case 'overdue':
      return g
        ? (g.status === 'PENDING' || g.status === 'DEPOSITED') && g.due_date < today
        : !!r && r.status === 'IN_HAND' && r.kind === 'REGULAR' && r.due_date < today
    case 'returned':
      return !!g && g.status === 'RETURNED'
    case 'bounced':
      return !!r && r.status === 'BOUNCED'
    case 'problems':
      return (!!g && g.status === 'RETURNED' && !isLegacyRepresented(g)) || (!!r && r.status === 'BOUNCED')
    case 'security':
      return !!r && r.kind === 'SECURITY' && r.status === 'IN_HAND'
    case 'series':
      return !!r && !!r.series_id
  }
}

/* ---------- Tags: what needs doing ---------- */

export type TagKind =
  | 'overdue'
  | 'due_today'
  | 'needs_funds'
  | 'going_stale'
  | 'stale'
  | 'cleared_check'
  | 'security'
  | 'series'
  | 'represented'
  | 'replacement'
  | 'old_represent'
  | 'from_return'
  | 'old_written_off'

export interface RowTag {
  kind: TagKind
  /** Times re-presented, or the series position ("3 of 12" needs the series size, which isn't loaded). */
  count?: number
}

/** At most the tags that matter most; the status chip says the rest. */
export function rowTags(row: ListRow, today: string, rules: AlertRules): RowTag[] {
  const tags: RowTag[] = []
  const g = row.given
  const r = row.received
  if (g) {
    const open = g.status === 'PENDING' || g.status === 'DEPOSITED'
    if (open && g.due_date < today) tags.push({ kind: 'overdue' })
    else if (open && g.due_date === today) tags.push({ kind: g.status === 'PENDING' ? 'needs_funds' : 'due_today' })
    else if (g.status === 'PENDING' && g.due_date <= plusDays(today, 6)) tags.push({ kind: 'needs_funds' })
    if (g.represent_count > 0) tags.push({ kind: 'represented', count: g.represent_count })
    if (g.replaces_cheque_id) tags.push({ kind: 'replacement' })
    // Markers the old app wrote into notes.
    const legacy = extractTags(g.notes)
    if (legacy.includes('RE_PRESENTED')) tags.push({ kind: 'old_represent' })
    if (legacy.includes('FROM_RETURN')) tags.push({ kind: 'from_return' })
    if (legacy.includes('WRITTEN_OFF')) tags.push({ kind: 'old_written_off' })
  }
  if (r) {
    const alerts = receivedAlerts(r, today, rules)
    if (alerts.includes('stale')) tags.push({ kind: 'stale' })
    else if (alerts.includes('deposit_overdue')) tags.push({ kind: 'overdue' })
    else if (alerts.includes('deposit_today')) tags.push({ kind: 'due_today' })
    if (alerts.includes('going_stale')) tags.push({ kind: 'going_stale' })
    if (alerts.includes('check_clearing')) tags.push({ kind: 'cleared_check' })
    if (r.kind === 'SECURITY') tags.push({ kind: 'security' })
    if (r.series_id) tags.push({ kind: 'series', count: r.series_index ?? undefined })
  }
  return tags
}

/** "in 3 days", "today" or "2 days overdue", for cheques still waiting on their date. */
export function dueNote(row: ListRow, today: string): string | null {
  const waiting = row.status === 'PENDING' || row.status === 'DEPOSITED' || row.status === 'IN_HAND'
  if (!waiting) return null
  const days = daysBetween(today, row.due)
  if (days === 0) return 'today'
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`
}

/* ---------- Search and sort ---------- */

/** Cheque number, party, or amount (digits only, separators ignored). */
export function matchesSearch(row: ListRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (row.number.toLowerCase().includes(q) || row.party.toLowerCase().includes(q)) return true
  if (/[a-z]/i.test(q)) return false
  const digits = q.replace(/[^\d.]/g, '')
  return !!digits && row.amount !== null && String(row.amount).startsWith(String(Number(digits)))
}

export type SortKey = 'upcoming' | 'due' | 'issued' | 'amount' | 'party'
export type SortDir = 'asc' | 'desc'

/**
 * "Upcoming": cheques still in play first, soonest due first (overdue at the
 * top), then finished ones, latest first. The others sort everything by one field.
 */
export function sortRows(rows: ListRow[], key: SortKey, dir: SortDir): ListRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const compare = (a: ListRow, b: ListRow): number => {
    switch (key) {
      case 'upcoming':
        if (a.open !== b.open) return a.open ? -1 : 1
        return a.open ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due)
      case 'due':
        return sign * a.due.localeCompare(b.due)
      case 'issued':
        return sign * a.issued.localeCompare(b.issued)
      case 'amount':
        return sign * ((a.amount ?? 0) - (b.amount ?? 0))
      case 'party':
        return sign * a.party.localeCompare(b.party)
    }
  }
  return [...rows].sort((a, b) => compare(a, b) || a.number.localeCompare(b.number))
}

/* ---------- Phone groups ---------- */

export interface DayGroup {
  key: string
  /** 'overdue', 'clearing' (received cheques deposited and waiting), 'today', a date (yyyy-MM-dd) for upcoming days, or a month (yyyy-MM) for finished cheques. */
  kind: 'overdue' | 'clearing' | 'today' | 'day' | 'month'
  value: string
  rows: ListRow[]
  in: number
  out: number
}

const GROUP_ORDER: DayGroup['kind'][] = ['overdue', 'clearing', 'today', 'day', 'month']

/**
 * For the "upcoming" order: overdue, in clearing, today, each coming day,
 * then finished cheques by month, latest first.
 */
export function groupByDay(rows: ListRow[], today: string): DayGroup[] {
  const groups: DayGroup[] = []
  const find = (kind: DayGroup['kind'], value: string) => {
    const key = `${kind}:${value}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, kind, value, rows: [], in: 0, out: 0 }
      groups.push(group)
    }
    return group
  }
  for (const row of rows) {
    const group = !row.open
      ? find('month', row.due.slice(0, 7))
      : row.received?.status === 'DEPOSITED'
        ? find('clearing', '')
        : row.due < today
        ? find('overdue', '')
        : row.due === today
          ? find('today', today)
          : find('day', row.due)
    group.rows.push(row)
    if (row.direction === 'in') group.in += row.amount ?? 0
    else group.out += row.amount ?? 0
  }
  const rank = (g: DayGroup) => GROUP_ORDER.indexOf(g.kind)
  return groups.sort(
    (a, b) => rank(a) - rank(b) || (a.kind === 'month' ? b.value.localeCompare(a.value) : a.value.localeCompare(b.value))
  )
}
