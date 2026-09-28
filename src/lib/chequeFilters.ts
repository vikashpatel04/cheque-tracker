import { inTab, inView, matchesSearch, VIEWS_BY_TAB, type DirectionTab, type ListRow, type ListView, type SortDir, type SortKey } from './chequeList'
import { formatShortDate } from './formatters'
import type { AlertRules } from './receivedSchedule'

/**
 * The Cheques list's filters, kept in the address bar (?dir=given&view=returned…)
 * so a view can be bookmarked, shared, or opened from Today.
 */
export interface ListFilters {
  dir: DirectionTab
  view: ListView | null
  q: string
  /** "out:PENDING", "in:IN_HAND": status per direction, since both use DEPOSITED. */
  statuses: string[]
  party: string | null
  bank: string | null
  account: string | null
  from: string | null
  to: string | null
  sort: SortKey
  order: SortDir
}

export const SORT_OPTIONS: { value: string; label: string; sort: SortKey; order: SortDir }[] = [
  { value: 'upcoming', label: 'Upcoming first', sort: 'upcoming', order: 'asc' },
  { value: 'due-asc', label: 'Due date, earliest first', sort: 'due', order: 'asc' },
  { value: 'due-desc', label: 'Due date, latest first', sort: 'due', order: 'desc' },
  { value: 'amount-desc', label: 'Amount, largest first', sort: 'amount', order: 'desc' },
  { value: 'amount-asc', label: 'Amount, smallest first', sort: 'amount', order: 'asc' },
  { value: 'party-asc', label: 'Party, A to Z', sort: 'party', order: 'asc' },
  { value: 'party-desc', label: 'Party, Z to A', sort: 'party', order: 'desc' },
  { value: 'issued-desc', label: 'Issued or received, latest first', sort: 'issued', order: 'desc' },
  { value: 'issued-asc', label: 'Issued or received, earliest first', sort: 'issued', order: 'asc' },
]

const TABS: DirectionTab[] = ['all', 'given', 'received']
const ISO = /^\d{4}-\d{2}-\d{2}$/

export function readFilters(params: URLSearchParams, defaultTab: DirectionTab): ListFilters {
  const dir = params.get('dir') as DirectionTab | null
  const tab = dir && TABS.includes(dir) ? dir : defaultTab
  const view = params.get('view') as ListView | null
  const sort = SORT_OPTIONS.find((o) => o.value === params.get('sort')) ?? SORT_OPTIONS[0]
  const date = (key: string) => {
    const value = params.get(key)
    return value && ISO.test(value) ? value : null
  }
  return {
    dir: tab,
    view: view && VIEWS_BY_TAB[tab].includes(view) ? view : null,
    q: params.get('q') ?? '',
    statuses: (params.get('status') ?? '').split(',').filter(Boolean),
    party: params.get('party'),
    bank: params.get('bank'),
    account: params.get('account'),
    from: date('from'),
    to: date('to'),
    sort: sort.sort,
    order: sort.order,
  }
}

/** The address-bar value of a sort, e.g. "due-desc". */
export function sortValue(filters: Pick<ListFilters, 'sort' | 'order'>): string {
  return SORT_OPTIONS.find((o) => o.sort === filters.sort && o.order === filters.order)?.value ?? 'upcoming'
}

/** How many filters are set, besides the tab, view and search. */
export function activeFilterCount(f: ListFilters): number {
  return [f.statuses.length > 0, !!f.party, !!f.bank, !!f.account, !!(f.from || f.to)].filter(Boolean).length
}

/** Rows that pass everything but the saved view (whose counts are shown next to it). */
export function filterRows(rows: ListRow[], f: ListFilters): ListRow[] {
  return rows.filter(
    (row) =>
      inTab(row, f.dir) &&
      matchesSearch(row, f.q) &&
      (!f.statuses.length || f.statuses.includes(`${row.direction}:${row.status}`)) &&
      (!f.party || row.partyId === f.party) &&
      (!f.bank || row.bank === f.bank) &&
      (!f.account || row.accountId === f.account) &&
      (!f.from || row.due >= f.from) &&
      (!f.to || row.due <= f.to)
  )
}

export function applyView(rows: ListRow[], view: ListView | null, today: string, rules: AlertRules): ListRow[] {
  return view ? rows.filter((row) => inView(row, view, today, rules)) : rows
}

/** How the due-date filter reads on its pill. */
export function dueLabel(filters: ListFilters): string {
  if (filters.from && filters.to) return `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
  if (filters.from) return `from ${formatShortDate(filters.from)}`
  if (filters.to) return `until ${formatShortDate(filters.to)}`
  return 'Any'
}
