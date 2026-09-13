import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import './ClaimsPage.css'

interface ClaimAction {
  action: string
  dueDate: string
  mandatory: boolean
}

interface Claim {
  id: string
  sellerId: string
  orderId: string
  type: 'med_pdd' | 'med_pnr' | 'return' | string
  stage: string
  status: string
  reason: string
  buyerId: string
  actions: ClaimAction[]
  dueDate?: string
  urgency?: 'critical' | 'warning' | 'safe'
  remainingHours?: number
  createdAt: string
}

type UrgencyFilter = 'all' | 'critical' | 'warning' | 'safe'

const TYPE_LABELS: Record<string, string> = {
  med_pdd: 'MED · No entregado',
  med_pnr: 'MED · No recibido',
  return:  'Devolución',
}

export default function ClaimsPage() {
  const [claims, setClaims]         = useState<Claim[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [urgency, setUrgency]       = useState<UrgencyFilter>('all')
  const [productTab, setProductTab] = useState('all')
  const [expanded, setExpanded]     = useState<string | null>(null)

  useEffect(() => { loadClaims() }, [])

  const loadClaims = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<{ claims: Claim[]; metrics?: unknown }>('/claims')
      setClaims(Array.isArray(data) ? data : (data.claims ?? []))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const ack = async (id: string) => {
    try {
      await api.post(`/claims/${id}/ack`)
      setClaims(cs => cs.map(c => c.id === id ? { ...c, status: 'acknowledged' } : c))
    } catch { /* silent */ }
  }

  const orders = Array.from(new Set(claims.map(c => c.orderId))).slice(0, 8)

  const filtered = claims.filter(c => {
    if (productTab !== 'all' && c.orderId !== productTab) return false
    if (urgency !== 'all' && c.urgency !== urgency) return false
    return true
  })

  const counts = {
    critical: claims.filter(c => c.urgency === 'critical').length,
    warning:  claims.filter(c => c.urgency === 'warning').length,
    safe:     claims.filter(c => c.urgency === 'safe').length,
  }

  return (
    <div className="page">
      <PageHeader
        title="Reclamos"
        subtitle="Post-venta · SLA activo"
        stats={[
          { label: 'Críticos',    value: counts.critical, color: counts.critical > 0 ? 'rose' : 'dim' },
          { label: 'Advertencia', value: counts.warning,  color: counts.warning  > 0 ? 'amber' : 'dim' },
          { label: 'Seguros',     value: counts.safe,     color: 'emerald' },
        ]}
      />

      {/* Order tabs */}
      {orders.length > 0 && (
        <div className="product-tabs">
          <button
            className={`product-tab${productTab === 'all' ? ' active' : ''}`}
            onClick={() => setProductTab('all')}
          >Todos</button>
          {orders.map(id => (
            <button
              key={id}
              className={`product-tab${productTab === id ? ' active' : ''}`}
              onClick={() => setProductTab(id)}
            >
              Orden #{id.slice(-6)}
            </button>
          ))}
        </div>
      )}

      {/* Urgency filter */}
      <div className="filter-tabs">
        {([
          ['all',      'Todos',       claims.length],
          ['critical', 'Críticos',    counts.critical],
          ['warning',  'Advertencia', counts.warning],
          ['safe',     'Seguros',     counts.safe],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            className={`filter-tab${urgency === key ? ' active' : ''}`}
            onClick={() => setUrgency(key)}
          >
            {label}
            <span className="filter-count">{count}</span>
          </button>
        ))}
      </div>

      <div className="claims-list">
        {loading && (
          <div className="list-empty">
            <span className="pulse-dot" /> Cargando reclamos…
          </div>
        )}
        {error && <div className="list-error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="list-empty">
            <span className="list-empty-icon">⚑</span>
            <p>No hay reclamos en esta categoría</p>
          </div>
        )}
        {filtered.map(c => (
          <ClaimCard
            key={c.id}
            claim={c}
            expanded={expanded === c.id}
            onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            onAck={() => ack(c.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ClaimCard({
  claim: c,
  expanded,
  onToggle,
  onAck,
}: {
  claim: Claim
  expanded: boolean
  onToggle: () => void
  onAck: () => void
}) {
  const urgency = c.urgency || 'safe'
  const hours   = c.remainingHours ?? 0
  const typeLabel = TYPE_LABELS[c.type] || c.type

  return (
    <div className={`claim-card glass claim-card--${urgency}${expanded ? ' claim-card--expanded' : ''}`}>
      <div className="claim-card-row" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}>

        {/* Urgency indicator */}
        <div className={`claim-urgency claim-urgency--${urgency}`}>
          <span className="claim-urgency-dot" />
          <span className="claim-urgency-label">
            {urgency === 'critical' ? 'CRÍTICO' : urgency === 'warning' ? 'ADVERTENCIA' : 'SEGURO'}
          </span>
        </div>

        {/* Type + reason */}
        <div className="claim-main">
          <div className="claim-type">{typeLabel}</div>
          <p className="claim-reason">{c.reason}</p>
        </div>

        {/* SLA timer */}
        {c.dueDate && (
          <div className={`claim-timer${urgency === 'critical' ? ' claim-timer--phosphor' : ''}`}>
            <span className="claim-timer-value tabular">
              {hours > 0 ? `${Math.round(hours)}h` : 'Vencido'}
            </span>
            <span className="claim-timer-label">restante</span>
          </div>
        )}

        <span className="claim-expand-icon">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="claim-detail">
          <div className="claim-detail-grid">
            <div>
              <span className="claim-detail-label">Orden</span>
              <span className="claim-detail-value tabular">#{c.orderId}</span>
            </div>
            <div>
              <span className="claim-detail-label">Reclamo</span>
              <span className="claim-detail-value tabular">#{c.id}</span>
            </div>
            <div>
              <span className="claim-detail-label">Comprador</span>
              <span className="claim-detail-value tabular">#{c.buyerId}</span>
            </div>
            <div>
              <span className="claim-detail-label">Etapa</span>
              <span className="claim-detail-value">{c.stage}</span>
            </div>
          </div>

          {c.actions.length > 0 && (
            <div className="claim-actions-list">
              <span className="claim-detail-label">Acciones requeridas</span>
              {c.actions.map((a, i) => (
                <div key={i} className="claim-action-item">
                  <span className={`claim-action-dot${a.mandatory ? ' mandatory' : ''}`} />
                  <span>{a.action}</span>
                  {a.dueDate && (
                    <span className="claim-action-due">
                      vence {new Date(a.dueDate).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {c.status !== 'acknowledged' && (
            <button className="btn-ack" onClick={onAck}>
              ✓ Marcar como visto
            </button>
          )}
        </div>
      )}
    </div>
  )
}
