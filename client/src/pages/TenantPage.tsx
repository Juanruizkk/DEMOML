import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useNotifications, WebNotificationsSettings } from '../context/NotificationContext'
import PageHeader from '../components/PageHeader'
import LLMUsageCard from '../components/LLMUsageCard'
import {
  Bell,
  ShieldAlert,
  MessageSquare,
  Monitor,
  Mail,
  Send,
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  X,
  Lock,
  Sparkles,
  Building2,
  UserCheck,
  ArrowRight,
  Sliders,
  Radio,
  RefreshCw,
  ShoppingBag,
  Zap,
  ExternalLink
} from 'lucide-react'
import './TenantPage.css'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'pending'
  createdAt: string
  activationToken?: string | null
}

interface TenantMeta {
  sellerId?: string
  nickname?: string
  email?: string
  tokenHealth?: 'healthy' | 'expiring_soon' | 'expired'
  expiresInMinutes?: number
}

type AutomationMode = 'always_auto' | 'smart_hybrid' | 'always_manual' | 'schedule'
type ToneType = 'casual_rioplatense' | 'formal' | 'concise' | 'sales_oriented'

interface ScheduleSettings {
  enabled: boolean
  timezone: string
  workDays: number[]
  workStartHour: string
  workEndHour: string
  daytimeMode: 'smart_hybrid' | 'always_manual'
  nighttimeMode: 'always_auto' | 'smart_hybrid'
}

interface StorePolicies {
  billingPolicy?: string
  shippingPolicy?: string
  warrantyPolicy?: string
  greeting?: string
  signature?: string
}

interface TenantSettings {
  automationMode: AutomationMode
  autoAnswerEnabled: boolean
  confidenceThreshold: number
  schedule?: ScheduleSettings
  tone: ToneType
  policies?: StorePolicies
  customInstructions?: string
  preferredAlertChannel?: string
  whatsappAlertPhone?: string
  telegramAlertChatId?: string
  telegramEnabled?: boolean
  emailAlertAddress?: string
  emailAlertsEnabled?: boolean
  emailAlertTypes?: 'all' | 'questions_only' | 'claims_only'
  webNotifications?: WebNotificationsSettings
}

const DAYS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const TONE_PREVIEWS: Record<ToneType, string> = {
  casual_rioplatense: '¡Hola! Sí, tenemos stock disponible para entrega inmediata. ¡Cualquier consulta avisanos!',
  formal: 'Estimado/a, le confirmamos que disponemos de stock y podemos coordinar la entrega a la brevedad.',
  concise: 'Hola, sí hay stock. Despacho inmediato.',
  sales_oriented: '¡Hola! Sí, tenemos stock listo para despacho hoy. Si comprás antes de las 14 hs, sale el mismo día. ¡Esperamos tu compra!',
}

const AUTOMATION_MODES: { id: AutomationMode; icon: string; label: string; desc: string }[] = [
  { id: 'always_auto',   icon: '⚡', label: '100% Automático',          desc: 'Publica toda respuesta que pase moderación sin revisión humana.' },
  { id: 'smart_hybrid',  icon: '🧠', label: 'Híbrido Inteligente',       desc: 'Auto-publica si la confianza supera el umbral; si no, envía a revisión.' },
  { id: 'always_manual', icon: '✋', label: '100% Manual',               desc: 'La IA sugiere pero nunca publica. Toda respuesta requiere aprobación.' },
  { id: 'schedule',      icon: '⏰', label: 'Por Horarios / Guardia',    desc: 'Automático de noche y fines de semana; manual durante el horario comercial.' },
]

interface TenantPermissionsState {
  whatsappEnabled?: boolean
  telegramEnabled?: boolean
  emailEnabled?: boolean
  preSaleEnabled?: boolean
  postSaleEnabled?: boolean
  multiUserEnabled?: boolean
}

const TABS = [
  { id: 'settings',   label: 'Configuración IA',    icon: <Sliders size={15} /> },
  { id: 'channels',   label: 'Canales & Alertas',   icon: <Radio size={15} /> },
  { id: 'team',       label: 'Equipo & Vendedores',  icon: <Users size={15} /> },
  { id: 'connection', label: 'Conexión MELI',        icon: <RefreshCw size={15} /> },
  { id: 'ia_usage',   label: 'Consumo IA',           icon: <Sparkles size={15} /> },
]

