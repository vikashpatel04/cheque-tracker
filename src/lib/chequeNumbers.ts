import { nextChequeNumber } from './formatters'

/** A given cheque's number, and what places it in a cheque book. */
export interface NumberedCheque {
  cheque_number: string
  issue_date: string
  created_at?: string | null
  bank_account_id?: string | null
}

/**
 * Whether a given cheque is from an account's cheque book. Cheques from before
 * accounts (no account) count for your default account; with no account
 * chosen, every cheque counts.
 */
export function inChequeBook(
  cheque: { bank_account_id?: string | null },
  accountId: string | null,
  defaultAccountId: string | null
): boolean {
  if (!accountId) return true
  return cheque.bank_account_id ? cheque.bank_account_id === accountId : accountId === defaultAccountId
}

/** The number after `from` that isn't in `used` ('' when `from` has no digits). */
export function nextFreeNumber(from: string, used: ReadonlySet<string>): string {
  let next = nextChequeNumber(from.trim())
  for (let i = 0; next && used.has(next) && i < 1000; i++) next = nextChequeNumber(next)
  return next
}

/** Compares the digits as numbers: "0999" before "1000", "99" before "100". */
function compareNumbers(a: string, b: string): number {
  const da = a.replace(/\D/g, '').replace(/^0+/, '')
  const db = b.replace(/\D/g, '').replace(/^0+/, '')
  return da.length - db.length || (da < db ? -1 : da > db ? 1 : 0)
}

/** Issued later; on the same day, added later, then the higher number. */
function isLater(a: NumberedCheque, b: NumberedCheque): boolean {
  if (a.issue_date !== b.issue_date) return a.issue_date > b.issue_date
  const addedA = a.created_at ?? ''
  const addedB = b.created_at ?? ''
  if (addedA !== addedB) return addedA > addedB
  return compareNumbers(a.cheque_number, b.cheque_number) > 0
}

/**
 * The number to suggest for a new cheque from an account (plan item 81): one
 * after the latest-issued cheque in its cheque book, so older cheques you add
 * later don't throw it off, skipping numbers the book (or `alsoUsed`, such as
 * other rows being added) already has. '' when the book has no cheques yet:
 * you type the first one.
 */
export function suggestChequeNumber(
  cheques: readonly NumberedCheque[],
  accountId: string | null,
  defaultAccountId: string | null,
  alsoUsed: readonly string[] = []
): string {
  const book = cheques.filter((c) => c.cheque_number.trim() && inChequeBook(c, accountId, defaultAccountId))
  if (!book.length) return ''
  const latest = book.reduce((a, b) => (isLater(b, a) ? b : a))
  const used = new Set([...book.map((c) => c.cheque_number.trim()), ...alsoUsed.map((n) => n.trim())])
  return nextFreeNumber(latest.cheque_number, used)
}

/** The numbers an account's cheque book has used. */
export function numbersInBook(
  cheques: readonly NumberedCheque[],
  accountId: string | null,
  defaultAccountId: string | null
): string[] {
  return cheques.filter((c) => inChequeBook(c, accountId, defaultAccountId)).map((c) => c.cheque_number.trim())
}
