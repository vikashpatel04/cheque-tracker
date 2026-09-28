import { Monitor, Moon, Sun } from 'lucide-react'
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '@/lib/theme'
import { cn } from '@/lib/utils'

const CHOICES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Light, dark or as the device is set. Saved on this device only. */
export function AppearanceSwitch({ className }: { className?: string }) {
  const choice = useThemeChoice()
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn('grid h-11 grid-cols-3 gap-1 rounded-xl bg-track p-1', className)}
    >
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const selected = value === choice
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemeChoice(value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[9px] text-sm font-semibold transition-colors',
              selected ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
