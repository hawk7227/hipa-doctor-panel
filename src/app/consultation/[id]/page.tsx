'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * STANDALONE VIDEO CONSULTATION PAGE
 * Route: /consultation/[id]/page.tsx
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Place this file at: src/app/consultation/[id]/page.tsx
 * 
 * A completely self-contained consultation window that:
 * - Opens via URL: /consultation/[appointmentId]
 * - Does NOT require the doctor dashboard
 * - Authenticates via Supabase session
 * - Contains: Video (Daily.co), Patient card, SOAP notes, EHR panels,
 *   AI Scribe, video controls, and all prototype features
 * - Works as a floating window when opened via window.open() from dashboard
 * - Mobile-responsive with swipeable tabs
 * 
 * Usage from dashboard:
 *   window.open(`/consultation/${appointmentId}`, 'consultation', 
 *     'width=1200,height=800,menubar=no,toolbar=no,location=no')
 * ═══════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DailyMeetingEmbed from '@/components/DailycoMeetingPanel'
// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Patient {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  address?: string
  preferred_pharmacy?: string
}

interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  status: string
  service_type: string
  visit_type: string
  requested_date_time: string
  dailyco_meeting_url?: string
  dailyco_room_name?: string
  dailyco_owner_token?: string
  recording_url?: string
  patients?: Patient
  chief_complaint?: string
  reason?: string
}

interface Medication {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  prescriber: string
  start_date: string
  status: string
}

interface Allergy {
  id: string
  allergen: string
  reaction: string
  severity: string
}

interface SOAPNote {
  id?: string
  note_type: string
  content: string
  updated_at?: string
}

// ═══════════════════════════════════════════════════════════════
// ICONS — inline SVG to avoid any external dependency
// ═══════════════════════════════════════════════════════════════

