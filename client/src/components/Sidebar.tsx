import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  MessageSquare,
  AlertTriangle,
  Package,
  Sliders,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  LogOut,
  Bot,
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import './Sidebar.css'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  badge?: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  // Módulos del Vendedor / Tenant
  {
    to: '/questions',
    icon: <MessageSquare size={18} />,
    label: 'Preguntas',
    roles: ['tenant', 'demo'],
  },
  {
    to: '/claims',
    icon: <AlertTriangle size={18} />,
    label: 'Reclamos',
    roles: ['tenant', 'demo'],
  },
  {
    to: '/products',
    icon: <Package size={18} />,
    label: 'Catálogo & Reglas',
    badge: 'Nuevo',
    roles: ['tenant', 'demo'],
  },
  {
    to: '/settings',
    icon: <Sliders size={18} />,
    label: 'Configuración IA',
    roles: ['tenant'],
  },
  {
    to: '/channels',
    icon: <Radio size={18} />,
    label: 'Canales & Alertas',
    roles: ['tenant'],
  },
  {
    to: '/connection',
    icon: <RefreshCw size={18} />,
    label: 'Conexión MELI',
    roles: ['tenant'],
  },

  // Módulos de Demo
  {
    to: '/demo',
    icon: <Sparkles size={18} />,
    label: 'Preparar Demo',
    roles: ['demo', 'super_admin'],
  },

  // Módulos del Super Admin
  {
    to: '/admin',
    icon: <Shield size={18} />,
    label: 'Panel Super Admin',
    roles: ['super_admin'],
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  if (!user) return null

  const visible = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabel =
    user.role === 'super_admin'
      ? 'Super Admin'
      : user.role === 'demo'
      ? 'Modo Demo'
      : 'Vendedor'

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-icon">
          <Bot size={22} className="text-white" />
        </div>
        <div className="brand-info">
          <span className="brand-title">MELI AI</span>
          <span className="brand-badge">PRO</span>
        </div>
      </div>

      {/* Seller Status Chip */}
      <div className="sidebar-status-card">
        <div className="status-indicator">
          <span className="pulse-dot emerald" />
          <span className="status-text">Asistente Activo</span>
        </div>
        <div className="status-seller-id">
          Seller ID: {user.sellerId || (user.role === 'super_admin' ? 'Global' : '3680586616')}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-menu">
        <div className="menu-group-label">MÓDULOS PRINCIPALES</div>
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="link-icon">{item.icon}</span>
            <span className="link-text">{item.label}</span>
            {item.badge && <span className="link-badge">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Footer */}
      <div className="sidebar-footer-card">
        <div className="user-profile-summary">
          <div className="user-avatar-circle">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="user-text-meta">
            <p className="user-display-name">{user.name || 'Usuario'}</p>
            <p className="user-role-badge">{roleLabel}</p>
          </div>
        </div>
        <div className="footer-actions">
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="btn-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
