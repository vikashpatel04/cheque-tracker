import { describe, expect, it } from 'vitest'
import { findPreset } from '@/config/regions'
import { regionFromPreset } from '@/lib/region'
import { planImport, type Workbook } from '@/lib/importPlan'

const india = regionFromPreset(findPreset('IN')!)
const us = regionFromPreset(findPreset('US')!)

/** A v0 export: its sheet names, its "Deposited" label and dd/MM/yyyy dates. */
const V0: Workbook = {
  Parties: [
    { Name: 'Party A', Contact: 'Contact A', Phone: '100', Bank: 'Bank One', Active: true, Notes: '' },
    { Name: 'Party B', Active: false },
    { Name: 'party a ', Contact: 'Someone else' },
    { Contact: 'Nobody' },
  ],
  Cheques: [
    { 'Cheque No.': '000101', Party: 'Party A', Bank: 'Bank One', Amount: 25000, 'Issue Date': '01/08/2026', 'Due Date': '05/09/2026', Status: 'Passed', 'Cheque Date': '', 'Times Re-presented': 0, 'Write-off Reason': '' },
    { 'Cheque No.': '000102', Party: 'PARTY A', Bank: 'Bank One', Amount: 12500.5, 'Issue Date': '01/08/2026', 'Due Date': '13/10/2026', Status: 'Deposited' },
    { 'Cheque No.': '000103', Party: 'Party C', Bank: 'Bank Two', Amount: 5000, 'Issue Date': '01/07/2026', 'Due Date': '15/11/2026', Status: 'Returned', 'Cheque Date': '15/08/2026', 'Times Re-presented': 1 },
    { 'Cheque No.': '000104', Party: 'Party B', Bank: 'Bank Two', Amount: 7000, 'Issue Date': '01/07/2026', 'Due Date': '31/02/2026', Status: 'Written Off' },
    { 'Cheque No.': '000105', Party: 'Party B', Bank: 'Bank Two', Amount: 0, 'Issue Date': '01/07/2026', 'Due Date': '01/08/2026', Status: 'Pending' },
    { 'Cheque No.': '000106', Party: 'Party B', Bank: 'Bank Two', Amount: 100, 'Issue Date': '01/07/2026', 'Due Date': '01/08/2026', Status: 'Bounced' },
    { 'Cheque No.': '000107', Party: 'Party B', Bank: 'Bank Two', Amount: 800, 'Issue Date': '01/07/2026', 'Due Date': '01/08/2026', Status: 'WRITTEN_OFF', 'Write-off Reason': 'Account closed' },
  ],
  History: [{ 'Cheque ID': 'id-1', From: 'PENDING', To: 'PASSED' }],
  Deposits: [
    { Amount: 25000, Date: '30/08/2026', Notes: 'For 000101' },
    { Amount: 'abc', Date: '30/09/2026' },
  ],
}

