'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { X, User, Plus, Search } from 'lucide-react'

// Helper function to convert UTC date to Phoenix timezone
function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  
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
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewPatientForm, setShowNewPatientForm] = useState(false)
  const [localSelectedTime, setLocalSelectedTime] = useState<Date | null>(null)
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    location: '',
    visitType: 'video' as 'video' | 'phone' | 'async',
    reason: ''
  })

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize with patient data if provided (for follow-up appointments)
  useEffect(() => {
    if (patientData && isOpen) {
      setSelectedPatient({
        id: patientData.id,
        first_name: patientData.first_name,
        last_name: patientData.last_name,
        email: patientData.email,
        mobile_phone: patientData.mobile_phone
      })
      setFormData(prev => ({
        ...prev,
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        email: patientData.email,
        phone: patientData.mobile_phone
      }))
      setSearch(patientData.first_name + ' ' + patientData.last_name)
    }
  }, [patientData, isOpen])

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPatient(null)
      setSearch('')
      setPatients([])
      setShowNewPatientForm(false)
      setError(null)
      setLocalSelectedTime(null)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        location: '',
        visitType: 'video',
        reason: ''
      })
    }
  }, [isOpen])

  // Search patients with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (search.length < 2) {
      setPatients([])
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPatients(search)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search])

  const searchPatients = async (searchTerm: string) => {
    setLoading(true)
    try {
      // Use string concatenation instead of template literals
      const searchPattern = '%' + searchTerm + '%'
      
      // Supabase .or() expects comma-separated conditions without quotes around values
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, email, mobile_phone, date_of_birth, address')
        .or('first_name.ilike.' + searchPattern + ',last_name.ilike.' + searchPattern + ',email.ilike.' + searchPattern + ',mobile_phone.ilike.' + searchPattern)
        .limit(10)

      if (error) throw error
      setPatients(data || [])
    } catch (err: any) {
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
      const doctorTimezone = 'America/Phoenix'
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          patientId: selectedPatient?.id || null,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dob: formData.dob,
          location: formData.location,
          visitType: formData.visitType,
          reason: formData.reason,
          // Send date components in Phoenix timezone
          dateComponents: {
            year,
            month,
            day,
            hours,
            minutes
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create appointment')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // Generate time slots (5 AM to 8 PM, 30-min intervals)
  const generateTimeSlots = (): Date[] => {
    const slots: Date[] = []
    const doctorTimezone = 'America/Phoenix'
    const phoenixDate = convertToTimezone(selectedDate.toISOString(), doctorTimezone)
    
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Create slot as UTC representing Phoenix time
        const time = new Date(Date.UTC(
          phoenixDate.getUTCFullYear(),
          phoenixDate.getUTCMonth(),
          phoenixDate.getUTCDate(),
          hour,
          minute,
          0
        ))
        slots.push(time)
      }
    }
    return slots
  }

  // Check if slot is booked
  const isSlotBooked = (time: Date): boolean => {
    if (!appointments || appointments.length === 0) return false
    
    const doctorTimezone = 'America/Phoenix'
    const slotHour = time.getUTCHours()
    const slotMinute = time.getUTCMinutes()
    
    return appointments.some(apt => {
      if (!apt.requested_date_time) return false
      const aptDate = convertToTimezone(apt.requested_date_time, doctorTimezone)
      const aptHour = aptDate.getUTCHours()
      const aptMinute = aptDate.getUTCMinutes()
      return aptHour === slotHour && aptMinute === slotMinute
    })
  }

  // Format time for display
  const formatTime = (date: Date): string => {
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return displayHours + ':' + displayMinutes + ' ' + ampm
  }

  // Check if time is currently selected
  const isTimeSelected = (time: Date): boolean => {
    const timeToCompare = localSelectedTime || selectedTime
    return timeToCompare.getUTCHours() === time.getUTCHours() && 
           timeToCompare.getUTCMinutes() === time.getUTCMinutes()
  }

  const handleTimeSelect = (time: Date) => {
    setLocalSelectedTime(time)
    if (onTimeSelect) {
      onTimeSelect(time)
    }
  }

  if (!isOpen) return null

  const timeSlots = generateTimeSlots()

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">
              {editingAppointmentId ? 'Edit Appointment' : 'Create New Appointment'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Patient Selection & Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Patient Information</h3>
                
                {/* Patient Search */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        if (selectedPatient) {
                          setSelectedPatient(null)
                        }
                      }}
                      placeholder="Search existing patients..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  
                  {/* Search Results Dropdown */}
                  {search.length >= 2 && patients.length > 0 && !selectedPatient && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => handlePatientSelect(patient)}
                          className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-white/5 last:border-0"
                        >
                          <div className="font-medium text-white">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {patient.email} • {patient.mobile_phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                    </div>
                  )}
                </div>
                
                {/* Selected Patient Badge */}
                {selectedPatient && (
                  <div className="flex items-center gap-2 p-3 bg-cyan-900/30 border border-cyan-500/30 rounded-lg">
                    <User className="h-5 w-5 text-cyan-400" />
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </div>
                      <div className="text-sm text-gray-400">{selectedPatient.email}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPatient(null)
                        setSearch('')
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
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                )}
                
                {/* New Patient Toggle */}
                {!selectedPatient && (
                  <button
                    onClick={() => setShowNewPatientForm(!showNewPatientForm)}
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                  >
                    <Plus className="h-4 w-4" />
                    {showNewPatientForm ? 'Hide new patient form' : 'Create new patient'}
                  </button>
                )}
                
                {/* Patient Form (shown when new patient or selected) */}
                {(showNewPatientForm || selectedPatient) && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">First Name *</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={formData.dob}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="City, State"
                          className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Visit Type</label>
                      <div className="flex gap-2">
                        {(['video', 'phone', 'async'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, visitType: type })}
                            className={'flex-1 py-2 px-3 rounded-lg border transition-colors ' + 
                              (formData.visitType === type
                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                : 'bg-slate-800 border-white/20 text-gray-300 hover:bg-slate-700')}
                          >
                            {type === 'video' ? '📹 Video' : type === 'phone' ? '📞 Phone' : '📝 Async'}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Reason for Visit</label>
                      <textarea
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        rows={3}
                        placeholder="Brief description of the visit reason..."
                        className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                      />
                    </div>
                    
                    {error && (
                      <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                      </div>
                    )}
                  </form>
                )}
              </div>
              
              {/* Right Column - Time Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Select Time</h3>
                <p className="text-sm text-gray-400">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                
                <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {timeSlots.map((time) => {
                    const booked = isSlotBooked(time)
                    const selected = isTimeSelected(time)
                    
                    return (
                      <button
                        key={time.getTime()}
                        type="button"
                        onClick={() => !booked && handleTimeSelect(time)}
                        disabled={booked}
                        className={'py-2 px-3 rounded-lg text-sm font-medium transition-all ' +
                          (booked
                            ? 'bg-red-900/30 text-red-400 border border-red-500/30 cursor-not-allowed'
                            : selected
                              ? 'bg-cyan-600 text-white border-2 border-cyan-400 shadow-lg shadow-cyan-500/30'
                              : 'bg-slate-800 text-gray-300 border border-white/10 hover:bg-slate-700 hover:border-cyan-500/50')}
                      >
                        {formatTime(time)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={creating || (!selectedPatient && !showNewPatientForm)}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                'Create Appointment'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}




