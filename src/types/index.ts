import type { DateFormat, WeekStart } from '@/config/regions'

export type ChequeStatus =
  | 'PENDING'
  | 'DEPOSITED'
  | 'PASSED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'WRITTEN_OFF'

export type ChangedBy = 'manual' | 'auto' | 'deposit_allocation' | 'rollback' | 'import'

export type AllocationSort = 'due_date_asc' | 'amount_asc' | 'amount_desc'

// Rows as the app uses them. They're stricter than the generated types in
// ./database.ts: statuses are the known values, and columns the database
// fills by default, such as is_active and created_at, are never null. Hooks
// cast query results to these types.

export interface Party {
  id: string
  user_id: string
  name: string
  contact_name: string | null
  phone: string | null
  bank_name: string | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export interface Cheque {
  id: string
  user_id: string
  party_id: string
  cheque_number: string
  bank_name: string
  /** The account it's drawn on (migration 018); older cheques only have a bank name. */
  bank_account_id?: string | null
  amount: number
  issue_date: string
  due_date: string
  status: ChequeStatus
  return_reason: string | null
  auto_transition_blocked: boolean
  notes: string | null
  /** Date printed on the cheque, set when a returned cheque is re-presented with a new due_date. */
  original_due_date: string | null
  /** Times this cheque was returned and re-presented. */
  represent_count: number
  /** Reason given when the cheque was written off (status WRITTEN_OFF). */
  write_off_reason: string | null
  /** For a new cheque issued in place of a written-off one. */
  replaces_cheque_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  party?: Party
}

export interface ChequeHistory {
  id: string
  cheque_id: string
  from_status: ChequeStatus
  to_status: ChequeStatus
  changed_by: ChangedBy
  note: string | null
  created_at: string
  /** Set on rollback rows: the history row that was undone. */
  reverts_history_id?: string | null
  cheque?: Cheque & { party?: Party }
}

export interface DailyDeposit {
  id: string
  user_id: string
  amount: number
  deposit_date: string
  notes: string | null
  /** The account the money went into (migration 018), if known. */
  bank_account_id?: string | null
  created_at: string
}

export interface Settings {
  id: string
  user_id: string
  /** Wall-clock time in the user's own time zone (`timezone`). */
  auto_pass_time: string
  /**
   * When true, DEPOSITED (funded) cheques past their due date are auto-marked
   * PASSED at the auto_pass_time. PENDING cheques are never auto-passed.
   * When false (default), no automatic transitions occur.
   * Cheque dates never change regardless of this setting.
   */
  auto_pass_enabled: boolean
  /** Symbol of `currency_code`, kept up to date for older clients. */
  currency_symbol: string | null
  allocation_sort: AllocationSort
  /**
   * User-configured list of banks for dropdown selection.
   */
  banks: string[]
  /** Region. `country_code` is null until the user picks a country. See src/lib/region.ts. */
  country_code: string | null
  currency_code: string | null
  locale: string | null
  timezone: string | null
  date_format: DateFormat | null
  week_starts_on: WeekStart | null
  cheque_validity_months: number | null
  /** Days a deposited cheque usually takes to clear. */
  clearing_days: number | null
  /**
   * What the user tracks (migration 017): the view Today and Cheques open on.
   * Missing on databases without that migration, which means both.
   */
  tracks?: Tracks
  created_at: string
  updated_at: string
}

/** Cheques the user gives, receives, or both. Only a default view, never a limit. */
export type Tracks = 'given' | 'received' | 'both'

export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

/**
 * One row per instance. Self-hosted copies leave billing off, so every
 * feature is free and there are no plans. See docs/editions.md.
 */
export interface InstanceConfig {
  billing_enabled: boolean
  trial_days: number
  default_country_code: string | null
}

/** Right to use the app on an instance with billing on. Written only by the server. */
export interface Entitlement {
  id: string
  user_id: string
  plan: string
  source: 'trial' | 'purchase' | 'comp'
  starts_at: string
  /** Null for grants that never expire. */
  expires_at: string | null
  payment_ref: string | null
  note: string | null
  created_at: string
}

export interface UpdateChequeStatusOptions {
  changedBy: ChangedBy
  note?: string
  returnReason?: string
}

export interface AllocationCheque extends Cheque {
  party: Party
  selected: boolean
}

/**
 * Forward status changes available from the generic status actions.
 * RETURNED has dedicated actions instead (re-present / write off), and any
 * change can be undone with rollback.
 */
export const VALID_STATUS_TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  PENDING: ['DEPOSITED', 'RETURNED', 'CANCELLED'],
  DEPOSITED: ['PASSED', 'RETURNED', 'CANCELLED'],
  PASSED: [],
  RETURNED: [],
  CANCELLED: [],
  WRITTEN_OFF: [],
}

export const ALL_STATUSES: ChequeStatus[] = ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF']

/**
 * DEPOSITED means the money to cover the cheque is in the bank (logged with
 * "Add funds"), so it's shown as Funded. The stored value stays DEPOSITED for
 * cheque-mcp and Cheque Watch.
 */
export const STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING: 'Pending',
  DEPOSITED: 'Funded',
  PASSED: 'Passed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
  WRITTEN_OFF: 'Written off',
}

/** Statuses where the cheque is finished — no due-date countdown. */
export const CLOSED_STATUSES: ChequeStatus[] = ['PASSED', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF']
