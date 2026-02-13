'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Video, Phone, PhoneOff, PhoneCall,
  Maximize2, Minimize2, X, ExternalLink, Clock, Copy,
  MessageSquare, Send, Circle, Square, Lock, Unlock, RefreshCw,
  ChevronDown, ChevronUp, Loader2, Hash
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface AppointmentData {
  id: string
  requested_date_time: string | null
  dailyco_meeting_url: string | null
  dailyco_room_name: string | null
  dailyco_owner_token: string | null
  recording_url: string | null
}

interface CurrentUser {
  name?: string
  email?: string
  id?: string
}

interface DailyMeetingEmbedProps {
  appointment: AppointmentData | null
  currentUser: CurrentUser | null
  isCustomizeMode?: boolean
  sectionProps?: Record<string, unknown>
  sectionId?: string
  patientPhone?: string
  patientName?: string
  onOpenCommHub?: (tab?: 'sms' | 'call' | 'email') => void
  onSendQuickSms?: (message: string) => void
}

interface VideoPanelPrefs {
  posX: number
  posY: number
  width: number
  height: number
  locked: boolean
  minimized: boolean
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed'
type BottomTab = 'controls' | 'dialpad' | 'sms'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_POS = { x: 60, y: 40 }
const DEFAULT_SIZE = { width: 520, height: 640 }
const MIN_WIDTH = 400
const MIN_HEIGHT = 400
const PREFS_KEY = 'video_panel_layout'

// ═══════════════════════════════════════════════════════════════
// DIALPAD BUTTON
// ═══════════════════════════════════════════════════════════════

function DialpadButton({ digit, sub, onClick }: { digit: string; sub?: string; onClick: (d: string) => void }) {
  return (
    <button
      onClick={() => onClick(digit)}
      className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all active:scale-95"
    >
      <span className="text-base font-bold text-white leading-none">{digit}</span>
      {sub && <span className="text-[7px] text-white/25 uppercase tracking-widest leading-none mt-0.5">{sub}</span>}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// DAILY IFRAME
// ═══════════════════════════════════════════════════════════════

function DailyIframe({ roomUrl }: { roomUrl: string }) {
  if (!roomUrl) return <div className="text-white p-4 text-sm">No meeting URL found.</div>
  return (
    <iframe
      src={roomUrl}
      title="Daily.co Meeting"
      className="w-full h-full border-0 bg-black"
      allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *; screen-wake-lock *"
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      referrerPolicy="no-referrer-when-downgrade"
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DailyMeetingEmbed({
  appointment,
  currentUser: _currentUser,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId,
  patientPhone = '',
  patientName = '',
  onOpenCommHub,
  onSendQuickSms,
}: DailyMeetingEmbedProps) {

  // ─── Layout state (persisted) ───
  const [position, setPosition] = useState(DEFAULT_POS)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [locked, setLocked] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  // ─── Video state ───
  const [meetingActive, setMeetingActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ─── Dialpad state ───
  const [dialNumber, setDialNumber] = useState(patientPhone)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Quick SMS ───
  const [quickSmsText, setQuickSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSent, setSmsSent] = useState(false)

  // ─── Bottom panel ───
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false)
  const [bottomTab, setBottomTab] = useState<BottomTab>('controls')

  // ─── Countdown ───
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number; isPast: boolean } | null>(null)

  // ─── Drag / resize refs ───
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; edge: string } | null>(null)
  const prefsRef = useRef<VideoPanelPrefs>({ ...DEFAULT_POS, ...DEFAULT_SIZE, locked: false, minimized: false, posX: DEFAULT_POS.x, posY: DEFAULT_POS.y })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync dial number
  useEffect(() => { setDialNumber(patientPhone) }, [patientPhone])

  // ═══════════════════════════════════════════════════════════════
  // PREFERENCES PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (prefsLoaded) return
    let cancelled = false
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from('doctor_preferences')
          .select('preference_value')
          .eq('doctor_id', user.id)
          .eq('preference_key', PREFS_KEY)
          .single()
        if (data?.preference_value && !cancelled) {
          const p = data.preference_value as unknown as VideoPanelPrefs
          setPosition({ x: p.posX ?? DEFAULT_POS.x, y: p.posY ?? DEFAULT_POS.y })
          setSize({ width: p.width ?? DEFAULT_SIZE.width, height: p.height ?? DEFAULT_SIZE.height })
          setLocked(p.locked ?? false)
          setMinimized(p.minimized ?? false)
          prefsRef.current = p
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setPrefsLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [prefsLoaded])

  const savePrefs = useCallback((updates: Partial<VideoPanelPrefs>) => {
    prefsRef.current = { ...prefsRef.current, ...updates }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('doctor_preferences').upsert({
          doctor_id: user.id,
          preference_key: PREFS_KEY,
          preference_value: prefsRef.current,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'doctor_id,preference_key' })
      } catch {
        // silent
      }
    }, 500)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // DRAG (header)
  // ═══════════════════════════════════════════════════════════════

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const nx = Math.max(0, dragRef.current.origX + (ev.clientX - dragRef.current.startX))
      const ny = Math.max(0, dragRef.current.origY + (ev.clientY - dragRef.current.startY))
      setPosition({ x: nx, y: ny })
    }
    const handleUp = () => {
      if (dragRef.current) {
        // save after drop
        const curPos = { x: dragRef.current.origX, y: dragRef.current.origY }
        // we need to read current position from state, use a timeout trick
        setTimeout(() => {
          const el = panelRef.current
          if (el) {
            const left = parseInt(el.style.left) || curPos.x
            const top = parseInt(el.style.top) || curPos.y
            savePrefs({ posX: left, posY: top })
          }
        }, 10)
      }
      dragRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [locked, position, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // RESIZE (edges)
  // ═══════════════════════════════════════════════════════════════

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    if (locked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height, edge }
    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      const maxW = window.innerWidth * 0.9
      const maxH = window.innerHeight * 0.9
      let newW = resizeRef.current.origW
      let newH = resizeRef.current.origH
      if (edge.includes('r')) newW = Math.min(maxW, Math.max(MIN_WIDTH, resizeRef.current.origW + dx))
      if (edge.includes('b')) newH = Math.min(maxH, Math.max(MIN_HEIGHT, resizeRef.current.origH + dy))
      if (edge.includes('l')) newW = Math.min(maxW, Math.max(MIN_WIDTH, resizeRef.current.origW - dx))
      setSize({ width: newW, height: newH })
    }
    const handleUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = edge.includes('r') && edge.includes('b') ? 'nwse-resize' : edge.includes('r') || edge.includes('l') ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [locked, size])

  // Save size on change
  const sizeRef = useRef(size)
  sizeRef.current = size
  useEffect(() => {
    if (!prefsLoaded) return
    const timer = setTimeout(() => {
      savePrefs({ width: sizeRef.current.width, height: sizeRef.current.height })
    }, 300)
    return () => clearTimeout(timer)
  }, [size.width, size.height, prefsLoaded, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // LOCK / RESET / MINIMIZE
  // ═══════════════════════════════════════════════════════════════

  const handleToggleLock = useCallback(() => {
    setLocked(v => {
      const next = !v
      savePrefs({ locked: next })
      return next
    })
  }, [savePrefs])

  const handleToggleMinimize = useCallback(() => {
    setMinimized(v => {
      const next = !v
      savePrefs({ minimized: next })
      return next
    })
  }, [savePrefs])

  const handleReset = useCallback(() => {
    setPosition(DEFAULT_POS)
    setSize(DEFAULT_SIZE)
    setLocked(false)
    setMinimized(false)
    savePrefs({ posX: DEFAULT_POS.x, posY: DEFAULT_POS.y, width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height, locked: false, minimized: false })
  }, [savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // COUNTDOWN
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!appointment?.requested_date_time) return
    const update = () => {
      const now = new Date()
      const target = new Date(appointment.requested_date_time!)
      const diff = target.getTime() - now.getTime()
      const isPast = diff < 0
      const absDiff = Math.abs(diff)
      setTimeRemaining({
        hours: Math.floor(absDiff / 3600000),
        minutes: Math.floor((absDiff % 3600000) / 60000),
        seconds: Math.floor((absDiff % 60000) / 1000),
        isPast,
      })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [appointment?.requested_date_time])

  const countdownText = useMemo(() => {
    if (!timeRemaining) return ''
    const { hours, minutes, seconds, isPast } = timeRemaining
    const t = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`
    return isPast ? `Started ${t} ago` : `Starts in ${t}`
  }, [timeRemaining])

  // ═══════════════════════════════════════════════════════════════
  // JOIN URL
  // ═══════════════════════════════════════════════════════════════

  const joinUrl = useMemo(() => {
    if (!appointment?.dailyco_meeting_url) return null
    try {
      const url = new URL(appointment.dailyco_meeting_url)
      if (appointment.dailyco_owner_token) url.searchParams.set('t', appointment.dailyco_owner_token)
      return url.toString()
    } catch {
      return appointment.dailyco_meeting_url
    }
  }, [appointment?.dailyco_meeting_url, appointment?.dailyco_owner_token])

  // ═══════════════════════════════════════════════════════════════
  // MEETING CONTROLS
  // ═══════════════════════════════════════════════════════════════

  const handleStartMeeting = useCallback(() => setMeetingActive(true), [])

  const handleEndMeeting = useCallback(() => {
    setMeetingActive(false)
    setIsRecording(false)
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    setRecordingTime(0)
  }, [])

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false)
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    } else {
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    }
  }, [isRecording])

  // ═══════════════════════════════════════════════════════════════
  // DIALPAD CALL
  // ═══════════════════════════════════════════════════════════════

  const handleDialpadPress = useCallback((d: string) => setDialNumber(prev => prev + d), [])

  const handleStartCall = useCallback(async () => {
    if (!dialNumber) return
    setCallStatus('connecting')
    try {
      const res = await fetch('/api/communication/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: dialNumber }),
      })
      if (!res.ok) throw new Error('Failed')
      setCallStatus('connected')
      setCallDuration(0)
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    } catch {
      setCallStatus('failed')
      setTimeout(() => setCallStatus('idle'), 3000)
    }
  }, [dialNumber])

  const handleEndCall = useCallback(() => {
    setCallStatus('ended')
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
    setTimeout(() => setCallStatus('idle'), 3000)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // QUICK SMS
  // ═══════════════════════════════════════════════════════════════

  const handleSendQuickSms = useCallback(async () => {
    if (!quickSmsText.trim() || !patientPhone) return
    setSmsSending(true)
    try {
      if (onSendQuickSms) {
        onSendQuickSms(quickSmsText)
      } else {
        await fetch('/api/communication/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: patientPhone, message: quickSmsText }),
        })
      }
      setSmsSent(true)
      setQuickSmsText('')
      setTimeout(() => setSmsSent(false), 3000)
    } catch (err) {
      console.error('Quick SMS error:', err)
    } finally {
      setSmsSending(false)
    }
  }, [quickSmsText, patientPhone, onSendQuickSms])

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  const copyText = (t: string) => { navigator.clipboard?.writeText(t) }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div key={sectionId} {...(sectionProps as React.HTMLAttributes<HTMLDivElement>)} className="relative">
      {/* Customize mode drag handle */}
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* FLOATING PANEL                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div
        ref={panelRef}
        className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-cyan-500/30 shadow-2xl shadow-black/40"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: minimized ? 48 : size.height,
          background: 'linear-gradient(135deg, rgba(6,38,54,0.97), rgba(10,15,30,0.98))',
          backdropFilter: 'blur(16px)',
          transition: minimized ? 'height 0.2s ease' : undefined,
        }}
      >
        {/* ── Resize handles (when unlocked & not minimized) ── */}
        {!locked && !minimized && (
          <>
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-500/10 z-10" onMouseDown={e => handleResizeStart(e, 'r')} />
            <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-cyan-500/10 z-10" onMouseDown={e => handleResizeStart(e, 'b')} />
            <div className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-20" onMouseDown={e => handleResizeStart(e, 'rb')} />
          </>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* HEADER                                                */}
        {/* ══════════════════════════════════════════════════════ */}
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0 select-none ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Video className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">Video Consultation</span>
            {/* Recording badge */}
            {meetingActive && isRecording && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full flex-shrink-0">
                <Circle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-400 font-mono">{fmt(recordingTime)}</span>
              </div>
            )}
            {/* Countdown */}
            {timeRemaining && !meetingActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full flex-shrink-0">
                <Clock className="w-3 h-3 text-white/40" />
                <span className={`text-[10px] font-bold ${timeRemaining.isPast ? 'text-yellow-400' : 'text-white/50'}`}>{countdownText}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {meetingActive && (
              <button onClick={handleToggleRecording} title={isRecording ? 'Stop recording' : 'Start recording'}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/30 text-red-400' : 'hover:bg-white/10 text-white/40'}`}>
                {isRecording ? <Square className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              </button>
            )}
            {joinUrl && (
              <a href={joinUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab"
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={handleToggleLock} title={locked ? 'Unlock position & size' : 'Lock position & size'}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all">
              {locked ? <Lock className="w-3.5 h-3.5 text-cyan-400" /> : <Unlock className="w-3.5 h-3.5 text-white/40" />}
            </button>
            <button onClick={handleReset} title="Reset position & size"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleToggleMinimize} title={minimized ? 'Expand' : 'Minimize'}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* BODY (hidden when minimized)                          */}
        {/* ══════════════════════════════════════════════════════ */}
        {!minimized && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── VIDEO AREA ── */}
            {meetingActive && joinUrl ? (
              <div className="flex-1 relative min-h-0 bg-black">
                <DailyIframe roomUrl={joinUrl} />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <button onClick={handleEndMeeting}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all">
                    <PhoneOff className="w-4 h-4" /> End Call
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-6 flex-shrink-0" style={{ background: 'linear-gradient(180deg, rgba(6,38,54,0.5), rgba(10,15,30,0.5))' }}>
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center mb-3">
                  <Video className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {appointment?.dailyco_meeting_url ? 'Ready to Start' : 'No Meeting Scheduled'}
                </h3>
                <p className="text-xs text-white/40 mb-3 text-center">
                  {appointment?.dailyco_room_name ? `Room: ${appointment.dailyco_room_name}` : 'A Daily.co room URL is required'}
                </p>
                {appointment?.dailyco_meeting_url && (
                  <button onClick={handleStartMeeting}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all hover:brightness-110 flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}>
                    <Video className="w-5 h-5" /> Start Video Call
                  </button>
                )}
              </div>
            )}

            {/* ── PHONE BAR ── */}
            {patientPhone && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 flex-shrink-0" style={{ background: 'rgba(14,165,233,0.04)' }}>
                <Phone className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-xs font-mono text-white font-bold flex-1 truncate">{patientPhone}</span>
                <button onClick={() => copyText(patientPhone)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400 transition-all flex items-center gap-1">
                  <Copy className="w-2.5 h-2.5" />Copy
                </button>
                <button onClick={() => { setBottomPanelOpen(true); setBottomTab('dialpad') }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-400 transition-all flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />Dial
                </button>
                <button onClick={() => { setBottomPanelOpen(true); setBottomTab('sms') }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400 transition-all flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5" />SMS
                </button>
                {onOpenCommHub && (
                  <button onClick={() => onOpenCommHub('call')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-400 transition-all flex items-center gap-1">
                    <PhoneCall className="h-2.5 w-2.5" />Hub
                  </button>
                )}
              </div>
            )}

            {/* ── BOTTOM TAB BAR ── */}
            <div className="flex items-center border-t border-white/5 flex-shrink-0">
              <button onClick={() => setBottomPanelOpen(v => !v)} className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/50 transition-colors">
                {bottomPanelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              {(['controls', 'dialpad', 'sms'] as const).map(tab => (
                <button key={tab} onClick={() => { setBottomTab(tab); setBottomPanelOpen(true) }}
                  className={`px-3 py-2 text-[10px] font-bold transition-all border-b-2 ${bottomTab === tab && bottomPanelOpen ? 'text-cyan-300 border-cyan-400' : 'text-white/25 border-transparent hover:text-white/40'}`}>
                  {tab === 'controls' ? 'Info' : tab === 'dialpad' ? 'Dialpad' : 'Quick SMS'}
                </button>
              ))}
            </div>

            {/* ── BOTTOM PANEL CONTENT ── */}
            {bottomPanelOpen && (
              <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: 280, background: 'rgba(8,12,28,0.6)' }}>

                {/* Controls / Info */}
                {bottomTab === 'controls' && (
                  <div className="p-3 space-y-2">
                    {appointment?.recording_url && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <Video className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[11px] text-emerald-300 font-medium flex-1">Recording available</span>
                        <a href={appointment.recording_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold">Download</a>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Room</div>
                        <div className="text-[11px] text-white font-mono truncate">{appointment?.dailyco_room_name || '—'}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Status</div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${meetingActive ? 'bg-green-400 animate-pulse' : 'bg-white/15'}`} />
                          <span className="text-[11px] text-white">{meetingActive ? 'In Progress' : 'Not Started'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {joinUrl && !meetingActive && (
                        <button onClick={handleStartMeeting}
                          className="flex-1 px-3 py-2 rounded-lg font-bold text-xs text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
                          style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}>
                          <Video className="w-3.5 h-3.5" /> Start Call
                        </button>
                      )}
                      {joinUrl && (
                        <a href={joinUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 px-3 py-2 rounded-lg font-bold text-xs text-white bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition-all border border-white/10">
                          <ExternalLink className="w-3.5 h-3.5" /> New Tab
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Dialpad */}
                {bottomTab === 'dialpad' && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                      <Hash className="w-3.5 h-3.5 text-white/25" />
                      <input value={dialNumber} onChange={e => setDialNumber(e.target.value)} placeholder="Phone number..."
                        className="flex-1 bg-transparent text-white text-sm font-mono outline-none" />
                      {dialNumber && <button onClick={() => setDialNumber('')} className="text-white/25 hover:text-white/50"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    {callStatus !== 'idle' && (
                      <div className={`mb-2 px-3 py-1.5 rounded-lg text-center text-[10px] font-bold ${
                        callStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
                        callStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                        callStatus === 'ended' ? 'bg-white/5 text-white/30' : 'bg-red-500/20 text-red-400'
                      }`}>{callStatus === 'connecting' ? 'Connecting...' : callStatus === 'connected' ? `Connected • ${fmt(callDuration)}` : callStatus === 'ended' ? `Ended • ${fmt(callDuration)}` : 'Failed'}</div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto mb-3">
                      {[['1',''],['2','ABC'],['3','DEF'],['4','GHI'],['5','JKL'],['6','MNO'],['7','PQRS'],['8','TUV'],['9','WXYZ'],['*',''],['0','+'],['#','']].map(([d,s]) => (
                        <DialpadButton key={d} digit={d} sub={s || undefined} onClick={handleDialpadPress} />
                      ))}
                    </div>
                    <div className="flex justify-center">
                      {callStatus !== 'connected' ? (
                        <button onClick={handleStartCall} disabled={!dialNumber || callStatus === 'connecting'}
                          className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 disabled:opacity-40 flex items-center justify-center transition-all shadow-lg shadow-green-600/30">
                          <Phone className="w-6 h-6 text-white" />
                        </button>
                      ) : (
                        <button onClick={handleEndCall}
                          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/30">
                          <PhoneOff className="w-6 h-6 text-white" />
                        </button>
                      )}
                    </div>
                    {patientPhone && dialNumber !== patientPhone && (
                      <button onClick={() => setDialNumber(patientPhone)}
                        className="w-full mt-2 px-2 py-1.5 bg-white/5 rounded-lg text-[10px] text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1.5">
                        <Phone className="w-2.5 h-2.5" />Patient: {patientPhone}
                      </button>
                    )}
                  </div>
                )}

                {/* Quick SMS */}
                {bottomTab === 'sms' && (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 uppercase font-bold">To</span>
                      <span className="text-[11px] font-mono text-white/60">{patientPhone || 'No phone'}</span>
                      {patientName && <span className="text-[9px] text-white/25">({patientName})</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['Running 5 min late', 'Please join the video call', "I'll call you shortly", 'Check your email'].map(tmpl => (
                        <button key={tmpl} onClick={() => setQuickSmsText(tmpl)}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] text-white/40 hover:text-white/60 transition-all">{tmpl}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <textarea value={quickSmsText} onChange={e => setQuickSmsText(e.target.value)} placeholder="Type a quick message..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:border-blue-500/50 focus:outline-none" rows={2}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendQuickSms() }} />
                      <button onClick={handleSendQuickSms} disabled={smsSending || !quickSmsText.trim() || !patientPhone}
                        className="self-end px-3 py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-all flex items-center gap-1">
                        {smsSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Send
                      </button>
                    </div>
                    {smsSent && <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-[10px]">Sent!</div>}
                    {onOpenCommHub && (
                      <button onClick={() => onOpenCommHub('sms')}
                        className="w-full px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/30 hover:text-white/50 transition-all flex items-center justify-center gap-1.5 border border-white/5">
                        <MessageSquare className="w-3 h-3" />Open Full Comm Hub
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}





























