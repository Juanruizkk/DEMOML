import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
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
  AlertCircle
} from 'lucide-react'
import PaginationControls, { PaginationMetadata } from '../components/PaginationControls'
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

type Filter = 'pending' | 'auto_answered' | 'resolved'

export default function QuestionsPage() {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('pending')
  const [productTab, setProductTab] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [actioning, setActioning] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    loadQuestions()
  }, [])

  const handleFilterChange = (f: Filter) => {
    setFilter(f)
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

  const loadQuestions = async () => {
    setLoading(true)
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
    }
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
      showToast('✓ Pregunta aprobada y respuesta enviada')
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
      showToast('🗑️ Pregunta descartada/rechazada')
    } catch (err: any) {
      alert(`Error al rechazar: ${err.message}`)
    } finally {
      setActioning(null)
    }
  }

  // Derive unique product tabs with real titles
  const productsMap = new Map<string, string>()
  for (const q of questions) {
    if (q.itemId && !productsMap.has(q.itemId)) {
      productsMap.set(q.itemId, q.itemTitle || `Producto ${q.itemId.slice(-4)}`)
    }
  }
  const products = Array.from(productsMap.entries())

  const filtered = questions.filter((q) => {
    if (productTab !== 'all' && q.itemId !== productTab) return false
    if (filter === 'pending') return q.status === 'pending'
    if (filter === 'auto_answered') return q.status === 'auto_answered'
    return q.status === 'approved' || q.status === 'rejected'
  })

  const counts = {
    pending: questions.filter((q) => q.status === 'pending').length,
    auto_answered: questions.filter((q) => q.status === 'auto_answered').length,
    resolved: questions.filter(
      (q) => q.status === 'approved' || q.status === 'rejected'
    ).length,
  }

  const sellerLabel =
    user?.role === 'super_admin'
      ? 'Super Admin'
      : user?.name || 'Vendedor'

  return (
    <div className="page-container">
      <PageHeader
        title="Preguntas Pre-Venta"
        subtitle={`Bandeja de atención automática y aprobación de IA · ${sellerLabel}`}
        stats={[
          {
            label: 'Pendientes de Revisión',
            value: counts.pending,
            color: counts.pending > 0 ? 'amber' : 'dim',
          },
          {
            label: 'Auto-Respondidas',
            value: counts.auto_answered,
            color: 'emerald',
          },
          { label: 'Resueltas', value: counts.resolved, color: 'blue' },
        ]}
      />

      <div className="questions-body">
        {/* Toast alert */}
        {toastMessage && (
          <div className="action-toast">
            <CheckCircle2 size={16} className="text-emerald" /> {toastMessage}
          </div>
        )}

        {/* Product Filter Tabs */}
        {products.length > 0 && (
          <div className="product-tabs-wrapper">
            <span className="tabs-lead-label">FILTRAR POR PUBLICACIÓN:</span>
            <div className="product-tabs">
              <button
                className={`product-pill${productTab === 'all' ? ' active' : ''}`}
                onClick={() => handleProductTabChange('all')}
              >
                Todas las publicaciones
              </button>
              {products.map(([id, title]) => (
                <button
                  key={id}
                  className={`product-pill${productTab === id ? ' active' : ''}`}
                  onClick={() => handleProductTabChange(id)}
                  title={title}
                >
                  {title.length > 28 ? `${title.slice(0, 28)}...` : title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="filter-tabs-row">
          {(['pending', 'auto_answered', 'resolved'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => handleFilterChange(f)}
            >
              {f === 'pending'
                ? '🟡 Pendientes de Aprobación'
                : f === 'auto_answered'
                ? '🟢 Auto-respondidas por IA'
                : '✓ Resueltas'}
              <span className={`count-pill ${counts[f] > 0 ? 'highlight' : ''}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* List Content */}
        <div className="questions-stream">
          {loading && (
            <div className="state-empty">
              <span className="pulse-dot" /> Cargando preguntas...
            </div>
          )}

          {error && <div className="state-empty error">{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="state-empty">
              <MessageSquare size={36} className="text-muted" />
              <p>
                No hay preguntas{' '}
                {filter === 'pending'
                  ? 'pendientes de revisión'
                  : filter === 'auto_answered'
                  ? 'auto-respondidas'
                  : 'resueltas'}
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
            itemName="preguntas"
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}
      </div>
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

  // Edit response state
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
      {/* Header Info */}
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
              title="Ver en Mercado Libre"
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
            <Sparkles size={12} /> IA {(conf * 100).toFixed(0)}% de certeza
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
                <RotateCcw size={13} /> Cancelar edición
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

      {/* Actions / Status Bottom */}
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
