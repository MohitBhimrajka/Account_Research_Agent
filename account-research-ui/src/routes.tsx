// FILE: account-research-ui/src/routes.tsx
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { lazy, Suspense } from 'react'

// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const WizardLayout = lazy(() => import('./pages/generate/WizardLayout')) // Corrected path
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-primary text-white">
    Loading...
  </div>
)

const Shell = () => (
  <AppShell>
    <Suspense fallback={<LoadingFallback />}>
      <Outlet />
    </Suspense>
  </AppShell>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        // Path for the wizard
        path: 'generate',
        element: <WizardLayout />,
      },
      {
        // Path for viewing task progress
        path: 'task/:id',
        element: <ProgressPage />,
      },
      {
        // Path for viewing the result of a completed task
        path: 'task/:id/result',
        element: <ResultPage />,
      },
      {
        // Path for viewing task history
        path: 'history',
        element: <HistoryPage />,
      },
      // Optional: Add a 404 page
      // {
      //   path: '*',
      //   element: <NotFoundPage />,
      // }
    ],
  },
])