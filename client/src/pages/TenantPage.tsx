import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

type Tab = 'preguntas' | 'reclamos' | 'configuracion'

interface Question {
  id: string
  text: string
  status: string
}

interface Claim {
  id: string
  orderId: string
  status: string
}

export default function TenantPage() {
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('preguntas')
  const [questions, setQuestions] = useState<Question[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (tab === 'preguntas') {
      setLoadingData(true)
      api.get<Question[]>('/questions').then(setQuestions).catch(console.error).finally(() => setLoadingData(false))
    } else if (tab === 'reclamos') {
      setLoadingData(true)
      api.get<Claim[]>('/claims').then(setClaims).catch(console.error).finally(() => setLoadingData(false))
    }
  }, [tab])

  const tabStyle = (t: Tab) => ({
    padding: '0.5rem 1rem',
    background: tab === t ? '#3b82f6' : '#1e293b',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  })

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Portal Tenant</h1>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button style={tabStyle('preguntas')} onClick={() => setTab('preguntas')}>Preguntas</button>
        <button style={tabStyle('reclamos')} onClick={() => setTab('reclamos')}>Reclamos</button>
        <button style={tabStyle('configuracion')} onClick={() => setTab('configuracion')}>Configuración</button>
      </div>

      {loadingData && <p style={{ color: '#64748b' }}>Cargando...</p>}

      {!loadingData && tab === 'preguntas' && (
        <div>
          {questions.length === 0 ? (
            <p style={{ color: '#64748b' }}>No hay preguntas pendientes.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {questions.map(q => (
                <li key={q.id} style={{ padding: '1rem', background: '#1e293b', borderRadius: '4px' }}>
                  <p>{q.text}</p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{q.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loadingData && tab === 'reclamos' && (
        <div>
          {claims.length === 0 ? (
            <p style={{ color: '#64748b' }}>No hay reclamos activos.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {claims.map(c => (
                <li key={c.id} style={{ padding: '1rem', background: '#1e293b', borderRadius: '4px' }}>
                  <p>Orden: {c.orderId}</p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'configuracion' && (
        <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '4px' }}>
          <p style={{ color: '#94a3b8' }}>Configuración del tenant — próximamente.</p>
        </div>
      )}
    </div>
  )
}
