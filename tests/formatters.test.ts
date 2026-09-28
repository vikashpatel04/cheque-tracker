import { describe, expect, it } from 'vitest'
import { findPreset } from '@/config/regions'
import { regionFromPreset, regionToSettings, setActiveRegion, type Region } from '@/lib/region'
import {
  formatAmountInput,
  formatCurrency,
  formatCurrencyCode,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatMoney,
  formatMoneyShort,
  formatMonthLabel,
  formatShortDate,
  formatSigned,
  localizeIsoDates,
  parseAmount,
  parseFlexibleDate,
  toISODate,
  todayISO,
} from '@/lib/formatters'

/** Intl puts non-breaking spaces in some outputs; compare with plain spaces. */
const plain = (s: string) => s.replace(/\s/g, ' ')

function use(country: string, timeZone?: string): Region {
  const region = regionFromPreset(findPreset(country)!, timeZone)
  setActiveRegion(region)
  return region
}

const isoOf = (value: unknown) => {
  const d = parseFlexibleDate(value)
  return d ? toISODate(d) : null
}

describe('India', () => {
  it('formats money with lakh grouping', () => {
    use('IN')
    expect(formatCurrency(125000)).toBe('₹1,25,000.00')
    expect(formatCurrencyCompact(120000)).toBe('₹1.2L')
    expect(plain(formatCurrencyCode(125000))).toBe('INR 1,25,000.00')
  })

  it('groups typed amounts and parses them back', () => {
    use('IN')
    expect(formatAmountInput('100000')).toBe('1,00,000')
    expect(formatAmountInput('1234.567')).toBe('1,234.56')
    expect(formatAmountInput('12.')).toBe('12.')
    expect(parseAmount('1,00,000.50')).toBe(100000.5)
  })

  it('shows and reads dates day first', () => {
    use('IN')
    expect(formatDate('2026-09-26')).toBe('26/09/2026')
    expect(formatDayMonth(new Date(2026, 8, 26))).toBe('26 Sep')
    expect(isoOf('05/06/2026')).toBe('2026-06-05')
    expect(isoOf('2026-06-05')).toBe('2026-06-05')
    expect(isoOf(46291)).toBe('2026-09-26') // Excel serial number
  })

  it('shows timestamps in the user time zone', () => {
    use('IN')
    // 18:45 UTC is 00:15 the next day in India.
    expect(formatDateTime('2026-09-26T18:45:00Z').startsWith('27/09/2026')).toBe(true)
  })

  it('localises ISO dates in history notes', () => {
    use('IN')
    expect(localizeIsoDates('Re-presented (was due 2026-09-20)')).toBe('Re-presented (was due 20/09/2026)')
  })

  it('keeps currency_symbol in sync for older clients', () => {
    expect(regionToSettings(use('IN')).currency_symbol).toBe('₹')
  })
})

describe('United States', () => {
  it('formats money and dates month first', () => {
    use('US')
    expect(formatCurrency(125000)).toBe('$125,000.00')
    expect(formatCurrencyCompact(1200000)).toBe('$1.2M')
    expect(formatAmountInput('100000')).toBe('100,000')
    expect(formatDate('2026-09-26')).toBe('09/26/2026')
    expect(formatDayMonth(new Date(2026, 8, 26))).toBe('Sep 26')
    expect(formatMonthLabel('2026-09')).toBe('Sep 26')
    expect(isoOf('05/06/2026')).toBe('2026-05-06')
    expect(formatDateTime('2026-09-26T18:45:00Z').startsWith('09/26/2026')).toBe(true)
  })
})

describe('other regions', () => {
  it('uses each preset', () => {
    use('GB')
    expect(formatCurrency(125000)).toBe('£125,000.00')
    use('CA')
    expect(formatDate('2026-09-26')).toBe('2026-09-26')
    // Year-first users: day/month order of 05/06/2026 is ambiguous, so it's refused.
    expect(isoOf('05/06/2026')).toBeNull()
    expect(findPreset('AU')!.chequeValidityMonths).toBe(15)
  })

  it('drops decimals for currencies without minor units', () => {
    const jpy: Region = { ...use('IN'), currency: 'JPY', locale: 'en-US' }
    expect(formatAmountInput('1234.5', jpy)).toBe('1,234')
  })

  it('handles locales that group with dots', () => {
    const de: Region = { ...use('IN'), currency: 'EUR', locale: 'de-DE' }
    expect(formatAmountInput('1.234,5', de)).toBe('1.234,5')
    expect(parseAmount('1.234,5', de)).toBe(1234.5)
  })

  it('computes today in the region time zone', () => {
    expect(todayISO(use('IN'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('figures and dates on Today', () => {
  it('drops decimals from whole amounts and shortens them for tiles', () => {
    use('IN')
    expect(formatMoney(20000)).toBe('₹20,000')
    expect(formatMoney(19037.5)).toBe('₹19,037.50')
    expect(formatMoneyShort(173000)).toBe('₹1.73L')
    expect(formatMoneyShort(6500)).toBe('₹6.5K')
    expect(formatSigned(15000, 'in')).toBe('+₹15,000')
    expect(formatSigned(72000, 'out')).toBe('−₹72,000')
    expect(formatSigned(0, 'out')).toBe('₹0')
    use('US')
    expect(formatMoney(125000)).toBe('$125,000')
    expect(formatMoneyShort(1234567)).toBe('$1.23M')
  })

  it('names the month so day and month order never confuse', () => {
    use('IN')
    expect(formatShortDate('2026-09-24')).toMatch(/^Thu 24 Sep( 2026)?$/)
    expect(formatLongDate('2026-09-27')).toBe('Sunday, 27 September')
    use('US')
    expect(formatShortDate('2026-09-24')).toMatch(/^Thu Sep 24( 2026)?$/)
    expect(formatLongDate('2026-09-27')).toBe('Sunday, September 27')
    expect(formatShortDate('2020-01-02')).toBe('Thu Jan 2 2020')
  })
})
