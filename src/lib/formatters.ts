import { format, parse, parseISO, isValid } from 'date-fns'
import { getActiveRegion, type Region } from './region'

/**
 * Money and date formatting. Everything follows the signed-in user's region
 * (currency, number format, date format, time zone), so no country is
 * assumed here. Pass a region explicitly only to preview another one.
 */

/** Dates are stored and passed around as ISO calendar dates (yyyy-MM-dd). */
export const ISO_DATE_FORMAT = 'yyyy-MM-dd'

// Intl formatters are slow to build, so they're cached by their options.
const numberFormats = new Map<string, Intl.NumberFormat>()
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = numberFormats.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, f)
  }
  return f
}

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = dateTimeFormats.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options)
    dateTimeFormats.set(key, f)
  }
  return f
}

/* ---------- Money ---------- */

export function formatCurrency(value: number, region: Region = getActiveRegion()): string {
  return numberFormat(region.locale, { style: 'currency', currency: region.currency }).format(value)
}

/**
 * For figures people read at a glance: no decimals when the amount is whole
 * ("₹20,000"), two when it isn't ("₹19,037.50").
 */
export function formatMoney(value: number, region: Region = getActiveRegion()): string {
  const digits = Math.round(Math.abs(value) * 100) % 100 === 0 ? 0 : 2
  return numberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** Three significant figures, for small tiles: "₹1.73L", "₹6.5K", "$1.2M". */
export function formatMoneyShort(value: number, region: Region = getActiveRegion()): string {
  return numberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    notation: 'compact',
    maximumSignificantDigits: 3,
  }).format(value)
}

/**
 * Joins a sign to the amount after it. Lines may otherwise break between "+"
 * and a currency symbol, leaving the sign alone on its own line.
 */
const WORD_JOINER = '⁠'

/**
 * Money with its direction: "+₹15,000" coming in, and plain "₹72,000" for a
 * cheque you give (plan item 70: no minus signs on the giving side). `format`
 * picks the full or the short form.
 */
export function formatSigned(
  value: number,
  direction: 'in' | 'out',
  format: (value: number, region?: Region) => string = formatMoney
): string {
  if (value === 0 || direction === 'out') return format(Math.abs(value))
  return `+${WORD_JOINER}${format(Math.abs(value))}`
}

/** A net figure, which can go either way: "+₹6,500" or "−₹45,406" (a real minus sign). */
export function formatNet(
  value: number,
  format: (value: number, region?: Region) => string = formatMoney
): string {
  if (value === 0) return format(0)
  return `${value > 0 ? '+' : '−'}${WORD_JOINER}${format(Math.abs(value))}`
}

/**
 * An amount in a currency's smallest unit (paise, cents), such as a pack's
 * price, in that currency: "₹500", "₹1,180.50", "$4.99". `whole` rounds it to
 * whole rupees or dollars, for figures such as a price per month.
 */
export function formatMinorUnits(
  minor: number,
  currency: string,
  { whole = false }: { whole?: boolean } = {},
  region: Region = getActiveRegion()
): string {
  const digits = numberFormat(region.locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  const value = whole ? Math.round(minor / 10 ** digits) : minor / 10 ** digits
  const shown = Number.isInteger(value) ? 0 : digits
  return numberFormat(region.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: shown,
    maximumFractionDigits: shown,
  }).format(value)
}

