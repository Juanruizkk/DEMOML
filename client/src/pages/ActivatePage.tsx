import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import './ActivatePage.css'

export default function ActivatePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/activate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al activar la cuenta.')

      // Limpiar cualquier sesión previa (ej: super admin) antes de guardar el nuevo token
      localStorage.removeItem('meli_jwt')
      localStorage.removeItem('token')
      localStorage.setItem('meli_jwt', data.token)
      localStorage.setItem('token', data.token)
      setDone(true)
      // Hard reload para que AuthContext reinicie con el nuevo usuario
      setTimeout(() => { window.location.replace('/onboarding') }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="activate-page">
      <div className="activate-card">
        <div className="activate-logo">MeliBot</div>

        {done ? (
          <div className="activate-success">
            <div className="activate-success-icon">✓</div>
            <p className="activate-success-title">Cuenta activada</p>
            <p className="activate-success-text">Redirigiendo al onboarding…</p>
          </div>
        ) : (
          <>
            <h1 className="activate-title">Activá tu cuenta</h1>
            <p className="activate-subtitle">
              Elegí una contraseña para acceder al panel de gestión.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="activate-field">
                <label className="activate-label">Contraseña</label>
                <div className="activate-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="activate-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                  />
                  <button type="button" className="activate-eye" onClick={() => setShowPassword(v => !v)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="activate-field">
                <label className="activate-label">Repetir contraseña</label>
                <div className="activate-input-wrap">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="activate-input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetí la contraseña"
                  />
                  <button type="button" className="activate-eye" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="activate-btn" disabled={loading}>
                {loading ? 'Activando…' : 'Activar cuenta'}
              </button>
              {error && <p className="activate-error">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
