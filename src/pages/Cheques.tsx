import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, FileSpreadsheet, FileText, Landmark, ListFilter, Search, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ChequeCards } from '@/components/cheques/ChequeCards'
import { ChequeTable } from '@/components/cheques/ChequeTable'
import {
  AccountField,
  BankField,
  DueField,
  FilterPill,
  PartyField,
  SortField,
  StatusField,
  type FilterChoices,
} from '@/components/cheques/ListFilters'
import { nextAction } from '@/components/cheques/nextAction'
import { useGivenActions } from '@/components/cheques/useGivenActions'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAppActions } from '@/hooks/useAppActions'
import { useChequeListData } from '@/hooks/useChequeListData'
import { useSettings } from '@/hooks/useSettings'
import { inTab, inView, sortRows, VIEW_LABELS, VIEWS_BY_TAB, type DirectionTab, type ListRow, type ListView } from '@/lib/chequeList'
import { activeFilterCount, applyView, dueLabel, filterRows, readFilters } from '@/lib/chequeFilters'
import { announceDataChange } from '@/lib/dataEvents'
import { exportChequesToExcel, exportChequesToPDF } from '@/lib/exportUtils'
import { formatMoney, formatSigned, todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { supabase } from '@/lib/supabase'
import { updateChequeStatus } from '@/lib/updateChequeStatus'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type Cheque, type ChequeStatus } from '@/types'
import { RECEIVED_STATUS_LABELS, type ReceivedStatus } from '@/types/received'

const PAGE = 150
const TAB_LABELS: Record<DirectionTab, string> = { all: 'All', received: 'Received', given: 'Given' }
const TAB_ORDER: DirectionTab[] = ['all', 'received', 'given']
/** Views whose counts are a warning, not just a count. */
const COUNT_TONE: Partial<Record<ListView, string>> = {
  to_deposit: 'text-attention',
  needs_funds: 'text-attention',
  overdue: 'text-problem',
  returned: 'text-problem',
  bounced: 'text-problem',
  problems: 'text-problem',
}

function totals(rows: ListRow[]) {
  let money_in = 0
  let money_out = 0
  for (const row of rows) {
    if (row.direction === 'in') money_in += row.amount ?? 0
    else money_out += row.amount ?? 0
  }
  return { in: money_in, out: money_out }
}

