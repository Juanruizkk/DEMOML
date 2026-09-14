import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
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

  const selectTenant = async (t: TenantOverview) => {
    setSelected(t.sellerId)
    try {
      const detail = await api.get<{ settings: { permissions?: Record<string, boolean> } }>(`/admin/tenants/${t.sellerId}`)
      setLocalPerms(detail.settings?.permissions || {
        whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
        preSaleEnabled: true, postSaleEnabled: true,
      })
    } catch {
      setLocalPerms({ whatsappEnabled: true, telegramEnabled: true, emailEnabled: false, preSaleEnabled: true, postSaleEnabled: true })
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
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedTenant = tenants.find(t => t.sellerId === selected)

  return (
    <div className="page">
      <PageHeader
        title="Super Admin"
        subtitle="Panel de operaciones"
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
              <p className="tenant-list-title">Tenants</p>
              <button className="btn-new-tenant" onClick={openModal}>+ Nuevo</button>
            </div>

            {/* Pending invitations */}
            {pending.length > 0 && (
              <div className="pending-section">
                {pending.map(inv => (
                  <div key={inv.id} className="tenant-row tenant-row--pending">
                    <div className="tenant-row-info">
                      <span className="tenant-row-name">{inv.name}</span>
                      <span className="tenant-row-email">{inv.email}</span>
                    </div>
                    <span className="badge-pending">Pendiente</span>
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
          <div className="modal-card glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nuevo tenant</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {createdLink ? (
              <div className="modal-success">
                <p className="modal-success-text">
                  Cuenta creada. Enviá este link al tenant para que active su cuenta:
                </p>
                <div className="activation-link-box">
                  <span className="activation-link-text">{createdLink}</span>
                </div>
                <button className="btn-copy" onClick={copyLink}>
                  {copied ? '✓ Copiado' : 'Copiar link'}
                </button>
                <button className="btn-save" style={{ marginTop: 12 }} onClick={closeModal}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="modal-field">
                  <label className="modal-label">Nombre</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Acme Corp"
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Email</label>
                  <input
                    type="email"
                    className="tenant-input"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="admin@acme.com"
                    required
                  />
                </div>
                {createError && <p className="modal-error">{createError}</p>}
                <button type="submit" className="btn-save" disabled={creating}>
                  {creating ? 'Creando…' : 'Crear tenant'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
