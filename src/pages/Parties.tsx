import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { PartyBulkUpload } from '@/components/parties/BulkUpload'
import { PartyForm } from '@/components/parties/PartyForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { useChequeListData } from '@/hooks/useChequeListData'
import { useParties } from '@/hooks/useParties'
import { usePlan } from '@/hooks/usePlan'
import { formatMoney, formatShortDate, formatSigned, todayISO } from '@/lib/formatters'
import { emptySummary, partyAbout, summarizeParties, type PartySummary } from '@/lib/parties'
import { announceDataChange } from '@/lib/dataEvents'
import { cn } from '@/lib/utils'
import type { Party } from '@/types'

type Side = 'all' | 'pay' | 'collect'
type Sort = 'due' | 'name' | 'next' | 'bounces'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'due', label: 'Most still due' },
  { value: 'next', label: 'Next date first' },
  { value: 'name', label: 'Name, A to Z' },
  { value: 'bounces', label: 'Most bounces' },
]

function Net({ s }: { s: PartySummary }) {
  if (!s.net) return <span className="text-ink-quiet">{s.pay.count || s.collect.count ? 'Even' : '—'}</span>
  return s.net > 0 ? (
    <span className="font-semibold text-money-in">{formatMoney(s.net)} to collect</span>
  ) : (
    <span className="font-semibold text-money-out">{formatMoney(-s.net)} to pay</span>
  )
}

function Next({ s, today }: { s: PartySummary; today: string }) {
  if (!s.next) return <span className="text-ink-faint">—</span>
  if (s.next.overdue) return <span className="font-semibold text-problem">Overdue since {formatShortDate(s.next.date)}</span>
  return (
    <span className={cn(s.next.date === today && 'font-semibold text-attention')}>
      {s.next.date === today ? 'Today' : formatShortDate(s.next.date)}
    </span>
  )
}

