import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChequeBulkUpload } from '@/components/cheques/BulkUpload'
import { ChequeDetail } from '@/components/cheques/ChequeDetail'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { NotesDialog, type NotesTarget } from '@/components/cheques/NotesDialog'
import { AddFundsFlow } from '@/components/deposit/AddFundsFlow'
import { HelpSheet } from '@/components/guide/HelpSheet'
import { DepositDialog } from '@/components/received/DepositDialog'
import { ReceivedActionDialog, type ReceivedActionMode } from '@/components/received/ReceivedActionDialog'
import { ReceivedChequeDetail } from '@/components/received/ReceivedChequeDetail'
import { ReceivedChequeForm } from '@/components/received/ReceivedChequeForm'
import { DirectionSwitch, type ChequeDirection } from '@/components/shared/DirectionSwitch'
import { SearchPalette } from '@/components/shared/SearchPalette'
import { createGivenCheque, updateGivenCheque } from '@/lib/chequeWrites'
import { announceDataChange } from '@/lib/dataEvents'
import { AppActionsContext, type AppActions } from '@/hooks/useAppActions'
import { usePlan } from '@/hooks/usePlan'
import { useSettings } from '@/hooks/useSettings'
import type { GuideTopicId } from '@/lib/guide'
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

/** Who a cheque is with and its number, for the notes dialog's title. */
function notesLabel(cheque: { cheque_number: string; party?: { name: string } | null }): string {
  return cheque.party?.name ? `${cheque.party.name}, cheque ${cheque.cheque_number}` : `Cheque ${cheque.cheque_number}`
}

/** Holds the dialogs that any page can open (see hooks/useAppActions.ts). */
export function AppActionsProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const { guard, lapsed } = usePlan()
  const tracks = settings.tracks ?? 'both'
  const [form, setForm] = useState<{ open: boolean; cheque: Cheque | null; replacing?: Cheque }>({ open: false, cheque: null })
  const [received, setReceived] = useState<{ open: boolean; cheque: ReceivedCheque | null; series?: boolean }>({ open: false, cheque: null })
  /** The party a new cheque starts with, when added from a party's page. */
  const [newParty, setNewParty] = useState<string | undefined>()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [receivedId, setReceivedId] = useState<string | null>(null)
  const [depositIds, setDepositIds] = useState<string[] | null>(null)
  const [receivedAction, setReceivedAction] = useState<{ mode: ReceivedActionMode; cheque: ReceivedCheque } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [funds, setFunds] = useState<{ open: boolean; amount?: number }>({ open: false })
  const [searchOpen, setSearchOpen] = useState(false)
  // On the Free plan, Edit changes the notes only.
  const [notesFor, setNotesFor] = useState<NotesTarget | null>(null)
  const [helpTopic, setHelpTopic] = useState<GuideTopicId | null>(null)
  const closeHelp = useCallback(() => setHelpTopic(null), [])

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
  const openNew = useCallback((direction: ChequeDirection, series = false, partyId?: string) => {
    rememberDirection(direction)
    if (partyId !== undefined) setNewParty(partyId)
    if (direction === 'given') {
      setReceived({ open: false, cheque: null })
      setForm({ open: true, cheque: null })
    } else {
      setForm({ open: false, cheque: null })
      setReceived({ open: true, cheque: null, series })
    }
  }, [])

  const directionSwitch = (direction: ChequeDirection) => <DirectionSwitch value={direction} onChange={(next) => openNew(next, false, newParty)} />

  // On the Free plan (plan item 55), adding and replacing explain why they can't,
  // Edit changes the notes only, and moving cheques along stays open.
  const actions = useMemo<AppActions>(
    () => ({
      newCheque: guard((direction, partyId) =>
        openNew(direction ?? lastDirection(tracks === 'received' ? 'received' : 'given'), false, partyId ?? '')
      ),
      newGivenCheque: guard((partyId) => openNew('given', false, partyId ?? '')),
      newReceivedCheque: guard((partyId) => openNew('received', false, partyId ?? '')),
      newSeries: guard((partyId) => openNew('received', true, partyId ?? '')),
      editReceivedCheque: (cheque) =>
        lapsed
          ? setNotesFor({ table: 'received_cheques', id: cheque.id, notes: cheque.notes, label: notesLabel(cheque) })
          : setReceived({ open: true, cheque }),
      editCheque: (cheque) => {
        setDetailId(null)
        if (lapsed) setNotesFor({ table: 'cheques', id: cheque.id, notes: cheque.notes, label: notesLabel(cheque) })
        else setForm({ open: true, cheque })
      },
      replaceCheque: guard((cheque) => {
        setDetailId(null)
        setForm({ open: true, cheque: null, replacing: cheque })
      }),
      addFunds: (amount) => setFunds({ open: true, amount }),
      importCheques: guard(() => setImportOpen(true)),
      openSearch,
      openHelp: (topic) => {
        setSearchOpen(false)
        setHelpTopic(topic)
      },
      openCheque: (id) => {
        setSearchOpen(false)
        setDetailId(id)
      },
      depositReceived: (ids) => {
        setReceivedId(null)
        setDepositIds(ids)
      },
      openReceivedCheque: (id) => {
        setSearchOpen(false)
        setReceivedId(id)
      },
      actOnReceived: (mode, cheque) =>
        mode === 'replace' ? guard(() => setReceivedAction({ mode, cheque }))() : setReceivedAction({ mode, cheque }),
    }),
    [guard, lapsed, openSearch, openNew, tracks]
  )

  return (
    <AppActionsContext.Provider value={actions}>
      {children}

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <HelpSheet topic={helpTopic} onClose={closeHelp} />

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
                bank_account_id: form.replacing.bank_account_id ?? null,
                amount: Number(form.replacing.amount),
                cheque_number: '',
              }
            : newParty
              ? { party_id: newParty }
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
        onEdit={actions.editCheque}
        onRefresh={announceDataChange}
      />

      <ChequeBulkUpload open={importOpen} onOpenChange={setImportOpen} onComplete={announceDataChange} />

      <ReceivedChequeForm
        open={received.open}
        onOpenChange={(open) => !open && setReceived({ open: false, cheque: null })}
        cheque={received.cheque}
        asSeries={received.series}
        partyId={newParty || undefined}
        directionSwitch={directionSwitch('received')}
      />

      <ReceivedChequeDetail chequeId={receivedId} onClose={() => setReceivedId(null)} onDeposit={(ids) => setDepositIds(ids)} />

      <DepositDialog ids={depositIds} onClose={() => setDepositIds(null)} />

      <ReceivedActionDialog
        mode={receivedAction?.mode ?? null}
        cheque={receivedAction?.cheque ?? null}
        onClose={() => setReceivedAction(null)}
      />

      <NotesDialog target={notesFor} onClose={() => setNotesFor(null)} />

      <AddFundsFlow
        open={funds.open}
        amount={funds.amount}
        onOpenChange={(open) => setFunds((current) => ({ ...current, open }))}
      />
    </AppActionsContext.Provider>
  )
}
