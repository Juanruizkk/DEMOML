import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import UnifiedTabNav, { UnifiedTab } from '../components/UnifiedTabNav'
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
  HelpCircle,
  Sparkles,
  Search,
  SlidersHorizontal,
  User
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
  reasonDetail?: string
  buyerId?: string
  buyerNickname?: string
  itemId?: string
  itemTitle?: string
  itemPrice?: number
  itemQuantity?: number
  complainantMessage?: string
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

function getClaimReasonLabel(reasonCode: string): string {
  const norm = (reasonCode || '').trim().toUpperCase()
  if (norm === 'PDD9949') return 'Producto Defectuoso / Falla Técnica'
  if (norm === 'PDD9549') return 'Faltan Accesorios o Piezas'
  if (norm === 'PDD9548') return 'Modelo o Color Diferente'
  if (norm === 'PDD9547') return 'Discrepancia con la Publicación'
  if (norm === 'PDD9546') return 'Daño en Envío'
  if (norm === 'PNR9910') return 'Envío Demorado'
  if (norm === 'PNR9949') return 'Paquete No Recibido'
  if (norm === 'RET9949') return 'Devolución Voluntaria'
  if (norm.startsWith('PDD')) return 'Producto Defectuoso'
  if (norm.startsWith('PNR')) return 'Inconveniente de Envío'
  if (norm.startsWith('RET')) return 'Devolución'
  return reasonCode || 'Mediación'
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
  const [claims, setClaims]             = useState<Claim[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [statusTab, setStatusTab]       = useState<StatusTab>('pending_action')
  const [urgency, setUrgency]           = useState<UrgencyFilter>('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [page, setPage]                 = useState(1)
  const [limit, setLimit]               = useState(10)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actioningId, setActioningId]   = useState<string | null>(null)
  const [syncing, setSyncing]           = useState(false)
  const [simulating, setSimulating]     = useState(false)

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

  const loadClaims = useCallback(async (withSync = false, isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError('')
    if (withSync) setSyncing(true)
    try {
      const url = withSync ? '/claims?sync=true' : '/claims'
      const data = await api.get<{ claims: Claim[]; metrics?: unknown }>(url)
      setClaims(Array.isArray(data) ? data : (data.claims ?? []))
    } catch (err: any) {
      setError(err.message || 'Error al cargar reclamos')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    loadClaims(false)

    // Real-time SSE listener
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/stream')
      const handleSync = () => {
        loadClaims(false, true)
        showToast('⚖️ Reclamo actualizado en tiempo real')
      }
      es.addEventListener('claim_received', handleSync)
      es.addEventListener('claim_updated', handleSync)
    } catch (e) {
      console.warn('SSE no disponible:', e)
    }

    return () => {
      es?.close()
    }
  }, [loadClaims])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Simulation handler
  const handleSimulateClaim = async () => {
    setSimulating(true)
    try {
      const res = await api.post<any>('/claims/simulate', {})
      if (res?.claim) {
        showToast(`✓ Reclamo simulado #${res.claim.id} creado con éxito`)
        await loadClaims(false)
      }
    } catch (err: any) {
      showToast(`Error simulando reclamo: ${err.message}`)
    } finally {
      setSimulating(false)
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

  const handleStatusTabChange = (tab: string) => {
    setStatusTab(tab as StatusTab)
    setPage(1)
  }

  // Status counts
  const pendingActionCount = claims.filter(c => c.status === 'opened' && !c.notifiedAt).length
  const acknowledgedCount  = claims.filter(c => c.status === 'opened' && !!c.notifiedAt).length
  const closedCount        = claims.filter(c => c.status === 'closed').length

  const filtered = claims.filter(c => {
    // Search query filter
    if (searchQuery.trim()) {
      const sq = searchQuery.toLowerCase()
      const matchesId = c.id.toLowerCase().includes(sq)
      const matchesOrder = (c.orderId || '').toLowerCase().includes(sq)
      const matchesReason = (c.reason || '').toLowerCase().includes(sq)
      const matchesBuyer = (c.buyerId || '').toLowerCase().includes(sq)
      if (!matchesId && !matchesOrder && !matchesReason && !matchesBuyer) return false
    }

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

  // Unified Tabs List
  const navTabs: UnifiedTab[] = [
    {
      id: 'pending_action',
      label: 'Pendientes de Atención',
      count: pendingActionCount,
      colorVariant: 'rose',
      alertDot: pendingActionCount > 0,
      icon: <BellRing size={14} />,
    },
    {
      id: 'acknowledged',
      label: 'En Gestión / Vistos',
      count: acknowledgedCount,
      colorVariant: 'amber',
      icon: <Eye size={14} />,
    },
    {
      id: 'closed',
      label: 'Resueltos / Cerrados',
      count: closedCount,
      colorVariant: 'emerald',
      icon: <CheckCheck size={14} />,
    },
    {
      id: 'all',
      label: 'Todos los Reclamos',
      count: claims.length,
      colorVariant: 'neutral',
      icon: <SlidersHorizontal size={14} />,
    },
  ]

  const ConfirmIcon = confirmDialog.icon

  return (
    <div className="channel-page-container">
      {/* Unified Hero Header Banner */}
      <div className="channel-hero-banner">
        <div className="channel-hero-left">
          <h1 className="channel-hero-title">Gestión de Reclamos & Mediaciones</h1>
          <p className="channel-hero-desc">
            Seguimiento estricto de SLA y acciones operativas de resolución en Mercado Libre para proteger el termómetro y reputación de tu negocio.
          </p>
        </div>

        <div className="channel-hero-actions">
          <button
            className="channel-btn-primary"
            onClick={handleSimulateClaim}
            disabled={simulating}
          >
            <Sparkles size={15} />
            <span>{simulating ? 'Simulando...' : 'Simular Reclamo'}</span>
          </button>
          <button
            className="channel-btn-refresh"
            onClick={() => loadClaims(true)}
            disabled={syncing || loading}
            title="Sincronizar reclamos desde Mercado Libre"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar ML'}</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="action-toast-banner">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Navigation Tabs */}
      <UnifiedTabNav
        tabs={navTabs}
        activeTab={statusTab}
        onTabChange={handleStatusTabChange}
      />

      {/* Unified Search & Urgency Filter Toolbar */}
      <div className="channel-toolbar-bar">
        <div className="toolbar-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por ID de reclamo, orden, comprador o motivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-dropdown-box">
          <label htmlFor="urgency-select" className="dropdown-label">Nivel de Urgencia SLA:</label>
          <select
            id="urgency-select"
            value={urgency}
            onChange={(e) => {
              setUrgency(e.target.value as UrgencyFilter)
              setPage(1)
            }}
            className="toolbar-select"
          >
            <option value="all">Todos los plazos SLA</option>
            <option value="critical">🔴 Crítico (Vence en &lt; 12h)</option>
            <option value="warning">🟡 Alerta (Vence en &lt; 24h)</option>
            <option value="safe">🟢 A tiempo (&gt; 24h restantes)</option>
          </select>
        </div>
      </div>

      {/* Stream List */}
      <div className="channel-stream-wrapper">
        {loading && (
          <div className="channel-empty-state">
            <span className="pulse-dot" /> Cargando reclamos...
          </div>
        )}

        {error && <div className="channel-empty-state text-rose">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="channel-empty-state">
            <ShieldAlert size={38} className="text-muted" />
            <p>
              No hay reclamos en esta vista{' '}
              {searchQuery ? 'que coincidan con la búsqueda' : ''}.
            </p>
          </div>
        )}

        {filtered
          .slice((page - 1) * limit, page * limit)
          .map((c) => {
            const isExpanded = expanded === c.id
            const isAcknowledged = !!c.notifiedAt
            const isClosed = c.status === 'closed'
            const isActioning = actioningId === c.id
            const reasonLabel = getClaimReasonLabel(c.reason)

            return (
              <div
                key={c.id}
                className={`claim-card glass-card ${
                  c.urgency === 'critical' && !isClosed ? 'border-critical' : ''
                } ${c.urgency === 'warning' && !isClosed ? 'border-warning' : ''}`}
              >
                {/* Header Row */}
                <div className="card-top-bar">
                  <div className="product-meta">
                    <span className="claim-id-badge">
                      Reclamo #{c.id}
                    </span>

                    {c.orderId && (
                      <span className="order-id-pill">
                        Orden #{c.orderId}
                      </span>
                    )}

                    <span className="buyer-user-pill">
                      <User size={13} />
                      {c.buyerNickname || `Comprador #${c.buyerId ? c.buyerId.slice(-4) : 'S/D'}`}
                    </span>

                    <span className="claim-reason-pill">
                      <AlertTriangle size={12} />
                      {c.reason} · {reasonLabel}
                    </span>

                    <span className="time-indicator">
                      <Clock size={12} /> {formatTimeAgo(c.createdAt)}
                    </span>
                  </div>

                  <div className="badges-right-row">
                    {/* SLA Countdown Badge */}
                    {c.remainingHours !== undefined && !isClosed && (
                      <span className={`sla-badge sla-${c.urgency || 'safe'}`}>
                        {c.urgency === 'critical' ? (
                          <span className="sla-dot" />
                        ) : (
                          <Clock size={11} />
                        )}
                        <span>SLA: {c.remainingHours > 0 ? `${c.remainingHours}h restantes` : 'Vencido'}</span>
                      </span>
                    )}

                    {/* Status Badge */}
                    <span className={`claim-status-pill status-${c.status === 'closed' ? 'closed' : isAcknowledged ? 'ack' : 'opened'}`}>
                      <span className={`status-dot dot-${c.status === 'closed' ? 'closed' : isAcknowledged ? 'ack' : 'opened'}`} />
                      <span>{c.status === 'closed' ? 'Resuelto' : isAcknowledged ? 'En Gestión' : 'Pendiente Atención'}</span>
                    </span>
                  </div>
                </div>

                {/* Product Detail Section */}
                <div className="claim-product-banner">
                  <div className="product-banner-left">
                    <div className="product-icon-wrap">
                      <Package size={18} className="text-blue" />
                    </div>
                    <div className="product-banner-info">
                      <span className="product-banner-label">PRODUCTO VINCULADO AL RECLAMO</span>
                      <h4 className="product-banner-title">
                        {c.itemTitle || 'Producto de la orden'}
                      </h4>
                    </div>
                  </div>

                  <div className="product-banner-right">
                    {c.itemQuantity && (
                      <span className="product-qty-badge">
                        {c.itemQuantity} {c.itemQuantity === 1 ? 'unidad' : 'unidades'}
                      </span>
                    )}
                    {c.itemPrice && (
                      <span className="product-price-badge">
                        ${c.itemPrice.toLocaleString('es-AR')}
                      </span>
                    )}
                    {c.itemId && (
                      <a
                        href={`https://articulo.mercadolibre.com.ar/MLA-${c.itemId.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-view-publication"
                        title="Ver publicación en Mercado Libre"
                      >
                        <ExternalLink size={13} />
                        <span>Ver publicación</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Buyer's Opening Message / Statement */}
                <div className="claim-buyer-message-bubble">
                  <div className="buyer-message-tag-row">
                    <MessageSquare size={13} className="text-rose" />
                    <span className="buyer-message-tag">MENSAJE DEL COMPRADOR AL ABRIR EL RECLAMO</span>
                  </div>
                  <p className="claim-buyer-text">
                    "{c.complainantMessage || c.reasonDetail || 'Sin mensaje de apertura registrado.'}"
                  </p>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="claim-card-actions-row">
                  <div className="left-actions-group">
                    {/* Primary Status Toggle Buttons */}
                    {!isAcknowledged && !isClosed && (
                      <button
                        className="btn-primary-emerald"
                        onClick={() =>
                          requestConfirm(
                            c.id,
                            'ack',
                            'Pasar reclamo a En Gestión',
                            `¿Confirmas que ya viste este reclamo (#${c.id.slice(-6)}) y estás atendiéndolo? Se moverá a la pestaña 'En Gestión / Vistos'.`,
                            'Sí, pasar a En Gestión',
                            'emerald',
                            CheckCheck
                          )
                        }
                        disabled={isActioning}
                      >
                        <CheckCheck size={14} /> Pasar a Gestión
                      </button>
                    )}

                    {isAcknowledged && !isClosed && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          requestConfirm(
                            c.id,
                            'unack',
                            'Devolver a Pendientes',
                            `¿Deseas devolver el reclamo (#${c.id.slice(-6)}) a la bandeja de 'Pendientes de Atención'?`,
                            'Sí, devolver a Pendientes',
                            'primary',
                            RotateCcw
                          )
                        }
                        disabled={isActioning}
                      >
                        <RotateCcw size={14} /> Devolver a Pendientes
                      </button>
                    )}

                    {!isClosed && (
                      <button
                        className="btn-secondary btn-emerald-hover"
                        onClick={() =>
                          requestConfirm(
                            c.id,
                            'close',
                            'Dar por resuelto y cerrar reclamo',
                            `¿Confirmas que este reclamo (#${c.id.slice(-6)}) ya fue resuelto con el comprador y deseas darlo por cerrado en el panel?`,
                            'Sí, marcar como Resuelto',
                            'emerald',
                            CheckCircle2
                          )
                        }
                        disabled={isActioning}
                      >
                        <CheckCircle2 size={14} /> Marcar Resuelto
                      </button>
                    )}

                    {isClosed && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          requestConfirm(
                            c.id,
                            'reopen',
                            'Reabrir reclamo',
                            `¿Deseas reabrir el reclamo (#${c.id.slice(-6)}) para continuar gestionándolo?`,
                            'Sí, reabrir reclamo',
                            'primary',
                            RotateCcw
                          )
                        }
                        disabled={isActioning}
                      >
                        <RotateCcw size={14} /> Reabrir Reclamo
                      </button>
                    )}
                  </div>

                  <div className="right-actions-group">
                    {c.actions && c.actions.length > 0 && (
                      <button
                        className="btn-toggle-drawer"
                        onClick={() => setExpanded(isExpanded ? null : c.id)}
                      >
                        <span>{c.actions.length} acciones operativas</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Action Drawer */}
                {isExpanded && c.actions && (
                  <div className="claim-actions-drawer">
                    <div className="drawer-header-title">
                      <Layers size={14} className="text-blue" />
                      <span>Acciones recomendadas en Mercado Libre para este reclamo:</span>
                    </div>

                    <div className="actions-sublist">
                      {c.actions.map((act, idx) => {
                        const meta = getActionMeta(act.action)
                        const ActionIcon = meta.icon

                        return (
                          <div key={idx} className={`action-item-card type-${meta.typeClass}`}>
                            <div className="action-item-left">
                              <div className="action-icon-wrap">
                                <ActionIcon size={16} />
                              </div>
                              <div className="action-text-meta">
                                <span className="action-title-text">{meta.title}</span>
                                <p className="action-desc-text">{meta.description}</p>
                              </div>
                            </div>

                            <div className="action-item-right">
                              {act.mandatory && (
                                <span className="mandatory-pill">Requerido</span>
                              )}
                              {act.dueDate && (
                                <span className="due-date-pill">
                                  Vence: {new Date(act.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          itemName="reclamos"
          pageSizeOptions={[5, 10, 20, 50]}
        />
      )}

      {/* Confirmation Alert Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <ConfirmIcon size={18} className={`text-${confirmDialog.confirmVariant === 'emerald' ? 'emerald' : 'blue'}`} />
                <h3>{confirmDialog.title}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">{confirmDialog.message}</p>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                className={confirmDialog.confirmVariant === 'emerald' ? 'btn-primary-emerald' : 'btn-primary'}
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

function formatTimeAgo(iso: string): string {
  if (!iso) return 'reciente'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} hs`
  return `hace ${Math.floor(h / 24)} días`
}
