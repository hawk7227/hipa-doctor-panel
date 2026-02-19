'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import MedazonScribe, { SoapNotes } from './MedazonScribe'
import CommunicationDialer from './CommunicationDialer'
import {
  Video, Phone, PhoneOff, PhoneCall, Mail, Stethoscope,
  Maximize2, Minimize2, X, ExternalLink, Clock, Copy,
  MessageSquare, Send, Circle, Square, Lock, Unlock, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, ArrowLeft
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
  currentUser?: CurrentUser | null
  patientPhone?: string
  patientName?: string
  patientEmail?: string
  providerId?: string
  providerEmail?: string
  onOpenCommHub?: (tab?: 'sms' | 'call' | 'email') => void
  onSendQuickSms?: (message: string) => void
  onSoapGenerated?: (soap: SoapNotes) => void
  onClose?: () => void
  /** 'inline' = fills parent (grid mode), 'floating' = fixed overlay */
  mode?: 'inline' | 'floating'
}
interface VideoPanelPrefs {
  posX: number; posY: number; width: number; height: number
  locked: boolean; minimized: boolean
}
type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed'
type SidePanel = 'dialpad' | 'sms' | 'email' | 'scribe'
interface SmsMessage {
  id: string; direction: 'inbound' | 'outbound'; body: string
  created_at: string; status?: string
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
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
  const n = normalizePhone(phone)
  const d = n.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return n
}
const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DEFAULT_POS = { x: 60, y: 40 }
const DEFAULT_SIZE = { width: 580, height: 640 }
const MIN_W = 380
const MIN_H = 360
const PREFS_KEY = 'video_panel_layout'

