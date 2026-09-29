import { formatMoney } from '@/lib/formatters'

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string
}

/** A chart's hover card: the point's label, then each series with its amount. */
export function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-surface px-3 py-2 text-sm shadow-pop">
      {label && <p className="mb-1.5 font-semibold text-ink">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: entry.color }} />
            <span className="text-ink-quiet">{entry.name ?? entry.dataKey}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums">{formatMoney(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
