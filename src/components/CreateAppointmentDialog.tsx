import { PROVIDER_TIMEZONE } from '@/lib/constants'
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { X, User, Plus, Search } from 'lucide-react'

// Helper function to convert UTC date to Phoenix timezone
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

interface Patient {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile_phone: string
  date_of_birth?: string
  address?: string
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

interface CreateAppointmentDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => any
  doctorId: string
  selectedDate: Date
  selectedTime: Date
  appointments?: CalendarAppointment[]
  editingAppointmentId?: string | null
  patientData?: {
    id: string
    first_name: string
    last_name: string
    email: string
    mobile_phone: string
  } | null
  onTimeSelect?: (time: Date) => void
}

export default function CreateAppointmentDialog({
  isOpen,
  onClose,
  onSuccess,
  doctorId,
  selectedDate,
  selectedTime,
  appointments = [],
  editingAppointmentId = null,
  patientData = null,
  onTimeSelect
}: CreateAppointmentDialogProps) {
  const [localSelectedTime, setLocalSelectedTime] = useState<Date>(selectedTime)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [patientMode, setPatientMode] = useState<'select' | 'create'>('select')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [visiblePatientsCount, setVisiblePatientsCount] = useState(10)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  
  // Form fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    location: '',
    visitType: 'video',
    serviceType: 'consultation',
    notes: ''
  })

  // Debounce search term
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchTerm])

  // Fetch patients when search term changes (debounced)
  useEffect(() => {
    if (!isOpen || patientMode !== 'select') return

    // Only search if there's a search term (minimum 2 characters)
    if (debouncedSearchTerm.trim().length >= 2) {
      searchPatients(debouncedSearchTerm.trim())
    } else if (debouncedSearchTerm.trim().length === 0) {
      // Clear results if search is empty
      setPatients([])
      setVisiblePatientsCount(10)
    }
  }, [debouncedSearchTerm, isOpen, patientMode])

  // Clear patients when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPatients([])
      setSearchTerm('')
      setDebouncedSearchTerm('')
      setVisiblePatientsCount(10)
    }
  }, [isOpen])

  const searchPatients = async (search: string) => {
    try {
      setLoading(true)
      
      // Build search pattern - Supabase uses % for wildcards in ilike
      const searchPattern = `%${search}%`

      // Build search query - search across multiple fields using OR
      // Supabase .or() expects comma-separated conditions without quotes around values
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          location
        `)
        .not('phone', 'is', null)
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Map patients to Patient interface
      const patientsList: Patient[] = (data || []).map((item: any) => ({
        id: item.id,
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        email: item.email || '',
        mobile_phone: item.phone || '',
        date_of_birth: item.date_of_birth || '',
        address: item.location || ''
      }))

      setPatients(patientsList)
      setVisiblePatientsCount(10) // Reset visible count on new search
    } catch (error) {
      console.error('Error searching patients:', error)
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    setFormData({
      ...formData,
      firstName: patient.first_name,
      lastName: patient.last_name,
      email: patient.email,
      phone: patient.mobile_phone,
      dob: patient.date_of_birth || '',
      location: patient.address || ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.firstName || !formData.lastName) {
      alert('Please fill in patient first name and last name')
      return
    }

    setCreating(true)

    try {
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix
      // selectedDate and selectedTime are in Phoenix timezone
      // We need to extract Phoenix time components correctly
      
      // Convert selectedDate to Phoenix timezone to get correct date components
      const doctorTimezone = PROVIDER_TIMEZONE
      const phoenixDate = convertToTimezone(selectedDate.toISOString(), doctorTimezone)
      const year = phoenixDate.getUTCFullYear()
      const month = phoenixDate.getUTCMonth() + 1 // JavaScript months are 0-indexed
      const day = phoenixDate.getUTCDate()
      
      // Use localSelectedTime if available, otherwise use selectedTime
      // Both are now Phoenix time slots (UTC values representing Phoenix local time)
      const timeToUse = localSelectedTime || selectedTime
      // Extract Phoenix time using UTC methods since time slots are UTC representing Phoenix time
      const hours = timeToUse.getUTCHours()
      const minutes = timeToUse.getUTCMinutes()
      
      // Send date and time components separately to avoid timezone conversion issues
      // The backend will construct the date in the doctor's timezone (Phoenix)
      const response = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId,
          year,
          month,
          day,
          hours,
          minutes,
          visitType: formData.visitType,
          patientFirstName: formData.firstName,
          patientLastName: formData.lastName,
          patientEmail: formData.email || null,
          patientPhone: formData.phone || null,
          patientDob: formData.dob || null,
          patientLocation: formData.location || null,
          serviceType: formData.serviceType,
          notes: formData.notes || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create appointment')
      }

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        location: '',
        visitType: 'video',
        serviceType: 'consultation',
        notes: ''
      })
      setSelectedPatient(null)
      setPatientMode('select')
      setSearchTerm('')

      // Wait for onSuccess to complete (which refreshes appointments) before closing
      const successResult = onSuccess()
      if (successResult instanceof Promise) {
        await successResult
      }
      onClose()
    } catch (error: any) {
      console.error('Error creating appointment:', error)
      alert(error.message || 'Failed to create appointment')
    } finally {
      setCreating(false)
    }
  }

  const handleCancelVisit = async () => {
    if (!editingAppointmentId) {
      alert('No appointment selected to cancel')
      return
    }

    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return
    }

    try {
      setCreating(true)
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', editingAppointmentId)

      if (error) throw error

      alert('Appointment cancelled successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error cancelling appointment:', error)
      alert(error.message || 'Failed to cancel appointment')
    } finally {
      setCreating(false)
    }
  }

  const handleMoveVisit = async () => {
    if (!editingAppointmentId) {
      alert('No appointment selected to move')
      return
    }

    // Extract date components from selectedDate
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth() + 1
    const day = selectedDate.getDate()
    const hours = selectedTime.getHours()
    const minutes = selectedTime.getMinutes()

    try {
      setCreating(true)
      
      // Construct the new date-time string
      const newDateTime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

      const { error } = await supabase
        .from('appointments')
        .update({ requested_date_time: newDateTime })
        .eq('id', editingAppointmentId)

      if (error) throw error

      alert('Appointment moved successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error moving appointment:', error)
      alert(error.message || 'Failed to move appointment')
    } finally {
      setCreating(false)
    }
  }

  const handleFollowUp = async () => {
    if (!selectedPatient && !formData.firstName) {
      alert('Please select or create a patient first')
      return
    }

    // Create a follow-up appointment with the same patient
    setFormData(prev => ({
      ...prev,
      serviceType: 'follow-up',
      notes: prev.notes || 'Follow-up appointment'
    }))

    // The form submission will handle creating the follow-up
    // This handler just prepares the form
  }

  // Save new patient to database WITHOUT creating an appointment
  const handleSavePatientOnly = async () => {
    if (!formData.firstName || !formData.lastName) {
      alert('Please fill in patient first name and last name')
      return
    }

    setCreating(true)

    try {
      // Check if patient already exists by email or phone
      let existingPatient = null
      if (formData.email) {
        const { data } = await supabase
          .from('patients')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle()
        existingPatient = data
      }
      if (!existingPatient && formData.phone) {
        const { data } = await supabase
          .from('patients')
          .select('id')
          .eq('phone', formData.phone)
          .maybeSingle()
        existingPatient = data
      }

      if (existingPatient) {
        alert('A patient with this email or phone already exists. Please use "Select Patient" to find them.')
        setCreating(false)
        return
      }

      // Create the patient record
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email || null,
          phone: formData.phone || null,
          date_of_birth: formData.dob || null,
          location: formData.location || null,
          doctor_id: doctorId,
          created_at: new Date().toISOString()
        })
        .select('id, first_name, last_name, email, phone')
        .single()

      if (patientError) {
        console.error('Error creating patient:', patientError)
        throw new Error(patientError.message || 'Failed to create patient')
      }

      console.log('✅ Patient created (no appointment):', newPatient.id, newPatient.first_name, newPatient.last_name)

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        location: '',
        visitType: 'video',
        serviceType: 'consultation',
        notes: ''
      })
      setSelectedPatient(null)
      setPatientMode('select')
      setSearchTerm('')

      alert(`Patient ${newPatient.first_name} ${newPatient.last_name} saved successfully! You can now find them in patient search.`)
      onClose()
    } catch (error: any) {
      console.error('Error saving patient:', error)
      alert(error.message || 'Failed to save patient')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!editingAppointmentId) {
      alert('No appointment selected to delete')
      return
    }

    if (!confirm('Are you sure you want to permanently delete this appointment? This action cannot be undone.')) {
      return
    }

    try {
      setCreating(true)
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', editingAppointmentId)

      if (error) throw error

      alert('Appointment deleted successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error deleting appointment:', error)
      alert(error.message || 'Failed to delete appointment')
    } finally {
      setCreating(false)
    }
  }

  // Use patients directly since they're already filtered server-side
  const visiblePatients = patients.slice(0, visiblePatientsCount)
  const hasMorePatients = patients.length > visiblePatientsCount

  // Reset visible count when dialog opens
  useEffect(() => {
    if (isOpen) {
      setVisiblePatientsCount(10)
    }
  }, [isOpen])

  // Sync localSelectedTime with selectedTime prop
  useEffect(() => {
    if (isOpen && selectedTime) {
      setLocalSelectedTime(selectedTime)
    }
  }, [isOpen, selectedTime])

  // Pre-fill patient data when provided (for follow-up appointments)
  useEffect(() => {
    if (patientData && isOpen) {
      setFormData({
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        email: patientData.email,
        phone: patientData.mobile_phone,
        dob: '',
        location: '',
        visitType: 'video',
        serviceType: 'follow-up',
        notes: 'Follow-up appointment'
      })
      setPatientMode('create')
      // Try to find and select the patient if they exist
      const foundPatient = patients.find(p => p.id === patientData.id)
      if (foundPatient) {
        setSelectedPatient(foundPatient)
        setPatientMode('select')
      }
    }
  }, [patientData, isOpen, patients])

  const loadMorePatients = () => {
    setVisiblePatientsCount(prev => prev + 10)
  }

  // Helper function to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Helper function to get appointment for a specific slot
  const getAppointmentForSlot = (date: Date, time: Date): CalendarAppointment | null => {
    if (!appointments || appointments.length === 0) return null
    
    for (const apt of appointments) {
      if (!apt.requested_date_time) continue
      
      const aptDate = new Date(apt.requested_date_time)
      if (aptDate.toDateString() === date.toDateString() &&
          aptDate.getHours() === time.getHours() &&
          aptDate.getMinutes() === time.getMinutes()) {
        return apt
      }
    }
    
    return null
  }

  // Helper function to get appointment reason
  const getAppointmentReason = (apt: CalendarAppointment): string => {
    if ((apt as any).clinical_notes && Array.isArray((apt as any).clinical_notes) && (apt as any).clinical_notes.length > 0) {
      const reasonNote = (apt as any).clinical_notes.find(
        (note: any) => note.note_type === 'chief_complaint' || note.note_type === 'subjective'
      )
      if (reasonNote?.content) {
        return reasonNote.content
      }
    }
    const aptAny = apt as any
    return aptAny.chief_complaint || aptAny.reason || ''
  }

  // Render current day slots (left sidebar) - Matching AppointmentDetailModal design
  const renderCurrentDaySlots = () => {
    // Generate time slots (5 AM to 8 PM, 30-min intervals)
    const slots: Date[] = []
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date(selectedDate)
        time.setHours(hour, minute, 0, 0)
        slots.push(time)
      }
    }
    
    return (
      <div style={{ 
        padding: '12px', 
        background: 'linear-gradient(180deg, #0d1424, #0b1222)',
        height: '100%', 
        overflowY: 'auto',
        borderRight: '1px solid #1b2b4d',
        scrollbarWidth: 'thin',
        scrollbarColor: '#1b2b4d #0a1222'
      }}
      className="scrollbar-thin scrollbar-thumb-[#1b2b4d] scrollbar-track-[#0a1222]"
      >
        {/* Day Header */}
        <div style={{
          color: '#cfe1ff',
          fontWeight: 'bold',
          fontSize: '14px',
          marginBottom: '16px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          paddingBottom: '12px',
          borderBottom: '1px solid #1b2b4d',
          zIndex: 10
        }}>
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
        
        {/* Time Slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {slots.map((time) => {
            const slotAppointment = getAppointmentForSlot(selectedDate, time)
            const isSelected = time.getTime() === localSelectedTime?.getTime() || time.getTime() === selectedTime?.getTime()
            const isAvailable = !slotAppointment
            
            return (
              <div
                key={time.getTime()}
                onClick={() => {
                  if (isAvailable) {
                    setLocalSelectedTime(time)
                    if (onTimeSelect) {
                      onTimeSelect(time)
                    }
                  }
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(0, 230, 255, 0.3), rgba(0, 230, 255, 0.2))'
                    : slotAppointment 
                      ? '#0a1222'
                      : 'linear-gradient(135deg, rgba(25,214,127,.18), rgba(25,214,127,.12))',
                  border: isSelected
                    ? '2px solid #00e6ff'
                    : slotAppointment
                      ? '2px solid #e53935'
                      : '2px solid rgba(25,214,127,.6)',
                  boxShadow: isSelected
                    ? '0 0 12px rgba(0, 230, 255, 0.4)'
                    : slotAppointment
                      ? '0 0 8px rgba(229, 57, 53, 0.3)'
                      : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  color: slotAppointment ? '#ffffff' : '#cde7da'
                }}
                onMouseEnter={(e) => {
                  if (isAvailable) {
                    e.currentTarget.style.filter = 'brightness(1.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: slotAppointment ? '#ffffff' : '#cde7da' }}>{formatTime(time)}</div>
                {slotAppointment && (
                  <>
                    <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '600', color: '#ffffff' }}>
                    {slotAppointment.patients?.first_name} {slotAppointment.patients?.last_name}
                  </div>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      marginTop: '4px',
                      textTransform: 'uppercase',
                      background: slotAppointment.visit_type === 'video' ? 'rgba(0, 230, 255, 0.25)' :
                                 slotAppointment.visit_type === 'phone' ? 'rgba(0, 194, 110, 0.25)' :
                                 slotAppointment.visit_type === 'async' ? 'rgba(176, 122, 255, 0.25)' : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${slotAppointment.visit_type === 'video' ? '#00e6ff' :
                                          slotAppointment.visit_type === 'phone' ? '#00c26e' :
                                          slotAppointment.visit_type === 'async' ? '#b07aff' : 'transparent'}`,
                      color: slotAppointment.visit_type === 'video' ? '#00e6ff' :
                             slotAppointment.visit_type === 'phone' ? '#00c26e' :
                             slotAppointment.visit_type === 'async' ? '#b07aff' : '#fff'
                    }}>
                      {slotAppointment.visit_type === 'video' ? 'VIDEO' :
                       slotAppointment.visit_type === 'phone' ? 'PHONE' :
                       slotAppointment.visit_type === 'async' ? 'ASYNC' : 'VISIT'}
                    </span>
                    {(() => {
                      const reason = getAppointmentReason(slotAppointment)
                      if (!reason) return null
                      const words = reason.trim().split(/\s+/)
                      const shortReason = words.slice(0, 2).join(' ')
                      return (
                        <div style={{ fontSize: '10px', marginTop: '4px', color: '#ffffff', opacity: 0.9 }}>
                          {shortReason}
                        </div>
                      )
                    })()}
                  </>
                )}
                {isAvailable && (
                  <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, fontWeight: '600' }}>Available</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Main container with calendar sidebar + panel - Matching AppointmentDetailModal */}
      <div className="fixed top-0 right-0 h-full w-full z-50 flex">
        {/* Left Calendar Sidebar - Matching AppointmentDetailModal design */}
        <div style={{
          width: '12%',
          minWidth: '140px',
          maxWidth: '200px',
          height: '100%',
          borderRight: '1px solid #1b2b4d',
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)'
        }}>
              {renderCurrentDaySlots()}
            </div>
        
        {/* Right Panel - Matching AppointmentDetailModal */}
        <div className={`flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/20 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10 flex-shrink-0 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-sm sm:text-base">
                <span className="text-cyan-400">SCHEDULE/MOVE APPOINTMENT</span>
              </h2>
            <button
              onClick={onClose}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
            >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
            </div>
            
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Date/Time Display */}
          <div className="bg-[#164e4e] rounded-lg p-3 sm:p-4 border border-[#1a3d3d]">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Selected Date & Time</div>
            <div className="text-sm sm:text-lg font-semibold text-white">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {' at '}
              {selectedTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>
          </div>

          {/* Patient Search */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-2">
              Search patient by name, DOB, email, or phone
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white"
              />
            </div>
          </div>

          {/* Appointment Details */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-2">Appointment details</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white"
              placeholder="Appointment notes..."
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" className="rounded" />
              Send confirmation to patient (SMS + Email)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button 
              type="button"
              onClick={() => setPatientMode('create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              New Patient
            </button>
            {editingAppointmentId && (
              <>
                <button 
                  type="button"
                  onClick={handleCancelVisit}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Cancel Visit
                </button>
                <button 
                  type="button"
                  onClick={handleMoveVisit}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                >
                  Move Visit
                </button>
              </>
            )}
            <button 
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Scheduling...' : 'Schedule New'}
            </button>
            <button 
              type="button"
              onClick={handleFollowUp}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              Follow-up
            </button>
            {editingAppointmentId && (
              <button 
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Delete
              </button>
            )}
          </div>

          {/* Patient Selection Mode */}
          <div className="flex gap-2 mb-3 sm:mb-4">
            <button
              type="button"
              onClick={() => {
                setPatientMode('select')
                setSelectedPatient(null)
              }}
              className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                patientMode === 'select'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Select Patient</span>
              <span className="sm:hidden">Select</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPatientMode('create')
                setSelectedPatient(null)
                setFormData({
                  ...formData,
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  dob: '',
                  location: ''
                })
              }}
              className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                patientMode === 'create'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">New Patient</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>

          {/* Patient Selection */}
          {patientMode === 'select' && (
            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {loading ? (
                <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-400">Searching patients...</div>
              ) : searchTerm.trim().length < 2 ? (
                <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-400">Type at least 2 characters to search</div>
              ) : patients.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-400">No patients found</div>
              ) : (
                <div className="space-y-1.5">
                  <div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-1 scroll-smooth pr-1">
                    {visiblePatients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className={`px-2 sm:px-3 py-2 rounded-md border cursor-pointer transition-all duration-200 ${
                          selectedPatient?.id === patient.id
                            ? 'bg-red-500 border-red-400 shadow-md'
                            : 'bg-[#164e4e] border-[#1a3d3d] hover:bg-[#1a5555] hover:border-[#2a6a6a]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm min-w-0">
                          <div className="text-white font-medium whitespace-nowrap flex-shrink-0">
                            {patient.first_name} {patient.last_name}
                          </div>
                          {(patient.email || patient.mobile_phone) && (
                            <div className="flex items-center gap-2 text-gray-300 truncate">
                              {patient.email && (
                                <>
                                  <span className="text-gray-500 hidden sm:inline">•</span>
                                  <span className="truncate min-w-0 text-[10px] sm:text-sm">{patient.email}</span>
                                </>
                              )}
                              {patient.mobile_phone && (
                                <>
                                  <span className="text-gray-500">•</span>
                                  <span className="whitespace-nowrap flex-shrink-0 text-[10px] sm:text-sm">{patient.mobile_phone}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMorePatients && (
                    <button
                      type="button"
                      onClick={loadMorePatients}
                      className="w-full px-3 sm:px-4 py-2 text-xs sm:text-sm bg-[#1a5555] text-white rounded-lg hover:bg-[#2a6a6a] transition-colors border border-[#1a3d3d]"
                    >
                      Load More ({patients.length - visiblePatientsCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Patient Form Fields */}
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Location"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Visit Type *
                </label>
                <select
                  required
                  value={formData.visitType}
                  onChange={(e) => setFormData({ ...formData, visitType: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="video">Video</option>
                  <option value="phone">Phone</option>
                  <option value="async">Async</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Service Type
                </label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="consultation">Consultation</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#164e4e] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            {patientMode === 'create' && (
              <button
                type="button"
                disabled={creating || !formData.firstName || !formData.lastName}
                onClick={handleSavePatientOnly}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Saving...' : '💾 Save Patient Only'}
              </button>
            )}
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Appointment'}
            </button>
          </div>
              </form>
          </div>
        </div>
      </div>
    </>
  )
}




