import { useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import type { Tracks } from '@/types'

const CHOICES: { value: Tracks; label: string; hint: string; icon: typeof ArrowUpRight }[] = [
  { value: 'given', label: 'Cheques I give', hint: 'Payments, funds and returns', icon: ArrowUpRight },
  { value: 'received', label: 'Cheques I receive', hint: 'Deposits, clearing and bounces', icon: ArrowDownLeft },
  { value: 'both', label: 'Both', hint: 'Everything, side by side', icon: ArrowLeftRight },
]

/** Settings → What you track: the view Today opens on. It never hides data for good. */
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
    else toast.success('Saved. Today opens on this from now on.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What you track</CardTitle>
        <CardDescription>
          Today opens on this. It only changes what you see first: the All, Given and Received views stay one tap away, and
          nothing is deleted or hidden for good.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="What you track" className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map(({ value, label, hint, icon: Icon }) => {
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
                  'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60',
                  selected ? 'border-2 border-brand bg-brand-soft/40 p-[13px]' : 'hover:bg-hover'
                )}
              >
                <Icon
                  className={cn('mt-0.5 h-5 w-5 shrink-0', value === 'received' ? 'text-money-in' : 'text-ink')}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{label}</span>
                  <span className="text-sm text-ink-quiet">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
