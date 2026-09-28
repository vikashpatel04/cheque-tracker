import type { ListRow } from './chequeList'
import type { Party } from '@/types'

/**
 * Per party, both directions: what you still pay them, what they still pay
 * you, bounces, and the next date. Pure, from the Cheques list's rows; dates
 * are yyyy-MM-dd.
 */
export interface PartySummary {
  /** Given cheques still to pass (waiting, funded, or returned and not settled). */
  pay: { amount: number; count: number }
  /** Received cheques still to come in (in hand, in clearing, or bounced). */
  collect: { amount: number; count: number }
  /** Still to collect minus still to pay. */
  net: number
  /** Cheques that ever came back: returned given ones, bounced received ones. */
  bounces: number
  /** The soonest date something is due, and whether it has already passed. */
  next: { date: string; overdue: boolean } | null
  /** All given cheques that were or will be paid (not cancelled or written off). */
  gave: { amount: number; count: number; passed: number; returnedOwed: number }
  /** All received cheques that did or will bring money (not handed back, written off or replaced). */
  got: { amount: number; count: number; clearing: number; cleared: number }
}

const GIVEN_VOID = new Set(['CANCELLED', 'WRITTEN_OFF'])
const RECEIVED_VOID = new Set(['HANDED_BACK', 'WRITTEN_OFF', 'REPLACED'])

export function emptySummary(): PartySummary {
  return {
    pay: { amount: 0, count: 0 },
    collect: { amount: 0, count: 0 },
    net: 0,
    bounces: 0,
    next: null,
    gave: { amount: 0, count: 0, passed: 0, returnedOwed: 0 },
    got: { amount: 0, count: 0, clearing: 0, cleared: 0 },
  }
}

export function summarizeParty(rows: ListRow[], today: string): PartySummary {
  const s = emptySummary()
  const amount = (r: ListRow) => r.amount ?? 0
  for (const r of rows) {
    if (r.given) {
      const g = r.given
      if (!GIVEN_VOID.has(g.status)) {
        s.gave.amount += amount(r)
        s.gave.count++
        if (g.status === 'PASSED') s.gave.passed += amount(r)
      }
      if (r.open) {
        s.pay.amount += amount(r)
        s.pay.count++
        if (g.status === 'RETURNED') s.gave.returnedOwed += amount(r)
      }
      if (g.status === 'RETURNED' || g.represent_count > 0) s.bounces++
    } else if (r.received) {
      const c = r.received
      if (!RECEIVED_VOID.has(c.status)) {
        s.got.amount += amount(r)
        s.got.count++
        if (c.status === 'DEPOSITED') s.got.clearing += amount(r)
        if (c.status === 'CLEARED') s.got.cleared += amount(r)
      }
      if (r.open) {
        s.collect.amount += amount(r)
        s.collect.count++
      }
      if (c.status === 'BOUNCED' || c.redeposit_count > 0) s.bounces++
    }
    // What's next: the soonest date of a cheque still waiting on its date.
    const waiting = r.status === 'PENDING' || r.status === 'DEPOSITED' || r.status === 'IN_HAND'
    if (r.open && waiting && !(r.received?.status === 'DEPOSITED')) {
      if (!s.next || r.due < s.next.date) s.next = { date: r.due, overdue: r.due < today }
    }
  }
  s.net = s.collect.amount - s.pay.amount
  return s
}

/** "Rohan Pillai · 98765 43210 · Kotak Bank": who they are, in one line. */
export function partyAbout(p: Pick<Party, 'contact_name' | 'phone' | 'bank_name'>): string {
  return [p.contact_name, p.phone, p.bank_name].filter(Boolean).join(' · ')
}

/**
 * A WhatsApp chat link for a phone number, or null when there's no usable
 * number. A number written without "+" or "00" is taken as local: leading
 * zeros go and the user's calling code (from their region preset) goes first.
 */
export function whatsappLink(phone: string | null | undefined, callingCode: string | undefined): string | null {
  const written = phone?.trim() ?? ''
  let digits = written.replace(/\D/g, '')
  if (!written.startsWith('+')) {
    if (digits.startsWith('00')) digits = digits.slice(2)
    else if (callingCode) digits = callingCode + digits.replace(/^0+/, '')
    else return null
  }
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null
}

/** Summaries for every party that has cheques, by party id. */
export function summarizeParties(rows: ListRow[], today: string): Map<string, PartySummary> {
  const byParty = new Map<string, ListRow[]>()
  for (const r of rows) byParty.set(r.partyId, [...(byParty.get(r.partyId) ?? []), r])
  const summaries = new Map<string, PartySummary>()
  for (const [partyId, partyRows] of byParty) summaries.set(partyId, summarizeParty(partyRows, today))
  return summaries
}
