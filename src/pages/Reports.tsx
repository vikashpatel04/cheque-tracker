import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Download, FileSpreadsheet, FileText, ListFilter } from 'lucide-react'
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
import {
  AccountField,
  BankField,
  DueField,
  FilterPill,
  PartyField,
  StatusField,
  type FilterChoices,
} from '@/components/cheques/ListFilters'
import {
  AccountsTab,
  BouncesTab,
  CashFlowTab,
  CollectionsTab,
  OverviewTab,
  PartiesTab,
  PaymentsTab,
} from '@/components/reports/ReportTabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { brand, brandSlug } from '@/config/brand'
import { useReportsData } from '@/hooks/useReportsData'
import { useSettings } from '@/hooks/useSettings'
import { inTab, type DirectionTab } from '@/lib/chequeList'
import { activeFilterCount, dueLabel, filterRows, readFilters } from '@/lib/chequeFilters'
import { formatDate, todayISO } from '@/lib/formatters'
import { exportReportExcel, exportReportPdf } from '@/lib/reportExport'
import { reportMonths } from '@/lib/reports'
import { REPORT_TABS, reportTables, statusLabel, type ReportInput, type ReportTab } from '@/lib/reportTables'
import { cn } from '@/lib/utils'

const DIR_ORDER: DirectionTab[] = ['all', 'received', 'given']
const DIR_LABELS: Record<DirectionTab, string> = { all: 'Both', received: 'Received', given: 'Given' }
const DIR_WORDS: Record<DirectionTab, string> = {
  all: 'Given and received cheques',
  received: 'Received cheques',
  given: 'Given cheques',
}

function DirectionField({ value, onChange }: { value: DirectionTab; onChange: (dir: DirectionTab) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1.5 text-sm font-medium">Direction</legend>
      {DIR_ORDER.map((dir) => (
        <label key={dir} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-[15px] hover:bg-hover">
          <input type="radio" name="report-direction" checked={value === dir} onChange={() => onChange(dir)} className="h-4 w-4 accent-brand" />
          {DIR_WORDS[dir]}
        </label>
      ))}
    </fieldset>
  )
}

/**
 * Reports (design brief, screen 39): filters that stay in view, seven tabs,
 * and "Export this tab" with the filters applied. Filters and the tab live in
 * the address bar, using the same names as the Cheques list.
 */