// ═══════════════════════════════════════════════════════════════
// DIALPAD BUTTON
// ═══════════════════════════════════════════════════════════════
function DialpadBtn({ digit, sub, onClick }: { digit: string; sub?: string; onClick: (d: string) => void }) {
  return (
    <button onClick={() => onClick(digit)}
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all active:scale-95">
      <span className="text-lg sm:text-xl font-bold text-white leading-none">{digit}</span>
      {sub && <span className="text-[8px] text-white/25 uppercase tracking-widest leading-none mt-0.5">{sub}</span>}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// DAILY IFRAME
// ═══════════════════════════════════════════════════════════════
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
// RESIZE EDGES COMPONENT — 8 handles for all edges + corners
// ═══════════════════════════════════════════════════════════════
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
function ResizeHandles({ onStart }: { onStart: (e: React.MouseEvent, edge: Edge) => void }) {
  const edges: { edge: Edge; cls: string }[] = [
    { edge: 'n',  cls: 'top-0 left-3 right-3 h-1.5 cursor-ns-resize' },
    { edge: 's',  cls: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
    { edge: 'w',  cls: 'left-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
    { edge: 'e',  cls: 'right-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
    { edge: 'nw', cls: 'top-0 left-0 w-3 h-3 cursor-nwse-resize' },
    { edge: 'ne', cls: 'top-0 right-0 w-3 h-3 cursor-nesw-resize' },
    { edge: 'sw', cls: 'bottom-0 left-0 w-3 h-3 cursor-nesw-resize' },
    { edge: 'se', cls: 'bottom-0 right-0 w-3 h-3 cursor-nwse-resize' },
  ]
  return (
    <>
      {edges.map(({ edge, cls }) => (
        <div key={edge} className={`absolute z-20 hover:bg-cyan-400/20 transition-colors ${cls}`}
          onMouseDown={e => onStart(e, edge)} />
      ))}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DailyMeetingEmbed({
  appointment,
  currentUser,
  patientPhone = '',
  patientName = '',
  patientEmail = '',
  providerId,
  providerEmail = '',
  onOpenCommHub,
  onSendQuickSms,
  onSoapGenerated,
  onClose,
  mode: initialMode = 'inline',
}: DailyMeetingEmbedProps) {

  // ─── Render mode ───
  const [renderMode, setRenderMode] = useState<'inline' | 'floating'>(initialMode)
  const isFloating = renderMode === 'floating'

  // ─── Layout prefs (floating mode) ───
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
  const [callError, setCallError] = useState<string | null>(null)
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
  const [copiedFlag, setCopiedFlag] = useState(false)

  // ─── Countdown ───
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number; isPast: boolean } | null>(null)

  // ─── Portal mount ───
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => { setPortalTarget(document.body) }, [])

  // ─── Drag / resize refs ───
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; edge: Edge } | null>(null)
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
  // PREFS PERSISTENCE (floating mode)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (prefsLoaded || !isFloating) return
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
  }, [prefsLoaded, isFloating])

  const savePrefs = useCallback((updates: Partial<VideoPanelPrefs>) => {
    prefsRef.current = { ...prefsRef.current, ...updates }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('doctor_preferences').upsert(
          { doctor_id: user.id, preference_key: PREFS_KEY, preference_value: prefsRef.current, updated_at: new Date().toISOString() },
          { onConflict: 'doctor_id,preference_key' }
        )
      } catch { /* silent */ }
    }, 500)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // DRAG (floating mode only)
  // ═══════════════════════════════════════════════════════════════
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isFloating || locked) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const nx = dragRef.current.origX + (ev.clientX - dragRef.current.startX)
      const ny = dragRef.current.origY + (ev.clientY - dragRef.current.startY)
      setPosition({ x: Math.max(-size.width + 100, Math.min(nx, window.innerWidth - 100)), y: Math.max(0, Math.min(ny, window.innerHeight - 50)) })
    }
    const up = () => {
      if (dragRef.current) {
        const el = panelRef.current
        if (el) savePrefs({ posX: parseInt(el.style.left) || position.x, posY: parseInt(el.style.top) || position.y })
      }
      dragRef.current = null
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [isFloating, locked, position, size.width, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // RESIZE — all 8 edges (floating mode only)
  // ═══════════════════════════════════════════════════════════════
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: Edge) => {
    if (!isFloating || locked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height, origX: position.x, origY: position.y, edge }
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      const r = resizeRef.current
      let w = r.origW, h = r.origH, x = r.origX, y = r.origY
      // East edges
      if (edge.includes('e')) w = Math.max(MIN_W, Math.min(r.origW + dx, window.innerWidth * 0.95))
      // West edges
      if (edge.includes('w')) { const nw = Math.max(MIN_W, r.origW - dx); x = r.origX + (r.origW - nw); w = nw }
      // South edges
      if (edge.includes('s')) h = Math.max(MIN_H, Math.min(r.origH + dy, window.innerHeight * 0.95))
      // North edges
      if (edge === 'n' || edge === 'ne' || edge === 'nw') { const nh = Math.max(MIN_H, r.origH - dy); y = r.origY + (r.origH - nh); h = nh }
      setSize({ width: w, height: h })
      setPosition({ x, y })
    }
    const up = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    const cursors: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', sw: 'nesw-resize' }
    document.body.style.cursor = cursors[edge] || 'nwse-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [isFloating, locked, size, position])

  // Save size on change
  useEffect(() => {
    if (!prefsLoaded || !isFloating) return
    const t = setTimeout(() => savePrefs({ width: size.width, height: size.height, posX: position.x, posY: position.y }), 300)
    return () => clearTimeout(t)
  }, [size.width, size.height, position.x, position.y, prefsLoaded, isFloating, savePrefs])

  // ═══════════════════════════════════════════════════════════════
  // LOCK / MINIMIZE / RESET / POP-OUT
  // ═══════════════════════════════════════════════════════════════
  const handleToggleLock = useCallback(() => setLocked(v => { const n = !v; savePrefs({ locked: n }); return n }), [savePrefs])
  const handleToggleMinimize = useCallback(() => setMinimized(v => { const n = !v; savePrefs({ minimized: n }); return n }), [savePrefs])
  const handleReset = useCallback(() => {
    setPosition(DEFAULT_POS); setSize(DEFAULT_SIZE); setLocked(false); setMinimized(false)
    savePrefs({ posX: DEFAULT_POS.x, posY: DEFAULT_POS.y, ...DEFAULT_SIZE, locked: false, minimized: false })
  }, [savePrefs])
  const handlePopOut = useCallback(() => setRenderMode(m => m === 'inline' ? 'floating' : 'inline'), [])

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
  const handleEndMeeting = useCallback(() => {
    setMeetingActive(false); setIsRecording(false)
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    setRecordingTime(0)
  }, [])
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
      const { data: { session } } = await supabase.auth.getSession()
      const normalized = normalizePhone(dialNumber)
      console.log('[VideoPanel] Starting call to:', normalized)
      const res = await fetch('/api/communication/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ to: normalized }),
      })
      const json = await res.json()
      console.log('[VideoPanel] Call response:', json)
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Call failed (${res.status})`)
      }
      setCallStatus('connected'); setCallDuration(0)
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    } catch (err: any) {
      console.error('[VideoPanel] Call error:', err)
      setCallStatus('failed')
      setCallError(err.message || 'Call failed')
      setTimeout(() => { setCallStatus('idle'); setCallError(null) }, 5000)
    }
  }, [dialNumber])
  const handleEndCall = useCallback(() => {
    setCallStatus('ended')
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
    setTimeout(() => setCallStatus('idle'), 3000)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // SMS
  // ═══════════════════════════════════════════════════════════════
  const fetchSmsHistory = useCallback(async () => {
    if (!patientPhone) return
    setSmsLoading(true)
    try {
      const digits = normalizePhone(patientPhone).replace(/\D/g, '')
      const { data } = await supabase.from('communication_logs').select('id, direction, body, created_at, status')
        .eq('type', 'sms').or(`to_number.ilike.%${digits.slice(-10)},from_number.ilike.%${digits.slice(-10)}`)
        .order('created_at', { ascending: true }).limit(50)
      if (data) setSmsMessages(data as SmsMessage[])
    } catch { /* silent */ }
    finally { setSmsLoading(false) }
  }, [patientPhone])

  useEffect(() => {
    if (openPanels.includes('sms') && patientPhone) fetchSmsHistory()
  }, [openPanels, patientPhone, fetchSmsHistory])

  // Realtime SMS subscription
  useEffect(() => {
    if (!openPanels.includes('sms') || !patientPhone) return
    const digits = normalizePhone(patientPhone).replace(/\D/g, '').slice(-10)
    const channel = supabase.channel(`sms-${digits}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_logs', filter: 'type=eq.sms' }, (payload) => {
        const row = payload.new as Record<string, string>
        const from = (row.from_number || '').replace(/\D/g, '').slice(-10)
        const to = (row.to_number || '').replace(/\D/g, '').slice(-10)
        if (from === digits || to === digits) {
          setSmsMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, { id: row.id, direction: row.direction as 'inbound' | 'outbound', body: row.body, created_at: row.created_at, status: row.status }])
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [openPanels, patientPhone])

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
          body: JSON.stringify({ to, message: smsText, appointmentId: appointment?.id }),
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
      let res = await fetch('/api/gmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody, appointmentId: appointment?.id }) })
      if (!res.ok) {
        res = await fetch('/api/communication/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody, appointmentId: appointment?.id }) })
      }
      if (!res.ok) throw new Error('Failed')
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
  // SMALL HELPERS
  // ═══════════════════════════════════════════════════════════════
  const copyText = (t: string) => { navigator.clipboard?.writeText(t) }
  const panelLabel = (p: SidePanel) => p === 'dialpad' ? 'Dialpad' : p === 'sms' ? 'SMS' : p === 'email' ? 'Email' : 'Scribe'

  // ═══════════════════════════════════════════════════════════════
  // PANEL CONTENT — shared between inline and floating
  // ═══════════════════════════════════════════════════════════════
  const panelContent = (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* ═══════ HEADER ═══════ */}
      <div className={`flex items-center justify-between px-2 sm:px-3 py-2 border-b border-white/10 flex-shrink-0 select-none ${isFloating && !locked ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={isFloating ? handleDragStart : undefined}>
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 overflow-hidden">
          <Video className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-white truncate">Video Consultation</span>
          {meetingActive && isRecording && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full flex-shrink-0">
              <Circle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 font-mono">{fmt(recordingTime)}</span>
            </div>
          )}
          {timeRemaining && !meetingActive && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded-full flex-shrink-0">
              <Clock className="w-3 h-3 text-white/40" />
              <span className={`text-[9px] sm:text-[10px] font-bold ${timeRemaining.isPast ? 'text-yellow-400' : 'text-white/50'}`}>{countdownText}</span>
            </div>
          )}
          {(meetingActive || callStatus === 'connected') && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex-shrink-0 cursor-pointer"
              onClick={() => togglePanel('scribe')} title="Medazon Scribe — click to view">
              <Stethoscope className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400 hidden sm:inline">Scribe</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {meetingActive && (
            <button onClick={handleToggleRecording} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/30 text-red-400' : 'hover:bg-white/10 text-white/40'}`}>
              {isRecording ? <Square className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            </button>
          )}
          {joinUrl && (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={handlePopOut} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all" title={isFloating ? 'Dock to grid' : 'Pop out'}>
            {isFloating ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          {isFloating && (
            <>
              <button onClick={handleToggleLock} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all" title={locked ? 'Unlock' : 'Lock position'}>
                {locked ? <Lock className="w-3.5 h-3.5 text-cyan-400" /> : <Unlock className="w-3.5 h-3.5 text-white/40" />}
              </button>
              <button onClick={handleToggleMinimize} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 transition-all">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════ BODY ═══════ */}
      {!minimized && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ─── LEFT: Video Area ─── */}
          <div className={`flex flex-col ${hasOpenPanel ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            <div className="flex-1 min-h-0 relative bg-black/30">
              {meetingActive && joinUrl ? (
                <DailyIframe roomUrl={joinUrl} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Video className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm sm:text-base font-bold text-white">Ready to Start</p>
                    {appointment?.dailyco_room_name && (
                      <p className="text-[10px] sm:text-xs text-white/30 mt-1">Room: {appointment.dailyco_room_name}</p>
                    )}
                  </div>
                  {joinUrl && (
                    <button onClick={handleStartMeeting}
                      className="flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-bold rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
                      <Video className="w-4 h-4" />Start Video Call
                    </button>
                  )}
                  {!joinUrl && (
                    <p className="text-xs text-white/30">No meeting URL configured</p>
                  )}
                </div>
              )}
              {/* In-call controls overlay */}
              {meetingActive && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <button onClick={handleEndMeeting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-all active:scale-95 shadow-lg">
                    <PhoneOff className="w-4 h-4" />End
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT: Side Panel (slide-over) ─── */}
          {hasOpenPanel && (
            <div className="w-1/2 flex flex-col border-l border-white/10 bg-[#060e1a]/60 min-h-0">
              {/* Panel header with nav */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-1">
                  {openPanels.length > 1 && (
                    <button onClick={navPrev} disabled={activePanelIdx === 0} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 disabled:opacity-20">
                      <ChevronLeft className="w-3 h-3 text-white/60" />
                    </button>
                  )}
                  <span className="text-[10px] sm:text-xs font-bold text-white/70">{activePanel ? panelLabel(activePanel) : ''}</span>
                  {openPanels.length > 1 && (
                    <button onClick={navNext} disabled={activePanelIdx >= openPanels.length - 1} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 disabled:opacity-20">
                      <ChevronRight className="w-3 h-3 text-white/60" />
                    </button>
                  )}
                  {openPanels.length > 1 && (
                    <span className="text-[8px] text-white/20 ml-1">{activePanelIdx + 1}/{openPanels.length}</span>
                  )}
                </div>
                <button onClick={() => activePanel && closePanel(activePanel)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10">
                  <X className="w-3 h-3 text-white/40" />
                </button>
              </div>

              {/* ─── CALL/SMS PANEL — uses CommunicationDialer with Twilio Voice SDK ─── */}
              {(activePanel === 'dialpad' || activePanel === 'sms') && (
                <div className="flex-1 overflow-hidden min-h-0">
                  <CommunicationDialer
                    initialPhone={patientPhone ? normalizePhone(patientPhone) : ''}
                    patientName={patientName}
                    defaultTab={activePanel === 'sms' ? 'sms' : 'call'}
                    compact
                    showPatientSearch={false}
                    onCallStatusChange={(status) => {
                      if (status === 'connected') setCallStatus('connected')
                      else if (status === 'ended') setCallStatus('idle')
                      else if (status === 'connecting') setCallStatus('connecting')
                      else setCallStatus('idle')
                    }}
                    onSmsSent={() => { console.log('[VideoPanel] SMS sent via CommunicationDialer') }}
                  />
                </div>
              )}

              {/* ─── EMAIL PANEL ─── */}
              {activePanel === 'email' && (
                <div className="flex-1 flex flex-col p-2 sm:p-3 gap-2 overflow-y-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 uppercase font-bold w-10 flex-shrink-0">To</span>
                    <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="patient@email.com"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] outline-none focus:border-purple-500/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 uppercase font-bold w-10 flex-shrink-0">From</span>
                    <div className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-white/40 text-[11px]">{providerEmail || 'Provider'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 uppercase font-bold w-10 flex-shrink-0">Subj</span>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] outline-none focus:border-purple-500/50" />
                  </div>
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Compose..."
                    className="flex-1 min-h-[100px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs resize-none focus:border-purple-500/50 focus:outline-none leading-relaxed"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendEmail() }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-white/20">⌘+Enter to send</span>
                    <button onClick={handleSendEmail} disabled={emailSending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-500 disabled:opacity-40 transition-all">
                      {emailSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Send
                    </button>
                  </div>
                  {emailSuccess && <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-[10px]">Email sent!</div>}
                </div>
              )}

              {/* ─── SCRIBE PANEL (always mounted when active) ─── */}
              <div className={activePanel === 'scribe' ? 'flex-1 flex flex-col overflow-hidden min-h-0' : 'hidden'}>
                <MedazonScribe
                  appointmentId={appointment?.id}
                  patientName={patientName}
                  doctorName={currentUser?.name || 'Doctor'}
                  doctorId={currentUser?.id || providerId}
                  callActive={meetingActive || callStatus === 'connected'}
                  onSoapGenerated={onSoapGenerated}
                  visible={activePanel === 'scribe'}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ BOTTOM ACTION BAR — 6 Buttons ═══════ */}
      {!minimized && (
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2 border-t border-white/10 flex-shrink-0 bg-[#060e1a]/80">
          {/* Copy */}
          <button onClick={() => {
            const link = appointment?.dailyco_meeting_url || ''
            const phone = patientPhone ? normalizePhone(patientPhone) : ''
            const text = link ? `Join: ${link}` : phone
            if (text) { copyText(text); setCopiedFlag(true); setTimeout(() => setCopiedFlag(false), 1500) }
          }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 ${copiedFlag ? 'bg-green-500/20 text-green-300 border-green-400' : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10 hover:text-white'}`}>
            <ArrowLeft className="w-3 h-3 rotate-[135deg]" />
            <span className="hidden xs:inline sm:inline">{copiedFlag ? 'Copied!' : 'Copy'}</span>
          </button>
          {/* Dial */}
          <button onClick={() => togglePanel('dialpad')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 ${openPanels.includes('dialpad') ? 'bg-green-500/20 text-green-300 border-green-400' : 'bg-white/5 text-green-400 border-green-500/30 hover:bg-green-500/10'}`}>
            <Phone className="w-3 h-3" />
            <span>Dial</span>
          </button>
          {/* SMS */}
          <button onClick={() => togglePanel('sms')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 ${openPanels.includes('sms') ? 'bg-blue-500/20 text-blue-300 border-blue-400' : 'bg-white/5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10'}`}>
            <MessageSquare className="w-3 h-3" />
            <span>SMS</span>
          </button>
          {/* Email */}
          <button onClick={() => togglePanel('email')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 ${openPanels.includes('email') ? 'bg-purple-500/20 text-purple-300 border-purple-400' : 'bg-white/5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10'}`}>
            <Mail className="w-3 h-3" />
            <span>Email</span>
          </button>
          {/* Scribe */}
          <button onClick={() => togglePanel('scribe')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 ${openPanels.includes('scribe') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' : 'bg-white/5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'}`}>
            <Stethoscope className="w-3 h-3" />
            <span>Scribe</span>
          </button>
          {/* Hub */}
          <button onClick={() => onOpenCommHub ? onOpenCommHub('call') : togglePanel('dialpad')}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-xs font-bold border transition-all active:scale-95 bg-white/5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10">
            <PhoneCall className="w-3 h-3" />
            <span>Hub</span>
          </button>
        </div>
      )}

      {/* Background scribe — runs when call active even if panel not visible */}
      {!openPanels.includes('scribe') && (meetingActive || callStatus === 'connected') && (
        <MedazonScribe
          appointmentId={appointment?.id}
          patientName={patientName}
          doctorName={currentUser?.name || 'Doctor'}
          doctorId={currentUser?.id || providerId}
          callActive={meetingActive || callStatus === 'connected'}
          onSoapGenerated={onSoapGenerated}
          visible={false}
        />
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // RENDER: INLINE MODE (fills parent container — for grid)
  // ═══════════════════════════════════════════════════════════════
  if (!isFloating) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(6,38,54,0.97), rgba(10,15,30,0.98))' }}>
        {panelContent}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: FLOATING MODE (portal to body)
  // ═══════════════════════════════════════════════════════════════
  if (!portalTarget) return null

  const floatingPanel = (
    <div ref={panelRef}
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-cyan-500/30 shadow-2xl shadow-black/40"
      style={{
        left: position.x, top: position.y,
        width: hasOpenPanel ? Math.max(size.width, 680) : size.width,
        height: minimized ? 48 : size.height,
        background: 'linear-gradient(135deg, rgba(6,38,54,0.97), rgba(10,15,30,0.98))',
        backdropFilter: 'blur(16px)',
        transition: 'width 0.3s ease, height 0.2s ease',
      }}>
      {/* All-edge resize handles */}
      {!locked && !minimized && <ResizeHandles onStart={handleResizeStart} />}
      {panelContent}
    </div>
  )

  return createPortal(floatingPanel, portalTarget)
}
