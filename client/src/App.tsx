import { ReactElement, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'

const DashboardPage   = lazy(() => import('./pages/DashboardPage'))
const QuestionsPage   = lazy(() => import('./pages/QuestionsPage'))
const OrderMessagesPage = lazy(() => import('./pages/OrderMessagesPage'))
const ClaimsPage      = lazy(() => import('./pages/ClaimsPage'))
const ProductsPage    = lazy(() => import('./pages/ProductsPage'))
const AdminPage       = lazy(() => import('./pages/AdminPage'))
const TenantPage      = lazy(() => import('./pages/TenantPage'))
const OnboardingPage  = lazy(() => import('./pages/OnboardingPage'))
const DemoPage        = lazy(() => import('./pages/DemoPage'))
const ActivatePage    = lazy(() => import('./pages/ActivatePage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))

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
    <NotificationProvider>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to={defaultRoute(user.role)} replace /> : <LoginPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Tenant + demo */}
        <Route path="/dashboard" element={
          <PrivateRoute roles={['tenant', 'demo']}>
            <Layout><DashboardPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/questions" element={
          <PrivateRoute roles={['tenant', 'demo']}>
            <Layout><QuestionsPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/order-messages" element={
          <PrivateRoute roles={['tenant', 'demo']}>
            <Layout><OrderMessagesPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/claims" element={
          <PrivateRoute roles={['tenant', 'demo']}>
            <Layout><ClaimsPage /></Layout>
          </PrivateRoute>
        } />

        <Route path="/products" element={
          <PrivateRoute roles={['tenant', 'demo']}>
            <Layout><ProductsPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/config" element={
          <PrivateRoute roles={['tenant']}>
            <Layout><TenantPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/settings"   element={<Navigate to="/config?tab=settings"   replace />} />
        <Route path="/team"       element={<Navigate to="/config?tab=team"       replace />} />
        <Route path="/channels"   element={<Navigate to="/config?tab=channels"   replace />} />
        <Route path="/connection" element={<Navigate to="/config?tab=connection" replace />} />
        <Route path="/onboarding" element={
          <PrivateRoute roles={['tenant']}>
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

        {/* Activation — public, no auth required */}
        <Route path="/activate/:token" element={<ActivatePage />} />

        {/* Catch-all */}
        <Route path="*" element={
          <Navigate to={user ? defaultRoute(user.role) : '/login'} replace />
        } />
      </Routes>
    </Suspense>
    </NotificationProvider>
  )
}

function defaultRoute(role: string): string {
  if (role === 'super_admin') return '/admin'
  if (role === 'demo')        return '/demo'
  return '/dashboard'
}
