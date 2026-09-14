import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import PaginationControls from '../components/PaginationControls'
import {
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Check,
  RotateCcw,
  MessageSquare,
  DollarSign,
  Package,
  Scale,
  ExternalLink,
  Info,
  Layers,
  Eye,
  BellRing,
  CheckCheck,
  RefreshCw,
  X,
  HelpCircle
} from 'lucide-react'
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
  notifiedAt?: string | null
  createdAt: string
}

type StatusTab = 'pending_action' | 'acknowledged' | 'closed' | 'all'
type UrgencyFilter = 'all' | 'critical' | 'warning' | 'safe'

interface ConfirmDialogState {
  isOpen: boolean
  claimId: string
  actionType: 'ack' | 'unack' | 'close' | 'reopen'
  title: string
  message: string
  confirmButtonText: string
  confirmVariant: 'primary' | 'emerald' | 'amber'
  icon: any
}

const TYPE_LABELS: Record<string, string> = {
  med_pdd: 'MED · Producto defectuoso / No funciona',
  med_pnr: 'MED · Paquete no recibido',
  return:  'Devolución exprés',
}

function formatStage(stage: string): string {
  switch (stage?.toLowerCase()) {
    case 'claim':
      return '💬 Negociación directa (Comprador vs Vendedor)'
    case 'dispute':
      return '⚖️ Mediación activa de Mercado Libre'
    case 'closed':
      return '✓ Reclamo cerrado / finalizado'
    default:
      return stage || 'En curso'
  }
}

function formatReason(reason: string): string {
  if (!reason) return 'Sin motivo especificado'
  if (reason.startsWith('PDD')) {
    return `${reason} · Producto defectuoso / No funciona según lo esperado`
  }
  if (reason.startsWith('PNR')) {
    return `${reason} · Paquete demorado o no recibido por el comprador`
  }
  return reason
}

interface ActionMeta {
  title: string
  description: string
  icon: any
  typeClass: 'message' | 'refund' | 'return' | 'evidence' | 'dispute'
}

function getActionMeta(actionKey: string): ActionMeta {
  const key = (actionKey || '').toLowerCase()
  if (key.includes('message') || key.includes('complainant') || key.includes('contact')) {
    return {
      title: 'Enviar mensaje al comprador',
      description: 'Iniciar conversación directa para aclarar dudas o acordar una solución antes de que intervenga Mercado Libre.',
      icon: MessageSquare,
      typeClass: 'message',
    }
  }
  if (key.includes('refund') || key.includes('reembolso')) {
    return {
      title: 'Emitir reembolso al comprador',
      description: 'Devolver el importe total de la compra al cliente y dar por cerrado el reclamo.',
      icon: DollarSign,
      typeClass: 'refund',
    }
  }
  if (key.includes('return') || key.includes('devolucion')) {
    return {
      title: 'Aceptar devolución del producto',
      description: 'Mercado Libre generará la etiqueta de retorno para que el comprador envíe el producto de vuelta.',
      icon: Package,
      typeClass: 'return',
    }
  }
  if (key.includes('attachment') || key.includes('evidence') || key.includes('comprobante') || key.includes('prueba')) {
    return {
      title: 'Adjuntar comprobantes y pruebas',
      description: 'Subir remitos oficiales, fotos del embalaje o facturas de respaldo a la plataforma.',
      icon: FileText,
      typeClass: 'evidence',
    }
  }
  if (key.includes('respond') || key.includes('dispute') || key.includes('claim')) {
    return {
      title: 'Responder a la mediación de Mercado Libre',
      description: 'Presentar tu descargo formal ante el equipo de representantes y resoluciones de Mercado Libre.',
      icon: Scale,
      typeClass: 'dispute',
    }
  }
  return {
    title: actionKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    description: 'Acción requerida dentro del panel de resoluciones de Mercado Libre.',
    icon: Info,
    typeClass: 'message',
  }
}

