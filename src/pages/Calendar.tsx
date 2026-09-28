import { ChequeCalendar } from '@/components/shared/ChequeCalendar'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAppActions } from '@/hooks/useAppActions'
import { useCheques } from '@/hooks/useCheques'

/** Every cheque on its due date, by month or as a list. Redesigned in plan item 14, step 5. */
export default function CalendarPage() {
  const { cheques } = useCheques()
  const { openCheque } = useAppActions()
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Cheques by the date they're due" />
      <ChequeCalendar cheques={cheques} onSelectCheque={openCheque} title="Due dates" height={640} />
    </div>
  )
}
