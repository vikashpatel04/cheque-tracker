import { cn } from '@/lib/utils'

interface TileProps {
  label: string
  /** A shorter label for small phone tiles. */
  shortLabel?: string
  /** The full figure, for wider screens. */
  value: string
  /** The short figure for small phone tiles; defaults to `value`. */
  shortValue?: string
  tone?: 'in' | 'out' | 'attention'
  /** Draws the eye: the one number that needs doing something about today. */
  highlight?: boolean
  /** A small arrow or icon before the label. */
  icon?: React.ReactNode
  children?: React.ReactNode
  /** On phones, the hero tile spans the width and keeps the full figure. */
  hero?: boolean
  className?: string
}

const toneClass = { in: 'text-money-in', out: 'text-money-out', attention: 'text-attention' } as const

/** One of Today's numbers. */
export function Tile({ label, shortLabel, value, shortValue, tone = 'out', highlight, icon, children, hero, className }: TileProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl bg-surface',
        highlight ? 'border-2 border-attention-line' : 'border',
        hero ? 'gap-2 p-4 lg:gap-2.5 lg:px-[22px] lg:py-5' : 'gap-1.5 p-3 lg:gap-2.5 lg:px-[22px] lg:py-5',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 font-medium text-ink-quiet',
          hero ? 'text-sm lg:text-[15px]' : 'text-[13px] lg:text-[15px]'
        )}
      >
        {icon}
        {shortLabel ? (
          <>
            <span className="lg:hidden">{shortLabel}</span>
            <span className="max-lg:hidden">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
      <div
        className={cn(
          'font-semibold tabular-nums break-words',
          hero ? 'text-[32px] leading-[38px] lg:text-[36px] lg:leading-[42px]' : 'text-[21px] leading-7 lg:text-[36px] lg:leading-[42px]',
          toneClass[tone]
        )}
      >
        {hero || !shortValue ? (
          value
        ) : (
          <>
            <span className="lg:hidden">{shortValue}</span>
            <span className="max-lg:hidden">{value}</span>
          </>
        )}
      </div>
      {children && <div className={cn('text-ink-quiet', hero ? 'text-sm' : 'text-xs lg:text-sm')}>{children}</div>}
    </section>
  )
}
