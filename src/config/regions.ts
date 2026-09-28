/**
 * Region presets. Picking a country fills in these defaults, and every value
 * can then be changed in Settings. Nothing else in the app assumes a country,
 * so supporting a new one means adding an entry here (see docs/regions.md).
 *
 * Cheque validity and clearing times follow usual bank practice in each
 * country. Confirm them, and the suggested banks, with someone local before
 * promoting the app there.
 */

export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd' | 'dd.MM.yyyy' | 'dd-MM-yyyy'

/** 0 = Sunday, 1 = Monday, 6 = Saturday. */
export type WeekStart = 0 | 1 | 6

/** Date formats a user can choose. Each is two-digit day and month, four-digit year. */
export const DATE_FORMATS: DateFormat[] = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy', 'dd-MM-yyyy']

export const WEEK_STARTS: WeekStart[] = [1, 0, 6]

export interface RegionPreset {
  /** ISO 3166-1 alpha-2 country code. */
  country: string
  /** ISO 4217 currency code. */
  currency: string
  /** BCP 47 locale used for numbers, currency and month names. */
  locale: string
  /** Default IANA time zone. */
  timeZone: string
  /** Other time zones in the country, used to recognise it from the browser. */
  otherTimeZones?: string[]
  dateFormat: DateFormat
  weekStartsOn: WeekStart
  /** Months after its date that a cheque stays valid before banks treat it as stale. */
  chequeValidityMonths: number
  /** Days a deposited cheque usually takes to clear; after this the app asks if it did. */
  clearingDays: number
  /** Suggested entries for the bank list. */
  banks: string[]
  /** International calling code without the "+", added to phone numbers written without one (WhatsApp links). */
  callingCode: string
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    country: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    timeZone: 'Asia/Kolkata',
    otherTimeZones: ['Asia/Calcutta'],
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    chequeValidityMonths: 3,
    clearingDays: 2,
    banks: ['SBI', 'HDFC', 'ICICI', 'Bank of Baroda', 'Axis Bank', 'Kotak Mahindra', 'Punjab National Bank'],
    callingCode: '91',
  },
  {
    country: 'AE',
    currency: 'AED',
    locale: 'en-AE',
    timeZone: 'Asia/Dubai',
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    chequeValidityMonths: 6,
    clearingDays: 2,
    banks: [],
    callingCode: '971',
  },
  {
    country: 'SG',
    currency: 'SGD',
    locale: 'en-SG',
    timeZone: 'Asia/Singapore',
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    chequeValidityMonths: 6,
    clearingDays: 2,
    banks: [],
    callingCode: '65',
  },
  {
    country: 'GB',
    currency: 'GBP',
    locale: 'en-GB',
    timeZone: 'Europe/London',
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    chequeValidityMonths: 6,
    clearingDays: 2,
    banks: [],
    callingCode: '44',
  },
  {
    country: 'US',
    currency: 'USD',
    locale: 'en-US',
    timeZone: 'America/New_York',
    otherTimeZones: [
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Detroit',
      'America/Indiana/Indianapolis',
      'America/Boise',
    ],
    dateFormat: 'MM/dd/yyyy',
    weekStartsOn: 0,
    chequeValidityMonths: 6,
    clearingDays: 2,
    banks: [],
    callingCode: '1',
  },
  {
    country: 'CA',
    currency: 'CAD',
    locale: 'en-CA',
    timeZone: 'America/Toronto',
    otherTimeZones: [
      'America/Vancouver',
      'America/Edmonton',
      'America/Regina',
      'America/Winnipeg',
      'America/Halifax',
      'America/St_Johns',
    ],
    dateFormat: 'yyyy-MM-dd',
    weekStartsOn: 0,
    chequeValidityMonths: 6,
    clearingDays: 2,
    banks: [],
    callingCode: '1',
  },
  {
    country: 'AU',
    currency: 'AUD',
    locale: 'en-AU',
    timeZone: 'Australia/Sydney',
    otherTimeZones: [
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Adelaide',
      'Australia/Perth',
      'Australia/Hobart',
      'Australia/Darwin',
    ],
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    chequeValidityMonths: 15,
    clearingDays: 3,
    banks: [],
    callingCode: '61',
  },
]

export function findPreset(country: string | null | undefined): RegionPreset | undefined {
  if (!country) return undefined
  return REGION_PRESETS.find((p) => p.country === country.toUpperCase())
}

/** The browser's time zone and the preset for its country, when we have one. */
export function detectPreset(): { preset: RegionPreset; timeZone: string } | null {
  let timeZone: string
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return null
  }
  const preset = REGION_PRESETS.find(
    (p) => p.timeZone === timeZone || p.otherTimeZones?.includes(timeZone)
  )
  return preset ? { preset, timeZone } : null
}

/** The country's name in English, e.g. "India" for "IN". */
export function countryName(country: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country
  } catch {
    return country
  }
}
