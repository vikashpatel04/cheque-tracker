import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { RePresentDrawer } from '@/components/cheques/RePresentDrawer'
import { WriteOffDialog } from '@/components/cheques/WriteOffDialog'
import { getChequeTags, isLegacyRepresented, stripTagLines } from '@/lib/chequeTags'
import type { Cheque } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Our cheques that bounced. Each one needs a decision: re-present the same
 * cheque (the party deposits it again) or write it off and issue a new one.
 */
export default function Returned() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [partyFilter, setPartyFilter] = useState('')
  const [rePresentCheque, setRePresentCheque] = useState<Cheque | null>(null)
  const [writeOffCheque, setWriteOffCheque] = useState<Cheque | null>(null)

  const fetchCheques = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cheques')
      .select('*, party:parties(*)')
      .eq('status', 'RETURNED')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (data) setCheques(data as Cheque[])
    setLoading(false)
  }

  useEffect(() => {
    fetchCheques()
  }, [])

  const filtered = partyFilter
    ? cheques.filter((c) => c.party?.name?.toLowerCase().includes(partyFilter.toLowerCase()))
    : cheques

  // Old-style re-presented cheques were settled through a separate entry.
  const needsAction = filtered.filter((c) => !isLegacyRepresented(c))
  const totalNeedsAction = needsAction.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returned cheques"
        subtitle="Cheques you gave that bounced. Re-present the same cheque, or write it off and issue a new one."
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          {loading ? (
            <>
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-9 w-48 ml-auto" />
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Still owed on returned cheques</p>
                <p className="text-xl font-semibold">{formatCurrency(totalNeedsAction)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Needs action</p>
                <p className="text-xl font-semibold">{needsAction.length}</p>
              </div>
              <Input
                placeholder="Filter by party..."
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="max-w-xs ml-auto"
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No returned cheques</p>
        ) : (
          filtered.map((c) => {
            const tags = getChequeTags(c)
            const visibleNotes = stripTagLines(c.notes)
            const legacy = isLegacyRepresented(c)

            return (
              <Card key={c.id} className={legacy ? 'opacity-70' : ''}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium">{c.party?.name} · #{c.cheque_number}</p>
                        {tags.map((tag) => (
                          <span
                            key={tag.key}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.className}`}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                      <p className="text-lg font-semibold">{formatCurrency(Number(c.amount))}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {formatDate(c.due_date)}
                        {c.original_due_date && c.original_due_date !== c.due_date && (
                          <> · Cheque date: {formatDate(c.original_due_date)}</>
                        )}
                      </p>
                      {c.return_reason && (
                        <p className="text-sm text-destructive mt-1">Reason: {c.return_reason}</p>
                      )}
                      {visibleNotes && (
                        <p className="text-sm text-muted-foreground mt-1">{visibleNotes}</p>
                      )}
                    </div>
                    {legacy ? (
                      <p className="text-xs text-muted-foreground italic">Re-presented earlier (separate entry)</p>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setRePresentCheque(c)}>Re-present</Button>
                        <Button size="sm" variant="outline" onClick={() => setWriteOffCheque(c)}>Write Off</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <RePresentDrawer
        cheque={rePresentCheque}
        open={!!rePresentCheque}
        onOpenChange={(o) => !o && setRePresentCheque(null)}
        onSuccess={fetchCheques}
      />

      <WriteOffDialog
        cheque={writeOffCheque}
        open={!!writeOffCheque}
        onOpenChange={(o) => !o && setWriteOffCheque(null)}
        onSuccess={fetchCheques}
      />
    </div>
  )
}
