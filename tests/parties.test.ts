import { describe, expect, it } from 'vitest'
import { givenRow, receivedRow } from '@/lib/chequeList'
import { summarizeParties, summarizeParty, whatsappLink } from '@/lib/parties'
import type { Cheque, ChequeStatus } from '@/types'
import type { ReceivedCheque, ReceivedStatus } from '@/types/received'

const TODAY = '2026-09-29'
let n = 0

function given(status: ChequeStatus, due: string, amount: number, extra: Partial<Cheque> = {}) {
  n++
  return givenRow({
    id: `g${n}`, user_id: 'u', party_id: 'p1', cheque_number: `${n}`, bank_name: 'Bank', amount, issue_date: '2026-09-01', due_date: due,
    status, return_reason: null, auto_transition_blocked: false, notes: null, original_due_date: null, represent_count: 0,
    write_off_reason: null, replaces_cheque_id: null, deleted_at: null, created_at: '', updated_at: '', ...extra,
  })
}

function received(status: ReceivedStatus, due: string, amount: number | null, extra: Partial<ReceivedCheque> = {}) {
  n++
  return receivedRow({
    id: `r${n}`, user_id: 'u', party_id: 'p1', kind: 'REGULAR', cheque_number: `${n}`, bank_name: 'Bank', amount, received_on: '2026-09-01',
    cheque_date: due, due_date: due, status, deposit_account_id: null, deposited_on: null, cleared_on: null, bounced_on: null,
    bounce_reason: null, bank_charges: null, settled_on: null, settled_via: null, settlement_ref: null, close_reason: null,
    redeposit_count: 0, replaces_id: null, series_id: null, series_index: null, notes: null, deleted_at: null, created_at: '',
    updated_at: '', ...extra,
  })
}

describe('a party, both ways', () => {
  const rows = [
    given('PENDING', '2026-10-02', 45000),
    given('PASSED', '2026-08-10', 100000),
    given('RETURNED', '2026-09-20', 40000, { represent_count: 0 }),
    given('CANCELLED', '2026-07-01', 5000),
    received('DEPOSITED', '2026-09-24', 60000, { deposited_on: '2026-09-24' }),
    received('CLEARED', '2026-07-15', 280000, { redeposit_count: 1 }),
    received('IN_HAND', '2026-09-27', 15000),
    received('HANDED_BACK', '2026-06-01', 20000),
  ]

  it('adds up what is still to pay and to collect, and the net', () => {
    const s = summarizeParty(rows, TODAY)
    expect(s.pay).toEqual({ amount: 85000, count: 2 })
    expect(s.collect).toEqual({ amount: 75000, count: 2 })
    expect(s.net).toBe(-10000)
  })

  it('keeps all-time totals without cancelled, written-off or handed-back cheques', () => {
    const s = summarizeParty(rows, TODAY)
    expect(s.gave).toEqual({ amount: 185000, count: 3, passed: 100000, returnedOwed: 40000 })
    expect(s.got).toEqual({ amount: 355000, count: 3, clearing: 60000, cleared: 280000 })
  })

  it('counts bounces either way, and says what is next', () => {
    const s = summarizeParty(rows, TODAY)
    expect(s.bounces).toBe(2)
    // The cheque in hand was due on the 27th: overdue, and sooner than the given one.
    expect(s.next).toEqual({ date: '2026-09-27', overdue: true })
  })

  it('makes WhatsApp links, adding the calling code to local numbers', () => {
    expect(whatsappLink('98765 43210', '91')).toBe('https://wa.me/919876543210')
    expect(whatsappLink('098765-43210', '91')).toBe('https://wa.me/919876543210')
    expect(whatsappLink('+44 20 7946 0000', '91')).toBe('https://wa.me/442079460000')
    expect(whatsappLink('0044 20 7946 0000', undefined)).toBe('https://wa.me/442079460000')
    // No calling code for the region, and none written: no link rather than a wrong one.
    expect(whatsappLink('555 0100', undefined)).toBeNull()
    expect(whatsappLink('12', '1')).toBeNull()
    expect(whatsappLink(null, '1')).toBeNull()
  })

  it('groups rows by party', () => {
    const other = given('PENDING', '2026-10-05', 1000, { party_id: 'p2' })
    const all = summarizeParties([...rows, other], TODAY)
    expect([...all.keys()].sort()).toEqual(['p1', 'p2'])
    expect(all.get('p2')?.next).toEqual({ date: '2026-10-05', overdue: false })
  })
})
