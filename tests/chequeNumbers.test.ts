import { describe, expect, it } from 'vitest'
import { inChequeBook, nextFreeNumber, numbersInBook, suggestChequeNumber, type NumberedCheque } from '@/lib/chequeNumbers'

function cheque(cheque_number: string, issue_date: string, bank_account_id: string | null, created_at = '2026-09-01T10:00:00+00:00'): NumberedCheque {
  return { cheque_number, issue_date, bank_account_id, created_at }
}

describe('Cheque books', () => {
  it('counts older cheques with no account for the default account only', () => {
    const older = { bank_account_id: null }
    expect(inChequeBook(older, 'a1', 'a1')).toBe(true)
    expect(inChequeBook(older, 'a2', 'a1')).toBe(false)
    expect(inChequeBook({ bank_account_id: 'a2' }, 'a2', 'a1')).toBe(true)
    expect(inChequeBook({ bank_account_id: 'a2' }, 'a1', 'a1')).toBe(false)
    // No account chosen: every cheque counts, as before accounts.
    expect(inChequeBook({ bank_account_id: 'a2' }, null, 'a1')).toBe(true)
  })

  it('lists the numbers one book has used', () => {
    const cheques = [cheque('100', '2026-09-01', 'a1'), cheque('200', '2026-09-01', 'a2'), cheque('050', '2026-08-01', null)]
    expect(numbersInBook(cheques, 'a1', 'a1')).toEqual(['100', '050'])
    expect(numbersInBook(cheques, 'a2', 'a1')).toEqual(['200'])
  })
})

describe('Suggesting the next cheque number', () => {
  it('follows the latest-issued cheque, not an older one added later', () => {
    const cheques = [
      cheque('789873', '2026-09-28', 'a1', '2026-09-28T09:00:00+00:00'),
      // Backfilled: added today, issued long ago.
      cheque('789803', '2026-06-02', 'a1', '2026-09-30T18:00:00+00:00'),
    ]
    expect(suggestChequeNumber(cheques, 'a1', 'a1')).toBe('789874')
  })

  it('uses each account’s own book, with older cheques in the default one', () => {
    const cheques = [
      cheque('789873', '2026-09-28', null),
      cheque('412007', '2026-09-20', 'a2'),
      cheque('789870', '2026-09-25', 'a1'),
    ]
    expect(suggestChequeNumber(cheques, 'a1', 'a1')).toBe('789874')
    expect(suggestChequeNumber(cheques, 'a2', 'a1')).toBe('412008')
  })

  it('on the same day, follows the cheque added last, e.g. the first leaf of a new book', () => {
    const cheques = [
      cheque('789900', '2026-09-30', 'a1', '2026-09-30T09:00:00+00:00'),
      cheque('123001', '2026-09-30', 'a1', '2026-09-30T11:00:00+00:00'),
    ]
    expect(suggestChequeNumber(cheques, 'a1', 'a1')).toBe('123002')
  })

  it('on the same day and added together, follows the highest number', () => {
    const cheques = [cheque('000998', '2026-09-30', 'a1'), cheque('001000', '2026-09-30', 'a1'), cheque('000999', '2026-09-30', 'a1')]
    expect(suggestChequeNumber(cheques, 'a1', 'a1')).toBe('001001')
  })

  it('skips numbers the book or the other rows already use', () => {
    const cheques = [cheque('500', '2026-09-30', 'a1'), cheque('501', '2026-08-01', 'a1'), cheque('503', '2026-08-02', 'a2')]
    expect(suggestChequeNumber(cheques, 'a1', 'a1')).toBe('502')
    expect(suggestChequeNumber(cheques, 'a1', 'a1', ['502'])).toBe('503')
  })

  it('suggests nothing for an account with no cheques yet', () => {
    expect(suggestChequeNumber([cheque('100', '2026-09-30', 'a1')], 'a2', 'a1')).toBe('')
    expect(suggestChequeNumber([], 'a1', 'a1')).toBe('')
  })

  it('steps past used numbers, keeping zero padding', () => {
    expect(nextFreeNumber('000123', new Set(['000124', '000125']))).toBe('000126')
    expect(nextFreeNumber('ABC', new Set())).toBe('')
  })
})
