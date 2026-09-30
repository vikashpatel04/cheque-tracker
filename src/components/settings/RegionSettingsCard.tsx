import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useSettings } from '@/hooks/useSettings'
import {
  DATE_FORMATS,
  REGION_PRESETS,
  WEEK_STARTS,
  countryName,
  findPreset,
  type DateFormat,
  type WeekStart,
} from '@/config/regions'
import { currencySymbol, formatCurrency, formatNumber, todayDate } from '@/lib/formatters'
import { regionFromPreset, regionToSettings, type Region } from '@/lib/region'
import { HelpLink } from '@/components/guide/HelpLink'

const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

/** Every currency or time zone the browser knows, or null when it can't list them. */
function supportedValues(key: 'currency' | 'timeZone'): string[] | null {
  try {
    return Intl.supportedValuesOf(key)
  } catch {
    return null
  }
}

function currencyOptions(current: string): ComboboxOption[] {
  const codes = supportedValues('currency') ?? REGION_PRESETS.map((p) => p.currency)
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(['en'], { type: 'currency' })
  } catch {
    // Older browsers: show codes only.
  }
  return unique([...codes, current]).map((code) => ({
    value: code,
    label: `${code} · ${names?.of(code) ?? code}`,
  }))
}

function timeZoneOptions(current: string): ComboboxOption[] {
  const zones = supportedValues('timeZone') ?? REGION_PRESETS.map((p) => p.timeZone)
  return unique([...zones, current]).map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))
}

/** Locales offered for number formatting, each labelled with an example. */
function localeOptions(current: string): ComboboxOption[] {
  return unique([...REGION_PRESETS.map((p) => p.locale), current]).map((locale) => ({
    value: locale,
    label: `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(1234567.89)} (${locale})`,
  }))
}

/** Weekday name for 0 = Sunday … 6 = Saturday (4 January 2026 was a Sunday). */
function weekdayName(day: WeekStart): string {
  return format(new Date(2026, 0, 4 + day), 'EEEE')
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

/** The region as a short list, written the way the app will show things. */
function summary(region: Region): { label: string; value: string }[] {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    { label: 'Country', value: countryName(region.country) },
    { label: 'Currency', value: `${currencySymbol(region)} ${currencyName(region.currency)}` },
    { label: 'Numbers', value: formatNumber(123456, 2, region) },
    { label: 'Dates', value: format(todayDate(region), region.dateFormat) },
    { label: 'Time zone', value: region.timeZone.replace(/_/g, ' ') },
    { label: 'Week starts', value: weekdayName(region.weekStartsOn) },
    { label: 'Cheques stay valid', value: plural(region.chequeValidityMonths, 'month') },
    { label: 'Deposits usually clear', value: region.clearingDays ? `in ${plural(region.clearingDays, 'day')}` : 'the same day' },
  ]
}

/**
 * Settings → Region: country, currency, number and date formats, time zone
 * and cheque rules, as a summary with Change. Picking a country fills in its
 * defaults; each field can then be changed.
 */
