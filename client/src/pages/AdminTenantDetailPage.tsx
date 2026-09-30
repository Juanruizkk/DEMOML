import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import LLMUsageCard from '../components/LLMUsageCard'
import {
  ArrowLeft,
  Store,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  MessageSquare,
  Send,
  Users,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Clock,
  KeyRound,
  Layers,
  Radio,
} from 'lucide-react'
import './AdminPage.css'
import './AdminTenantDetailPage.css'

interface TenantDetail {
  sellerId: string
  nickname?: string
  email?: string
  autoAnswerEnabled?: boolean
  settings: Record<string, any>
}

interface PermissionMeta {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
}

const CHANNEL_PERMISSIONS: PermissionMeta[] = [
  { key: 'whatsappEnabled', label: 'Canal WhatsApp',   desc: 'Alertas y aprobación de preguntas vía WhatsApp',              icon: <MessageSquare size={16} /> },
  { key: 'telegramEnabled', label: 'Bot Telegram',     desc: 'Bot interactivo para el equipo de ventas en Telegram',        icon: <Send size={16} /> },
  { key: 'emailEnabled',    label: 'Alertas por Email', desc: 'Notificaciones de urgencias y vencimiento SLA vía Resend',   icon: <Mail size={16} /> },
]

const MODULE_PERMISSIONS: PermissionMeta[] = [
  { key: 'preSaleEnabled',   label: 'Respuestas Pre-venta',  desc: 'Automatización con IA para preguntas antes de la compra', icon: <Sparkles size={16} /> },
  { key: 'postSaleEnabled',  label: 'Gestión Post-venta',    desc: 'Monitoreo de reclamos, mediaciones y tiempos de SLA',      icon: <ShieldAlert size={16} /> },
  { key: 'multiUserEnabled', label: 'Equipo / Multi-Usuario', desc: 'Múltiples vendedores con accesos propios',                icon: <Users size={16} /> },
]

const TABS = [
  { id: 'general',     label: 'General',       icon: <Store size={15} /> },
  { id: 'integrations', label: 'Integraciones', icon: <Layers size={15} /> },
  { id: 'billing',     label: 'Plan & Billing', icon: <Radio size={15} /> },
  { id: 'ia_usage',    label: 'Consumo IA',     icon: <Sparkles size={15} /> },
]

