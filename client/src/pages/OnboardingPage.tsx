import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import './OnboardingPage.css'

interface OnboardingStatus {
  completed: boolean
  steps?: string[]
}

export default function OnboardingPage() {
  const [status, setStatus]   = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.get<OnboardingStatus>('/auth/onboarding-status')
      .then(setStatus)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar estado'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <PageHeader
        title="Onboarding"
        subtitle="Configuración inicial"
        stats={status ? [
          {
            label: 'Estado',
            value: status.completed ? 'Completado' : 'Pendiente',
            color: status.completed ? 'emerald' : 'amber',
          },
        ] : []}
      />
      <div className="onboarding-content">
        {loading && (
          <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>
        )}
        {error && (
          <p className="onboarding-error">{error}</p>
        )}
        {status && (
          <div className="onboarding-card glass">
            <div className="onboarding-status-row">
              <span className={`onboarding-dot${status.completed ? ' onboarding-dot--ok' : ' onboarding-dot--pending'}`} />
              <div>
                <p className="onboarding-status-label">
                  {status.completed ? 'Onboarding completado' : 'Configuración pendiente'}
                </p>
                <p className="onboarding-status-hint">
                  {status.completed
                    ? 'Tu cuenta está lista para recibir preguntas.'
                    : 'Completá los pasos a continuación para empezar.'}
                </p>
              </div>
            </div>

            {status.steps && status.steps.length > 0 && (
              <ul className="onboarding-steps">
                {status.steps.map((step, i) => (
                  <li key={i} className="onboarding-step">
                    <span className="onboarding-step-num tabular">{String(i + 1).padStart(2, '0')}</span>
                    <span className="onboarding-step-text">{step}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
