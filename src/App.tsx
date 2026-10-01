import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/shared/Layout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { SettingsProvider } from '@/components/shared/SettingsProvider'
import Login from '@/pages/Login'
import Today from '@/pages/Today'

// Pages load the first time they're opened, so the app starts faster on
// phones (plan item 69). Today is the first page, so it comes with the app.
const loadCheques = () => import('@/pages/Cheques')
const loadParties = () => import('@/pages/PartiesPage')
const Cheques = lazy(loadCheques)
const PartiesPage = lazy(loadParties)
const Reports = lazy(() => import('@/pages/Reports'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const BulkAdd = lazy(() => import('@/pages/BulkAdd'))
const CalendarPage = lazy(() => import('@/pages/Calendar'))
const Learn = lazy(() => import('@/pages/Learn'))

/** Shown in the frame while a page loads. */
function PageLoading() {
  return (
    <p role="status" className="py-16 text-center text-ink-quiet">
      Loading…
    </p>
  )
}

/**
 * Once the app is showing, fetch the pages behind the bottom tabs in the
 * background, so opening them doesn't wait.
 */
function PrefetchTabs() {
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCheques()
      void loadParties()
    }, 2500)
    return () => clearTimeout(timer)
  }, [])
  return null
}

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
                <PrefetchTabs />
                <Suspense fallback={<PageLoading />}>
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
                </Suspense>
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
