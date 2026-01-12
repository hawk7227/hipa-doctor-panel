import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// Helper function to convert UTC date to Phoenix timezone (same as CreateAppointmentDialog)
function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  
  // Get the date/time components in the specified timezone
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

export interface Referral {
  id: string
  specialist_name: string
  specialty: string
  reason: string
  urgency: 'routine' | 'urgent' | 'stat'
  status: 'pending' | 'sent' | 'scheduled' | 'completed'
  created_at: string
  appointment_date?: string | null
  notes?: string | null
  patient_id: string
  appointment_id?: string | null
  provider_id?: string | null
}

export interface FollowUpData {
  date: string
  time: string
  visitType: 'video' | 'phone' | 'async'
  reason: string
  notes: string
}

export function useReferralsFollowUp(
  appointmentId: string | null,
  appointment: any,
  onFollowUp?: (patientData: {
    id: string
    first_name: string
    last_name: string
    email: string
    mobile_phone: string
  }, date: Date, time: Date) => void
) {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [newReferral, setNewReferral] = useState({
    specialistName: '',
    specialty: '',
    reason: '',
    urgency: 'routine' as 'routine' | 'urgent' | 'stat',
    notes: ''
  })

  const [showFollowUpScheduler, setShowFollowUpScheduler] = useState(false)
  const [followUpData, setFollowUpData] = useState<FollowUpData>({
    date: '',
    time: '',
    visitType: 'video',
    reason: '',
    notes: ''
  })
  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false)

  const loadReferrals = useCallback(async () => {
    if (!appointmentId) return

    try {
      // Try to fetch from referrals table
      // Note: If table doesn't exist, we'll handle gracefully
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist (404), that's okay - we'll just have an empty list
        // Check if error has a code property before comparing
        const errorCode = error?.code
        const errorMessage = error?.message || ''
        
        // Check if this is a table-not-found error (404 or specific error codes) - should be silent
        const isTableNotFound = 
          errorCode === 'PGRST116' || 
          errorCode === '42P01' || 
          errorCode === 'PGRST301' ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('relation') ||
          errorMessage.includes('table') ||
          errorMessage.includes('404') ||
          errorCode === '404'
        
        // Only log if error has meaningful information AND is not a table-not-found error
        // Suppress all 404 errors for missing tables
        if (!isTableNotFound && errorCode !== '404') {
          // Only log in development or if it's a real error (not just missing table)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error loading referrals (non-critical):', {
              message: errorMessage || 'Unknown error',
              code: errorCode
            })
          }
        }
        // Set empty array if table doesn't exist or on any error
        setReferrals([])
        return
      }

      if (data && data.length > 0) {
        const transformedReferrals: Referral[] = data.map((item: any) => ({
          id: item.id,
          specialist_name: item.specialist_name || item.specialistName || '',
          specialty: item.specialty || '',
          reason: item.reason || '',
          urgency: (item.urgency || 'routine') as 'routine' | 'urgent' | 'stat',
          status: (item.status || 'pending') as 'pending' | 'sent' | 'scheduled' | 'completed',
          created_at: item.created_at || new Date().toISOString(),
          appointment_date: item.appointment_date || null,
          notes: item.notes || null,
          patient_id: item.patient_id || appointment?.patient_id || '',
          appointment_id: item.appointment_id || appointmentId,
          provider_id: item.provider_id || item.doctor_id || null
        }))
        setReferrals(transformedReferrals)
      } else {
        setReferrals([])
      }
    } catch (error: any) {
      // Only log if error has meaningful information (not empty object)
      const errorKeys = error ? Object.keys(error).filter(key => error[key] !== undefined && error[key] !== null && error[key] !== '') : []
      if (errorKeys.length > 0 && (error.message || error.code)) {
        console.error('Error loading referrals:', {
          message: error?.message || 'Unknown error',
          code: error?.code,
          details: error?.details
        })
      }
      setReferrals([])
    }
  }, [appointmentId, appointment?.patient_id])

  const handleCreateReferral = useCallback(async () => {
    if (!newReferral.specialistName || !newReferral.specialty || !newReferral.reason) {
      throw new Error('Please fill in all required referral fields')
    }

    if (!appointment?.patient_id) {
      throw new Error('Patient ID is required')
    }

    const user = await getCurrentUser()
    const referral: Referral = {
      id: `ref-${Date.now()}`,
      specialist_name: newReferral.specialistName,
      specialty: newReferral.specialty,
      reason: newReferral.reason,
      urgency: newReferral.urgency,
      status: 'pending',
      created_at: new Date().toISOString(),
      notes: newReferral.notes || null,
      patient_id: appointment.patient_id,
      appointment_id: appointmentId,
      provider_id: user?.doctor?.id || null
    }

    try {
      // Try to save to referrals table if it exists
      const { error } = await supabase
        .from('referrals')
        .insert([{
          specialist_name: referral.specialist_name,
          specialty: referral.specialty,
          reason: referral.reason,
          urgency: referral.urgency,
          status: referral.status,
          notes: referral.notes,
          patient_id: referral.patient_id,
          appointment_id: referral.appointment_id,
          provider_id: referral.provider_id,
          doctor_id: referral.provider_id // Also try doctor_id in case that's the column name
        }])

      if (error) {
        // If table doesn't exist, that's okay - we'll still add to local state
        const errorCode = error?.code
        const isTableNotFound = errorCode === 'PGRST116' || errorCode === '42P01' || errorCode === 'PGRST301'
        
        // Only log if error has meaningful information AND is not a table-not-found error
        if (!isTableNotFound) {
          const errorKeys = Object.keys(error).filter(key => (error as any)[key] !== undefined && (error as any)[key] !== null && (error as any)[key] !== '')
          if (errorKeys.length > 0 && (error.message || error.details)) {
            console.error('Error saving referral:', {
              message: error?.message || 'Unknown error',
              code: errorCode,
              details: error?.details
            })
          }
        }
        // Don't throw - we'll still add to local state for UI
      }
    } catch (error: any) {
      // Only log if error has meaningful information (not empty object)
      const errorKeys = error ? Object.keys(error).filter(key => error[key] !== undefined && error[key] !== null && error[key] !== '') : []
      if (errorKeys.length > 0 && (error.message || error.code)) {
        console.error('Error saving referral:', {
          message: error?.message || 'Unknown error',
          code: error?.code,
          details: error?.details
        })
      }
      // Don't throw - we'll still add to local state for UI
    }

    // Add to local state regardless of DB save status
    setReferrals(prev => [...prev, referral])
    setNewReferral({ specialistName: '', specialty: '', reason: '', urgency: 'routine', notes: '' })
    setShowReferralForm(false)
  }, [newReferral, appointmentId, appointment])

  const handleScheduleFollowUp = useCallback(async () => {
    if (!followUpData.date || !followUpData.time || !appointment) {
      throw new Error('Please select date and time for follow-up')
    }

    if (!appointment.patient_id || !appointment.doctor_id) {
      throw new Error('Patient ID and Doctor ID are required')
    }

    setIsSchedulingFollowUp(true)

    try {
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix
      // Parse the date and time from form inputs (they are strings representing Phoenix time)
      const [year, month, day] = followUpData.date.split('-').map(Number)
      const [hours, minutes] = followUpData.time.split(':').map(Number)
      
      // Convert to Phoenix timezone to get correct date components (same as CreateAppointmentDialog)
      const doctorTimezone = 'America/Phoenix'
      // Create a date string from the parsed components and convert to Phoenix timezone
      // This ensures we get the correct date components in Phoenix timezone
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`
      const phoenixDate = convertToTimezone(dateStr, doctorTimezone)
      const phoenixYear = phoenixDate.getUTCFullYear()
      const phoenixMonth = phoenixDate.getUTCMonth() + 1 // JavaScript months are 0-indexed
      const phoenixDay = phoenixDate.getUTCDate()
      
      // Hours and minutes are already in the correct format (24-hour), use them directly
      // They represent Phoenix time as selected by the user
      
      // Use the same API endpoint as CreateAppointmentDialog
      const response = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId: appointment.doctor_id,
          year: phoenixYear,
          month: phoenixMonth,
          day: phoenixDay,
          hours: hours,
          minutes: minutes,
          visitType: followUpData.visitType,
          patientFirstName: appointment.patients?.first_name || '',
          patientLastName: appointment.patients?.last_name || '',
          patientEmail: appointment.patients?.email || null,
          patientPhone: appointment.patients?.phone || null,
          patientDob: null, // Not available in appointment object
          patientLocation: null, // Not available in appointment object
          serviceType: 'follow-up',
          notes: followUpData.reason || `Follow-up: ${appointment.chief_complaint || 'Follow-up appointment'}`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule follow-up')
      }

      // Call onFollowUp callback if provided (for any additional handling)
      if (onFollowUp && appointment.patients) {
        // Create date object for callback (in Phoenix timezone)
        const followUpDateTime = new Date(Date.UTC(phoenixYear, phoenixMonth - 1, phoenixDay, hours, minutes, 0))
        onFollowUp(
          {
            id: appointment.patients.id,
            first_name: appointment.patients.first_name || '',
            last_name: appointment.patients.last_name || '',
            email: appointment.patients.email || '',
            mobile_phone: appointment.patients.phone || ''
          },
          followUpDateTime,
          followUpDateTime
        )
      }

      setShowFollowUpScheduler(false)
      setFollowUpData({ date: '', time: '', visitType: 'video', reason: '', notes: '' })
    } catch (error: any) {
      console.error('Error scheduling follow-up:', error)
      throw error
    } finally {
      setIsSchedulingFollowUp(false)
    }
  }, [followUpData, appointment, onFollowUp])

  // Load referrals when appointmentId changes
  useEffect(() => {
    if (appointmentId) {
      loadReferrals()
    }
  }, [appointmentId, loadReferrals])

  return {
    referrals,
    showReferralForm,
    setShowReferralForm,
    newReferral,
    setNewReferral,
    showFollowUpScheduler,
    setShowFollowUpScheduler,
    followUpData,
    setFollowUpData,
    isSchedulingFollowUp,
    loadReferrals,
    handleCreateReferral,
    handleScheduleFollowUp
  }
}

