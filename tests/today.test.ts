import { describe, expect, it } from 'vitest'
import {
  givenTodos,
  plusDays,
  receivedTodos,
  sortTodos,
  summarizeGiven,
  summarizeReceived,
  todoAmount,
  weeklyInOut,
  type Todo,
} from '@/lib/today'
import type { Cheque, ChequeStatus } from '@/types'
import type { ReceivedCheque, ReceivedKind, ReceivedStatus } from '@/types/received'

const TODAY = '2026-09-27'
const RULES = { chequeValidityMonths: 3, clearingDays: 2 }

let next = 0
function given(status: ChequeStatus, dueInDays: number, amount: number, notes: string | null = null): Cheque {
  next += 1
  return {
    id: `g${next}`,
    user_id: 'u',
    party_id: `p${next}`,
    cheque_number: String(100000 + next),
    bank_name: 'Bank One',
    amount,
    issue_date: '2026-08-01',
    due_date: plusDays(TODAY, dueInDays),
    status,
    return_reason: null,
    auto_transition_blocked: false,
    notes,
    original_due_date: null,
    represent_count: 0,
    write_off_reason: null,
    replaces_cheque_id: null,
    deleted_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }
}

function received(
  status: ReceivedStatus,
  dueInDays: number,
  amount: number | null,
  extra: Partial<ReceivedCheque> & { kind?: ReceivedKind } = {}
): ReceivedCheque {
  next += 1
  return {
    id: `r${next}`,
    user_id: 'u',
    party_id: `p${next}`,
    kind: 'REGULAR',
    cheque_number: String(200000 + next),
    bank_name: 'Bank Two',
    amount,
    received_on: '2026-09-01',
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
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...extra,
  }
}

const kinds = (todos: Todo[]) => todos.map((t) => `${t.group}:${t.kind}`)

describe('given cheques on Today', () => {
  const cheques = [
    given('PENDING', -2, 5000), // overdue, not funded
    given('DEPOSITED', -1, 7000), // overdue, funded: did it pass?
    given('PENDING', 0, 20000), // due today, not funded
    given('DEPOSITED', 0, 12500), // due today, funded
    given('PENDING', 2, 60000),
    given('PENDING', 2, 60000),
    given('DEPOSITED', 3, 12000),
    given('PENDING', 20, 30000),
    given('PASSED', 1, 99999), // done: never counted
    given('RETURNED', -5, 27000), // needs a decision
    given('RETURNED', -40, 1000, '[RE_PRESENTED]'), // settled the old way
  ]

  it('adds up what is needed now, this week and in all', () => {
    const s = summarizeGiven(cheques, TODAY)
    expect(s.neededNow).toEqual({ amount: 25000, notFunded: 2, due: 4 })
    expect(s.next7).toEqual({ amount: 164500, notFunded: 140000, count: 5 })
    expect(s.outstanding).toEqual({ amount: 206500, count: 8, lastDue: plusDays(TODAY, 20) })
  })

  it('lays out the week strip and the 30-day chart', () => {
    const s = summarizeGiven(cheques, TODAY)
    expect(s.week).toHaveLength(7)
    expect(s.week[0]).toEqual({ date: TODAY, count: 2, funded: 12500, notFunded: 20000 })
    expect(s.week[2]).toEqual({ date: plusDays(TODAY, 2), count: 2, funded: 0, notFunded: 120000 })
    expect(s.next30).toHaveLength(30)
    // Today's bar also carries the overdue cheque that still needs funds.
    expect(s.next30[0]).toMatchObject({ funded: 12500, notFunded: 25000 })
    expect(s.next30[20]).toMatchObject({ notFunded: 30000 })
  })

  it('lists what to do, most urgent first', () => {
    const todos = sortTodos(givenTodos(cheques, TODAY))
    expect(kinds(todos)).toEqual(['overdue:fund', 'overdue:passed', 'today:fund', 'today:returned', 'week:fund'])
    const today = todos.find((t) => t.kind === 'fund' && t.group === 'today')!
    expect(today.kind === 'fund' && today.funded.map((c) => c.amount)).toEqual([12500])
    const week = todos.find((t) => t.group === 'week')!
    expect(todoAmount(week)).toBe(120000)
    const returned = todos.find((t) => t.kind === 'returned')!
    expect(returned.kind === 'returned' && returned.cheques).toHaveLength(1)
  })

  it('has nothing to do when everything is passed', () => {
    expect(givenTodos([given('PASSED', -3, 100)], TODAY)).toEqual([])
    expect(summarizeGiven([], TODAY).outstanding).toEqual({ amount: 0, count: 0, lastDue: null })
  })
})

