import { ChequeList } from '@/components/cheques/ChequeList'
import { PageHeader } from '@/components/shared/PageHeader'

export default function Cheques() {
  return (
    <div>
      <PageHeader title="Cheques" />
      <ChequeList />
    </div>
  )
}
