import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import UnifiedTabNav, { UnifiedTab } from '../components/UnifiedTabNav'
import {
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Zap,
  Send,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Package,
  Sparkles,
  Bot,
  User,
  Clock,
  ShieldCheck,
  FileText,
  Truck,
  Wrench,
  HeartHandshake,
  HelpCircle,
  Check,
  X,
  Plus,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import './OrderMessagesPage.css'

interface OrderMessageItem {
  id: string
  sellerId: string
  packId: string
  orderId?: string
  buyerId: string
  buyerNickname?: string
  messageText: string
  senderRole: 'buyer' | 'seller'
  status: 'unread' | 'pending_review' | 'auto_answered' | 'replied' | 'error'
  intent?: 'facturacion' | 'envio_seguimiento' | 'soporte_tecnico' | 'garantia_consulta' | 'reclamo_potencial' | 'agradecimiento' | 'otro'
  aiConfidence?: number
  suggestedAnswer?: string
  sellerAnswer?: string
  itemTitle?: string
  createdAt: string
  answeredAt?: string | null
}

interface Metrics {
  total: number
  pending: number
  autoAnswered: number
  replied: number
  claimRisks: number
}

const INTENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
  facturacion: {
    label: 'Facturación A/B',
    icon: <FileText size={13} />,
    colorClass: 'intent-facturacion',
  },
  envio_seguimiento: {
    label: 'Envío & Tracking',
    icon: <Truck size={13} />,
    colorClass: 'intent-envio',
  },
  soporte_tecnico: {
    label: 'Soporte Técnico',
    icon: <Wrench size={13} />,
    colorClass: 'intent-soporte',
  },
  garantia_consulta: {
    label: 'Garantía',
    icon: <ShieldCheck size={13} />,
    colorClass: 'intent-garantia',
  },
  reclamo_potencial: {
    label: 'Riesgo Reclamo',
    icon: <AlertTriangle size={13} />,
    colorClass: 'intent-reclamo',
  },
  agradecimiento: {
    label: 'Agradecimiento',
    icon: <HeartHandshake size={13} />,
    colorClass: 'intent-agradecimiento',
  },
  otro: {
    label: 'Consulta General',
    icon: <HelpCircle size={13} />,
    colorClass: 'intent-otro',
  },
}

