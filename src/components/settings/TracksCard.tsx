import { useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import type { Tracks } from '@/types'

const CHOICES: { value: Tracks; label: string; hint: string; icon: typeof ArrowUpRight; tone: string }[] = [
  { value: 'given', label: 'Cheques I give', hint: 'Rent, instalments, payments you make', icon: ArrowUpRight, tone: 'text-ink' },
  { value: 'received', label: 'Cheques I receive', hint: 'Rent, instalments, payments made to you', icon: ArrowDownLeft, tone: 'text-money-in' },
  { value: 'both', label: 'Both', hint: 'See money in and out together', icon: ArrowLeftRight, tone: 'text-brand' },
]

/** Settings → What you track: what Today and Cheques open on. It never hides data for good. */
export function TracksCard() {
  const { settings, updateSettings } = useSettings()
  const current = settings.tracks ?? 'both'
  const [saving, setSaving] = useState<Tracks | null>(null)

  const choose = async (tracks: Tracks) => {
    if (tracks === current) return
    setSaving(tracks)
    const { error } = await updateSettings({ tracks })
    setSaving(null)
    if (error) toast.error(`Couldn't save: ${error}`)
    else toast.success('Saved. Today and Cheques open on this from now on.')
  }

  return (
    <SettingsSection
      id="track"
      title="What you track"
      description="Decides what Today and Cheques show first. Your cheques stay as they are, and you can switch any time with All / Given / Received."
    >
      <div role="radiogroup" aria-labelledby="track-title" className="grid gap-2.5 sm:grid-cols-3">
        {CHOICES.map(({ value, label, hint, icon: Icon, tone }) => {
          const selected = value === current
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving !== null}
              onClick={() => void choose(value)}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60',
                selected ? 'border-2 border-brand bg-brand-soft/40 p-[13px]' : 'hover:bg-hover'
              )}
            >
              <span className={cn('inline-flex items-center gap-2 text-[15px] font-semibold', tone)}>
                <Icon className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                {label}
              </span>
              <span className="text-[13px] leading-[18px] text-ink-quiet">{hint}</span>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}
