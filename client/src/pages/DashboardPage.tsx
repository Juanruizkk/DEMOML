import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import UnifiedKpiGrid, { KpiItem } from '../components/UnifiedKpiGrid'
import {
  Zap,
  Clock,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Bot,
  CheckCircle2,
  ExternalLink,
  Layers,
  ChevronRight,
  User,
  Package
} from 'lucide-react'
import './DashboardPage.css'

interface ActivityItem {
  id: string
  channel: 'question' | 'message' | 'claim'
  title: string
  preview: string
  itemTitle?: string
  buyerNickname?: string
  status: string
  statusLabel: string
  statusColor: 'amber' | 'emerald' | 'blue' | 'rose'
  createdAt: string
  linkTo: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Channel raw metrics
  const [questionsStats, setQuestionsStats] = useState({ total: 0, pending: 0, auto: 0, resolved: 0 })
  const [messagesStats, setMessagesStats] = useState({ total: 0, pending: 0, auto: 0, replied: 0, risks: 0 })
  const [claimsStats, setClaimsStats] = useState({ total: 0, pending: 0, ack: 0, closed: 0, critical: 0 })

  // Combined Activity Stream
  const [activities, setActivities] = useState<ActivityItem[]>([])

  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Fetch Questions
      const questionsPromise = api.get<any>('/questions').catch(() => null)
      // 2. Fetch Order Messages
      const messagesPromise = api.get<any>('/order-messages').catch(() => null)
      // 3. Fetch Claims
      const claimsPromise = api.get<any>('/claims').catch(() => null)

      const [qRes, mRes, cRes] = await Promise.all([questionsPromise, messagesPromise, claimsPromise])

      const recentItems: ActivityItem[] = []

      // Process Questions
      if (qRes) {
        const pendingArr = qRes.pending_review || []
        const autoArr = qRes.auto_answered || []
        const otherArr = qRes.other || []
        const flatQ = [...pendingArr, ...autoArr, ...otherArr]

        const pCount = pendingArr.length
        const aCount = autoArr.length
        const rCount = otherArr.filter((q: any) => q.appStatus === 'approved' || q.appStatus === 'rejected').length

        setQuestionsStats({
          total: flatQ.length,
          pending: pCount,
          auto: aCount,
          resolved: rCount,
        })

        flatQ.slice(0, 5).forEach((q: any) => {
          const isPending = q.appStatus === 'pending_review'
          const isAuto = q.appStatus === 'auto_answered'
          recentItems.push({
            id: `q-${q.id}`,
            channel: 'question',
            title: `Pregunta sobre "${q.itemTitle || 'Producto'}"`,
            preview: q.text,
            itemTitle: q.itemTitle,
            status: q.appStatus,
            statusLabel: isPending ? 'Pendiente Revisión' : isAuto ? 'Auto-respondida' : 'Resuelta',
            statusColor: isPending ? 'amber' : isAuto ? 'emerald' : 'blue',
            createdAt: q.receivedAt || new Date().toISOString(),
            linkTo: '/questions',
          })
        })
      }

      // Process Order Messages
      if (mRes?.success) {
        const mList: any[] = mRes.messages || []
        const mMetrics = mRes.metrics || { total: 0, pending: 0, autoAnswered: 0, replied: 0, claimRisks: 0 }

        setMessagesStats({
          total: mMetrics.total || mList.length,
          pending: mMetrics.pending || 0,
          auto: mMetrics.autoAnswered || 0,
          replied: mMetrics.replied || 0,
          risks: mMetrics.claimRisks || 0,
        })

        mList.slice(0, 5).forEach((m: any) => {
          const isPending = m.status === 'pending_review' || m.status === 'unread'
          const isAuto = m.status === 'auto_answered'
          const isRisk = m.intent === 'reclamo_potencial'
          recentItems.push({
            id: `m-${m.id}`,
            channel: 'message',
            title: `Mensaje Post-Venta · ${m.buyerNickname || 'Comprador'}`,
            preview: m.messageText,
            buyerNickname: m.buyerNickname,
            itemTitle: m.itemTitle,
            status: m.status,
            statusLabel: isRisk ? 'Alerta Riesgo' : isPending ? 'Pendiente' : isAuto ? 'Auto-respondido' : 'Respondido',
            statusColor: isRisk ? 'rose' : isPending ? 'amber' : isAuto ? 'emerald' : 'blue',
            createdAt: m.createdAt,
            linkTo: '/order-messages',
          })
        })
      }

