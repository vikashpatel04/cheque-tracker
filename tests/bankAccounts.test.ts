import { describe, expect, it } from 'vitest'
import { bankChoices } from '@/lib/bankAccounts'

describe('the banks a given cheque can be drawn on', () => {
  const accounts = [
    { name: 'Main', last4: '1234', bank_name: 'First Bank' },
    { name: 'Savings', last4: null, bank_name: 'First Bank' },
    { name: 'Business', last4: '9876', bank_name: 'Second Bank ' },
  ]

  it('lists each bank of your accounts once, with the accounts there under it', () => {
    expect(bankChoices(accounts)).toEqual([
      { value: 'First Bank', label: 'First Bank', hint: 'Main ···1234, Savings' },
      { value: 'Second Bank', label: 'Second Bank', hint: 'Business ···9876' },
    ])
  })

  it("keeps an older cheque's bank that isn't one of your accounts, so editing doesn't lose it", () => {
    expect(bankChoices(accounts, 'Old Bank').at(-1)).toEqual({ value: 'Old Bank', label: 'Old Bank', hint: 'Not one of your accounts' })
    expect(bankChoices(accounts, 'Second Bank')).toHaveLength(2)
    expect(bankChoices([], '')).toEqual([])
  })
})
