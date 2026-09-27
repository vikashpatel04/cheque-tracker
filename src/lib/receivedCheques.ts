import { supabase } from './supabase'
import { buildSeries, type SeriesPlan } from './receivedSchedule'
import type { ReceivedKind, ReceivedStatus, SettlementMethod } from '@/types/received'
import type { Database } from '@/types/database'

/**
 * Received-cheque actions. Each one calls a SQL function from migration 012,
 * which checks the change, applies it and writes history in one transaction.
 * Status can't be changed any other way.
 */

type Result = { success: boolean; error?: string }

type Functions = Database['public']['Functions']

/**
 * A function's arguments, checked by name against the generated types. Any
 * of them may be null: a security cheque has no amount or date, and SQL
 * allows it, but the generated types can't say so.
 */
type Args<F extends keyof Functions> = { [K in keyof Functions[F]['Args']]: Functions[F]['Args'][K] | null }

async function rpc<F extends keyof Functions>(fn: F, args: Args<F>): Promise<Result & { data?: unknown }> {
  const { data, error } = await supabase.rpc(fn, args as Functions[F]['Args'])
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export interface NewReceivedCheque {
  party_id: string
  kind?: ReceivedKind
  cheque_number: string
  bank_name: string
  /** May be null only for a security cheque. */
  amount: number | null
  received_on: string
  /** May be null only for a security cheque. */
  cheque_date: string | null
  /** Defaults to the cheque date. Required for an undated security cheque (when to review it). */
  due_date?: string
  deposit_account_id?: string | null
  notes?: string | null
}

function toRow(userId: string, c: NewReceivedCheque) {
  const dueDate = c.due_date ?? c.cheque_date
  if (!dueDate) throw new Error('A due date is needed when the cheque has no date')
  return {
    user_id: userId,
    party_id: c.party_id,
    kind: c.kind ?? 'REGULAR',
    cheque_number: c.cheque_number.trim(),
    bank_name: c.bank_name.trim(),
    amount: c.amount,
    received_on: c.received_on,
    cheque_date: c.cheque_date,
    due_date: dueDate,
    deposit_account_id: c.deposit_account_id ?? null,
    notes: c.notes?.trim() || null,
  }
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Add a cheque you've received. It starts in hand. */
export async function createReceivedCheque(cheque: NewReceivedCheque): Promise<Result & { id?: string }> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Not signed in' }
  try {
    const { data, error } = await supabase.from('received_cheques').insert(toRow(userId, cheque)).select('id').single()
    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Add a series of cheques (rent, EMIs) in one go: all of them are saved, or
 * none are. Numbers and dates come from buildSeries; `base` supplies the rest.
 */
export async function createReceivedSeries(
  base: Omit<NewReceivedCheque, 'cheque_number' | 'cheque_date' | 'due_date'>,
  plan: SeriesPlan
): Promise<Result & { ids?: string[] }> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Not signed in' }
  try {
    const seriesId = crypto.randomUUID()
    const rows = buildSeries(plan).map((c) => {
      if (!c.cheque_number) throw new Error(`Cheque ${c.series_index} of the series has no number`)
      return {
        ...toRow(userId, { ...base, cheque_number: c.cheque_number, cheque_date: c.cheque_date }),
        series_id: seriesId,
        series_index: c.series_index,
      }
    })
    const { data, error } = await supabase.from('received_cheques').insert(rows).select('id')
    if (error) return { success: false, error: error.message }
    return { success: true, ids: data.map((r) => r.id as string) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** In hand → in clearing, for one or more cheques (all or nothing). */
export function depositReceivedCheques(
  chequeIds: string[],
  depositedOn: string,
  options: { accountId?: string; note?: string } = {}
): Promise<Result> {
  return rpc('deposit_received_cheques', {
    p_cheque_ids: [...new Set(chequeIds)],
    p_deposited_on: depositedOn,
    p_account_id: options.accountId ?? null,
    p_note: options.note ?? null,
  })
}

/** In clearing → cleared, for one or more cheques (all or nothing). */
export function clearReceivedCheques(chequeIds: string[], clearedOn: string, note?: string): Promise<Result> {
  return rpc('clear_received_cheques', {
    p_cheque_ids: [...new Set(chequeIds)],
    p_cleared_on: clearedOn,
    p_note: note ?? null,
  })
}

/** In clearing → bounced. Bank charges add up across bounces. */
export function bounceReceivedCheque(
  chequeId: string,
  options: { bouncedOn: string; reason: string; bankCharges?: number; note?: string }
): Promise<Result> {
  return rpc('bounce_received_cheque', {
    p_cheque_id: chequeId,
    p_bounced_on: options.bouncedOn,
    p_reason: options.reason,
    p_bank_charges: options.bankCharges ?? null,
    p_note: options.note ?? null,
  })
}

/**
 * Bounced → deposited again now (`depositNow`), or back in hand to deposit
 * on `date`.
 */
export function redepositReceivedCheque(
  chequeId: string,
  options: { date: string; depositNow: boolean; accountId?: string; note?: string }
): Promise<Result> {
  return rpc('redeposit_received_cheque', {
    p_cheque_id: chequeId,
    p_date: options.date,
    p_deposit_now: options.depositNow,
    p_account_id: options.accountId ?? null,
    p_note: options.note ?? null,
  })
}

/** In hand or bounced → settled: the payer paid another way. */
export function settleReceivedCheque(
  chequeId: string,
  options: { via: SettlementMethod; settledOn: string; reference?: string; note?: string }
): Promise<Result> {
  return rpc('settle_received_cheque', {
    p_cheque_id: chequeId,
    p_via: options.via,
    p_settled_on: options.settledOn,
    p_reference: options.reference ?? null,
    p_note: options.note ?? null,
  })
}

/** In hand → handed back to the payer. */
export function handBackReceivedCheque(chequeId: string, reason?: string): Promise<Result> {
  return rpc('hand_back_received_cheque', { p_cheque_id: chequeId, p_reason: reason ?? null })
}

/** In hand or bounced → written off (the money won't come). */
export function writeOffReceivedCheque(chequeId: string, reason: string): Promise<Result> {
  return rpc('write_off_received_cheque', { p_cheque_id: chequeId, p_reason: reason })
}

/** In hand or bounced → replaced by a new cheque from the same payer. Returns the new cheque's id. */
export async function replaceReceivedCheque(
  chequeId: string,
  replacement: {
    chequeNumber: string
    bankName: string
    amount: number | null
    chequeDate: string | null
    receivedOn: string
    dueDate?: string
    notes?: string
  }
): Promise<Result & { id?: string }> {
  const result = await rpc('replace_received_cheque', {
    p_cheque_id: chequeId,
    p_cheque_number: replacement.chequeNumber,
    p_bank_name: replacement.bankName,
    p_amount: replacement.amount,
    p_cheque_date: replacement.chequeDate,
    p_received_on: replacement.receivedOn,
    p_due_date: replacement.dueDate ?? null,
    p_notes: replacement.notes ?? null,
  })
  return { success: result.success, error: result.error, id: result.data as string | undefined }
}

/** Undo the cheque's latest change. Returns the status it went back to. */
export async function rollbackReceivedCheque(
  chequeId: string,
  note?: string
): Promise<Result & { status?: ReceivedStatus }> {
  const result = await rpc('rollback_received_cheque', { p_cheque_id: chequeId, p_note: note ?? null })
  return { success: result.success, error: result.error, status: result.data as ReceivedStatus | undefined }
}