export default function AdminTenantDetailPage() {
  const { sellerId } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading]       = useState(true)
  const [detail, setDetail]         = useState<TenantDetail | null>(null)
  const [activeTab, setActiveTab]   = useState('general')
  const [copiedId, setCopiedId]     = useState(false)
  const [resetSent, setResetSent]   = useState<string | null>(null)
  const [resetting, setResetting]   = useState(false)

  // Permissions
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({})
  const [saving, setSaving]         = useState(false)
  const [savedPerms, setSavedPerms] = useState(false)

  // Integrations
  const [localInt, setLocalInt] = useState({
    whatsappMode: 'platform_shared' as 'platform_shared' | 'custom_byo',
    customPhoneNumberId: '',
    customAccessToken: '',
    llmProvider: 'groq' as 'groq' | 'openai' | 'anthropic',
    llmApiKey: '',
    hasLlmApiKey: false,
    hasCustomAccessToken: false,
  })
  const [clearLlmKey, setClearLlmKey]   = useState(false)
  const [clearWaToken, setClearWaToken] = useState(false)
  const [savingInt, setSavingInt]       = useState(false)
  const [savedInt, setSavedInt]         = useState(false)

  // Plan
  const [localPlan, setLocalPlan] = useState({
    planId: 'starter',
    billingStatus: 'active',
    nextBillingDate: '',
    llmResponsesThisMonth: 0,
    monthlyLLMLimit: 300,
  })
  const [savingPlan, setSavingPlan] = useState(false)
  const [savedPlan, setSavedPlan]   = useState(false)

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)
    api.get<{ settings: Record<string, any> }>(`/admin/tenants/${sellerId}`)
      .then(res => {
        const s = res.settings || {}
        setDetail({
          sellerId,
          nickname: s.nickname || sellerId,
          email: s.email,
          autoAnswerEnabled: s.autoAnswerEnabled,
          settings: s,
        })
        setLocalPerms(s.permissions || {
          whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
          preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false,
        })
        setLocalInt({
          whatsappMode: s.whatsappMode || 'platform_shared',
          customPhoneNumberId: s.customPhoneNumberId || '',
          customAccessToken: '',
          llmProvider: s.llmProvider || 'groq',
          llmApiKey: '',
          hasLlmApiKey: s.llmApiKey === '***',
          hasCustomAccessToken: s.customAccessToken === '***',
        })
        setLocalPlan({
          planId: s.planId || 'starter',
          billingStatus: s.billingStatus || 'active',
          nextBillingDate: s.nextBillingDate ? s.nextBillingDate.slice(0, 10) : '',
          llmResponsesThisMonth: s.llmResponsesThisMonth || 0,
          monthlyLLMLimit: s.monthlyLLMLimit || 300,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sellerId])

  const savePermissions = async () => {
    if (!sellerId) return
    setSaving(true)
    setSavedPerms(false)
    try {
      await api.put(`/admin/tenants/${sellerId}/permissions`, { permissions: localPerms })
      setSavedPerms(true)
      setTimeout(() => setSavedPerms(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const saveIntegrations = async () => {
    if (!sellerId) return
    setSavingInt(true)
    setSavedInt(false)
    try {
      const payload: Record<string, string> = {
        whatsappMode: localInt.whatsappMode,
        llmProvider: localInt.llmProvider,
      }
      if (localInt.customPhoneNumberId) payload.customPhoneNumberId = localInt.customPhoneNumberId
      if (localInt.customAccessToken)   payload.customAccessToken   = localInt.customAccessToken
      else if (clearWaToken)            payload.customAccessToken   = ''
      if (localInt.llmApiKey)           payload.llmApiKey           = localInt.llmApiKey
      else if (clearLlmKey)             payload.llmApiKey           = ''

      await api.patch(`/admin/tenants/${sellerId}/integrations`, { integrations: payload })
      setSavedInt(true)
      setClearLlmKey(false)
      setClearWaToken(false)
      setLocalInt(prev => ({
        ...prev,
        customAccessToken: '',
        llmApiKey: '',
        hasLlmApiKey: Boolean(prev.llmApiKey) || (prev.hasLlmApiKey && !clearLlmKey),
        hasCustomAccessToken: Boolean(prev.customAccessToken) || (prev.hasCustomAccessToken && !clearWaToken),
      }))
      setTimeout(() => setSavedInt(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSavingInt(false) }
  }

  const savePlan = async () => {
    if (!sellerId) return
    setSavingPlan(true)
    setSavedPlan(false)
    try {
      const payload = {
        planId: localPlan.planId,
        billingStatus: localPlan.billingStatus,
        nextBillingDate: localPlan.nextBillingDate
          ? new Date(localPlan.nextBillingDate).toISOString()
          : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      }
      const updated = await api.put<{ monthlyLLMLimit: number }>(`/admin/tenants/${sellerId}/plan`, payload)
      setLocalPlan(prev => ({ ...prev, monthlyLLMLimit: updated.monthlyLLMLimit ?? prev.monthlyLLMLimit }))
      setSavedPlan(true)
      setTimeout(() => setSavedPlan(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSavingPlan(false) }
  }

  const handleResetPassword = async () => {
    if (!detail?.email) return
    setResetting(true)
    try {
      await api.post('/admin/reset-password', { email: detail.email })
      setResetSent(detail.email)
      setTimeout(() => setResetSent(null), 4000)
    } catch (e) { console.error(e) }
    finally { setResetting(false) }
  }

  const copyId = () => {
    if (!sellerId) return
    navigator.clipboard.writeText(sellerId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const displayName = detail?.settings?.nickname || detail?.nickname || sellerId || '—'

  return (
    <div className="page">
      <PageHeader
        title={displayName}
        subtitle={`Seller ID: ${sellerId}`}
      />

      {/* Back + Tabs */}
      <div className="detail-nav">
        <button className="btn-back" onClick={() => navigate('/admin')}>
          <ArrowLeft size={15} />
          Volver a Tenants
        </button>

        <div className="detail-tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`detail-tab${activeTab === t.id ? ' detail-tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>}

      {!loading && detail && (
        <div className="detail-content">

          {/* ── GENERAL TAB ── */}
          {activeTab === 'general' && (
            <div className="detail-section-stack">

              {/* Identity card */}
              <div className="detail-card glass">
                <div className="detail-card-header">
                  <div className="header-icon-box blue"><Store size={18} /></div>
                  <div>
                    <h4 className="detail-card-title">Información del Tenant</h4>
                    <p className="detail-card-sub">Identidad y datos de acceso del vendedor.</p>
                  </div>
                </div>

                <div className="detail-meta-row">
                  <button type="button" className="meta-pill meta-pill--copy" onClick={copyId} title="Copiar Seller ID">
                    <span className="meta-pill-label">Seller ID:</span>
                    <span className="meta-pill-val">{sellerId}</span>
                    {copiedId ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                  {detail.email && (
                    <span className="meta-pill">
                      <Mail size={12} />
                      <span>{detail.email}</span>
                    </span>
                  )}
                  <span className={`tenant-status-pill ${detail.autoAnswerEnabled ? 'tenant-status-pill--active' : 'tenant-status-pill--paused'}`}>
                    {detail.autoAnswerEnabled
                      ? <><CheckCircle2 size={12} /> IA Activa</>
                      : <><Clock size={12} /> Pausado</>
                    }
                  </span>
                </div>

                {detail.email && (
                  <div className="detail-reset-row">
                    <div>
                      <p className="detail-label">Acceso & Contraseña</p>
                      <p className="detail-hint">Enviá un enlace de restablecimiento al correo del tenant</p>
                    </div>
                    <button
                      type="button"
                      className="btn-admin-reset"
                      disabled={resetting}
                      onClick={handleResetPassword}
                    >
                      <KeyRound size={14} />
                      {resetting ? 'Enviando email…' : 'Reset Contraseña'}
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

              {/* Permissions */}
              <div className="detail-card glass">
                <div className="detail-card-header">
                  <div className="header-icon-box blue"><ShieldCheck size={18} /></div>
                  <div>
                    <h4 className="detail-card-title">Permisos & Módulos Habilitados</h4>
                    <p className="detail-card-sub">Configurá las capacidades y canales activos para este cliente.</p>
                  </div>
                </div>

                <p className="permissions-section-label">Canales de Alerta</p>
                <div className="permissions-grid">
                  {CHANNEL_PERMISSIONS.map(item => {
                    const isChecked = Boolean(localPerms[item.key])
                    return (
                      <div
                        key={item.key}
                        className={`permission-item${isChecked ? ' permission-item--active' : ''}`}
                        onClick={() => setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                      >
                        <div className="permission-item-icon">{item.icon}</div>
                        <div className="permission-info">
                          <span className="permission-label">{item.label}</span>
                          <span className="permission-desc">{item.desc}</span>
                        </div>
                        <button
                          type="button"
                          className={`toggle${isChecked ? ' toggle--on' : ''}`}
                          onClick={e => { e.stopPropagation(); setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] })) }}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div style={{ height: '1px', background: 'var(--border-glass)', margin: '4px 0' }} />
                <p className="permissions-section-label">Módulos Funcionales</p>
                <div className="permissions-grid">
                  {MODULE_PERMISSIONS.map(item => {
                    const isChecked = Boolean(localPerms[item.key])
                    return (
                      <div
                        key={item.key}
                        className={`permission-item${isChecked ? ' permission-item--active' : ''}`}
                        onClick={() => setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                      >
                        <div className="permission-item-icon">{item.icon}</div>
                        <div className="permission-info">
                          <span className="permission-label">{item.label}</span>
                          <span className="permission-desc">{item.desc}</span>
                        </div>
                        <button
                          type="button"
                          className={`toggle${isChecked ? ' toggle--on' : ''}`}
                          onClick={e => { e.stopPropagation(); setLocalPerms(p => ({ ...p, [item.key]: !p[item.key] })) }}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="admin-actions-bar">
                  <button className="btn-save" onClick={savePermissions} disabled={saving}>
                    {saving ? 'Guardando…' : savedPerms ? '✓ Permisos Guardados' : 'Guardar Permisos'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRATIONS TAB ── */}
          {activeTab === 'integrations' && (
            <div className="detail-section-stack">
              <div className="detail-card glass">
                <div className="detail-card-header">
                  <div className="header-icon-box blue"><Layers size={18} /></div>
                  <div>
                    <h4 className="detail-card-title">Integraciones del Cliente</h4>
                    <p className="detail-card-sub">Credenciales propias del cliente para WhatsApp y LLM.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  {localPerms.whatsappEnabled !== false && (
                    <fieldset className="detail-fieldset">
                      <legend className="detail-fieldset-legend">WhatsApp</legend>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label className="detail-input-label">Modo</label>
                        <select
                          className="input-field"
                          value={localInt.whatsappMode}
                          onChange={e => setLocalInt(p => ({ ...p, whatsappMode: e.target.value as any }))}
                        >
                          <option value="platform_shared">Compartido (número de la plataforma)</option>
                          <option value="custom_byo">Propio del cliente (custom WABA)</option>
                        </select>

                        {localInt.whatsappMode === 'custom_byo' && (
                          <>
                            <label className="detail-input-label">Phone Number ID</label>
                            <input
                              className="input-field"
                              type="text"
                              placeholder="Ej: 123456789012345"
                              value={localInt.customPhoneNumberId}
                              onChange={e => setLocalInt(p => ({ ...p, customPhoneNumberId: e.target.value }))}
                            />
                            <label className="detail-input-label">
                              Access Token {localInt.hasCustomAccessToken && <span className="detail-configured">✓ configurado</span>}
                            </label>
                            <input
                              className="input-field"
                              type="password"
                              placeholder={localInt.hasCustomAccessToken ? 'Dejar vacío para mantener el actual' : 'Pegar token de acceso'}
                              value={localInt.customAccessToken}
                              onChange={e => { setLocalInt(p => ({ ...p, customAccessToken: e.target.value })); setClearWaToken(false) }}
                            />
                            {localInt.hasCustomAccessToken && !localInt.customAccessToken && (
                              <label className="detail-checkbox-label">
                                <input type="checkbox" checked={clearWaToken} onChange={e => setClearWaToken(e.target.checked)} />
                                Limpiar token (volver a número de plataforma)
                              </label>
                            )}
                          </>
                        )}
                      </div>
                    </fieldset>
                  )}

                  <fieldset className="detail-fieldset">
                    <legend className="detail-fieldset-legend">Modelo de IA (LLM)</legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label className="detail-input-label">Proveedor</label>
                      <select
                        className="input-field"
                        value={localInt.llmProvider}
                        onChange={e => setLocalInt(p => ({ ...p, llmProvider: e.target.value as any }))}
                      >
                        <option value="groq">Groq (recomendado — gratis)</option>
                        <option value="openai">OpenAI (GPT-4o mini)</option>
                        <option value="anthropic">Anthropic (Claude Sonnet)</option>
                      </select>
                      <label className="detail-input-label">
                        API Key {localInt.hasLlmApiKey && <span className="detail-configured">✓ configurada</span>}
                      </label>
                      <input
                        className="input-field"
                        type="password"
                        placeholder={localInt.hasLlmApiKey ? 'Dejar vacío para mantener la actual' : 'Pegar API key del cliente'}
                        value={localInt.llmApiKey}
                        onChange={e => { setLocalInt(p => ({ ...p, llmApiKey: e.target.value })); setClearLlmKey(false) }}
                      />
                      {localInt.hasLlmApiKey && !localInt.llmApiKey && (
                        <label className="detail-checkbox-label">
                          <input type="checkbox" checked={clearLlmKey} onChange={e => setClearLlmKey(e.target.checked)} />
                          Limpiar clave (usar credenciales de plataforma)
                        </label>
                      )}
                    </div>
                  </fieldset>
                </div>

                <div className="admin-actions-bar" style={{ marginTop: '16px' }}>
                  <button className="btn-save" onClick={saveIntegrations} disabled={savingInt}>
                    {savingInt ? 'Guardando…' : savedInt ? '✓ Integraciones Guardadas' : 'Guardar Integraciones'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── BILLING TAB ── */}
          {activeTab === 'billing' && (
            <div className="detail-section-stack">
              <div className="detail-card glass">
                <div className="detail-card-header">
                  <div className="header-icon-box blue"><Radio size={18} /></div>
                  <div>
                    <h4 className="detail-card-title">Plan & Facturación</h4>
                    <p className="detail-card-sub">Gestioná el plan, estado de pago y cuota de respuestas IA.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  <div>
                    <label className="detail-input-label" style={{ display: 'block', marginBottom: '6px' }}>Plan</label>
                    <select
                      className="input-field"
                      value={localPlan.planId}
                      onChange={e => setLocalPlan(p => ({ ...p, planId: e.target.value }))}
                    >
                      <option value="starter">Starter — 300 respuestas/mes</option>
                      <option value="pro">Pro — 1.000 respuestas/mes</option>
                      <option value="business">Business — 5.000 respuestas/mes</option>
                      <option value="enterprise">Enterprise — Ilimitado</option>
                    </select>
                  </div>

                  <div>
                    <label className="detail-input-label" style={{ display: 'block', marginBottom: '6px' }}>Estado de facturación</label>
                    <select
                      className="input-field"
                      value={localPlan.billingStatus}
                      onChange={e => setLocalPlan(p => ({ ...p, billingStatus: e.target.value }))}
                    >
                      <option value="active">Activo</option>
                      <option value="overdue">Vencido</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label className="detail-input-label" style={{ display: 'block', marginBottom: '6px' }}>Próximo vencimiento</label>
                    <input
                      className="input-field"
                      type="date"
                      value={localPlan.nextBillingDate}
                      onChange={e => setLocalPlan(p => ({ ...p, nextBillingDate: e.target.value }))}
                    />
                  </div>

                  <div className="billing-usage-box">
                    <span className="billing-usage-label">Respuestas IA este mes</span>
                    <div className="billing-usage-numbers">
                      <strong>{localPlan.llmResponsesThisMonth}</strong>
                      <span> / </span>
                      <strong>{localPlan.monthlyLLMLimit >= 999_999_999 ? '∞' : localPlan.monthlyLLMLimit}</strong>
                      {localPlan.monthlyLLMLimit > 0 && localPlan.monthlyLLMLimit < 999_999_999 && (
                        <span
                          className="billing-usage-pct"
                          style={{
                            color: localPlan.llmResponsesThisMonth / localPlan.monthlyLLMLimit >= 0.8 ? '#f59e0b' : 'var(--text-dim)'
                          }}
                        >
                          ({Math.round((localPlan.llmResponsesThisMonth / localPlan.monthlyLLMLimit) * 100)}%)
                        </span>
                      )}
                    </div>
                    {localPlan.monthlyLLMLimit < 999_999_999 && (
                      <div className="billing-usage-bar">
                        <div
                          className="billing-usage-bar-fill"
                          style={{
                            width: `${Math.min((localPlan.llmResponsesThisMonth / localPlan.monthlyLLMLimit) * 100, 100)}%`,
                            background: localPlan.llmResponsesThisMonth / localPlan.monthlyLLMLimit >= 0.8 ? '#f59e0b' : 'var(--blue)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-actions-bar" style={{ marginTop: '16px' }}>
                  <button className="btn-save" onClick={savePlan} disabled={savingPlan}>
                    {savingPlan ? 'Guardando…' : savedPlan ? '✓ Plan Guardado' : 'Guardar Plan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── IA USAGE TAB ── */}
          {activeTab === 'ia_usage' && (
            <div className="detail-section-stack">
              <LLMUsageCard />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