export function RegionSettingsCard() {
  const { region, updateSettings } = useSettings()
  // Saving remounts the app (see SettingsProvider), so the draft starts fresh.
  const [draft, setDraft] = useState<Region | null>(region)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const countries = useMemo(() => {
    const codes = unique([...REGION_PRESETS.map((p) => p.country), draft?.country ?? ''])
    return codes.sort((a, b) => countryName(a).localeCompare(countryName(b)))
  }, [draft?.country])
  const currencies = useMemo(() => currencyOptions(draft?.currency ?? ''), [draft?.currency])
  const timeZones = useMemo(() => timeZoneOptions(draft?.timeZone ?? ''), [draft?.timeZone])
  const locales = useMemo(() => localeOptions(draft?.locale ?? ''), [draft?.locale])

  if (!draft || !region) return null

  if (!editing) {
    return (
      <SettingsSection
        id="region"
        title="Region"
        description="How amounts, dates and “today” work for you."
        action={
          <Button variant="outline" onClick={() => setEditing(true)}>
            Change
          </Button>
        }
      >
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {summary(region).map((row) => (
            <div key={row.label} className="flex justify-between gap-3 border-b border-line-soft py-2.5 text-sm">
              <dt className="text-ink-quiet">{row.label}</dt>
              <dd className="text-right font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <HelpLink topic="stale" />
          <HelpLink topic="clearing" />
        </div>
      </SettingsSection>
    )
  }

  const set = <K extends keyof Region>(key: K, value: Region[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const pickCountry = (code: string) => {
    const preset = findPreset(code)
    if (preset) setDraft(regionFromPreset(preset))
  }

  const save = async () => {
    setSaving(true)
    const { error } = await updateSettings(regionToSettings(draft))
    setSaving(false)
    if (error) {
      toast.error(`Couldn't save the region: ${error}`)
      return
    }
    toast.success('Region saved')
    // A changed region remounts the app; an unchanged one just closes the form.
    setEditing(false)
  }

  const today = todayDate(draft)

  return (
    <SettingsSection id="region" title="Region" description="Picking a country fills in its usual settings. You can change each one after.">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <Label htmlFor="region-country">Country</Label>
            <Select value={draft.country} onValueChange={pickCountry}>
              <SelectTrigger id="region-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((code) => (
                  <SelectItem key={code} value={code}>
                    {countryName(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-currency">Currency</Label>
            <Combobox
              id="region-currency"
              options={currencies}
              value={draft.currency}
              onChange={(v) => set('currency', v)}
              title="Currency"
              searchPlaceholder="Find a currency"
              emptyText="No currency by that name"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-locale">Number format</Label>
            <Combobox
              id="region-locale"
              options={locales}
              value={draft.locale}
              onChange={(v) => set('locale', v)}
              title="Number format"
              searchPlaceholder="Find a format"
              emptyText="No format like that"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-date-format">Date format</Label>
            <Select value={draft.dateFormat} onValueChange={(v) => set('dateFormat', v as DateFormat)}>
              <SelectTrigger id="region-date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>
                    {format(today, fmt)} ({fmt.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-time-zone">Time zone</Label>
            <Combobox
              id="region-time-zone"
              options={timeZones}
              value={draft.timeZone}
              onChange={(v) => set('timeZone', v)}
              title="Time zone"
              searchPlaceholder="Find a time zone"
              emptyText="No time zone by that name"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-week-start">Week starts on</Label>
            <Select
              value={String(draft.weekStartsOn)}
              onValueChange={(v) => set('weekStartsOn', Number(v) as WeekStart)}
            >
              <SelectTrigger id="region-week-start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_STARTS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {weekdayName(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-validity">Cheques stay valid for (months)</Label>
            <Input
              id="region-validity"
              type="number"
              min={1}
              max={24}
              value={draft.chequeValidityMonths}
              onChange={(e) => {
                const months = Math.round(Number(e.target.value))
                if (months >= 1 && months <= 24) set('chequeValidityMonths', months)
              }}
              className="w-24"
            />
            <p className="mt-1 text-[13px] text-ink-quiet">After this, banks treat a cheque as stale. Used for stale-cheque warnings.</p>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="region-clearing">Deposits usually clear within (days)</Label>
            <Input
              id="region-clearing"
              type="number"
              min={0}
              max={30}
              value={draft.clearingDays}
              onChange={(e) => {
                const days = Math.round(Number(e.target.value))
                if (days >= 0 && days <= 30) set('clearingDays', days)
              }}
              className="w-24"
            />
            <p className="mt-1 text-[13px] text-ink-quiet">After this, the app asks whether a deposited cheque has cleared.</p>
          </div>
        </div>

        <p className="text-sm text-ink-quiet">
          Preview: {formatCurrency(125000, draft)} · today is {format(today, draft.dateFormat)}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save region'}
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              setDraft(region)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