describe('received cheques on Today', () => {
  const cheques = [
    received('IN_HAND', -3, 15000, { cheque_date: '2026-07-01' }), // overdue, goes stale on 1 Oct
    received('IN_HAND', 0, 25000),
    received('IN_HAND', 0, 50000),
    received('IN_HAND', 4, 20000, { cheque_date: '2026-06-28' }), // goes stale on 28 Sep
    received('IN_HAND', 10, 40000),
    received('IN_HAND', -1, 9000, { cheque_date: '2026-06-01' }), // stale since 1 Sep
    received('DEPOSITED', -5, 98000, { deposited_on: '2026-09-22', deposit_account_id: 'a1' }),
    received('DEPOSITED', -5, 2000, { deposited_on: '2026-09-22', deposit_account_id: 'a1' }),
    received('DEPOSITED', -1, 73000, { deposited_on: '2026-09-26' }), // not slow yet
    received('BOUNCED', -2, 42000, { bounced_on: '2026-09-25' }),
    received('IN_HAND', 3, null, { kind: 'SECURITY', cheque_date: null }),
    received('CLEARED', -9, 11111),
  ]

  it('adds up what to deposit, what is clearing and what is coming', () => {
    const s = summarizeReceived(cheques, TODAY, RULES)
    expect(s.toDeposit).toMatchObject({ amount: 90000, count: 3, overdue: 1 })
    expect(s.inClearing).toEqual({ amount: 173000, count: 3, slow: 2 })
    expect(s.comingIn30).toEqual({ amount: 60000, count: 2, security: 1 })
  })

  it('marks overdue and soon-stale cheques on the week strip', () => {
    const s = summarizeReceived(cheques, TODAY, RULES)
    expect(s.week[0]).toMatchObject({ amount: 75000, count: 2, overdue: 15000, staleOn: null })
    expect(s.week[4]).toMatchObject({ amount: 20000, staleOn: '2026-09-28' })
    expect(s.weeks.map((w) => w.in)).toEqual([110000, 40000, 0, 0])
  })

  it('lists deposits, clearing checks, bounces, stale cheques and security reviews', () => {
    const todos = sortTodos(receivedTodos(cheques, TODAY, RULES))
    expect(kinds(todos)).toEqual([
      'overdue:deposit',
      'overdue:clearing',
      'overdue:stale',
      'today:deposit',
      'today:bounced',
      'week:going_stale',
      'week:security',
    ])
    const overdue = todos[0]
    expect(overdue.kind === 'deposit' && overdue.staleOn).toBe('2026-10-01')
    const clearing = todos.find((t) => t.kind === 'clearing')!
    expect(todoAmount(clearing)).toBe(100000)
    const security = todos.find((t) => t.kind === 'security')!
    expect(todoAmount(security)).toBeNull()
  })
})

describe('both directions', () => {
  it('adds money in and out by week, with what is already due in the first week', () => {
    const weeks = weeklyInOut(
      [given('PENDING', -1, 1000), given('DEPOSITED', 2, 2000), given('PENDING', 9, 4000), given('DEPOSITED', -3, 8000)],
      [received('IN_HAND', -2, 100), received('DEPOSITED', -1, 200), received('IN_HAND', 15, 400)],
      TODAY,
      RULES
    )
    expect(weeks.map((w) => [w.start, w.in, w.out])).toEqual([
      [TODAY, 300, 3000],
      [plusDays(TODAY, 7), 0, 4000],
      [plusDays(TODAY, 14), 400, 0],
      [plusDays(TODAY, 21), 0, 0],
    ])
  })
})
