'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, Appointment } from '@/lib/supabase'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog'
import InstantVisitQueueModal from '@/components/InstantVisitQueueModal'
import { HoverPreview, useHoverPreview, MiniCalendar, deriveChartStatus, getChipBorderStyle, getChipStatusIcon, useExtras, ExtrasToggleButton, ConfettiOverlay, WelcomePopup } from '@/components/calendar'
import type { HoverPreviewData } from '@/components/calendar'
import { PROVIDER_TIMEZONE, CALENDAR_DEFAULTS } from '@/lib/constants'
import { useNotifications } from '@/lib/notifications'
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, ArrowLeft,
  Video, Phone, MessageSquare, Zap, Bell, List, Printer, Calendar
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ClinicalNote {
  id: string
  note_type: string
  content: string | null
}

interface CalendarAppointment extends Omit<Appointment, 'patients' | 'requested_date_time' | 'visit_type'> {
  requested_date_time: string | null
  visit_type: string | null
  patients?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    chief_complaint?: string | null
    date_of_birth?: string | null
    gender?: string | null
  } | null
  doctors?: { timezone: string }
  clinical_notes?: ClinicalNote[] | null
  subjective_notes?: string | null
  chief_complaint?: string | null
  reason?: string | null
  chart_locked: boolean | null
  chart_status?: string | null
  created_at?: string | null
}

type CalendarView = 'week' | 'day' | 'list'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getTimeSlots(): Date[] {
  const slots: Date[] = []
  for (let h = CALENDAR_DEFAULTS.START_HOUR; h <= CALENDAR_DEFAULTS.END_HOUR; h++) {
    for (let m = 0; m < 60; m += CALENDAR_DEFAULTS.SLOT_MINUTES) {
      slots.push(new Date(2000, 0, 1, h, m))
    }
  }
  return slots
}

function formatSlotTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function getAppointmentReason(apt: CalendarAppointment): string {
  if (apt.chief_complaint) return apt.chief_complaint
  if (apt.reason) return apt.reason
  if (apt.subjective_notes) return apt.subjective_notes
  if (apt.patients?.chief_complaint) return apt.patients.chief_complaint
  if (apt.clinical_notes?.length) {
    const soap = apt.clinical_notes.find(n => n.note_type === 'soap' && n.content)
    if (soap?.content) {
      try {
        const parsed = JSON.parse(soap.content)
        return parsed.subjective || parsed.chief_complaint || ''
      } catch { return '' }
    }
  }
  return ''
}

function getVisitTypeIcon(type: string | null) {
  switch (type) {
    case 'video': return Video
    case 'phone': return Phone
    case 'async': return MessageSquare
    case 'instant': return Zap
    default: return Video
  }
}

function getNowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AppointmentsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Core state ──
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [refreshing, setRefreshing] = useState(false)

  // ── Modal state ──
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    searchParams.get('apt') || null
  )
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null)
  const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null)
  const [followUpPatientData, setFollowUpPatientData] = useState<any>(null)
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)

  // ── Instant visit state ──
  const [instantVisitQueue, setInstantVisitQueue] = useState<CalendarAppointment[]>([])
  const [activeInstantVisit, setActiveInstantVisit] = useState<CalendarAppointment | null>(null)
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false)

  // ── Current time ──
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes)

  const hoverPreview = useHoverPreview()
  const extras = useExtras()
  const { addNotification } = useNotifications()
  const [showWelcome, setShowWelcome] = useState(false)
  const today = useMemo(() => new Date(), [])
  const timeSlots = useMemo(() => getTimeSlots(), [])

  // ── Computed ──
  const visibleDates = useMemo(() => {
    if (calendarView === 'day') return [currentDate]
    return getWeekDates(currentDate)
  }, [currentDate, calendarView])

  const datesWithAppointments = useMemo(() => {
    const dates = new Set<string>()
    appointments.forEach(apt => {
      if (apt.scheduled_time) dates.add(formatDateKey(new Date(apt.scheduled_time)))
    })
    return dates
  }, [appointments])

  const dateLabel = useMemo(() => {
    if (calendarView === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: PROVIDER_TIMEZONE })
    }
    const week = getWeekDates(currentDate)
    const first = week[0]
    const last = week[6]
    if (first.getMonth() === last.getMonth()) {
      return `${first.toLocaleDateString('en-US', { month: 'long', timeZone: PROVIDER_TIMEZONE })} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`
    }
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: PROVIDER_TIMEZONE })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: PROVIDER_TIMEZONE })}`
  }, [currentDate, calendarView])

  // ── Appointment lookup ──
  const getAppointmentForSlot = useCallback((date: Date, slot: Date): CalendarAppointment | null => {
    return appointments.find(apt => {
      if (!apt.scheduled_time) return false
      const aptDate = new Date(apt.scheduled_time)
      return isSameDay(aptDate, date) && aptDate.getHours() === slot.getHours() && aptDate.getMinutes() === slot.getMinutes()
    }) || null
  }, [appointments])

  // ═══════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════

  const fetchAppointments = useCallback(async (doctorId: string, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors!appointments_doctor_id_fkey(timezone),
          patients!appointments_patient_id_fkey(first_name, last_name, email, phone, chief_complaint),
          clinical_notes(id, note_type, content)
        `)
        .eq('doctor_id', doctorId)
        .neq('status', 'cancelled')
        .order('requested_date_time', { ascending: true })

      if (fetchError) {
        // Some Supabase errors are empty objects {} — only fail on real errors
        const hasMessage = fetchError.message || fetchError.code || fetchError.details
        if (hasMessage) {
          console.error('Error fetching appointments:', fetchError)
          setError(`Failed to load appointments: ${fetchError.message || 'Unknown error'}`)
          return
        } else {
          console.warn('Supabase returned empty error object, proceeding:', fetchError)
        }
      }

      setAppointments((data || []) as any)
    } catch (err) {
      console.error('Error fetching appointments:', err)
      setError('Failed to load appointments')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [])

  // ── Auth init ──
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: doctor, error: docErr } = await supabase
          .from('doctors')
          .select('id')
          .eq('email', user.email)
          .single()

        if (docErr || !doctor) { setLoading(false); return }

        setCurrentDoctorId(doctor.id)
        fetchAppointments(doctor.id)
      } catch { setLoading(false) }
    }
    init()
  }, [fetchAppointments])

  // ── Instant visit detection ──
  useEffect(() => {
    if (!currentDoctorId) return
    const instants = appointments.filter(apt =>
      apt.visit_type === 'instant' && apt.status !== 'completed' && apt.status !== 'cancelled'
    )
    setInstantVisitQueue(instants)
    if (instants.length > 0 && !activeInstantVisit) {
      setActiveInstantVisit(instants[0])
      setIsQueueModalOpen(true)
    }
  }, [appointments, currentDoctorId, activeInstantVisit])

  // ── Realtime subscription ──
  useEffect(() => {
    if (!currentDoctorId) return
    const channel = supabase
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${currentDoctorId}` }, () => {
        fetchAppointments(currentDoctorId, true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentDoctorId, fetchAppointments])

  // ── Time ticker ──
  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(getNowMinutes()), 60000)
    return () => clearInterval(interval)
  }, [])

  // ── Welcome popup (if extras enabled) ──
  useEffect(() => {
    if (!loading && extras.state.welcomePopup) {
      setShowWelcome(true)
    }
  }, [loading, extras.state.welcomePopup])

  // ── Scroll to current time on load ──
  useEffect(() => {
    if (!loading && gridRef.current && calendarView !== 'list') {
      const startMin = CALENDAR_DEFAULTS.START_HOUR * 60
      const currentMin = getNowMinutes()
      const rowHeight = 64
      const targetRow = Math.floor((currentMin - startMin) / CALENDAR_DEFAULTS.SLOT_MINUTES)
      gridRef.current.scrollTop = Math.max(0, (targetRow - 2) * rowHeight)
    }
  }, [loading, calendarView])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey) return

      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); navigateDate('prev'); break
        case 'ArrowRight': e.preventDefault(); navigateDate('next'); break
        case 't': case 'T': e.preventDefault(); goToToday(); break
        case 'd': case 'D': e.preventDefault(); setCalendarView('day'); break
        case 'w': case 'W': e.preventDefault(); setCalendarView('week'); break
        case 'l': case 'L': e.preventDefault(); setCalendarView('list'); break
        case 'n': case 'N':
          if (!showCreateDialog) {
            e.preventDefault()
            setSelectedSlotDate(currentDate)
            setSelectedSlotTime(new Date(2000, 0, 1, new Date().getHours() + 1, 0))
            setShowCreateDialog(true)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigateDate, goToToday, currentDate, showCreateDialog])

  // ── Touch swipe for mobile day navigation ──
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      const dx = e.changedTouches[0].clientX - touchStart.current.x
      const dy = e.changedTouches[0].clientY - touchStart.current.y
      // Only trigger horizontal swipe (not vertical scroll)
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        navigateDate(dx > 0 ? 'prev' : 'next')
      }
      touchStart.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigateDate])

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handleRefresh = useCallback(async () => {
    if (!currentDoctorId || refreshing) return
    setRefreshing(true)
    await fetchAppointments(currentDoctorId, true)
    setRefreshing(false)
  }, [currentDoctorId, refreshing, fetchAppointments])

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      const delta = calendarView === 'week' ? 7 : 1
      d.setDate(d.getDate() + (direction === 'next' ? delta : -delta))
      return d
    })
  }, [calendarView])

  const goToToday = useCallback(() => setCurrentDate(new Date()), [])

  const handleSlotClick = useCallback((date: Date, slot: Date) => {
    const apt = getAppointmentForSlot(date, slot)
    if (apt) {
      setSelectedAppointmentId(apt.id)
    } else {
      setSelectedSlotDate(date)
      setSelectedSlotTime(slot)
      setShowCreateDialog(true)
    }
  }, [getAppointmentForSlot])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const getAppointmentsForDate = useCallback((date: Date): CalendarAppointment[] => {
    return appointments.filter(apt => apt.scheduled_time && isSameDay(new Date(apt.scheduled_time), date))
      .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime())
  }, [appointments])

  // List view: appointments for visible date range
  const listViewAppointments = useMemo(() => {
    if (calendarView !== 'list') return []
    const weekDates = getWeekDates(currentDate)
    const result: { date: Date; appointments: CalendarAppointment[] }[] = []
    weekDates.forEach(date => {
      const dayApts = getAppointmentsForDate(date)
      if (dayApts.length > 0) {
        result.push({ date, appointments: dayApts })
      }
    })
    return result
  }, [calendarView, currentDate, getAppointmentsForDate])

  const handleStartCall = useCallback(() => {
    if (activeInstantVisit) {
      setSelectedAppointmentId(activeInstantVisit.id)
      setIsQueueModalOpen(false)
    }
  }, [activeInstantVisit])

  const handleCompleteInstantVisit = useCallback(async () => {
    if (!activeInstantVisit || !currentDoctorId) return
    try {
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', activeInstantVisit.id)
      setActiveInstantVisit(null)
      setIsQueueModalOpen(false)
      fetchAppointments(currentDoctorId, true)
    } catch (err) { console.error('Error completing instant visit:', err) }
  }, [activeInstantVisit, currentDoctorId, fetchAppointments])

  const handleCancelInstantVisit = useCallback(async () => {
    if (!activeInstantVisit || !currentDoctorId) return
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', activeInstantVisit.id)
      setActiveInstantVisit(null)
      setIsQueueModalOpen(false)
      fetchAppointments(currentDoctorId, true)
    } catch (err) { console.error('Error cancelling instant visit:', err) }
  }, [activeInstantVisit, currentDoctorId, fetchAppointments])

  // ═══════════════════════════════════════════════════════════
  // DEV: DEMO APPOINTMENTS (shows all chart states)
  // ═══════════════════════════════════════════════════════════

  const loadDemoAppointments = useCallback(() => {
    const todayStr = formatDateKey(new Date())
    const makeTime = (hour: number, min: number) => `${todayStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`

    const demos: CalendarAppointment[] = [
      {
        id: 'demo-1', doctor_id: '', patient_id: 'p1', status: 'pending',
        scheduled_time: makeTime(8, 0), requested_date_time: makeTime(8, 0),
        visit_type: 'video', chart_locked: false, chart_status: 'draft',
        patients: { first_name: 'Sarah', last_name: 'Johnson', email: '', phone: '', chief_complaint: 'UTI symptoms - burning, frequency' },
      },
      {
        id: 'demo-2', doctor_id: '', patient_id: 'p2', status: 'accepted',
        scheduled_time: makeTime(9, 0), requested_date_time: makeTime(9, 0),
        visit_type: 'video', chart_locked: false, chart_status: 'preliminary',
        patients: { first_name: 'Marcus', last_name: 'Williams', email: '', phone: '', chief_complaint: 'ADHD follow-up evaluation' },
      },
      {
        id: 'demo-3', doctor_id: '', patient_id: 'p3', status: 'completed',
        scheduled_time: makeTime(10, 0), requested_date_time: makeTime(10, 0),
        visit_type: 'phone', chart_locked: false, chart_status: 'signed',
        patients: { first_name: 'Emily', last_name: 'Chen', email: '', phone: '', chief_complaint: 'STD screening results review' },
      },
      {
        id: 'demo-4', doctor_id: '', patient_id: 'p4', status: 'completed',
        scheduled_time: makeTime(11, 0), requested_date_time: makeTime(11, 0),
        visit_type: 'video', chart_locked: true, chart_status: 'closed',
        patients: { first_name: 'James', last_name: 'Rodriguez', email: '', phone: '', chief_complaint: 'Anxiety medication refill' },
      },
      {
        id: 'demo-5', doctor_id: '', patient_id: 'p5', status: 'completed',
        scheduled_time: makeTime(12, 0), requested_date_time: makeTime(12, 0),
        visit_type: 'async', chart_locked: true, chart_status: 'amended',
        patients: { first_name: 'Aisha', last_name: 'Patel', email: '', phone: '', chief_complaint: 'Skin rash assessment - amended dosage' },
      },
      {
        id: 'demo-6', doctor_id: '', patient_id: 'p6', status: 'accepted',
        scheduled_time: makeTime(13, 30), requested_date_time: makeTime(13, 30),
        visit_type: 'instant', chart_locked: false, chart_status: 'draft',
        patients: { first_name: 'David', last_name: 'Kim', email: '', phone: '', chief_complaint: 'Urgent sore throat' },
      },
      {
        id: 'demo-7', doctor_id: '', patient_id: 'p7', status: 'accepted',
        scheduled_time: makeTime(14, 0), requested_date_time: makeTime(14, 0),
        visit_type: 'video', chart_locked: false, chart_status: 'draft',
        patients: { first_name: 'Lisa', last_name: 'Thompson', email: '', phone: '', chief_complaint: 'Blood pressure follow-up' },
      },
    ] as any

    setAppointments(demos)
  }, [])

  // ═══════════════════════════════════════════════════════════
  // CURRENT TIME INDICATOR
  // ═══════════════════════════════════════════════════════════

  const currentTimePosition = useMemo(() => {
    const startMin = CALENDAR_DEFAULTS.START_HOUR * 60
    const endMin = CALENDAR_DEFAULTS.END_HOUR * 60 + 30
    if (nowMinutes < startMin || nowMinutes > endMin) return null
    const totalSlots = (endMin - startMin) / CALENDAR_DEFAULTS.SLOT_MINUTES
    const currentSlot = (nowMinutes - startMin) / CALENDAR_DEFAULTS.SLOT_MINUTES
    return (currentSlot / totalSlots) * 100
  }, [nowMinutes])

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
          <span className="text-sm text-gray-400">Loading calendar...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="bg-[#0d2626] border border-red-500/30 rounded-xl p-6 max-w-sm text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load calendar</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={handleRefresh} className="bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-teal-500/20">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0a1f1f] overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex-shrink-0 border-b border-[#1a3d3d] bg-[#0d2626]">
        <div className="flex items-center justify-between px-3 py-2 md:px-4">
          <div className="flex items-center space-x-2 min-w-0">
            <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors md:hidden" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-white truncate">Your Appointments</h1>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Dev: Load demo appointments to see all chart states */}
            {process.env.NODE_ENV === 'development' && (
              <>
              <button
                onClick={loadDemoAppointments}
                className="px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-[10px] font-bold transition-colors"
                title="Load demo appointments (dev only)"
              >
                Demo
              </button>
              <button
                onClick={() => {
                  const types = ['new_appointment', 'instant_visit', 'patient_message', 'payment_received', 'appointment_cancelled'] as const
                  const titles = ['📅 New Appointment Booked', '⚡ Instant Visit Request', '💬 Patient Message', '💰 Payment Received', '❌ Appointment Cancelled']
                  const bodies = ['Sarah Johnson booked a video visit for 2:30 PM — tap to view', 'Urgent care request from David Kim — tap to view queue', 'Emily Chen: "When will my results be ready?" — tap to reply', '$75.00 payment from James Rodriguez — tap to view', 'Lisa Thompson cancelled her 3:00 PM visit']
                  const urls = ['/doctor/appointments', '/doctor/appointments', '/doctor/communication', '/doctor/billing', '/doctor/appointments']
                  const idx = Math.floor(Math.random() * types.length)
                  addNotification({ type: types[idx], title: titles[idx], body: bodies[idx], priority: idx === 1 ? 'urgent' : idx === 4 ? 'high' : 'normal', actionUrl: urls[idx] })
                }}
                className="px-2 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-400 hover:bg-pink-500/25 text-[10px] font-bold transition-colors"
                title="Send test notification (dev only)"
              >
                🔔 Test
              </button>
              </>
            )}
            <ExtrasToggleButton extras={extras} />
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50" aria-label="Refresh" title="Refresh appointments">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setSelectedSlotDate(currentDate)
                setSelectedSlotTime(new Date(2000, 0, 1, new Date().getHours() + 1, 0))
                setShowCreateDialog(true)
              }}
              className="flex items-center space-x-1.5 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] pl-2.5 pr-3.5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-teal-500/20"
              aria-label="New appointment"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Appt</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-2 md:px-4">
          <div className="flex items-center space-x-1">
            <button onClick={() => navigateDate('prev')} className="p-1.5 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors" aria-label="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 border border-pink-500/30 transition-colors">Today</button>
            <button onClick={() => navigateDate('next')} className="p-1.5 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors" aria-label="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm text-white font-bold ml-2 truncate">{dateLabel}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-[#0a1f1f] rounded-lg p-0.5 border border-[#1a3d3d]">
              <button onClick={() => setCalendarView('day')} className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${calendarView === 'day' ? 'bg-blue-400 text-[#0a1f1f] shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}>Day</button>
              <button onClick={() => setCalendarView('week')} className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${calendarView === 'week' ? 'bg-blue-400 text-[#0a1f1f] shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}>Week</button>
              <button onClick={() => setCalendarView('list')} className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${calendarView === 'list' ? 'bg-blue-400 text-[#0a1f1f] shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={handlePrint} className="p-1.5 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-400 hover:text-teal-400 transition-colors hidden md:block" title="Print appointments" aria-label="Print">
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Mini Calendar Sidebar (lg+ only) ── */}
        <div className="hidden lg:flex flex-col flex-shrink-0 w-[270px] border-r border-[#1a3d3d] bg-[#0b2424] p-3 overflow-y-auto">
          <MiniCalendar
            currentDate={currentDate}
            onDateSelect={(date) => setCurrentDate(date)}
            onMonthChange={(date) => setCurrentDate(date)}
            datesWithAppointments={datesWithAppointments}
          />
          <div className="mt-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold px-1">Today&apos;s Summary</p>
            {(() => {
              const todayApts = appointments.filter(apt => apt.scheduled_time && isSameDay(new Date(apt.scheduled_time), today))
              const completed = todayApts.filter(a => a.status === 'completed').length
              const pending = todayApts.filter(a => a.status === 'pending').length
              const accepted = todayApts.filter(a => a.status === 'accepted').length
              return (
                <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium">Total</span>
                    <span className="text-lg font-bold text-white">{todayApts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium">Completed</span>
                    <span className="text-lg font-bold text-green-400">{completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium">Accepted</span>
                    <span className="text-lg font-bold text-blue-400">{accepted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium">Pending</span>
                    <span className="text-lg font-bold text-amber-400">{pending}</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ══ LIST VIEW ══ */}
          {calendarView === 'list' ? (
            <div ref={gridRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
              {listViewAppointments.length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium">No appointments this week</p>
                  <p className="text-xs text-gray-500 mt-1">Try navigating to a different week or create a new appointment.</p>
                </div>
              ) : (
                listViewAppointments.map(({ date, appointments: dayApts }) => {
                  const isToday = isSameDay(date, today)
                  return (
                    <div key={formatDateKey(date)}>
                      {/* Day header */}
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isToday ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-[#0d2626] text-gray-300 border border-[#1a3d3d]'}`}>
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: PROVIDER_TIMEZONE })}
                        </div>
                        {isToday && <span className="text-[9px] text-teal-400 font-bold uppercase tracking-wider">Today</span>}
                        <span className="text-[10px] text-gray-500 font-bold">{dayApts.length} appt{dayApts.length !== 1 ? 's' : ''}</span>
                      </div>
                      {/* Appointment cards */}
                      <div className="space-y-1.5">
                        {dayApts.map(apt => {
                          const aptTime = apt.scheduled_time ? new Date(apt.scheduled_time) : null
                          const timeStr = aptTime ? formatSlotTime(aptTime) : ''
                          const reason = getAppointmentReason(apt)
                          const chartStatus = deriveChartStatus(apt)
                          const statusIcon = getChipStatusIcon(chartStatus)
                          const VisitIcon = getVisitTypeIcon(apt.visit_type)
                          return (
                            <div
                              key={apt.id}
                              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all hover:brightness-110 ${
                                apt.status === 'completed' ? 'bg-green-500/10 hover:bg-green-500/15' :
                                apt.status === 'pending' ? 'bg-amber-500/10 hover:bg-amber-500/15' :
                                apt.status === 'accepted' ? 'bg-blue-500/10 hover:bg-blue-500/15' :
                                'bg-gray-500/10 hover:bg-gray-500/15'
                              }`}
                              style={getChipBorderStyle(chartStatus)}
                              onClick={() => setSelectedAppointmentId(apt.id)}
                            >
                              {/* Time */}
                              <div className="w-16 flex-shrink-0 text-right">
                                <p className="text-sm font-bold text-white">{timeStr}</p>
                              </div>
                              {/* Patient info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-bold text-white truncate">
                                    {apt.patients?.first_name} {apt.patients?.last_name}
                                  </p>
                                  <span style={{ color: statusIcon.color, filter: `drop-shadow(0 0 3px ${statusIcon.color}50)` }} className="text-xs" title={statusIcon.title}>{statusIcon.icon}</span>
                                </div>
                                {reason && <p className="text-xs text-gray-400 truncate mt-0.5">{reason}</p>}
                              </div>
                              {/* Visit type */}
                              <div className="flex items-center space-x-1.5 flex-shrink-0">
                                <VisitIcon className="w-3.5 h-3.5 text-gray-400" />
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                                  apt.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                  apt.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                  apt.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>{apt.status}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
          /* ══ GRID VIEW (day/week) ══ */
          <>
          {/* Column headers */}
          <div className="flex-shrink-0 border-b border-[#1a3d3d] bg-[#0d2626]">
            <div className="flex">
              <div className="w-14 md:w-16 flex-shrink-0" />
              {visibleDates.map((date, i) => {
                const isToday = isSameDay(date, today)
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: PROVIDER_TIMEZONE })
                const dayNum = date.getDate()
                const dayAptCount = getAppointmentsForDate(date).length
                return (
                  <div key={i} className={`flex-1 min-w-0 text-center py-2 border-l border-[#1a3d3d]/50 first:border-l-0 ${isToday ? 'bg-teal-500/5' : ''}`}>
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${isToday ? 'text-teal-400' : 'text-gray-400'}`}>{dayName}</p>
                    <div className="flex items-center justify-center space-x-1">
                      <p className={`text-xl font-bold leading-tight ${isToday ? 'text-teal-400' : 'text-white'}`}>{dayNum}</p>
                      {dayAptCount > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-teal-500/20 text-teal-400' : 'bg-white/10 text-gray-300'}`}>
                          {dayAptCount}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scrollable grid */}
          <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
            {/* Current time line */}
            {currentTimePosition !== null && visibleDates.some(d => isSameDay(d, today)) && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${currentTimePosition}%` }}>
                <div className="flex items-center">
                  <div className="w-14 md:w-16 flex justify-end pr-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                  <div className="flex-1 h-[2px] bg-red-500/60" />
                </div>
              </div>
            )}

            {/* Time rows */}
            {timeSlots.map((slot, rowIdx) => {
              const slotMin = slot.getHours() * 60 + slot.getMinutes()
              const isPast = nowMinutes > slotMin + CALENDAR_DEFAULTS.SLOT_MINUTES
              const isHour = slot.getMinutes() === 0

              return (
                <div key={rowIdx} className={`flex ${isHour ? 'border-t border-[#1a3d3d]' : 'border-t border-[#1a3d3d]/20'}`} style={{ minHeight: '64px' }}>
                  <div className="w-14 md:w-16 flex-shrink-0 text-right pr-2 pt-1">
                    {isHour && (
                      <span className={`text-[10px] font-bold ${isPast ? 'text-gray-600' : 'text-gray-300'}`}>{formatSlotTime(slot)}</span>
                    )}
                  </div>

                  {visibleDates.map((date, colIdx) => {
                    const appointment = getAppointmentForSlot(date, slot)
                    const isToday = isSameDay(date, today)
                    const isCellPast = isPast && isToday

                    return (
                      <div
                        key={colIdx}
                        className={`flex-1 min-w-0 border-l border-[#1a3d3d]/30 first:border-l-0 cursor-pointer transition-colors group relative ${isToday ? 'bg-teal-500/[0.02]' : ''} ${isCellPast ? 'opacity-50' : ''} ${!appointment ? 'hover:bg-teal-500/5' : ''}`}
                        onClick={() => handleSlotClick(date, slot)}
                      >
                        {/* Empty: show + on hover */}
                        {!appointment && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4 text-teal-500/30" />
                          </div>
                        )}

                        {/* Appointment chip */}
                        {appointment && (
                          <div
                            className={`m-0.5 rounded-lg p-1.5 md:p-2 h-[calc(100%-4px)] overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:brightness-110 relative ${
                              appointment.status === 'completed' ? 'bg-green-500/15 hover:bg-green-500/25' :
                              appointment.status === 'pending' ? 'bg-amber-500/15 hover:bg-amber-500/25' :
                              appointment.status === 'accepted' ? 'bg-blue-500/15 hover:bg-blue-500/25' :
                              'bg-gray-500/15 hover:bg-gray-500/25'
                            }`}
                            style={getChipBorderStyle(deriveChartStatus(appointment))}
                            onMouseEnter={(e) => {
                              const chipEl = e.currentTarget as HTMLElement
                              const previewData: HoverPreviewData = {
                                patientName: `${appointment.patients?.first_name || ''} ${appointment.patients?.last_name || ''}`.trim() || 'Patient',
                                patientGender: appointment.patients?.gender || undefined,
                                patientDOB: appointment.patients?.date_of_birth || undefined,
                                providerName: 'LaMonica A. Hodges',
                                appointmentTime: formatSlotTime(slot),
                                appointmentDuration: '30 min',
                                appointmentDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                                visitType: appointment.visit_type || 'video',
                                chartStatus: deriveChartStatus(appointment),
                                chiefComplaint: getAppointmentReason(appointment) || undefined,
                                appointmentStatus: appointment.status,
                              }
                              hoverPreview.showPreview(previewData, chipEl)
                            }}
                            onMouseLeave={() => hoverPreview.hidePreview()}
                          >
                            {(() => {
                              const si = getChipStatusIcon(deriveChartStatus(appointment))
                              return <span className="absolute top-1 right-1.5 text-[10px]" style={{ color: si.color, filter: `drop-shadow(0 0 3px ${si.color}50)` }} title={si.title}>{si.icon}</span>
                            })()}
                            <p className="text-xs font-bold text-white truncate leading-tight">
                              {appointment.patients?.first_name} {appointment.patients?.last_name?.charAt(0)}.
                            </p>
                            <div className="flex items-center space-x-1 mt-0.5">
                              {(() => { const I = getVisitTypeIcon(appointment.visit_type); return <I className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" /> })()}
                              <span className="text-[9px] text-gray-400 truncate">{formatSlotTime(slot)}</span>
                            </div>
                            {(() => {
                              const r = getAppointmentReason(appointment)
                              if (!r) return null
                              return <p className="text-[9px] text-gray-500 truncate mt-0.5 hidden md:block">{r.length > 25 ? r.substring(0, 25) + '...' : r}</p>
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          </>
          )}
        </div>
      </div>

      {/* ═══ NOTIFICATION ═══ */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out] ${notification.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          {notification.message}
        </div>
      )}

      {/* ═══ HOVER PREVIEW ═══ */}
      <HoverPreview data={hoverPreview.data} anchorRect={hoverPreview.anchorRect} isVisible={hoverPreview.isVisible} onMouseEnter={hoverPreview.onPopupMouseEnter} onMouseLeave={hoverPreview.onPopupMouseLeave} />

      {/* ═══ APPOINTMENT DETAIL MODAL ═══ */}
      <AppointmentDetailModal
        appointmentId={selectedAppointmentId}
        isOpen={!!selectedAppointmentId}
        appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
        currentDate={currentDate}
        onClose={() => setSelectedAppointmentId(null)}
        onStatusChange={() => { if (currentDoctorId) fetchAppointments(currentDoctorId, true) }}
        onAppointmentSwitch={(appointmentId) => setSelectedAppointmentId(appointmentId)}
        onFollowUp={(patientData, date, time) => {
          setFollowUpPatientData(patientData)
          setSelectedSlotDate(date)
          setSelectedSlotTime(time)
          setShowCreateDialog(true)
          setSelectedAppointmentId(null)
        }}
        onSmsSent={(message) => {
          setNotification({ type: 'success', message })
          setTimeout(() => setNotification(null), 5000)
        }}
      />

      {/* ═══ CREATE DIALOG ═══ */}
      {currentDoctorId && selectedSlotDate && selectedSlotTime && (
        <CreateAppointmentDialog
          isOpen={showCreateDialog}
          appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
          onClose={() => { setShowCreateDialog(false); setSelectedSlotDate(null); setSelectedSlotTime(null); setFollowUpPatientData(null) }}
          onSuccess={async () => { if (currentDoctorId) await fetchAppointments(currentDoctorId); setFollowUpPatientData(null) }}
          doctorId={currentDoctorId}
          selectedDate={selectedSlotDate}
          selectedTime={selectedSlotTime}
          patientData={followUpPatientData}
        />
      )}

      {/* ═══ DELIGHTFUL EXTRAS ═══ */}
      <ConfettiOverlay active={extras.state.confetti} />
      <WelcomePopup show={showWelcome} doctorName="" onDismiss={() => setShowWelcome(false)} />

      {/* ═══ INSTANT VISIT QUEUE ═══ */}
      {activeInstantVisit && (
        <InstantVisitQueueModal
          isOpen={isQueueModalOpen}
          patient={{
            id: activeInstantVisit.patient_id || '',
            appointmentId: activeInstantVisit.id,
            name: `${activeInstantVisit.patients?.first_name || ''} ${activeInstantVisit.patients?.last_name || ''}`.trim() || 'Unknown Patient',
            email: activeInstantVisit.patients?.email || '',
            phone: activeInstantVisit.patients?.phone || '',
            reason: getAppointmentReason(activeInstantVisit),
            visitType: (activeInstantVisit.visit_type === 'video' ? 'video' : 'phone') as 'video' | 'phone',
            position: instantVisitQueue.findIndex(apt => apt.id === activeInstantVisit.id) + 1,
            totalInQueue: instantVisitQueue.length,
            estimatedWait: (instantVisitQueue.findIndex(apt => apt.id === activeInstantVisit.id) + 1) * 5,
            paidAt: activeInstantVisit.created_at ? new Date(activeInstantVisit.created_at) : new Date(),
          }}
          onClose={() => setIsQueueModalOpen(false)}
          onStartCall={handleStartCall}
          onComplete={handleCompleteInstantVisit}
          onCancel={handleCancelInstantVisit}
        />
      )}
    </div>
  )
}