export default function TenantPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'settings'
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(null)
  const [permissions, setPermissions] = useState<TenantPermissionsState>({
    whatsappEnabled: true,
    telegramEnabled: true,
    emailEnabled: false,
    preSaleEnabled: true,
    postSaleEnabled: true,
    multiUserEnabled: false,
  })
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)
  const [oauthBanner, setOauthBanner] = useState<{
    type: 'success' | 'error'
    message: string
    sellerId?: string
    nickname?: string
  } | null>(null)
  const [connectingMeli, setConnectingMeli] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const { requestDesktopPermission, updateWebSettings } = useNotifications()

  const fetchSettings = () => {
    setLoading(true)
    api.get<any>('/tenant/settings')
      .then((res) => {
        const data = res.settings || res
        setTenantMeta({
          sellerId: res.sellerId,
          nickname: res.nickname,
          email: res.email,
          tokenHealth: res.tokenHealth,
          expiresInMinutes: res.expiresInMinutes,
        })
        if (res.permissions) {
          setPermissions(res.permissions)
        } else if (data.permissions) {
          setPermissions(data.permissions)
        }
        // Back-compat: derive automationMode from legacy autoAnswerEnabled
        if (!data.automationMode) {
          data.automationMode = data.autoAnswerEnabled ? 'smart_hybrid' : 'always_manual'
        }
        if (!data.schedule) {
          data.schedule = {
            enabled: false,
            timezone: 'America/Argentina/Buenos_Aires',
            workDays: [1, 2, 3, 4, 5],
            workStartHour: '09:00',
            workEndHour: '18:00',
            daytimeMode: 'always_manual',
            nighttimeMode: 'always_auto',
          }
        }
        if (!data.policies) data.policies = {}
        setSettings(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const status = searchParams.get('status')
    const token = searchParams.get('token')
    const errParam = searchParams.get('error')
    const sellerId = searchParams.get('sellerId')
    const nickname = searchParams.get('nickname')

    if (token) {
      localStorage.setItem('token', token)
      localStorage.setItem('meli_jwt', token)
    }

    if (status === 'connected') {
      setOauthBanner({
        type: 'success',
        message: `¡Cuenta de Mercado Libre conectada exitosamente! ${nickname ? `Tienda: "${nickname}"` : ''} ${sellerId ? `(Seller ID: ${sellerId})` : ''}`,
        sellerId: sellerId || undefined,
        nickname: nickname || undefined,
      })
    } else if (status === 'error') {
      setOauthBanner({
        type: 'error',
        message: errParam ? decodeURIComponent(errParam) : 'Ocurrió un error al conectar con Mercado Libre.',
      })
    }
    fetchSettings()
  }, [searchParams])

  const handleConnectMeli = async () => {
    setConnectingMeli(true)
    setConnectError(null)
    try {
      const res = await api.get<{ url: string }>('/auth/meli-auth-url')
      if (res.url) {
        window.location.href = res.url
      } else {
        throw new Error('No se pudo obtener la URL de autorización.')
      }
    } catch (err: any) {
      setConnectError(err.message || 'Error al iniciar conexión con Mercado Libre.')
      setConnectingMeli(false)
    }
  }

  const handleTestSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.get<any>('/tenant/settings')
      setTenantMeta({
        sellerId: res.sellerId,
        nickname: res.nickname,
        email: res.email,
        tokenHealth: res.tokenHealth,
        expiresInMinutes: res.expiresInMinutes,
      })
      setSyncResult({ ok: true, message: 'Conexión y tokens sincronizados correctamente con Mercado Libre.' })
    } catch (err: any) {
      setSyncResult({ ok: false, message: err.message || 'Error al validar la conexión.' })
    } finally {
      setSyncing(false)
    }
  }

  const save = async () => {
    if (!settings) return
    await api.put('/tenant/settings', settings)
    if (settings.webNotifications) await updateWebSettings(settings.webNotifications)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) =>
    setSettings(s => s ? { ...s, [key]: value } : s)

  const setSchedule = (partial: Partial<ScheduleSettings>) =>
    setSettings(s => s ? { ...s, schedule: { ...s.schedule!, ...partial } } : s)

  const setPolicies = (partial: Partial<StorePolicies>) =>
    setSettings(s => s ? { ...s, policies: { ...s.policies, ...partial } } : s)

  const toggleWorkDay = (day: number) => {
    if (!settings?.schedule) return
    const days = settings.schedule.workDays.includes(day)
      ? settings.schedule.workDays.filter(d => d !== day)
      : [...settings.schedule.workDays, day]
    setSchedule({ workDays: days })
  }

  // ── Web notifications helpers ───────────────────────────────────────────────
  const webNotif = settings?.webNotifications
  const setWeb = (partial: Partial<WebNotificationsSettings>) =>
    setSettings(s => s ? { ...s, webNotifications: { enabled: true, scope: 'all', soundEnabled: true, desktopPushEnabled: false, ...s.webNotifications, ...partial } } : s)

  const handleToggleDesktopPush = async () => {
    const current = webNotif?.desktopPushEnabled ?? false
    if (!current) {
      const granted = await requestDesktopPermission()
      setWeb({ desktopPushEnabled: granted })
    } else {
      setWeb({ desktopPushEnabled: false })
    }
  }

  // ── Email test helper ───────────────────────────────────────────────────────
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTestEmail = async () => {
    setTestingEmail(true)
    setEmailTestResult(null)
    try {
      const res = await api.post<{ ok: boolean; message: string; error?: string }>('/tenant/channels/email/test', {
        email: settings?.emailAlertAddress,
      })
      if (res.ok) {
        setEmailTestResult({ success: true, message: res.message || 'Email de prueba enviado exitosamente.' })
      } else {
        setEmailTestResult({ success: false, message: res.error || 'No se pudo enviar el correo de prueba.' })
      }
    } catch (err: any) {
      setEmailTestResult({ success: false, message: err.message || 'Error al conectar con el servidor.' })
    } finally {
      setTestingEmail(false)
    }
  }

  // ── Team management state & handlers ───────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [multiUserEnabled, setMultiUserEnabled] = useState<boolean>(false)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invitedResult, setInvitedResult] = useState<{ activationUrl: string; name: string; email: string } | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchTeam = () => {
    setLoadingTeam(true)
    api.get<{ multiUserEnabled: boolean; members: TeamMember[] }>('/tenant/team')
      .then((res) => {
        setMultiUserEnabled(Boolean(res.multiUserEnabled))
        setTeamMembers(res.members || [])
      })
      .catch(console.error)
      .finally(() => setLoadingTeam(false))
  }

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeam()
    }
  }, [activeTab])

  const openInviteModal = () => {
    setShowInviteModal(true)
    setInviteName('')
    setInviteEmail('')
    setInviteError(null)
    setInvitedResult(null)
    setCopiedInvite(false)
  }

  const closeInviteModal = () => {
    setShowInviteModal(false)
    setInvitedResult(null)
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)
    try {
      const res = await api.post<{ userId: string; activationUrl: string; name: string; email: string }>('/tenant/team/invite', {
        name: inviteName,
        email: inviteEmail,
      })
      setInvitedResult({ activationUrl: res.activationUrl, name: inviteName, email: inviteEmail })
      fetchTeam()
    } catch (err: any) {
      setInviteError(err.message || 'Error al invitar colaborador.')
    } finally {
      setInviting(false)
    }
  }

  const handleCopyActivation = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2500)
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseás eliminar a ${memberName} del equipo de la tienda?`)) {
      return
    }
    setDeletingId(memberId)
    try {
      await api.delete(`/tenant/team/${memberId}`)
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err: any) {
      alert(err.message || 'Error al eliminar colaborador.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Configuración" subtitle="Ajustes de tu tienda y cuenta" />

      <div className="config-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`config-tab${activeTab === t.id ? ' config-tab--active' : ''}`}
            onClick={() => setSearchParams({ tab: t.id })}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tenant-content">
        {loading && <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>}

        {/* ── SETTINGS TAB ───────────────────────────────────────────────── */}
        {!loading && settings && activeTab === 'settings' && (
          <div className="ai-settings-stack">

            {/* ── Card 1: Modo de Automatización ───────────────────────── */}
            <div className="ai-card glass">
              <div className="ai-card-header">
                <span className="ai-card-icon">🤖</span>
                <div>
                  <h3 className="ai-card-title">Modo de Automatización Operativa</h3>
                  <p className="ai-card-sub">Define cuándo la IA publica automáticamente en Mercado Libre</p>
                </div>
              </div>

              <div className="mode-grid">
                {AUTOMATION_MODES.map(m => (
                  <button
                    key={m.id}
                    className={`mode-card${settings.automationMode === m.id ? ' mode-card--active' : ''}`}
                    onClick={() => set('automationMode', m.id)}
                  >
                    <span className="mode-icon">{m.icon}</span>
                    <span className="mode-label">{m.label}</span>
                    <span className="mode-desc">{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* Umbral — solo visible en smart_hybrid */}
              {settings.automationMode === 'smart_hybrid' && (
                <div className="tenant-field" style={{ marginTop: 20 }}>
                  <label className="tenant-label">
                    Umbral de confianza — <span className="tenant-value">{Math.round((settings.confidenceThreshold || 0) * 100)}%</span>
                  </label>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={settings.confidenceThreshold}
                    onChange={e => set('confidenceThreshold', parseFloat(e.target.value))}
                    className="tenant-range"
                  />
                  <div className="tenant-range-labels">
                    <span>0% (todo a revisión)</span>
                    <span>100% (todo auto)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Card 2: Horarios (solo si mode === 'schedule') ─────────── */}
            {settings.automationMode === 'schedule' && settings.schedule && (
              <div className="ai-card glass">
                <div className="ai-card-header">
                  <span className="ai-card-icon">📅</span>
                  <div>
                    <h3 className="ai-card-title">Horario Comercial & Guardia Nocturna</h3>
                    <p className="ai-card-sub">Define los días y horas de atención humana</p>
                  </div>
                </div>

                <div className="tenant-field">
                  <label className="tenant-label">Días laborales</label>
                  <div className="day-pills">
                    {DAYS_LABELS.map((label, i) => (
                      <button
                        key={i}
                        className={`day-pill${settings.schedule!.workDays.includes(i) ? ' day-pill--active' : ''}`}
                        onClick={() => toggleWorkDay(i)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="schedule-time-row">
                  <div className="tenant-field">
                    <label className="tenant-label">Inicio de atención</label>
                    <input
                      type="time"
                      className="tenant-input"
                      value={settings.schedule.workStartHour}
                      onChange={e => setSchedule({ workStartHour: e.target.value })}
                    />
                  </div>
                  <div className="tenant-field">
                    <label className="tenant-label">Fin de atención</label>
                    <input
                      type="time"
                      className="tenant-input"
                      value={settings.schedule.workEndHour}
                      onChange={e => setSchedule({ workEndHour: e.target.value })}
                    />
                  </div>
                </div>

                <div className="schedule-modes-row">
                  <div className="tenant-field">
                    <label className="tenant-label">☀ En horario comercial</label>
                    <select
                      className="tenant-select"
                      value={settings.schedule.daytimeMode}
                      onChange={e => setSchedule({ daytimeMode: e.target.value as any })}
                    >
                      <option value="always_manual">✋ Revisión Manual</option>
                      <option value="smart_hybrid">🧠 Híbrido Inteligente</option>
                    </select>
                  </div>
                  <div className="tenant-field">
                    <label className="tenant-label">🌙 Fuera de horario / Guardia</label>
                    <select
                      className="tenant-select"
                      value={settings.schedule.nighttimeMode}
                      onChange={e => setSchedule({ nighttimeMode: e.target.value as any })}
                    >
                      <option value="always_auto">⚡ 100% Automático</option>
                      <option value="smart_hybrid">🧠 Híbrido Inteligente</option>
                    </select>
                  </div>
                </div>

                {/* Umbral para modos híbridos en schedule */}
                {(settings.schedule.daytimeMode === 'smart_hybrid' || settings.schedule.nighttimeMode === 'smart_hybrid') && (
                  <div className="tenant-field">
                    <label className="tenant-label">
                      Umbral de confianza — <span className="tenant-value">{Math.round((settings.confidenceThreshold || 0) * 100)}%</span>
                    </label>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={settings.confidenceThreshold}
                      onChange={e => set('confidenceThreshold', parseFloat(e.target.value))}
                      className="tenant-range"
                    />
                    <div className="tenant-range-labels"><span>0%</span><span>100%</span></div>
                  </div>
                )}
              </div>
            )}

            {/* ── Card 3: Tono y Personalidad ──────────────────────────── */}
            <div className="ai-card glass">
              <div className="ai-card-header">
                <span className="ai-card-icon">🎙️</span>
                <div>
                  <h3 className="ai-card-title">Tono y Personalidad de la IA</h3>
                  <p className="ai-card-sub">Cómo suena tu asistente al responder compradores</p>
                </div>
              </div>

              <div className="tone-grid">
                {([
                  { id: 'casual_rioplatense', icon: '🧉', label: 'Casual Rioplatense' },
                  { id: 'formal',             icon: '👔', label: 'Formal & Corporativo' },
                  { id: 'concise',            icon: '⚡', label: 'Conciso & Directo' },
                  { id: 'sales_oriented',     icon: '🚀', label: 'Comercial & Persuasivo' },
                ] as { id: ToneType; icon: string; label: string }[]).map(t => (
                  <button
                    key={t.id}
                    className={`tone-card${settings.tone === t.id ? ' tone-card--active' : ''}`}
                    onClick={() => set('tone', t.id)}
                  >
                    <span className="tone-icon">{t.icon}</span>
                    <span className="tone-label">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Preview en vivo */}
              <div className="tone-preview">
                <span className="tone-preview-label">Vista previa</span>
                <div className="tone-bubble">
                  "{TONE_PREVIEWS[settings.tone]}"
                </div>
              </div>

              <div className="two-col-fields">
                <div className="tenant-field">
                  <label className="tenant-label">Saludo inicial</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={settings.policies?.greeting || ''}
                    onChange={e => setPolicies({ greeting: e.target.value })}
                    placeholder="¡Hola! Gracias por consultar en nuestra tienda."
                  />
                </div>
                <div className="tenant-field">
                  <label className="tenant-label">Firma / Despedida</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={settings.policies?.signature || ''}
                    onChange={e => setPolicies({ signature: e.target.value })}
                    placeholder="Saludos, equipo de TiendaXYZ | MercadoLíder Platinum"
                  />
                </div>
              </div>
            </div>

            {/* ── Card 4: Políticas Comerciales ────────────────────────── */}
            <div className="ai-card glass">
              <div className="ai-card-header">
                <span className="ai-card-icon">📋</span>
                <div>
                  <h3 className="ai-card-title">Políticas Comerciales de la Tienda</h3>
                  <p className="ai-card-sub">La IA usa estas reglas globales en todas las respuestas</p>
                </div>
              </div>

              <div className="policies-grid">
                <div className="tenant-field">
                  <label className="tenant-label">🧾 Facturación</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={settings.policies?.billingPolicy || ''}
                    onChange={e => setPolicies({ billingPolicy: e.target.value })}
                    placeholder="Emitimos Factura A y B automáticamente."
                  />
                </div>
                <div className="tenant-field">
                  <label className="tenant-label">🚚 Envíos y Despachos</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={settings.policies?.shippingPolicy || ''}
                    onChange={e => setPolicies({ shippingPolicy: e.target.value })}
                    placeholder="Envíos Flex en el día comprando antes de las 14 hs."
                  />
                </div>
                <div className="tenant-field">
                  <label className="tenant-label">🛡️ Garantía</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={settings.policies?.warrantyPolicy || ''}
                    onChange={e => setPolicies({ warrantyPolicy: e.target.value })}
                    placeholder="Garantía oficial de 6 meses con cambio directo."
                  />
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">📝 Instrucciones adicionales</label>
                <textarea
                  className="tenant-textarea"
                  rows={3}
                  value={settings.customInstructions || ''}
                  onChange={e => set('customInstructions', e.target.value)}
                  placeholder="Ej: Siempre mencionar que hacemos descuento a mayoristas. No prometer plazos de entrega específicos."
                />
              </div>
            </div>

            <button className="btn-save btn-save--sticky" onClick={save}>
              {saved ? '✓ Guardado' : 'Guardar configuración IA'}
            </button>
          </div>
        )}

        {/* ── TEAM TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'team' && (
          <div className="team-container">
            {loadingTeam ? (
              <div className="list-empty"><span className="pulse-dot" /> Cargando miembros del equipo…</div>
            ) : !multiUserEnabled ? (
              <div className="team-locked-banner glass">
                <div className="locked-banner-icon">
                  <Lock size={36} />
                </div>
                <div className="locked-banner-content">
                  <div className="locked-badge">Función Multi-Usuario Bloqueada</div>
                  <h3 className="locked-title">Gestión de Equipo & Vendedores</h3>
                  <p className="locked-desc">
                    Tu tienda actualmente opera en modalidad <strong>Mono-Usuario</strong>. 
                    Con el módulo de Equipo podés delegar la gestión de preguntas y reclamos a múltiples vendedores, 
                    cada uno con su propio acceso seguro y alertas sincronizadas.
                  </p>
                  <div className="locked-features-grid">
                    <div className="locked-feature-item">
                      <Users size={16} />
                      <span>Múltiples vendedores y colaboradores</span>
                    </div>
                    <div className="locked-feature-item">
                      <ShieldCheck size={16} />
                      <span>Accesos individuales con contraseña propia</span>
                    </div>
                    <div className="locked-feature-item">
                      <MessageSquare size={16} />
                      <span>Notificaciones compartidas en tiempo real</span>
                    </div>
                  </div>
                  <div className="locked-contact-hint">
                    <AlertCircle size={15} />
                    <span>Contactá al soporte / Super Administrador para activar el plan Multi-Usuario en tu cuenta.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="team-management glass">
                <div className="team-header">
                  <div className="team-header-info">
                    <div className="header-icon-box blue"><Users size={20} /></div>
                    <div>
                      <h3 className="section-title">Vendedores & Colaboradores</h3>
                      <p className="section-sub">
                        Gestioná el equipo que tiene acceso al panel y a las respuestas de esta tienda.
                      </p>
                    </div>
                  </div>
                  <button className="btn-primary" onClick={openInviteModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserPlus size={16} />
                    Invitar Colaborador
                  </button>
                </div>

                <div className="team-stats-row">
                  <div className="team-stat-card glass">
                    <span className="team-stat-num">{teamMembers.length}</span>
                    <span className="team-stat-lbl">Usuarios Totales</span>
                  </div>
                  <div className="team-stat-card glass">
                    <span className="team-stat-num" style={{ color: '#10b981' }}>
                      {teamMembers.filter(m => m.status === 'active').length}
                    </span>
                    <span className="team-stat-lbl">Activos</span>
                  </div>
                  <div className="team-stat-card glass">
                    <span className="team-stat-num" style={{ color: '#f59e0b' }}>
                      {teamMembers.filter(m => m.status === 'pending').length}
                    </span>
                    <span className="team-stat-lbl">Pendientes</span>
                  </div>
                </div>

                <div className="team-list-wrapper">
                  <table className="team-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Fecha de Alta</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => {
                        const isPending = member.status === 'pending'
                        return (
                          <tr key={member.id} className="team-row">
                            <td>
                              <div className="member-cell">
                                <div className="member-avatar">
                                  {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="member-name">{member.name || 'Sin nombre'}</div>
                                  <div className="member-email">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="member-role-badge">
                                {member.role === 'admin' ? 'Super Admin' : 'Vendedor / Colaborador'}
                              </span>
                            </td>
                            <td>
                              {isPending ? (
                                <span className="status-chip status-chip--pending">
                                  <Clock size={12} />
                                  Pendiente
                                </span>
                              ) : (
                                <span className="status-chip status-chip--active">
                                  <CheckCircle2 size={12} />
                                  Activo
                                </span>
                              )}
                            </td>
                            <td className="member-date">
                              {new Date(member.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="member-actions">
                                {isPending && member.activationToken && (
                                  <button
                                    type="button"
                                    className="btn-icon-action btn-copy-link"
                                    title="Copiar enlace de activación"
                                    onClick={() => handleCopyActivation(`${window.location.origin}/reset-password?token=${member.activationToken}`)}
                                  >
                                    <Copy size={14} />
                                    <span>Copiar Enlace</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-icon-action btn-delete-member"
                                  title="Eliminar colaborador"
                                  disabled={deletingId === member.id}
                                  onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {copiedInvite && (
                  <div className="team-toast glass">
                    <Check size={16} color="#10b981" />
                    <span>¡Enlace de activación copiado al portapapeles!</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal de Invitación */}
            {showInviteModal && (
              <div className="modal-backdrop" onClick={closeInviteModal}>
                <div className="modal-dialog glass" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="modal-title-box">
                      <UserPlus size={20} className="modal-title-icon" />
                      <h3>Invitar Colaborador</h3>
                    </div>
                    <button className="modal-close-btn" onClick={closeInviteModal}>
                      <X size={18} />
                    </button>
                  </div>

                  {invitedResult ? (
                    <div className="modal-success-body">
                      <div className="success-icon-box">
                        <CheckCircle2 size={40} color="#10b981" />
                      </div>
                      <h4>¡Invitación Generada con Éxito!</h4>
                      <p className="success-sub">
                        Se envió un correo electrónico a <strong>{invitedResult.email}</strong> con las instrucciones de acceso.
                      </p>

                      <div className="activation-link-box glass">
                        <label className="activation-link-label">Enlace directo de activación:</label>
                        <div className="activation-link-row">
                          <input
                            type="text"
                            readOnly
                            value={invitedResult.activationUrl}
                            className="activation-link-input"
                          />
                          <button
                            type="button"
                            className="btn-copy"
                            onClick={() => handleCopyActivation(invitedResult.activationUrl)}
                          >
                            {copiedInvite ? <Check size={16} /> : <Copy size={16} />}
                            {copiedInvite ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <span className="activation-link-hint">
                          Podés compartirle este enlace por WhatsApp o Telegram si preferís que active su cuenta de inmediato.
                        </span>
                      </div>

                      <div className="modal-actions" style={{ marginTop: '20px' }}>
                        <button className="btn-primary" onClick={closeInviteModal} style={{ width: '100%' }}>
                          Finalizar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleInviteSubmit}>
                      <div className="modal-body">
                        <p className="modal-sub">
                          El nuevo integrante recibirá un correo para configurar su contraseña y comenzar a responder preguntas y reclamos.
                        </p>

                        {inviteError && (
                          <div className="modal-error-alert">
                            <AlertCircle size={16} />
                            <span>{inviteError}</span>
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Nombre Completo</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Laura Gómez"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            className="form-input"
                            autoFocus
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Correo Electrónico</label>
                          <input
                            type="email"
                            required
                            placeholder="colaborador@empresa.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={closeInviteModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={inviting}>
                          {inviting ? 'Enviando invitación...' : 'Enviar Invitación'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHANNELS TAB ───────────────────────────────────────────────── */}
        {!loading && settings && activeTab === 'channels' && (
          <div className="channels-container">
            <div className="tenant-form glass">
              <div className="card-section-header">
                <div className="header-icon-box blue"><Bell size={18} /></div>
                <div>
                  <h3 className="section-title">Campana de Alertas en Vivo</h3>
                  <p className="section-sub">Configura cómo recibes las alertas en tiempo real dentro del panel</p>
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">Notificaciones en Pantalla</label>
                <div className="toggle-row">
                  <span className="tenant-hint">Mostrar badges numéricos y registrar eventos en la campana</span>
                  <button className={`toggle${webNotif?.enabled !== false ? ' toggle--on' : ''}`} onClick={() => setWeb({ enabled: !(webNotif?.enabled ?? true) })}>
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">Alcance de Notificaciones</label>
                <div className="channel-options">
                  {(['all', 'questions_only', 'claims_only'] as const).map(scope => (
                    <button key={scope} type="button"
                      className={`channel-btn${(webNotif?.scope || 'all') === scope ? ' channel-btn--active' : ''}`}
                      onClick={() => setWeb({ scope })}>
                      {scope === 'all' ? <><Bell size={14} style={{ marginRight: 6 }} />Todas</> : scope === 'questions_only' ? <><MessageSquare size={14} style={{ marginRight: 6 }} />Preguntas</> : <><ShieldAlert size={14} style={{ marginRight: 6 }} />Reclamos</>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">Sonido de Notificación</label>
                <div className="toggle-row">
                  <span className="tenant-hint">Emitir una campanilla al llegar una alerta</span>
                  <button className={`toggle${webNotif?.soundEnabled !== false ? ' toggle--on' : ''}`} onClick={() => setWeb({ soundEnabled: !(webNotif?.soundEnabled ?? true) })}>
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">Notificaciones de Escritorio (Push)</label>
                <div className="toggle-row">
                  <span className="tenant-hint">Avisar aunque la ventana esté en segundo plano</span>
                  <button className={`toggle${webNotif?.desktopPushEnabled ? ' toggle--on' : ''}`} onClick={handleToggleDesktopPush}>
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              <button className="btn-save" onClick={save}>{saved ? '✓ Guardado' : 'Guardar cambios'}</button>
            </div>

            {/* WhatsApp */}
            {permissions.whatsappEnabled !== false ? (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box" style={{ background: 'rgba(37, 211, 102, 0.12)', color: '#25d366' }}><MessageSquare size={18} /></div>
                  <div>
                    <h3 className="section-title">WhatsApp</h3>
                    <p className="section-sub">Alertas directas a tu número de WhatsApp personal o del equipo</p>
                  </div>
                </div>
                <div className="tenant-field">
                  <label className="tenant-label">Número de teléfono</label>
                  <input type="tel" className="tenant-input" value={settings.whatsappAlertPhone || ''}
                    onChange={e => set('whatsappAlertPhone', e.target.value)} placeholder="+5491112345678" />
                  <span className="tenant-hint">Incluí el código de país. Ej: +5491112345678</span>
                </div>
                <button className="btn-save" onClick={save}>{saved ? '✓ Guardado' : 'Guardar cambios'}</button>
              </div>
            ) : (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box" style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-dim)' }}><MessageSquare size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                      <h3 className="section-title">WhatsApp</h3>
                      <span className="locked-badge" style={{ fontSize: '0.68rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={11} />
                        Deshabilitado
                      </span>
                    </div>
                    <p className="section-sub">Alertas directas a tu número de WhatsApp personal o del equipo</p>
                  </div>
                </div>
                <div className="channel-locked-banner glass">
                  <div className="locked-banner-icon" style={{ width: 44, height: 44, minWidth: 44 }}><Lock size={22} /></div>
                  <div className="locked-banner-content">
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>Canal de WhatsApp no autorizado</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Las alertas por WhatsApp no están activadas en tu plan. Contactá al administrador para habilitar este canal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Telegram */}
            {permissions.telegramEnabled !== false ? (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box" style={{ background: 'rgba(0, 136, 204, 0.12)', color: '#0088cc' }}><Send size={18} /></div>
                  <div>
                    <h3 className="section-title">Telegram</h3>
                    <p className="section-sub">Notificaciones al bot de Telegram del equipo de ventas</p>
                  </div>
                </div>
                <div className="tenant-field">
                  <label className="tenant-label">Chat ID</label>
                  <input type="text" className="tenant-input" value={settings.telegramAlertChatId || ''}
                    onChange={e => set('telegramAlertChatId', e.target.value)} placeholder="-100123456789" />
                  <span className="tenant-hint">ID del grupo o canal de Telegram. Podés obtenerlo con el bot @userinfobot.</span>
                </div>
                <button className="btn-save" onClick={save}>{saved ? '✓ Guardado' : 'Guardar cambios'}</button>
              </div>
            ) : (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box" style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-dim)' }}><Send size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                      <h3 className="section-title">Telegram</h3>
                      <span className="locked-badge" style={{ fontSize: '0.68rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={11} />
                        Deshabilitado
                      </span>
                    </div>
                    <p className="section-sub">Notificaciones al bot de Telegram del equipo de ventas</p>
                  </div>
                </div>
                <div className="channel-locked-banner glass">
                  <div className="locked-banner-icon" style={{ width: 44, height: 44, minWidth: 44 }}><Lock size={22} /></div>
                  <div className="locked-banner-content">
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>Canal de Telegram no autorizado</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Las alertas por Telegram no están activadas en tu plan. Contactá al administrador para habilitar este canal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── CARD EMAIL ALERTS (GATED BY PERMISSION) ── */}
            {!permissions.emailEnabled ? (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box purple"><Mail size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <h3 className="section-title">Alertas por Email (Resend Transaccional)</h3>
                      <span className="locked-badge" style={{ fontSize: '0.68rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={11} />
                        Deshabilitado en Super Admin
                      </span>
                    </div>
                    <p className="section-sub">Avisos inmediatos de preguntas para moderación y reclamos urgentes</p>
                  </div>
                </div>

                <div className="channel-locked-banner glass">
                  <div className="locked-banner-icon" style={{ width: 44, height: 44, minWidth: 44 }}>
                    <Lock size={22} />
                  </div>
                  <div className="locked-banner-content">
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Canal de Email no autorizado para esta tienda
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Las alertas por correo electrónico no están activadas en los permisos de tu plan. 
                      Para recibir notificaciones automáticas en tu casilla, solicita a tu administrador la activación del permiso <strong>Alertas por Email</strong> en el panel de Super Admin.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="tenant-form glass">
                <div className="card-section-header">
                  <div className="header-icon-box purple"><Mail size={18} /></div>
                  <div>
                    <h3 className="section-title">Alertas por Email (Resend Transaccional)</h3>
                    <p className="section-sub">Avisos inmediatos de preguntas para moderación y reclamos urgentes</p>
                  </div>
                </div>

                <div className="tenant-field">
                  <label className="tenant-label">Habilitar Alertas por Email</label>
                  <div className="toggle-row">
                    <span className="tenant-hint">Recibir avisos por correo para preguntas y reclamos</span>
                    <button
                      type="button"
                      className={`toggle${settings.emailAlertsEnabled !== false ? ' toggle--on' : ''}`}
                      onClick={() => set('emailAlertsEnabled', settings.emailAlertsEnabled === false ? true : false)}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>

                <div className="tenant-field">
                  <label className="tenant-label">Dirección de Correo Destino</label>
                  <input
                    type="email"
                    className="tenant-input"
                    value={settings.emailAlertAddress || ''}
                    onChange={e => set('emailAlertAddress', e.target.value)}
                    placeholder="vendedor@ejemplo.com"
                  />
                  <span className="tenant-hint">Si queda vacío, se enviará al email registrado en tu cuenta de Mercado Libre.</span>
                </div>

                <div className="tenant-field">
                  <label className="tenant-label">Alcance de Notificaciones</label>
                  <select
                    className="tenant-select"
                    value={settings.emailAlertTypes || 'all'}
                    onChange={e => set('emailAlertTypes', e.target.value as any)}
                  >
                    <option value="all">Todas las alertas (Preguntas + Reclamos urgentes)</option>
                    <option value="questions_only">Sólo preguntas que requieren revisión</option>
                    <option value="claims_only">Sólo reclamos con SLA urgente (&lt; 12hs)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn-save"
                    style={{
                      background: 'var(--border-glass)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    disabled={testingEmail}
                    onClick={handleTestEmail}
                  >
                    <Send size={14} />
                    {testingEmail ? 'Enviando...' : 'Enviar Email de Prueba'}
                  </button>
                  <button className="btn-save" onClick={save}>
                    {saved ? '✓ Guardado' : 'Guardar cambios'}
                  </button>
                </div>

                {emailTestResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--r-md)',
                      fontSize: '0.82rem',
                      marginTop: '8px',
                      background: emailTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: emailTestResult.success ? '#34d399' : '#f87171',
                      border: `1px solid ${emailTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {emailTestResult.success ? '✅ ' : '❌ '}
                    {emailTestResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONNECTION TAB ─────────────────────────────────────────────── */}
        {activeTab === 'connection' && (
          <div className="meli-connection-container">
            {oauthBanner && (
              <div className={`oauth-feedback-banner glass ${oauthBanner.type === 'success' ? 'oauth-feedback-banner--success' : 'oauth-feedback-banner--error'}`}>
                <div className="oauth-feedback-icon">
                  {oauthBanner.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <div className="oauth-feedback-body">
                  <strong>{oauthBanner.type === 'success' ? 'Conexión Exitosa' : 'Error de Conexión'}</strong>
                  <p>{oauthBanner.message}</p>
                </div>
                <button className="oauth-feedback-close" onClick={() => setOauthBanner(null)}>
                  <X size={16} />
                </button>
              </div>
            )}

            {connectError && (
              <div className="oauth-feedback-banner glass oauth-feedback-banner--error">
                <div className="oauth-feedback-icon"><AlertCircle size={20} /></div>
                <div className="oauth-feedback-body">
                  <strong>Error al Iniciar Conexión</strong>
                  <p>{connectError}</p>
                </div>
                <button className="oauth-feedback-close" onClick={() => setConnectError(null)}><X size={16} /></button>
              </div>
            )}

            {syncResult && (
              <div className={`oauth-feedback-banner glass ${syncResult.ok ? 'oauth-feedback-banner--success' : 'oauth-feedback-banner--error'}`}>
                <div className="oauth-feedback-icon">
                  {syncResult.ok ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <div className="oauth-feedback-body">
                  <strong>{syncResult.ok ? 'Sincronización Correcta' : 'Fallo de Sincronización'}</strong>
                  <p>{syncResult.message}</p>
                </div>
                <button className="oauth-feedback-close" onClick={() => setSyncResult(null)}><X size={16} /></button>
              </div>
            )}

            <div className="tenant-form glass meli-connection-card">
              <div className="card-section-header">
                <div className="header-icon-box meli-yellow-box">
                  <ShoppingBag size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="section-title">Conexión con Mercado Libre</h3>
                    {tenantMeta?.sellerId ? (
                      <span className="meli-status-badge meli-status-badge--connected">
                        <span className="connection-dot connection-dot--ok" />
                        Conectado & Sincronizado
                      </span>
                    ) : (
                      <span className="meli-status-badge meli-status-badge--disconnected">
                        <span className="connection-dot" style={{ background: '#f59e0b' }} />
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="section-sub">
                    Vinculación oficial mediante OAuth 2.0 para recibir preguntas, mensajes post-venta y reclamos en tiempo real.
                  </p>
                </div>
              </div>

              {tenantMeta?.sellerId ? (
                <div className="meli-connected-details">
                  <div className="meli-info-grid">
                    <div className="meli-info-item glass">
                      <span className="meli-info-label">Vendedor / Tienda</span>
                      <span className="meli-info-val highlight">{tenantMeta.nickname || `Seller_${tenantMeta.sellerId}`}</span>
                    </div>

                    <div className="meli-info-item glass">
                      <span className="meli-info-label">Seller ID (Mercado Libre)</span>
                      <span className="meli-info-val">{tenantMeta.sellerId}</span>
                    </div>

                    <div className="meli-info-item glass">
                      <span className="meli-info-label">Email Registrado en MELI</span>
                      <span className="meli-info-val">{tenantMeta.email || 'No registrado'}</span>
                    </div>

                    <div className="meli-info-item glass">
                      <span className="meli-info-label">Salud del Token OAuth</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`token-health-badge token-health-badge--${tenantMeta?.tokenHealth || 'healthy'}`}>
                          {tenantMeta?.tokenHealth === 'expired'
                            ? 'Expirado'
                            : tenantMeta?.tokenHealth === 'expiring_soon'
                            ? 'Por Expirar'
                            : 'Saludable'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          (Autorenovable)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="meli-action-row">
                    <button
                      type="button"
                      className="btn-meli-sync"
                      onClick={handleTestSync}
                      disabled={syncing}
                    >
                      <RefreshCw size={15} className={syncing ? 'spin' : ''} />
                      {syncing ? 'Verificando...' : 'Verificar Sincronización'}
                    </button>

                    <button
                      type="button"
                      className="btn-meli-reconnect"
                      onClick={handleConnectMeli}
                      disabled={connectingMeli}
                    >
                      <ShoppingBag size={15} />
                      {connectingMeli ? 'Redirigiendo a Mercado Libre...' : 'Reconectar / Cambiar Cuenta MELI'}
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="meli-disconnected-details">
                  <div className="meli-connect-promo glass">
                    <div className="meli-promo-badge">
                      <Zap size={16} />
                      <span>Paso Obligatorio</span>
                    </div>
                    <h4>Conectá tu Tienda de Mercado Libre</h4>
                    <p>
                      Para que el Asistente IA pueda responder preguntas pre-venta, gestionar reclamos y procesar mensajes post-venta en tu cuenta, necesitás autorizar la aplicación de Mercado Libre.
                    </p>

                    <div className="meli-benefits-list">
                      <div className="meli-benefit-item">
                        <CheckCircle2 size={16} className="meli-check-icon" />
                        <span>Recepción de preguntas de compradores en tiempo real vía Webhooks</span>
                      </div>
                      <div className="meli-benefit-item">
                        <CheckCircle2 size={16} className="meli-check-icon" />
                        <span>Publicación inteligente de respuestas automáticas con IA</span>
                      </div>
                      <div className="meli-benefit-item">
                        <CheckCircle2 size={16} className="meli-check-icon" />
                        <span>Monitoreo continuo de reclamos y SLA de atención</span>
                      </div>
                      <div className="meli-benefit-item">
                        <CheckCircle2 size={16} className="meli-check-icon" />
                        <span>Conexión 100% segura con credenciales cifradas OAuth 2.0</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-meli-connect-primary"
                      onClick={handleConnectMeli}
                      disabled={connectingMeli}
                    >
                      <ShoppingBag size={18} />
                      {connectingMeli ? 'Abriendo Mercado Libre...' : 'Conectar con Mercado Libre'}
                      <ExternalLink size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── IA USAGE TAB ───────────────────────────────────────────────── */}
        {activeTab === 'ia_usage' && (
          <div className="config-section">
            <LLMUsageCard />
          </div>
        )}
      </div>
    </div>
  )
}
