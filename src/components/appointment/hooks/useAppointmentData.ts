import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateForDateTimeLocal } from '../utils/timezone-utils'

interface Appointment {
  id: string
  service_type: string
  status: string
  visit_type: string
  requested_date_time: string | null
  zoom_meeting_url: string | null
  zoom_meeting_id: string | null
  zoom_meeting_password: string | null
  zoom_start_url: string | null
  transcription: string | null
  notes: string | null
  created_at: string
  provider_accepted_at: string | null
  preferred_pharmacy: string | null
  allergies: string | null
  subjective_notes: string | null
  objective_notes: string | null
  assessment_notes: string | null
  plan_notes: string | null
  diagnosis_codes: string | null
  current_medications: string | null
  active_problems: string | null
  recent_surgeries_details: string | null
  ongoing_medical_issues_details: string | null
  vitals_bp: string | null
  vitals_hr: string | null
  vitals_temp: string | null
  patient_id: string | null
  doctor_id: string | null
  user_id: string | null
  chief_complaint: string | null
  ros_general: string | null
  signed_at: string | null
  signed_by: string | null
  is_locked: boolean | null
  cdss_auto_generated: boolean | null
  resolved_problems: any[] | null
  medication_history: any[] | null
  active_medication_orders: any[] | null
  past_medication_orders: any[] | null
  prescription_logs: any[] | null
  payment_status: string | null
  payment_intent_id: string | null
  has_drug_allergies: boolean | null
  has_ongoing_medical_issues: boolean | null
  has_recent_surgeries: boolean | null
  doctors: {
    first_name: string
    last_name: string
    specialty: string
    timezone?: string
  } | null
  patients: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    date_of_birth: string | null
    location: string | null
    allergies: string | null
    allergies_list?: string[] // Allergies from normalized patient_allergies table
    current_medications: string | null
    active_problems: string | null
    recent_surgeries_details: string | null
    ongoing_medical_issues_details: string | null
    vitals_bp: string | null
    vitals_hr: string | null
    vitals_temp: string | null
    preferred_pharmacy: string | null
    chief_complaint: string | null
    ros_general: string | null
  } | null
}

interface CalendarAppointment {
  id: string
  requested_date_time: string | null
  visit_type: string | null
  patients?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  doctors?: {
    timezone: string
  }
}

export function useAppointmentData(
  appointmentId: string | null,
  isOpen: boolean,
  appointments: CalendarAppointment[] = []
) {
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newDateTime, setNewDateTime] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching current user:', err)
      }
    }
  }, [])

  const fetchAppointmentDetails = useCallback(async () => {
    if (!appointmentId) return

    setError(null)

    // OPTIMIZATION: Use cached appointment data for immediate display
    const cachedAppointment = appointments.find(apt => apt.id === appointmentId)
    if (cachedAppointment) {
      // Show basic info immediately from cache - DON'T set loading to true
      const basicAppointment = {
        ...cachedAppointment,
        patients: cachedAppointment.patients || null,
        doctors: cachedAppointment.doctors || null
      } as Appointment
      setAppointment(basicAppointment)
      // Don't set loading to false here - let the full fetch complete
    } else {
      // Only show loading if we don't have cached data
      setLoading(true)
    }

    try {
      // TIER 1: PRIORITY - Load Patient Header + SOAP Notes IMMEDIATELY
      // These are what users see first, so load them first
      const [
        { data: appointmentData, error: appointmentError },
        { data: clinicalNotesInitial, error: clinicalNotesError }
      ] = await Promise.all([
        // Main appointment query with complete patient data (for Patient Header)
        // OPTIMIZED: Using Next.js API route (server-side fetch) to bypass browser fetch delays
        // Browser fetch is taking 6-29s, but server-side should be fast
        (async () => {
          const response = await fetch(`/api/appointments/${appointmentId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            return { data: null, error: { message: errorData.error, status: response.status } }
          }
          
          const resultData = await response.json()
          return { data: resultData.data, error: resultData.error }
        })(),
        // Clinical notes query (SOAP Notes) - HIGH PRIORITY
        // OPTIMIZED: Using Next.js API route (server-side fetch) to bypass browser fetch delays
        (async () => {
          const response = await fetch(`/api/clinical-notes?appointment_id=${appointmentId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            return { data: null, error: { message: errorData.error, status: response.status } }
          }
          
          const resultData = await response.json()
          return { data: resultData.data, error: resultData.error }
        })()
      ])

      if (appointmentError) {
        throw appointmentError
      }

      if (!appointmentData) {
        throw new Error('Appointment not found')
      }

      // Fetch patient allergies from normalized table if patient_id exists
      // OPTIMIZED: With database indexes, this should now be <50ms instead of 20-28s
      let allergiesList: string[] = []
      if (appointmentData.patients?.id) {
        const { data: allergiesData } = await supabase
          .from('patient_allergies')
          .select('allergen_name')
          .eq('patient_id', appointmentData.patients.id)
          .order('recorded_at', { ascending: false })
        
        if (allergiesData && allergiesData.length > 0) {
          allergiesList = allergiesData
            .map(a => a.allergen_name)
            .filter((name): name is string => !!name)
        }
      }

      // Format appointment time in doctor's timezone
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
      if (appointmentData.requested_date_time) {
        const doctorTimezone = PROVIDER_TIMEZONE
        const formattedDate = formatDateForDateTimeLocal(appointmentData.requested_date_time, doctorTimezone)
        setNewDateTime(formattedDate)
      }

      // Add patient allergies to appointment data (only from normalized table)
      const appointmentWithAllergies = {
        ...appointmentData,
        patients: appointmentData.patients ? {
          ...appointmentData.patients,
          allergies_list: allergiesList,
          allergies: allergiesList.length > 0 ? allergiesList.join(', ') : ''
        } : null
      }

      // IMMEDIATELY set appointment data so Patient Header and SOAP Notes can render
      setAppointment(appointmentWithAllergies)

      // TIER 2: Load non-critical data in background (prescription logs, etc.)
      // These can load after Patient Header and SOAP Notes are visible
      // Load prescription logs with a small delay (200ms) to not block critical data
      setTimeout(async () => {
        const { data: prescriptionLogsData } = await supabase
          .from('prescription_logs')
          .select('*')
          .eq('appointment_id', appointmentId)
          .order('action_at', { ascending: false })
        // Prescription logs are used in lower sections, so loading them later is fine
      }, 200)

      // Return data for use in other hooks
      // Note: Problems & Medications are loaded separately in useProblemsMedications hook
      // using normalized tables: problems, medication_history, medication_orders
      return {
        appointmentData: appointmentWithAllergies,
        clinicalNotes: clinicalNotesInitial || [],
        prescriptionLogs: [], // Will be loaded in background (non-blocking)
        patientId: appointmentData.patients?.id || null,
        patientAllergies: allergiesList
      }
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [appointmentId, appointments])

  useEffect(() => {
    if (isOpen && appointmentId) {
      setError(null)
      
      // Don't clear appointment immediately - show cached version first
      // Only clear if we're switching to a different appointment
      const cachedAppointment = appointments.find(apt => apt.id === appointmentId)
      if (!cachedAppointment) {
        setAppointment(null)
        setLoading(true)
      }
      
      // Fetch in background - don't block UI
      fetchAppointmentDetails()
      fetchCurrentUser()
    } else if (!isOpen) {
      // Only clear when modal closes
      setAppointment(null)
      setLoading(false)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointmentId])

  return {
    appointment,
    loading,
    error,
    newDateTime,
    setNewDateTime,
    currentUser,
    setAppointment,
    setError,
    fetchAppointmentDetails
  }
}




