import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { GivenRowMenu } from '@/components/cheques/GivenRowMenu'
import { RowStatus, RowTags } from '@/components/cheques/RowChips'
import type { GivenActions } from '@/components/cheques/useGivenActions'
import { dueNote, rowTags, type ListRow } from '@/lib/chequeList'
import { formatShortDate, formatSigned } from '@/lib/formatters'
import type { AlertRules } from '@/lib/receivedSchedule'
import { cn } from '@/lib/utils'

interface ChequeTableProps {
  rows: ListRow[]
  today: string
  rules: AlertRules
  selected: Set<string>
  onToggle: (key: string) => void
  onToggleAll: (select: boolean) => void
  onOpen: (row: ListRow) => void
  givenActions: GivenActions
}

/** The cheque list on wider screens: one row per cheque, with selection and a menu. */
export function ChequeTable({ rows, today, rules, selected, onToggle, onToggleAll, onOpen, givenActions }: ChequeTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.key))
  const someSelected = !allSelected && rows.some((r) => selected.has(r.key))
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full min-w-[700px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[48px]" />
          <col className="w-[40px]" />
          <col className="w-[112px]" />
          <col />
          <col className="w-[100px]" />
          <col className="hidden w-[112px] xl:table-column" />
          <col className="hidden w-[108px] 2xl:table-column" />
          <col className="w-[128px]" />
          <col className="w-[140px] xl:w-[220px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead className="bg-sidebar text-[13px] font-semibold text-ink-quiet">
          <tr className="h-11 border-b">
            <th className="pl-5">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                aria-label="Select all"
              />
            </th>
            <th>
              <span className="sr-only">Direction</span>
            </th>
            <th>Due</th>
            <th>Party</th>
            <th>Cheque no.</th>
            <th className="hidden xl:table-cell">Bank</th>
            <th className="hidden 2xl:table-cell">Issued</th>
            <th className="pr-3 text-right">Amount</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selected.has(row.key)
            const note = dueNote(row, today)
            const tags = rowTags(row, today, rules)
            return (
              <tr
                key={row.key}
                onClick={() => onOpen(row)}
                className={cn(
                  'h-14 cursor-pointer border-b border-line-soft transition-colors last:border-0',
                  isSelected ? 'bg-brand-soft/50' : 'hover:bg-hover/60'
                )}
              >
                <td className="pl-5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(row.key)}
                    aria-label={`Select cheque ${row.number}`}
                  />
                </td>
                <td>
                  <span
                    aria-label={row.direction === 'in' ? 'Received' : 'Given'}
                    className={cn(
                      'flex h-[30px] w-[30px] items-center justify-center rounded-full',
                      row.direction === 'in' ? 'bg-money-in-soft text-money-in' : 'bg-money-out-soft text-money-out'
                    )}
                  >
                    {row.direction === 'in' ? (
                      <ArrowDownLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                    )}
                  </span>
                </td>
                <td className="py-2 text-sm tabular-nums">
                  <div>{formatShortDate(row.due)}</div>
                  {note && (
                    <div className={cn('text-xs', note.endsWith('overdue') ? 'text-problem' : 'text-ink-quiet')}>{note}</div>
                  )}
                </td>
                <td className="truncate pr-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(row)
                    }}
                    className="max-w-full truncate text-left text-[15px] font-semibold hover:underline"
                  >
                    {row.party}
                  </button>
                </td>
                <td className="font-cheque truncate text-sm text-ink-nav">{row.number}</td>
                <td className="hidden truncate pr-3 text-sm text-ink-quiet xl:table-cell">{row.bank}</td>
                <td className="hidden text-sm tabular-nums text-ink-quiet 2xl:table-cell">{formatShortDate(row.issued)}</td>
                <td
                  className={cn(
                    'pr-3 text-right text-[15px] font-semibold tabular-nums',
                    row.direction === 'in' ? 'text-money-in' : 'text-money-out'
                  )}
                >
                  {row.amount === null ? <span className="font-normal text-ink-quiet">No amount</span> : formatSigned(row.amount, row.direction)}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RowStatus row={row} />
                    <span className="contents max-xl:hidden">
                      <RowTags tags={tags} limit={2} />
                    </span>
                    <span className="contents xl:hidden">
                      <RowTags tags={tags} limit={1} />
                    </span>
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {row.given && <GivenRowMenu cheque={row.given} actions={givenActions} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
