import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function DemoPage() {
  const { user, logout } = useAuth()
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMsg(null)
    try {
      const res = await api.post<{ message: string }>('/demo/seed')
      setSeedMsg(res.message ?? 'Demo preparada correctamente')
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : 'Error al preparar demo')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Demo Dashboard</h1>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Seller ID: {user?.sellerId ?? '—'}</p>
      <button
        onClick={handleSeed}
        disabled={seeding}
        style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.7 : 1 }}
      >
        {seeding ? 'Preparando...' : 'Preparar Demo'}
      </button>
      {seedMsg && (
        <p style={{ marginTop: '1rem', color: '#86efac', background: '#0a1f0a', padding: '0.75rem', borderRadius: '4px' }}>{seedMsg}</p>
      )}
    </div>
  )
}
