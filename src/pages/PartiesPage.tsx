import { Routes, Route } from 'react-router-dom'
import Parties from './Parties'
import PartyLedger from './PartyLedger'

export default function PartiesPage() {
  return (
    <Routes>
      <Route index element={<Parties />} />
      <Route path=":id" element={<PartyLedger />} />
    </Routes>
  )
}
