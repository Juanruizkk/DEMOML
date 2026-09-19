import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import MonthPicker from '../components/MonthPicker'
import {
  Building2,
  Mail,
  UserPlus,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Store,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Ban,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import './AdminPage.css'

interface Metrics {
  totalTenants?: number
  activeTenants?: number
  totalQuestions?: number
  pendingQuestions?: number
  totalClaims?: number
}

interface TenantOverview {
  sellerId: string
  nickname?: string
  email?: string
  totalQuestions?: number
  autoAnswerEnabled?: boolean
  planId?: string
  billingStatus?: string
  llmResponsesThisMonth?: number
  monthlyLLMLimit?: number
}

interface PendingInvitation {
  id: string
  name: string
  email: string
  createdAt: string
}

interface UnconnectedTenant {
  id: string
  name: string
  email: string
  createdAt: string
}

interface CreateTenantResult {
  userId: string
  activationUrl: string
}

interface LeadRow {
  id: string
  name: string
  email: string
  phone: string
  mlStore: string
  weeklyQuestions: string
  qualified: boolean
  status: 'nuevo' | 'contactado' | 'convertido' | 'descartado'
  createdAt: string
}

type TableRow =
  | { kind: 'tenant';      data: TenantOverview }
  | { kind: 'pending';     data: PendingInvitation }
  | { kind: 'unconnected'; data: UnconnectedTenant }

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
  enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  starter:    'plan-badge--starter',
  pro:        'plan-badge--pro',
  business:   'plan-badge--business',
  enterprise: 'plan-badge--enterprise',
}

function rowName(row: TableRow): string {
  if (row.kind === 'tenant') return row.data.nickname || row.data.sellerId
  return row.data.name
}

function rowEmail(row: TableRow): string {
  return row.data.email || '—'
}

