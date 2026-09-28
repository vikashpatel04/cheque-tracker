import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { ListRow } from './chequeList'

/**
 * The Calendar's month grid: each day's money in and out, and whether it
 * needs you. Pure, so it's easy to test; `today` and dates are yyyy-MM-dd.
 */

const ISO = 'yyyy-MM-dd'

export interface DayCell {
  date: string
  /** False for the days of the previous and next months that fill the first and last weeks. */
  inMonth: boolean
  in: number
  out: number
  count: number
  /** Every cheque that day is finished (passed, cleared and so on). */
  done: boolean
  /** A problem (returned, bounced, overdue) or something to do. */
  flag: 'problem' | 'attention' | null
}

/** Something went wrong with it, or its date passed while it was still waiting. */
function isProblem(row: ListRow, today: string) {
  if (row.status === 'RETURNED' || row.status === 'BOUNCED') return row.open
  const waiting = row.status === 'PENDING' || row.status === 'IN_HAND'
  return waiting && row.due < today
}

export function dayCell(date: string, rows: ListRow[], today: string, inMonth = true): DayCell {
  const due = rows.filter((r) => r.due === date)
  const open = due.filter((r) => r.open)
  return {
    date,
    inMonth,
    in: due.filter((r) => r.direction === 'in').reduce((sum, r) => sum + (r.amount ?? 0), 0),
    out: due.filter((r) => r.direction === 'out').reduce((sum, r) => sum + (r.amount ?? 0), 0),
    count: due.length,
    done: due.length > 0 && open.length === 0,
    flag: open.some((r) => isProblem(r, today)) ? 'problem' : open.some((r) => r.status === 'PENDING' || r.status === 'IN_HAND') ? 'attention' : null,
  }
}

/** Whole weeks covering the month of `month` (any day in it), starting on the region's first day of the week. */
export function monthCells(month: string, weekStartsOn: 0 | 1 | 6, rows: ListRow[], today: string): DayCell[] {
  const first = startOfMonth(parseISO(month))
  const last = endOfMonth(first)
  const start = startOfWeek(first, { weekStartsOn })
  const cells: DayCell[] = []
  for (let day = start; day <= last || cells.length % 7 !== 0; day = addDays(day, 1)) {
    const date = format(day, ISO)
    cells.push(dayCell(date, rows, today, day >= first && day <= last))
  }
  return cells
}
