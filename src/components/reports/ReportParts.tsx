import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppActions } from '@/hooks/useAppActions'
import { formatMoney, formatMonthLabel, formatNumber, formatShortDate } from '@/lib/formatters'
import type { ReportCell, ReportColumn, ReportTable, RowTarget } from '@/lib/reportTables'
import { cn } from '@/lib/utils'

/** A figure at the top of a tab: what it is, the amount, and a line under it. */
export function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'in' | 'attention' | 'problem'
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-xl border bg-surface p-4 lg:gap-2 lg:px-[18px]">
      <h3 className="text-sm font-medium text-ink-quiet">{label}</h3>
      <p
        className={cn(
          'truncate text-xl font-semibold tabular-nums sm:text-2xl lg:text-[26px]',
          tone === 'in' && 'text-money-in',
          tone === 'attention' && 'text-attention',
          tone === 'problem' && 'text-problem'
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[13px] text-ink-quiet">{sub}</p>}
    </section>
  )
}

export function Figures({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">{children}</div>
}

/** A card with one chart or table. */
export function ReportSection({
  title,
  note,
  aside,
  children,
}: {
  title: string
  note?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-xl border bg-surface p-4 lg:px-[22px] lg:py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-ink-quiet">{note}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** A colour key: a small square and its label. */
export function Key({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-quiet">
      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  )
}

/** For a tab about the other direction, e.g. Collections while showing given cheques only. */
export function OtherSide({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6">
      <p className="text-ink-quiet">{children}</p>
      {action}
    </div>
  )
}

const isMonthKey = (cell: ReportCell) => typeof cell === 'string' && /^\d{4}-\d{2}$/.test(cell)
const isNumeric = (column: ReportColumn) => column.kind !== 'text' && column.kind !== 'date' && column.kind !== 'month'

function cellText(column: ReportColumn, cell: ReportCell): string {
  if (cell === null || cell === '') return '—'
  switch (column.kind) {
    case 'money':
      return formatMoney(Number(cell))
    case 'count':
      return formatNumber(Number(cell))
    case 'date':
      return formatShortDate(String(cell))
    case 'month':
      return isMonthKey(cell) ? formatMonthLabel(String(cell)) : String(cell)
    case 'percent':
      return `${formatNumber(Number(cell) * 100, 1)}%`
    case 'net': {
      const value = Number(cell)
      if (!value) return formatMoney(0)
      const [positive, negative] = column.words ?? ['', '']
      return `${formatMoney(Math.abs(value))} ${value > 0 ? positive : negative}`.trim()
    }
    default:
      return String(cell)
  }
}

function netTone(column: ReportColumn, cell: ReportCell): string | undefined {
  if (column.kind !== 'net' || typeof cell !== 'number' || !cell) return undefined
  if (cell > 0) return 'text-money-in'
  return column.alarm ? 'text-problem' : undefined
}

const PAD = 'px-3 first:pl-4 last:pr-4 lg:first:pl-[22px] lg:last:pr-[22px]'

/**
 * Any report table, as on screen. Rows with a target open that party's ledger
 * or that cheque. `limit` shows the first rows with a button for the rest.
 */
export function ReportTableView({ table, limit }: { table: ReportTable; limit?: number }) {
  const [all, setAll] = useState(false)
  const navigate = useNavigate()
  const app = useAppActions()

  if (!table.rows.length) return <p className="text-sm text-ink-quiet">Nothing here with these filters.</p>

  const shown = all || !limit ? table.rows : table.rows.slice(0, limit)
  const go = (target: RowTarget) => {
    if (!target) return
    if ('party' in target) navigate(`/parties/${target.party}`)
    else if (target.cheque.given) app.openCheque(target.cheque.id)
    else app.openReceivedCheque(target.cheque.id)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-4 overflow-x-auto lg:-mx-[22px]">
        {/* Wide enough for its columns, so small tables fit half-width cards and wide ones scroll inside theirs. */}
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth: Math.max(320, table.columns.length * 110) }}>
          <thead>
            <tr className="border-y bg-sidebar text-[13px] font-semibold text-ink-quiet">
              {table.columns.map((column) => (
                <th key={column.label} scope="col" className={cn('h-10 whitespace-nowrap', PAD, isNumeric(column) && 'text-right')}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((cells, r) => {
              const target = table.targets?.[r] ?? null
              return (
                <tr
                  key={r}
                  onClick={target ? () => go(target) : undefined}
                  className={cn('border-b border-line-soft last:border-0', target && 'cursor-pointer transition-colors hover:bg-hover/60')}
                >
                  {cells.map((cell, i) => {
                    const column = table.columns[i]
                    const content = cellText(column, cell)
                    return (
                      <td
                        key={i}
                        className={cn(
                          'h-11 whitespace-nowrap',
                          PAD,
                          isNumeric(column) && 'text-right tabular-nums',
                          i === 0 && 'font-semibold',
                          netTone(column, cell)
                        )}
                      >
                        {i === 0 && target ? (
                          <button
                            type="button"
                            className="max-w-[260px] truncate text-left hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              go(target)
                            }}
                          >
                            {content}
                          </button>
                        ) : (
                          content
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {table.total && (
            <tfoot>
              <tr className="border-t-2 border-line-strong font-semibold">
                {table.total.map((cell, i) => (
                  <td key={i} className={cn('h-11 whitespace-nowrap', PAD, isNumeric(table.columns[i]) && 'text-right tabular-nums')}>
                    {i === 0 ? String(cell) : cellText(table.columns[i], cell)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {limit && table.rows.length > limit && (
        <Button variant="link" className="h-auto self-start p-0" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${table.rows.length}`}
        </Button>
      )}
    </div>
  )
}
