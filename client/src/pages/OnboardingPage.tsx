import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

interface OnboardingStatus {
  completed: boolean
  steps?: string[]
}

export default function OnboardingPage() {
  const { logout } = useAuth()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<OnboardingStatus>('/auth/onboarding-status')
      .then(setStatus)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar estado'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Onboarding</h1>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
      {loading && <p style={{ color: '#64748b' }}>Cargando estado de onboarding...</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {status && (
        <div style={{ padding: '1.5rem', background: '#1e293b', borderRadius: '8px' }}>
          <p style={{ marginBottom: '1rem' }}>
            Estado:{' '}
            <strong style={{ color: status.completed ? '#86efac' : '#fbbf24' }}>
              {status.completed ? 'Completado' : 'Pendiente'}
            </strong>
          </p>
          {status.steps && status.steps.length > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {status.steps.map((step, i) => (
                <li key={i} style={{ padding: '0.5rem', background: '#0f172a', borderRadius: '4px', color: '#94a3b8' }}>{step}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