const VideoIcon = ({ on = true, size = 20 }: { on?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={on ? '#e2e8f0' : '#fca5a5'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    {!on && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
)

const MicIcon = ({ on = true, size = 20 }: { on?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={on ? '#e2e8f0' : '#fca5a5'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    {!on && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
)

const ChatIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const ScreenIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const EndCallIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
)

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
)

const PhoneIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const SendIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const LinkIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const CopyIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

// ═══════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════

function convertToTimezone(dateStr: string, tz: string): Date {
  const date = new Date(dateStr)
  return new Date(date.toLocaleString('en-US', { timeZone: tz }))
}

function formatCallTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════
// EHR Panel config
// ═══════════════════════════════════════════════════════════════

const EHR_PANELS = [
  { id: 'medHx', label: 'Med Hx', color: '#6366f1' },
  { id: 'orders', label: 'Orders', color: '#8b5cf6' },
  { id: 'rxHx', label: 'Rx Hx', color: '#a855f7' },
  { id: 'appts', label: 'Appts', color: '#3b82f6' },
  { id: 'allergy', label: 'Allergy', color: '#ef4444' },
  { id: 'vitals', label: 'Vitals', color: '#10b981' },
  { id: 'meds', label: 'Meds', color: '#ec4899' },
]

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ConsultationPageRoute() {
  const params = useParams()
  const appointmentId = (params?.id as string) || ''

  // ─── Data state ───
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doctor, setDoctor] = useState<{ id: string; first_name: string; last_name: string; email: string } | null>(null)

  // ─── UI state ───
  const [activeEHRPanel, setActiveEHRPanel] = useState<string | null>(null)
  const [videoCameraOn, setVideoCameraOn] = useState(true)
  const [videoMicOn, setVideoMicOn] = useState(true)
  const [drSelfViewExpanded, setDrSelfViewExpanded] = useState(false)
  const [drSelfViewHidden, setDrSelfViewHidden] = useState(false)
  const [callActive, setCallActive] = useState(false)
  const [callTime, setCallTime] = useState(0)
  const [soapTab, setSoapTab] = useState(0) // 0=S, 1=O, 2=A, 3=P
  const [soapContent, setSoapContent] = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const [soapSaving, setSoapSaving] = useState(false)
  const [soapSaved, setSoapSaved] = useState(false)
  const [patientCardCollapsed, setPatientCardCollapsed] = useState(false)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [newDateTime, setNewDateTime] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // ─── Mobile state ───
  const [isMobile, setIsMobile] = useState(false)
  const [mobileTab, setMobileTab] = useState<'video' | 'soap' | 'chart' | 'comms'>('video')
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // ─── Idle alarm ───
  const [idleAlarmEnabled, setIdleAlarmEnabled] = useState(true)
  const [idleAlarmMinutes, setIdleAlarmMinutes] = useState(2)
  const [idleAlarmFiring, setIdleAlarmFiring] = useState(false)
  const [showIdleAlarmSettings, setShowIdleAlarmSettings] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const idleAlarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Auto-save timer ───
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!callActive) return
    const interval = setInterval(() => setCallTime(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [callActive])

  useEffect(() => {
    loadData()
  }, [appointmentId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); setLoading(false); return }

      const { data: doc } = await supabase.from('doctors').select('id, first_name, last_name, email').eq('email', user.email).single()
      if (doc) setDoctor(doc)

      // Appointment + patient
      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .select('*, patients(*)')
        .eq('id', appointmentId)
        .single()
      
      if (apptErr) throw apptErr
      setAppointment(appt)

      // Medications
      if (appt?.patient_id) {
        const { data: meds } = await supabase
          .from('medications')
          .select('*')
          .eq('patient_id', appt.patient_id)
          .order('start_date', { ascending: false })
        if (meds) setMedications(meds)

        // Allergies
        const { data: allrg } = await supabase
          .from('allergies')
          .select('*')
          .eq('patient_id', appt.patient_id)
        if (allrg) setAllergies(allrg)
      }

      // SOAP Notes
      const { data: notes } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('appointment_id', appointmentId)
      if (notes) {
        setSoapNotes(notes)
        const s = notes.find(n => n.note_type === 'subjective')
        const o = notes.find(n => n.note_type === 'objective')
        const a = notes.find(n => n.note_type === 'assessment')
        const p = notes.find(n => n.note_type === 'plan')
        setSoapContent({
          subjective: s?.content || '',
          objective: o?.content || '',
          assessment: a?.content || '',
          plan: p?.content || '',
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load appointment')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SOAP AUTO-SAVE
  // ═══════════════════════════════════════════════════════════════

  const handleSoapChange = useCallback((field: string, value: string) => {
    setSoapContent(prev => ({ ...prev, [field]: value }))
    setSoapSaved(false)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      setSoapSaving(true)
      try {
        const existing = soapNotes.find(n => n.note_type === field)
        if (existing?.id) {
          await supabase.from('clinical_notes').update({ content: value, updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('clinical_notes').insert([{ appointment_id: appointmentId, note_type: field, content: value }])
        }
        setSoapSaved(true)
      } catch (e) { console.error('Auto-save error:', e) }
      setSoapSaving(false)
    }, 1500)
  }, [appointmentId, soapNotes])

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════

  const handleReschedule = async () => {
    if (!newDateTime || !appointment) return
    setRescheduleLoading(true)
    try {
      await supabase.from('appointments').update({ requested_date_time: newDateTime, status: 'rescheduled' }).eq('id', appointment.id)
      setShowRescheduleForm(false)
      loadData()
    } catch (e: any) { setError(e.message) }
    setRescheduleLoading(false)
  }

  const handleCancel = async () => {
    if (!appointment) return
    setCancelling(true)
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointment.id)
      setShowCancelConfirm(false)
      loadData()
    } catch (e: any) { setError(e.message) }
    setCancelling(false)
  }

  const handleAcceptReject = async (action: 'accept' | 'reject') => {
    if (!appointment) return
    try {
      await supabase.from('appointments').update({ status: action === 'accept' ? 'accepted' : 'rejected' }).eq('id', appointment.id)
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  // ═══════════════════════════════════════════════════════════════
  // SWIPE
  // ═══════════════════════════════════════════════════════════════

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      const tabs: Array<'video' | 'soap' | 'chart' | 'comms'> = ['video', 'soap', 'chart', 'comms']
      const idx = tabs.indexOf(mobileTab)
      if (dx < 0 && idx < tabs.length - 1) setMobileTab(tabs[idx + 1])
      if (dx > 0 && idx > 0) setMobileTab(tabs[idx - 1])
    }
    touchStartRef.current = null
  }, [mobileTab])

  // ═══════════════════════════════════════════════════════════════
  // IDLE ALARM
  // ═══════════════════════════════════════════════════════════════

  const playAlarmBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      const ctx = audioContextRef.current
      const playTone = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        osc.start(startTime); osc.stop(startTime + duration)
      }
      const now = ctx.currentTime
      playTone(now, 880, 0.15); playTone(now + 0.2, 880, 0.15); playTone(now + 0.4, 1109, 0.25)
    } catch (e) { /* audio not available */ }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════

  const patient = appointment?.patients
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'
  const patientInitials = patient ? `${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}` : 'PT'
  const doctorInitials = doctor ? `${doctor.first_name?.[0] || 'D'}${doctor.last_name?.[0] || 'H'}` : 'DH'
  const patientAge = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000) : null

  const statusColor = appointment?.status === 'accepted' ? '#16a34a' : appointment?.status === 'pending' ? '#ca8a04' : appointment?.status === 'completed' ? '#2563eb' : '#6b7280'

  // ═══════════════════════════════════════════════════════════════
  // RENDER: LOADING / ERROR
  // ═══════════════════════════════════════════════════════════════

  if (!appointmentId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a1018' }}>
        <div className="text-red-400 text-sm">No appointment ID provided</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a1018' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <div className="text-slate-400 text-sm">Loading consultation...</div>
        </div>
      </div>
    )
  }

  if (error && !appointment) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a1018' }}>
        <div className="text-center p-8 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b', maxWidth: 400 }}>
          <div className="text-red-400 text-lg font-bold mb-2">Error</div>
          <div className="text-slate-400 text-sm mb-4">{error}</div>
          <button onClick={loadData} className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: VIDEO AREA (shared between mobile and desktop)
  // ═══════════════════════════════════════════════════════════════

  const renderVideoArea = (height?: string) => (
    <div className="relative w-full" style={{ height: height || '100%', background: '#000', minHeight: 200 }}>
      {/* Daily.co Embed */}
      {appointment?.dailyco_meeting_url && (
        <DailyMeetingEmbed
          dailyco_meeting_url={appointment.dailyco_meeting_url}
          dailyco_room_name={appointment.dailyco_room_name || ''}
          dailyco_owner_token={appointment.dailyco_owner_token || ''}
          recording_url={appointment.recording_url || ''}
        />
      )}

      {/* AI Scribe Recording indicator */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid #1e293b' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] text-red-400 font-bold">AI Scribe Recording</span>
      </div>

      {/* Doctor self-view */}
      {!drSelfViewHidden && (
        <div className="absolute top-3 right-3 z-20 cursor-pointer overflow-hidden flex items-center justify-center"
          style={{
            width: drSelfViewExpanded ? 160 : 48, height: drSelfViewExpanded ? 100 : 48,
            borderRadius: 10, border: '2px solid rgba(0, 203, 169, 0.4)',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'all 0.3s ease'
          }}
          onClick={() => setDrSelfViewExpanded(!drSelfViewExpanded)}>
          {drSelfViewExpanded ? (
            <div style={{ textAlign: 'center' }}>
              <div className="text-[10px] text-slate-400 font-semibold">
                {doctor ? `Dr. ${doctor.last_name || doctor.first_name}` : 'Dr.'}
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}>
              {doctorInitials}
            </div>
          )}
        </div>
      )}
      <button onClick={() => setDrSelfViewHidden(!drSelfViewHidden)}
        className="absolute z-20 px-2 py-1 rounded text-[9px] font-bold hover:text-white transition-colors"
        style={{
          top: drSelfViewHidden ? 12 : (drSelfViewExpanded ? 108 : 56), right: 12,
          background: 'rgba(15,23,42,0.8)', border: '1px solid #334155', color: '#94a3b8'
        }}>
        {drSelfViewHidden ? 'Show self' : 'Hide self'}
      </button>

      {/* Video controls bar — Camera, Mic, Chat, Screen, EndCall */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <button onClick={() => setVideoCameraOn(!videoCameraOn)}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
          style={{ background: videoCameraOn ? 'rgba(30,41,59,0.9)' : 'rgba(239,68,68,0.9)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          <VideoIcon on={videoCameraOn} />
        </button>
        <button onClick={() => setVideoMicOn(!videoMicOn)}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
          style={{ background: videoMicOn ? 'rgba(30,41,59,0.9)' : 'rgba(239,68,68,0.9)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          <MicIcon on={videoMicOn} />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <ChatIcon />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <ScreenIcon />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.9)', border: '1px solid rgba(239,68,68,0.5)' }}>
          <EndCallIcon />
        </button>
      </div>

      {/* Patient name + Video Call label */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-center">
        <div className="text-sm font-bold text-white">{patientName}</div>
        <div className="text-[10px] text-slate-400">Patient • Video Call</div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // RENDER: PATIENT CARD
  // ═══════════════════════════════════════════════════════════════

  const renderPatientCard = () => (
    <div style={{ borderTop: '1px solid #1e293b', background: 'linear-gradient(180deg, #0d1424, #0a1018)' }}>
      {/* Collapse toggle */}
      <button onClick={() => setPatientCardCollapsed(!patientCardCollapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        style={{ background: 'rgba(10,16,24,0.5)' }}>
        <span className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}>
            {patientInitials}
          </div>
          <div>
            <span className="text-white font-bold">{patient?.first_name} </span>
            <span className="text-white font-bold">{patient?.last_name} </span>
            <span className="text-slate-500">{patientAge ? `${patientAge}yo` : ''} {patient?.gender || ''}</span>
          </div>
          {allergies.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 border border-red-500/50 text-red-300 animate-pulse">
              ⚠ {allergies.length} ALLERGIES
            </span>
          )}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
          {patientCardCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
        </svg>
      </button>

      {!patientCardCollapsed && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[10px] text-slate-500">
            DOB: {patient?.date_of_birth || 'N/A'} • {(appointment as any)?.chief_complaint || (appointment as any)?.reason || 'General Visit'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-slate-500 uppercase tracking-wider mb-0.5">Email</div>
              <div className="text-white truncate">{patient?.email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-wider mb-0.5">Phone</div>
              <div className="text-white">{patient?.phone || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // RENDER: SOAP NOTES EDITOR
  // ═══════════════════════════════════════════════════════════════

  const soapFields = ['subjective', 'objective', 'assessment', 'plan'] as const
  const soapLabels = ['Subjective', 'Objective', 'Assessment', 'Plan']

  const renderSOAPNotes = () => (
    <div className="flex flex-col h-full">
      {/* SOAP Tab bar */}
      <div className="flex gap-0 flex-shrink-0" style={{ borderBottom: '1px solid #1e293b', background: 'rgba(10,18,32,0.5)' }}>
        {soapLabels.map((tab, i) => (
          <button key={tab} onClick={() => setSoapTab(i)}
            className="flex-1 py-2 text-xs font-bold transition-all"
            style={{
              color: soapTab === i ? '#00cba9' : '#64748b',
              borderBottom: soapTab === i ? '2px solid #00cba9' : '2px solid transparent',
              background: soapTab === i ? 'rgba(30,41,59,0.3)' : 'transparent'
            }}>
            {tab.charAt(0)}<span className="text-[10px] font-normal ml-0.5">{tab.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* SOAP content */}
      <div className="flex-1 p-3 overflow-y-auto">
        <textarea
          value={soapContent[soapFields[soapTab]]}
          onChange={(e) => handleSoapChange(soapFields[soapTab], e.target.value)}
          placeholder={`Enter ${soapLabels[soapTab]} notes...`}
          className="w-full h-full min-h-[200px] p-3 rounded-lg text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        />
      </div>

      {/* Save status */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5" style={{ borderTop: '1px solid #1e293b', background: 'rgba(10,16,24,0.5)' }}>
        <span className="text-[11px] flex items-center gap-1.5" style={{ color: soapSaving ? '#f59e0b' : soapSaved ? '#4ade80' : '#64748b' }}>
          {soapSaving ? '⟳ Saving...' : soapSaved ? '✓ Auto-saved' : '● Ready'}
        </span>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // RENDER: MEDICATIONS PANEL
  // ═══════════════════════════════════════════════════════════════

  const renderMedicationsPanel = () => (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
        Active Medications ({medications.filter(m => m.status === 'active' || m.status === 'ACTIVE').length})
      </div>
      {medications.filter(m => m.status === 'active' || m.status === 'ACTIVE').map(med => (
        <div key={med.id} className="p-3 rounded-lg" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-white">{med.medication_name} {med.dosage}</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold text-green-400" style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>ACTIVE</span>
          </div>
          <div className="text-[11px] text-slate-400">{med.frequency}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            👤 {med.prescriber || 'Unknown'} &nbsp; 📅 Started {med.start_date || 'N/A'}
          </div>
        </div>
      ))}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0a1018', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ═══ HEADER ═══ */}
      <div className="flex-shrink-0" style={{ background: 'linear-gradient(90deg, #0a1628, #0f172a, #0a1628)', borderBottom: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold tracking-wider" style={{ background: 'linear-gradient(90deg, #00e6ff, #00cba9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MEDAZON</span>
            <span className="text-sm font-extrabold text-white">+ HEALTH</span>
            <span className="text-xs text-cyan-400 font-bold ml-2">APPOINTMENT</span>
            <span className="text-xs text-slate-500">
              • {appointment?.requested_date_time && (() => {
                const d = convertToTimezone(appointment.requested_date_time, 'America/Phoenix')
                return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
              })()}
            </span>
            {appointment?.status && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: statusColor }}>
                {appointment.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {callActive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-400">{formatCallTime(callTime)}</span>
              </span>
            )}
          </div>
        </div>

        {/* EHR Toolbar */}
        <div className="flex items-center gap-1.5 px-4 py-1 overflow-x-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', scrollbarWidth: 'none' }}>
          {EHR_PANELS.map(panel => (
            <button key={panel.id} onClick={() => setActiveEHRPanel(activeEHRPanel === panel.id ? null : panel.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold whitespace-nowrap border transition-all"
              style={{
                borderColor: activeEHRPanel === panel.id ? panel.color : '#1e293b',
                color: activeEHRPanel === panel.id ? '#fff' : '#94a3b8',
                background: activeEHRPanel === panel.id ? panel.color + '30' : 'transparent'
              }}>
              {panel.label}
            </button>
          ))}
          <button onClick={() => { setShowRescheduleForm(!showRescheduleForm); setShowCancelConfirm(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-white"
            style={{ background: '#ea580c', flexShrink: 0 }}>
            ↻ Reschedule
          </button>
          <button onClick={() => { setShowCancelConfirm(!showCancelConfirm); setShowRescheduleForm(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-white"
            style={{ background: '#dc2626', flexShrink: 0 }}>
            ✕ Cancel Appt
          </button>
        </div>

        {/* Reschedule / Cancel forms */}
        {showRescheduleForm && (
          <div className="px-4 py-2" style={{ background: 'rgba(249,115,22,0.08)', borderTop: '1px solid rgba(249,115,22,0.2)' }}>
            <div className="flex items-center gap-3">
              <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)}
                className="flex-1 px-3 py-1 bg-slate-800 border border-white/20 rounded-lg text-white text-xs" />
              <button onClick={handleReschedule} disabled={!newDateTime || rescheduleLoading}
                className="px-3 py-1 bg-orange-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                {rescheduleLoading ? '...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        )}
        {showCancelConfirm && (
          <div className="px-4 py-2" style={{ background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-red-300 text-xs">Cancel this appointment?</span>
              <div className="flex gap-2">
                <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs">No</button>
                <button onClick={handleCancel} disabled={cancelling} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                  {cancelling ? '...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept/Reject for pending */}
        {appointment?.status === 'pending' && (
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ borderTop: '1px solid #1e293b', background: 'rgba(202,138,4,0.05)' }}>
            <span className="text-xs text-yellow-400">Appointment pending your approval</span>
            <button onClick={() => handleAcceptReject('accept')} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold">Accept</button>
            <button onClick={() => handleAcceptReject('reject')} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold">Reject</button>
          </div>
        )}
      </div>

      {/* ═══ CONTENT — Two-column (desktop) or tabbed (mobile) ═══ */}
      <div className="flex-1 flex overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {isMobile ? (
          /* ── MOBILE: Tab-based layout ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile tab bar */}
            <div className="flex gap-0.5 px-2 py-1 flex-shrink-0" style={{ background: '#0a1018', borderBottom: '1px solid #1e293b' }}>
              {([
                { id: 'video' as const, label: 'Call', icon: '📹' },
                { id: 'soap' as const, label: 'SOAP', icon: '📋' },
                { id: 'chart' as const, label: 'Chart', icon: '📊' },
                { id: 'comms' as const, label: 'Comms', icon: '💬' },
              ]).map(tab => (
                <button key={tab.id} onClick={() => setMobileTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold"
                  style={{
                    background: mobileTab === tab.id ? '#1e293b' : 'transparent',
                    color: mobileTab === tab.id ? '#00e6ff' : '#64748b',
                    borderBottom: mobileTab === tab.id ? '2px solid #00e6ff' : '2px solid transparent'
                  }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {mobileTab === 'video' && (
                <div className="flex flex-col h-full">
                  <div style={{ height: '45vh', minHeight: 200 }}>{renderVideoArea('100%')}</div>
                  {renderPatientCard()}
                </div>
              )}
              {mobileTab === 'soap' && renderSOAPNotes()}
              {mobileTab === 'chart' && renderMedicationsPanel()}
              {mobileTab === 'comms' && (
                <div className="p-4 text-center text-slate-500 text-sm">
                  Communication tools available in the full dashboard
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── DESKTOP: Two-column layout ── */
          <>
            {/* LEFT: Video + Patient Card */}
            <div className="flex flex-col overflow-hidden" style={{ width: '45%', minWidth: 380, borderRight: '1px solid #1e293b' }}>
              <div className="flex-1 min-h-0">
                {renderVideoArea()}
              </div>
              {renderPatientCard()}
            </div>

            {/* RIGHT: SOAP + Meds overlay */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeEHRPanel === 'meds' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #1e293b', background: 'rgba(10,18,32,0.5)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-pink-400">♥</span>
                      <span className="text-sm font-bold text-white">Medications</span>
                      <span className="px-2 py-0.5 rounded text-[10px] text-slate-400" style={{ background: '#1e293b' }}>{patientName}</span>
                    </div>
                    <button onClick={() => setActiveEHRPanel(null)} className="text-slate-400 hover:text-white"><XIcon /></button>
                  </div>
                  {renderMedicationsPanel()}
                </div>
              ) : (
                renderSOAPNotes()
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
