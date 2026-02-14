// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — NOTIFICATION SYSTEM v2
// Real-time notifications: Supabase realtime + Web Audio + Push API
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Bell, BellRing, X, Calendar, MessageSquare, Shield, Users,
  AlertTriangle, CheckCircle, Zap, Volume2, VolumeX,
  Settings, ChevronRight, ExternalLink
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
export type ToastPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type SoundTheme = 'default' | 'gentle' | 'retro' | 'minimal'

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

export interface NotificationSettings {
  soundEnabled: boolean
  soundVolume: number
  soundTheme: SoundTheme
  toastDuration: number
  toastPosition: ToastPosition
  pushEnabled: boolean
  // Per-type toggles
  enabledTypes: Record<NotificationType, boolean>
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  settings: NotificationSettings
  updateSettings: (partial: Partial<NotificationSettings>) => void
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  dismissNotification: (id: string) => void
  activeToast: Notification | null
  dismissToast: () => void
  requestPushPermission: () => Promise<void>
  pushSupported: boolean
  pushPermission: NotificationPermission | 'default'
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CONFIG
// ═══════════════════════════════════════════════════════════════

const ALL_TYPES: NotificationType[] = [
  'new_appointment', 'appointment_cancelled', 'appointment_completed',
  'instant_visit', 'patient_message', 'admin_message',
  'system_alert', 'chart_update', 'staff_action', 'payment_received',
]

const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: typeof Bell
  color: string
  bgColor: string
  label: string
  defaultPriority: NotificationPriority
}> = {
  new_appointment:       { icon: Calendar, color: 'text-teal-400', bgColor: 'bg-teal-500/15', label: 'New Appointments', defaultPriority: 'normal' },
  appointment_cancelled: { icon: Calendar, color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Cancellations', defaultPriority: 'high' },
  appointment_completed: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/15', label: 'Completed Visits', defaultPriority: 'low' },
  instant_visit:         { icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Instant Visits', defaultPriority: 'urgent' },
  patient_message:       { icon: MessageSquare, color: 'text-blue-400', bgColor: 'bg-blue-500/15', label: 'Patient Messages', defaultPriority: 'normal' },
  admin_message:         { icon: MessageSquare, color: 'text-purple-400', bgColor: 'bg-purple-500/15', label: 'Admin Messages', defaultPriority: 'normal' },
  system_alert:          { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'System Alerts', defaultPriority: 'high' },
  chart_update:          { icon: Shield, color: 'text-purple-400', bgColor: 'bg-purple-500/15', label: 'Chart Updates', defaultPriority: 'low' },
  staff_action:          { icon: Users, color: 'text-teal-400', bgColor: 'bg-teal-500/15', label: 'Staff Actions', defaultPriority: 'low' },
  payment_received:      { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/15', label: 'Payments', defaultPriority: 'normal' },
}

// ═══════════════════════════════════════════════════════════════
// SOUND ENGINE
// ═══════════════════════════════════════════════════════════════

class NotificationSoundEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  private playNote(ctx: AudioContext, freq: number, startTime: number, duration: number, vol: number, type: OscillatorType = 'sine') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)
    gain.gain.setValueAtTime(vol, startTime)
    gain.gain.setValueAtTime(vol, startTime + duration * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  // ── DEFAULT THEME ──

  private defaultNewAppointment(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 523, t, 0.12, v)
    this.playNote(ctx, 659, t + 0.13, 0.12, v)
    this.playNote(ctx, 784, t + 0.26, 0.12, v)
    this.playNote(ctx, 1047, t + 0.39, 0.35, v * 1.2)
  }

  private defaultInstantVisit(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.22
      this.playNote(ctx, 880, t + offset, 0.08, v, 'square')
      this.playNote(ctx, 1109, t + offset + 0.08, 0.08, v, 'square')
    }
    this.playNote(ctx, 1320, t + 0.7, 0.3, v * 0.8, 'sawtooth')
  }

  private defaultMessage(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(600, t)
    osc1.frequency.exponentialRampToValueAtTime(900, t + 0.08)
    gain1.gain.setValueAtTime(v, t)
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc1.connect(gain1); gain1.connect(ctx.destination)
    osc1.start(t); osc1.stop(t + 0.15)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1000, t + 0.1)
    osc2.frequency.exponentialRampToValueAtTime(1400, t + 0.18)
    gain2.gain.setValueAtTime(v * 0.9, t + 0.1)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc2.connect(gain2); gain2.connect(ctx.destination)
    osc2.start(t + 0.1); osc2.stop(t + 0.3)
  }

  private defaultPayment(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 1319, t, 0.06, v * 0.5)
    this.playNote(ctx, 1397, t + 0.06, 0.06, v * 0.5)
    this.playNote(ctx, 1319, t + 0.12, 0.06, v * 0.5)
    this.playNote(ctx, 1568, t + 0.2, 0.5, v * 1.3)
  }

  private defaultAlert(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 659, t, 0.25, v, 'triangle')
    this.playNote(ctx, 523, t + 0.28, 0.35, v, 'triangle')
  }

  private defaultCancellation(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 523, t, 0.2, v, 'triangle')
    this.playNote(ctx, 392, t + 0.22, 0.3, v, 'triangle')
  }

  // ── GENTLE THEME ──

  private gentleChime(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 784, t, 0.4, v * 0.4)
    this.playNote(ctx, 988, t + 0.15, 0.4, v * 0.3)
  }

  private gentlePop(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 1047, t, 0.15, v * 0.35)
  }

  // ── RETRO THEME ──

  private retroBeep(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 440, t, 0.1, v * 0.6, 'square')
    this.playNote(ctx, 880, t + 0.12, 0.15, v * 0.6, 'square')
  }

  private retroAlarm(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    for (let i = 0; i < 4; i++) {
      this.playNote(ctx, 660, t + i * 0.15, 0.08, v * 0.5, 'square')
    }
  }

  // ── MINIMAL THEME ──

  private minimalTick(v: number) {
    const ctx = this.getContext()
    const t = ctx.currentTime
    this.playNote(ctx, 800, t, 0.08, v * 0.3)
  }

  play(type: NotificationType, volume: number, theme: SoundTheme) {
    try {
      const v = volume * 0.6

      if (theme === 'gentle') {
        if (type === 'instant_visit') { this.gentleChime(v * 1.3); this.gentleChime(v * 1.3); return }
        if (type === 'patient_message' || type === 'admin_message') { this.gentlePop(v); return }
        this.gentleChime(v); return
      }

      if (theme === 'retro') {
        if (type === 'instant_visit') { this.retroAlarm(v); return }
        this.retroBeep(v); return
      }

      if (theme === 'minimal') {
        this.minimalTick(v); return
      }

      // Default theme
      switch (type) {
        case 'new_appointment': this.defaultNewAppointment(v); break
        case 'instant_visit': this.defaultInstantVisit(v); break
        case 'patient_message':
        case 'admin_message': this.defaultMessage(v); break
        case 'payment_received': this.defaultPayment(v); break
        case 'appointment_cancelled': this.defaultCancellation(v); break
        default: this.defaultAlert(v); break
      }
    } catch (err) {
      console.warn('Notification sound failed:', err)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS STORAGE
// ═══════════════════════════════════════════════════════════════

const SETTINGS_KEY = 'medazon-notification-settings'
const MAX_NOTIFICATIONS = 50

function defaultEnabledTypes(): Record<NotificationType, boolean> {
  const map: any = {}
  ALL_TYPES.forEach(t => { map[t] = true })
  return map
}

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  soundVolume: 0.8,
  soundTheme: 'default',
  toastDuration: 5000,
  toastPosition: 'bottom-right',
  pushEnabled: false,
  enabledTypes: defaultEnabledTypes(),
}

function loadSettings(): NotificationSettings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    return {
      ...defaultSettings,
      ...parsed,
      enabledTypes: { ...defaultEnabledTypes(), ...(parsed.enabledTypes || {}) },
    }
  } catch { return defaultSettings }
}