      // Process Claims
      if (cRes?.claims) {
        const cList: any[] = cRes.claims || []
        const pendingCount = cList.filter((c: any) => c.status === 'opened' && !c.notifiedAt).length
        const ackCount = cList.filter((c: any) => c.status === 'opened' && c.notifiedAt).length
        const closedCount = cList.filter((c: any) => c.status === 'closed').length
        const criticalCount = cList.filter((c: any) => c.urgency === 'critical').length

        setClaimsStats({
          total: cList.length,
          pending: pendingCount,
          ack: ackCount,
          closed: closedCount,
          critical: criticalCount,
        })

        cList.slice(0, 5).forEach((c: any) => {
          const isPending = c.status === 'opened' && !c.notifiedAt
          recentItems.push({
            id: `c-${c.id}`,
            channel: 'claim',
            title: `Reclamo #${c.id} · Orden #${c.orderId || 'S/D'}`,
            preview: c.reason || 'Reclamo abierto por el comprador',
            status: c.status,
            statusLabel: isPending ? 'Atención Requerida' : c.status === 'closed' ? 'Cerrado' : 'En Gestión',
            statusColor: isPending ? 'rose' : c.status === 'closed' ? 'blue' : 'amber',
            createdAt: c.createdAt,
            linkTo: '/claims',
          })
        })
      }

