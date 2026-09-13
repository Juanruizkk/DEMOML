import { ReactElement, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'

const QuestionsPage   = lazy(() => import('./pages/QuestionsPage'))
const ClaimsPage      = lazy(() => import('./pages/ClaimsPage'))
const AdminPage       = lazy(() => import('./pages/AdminPage'))
const TenantPage      = lazy(() => import('./pages/TenantPage'))
const OnboardingPage  = lazy(() => import('./pages/OnboardingPage'))
const DemoPage        = lazy(() => import('./pages/DemoPage'))

function PrivateRoute({ children, roles }: { children: ReactElement; roles: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoading />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={defaultRoute(user.role)} replace />
  return children
}

function PageLoading() {
  return (
    <Layout>
      <div className="loading-screen">
        <span className="pulse-dot" />
        Cargando…
      </div>
    </Layout>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="pulse-dot" />
        Cargando…
      </div>
    )
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to={defaultRoute(user.role)} replace /> : <LoginPage />}
        />

        {/* Tenant + demo */}
        <Route path="/questions" element={
          <PrivateRoute roles={['tenant', 'super_admin', 'demo']}>
            <Layout><QuestionsPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/claims" element={
          <PrivateRoute roles={['tenant', 'super_admin', 'demo']}>
            <Layout><ClaimsPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute roles={['tenant', 'super_admin']}>
            <Layout><TenantPage tab="settings" /></Layout>
          </PrivateRoute>
        } />
        <Route path="/channels" element={
          <PrivateRoute roles={['tenant', 'super_admin']}>
            <Layout><TenantPage tab="channels" /></Layout>
          </PrivateRoute>
        } />
        <Route path="/connection" element={
          <PrivateRoute roles={['tenant', 'super_admin']}>
            <Layout><TenantPage tab="connection" /></Layout>
          </PrivateRoute>
        } />
        <Route path="/onboarding" element={
          <PrivateRoute roles={['tenant', 'super_admin']}>
            <Layout><OnboardingPage /></Layout>
          </PrivateRoute>
        } />

        {/* Demo */}
        <Route path="/demo" element={
          <PrivateRoute roles={['demo', 'super_admin']}>
            <Layout><DemoPage /></Layout>
          </PrivateRoute>
        } />

        {/* Super admin */}
        <Route path="/admin" element={
          <PrivateRoute roles={['super_admin']}>
            <Layout><AdminPage /></Layout>
          </PrivateRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={
          <Navigate to={user ? defaultRoute(user.role) : '/login'} replace />
        } />
      </Routes>
    </Suspense>
  )
}

function defaultRoute(role: string): string {
  if (role === 'super_admin') return '/admin'
  if (role === 'demo')        return '/questions'
  return '/questions'
}
