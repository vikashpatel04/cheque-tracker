import { describe, expect, it } from 'vitest'
import {
  givenRow,
  groupByDay,
  inTab,
  inView,
  matchesSearch,
  receivedRow,
  rowTags,
  sortRows,
  VIEWS_BY_TAB,
} from '@/lib/chequeList'
import { plusDays } from '@/lib/today'
import type { Cheque, ChequeStatus } from '@/types'
import type { ReceivedCheque, ReceivedStatus } from '@/types/received'

const TODAY = '2026-09-27'
const RULES = { chequeValidityMonths: 3, clearingDays: 2 }

let next = 0
const party = (name: string) => ({ id: `p-${name}`, name }) as Cheque['party']

function given(status: ChequeStatus, dueInDays: number, amount: number, extra: Partial<Cheque> = {}): Cheque {
  next += 1
  return {
    id: `g${next}`,
    user_id: 'u',
    party_id: 'p',
    cheque_number: String(300000 + next),
    bank_name: 'Bank One',
    amount,
    issue_date: plusDays(TODAY, -30 - next),
    due_date: plusDays(TODAY, dueInDays),
    status,
    return_reason: null,
    auto_transition_blocked: false,
    notes: null,
    original_due_date: null,
    represent_count: 0,
    write_off_reason: null,
    replaces_cheque_id: null,
    deleted_at: null,
    created_at: '',
    updated_at: '',
    party: party(`Given ${next}`),
    ...extra,
  }
}

function received(status: ReceivedStatus, dueInDays: number, amount: number, extra: Partial<ReceivedCheque> = {}): ReceivedCheque {
  next += 1
  return {
    id: `r${next}`,
    user_id: 'u',
    party_id: 'p',
    kind: 'REGULAR',
    cheque_number: String(400000 + next),
    bank_name: 'Bank Two',
    amount,
    received_on: plusDays(TODAY, -10),
    cheque_date: plusDays(TODAY, dueInDays),
    due_date: plusDays(TODAY, dueInDays),
    status,
    deposit_account_id: null,
    deposited_on: null,
    cleared_on: null,
    bounced_on: null,
    bounce_reason: null,
    bank_charges: null,
    settled_on: null,
    settled_via: null,
    settlement_ref: null,
    close_reason: null,
    redeposit_count: 0,
    replaces_id: null,
    series_id: null,
    series_index: null,
    notes: null,
    deleted_at: null,
    created_at: '',
    updated_at: '',
    party: party(`Received ${next}`),
    ...extra,
  }
}

describe('the Cheques list', () => {
  const rows = [
    givenRow(given('PENDING', 0, 20000)),
    givenRow(given('PENDING', 3, 72000)),
    givenRow(given('DEPOSITED', -1, 12000)),
    givenRow(given('PASSED', -20, 31500)),
    givenRow(given('RETURNED', -5, 27000, { represent_count: 1 })),
    givenRow(given('RETURNED', -60, 5000, { notes: '[RE_PRESENTED]' })),
    receivedRow(received('IN_HAND', -3, 15000)),
    receivedRow(received('IN_HAND', 0, 25000)),
    receivedRow(received('DEPOSITED', -4, 60000, { deposited_on: plusDays(TODAY, -4) })),
    receivedRow(received('BOUNCED', -6, 42000)),
    receivedRow(received('IN_HAND', 20, 0, { kind: 'SECURITY', series_id: 's1', series_index: 2 })),
    receivedRow(received('CLEARED', -30, 9000)),
  ]

  const count = (tab: 'all' | 'given' | 'received') =>
    Object.fromEntries(
      VIEWS_BY_TAB[tab].map((view) => [view, rows.filter((r) => inTab(r, tab) && inView(r, view, TODAY, RULES)).length])
    )

  it('counts the saved views on each tab', () => {
    expect(count('given')).toEqual({ needs_funds: 2, funded: 1, overdue: 1, returned: 2 })
    expect(count('received')).toEqual({ to_deposit: 2, in_clearing: 1, bounced: 1, security: 1, series: 1 })
    expect(count('all')).toEqual({ to_deposit: 2, needs_funds: 2, in_clearing: 1, overdue: 2, problems: 2 })
  })

  it('tags what needs doing', () => {
    const kinds = (i: number) => rowTags(rows[i], TODAY, RULES).map((t) => t.kind)
    expect(kinds(0)).toEqual(['needs_funds'])
    expect(kinds(1)).toEqual(['needs_funds'])
    expect(kinds(2)).toEqual(['overdue'])
    expect(kinds(3)).toEqual([])
    expect(kinds(4)).toEqual(['represented'])
    expect(kinds(5)).toEqual(['old_represent'])
    expect(kinds(6)).toEqual(['overdue'])
    expect(kinds(7)).toEqual(['due_today'])
    expect(kinds(8)).toEqual(['cleared_check'])
    expect(kinds(10)).toEqual(['security', 'series'])
  })

  it('searches by number, party or amount', () => {
    const r = rows[1]
    expect(matchesSearch(r, r.number.slice(-3))).toBe(true)
    expect(matchesSearch(r, r.party.toUpperCase())).toBe(true)
    expect(matchesSearch(r, '72,000')).toBe(true)
    expect(matchesSearch(r, '72000.00')).toBe(true)
    expect(matchesSearch(r, '99')).toBe(false)
    expect(matchesSearch(r, 'nobody')).toBe(false)
  })

  it('puts what is still in play first, soonest due, and groups it by day for phones', () => {
    const sorted = sortRows(rows, 'upcoming', 'asc')
    const open = sorted.filter((r) => r.open)
    expect(sorted.slice(0, open.length)).toEqual(open)
    expect(open.map((r) => r.due)).toEqual([...open.map((r) => r.due)].sort())

    const groups = groupByDay(sorted, TODAY)
    expect(groups.map((g) => g.kind)).toEqual(['overdue', 'today', 'day', 'day', 'month', 'month', 'month'])
    const todayGroup = groups.find((g) => g.kind === 'today')!
    expect([todayGroup.in, todayGroup.out]).toEqual([25000, 20000])
  })

  it('sorts by one field in either direction', () => {
    const byAmount = sortRows(rows, 'amount', 'desc').map((r) => r.amount)
    expect(byAmount[0]).toBe(72000)
    expect(byAmount[byAmount.length - 1]).toBe(0)
  })
})