describe('planImport, v0 export', () => {
  const plan = planImport(V0, india)

  it('reads v0 sheets with dd/MM/yyyy dates', () => {
    expect(plan.format).toBe('v0')
    expect(plan.dateFormat).toBe('dd/MM/yyyy')
  })

  it('makes one party per name, and adds parties that only cheques name', () => {
    expect(plan.parties).toEqual([
      { name: 'Party A', contact_name: 'Contact A', phone: '100', bank_name: 'Bank One', notes: null, is_active: true },
      { name: 'Party B', contact_name: null, phone: null, bank_name: null, notes: null, is_active: false },
      { name: 'Party C', contact_name: null, phone: null, bank_name: null, notes: null, is_active: true },
    ])
    expect(plan.mergedParties).toEqual(['Party A'])
    expect(plan.addedParties).toEqual(['Party C'])
  })

  it('maps statuses, including v0\'s "Deposited", and keeps re-presentation details', () => {
    expect(plan.cheques.map((c) => [c.cheque_number, c.party, c.status, c.due_date])).toEqual([
      ['000101', 'Party A', 'PASSED', '2026-09-05'],
      ['000102', 'Party A', 'DEPOSITED', '2026-10-13'],
      ['000103', 'Party C', 'RETURNED', '2026-11-15'],
      ['000107', 'Party B', 'WRITTEN_OFF', '2026-08-01'],
    ])
    expect(plan.cheques[2]).toMatchObject({ original_due_date: '2026-08-15', represent_count: 1 })
    expect(plan.cheques[3].write_off_reason).toBe('Account closed')
    expect(plan.cheques[0]).toMatchObject({ original_due_date: null, write_off_reason: null, notes: null })
  })

  it('leaves out rows it can\'t read, and says why', () => {
    expect(plan.problems).toEqual([
      { sheet: 'Parties', row: 5, message: 'No name' },
      { sheet: 'Cheques', row: 5, message: 'Cheque 000104: can\'t read the due date "31/02/2026"' },
      { sheet: 'Cheques', row: 6, message: "Cheque 000105: the amount isn't a number above zero" },
      { sheet: 'Cheques', row: 7, message: 'Cheque 000106: unknown status "Bounced"' },
      { sheet: 'Deposits', row: 3, message: "The amount isn't a number above zero" },
    ])
    expect(plan.deposits).toEqual([{ amount: 25000, deposit_date: '2026-08-30', notes: 'For 000101' }])
  })

  it("explains that history can't be imported", () => {
    expect(plan.skippedSheets).toEqual([expect.objectContaining({ sheet: 'History', rows: 1 })])
  })

  it('reads v0 dates day first, whatever the region', () => {
    expect(planImport(V0, us).cheques[0].due_date).toBe('2026-09-05')
  })
})

describe('planImport, current export', () => {
  const current: Workbook = {
    Parties: [{ Name: 'Party A', Active: 'FALSE' }],
    'Given cheques': [
      { 'Cheque No.': '000201', Party: 'Party A', Bank: 'Bank One', Amount: '1,250.50', 'Issue Date': '09/01/2026', 'Due Date': '09/05/2026', Status: 'Funded' },
      // Excel may turn dates into date cells or serial numbers.
      { 'Cheque No.': '000202', Party: 'Party A', Bank: 'Bank One', Amount: 300, 'Issue Date': new Date(2026, 8, 1), 'Due Date': 46270, Status: 'Pending' },
    ],
    'Given history': [],
    'Funds added': [{ Amount: 1250.5, Date: '09/04/2026' }],
    'Received cheques': [{ 'Cheque No.': '1' }, { 'Cheque No.': '2' }],
    'Received history': [],
    'Bank accounts': [{ Name: 'Main' }],
  }
  const plan = planImport(current, us)

  it("reads dates in the user's format and amounts with their separators", () => {
    expect(plan.format).toBe('current')
    expect(plan.dateFormat).toBe(us.dateFormat)
    expect(plan.cheques[0]).toMatchObject({ amount: 1250.5, issue_date: '2026-09-01', due_date: '2026-09-05', status: 'DEPOSITED' })
    expect(plan.deposits).toEqual([{ amount: 1250.5, deposit_date: '2026-09-04', notes: null }])
    expect(plan.parties[0].is_active).toBe(false)
  })

  it('reads Excel date cells and serial numbers', () => {
    expect(plan.cheques[1]).toMatchObject({ issue_date: '2026-09-01', due_date: '2026-09-05' })
  })

  it('lists the sheets it leaves out', () => {
    expect(plan.skippedSheets.map((s) => [s.sheet, s.rows])).toEqual([
      ['Received cheques', 2],
      ['Bank accounts', 1],
    ])
    expect(plan.problems).toEqual([])
  })
})

it('refuses files that are not an export', () => {
  expect(() => planImport({ Sheet1: [{ A: 1 }] }, india)).toThrow(/no sheet of cheques/)
})
