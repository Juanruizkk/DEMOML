import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import UnifiedTabNav, { UnifiedTab } from '../components/UnifiedTabNav'
import PaginationControls from '../components/PaginationControls'
import {
  MessageSquare,
  Sparkles,
  Check,
  X,
  Edit3,
  ExternalLink,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Bot
} from 'lucide-react'
import './QuestionsPage.css'

interface Question {
  id: string
  text: string
  itemId: string
  itemTitle?: string
  status: 'pending' | 'approved' | 'rejected' | 'auto_answered'
  aiAnswer?: string
  confidence?: number
  createdAt: string
}

interface ApiQuestion {
  id: string
  text: string
  itemId: string
  itemTitle?: string
  appStatus: string
  suggestedAnswer?: string
  finalAnswer?: string
  confidence?: number
  receivedAt?: string
}

interface GroupedResponse {
  pending_review: ApiQuestion[]
  auto_answered: ApiQuestion[]
  other: ApiQuestion[]
}

function normalize(q: ApiQuestion): Question {
  const statusMap: Record<string, Question['status']> = {
    pending_review: 'pending',
    auto_answered: 'auto_answered',
    approved: 'approved',
    rejected: 'rejected',
  }
  return {
    id: q.id,
    text: q.text,
    itemId: q.itemId,
    itemTitle: q.itemTitle,
    status: statusMap[q.appStatus] ?? 'approved',
    aiAnswer: q.suggestedAnswer ?? q.finalAnswer,
    confidence: q.confidence,
    createdAt: q.receivedAt ?? new Date().toISOString(),
  }
}

type Filter = 'pending' | 'auto_answered' | 'resolved' | 'all'

