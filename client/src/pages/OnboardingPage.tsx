import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { CheckCircle2, ShoppingBag, Zap, Shield, ArrowRight, ExternalLink } from 'lucide-react'
import './OnboardingPage.css'

interface OnboardingStatusDTO {
  isMeliConnected: boolean
  meliAuthUrl: string
  user: { name: string; email: string }
  tenant?: { nickname: string; autoAnswerEnabled: boolean }
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<OnboardingStatusDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<OnboardingStatusDTO>('/auth/onboarding-status')
      .then(data => {
        setStatus(data)
        if (data.isMeliConnected) {
          navigate('/dashboard', { replace: true })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) {
    return (
      <div className="onboarding-page">
        <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>
      </div>
    )
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-hero">
        <div className="onboarding-badge">
          <ShoppingBag size={28} />
        </div>
        <h1 className="onboarding-title">
          {status ? `¡Bienvenido, ${status.user.name.split(' ')[0]}!` : 'Bienvenido'}
        </h1>
        <p className="onboarding-subtitle">
          Para activar el asistente necesitás conectar tu cuenta de Mercado Libre.
          Es el único paso que falta.
        </p>
      </div>

      <div className="onboarding-features">
        <div className="onboarding-feature">
          <Zap size={18} className="onboarding-feature-icon" />
          <div>
            <p className="onboarding-feature-title">Respuestas en 1–3 segundos</p>
            <p className="onboarding-feature-desc">La IA responde las preguntas de tus compradores automáticamente.</p>
          </div>
        </div>
        <div className="onboarding-feature">
          <Shield size={18} className="onboarding-feature-icon" />
          <div>
            <p className="onboarding-feature-title">Moderación anti-sanciones</p>
            <p className="onboarding-feature-desc">Bloquea respuestas que podrían costarte la cuenta en ML.</p>
          </div>
        </div>
        <div className="onboarding-feature">
          <CheckCircle2 size={18} className="onboarding-feature-icon" />
          <div>
            <p className="onboarding-feature-title">Control total desde el panel</p>
            <p className="onboarding-feature-desc">Aprobá, editá o rechazá respuestas con un clic.</p>
          </div>
        </div>
      </div>

      <div className="onboarding-cta-section">
        <a
          href={status?.meliAuthUrl}
          className="btn-connect-meli"
        >
          <ShoppingBag size={18} />
          Conectar con Mercado Libre
          <ExternalLink size={14} className="btn-connect-external" />
        </a>
        <p className="onboarding-cta-hint">
          Se abre la pantalla de autorización oficial de Mercado Libre.
          Tomá menos de un minuto.
        </p>
        <button
          className="btn-skip-to-config"
          onClick={() => navigate('/config?tab=connection')}
        >
          Ver opciones de configuración avanzada
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
