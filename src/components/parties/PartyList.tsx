import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useParties } from '@/hooks/useParties'
import { useCheques } from '@/hooks/useCheques'
import { formatCurrency } from '@/lib/formatters'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PartyForm } from './PartyForm'
import { PartyBulkUpload } from './BulkUpload'

type SortKey = 'name' | 'count' | 'outstanding'
type SortDir = 'asc' | 'desc'

// Default direction when a column is first selected.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  count: 'desc',
  outstanding: 'desc',
}

export function PartyList() {
  const navigate = useNavigate()
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { parties, loading, createParty, fetchParties } = useParties()
  const { cheques } = useCheques()

  // Pre-compute stats per party once, then filter + sort
  const rows = useMemo(() => {
    const statsByParty: Record<string, { count: number; outstanding: number }> = {}
    cheques.forEach((c) => {
      if (!['PENDING', 'DEPOSITED'].includes(c.status)) return
      const s = (statsByParty[c.party_id] ??= { count: 0, outstanding: 0 })
      s.count += 1
      s.outstanding += Number(c.amount)
    })

    const term = search.trim().toLowerCase()
    const filtered = parties.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false
      if (showActiveOnly && (statsByParty[p.id]?.count ?? 0) === 0) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      const aStats = statsByParty[a.id] ?? { count: 0, outstanding: 0 }
      const bStats = statsByParty[b.id] ?? { count: 0, outstanding: 0 }

      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      } else if (sortKey === 'count') {
        cmp = aStats.count - bStats.count
      } else {
        cmp = aStats.outstanding - bStats.outstanding
      }
      // Name as the tiebreaker so the order is stable
      if (cmp === 0 && sortKey !== 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted.map((p) => ({
      ...p,
      stats: statsByParty[p.id] ?? { count: 0, outstanding: 0 },
    }))
  }, [parties, cheques, search, showActiveOnly, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(DEFAULT_DIR[key])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} id="active-only" />
            <Label htmlFor="active-only" className="mb-0">
              Active cheques only
            </Label>
          </div>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Upload
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Party
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <SortableTh
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
                <TableHead className="p-3 text-foreground">Contact</TableHead>
                <TableHead className="p-3 text-foreground">Phone</TableHead>
                <TableHead className="p-3 text-foreground">Bank</TableHead>
                <SortableTh
                  label="Active Cheques"
                  column="count"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
                <SortableTh
                  label="Outstanding"
                  column="outstanding"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-3"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell className="p-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    No parties found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((party) => (
                  <TableRow
                    key={party.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/parties/${party.id}`)}
                  >
                    <TableCell className="p-3 font-medium">
                      {party.name}
                      {!party.is_active && (
                        <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                      )}
                    </TableCell>
                    <TableCell className="p-3">{party.contact_name ?? '—'}</TableCell>
                    <TableCell className="p-3">{party.phone ?? '—'}</TableCell>
                    <TableCell className="p-3">{party.bank_name ?? '—'}</TableCell>
                    <TableCell className="p-3 text-right tabular-nums">{party.stats.count}</TableCell>
                    <TableCell className="p-3 text-right tabular-nums">
                      {formatCurrency(party.stats.outstanding)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            toast.error(`Failed to add party: ${error}`)
            return false
          }
          toast.success('Party added')
        }}
      />

      <PartyBulkUpload open={bulkOpen} onOpenChange={setBulkOpen} onComplete={fetchParties} />
    </div>
  )
}

/* ---------- Sortable column header ---------- */

interface SortableThProps {
  label: string
  column: SortKey
  align?: 'left' | 'right'
  sortKey: SortKey
  sortDir: SortDir
  onClick: (column: SortKey) => void
}

function SortableTh({ label, column, align = 'left', sortKey, sortDir, onClick }: SortableThProps) {
  const active = sortKey === column
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead
      className={cn('p-0', align === 'right' && 'text-right')}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => onClick(column)}
        className={cn(
          'group h-auto w-full justify-start rounded-none px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70',
          align === 'right' && 'justify-end',
          active && 'text-foreground'
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn(
            'transition-opacity',
            active ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
          )}
        />
      </Button>
    </TableHead>
  )
}
