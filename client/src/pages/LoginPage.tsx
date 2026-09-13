import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px', padding: '2rem', background: '#1a1a2e', borderRadius: '8px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>MELI AI Assistant</h1>
        {error && <div style={{ color: '#f87171', background: '#1f0a0a', padding: '0.75rem', borderRadius: '4px' }}>{error}</div>}
        <label>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem', background: '#0d0d1a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0' }}
          />
        </label>
        <label>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem', background: '#0d0d1a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0' }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.75rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
