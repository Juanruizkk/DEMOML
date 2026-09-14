import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import {
  Building2,
  Mail,
  UserPlus,
  Sparkles,
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
  Users,
  MessageSquare,
  Send,
  ShieldAlert,
  KeyRound,
  Layers,
  Radio
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
}

interface PendingInvitation {
  id: string
  name: string
  email: string
  createdAt: string
}

interface CreateTenantResult {
  userId: string
  activationUrl: string
}

interface PermissionMeta {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
  soon?: boolean
}

interface TenantIntegrations {
  whatsappMode: 'platform_shared' | 'custom_byo'
  customPhoneNumberId: string
  customAccessToken: string
  llmProvider: 'groq' | 'openai' | 'anthropic'
  llmApiKey: string
  hasLlmApiKey: boolean
  hasCustomAccessToken: boolean
}

const CHANNEL_PERMISSIONS: PermissionMeta[] = [
  {
    key: 'whatsappEnabled',
    label: 'Canal WhatsApp',
    desc: 'Alertas y aprobación de preguntas directamente vía WhatsApp',
    icon: <MessageSquare size={16} />,
  },
  {
    key: 'telegramEnabled',
    label: 'Bot Telegram',
    desc: 'Bot interactivo para el equipo de ventas en Telegram',
    icon: <Send size={16} />,
  },
  {
    key: 'emailEnabled',
    label: 'Alertas por Email',
    desc: 'Notificaciones de urgencias y vencimiento SLA vía Resend',
    icon: <Mail size={16} />,
  },
]

const MODULE_PERMISSIONS: PermissionMeta[] = [
  {
    key: 'preSaleEnabled',
    label: 'Respuestas Pre-venta',
    desc: 'Automatización con IA para preguntas antes de la compra',
    icon: <Sparkles size={16} />,
  },
  {
    key: 'postSaleEnabled',
    label: 'Gestión Post-venta',
    desc: 'Monitoreo de reclamos, mediaciones y tiempos de SLA',
    icon: <ShieldAlert size={16} />,
  },
  {
    key: 'multiUserEnabled',
    label: 'Equipo / Multi-Usuario',
    desc: 'Múltiples vendedores y colaboradores con accesos propios',
    icon: <Users size={16} />,
  },
]

