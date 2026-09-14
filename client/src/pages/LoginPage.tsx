import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  Bot,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  ArrowRight,
  Store,
  Film,
  Shield
} from 'lucide-react'
import './LoginPage.css'

export default function LoginPage() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = (userEmail: string, userPass: string) => {
    setEmail(userEmail)
    setPassword(userPass)
    setError('')
  }

  return (
    <div className="login-root">
      {/* Background Ambient Glows */}
      <div className="login-glow login-glow-1" aria-hidden="true" />
      <div className="login-glow login-glow-2" aria-hidden="true" />

      {/* Top Controls */}
      <div className="login-top-bar">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="login-container">
        <div className="login-card glass-panel">
          {/* Brand Header */}
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
              <p className="login-tagline">
                Plataforma de automatización inteligente para Mercado Libre
              </p>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="login-error-card" role="alert">
              <span className="pulse-dot rose" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
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
                  placeholder="ej. test@test.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <div className="field-label-row">
                <label className="login-label" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <div className="login-input-wrap">
                <Lock size={17} className="input-icon-left" />
                <input
                  id="password"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn-right"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button className="login-submit-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading-content">
                  <span className="pulse-dot" /> Iniciando sesión…
                </span>
              ) : (
                <span className="btn-normal-content">
                  Ingresar al Sistema <ArrowRight size={17} />
                </span>
              )}
            </button>
          </form>

          {/* Quick Access Demo Buttons */}
          <div className="login-quick-section">
            <span className="quick-lead-label">ACCESO RÁPIDO DE PRUEBA</span>
            <div className="quick-pills-row">
              <button
                type="button"
                className="quick-pill"
                onClick={() => handleQuickFill('test@test.com', 'Test123456!')}
              >
                <Store size={13} /> Vendedor
              </button>
              <button
                type="button"
                className="quick-pill"
                onClick={() => handleQuickFill('demo@melibot.com', 'Demo123456!')}
              >
                <Film size={13} /> Modo Demo
              </button>
              <button
                type="button"
                className="quick-pill"
                onClick={() => handleQuickFill('admin@melibot.com', 'Admin123456!')}
              >
                <Shield size={13} /> Super Admin
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="login-security-footer">
          <ShieldCheck size={14} className="text-emerald" />
          <span>Conexión cifrada de extremo a extremo · Mercado Libre API v1.0</span>
        </div>
      </div>
    </div>
  )
}
