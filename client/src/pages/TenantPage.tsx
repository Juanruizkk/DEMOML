import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useNotifications, WebNotificationsSettings } from '../context/NotificationContext'
import PageHeader from '../components/PageHeader'
import { Bell, ShieldAlert, MessageSquare, Monitor, Mail, Send } from 'lucide-react'
import './TenantPage.css'

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

export default function TenantPage({ tab }: { tab?: string }) {
  const activeTab = tab || 'settings'
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)
  const { requestDesktopPermission, updateWebSettings } = useNotifications()

  useEffect(() => {
    api.get<any>('/tenant/settings')
      .then((res) => {
        const data = res.settings || res
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
  }, [])

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

  const titles: Record<string, string> = {
    settings:   'Configuración IA',
    channels:   'Canales de Alerta & Notificaciones',
    connection: 'Conexión MELI',
  }

  return (
    <div className="page">
      <PageHeader title={titles[activeTab] || 'Configuración'} subtitle="Portal del vendedor" />
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

            <div className="tenant-form glass">
              <div className="card-section-header">
                <div className="header-icon-box emerald"><Monitor size={18} /></div>
                <div>
                  <h3 className="section-title">Canales Externos (WhatsApp, Telegram & Email)</h3>
                  <p className="section-sub">Alertas directas a tu teléfono personal, chat de equipo o correo</p>
                </div>
              </div>

              <div className="tenant-field">
                <label className="tenant-label">Canal preferido de despacho</label>
                <div className="channel-options" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { id: 'whatsapp', label: 'WhatsApp' },
                    { id: 'telegram', label: 'Telegram' },
                    { id: 'email',    label: 'Email' },
                    { id: 'both',     label: 'WA + TG' },
                    { id: 'all',      label: 'Todos' },
                  ].map(ch => (
                    <button key={ch.id} type="button"
                      className={`channel-btn${(settings.preferredAlertChannel || 'whatsapp') === ch.id ? ' channel-btn--active' : ''}`}
                      onClick={() => set('preferredAlertChannel', ch.id)}>
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {(settings.preferredAlertChannel === 'whatsapp' || settings.preferredAlertChannel === 'both' || settings.preferredAlertChannel === 'all' || !settings.preferredAlertChannel) && (
                <div className="tenant-field">
                  <label className="tenant-label">Teléfono WhatsApp</label>
                  <input type="tel" className="tenant-input" value={settings.whatsappAlertPhone || ''}
                    onChange={e => set('whatsappAlertPhone', e.target.value)} placeholder="+5491112345678" />
                </div>
              )}

              {(settings.preferredAlertChannel === 'telegram' || settings.preferredAlertChannel === 'both' || settings.preferredAlertChannel === 'all') && (
                <div className="tenant-field">
                  <label className="tenant-label">Telegram Chat ID</label>
                  <input type="text" className="tenant-input" value={settings.telegramAlertChatId || ''}
                    onChange={e => set('telegramAlertChatId', e.target.value)} placeholder="-100123456789" />
                </div>
              )}

              <button className="btn-save" onClick={save}>{saved ? '✓ Guardado' : 'Guardar cambios'}</button>
            </div>

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
          </div>
        )}

        {/* ── CONNECTION TAB ─────────────────────────────────────────────── */}
        {activeTab === 'connection' && (
          <div className="tenant-form glass">
            <div className="connection-status">
              <span className="connection-dot connection-dot--ok" />
              <div>
                <p className="connection-label">Conexión MELI activa</p>
                <p className="connection-hint">Tu token está sincronizado. Se renueva automáticamente.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