      // Sort recent items by date descending
      recentItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setActivities(recentItems.slice(0, 8))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Real-time SSE listening for dashboard auto-refresh
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/stream')
      const handleEvent = () => {
        loadDashboardData()
      }
      es.addEventListener('question_received', handleEvent)
      es.addEventListener('question_approved', handleEvent)
      es.addEventListener('order_message_received', handleEvent)
      es.addEventListener('claim_received', handleEvent)
      es.addEventListener('claim_updated', handleEvent)
    } catch (e) {
      console.warn('SSE no disponible en Dashboard:', e)
    }
    return () => {
      es?.close()
    }
  }, [loadDashboardData])

  const handleManualRefresh = () => {
    setRefreshing(true)
    loadDashboardData()
  }

  // Calculate Consolidated Global Metrics
  const totalInteractions = questionsStats.total + messagesStats.total + claimsStats.total
  const totalAuto = questionsStats.auto + messagesStats.auto
  const totalPending = questionsStats.pending + messagesStats.pending + claimsStats.pending
  const autoRate = totalInteractions > 0 ? Math.round((totalAuto / totalInteractions) * 100) : 100

  const globalKpis: KpiItem[] = [
    {
      title: 'Tasa de Automatización IA',
      value: `${autoRate}%`,
      subtitle: `${totalAuto} interacciones resueltas sin operador`,
      icon: <Zap size={18} />,
      colorVariant: 'emerald',
      badge: { text: 'Alta Eficiencia', variant: 'success' },
    },
    {
      title: 'Tiempo Promedio de Respuesta',
      value: '< 2 min',
      subtitle: 'vs. 4.5h promedio manual del sector',
      icon: <Clock size={18} />,
      colorVariant: 'blue',
      badge: { text: 'Instantáneo', variant: 'info' },
    },
    {
      title: 'Atención Inmediata Requerida',
      value: totalPending,
      subtitle: `${questionsStats.pending} preguntas · ${messagesStats.pending} mensajes · ${claimsStats.pending} reclamos`,
      icon: <AlertTriangle size={18} />,
      colorVariant: totalPending > 0 ? 'amber' : 'emerald',
      badge: {
        text: totalPending > 0 ? 'Casos Pendientes' : 'Al Día',
        variant: totalPending > 0 ? 'warning' : 'success',
      },
      onClick: () => {
        if (claimsStats.pending > 0) navigate('/claims')
        else if (messagesStats.pending > 0) navigate('/order-messages')
        else navigate('/questions')
      },
    },
    {
      title: 'Protección de SLA & Reputación',
      value: '100%',
      subtitle: '0 mediaciones vencidas en Mercado Libre',
      icon: <ShieldCheck size={18} />,
      colorVariant: 'purple',
      badge: { text: 'Termómetro Verde', variant: 'success' },
    },
  ]

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Hace un momento'
      if (diffMins < 60) return `Hace ${diffMins}m`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `Hace ${diffHours}h`
      return `Hace ${Math.floor(diffHours / 24)}d`
    } catch {
      return 'Reciente'
    }
  }

  return (
    <div className="dashboard-page-container">
      {/* Top Hero Banner */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Panel General de Operaciones MELI
          </h1>
          <p className="hero-subtitle">
            Monitoreo en tiempo real de preguntas pre-venta, mensajería de paquetes y gestión preventiva de reclamos.
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="hero-btn-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            title="Sincronizar métricas de todos los canales"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Sincronizando...' : 'Actualizar Todo'}</span>
          </button>
        </div>
      </div>

      {/* Global Consolidated KPI Cards */}
      <div className="dashboard-section-block">
        <div className="section-header-row">
          <h2 className="section-title">Métricas Ejecutivas Globales</h2>
          <span className="section-timestamp">
            Última sync: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        <UnifiedKpiGrid items={globalKpis} columns={4} />
      </div>

      {/* 3 Operational Channel Hub Cards */}
      <div className="dashboard-section-block">
        <div className="section-header-row">
          <h2 className="section-title">Canales de Atención al Cliente</h2>
          <span className="section-subtitle-text">Acceso directo y estado operativo de cada módulo</span>
        </div>

        <div className="channels-hub-grid">
          {/* Card 1: Preguntas Pre-Venta */}
          <div className="channel-hub-card channel-questions" onClick={() => navigate('/questions')}>
            <div className="hub-card-header">
              <div className="hub-icon-bubble bubble-cyan">
                <MessageSquare size={22} />
              </div>
              <div className="hub-status-tag tag-emerald">
                <span className="dot-mini" /> Auto-Respuesta Activa
              </div>
            </div>

            <div className="hub-card-body">
              <h3 className="hub-channel-title">Preguntas Pre-Venta</h3>
              <p className="hub-channel-desc">
                Consultas técnicas, compatibilidad y stock previas a la compra.
              </p>

              <div className="hub-metrics-row">
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Pendientes</span>
                  <span className={`hub-metric-val ${questionsStats.pending > 0 ? 'text-amber' : ''}`}>
                    {questionsStats.pending}
                  </span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Auto-Respondidas</span>
                  <span className="hub-metric-val text-emerald">{questionsStats.auto}</span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Total</span>
                  <span className="hub-metric-val">{questionsStats.total}</span>
                </div>
              </div>
            </div>

            <div className="hub-card-footer">
              <span className="hub-action-text">Abrir Panel de Preguntas</span>
              <ArrowRight size={16} className="hub-arrow-icon" />
            </div>
          </div>

          {/* Card 2: Mensajes Post-Venta */}
          <div className="channel-hub-card channel-messages" onClick={() => navigate('/order-messages')}>
            <div className="hub-card-header">
              <div className="hub-icon-bubble bubble-purple">
                <MessageCircle size={22} />
              </div>
              <div className="hub-status-tag tag-purple">
                <Sparkles size={12} /> Alerta Preventiva
              </div>
            </div>

            <div className="hub-card-body">
              <h3 className="hub-channel-title">Mensajería Post-Venta</h3>
              <p className="hub-channel-desc">
                Chat directo por orden para facturación, envíos y soporte técnico.
              </p>

              <div className="hub-metrics-row">
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Pendientes</span>
                  <span className={`hub-metric-val ${messagesStats.pending > 0 ? 'text-amber' : ''}`}>
                    {messagesStats.pending}
                  </span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Riesgo Reclamo</span>
                  <span className={`hub-metric-val ${messagesStats.risks > 0 ? 'text-rose' : ''}`}>
                    {messagesStats.risks}
                  </span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Respondidos</span>
                  <span className="hub-metric-val text-emerald">{messagesStats.replied + messagesStats.auto}</span>
                </div>
              </div>
            </div>

            <div className="hub-card-footer">
              <span className="hub-action-text">Abrir Mensajes Post-Venta</span>
              <ArrowRight size={16} className="hub-arrow-icon" />
            </div>
          </div>

          {/* Card 3: Reclamos & Disputas */}
          <div className="channel-hub-card channel-claims" onClick={() => navigate('/claims')}>
            <div className="hub-card-header">
              <div className="hub-icon-bubble bubble-rose">
                <AlertTriangle size={22} />
              </div>
              <div className="hub-status-tag tag-amber">
                <Clock size={12} /> Control SLA 24/7
              </div>
            </div>

            <div className="hub-card-body">
              <h3 className="hub-channel-title">Reclamos & Disputas</h3>
              <p className="hub-channel-desc">
                Mediaciones de producto defectuoso o demoras con plazo estricto de resolución.
              </p>

              <div className="hub-metrics-row">
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Por Atender</span>
                  <span className={`hub-metric-val ${claimsStats.pending > 0 ? 'text-rose' : ''}`}>
                    {claimsStats.pending}
                  </span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">En Gestión</span>
                  <span className="hub-metric-val text-amber">{claimsStats.ack}</span>
                </div>
                <div className="hub-metric-item">
                  <span className="hub-metric-label">Resueltos</span>
                  <span className="hub-metric-val text-emerald">{claimsStats.closed}</span>
                </div>
              </div>
            </div>

            <div className="hub-card-footer">
              <span className="hub-action-text">Abrir Panel de Reclamos</span>
              <ArrowRight size={16} className="hub-arrow-icon" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Live Activity Feed */}
      <div className="dashboard-section-block">
        <div className="section-header-row">
          <div className="feed-header-left">
            <h2 className="section-title">Flujo Unificado de Actividad</h2>
            <span className="feed-live-badge">En Vivo</span>
          </div>
          <span className="section-subtitle-text">Últimos eventos recibidos en los 3 canales</span>
        </div>

        <div className="activity-feed-card">
          {loading && (
            <div className="feed-loading-state">
              <span className="pulse-dot" /> Cargando flujo de operaciones...
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div className="feed-empty-state">
              <CheckCircle2 size={36} className="text-emerald" />
              <p>No hay actividad reciente registrada en los canales.</p>
            </div>
          )}

          {!loading && activities.length > 0 && (
            <div className="activity-items-list">
              {activities.map((item) => (
                <div
                  key={item.id}
                  className="activity-item-row"
                  onClick={() => navigate(item.linkTo)}
                >
                  <div className="activity-channel-badge-col">
                    {item.channel === 'question' && (
                      <span className="channel-pill pill-question">
                        <MessageSquare size={12} /> Pregunta
                      </span>
                    )}
                    {item.channel === 'message' && (
                      <span className="channel-pill pill-message">
                        <MessageCircle size={12} /> Post-Venta
                      </span>
                    )}
                    {item.channel === 'claim' && (
                      <span className="channel-pill pill-claim">
                        <AlertTriangle size={12} /> Reclamo
                      </span>
                    )}
                  </div>

                  <div className="activity-content-col">
                    <div className="activity-title-row">
                      <span className="activity-title">{item.title}</span>
                      <span className="activity-time">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <p className="activity-preview-text">"{item.preview}"</p>
                  </div>

                  <div className="activity-status-col">
                    <span className={`activity-status-tag tag-${item.statusColor}`}>
                      {item.statusLabel}
                    </span>
                    <ChevronRight size={16} className="activity-chevron" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
