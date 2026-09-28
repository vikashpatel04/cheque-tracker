import type { Cheque } from '@/types'

export type ChequeTag = 'RE_PRESENTED' | 'FROM_RETURN' | 'WRITTEN_OFF'

export function extractTags(notes: string | null): ChequeTag[] {
  if (!notes) return []
  const tags: ChequeTag[] = []
  if (notes.includes('[RE_PRESENTED]')) tags.push('RE_PRESENTED')
  if (notes.includes('[FROM_RETURN]')) tags.push('FROM_RETURN')
  if (notes.includes('[WRITTEN_OFF]')) tags.push('WRITTEN_OFF')
  return tags
}

export function stripTagLines(notes: string | null): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !['[RE_PRESENTED]', '[FROM_RETURN]', '[WRITTEN_OFF]'].some((t) => line.startsWith(t)))
    .join('\n')
    .trim()
}

/** Returned cheque re-presented with the old flow (a separate cheque row was created). */
export function isLegacyRepresented(cheque: Cheque): boolean {
  return extractTags(cheque.notes).includes('RE_PRESENTED')
}

/** Route that opens Add Cheque pre-filled as a replacement for the given (written-off) cheque. */
export function replacementChequePath(chequeId: string) {
  return `/cheques?replace=${chequeId}`
}

/**
 * Whether a cheque counts as a separate issued amount in totals. The old
 * re-present flow created a second row for the same payment; the returned
 * original is settled by that copy, so only the copy counts.
 */
export function countsAsIssued(cheque: Cheque): boolean {
  return !isLegacyRepresented(cheque)
}

/** Amount we still have to pay: scheduled (pending/funded) or bounced and not yet resolved. */
export function isStillToPay(cheque: Cheque): boolean {
  if (!countsAsIssued(cheque)) return false
  return ['PENDING', 'DEPOSITED', 'RETURNED'].includes(cheque.status)
}
