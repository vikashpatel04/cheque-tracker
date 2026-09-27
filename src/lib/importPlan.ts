import type { DateFormat } from '@/config/regions'
import { STATUS_LABELS, type ChequeStatus } from '@/types'
import { parseAmount, parseFlexibleDate, toISODate } from './formatters'
import type { Region } from './region'

/**
 * Import from a Cheque Tracker export: the Excel file from Settings → Export,
 * made by this app or by v0. planImport() works out what can be imported and
 * what can't, for a preview; importData.ts reads the file and saves the plan.
 */

/** Sheets by name, each as rows keyed by column header. */
export type Workbook = Record<string, Record<string, unknown>[]>

export type ImportParty = {
  name: string
  contact_name: string | null
  phone: string | null
  bank_name: string | null
  notes: string | null
  is_active: boolean
}

export type ImportCheque = {
  party: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  due_date: string
  status: ChequeStatus
  original_due_date: string | null
  represent_count: number
  write_off_reason: string | null
  notes: string | null
}

export type ImportDeposit = {
  amount: number
  deposit_date: string
  notes: string | null
}

export interface ImportProblem {
  sheet: string
  /** The row number Excel shows, counting the header row. */
  row: number
  message: string
}

export interface ImportPlan {
  /** v0's exports name their sheets differently and always wrote dates as dd/MM/yyyy. */
  format: 'v0' | 'current'
  /** The date format text dates were read with. */
  dateFormat: string
  parties: ImportParty[]
  cheques: ImportCheque[]
  deposits: ImportDeposit[]
  /** Rows that will be left out, and why. */
  problems: ImportProblem[]
  /** Parties that cheques name but the Parties sheet doesn't list. They're added. */
  addedParties: string[]
  /** Names listed more than once in the Parties sheet. Each becomes one party. */
  mergedParties: string[]
  /** Sheets with rows that aren't imported, and why. */
  skippedSheets: { sheet: string; rows: number; reason: string }[]
}

export interface ImportCounts {
  parties: number
  cheques: number
  deposits: number
}

const SHEETS = {
  v0: { cheques: 'Cheques', history: 'History', deposits: 'Deposits' },
  current: { cheques: 'Given cheques', history: 'Given history', deposits: 'Funds added' },
} as const

/** Sheets of the current export that this import doesn't cover yet. */
const NOT_YET = ['Received cheques', 'Received history', 'Bank accounts']

const V0_DATE_FORMAT: DateFormat = 'dd/MM/yyyy'

/** Status labels and values, as exports have written them. */
const STATUS_BY_NAME = new Map<string, ChequeStatus>([
  ...Object.entries(STATUS_LABELS).map(([status, label]) => [label.toLowerCase(), status as ChequeStatus] as const),
  ...Object.keys(STATUS_LABELS).map((status) => [status.toLowerCase(), status as ChequeStatus] as const),
  // v0 labelled Funded as "Deposited".
  ['deposited', 'DEPOSITED'],
])

const text = (value: unknown) => (value == null ? '' : String(value).trim())
const optionalText = (value: unknown) => text(value) || null
const key = (name: string) => name.trim().toLowerCase()

function yesNo(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return !['false', 'no', '0'].includes(key(text(value)))
}

function amountOf(value: unknown, region: Region): number {
  if (typeof value === 'number') return value
  return parseAmount(text(value), region)
}

function dateOf(value: unknown, region: Region): string | null {
  const date = parseFlexibleDate(value, region)
  return date ? toISODate(date) : null
}