export default function OrderMessagesPage() {
  const [messages, setMessages] = useState<OrderMessageItem[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    pending: 0,
    autoAnswered: 0,
    replied: 0,
    claimRisks: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [intentFilter, setIntentFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingAnswers, setEditingAnswers] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simPreset, setSimPreset] = useState<'factura' | 'envio' | 'soporte' | 'reclamo'>('factura')

  const fetchMessages = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (statusFilter !== 'all') {
        if (statusFilter === 'claim_risk') {
          searchParams.append('intent', 'reclamo_potencial')
        } else {
          searchParams.append('status', statusFilter)
        }
      }
      if (intentFilter !== 'all' && statusFilter !== 'claim_risk') {
        searchParams.append('intent', intentFilter)
      }
      if (searchQuery.trim()) {
        searchParams.append('search', searchQuery.trim())
      }

      const qs = searchParams.toString()
      const url = `/order-messages${qs ? `?${qs}` : ''}`

      const res = await api.get<any>(url)
      if (res?.success) {
        setMessages(res.messages || [])
        if (res.metrics) setMetrics(res.metrics)
      }
    } catch (err) {
      console.error('Error cargando mensajes post-venta:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, intentFilter, searchQuery])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Real-time SSE listening
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/stream')
      const handleSync = () => fetchMessages(true)
      es.addEventListener('order_message_received', handleSync)
    } catch (e) {
      console.warn('SSE no disponible:', e)
    }
    return () => {
      es?.close()
    }
  }, [fetchMessages])

  const handleManualRefresh = () => {
    setRefreshing(true)
    fetchMessages()
  }

  const handleReplyChange = (id: string, text: string) => {
    setEditingAnswers((prev) => ({ ...prev, [id]: text }))
  }

  const handleSendReply = async (msg: OrderMessageItem) => {
    const textToSend = editingAnswers[msg.id] !== undefined ? editingAnswers[msg.id] : msg.suggestedAnswer
    if (!textToSend || !textToSend.trim()) return

    setSubmittingId(msg.id)
    try {
      const res = await api.post<any>(`/order-messages/${msg.id}/reply`, {
        replyText: textToSend.trim(),
        source: 'web_panel',
      })
      if (res?.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  status: 'replied',
                  sellerAnswer: textToSend.trim(),
                  answeredAt: new Date().toISOString(),
                }
              : m
          )
        )
        setMetrics((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          replied: prev.replied + 1,
        }))
      }
    } catch (err) {
      console.error('Error enviando respuesta:', err)
      alert(`Error al enviar: ${err}`)
    } finally {
      setSubmittingId(null)
    }
  }

  const handleSimulate = async () => {
    setSimulating(true)
    let payload: any = {}

    if (simPreset === 'factura') {
      payload = {
        messageText: 'Hola buenas tardes! ¿Me podrían emitir Factura A para mi empresa? CUIT: 30-71485923-4, Razón Social: Tech Solutions SRL.',
        buyerNickname: 'EMPRESA_TECH_SRL',
        itemTitle: 'Mouse Gamer Logitech G203 White Lightsync',
      }
    } else if (simPreset === 'envio') {
      payload = {
        messageText: 'Hola, quería saber cuándo realizan el despacho del paquete o si ya tienen el código de seguimiento de Correo Argentino. Gracias!',
        buyerNickname: 'MARIA_LOPEZ_99',
        itemTitle: 'Auriculares Inalámbricos Bluetooth Pro',
      }
    } else if (simPreset === 'soporte') {
      payload = {
        messageText: 'Hola! Ya me llegó el producto pero no encuentro en la caja el manual para configurarlo por Bluetooth, me podrán dar una mano?',
        buyerNickname: 'CARLOS_AUDIO',
        itemTitle: 'Teclado Mecánico RGB Switch Blue',
      }
    } else if (simPreset === 'reclamo') {
      payload = {
        messageText: 'Hola, la caja vino golpeada y el cable hace falso contacto. Si no me lo solucionan hoy mismo voy a tener que abrir un reclamo.',
        buyerNickname: 'COMPRADOR_DISCONFORME',
        itemTitle: 'Monitor Gamer 24 Pulgadas 144Hz Full HD',
      }
    }

    try {
      const res = await api.post<any>('/order-messages/simulate', payload)
      if (res?.success) {
        setShowSimulateModal(false)
        await fetchMessages()
      }
    } catch (err) {
      console.error('Error simulando mensaje post-venta:', err)
    } finally {
      setSimulating(false)
    }
  }

  // Unified Tabs List
  const navTabs: UnifiedTab[] = [
    {
      id: 'all',
      label: 'Todas las Conversaciones',
      count: metrics.total,
      colorVariant: 'neutral',
      icon: <SlidersHorizontal size={14} />,
    },
    {
      id: 'pending_review',
      label: 'Pendientes de Revisión',
      count: metrics.pending,
      colorVariant: 'amber',
      alertDot: metrics.pending > 0,
      icon: <Clock size={14} />,
    },
    {
      id: 'auto_answered',
      label: 'Auto-respondidos',
      count: metrics.autoAnswered,
      colorVariant: 'emerald',
      icon: <Zap size={14} />,
    },
    {
      id: 'replied',
      label: 'Respondidos por Operador',
      count: metrics.replied,
      colorVariant: 'blue',
      icon: <CheckCircle size={14} />,
    },
    {
      id: 'claim_risk',
      label: 'Riesgo de Reclamo',
      count: metrics.claimRisks,
      colorVariant: 'rose',
      alertDot: metrics.claimRisks > 0,
      icon: <AlertTriangle size={14} />,
    },
  ]

  const formatTimeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime()
      const m = Math.floor(diff / 60000)
      if (m < 1) return 'hace un momento'
      if (m < 60) return `hace ${m} min`
      const h = Math.floor(m / 60)
      if (h < 24) return `hace ${h} hs`
      return `hace ${Math.floor(h / 24)} días`
    } catch {
      return 'reciente'
    }
  }

  return (
    <div className="channel-page-container">
      {/* Unified Hero Header Banner */}
      <div className="channel-hero-banner">
        <div className="channel-hero-left">
          <h1 className="channel-hero-title">Mensajería Post-Venta & Paquetes</h1>
          <p className="channel-hero-desc">
            Atención inteligente por chat de orden de compra. Respondé facturas, envíos y dudas de compradores para prevenir reclamos y cuidar tu reputación.
          </p>
        </div>

        <div className="channel-hero-actions">
          <button
            className="channel-btn-primary"
            onClick={() => setShowSimulateModal(true)}
          >
            <Sparkles size={15} />
            <span>Simular Mensaje</span>
          </button>
          <button
            className="channel-btn-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            title="Sincronizar mensajes"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* Unified Navigation Tabs */}
      <UnifiedTabNav
        tabs={navTabs}
        activeTab={statusFilter}
        onTabChange={(tabId) => setStatusFilter(tabId)}
      />

      {/* Unified Search & Intent Filter Toolbar */}
      <div className="channel-toolbar-bar">
        <div className="toolbar-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por comprador, orden, producto o texto del mensaje..."
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
          <label htmlFor="intent-select" className="dropdown-label">Intención:</label>
          <select
            id="intent-select"
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="toolbar-select"
          >
            <option value="all">Todas las intenciones</option>
            <option value="facturacion">Facturación A / B</option>
            <option value="envio_seguimiento">Envío y Despacho</option>
            <option value="soporte_tecnico">Soporte Técnico</option>
            <option value="garantia_consulta">Garantía</option>
            <option value="reclamo_potencial">Riesgo Reclamo</option>
            <option value="agradecimiento">Agradecimiento</option>
            <option value="otro">Otras consultas</option>
          </select>
        </div>
      </div>

      {/* Stream List */}
      <div className="channel-stream-wrapper">
        {loading && (
          <div className="channel-empty-state">
            <span className="pulse-dot" /> Cargando mensajes post-venta...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="channel-empty-state">
            <MessageCircle size={38} className="text-muted" />
            <p>No se encontraron conversaciones post-venta con los filtros seleccionados.</p>
          </div>
        )}

        {!loading &&
          messages.map((msg) => {
            const isPending = msg.status === 'unread' || msg.status === 'pending_review'
            const isAuto = msg.status === 'auto_answered'
            const isReplied = msg.status === 'replied'
            const isRisk = msg.intent === 'reclamo_potencial'
            const intentInfo = msg.intent ? INTENT_CONFIG[msg.intent] : null
            const currentAnswerText = editingAnswers[msg.id] !== undefined ? editingAnswers[msg.id] : msg.suggestedAnswer || ''

            return (
              <div
                key={msg.id}
                className={`order-msg-card ${isRisk ? 'card-risk-highlight' : ''}`}
              >
                {/* Header Card */}
                <div className="card-top-bar">
                  <div className="product-meta">
                    <span className="buyer-user-pill">
                      <User size={13} />
                      {msg.buyerNickname || `Comprador #${msg.buyerId.slice(-4)}`}
                    </span>

                    {msg.orderId && (
                      <span className="order-id-pill">
                        Orden #{msg.orderId}
                      </span>
                    )}

                    {msg.itemTitle && (
                      <span className="product-title-pill" title={msg.itemTitle}>
                        <Package size={13} />
                        {msg.itemTitle}
                      </span>
                    )}

                    <span className="time-indicator">
                      <Clock size={12} /> {formatTimeAgo(msg.createdAt)}
                    </span>
                  </div>

                  <div className="badges-right-row">
                    {intentInfo && (
                      <span className={`intent-badge ${intentInfo.colorClass}`}>
                        {intentInfo.icon}
                        {intentInfo.label}
                      </span>
                    )}

                    {msg.aiConfidence !== undefined && msg.aiConfidence > 0 && (
                      <span className="badge badge-emerald">
                        <Sparkles size={12} /> IA {(msg.aiConfidence * 100).toFixed(0)}% certeza
                      </span>
                    )}
                  </div>
                </div>

                {/* Risk Warning Box */}
                {isRisk && (
                  <div className="risk-warning-banner">
                    <AlertTriangle size={16} className="text-rose" />
                    <span>
                      <strong>Alerta Preventiva de Reclamo:</strong> El comprador manifiesta inconformidad o daño. Priorizá una solución inmediata para evitar mediación en Mercado Libre.
                    </span>
                  </div>
                )}

                {/* Buyer Message Bubble */}
                <div className="question-bubble">
                  <span className="buyer-tag">MENSAJE DEL COMPRADOR</span>
                  <p className="buyer-text">"{msg.messageText}"</p>
                </div>

                {/* Suggested or Published Answer */}
                {(msg.suggestedAnswer || msg.sellerAnswer) && (
                  <div className={`answer-section ${isAuto ? 'answer-auto' : isReplied ? 'answer-replied' : ''}`}>
                    <div className="answer-header">
                      <span className="answer-label">
                        {isAuto ? (
                          <>
                            <Zap size={14} className="text-emerald" /> Respuesta automática publicada por IA:
                          </>
                        ) : isReplied ? (
                          <>
                            <CheckCircle size={14} className="text-purple" /> Respuesta enviada por operador:
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} className="text-blue" /> Sugerencia generada por IA (Lista para enviar):
                          </>
                        )}
                      </span>
                    </div>

                    {isPending ? (
                      <div className="edit-answer-container">
                        <textarea
                          className="edit-answer-textarea"
                          rows={3}
                          value={currentAnswerText}
                          onChange={(e) => handleReplyChange(msg.id, e.target.value)}
                          placeholder="Escribí o editá la respuesta antes de enviar..."
                        />
                      </div>
                    ) : (
                      <p className="answer-text">
                        "{msg.sellerAnswer || msg.suggestedAnswer}"
                      </p>
                    )}
                  </div>
                )}

                {/* Card Action / Status Footer */}
                {isPending && (
                  <div className="card-actions-bar">
                    <button
                      className="btn-primary"
                      onClick={() => handleSendReply(msg)}
                      disabled={submittingId === msg.id || !currentAnswerText.trim()}
                    >
                      <Send size={15} />
                      {submittingId === msg.id ? 'Enviando a Mercado Libre...' : 'Enviar Respuesta al Comprador'}
                    </button>
                  </div>
                )}

                {!isPending && (
                  <div className="card-status-footer">
                    {isAuto && (
                      <span className="status-badge emerald">
                        ✓ Auto-respondido por IA al instante
                      </span>
                    )}
                    {isReplied && (
                      <span className="status-badge emerald">
                        ✓ Respondido por operador {msg.answeredAt ? formatTimeAgo(msg.answeredAt) : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Simulation Modal */}
      {showSimulateModal && (
        <div className="modal-backdrop" onClick={() => setShowSimulateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Sparkles size={18} className="text-blue" />
                <h3>Simular Mensaje Post-Venta</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSimulateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                Seleccioná un caso de uso real de mensajería para simular la llegada de un webhook post-venta de Mercado Libre:
              </p>

              <div className="simulation-presets-grid">
                <div
                  className={`preset-card ${simPreset === 'factura' ? 'active' : ''}`}
                  onClick={() => setSimPreset('factura')}
                >
                  <FileText size={18} className="text-blue" />
                  <h4>Facturación A</h4>
                  <p>Comprador solicita comprobante fiscal con CUIT y Razón Social.</p>
                </div>

                <div
                  className={`preset-card ${simPreset === 'envio' ? 'active' : ''}`}
                  onClick={() => setSimPreset('envio')}
                >
                  <Truck size={18} className="text-emerald" />
                  <h4>Envío & Tracking</h4>
                  <p>Consulta por fecha de despacho y número de guía.</p>
                </div>

                <div
                  className={`preset-card ${simPreset === 'soporte' ? 'active' : ''}`}
                  onClick={() => setSimPreset('soporte')}
                >
                  <Wrench size={18} className="text-purple" />
                  <h4>Soporte Técnico</h4>
                  <p>Dudas de configuración o uso del producto recibido.</p>
                </div>

                <div
                  className={`preset-card ${simPreset === 'reclamo' ? 'active' : ''}`}
                  onClick={() => setSimPreset('reclamo')}
                >
                  <AlertTriangle size={18} className="text-rose" />
                  <h4>Riesgo Reclamo</h4>
                  <p>Comprador disconforme con aviso de mediación inminente.</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowSimulateModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSimulate}
                disabled={simulating}
              >
                {simulating ? 'Simulando e Invocando IA...' : 'Disparar Mensaje'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
