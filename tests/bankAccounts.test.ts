import { describe, expect, it } from 'vitest'
import { OTHER_BANK, accountChoices } from '@/lib/bankAccounts'

describe('the accounts a given cheque can be drawn on', () => {
  const accounts = [
    { id: 'a1', name: 'Main', last4: '1234', bank_name: 'First Bank' },
    { id: 'a2', name: 'Savings', last4: null, bank_name: 'First Bank' },
    { id: 'a3', name: 'Business', last4: '9876', bank_name: 'Second Bank' },
  ]

  it('lists every account, even two at the same bank, with the bank under it', () => {
    expect(accountChoices(accounts)).toEqual([
      { value: 'a1', label: 'Main ···1234', hint: 'First Bank' },
      { value: 'a2', label: 'Savings', hint: 'First Bank' },
      { value: 'a3', label: 'Business ···9876', hint: 'Second Bank' },
    ])
  })

  it("keeps an older cheque's bank, or a removed account, so editing doesn't lose it", () => {
    expect(accountChoices(accounts, { accountId: null, bankName: 'Old Bank' }).at(-1)).toEqual({
      value: OTHER_BANK,
      label: 'Old Bank',
      hint: 'Not one of your accounts',
    })
    expect(accountChoices(accounts, { accountId: 'gone', bankName: 'First Bank' }).at(-1)).toEqual({
      value: 'gone',
      label: 'First Bank',
      hint: 'An account you removed',
    })
    expect(accountChoices(accounts, { accountId: 'a1', bankName: 'First Bank' })).toHaveLength(3)
    expect(accountChoices([], { accountId: null, bankName: '' })).toEqual([])
  })
})
