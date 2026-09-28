import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChequeBulkUpload } from '@/components/cheques/BulkUpload'
import { ChequeDetail } from '@/components/cheques/ChequeDetail'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { AddFundsFlow } from '@/components/deposit/AddFundsFlow'
import { ReceivedChequeForm } from '@/components/received/ReceivedChequeForm'
import { DirectionSwitch, type ChequeDirection } from '@/components/shared/DirectionSwitch'
import { SearchPalette } from '@/components/shared/SearchPalette'
import { createGivenCheque, updateGivenCheque } from '@/lib/chequeWrites'
import { announceDataChange } from '@/lib/dataEvents'
import { AppActionsContext, type AppActions } from '@/hooks/useAppActions'
import { useSettings } from '@/hooks/useSettings'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

const DIRECTION_KEY = 'new-cheque-direction'

/** The direction the New cheque form opens on: the last one used on this device, else what you track. */
function lastDirection(fallback: ChequeDirection): ChequeDirection {
  try {
    const saved = localStorage.getItem(DIRECTION_KEY)
    return saved === 'given' || saved === 'received' ? saved : fallback
  } catch {
    return fallback
  }
}

function rememberDirection(direction: ChequeDirection) {
  try {
    localStorage.setItem(DIRECTION_KEY, direction)
  } catch {
    // Private browsing: it's forgotten when the page closes.
  }
}

/** Holds the dialogs that any page can open (see hooks/useAppActions.ts). */
export function AppActionsProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const tracks = settings.tracks ?? 'both'
  const [form, setForm] = useState<{ open: boolean; cheque: Cheque | null; replacing?: Cheque }>({ open: false, cheque: null })
  const [received, setReceived] = useState<{ open: boolean; cheque: ReceivedCheque | null; series?: boolean }>({ open: false, cheque: null })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [funds, setFunds] = useState<{ open: boolean; amount?: number }>({ open: false })
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])

  // Ctrl K (or ⌘K) opens search from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Opens an empty form for a new cheque in this direction, closing the other one. */
  const openNew = useCallback((direction: ChequeDirection, series = false) => {
    rememberDirection(direction)
    if (direction === 'given') {
      setReceived({ open: false, cheque: null })
      setForm({ open: true, cheque: null })
    } else {
      setForm({ open: false, cheque: null })
      setReceived({ open: true, cheque: null, series })
    }
  }, [])

  const directionSwitch = (direction: ChequeDirection) => <DirectionSwitch value={direction} onChange={(next) => openNew(next)} />

  const actions = useMemo<AppActions>(
    () => ({
      newCheque: (direction) => openNew(direction ?? lastDirection(tracks === 'received' ? 'received' : 'given')),
      newGivenCheque: () => openNew('given'),
      newReceivedCheque: () => openNew('received'),
      newSeries: () => openNew('received', true),
      editReceivedCheque: (cheque) => setReceived({ open: true, cheque }),
      editCheque: (cheque) => {
        setDetailId(null)
        setForm({ open: true, cheque })
      },
      replaceCheque: (cheque) => {
        setDetailId(null)
        setForm({ open: true, cheque: null, replacing: cheque })
      },
      addFunds: (amount) => setFunds({ open: true, amount }),
      importCheques: () => setImportOpen(true),
      openSearch,
      openCheque: (id) => {
        setSearchOpen(false)
        setDetailId(id)
      },
      depositReceived: () => toast.info('Received cheques get their own screens in the next part of the redesign.'),
      openReceivedCheque: () => toast.info('Received cheques get their own screens in the next part of the redesign.'),
    }),
    [openSearch, openNew, tracks]
  )

  return (
    <AppActionsContext.Provider value={actions}>
      {children}

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <ChequeForm
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false, cheque: null })}
        cheque={form.cheque}
        replacing={form.replacing}
        directionSwitch={form.replacing ? undefined : directionSwitch('given')}
        prefill={
          form.replacing
            ? {
                party_id: form.replacing.party_id,
                bank_name: form.replacing.bank_name,
                amount: Number(form.replacing.amount),
                cheque_number: '',
              }
            : undefined
        }
        onSubmit={async (data) => {
          const { error } = form.cheque
            ? await updateGivenCheque(form.cheque.id, data)
            : await createGivenCheque({ ...data, replaces_cheque_id: form.replacing?.id })
          if (error) {
            toast.error(`Couldn't save the cheque: ${error}`)
            return false
          }
          toast.success(form.cheque ? 'Cheque updated' : form.replacing ? 'New cheque added in its place' : 'Cheque added')
        }}
        onStatusChange={announceDataChange}
      />

      <ChequeDetail
        chequeId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={(cheque) => {
          setDetailId(null)
          setForm({ open: true, cheque })
        }}
        onRefresh={announceDataChange}
      />

      <ChequeBulkUpload open={importOpen} onOpenChange={setImportOpen} onComplete={announceDataChange} />

      <ReceivedChequeForm
        open={received.open}
        onOpenChange={(open) => !open && setReceived({ open: false, cheque: null })}
        cheque={received.cheque}
        asSeries={received.series}
        directionSwitch={directionSwitch('received')}
      />

      <AddFundsFlow
        open={funds.open}
        amount={funds.amount}
        onOpenChange={(open) => setFunds((current) => ({ ...current, open }))}
      />
    </AppActionsContext.Provider>
  )
}
