import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { DateInput } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SORT_OPTIONS, sortValue, type ListFilters } from '@/lib/chequeFilters'
import { cn } from '@/lib/utils'
import { ALL_STATUSES, STATUS_LABELS } from '@/types'
import { RECEIVED_STATUS_LABELS, type BankAccount, type ReceivedStatus } from '@/types/received'

const RECEIVED_STATUSES = Object.keys(RECEIVED_STATUS_LABELS) as ReceivedStatus[]

/** The statuses to pick from on a tab, keyed by direction since both sides have DEPOSITED. */
function statusOptions(dir: ListFilters['dir']) {
  const given = ALL_STATUSES.map((s) => ({ value: `out:${s}`, label: STATUS_LABELS[s] }))
  const received = RECEIVED_STATUSES.map((s) => ({ value: `in:${s}`, label: RECEIVED_STATUS_LABELS[s] }))
  if (dir === 'given') return [{ heading: null, options: given }]
  if (dir === 'received') return [{ heading: null, options: received }]
  return [
    { heading: 'Given', options: given },
    { heading: 'Received', options: received },
  ]
}

export interface FilterChoices {
  parties: { id: string; name: string }[]
  banks: string[]
  accounts: BankAccount[]
}

interface FieldProps {
  filters: ListFilters
  set: (changes: Partial<Record<'status' | 'party' | 'bank' | 'account' | 'from' | 'to' | 'sort', string | null>>) => void
  choices: FilterChoices
}

export function StatusField({ filters, set }: FieldProps) {
  const toggle = (value: string) => {
    const next = filters.statuses.includes(value) ? filters.statuses.filter((s) => s !== value) : [...filters.statuses, value]
    set({ status: next.join(',') || null })
  }
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium">Status</legend>
      {statusOptions(filters.dir).map((group) => (
        <div key={group.heading ?? 'all'} className="flex flex-col gap-1">
          {group.heading && <span className="text-xs font-bold uppercase tracking-[0.07em] text-ink-quiet">{group.heading}</span>}
          {group.options.map((option) => (
            <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-[15px] hover:bg-hover">
              <Checkbox checked={filters.statuses.includes(option.value)} onCheckedChange={() => toggle(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  )
}

export function PartyField({ filters, set, choices }: FieldProps) {
  return (
    <div className="flex flex-col">
      <Label htmlFor="filter-party">Party</Label>
      <Combobox
        id="filter-party"
        options={[{ value: '', label: 'Any party' }, ...choices.parties.map((p) => ({ value: p.id, label: p.name }))]}
        value={filters.party ?? ''}
        onChange={(value) => set({ party: value || null })}
        placeholder="Any party"
        title="Party"
        searchPlaceholder="Find a party"
        emptyText="No party by that name"
      />
    </div>
  )
}

const ANY = '__any__'

export function BankField({ filters, set, choices }: FieldProps) {
  return (
    <div className="flex flex-col">
      <Label htmlFor="filter-bank">Bank</Label>
      <Select value={filters.bank ?? ANY} onValueChange={(value) => set({ bank: value === ANY ? null : value })}>
        <SelectTrigger id="filter-bank">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any bank</SelectItem>
          {choices.banks.map((bank) => (
            <SelectItem key={bank} value={bank}>
              {bank}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function AccountField({ filters, set, choices }: FieldProps) {
  return (
    <div className="flex flex-col">
      <Label htmlFor="filter-account">Deposited into</Label>
      <Select value={filters.account ?? ANY} onValueChange={(value) => set({ account: value === ANY ? null : value })}>
        <SelectTrigger id="filter-account">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any account</SelectItem>
          {choices.accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
              {a.last4 ? ` ···${a.last4}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DueField({ filters, set }: FieldProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium">Due between</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <Label htmlFor="filter-from" className="text-ink-quiet">
            From
          </Label>
          <DateInput id="filter-from" value={filters.from} onChange={(iso) => set({ from: iso || null })} />
        </div>
        <div className="flex flex-col">
          <Label htmlFor="filter-to" className="text-ink-quiet">
            To
          </Label>
          <DateInput id="filter-to" value={filters.to} onChange={(iso) => set({ to: iso || null })} />
        </div>
      </div>
      {(filters.from || filters.to) && (
        <Button variant="link" className="h-auto self-start p-0" onClick={() => set({ from: null, to: null })}>
          Any date
        </Button>
      )}
    </fieldset>
  )
}

export function SortField({ filters, set }: FieldProps) {
  return (
    <div className="flex flex-col">
      <Label htmlFor="filter-sort">Order</Label>
      <Select value={sortValue(filters)} onValueChange={(value) => set({ sort: value === 'upcoming' ? null : value })}>
        <SelectTrigger id="filter-sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** A filter as a pill that opens its field, like "Party · Any ▾". */
export function FilterPill({
  label,
  value,
  active,
  onClear,
  children,
  wide,
}: {
  label: string
  value: string
  active: boolean
  onClear?: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <Popover>
      <div className={cn('inline-flex h-10 items-center rounded-[10px] border bg-surface', active ? 'border-brand' : 'border-line-field')}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex h-full items-center gap-1.5 pl-3 pr-2.5 text-sm">
            <span className="text-ink-quiet">{label}</span>
            <span className="max-w-[180px] truncate font-semibold">{value}</span>
            {!active && <ChevronDown className="h-3.5 w-3.5 text-ink-quiet" aria-hidden="true" />}
          </button>
        </PopoverTrigger>
        {active && onClear && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={onClear}
            className="mr-1 flex h-8 w-8 items-center justify-center rounded-md text-ink-quiet hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className={cn('flex flex-col gap-3', wide ? 'w-[340px]' : 'w-72')}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
