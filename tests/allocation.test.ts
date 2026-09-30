import { describe, expect, it } from 'vitest'
import { dueGroup, suggestForAccount } from '@/lib/allocationEngine'
import type { Cheque, Party } from '@/types'

let n = 0
function pending(amount: number, due: string, account: string | null): Cheque & { party: Party } {
  n++
  return {
    id: `c${n}`, user_id: 'u', party_id: 'p', cheque_number: `${n}`, bank_name: 'Bank', bank_account_id: account, amount,
    issue_date: '2026-09-01', due_date: due, status: 'PENDING', return_reason: null, auto_transition_blocked: false, notes: null,
    original_due_date: null, represent_count: 0, write_off_reason: null, replaces_cheque_id: null, deleted_at: null, created_at: '',
    updated_at: '', party: { id: 'p', name: 'Party' } as Party,
  }
}

describe('Add funds into one account', () => {
  const own = pending(4000, '2026-10-02', 'a1')
  const ownLater = pending(3000, '2026-10-05', 'a1')
  const other = pending(1000, '2026-09-30', 'a2')
  const older = pending(2000, '2026-09-30', null)

  it("covers that account's cheques first, then ones with no account, and leaves out other accounts", () => {
    const items = suggestForAccount([own, ownLater, other, older], 9000, 'due_date_asc', 'a1')
    expect(items.map((i) => [i.cheque.id, i.selected])).toEqual([
      [own.id, true],
      [ownLater.id, true],
      [older.id, true],
    ])
    // Not enough for everything: the account's own come first, even the older cheque is due sooner;
    // what's left then covers an older cheque that fits.
    const short = suggestForAccount([own, ownLater, older], 6000, 'due_date_asc', 'a1')
    expect(short.filter((i) => i.selected).map((i) => i.cheque.id)).toEqual([own.id, older.id])
  })

  it('counts every cheque when no account is chosen', () => {
    expect(suggestForAccount([own, other, older], 10000, 'due_date_asc', null)).toHaveLength(3)
  })

  it('puts each cheque under Overdue, Today, Tomorrow or Later', () => {
    expect(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].map((d) => dueGroup(d, '2026-09-29', '2026-09-30'))).toEqual([
      'overdue',
      'today',
      'tomorrow',
      'later',
    ])
  })
})