/** The currency's symbol as the region writes it, for amount fields: "₹", "$", "€". */
export function currencySymbol(region: Region = getActiveRegion()): string {
  const parts = numberFormat(region.locale, { style: 'currency', currency: region.currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? region.currency
}

/** Short form for chart axes and tiles, e.g. ₹1.2L or $1.2M. */
export function formatCurrencyCompact(value: number, region: Region = getActiveRegion()): string {
  return numberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * The amount with the currency code instead of its symbol ("INR 1,25,000.00").
 * For PDFs: the built-in PDF fonts can't draw symbols such as ₹.
 */
export function formatCurrencyCode(value: number, region: Region = getActiveRegion()): string {
  return numberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    currencyDisplay: 'code',
  }).format(value)
}

export function formatNumber(value: number, decimals = 0, region: Region = getActiveRegion()): string {
  return numberFormat(region.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Grouping and decimal marks of a locale, e.g. "," and "." for en-IN. */
function separators(locale: string) {
  const parts = numberFormat(locale, {}).formatToParts(1234567.8)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

/** Minor units of the currency: 2 for INR or USD, 0 for JPY. */
function currencyDecimals(region: Region): number {
  return (
    numberFormat(region.locale, { style: 'currency', currency: region.currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

/** Whether a character typed into an amount field is meant as the decimal mark. */
function isDecimalMark(ch: string, group: string, decimal: string): boolean {
  return ch === decimal || (ch === '.' && group !== '.')
}

/**
 * Format a raw amount string for live display in an input, grouped the way the
 * user writes numbers (1,00,000 in India, 100,000 in most places). Keeps a
 * trailing decimal mark while the user is still typing the decimal part and
 * caps decimals at the currency's minor units.
 */
export function formatAmountInput(raw: string, region: Region = getActiveRegion()): string {
  const { group, decimal } = separators(region.locale)
  const decimals = currencyDecimals(region)
  let intDigits = ''
  let fraction = ''
  let hasDecimal = false
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (hasDecimal) fraction += ch
      else intDigits += ch
    } else if (!hasDecimal && isDecimalMark(ch, group, decimal)) {
      hasDecimal = true
    }
  }
  intDigits = intDigits.replace(/^0+(?=\d)/, '')
  const grouped = intDigits
    ? numberFormat(region.locale, { maximumFractionDigits: 0 }).format(BigInt(intDigits))
    : ''
  // Currencies without minor units (JPY) drop anything after the decimal
  // mark rather than running it into the whole number.
  if (!hasDecimal || decimals === 0) return grouped
  return `${grouped}${decimal}${fraction.slice(0, decimals)}`
}

/** Parse an amount typed or shown in the user's number format. Returns 0 when there's none. */
export function parseAmount(value: string, region: Region = getActiveRegion()): number {
  const { group, decimal } = separators(region.locale)
  let normalized = ''
  let hasDecimal = false
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') normalized += ch
    else if (!hasDecimal && isDecimalMark(ch, group, decimal)) {
      normalized += '.'
      hasDecimal = true
    }
  }
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

/* ---------- Dates ---------- */

/** The wall-clock time of an instant in the user's time zone, as a local Date. */
function inTimeZone(instant: Date, timeZone: string): Date {
  const parts = dateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

/**
 * Plain yyyy-MM-dd strings are calendar dates and have no time zone. Longer
 * strings are timestamps, shown as the date they fall on in the user's time
 * zone. Date objects are taken as local calendar dates.
 */
function toCalendarDate(date: string | Date, region: Region): Date {
  if (date instanceof Date) return date
  return date.length > 10 ? inTimeZone(new Date(date), region.timeZone) : parseISO(date)
}

export function formatDate(date: string | Date, region: Region = getActiveRegion()): string {
  return format(toCalendarDate(date, region), region.dateFormat)
}

/** A timestamp as date and time in the user's time zone. */
export function formatDateTime(date: string | Date, region: Region = getActiveRegion()): string {
  const instant = typeof date === 'string' ? new Date(date) : date
  const time = dateTimeFormat(region.locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: region.timeZone,
  }).format(instant)
  return `${format(inTimeZone(instant, region.timeZone), region.dateFormat)} ${time}`
}

/** Whether the user writes the month before the day (MM/dd/yyyy). */
export function isMonthFirst(region: Region = getActiveRegion()): boolean {
  return region.dateFormat.startsWith('MM')
}

/**
 * A date with the month named, so the day and month order can't confuse
 * anyone: "Thu 24 Sep" (or "Thu Sep 24"), plus the year when it isn't this year.
 */
export function formatShortDate(date: string | Date, region: Region = getActiveRegion()): string {
  const day = toCalendarDate(date, region)
  const pattern = isMonthFirst(region) ? 'EEE MMM d' : 'EEE d MMM'
  const thisYear = day.getFullYear() === nowInUserTimeZone(region).getFullYear()
  return format(day, thisYear ? pattern : `${pattern} yyyy`)
}

/** The full date for page headings: "Sunday, 27 September" (or "Sunday, September 27"). */
export function formatLongDate(date: string | Date, region: Region = getActiveRegion()): string {
  return format(toCalendarDate(date, region), isMonthFirst(region) ? 'EEEE, MMMM d' : 'EEEE, d MMMM')
}

/** Short day and month for chart labels, in the user's order: "6 Sep" or "Sep 6". */
export function formatDayMonth(date: Date, region: Region = getActiveRegion()): string {
  return format(date, isMonthFirst(region) ? 'MMM d' : 'd MMM')
}

/** Month label for a yyyy-MM key, e.g. "Sep 26". */
export function formatMonthLabel(monthKey: string, region: Region = getActiveRegion()): string {
  const [year, month] = monthKey.split('-').map(Number)
  return dateTimeFormat(region.locale, { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1)
  )
}

export function toISODate(date: Date): string {
  return format(date, ISO_DATE_FORMAT)
}

/** The current wall-clock time in the user's time zone. */
export function nowInUserTimeZone(region: Region = getActiveRegion()): Date {
  return inTimeZone(new Date(), region.timeZone)
}

/** Today's date in the user's time zone (yyyy-MM-dd). */
export function todayISO(region: Region = getActiveRegion()): string {
  return toISODate(nowInUserTimeZone(region))
}

/** The date (yyyy-MM-dd) a timestamp falls on in the user's time zone. */
export function isoDateOf(timestamp: string, region: Region = getActiveRegion()): string {
  return toISODate(inTimeZone(new Date(timestamp), region.timeZone))
}

/** Today in the user's time zone, as a local Date at midnight for date arithmetic. */
export function todayDate(region: Region = getActiveRegion()): Date {
  return parseISO(todayISO(region))
}

/** Text formats to try for a typed date, in the order the user writes dates. */
function textDateFormats(region: Region): string[] {
  const dayFirst = ['dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy', 'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy']
  const monthFirst = ['MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy', 'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy']
  const yearFirst = ['yyyy-MM-dd', 'yyyy/MM/dd', 'yyyy.MM.dd']
  // 05/06/2026 could be either order, so only the user's own order is tried.
  // Year-first users get year-first formats only.
  const ambiguous = region.dateFormat.startsWith('yyyy')
    ? []
    : isMonthFirst(region)
      ? monthFirst
      : dayFirst
  return [region.dateFormat, ...ambiguous, ...yearFirst]
}

/**
 * Parse a date coming from a spreadsheet cell, which may arrive as a JS Date
 * (when read with cellDates), an Excel serial number, or text in the user's
 * date format. Returns null when nothing usable is found.
 */
export function parseFlexibleDate(value: unknown, region: Region = getActiveRegion()): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30. Build a local midnight date
    // from the UTC components to avoid timezone-induced off-by-one shifts.
    const utc = new Date(Math.round((value - 25569) * 86400000))
    if (!isValid(utc)) return null
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
  const str = String(value).trim()
  if (!str) return null
  for (const fmt of textDateFormats(region)) {
    const parsed = parse(str, fmt, new Date())
    if (isValid(parsed)) return parsed
  }
  const iso = parseISO(str)
  return isValid(iso) ? iso : null
}

/**
 * Show ISO dates inside free text in the user's date format. History notes
 * written by the database use yyyy-MM-dd so they read correctly everywhere.
 */
export function localizeIsoDates(text: string, region: Region = getActiveRegion()): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => {
    const d = parseISO(iso)
    return isValid(d) ? formatDate(d, region) : iso
  })
}

/* ---------- Cheque numbers ---------- */

/**
 * Predict the next cheque number by incrementing the trailing numeric run of
 * the last used number, preserving any prefix/suffix and zero-padding
 * (e.g. "100234" -> "100235", "CHQ-000999" -> "CHQ-001000"). Returns '' when
 * there is no usable number to increment.
 */
export function nextChequeNumber(last?: string | null): string {
  if (!last) return ''
  const m = last.match(/^(.*?)(\d+)(\D*)$/)
  if (!m) return ''
  const [, prefix, digits, suffix] = m
  const incremented = (BigInt(digits) + 1n).toString().padStart(digits.length, '0')
  return `${prefix}${incremented}${suffix}`
}
