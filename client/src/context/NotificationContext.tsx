import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../api/client'

export interface WebNotificationsSettings {
  enabled: boolean
  scope: 'all' | 'questions_only' | 'claims_only'
  soundEnabled: boolean
  desktopPushEnabled: boolean
}

export interface NotificationItem {
  id: string
  type: 'question' | 'claim' | 'system'
  title: string
  message: string
  timestamp: string
  read: boolean
  link?: string
  urgency?: 'critical' | 'warning' | 'normal'
}

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  webSettings: WebNotificationsSettings
  updateWebSettings: (settings: Partial<WebNotificationsSettings>) => Promise<void>
  requestDesktopPermission: () => Promise<boolean>
}

const DEFAULT_WEB_SETTINGS: WebNotificationsSettings = {
  enabled: true,
  scope: 'all',
  soundEnabled: true,
  desktopPushEnabled: false,
}

const NotificationContext = createContext<NotificationContextType | null>(null)

// Synthesizer Chime using Web Audio API
function playChime(urgency?: string) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    const now = ctx.currentTime

    if (urgency === 'critical') {
      // High alert two-tone beep
      osc.frequency.setValueAtTime(880, now) // A5
      osc.frequency.setValueAtTime(1108.73, now + 0.1) // C#6
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } else {
      // Gentle melodious glass chime
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.45)
    }
  } catch {
    // Audio context not allowed until user gesture or unsupported
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const sellerId = user?.sellerId || (user?.role === 'super_admin' ? 'all' : '3680586616')

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [webSettings, setWebSettings] = useState<WebNotificationsSettings>(DEFAULT_WEB_SETTINGS)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load notifications and settings on mount / tenant change
  useEffect(() => {
    if (!sellerId) return

    // 1. Load cached notifications from localStorage
    try {
      const stored = localStorage.getItem(`meli_notifications_${sellerId}`)
      if (stored) {
        setNotifications(JSON.parse(stored))
      }
    } catch {
      setNotifications([])
    }

    // 2. Fetch tenant settings from API
    api.get<any>('/tenant/settings')
      .then((res) => {
        if (res?.webNotifications) {
          setWebSettings({
            ...DEFAULT_WEB_SETTINGS,
            ...res.webNotifications,
          })
        }
      })
      .catch(() => {})
  }, [sellerId])

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (!sellerId) return
    try {
      localStorage.setItem(`meli_notifications_${sellerId}`, JSON.stringify(notifications.slice(0, 50)))
    } catch {}
  }, [notifications, sellerId])

  // Real-time SSE Connection
  useEffect(() => {
    if (!user) return

    const url = `/api/events/stream?seller_id=${sellerId}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    const handleEvent = (type: 'question' | 'claim', data: any) => {
      // Check if notifications are disabled in settings
      if (!webSettings.enabled) return

      // Check scope filter
      if (webSettings.scope === 'questions_only' && type !== 'question') return
      if (webSettings.scope === 'claims_only' && type !== 'claim') return

      let newItem: NotificationItem

      if (type === 'question') {
        const text = data.text || data.questionText || 'Nueva consulta recibida'
        const itemId = data.itemId || data.item_id || ''
        newItem = {
          id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'question',
          title: '💬 Nueva Pregunta en Mercado Libre',
          message: text.length > 80 ? `${text.slice(0, 80)}...` : text,
          timestamp: new Date().toISOString(),
          read: false,
          link: itemId ? `/questions` : '/questions',
          urgency: 'normal',
        }
      } else {
        const reason = data.reason || 'Nuevo reclamo iniciado'
        const hours = data.remaining_hours || data.remainingHours
        const urgency = data.urgency || (hours && hours <= 12 ? 'critical' : 'warning')
        newItem = {
          id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'claim',
          title: urgency === 'critical' ? '🔴 RECLAMO CRÍTICO (<12h SLA)' : '⚖️ Nuevo Reclamo Recibido',
          message: `${reason}${hours ? ` · SLA restante: ${hours}hs` : ''}`,
          timestamp: new Date().toISOString(),
          read: false,
          link: '/claims',
          urgency: urgency as any,
        }
      }

      setNotifications((prev) => [newItem, ...prev])

      // Play sound
      if (webSettings.soundEnabled) {
        playChime(newItem.urgency)
      }

      // Browser Desktop Push Notification
      if (
        webSettings.desktopPushEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(newItem.title, {
            body: newItem.message,
            icon: '/favicon.ico',
          })
        } catch {}
      }
    }

    es.addEventListener('question_received', (e) => {
      try {
        handleEvent('question', JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('question_pending_review', (e) => {
      try {
        handleEvent('question', JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('claim_received', (e) => {
      try {
        handleEvent('claim', JSON.parse(e.data))
      } catch {}
    })

    return () => {
      es.close()
    }
  }, [user, sellerId, webSettings])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const updateWebSettings = async (partial: Partial<WebNotificationsSettings>) => {
    const updated = { ...webSettings, ...partial }
    setWebSettings(updated)
    try {
      await api.put('/tenant/settings', {
        webNotifications: updated,
      })
    } catch (err) {
      console.error('Error saving web notification settings:', err)
    }
  }

  const requestDesktopPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }
    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      if (granted) {
        await updateWebSettings({ desktopPushEnabled: true })
      }
      return granted
    } catch {
      return false
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        webSettings,
        updateWebSettings,
        requestDesktopPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
