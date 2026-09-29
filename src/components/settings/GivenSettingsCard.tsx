import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SettingRow, SettingsSection } from '@/components/settings/SettingsSection'
import { useSettings } from '@/hooks/useSettings'
import { getActiveRegion } from '@/lib/region'
import { cn } from '@/lib/utils'
import type { AllocationSort, SettingsUpdate } from '@/types'

const ORDERS: { value: AllocationSort; label: string }[] = [
  { value: 'due_date_asc', label: 'Due soonest first' },
  { value: 'amount_asc', label: 'Smallest first' },
  { value: 'amount_desc', label: 'Largest first' },
]

/** "23:59" as the user's locale writes a time of day, e.g. "11:59 pm". */
function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  try {
    return new Intl.DateTimeFormat(getActiveRegion().locale, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(2000, 0, 1, hours, minutes)
    )
  } catch {
    return time
  }
}

/** Settings → Cheques you give: auto-pass, the order Add funds covers cheques in, and your banks. Each change saves at once. */
export function GivenSettingsCard() {
  const { settings, updateSettings } = useSettings()
  const savedTime = settings.auto_pass_time?.slice(0, 5) || '23:59'
  const [time, setTime] = useState(savedTime)
  const [newBank, setNewBank] = useState('')
  const [saving, setSaving] = useState(false)
  const banks = settings.banks ?? []
  const order = settings.allocation_sort ?? 'due_date_asc'
  const autoPass = settings.auto_pass_enabled ?? false

  useEffect(() => setTime(savedTime), [savedTime])

  const save = async (changes: SettingsUpdate, message?: string) => {
    setSaving(true)
    const { error } = await updateSettings(changes)
    setSaving(false)
    if (error) toast.error(`Couldn't save: ${error}`)
    else if (message) toast.success(message)
    return !error
  }

  const saveTime = () => {
    if (!/^\d{2}:\d{2}$/.test(time) || time === savedTime) return
    void save({ auto_pass_time: `${time}:00` }, `Auto-pass now runs at ${formatClock(time)}`)
  }

  const addBank = async () => {
    const bank = newBank.trim()
    if (!bank) return
    if (banks.some((b) => b.toLowerCase() === bank.toLowerCase())) {
      setNewBank('')
      return
    }
    if (await save({ banks: [...banks, bank] })) setNewBank('')
  }

  return (
    <SettingsSection id="given" title="Cheques you give">
      <SettingRow
        label="Auto-pass"
        labelId="autopass-label"
        hint={
          autoPass ? (
            <>
              On their due date, funded cheques are marked passed at <strong className="font-semibold text-ink">{formatClock(savedTime)}</strong>{' '}
              ({getActiveRegion().timeZone.replace(/_/g, ' ')} time). Pending cheques always wait for you.
            </>
          ) : (
            'Off: funded cheques stay funded until you mark them passed.'
          )
        }
      >
        {autoPass && (
          <Input
            type="time"
            aria-label="Auto-pass time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={saveTime}
            onKeyDown={(e) => e.key === 'Enter' && saveTime()}
            className="h-10 w-[120px] tabular-nums"
          />
        )}
        <Switch
          aria-labelledby="autopass-label"
          checked={autoPass}
          disabled={saving}
          onCheckedChange={(on) => void save({ auto_pass_enabled: on }, on ? 'Auto-pass is on' : 'Auto-pass is off')}
        />
      </SettingRow>

      <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
        <span id="order-label" className="text-[15px] font-semibold">
          When you add funds, cover cheques
        </span>
        <div role="radiogroup" aria-labelledby="order-label" className="flex flex-wrap gap-2">
          {ORDERS.map((o) => {
            const selected = o.value === order
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => !selected && void save({ allocation_sort: o.value })}
                className={cn(
                  'h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60',
                  selected ? 'border-2 border-brand bg-brand-soft px-[13px] text-brand' : 'border-line-strong text-ink-nav hover:bg-hover'
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
        <span className="text-[15px] font-semibold">Banks you write cheques on</span>
        <span className="text-sm text-ink-quiet">Suggested when you add a cheque.</span>
        <div className="flex flex-wrap items-center gap-2">
          {banks.map((bank) => (
            <span key={bank} className="inline-flex h-9 items-center gap-1 rounded-full bg-money-out-soft pl-3 pr-1 text-sm font-medium">
              {bank}
              <button
                type="button"
                aria-label={`Remove ${bank}`}
                disabled={saving}
                onClick={() => void save({ banks: banks.filter((b) => b !== bank) })}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-quiet transition-colors hover:bg-problem-soft hover:text-problem"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void addBank()
            }}
          >
            <Input
              aria-label="Add a bank"
              placeholder="Add a bank"
              value={newBank}
              onChange={(e) => setNewBank(e.target.value)}
              className="h-9 w-40 rounded-full border-dashed px-3 text-sm"
            />
            {newBank.trim() && (
              <Button type="submit" variant="outline" size="icon" aria-label="Add this bank" className="h-9 w-9 rounded-full" disabled={saving}>
                <Plus />
              </Button>
            )}
          </form>
        </div>
      </div>
    </SettingsSection>
  )
}
