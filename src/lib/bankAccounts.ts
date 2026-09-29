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

/**
 * The banks a given cheque can be drawn on: one per bank among your accounts,
 * with the accounts there as a second line. A cheque's current bank that
 * isn't one of them (an older cheque) stays on the list so editing keeps it.
 */
export function bankChoices(accounts: Pick<BankAccount, 'name' | 'last4' | 'bank_name'>[], current?: string | null): BankChoice[] {
  const byBank = new Map<string, string[]>()
  for (const account of accounts) {
    const bank = account.bank_name.trim()
    if (bank) byBank.set(bank, [...(byBank.get(bank) ?? []), accountLabel(account)])
  }
  const choices: BankChoice[] = [...byBank].map(([bank, labels]) => ({ value: bank, label: bank, hint: labels.join(', ') }))
  const kept = current?.trim()
  if (kept && !byBank.has(kept)) choices.push({ value: kept, label: kept, hint: 'Not one of your accounts' })
  return choices
}
