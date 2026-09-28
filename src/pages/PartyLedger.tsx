import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ListPlus,
  MessageCircle,
  Pencil,
  Plus,
  Repeat,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChequeCards } from '@/components/cheques/ChequeCards'
import { ChequeTable } from '@/components/cheques/ChequeTable'
import { nextAction } from '@/components/cheques/nextAction'
import { useGivenActions } from '@/components/cheques/useGivenActions'
import { PartyForm } from '@/components/parties/PartyForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { findPreset } from '@/config/regions'
import { useAppActions } from '@/hooks/useAppActions'
import { useChequeListData } from '@/hooks/useChequeListData'
import { useParties } from '@/hooks/useParties'
import { useSettings } from '@/hooks/useSettings'
import { inTab, sortRows, type DirectionTab, type ListRow } from '@/lib/chequeList'
import { formatMoney, formatSigned, todayISO } from '@/lib/formatters'
import { summarizeParty, whatsappLink } from '@/lib/parties'
import { getActiveRegion } from '@/lib/region'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, type ChequeStatus } from '@/types'
import { RECEIVED_STATUS_LABELS, type ReceivedStatus } from '@/types/received'

const TABS: DirectionTab[] = ['all', 'given', 'received']
const TAB_LABELS: Record<DirectionTab, string> = { all: 'All', given: 'Given', received: 'Received' }
const ANY = '__any__'

interface NewItem {
  label: string
  hint: string
  icon: LucideIcon
  run: () => void
}

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-xl border bg-surface p-4 lg:gap-1.5 lg:px-5">
      <h2 className="text-sm font-medium text-ink-quiet">{label}</h2>
      <p className="truncate text-xl font-semibold tabular-nums sm:text-2xl lg:text-[28px]">{children}</p>
      <p className="text-[13px] text-ink-quiet">{sub}</p>
    </section>
  )
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * A party's ledger (design brief, screen 38): who they are, what went each
 * way, and every cheque with them, both directions, with its next step.
 */
