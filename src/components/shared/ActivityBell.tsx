import { useState } from 'react'
import { differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useActivity } from '@/hooks/useActivity'
import { useAppActions } from '@/hooks/useAppActions'
import { formatCurrency, formatShortDate } from '@/lib/formatters'
import { GIVEN_STATUS_CHIPS, TONE_CLASSES } from '@/lib/statusChips'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type ChequeHistory } from '@/types'

/** How a change was made, when it wasn't made by hand. */
function how(item: ChequeHistory): string | null {
  // The assistant (cheque-mcp) writes "velo", which isn't in ChangedBy.
  const by: string = item.changed_by
  if (by === 'deposit_allocation') return 'with Add funds'
  if (by === 'auto') return 'automatically'
  if (by === 'rollback') return 'undone'
  if (by === 'velo') return 'by the assistant'
  return item.from_status === 'RETURNED' && item.to_status === 'PENDING' ? 're-presented' : null
}

function when(timestamp: string): string {
  const date = new Date(timestamp)
  return differenceInCalendarDays(new Date(), date) < 7
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : formatShortDate(timestamp)
}

/** The bell: recent changes to your cheques. */
export function ActivityBell({ className }: { className?: string }) {
  const { items, unread, markSeen } = useActivity()
  const { openCheque } = useAppActions()
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) markSeen()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Activity, ${unread} new` : 'Activity'}
          className={cn(
            'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line-field bg-surface text-ink transition-colors hover:bg-hover max-lg:rounded-xl',
            className
          )}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span aria-hidden="true" className="absolute right-2.5 top-[9px] h-2 w-2 rounded-full bg-problem" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-baseline justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-base font-semibold">Activity</h2>
          <span className="text-sm text-ink-quiet">Latest changes</span>
        </div>
        <div className="max-h-[min(60vh,440px)] overflow-y-auto py-1">
          {items === null ? (
            <p className="px-4 py-6 text-center text-sm text-ink-quiet">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-quiet">
              Nothing yet. Changes to your cheques show up here.
            </p>
          ) : (
            items.map((item) => {
              const chip = GIVEN_STATUS_CHIPS[item.to_status]
              const Icon = chip?.icon
              const party = item.cheque?.party?.name ?? 'A cheque'
              const detail = [
                item.cheque ? formatCurrency(Number(item.cheque.amount)) : null,
                how(item),
                when(item.created_at),
              ].filter(Boolean)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openCheque(item.cheque_id)
                  }}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      TONE_CLASSES[chip?.tone ?? 'done']
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" strokeWidth={2.2} />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] leading-snug">
                      <span className="font-semibold">{party}</span> · {STATUS_LABELS[item.to_status] ?? item.to_status}
                    </span>
                    <span className="text-[13px] text-ink-quiet">{detail.join(' · ')}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
