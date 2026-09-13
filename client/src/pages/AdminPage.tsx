import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function AdminPage() {
  const { logout } = useAuth()
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/admin/metrics')
      .then(data => setMetrics(data as Record<string, unknown>))
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar métricas'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Super Admin</h1>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
      <h2 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Métricas globales</h2>
      {loading && <p style={{ color: '#64748b' }}>Cargando métricas...</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {metrics && (
        <pre style={{ background: '#1e293b', padding: '1rem', borderRadius: '4px', overflow: 'auto', fontSize: '0.875rem' }}>
          {JSON.stringify(metrics, null, 2)}
        </pre>
      )}
    </div>
  )
}