function countOf(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(text(value), 10)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Work out what a workbook would import. `region` is the user's: dates in a
 * current export are read in its date format, amounts with its separators.
 */
export function planImport(workbook: Workbook, region: Region): ImportPlan {
  const format = SHEETS.current.cheques in workbook ? 'current' : SHEETS.v0.cheques in workbook ? 'v0' : null
  if (!format) {
    throw new Error("This doesn't look like an export from Settings → Export: it has no sheet of cheques.")
  }
  const sheets = SHEETS[format]
  const dates: Region = format === 'v0' ? { ...region, dateFormat: V0_DATE_FORMAT } : region
  const problems: ImportProblem[] = []
  const rowsOf = (sheet: string) => workbook[sheet] ?? []

  // Parties, one per name.
  const parties = new Map<string, ImportParty>()
  const merged = new Set<string>()
  rowsOf('Parties').forEach((row, i) => {
    const name = text(row['Name'])
    if (!name) {
      problems.push({ sheet: 'Parties', row: i + 2, message: 'No name' })
      return
    }
    if (parties.has(key(name))) {
      merged.add(parties.get(key(name))!.name)
      return
    }
    parties.set(key(name), {
      name,
      contact_name: optionalText(row['Contact']),
      phone: optionalText(row['Phone']),
      bank_name: optionalText(row['Bank']),
      notes: optionalText(row['Notes']),
      is_active: row['Active'] == null ? true : yesNo(row['Active']),
    })
  })

  // Given cheques.
  const added: string[] = []
  const cheques: ImportCheque[] = []
  rowsOf(sheets.cheques).forEach((row, i) => {
    const problem = (message: string) => problems.push({ sheet: sheets.cheques, row: i + 2, message })
    const number = text(row['Cheque No.'])
    const party = text(row['Party'])
    const bank = text(row['Bank'])
    const amount = amountOf(row['Amount'], region)
    const issueDate = dateOf(row['Issue Date'], dates)
    const dueDate = dateOf(row['Due Date'], dates)
    const status = STATUS_BY_NAME.get(key(text(row['Status'])))
    if (!number) return problem('No cheque number')
    if (!party) return problem(`Cheque ${number}: no party`)
    if (!bank) return problem(`Cheque ${number}: no bank`)
    if (!(amount > 0)) return problem(`Cheque ${number}: the amount isn't a number above zero`)
    if (!issueDate) return problem(`Cheque ${number}: can't read the issue date "${text(row['Issue Date'])}"`)
    if (!dueDate) return problem(`Cheque ${number}: can't read the due date "${text(row['Due Date'])}"`)
    if (!status) return problem(`Cheque ${number}: unknown status "${text(row['Status'])}"`)

    if (!parties.has(key(party))) {
      parties.set(key(party), { name: party, contact_name: null, phone: null, bank_name: null, notes: null, is_active: true })
      added.push(party)
    }
    cheques.push({
      party: parties.get(key(party))!.name,
      cheque_number: number,
      bank_name: bank,
      amount,
      issue_date: issueDate,
      due_date: dueDate,
      status,
      original_due_date: dateOf(row['Cheque Date'], dates),
      represent_count: countOf(row['Times Re-presented']),
      write_off_reason: optionalText(row['Write-off Reason']),
      notes: optionalText(row['Notes']),
    })
  })

  // Funds added.
  const deposits: ImportDeposit[] = []
  rowsOf(sheets.deposits).forEach((row, i) => {
    const problem = (message: string) => problems.push({ sheet: sheets.deposits, row: i + 2, message })
    const amount = amountOf(row['Amount'], region)
    const date = dateOf(row['Date'], dates)
    if (!date) return problem(`Can't read the date "${text(row['Date'])}"`)
    if (!(amount > 0)) return problem("The amount isn't a number above zero")
    deposits.push({ amount, deposit_date: date, notes: optionalText(row['Notes']) })
  })

  const skippedSheets: ImportPlan['skippedSheets'] = []
  if (rowsOf(sheets.history).length) {
    skippedSheets.push({
      sheet: sheets.history,
      rows: rowsOf(sheets.history).length,
      reason: "The file doesn't say which cheque each change belongs to, so each cheque gets one \"Imported\" entry instead.",
    })
  }
  for (const sheet of NOT_YET) {
    if (rowsOf(sheet).length) skippedSheets.push({ sheet, rows: rowsOf(sheet).length, reason: "Import doesn't cover these yet." })
  }

  return {
    format,
    dateFormat: dates.dateFormat,
    parties: [...parties.values()],
    cheques,
    deposits,
    problems,
    addedParties: added,
    mergedParties: [...merged],
    skippedSheets,
  }
}