function rowStatus(row: TableRow): 'active' | 'paused' | 'cancelled' | 'pending' | 'no-ml' {
  if (row.kind === 'pending')     return 'pending'
  if (row.kind === 'unconnected') return 'no-ml'
  const t = row.data as TenantOverview
  if (t.billingStatus === 'cancelled') return 'cancelled'
  if (t.autoAnswerEnabled) return 'active'
  return 'paused'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [metrics, setMetrics]         = useState<Metrics | null>(null)
  const [tenants, setTenants]         = useState<TenantOverview[]>([])
  const [pending, setPending]         = useState<PendingInvitation[]>([])
  const [unconnected, setUnconnected] = useState<UnconnectedTenant[]>([])
  const [loading, setLoading]         = useState(true)

  const [search, setSearch]           = useState('')
  const [filterPlan, setFilterPlan]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [inactivating, setInactivating] = useState<string | null>(null)

  const [activeSection, setActiveSection] = useState<'tenants' | 'llm_usage' | 'leads'>('tenants')
  const [llmStats, setLlmStats]   = useState<any | null>(null)
  const [llmMonth, setLlmMonth]   = useState(() => new Date().toISOString().slice(0, 7))
  const [loadingLlm, setLoadingLlm] = useState(false)

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>('all')

  const [showModal, setShowModal]       = useState(false)
  const [newName, setNewName]           = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)
  const [createdLink, setCreatedLink]   = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [resenting, setResenting]       = useState<string | null>(null)
  const [resentLink, setResentLink]     = useState<Record<string, string>>({})
  const [copiedResent, setCopiedResent] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Metrics>('/admin/metrics'),
      api.get<TenantOverview[]>('/admin/tenants'),
      api.get<PendingInvitation[]>('/admin/invitations'),
      api.get<UnconnectedTenant[]>('/admin/unconnected'),
    ]).then(([m, t, p, u]) => {
      setMetrics(m)
      setTenants(t)
      setPending(p)
      setUnconnected(u)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const allRows = useMemo<TableRow[]>(() => {
    const rows: TableRow[] = [
      ...tenants.map(t => ({ kind: 'tenant' as const, data: t })),
      ...pending.map(p => ({ kind: 'pending' as const, data: p })),
      ...unconnected.map(u => ({ kind: 'unconnected' as const, data: u })),
    ]
    return rows
  }, [tenants, pending, unconnected])

  const filtered = useMemo(() => {
    return allRows.filter(row => {
      const name  = rowName(row).toLowerCase()
      const email = rowEmail(row).toLowerCase()
      const q     = search.toLowerCase()
      if (q && !name.includes(q) && !email.includes(q)) return false

      if (filterPlan !== 'all') {
        if (row.kind !== 'tenant') return false
        const plan = (row.data as TenantOverview).planId || 'starter'
        if (plan !== filterPlan) return false
      }

      if (filterStatus !== 'all') {
        if (rowStatus(row) !== filterStatus) return false
      }

      return true
    })
  }, [allRows, search, filterPlan, filterStatus])

  const handleInactivate = async (sellerId: string, currentPlan: string, nextBillingDate: string) => {
    if (!window.confirm('¿Inactivar este tenant? Se cancelará su facturación y se desactivará la IA.')) return
    setInactivating(sellerId)
    try {
      await api.put(`/admin/tenants/${sellerId}/plan`, {
        planId: currentPlan,
        billingStatus: 'cancelled',
        nextBillingDate: nextBillingDate || new Date().toISOString(),
      })
      setTenants(ts => ts.map(t =>
        t.sellerId === sellerId ? { ...t, billingStatus: 'cancelled', autoAnswerEnabled: false } : t
      ))
    } catch (e) {
      console.error(e)
    } finally {
      setInactivating(null)
    }
  }

  const openModal = () => {
    setShowModal(true)
    setNewName('')
    setNewEmail('')
    setCreateError(null)
    setCreatedLink(null)
    setCopied(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setCreatedLink(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      const result = await api.post<CreateTenantResult>('/admin/tenants', { name: newName, email: newEmail })
      setCreatedLink(result.activationUrl)
      setPending(p => [...p, { id: result.userId, name: newName, email: newEmail, createdAt: new Date().toISOString() }])
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = () => {
    if (!createdLink) return
    navigator.clipboard.writeText(createdLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleResendInvitation = async (userId: string) => {
    setResenting(userId)
    try {
      const result = await api.post<{ activationUrl: string }>(`/admin/users/${userId}/resend-invitation`, {})
      setResentLink(prev => ({ ...prev, [userId]: result.activationUrl }))
    } catch (err: any) {
      console.error(err)
    } finally {
      setResenting(null)
    }
  }

  const copyResentLink = (userId: string) => {
    const link = resentLink[userId]
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiedResent(userId)
    setTimeout(() => setCopiedResent(null), 2500)
  }

  const fetchLlmStats = (month: string) => {
    setLoadingLlm(true)
    api.get<any>(`/admin/llm-usage?month=${month}`)
      .then(setLlmStats)
      .catch(console.error)
      .finally(() => setLoadingLlm(false))
  }

  useEffect(() => {
    if (activeSection === 'llm_usage') fetchLlmStats(llmMonth)
  }, [activeSection, llmMonth])

  const fetchLeads = async () => {
    setLeadsLoading(true)
    try {
      const data = await api.get<LeadRow[]>('/leads')
      setLeads(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLeadsLoading(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'leads') fetchLeads()
  }, [activeSection])

  const handleLeadStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/leads/${id}/status`, { status })
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status as LeadRow['status'] } : l))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Super Admin"
        subtitle="Panel de operaciones y gestión de tenants"
        stats={[
          { label: 'Tenants',    value: metrics?.totalTenants    ?? '—', color: 'blue' },
          { label: 'Preguntas',  value: metrics?.totalQuestions  ?? '—', color: 'dim' },
          { label: 'Pendientes', value: metrics?.pendingQuestions ?? '—', color: metrics?.pendingQuestions ? 'amber' : 'dim' },
        ]}
      />

      {loading && <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>}

      {!loading && (
        <>
          <div className="admin-section-tabs">
            <button
              className={`admin-section-tab${activeSection === 'tenants' ? ' admin-section-tab--active' : ''}`}
              onClick={() => setActiveSection('tenants')}
            >
              Tenants
            </button>
            <button
              className={`admin-section-tab${activeSection === 'llm_usage' ? ' admin-section-tab--active' : ''}`}
              onClick={() => setActiveSection('llm_usage')}
            >
              Consumo IA
            </button>
            <button
              className={`admin-section-tab${activeSection === 'leads' ? ' admin-section-tab--active' : ''}`}
              onClick={() => setActiveSection('leads')}
            >
              Leads
            </button>
          </div>

          {activeSection === 'tenants' && (
            <div className="admin-table-container">
              {/* Toolbar */}
              <div className="admin-toolbar">
                <div className="admin-search-wrap">
                  <Search size={15} className="admin-search-icon" />
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Buscar por nombre o email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button className="admin-search-clear" onClick={() => setSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="admin-filters">
                  <div className="admin-filter-group">
                    <Filter size={13} />
                    <select
                      className="admin-filter-select"
                      value={filterPlan}
                      onChange={e => setFilterPlan(e.target.value)}
                    >
                      <option value="all">Todos los planes</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div className="admin-filter-group">
                    <select
                      className="admin-filter-select"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos los estados</option>
                      <option value="active">IA Activa</option>
                      <option value="paused">Pausado</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="pending">Pendiente</option>
                      <option value="no-ml">Sin ML</option>
                    </select>
                  </div>
                </div>

                <button className="btn-new-tenant" onClick={openModal}>
                  <UserPlus size={13} />
                  <span>Nuevo Tenant</span>
                </button>
              </div>

              {/* Table */}
              <div className="admin-table-wrapper glass">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Organización</th>
                      <th>Email</th>
                      <th>Plan</th>
                      <th>Estado</th>
                      <th>Respuestas IA / mes</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="admin-table-empty">
                          Sin resultados para los filtros actuales
                        </td>
                      </tr>
                    )}
                    {filtered.map((row, i) => {
                      const name   = rowName(row)
                      const email  = rowEmail(row)
                      const status = rowStatus(row)
                      const isTenant = row.kind === 'tenant'
                      const t = isTenant ? (row.data as TenantOverview) : null
                      const plan = t?.planId || 'starter'
                      const llmUsed  = t?.llmResponsesThisMonth ?? 0
                      const llmLimit = t?.monthlyLLMLimit ?? 300
                      const usePct   = llmLimit > 0 && llmLimit < 999_999_999 ? llmUsed / llmLimit : null
                      const isActivating = isTenant && inactivating === t?.sellerId

                      return (
                        <tr key={`${row.kind}-${i}`} className="admin-table-row">
                          <td>
                            <div className="admin-row-name-cell">
                              <div className="admin-row-avatar">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span className="admin-row-name">{name}</span>
                            </div>
                          </td>
                          <td className="admin-row-email">{email}</td>
                          <td>
                            {isTenant ? (
                              <span className={`plan-badge ${PLAN_COLORS[plan] || 'plan-badge--starter'}`}>
                                {PLAN_LABELS[plan] || plan}
                              </span>
                            ) : <span className="admin-row-dim">—</span>}
                          </td>
                          <td>
                            <StatusBadge status={status} />
                          </td>
                          <td>
                            {isTenant ? (
                              <div className="admin-llm-cell">
                                <span className={`admin-llm-count${usePct !== null && usePct >= 0.8 ? ' admin-llm-count--warn' : ''}`}>
                                  {llmUsed}
                                  {llmLimit < 999_999_999 && <span className="admin-llm-limit"> / {llmLimit}</span>}
                                  {llmLimit >= 999_999_999 && <span className="admin-llm-limit"> / ∞</span>}
                                </span>
                                {usePct !== null && (
                                  <div className="admin-llm-bar">
                                    <div
                                      className={`admin-llm-bar-fill${usePct >= 0.8 ? ' admin-llm-bar-fill--warn' : ''}`}
                                      style={{ width: `${Math.min(usePct * 100, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : <span className="admin-row-dim">—</span>}
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              {isTenant && (
                                <>
                                  <button
                                    className="btn-action btn-action--primary"
                                    onClick={() => navigate(`/admin/tenants/${t!.sellerId}`)}
                                  >
                                    <ExternalLink size={13} />
                                    Ver detalles
                                    <ChevronRight size={12} />
                                  </button>
                                  {t?.billingStatus !== 'cancelled' && (
                                    <button
                                      className="btn-action btn-action--danger"
                                      disabled={isActivating}
                                      onClick={() => handleInactivate(
                                        t!.sellerId,
                                        t!.planId || 'starter',
                                        t!.billingStatus === 'active' ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : ''
                                      )}
                                    >
                                      <Ban size={13} />
                                      {isActivating ? 'Inactivando…' : 'Inactivar'}
                                    </button>
                                  )}
                                </>
                              )}
                              {row.kind === 'pending' && (
                                <div className="admin-pending-actions">
                                  <button
                                    className="btn-action btn-action--ghost"
                                    disabled={resenting === row.data.id}
                                    onClick={() => handleResendInvitation(row.data.id)}
                                  >
                                    {resenting === row.data.id ? '…' : '↺ Reenviar'}
                                  </button>
                                  {resentLink[row.data.id] && (
                                    <button
                                      className="btn-action btn-action--ghost"
                                      onClick={() => copyResentLink(row.data.id)}
                                    >
                                      {copiedResent === row.data.id ? <Check size={13} /> : <Copy size={13} />}
                                      {copiedResent === row.data.id ? 'Copiado' : 'Copiar link'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {row.kind === 'unconnected' && (
                                <span className="admin-row-dim" style={{ fontSize: '0.78rem' }}>Sin acciones</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="admin-table-count">
                {filtered.length} de {allRows.length} organizaciones
              </p>
            </div>
          )}

          {activeSection === 'leads' && (
            <div className="admin-section">
              <div className="admin-toolbar">
                <span className="admin-section-title">Leads</span>
                <select
                  className="admin-filter-select"
                  value={leadsStatusFilter}
                  onChange={e => setLeadsStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="nuevo">Nuevo</option>
                  <option value="contactado">Contactado</option>
                  <option value="convertido">Convertido</option>
                  <option value="descartado">Descartado</option>
                </select>
                <button className="btn-ghost" onClick={fetchLeads}>↺ Actualizar</button>
              </div>

              {leadsLoading ? (
                <div className="admin-loading">Cargando leads…</div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Tienda ML</th>
                        <th>Preg/sem</th>
                        <th>Calificado</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads
                        .filter(l => leadsStatusFilter === 'all' || l.status === leadsStatusFilter)
                        .map(l => (
                          <tr key={l.id} className="admin-table-row">
                            <td>{l.name}</td>
                            <td>{l.email}</td>
                            <td>{l.phone}</td>
                            <td>{l.mlStore}</td>
                            <td>{l.weeklyQuestions}</td>
                            <td>
                              <span className={`lead-qualified-badge lead-qualified-badge--${l.qualified ? 'yes' : 'no'}`}>
                                {l.qualified ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td>
                              <select
                                className="lead-status-select"
                                value={l.status}
                                onChange={e => handleLeadStatusChange(l.id, e.target.value)}
                              >
                                <option value="nuevo">Nuevo</option>
                                <option value="contactado">Contactado</option>
                                <option value="convertido">Convertido</option>
                                <option value="descartado">Descartado</option>
                              </select>
                            </td>
                            <td>{new Date(l.createdAt).toLocaleDateString('es-AR')}</td>
                          </tr>
                        ))}
                      {leads.filter(l => leadsStatusFilter === 'all' || l.status === leadsStatusFilter).length === 0 && (
                        <tr><td colSpan={8} className="admin-table-empty">No hay leads aún.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === 'llm_usage' && (
            <div className="llm-usage-panel">
              <div className="llm-usage-header">
                <h3>Consumo de IA</h3>
                <MonthPicker value={llmMonth} onChange={setLlmMonth} />
              </div>

              {loadingLlm && <p className="llm-loading">Cargando...</p>}

              {!loadingLlm && llmStats && (
                <>
                  <div className="llm-kpis">
                    <div className="llm-kpi">
                      <span className="llm-kpi-label">💵 Gasto total</span>
                      <span className="llm-kpi-value">${llmStats.totals.totalCostUsd.toFixed(4)} USD</span>
                    </div>
                    <div className="llm-kpi">
                      <span className="llm-kpi-label">🔢 Tokens</span>
                      <span className="llm-kpi-value">{(llmStats.totals.totalTokens / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="llm-kpi">
                      <span className="llm-kpi-label">⚡ Llamadas</span>
                      <span className="llm-kpi-value">{llmStats.totals.totalCalls}</span>
                    </div>
                    <div className="llm-kpi">
                      <span className="llm-kpi-label">🤖 Providers</span>
                      <span className="llm-kpi-value">
                        {Object.entries(llmStats.totals.byProvider as Record<string, { calls: number; costUsd: number }>)
                          .map(([p, s]) => `${p} (${s.calls})`)
                          .join(' · ') || '—'}
                      </span>
                    </div>
                  </div>

                  <table className="llm-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Llamadas</th>
                        <th>Tokens</th>
                        <th>Costo USD</th>
                        <th>Límite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {llmStats.tenants.length === 0 && (
                        <tr><td colSpan={5} className="llm-empty">Sin datos para este mes</td></tr>
                      )}
                      {llmStats.tenants.map((t: any) => (
                        <tr key={t.sellerId}>
                          <td>{t.nickname ?? t.sellerId}</td>
                          <td>{t.totalCalls}</td>
                          <td>{(t.totalTokens / 1000).toFixed(1)}K</td>
                          <td>${t.totalCostUsd.toFixed(4)}</td>
                          <td>{t.spendingLimitUsd != null ? `$${t.spendingLimitUsd}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Tenant Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-ambient-glow" aria-hidden="true" />

            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge">
                  <Store size={22} />
                </div>
                <div className="modal-title-group">
                  <h3 className="modal-title">
                    {createdLink ? '¡Tenant Creado!' : 'Registrar Nuevo Tenant'}
                  </h3>
                  <p className="modal-subtitle">
                    {createdLink
                      ? 'Cuenta de vendedor generada correctamente'
                      : 'Crea una organización y genera la invitación de acceso'}
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={closeModal} title="Cerrar modal">
                <X size={18} />
              </button>
            </div>

            {createdLink ? (
              <div className="modal-success-content">
                <div className="modal-success-banner">
                  <div className="success-icon-wrap">
                    <CheckCircle2 size={24} className="text-emerald" />
                  </div>
                  <div>
                    <h4 className="success-banner-title">Invitación lista para enviar</h4>
                    <p className="success-banner-desc">
                      Compartí este enlace de activación con el vendedor para que configure su clave e inicie sesión.
                    </p>
                  </div>
                </div>

                <div className="activation-link-container">
                  <div className="activation-link-header">
                    <span className="activation-link-tag">Enlace de Activación (24 horas)</span>
                    <span className="activation-link-hint">Un solo uso</span>
                  </div>
                  <div className="activation-link-box">
                    <span className="activation-link-text">{createdLink}</span>
                  </div>
                </div>

                <div className="modal-success-actions">
                  <button
                    className={`btn-modal-copy ${copied ? 'btn-modal-copy--copied' : ''}`}
                    onClick={copyLink}
                  >
                    {copied ? (
                      <><Check size={16} /> ¡Enlace Copiado al Portapapeles!</>
                    ) : (
                      <><Copy size={16} /> Copiar Enlace de Activación</>
                    )}
                  </button>
                  <button className="btn-modal-done" onClick={closeModal}>
                    Finalizar
                  </button>
                </div>
              </div>
            ) : (
              <form className="modal-form" onSubmit={handleCreate}>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="tenant-name">
                    Nombre del Comercio / Empresa
                  </label>
                  <div className="modal-input-wrap">
                    <Building2 size={18} className="modal-input-icon" />
                    <input
                      id="tenant-name"
                      type="text"
                      className="tenant-modal-input"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="ej. Tienda Oficial Samsung"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="tenant-email">
                    Correo Electrónico del Administrador
                  </label>
                  <div className="modal-input-wrap">
                    <Mail size={18} className="modal-input-icon" />
                    <input
                      id="tenant-email"
                      type="email"
                      className="tenant-modal-input"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="ej. admin@tiendaoficial.com"
                      required
                    />
                  </div>
                </div>

                <div className="modal-info-callout">
                  <ShieldCheck size={16} className="callout-icon" />
                  <p className="callout-text">
                    Se generará un usuario vendedor en estado pendiente. Podrá activar su cuenta y conectar Mercado Libre al ingresar.
                  </p>
                </div>

                {createError && (
                  <div className="modal-error-banner" role="alert">
                    <AlertCircle size={17} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="modal-form-actions">
                  <button type="button" className="btn-modal-cancel" onClick={closeModal} disabled={creating}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-modal-submit" disabled={creating}>
                    {creating ? (
                      <span className="btn-loading-row">
                        <span className="pulse-dot" /> Registrando...
                      </span>
                    ) : (
                      <><span>Crear Tenant</span><ArrowRight size={16} /></>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ReturnType<typeof rowStatus> }) {
  const map = {
    active:    { label: 'IA Activa',  cls: 'status-badge--active' },
    paused:    { label: 'Pausado',    cls: 'status-badge--paused' },
    cancelled: { label: 'Cancelado',  cls: 'status-badge--cancelled' },
    pending:   { label: 'Pendiente',  cls: 'status-badge--pending' },
    'no-ml':   { label: 'Sin ML',     cls: 'status-badge--no-ml' },
  }
  const { label, cls } = map[status]
  return <span className={`status-badge ${cls}`}>{label}</span>
}