export default function AdminPage() {
  const [metrics, setMetrics]           = useState<Metrics | null>(null)
  const [tenants, setTenants]           = useState<TenantOverview[]>([])
  const [pending, setPending]           = useState<PendingInvitation[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [copiedId, setCopiedId]         = useState(false)
  const [localPerms, setLocalPerms]     = useState<Record<string, boolean>>({})
  const [localIntegrations, setLocalIntegrations] = useState<TenantIntegrations>({
    whatsappMode: 'platform_shared',
    customPhoneNumberId: '',
    customAccessToken: '',
    llmProvider: 'groq',
    llmApiKey: '',
    hasLlmApiKey: false,
    hasCustomAccessToken: false,
  })
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [savedIntegrations, setSavedIntegrations]   = useState(false)
  const [clearLlmKey, setClearLlmKey]               = useState(false)
  const [clearWaToken, setClearWaToken]             = useState(false)

  const [activeSection, setActiveSection] = useState<'tenants' | 'llm_usage'>('tenants')
  const [llmStats, setLlmStats] = useState<any | null>(null)
  const [llmMonth, setLlmMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [loadingLlm, setLoadingLlm] = useState(false)

  // Modal state
  const [showModal, setShowModal]       = useState(false)
  const [newName, setNewName]           = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)
  const [createdLink, setCreatedLink]   = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [resetSent, setResetSent]       = useState<string | null>(null)
  const [resetting, setResetting]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Metrics>('/admin/metrics'),
      api.get<TenantOverview[]>('/admin/tenants'),
      api.get<PendingInvitation[]>('/admin/invitations'),
    ]).then(([m, t, p]) => {
      setMetrics(m)
      setTenants(t)
      setPending(p)
      // Auto-select first tenant if available
      if (t.length > 0 && !selected) {
        selectTenant(t[0])
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setResetSent(null)
    setSavedSuccess(false)
  }, [selected])

  const selectTenant = async (t: TenantOverview) => {
    setSelected(t.sellerId)
    setClearLlmKey(false)
    setClearWaToken(false)
    try {
      const detail = await api.get<{ settings: Record<string, any> }>(`/admin/tenants/${t.sellerId}`)
      const s = detail.settings || {}
      setLocalPerms(s.permissions || {
        whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
        preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false,
      })
      setLocalIntegrations({
        whatsappMode: s.whatsappMode || 'platform_shared',
        customPhoneNumberId: s.customPhoneNumberId || '',
        customAccessToken: '',
        llmProvider: s.llmProvider || 'groq',
        llmApiKey: '',
        hasLlmApiKey: s.llmApiKey === '***',
        hasCustomAccessToken: s.customAccessToken === '***',
      })
    } catch {
      setLocalPerms({ whatsappEnabled: true, telegramEnabled: true, emailEnabled: false, preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false })
    }
  }

  const savePermissions = async () => {
    if (!selected) return
    setSaving(true)
    setSavedSuccess(false)
    try {
      await api.put(`/admin/tenants/${selected}/permissions`, { permissions: localPerms })
      setTenants(ts => ts.map(t =>
        t.sellerId === selected ? { ...t, permissions: { ...localPerms } } : t
      ))
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const saveIntegrations = async () => {
    if (!selected) return
    setSavingIntegrations(true)
    setSavedIntegrations(false)
    try {
      const payload: Record<string, string> = {
        whatsappMode: localIntegrations.whatsappMode,
        llmProvider: localIntegrations.llmProvider,
      }
      if (localIntegrations.customPhoneNumberId) payload.customPhoneNumberId = localIntegrations.customPhoneNumberId
      if (localIntegrations.customAccessToken)   payload.customAccessToken = localIntegrations.customAccessToken
      else if (clearWaToken)                     payload.customAccessToken = ""
      if (localIntegrations.llmApiKey)           payload.llmApiKey = localIntegrations.llmApiKey
      else if (clearLlmKey)                      payload.llmApiKey = ""

      await api.patch(`/admin/tenants/${selected}/integrations`, { integrations: payload })
      setSavedIntegrations(true)
      setClearLlmKey(false)
      setClearWaToken(false)
      setLocalIntegrations(prev => ({
        ...prev,
        customAccessToken: '',
        llmApiKey: '',
        hasLlmApiKey: Boolean(prev.llmApiKey) || (prev.hasLlmApiKey && !clearLlmKey),
        hasCustomAccessToken: Boolean(prev.customAccessToken) || (prev.hasCustomAccessToken && !clearWaToken),
      }))
      setTimeout(() => setSavedIntegrations(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingIntegrations(false)
    }
  }

  const handleCopySellerId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
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

  const handleResetPassword = async (userId: string, email: string) => {
    setResetting(userId)
    try {
      await api.post(`/admin/users/${userId}/reset-password`, {})
      setResetSent(email)
      setTimeout(() => setResetSent(null), 4000)
    } catch (err: any) {
      console.error('Error al enviar reset:', err)
    } finally {
      setResetting(null)
    }
  }

  const handleResetForTenant = async (email: string) => {
    setResetting(email)
    try {
      await api.post('/admin/reset-password', { email })
      setResetSent(email)
      setTimeout(() => setResetSent(null), 4000)
    } catch (err: any) {
      console.error('Error al enviar reset:', err)
    } finally {
      setResetting(null)
    }
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

  const selectedTenant = tenants.find(t => t.sellerId === selected)

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
          </div>

          {activeSection === 'tenants' && (
        <div className="admin-layout">
          {/* Tenant list */}
          <div className="tenant-list">
            <div className="tenant-list-header">
              <div className="tenant-list-header-left">
                <Store size={16} className="text-blue" />
                <span className="tenant-list-title">Organizaciones</span>
                <span className="tenant-count-pill">{tenants.length}</span>
              </div>
              <button className="btn-new-tenant" onClick={openModal}>
                <UserPlus size={13} />
                <span>Nuevo Tenant</span>
              </button>
            </div>

            {/* Pending invitations */}
            {pending.length > 0 && (
              <div className="pending-section">
                <div className="pending-section-title">
                  <Clock size={13} />
                  <span>Invitaciones pendientes ({pending.length})</span>
                </div>
                {pending.map(inv => (
                  <div key={inv.id} className="tenant-row tenant-row--pending">
                    <div className="tenant-row-info">
                      <span className="tenant-row-name">{inv.name}</span>
                      <span className="tenant-row-email">{inv.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge-pending">Pendiente</span>
                      <button
                        className="btn-resend-invite"
                        disabled={resetting === inv.id}
                        onClick={() => handleResetPassword(inv.id, inv.email)}
                        title="Reenviar link de activación"
                      >
                        {resetting === inv.id ? '…' : '↺ Reenviar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tenants.length === 0 && pending.length === 0 && (
              <p className="list-empty" style={{ padding: '24px 16px' }}>Sin tenants registrados</p>
            )}

            <div className="tenant-items-wrapper">
              {tenants.map(t => {
                const isSelected = selected === t.sellerId
                const initial = (t.nickname || t.sellerId).charAt(0).toUpperCase()
                return (
                  <button
                    key={t.sellerId}
                    className={`tenant-row${isSelected ? ' tenant-row--active' : ''}`}
                    onClick={() => selectTenant(t)}
                  >
                    <div className="tenant-row-avatar">
                      {initial}
                    </div>
                    <div className="tenant-row-info">
                      <span className="tenant-row-name">{t.nickname || t.sellerId}</span>
                      {t.email && <span className="tenant-row-email">{t.email}</span>}
                    </div>
                    <div className="tenant-row-stats">
                      {t.totalQuestions !== undefined && (
                        <span className="tenant-row-badge">{t.totalQuestions} Q</span>
                      )}
                      {t.autoAnswerEnabled && (
                        <span className="tenant-row-badge tenant-row-badge--green">IA ✓</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tenant detail */}
          {selectedTenant ? (
            <div className="tenant-detail glass">
              <div className="tenant-detail-header">
                <div className="tenant-detail-header-left">
                  <div className="tenant-detail-avatar">
                    <Store size={24} />
                  </div>
                  <div className="tenant-detail-titles">
                    <div className="tenant-name-row">
                      <h3 className="tenant-detail-name">{selectedTenant.nickname || selectedTenant.sellerId}</h3>
                      {selectedTenant.autoAnswerEnabled ? (
                        <span className="tenant-status-pill tenant-status-pill--active">
                          <CheckCircle2 size={13} />
                          IA Activa
                        </span>
                      ) : (
                        <span className="tenant-status-pill tenant-status-pill--paused">
                          <Clock size={13} />
                          Pausado
                        </span>
                      )}
                    </div>
                    <div className="tenant-meta-pills">
                      <button
                        type="button"
                        className="meta-pill meta-pill--copy"
                        onClick={() => handleCopySellerId(selectedTenant.sellerId)}
                        title="Copiar Seller ID"
                      >
                        <span className="meta-pill-label">Seller ID:</span>
                        <span className="meta-pill-val">{selectedTenant.sellerId}</span>
                        {copiedId ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                      {selectedTenant.email && (
                        <span className="meta-pill">
                          <Mail size={12} />
                          <span>{selectedTenant.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="permissions-section">
                <div className="permissions-header">
                  <div className="header-icon-box blue">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="permissions-title">Permisos & Módulos Habilitados</h4>
                    <p className="permissions-hint">Configurá las capacidades y canales activos para este cliente.</p>
                  </div>
                </div>

                <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-dim)', margin: 0 }}>Canales de Alerta</p>
                <div className="permissions-grid">
                  {CHANNEL_PERMISSIONS.map((item) => {
                    const isChecked = Boolean(localPerms[item.key])
                    return (
                      <div
                        key={item.key}
                        className={`permission-item${isChecked ? ' permission-item--active' : ''}`}
                        onClick={() => setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                      >
                        <div className="permission-item-icon">{item.icon}</div>
                        <div className="permission-info">
                          <div className="permission-label-row">
                            <span className="permission-label">{item.label}</span>
                            {item.soon && <span className="permission-soon">próximamente</span>}
                          </div>
                          <span className="permission-desc">{item.desc}</span>
                        </div>
                        <button type="button" className={`toggle${isChecked ? ' toggle--on' : ''}`} onClick={(e) => { e.stopPropagation(); setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] })) }}>
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div style={{ height: '1px', background: 'var(--border-glass)' }} />

                <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-dim)', margin: 0 }}>Módulos Funcionales</p>
                <div className="permissions-grid">
                  {MODULE_PERMISSIONS.map((item) => {
                    const isChecked = Boolean(localPerms[item.key])
                    return (
                      <div
                        key={item.key}
                        className={`permission-item${isChecked ? ' permission-item--active' : ''}`}
                        onClick={() => setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                      >
                        <div className="permission-item-icon">{item.icon}</div>
                        <div className="permission-info">
                          <div className="permission-label-row">
                            <span className="permission-label">{item.label}</span>
                            {item.soon && <span className="permission-soon">próximamente</span>}
                          </div>
                          <span className="permission-desc">{item.desc}</span>
                        </div>
                        <button type="button" className={`toggle${isChecked ? ' toggle--on' : ''}`} onClick={(e) => { e.stopPropagation(); setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] })) }}>
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="admin-actions-bar">
                  <button className="btn-save" onClick={savePermissions} disabled={saving}>
                    {saving ? 'Guardando cambios…' : savedSuccess ? '✓ Permisos Guardados' : 'Guardar Configuración'}
                  </button>
                </div>

                {selectedTenant.email && (
                  <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Acceso & Contraseña</p>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', margin: '2px 0 0' }}>Enviá un enlace de restablecimiento al correo del tenant</p>
                    </div>
                    <button
                      type="button"
                      className="btn-admin-reset"
                      disabled={resetting === selectedTenant.email}
                      onClick={() => handleResetForTenant(selectedTenant.email!)}
                    >
                      <KeyRound size={14} />
                      {resetting === selectedTenant.email ? 'Enviando email…' : 'Reset Contraseña'}
                    </button>
                  </div>
                )}

                {resetSent && (
                  <div className="admin-alert admin-alert--success">
                    <CheckCircle2 size={16} />
                    <span>Se envió el correo de restablecimiento a <strong>{resetSent}</strong></span>
                  </div>
                )}
              </div>

              {/* Integrations section */}
              <div className="permissions-section" style={{ marginTop: '24px' }}>
                <div className="permissions-header">
                  <div className="header-icon-box blue">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 className="permissions-title">Integraciones del Cliente</h4>
                    <p className="permissions-hint">Credenciales propias del cliente para WhatsApp y LLM.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  {/* WhatsApp — solo si el canal está habilitado */}
                  {localPerms.whatsappEnabled !== false && <fieldset style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <legend style={{ padding: '0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>WhatsApp</legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Modo</label>
                      <select
                        className="input-field"
                        value={localIntegrations.whatsappMode}
                        onChange={e => setLocalIntegrations(p => ({ ...p, whatsappMode: e.target.value as 'platform_shared' | 'custom_byo' }))}
                      >
                        <option value="platform_shared">Compartido (número de la plataforma)</option>
                        <option value="custom_byo">Propio del cliente (custom WABA)</option>
                      </select>

                      {localIntegrations.whatsappMode === 'custom_byo' && (
                        <>
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Phone Number ID</label>
                          <input
                            className="input-field"
                            type="text"
                            placeholder="Ej: 123456789012345"
                            value={localIntegrations.customPhoneNumberId}
                            onChange={e => setLocalIntegrations(p => ({ ...p, customPhoneNumberId: e.target.value }))}
                          />
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Access Token {localIntegrations.hasCustomAccessToken && <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓ configurado</span>}
                          </label>
                          <input
                            className="input-field"
                            type="password"
                            placeholder={localIntegrations.hasCustomAccessToken ? 'Dejar vacío para mantener el actual' : 'Pegar token de acceso'}
                            value={localIntegrations.customAccessToken}
                            onChange={e => { setLocalIntegrations(p => ({ ...p, customAccessToken: e.target.value })); setClearWaToken(false) }}
                          />
                          {localIntegrations.hasCustomAccessToken && !localIntegrations.customAccessToken && (
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={clearWaToken} onChange={e => setClearWaToken(e.target.checked)} />
                              Limpiar token (volver a número de plataforma)
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </fieldset>}

                  {/* LLM */}
                  <fieldset style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <legend style={{ padding: '0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Modelo de IA (LLM)</legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Proveedor</label>
                      <select
                        className="input-field"
                        value={localIntegrations.llmProvider}
                        onChange={e => setLocalIntegrations(p => ({ ...p, llmProvider: e.target.value as 'groq' | 'openai' | 'anthropic' }))}
                      >
                        <option value="groq">Groq (recomendado — gratis)</option>
                        <option value="openai">OpenAI (GPT-4o mini)</option>
                        <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                      </select>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        API Key {localIntegrations.hasLlmApiKey && <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓ configurada</span>}
                      </label>
                      <input
                        className="input-field"
                        type="password"
                        placeholder={localIntegrations.hasLlmApiKey ? 'Dejar vacío para mantener la actual' : 'Pegar API key del cliente'}
                        value={localIntegrations.llmApiKey}
                        onChange={e => { setLocalIntegrations(p => ({ ...p, llmApiKey: e.target.value })); setClearLlmKey(false) }}
                      />
                      {localIntegrations.hasLlmApiKey && !localIntegrations.llmApiKey && (
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={clearLlmKey} onChange={e => setClearLlmKey(e.target.checked)} />
                          Limpiar clave (usar credenciales de plataforma)
                        </label>
                      )}
                    </div>
                  </fieldset>
                </div>

                <div className="admin-actions-bar" style={{ marginTop: '16px' }}>
                  <button className="btn-save" onClick={saveIntegrations} disabled={savingIntegrations}>
                    {savingIntegrations ? 'Guardando…' : savedIntegrations ? '✓ Integraciones Guardadas' : 'Guardar Integraciones'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="tenant-empty-hero glass">
              <div className="empty-hero-icon-box">
                <Store size={44} />
              </div>
              <h3>Centro de Control Multi-Tenant</h3>
              <p className="empty-hero-desc">
                Seleccioná una organización del listado lateral para inspeccionar sus métricas, 
                configurar canales de alerta o habilitar el módulo de Equipo Multi-Usuario.
              </p>
              <div className="empty-hero-stats">
                <div className="empty-stat-item">
                  <span className="empty-stat-val">{tenants.length}</span>
                  <span className="empty-stat-lbl">Organizaciones</span>
                </div>
                <div className="empty-stat-item">
                  <span className="empty-stat-val" style={{ color: '#10b981' }}>
                    {tenants.filter(t => t.autoAnswerEnabled).length}
                  </span>
                  <span className="empty-stat-lbl">IA Activa</span>
                </div>
                <div className="empty-stat-item">
                  <span className="empty-stat-val" style={{ color: '#f59e0b' }}>
                    {pending.length}
                  </span>
                  <span className="empty-stat-lbl">Invitaciones</span>
                </div>
              </div>
              <button className="btn-primary" onClick={openModal} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={16} />
                Registrar Nuevo Tenant
              </button>
            </div>
          )}
        </div>
          )}

          {activeSection === 'llm_usage' && (
            <div className="llm-usage-panel">
              <div className="llm-usage-header">
                <h3>Consumo de IA</h3>
                <input
                  type="month"
                  value={llmMonth}
                  onChange={(e) => setLlmMonth(e.target.value)}
                  className="llm-month-picker"
                />
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
            {/* Modal Glow Accents */}
            <div className="modal-ambient-glow" aria-hidden="true" />

            {/* Modal Header */}
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

            {/* Modal Body */}
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
                      <>
                        <Check size={16} /> ¡Enlace Copiado al Portapapeles!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copiar Enlace de Activación
                      </>
                    )}
                  </button>

                  <button className="btn-modal-done" onClick={closeModal}>
                    Finalizar
                  </button>
                </div>
              </div>
            ) : (
              <form className="modal-form" onSubmit={handleCreate}>
                {/* Field 1: Nombre */}
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

                {/* Field 2: Email */}
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

                {/* Info Callout */}
                <div className="modal-info-callout">
                  <ShieldCheck size={16} className="callout-icon" />
                  <p className="callout-text">
                    Se generará un usuario vendedor en estado pendiente. Podrá activar su cuenta y conectar Mercado Libre al ingresar.
                  </p>
                </div>

                {/* Error Banner */}
                {createError && (
                  <div className="modal-error-banner" role="alert">
                    <AlertCircle size={17} />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="modal-form-actions">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={closeModal}
                    disabled={creating}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-modal-submit" disabled={creating}>
                    {creating ? (
                      <span className="btn-loading-row">
                        <span className="pulse-dot" /> Registrando...
                      </span>
                    ) : (
                      <>
                        <span>Crear Tenant</span>
                        <ArrowRight size={16} />
                      </>
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

