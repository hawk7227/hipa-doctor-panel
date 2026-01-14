'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, Appointment } from '@/lib/supabase'
import { sendAppointmentStatusEmail } from '@/lib/email'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog'
import InstantVisitQueueModal from '@/components/InstantVisitQueueModal'
import '../availability/availability.css'

function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  
  // Get the date/time components in the doctor's timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  const hour = parseInt(getValue('hour'))
  const minute = parseInt(getValue('minute'))
  const second = parseInt(getValue('second'))
  
  const converted = new Date(Date.UTC(year, month, day, hour, minute, second))
  
  return converted
}

function getDateString(date: Date, timezone?: string): string {
  if (timezone) {
    // When timezone is provided, the date should be from convertToTimezone which returns
    // a Date with UTC values representing the timezone's local time.
    // We use UTC methods to extract the date components.
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // Fallback to UTC date string
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to create a time slot explicitly as Phoenix time
// This ensures time slots represent Phoenix time regardless of browser timezone
function createPhoenixTimeSlot(hour: number, minute: number): Date {
  // Get today's date in Phoenix timezone
  const today = new Date()
  const phoenixFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = phoenixFormatter.formatToParts(today)
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  
  // Create a UTC Date representing this Phoenix time
  // This creates a Date where UTC values represent Phoenix local time
  return new Date(Date.UTC(year, month, day, hour, minute, 0))
}

interface ClinicalNote {
  id: string
  note_type: string
  content: string | null
}

interface CalendarAppointment extends Omit<Appointment, 'patients' | 'requested_date_time' | 'visit_type'> {
  requested_date_time: string | null // Override to match AppointmentDetailModal type (was string | undefined)
  visit_type: string | null // Override to match AppointmentDetailModal type (was 'async' | 'video' | 'phone' | undefined)
  patients?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    chief_complaint?: string | null
  } | null
  doctors?: {
    timezone: string
  }
  // Clinical notes joined from clinical_notes table
  clinical_notes?: ClinicalNote[] | null
  // Additional fields from appointments table (fetched with *)
  subjective_notes?: string | null
  chief_complaint?: string | null
  reason?: string | null
}

type ViewType = 'calendar' | 'list'

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('calendar')
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null)
  const [calendarViewType, setCalendarViewType] = useState<'week' | 'month' | '3month'>('week')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null)
  const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null)
  const [followUpPatientData, setFollowUpPatientData] = useState<{
    id: string
    first_name: string
    last_name: string
    email: string
    mobile_phone: string
  } | null>(null)
  const [instantVisitQueue, setInstantVisitQueue] = useState<CalendarAppointment[]>([])
  const [activeInstantVisit, setActiveInstantVisit] = useState<CalendarAppointment | null>(null)
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false)

  useEffect(() => {
    fetchCurrentDoctor()
  }, [])

  // Calendar utility functions
  const getWeekDates = (date: Date) => {
    const start = new Date(date)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    start.setDate(diff)
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const dates = []
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(new Date(year, month, day))
    }
    return dates
  }

  const getThreeMonthDates = (date: Date) => {
    const dates: Date[] = []
    const startMonth = date.getMonth()
    const year = date.getFullYear()
    
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const currentMonth = new Date(year, startMonth + monthOffset, 1)
      const lastDay = new Date(year, startMonth + monthOffset + 1, 0)
      
      for (let day = 1; day <= lastDay.getDate(); day++) {
        dates.push(new Date(year, startMonth + monthOffset, day))
      }
    }
    return dates
  }

  const getVisibleDates = () => {
    if (calendarViewType === 'week') {
      return getWeekDates(currentDate)
    } else if (calendarViewType === 'month') {
      return getMonthDates(currentDate)
    } else {
      return getThreeMonthDates(currentDate)
    }
  }

  // Memoize time slots to avoid recreating on every render
  // CRITICAL: Create time slots explicitly as Phoenix time, not browser local time
  // This ensures the calendar works correctly regardless of where the doctor views it from
  const timeSlots = useMemo(() => {
    const slots = []
    // Start from 5:00 AM to catch early morning appointments
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Create time slot explicitly as Phoenix time
        const time = createPhoenixTimeSlot(hour, minute)
        slots.push(time)
      }
    }
    return slots
  }, [])

  const formatTime = (date: Date) => {
    // CRITICAL: Time slots are now Phoenix time (UTC values representing Phoenix local time)
    // Use UTC methods to extract hour/minute since they represent Phoenix time
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${period}`
  }

  // Helper function to get the actual appointment time from appointment object
  // Uses UTC methods since convertToTimezone stores doctor's local time in UTC values
  const getAppointmentActualTime = (appointment: CalendarAppointment): string => {
    if (!appointment.requested_date_time) return ''
    
    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
    const doctorTimezone = 'America/Phoenix'
    const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
    
    // Use UTC methods since convertToTimezone returns UTC values that represent doctor's local time
    const hours = appointmentDate.getUTCHours()
    const minutes = appointmentDate.getUTCMinutes()
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    
    return `${displayHours}:${displayMinutes} ${period}`
  }

  // Helper function to get the reason from clinical_notes table
  const getAppointmentReason = (appointment: CalendarAppointment): string => {
    // First check clinical_notes for chief_complaint or subjective notes
    if (appointment.clinical_notes && appointment.clinical_notes.length > 0) {
      // Look for chief_complaint or subjective note type
      const reasonNote = appointment.clinical_notes.find(
        note => note.note_type === 'chief_complaint' || note.note_type === 'subjective'
      )
      if (reasonNote?.content) {
        return reasonNote.content
      }
    }
    
    // Fallback to other fields
    return appointment.chief_complaint || 
           appointment.patients?.chief_complaint || 
           appointment.reason || 
           ''
  }

  // Helper function to round a time to the nearest 30-minute slot
  const roundToNearestSlot = (appointmentDate: Date): Date => {
    const rounded = new Date(appointmentDate)
    // Use UTC methods since convertToTimezone returns UTC dates
    const minutes = appointmentDate.getUTCMinutes()
    const hours = appointmentDate.getUTCHours()
    
    // Round to nearest 30-minute slot (:00 or :30)
    if (minutes < 15) {
      rounded.setUTCMinutes(0, 0, 0)
      rounded.setUTCHours(hours)
    } else if (minutes < 45) {
      rounded.setUTCMinutes(30, 0, 0)
      rounded.setUTCHours(hours)
    } else {
      rounded.setUTCMinutes(0, 0, 0)
      rounded.setUTCHours(hours + 1)
    }
    
    return rounded
  }

  // Create a memoized appointment lookup map for O(1) access
  const appointmentMap = useMemo(() => {
    const map = new Map<string, CalendarAppointment>()
    
    appointments.forEach(appointment => {
      if (!appointment.requested_date_time) {
        return
      }
      
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
      // All appointments are stored in Phoenix time, so we always use Phoenix for display
      const doctorTimezone = 'America/Phoenix'
      // Convert the UTC date to Phoenix timezone first
      const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
      // Get date string from the converted date (which has UTC values representing Phoenix local time)
      const dateStr = getDateString(appointmentDate, doctorTimezone)
      const roundedSlot = roundToNearestSlot(appointmentDate)
      
      // Extract hour and minute from the rounded slot in doctor's timezone
      // Since convertToTimezone returns a Date with UTC values representing doctor's local time,
      // we use UTC methods to get the hour/minute
      const hour = roundedSlot.getUTCHours()
      const minute = roundedSlot.getUTCMinutes()
      const key = `${dateStr}_${hour}_${minute}`
      
      map.set(key, appointment)
    })
    
    return map
  }, [appointments])

  const getAppointmentForSlot = useCallback((date: Date, time: Date) => {
    // The calendar displays dates and time slots (5:00 AM - 8:00 PM) which represent
    // the doctor's timezone hours. CRITICAL: Provider timezone is ALWAYS America/Phoenix
    const doctorTimezone = 'America/Phoenix'
    
    // Convert the date to Phoenix timezone first (matching how appointments are mapped)
    const dateInPhoenix = convertToTimezone(date.toISOString(), doctorTimezone)
    // Format the date string from the converted date (which has UTC values representing Phoenix local time)
    const slotDateStr = getDateString(dateInPhoenix, doctorTimezone)
    
    // CRITICAL: Time slots are now created explicitly as Phoenix time using createPhoenixTimeSlot()
    // This means time.getUTCHours() and time.getUTCMinutes() already represent Phoenix time
    // (since createPhoenixTimeSlot creates a UTC Date representing Phoenix local time)
    const hour = time.getUTCHours()
    const minute = time.getUTCMinutes()
    
    const key = `${slotDateStr}_${hour}_${minute}`
    
    const found = appointmentMap.get(key) || null
    
    return found
  }, [appointmentMap, appointments])

  // Memoize visible dates - must be before any conditional returns
  const visibleDates = useMemo(() => {
    if (calendarViewType === 'week') {
      return getWeekDates(currentDate)
    } else if (calendarViewType === 'month') {
      return getMonthDates(currentDate)
    } else {
      return getThreeMonthDates(currentDate)
    }
  }, [currentDate, calendarViewType])

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (calendarViewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (calendarViewType === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (calendarViewType === '3month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3))
    }
    setCurrentDate(newDate)
  }

  const fetchCurrentDoctor = async () => {
    try {
      // Get the current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.error('No authenticated user found')
        setLoading(false)
        return
      }

      // Get the doctor record associated with this user's email
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single()

      if (error) {
        console.error('Error fetching doctor:', error)
        setLoading(false)
        return
      }

      if (doctor) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Current doctor ID:', doctor.id)
        }
        setCurrentDoctorId(doctor.id)
        // Fetch appointments for this doctor
        fetchAppointments(doctor.id)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching current doctor:', error)
      }
      setLoading(false)
    }
  }

  const fetchAppointments = useCallback(async (doctorId: string, skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true)
      }
      
      // Fetch appointments excluding cancelled - use * to get all fields for type safety
      // Include clinical_notes to get the reason/subjective notes
      const { data, error } = await supabase
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

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error fetching appointments:', error)
        }
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📅 Fetched appointments:', data?.length || 0)
        if (data && data.length > 0) {
          console.log('📅 Sample appointment:', {
            id: data[0].id,
            requested_date_time: data[0].requested_date_time,
            status: data[0].status,
            doctor_id: data[0].doctor_id,
            patient_name: `${data[0].patients?.first_name} ${data[0].patients?.last_name}`
          })
        }
      }

      // Update state immediately - cast to fix type issues with Supabase relations
      setAppointments((data || []) as any)
    } catch (error) {
      console.error('❌ Error fetching appointments:', error)
    } finally {
      if (!skipLoading) {
        setLoading(false)
      }
    }
  }, [])

  // Detect instant visits and manage queue
  useEffect(() => {
    if (!currentDoctorId) return

    const instantVisits = appointments.filter(apt => 
      apt.visit_type === 'instant' && 
      apt.status !== 'completed' && 
      apt.status !== 'cancelled'
    )

    setInstantVisitQueue(instantVisits)

    // Auto-open modal if there's a new instant visit and none is active
    if (instantVisits.length > 0 && !activeInstantVisit) {
      setActiveInstantVisit(instantVisits[0])
      setIsQueueModalOpen(true)
    }
  }, [appointments, currentDoctorId, activeInstantVisit])

  // Real-time subscription for instant visits
  useEffect(() => {
    if (!currentDoctorId) return

    const channel = supabase
      .channel('instant-visits-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${currentDoctorId}`
        },
        (payload) => {
          const newAppointment = payload.new as CalendarAppointment
          
          // Check if it's an instant visit
          if (newAppointment.visit_type === 'instant' && 
              newAppointment.status !== 'completed' && 
              newAppointment.status !== 'cancelled') {
            
            // Refresh appointments to get full data (including patient info)
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId, true)
            }
            
            // Show notification
            setNotification({
              type: 'success',
              message: `⚡ New instant visit: ${newAppointment.patients?.first_name || 'Patient'} ${newAppointment.patients?.last_name || ''}`
            })
            setTimeout(() => setNotification(null), 5000)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${currentDoctorId}`
        },
        (payload) => {
          const updatedAppointment = payload.new as CalendarAppointment
          
          // If instant visit was completed or cancelled, refresh
          if (updatedAppointment.visit_type === 'instant' && 
              (updatedAppointment.status === 'completed' || updatedAppointment.status === 'cancelled')) {
            if (currentDoctorId) {
              fetchAppointments(currentDoctorId, true)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentDoctorId, fetchAppointments])

  // Handler functions for instant visit queue
  const handleStartCall = async (appointmentId: string) => {
    // Find appointment and open Zoom if available
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (appointment?.zoom_meeting_url) {
      window.open(appointment.zoom_meeting_url, '_blank')
    } else {
      setNotification({
        type: 'error',
        message: 'No Zoom meeting link available for this appointment'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleCompleteInstantVisit = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId)

      if (error) throw error

      setNotification({
        type: 'success',
        message: 'Instant visit completed'
      })
      setTimeout(() => setNotification(null), 5000)

      // Close modal and refresh
      setIsQueueModalOpen(false)
      setActiveInstantVisit(null)
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error completing visit:', error)
      setNotification({
        type: 'error',
        message: 'Failed to complete visit'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleCancelInstantVisit = async (appointmentId: string) => {
    if (!confirm('Remove this patient from the instant visit queue?')) return

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)

      if (error) throw error

      setNotification({
        type: 'success',
        message: 'Patient removed from queue'
      })
      setTimeout(() => setNotification(null), 5000)

      // Close modal and refresh
      setIsQueueModalOpen(false)
      setActiveInstantVisit(null)
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error cancelling visit:', error)
      setNotification({
        type: 'error',
        message: 'Failed to remove patient'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleAppointmentAction = async (appointmentId: string, action: 'accept' | 'reject' | 'complete') => {
    try {
      if (action === 'complete') {
        // Handle completion separately (no payment/email needed)
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)

        if (error) {
          console.error('Error updating appointment:', error)
          setNotification({
            type: 'error',
            message: 'Failed to mark appointment as complete'
          })
          setTimeout(() => setNotification(null), 5000)
          return
        }

        setNotification({
          type: 'success',
          message: 'Appointment marked as complete'
        })
        setTimeout(() => setNotification(null), 5000)
        if (currentDoctorId) fetchAppointments(currentDoctorId)
        return
      }

      // Handle accept/reject with payment and email
      const endpoint = action === 'accept' ? '/api/appointments/accept' : '/api/appointments/reject'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          reason: action === 'reject' ? 'Doctor unavailable at this time' : undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setNotification({
          type: 'error',
          message: result.error || `Failed to ${action} appointment`
        })
        setTimeout(() => setNotification(null), 5000)
        return
      }

      // Show success message with details
      let successMessage = `Appointment ${action}ed successfully`
      
      if (action === 'accept') {
        if (result.data.paymentCaptured) {
          successMessage += ' • Payment captured'
        }
        if (result.data.zoomMeeting) {
          successMessage += ' • Zoom meeting created'
        }
      } else if (action === 'reject') {
        if (result.data.paymentRefunded) {
          successMessage += ` • Payment refunded ($${(result.data.refundAmount / 100).toFixed(2)})`
        }
      }

      setNotification({
        type: 'success',
        message: successMessage
      })
      setTimeout(() => setNotification(null), 5000)

      // Refresh appointments
      if (currentDoctorId) fetchAppointments(currentDoctorId)
    } catch (error) {
      console.error('Error updating appointment:', error)
      setNotification({
        type: 'error',
        message: 'An unexpected error occurred'
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const gridCols = calendarViewType === 'week' ? 'grid-cols-7' : calendarViewType === 'month' ? 'grid-cols-7' : 'grid-cols-7'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="w-12 h-12 border-b-2 border-teal-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="availability-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Full Screen Calendar Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        {viewType === 'calendar' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
          {calendarViewType === 'week' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%' }}>
              {/* Week Calendar Grid - Using availability page structure */}
              <div className="availability-cal" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Header Row */}
                <div className="availability-cal-row" style={{ borderBottom: '2px solid var(--line)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div className="availability-dayhead" style={{ background: '#081226' }}>Time</div>
                  {visibleDates.map((date, idx) => (
                    <div key={`header-${idx}`} className="availability-dayhead">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })} {date.getDate()}
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {timeSlots.map((time, timeIndex) => (
                  <div key={`row-${timeIndex}`} className="availability-cal-row">
                    <div className="availability-time">{formatTime(time)}</div>
                    {visibleDates.map((date, dayIndex) => {
                      const appointment = getAppointmentForSlot(date, time)
                      const isAvailable = !appointment
                      
                      return (
                        <div
                          key={`cell-${dayIndex}-${timeIndex}`}
                          className="availability-cell"
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedSlotDate(date)
                              setSelectedSlotTime(time)
                              setShowCreateDialog(true)
                            } else {
                              setSelectedAppointmentId(appointment.id)
                            }
                          }}
                        >
                          {isAvailable ? (
                            <div className="availability-event available">
                              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: 'white' }}>Available</div>
                              <small style={{ fontSize: '11px', opacity: 0.9, color: 'white' }}>{formatTime(time)}</small>
                            </div>
                          ) : (
                            <div className={`availability-event blocked ${appointment.visit_type || 'video'}`}>
                              <div className="appointment-name">
                                {appointment.patients?.first_name} {appointment.patients?.last_name}
                              </div>
                              <span className={`appointment-type-badge ${appointment.visit_type || 'video'}`}>
                                {appointment.visit_type === 'instant' ? '⚡ INSTANT' :
                                 appointment.visit_type === 'video' ? 'VIDEO' :
                                 appointment.visit_type === 'phone' ? 'PHONE' :
                                 appointment.visit_type === 'async' ? 'ASYNC' : 'VISIT'}
                              </span>
                              {(() => {
                                const reason = getAppointmentReason(appointment)
                                if (!reason) return null
                                const words = reason.trim().split(/\s+/)
                                const shortReason = words.slice(0, 2).join(' ')
                                return (
                                  <div className="appointment-reason">
                                    {shortReason}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="availability-hint" style={{ marginTop: '8px' }}>
                Tip: Click a slot to schedule or view appointment details.
              </div>
            </div>
          ) : calendarViewType === 'month' ? (
            /* Month View - Using availability page structure */
            <div>
              <div className="availability-month">
                {visibleDates.map((date, index) => {
                  const dayAppointments = appointments.filter(apt => {
                    if (!apt.requested_date_time) return false
                    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
                    const doctorTimezone = 'America/Phoenix'
                    const aptDate = convertToTimezone(apt.requested_date_time, doctorTimezone)
                    const aptDateStr = getDateString(aptDate, doctorTimezone)
                    const calendarDateStr = getDateString(date, doctorTimezone)
                    return aptDateStr === calendarDateStr
                  })
                  
                  return (
                    <div
                      key={index}
                      className="availability-mcell"
                      data-day={date.getDate()}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="availability-d">{date.getDate()}</div>
                      {dayAppointments.map((apt) => (
                        <span
                          key={apt.id}
                          className={`availability-tag ${
                            apt.visit_type === 'video' ? 'g' :
                            apt.visit_type === 'phone' ? 'a' :
                            apt.visit_type === 'async' ? 'h' :
                            apt.visit_type === 'instant' ? 'instant' : 'b'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAppointmentId(apt.id)
                          }}
                          style={{ cursor: 'pointer' }}
                          title={`${apt.patients?.first_name} ${apt.patients?.last_name} - ${getAppointmentActualTime(apt)}`}
                        >
                          {apt.patients?.first_name} {apt.patients?.last_name?.charAt(0)}. • {apt.visit_type || 'Visit'}
                        </span>
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="availability-hint" style={{ marginTop: '8px' }}>
                Tip: Click a day to view or schedule appointments.
              </div>
            </div>
          ) : (
            <div className="availability-hint">3-Month view (to be implemented)</div>
          )}
          </div>
        ) : (
          /* List View - Using availability page structure */
          <div className="availability-card">
            <table className="availability-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', background: '#0a1732', color: '#cfe1ff' }}>Patient</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', background: '#0a1732', color: '#cfe1ff' }}>Date & Time</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', background: '#0a1732', color: '#cfe1ff' }}>Type</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', background: '#0a1732', color: '#cfe1ff' }}>Reason</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', background: '#0a1732', color: '#cfe1ff' }}>Contact</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length > 0 ? (
                  appointments.map((apt) => {
                    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
                    const doctorTimezone = 'America/Phoenix'
                    const aptDate = apt.requested_date_time 
                      ? convertToTimezone(apt.requested_date_time, doctorTimezone)
                      : null
                    
                    return (
                      <tr
                        key={apt.id}
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                        onClick={() => setSelectedAppointmentId(apt.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#0d1628' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '8px 10px', color: '#e6f4ff' }}>
                          <div style={{ fontWeight: 'bold' }}>
                            {apt.patients?.first_name || ''} {apt.patients?.last_name || ''}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#98b1c9' }}>
                          {aptDate ? (
                            <>
                              {aptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' • '}
                              {aptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span 
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              borderRadius: '8px',
                              fontWeight: 'bold',
                              background: apt.visit_type === 'video' ? 'rgba(0, 230, 255, 0.12)' :
                                         apt.visit_type === 'phone' ? 'rgba(0, 194, 110, 0.12)' :
                                         apt.visit_type === 'async' ? 'rgba(176, 122, 255, 0.12)' :
                                         apt.visit_type === 'instant' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.08)',
                              color: apt.visit_type === 'video' ? '#00e6ff' :
                                     apt.visit_type === 'phone' ? '#00c26e' :
                                     apt.visit_type === 'async' ? '#b07aff' :
                                     apt.visit_type === 'instant' ? '#f59e0b' : '#f0d7dc'
                            }}
                          >
                            {apt.visit_type === 'instant' ? '⚡ Instant' :
                             apt.visit_type === 'video' ? 'Video' :
                             apt.visit_type === 'phone' ? 'Phone' :
                             apt.visit_type === 'async' ? 'Async' : 'Visit'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#98b1c9', fontSize: '14px' }}>
                          {getAppointmentReason(apt) || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#98b1c9', fontSize: '14px' }}>
                          <div>{apt.patients?.email || '—'}</div>
                          <div style={{ fontSize: '12px' }}>{apt.patients?.phone || ''}</div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#98b1c9' }}>
                      No appointments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notification - Styled to match availability page theme */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            maxWidth: '400px',
            borderRadius: '12px',
            padding: '16px',
            zIndex: 9999,
            boxShadow: '0 12px 60px rgba(0,0,0,.45)',
            background: notification.type === 'success' ? '#0e2a1c' : '#2a1417',
            border: notification.type === 'success' ? '1px solid #1e5a3a' : '1px solid #5a2a32',
            color: notification.type === 'success' ? '#cde7da' : '#f0d7dc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <div>
              {notification.type === 'success' ? (
                <svg style={{ width: '20px', height: '20px', color: '#19d67f' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg style={{ width: '20px', height: '20px', color: '#E53935' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '600' }}>{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'inherit',
                opacity: 0.7
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      <AppointmentDetailModal 
        appointmentId={selectedAppointmentId}
        isOpen={!!selectedAppointmentId}
        appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
        currentDate={currentDate}
        onClose={() => setSelectedAppointmentId(null)}
        onStatusChange={() => {
          // Trigger refresh immediately without blocking (skip loading state for faster update)
          if (currentDoctorId) {
            fetchAppointments(currentDoctorId, true) // Skip loading state for instant refresh
          }
        }}
        onAppointmentSwitch={(appointmentId) => {
          setSelectedAppointmentId(appointmentId)
        }}
        onFollowUp={(patientData, date, time) => {
          setFollowUpPatientData(patientData)
          setSelectedSlotDate(date)
          setSelectedSlotTime(time)
          setShowCreateDialog(true)
          setSelectedAppointmentId(null) // Close appointment detail modal
        }}
        onSmsSent={(message) => {
          setNotification({
            type: 'success',
            message: message
          })
          setTimeout(() => setNotification(null), 5000)
        }}
      />

      {/* Create Appointment Dialog */}
      {currentDoctorId && selectedSlotDate && selectedSlotTime && (
        <CreateAppointmentDialog
          isOpen={showCreateDialog}
          appointments={appointments.map(apt => ({ ...apt, requested_date_time: apt.requested_date_time ?? null })) as any}
          onClose={() => {
            setShowCreateDialog(false)
            setSelectedSlotDate(null)
            setSelectedSlotTime(null)
            setFollowUpPatientData(null)
          }}
          onSuccess={async () => {
            if (currentDoctorId) {
              await fetchAppointments(currentDoctorId)
            }
            setFollowUpPatientData(null)
          }}
          doctorId={currentDoctorId}
          selectedDate={selectedSlotDate}
          selectedTime={selectedSlotTime}
          patientData={followUpPatientData}
        />
      )}

      {/* Instant Visit Queue Modal */}
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
            paidAt: activeInstantVisit.created_at ? new Date(activeInstantVisit.created_at) : new Date()
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