export default function QuestionsPage() {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('pending')
  const [productTab, setProductTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [actioning, setActioning] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadQuestions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError('')
    try {
      const data = await api.get<GroupedResponse>('/questions')
      const flat = [
        ...(data.pending_review ?? []),
        ...(data.auto_answered ?? []),
        ...(data.other ?? []),
      ].map(normalize)
      setQuestions(flat)
    } catch (err: any) {
      setError(err.message || 'Error al cargar preguntas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  // Real-time SSE listening
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/stream')
      const handleSync = () => loadQuestions(true)
      es.addEventListener('question_received', handleSync)
      es.addEventListener('question_approved', handleSync)
    } catch (e) {
      console.warn('SSE stream error:', e)
    }
    return () => {
      es?.close()
    }
  }, [loadQuestions])

  const handleFilterChange = (f: string) => {
    setFilter(f as Filter)
    setPage(1)
  }

  const handleProductTabChange = (tab: string) => {
    setProductTab(tab)
    setPage(1)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleManualRefresh = () => {
    setRefreshing(true)
    loadQuestions()
  }

  const handleApprove = async (id: string, text?: string) => {
    setActioning(id)
    try {
      await api.post(`/questions/${id}/approve`, { text })
      setQuestions((qs) =>
        qs.map((q) =>
          q.id === id
            ? { ...q, status: 'approved', aiAnswer: text || q.aiAnswer }
            : q
        )
      )
      showToast('✓ Pregunta aprobada y respuesta enviada a Mercado Libre')
    } catch (err: any) {
      alert(`Error al aprobar: ${err.message}`)
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (id: string) => {
    setActioning(id)
    try {
      await api.post(`/questions/${id}/reject`)
      setQuestions((qs) =>
        qs.map((q) => (q.id === id ? { ...q, status: 'rejected' } : q))
      )
      showToast('🗑️ Pregunta descartada')
    } catch (err: any) {
      alert(`Error al rechazar: ${err.message}`)
    } finally {
      setActioning(null)
    }
  }

  // Derive unique product tabs
  const productsMap = new Map<string, string>()
  for (const q of questions) {
    if (q.itemId && !productsMap.has(q.itemId)) {
      productsMap.set(q.itemId, q.itemTitle || `Producto ${q.itemId.slice(-4)}`)
    }
  }
  const products = Array.from(productsMap.entries())

  // Filter questions
  const filtered = questions.filter((q) => {
    if (productTab !== 'all' && q.itemId !== productTab) return false

    if (searchQuery.trim()) {
      const sq = searchQuery.toLowerCase()
      const matchesText = q.text.toLowerCase().includes(sq)
      const matchesTitle = (q.itemTitle || '').toLowerCase().includes(sq)
      const matchesAns = (q.aiAnswer || '').toLowerCase().includes(sq)
      if (!matchesText && !matchesTitle && !matchesAns) return false
    }

    if (filter === 'pending') return q.status === 'pending'
    if (filter === 'auto_answered') return q.status === 'auto_answered'
    if (filter === 'resolved') return q.status === 'approved' || q.status === 'rejected'
    return true // 'all'
  })

  const counts = {
    total: questions.length,
    pending: questions.filter((q) => q.status === 'pending').length,
    auto_answered: questions.filter((q) => q.status === 'auto_answered').length,
    resolved: questions.filter((q) => q.status === 'approved' || q.status === 'rejected').length,
  }

  // Unified Tabs List
  const navTabs: UnifiedTab[] = [
    {
      id: 'pending',
      label: 'Pendientes de Aprobación',
      count: counts.pending,
      colorVariant: 'amber',
      alertDot: counts.pending > 0,
      icon: <Clock size={14} />,
    },
    {
      id: 'auto_answered',
      label: 'Auto-respondidas por IA',
      count: counts.auto_answered,
      colorVariant: 'emerald',
      icon: <Zap size={14} />,
    },
    {
      id: 'resolved',
      label: 'Resueltas',
      count: counts.resolved,
      colorVariant: 'blue',
      icon: <CheckCircle2 size={14} />,
    },
    {
      id: 'all',
      label: 'Todas las Preguntas',
      count: counts.total,
      colorVariant: 'neutral',
      icon: <SlidersHorizontal size={14} />,
    },
  ]

  return (
    <div className="channel-page-container">
      {/* Unified Hero Header Banner */}
      <div className="channel-hero-banner">
        <div className="channel-hero-left">
          <h1 className="channel-hero-title">Preguntas de Publicaciones</h1>
          <p className="channel-hero-desc">
            Bandeja de atención automática y aprobación con IA para consultas técnicas de compradores en Mercado Libre.
          </p>
        </div>

        <div className="channel-hero-actions">
          <button
            className="channel-btn-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            title="Recargar preguntas"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
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
        activeTab={filter}
        onTabChange={handleFilterChange}
      />

      {/* Unified Search & Contextual Filter Toolbar */}
      <div className="channel-toolbar-bar">
        <div className="toolbar-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por texto de pregunta, respuesta o producto..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {products.length > 0 && (
          <div className="toolbar-dropdown-box">
            <label htmlFor="pub-select" className="dropdown-label">Publicación:</label>
            <select
              id="pub-select"
              value={productTab}
              onChange={(e) => handleProductTabChange(e.target.value)}
              className="toolbar-select"
            >
              <option value="all">Todas las publicaciones ({products.length})</option>
              {products.map(([id, title]) => (
                <option key={id} value={id}>
                  {title.length > 45 ? `${title.slice(0, 45)}...` : title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stream List */}
      <div className="channel-stream-wrapper">
        {loading && (
          <div className="channel-empty-state">
            <span className="pulse-dot" /> Cargando preguntas...
          </div>
        )}

        {error && <div className="channel-empty-state text-rose">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="channel-empty-state">
            <MessageSquare size={38} className="text-muted" />
            <p>
              No hay preguntas en esta vista{' '}
              {searchQuery ? 'que coincidan con la búsqueda' : ''}.
            </p>
          </div>
        )}

        {filtered
          .slice((page - 1) * limit, page * limit)
          .map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onApprove={(customText) => handleApprove(q.id, customText)}
              onReject={() => handleReject(q.id)}
              loading={actioning === q.id}
            />
          ))}
      </div>

      {/* Unified Pagination Controls */}
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
          itemName="preguntas"
          pageSizeOptions={[5, 10, 20, 50]}
        />
      )}
    </div>
  )
}

function QuestionCard({
  question: q,
  onApprove,
  onReject,
  loading,
}: {
  question: Question
  onApprove: (customText?: string) => void
  onReject: () => void
  loading: boolean
}) {
  const conf = q.confidence ?? 0
  const isPending = q.status === 'pending'
  const timeAgo = formatTimeAgo(q.createdAt)

  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(q.aiAnswer || '')

  const handleConfirmApprove = () => {
    if (isEditing) {
      onApprove(editedText)
    } else {
      onApprove()
    }
  }

  return (
    <div
      className={`question-card glass-card${
        isPending ? ' card-pending-border' : ''
      }`}
    >
      {/* Top Header */}
      <div className="card-top-bar">
        <div className="product-meta">
          <span className="product-title-pill" title={q.itemTitle}>
            {q.itemTitle || (q.itemId ? `Producto ${q.itemId}` : 'Publicación')}
          </span>
          {q.itemId && (
            <a
              href={`https://articulo.mercadolibre.com.ar/MLA-${q.itemId.replace(
                /\D/g,
                ''
              )}`}
              target="_blank"
              rel="noreferrer"
              className="link-external-icon"
              title="Ver publicación en Mercado Libre"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <span className="time-indicator">
            <Clock size={12} /> {timeAgo}
          </span>
        </div>

        {q.confidence !== undefined && (
          <span className="badge badge-emerald">
            <Sparkles size={12} /> IA {(conf * 100).toFixed(0)}% certeza
          </span>
        )}
      </div>

      {/* Buyer Question */}
      <div className="question-bubble">
        <span className="buyer-tag">PREGUNTA DEL COMPRADOR</span>
        <p className="buyer-text">"{q.text}"</p>
      </div>

      {/* Suggested or Final Answer */}
      {q.aiAnswer && (
        <div className="answer-section">
          <div className="answer-header">
            <span className="answer-label">
              <Sparkles size={14} className="text-blue" />{' '}
              {isPending ? 'Respuesta sugerida por IA:' : 'Respuesta publicada:'}
            </span>
            {isPending && !isEditing && (
              <button
                className="btn-edit-toggle"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={13} /> Modificar respuesta
              </button>
            )}
            {isPending && isEditing && (
              <button
                className="btn-edit-toggle text-dim"
                onClick={() => {
                  setIsEditing(false)
                  setEditedText(q.aiAnswer || '')
                }}
              >
                <RotateCcw size={13} /> Cancelar
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="edit-answer-container">
              <textarea
                className="edit-answer-textarea"
                rows={3}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
            </div>
          ) : (
            <p className="answer-text">"{q.aiAnswer}"</p>
          )}
        </div>
      )}

      {/* Action Bar */}
      {isPending && (
        <div className="card-actions-bar">
          <button
            className="btn-primary"
            onClick={handleConfirmApprove}
            disabled={loading || (isEditing && !editedText.trim())}
          >
            <Check size={16} />{' '}
            {isEditing ? 'Aprobar con cambios' : 'Aprobar y Enviar'}
          </button>
          <button
            className="btn-secondary btn-danger-hover"
            onClick={onReject}
            disabled={loading}
          >
            <X size={16} /> Rechazar
          </button>
        </div>
      )}

      {q.status !== 'pending' && (
        <div className="card-status-footer">
          {q.status === 'auto_answered' && (
            <span className="status-badge emerald">
              ✓ Auto-respondida y publicada en Mercado Libre
            </span>
          )}
          {q.status === 'approved' && (
            <span className="status-badge emerald">
              ✓ Aprobada por operador humano y publicada
            </span>
          )}
          {q.status === 'rejected' && (
            <span className="status-badge rose">
              ✕ Descartada / Rechazada
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} hs`
  return `hace ${Math.floor(h / 24)} días`
}
