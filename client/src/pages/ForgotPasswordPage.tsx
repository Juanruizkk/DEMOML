// client/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import './LoginPage.css'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // silencioso — no revelamos si el email existe
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="login-root">
      <div className="login-glow login-glow-1" aria-hidden="true" />
      <div className="login-glow login-glow-2" aria-hidden="true" />

      <div className="login-container">
        <div className="login-card glass-panel">
          <div className="login-brand-header">
            <div className="login-logo-glow-wrap">
              <div className="login-logo-badge">
                <Bot size={26} className="text-white" />
              </div>
            </div>
            <div className="login-brand-texts">
              <div className="brand-title-row">
                <h1 className="login-brand-title">MELI AI</h1>
                <span className="login-pro-pill">PRO</span>
              </div>
              <p className="login-tagline">Recuperación de contraseña</p>
            </div>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <p style={{ fontSize: '15px', color: 'var(--text-primary, #f8fafc)', marginBottom: '8px' }}>
                📬 Revisá tu casilla de correo
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginBottom: '24px', lineHeight: '1.5' }}>
                Si el email está registrado, recibirás un link de recuperación en los próximos minutos.
              </p>
              <button
                className="login-submit-btn"
                onClick={() => navigate('/login')}
              >
                <span className="btn-normal-content">
                  <ArrowLeft size={16} /> Volver al login
                </span>
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field-group">
                <label className="login-label" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="login-input-wrap">
                  <Mail size={17} className="input-icon-left" />
                  <input
                    id="email"
                    className="login-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej. vendedor@ejemplo.com"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button className="login-submit-btn" type="submit" disabled={loading || !email}>
                {loading ? (
                  <span className="btn-loading-content">
                    <span className="pulse-dot" /> Enviando…
                  </span>
                ) : (
                  <span className="btn-normal-content">
                    Enviar link de recuperación <ArrowRight size={17} />
                  </span>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
                >
                  ← Volver al login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
