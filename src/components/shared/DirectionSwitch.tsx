import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChequeDirection = 'received' | 'given'

/** "I received it / I gave it", at the top of the New cheque form. */
export function DirectionSwitch({ value, onChange }: { value: ChequeDirection; onChange: (direction: ChequeDirection) => void }) {
  const option = (direction: ChequeDirection, label: string, Icon: typeof ArrowUpRight) => {
    const selected = value === direction
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onChange(direction)}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-[9px] text-base font-semibold transition-colors',
          selected ? 'bg-thumb shadow-thumb' : 'text-ink-quiet hover:text-ink',
          selected && (direction === 'received' ? 'text-money-in' : 'text-ink')
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
        {label}
      </button>
    )
  }
  return (
    <div role="group" aria-label="Direction" className="grid h-[52px] grid-cols-2 gap-1 rounded-xl bg-track p-1">
      {option('received', 'I received it', ArrowDownLeft)}
      {option('given', 'I gave it', ArrowUpRight)}
    </div>
  )
}
