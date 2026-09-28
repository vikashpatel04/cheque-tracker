import { describe, expect, it } from 'vitest'
import { dayCell, monthCells } from '@/lib/calendar'
import type { ListRow } from '@/lib/chequeList'

const TODAY = '2026-09-29'

function row(direction: 'in' | 'out', due: string, status: string, amount: number, open = true): ListRow {
  return {
    key: `${direction}:${due}:${status}:${amount}`,
    id: `${due}-${amount}`,
    direction,
    partyId: 'p',
    party: 'A party',
    number: '000001',
    bank: 'Bank',
    accountId: null,
    amount,
    due,
    issued: '2026-09-01',
    status,
    open,
  }
}

describe('the calendar month', () => {
  it("fills whole weeks from the region's first day of the week", () => {
    const monday = monthCells('2026-09-01', 1, [], TODAY)
    expect(monday[0].date).toBe('2026-08-31')
    expect(monday.length % 7).toBe(0)
    expect(monday.filter((c) => c.inMonth)).toHaveLength(30)
    const sunday = monthCells('2026-09-15', 0, [], TODAY)
    expect(sunday[0].date).toBe('2026-08-30')
    expect(sunday[sunday.length - 1].date).toBe('2026-10-03')
  })

  it('adds up each day and flags what needs you', () => {
    const rows = [
      row('in', '2026-09-29', 'IN_HAND', 20000),
      row('out', '2026-09-29', 'PENDING', 120000),
      row('out', '2026-09-26', 'PENDING', 18000),
      row('in', '2026-09-21', 'BOUNCED', 42000),
      row('out', '2026-09-25', 'PASSED', 31500, false),
      row('out', '2026-09-30', 'DEPOSITED', 12000),
    ]
    expect(dayCell('2026-09-29', rows, TODAY)).toMatchObject({ in: 20000, out: 120000, count: 2, done: false, flag: 'attention' })
    expect(dayCell('2026-09-26', rows, TODAY).flag).toBe('problem')
    expect(dayCell('2026-09-21', rows, TODAY).flag).toBe('problem')
    expect(dayCell('2026-09-25', rows, TODAY)).toMatchObject({ done: true, flag: null })
    expect(dayCell('2026-09-30', rows, TODAY)).toMatchObject({ done: false, flag: null })
    expect(dayCell('2026-09-28', rows, TODAY)).toMatchObject({ count: 0, done: false, flag: null })
  })
})
