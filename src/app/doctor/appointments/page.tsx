'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  chart_locked: boolean | null
}

type ViewType = 'calendar' | 'list'

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    searchParams.get('apt') || null
  )

  // Sync selectedAppointmentId to URL so refresh preserves the open chart
  useEffect(() => {
    const currentApt = searchParams.get('apt') || null
    if (selectedAppointmentId !== currentApt) {
      const url = new URL(window.location.href)
      if (selectedAppointmentId) {
        url.searchParams.set('apt', selectedAppointmentId)
      } else {
        url.searchParams.delete('apt')
      }
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [selectedAppointmentId])
  
  // Initialize currentDate based on Phoenix timezone
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    const phoenixFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const phoenixStr = phoenixFormatter.format(now)
    const [month, day, year] = phoenixStr.split('/').map(Number)
    console.log('🗓️ Initializing calendar to Phoenix date:', month, '/', day, '/', year)
    return new Date(year, month - 1, day, 12, 0, 0) // Use noon to avoid DST issues
  })
  
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

  // ============================================
  // CELEBRATION STATE - FRONTEND ONLY (Added)
  // ============================================
  const [showWelcome, setShowWelcome] = useState(false)
  const [particles, setParticles] = useState<Array<{id: number, x: number, color: string, size: number, duration: number, delay: number, shape: string}>>([])
  const [confetti, setConfetti] = useState<Array<{id: number, x: number, color: string, delay: number}>>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showEffects, setShowEffects] = useState(true) // Toggle for particles/confetti
  const [currentPhoenixTime, setCurrentPhoenixTime] = useState<{hour: number, minute: number, formatted: string, dateStr: string}>({ hour: 0, minute: 0, formatted: '', dateStr: '' })
  const celebrationTriggeredRef = useRef(false)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const currentTimeRowRef = useRef<HTMLDivElement>(null)

  // Update current Phoenix time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      
      // Get Phoenix date
      const phoenixDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Phoenix',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
      const phoenixDateStr = phoenixDateFormatter.format(now)
      
      // Get Phoenix time in 24-hour format for calculations
      const phoenixTime24 = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Phoenix',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).format(now)
      const [hour24, minute] = phoenixTime24.split(':').map(Number)
      
      // Also get the 12-hour formatted time for display
      const phoenixTimeFormatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Phoenix',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(now)
      
      setCurrentPhoenixTime({ hour: hour24, minute, formatted: phoenixTimeFormatted, dateStr: phoenixDateStr })
      console.log('🕐 Phoenix NOW:', phoenixDateStr, phoenixTimeFormatted, '(24h:', hour24 + ':' + String(minute).padStart(2, '0') + ')')
    }
    
    updateTime() // Run immediately
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Generate particles IMMEDIATELY on mount (no waiting for loading)
  useEffect(() => {
    const colors = ['#00ff88', '#00f5ff', '#ff00ff', '#ffff00', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff0080', '#00ffcc']
    const shapes = ['circle', 'square', 'diamond']
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 16 + 8,
      duration: Math.random() * 12 + 8,
      delay: Math.random() * 8,
      shape: shapes[Math.floor(Math.random() * shapes.length)]
    }))
    setParticles(newParticles)
    console.log('🎉 Particles generated:', newParticles.length)
  }, [])

  useEffect(() => {
    fetchCurrentDoctor()
  }, [])

  // ============================================
  // CELEBRATION EFFECT - FRONTEND ONLY (Added)
  // ============================================
  useEffect(() => {
    if (!loading && !celebrationTriggeredRef.current) {
      celebrationTriggeredRef.current = true
      console.log('🎊 Celebration triggered!')
      
      // Generate confetti burst
      const confettiColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff6600', '#9933ff', '#00ff88', '#ff0080']
      const newConfetti = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        delay: Math.random() * 3
      }))
      setConfetti(newConfetti)
      console.log('🎊 Confetti generated:', newConfetti.length)
      
      // Show welcome banner immediately
      setShowWelcome(true)
      
      // Play celebration sound (may be blocked by browser autoplay policy)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const playNote = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.2, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
          osc.start(startTime)
          osc.stop(startTime + duration)
        }
        const now = ctx.currentTime
        playNote(523.25, now, 0.15)        // C5
        playNote(659.25, now + 0.1, 0.15)  // E5
        playNote(783.99, now + 0.2, 0.2)   // G5
        playNote(1046.50, now + 0.35, 0.3) // C6
        setSoundEnabled(true)
      } catch (e) {
        console.log('Audio blocked - will play on first click')
      }
      
      // Auto-hide welcome and confetti
      setTimeout(() => setShowWelcome(false), 10000)
      setTimeout(() => setConfetti([]), 6000)
    }
  }, [loading])

  // ============================================
  // AUTO-SCROLL TO CURRENT TIME - FRONTEND ONLY
  // ============================================
  useEffect(() => {
    if (!loading && calendarScrollRef.current && currentPhoenixTime.hour > 0) {
      // Wait a bit for DOM to render
      setTimeout(() => {
        if (currentTimeRowRef.current) {
          currentTimeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
          console.log('📍 Auto-scrolled to current time row')
        }
      }, 800)
    }
  }, [loading, currentPhoenixTime.hour])

  // Check if a time slot is the current time slot
  const isCurrentTimeSlot = useCallback((time: Date) => {
    const { hour, minute } = currentPhoenixTime
    const slotHour = time.getUTCHours()
    const slotMinute = time.getUTCMinutes()
    // Match if within the same 30-minute slot
    if (slotHour === hour) {
      if (minute < 30 && slotMinute === 0) return true
      if (minute >= 30 && slotMinute === 30) return true
    }
    return false
  }, [currentPhoenixTime])

  // Check if a date is today (in Phoenix timezone)
  const isToday = useCallback((date: Date) => {
    // Get today in Phoenix timezone using the server/client time
    const now = new Date()
    const phoenixFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const phoenixTodayStr = phoenixFormatter.format(now)
    const [todayMonth, todayDay, todayYear] = phoenixTodayStr.split('/').map(Number)
    
    // The calendar date is a local Date object
    const calMonth = date.getMonth() + 1
    const calDay = date.getDate()
    const calYear = date.getFullYear()
    
    const isMatch = calYear === todayYear && calMonth === todayMonth && calDay === todayDay
    
    // Debug logging
    console.log('📍 isToday check:', {
      phoenixToday: `${todayMonth}/${todayDay}/${todayYear}`,
      calendarDate: `${calMonth}/${calDay}/${calYear}`,
      isMatch
    })
    
    return isMatch
  }, [])

  // Go to today (in Phoenix timezone)
  const goToToday = () => {
    const now = new Date()
    const phoenixFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const phoenixStr = phoenixFormatter.format(now)
    const [month, day, year] = phoenixStr.split('/').map(Number)
    const phoenixDate = new Date(year, month - 1, day, 12, 0, 0)
    console.log('📍 Going to Phoenix today:', month, '/', day, '/', year)
    setCurrentDate(phoenixDate)
    // Scroll to current time after state update
    setTimeout(() => {
      if (currentTimeRowRef.current) {
        currentTimeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  // Toggle effects (particles + confetti)
  const toggleEffects = () => {
    setShowEffects(!showEffects)
    if (!showEffects) {
      // Re-generate particles when turning back on
      const colors = ['#00ff88', '#00f5ff', '#ff00ff', '#ffff00', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff0080', '#00ffcc']
      const shapes = ['circle', 'square', 'diamond']
      const newParticles = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 16 + 8,
        duration: Math.random() * 12 + 8,
        delay: Math.random() * 8,
        shape: shapes[Math.floor(Math.random() * shapes.length)]
      }))
      setParticles(newParticles)
    }
  }

  // ============================================
  // SOUND EFFECTS - FRONTEND ONLY (Added)
  // ============================================
  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // If first sound, play celebration chime!
      if (!soundEnabled) {
        setSoundEnabled(true)
        const playNote = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.2, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
          osc.start(startTime)
          osc.stop(startTime + duration)
        }
        const now = ctx.currentTime
        playNote(523.25, now, 0.15)
        playNote(659.25, now + 0.1, 0.15)
        playNote(783.99, now + 0.2, 0.2)
        playNote(1046.50, now + 0.35, 0.3)
      } else {
        // Normal click sound
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.08)
      }
    } catch (e) {}
  }

  const playHoverSound = () => {
    if (!soundEnabled) return // Don't play hover until first click
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1200
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.04)
    } catch (e) {}
  }

  const getWeekDates = (date: Date) => {
    // Use the passed date to calculate the week
    // The date passed is currentDate which represents what week we want to show
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    
    // Create a date for the start calculation
    const targetDate = new Date(year, month, day, 12, 0, 0) // Use noon to avoid DST issues
    
    // Calculate the Monday of the week containing this date
    const dayOfWeek = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Get to Monday
    
    const monday = new Date(targetDate)
    monday.setDate(targetDate.getDate() + mondayOffset)
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      dates.push(d)
    }
    
    console.log('📆 Showing week for date:', month + 1, '/', day, '/', year)
    console.log('📆 Week dates:', dates.map(d => `${d.getMonth()+1}/${d.getDate()}`).join(', '))
    
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
  // Normal doctor hours: 9 AM to 6 PM, but also include any appointment times outside this range
  const timeSlots = useMemo(() => {
    const slots: Date[] = []
    const hoursSet = new Set<string>()
    
    // Default doctor hours: 9 AM to 6 PM
    for (let hour = 9; hour <= 18; hour++) {
      hoursSet.add(`${hour}:0`)
      hoursSet.add(`${hour}:30`)
    }
    
    // Also include hours for any existing appointments outside normal hours
    if (appointments && appointments.length > 0) {
      appointments.forEach(apt => {
        if (apt.requested_date_time) {
          try {
            const aptDate = convertToTimezone(apt.requested_date_time, 'America/Phoenix')
            const aptHour = aptDate.getUTCHours()
            const aptMinute = aptDate.getUTCMinutes() < 30 ? 0 : 30
            
            // Add this slot
            hoursSet.add(`${aptHour}:${aptMinute}`)
            
            // Add surrounding slots for context
            if (aptMinute === 0 && aptHour > 0) {
              hoursSet.add(`${aptHour - 1}:30`)
            }
            if (aptMinute === 30 && aptHour < 23) {
              hoursSet.add(`${aptHour + 1}:0`)
            }
          } catch (e) {
            console.error('Error processing appointment time:', e)
          }
        }
      })
    }
    
    // Convert to sorted array and create time slots
    const sortedHours = Array.from(hoursSet)
      .map(h => {
        const [hour, minute] = h.split(':').map(Number)
        return { hour, minute }
      })
      .filter(h => h.hour >= 0 && h.hour <= 23)
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    
    sortedHours.forEach(({ hour, minute }) => {
      const time = createPhoenixTimeSlot(hour, minute)
      slots.push(time)
    })
    
    console.log('📅 Time slots generated:', sortedHours.length, 'slots from', sortedHours[0]?.hour + ':' + sortedHours[0]?.minute, 'to', sortedHours[sortedHours.length-1]?.hour + ':' + sortedHours[sortedHours.length-1]?.minute)
    
    return slots
  }, [appointments])

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

  // Count today's appointments for welcome banner
  const todayAppointmentsCount = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return appointments.filter(apt => {
      if (!apt.requested_date_time) return false
      const aptDate = convertToTimezone(apt.requested_date_time, 'America/Phoenix')
      const aptDateStr = getDateString(aptDate, 'America/Phoenix')
      return aptDateStr === todayStr
    }).length
  }, [appointments])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="w-12 h-12 border-b-2 border-teal-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <>
      {/* ============================================ */}
      {/* CELEBRATION STYLES - FRONTEND ONLY (Added) */}
      {/* ============================================ */}
      <style>{`
        .particles-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9997;
          overflow: hidden;
        }
        .particle {
          position: absolute;
          bottom: -50px;
          border-radius: 50%;
          animation: floatParticle linear infinite;
          opacity: 0.9;
          box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
          filter: brightness(1.5);
        }
        .particle.square {
          border-radius: 4px;
          transform: rotate(45deg);
        }
        .particle.diamond {
          border-radius: 2px;
          transform: rotate(45deg);
        }
        @keyframes floatParticle {
          0% { 
            transform: translateY(0) rotate(0deg); 
            opacity: 0; 
          }
          5% { 
            opacity: 0.8; 
          }
          95% { 
            opacity: 0.6; 
          }
          100% { 
            transform: translateY(-110vh) rotate(720deg); 
            opacity: 0; 
          }
        }
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9998;
          overflow: hidden;
        }
        .confetti-piece {
          position: absolute;
          top: -20px;
          width: 12px;
          height: 24px;
          animation: confettiFall 4s ease-out forwards;
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotateZ(0deg) rotateY(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotateZ(720deg) rotateY(360deg); opacity: 0; }
        }
        .welcome-banner {
          position: fixed;
          top: 80px;
          right: 20px;
          background: linear-gradient(135deg, rgba(0, 200, 100, 0.95), rgba(20, 184, 166, 0.95));
          border-radius: 16px;
          padding: 20px 24px;
          z-index: 9999;
          box-shadow: 0 20px 60px rgba(0, 200, 100, 0.4), 0 0 40px rgba(20, 184, 166, 0.3);
          animation: welcomeSlideIn 0.5s ease-out, welcomePulse 2s ease-in-out infinite;
          max-width: 380px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        @keyframes welcomeSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes welcomePulse {
          0%, 100% { box-shadow: 0 20px 60px rgba(0, 200, 100, 0.4), 0 0 40px rgba(20, 184, 166, 0.3); }
          50% { box-shadow: 0 20px 80px rgba(0, 200, 100, 0.6), 0 0 60px rgba(20, 184, 166, 0.5); }
        }
        .welcome-icon {
          width: 50px;
          height: 50px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          animation: iconBounce 1s ease infinite;
        }
        @keyframes iconBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .welcome-close {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          color: #fff;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .welcome-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .availability-page {
          background: linear-gradient(-45deg, #0a0a1a, #1a0a2e, #0a1a2e, #0a0a1a) !important;
          background-size: 400% 400% !important;
          animation: gradientShift 15s ease infinite !important;
        }

        /* ============================================ */
        /* BRIGHT CALENDAR GRID STYLES - Visual Only */
        /* ============================================ */
        
        /* Bright header row */
        .availability-dayhead {
          background: linear-gradient(180deg, rgba(0, 245, 255, 0.15), rgba(20, 184, 166, 0.1)) !important;
          color: #00f5ff !important;
          text-shadow: 0 0 10px rgba(0, 245, 255, 0.5) !important;
          border-bottom: 2px solid rgba(0, 245, 255, 0.3) !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
        }

        /* Time column */
        .availability-time {
          color: #ff00ff !important;
          text-shadow: 0 0 10px rgba(255, 0, 255, 0.4) !important;
          font-weight: 600 !important;
        }

        /* Available slots - BRIGHT GREEN with glow */
        .availability-event.available {
          background: linear-gradient(135deg, rgba(0, 255, 100, 0.35), rgba(20, 255, 150, 0.25)) !important;
          border: 2px solid rgba(0, 255, 100, 0.6) !important;
          box-shadow: 0 0 20px rgba(0, 255, 100, 0.3), inset 0 0 20px rgba(0, 255, 100, 0.1) !important;
          animation: availablePulse 3s ease-in-out infinite !important;
          transition: all 0.3s ease !important;
        }

        @keyframes availablePulse {
          0%, 100% { 
            box-shadow: 0 0 15px rgba(0, 255, 100, 0.3), inset 0 0 15px rgba(0, 255, 100, 0.1);
            border-color: rgba(0, 255, 100, 0.5);
          }
          50% { 
            box-shadow: 0 0 30px rgba(0, 255, 100, 0.5), inset 0 0 25px rgba(0, 255, 100, 0.2);
            border-color: rgba(0, 255, 100, 0.8);
          }
        }

        .availability-event.available:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 0 40px rgba(0, 255, 100, 0.6), inset 0 0 30px rgba(0, 255, 100, 0.2) !important;
          border-color: #00ff64 !important;
        }

        /* Booked slots - Vibrant colors */
        .availability-event.blocked {
          transition: all 0.3s ease !important;
          box-shadow: 0 0 15px rgba(255, 100, 100, 0.3) !important;
        }

        .availability-event.blocked:hover {
          transform: scale(1.05) !important;
          z-index: 100 !important;
        }

        .availability-event.blocked.video {
          background: linear-gradient(135deg, rgba(0, 200, 255, 0.4), rgba(0, 150, 220, 0.3)) !important;
          border: 2px solid rgba(0, 220, 255, 0.6) !important;
          box-shadow: 0 0 20px rgba(0, 220, 255, 0.4) !important;
        }

        .availability-event.blocked.phone {
          background: linear-gradient(135deg, rgba(0, 255, 150, 0.4), rgba(0, 200, 100, 0.3)) !important;
          border: 2px solid rgba(0, 255, 150, 0.6) !important;
          box-shadow: 0 0 20px rgba(0, 255, 150, 0.4) !important;
        }

        .availability-event.blocked.async {
          background: linear-gradient(135deg, rgba(180, 100, 255, 0.4), rgba(150, 80, 220, 0.3)) !important;
          border: 2px solid rgba(180, 100, 255, 0.6) !important;
          box-shadow: 0 0 20px rgba(180, 100, 255, 0.4) !important;
        }

        .availability-event.blocked.instant {
          background: linear-gradient(135deg, rgba(255, 180, 0, 0.4), rgba(255, 150, 0, 0.3)) !important;
          border: 2px solid rgba(255, 180, 0, 0.6) !important;
          box-shadow: 0 0 20px rgba(255, 180, 0, 0.4) !important;
          animation: instantPulse 1.5s ease-in-out infinite !important;
        }

        @keyframes instantPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 180, 0, 0.4); }
          50% { box-shadow: 0 0 35px rgba(255, 180, 0, 0.7); }
        }

        /* Calendar cell hover */
        .availability-cell {
          transition: all 0.2s ease !important;
        }

        .availability-cell:hover {
          background: rgba(0, 245, 255, 0.05) !important;
        }

        /* Calendar grid lines - subtle glow */
        .availability-cal-row {
          border-bottom: 1px solid rgba(0, 245, 255, 0.1) !important;
        }

        /* Appointment name text */
        .appointment-name {
          color: #fff !important;
          font-weight: 700 !important;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.3) !important;
        }

        /* Type badges - brighter */
        .appointment-type-badge {
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 4px 10px !important;
          border-radius: 12px !important;
          font-size: 10px !important;
        }

        .appointment-type-badge.video {
          background: rgba(0, 220, 255, 0.3) !important;
          color: #00f5ff !important;
          box-shadow: 0 0 10px rgba(0, 220, 255, 0.4) !important;
        }

        .appointment-type-badge.phone {
          background: rgba(0, 255, 150, 0.3) !important;
          color: #00ff96 !important;
          box-shadow: 0 0 10px rgba(0, 255, 150, 0.4) !important;
        }

        .appointment-type-badge.async {
          background: rgba(180, 100, 255, 0.3) !important;
          color: #c896ff !important;
          box-shadow: 0 0 10px rgba(180, 100, 255, 0.4) !important;
        }

        /* Sparkle effect on hover for available slots */
        .availability-event.available::before {
          content: '✨';
          position: absolute;
          top: 5px;
          right: 8px;
          font-size: 14px;
          opacity: 0.8;
          animation: sparkle 2s ease-in-out infinite;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        /* Calendar container glow */
        .availability-cal {
          border: 1px solid rgba(0, 245, 255, 0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 0 40px rgba(0, 245, 255, 0.1), 0 0 80px rgba(20, 184, 166, 0.05) !important;
        }

        /* Scrollbar styling */
        .availability-page ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .availability-page ::-webkit-scrollbar-track {
          background: rgba(0, 20, 40, 0.5);
          border-radius: 5px;
        }
        .availability-page ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #00f5ff, #14b8a6);
          border-radius: 5px;
        }
        .availability-page ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #00ffff, #20d0b8);
        }

        /* ============================================ */
        /* CALENDAR HEADER BAR STYLES */
        /* ============================================ */
        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: linear-gradient(180deg, rgba(0, 20, 40, 0.95), rgba(10, 30, 50, 0.9));
          border-bottom: 2px solid rgba(0, 245, 255, 0.3);
          gap: 16px;
          flex-wrap: wrap;
        }

        .calendar-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .calendar-header-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .calendar-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .calendar-title {
          font-size: 20px;
          font-weight: 800;
          color: #00f5ff;
          text-shadow: 0 0 20px rgba(0, 245, 255, 0.5);
          margin: 0;
        }

        .calendar-date-display {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          padding: 6px 12px;
          background: rgba(0, 245, 255, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(0, 245, 255, 0.2);
        }

        .nav-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(0, 200, 150, 0.3), rgba(0, 150, 200, 0.3));
          border: 2px solid rgba(0, 245, 255, 0.4);
          border-radius: 8px;
          color: #00f5ff;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }

        .nav-btn:hover {
          background: linear-gradient(135deg, rgba(0, 200, 150, 0.5), rgba(0, 150, 200, 0.5));
          border-color: #00f5ff;
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
        }

        .nav-btn.active {
          background: linear-gradient(135deg, rgba(0, 255, 150, 0.4), rgba(0, 200, 255, 0.4));
          border-color: #00ff96;
          box-shadow: 0 0 15px rgba(0, 255, 150, 0.4);
        }

        .today-btn {
          background: linear-gradient(135deg, rgba(255, 180, 0, 0.3), rgba(255, 100, 50, 0.3));
          border-color: rgba(255, 180, 0, 0.5);
          color: #ffcc00;
        }

        .today-btn:hover {
          background: linear-gradient(135deg, rgba(255, 180, 0, 0.5), rgba(255, 100, 50, 0.5));
          border-color: #ffcc00;
          box-shadow: 0 0 20px rgba(255, 180, 0, 0.4);
        }

        .effects-btn {
          background: linear-gradient(135deg, rgba(255, 0, 150, 0.3), rgba(150, 0, 255, 0.3));
          border-color: rgba(255, 0, 150, 0.5);
          color: #ff00ff;
        }

        .effects-btn:hover {
          background: linear-gradient(135deg, rgba(255, 0, 150, 0.5), rgba(150, 0, 255, 0.5));
          border-color: #ff00ff;
          box-shadow: 0 0 20px rgba(255, 0, 150, 0.4);
        }

        .effects-btn.off {
          background: rgba(100, 100, 100, 0.3);
          border-color: rgba(150, 150, 150, 0.4);
          color: rgba(200, 200, 200, 0.6);
        }

        /* Current time row highlighting */
        .current-time-row {
          position: relative;
        }

        .current-time-row::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: linear-gradient(90deg, rgba(255, 100, 0, 0.15), rgba(255, 50, 100, 0.1), transparent);
          pointer-events: none;
          z-index: 1;
        }

        .current-time-indicator {
          position: absolute;
          left: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #ff6600, #ff0066);
          box-shadow: 0 0 10px #ff6600, 0 0 20px #ff0066;
          animation: timeIndicatorPulse 2s ease-in-out infinite;
          z-index: 5;
        }

        @keyframes timeIndicatorPulse {
          0%, 100% { box-shadow: 0 0 10px #ff6600, 0 0 20px #ff0066; }
          50% { box-shadow: 0 0 20px #ff6600, 0 0 40px #ff0066, 0 0 60px #ff6600; }
        }

        .current-time-label {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, #ff6600, #ff0066);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          z-index: 6;
          white-space: nowrap;
        }

        /* Today column highlight */
        .today-column {
          background: rgba(0, 255, 150, 0.08) !important;
        }

        .today-header {
          background: linear-gradient(180deg, rgba(0, 255, 150, 0.3), rgba(0, 200, 100, 0.2)) !important;
          color: #00ff96 !important;
          position: relative;
        }

        .today-header::after {
          content: 'TODAY';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 8px;
          background: #00ff96;
          color: #000;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 800;
        }
      `}</style>

      {/* ============================================ */}
      {/* FLOATING PARTICLES - FRONTEND ONLY (Added) */}
      {/* ============================================ */}
      {showEffects && !selectedAppointmentId && (
        <div className="particles-container">
          {particles.map(particle => (
            <div
              key={particle.id}
              className={`particle ${particle.shape}`}
              style={{
                left: `${particle.x}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                backgroundColor: particle.color,
                color: particle.color,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`
              }}
            />
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* CONFETTI BURST - FRONTEND ONLY (Added) */}
      {/* ============================================ */}
      {showEffects && !selectedAppointmentId && confetti.length > 0 && (
        <div className="confetti-container">
          {confetti.map(piece => (
            <div
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.x}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`
              }}
            />
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* WELCOME BANNER - FRONTEND ONLY (Added) */}
      {/* ============================================ */}
      {showWelcome && !selectedAppointmentId && (
        <div className="welcome-banner">
          <div className="welcome-icon">✨</div>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 800 }}>👋 WELCOME!</h3>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
              Your appointment calendar is ready. You have {todayAppointmentsCount} appointment{todayAppointmentsCount !== 1 ? 's' : ''} today!
            </p>
          </div>
          <button className="welcome-close" onClick={() => setShowWelcome(false)}>×</button>
        </div>
      )}

      {/* ============================================ */}
      {/* ORIGINAL CALENDAR - COMPLETELY UNCHANGED */}
      {/* ============================================ */}
      <div className="availability-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* ============================================ */}
        {/* CALENDAR HEADER BAR - FRONTEND ONLY */}
        {/* ============================================ */}
        <div className="calendar-header" style={{ flexShrink: 0 }}>
          <div className="calendar-header-left">
            <h1 className="calendar-title">📅 Your Appointments</h1>
            <span className="calendar-date-display">
              {currentPhoenixTime.dateStr || currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span style={{ fontSize: '12px', color: '#00ff88', marginLeft: '8px', padding: '4px 8px', background: 'rgba(0,255,136,0.2)', borderRadius: '6px' }}>
              🕐 {currentPhoenixTime.formatted || '--:--'} PHX
            </span>
          </div>
          
          <div className="calendar-header-center">
            <button className="nav-btn" onClick={() => navigateCalendar('prev')}>
              ◀ Prev
            </button>
            <button className="nav-btn today-btn" onClick={goToToday}>
              📍 Today
            </button>
            <button className="nav-btn" onClick={() => navigateCalendar('next')}>
              Next ▶
            </button>
          </div>

          <div className="calendar-header-right">
            <button 
              className={`nav-btn ${calendarViewType === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('week')}
            >
              Week
            </button>
            <button 
              className={`nav-btn ${calendarViewType === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarViewType('month')}
            >
              Month
            </button>
            <button 
              className={`nav-btn ${viewType === 'list' ? 'active' : ''}`}
              onClick={() => setViewType(viewType === 'calendar' ? 'list' : 'calendar')}
            >
              {viewType === 'calendar' ? '📋 List' : '📅 Calendar'}
            </button>
            <button 
              className={`nav-btn effects-btn ${!showEffects ? 'off' : ''}`}
              onClick={toggleEffects}
            >
              {showEffects ? '✨ Effects ON' : '✨ Effects OFF'}
            </button>
          </div>
        </div>

        {/* Full Screen Calendar Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {viewType === 'calendar' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {calendarViewType === 'week' ? (
              <div ref={calendarScrollRef} style={{ flex: 1, overflow: 'auto' }}>
                {/* Week Calendar Grid - Using availability page structure */}
                <div className="availability-cal" style={{ display: 'flex', flexDirection: 'column', minHeight: 'max-content' }}>
                  {/* Header Row */}
                  <div className="availability-cal-row" style={{ borderBottom: '2px solid var(--line)', position: 'sticky', top: 0, zIndex: 10, background: '#081226' }}>
                    <div className="availability-dayhead" style={{ background: '#081226' }}>TIME</div>
                    {visibleDates.map((date, idx) => (
                      <div 
                        key={`header-${idx}`} 
                        className={`availability-dayhead ${isToday(date) ? 'today-header' : ''}`}
                        style={{ background: isToday(date) ? undefined : '#081226' }}
                      >
                        {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} {date.getDate()}
                      </div>
                    ))}
                  </div>

                  {/* Time Slots */}
                  {timeSlots.map((time, timeIndex) => {
                    const isCurrent = isCurrentTimeSlot(time)
                    return (
                      <div 
                        key={`row-${timeIndex}`} 
                        className={`availability-cal-row ${isCurrent ? 'current-time-row' : ''}`}
                        ref={isCurrent ? currentTimeRowRef : null}
                      >
                        {isCurrent && <div className="current-time-indicator" />}
                        <div className="availability-time" style={isCurrent ? { color: '#ff6600', fontWeight: 800 } : {}}>
                          {formatTime(time)}
                          {isCurrent && <span style={{ marginLeft: 4, fontSize: 10 }}>◀ NOW</span>}
                        </div>
                        {visibleDates.map((date, dayIndex) => {
                          const appointment = getAppointmentForSlot(date, time)
                          const isAvailable = !appointment
                          const isTodayCol = isToday(date)
                        
                          return (
                            <div
                              key={`cell-${dayIndex}-${timeIndex}`}
                              className={`availability-cell ${isTodayCol ? 'today-column' : ''}`}
                              onMouseEnter={() => playHoverSound()}
                              onClick={() => {
                                playClickSound()
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
                                <div className={`availability-event blocked ${appointment.visit_type || 'video'}`} style={{ position: 'relative' }}>
                                  {appointment.chart_locked && (
                                    <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '10px', color: '#fbbf24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.6))' }} title="Chart locked">🔒</span>
                                  )}
                                  {appointment.status === 'completed' && !appointment.chart_locked && (
                                    <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '10px', color: '#4ade80', opacity: 0.8 }} title="Completed">✓</span>
                                  )}
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
                  )
                  })}
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
    </>
  )
}



























































































































