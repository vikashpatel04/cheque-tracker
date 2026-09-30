import { supabase } from './supabase'
import { announceDataChange } from './dataEvents'
import type { BankAccount } from '@/types/received'

/**
 * Your own bank accounts: the ones you write cheques from and deposit
 * received cheques into (plan item 74). Only a name, the bank and the last
 * four digits are kept, never the full number.
 */
export interface BankAccountInput {
  name: string
  bank_name: string
  last4: string | null
  is_default: boolean
}

type Result = { error?: string; id?: string }

/** Only one account can be the default, so the old one is cleared first. */
async function clearDefault(exceptId?: string): Promise<string | undefined> {
  let query = supabase.from('bank_accounts').update({ is_default: false }).eq('is_default', true).is('deleted_at', null)
  if (exceptId) query = query.neq('id', exceptId)
  const { error } = await query
  return error?.message
}

export async function createBankAccount(input: BankAccountInput): Promise<Result> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (input.is_default) {
    const error = await clearDefault()
    if (error) return { error }
  }
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({ ...input, user_id: user.id, last4: input.last4 || null })
    .select('id')
    .single()
  if (error) return { error: error.message }
  announceDataChange()
  return { id: data.id }
}

export async function updateBankAccount(id: string, input: BankAccountInput): Promise<Result> {
  if (input.is_default) {
    const error = await clearDefault(id)
    if (error) return { error }
  }
  const { error } = await supabase
    .from('bank_accounts')
    .update({ ...input, last4: input.last4 || null })
    .eq('id', id)
  if (error) return { error: error.message }
  announceDataChange()
  return {}
}

/** Kept for the cheques already deposited into it, but no longer offered. */
export async function removeBankAccount(account: BankAccount): Promise<Result> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('id', account.id)
  if (error) return { error: error.message }
  announceDataChange()
  return {}
}

/** "HDFC Bank ···4821", or just the name. */
export function accountLabel(account: Pick<BankAccount, 'name' | 'last4'> | null | undefined): string {
  if (!account) return ''
  return account.last4 ? `${account.name} ···${account.last4}` : account.name
}

export interface BankChoice {
  value: string
  label: string
  hint?: string
}

/** The choice for an older cheque's bank that isn't one of your accounts. */
export const OTHER_BANK = '__other_bank__'

/**
 * The accounts a given cheque can be drawn on (plan item 77): each account by
 * name and last four digits, with its bank under it, so two accounts at the
 * same bank are two choices. An older cheque with only a bank name, or on an
 * account since removed, keeps that as a choice so editing doesn't lose it.
 */
export function accountChoices(
  accounts: Pick<BankAccount, 'id' | 'name' | 'last4' | 'bank_name'>[],
  current?: { accountId?: string | null; bankName?: string | null }
): BankChoice[] {
  const choices: BankChoice[] = accounts.map((a) => ({ value: a.id, label: accountLabel(a), hint: a.bank_name }))
  const bank = current?.bankName?.trim() ?? ''
  if (current?.accountId && !accounts.some((a) => a.id === current.accountId)) {
    choices.push({ value: current.accountId, label: bank || 'Removed account', hint: 'An account you removed' })
  } else if (!current?.accountId && bank) {
    choices.push({ value: OTHER_BANK, label: bank, hint: 'Not one of your accounts' })
  }
  return choices
}
