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

    const notifiedSet = new Set<string>()

    const handleQuestionEvent = (data: any) => {
      if (!webSettings.enabled) return
      if (webSettings.scope === 'claims_only') return

      const qId = data.id || data.questionId
      const status = data.appStatus || data.app_status
      const dedupeKey = `${qId}_${status}`
      if (notifiedSet.has(dedupeKey)) return
      notifiedSet.add(dedupeKey)

      const text = data.text || data.questionText || 'Nueva consulta recibida'
      const isAuto = status === 'auto_answered'
      const isReview = status === 'pending_review'

      let title = '💬 Nueva Pregunta'
      let urgency: 'normal' | 'warning' | 'critical' = 'normal'

      if (isAuto) {
        title = '⚡ Pregunta Auto-Respondida'
        urgency = 'normal'
      } else if (isReview) {
        title = '🤔 Pregunta Requiere Aprobación'
        urgency = 'warning'
      }

      const newItem: NotificationItem = {
        id: `q_${qId || Date.now()}_${status || 'rec'}`,
        type: 'question',
        title,
        message: text.length > 90 ? `${text.slice(0, 90)}...` : text,
        timestamp: new Date().toISOString(),
        read: false,
        link: '/questions',
        urgency,
      }

      setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)])

      // Play chime
      if (webSettings.soundEnabled) {
        playChime(newItem.urgency)
      }

      // Desktop notification
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

    const handleClaimEvent = (data: any) => {
      if (!webSettings.enabled) return
      if (webSettings.scope === 'questions_only') return

      const cId = data.id || data.claimId
      const reason = data.reason || 'Nuevo reclamo iniciado'
      const hours = data.remaining_hours || data.remainingHours
      const urgency = data.urgency || (hours && hours <= 12 ? 'critical' : 'warning')

      const newItem: NotificationItem = {
        id: `c_${cId || Date.now()}`,
        type: 'claim',
        title: urgency === 'critical' ? '🔴 RECLAMO CRÍTICO (<12h SLA)' : '⚖️ Nuevo Reclamo Recibido',
        message: `${reason}${hours ? ` · SLA restante: ${hours}hs` : ''}`,
        timestamp: new Date().toISOString(),
        read: false,
        link: '/claims',
        urgency: urgency as any,
      }

      setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)])

      if (webSettings.soundEnabled) {
        playChime(newItem.urgency)
      }

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
        handleQuestionEvent(JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('question_pending_review', (e) => {
      try {
        handleQuestionEvent(JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('question_updated', (e) => {
      try {
        handleQuestionEvent(JSON.parse(e.data))
      } catch {}
    })

    const handleOrderMessageEvent = (data: any) => {
      if (!webSettings.enabled) return

      const msgId = data.message_id || data.id
      const buyer = data.buyer_nickname || 'Comprador'
      const isAuto = Boolean(data.answer)
      const intent = data.intent
      const isClaimRisk = intent === 'reclamo_potencial'

      let title = isClaimRisk
        ? '🚨 Mensaje Post-Venta (Riesgo Reclamo)'
        : isAuto
        ? '⚡ Mensaje Post-Venta Auto-Respondido'
        : '💬 Nuevo Mensaje Post-Venta'
      let urgency: 'normal' | 'warning' | 'critical' = isClaimRisk ? 'critical' : isAuto ? 'normal' : 'warning'

      const newItem: NotificationItem = {
        id: `msg_${msgId || Date.now()}`,
        type: 'question',
        title,
        message: `${buyer}: ${data.message_text || data.answer || 'Nuevo mensaje en orden de compra'}`,
        timestamp: new Date().toISOString(),
        read: false,
        link: '/order-messages',
        urgency,
      }

      setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)])

      if (webSettings.soundEnabled) {
        playChime(newItem.urgency)
      }

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

    es.addEventListener('order_message_received', (e) => {
      try {
        handleOrderMessageEvent(JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('order_message_auto_answered', (e) => {
      try {
        handleOrderMessageEvent(JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('claim_received', (e) => {
      try {
        handleClaimEvent(JSON.parse(e.data))
      } catch {}
    })

    es.addEventListener('claim_updated', (e) => {
      try {
        handleClaimEvent(JSON.parse(e.data))
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
