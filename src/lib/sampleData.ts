import { addDays, addMonths, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { supabase } from './supabase'
import { announceDataChange } from './dataEvents'
import { createGivenCheque } from './chequeWrites'
import {
  bounceReceivedCheque,
  clearReceivedCheques,
  createReceivedCheque,
  createReceivedSeries,
  depositReceivedCheques,
  settleReceivedCheque,
} from './receivedCheques'
import { updateChequeStatus } from './updateChequeStatus'
import type { ChequeStatus } from '@/types'
import type { ReceivedKind, SettlementMethod } from '@/types/received'

/**
 * Made-up cheques to try the app with (plan item 11). Every party, account
 * and cheque here is fictional, and marked so it can be told apart and
 * removed in one go from Settings. Real cheque, party or bank data never goes
 * in the code.
 */
export const SAMPLE_NOTE = 'Sample data. Remove it in Settings → Sample data.'
export const SAMPLE_ACCOUNT = { name: 'Sample account', bank_name: 'Northwind Bank', last4: '0000' }
const SUFFIX = ' (sample)'

const ISO = 'yyyy-MM-dd'
const day = (today: string, offset: number) => format(addDays(parseISO(today), offset), ISO)

type Step =
  | { do: 'deposit'; on: string }
  | { do: 'clear'; on: string }
  | { do: 'bounce'; on: string; reason: string; charges?: number }
  | { do: 'settle'; on: string; via: SettlementMethod; reference?: string }

export interface SampleReceived {
  party: string
  number: string
  bank: string
  amount: number | null
  kind: ReceivedKind
  chequeDate: string | null
  due: string
  receivedOn: string
  notes?: string
  steps: Step[]
}

export interface SampleGiven {
  party: string
  number: string
  bank: string
  amount: number
  issued: string
  due: string
  /** Status changes after it's added, in order. */
  steps: ChequeStatus[]
  returnReason?: string
}

export interface SamplePlan {
  parties: string[]
  received: SampleReceived[]
  series: { party: string; firstNumber: string; bank: string; amount: number; firstDate: string; count: number }
  given: SampleGiven[]
}

/**
 * The sample, dated around `today` so every state shows: to deposit today and
 * overdue, going stale, in clearing (one slow), cleared, bounced, settled, a
 * security cheque, a monthly series, and given cheques that need funds,
 * are funded, passed or came back.
 */
export function samplePlan(today: string, validityMonths: number): SamplePlan {
  const p = (name: string) => `${name}${SUFFIX}`
  // A cheque dated so that it stops being valid `days` from today.
  const staleIn = (days: number) => format(subMonths(parseISO(day(today, days)), validityMonths), ISO)
  const nextMonth = format(startOfMonth(addMonths(parseISO(today), 1)), ISO)

  const received: SampleReceived[] = [
    { party: p('Sunrise Interiors'), number: '604518', bank: 'Riverside Bank', amount: 35000, kind: 'REGULAR', chequeDate: today, due: today, receivedOn: day(today, -4), steps: [] },
    { party: p('Harbor Logistics'), number: '773131', bank: 'Summit Bank', amount: 25000, kind: 'REGULAR', chequeDate: today, due: today, receivedOn: day(today, -6), steps: [] },
    { party: p('Lakeview Clinic'), number: '220917', bank: 'Lakeshore Bank', amount: 15000, kind: 'REGULAR', chequeDate: today, due: today, receivedOn: day(today, -2), steps: [] },
    { party: p('Nimbus Print Works'), number: '000912', bank: 'Riverside Bank', amount: 15000, kind: 'REGULAR', chequeDate: staleIn(3), due: day(today, -3), receivedOn: day(today, -20), steps: [] },
    { party: p('Vega Packaging'), number: '451207', bank: 'Summit Bank', amount: 20000, kind: 'REGULAR', chequeDate: staleIn(6), due: day(today, 4), receivedOn: day(today, -30), steps: [] },
    { party: p('Orbit Engineering'), number: '118340', bank: 'Lakeshore Bank', amount: 40000, kind: 'REGULAR', chequeDate: day(today, 10), due: day(today, 10), receivedOn: day(today, -1), steps: [] },
    {
      party: p('Coastal Freight'), number: '000418', bank: 'Summit Bank', amount: 42000, kind: 'REGULAR', chequeDate: day(today, -8), due: day(today, -6), receivedOn: day(today, -12),
      steps: [{ do: 'deposit', on: day(today, -6) }, { do: 'bounce', on: day(today, -3), reason: 'Funds insufficient', charges: 354 }],
    },
    { party: p('Delta Traders'), number: '773120', bank: 'Riverside Bank', amount: 60000, kind: 'REGULAR', chequeDate: day(today, -5), due: day(today, -5), receivedOn: day(today, -9), steps: [{ do: 'deposit', on: day(today, -5) }] },
    { party: p('Delta Traders'), number: '773121', bank: 'Riverside Bank', amount: 38000, kind: 'REGULAR', chequeDate: day(today, -5), due: day(today, -5), receivedOn: day(today, -9), steps: [{ do: 'deposit', on: day(today, -5) }] },
    { party: p('Pinewood Studio'), number: '309551', bank: 'Lakeshore Bank', amount: 73000, kind: 'REGULAR', chequeDate: day(today, -1), due: day(today, -1), receivedOn: day(today, -3), steps: [{ do: 'deposit', on: day(today, -1) }] },
    {
      party: p('Summit Tools'), number: '812004', bank: 'Summit Bank', amount: 31500, kind: 'REGULAR', chequeDate: day(today, -20), due: day(today, -20), receivedOn: day(today, -25),
      steps: [{ do: 'deposit', on: day(today, -20) }, { do: 'clear', on: day(today, -18) }],
    },
    {
      party: p('Maple Catering'), number: '560073', bank: 'Riverside Bank', amount: 12000, kind: 'REGULAR', chequeDate: day(today, -10), due: day(today, -10), receivedOn: day(today, -14),
      steps: [{ do: 'settle', on: day(today, -8), via: 'TRANSFER', reference: 'TXN-SAMPLE-1' }],
    },
    {
      party: p('Skyline Properties'), number: '118000', bank: 'Northwind Bank', amount: null, kind: 'SECURITY', chequeDate: null, due: day(today, 4), receivedOn: day(today, -60),
      notes: `Security for the office lease. ${SAMPLE_NOTE}`, steps: [],
    },
  ]

  const given: SampleGiven[] = [
    { party: p('Greenfield Supplies'), number: '310201', bank: 'Northwind Bank', amount: 18000, issued: day(today, -15), due: today, steps: [] },
    { party: p('Bluebell Printers'), number: '310202', bank: 'Northwind Bank', amount: 12500, issued: day(today, -12), due: day(today, 3), steps: [] },
    { party: p('Cedar Logistics'), number: '310203', bank: 'Northwind Bank', amount: 24000, issued: day(today, -10), due: day(today, 1), steps: ['DEPOSITED'] },
    { party: p('Greenfield Supplies'), number: '310198', bank: 'Northwind Bank', amount: 9500, issued: day(today, -30), due: day(today, -7), steps: ['DEPOSITED', 'PASSED'] },
    {
      party: p('Bluebell Printers'), number: '310199', bank: 'Northwind Bank', amount: 27000, issued: day(today, -25), due: day(today, -4), steps: ['DEPOSITED', 'RETURNED'],
      returnReason: 'Signature differs',
    },
  ]

  const names = [...received.map((c) => c.party), ...given.map((c) => c.party), p('Skyline Properties')]
  return {
    parties: [...new Set(names)],
    received,
    series: { party: p('Skyline Properties'), firstNumber: '118001', bank: 'Northwind Bank', amount: 25000, firstDate: nextMonth, count: 6 },
    given,
  }
}

type Result = { error?: string; added?: number }

/** Adds the sample to the signed-in account. Given samples only go into an account without given cheques. */
export async function addSampleData(today: string, validityMonths: number): Promise<Result> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const plan = samplePlan(today, validityMonths)

  const { count: givenCount } = await supabase.from('cheques').select('id', { count: 'exact', head: true }).is('deleted_at', null)
  const withGiven = (givenCount ?? 0) === 0

  const { data: parties, error: partyError } = await supabase
    .from('parties')
    .insert(plan.parties.map((name) => ({ user_id: user.id, name, notes: SAMPLE_NOTE, is_active: true })))
    .select('id, name')
  if (partyError || !parties) return { error: partyError?.message ?? 'Could not add the sample parties' }
  const partyId = (name: string) => parties.find((x) => x.name === name)!.id

  const { data: defaults } = await supabase.from('bank_accounts').select('id').eq('is_default', true).is('deleted_at', null)
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .insert({ user_id: user.id, ...SAMPLE_ACCOUNT, is_default: !defaults?.length })
    .select('id')
    .single()
  if (accountError || !account) return { error: accountError?.message ?? 'Could not add the sample account' }

  let added = 0
  for (const c of plan.received) {
    const created = await createReceivedCheque({
      party_id: partyId(c.party),
      kind: c.kind,
      cheque_number: c.number,
      bank_name: c.bank,
      amount: c.amount,
      received_on: c.receivedOn,
      cheque_date: c.chequeDate,
      due_date: c.due,
      deposit_account_id: account.id,
      notes: c.notes ?? SAMPLE_NOTE,
    })
    if (!created.success || !created.id) return { error: created.error ?? 'Could not add a sample cheque', added }
    added++
    for (const step of c.steps) {
      const done =
        step.do === 'deposit'
          ? await depositReceivedCheques([created.id], step.on, { accountId: account.id })
          : step.do === 'clear'
            ? await clearReceivedCheques([created.id], step.on)
            : step.do === 'bounce'
              ? await bounceReceivedCheque(created.id, { bouncedOn: step.on, reason: step.reason, bankCharges: step.charges })
              : await settleReceivedCheque(created.id, { via: step.via, settledOn: step.on, reference: step.reference })
      if (!done.success) return { error: done.error ?? 'Could not set up a sample cheque', added }
    }
  }

  const series = await createReceivedSeries(
    {
      party_id: partyId(plan.series.party),
      bank_name: plan.series.bank,
      amount: plan.series.amount,
      received_on: today,
      deposit_account_id: account.id,
      notes: SAMPLE_NOTE,
    },
    { firstNumber: plan.series.firstNumber, firstDate: plan.series.firstDate, count: plan.series.count, every: 'month' }
  )
  if (!series.success) return { error: series.error ?? 'Could not add the sample series', added }
  added += plan.series.count

  if (withGiven) {
    for (const c of plan.given) {
      const created = await createGivenCheque({
        party_id: partyId(c.party),
        cheque_number: c.number,
        bank_name: c.bank,
        amount: c.amount,
        issue_date: c.issued,
        due_date: c.due,
        notes: SAMPLE_NOTE,
      })
      if (created.error) return { error: created.error, added }
      added++
      if (!c.steps.length) continue
      const { data: row } = await supabase.from('cheques').select('id').eq('cheque_number', c.number).eq('notes', SAMPLE_NOTE).single()
      for (const status of c.steps) {
        const done = await updateChequeStatus(row!.id, status, {
          changedBy: 'manual',
          returnReason: status === 'RETURNED' ? c.returnReason : undefined,
        })
        if (!done.success) return { error: done.error, added }
      }
    }
  }

  announceDataChange()
  return { added }
}

