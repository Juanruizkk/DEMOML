import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import './Layout.css'

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <header className="app-top-nav">
          <div className="top-nav-left">
            <span className="platform-tag">MERCADO LIBRE AI AUTOMATION</span>
          </div>
          <div className="top-nav-right">
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <NotificationBell />
          </div>
        </header>
        <div className="app-page-content">{children}</div>
      </main>
    </div>
  )
}
