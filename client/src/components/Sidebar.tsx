import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Sidebar.css'

interface NavItem {
  to: string
  icon: string
  label: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/questions', icon: '◎', label: 'Preguntas',     roles: ['tenant', 'super_admin', 'demo'] },
  { to: '/claims',    icon: '⚑', label: 'Reclamos',      roles: ['tenant', 'super_admin', 'demo'] },
  { to: '/settings',  icon: '⌘', label: 'Configuración', roles: ['tenant', 'super_admin'] },
  { to: '/channels',  icon: '⊕', label: 'Canales',       roles: ['tenant', 'super_admin'] },
  { to: '/connection',icon: '⟳', label: 'Conexión MELI', roles: ['tenant', 'super_admin'] },
  { to: '/admin',     icon: '◈', label: 'Super Admin',   roles: ['super_admin'] },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const visible = NAV_ITEMS.filter(item => item.roles.includes(user.role))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email[0].toUpperCase()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo" title="MELI AI">
        <div className="sidebar-logo-mark">
          <span>M</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom — user */}
      <div className="sidebar-footer">
        <button
          className="sidebar-user"
          onClick={handleLogout}
          title={`${user.name || user.email} — Salir`}
        >
          <span className="sidebar-avatar">{initials}</span>
        </button>
      </div>
    </aside>
  )
}
