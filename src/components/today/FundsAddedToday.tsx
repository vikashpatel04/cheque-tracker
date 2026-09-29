import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatMoney } from '@/lib/formatters'
import { HelpLink } from '@/components/guide/HelpLink'

/**
 * "Funds added today", with what it means: Add funds records money put into
 * the bank today and funds the cheques it covers at once; the total starts
 * from zero each day (plan item 71).
 */
export function FundsAddedToday({ total, label = 'funds added today' }: { total: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}: <span className="font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="What are funds added today?"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 text-sm leading-5">
          <p className="font-semibold">Funds added today</p>
          <p className="mt-1 text-ink-quiet">
            When you put money into the bank, record it with <span className="font-medium text-ink">Add funds</span> and tick the
            cheques it covers. They're all marked funded at once.
          </p>
          <p className="mt-2 text-ink-quiet">This counts only today's money, so it starts again from zero each day.</p>
          <HelpLink topic="add-funds" className="mt-3">
            More about Add funds
          </HelpLink>
        </PopoverContent>
      </Popover>
    </span>
  )
}