export default function ClaimsPage() {
  const [claims, setClaims]         = useState<Claim[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [statusTab, setStatusTab]   = useState<StatusTab>('pending_action')
  const [urgency, setUrgency]       = useState<UrgencyFilter>('all')
  const [orderTab, setOrderTab]     = useState('all')
  const [page, setPage]             = useState(1)
  const [limit, setLimit]           = useState(10)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actioningId, setActioningId]   = useState<string | null>(null)

  // Confirmation Alert Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    claimId: '',
    actionType: 'ack',
    title: '',
    message: '',
    confirmButtonText: '',
    confirmVariant: 'primary',
    icon: HelpCircle,
  })

  useEffect(() => { loadClaims() }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadClaims = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<{ claims: Claim[]; metrics?: unknown }>('/claims')
      setClaims(Array.isArray(data) ? data : (data.claims ?? []))
    } catch (err: any) {
      setError(err.message || 'Error al cargar reclamos')
    } finally {
      setLoading(false)
    }
  }

  // Action: Mark as in management
  const handleAck = async (id: string) => {
    setActioningId(id)
    try {
      await api.post(`/claims/${id}/ack`)
      setClaims(cs => cs.map(c => c.id === id ? { ...c, notifiedAt: new Date().toISOString(), status: 'opened' } : c))
      showToast(`✓ Reclamo #${id.slice(-6)} pasado a 'En Gestión'`)
    } catch (err: any) {
      showToast(`Error al confirmar reclamo: ${err.message}`)
    } finally {
      setActioningId(null)
    }
  }

  // Action: Return back to pending
  const handleUnack = async (id: string) => {
    setActioningId(id)
    try {
      await api.post(`/claims/${id}/unack`)
      setClaims(cs => cs.map(c => c.id === id ? { ...c, notifiedAt: null, status: 'opened' } : c))
      showToast(`↩ Reclamo #${id.slice(-6)} devuelto a 'Pendientes de Atención'`)
    } catch (err: any) {
      showToast(`Error al mover a pendientes: ${err.message}`)
    } finally {
      setActioningId(null)
    }
  }

  // Action: Mark as resolved / closed
  const handleClose = async (id: string) => {
    setActioningId(id)
    try {
      await api.post(`/claims/${id}/close`)
      setClaims(cs => cs.map(c => c.id === id ? { ...c, status: 'closed', stage: 'closed' } : c))
      showToast(`🟢 Reclamo #${id.slice(-6)} marcado como resuelto y cerrado`)
    } catch (err: any) {
      showToast(`Error al cerrar reclamo: ${err.message}`)
    } finally {
      setActioningId(null)
    }
  }

  // Action: Reopen a closed claim
  const handleReopen = async (id: string) => {
    setActioningId(id)
    try {
      await api.post(`/claims/${id}/reopen`)
      setClaims(cs => cs.map(c => c.id === id ? { ...c, status: 'opened', stage: 'claim', notifiedAt: new Date().toISOString() } : c))
      showToast(`🔄 Reclamo #${id.slice(-6)} reabierto y activo en 'En Gestión'`)
    } catch (err: any) {
      showToast(`Error al reabrir reclamo: ${err.message}`)
    } finally {
      setActioningId(null)
    }
  }

  // Prompt Confirmation Helpers
  const requestConfirm = (
    claimId: string,
    actionType: 'ack' | 'unack' | 'close' | 'reopen',
    title: string,
    message: string,
    confirmButtonText: string,
    confirmVariant: 'primary' | 'emerald' | 'amber',
    icon: any
  ) => {
    setConfirmDialog({
      isOpen: true,
      claimId,
      actionType,
      title,
      message,
      confirmButtonText,
      confirmVariant,
      icon,
    })
  }

  const executeConfirmAction = async () => {
    const { claimId, actionType } = confirmDialog
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    if (!claimId) return

    if (actionType === 'ack') {
      await handleAck(claimId)
    } else if (actionType === 'unack') {
      await handleUnack(claimId)
    } else if (actionType === 'close') {
      await handleClose(claimId)
    } else if (actionType === 'reopen') {
      await handleReopen(claimId)
    }
  }

  const handleStatusTabChange = (tab: StatusTab) => {
    setStatusTab(tab)
    setPage(1)
  }

  const handleUrgencyChange = (u: UrgencyFilter) => {
    setUrgency(u)
    setPage(1)
  }

  const handleOrderTabChange = (tab: string) => {
    setOrderTab(tab)
    setPage(1)
  }

  const orders = Array.from(new Set(claims.map(c => c.orderId))).slice(0, 8)

  // Status counts
  const pendingActionCount = claims.filter(c => c.status === 'opened' && !c.notifiedAt).length
  const acknowledgedCount  = claims.filter(c => c.status === 'opened' && !!c.notifiedAt).length
  const closedCount        = claims.filter(c => c.status === 'closed').length

  const filtered = claims.filter(c => {
    if (orderTab !== 'all' && c.orderId !== orderTab) return false
    
    // Status tab filter
    if (statusTab === 'pending_action') {
      if (c.status !== 'opened' || !!c.notifiedAt) return false
    } else if (statusTab === 'acknowledged') {
      if (c.status !== 'opened' || !c.notifiedAt) return false
    } else if (statusTab === 'closed') {
      if (c.status !== 'closed') return false
    }

    // Urgency filter
    if (urgency !== 'all' && c.urgency !== urgency) return false

    return true
  })

  // Urgency counts for current status tab
  const statusTabItems = claims.filter(c => {
    if (statusTab === 'pending_action') return c.status === 'opened' && !c.notifiedAt
    if (statusTab === 'acknowledged') return c.status === 'opened' && !!c.notifiedAt
    if (statusTab === 'closed') return c.status === 'closed'
    return true
  })

  const counts = {
    critical: statusTabItems.filter(c => c.urgency === 'critical').length,
    warning:  statusTabItems.filter(c => c.urgency === 'warning').length,
    safe:     statusTabItems.filter(c => c.urgency === 'safe').length,
  }

  const ConfirmIcon = confirmDialog.icon

  return (
    <div className="page-container">
      <PageHeader
        title="Gestión de Reclamos & Post-Venta"
        subtitle="Monitoreo de SLA y flujo de atención para proteger tu reputación en Mercado Libre"
        stats={[
          {
            label: 'Pendientes de Revisión',
            value: pendingActionCount,
            color: pendingActionCount > 0 ? 'rose' : 'dim',
          },
          {
            label: 'En Gestión / Vistos',
            value: acknowledgedCount,
            color: 'blue',
          },
          {
            label: 'Cerrados / Resueltos',
            value: closedCount,
            color: 'emerald',
          },
        ]}
      />

      <div className="claims-body">
        {/* Toast alert */}
        {toastMessage && (
          <div className="action-toast">
            <CheckCircle2 size={16} className="text-emerald" /> {toastMessage}
          </div>
        )}

        {/* Order filter pills */}
        {orders.length > 0 && (
          <div className="order-tabs-wrapper">
            <span className="order-tabs-lead">FILTRAR POR ORDEN DE COMPRA:</span>
            <div className="order-tabs">
              <button
                className={`order-pill${orderTab === 'all' ? ' active' : ''}`}
                onClick={() => handleOrderTabChange('all')}
              >
                Todas las órdenes
              </button>
              {orders.map(id => (
                <button
                  key={id}
                  className={`order-pill${orderTab === id ? ' active' : ''}`}
                  onClick={() => handleOrderTabChange(id)}
                >
                  Orden #{id.slice(-6)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Status Workflow Navigation Tabs */}
        <div className="claims-status-nav">
          <button
            className={`status-nav-btn${statusTab === 'pending_action' ? ' active' : ''}`}
            onClick={() => handleStatusTabChange('pending_action')}
          >
            <BellRing size={16} /> Pendientes de Atención
            <span className={`count-pill ${pendingActionCount > 0 ? 'highlight-rose' : ''}`}>
              {pendingActionCount}
            </span>
          </button>

          <button
            className={`status-nav-btn${statusTab === 'acknowledged' ? ' active' : ''}`}
            onClick={() => handleStatusTabChange('acknowledged')}
          >
            <Eye size={16} /> En Gestión / Vistos
            <span className="count-pill">
              {acknowledgedCount}
            </span>
          </button>

          <button
            className={`status-nav-btn${statusTab === 'closed' ? ' active' : ''}`}
            onClick={() => handleStatusTabChange('closed')}
          >
            <CheckCheck size={16} /> Resueltos / Cerrados
            <span className="count-pill">
              {closedCount}
            </span>
          </button>

          <button
            className={`status-nav-btn${statusTab === 'all' ? ' active' : ''}`}
            onClick={() => handleStatusTabChange('all')}
          >
            Todos ({claims.length})
          </button>
        </div>

        {/* Secondary SLA Urgency Filter Chips */}
        <div className="claims-sla-bar">
          <span className="sla-label">NIVEL DE URGENCIA SLA:</span>
          <button
            className={`sla-chip${urgency === 'all' ? ' active' : ''}`}
            onClick={() => handleUrgencyChange('all')}
          >
            Todos ({statusTabItems.length})
          </button>
          <button
            className={`sla-chip rose${urgency === 'critical' ? ' active' : ''}`}
            onClick={() => handleUrgencyChange('critical')}
          >
            🔴 Críticos (&lt;12h) ({counts.critical})
          </button>
          <button
            className={`sla-chip amber${urgency === 'warning' ? ' active' : ''}`}
            onClick={() => handleUrgencyChange('warning')}
          >
            🟠 Advertencia (&lt;24h) ({counts.warning})
          </button>
          <button
            className={`sla-chip emerald${urgency === 'safe' ? ' active' : ''}`}
            onClick={() => handleUrgencyChange('safe')}
          >
            🟢 Seguros ({counts.safe})
          </button>
        </div>

        {/* List Content */}
        <div className="claims-stream">
          {loading && (
            <div className="state-empty">
              <span className="pulse-dot" /> Cargando reclamos...
            </div>
          )}

          {error && <div className="state-empty error">{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="state-empty">
              <ShieldAlert size={36} className="text-muted" />
              <p>
                {statusTab === 'pending_action'
                  ? '¡Excelente! No hay reclamos nuevos pendientes de revisión.'
                  : statusTab === 'acknowledged'
                  ? 'No hay reclamos en curso marcados como en gestión.'
                  : statusTab === 'closed'
                  ? 'No hay reclamos finalizados en el historial.'
                  : 'No se encontraron reclamos con los filtros seleccionados.'}
              </p>
            </div>
          )}

          {filtered
            .slice((page - 1) * limit, page * limit)
            .map(c => (
              <ClaimCard
                key={c.id}
                claim={c}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                isActioning={actioningId === c.id}
                onPromptAck={() =>
                  requestConfirm(
                    c.id,
                    'ack',
                    '¿Marcar reclamo en gestión?',
                    `El reclamo #${c.id} pasará a la pestaña "En Gestión / Vistos" y se registrará tu atención en el panel.`,
                    'Sí, pasar a gestión',
                    'primary',
                    Eye
                  )
                }
                onPromptUnack={() =>
                  requestConfirm(
                    c.id,
                    'unack',
                    '¿Devolver reclamo a pendientes?',
                    `El reclamo #${c.id} regresará a la pestaña "Pendientes de Atención" como una alerta pendiente de revisión.`,
                    'Sí, devolver a pendientes',
                    'amber',
                    RotateCcw
                  )
                }
                onPromptClose={() =>
                  requestConfirm(
                    c.id,
                    'close',
                    '¿Marcar reclamo como Resuelto / Cerrado?',
                    `El reclamo #${c.id} se marcará como cerrado y se moverá al historial de "Resueltos / Cerrados". Podrás reabrirlo si es necesario.`,
                    'Sí, marcar como resuelto',
                    'emerald',
                    CheckCheck
                  )
                }
                onPromptReopen={() =>
                  requestConfirm(
                    c.id,
                    'reopen',
                    '¿Reabrir este reclamo?',
                    `El reclamo #${c.id} se reactivará y pasará nuevamente a la cola activa en "En Gestión / Vistos".`,
                    'Sí, reabrir caso',
                    'primary',
                    RefreshCw
                  )
                }
              />
            ))}
        </div>

        {/* Pagination Controls */}
        {!loading && filtered.length > 0 && (
          <PaginationControls
            pagination={{
              page,
              limit,
              total: filtered.length,
              totalPages: Math.ceil(filtered.length / limit) || 1,
              hasNext: page < (Math.ceil(filtered.length / limit) || 1),
              hasPrev: page > 1,
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
            itemName="reclamos"
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Confirmation Alert Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="confirm-overlay" onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}>
          <div className="confirm-modal-box glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-top">
              <div className={`confirm-icon-box ${confirmDialog.confirmVariant}`}>
                <ConfirmIcon size={24} />
              </div>
              <div className="confirm-modal-texts">
                <h3 className="confirm-modal-title">{confirmDialog.title}</h3>
                <p className="confirm-modal-message">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="confirm-modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                className={`btn-primary ${confirmDialog.confirmVariant === 'emerald' ? 'btn-emerald' : ''}`}
                onClick={executeConfirmAction}
              >
                {confirmDialog.confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClaimCard({
  claim: c,
  expanded,
  onToggle,
  isActioning,
  onPromptAck,
  onPromptUnack,
  onPromptClose,
  onPromptReopen,
}: {
  claim: Claim
  expanded: boolean
  onToggle: () => void
  isActioning: boolean
  onPromptAck: () => void
  onPromptUnack: () => void
  onPromptClose: () => void
  onPromptReopen: () => void
}) {
  const urgency = c.urgency || 'safe'
  const hours   = c.remainingHours ?? 0
  const typeLabel = TYPE_LABELS[c.type] || c.type
  const reasonText = formatReason(c.reason)
  const stageText = formatStage(c.stage)
  const isClosed = c.status === 'closed'
  const isAcknowledged = !isClosed && !!c.notifiedAt

  return (
    <div className={`claim-card urgency-${isClosed ? 'safe' : urgency}`}>
      <div
        className="claim-card-row"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
      >
        {/* Urgency / Status Badge */}
        {isClosed ? (
          <div className="claim-urgency-badge safe">
            <CheckCheck size={14} /> Resuelto
          </div>
        ) : (
          <div className={`claim-urgency-badge ${urgency}`}>
            <span className={`pulse-dot ${urgency === 'critical' ? 'rose' : urgency === 'warning' ? 'amber' : 'emerald'}`} />
            {urgency === 'critical' ? 'Crítico' : urgency === 'warning' ? 'Advertencia' : 'En tiempo'}
          </div>
        )}

        {/* Main Reason & Type */}
        <div className="claim-main">
          <span className="claim-type-tag">{typeLabel}</span>
          <p className="claim-reason">{reasonText}</p>
        </div>

        {/* SLA Countdown Timer */}
        {c.dueDate && !isClosed && (
          <div className={`claim-timer-box ${urgency}`}>
            <span className="claim-timer-val">
              {hours > 0 ? `${Math.round(hours)}h` : 'Vencido'}
            </span>
            <span className="claim-timer-sub">SLA RESTANTE</span>
          </div>
        )}

        {isClosed && (
          <div className="claim-timer-box safe">
            <span className="claim-timer-val">0h</span>
            <span className="claim-timer-sub">CERRADO</span>
          </div>
        )}

        {/* Expand Trigger Icon */}
        <div className="claim-expand-btn">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {expanded && (
        <div className="claim-detail-drawer">
          <div className="claim-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Orden de Compra</span>
              <span className="detail-value tabular-mono">#{c.orderId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">ID de Reclamo</span>
              <span className="detail-value tabular-mono">#{c.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">ID de Comprador</span>
              <span className="detail-value tabular-mono">#{c.buyerId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Etapa Actual</span>
              <span className="detail-value">{stageText}</span>
            </div>
          </div>

          {/* Actions Required by Mercado Libre */}
          {c.actions.length > 0 && !isClosed && (
            <div className="actions-section">
              <div className="actions-heading-row">
                <h4 className="actions-heading">
                  <Layers size={15} className="text-blue" />
                  Acciones requeridas por Mercado Libre ({c.actions.length})
                </h4>
              </div>

              <div className="actions-list">
                {c.actions.map((a, i) => {
                  const meta = getActionMeta(a.action)
                  const ActionIcon = meta.icon

                  return (
                    <div
                      key={i}
                      className={`action-card-item ${a.mandatory ? 'is-mandatory' : 'is-optional'}`}
                    >
                      <div className={`action-icon-wrap ${meta.typeClass}`}>
                        <ActionIcon size={20} />
                      </div>

                      <div className="action-info-col">
                        <div className="action-title-row">
                          <span className="action-title-text">{meta.title}</span>
                          {a.mandatory ? (
                            <span className="action-badge-mandatory">
                              🔴 Obligatoria
                            </span>
                          ) : (
                            <span className="action-badge-optional">
                              Opcional
                            </span>
                          )}
                        </div>
                        <p className="action-desc-text">{meta.description}</p>
                      </div>

                      <div className="action-meta-col">
                        {a.dueDate && (
                          <div className={`action-due-pill ${a.mandatory ? 'urgent' : ''}`}>
                            <Clock size={12} />
                            <span>
                              Vence {new Date(a.dueDate).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Workflow Action Buttons */}
          <div className="claim-actions-bottom">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* If Pending */}
              {!isClosed && !isAcknowledged && (
                <>
                  <button
                    className="btn-primary"
                    disabled={isActioning}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPromptAck()
                    }}
                  >
                    <Check size={15} /> Marcar como visto / En gestión
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={isActioning}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPromptClose()
                    }}
                  >
                    <CheckCheck size={15} className="text-emerald" /> Marcar como Resuelto
                  </button>
                </>
              )}

              {/* If in Management */}
              {isAcknowledged && (
                <>
                  <span className="badge badge-emerald">
                    ✓ En gestión por el operador {c.notifiedAt ? `(${new Date(c.notifiedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs)` : ''}
                  </span>
                  <button
                    className="btn-primary"
                    disabled={isActioning}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPromptClose()
                    }}
                  >
                    <CheckCheck size={15} /> Marcar como Resuelto / Cerrado
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={isActioning}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPromptUnack()
                    }}
                    title="Devolver a la lista de pendientes sin atender"
                  >
                    <RotateCcw size={14} /> Devolver a Pendientes
                  </button>
                </>
              )}

              {/* If Closed */}
              {isClosed && (
                <>
                  <span className="badge badge-emerald">
                    ✓ Reclamo Resuelto y Finalizado
                  </span>
                  <button
                    className="btn-secondary"
                    disabled={isActioning}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPromptReopen()
                    }}
                  >
                    <RefreshCw size={14} /> Reabrir Reclamo
                  </button>
                </>
              )}
            </div>

            <a
              href={`https://www.mercadolibre.com.ar/resumen/claims/${c.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} /> Abrir en Mercado Libre
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
