import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChequeBulkUpload } from '@/components/cheques/BulkUpload'
import { ChequeDetail } from '@/components/cheques/ChequeDetail'
import { ChequeForm } from '@/components/cheques/ChequeForm'
import { AddFundsFlow } from '@/components/deposit/AddFundsFlow'
import { SearchPalette } from '@/components/shared/SearchPalette'
import { createGivenCheque, updateGivenCheque } from '@/lib/chequeWrites'
import { announceDataChange } from '@/lib/dataEvents'
import { AppActionsContext, type AppActions } from '@/hooks/useAppActions'
import type { Cheque } from '@/types'

/** Holds the dialogs that any page can open (see hooks/useAppActions.ts). */
export function AppActionsProvider({ children }: { children: React.ReactNode }) {
  const [form, setForm] = useState<{ open: boolean; cheque: Cheque | null }>({ open: false, cheque: null })
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

  const actions = useMemo<AppActions>(
    () => ({
      newGivenCheque: () => setForm({ open: true, cheque: null }),
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
    [openSearch]
  )

  return (
    <AppActionsContext.Provider value={actions}>
      {children}

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <ChequeForm
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false, cheque: null })}
        cheque={form.cheque}
        onSubmit={async (data) => {
          const { error } = form.cheque ? await updateGivenCheque(form.cheque.id, data) : await createGivenCheque(data)
          if (error) {
            toast.error(`Couldn't save the cheque: ${error}`)
            return false
          }
          toast.success(form.cheque ? 'Cheque updated' : 'Cheque added')
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

      <AddFundsFlow
        open={funds.open}
        amount={funds.amount}
        onOpenChange={(open) => setFunds((current) => ({ ...current, open }))}
      />
    </AppActionsContext.Provider>
  )
}
