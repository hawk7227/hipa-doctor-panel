'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import MedazonScribe, { SoapNotes } from './MedazonScribe'
import CommunicationDialer from './CommunicationDialer'
import {
  Video, Phone, PhoneOff, PhoneCall, Mail, Stethoscope,
  Maximize2, Minimize2, X, ExternalLink, Clock, Copy,
  MessageSquare, Send, Circle, Square, Lock, Unlock, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Hash, ArrowLeft
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
  patientEmail?: string
  providerId?: string
  providerEmail?: string
  onOpenCommHub?: (tab?: 'sms' | 'call' | 'email') => void
  onSendQuickSms?: (message: string) => void
  onSoapGenerated?: (soap: SoapNotes) => void
  onClose?: () => void
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
type SidePanel = 'dialpad' | 'sms' | 'email' | 'scribe'

interface SmsMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  status?: string
}

// ═══════════════════════════════════════════════════════════════
// PHONE NORMALIZATION (+1 for US)
// ═══════════════════════════════════════════════════════════════

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  const justDigits = digits.replace(/\+/g, '')
  if (justDigits.length === 10) return `+1${justDigits}`
  if (justDigits.length === 11 && justDigits.startsWith('1')) return `+${justDigits}`
  if (digits.startsWith('+1') && justDigits.length === 11) return digits
  if (digits.startsWith('+')) return digits
  return `+1${justDigits}`
}

function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  const digits = normalized.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4)
    const pre = digits.slice(4, 7)
    const line = digits.slice(7, 11)
    return `+1 (${area}) ${pre}-${line}`
  }
  return normalized
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_POS = { x: 60, y: 40 }
const DEFAULT_SIZE = { width: 580, height: 640 }
const MIN_WIDTH = 420
const MIN_HEIGHT = 400
const PREFS_KEY = 'video_panel_layout'

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════

function DialpadBtn({ digit, sub, onClick }: { digit: string; sub?: string; onClick: (d: string) => void }) {
  return (
    <button onClick={() => onClick(digit)}
      className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all active:scale-95">
      <span className="text-base font-bold text-white leading-none">{digit}</span>
      {sub && <span className="text-[7px] text-white/25 uppercase tracking-widest leading-none mt-0.5">{sub}</span>}
    </button>
  )
}