function saveSettings(s: NotificationSettings) {
  if (typeof window !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT + PROVIDER
// ═══════════════════════════════════════════════════════════════

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children, doctorId }: { children: React.ReactNode; doctorId: string | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)
  const [activeToast, setActiveToast] = useState<Notification | null>(null)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'default'>('default')
  const soundEngine = useRef<NotificationSoundEngine | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushSupported = typeof window !== 'undefined' && 'Notification' in window

  useEffect(() => {
    setSettings(loadSettings())
    soundEngine.current = new NotificationSoundEngine()
    if (pushSupported) setPushPermission(window.Notification?.permission || 'default')
  }, [pushSupported])

  const unreadCount = notifications.filter(n => !n.read).length

  const updateSettings = useCallback((partial: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      saveSettings(next)
      return next
    })
  }, [])

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    // Check if type is enabled
    if (!settings.enabledTypes[n.type]) return

    const notification: Notification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      read: false,
    }

    setNotifications(prev => [notification, ...prev].slice(0, MAX_NOTIFICATIONS))

    // Toast
    setActiveToast(notification)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setActiveToast(null), settings.toastDuration)

    // Sound
    if (settings.soundEnabled && soundEngine.current) {
      soundEngine.current.play(n.type, settings.soundVolume, settings.soundTheme)
    }

    // Browser push notification (when tab is not focused)
    if (settings.pushEnabled && pushSupported && window.Notification?.permission === 'granted' && document.hidden) {
      try {
        new window.Notification(n.title, {
          body: n.body,
          icon: '/favicon.ico',
          tag: notification.id,
        })
      } catch { /* silent */ }
    }
  }, [settings, pushSupported])

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

  const dismissToast = useCallback(() => {
    setActiveToast(null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const requestPushPermission = useCallback(async () => {
    if (!pushSupported) return
    try {
      const perm = await window.Notification.requestPermission()
      setPushPermission(perm)
      if (perm === 'granted') {
        updateSettings({ pushEnabled: true })
      }
    } catch { /* silent */ }
  }, [pushSupported, updateSettings])

  // ═══ SUPABASE REALTIME LISTENERS ═══
  useEffect(() => {
    if (!doctorId) return

    const aptChannel = supabase
      .channel('notif-appointments')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`
      }, (payload) => {
        const apt = payload.new as any
        if (apt.visit_type === 'instant') {
          addNotification({
            type: 'instant_visit',
            title: '⚡ Instant Visit Request',
            body: `New urgent care request — tap to view queue`,
            priority: 'urgent',
            actionUrl: `/doctor/appointments?apt=${apt.id}`,
          })
        } else {
          const dateStr = apt.requested_date_time
            ? new Date(apt.requested_date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : 'upcoming'
          addNotification({
            type: 'new_appointment',
            title: '📅 New Appointment Booked',
            body: `Scheduled for ${dateStr} — tap to view details`,
            priority: 'normal',
            actionUrl: `/doctor/appointments?apt=${apt.id}`,
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`
      }, (payload) => {
        const apt = payload.new as any
        const old = payload.old as any
        if (apt.status === 'cancelled' && old.status !== 'cancelled') {
          addNotification({
            type: 'appointment_cancelled',
            title: '❌ Appointment Cancelled',
            body: `A patient cancelled their appointment`,
            priority: 'high',
            actionUrl: '/doctor/appointments',
          })
        }
        if (apt.status === 'completed' && old.status !== 'completed') {
          addNotification({
            type: 'appointment_completed',
            title: '✅ Visit Completed',
            body: `Visit marked as completed — chart ready for review`,
            priority: 'low',
            actionUrl: `/doctor/appointments?apt=${apt.id}`,
          })
        }
        if (apt.chart_locked && !old.chart_locked) {
          addNotification({
            type: 'chart_update',
            title: '🔒 Chart Locked',
            body: `Chart has been locked and finalized`,
            priority: 'low',
            actionUrl: `/doctor/appointments?apt=${apt.id}`,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(aptChannel) }
  }, [doctorId, addNotification])

  const value: NotificationContextType = {
    notifications, unreadCount, settings, updateSettings,
    addNotification, markRead, markAllRead, clearAll,
    dismissNotification, activeToast, dismissToast,
    requestPushPermission, pushSupported, pushPermission,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider')
  return ctx
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION BELL
// ═══════════════════════════════════════════════════════════════

export function NotificationBell() {
  const ctx = useNotifications()
  const router = useRouter()
  const { notifications, unreadCount, markAllRead, clearAll, dismissNotification, markRead, settings } = ctx
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleNotificationClick = (n: Notification) => {
    markRead(n.id)
    setOpen(false)
    if (n.actionUrl) router.push(n.actionUrl)
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setShowSettings(false) }}
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
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-pink-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-pink-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-full ml-2 bottom-0 w-80 md:w-96 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out] max-h-[80vh] flex flex-col">

            {showSettings ? (
              <NotificationSettingsPanel onBack={() => setShowSettings(false)} />
            ) : (
              <>
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
                    <button onClick={() => setShowSettings(true)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Notification Settings">
                      <Settings className="w-3.5 h-3.5" />
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
                      <p className="text-xs text-gray-600 mt-1">Alerts appear here for appointments, messages, and more.</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const config = NOTIFICATION_CONFIG[n.type]
                      const Icon = config.icon
                      return (
                        <div
                          key={n.id}
                          className={`flex items-start space-x-3 px-4 py-3 border-b border-[#1a3d3d]/50 hover:bg-white/[0.03] transition-colors cursor-pointer ${!n.read ? 'bg-teal-500/[0.03]' : ''}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center mt-0.5`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold truncate ${!n.read ? 'text-white' : 'text-gray-300'}`}>{n.title}</p>
                              <button onClick={(e) => { e.stopPropagation(); dismissNotification(n.id) }} className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 flex-shrink-0 ml-2">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[9px] text-gray-500">{getTimeAgo(n.timestamp)}</span>
                              {!n.read && <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />}
                              {n.priority === 'urgent' && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-bold">URGENT</span>}
                              {n.priority === 'high' && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded font-bold">HIGH</span>}
                              {n.actionUrl && <ExternalLink className="w-2.5 h-2.5 text-gray-500" />}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-[#1a3d3d] bg-[#0a1f1f] flex-shrink-0 flex items-center justify-between">
                    <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-300 font-medium transition-colors">
                      Clear all
                    </button>
                    <button onClick={() => setShowSettings(true)} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold transition-colors flex items-center space-x-1">
                      <Settings className="w-3 h-3" />
                      <span>Settings</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS PANEL (inside bell dropdown)
// ═══════════════════════════════════════════════════════════════

function NotificationSettingsPanel({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, requestPushPermission, pushSupported, pushPermission } = useNotifications()
  const soundEngine = useRef<NotificationSoundEngine | null>(null)

  useEffect(() => { soundEngine.current = new NotificationSoundEngine() }, [])

  const testSound = () => {
    if (soundEngine.current) soundEngine.current.play('new_appointment', settings.soundVolume, settings.soundTheme)
  }

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a3d3d] flex items-center space-x-2 flex-shrink-0">
        <button onClick={onBack} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <span className="text-sm font-bold text-white">Notification Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Sound ── */}
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Sound</h3>

          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">Enable sounds</span>
            <ToggleSwitch enabled={settings.soundEnabled} onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })} />
          </div>

          {/* Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-medium flex items-center space-x-1.5">
                {settings.soundEnabled ? <Volume2 className="w-3 h-3 text-teal-400" /> : <VolumeX className="w-3 h-3 text-gray-500" />}
                <span>Volume</span>
              </span>
              <span className="text-[10px] text-gray-500 font-bold">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={Math.round(settings.soundVolume * 100)}
              onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value) / 100 })}
              className="w-full h-1.5 bg-[#1a3d3d] rounded-full appearance-none cursor-pointer accent-teal-400"
              disabled={!settings.soundEnabled}
            />
          </div>

          {/* Sound theme */}
          <div className="space-y-1.5">
            <span className="text-xs text-gray-300 font-medium">Sound style</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['default', 'gentle', 'retro', 'minimal'] as SoundTheme[]).map(theme => (
                <button
                  key={theme}
                  onClick={() => { updateSettings({ soundTheme: theme }); setTimeout(testSound, 100) }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors capitalize ${
                    settings.soundTheme === theme
                      ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                      : 'bg-[#0a1f1f] border-[#1a3d3d] text-gray-400 hover:border-teal-500/20 hover:text-gray-300'
                  }`}
                >
                  {theme === 'default' ? '🎵 Default' : theme === 'gentle' ? '🌊 Gentle' : theme === 'retro' ? '👾 Retro' : '✦ Minimal'}
                </button>
              ))}
            </div>
            <button onClick={testSound} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold mt-1" disabled={!settings.soundEnabled}>
              ▶ Test sound
            </button>
          </div>
        </div>

        {/* ── Toast Position ── */}
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Toast Position</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as ToastPosition[]).map(pos => (
              <button
                key={pos}
                onClick={() => updateSettings({ toastPosition: pos })}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                  settings.toastPosition === pos
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-[#0a1f1f] border-[#1a3d3d] text-gray-400 hover:border-blue-500/20 hover:text-gray-300'
                }`}
              >
                {pos.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* ── Push Notifications ── */}
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Browser Push Notifications</h3>
          <p className="text-[10px] text-gray-500">Get notified even when this tab is in the background.</p>

          {!pushSupported ? (
            <p className="text-[10px] text-amber-400">Your browser doesn&apos;t support push notifications.</p>
          ) : pushPermission === 'granted' ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400 font-medium">✓ Push notifications enabled</span>
              <ToggleSwitch enabled={settings.pushEnabled} onChange={() => updateSettings({ pushEnabled: !settings.pushEnabled })} />
            </div>
          ) : pushPermission === 'denied' ? (
            <p className="text-[10px] text-red-400">Push notifications blocked. Enable in browser settings.</p>
          ) : (
            <button onClick={requestPushPermission} className="w-full bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 text-xs font-bold rounded-lg py-2 transition-colors">
              Enable Push Notifications
            </button>
          )}
        </div>

        {/* ── Per-Type Toggles ── */}
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Notification Types</h3>
          <div className="space-y-1">
            {ALL_TYPES.map(type => {
              const config = NOTIFICATION_CONFIG[type]
              const Icon = config.icon
              return (
                <div key={type} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-[11px] text-gray-300 font-medium">{config.label}</span>
                  </div>
                  <ToggleSwitch
                    enabled={settings.enabledTypes[type]}
                    onChange={() => updateSettings({
                      enabledTypes: { ...settings.enabledTypes, [type]: !settings.enabledTypes[type] }
                    })}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ═══════════════════════════════════════════════════════════════

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`w-8 h-[18px] rounded-full p-0.5 transition-colors flex-shrink-0 ${enabled ? 'bg-teal-500' : 'bg-gray-600'}`}>
      <div className={`w-[14px] h-[14px] bg-white rounded-full transition-transform shadow-sm ${enabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════

export function NotificationToast() {
  const { activeToast, dismissToast, settings } = useNotifications()
  const router = useRouter()

  if (!activeToast) return null

  const config = NOTIFICATION_CONFIG[activeToast.type]
  const Icon = config.icon

  const posClasses: Record<ToastPosition, string> = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  }

  const handleClick = () => {
    dismissToast()
    if (activeToast.actionUrl) router.push(activeToast.actionUrl)
  }

  return (
    <div
      className={`fixed ${posClasses[settings.toastPosition]} z-50 w-80 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out] cursor-pointer hover:border-teal-500/30 transition-colors`}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3 p-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{activeToast.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{activeToast.body}</p>
          {activeToast.actionUrl && (
            <p className="text-[9px] text-teal-400 mt-1 font-bold">Tap to view →</p>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); dismissToast() }} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-0.5 bg-[#1a3d3d]">
        <div
          className={`h-full ${config.color.replace('text-', 'bg-')} animate-[shrink_5s_linear_forwards]`}
          style={{ animationDuration: `${settings.toastDuration}ms` }}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getTimeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
