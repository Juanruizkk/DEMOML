import { useState, useEffect } from 'react'
import { api } from '../api/client'
import MonthPicker from './MonthPicker'
import './LLMUsageCard.css'

interface MonthlyStats {
  yearMonth: string
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
  spendingLimitUsd: number | null
}

interface LogEntry {
  channel: string
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  tokensEstimated: boolean
  costUsd: number
  latencyMs: number
  createdAt: string
}

interface UsageData {
  monthly: MonthlyStats | null
  recentLogs: LogEntry[]
  hasOwnKey: boolean
}

export default function LLMUsageCard() {
  // Use local date so the default month matches the user's timezone, not UTC
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [limitInput, setLimitInput] = useState('')
  const [editingLimit, setEditingLimit] = useState(false)
  const [savingLimit, setSavingLimit] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<UsageData>(`/tenant/llm-usage?month=${month}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [month])

  const saveLimit = async () => {
    setSavingLimit(true)
    try {
      const limitUsd = limitInput === '' ? null : parseFloat(limitInput)
      await api.patch('/tenant/llm-usage/limit', { limitUsd })
      setEditingLimit(false)
      const refreshed = await api.get<UsageData>(`/tenant/llm-usage?month=${month}`)
      setData(refreshed)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingLimit(false)
    }
  }

  if (!data && !loading) return null

  if (data && !data.hasOwnKey) {
    return (
      <div className="llm-usage-card llm-usage-card--shared">
        <p className="llm-usage-shared-msg">
          Usás el modelo compartido de la plataforma — el costo no aplica a tu cuenta.
        </p>
      </div>
    )
  }

  const monthly = data?.monthly ?? null
  const limit = monthly?.spendingLimitUsd ?? null
  const pct = monthly && limit ? Math.min((monthly.totalCostUsd / limit) * 100, 100) : null

  return (
    <div className="llm-usage-card">
      <div className="llm-usage-card-header">
        <h4>Consumo de IA</h4>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading && <p className="llm-loading">Cargando...</p>}

      {!loading && monthly && (
        <>
          <div className="llm-stats-row">
            <span>{monthly.totalCalls} llamadas</span>
            <span>{(monthly.totalTokens / 1000).toFixed(1)}K tokens</span>
            <span className="llm-cost">${monthly.totalCostUsd.toFixed(4)} USD</span>
          </div>

          {pct !== null && (
            <div className="llm-progress-wrap">
              <div className="llm-progress-bar">
                <div className="llm-progress-fill" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? '#ef4444' : 'var(--accent)' }} />
              </div>
              <span className="llm-progress-label">{pct.toFixed(0)}% de ${limit} USD</span>
            </div>
          )}

          {!editingLimit ? (
            <button
              className="llm-limit-btn"
              onClick={() => { setLimitInput(limit != null ? String(limit) : ''); setEditingLimit(true) }}
            >
              {limit != null ? `Límite de alerta: $${limit} USD` : 'Configurar límite de alerta'}
            </button>
          ) : (
            <div className="llm-limit-edit">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="USD (vacío = sin límite)"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="llm-limit-input"
              />
              <button onClick={saveLimit} disabled={savingLimit} className="llm-limit-save">
                {savingLimit ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditingLimit(false)} className="llm-limit-cancel">Cancelar</button>
            </div>
          )}
        </>
      )}

      {!loading && !monthly && (
        <p className="llm-no-data">Sin llamadas de IA registradas en {month}.</p>
      )}

      {!loading && data && data.recentLogs.length > 0 && (
        <details className="llm-logs">
          <summary>Últimas {data.recentLogs.length} llamadas</summary>
          <table className="llm-log-table">
            <thead>
              <tr><th>Canal</th><th>Modelo</th><th>Tokens</th><th>Costo</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {data.recentLogs.map((log, i) => (
                <tr key={`${log.createdAt}-${i}`}>
                  <td>{log.channel}</td>
                  <td>{log.model}{log.tokensEstimated && <span className="llm-est" title="estimado">~</span>}</td>
                  <td>{log.tokensIn + log.tokensOut}</td>
                  <td>${log.costUsd.toFixed(6)}</td>
                  <td>{new Date(log.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
