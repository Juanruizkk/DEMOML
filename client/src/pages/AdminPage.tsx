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
  Clock
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

const PERMISSION_LABELS: Record<string, string> = {
  whatsappEnabled:  'WhatsApp',
  telegramEnabled:  'Telegram',
  emailEnabled:     'Email',
  preSaleEnabled:   'Pre-venta',
  postSaleEnabled:  'Post-venta',
  multiUserEnabled: 'Equipo / Multi-Usuario',
}

export default function AdminPage() {
  const [metrics, setMetrics]           = useState<Metrics | null>(null)
  const [tenants, setTenants]           = useState<TenantOverview[]>([])
  const [pending, setPending]           = useState<PendingInvitation[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [localPerms, setLocalPerms]     = useState<Record<string, boolean>>({})

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
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setResetSent(null)
  }, [selected])

  const selectTenant = async (t: TenantOverview) => {
    setSelected(t.sellerId)
    try {
      const detail = await api.get<{ settings: { permissions?: Record<string, boolean> } }>(`/admin/tenants/${t.sellerId}`)
      setLocalPerms(detail.settings?.permissions || {
        whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
        preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false,
      })
    } catch {
      setLocalPerms({ whatsappEnabled: true, telegramEnabled: true, emailEnabled: false, preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false })
    }
  }

  const savePermissions = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.put(`/admin/tenants/${selected}/permissions`, { permissions: localPerms })
      setTenants(ts => ts.map(t =>
        t.sellerId === selected ? { ...t, permissions: { ...localPerms } } : t
      ))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
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
        <div className="admin-layout">
          {/* Tenant list */}
          <div className="tenant-list">
            <div className="tenant-list-header">
              <span className="tenant-list-title">Organizaciones</span>
              <button className="btn-new-tenant" onClick={openModal}>
                <UserPlus size={13} />
                <span>Nuevo Tenant</span>
              </button>
            </div>

            {/* Pending invitations */}
            {pending.length > 0 && (
              <div className="pending-section">
                <div className="pending-section-title">
                  <Clock size={12} />
                  <span>Invitaciones pendientes</span>
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
                        style={{
                          background: 'none', border: '1px solid #334155', borderRadius: '6px',
                          color: '#94a3b8', fontSize: '11px', padding: '3px 8px', cursor: 'pointer'
                        }}
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
            {tenants.map(t => (
              <button
                key={t.sellerId}
                className={`tenant-row${selected === t.sellerId ? ' tenant-row--active' : ''}`}
                onClick={() => selectTenant(t)}
              >
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
            ))}
          </div>

          {/* Tenant detail */}
          {selectedTenant ? (
            <div className="tenant-detail glass">
              <div className="tenant-detail-header">
                <div>
                  <p className="tenant-detail-name">{selectedTenant.nickname || selectedTenant.sellerId}</p>
                  <p className="tenant-detail-id tabular">ID: {selectedTenant.sellerId}</p>
                </div>
              </div>

              <div className="permissions-section">
                <p className="permissions-title">Permisos granulares</p>
                <p className="permissions-hint">Controlá qué funcionalidades tiene disponibles este tenant.</p>

                <div className="permissions-grid">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <div key={key} className="permission-item">
                      <div className="permission-info">
                        <span className="permission-label">{label}</span>
                        {key === 'emailEnabled' && (
                          <span className="permission-soon">próximamente</span>
                        )}
                      </div>
                      <button
                        className={`toggle${localPerms[key] ? ' toggle--on' : ''}${key === 'emailEnabled' ? ' toggle--disabled' : ''}`}
                        disabled={key === 'emailEnabled'}
                        onClick={() => setLocalPerms(p => ({ ...p, [key]: !p[key] }))}
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="btn-save" onClick={savePermissions} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar permisos'}
                </button>
                {selectedTenant.email && (
                  <button
                    style={{
                      marginTop: '8px', width: '100%', background: 'none',
                      border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8',
                      fontSize: '13px', padding: '8px', cursor: 'pointer'
                    }}
                    disabled={resetting === selectedTenant.email}
                    onClick={() => handleResetForTenant(selectedTenant.email!)}
                  >
                    {resetting === selectedTenant.email ? 'Enviando…' : '🔑 Resetear contraseña'}
                  </button>
                )}
                {resetSent && (
                  <p style={{ fontSize: '12px', color: '#10b981', marginTop: '8px', textAlign: 'center' }}>
                    ✓ Email de reset enviado a {resetSent}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="tenant-detail-empty">
              <span className="list-empty-icon">◈</span>
              <p>Seleccioná un tenant para ver y editar sus permisos</p>
            </div>
          )}
        </div>
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

