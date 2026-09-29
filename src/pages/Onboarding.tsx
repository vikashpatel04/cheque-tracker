import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BankAccountDialog } from '@/components/shared/BankAccountDialog'
import { Chip } from '@/components/shared/Chip'
import { REGION_PRESETS, countryName, detectPreset, findPreset } from '@/config/regions'
import { useAuth } from '@/hooks/useAuth'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, todayDate } from '@/lib/formatters'
import { regionFromPreset, regionKey, regionToSettings, setActiveRegion } from '@/lib/region'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Tracks } from '@/types'

const STEPS = 3

const TRACK_CHOICES: { value: Tracks; title: string; sub: string; icon: typeof ArrowUpRight; iconClass: string }[] = [
  { value: 'given', title: 'I give cheques', sub: 'Rent, loan instalments, paying people and businesses', icon: ArrowUpRight, iconClass: 'bg-money-out-soft text-ink' },
  { value: 'received', title: 'I receive cheques', sub: 'Rent, instalments, payments made to you', icon: ArrowDownLeft, iconClass: 'bg-money-in-soft text-money-in' },
  { value: 'both', title: 'Both', sub: 'Money in and out together, with a net for each party', icon: ArrowLeftRight, iconClass: 'bg-brand-soft text-brand' },
]

/** A radio dot, as in the boards: a ring, filled when chosen. */
function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand' : 'border-line-strong')}>
      {on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
    </span>
  )
}

/**
 * First run, after sign-in (design boards Onboarding-region-phone and
 * Onboarding-track-phone): 1. where you use cheques, 2. what you use them
 * for, 3. your bank accounts, which can be skipped. The region and choice
 * are saved together at the end, so leaving halfway just starts again; the
 * app opens once they're saved.
 */
