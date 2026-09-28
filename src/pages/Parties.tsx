import { PartyList } from '@/components/parties/PartyList'
import { PageHeader } from '@/components/shared/PageHeader'

export default function Parties() {
  return (
    <div>
      <PageHeader title="Parties" />
      <PartyList />
    </div>
  )
}