/** Whether the account has any sample data to remove. */
export async function hasSampleData(): Promise<boolean> {
  const { count } = await supabase.from('parties').select('id', { count: 'exact', head: true }).eq('notes', SAMPLE_NOTE).is('deleted_at', null)
  return (count ?? 0) > 0
}

/** Removes everything the sample added. Cheques are kept in the database, marked deleted, like any delete in the app. */
export async function removeSampleData(): Promise<Result> {
  const now = new Date().toISOString()
  const steps = [
    supabase.from('received_cheques').update({ deleted_at: now }).like('notes', `%${SAMPLE_NOTE}`).is('deleted_at', null),
    supabase.from('cheques').update({ deleted_at: now }).eq('notes', SAMPLE_NOTE).is('deleted_at', null),
    supabase
      .from('bank_accounts')
      .update({ deleted_at: now, is_default: false })
      .eq('name', SAMPLE_ACCOUNT.name)
      .eq('last4', SAMPLE_ACCOUNT.last4)
      .is('deleted_at', null),
    supabase.from('parties').update({ deleted_at: now }).eq('notes', SAMPLE_NOTE).is('deleted_at', null),
  ]
  for (const step of steps) {
    const { error } = await step
    if (error) return { error: error.message }
  }
  announceDataChange()
  return {}
}