export default function PartyLedger() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const app = useAppActions()
  const tracks = useSettings().settings.tracks ?? 'both'
  const [params, setParams] = useSearchParams()
  const { parties, loading: partiesLoading, updateParty, softDeleteParty } = useParties(true)
  const { rows: allRows, loading: rowsLoading, error } = useChequeListData()
  const { actions: givenActions, dialogs } = useGivenActions()
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const today = todayISO()
  const region = getActiveRegion()
  const { chequeValidityMonths, clearingDays } = region
  const rules = useMemo(() => ({ chequeValidityMonths, clearingDays }), [chequeValidityMonths, clearingDays])

  const party = parties.find((p) => p.id === id)
  const rows = useMemo(() => allRows.filter((r) => r.partyId === id), [allRows, id])
  const summary = useMemo(() => summarizeParty(rows, today), [rows, today])

  const dirParam = params.get('dir') as DirectionTab | null
  const dir: DirectionTab = dirParam && TABS.includes(dirParam) ? dirParam : 'all'
  const status = params.get('status')
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
    setSelected(new Set())
  }

  // Status choices are the ones this party's cheques are in, "given:" or "received:" first.
  const statuses = useMemo(
    () => [...new Set(rows.filter((r) => inTab(r, dir)).map((r) => `${r.direction}:${r.status}`))].sort(),
    [rows, dir]
  )
  const statusLabel = (value: string) => {
    const [direction, s] = value.split(':')
    const label = direction === 'out' ? STATUS_LABELS[s as ChequeStatus] : RECEIVED_STATUS_LABELS[s as ReceivedStatus]
    return dir === 'all' ? `${label} (${direction === 'out' ? 'given' : 'received'})` : label
  }
  const visible = useMemo(
    () => sortRows(rows.filter((r) => inTab(r, dir) && (!status || `${r.direction}:${r.status}` === status)), 'upcoming', 'asc'),
    [rows, dir, status]
  )
  const open = (row: ListRow) => (row.given ? app.openCheque(row.id) : app.openReceivedCheque(row.id))
  const next = (row: ListRow) => nextAction(row, givenActions, app)

  if (partiesLoading || rowsLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!party) {
    return (
      <div>
        <PageHeader back={() => navigate('/parties')} title="Party not found" />
        <p className="text-ink-quiet">It may have been deleted.</p>
      </div>
    )
  }

  const whatsapp = whatsappLink(party.phone, findPreset(region.country)?.callingCode)
  const receivedItems: NewItem[] = [
    { label: 'Received cheque', hint: 'A cheque they gave you', icon: ArrowDownLeft, run: () => app.newReceivedCheque(party.id) },
    { label: 'Series', hint: 'Rent, instalments: many at once', icon: Repeat, run: () => app.newSeries(party.id) },
  ]
  const givenItems: NewItem[] = [
    { label: 'Given cheque', hint: 'A cheque you wrote to them', icon: ArrowUpRight, run: () => app.newGivenCheque(party.id) },
    {
      label: 'Several given cheques',
      hint: 'Many at once, with numbers counting up',
      icon: ListPlus,
      run: () => navigate(`/parties/${party.id}/bulk-add`),
    },
  ]
  const newGroups = tracks === 'given' ? [givenItems] : tracks === 'received' ? [receivedItems] : [receivedItems, givenItems]

  const net = summary.net
  const bouncedOwedToYou = rows
    .filter((r) => r.received?.status === 'BOUNCED')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const bounceNote = summary.gave.returnedOwed
    ? `${formatMoney(summary.gave.returnedOwed)} returned, still to pay`
    : bouncedOwedToYou
      ? `${formatMoney(bouncedOwedToYou)} bounced, still to collect`
      : summary.bounces
        ? 'All settled since'
        : 'None so far'

  const about = [
    party.contact_name,
    party.phone && (
      <a key="phone" href={`tel:${party.phone.replace(/[^\d+]/g, '')}`} className="underline-offset-2 hover:underline">
        {party.phone}
      </a>
    ),
    party.bank_name,
  ].filter(Boolean)

  const whatsappButton = whatsapp && (
    <Button variant="outline" asChild>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
        <MessageCircle />
        WhatsApp
      </a>
    </Button>
  )

  return (
    <div>
      <PageHeader
        back={() => navigate('/parties')}
        title={party.name}
        subtitle={
          <>
            {about.length ? (
              about.map((part, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {part}
                </span>
              ))
            ) : (
              <span>No contact details yet</span>
            )}
            {!party.is_active && <span className="font-semibold text-ink"> · Inactive</span>}
            {party.notes && <p className="mt-1 text-sm">{party.notes}</p>}
          </>
        }
        actions={
          <>
            {whatsappButton}
            <Button variant="outline" className="max-lg:hidden" onClick={() => setEditing(true)}>
              <Pencil />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 pl-4 pr-3.5">
                  <Plus strokeWidth={2.2} />
                  New cheque
                  <ChevronDown className="!size-4 max-sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-80">
                {newGroups.map((group, g) => (
                  <div key={g}>
                    {g > 0 && <DropdownMenuSeparator />}
                    {group.map((item) => (
                      <DropdownMenuItem key={item.label} onSelect={() => item.run()} className="items-start py-2.5">
                        <item.icon className="mt-0.5 !size-[18px] text-ink-quiet" />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{item.label}</span>
                          <span className="text-[13px] text-ink-quiet">{item.hint}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" aria-label="Edit party" className="lg:hidden" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:gap-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
          <Tile
            label="You gave them"
            sub={
              summary.gave.count
                ? summary.pay.amount
                  ? `${plural(summary.gave.count, 'cheque')} · ${formatMoney(summary.pay.amount)} still to pay`
                  : `${plural(summary.gave.count, 'cheque')} · all paid`
                : 'No cheques yet'
            }
          >
            {formatMoney(summary.gave.amount)}
          </Tile>
          <Tile
            label="They gave you"
            sub={
              summary.got.count
                ? summary.collect.amount
                  ? `${plural(summary.got.count, 'cheque')} · ${formatMoney(summary.collect.amount)} still to collect`
                  : `${plural(summary.got.count, 'cheque')} · all collected`
                : 'No cheques yet'
            }
          >
            <span className={summary.got.amount ? 'text-money-in' : undefined}>{formatSigned(summary.got.amount, 'in')}</span>
          </Tile>
          <Tile
            label="Net still due"
            sub={
              net > 0
                ? 'To collect from them, after what you pay'
                : net < 0
                  ? 'To pay them, after what you collect'
                  : summary.pay.count || summary.collect.count
                    ? 'Even: what you pay and collect match'
                    : 'Nothing left either way'
            }
          >
            <span className={net > 0 ? 'text-money-in' : undefined}>{formatMoney(Math.abs(net))}</span>
          </Tile>
          <Tile label="Bounces" sub={bounceNote}>
            <span className={summary.bounces ? 'text-problem' : undefined}>{summary.bounces}</span>
          </Tile>
        </div>

        {/* Direction: underlined tabs on desktop, a segmented control on phones (as on Cheques). */}
        <div role="group" aria-label="Direction" className="flex items-end gap-7 border-b max-lg:hidden">
          {TABS.map((tab) => {
            const active = dir === tab
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => set({ dir: tab === 'all' ? null : tab, status: null })}
                className={cn(
                  '-mb-px inline-flex h-11 items-center gap-2 border-b-[3px] px-0.5 text-base font-semibold',
                  active ? 'border-brand text-brand' : 'border-transparent text-ink-nav hover:text-ink'
                )}
              >
                {TAB_LABELS[tab]}
                <span className="text-[13px] font-medium text-ink-quiet">{rows.filter((r) => inTab(r, tab)).length}</span>
              </button>
            )
          })}
        </div>
        <div role="group" aria-label="Direction" className="grid h-11 grid-cols-3 gap-1 rounded-xl bg-track p-1 lg:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={dir === tab}
              onClick={() => set({ dir: tab === 'all' ? null : tab, status: null })}
              className={cn('rounded-[9px] text-[15px] font-semibold', dir === tab ? 'bg-thumb text-ink shadow-thumb' : 'text-ink-quiet')}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={status ?? ANY} onValueChange={(v) => set({ status: v === ANY ? null : v })}>
            <SelectTrigger aria-label="Status" className="h-10 w-auto min-w-[190px] bg-surface text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <span className="text-sm tabular-nums text-ink-quiet">{plural(visible.length, 'cheque')}</span>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-problem-line bg-problem-soft p-3 text-sm text-problem">
            Couldn't load everything: {error}
          </p>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6">
            <p className="font-semibold">{rows.length ? 'No cheques match' : 'No cheques with them yet'}</p>
            <p className="text-ink-quiet">
              {rows.length ? 'Try another direction or status.' : 'Add a cheque you gave them or one they gave you.'}
            </p>
            {rows.length > 0 && (
              <Button variant="outline" onClick={() => set({ dir: null, status: null })}>
                Show all their cheques
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="max-xl:hidden">
              <ChequeTable
                rows={visible}
                today={today}
                rules={rules}
                selected={selected}
                onToggle={(key) =>
                  setSelected((current) => {
                    const nextSet = new Set(current)
                    if (nextSet.has(key)) nextSet.delete(key)
                    else nextSet.add(key)
                    return nextSet
                  })
                }
                onToggleAll={(all) => setSelected(all ? new Set(visible.map((r) => r.key)) : new Set())}
                onOpen={open}
                nextAction={next}
                givenActions={givenActions}
                hideParty
              />
            </div>
            <div className="xl:hidden">
              <ChequeCards rows={visible} today={today} rules={rules} grouped onOpen={open} nextAction={next} hideParty />
            </div>
          </>
        )}
      </div>

      <PartyForm
        open={editing}
        onOpenChange={setEditing}
        party={party}
        onSubmit={async (data) => {
          const { error: saveError } = await updateParty(party.id, {
            name: data.name.trim(),
            contact_name: data.contact_name || null,
            phone: data.phone || null,
            bank_name: data.bank_name || null,
            notes: data.notes || null,
            is_active: data.is_active,
          })
          if (saveError) {
            toast.error(`Couldn't save the party: ${saveError}`)
            return false
          }
          toast.success('Party saved')
        }}
        onDelete={async () => {
          const { error: deleteError } = await softDeleteParty(party.id)
          if (deleteError) {
            toast.error(`Couldn't delete the party: ${deleteError}`)
            throw new Error(deleteError)
          }
          toast.success(`${party.name} deleted`)
          navigate('/parties')
        }}
      />
      {dialogs}
    </div>
  )
}
