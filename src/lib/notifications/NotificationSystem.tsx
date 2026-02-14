// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — NOTIFICATION SYSTEM
// Real-time notifications for appointments, messages, system events
// Uses Supabase realtime + Web Audio API for sounds
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Bell, BellRing, X, Calendar, MessageSquare, Shield, Users,
  AlertTriangle, CheckCircle, Info, Zap, Volume2, VolumeX
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type NotificationType =
  | 'new_appointment'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'instant_visit'
  | 'patient_message'
  | 'admin_message'
  | 'system_alert'
  | 'chart_update'
  | 'staff_action'
  | 'payment_received'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  priority: NotificationPriority
  timestamp: Date
  read: boolean
  actionUrl?: string
  metadata?: Record<string, any>
}

interface NotificationSettings {
  soundEnabled: boolean
  soundVolume: number // 0.0 - 1.0
  toastDuration: number // ms
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  settings: NotificationSettings
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  dismissNotification: (id: string) => void
  toggleSound: () => void
  activeToast: Notification | null
  dismissToast: () => void
}

// ═══════════════════════════════════════════════════════════════
// SOUND ENGINE
// ═══════════════════════════════════════════════════════════════

// Synthesized notification sounds using Web Audio API — no external files needed
class NotificationSoundEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  // Bright, friendly two-tone chime for new appointments
  playNewAppointment(volume: number) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(volume * 0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    // Two ascending tones — cheerful
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523, now) // C5
    osc1.connect(gain)
    osc1.start(now)
    osc1.stop(now + 0.15)

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659, now + 0.15) // E5
    osc2.connect(gain)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.4)
  }

  // Quick urgent triple-beep for instant visits
  playInstantVisit(volume: number) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(volume * 0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, now + i * 0.15) // A5
      osc.connect(gain)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.08)
    }
  }

  // Soft bubble pop for messages
  playMessage(volume: number) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(volume * 0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(784, now) // G5
    osc.frequency.exponentialRampToValueAtTime(1047, now + 0.1) // C6 - ascending pop
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // Low subtle tone for system alerts
  playSystemAlert(volume: number) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(volume * 0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(392, now) // G4
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  // Cash register ding for payments
  playPayment(volume: number) {
    const ctx = this.getContext()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(volume * 0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1047, now) // C6
    osc1.connect(gain)
    osc1.start(now)
    osc1.stop(now + 0.5)
  }

  play(type: NotificationType, volume: number) {
    try {
      switch (type) {
        case 'new_appointment': this.playNewAppointment(volume); break
        case 'instant_visit': this.playInstantVisit(volume); break
        case 'patient_message':
        case 'admin_message': this.playMessage(volume); break
        case 'payment_received': this.playPayment(volume); break
        default: this.playSystemAlert(volume); break
      }
    } catch (err) {
      console.warn('Notification sound failed:', err)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CONFIG
// ═══════════════════════════════════════════════════════════════

const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: typeof Bell
  color: string
  bgColor: string
  defaultPriority: NotificationPriority
}> = {
  new_appointment:       { icon: Calendar, color: 'text-teal-400', bgColor: 'bg-teal-500/15', defaultPriority: 'normal' },
  appointment_cancelled: { icon: Calendar, color: 'text-red-400', bgColor: 'bg-red-500/15', defaultPriority: 'high' },
  appointment_completed: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/15', defaultPriority: 'low' },
  instant_visit:         { icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/15', defaultPriority: 'urgent' },
  patient_message:       { icon: MessageSquare, color: 'text-blue-400', bgColor: 'bg-blue-500/15', defaultPriority: 'normal' },
  admin_message:         { icon: MessageSquare, color: 'text-purple-400', bgColor: 'bg-purple-500/15', defaultPriority: 'normal' },
  system_alert:          { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/15', defaultPriority: 'high' },
  chart_update:          { icon: Shield, color: 'text-purple-400', bgColor: 'bg-purple-500/15', defaultPriority: 'low' },
  staff_action:          { icon: Users, color: 'text-teal-400', bgColor: 'bg-teal-500/15', defaultPriority: 'low' },
  payment_received:      { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/15', defaultPriority: 'normal' },
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT + PROVIDER
// ═══════════════════════════════════════════════════════════════

const SETTINGS_KEY = 'medazon-notification-settings'
const MAX_NOTIFICATIONS = 50

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  toastDuration: 5000,
}

function loadSettings(): NotificationSettings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch { return defaultSettings }
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children, doctorId }: { children: React.ReactNode; doctorId: string | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)
  const [activeToast, setActiveToast] = useState<Notification | null>(null)
  const soundEngine = useRef<NotificationSoundEngine | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings())
    soundEngine.current = new NotificationSoundEngine()
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  // ── Add notification ──
  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const notification: Notification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      read: false,
    }

    setNotifications(prev => [notification, ...prev].slice(0, MAX_NOTIFICATIONS))

    // Show toast
    setActiveToast(notification)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setActiveToast(null), settings.toastDuration)

    // Play sound
    if (settings.soundEnabled && soundEngine.current) {
      soundEngine.current.play(n.type, settings.soundVolume)
    }
  }, [settings])

  // ── Mark read ──
  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => setNotifications([]), [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const toggleSound = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const dismissToast = useCallback(() => {
    setActiveToast(null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // ═══ SUPABASE REALTIME LISTENERS ═══
  useEffect(() => {
    if (!doctorId) return

    // Appointments channel
    const aptChannel = supabase
      .channel('notif-appointments')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`
      }, (payload) => {
        const apt = payload.new as any
        if (apt.visit_type === 'instant') {
          addNotification({
            type: 'instant_visit',
            title: '⚡ Instant Visit Request',
            body: `New instant visit from ${apt.patient_id || 'a patient'}`,
            priority: 'urgent',
          })
        } else {
          addNotification({
            type: 'new_appointment',
            title: 'New Appointment',
            body: `Appointment scheduled for ${apt.requested_date_time || 'upcoming'}`,
            priority: 'normal',
            actionUrl: `/doctor/appointments?apt=${apt.id}`,
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`
      }, (payload) => {
        const apt = payload.new as any
        const old = payload.old as any
        if (apt.status === 'cancelled' && old.status !== 'cancelled') {
          addNotification({
            type: 'appointment_cancelled',
            title: 'Appointment Cancelled',
            body: `An appointment has been cancelled`,
            priority: 'high',
          })
        }
        if (apt.status === 'completed' && old.status !== 'completed') {
          addNotification({
            type: 'appointment_completed',
            title: 'Visit Completed',
            body: `Visit marked as completed`,
            priority: 'low',
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(aptChannel)
    }
  }, [doctorId, addNotification])

  const value: NotificationContextType = {
    notifications, unreadCount, settings,
    addNotification, markRead, markAllRead, clearAll,
    dismissNotification, toggleSound, activeToast, dismissToast,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider')
  return ctx
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION BELL (for toolbar/header)
// ═══════════════════════════════════════════════════════════════

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll, dismissNotification, markRead, settings, toggleSound } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg border transition-colors ${
          unreadCount > 0
            ? 'bg-pink-500/15 border-pink-500/30 text-pink-400 hover:bg-pink-500/25'
            : 'bg-[#0a1f1f] border-[#1a3d3d] text-gray-400 hover:border-teal-500/30 hover:text-teal-400'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        {unreadCount > 0 ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-pink-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out] max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a3d3d] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-bold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <button onClick={toggleSound} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title={settings.soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
                  {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold px-2 py-1 rounded hover:bg-teal-500/10 transition-colors">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                  <p className="text-xs text-gray-600 mt-1">You&apos;ll see alerts here for new appointments, messages, and more.</p>
                </div>
              ) : (
                notifications.map(n => {
                  const config = NOTIFICATION_CONFIG[n.type]
                  const Icon = config.icon
                  const timeAgo = getTimeAgo(n.timestamp)

                  return (
                    <div
                      key={n.id}
                      className={`flex items-start space-x-3 px-4 py-3 border-b border-[#1a3d3d]/50 hover:bg-white/[0.02] transition-colors cursor-pointer ${!n.read ? 'bg-white/[0.01]' : ''}`}
                      onClick={() => markRead(n.id)}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center mt-0.5`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-bold truncate ${!n.read ? 'text-white' : 'text-gray-300'}`}>{n.title}</p>
                          <button onClick={(e) => { e.stopPropagation(); dismissNotification(n.id) }} className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 flex-shrink-0 ml-2">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.body}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[9px] text-gray-500">{timeAgo}</span>
                          {!n.read && <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />}
                          {n.priority === 'urgent' && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-bold">URGENT</span>}
                          {n.priority === 'high' && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded font-bold">HIGH</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-[#1a3d3d] bg-[#0a1f1f] flex-shrink-0">
                <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-300 font-medium transition-colors">
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TOAST (floating notification at bottom-right)
// ═══════════════════════════════════════════════════════════════

export function NotificationToast() {
  const { activeToast, dismissToast } = useNotifications()

  if (!activeToast) return null

  const config = NOTIFICATION_CONFIG[activeToast.type]
  const Icon = config.icon

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start space-x-3 p-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{activeToast.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{activeToast.body}</p>
        </div>
        <button onClick={dismissToast} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-[#1a3d3d]">
        <div className={`h-full ${config.color.replace('text-', 'bg-')} animate-[shrink_5s_linear_forwards]`} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
