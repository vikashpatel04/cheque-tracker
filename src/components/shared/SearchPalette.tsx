import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, Repeat, Users, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { RowStatus } from '@/components/cheques/RowChips'
import { NAV_ITEMS } from '@/components/shared/navigation'
import { useAppActions } from '@/hooks/useAppActions'
import { useDataChanges } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { givenRow, receivedRow, type ListRow } from '@/lib/chequeList'
import { formatShortDate, formatSigned } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Cheque, Party } from '@/types'
import type { ReceivedCheque } from '@/types/received'

const MAX_CHEQUES = 8
const MAX_PARTIES = 5


interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Search by cheque number, party or amount (Ctrl K), plus places and actions. */
export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const navigate = useNavigate()
  const actions = useAppActions()
  const [query, setQuery] = useState('')
  const [cheques, setCheques] = useState<ListRow[] | null>(null)
  const [parties, setParties] = useState<Party[]>([])

  const load = useCallback(async () => {
    const [given, received, partyRows] = await Promise.all([
      fetchAllRows<Cheque>('cheques', '*, party:parties(*)', { activeOnly: true }),
      fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*)', { activeOnly: true }),
      fetchAllRows<Party>('parties', '*', { activeOnly: true }),
    ])
    setCheques([...given.rows.map(givenRow), ...received.rows.map(receivedRow)])
    setParties(partyRows.rows)
  }, [])

  // Loaded when search first opens, then kept fresh.
  useEffect(() => {
    if (open && cheques === null) void load()
  }, [open, cheques, load])
  const refresh = useCallback(() => {
    if (cheques !== null) void load()
  }, [cheques, load])
  useDataChanges(refresh)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const q = query.trim().toLowerCase()
  // Digits alone could be a cheque number or an amount; ignore separators like 1,20,000.
  const digits = /[a-z]/i.test(q) ? '' : q.replace(/[^\d.]/g, '')

  const chequeResults = useMemo(() => {
    if (!q || !cheques) return []
    const scored: { row: ListRow; score: number }[] = []
    for (const row of cheques) {
      const number = row.number.toLowerCase()
      let score = 0
      if (number === q) score = 4
      else if (number.includes(q)) score = 3
      else if (row.party.toLowerCase().includes(q)) score = 2
      else if (digits && row.amount !== null && String(row.amount).startsWith(String(Number(digits)))) score = 1
      // Cheques still in play come first.
      if (score) scored.push({ row, score: score + (row.open ? 0.5 : 0) })
    }
    return scored
      .sort((a, b) => b.score - a.score || b.row.due.localeCompare(a.row.due))
      .slice(0, MAX_CHEQUES)
      .map((s) => s.row)
  }, [q, digits, cheques])

  const partyResults = useMemo(
    () => (q ? parties.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_PARTIES) : []),
    [q, parties]
  )

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  const actionItems = [
    { label: 'Add a received cheque', icon: ArrowDownLeft, run: () => actions.newReceivedCheque() },
    { label: 'Add a series of received cheques', icon: Repeat, run: () => actions.newSeries() },
    { label: 'Add a given cheque', icon: ArrowUpRight, run: () => actions.newGivenCheque() },
    { label: 'Add funds', icon: Wallet, run: () => actions.addFunds() },
    { label: 'Import cheques from Excel', icon: FileSpreadsheet, run: () => actions.importCheques() },
  ].filter((a) => !q || a.label.toLowerCase().includes(q))

  const places = NAV_ITEMS.filter((item) => !q || item.label.toLowerCase().includes(q))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-w-[640px] sm:translate-y-0 sm:[&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Find a cheque by its number, party or amount.</DialogDescription>
        <Command shouldFilter={false} className="rounded-none max-sm:[&>div:first-child]:pr-14">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search cheque no., party or amount"
            aria-label="Search cheques"
          />
          <CommandList className="max-h-[min(60vh,520px)] p-1.5 max-sm:max-h-none">
            {q && cheques === null && <div className="px-3 py-6 text-center text-sm text-ink-quiet">Loading…</div>}
            {q && cheques !== null && (
              <CommandEmpty className="px-3 py-8 text-center text-[15px] text-ink-quiet">
                Nothing matches “{query.trim()}”.
              </CommandEmpty>
            )}

            {chequeResults.length > 0 && (
              <CommandGroup heading="Cheques">
                {chequeResults.map((row) => (
                  <CommandItem
                    key={row.key}
                    value={row.key}
                    onSelect={() => (row.given ? actions.openCheque(row.id) : actions.openReceivedCheque(row.id))}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        row.direction === 'in' ? 'bg-money-in-soft text-money-in' : 'bg-money-out-soft text-money-out'
                      )}
                    >
                      {row.direction === 'in' ? <ArrowDownLeft className="!size-[18px]" /> : <ArrowUpRight className="!size-[18px]" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{row.party}</span>
                        <RowStatus row={row} />
                      </span>
                      <span className="truncate text-sm text-ink-quiet">
                        <span className="font-cheque">{row.number}</span> · {row.bank} · due {formatShortDate(row.due)}
                      </span>
                    </span>
                    <span className={cn('shrink-0 font-semibold tabular-nums', row.direction === 'in' && 'text-money-in')}>
                      {row.amount === null ? '' : formatSigned(row.amount, row.direction)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {partyResults.length > 0 && (
              <CommandGroup heading="Parties">
                {partyResults.map((party) => (
                  <CommandItem key={party.id} value={`party-${party.id}`} onSelect={() => run(() => navigate(`/parties/${party.id}`))}>
                    <Users className="text-ink-quiet" />
                    <span className="truncate">{party.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {actionItems.length > 0 && (
              <CommandGroup heading="Do">
                {actionItems.map((item) => (
                  <CommandItem key={item.label} value={item.label} onSelect={() => run(item.run)}>
                    <item.icon className="text-ink-quiet" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {places.length > 0 && (
              <CommandGroup heading="Go to">
                {places.map((item) => (
                  <CommandItem key={item.to} value={`go-${item.to}`} onSelect={() => run(() => navigate(item.to))}>
                    <item.icon className="text-ink-quiet" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
