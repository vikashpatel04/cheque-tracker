import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/shared/Layout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { SettingsProvider } from '@/components/shared/SettingsProvider'
import Login from '@/pages/Login'
import Today from '@/pages/Today'
import Cheques from '@/pages/Cheques'
import PartiesPage from '@/pages/PartiesPage'
import Reports from '@/pages/Reports'
import SettingsPage from '@/pages/Settings'
import BulkAdd from '@/pages/BulkAdd'
import CalendarPage from '@/pages/Calendar'
import Learn from '@/pages/Learn'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SettingsProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<Today />} />
                  <Route path="/cheques" element={<Cheques />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/bulk-add" element={<BulkAdd />} />
                  <Route path="/parties/:partyId/bulk-add" element={<BulkAdd />} />
                  <Route path="/parties/*" element={<PartiesPage />} />
                  <Route path="/returned" element={<Navigate to="/cheques?dir=given&view=returned" replace />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/learn" element={<Learn />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </SettingsProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  )
}
