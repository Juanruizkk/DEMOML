import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import './TenantPage.css'

interface TenantSettings {
  autoAnswerEnabled: boolean
  confidenceThreshold: number
  tone: string
  customInstructions?: string
  preferredAlertChannel?: string
  whatsappAlertPhone?: string
  telegramAlertChatId?: string
  telegramEnabled?: boolean
}

export default function TenantPage({ tab }: { tab?: string }) {
  const activeTab = tab || 'settings'
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    api.get<TenantSettings>('/tenant/settings')
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!settings) return
    await api.put('/tenant/settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const titles: Record<string, string> = {
    settings:   'Configuración IA',
    channels:   'Canales de Alerta',
    connection: 'Conexión MELI',
  }

  return (
    <div className="page">
      <PageHeader title={titles[activeTab] || 'Configuración'} subtitle="Portal del vendedor" />
      <div className="tenant-content">
        {loading && <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>}

        {!loading && settings && activeTab === 'settings' && (
          <div className="tenant-form glass">
            <div className="tenant-field">
              <label className="tenant-label">Auto-respuesta IA</label>
              <div className="toggle-row">
                <span className="tenant-hint">Activar respuesta automática con IA para preguntas de alta confianza</span>
                <button
                  className={`toggle${settings.autoAnswerEnabled ? ' toggle--on' : ''}`}
                  onClick={() => setSettings(s => s ? { ...s, autoAnswerEnabled: !s.autoAnswerEnabled } : s)}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="tenant-field">
              <label className="tenant-label">
                Umbral de confianza — <span className="tenant-value">{Math.round((settings.confidenceThreshold || 0) * 100)}%</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={settings.confidenceThreshold}
                onChange={e => setSettings(s => s ? { ...s, confidenceThreshold: parseFloat(e.target.value) } : s)}
                className="tenant-range"
              />
              <div className="tenant-range-labels">
                <span>0% (todo manual)</span>
                <span>100% (todo auto)</span>
              </div>
            </div>

            <div className="tenant-field">
              <label className="tenant-label">Tono de respuesta</label>
              <select
                className="tenant-select"
                value={settings.tone}
                onChange={e => setSettings(s => s ? { ...s, tone: e.target.value } : s)}
              >
                <option value="casual_rioplatense">Casual rioplatense</option>
                <option value="formal">Formal</option>
                <option value="concise">Conciso</option>
              </select>
            </div>

            <div className="tenant-field">
              <label className="tenant-label">Instrucciones personalizadas</label>
              <textarea
                className="tenant-textarea"
                rows={4}
                value={settings.customInstructions || ''}
                onChange={e => setSettings(s => s ? { ...s, customInstructions: e.target.value } : s)}
                placeholder="Ej: Siempre mencionar garantía de 12 meses. No prometer envíos en el día."
              />
            </div>

            <button className="btn-save" onClick={save}>
              {saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {!loading && settings && activeTab === 'channels' && (
          <div className="tenant-form glass">
            <div className="tenant-field">
              <label className="tenant-label">Canal preferido de alertas</label>
              <div className="channel-options">
                {['whatsapp', 'telegram', 'both'].map(ch => (
                  <button
                    key={ch}
                    className={`channel-btn${settings.preferredAlertChannel === ch ? ' channel-btn--active' : ''}`}
                    onClick={() => setSettings(s => s ? { ...s, preferredAlertChannel: ch } : s)}
                  >
                    {ch === 'whatsapp' ? 'WhatsApp' : ch === 'telegram' ? 'Telegram' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>

            {(settings.preferredAlertChannel === 'whatsapp' || settings.preferredAlertChannel === 'both') && (
              <div className="tenant-field">
                <label className="tenant-label">Teléfono WhatsApp</label>
                <input
                  type="tel"
                  className="tenant-input"
                  value={settings.whatsappAlertPhone || ''}
                  onChange={e => setSettings(s => s ? { ...s, whatsappAlertPhone: e.target.value } : s)}
                  placeholder="+5491112345678"
                />
              </div>
            )}

            {(settings.preferredAlertChannel === 'telegram' || settings.preferredAlertChannel === 'both') && (
              <div className="tenant-field">
                <label className="tenant-label">Telegram Chat ID</label>
                <input
                  type="text"
                  className="tenant-input"
                  value={settings.telegramAlertChatId || ''}
                  onChange={e => setSettings(s => s ? { ...s, telegramAlertChatId: e.target.value } : s)}
                  placeholder="-100123456789"
                />
              </div>
            )}

            <button className="btn-save" onClick={save}>
              {saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        )}

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