export default function Reports() {
  const { settings } = useSettings()
  const data = useReportsData()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const today = todayISO()
  const tracks = settings.tracks ?? 'both'
  const defaultDir: DirectionTab = tracks === 'both' ? 'all' : tracks
  const paramString = params.toString()
  const filters = useMemo(() => readFilters(new URLSearchParams(paramString), defaultDir), [paramString, defaultDir])
  const tabParam = params.get('tab') as ReportTab | null
  const tab: ReportTab = tabParam && REPORT_TABS.some((t) => t.key === tabParam) ? tabParam : 'overview'
  const tabLabel = REPORT_TABS.find((t) => t.key === tab)!.label

  /** Changes the address bar: a null value removes the setting. */
  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const set = (changes: Partial<Record<string, string | null>>) => setParam(changes as Record<string, string | null>)
  const setDir = (dir: DirectionTab) => setParam({ dir: dir === defaultDir ? null : dir, status: null, account: null, bank: null })
  const setTab = (next: ReportTab) => {
    setParam({ tab: next === 'overview' ? null : next })
    window.scrollTo({ top: 0 })
  }

  const input = useMemo<ReportInput>(() => {
    const inRange = (day: string) => (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
    const base = { ...filters, q: '', view: null }
    return {
      dir: filters.dir,
      rows: filterRows(data.rows, base),
      undated: filterRows(data.rows, { ...base, from: null, to: null }),
      deposits: data.deposits.filter((d) => inRange(d.deposit_date)),
      allDeposits: data.deposits,
      accounts: data.accounts,
      everReturned: data.everReturned,
      passedOn: data.passedOn,
      today,
      months: reportMonths(filters.from, filters.to, today),
    }
  }, [data.rows, data.deposits, data.accounts, data.everReturned, data.passedOn, filters, today])

  const choices: FilterChoices = useMemo(() => {
    const parties = new Map<string, string>()
    const banks = new Set<string>()
    for (const row of data.rows) {
      if (!inTab(row, filters.dir)) continue
      parties.set(row.partyId, row.party)
      if (row.bank) banks.add(row.bank)
    }
    return {
      parties: [...parties].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      banks: [...banks].sort((a, b) => a.localeCompare(b)),
      accounts: data.accounts,
    }
  }, [data.rows, data.accounts, filters.dir])

  const fieldProps = { filters, set, choices }
  const partyName = choices.parties.find((p) => p.id === filters.party)?.name
  const account = data.accounts.find((a) => a.id === filters.account)
  const accountName = account ? `${account.name}${account.last4 ? ` ···${account.last4}` : ''}` : undefined
  const statusText = filters.statuses
    .map((value) => {
      const [direction, status] = value.split(':')
      return statusLabel(direction as 'in' | 'out', status)
    })
    .join(', ')
  const filterCount = activeFilterCount(filters)
  const clearAll = () => setParam({ dir: null, status: null, party: null, bank: null, account: null, from: null, to: null })

  const describeFilters = () =>
    [
      filters.from || filters.to ? `Due ${dueLabel(filters)}` : 'Any due date',
      DIR_WORDS[filters.dir],
      partyName && `Party: ${partyName}`,
      accountName && `Deposited into ${accountName}`,
      filters.bank && `Bank: ${filters.bank}`,
      statusText && `Status: ${statusText}`,
      `Made ${formatDate(today)}`,
    ]
      .filter(Boolean)
      .join(' · ')

  const exportTab = (as: 'pdf' | 'excel') => {
    const job = {
      title: `${brand.name}: ${tabLabel}`,
      subtitle: describeFilters(),
      tables: reportTables(tab, input),
      fileName: `${brandSlug()}_report_${tab}_${today}`,
    }
    try {
      if (as === 'pdf') exportReportPdf(job)
      else exportReportExcel(job)
    } catch (e) {
      toast.error(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const tabProps = { input, onTab: setTab, onDirection: setDir }

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={data.loading}>
                <Download />
                Export this tab
                <ChevronDown className="!size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[13px] font-normal text-ink-quiet">{tabLabel}, with these filters</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportTab('pdf')}>
                <FileText className="text-ink-quiet" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportTab('excel')}>
                <FileSpreadsheet className="text-ink-quiet" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* The filters stay in view while the tab scrolls. */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[68px] lg:mx-0 lg:px-0">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-surface p-2.5 max-lg:hidden">
          <FilterPill label="Due" value={dueLabel(filters)} active={!!(filters.from || filters.to)} onClear={() => set({ from: null, to: null })} wide>
            <DueField {...fieldProps} />
          </FilterPill>
          <FilterPill label="Direction" value={DIR_LABELS[filters.dir]} active={filters.dir !== defaultDir} onClear={() => setDir(defaultDir)}>
            <DirectionField value={filters.dir} onChange={setDir} />
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
          <FilterPill label="Status" value={statusText || 'Any'} active={filters.statuses.length > 0} onClear={() => set({ status: null })}>
            <StatusField {...fieldProps} />
          </FilterPill>
          <div className="flex-1" />
          {(filterCount > 0 || filters.dir !== defaultDir) && (
            <Button variant="link" className="h-10" onClick={clearAll}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <div role="group" aria-label="Direction" className="grid h-11 min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-track p-1">
            {DIR_ORDER.map((dir) => (
              <button
                key={dir}
                type="button"
                aria-pressed={filters.dir === dir}
                onClick={() => setDir(dir)}
                className={cn('rounded-[9px] text-[15px] font-semibold', filters.dir === dir ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet')}
              >
                {DIR_LABELS[dir]}
              </button>
            ))}
          </div>
          <Button variant="outline" className="h-11 shrink-0" onClick={() => setFiltersOpen(true)}>
            <ListFilter />
            Filters{filterCount ? ` · ${filterCount}` : ''}
          </Button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Report"
        className="-mx-4 mt-2 flex gap-6 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px h-11 shrink-0 border-b-[3px] px-0.5 text-[15px] font-semibold',
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-ink-nav hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:mt-5">
        {data.error && (
          <p role="alert" className="rounded-xl border border-problem-line bg-problem-soft p-3 text-sm text-problem">
            Couldn't load everything: {data.error}
          </p>
        )}
        {data.loading ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border bg-surface p-6">
            <p className="font-semibold">Nothing to report yet</p>
            <p className="text-ink-quiet">Reports fill in as you add the cheques you give and receive.</p>
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab {...tabProps} />
        ) : tab === 'cash' ? (
          <CashFlowTab {...tabProps} />
        ) : tab === 'collections' ? (
          <CollectionsTab {...tabProps} />
        ) : tab === 'payments' ? (
          <PaymentsTab {...tabProps} />
        ) : tab === 'parties' ? (
          <PartiesTab {...tabProps} />
        ) : tab === 'bounces' ? (
          <BouncesTab {...tabProps} />
        ) : (
          <AccountsTab {...tabProps} />
        )}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto px-4 pt-5">
          <SheetHeader className="text-left">
            <SheetTitle className="font-title text-2xl">Filters</SheetTitle>
            <SheetDescription>Every tab uses them, and so does the export.</SheetDescription>
          </SheetHeader>
          <div className="mt-2 flex flex-col gap-5">
            <DueField {...fieldProps} />
            <PartyField {...fieldProps} />
            {filters.dir === 'received' ? <AccountField {...fieldProps} /> : <BankField {...fieldProps} />}
            <StatusField {...fieldProps} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => set({ status: null, party: null, bank: null, account: null, from: null, to: null })}>
                Clear all
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Done</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