export default function Onboarding() {
  const { updateSettings } = useSettings()
  const { signOut } = useAuth()
  const { accounts } = useBankAccounts()
  const detected = useMemo(() => detectPreset(), [])
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState(detected?.preset.country ?? '')
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<Tracks>('both')
  const [addingAccount, setAddingAccount] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the browser's time zone doesn't match a country we know, start from
  // this instance's default country (instance_config), or the first preset.
  useEffect(() => {
    if (country) return
    let cancelled = false
    void supabase
      .from('instance_config')
      .select('default_country_code')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setCountry(findPreset(data?.default_country_code)?.country ?? REGION_PRESETS[0].country)
      })
    return () => {
      cancelled = true
    }
  }, [country])

  // The country the browser suggests first, then the rest by name.
  const countries = useMemo(() => {
    const byName = [...REGION_PRESETS].sort((a, b) => countryName(a.country).localeCompare(countryName(b.country)))
    const first = detected ? byName.filter((p) => p.country === detected.preset.country) : []
    return [...first, ...byName.filter((p) => !first.includes(p))]
  }, [detected])
  const term = query.trim().toLowerCase()
  const shown = countries.filter((p) => !term || countryName(p.country).toLowerCase().includes(term))

  const preset = findPreset(country)
  const timeZone = preset && detected && detected.preset.country === preset.country ? detected.timeZone : preset?.timeZone
  const region = useMemo(() => (preset ? regionFromPreset(preset, timeZone) : null), [preset, timeZone])

  // Amounts and dates in later steps (and the bank suggestions) follow the chosen country.
  const key = region ? regionKey(region) : ''
  useEffect(() => {
    if (region) setActiveRegion(region)
    // `key` changes exactly when the region does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const finish = async () => {
    if (!region) return
    setSaving(true)
    setError(null)
    const result = await updateSettings({ ...regionToSettings(region), tracks })
    setSaving(false)
    if (result.error) setError(result.error)
  }

  const next = () => (step < STEPS ? setStep(step + 1) : void finish())

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
        <div className="flex flex-col gap-2 px-5 pt-6">
          <div className="flex min-h-9 items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-quiet">
              Step {step} of {STEPS}
            </span>
            {step > 1 ? (
              <Button variant="link" className="h-9 px-1" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="link" className="h-9 px-1 text-ink-quiet" onClick={() => void signOut()}>
                Sign out
              </Button>
            )}
          </div>
          <span className="grid grid-cols-3 gap-1.5" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={cn('h-[5px] rounded-full', i < step ? 'bg-brand' : 'bg-track')} />
            ))}
          </span>
        </div>

        <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-[22px]">
          {step === 1 && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-title text-[28px] leading-[34px]">Where do you use cheques?</h1>
                <p className="text-[15px] leading-[22px] text-ink-quiet">
                  This sets your currency, how numbers and dates look, and how long cheques stay valid. You can change it later.
                </p>
              </div>

              <label className="flex h-12 items-center gap-2.5 rounded-xl border border-line-field bg-surface px-3.5 text-ink-quiet">
                <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search countries"
                  placeholder="Search countries"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
                />
              </label>

              <div role="radiogroup" aria-label="Country" className="flex flex-col overflow-hidden rounded-xl border bg-surface">
                {shown.map((p) => {
                  const on = p.country === country
                  return (
                    <button
                      key={p.country}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCountry(p.country)}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 border-b border-line-soft px-3.5 text-left last:border-0',
                        on ? 'bg-brand-soft/40' : 'hover:bg-hover'
                      )}
                    >
                      <Dot on={on} />
                      <span className={cn('flex-1 text-base', on && 'font-semibold')}>{countryName(p.country)}</span>
                      {detected?.preset.country === p.country && <span className="text-[13px] text-ink-quiet">From your time zone</span>}
                    </button>
                  )
                })}
                {!shown.length && <p className="p-4 text-sm text-ink-quiet">No country by that name. Pick the closest one.</p>}
              </div>
              <p className="-mt-2 text-[13px] text-ink-quiet">Not listed? Pick the closest one, then adjust it in Settings.</p>

              {region && (
                <section aria-labelledby="preview-title" className="flex flex-col gap-2 rounded-xl border bg-surface p-4">
                  <h2 id="preview-title" className="mb-1 text-base font-semibold">
                    How things will look
                  </h2>
                  {[
                    ['Amounts', formatCurrency(123456, region)],
                    ['Dates', format(todayDate(region), region.dateFormat)],
                    ['Time zone', region.timeZone.replace(/_/g, ' ')],
                    ['Cheques stay valid', `${region.chequeValidityMonths} month${region.chequeValidityMonths === 1 ? '' : 's'}`],
                    ['Deposits usually clear', region.clearingDays ? `in ${region.clearingDays} day${region.clearingDays === 1 ? '' : 's'}` : 'the same day'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-sm">
                      <span className="text-ink-quiet">{label}</span>
                      <span className="font-semibold tabular-nums">{value}</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-title text-[28px] leading-[34px]">What do you use cheques for?</h1>
                <p className="text-[15px] leading-[22px] text-ink-quiet">
                  We'll show what matters to you first. Nothing is locked: you can switch between views any time.
                </p>
              </div>
              <div role="radiogroup" aria-label="What you track" className="flex flex-col gap-2.5">
                {TRACK_CHOICES.map(({ value, title, sub, icon: Icon, iconClass }) => {
                  const on = value === tracks
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTracks(value)}
                      className={cn(
                        'grid grid-cols-[44px_minmax(0,1fr)_22px] items-center gap-3.5 rounded-xl border p-4 text-left transition-colors',
                        on ? 'border-2 border-brand bg-brand-soft/40 p-[15px]' : 'bg-surface hover:bg-hover'
                      )}
                    >
                      <span aria-hidden="true" className={cn('flex h-11 w-11 items-center justify-center rounded-full', iconClass)}>
                        <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
                      </span>
                      <span className="flex flex-col gap-[3px]">
                        <span className="text-[17px] font-semibold">{title}</span>
                        <span className="text-sm leading-5 text-ink-quiet">{sub}</span>
                      </span>
                      <Dot on={on} />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-title text-[28px] leading-[34px]">Your bank accounts</h1>
                <p className="text-[15px] leading-[22px] text-ink-quiet">
                  Add the accounts you write cheques from or deposit cheques into. Only a name and the last four digits are kept, never the
                  full number. You can skip this and add them later in Settings.
                </p>
              </div>
              {accounts.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {accounts.map((account) => (
                    <li key={account.id} className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-surface px-3.5 py-2">
                      <Landmark className="h-5 w-5 shrink-0 text-ink-quiet" aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-[15px] font-semibold">{account.name}</span>
                          {account.last4 && <span className="font-cheque text-sm tracking-[0.06em] text-ink-quiet">···{account.last4}</span>}
                          {account.is_default && (
                            <Chip tone="progress" size="sm">
                              Default
                            </Chip>
                          )}
                        </span>
                        <span className="truncate text-[13px] text-ink-quiet">{account.bank_name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="lg" className="self-start" onClick={() => setAddingAccount(true)}>
                <Plus />
                {accounts.length ? 'Add another account' : 'Add an account'}
              </Button>
              <BankAccountDialog open={addingAccount} onOpenChange={setAddingAccount} makeDefault={accounts.length === 0} />
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-problem">
              Couldn't save: {error}
            </p>
          )}
        </main>

        <div className="sticky bottom-0 border-t bg-background px-5 pb-[calc(22px+env(safe-area-inset-bottom))] pt-3.5">
          <Button size="lg" className="h-[52px] w-full text-[17px]" disabled={!region || saving} onClick={next}>
            {saving ? 'Saving…' : step < STEPS ? 'Continue' : accounts.length ? 'Finish' : 'Skip for now'}
          </Button>
        </div>
      </div>
    </div>
  )
}
