import { supabase } from './supabase'
import type { ChequeStatus, UpdateChequeStatusOptions } from '@/types'

/**
 * Change a cheque's status via the change_cheque_status database function,
 * which validates the transition, updates the cheque, and writes the history
 * row in a single transaction.
 */
export async function updateChequeStatus(
  chequeId: string,
  newStatus: ChequeStatus,
  options: UpdateChequeStatusOptions
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('change_cheque_status', {
    p_cheque_id: chequeId,
    p_new_status: newStatus,
    p_changed_by: options.changedBy,
    p_note: options.note,
    p_return_reason: newStatus === 'RETURNED' ? options.returnReason : undefined,
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Record a bank deposit and mark the allocated cheques DEPOSITED in one
 * transaction — either all of it is saved or none of it is.
 */
export async function recordDeposit(
  amount: number,
  depositDate: string,
  chequeIds: string[],
  notes?: string,
  /** The account the money went into. */
  accountId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('record_deposit', {
    p_amount: amount,
    p_deposit_date: depositDate,
    p_cheque_ids: chequeIds,
    p_notes: notes,
    p_account_id: accountId ?? undefined,
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Re-present a returned cheque: the same cheque goes back to PENDING with a
 * new due date (or straight on to DEPOSITED when markDeposited is set).
 */
export async function representCheque(
  chequeId: string,
  newDueDate: string,
  options: { note?: string; markDeposited?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('represent_cheque', {
    p_cheque_id: chequeId,
    p_new_due_date: newDueDate,
    p_note: options.note,
    p_mark_deposited: options.markDeposited ?? false,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Close a returned cheque as WRITTEN_OFF (unusable) with a reason. */
export async function writeOffCheque(
  chequeId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('write_off_cheque', {
    p_cheque_id: chequeId,
    p_reason: reason,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Undo the cheque's latest status change. Returns the status it went back to. */
export async function rollbackChequeStatus(
  chequeId: string,
  note?: string
): Promise<{ success: boolean; error?: string; status?: ChequeStatus }> {
  const { data, error } = await supabase.rpc('rollback_cheque_status', {
    p_cheque_id: chequeId,
    p_note: note,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, status: data as ChequeStatus }
}
