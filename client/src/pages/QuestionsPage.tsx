import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
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

// Shape returned by GET /api/questions
interface ApiQuestion {
  id: string
  text: string
  itemId: string
  appStatus: string
  suggestedAnswer?: string
  finalAnswer?: string
  confidence?: number
  receivedAt?: string
}

interface GroupedResponse {
  pending_review: ApiQuestion[]
  auto_answered:  ApiQuestion[]
  other:          ApiQuestion[]
}

function normalize(q: ApiQuestion): Question {
  const statusMap: Record<string, Question['status']> = {
    pending_review: 'pending',
    auto_answered:  'auto_answered',
    approved:       'approved',
    rejected:       'rejected',
  }
  return {
    id:        q.id,
    text:      q.text,
    itemId:    q.itemId,
    status:    statusMap[q.appStatus] ?? 'approved',
    aiAnswer:  q.suggestedAnswer ?? q.finalAnswer,
    confidence: q.confidence,
    createdAt: q.receivedAt ?? new Date().toISOString(),
  }
}

type Filter = 'pending' | 'auto_answered' | 'resolved'

export default function QuestionsPage() {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState<Filter>('pending')
  const [productTab, setProductTab] = useState('all')
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<GroupedResponse>('/questions')
      const flat = [
        ...(data.pending_review ?? []),
        ...(data.auto_answered  ?? []),
        ...(data.other          ?? []),
      ].map(normalize)
      setQuestions(flat)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActioning(id)
    try {
      await api.post(`/questions/${id}/${action}`)
      setQuestions(qs => qs.map(q =>
        q.id === id ? { ...q, status: action === 'approve' ? 'approved' : 'rejected' } : q
      ))
    } catch {
      // silent — item stays, user can retry
    } finally {
      setActioning(null)
    }
  }

  // Derive unique product tabs
  const products = Array.from(new Set(questions.map(q => q.itemId))).slice(0, 8)

  const filtered = questions.filter(q => {
    if (productTab !== 'all' && q.itemId !== productTab) return false
    if (filter === 'pending')      return q.status === 'pending'
    if (filter === 'auto_answered') return q.status === 'auto_answered'
    return q.status === 'approved' || q.status === 'rejected'
  })

  const counts = {
    pending:      questions.filter(q => q.status === 'pending').length,
    auto_answered: questions.filter(q => q.status === 'auto_answered').length,
    resolved:     questions.filter(q => q.status === 'approved' || q.status === 'rejected').length,
  }

  const sellerLabel = user?.role === 'super_admin' ? 'Super Admin' : user?.name || 'Vendedor'

  return (
    <div className="page">
      <PageHeader
        title="Preguntas"
        subtitle={`Pre-venta · ${sellerLabel}`}
        stats={[
          { label: 'Pendientes', value: counts.pending, color: counts.pending > 0 ? 'amber' : 'dim' },
          { label: 'Auto-respondidas', value: counts.auto_answered, color: 'emerald' },
          { label: 'Resueltas', value: counts.resolved, color: 'dim' },
        ]}
      />

      {/* Product tabs */}
      {products.length > 0 && (
        <div className="product-tabs">
          <button
            className={`product-tab${productTab === 'all' ? ' active' : ''}`}
            onClick={() => setProductTab('all')}
          >
            Todos
          </button>
          {products.map(id => (
            <button
              key={id}
              className={`product-tab${productTab === id ? ' active' : ''}`}
              onClick={() => setProductTab(id)}
            >
              {questions.find(q => q.itemId === id)?.itemTitle?.slice(0, 22) || `Producto ${id.slice(-4)}`}
            </button>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="filter-tabs">
        {(['pending', 'auto_answered', 'resolved'] as Filter[]).map(f => (
          <button
            key={f}
            className={`filter-tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'pending' ? 'Pendientes' : f === 'auto_answered' ? 'Auto-respondidas' : 'Resueltas'}
            <span className="filter-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="questions-list">
        {loading && (
          <div className="list-empty">
            <span className="pulse-dot" /> Cargando preguntas…
          </div>
        )}

        {error && (
          <div className="list-error">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="list-empty">
            <span className="list-empty-icon">◎</span>
            <p>No hay preguntas {filter === 'pending' ? 'pendientes' : filter === 'auto_answered' ? 'auto-respondidas' : 'resueltas'}</p>
          </div>
        )}

        {filtered.map(q => (
          <QuestionCard
            key={q.id}
            question={q}
            onApprove={() => act(q.id, 'approve')}
            onReject={() => act(q.id, 'reject')}
            loading={actioning === q.id}
          />
        ))}
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
  onApprove: () => void
  onReject: () => void
  loading: boolean
}) {
  const conf = q.confidence ?? 0
  const confColor = conf >= 0.8 ? 'emerald' : conf >= 0.6 ? 'amber' : 'rose'
  const isPending = q.status === 'pending'
  const timeAgo = formatTimeAgo(q.createdAt)

  return (
    <div className={`question-card glass${isPending ? ' question-card--pending' : ''}`}>
      <div className="question-card-header">
        <div className="question-meta">
          {q.itemTitle && (
            <span className="question-product">{q.itemTitle.slice(0, 40)}</span>
          )}
          <span className="question-time">{timeAgo}</span>
        </div>
        {q.confidence !== undefined && (
          <span className={`confidence-badge confidence-badge--${confColor}`}>
            IA {Math.round(conf * 100)}%
          </span>
        )}
      </div>

      <p className="question-text">{q.text}</p>

      {q.aiAnswer && (
        <div className="question-answer">
          <span className="question-answer-label">Respuesta sugerida</span>
          <p className="question-answer-text">{q.aiAnswer}</p>
        </div>
      )}

      {isPending && (
        <div className="question-actions">
          <button
            className="btn-approve"
            onClick={onApprove}
            disabled={loading}
          >
            ✓ Aprobar
          </button>
          <button
            className="btn-reject"
            onClick={onReject}
            disabled={loading}
          >
            ✕ Rechazar
          </button>
        </div>
      )}

      {q.status !== 'pending' && (
        <div className={`question-status question-status--${q.status}`}>
          {q.status === 'auto_answered' ? '◎ Auto-respondida' :
           q.status === 'approved'      ? '✓ Aprobada' : '✕ Rechazada'}
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}
