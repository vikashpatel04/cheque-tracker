import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { TodayView } from '@/lib/today'
import { cn } from '@/lib/utils'

const VIEWS: { value: TodayView; label: string; icon?: typeof ArrowUpRight }[] = [
  { value: 'all', label: 'All' },
  { value: 'given', label: 'Given', icon: ArrowUpRight },
  { value: 'received', label: 'Received', icon: ArrowDownLeft },
]

/** All, Given or Received: only which cheques show, never the account. */
export function ViewSwitch({
  value,
  onChange,
  className,
}: {
  value: TodayView
  onChange: (view: TodayView) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Show cheques"
      className={cn('grid h-11 grid-cols-3 gap-1 rounded-xl bg-track p-1 lg:w-[330px]', className)}
    >
      {VIEWS.map(({ value: view, label, icon: Icon }) => {
        const selected = view === value
        return (
          <button
            key={view}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(view)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[9px] text-sm font-semibold transition-colors',
              selected ? 'bg-thumb shadow-thumb' : 'text-ink-quiet hover:text-ink',
              selected && (view === 'received' ? 'text-money-in' : 'text-ink')
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