/** Parties (design screen Parties-desktop): what you still pay and collect with each, both ways. */
export default function Parties() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { parties, loading: partiesLoading, createParty } = useParties(true)
  const { rows, loading: rowsLoading } = useChequeListData()
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const { guard } = usePlan()
  const today = todayISO()

  const q = params.get('q') ?? ''
  const side = (['all', 'pay', 'collect'] as Side[]).includes(params.get('side') as Side) ? (params.get('side') as Side) : 'all'
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? (params.get('sort') as Sort) : 'due'
  const inactive = params.get('inactive') === '1'
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const summaries = useMemo(() => summarizeParties(rows, today), [rows, today])
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const summary = (p: Party) => summaries.get(p.id) ?? emptySummary()
    return parties
      .filter((p) => inactive || p.is_active)
      .filter((p) => !term || p.name.toLowerCase().includes(term) || partyAbout(p).toLowerCase().includes(term))
      .filter((p) => side === 'all' || (side === 'pay' ? summary(p).pay.count > 0 : summary(p).collect.count > 0))
      .map((p) => ({ party: p, s: summary(p) }))
      .sort((a, b) => {
        switch (sort) {
          case 'name':
            return a.party.name.localeCompare(b.party.name, undefined, { sensitivity: 'base' })
          case 'next':
            return (a.s.next?.date ?? '9999').localeCompare(b.s.next?.date ?? '9999') || a.party.name.localeCompare(b.party.name)
          case 'bounces':
            return b.s.bounces - a.s.bounces || a.party.name.localeCompare(b.party.name)
          default:
            return b.s.pay.amount + b.s.collect.amount - (a.s.pay.amount + a.s.collect.amount) || a.party.name.localeCompare(b.party.name)
        }
      })
  }, [parties, summaries, q, side, sort, inactive])

  const shownPay = list.reduce((sum, x) => sum + x.s.pay.amount, 0)
  const shownCollect = list.reduce((sum, x) => sum + x.s.collect.amount, 0)
  const loading = partiesLoading || rowsLoading

  return (
    <div>
      <PageHeader
        title="Parties"
        actions={
          <>
            <Button variant="outline" onClick={guard(() => setImportOpen(true))}>
              <FileSpreadsheet />
              Import from Excel
            </Button>
            <Button onClick={guard(() => setFormOpen(true))}>
              <Plus />
              Add party
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-line-field bg-surface px-3.5 text-ink-quiet sm:w-[300px]">
            <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search parties"
              placeholder="Name, contact, phone or bank"
              value={q}
              onChange={(e) => set({ q: e.target.value || null })}
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <div role="group" aria-label="Which parties" className="grid h-11 w-full grid-cols-3 gap-1 rounded-xl bg-track p-1 sm:w-[300px]">
            {(
              [
                ['all', 'All'],
                ['pay', 'You pay'],
                ['collect', 'Pay you'],
              ] as [Side, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => set({ side: value === 'all' ? null : value })}
                className={cn('rounded-[9px] text-sm font-semibold', side === value ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet')}
              >
                {label}
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={(v) => set({ sort: v === 'due' ? null : v })}>
            <SelectTrigger aria-label="Order" className="h-11 w-auto min-w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex h-11 items-center gap-2 px-1 text-sm text-ink-quiet">
            <Switch checked={inactive} onCheckedChange={(on) => set({ inactive: on ? '1' : null })} />
            Show inactive
          </label>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6">
            <p className="font-semibold">{parties.length ? 'No parties match' : 'No parties yet'}</p>
            <p className="text-ink-quiet">
              {parties.length ? 'Try another search, or show inactive parties too.' : 'Add the people and businesses you give cheques to or get cheques from.'}
            </p>
          </div>
        ) : (
          <>
            {/* Wide screens: a table. */}
            <div className="overflow-hidden rounded-xl border bg-surface max-lg:hidden">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col />
                  <col className="w-[170px]" />
                  <col className="w-[170px]" />
                  <col className="w-[170px]" />
                  <col className="w-[90px]" />
                  <col className="w-[180px]" />
                </colgroup>
                <thead className="bg-sidebar text-[13px] font-semibold text-ink-quiet">
                  <tr className="h-11 border-b">
                    <th className="pl-5">Party</th>
                    <th className="pr-4 text-right">You still pay</th>
                    <th className="pr-4 text-right">You still collect</th>
                    <th>Net still due</th>
                    <th>Bounces</th>
                    <th>Next</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ party, s }) => (
                    <tr
                      key={party.id}
                      onClick={() => navigate(`/parties/${party.id}`)}
                      className={cn('h-[62px] cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-hover/60', !party.is_active && 'opacity-60')}
                    >
                      <td className="py-2 pl-5 pr-3">
                        <button type="button" className="max-w-full truncate text-left text-[15px] font-semibold hover:underline" onClick={() => navigate(`/parties/${party.id}`)}>
                          {party.name}
                          {!party.is_active && <span className="ml-2 text-xs font-normal text-ink-quiet">inactive</span>}
                        </button>
                        <div className="truncate text-[13px] text-ink-quiet">{partyAbout(party)}</div>
                      </td>
                      <td className="pr-4 text-right tabular-nums">
                        {s.pay.count ? (
                          <>
                            <div className="text-[15px] font-semibold">{formatMoney(s.pay.amount)}</div>
                            <div className="text-xs text-ink-quiet">
                              {s.pay.count} cheque{s.pay.count === 1 ? '' : 's'}
                            </div>
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="pr-4 text-right tabular-nums">
                        {s.collect.count ? (
                          <>
                            <div className="text-[15px] font-semibold text-money-in">{formatSigned(s.collect.amount, 'in')}</div>
                            <div className="text-xs text-ink-quiet">
                              {s.collect.count} cheque{s.collect.count === 1 ? '' : 's'}
                            </div>
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="text-sm tabular-nums">
                        <Net s={s} />
                      </td>
                      <td className={cn('text-sm', s.bounces ? 'font-semibold text-problem' : 'text-ink-faint')}>{s.bounces || '—'}</td>
                      <td className="text-sm">
                        <Next s={s} today={today} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones and tablets: cards. */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:hidden">
              {list.map(({ party, s }) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => navigate(`/parties/${party.id}`)}
                  className={cn('flex min-w-0 flex-col gap-2 rounded-xl border bg-surface p-3.5 text-left', !party.is_active && 'opacity-60')}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-semibold">{party.name}</span>
                      <span className="truncate text-[13px] text-ink-quiet">{partyAbout(party) || (party.is_active ? '' : 'Inactive')}</span>
                    </span>
                    <span className="shrink-0 text-sm">
                      <Next s={s} today={today} />
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                    {s.pay.count > 0 && <span>You pay <span className="font-semibold">{formatMoney(s.pay.amount)}</span></span>}
                    {s.collect.count > 0 && (
                      <span>
                        You collect <span className="font-semibold text-money-in">{formatMoney(s.collect.amount)}</span>
                      </span>
                    )}
                    {s.bounces > 0 && <span className="font-semibold text-problem">{s.bounces} bounced</span>}
                    {!s.pay.count && !s.collect.count && <span className="text-ink-quiet">Nothing due</span>}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-sm tabular-nums text-ink-quiet">
              {list.length} of {parties.filter((p) => inactive || p.is_active).length} parties
              {(shownPay > 0 || shownCollect > 0) && (
                <>
                  {' · '}these: you still pay <span className="font-semibold text-ink">{formatMoney(shownPay)}</span>, you still collect{' '}
                  <span className="font-semibold text-money-in">{formatMoney(shownCollect)}</span>
                </>
              )}
            </p>
          </>
        )}
      </div>

      <PartyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={async (data) => {
          const { error } = await createParty({
            name: data.name,
            contact_name: data.contact_name || null,
            phone: data.phone || null,
            bank_name: data.bank_name || null,
            notes: data.notes || null,
            is_active: true,
          })
          if (error) {
            toast.error(`Couldn't add the party: ${error}`)
            return false
          }
          toast.success('Party added')
        }}
      />
      <PartyBulkUpload open={importOpen} onOpenChange={setImportOpen} onComplete={announceDataChange} />
    </div>
  )
}
