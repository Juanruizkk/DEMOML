import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, NotificationItem } from '../context/NotificationContext'
import {
  Bell,
  BellRing,
  MessageSquare,
  ShieldAlert,
  Clock,
  CheckCheck,
  Trash2,
  Sliders,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import './NotificationBell.css'

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const handleNotificationClick = (n: NotificationItem) => {
    markAsRead(n.id)
    setIsOpen(false)
    if (n.link) {
      navigate(n.link)
    }
  }

  const handleConfigureClick = () => {
    setIsOpen(false)
    navigate('/channels')
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className={`bell-trigger-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Centro de Notificaciones"
      >
        {unreadCount > 0 ? (
          <BellRing size={19} className="bell-ring-anim" />
        ) : (
          <Bell size={19} />
        )}
        {unreadCount > 0 && (
          <span className="unread-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown glass-panel">
          {/* Header */}
          <div className="dropdown-header">
            <div className="header-title-box">
              <span className="header-title">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="badge badge-rose">{unreadCount} nuevas</span>
              )}
            </div>
            <div className="header-actions">
              {unreadCount > 0 && (
                <button
                  className="header-action-btn"
                  onClick={markAllAsRead}
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={14} /> Leídas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="header-action-btn text-muted"
                  onClick={clearAll}
                  title="Borrar historial"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="notifications-scroll-area">
            {notifications.length === 0 ? (
              <div className="empty-notifications-box">
                <Bell size={32} className="text-dim" />
                <p className="empty-title">Sin notificaciones pendientes</p>
                <p className="empty-sub">
                  Te avisaremos en tiempo real ante cualquier pregunta o reclamo nuevo.
                </p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((n) => {
                  const isQuestion = n.type === 'question'
                  const isCritical = n.urgency === 'critical'

                  return (
                    <div
                      key={n.id}
                      className={`notification-item-card ${!n.read ? 'is-unread' : ''} ${isCritical ? 'is-critical' : ''}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div className={`notif-icon-bubble ${isQuestion ? 'blue' : isCritical ? 'rose' : 'amber'}`}>
                        {isQuestion ? (
                          <MessageSquare size={16} />
                        ) : (
                          <ShieldAlert size={16} />
                        )}
                      </div>

                      <div className="notif-content-col">
                        <div className="notif-title-row">
                          <span className="notif-title">{n.title}</span>
                          {!n.read && <span className="unread-dot" />}
                        </div>
                        <p className="notif-message">{n.message}</p>
                        <span className="notif-time">
                          <Clock size={11} /> {formatTimeAgo(n.timestamp)}
                        </span>
                      </div>

                      <div className="notif-arrow">
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="dropdown-footer">
            <button className="footer-config-link" onClick={handleConfigureClick}>
              <Sliders size={13} /> Configurar alcance y sonido de alertas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} hs`
  return `hace ${Math.floor(h / 24)} días`
}