/** The Cheques list (docs/design-brief.md, screen 33): both directions, saved views, filters and export. */
export default function Cheques() {
  const { settings } = useSettings()
  const app = useAppActions()
  const { rows, accounts, loading, error } = useChequeListData()
  const { actions: givenActions, dialogs } = useGivenActions()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState(PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const today = todayISO()
  const { chequeValidityMonths, clearingDays } = getActiveRegion()
  const rules = useMemo(() => ({ chequeValidityMonths, clearingDays }), [chequeValidityMonths, clearingDays])
  const tracks = settings.tracks ?? 'both'
  const defaultTab: DirectionTab = tracks === 'both' ? 'all' : tracks
  const paramString = params.toString()
  const filters = useMemo(() => readFilters(new URLSearchParams(paramString), defaultTab), [paramString, defaultTab])

  /** Changes the address bar: a null value removes the setting. */
  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
    setSelected(new Set())
    setShown(PAGE)
  }

  // Links from elsewhere: ?cheque=<id> opens one, ?replace=<id> issues a new cheque for a written-off one.
  useEffect(() => {
    const open = params.get('cheque')
    const replace = params.get('replace')
    const isNew = params.get('new')
    if (!open && !replace && !isNew) return
    const next = new URLSearchParams(params)
    next.delete('cheque')
    next.delete('replace')
    next.delete('new')
    setParams(next, { replace: true })
    if (open) app.openCheque(open)
    if (isNew === 'given') app.newGivenCheque()
    if (replace) {
      void supabase
        .from('cheques')
        .select('*, party:parties(*)')
        .eq('id', replace)
        .maybeSingle()
        .then(({ data }) => data && app.replaceCheque(data as Cheque))
    }
  }, [params, setParams, app])

  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters])
  const visible = useMemo(
    () => sortRows(applyView(filtered, filters.view, today, rules), filters.sort, filters.order),
    [filtered, filters.view, filters.sort, filters.order, today, rules]
  )
  const sum = totals(visible)

  const choices: FilterChoices = useMemo(() => {
    const parties = new Map<string, string>()
    const banks = new Set<string>()
    for (const row of rows) {
      if (!inTab(row, filters.dir)) continue
      parties.set(row.partyId, row.party)
      if (row.bank) banks.add(row.bank)
    }
    return {
      parties: [...parties].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      banks: [...banks].sort((a, b) => a.localeCompare(b)),
      accounts,
    }
  }, [rows, accounts, filters.dir])

  const tabCount = (tab: DirectionTab) => rows.filter((r) => inTab(r, tab)).length
  const viewCount = (view: ListView) => filtered.filter((r) => inView(r, view, today, rules)).length

  /* ---------- Selection ---------- */

  const selectedRows = visible.filter((r) => selected.has(r.key))
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const toggleAll = (select: boolean) => setSelected(select ? new Set(visible.slice(0, shown).map((r) => r.key)) : new Set())

  const selectedGiven = selectedRows.map((r) => r.given).filter((c): c is Cheque => !!c)
  const allPending = selectedRows.length > 0 && selectedGiven.length === selectedRows.length && selectedGiven.every((c) => c.status === 'PENDING')
  const allFunded = selectedRows.length > 0 && selectedGiven.length === selectedRows.length && selectedGiven.every((c) => c.status === 'DEPOSITED')
  const allInHand = selectedRows.length > 0 && selectedRows.every((r) => r.received?.status === 'IN_HAND' && r.received.kind === 'REGULAR')

  const markPassed = async (cheques: Cheque[]) => {
    setBusy(true)
    let done = 0
    for (const cheque of cheques) {
      const result = await updateChequeStatus(cheque.id, 'PASSED', { changedBy: 'manual' })
      if (!result.success) {
        toast.error(`Stopped at cheque ${cheque.cheque_number}: ${result.error}`)
        break
      }
      done++
    }
    setBusy(false)
    if (done) {
      toast.success(`Marked ${done} cheque${done === 1 ? '' : 's'} passed`)
      setSelected(new Set())
      announceDataChange()
    }
  }

  /* ---------- Rows ---------- */

  const openRow = (row: ListRow) => {
    if (row.given) app.openCheque(row.id)
    else app.openReceivedCheque(row.id)
  }

  const next = (row: ListRow) => nextAction(row, givenActions, app)

  /* ---------- Export ---------- */

  const exportGiven = (as: 'pdf' | 'excel') => {
    const cheques = visible.map((r) => r.given).filter((c): c is Cheque => !!c)
    if (!cheques.length) {
      toast.info('No given cheques in this list to export.')
      return
    }
    if (as === 'pdf') exportChequesToPDF(cheques, filters.view ? `Cheques: ${VIEW_LABELS[filters.view]}` : 'Cheques')
    else exportChequesToExcel(cheques, 'cheques_export')
  }

  /* ---------- Filters ---------- */

  const set = (changes: Partial<Record<string, string | null>>) => setParam(changes as Record<string, string | null>)
  const fieldProps = { filters, set, choices }
  const statusLabel = (value: string) => {
    const [dir, status] = value.split(':')
    return dir === 'out' ? STATUS_LABELS[status as ChequeStatus] : RECEIVED_STATUS_LABELS[status as ReceivedStatus]
  }
  const accountName = accounts.find((a) => a.id === filters.account)?.name
  const partyName = choices.parties.find((p) => p.id === filters.party)?.name
  const filterCount = activeFilterCount(filters)
  const problemsView = filters.view === 'returned' || filters.view === 'problems' || filters.view === 'bounced'

  const views = VIEWS_BY_TAB[filters.dir]
  const openProblems = visible.filter((r) => r.open)
  const owed = totals(openProblems)

  return (
    <div>
      <PageHeader
        title="Cheques"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="max-lg:hidden">
                <Download />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[13px] font-normal text-ink-quiet">Given cheques in this list</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportGiven('pdf')}>
                <FileText className="text-ink-quiet" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportGiven('excel')}>
                <FileSpreadsheet className="text-ink-quiet" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex flex-col gap-3 lg:gap-[18px]">
        {/* Search: on phones it leads the page; on desktop it's in the filter row. */}
        <label className="flex h-12 items-center gap-2.5 rounded-xl border border-line-field bg-surface px-3.5 text-ink-quiet lg:hidden">
          <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search cheques"
            placeholder="Cheque no., party or amount"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value || null })}
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        {/* Direction: underlined tabs on desktop, a segmented control on phones. */}
        <div role="group" aria-label="Direction" className="flex items-end gap-7 border-b max-lg:hidden">
          {TAB_ORDER.map((tab) => {
            const active = filters.dir === tab
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setParam({ dir: tab === defaultTab ? null : tab, view: null, status: null, account: null, bank: null })}
                className={cn(
                  '-mb-px inline-flex h-11 items-center gap-2 border-b-[3px] px-0.5 text-base font-semibold',
                  active ? 'border-brand text-brand' : 'border-transparent text-ink-nav hover:text-ink'
                )}
              >
                {TAB_LABELS[tab]}
                <span className="text-[13px] font-medium text-ink-quiet">{loading ? '' : tabCount(tab)}</span>
              </button>
            )
          })}
        </div>
        <div role="group" aria-label="Direction" className="grid h-11 grid-cols-3 gap-1 rounded-xl bg-track p-1 lg:hidden">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={filters.dir === tab}
              onClick={() => setParam({ dir: tab === defaultTab ? null : tab, view: null, status: null, account: null, bank: null })}
              className={cn(
                'rounded-[9px] text-[15px] font-semibold',
                filters.dir === tab ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet'
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Saved views. */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          <span className="pr-1 text-sm font-medium text-ink-quiet max-lg:hidden">Views</span>
          {views.map((view) => {
            const active = filters.view === view
            const count = loading ? null : viewCount(view)
            return (
              <button
                key={view}
                type="button"
                aria-pressed={active}
                onClick={() => setParam({ view: active ? null : view })}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors lg:h-9',
                  active ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong bg-surface text-ink hover:bg-hover'
                )}
              >
                {VIEW_LABELS[view]}
                {count !== null && (
                  <span className={cn('text-[13px] font-semibold', count ? (COUNT_TONE[view] ?? 'text-ink-quiet') : 'text-ink-faint')}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Filters: pills on desktop, a sheet on phones. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 w-[260px] items-center gap-2 rounded-[10px] border border-line-field bg-surface px-3 text-ink-quiet max-lg:hidden">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search cheques"
              placeholder="Cheque no., party or amount"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value || null })}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <div className="contents max-lg:hidden">
            <FilterPill label="Due" value={dueLabel(filters)} active={!!(filters.from || filters.to)} onClear={() => set({ from: null, to: null })} wide>
              <DueField {...fieldProps} />
            </FilterPill>
            <FilterPill label="Party" value={partyName ?? 'Any'} active={!!filters.party} onClear={() => set({ party: null })} wide>
              <PartyField {...fieldProps} />
            </FilterPill>
            {filters.dir === 'received' ? (
              <FilterPill label="Account" value={accountName ?? 'Any'} active={!!filters.account} onClear={() => set({ account: null })}>
                <AccountField {...fieldProps} />
              </FilterPill>
            ) : (
              <FilterPill label="Bank" value={filters.bank ?? 'Any'} active={!!filters.bank} onClear={() => set({ bank: null })}>
                <BankField {...fieldProps} />
              </FilterPill>
            )}
            <FilterPill
              label="Status"
              value={filters.statuses.length ? filters.statuses.map(statusLabel).join(', ') : 'Any'}
              active={filters.statuses.length > 0}
              onClear={() => set({ status: null })}
            >
              <StatusField {...fieldProps} />
            </FilterPill>
            <FilterPill label="Order" value={filters.sort === 'upcoming' ? 'Upcoming first' : 'Custom'} active={filters.sort !== 'upcoming'} onClear={() => set({ sort: null })} wide>
              <SortField {...fieldProps} />
            </FilterPill>
          </div>
          <Button variant="outline" className="h-10 lg:hidden" onClick={() => setFiltersOpen(true)}>
            <ListFilter />
            Filters{filterCount ? ` · ${filterCount}` : ''}
          </Button>
          <div className="flex-1" />
          {!loading && (
            <span className="text-sm tabular-nums text-ink-quiet">
              {visible.length} cheque{visible.length === 1 ? '' : 's'}
              {sum.in > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold text-money-in">{formatSigned(sum.in, 'in')} in</span>
                </>
              )}
              {sum.out > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold text-money-out">{formatSigned(sum.out, 'out')} out</span>
                </>
              )}
            </span>
          )}
        </div>

        {problemsView && !loading && openProblems.length > 0 && (
          <p className="rounded-xl border border-problem-line bg-problem-soft px-4 py-3 text-sm text-problem">
            {openProblems.length} need{openProblems.length === 1 ? 's' : ''} a decision
            {owed.out > 0 && ` · ${formatMoney(owed.out)} you still have to pay`}
            {owed.in > 0 && ` · ${formatMoney(owed.in)} still owed to you`}. Open one to present it again, write it off,
            or record how it was settled.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-problem-line bg-problem-soft p-3 text-sm text-problem">
            Couldn't load everything: {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6">
            <p className="font-semibold">{rows.length ? 'No cheques match' : 'No cheques yet'}</p>
            <p className="text-ink-quiet">
              {rows.length
                ? 'Try another view, or clear the search and filters.'
                : 'Add a cheque you gave, or import your cheques from Excel.'}
            </p>
            {rows.length ? (
              <Button variant="outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear search and filters
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => app.newGivenCheque()}>Add a given cheque</Button>
                <Button variant="outline" onClick={() => app.importCheques()}>
                  Import from Excel
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="max-xl:hidden">
              <ChequeTable
                rows={visible.slice(0, shown)}
                today={today}
                rules={rules}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onOpen={openRow}
                nextAction={next}
                givenActions={givenActions}
              />
            </div>
            <div className="xl:hidden">
              <ChequeCards
                rows={visible.slice(0, shown)}
                today={today}
                rules={rules}
                grouped={filters.sort === 'upcoming'}
                onOpen={openRow}
                nextAction={next}
              />
            </div>
            {visible.length > shown && (
              <Button variant="outline" className="self-center" onClick={() => setShown((n) => n + PAGE)}>
                Show {Math.min(PAGE, visible.length - shown)} more
              </Button>
            )}
          </>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-brand px-5 py-3 text-brand-ink shadow-pop max-xl:hidden">
          <span className="text-[15px] font-semibold">{selectedRows.length} selected</span>
          <span className="text-[15px] tabular-nums opacity-80">
            {[totals(selectedRows).in ? formatSigned(totals(selectedRows).in, 'in') : null, totals(selectedRows).out ? formatSigned(totals(selectedRows).out, 'out') : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <div className="flex-1" />
          <Button variant="link" className="text-brand-ink hover:text-brand-ink" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          {allPending && (
            <Button className="bg-surface text-brand hover:bg-hover" onClick={() => app.addFunds(totals(selectedRows).out)}>
              <Wallet />
              Add funds for {selectedRows.length}
            </Button>
          )}
          {allFunded && (
            <Button className="bg-surface text-brand hover:bg-hover" disabled={busy} onClick={() => void markPassed(selectedGiven)}>
              <Check />
              Mark {selectedRows.length} passed
            </Button>
          )}
          {allInHand && (
            <Button className="bg-surface text-brand hover:bg-hover" onClick={() => app.depositReceived(selectedRows.map((r) => r.id))}>
              <Landmark />
              Deposit {selectedRows.length} cheque{selectedRows.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto px-4 pt-5">
          <SheetHeader className="text-left">
            <SheetTitle className="font-title text-2xl">Filters</SheetTitle>
            <SheetDescription>{visible.length} cheques match</SheetDescription>
          </SheetHeader>
          <div className="mt-2 flex flex-col gap-5">
            <SortField {...fieldProps} />
            <DueField {...fieldProps} />
            <PartyField {...fieldProps} />
            {filters.dir === 'received' ? <AccountField {...fieldProps} /> : <BankField {...fieldProps} />}
            <StatusField {...fieldProps} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => set({ status: null, party: null, bank: null, account: null, from: null, to: null, sort: null })}
              >
                Clear all
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show {visible.length}</Button>
            </div>
            <Button variant="outline" onClick={() => exportGiven('excel')}>
              <Download />
              Export given cheques to Excel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {dialogs}
    </div>
  )
}
