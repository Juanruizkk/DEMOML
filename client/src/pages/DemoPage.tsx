import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import './DemoPage.css'

export default function DemoPage() {
  const { user } = useAuth()
  const [seeding, setSeeding]   = useState(false)
  const [seedMsg, setSeedMsg]   = useState<string | null>(null)
  const [isError, setIsError]   = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMsg(null)
    setIsError(false)
    try {
      const res = await api.post<{ message: string }>('/demo/seed')
      setSeedMsg(res.message ?? 'Demo preparada correctamente')
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : 'Error al preparar demo')
      setIsError(true)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Demo"
        subtitle="Panel de demostración"
        stats={[
          { label: 'Seller ID', value: user?.sellerId ?? '—', color: 'dim' },
        ]}
      />
      <div className="demo-content">
        <div className="demo-card glass">
          <div className="demo-card-header">
            <span className="demo-icon">◉</span>
            <div>
              <p className="demo-card-title">Preparar datos de demostración</p>
              <p className="demo-card-hint">Carga preguntas y reclamos de ejemplo para recorrer el flujo completo.</p>
            </div>
          </div>
          <button className="btn-seed" onClick={handleSeed} disabled={seeding}>
            {seeding ? (
              <><span className="pulse-dot" /> Preparando…</>
            ) : (
              'Preparar Demo'
            )}
          </button>
          {seedMsg && (
            <p className={`seed-msg${isError ? ' seed-msg--error' : ''}`}>{seedMsg}</p>
          )}
        </div>

        <div className="demo-nav-hint glass">
          <p className="demo-nav-hint-title">Flujo recomendado</p>
          <ol className="demo-steps">
            <li>Preparar Demo arriba</li>
            <li>Ir a <strong>Preguntas</strong> para ver respuestas IA pendientes</li>
            <li>Aprobar o rechazar respuestas</li>
            <li>Ir a <strong>Reclamos</strong> para ver el panel post-venta</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
