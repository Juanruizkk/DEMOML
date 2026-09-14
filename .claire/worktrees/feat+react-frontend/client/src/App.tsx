import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import DemoPage from './pages/DemoPage'
import TenantPage from './pages/TenantPage'
import AdminPage from './pages/AdminPage'
import OnboardingPage from './pages/OnboardingPage'

function PrivateRoute({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute(user.role)} replace /> : <LoginPage />} />
      <Route path="/demo" element={
        <PrivateRoute roles={['demo', 'super_admin']}>
          <DemoPage />
        </PrivateRoute>
      } />
      <Route path="/tenant" element={
        <PrivateRoute roles={['tenant', 'super_admin']}>
          <TenantPage />
        </PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute roles={['super_admin']}>
          <AdminPage />
        </PrivateRoute>
      } />
      <Route path="/onboarding" element={
        <PrivateRoute roles={['tenant', 'super_admin']}>
          <OnboardingPage />
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to={user ? defaultRoute(user.role) : '/login'} replace />} />
    </Routes>
  )
}

function defaultRoute(role: string): string {
  if (role === 'super_admin') return '/admin'
  if (role === 'demo') return '/demo'
  return '/tenant'
}