function DailyIframe({ roomUrl }: { roomUrl: string }) {
  if (!roomUrl) return <div className="text-white p-4 text-sm">No meeting URL found.</div>
  return (
    <iframe src={roomUrl} title="Daily.co Meeting" className="w-full h-full border-0 bg-black"
      allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *; screen-wake-lock *"
      allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      referrerPolicy="no-referrer-when-downgrade" />
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
  patientEmail = '',
  providerId,
  providerEmail = '',
  onOpenCommHub,
  onSendQuickSms,
  onSoapGenerated,
  onClose,
}: DailyMeetingEmbedProps) {

  // ─── Layout prefs ───
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

  // ─── Side panel carousel ───
  const [openPanels, setOpenPanels] = useState<SidePanel[]>([])
  const [activePanelIdx, setActivePanelIdx] = useState(0)

  // ─── Dialpad ───
  const [dialNumber, setDialNumber] = useState(patientPhone ? normalizePhone(patientPhone) : '')
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── SMS ───
  const [smsText, setSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([])
  const [smsLoading, setSmsLoading] = useState(false)
  const smsEndRef = useRef<HTMLDivElement>(null)

  // ─── Email ───
  const [emailTo, setEmailTo] = useState(patientEmail)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)

  // ─── Countdown ───
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number; isPast: boolean } | null>(null)

  // ─── Drag / resize refs ───
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; edge: string } | null>(null)
  const prefsRef = useRef<VideoPanelPrefs>({ posX: DEFAULT_POS.x, posY: DEFAULT_POS.y, ...DEFAULT_SIZE, locked: false, minimized: false })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync props
  useEffect(() => { if (patientPhone) setDialNumber(normalizePhone(patientPhone)) }, [patientPhone])
  useEffect(() => { setEmailTo(patientEmail) }, [patientEmail])

  const hasOpenPanel = openPanels.length > 0
  const activePanel = openPanels[activePanelIdx] || null

  // ═══════════════════════════════════════════════════════════════
  // PANEL ACTIONS
  // ═══════════════════════════════════════════════════════════════

  const togglePanel = useCallback((panel: SidePanel) => {
    setOpenPanels(prev => {
      const idx = prev.indexOf(panel)
      if (idx >= 0) {
        const next = prev.filter(p => p !== panel)
        setActivePanelIdx(i => Math.min(i, Math.max(0, next.length - 1)))
        return next
      }
      const next = [...prev, panel]
      setActivePanelIdx(next.length - 1)
      return next
    })
  }, [])

  const closePanel = useCallback((panel: SidePanel) => {
    setOpenPanels(prev => {
      const next = prev.filter(p => p !== panel)
      setActivePanelIdx(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }, [])

  const navPrev = useCallback(() => setActivePanelIdx(i => Math.max(0, i - 1)), [])
  const navNext = useCallback(() => setActivePanelIdx(i => Math.min(openPanels.length - 1, i + 1)), [openPanels.length])

  // ═══════════════════════════════════════════════════════════════
  // PREFS PERSISTENCE
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (prefsLoaded) return
    let cancelled = false
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase.from('doctor_preferences').select('preference_value').eq('doctor_id', user.id).eq('preference_key', PREFS_KEY).single()
        if (data?.preference_value && !cancelled) {
          const p = data.preference_value as unknown as VideoPanelPrefs
          setPosition({ x: p.posX ?? DEFAULT_POS.x, y: p.posY ?? DEFAULT_POS.y })
          setSize({ width: p.width ?? DEFAULT_SIZE.width, height: p.height ?? DEFAULT_SIZE.height })
          setLocked(p.locked ?? false)
          setMinimized(p.minimized ?? false)
          prefsRef.current = p
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setPrefsLoaded(true) }
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
        await supabase.from('doctor_preferences').upsert({ doctor_id: user.id, preference_key: PREFS_KEY, preference_value: prefsRef.current, updated_at: new Date().toISOString() }, { onConflict: 'doctor_id,preference_key' })
      } catch { /* silent */ }
    }, 500)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // DRAG
  // ═══════════════════════════════════════════════════════════════

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPosition({ x: Math.max(0, dragRef.current.origX + (ev.clientX - dragRef.current.startX)), y: Math.max(0, dragRef.current.origY + (ev.clientY - dragRef.current.startY)) })
    }
    const up = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const el = panelRef.current
      if (el) savePrefs({ posX: parseInt(el.style.left) || position.x, posY: parseInt(el.style.top) || position.y })
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [locked, position, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // RESIZE
  // ═══════════════════════════════════════════════════════════════

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    if (locked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height, edge }
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      let w = resizeRef.current.origW, h = resizeRef.current.origH
      if (edge.includes('r')) w = Math.max(MIN_WIDTH, w + dx)
      if (edge.includes('b')) h = Math.max(MIN_HEIGHT, h + dy)
      setSize({ width: Math.min(w, window.innerWidth * 0.95), height: Math.min(h, window.innerHeight * 0.95) })
    }
    const up = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = edge === 'rb' ? 'nwse-resize' : edge === 'r' ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [locked, size])

  // Save size
  useEffect(() => {
    if (!prefsLoaded) return
    const t = setTimeout(() => savePrefs({ width: size.width, height: size.height }), 300)
    return () => clearTimeout(t)
  }, [size.width, size.height, prefsLoaded, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // LOCK / MINIMIZE / RESET
  // ═══════════════════════════════════════════════════════════════

  const handleToggleLock = useCallback(() => setLocked(v => { const n = !v; savePrefs({ locked: n }); return n }), [savePrefs])
  const handleToggleMinimize = useCallback(() => setMinimized(v => { const n = !v; savePrefs({ minimized: n }); return n }), [savePrefs])
  const handleReset = useCallback(() => { setPosition(DEFAULT_POS); setSize(DEFAULT_SIZE); setLocked(false); setMinimized(false); savePrefs({ posX: DEFAULT_POS.x, posY: DEFAULT_POS.y, ...DEFAULT_SIZE, locked: false, minimized: false }) }, [savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // COUNTDOWN
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!appointment?.requested_date_time) return
    const update = () => {
      const diff = new Date(appointment.requested_date_time!).getTime() - Date.now()
      const isPast = diff < 0
      const abs = Math.abs(diff)
      setTimeRemaining({ hours: Math.floor(abs / 3600000), minutes: Math.floor((abs % 3600000) / 60000), seconds: Math.floor((abs % 60000) / 1000), isPast })
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
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
    } catch { return appointment.dailyco_meeting_url }
  }, [appointment?.dailyco_meeting_url, appointment?.dailyco_owner_token])

  // ═══════════════════════════════════════════════════════════════
  // MEETING
  // ═══════════════════════════════════════════════════════════════

  const handleStartMeeting = useCallback(() => setMeetingActive(true), [])
  const handleEndMeeting = useCallback(() => { setMeetingActive(false); setIsRecording(false); if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }; setRecordingTime(0) }, [])
  const handleToggleRecording = useCallback(() => {
    if (isRecording) { setIsRecording(false); if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null } }
    else { setIsRecording(true); setRecordingTime(0); recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000) }
  }, [isRecording])

  // ═══════════════════════════════════════════════════════════════
  // DIALPAD / CALL
  // ═══════════════════════════════════════════════════════════════

  const handleDialPress = useCallback((d: string) => setDialNumber(prev => prev + d), [])

  const handleStartCall = useCallback(async () => {
    if (!dialNumber) return
    setCallStatus('connecting')
    try {
      const res = await fetch('/api/communication/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: normalizePhone(dialNumber) }) })
      if (!res.ok) throw new Error('Failed')
      setCallStatus('connected'); setCallDuration(0)
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    } catch { setCallStatus('failed'); setTimeout(() => setCallStatus('idle'), 3000) }
  }, [dialNumber])

  const handleEndCall = useCallback(() => {
    setCallStatus('ended')
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
    setTimeout(() => setCallStatus('idle'), 3000)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // SMS — SEND + RECEIVE + REALTIME
  // ═══════════════════════════════════════════════════════════════

  const fetchSmsHistory = useCallback(async () => {
    if (!patientPhone) return
    setSmsLoading(true)
    try {
      const normalized = normalizePhone(patientPhone)
      const digits = normalized.replace(/\D/g, '')
      const { data } = await supabase
        .from('communication_logs')
        .select('id, direction, body, created_at, status')
        .eq('type', 'sms')
        .or(`to_number.ilike.%${digits.slice(-10)},from_number.ilike.%${digits.slice(-10)}`)
        .order('created_at', { ascending: true })
        .limit(50)
      if (data) setSmsMessages(data as SmsMessage[])
    } catch { /* silent */ }
    finally { setSmsLoading(false) }
  }, [patientPhone])

  // Fetch on SMS panel open
  useEffect(() => {
    if (openPanels.includes('sms') && patientPhone) fetchSmsHistory()
  }, [openPanels, patientPhone, fetchSmsHistory])

  // Realtime subscription for inbound SMS
  useEffect(() => {
    if (!openPanels.includes('sms') || !patientPhone) return
    const digits = normalizePhone(patientPhone).replace(/\D/g, '').slice(-10)
    const channel = supabase
      .channel(`sms-${digits}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_logs',
        filter: `type=eq.sms`,
      }, (payload) => {
        const row = payload.new as any
        const fromDigits = (row.from_number || '').replace(/\D/g, '').slice(-10)
        const toDigits = (row.to_number || '').replace(/\D/g, '').slice(-10)
        if (fromDigits === digits || toDigits === digits) {
          setSmsMessages(prev => {
            if (prev.some(m => m.id === row.id)) return prev
            return [...prev, { id: row.id, direction: row.direction, body: row.body, created_at: row.created_at, status: row.status }]
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [openPanels, patientPhone])

  // Auto-scroll SMS
  useEffect(() => { smsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [smsMessages])

  const handleSendSms = useCallback(async () => {
    if (!smsText.trim() || !patientPhone) return
    setSmsSending(true)
    try {
      const to = normalizePhone(patientPhone)
      if (onSendQuickSms) { onSendQuickSms(smsText) }
      else {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/communication/sms', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: session?.access_token ? `Bearer ${session.access_token}` : '' },
          body: JSON.stringify({ to, message: smsText, patientId: undefined, appointmentId: appointment?.id }),
        })
      }
      setSmsText('')
      fetchSmsHistory()
    } catch (err) { console.error('SMS send error:', err) }
    finally { setSmsSending(false) }
  }, [smsText, patientPhone, onSendQuickSms, appointment?.id, fetchSmsHistory])

  // ═══════════════════════════════════════════════════════════════
  // EMAIL
  // ═══════════════════════════════════════════════════════════════

  const handleSendEmail = useCallback(async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return
    setEmailSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const auth = session?.access_token ? `Bearer ${session.access_token}` : ''
      // Try Gmail first, fallback to SMTP
      let res = await fetch('/api/gmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody, appointmentId: appointment?.id }) })
      if (!res.ok) {
        res = await fetch('/api/communication/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody, appointmentId: appointment?.id }) })
      }
      if (!res.ok) throw new Error('Failed to send email')
      setEmailSuccess(true); setEmailSubject(''); setEmailBody('')
      setTimeout(() => setEmailSuccess(false), 3000)
    } catch (err) { console.error('Email error:', err) }
    finally { setEmailSending(false) }
  }, [emailTo, emailSubject, emailBody, appointment?.id])

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const copyText = (t: string) => { navigator.clipboard?.writeText(t) }
  const panelLabel = (p: SidePanel) => p === 'dialpad' ? 'Dialpad' : p === 'sms' ? 'SMS' : p === 'email' ? 'Email' : 'Scribe'

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div key={sectionId} {...(sectionProps as React.HTMLAttributes<HTMLDivElement>)} className="relative">
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
        </div>
      )}

      {/* ═══════ FLOATING PANEL ═══════ */}
      <div ref={panelRef} className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-cyan-500/30 shadow-2xl shadow-black/40"
        style={{ left: position.x, top: position.y, width: hasOpenPanel ? Math.max(size.width, 720) : size.width, height: minimized ? 48 : size.height, background: 'linear-gradient(135deg, rgba(6,38,54,0.97), rgba(10,15,30,0.98))', backdropFilter: 'blur(16px)', transition: 'width 0.3s ease, height 0.2s ease' }}>

        {/* Resize handles */}
        {!locked && !minimized && (<>
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-500/10 z-10" onMouseDown={e => handleResizeStart(e, 'r')} />
          <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-cyan-500/10 z-10" onMouseDown={e => handleResizeStart(e, 'b')} />
          <div className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-20" onMouseDown={e => handleResizeStart(e, 'rb')} />
        </>)}

        {/* ═══════ HEADER ═══════ */}
        <div className={`flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0 select-none ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleDragStart}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Video className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">Video Consultation</span>
            {meetingActive && isRecording && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full flex-shrink-0">
                <Circle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse" /><span className="text-[10px] font-bold text-red-400 font-mono">{fmt(recordingTime)}</span>
              </div>
            )}
            {timeRemaining && !meetingActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full flex-shrink-0">
                <Clock className="w-3 h-3 text-white/40" /><span className={`text-[10px] font-bold ${timeRemaining.isPast ? 'text-yellow-400' : 'text-white/50'}`}>{countdownText}</span>
              </div>
            )}
            {(meetingActive || callStatus === 'connected') && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex-shrink-0 cursor-pointer" onClick={() => togglePanel('scribe')} title="Medazon Scribe active — click to view">
                <Stethoscope className="w-3 h-3 text-emerald-400" /><span className="text-[9px] font-bold text-emerald-400">Scribe</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {meetingActive && <button onClick={handleToggleRecording} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/30 text-red-400' : 'hover:bg-white/10 text-white/40'}`}>{isRecording ? <Square className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}</button>}
            {joinUrl && <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all"><ExternalLink className="w-3.5 h-3.5" /></a>}
            <button onClick={handleToggleLock} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all">{locked ? <Lock className="w-3.5 h-3.5 text-cyan-400" /> : <Unlock className="w-3.5 h-3.5 text-white/40" />}</button>
            <button onClick={handleReset} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button onClick={handleToggleMinimize} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">{minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}</button>
            {onClose && <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all" title="Close video panel"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {/* ═══════ BODY ═══════ */}
        {!minimized && (
          <div className="flex-1 flex overflow-hidden">

            {/* ─── LEFT: VIDEO ─── */}
            <div className={`flex flex-col ${hasOpenPanel ? 'w-1/2 border-r border-white/10' : 'w-full'}`} style={{ transition: 'width 0.3s ease' }}>
              {meetingActive && joinUrl ? (
                <div className="flex-1 relative min-h-0 bg-black">
                  <DailyIframe roomUrl={joinUrl} />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <button onClick={handleEndMeeting} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"><PhoneOff className="w-4 h-4" /> End</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, rgba(6,38,54,0.5), rgba(10,15,30,0.5))' }}>
                  <div className="w-14 h-14 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center mb-3"><Video className="w-7 h-7 text-cyan-400" /></div>
                  <h3 className="text-sm font-bold text-white mb-1">{appointment?.dailyco_meeting_url ? 'Ready to Start' : 'No Meeting'}</h3>
                  <p className="text-[10px] text-white/40 mb-3 text-center truncate w-full">{appointment?.dailyco_room_name ? `Room: ${appointment.dailyco_room_name}` : ''}</p>
                  {appointment?.dailyco_meeting_url && (
                    <button onClick={handleStartMeeting} className="px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-all hover:brightness-110 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}><Video className="w-4 h-4" /> Start Video Call</button>
                  )}
                </div>
              )}

              {/* Phone bar */}
              {patientPhone && (
                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/5 flex-shrink-0" style={{ background: 'rgba(14,165,233,0.04)' }}>
                  <Phone className="h-3 w-3 text-sky-400 flex-shrink-0" />
                  <span className="text-[10px] font-mono text-white font-bold flex-1 truncate">{formatPhoneDisplay(patientPhone)}</span>
                  <button onClick={() => copyText(normalizePhone(patientPhone))} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-400 border border-sky-500/30 hover:border-sky-400 transition-all">Copy</button>
                  <button onClick={() => togglePanel('dialpad')} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${openPanels.includes('dialpad') ? 'text-green-300 border-green-400 bg-green-500/20' : 'text-green-400 border-green-500/30 hover:border-green-400'}`}><Phone className="h-2.5 w-2.5 inline mr-0.5" />Dial</button>
                  <button onClick={() => togglePanel('sms')} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${openPanels.includes('sms') ? 'text-blue-300 border-blue-400 bg-blue-500/20' : 'text-blue-400 border-blue-500/30 hover:border-blue-400'}`}><MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />SMS</button>
                  <button onClick={() => togglePanel('email')} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${openPanels.includes('email') ? 'text-purple-300 border-purple-400 bg-purple-500/20' : 'text-purple-400 border-purple-500/30 hover:border-purple-400'}`}><Mail className="h-2.5 w-2.5 inline mr-0.5" />Email</button>
                  <button onClick={() => togglePanel('scribe')} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${openPanels.includes('scribe') ? 'text-emerald-300 border-emerald-400 bg-emerald-500/20' : 'text-emerald-400 border-emerald-500/30 hover:border-emerald-400'}`}><Stethoscope className="h-2.5 w-2.5 inline mr-0.5" />Scribe</button>
                  {onOpenCommHub && <button onClick={() => onOpenCommHub('call')} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-orange-400 border border-orange-500/30 hover:border-orange-400 transition-all"><PhoneCall className="h-2.5 w-2.5 inline mr-0.5" />Hub</button>}
                </div>
              )}
            </div>

            {/* ─── RIGHT: SIDE PANEL CAROUSEL ─── */}
            {hasOpenPanel && (
              <div className="w-1/2 flex flex-col overflow-hidden" style={{ transition: 'width 0.3s ease' }}>

                {/* Panel nav header */}
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 flex-shrink-0">
                  {openPanels.length > 1 && <button onClick={navPrev} disabled={activePanelIdx === 0} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5" /></button>}
                  <div className="flex gap-1 flex-1 justify-center">
                    {openPanels.map((p, i) => (
                      <button key={p} onClick={() => setActivePanelIdx(i)}
                        className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${i === activePanelIdx ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}>
                        {panelLabel(p)}
                      </button>
                    ))}
                  </div>
                  {openPanels.length > 1 && <button onClick={navNext} disabled={activePanelIdx >= openPanels.length - 1} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => closePanel(activePanel!)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-white/20 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>

                {/* ─── CALL/SMS PANEL (uses CommunicationDialer — same as /doctor/communication page) ─── */}
                {(activePanel === 'dialpad' || activePanel === 'sms') && (
                  <CommunicationDialer
                    initialPhone={patientPhone}
                    patientName={patientName}
                    patientId={appointment?.id}
                    defaultTab={activePanel === 'sms' ? 'sms' : 'call'}
                    compact
                  />
                )}

                {/* ─── EMAIL PANEL ─── */}
                {activePanel === 'email' && (
                  <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/40 uppercase font-bold w-10">To</span>
                      <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="patient@email.com"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] outline-none focus:border-purple-500/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/40 uppercase font-bold w-10">From</span>
                      <div className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-white/40 text-[11px]">{providerEmail || 'Provider'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/40 uppercase font-bold w-10">Subj</span>
                      <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] outline-none focus:border-purple-500/50" />
                    </div>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Compose..."
                      className="flex-1 min-h-[120px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs resize-none focus:border-purple-500/50 focus:outline-none leading-relaxed"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendEmail() }} />
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/25">⌘+Enter to send</span>
                      <button onClick={handleSendEmail} disabled={emailSending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-500 disabled:opacity-40 transition-all">
                        {emailSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Send
                      </button>
                    </div>
                    {emailSuccess && <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-[10px]">Email sent!</div>}
                  </div>
                )}

                {/* ─── SCRIBE PANEL (always mounted, visible when active) ─── */}
                <div className={activePanel === 'scribe' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
                  <MedazonScribe
                    appointmentId={appointment?.id}
                    patientName={patientName}
                    doctorName={_currentUser?.name || 'Doctor'}
                    doctorId={_currentUser?.id || providerId}
                    callActive={meetingActive || callStatus === 'connected'}
                    onSoapGenerated={onSoapGenerated}
                    visible={activePanel === 'scribe'}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Background scribe — runs when call active even if panel closed */}
        {!openPanels.includes('scribe') && (meetingActive || callStatus === 'connected') && (
          <MedazonScribe
            appointmentId={appointment?.id}
            patientName={patientName}
            doctorName={_currentUser?.name || 'Doctor'}
            doctorId={_currentUser?.id || providerId}
            callActive={meetingActive || callStatus === 'connected'}
            onSoapGenerated={onSoapGenerated}
            visible={false}
          />
        )}
      </div>
    </div>
  )
}































