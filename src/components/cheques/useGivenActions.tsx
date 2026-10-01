import { useState } from 'react'
import { PresentAgainDialog } from '@/components/cheques/PresentAgainDialog'
import { useRollbackAction } from '@/components/cheques/RollbackDialog'
import { useChequeStatusActions } from '@/components/cheques/StatusActions'
import { WriteOffDialog } from '@/components/cheques/WriteOffDialog'
import { useAppActions } from '@/hooks/useAppActions'
import { usePlan } from '@/hooks/usePlan'
import { announceDataChange } from '@/lib/dataEvents'
import type { Cheque, ChequeStatus } from '@/types'

export interface GivenActions {
  setStatus: (cheque: Cheque, status: ChequeStatus) => void
  /** Funded, then passed, both kept in the history. */
  fundAndPass: (cheque: Cheque) => void
  represent: (cheque: Cheque) => void
  writeOff: (cheque: Cheque) => void
  undo: (cheque: Cheque) => void
  edit: (cheque: Cheque) => void
  open: (cheque: Cheque) => void
}

/**
 * Everything a given cheque's row menu or swipe can do, with the dialogs it
 * needs (return reason, undo, present again, write off). Render `dialogs`
 * once, next to the list.
 */
export function useGivenActions() {
  const app = useAppActions()
  const { guard } = usePlan()
  const status = useChequeStatusActions(announceDataChange)
  const rollback = useRollbackAction(announceDataChange)
  const [representing, setRepresenting] = useState<Cheque | null>(null)
  const [writingOff, setWritingOff] = useState<Cheque | null>(null)

  const actions: GivenActions = {
    setStatus: status.requestStatus,
    fundAndPass: status.requestChained,
    represent: guard(setRepresenting),
    writeOff: guard(setWritingOff),
    undo: rollback.requestRollback,
    edit: app.editCheque,
    open: (cheque) => app.openCheque(cheque.id),
  }

  const dialogs = (
    <>
      {status.returnDialog}
      {rollback.rollbackDialog}
      <PresentAgainDialog
        cheque={representing}
        open={!!representing}
        onOpenChange={(open) => !open && setRepresenting(null)}
        onSuccess={announceDataChange}
      />
      <WriteOffDialog
        cheque={writingOff}
        open={!!writingOff}
        onOpenChange={(open) => !open && setWritingOff(null)}
        onSuccess={announceDataChange}
      />
    </>
  )

  return { actions, dialogs, busy: status.submitting }
}
