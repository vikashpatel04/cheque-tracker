import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { countsAsIssued } from '@/lib/chequeTags'
import { ALL_STATUSES, STATUS_LABELS, type Party, type Cheque, type ChequeStatus } from '@/types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { StatusPill } from '@/components/shared/StatusPill'
import { PartyForm } from './PartyForm'
import { useParties } from '@/hooks/useParties'

export function PartyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateParty, softDeleteParty } = useParties(true)
  const [party, setParty] = useState<Party | null>(null)
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ChequeStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('parties').select('*').eq('id', id).single(),
      supabase.from('cheques').select('*').eq('party_id', id).is('deleted_at', null).order('due_date'),
    ]).then(([partyRes, chequesRes]) => {
      if (partyRes.data) setParty(partyRes.data as Party)
      if (chequesRes.data) setCheques(chequesRes.data as Cheque[])
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parties')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-8 w-40" />
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-16" />
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TableHead key={i} className="p-3"><Skeleton className="h-4 w-16" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="p-3"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!party) return <p className="text-muted-foreground">Party not found.</p>

  const filtered = statusFilter === 'ALL' ? cheques : cheques.filter((c) => c.status === statusFilter)

  const issued = cheques.filter(countsAsIssued)
  const totalIssued = issued.reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid = issued.filter((c) => c.status === 'PASSED').reduce((s, c) => s + Number(c.amount), 0)
  const totalOutstanding = issued
    .filter((c) => ['PENDING', 'DEPOSITED'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount), 0)
  // Bounced and not yet re-presented or written off — still owed to the party.
  const totalReturned = issued.filter((c) => c.status === 'RETURNED').reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parties')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">{party.name}</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Party Info</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Contact:</span> {party.contact_name ?? '—'}</p>
          <p><span className="text-muted-foreground">Phone:</span> {party.phone ?? '—'}</p>
          <p><span className="text-muted-foreground">Bank:</span> {party.bank_name ?? '—'}</p>
          <p><span className="text-muted-foreground">Notes:</span> {party.notes ?? '—'}</p>
          <div className="flex items-center gap-2">
            <Switch
              checked={party.is_active}
              onCheckedChange={async (v) => {
                await updateParty(party.id, { is_active: v })
                setParty({ ...party, is_active: v })
              }}
            />
            <Label>Active</Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issued', value: totalIssued },
          { label: 'Paid', value: totalPaid },
          { label: 'Outstanding', value: totalOutstanding },
          { label: 'Returned (still owed)', value: totalReturned },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['ALL', ...ALL_STATUSES] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => navigate(`/parties/${party.id}/bulk-add`)}>
          Bulk Add Cheques
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="p-3 text-foreground">Cheque No.</TableHead>
                <TableHead className="p-3 text-foreground">Amount</TableHead>
                <TableHead className="p-3 text-foreground">Due Date</TableHead>
                <TableHead className="p-3 text-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="p-3">{c.cheque_number}</TableCell>
                  <TableCell className="p-3">{formatCurrency(Number(c.amount))}</TableCell>
                  <TableCell className="p-3">{formatDate(c.due_date)}</TableCell>
                  <TableCell className="p-3"><StatusPill status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PartyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        party={party}
        onSubmit={async (data) => {
          const result = await updateParty(party.id, {
            name: data.name,
            contact_name: data.contact_name || null,
            phone: data.phone || null,
            bank_name: data.bank_name || null,
            notes: data.notes || null,
            is_active: data.is_active,
          })
          if (result.error) {
            toast.error(result.error)
            return false
          }
          toast.success('Party updated')
          setParty({ ...party, ...data, contact_name: data.contact_name || null, phone: data.phone || null, bank_name: data.bank_name || null, notes: data.notes || null })
        }}
        onDelete={async () => {
          const result = await softDeleteParty(party.id)
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          toast.success(`${party.name} deleted`)
          navigate('/parties')
        }}
      />
    </div>
  )
}
