'use client'

import { useState, useRef, useEffect } from 'react'
import { X, GripHorizontal, Calendar, Clock, Video, Phone, MessageSquare, User, FileText, ArrowLeft, Pill, Stethoscope, ClipboardList, Heart, Activity, Thermometer, Scale, AlertTriangle, TestTube, Upload, ExternalLink, UserCheck, MapPin, Mail, PhoneCall, Shield, History, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Reference colors from design:
// --cyan:#00e6ff; --mint:#19d67f; --amber:#f5a524; --pink:#ff7ad6;
// --panel:#0d1424; --panel2:#0b1222; --line:#1b2b4d;

interface Appointment {
  id: string
  visit_type: string | null
  requested_date_time: string | null
  status: string | null
  created_at: string
  chief_complaint?: string | null
  doctor_notes?: string | null
  doctors?: {
    first_name?: string
    last_name?: string
  } | null
}

interface AppointmentDetail {
  id: string
  visit_type: string | null
  requested_date_time: string | null
  status: string | null
  created_at: string
  chief_complaint?: string | null
  doctor_notes?: string | null
  zoom_meeting_url?: string | null
  intake_answers?: any | null
  doctors?: {
    first_name?: string
    last_name?: string
    specialty?: string
    npi?: string
  } | null
  patients?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    date_of_birth?: string
    gender?: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    allergies?: string
    current_medications?: string
    medical_history?: string
    insurance_provider?: string
    insurance_member_id?: string
  } | null
  clinical_notes?: Array<{
    id: string
    note_type: string
    content: string
    created_at: string
  }>
  prescriptions?: Array<{
    id: string
    medication: string
    sig: string
    quantity: number
    refills: number
    status: string
    pharmacy_name?: string
    created_at: string
  }>
  problems?: Array<{
    id: string
    problem: string
    status: string
    onset_date?: string
  }>
  vitals?: {
    blood_pressure?: string
    heart_rate?: string
    temperature?: string
    weight?: string
    height?: string
    bmi?: string
    oxygen_saturation?: string
    respiratory_rate?: string
  } | null
  lab_orders?: Array<{
    id: string
    test_name: string
    status: string
    ordered_at: string
    results?: string
  }>
  documents?: Array<{
    id: string
    file_name: string
    file_type: string
    uploaded_at: string
    url?: string
  }>
  referrals?: Array<{
    id: string
    specialty: string
    reason: string
    status: string
    provider_name?: string
  }>
}

interface AppointmentsOverlayPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  patientDOB?: string
}

export default function AppointmentsOverlayPanel({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientDOB
}: AppointmentsOverlayPanelProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    'visit-info', 'patient-info', 'vitals', 'clinical-notes', 'prescriptions', 'problems'
  ]))

  // Draggable state
  const [position, setPosition] = useState({ x: 100, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch appointments when panel opens
  useEffect(() => {
    if (isOpen && patientId) {
      fetchAppointments()
    }
  }, [isOpen, patientId])

  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          visit_type,
          requested_date_time,
          status,
          created_at,
          chief_complaint,
          doctor_notes,
          doctors (
            first_name,
            last_name
          )
        `)
        .eq('patient_id', patientId)
        .order('requested_date_time', { ascending: false })

      if (error) throw error
      setAppointments(data || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAppointmentDetail = async (appointmentId: string) => {
    setLoadingDetail(true)
    try {
      // Fetch appointment with patient and doctor data
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          id,
          visit_type,
          requested_date_time,
          status,
          created_at,
          chief_complaint,
          doctor_notes,
          zoom_meeting_url,
          intake_answers,
          doctors (
            first_name,
            last_name,
            specialty,
            npi
          ),
          patients (
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            gender,
            address,
            city,
            state,
            zip_code,
            allergies,
            current_medications,
            medical_history,
            insurance_provider,
            insurance_member_id
          )
        `)
        .eq('id', appointmentId)
        .single()

      if (appointmentError) throw appointmentError

      // Fetch clinical notes
      const { data: notesData } = await supabase
        .from('clinical_notes')
        .select('id, note_type, content, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true })

      // Fetch prescriptions
      const { data: rxData } = await supabase
        .from('prescription_logs')
        .select('id, medication, sig, quantity, refills, status, pharmacy_name, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })

      // Fetch problems for this patient
      const { data: problemsData } = await supabase
        .from('patient_problems')
        .select('id, problem, status, onset_date')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      // Fetch lab orders
      const { data: labData } = await supabase
        .from('lab_orders')
        .select('id, test_name, status, created_at, results')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })

      // Fetch documents
      const { data: docsData } = await supabase
        .from('appointment_documents')
        .select('id, file_name, file_type, created_at, url')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })

      // Fetch referrals
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('id, specialty, reason, status, provider_name')
        .eq('appointment_id', appointmentId)

      // Parse vitals from intake_answers if available
      let vitals = null
      if (appointmentData.intake_answers) {
        const intake = typeof appointmentData.intake_answers === 'string' 
          ? JSON.parse(appointmentData.intake_answers) 
          : appointmentData.intake_answers
        
        vitals = {
          blood_pressure: intake.blood_pressure || intake.bp,
          heart_rate: intake.heart_rate || intake.pulse,
          temperature: intake.temperature || intake.temp,
          weight: intake.weight,
          height: intake.height,
          bmi: intake.bmi,
          oxygen_saturation: intake.oxygen_saturation || intake.spo2,
          respiratory_rate: intake.respiratory_rate
        }
      }

      setSelectedAppointment({
        ...appointmentData,
        clinical_notes: notesData || [],
        prescriptions: rxData || [],
        problems: problemsData || [],
        vitals,
        lab_orders: labData || [],
        documents: docsData || [],
        referrals: referralsData || []
      })
    } catch (error) {
      console.error('Error fetching appointment detail:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleViewDetails = (appointmentId: string) => {
    fetchAppointmentDetail(appointmentId)
  }

  const handleBackToList = () => {
    setSelectedAppointment(null)
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  // Section Header Component
  const SectionHeader = ({ id, title, icon, count }: { id: string, title: string, icon: React.ReactNode, count?: number }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors rounded-t-xl"
      style={{ background: '#070c18' }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[#e6f4ff] font-bold">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#00e6ff]/20 text-[#00e6ff]">{count}</span>
        )}
      </div>
      {expandedSections.has(id) ? (
        <ChevronUp className="h-4 w-4 text-[#98b1c9]" />
      ) : (
        <ChevronDown className="h-4 w-4 text-[#98b1c9]" />
      )}
    </button>
  )

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      const rect = panelRef.current?.getBoundingClientRect()
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y)
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getVisitTypeIcon = (visitType?: string | null) => {
    switch (visitType?.toLowerCase()) {
      case 'video':
        return <Video className="h-4 w-4 text-[#00e6ff]" />
      case 'phone':
        return <Phone className="h-4 w-4 text-[#19d67f]" />
      case 'async':
        return <MessageSquare className="h-4 w-4 text-[#b07aff]" />
      default:
        return <User className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status?: string | null) => {
    const statusLower = status?.toLowerCase()
    let bgColor = '#0a1732'
    let textColor = '#cfe1ff'
    let borderColor = '#1b2b4d'

    switch (statusLower) {
      case 'pending':
        bgColor = 'rgba(245, 165, 36, 0.2)'
        textColor = '#f5a524'
        borderColor = '#f5a524'
        break
      case 'accepted':
      case 'confirmed':
        bgColor = 'rgba(25, 214, 127, 0.2)'
        textColor = '#19d67f'
        borderColor = '#19d67f'
        break
      case 'completed':
        bgColor = 'rgba(0, 230, 255, 0.2)'
        textColor = '#00e6ff'
        borderColor = '#00e6ff'
        break
      case 'cancelled':
      case 'rejected':
        bgColor = 'rgba(255, 122, 214, 0.2)'
        textColor = '#ff7ad6'
        borderColor = '#ff7ad6'
        break
    }

    return (
      <span 
        className="inline-flex px-2 py-0.5 text-xs rounded-full"
        style={{ background: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
      >
        {status || 'Unknown'}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[60]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Backdrop - reduced opacity so appointment content shows through */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute overflow-hidden flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: '700px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 100px)',
          cursor: isDragging ? 'grabbing' : 'default',
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          borderRadius: '16px',
          boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div 
          className="drag-handle sticky top-0 z-10 cursor-grab active:cursor-grabbing"
          style={{ 
            background: '#070c18b3', 
            backdropFilter: 'blur(8px)', 
            borderBottom: '1px solid #1b2b4d',
            padding: '10px 16px'
          }}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5 text-gray-500" />
            
            {selectedAppointment ? (
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1.5 text-[#00e6ff] hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #00e6ff, #007a86 40%, #00171a 70%)',
                    boxShadow: '0 0 24px #00e6ff88, inset 0 0 10px #00e6ff33'
                  }}
                />
                <span className="font-black text-[#e6f4ff]">Patient Appointments</span>
              </div>
            )}
            
            {/* Patient pills */}
            <span 
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
              style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
            >
              {patientName}
            </span>
            {patientDOB && (
              <span 
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                style={{ background: '#0a1732', border: '1px solid #1b2b4d', color: '#cfe1ff' }}
              >
                DOB {formatDate(patientDOB)}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="text-[#98b1c9] hover:text-white transition-colors p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedAppointment ? (
            // MINI PATIENT CHART - Comprehensive Appointment Detail View
            <div className="space-y-3">
              {loadingDetail ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00e6ff] mx-auto mb-2"></div>
                  <p className="text-[#98b1c9] text-sm">Loading visit details...</p>
                </div>
              ) : (
                <>
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* VISIT INFORMATION HEADER */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #00e6ff44'
                  }}>
                    <SectionHeader 
                      id="visit-info" 
                      title="Visit Information" 
                      icon={<Calendar className="h-4 w-4 text-[#00e6ff]" />} 
                    />
                    {expandedSections.has('visit-info') && (
                      <div className="p-4 pt-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-[#e6f4ff] font-bold text-lg flex items-center gap-2">
                              {getVisitTypeIcon(selectedAppointment.visit_type)}
                              {selectedAppointment.chief_complaint || 'Appointment'}
                            </h3>
                            <p className="text-[#98b1c9] text-sm mt-1">
                              Visit Type: {selectedAppointment.visit_type || 'N/A'}
                            </p>
                          </div>
                          {getStatusBadge(selectedAppointment.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                            <span className="text-[#98b1c9] text-xs">Date & Time</span>
                            <p className="text-[#e6f4ff] font-medium">{formatDateTime(selectedAppointment.requested_date_time)}</p>
                          </div>
                          <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                            <span className="text-[#98b1c9] text-xs">Created</span>
                            <p className="text-[#e6f4ff] font-medium">{formatDateTime(selectedAppointment.created_at)}</p>
                          </div>
                          {selectedAppointment.doctors && (
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs">Provider</span>
                              <p className="text-[#e6f4ff] font-medium">
                                Dr. {selectedAppointment.doctors.first_name} {selectedAppointment.doctors.last_name}
                              </p>
                              {selectedAppointment.doctors.specialty && (
                                <p className="text-[#98b1c9] text-xs">{selectedAppointment.doctors.specialty}</p>
                              )}
                            </div>
                          )}
                          <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                            <span className="text-[#98b1c9] text-xs">Appointment ID</span>
                            <p className="text-[#e6f4ff] font-medium text-xs font-mono">{selectedAppointment.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* PATIENT DEMOGRAPHICS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {selectedAppointment.patients && (
                    <section style={{ 
                      background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                    }}>
                      <SectionHeader 
                        id="patient-info" 
                        title="Patient Demographics" 
                        icon={<User className="h-4 w-4 text-[#19d67f]" />} 
                      />
                      {expandedSections.has('patient-info') && (
                        <div className="p-4 pt-0">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1">
                                <UserCheck className="h-3 w-3" /> Name
                              </span>
                              <p className="text-[#e6f4ff] font-medium">
                                {selectedAppointment.patients.first_name} {selectedAppointment.patients.last_name}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> DOB / Age
                              </span>
                              <p className="text-[#e6f4ff] font-medium">
                                {formatDate(selectedAppointment.patients.date_of_birth)}
                                {selectedAppointment.patients.date_of_birth && (
                                  <span className="text-[#98b1c9] ml-1">
                                    ({Math.floor((Date.now() - new Date(selectedAppointment.patients.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} y/o)
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs">Gender</span>
                              <p className="text-[#e6f4ff] font-medium capitalize">{selectedAppointment.patients.gender || 'N/A'}</p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1">
                                <Mail className="h-3 w-3" /> Email
                              </span>
                              <p className="text-[#e6f4ff] font-medium text-xs">{selectedAppointment.patients.email || 'N/A'}</p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" /> Phone
                              </span>
                              <p className="text-[#e6f4ff] font-medium">{selectedAppointment.patients.phone || 'N/A'}</p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Address
                              </span>
                              <p className="text-[#e6f4ff] font-medium text-xs">
                                {selectedAppointment.patients.address ? (
                                  `${selectedAppointment.patients.address}, ${selectedAppointment.patients.city}, ${selectedAppointment.patients.state} ${selectedAppointment.patients.zip_code}`
                                ) : 'N/A'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Insurance */}
                          {(selectedAppointment.patients.insurance_provider || selectedAppointment.patients.insurance_member_id) && (
                            <div className="mt-3 p-2 rounded-lg border border-[#1b2b4d]" style={{ background: '#0a1732' }}>
                              <span className="text-[#98b1c9] text-xs flex items-center gap-1 mb-1">
                                <Shield className="h-3 w-3" /> Insurance
                              </span>
                              <p className="text-[#e6f4ff] font-medium">
                                {selectedAppointment.patients.insurance_provider || 'N/A'}
                                {selectedAppointment.patients.insurance_member_id && (
                                  <span className="text-[#98b1c9] ml-2">ID: {selectedAppointment.patients.insurance_member_id}</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* VITALS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                  }}>
                    <SectionHeader 
                      id="vitals" 
                      title="Vitals" 
                      icon={<Activity className="h-4 w-4 text-[#ff7ad6]" />} 
                    />
                    {expandedSections.has('vitals') && (
                      <div className="p-4 pt-0">
                        {selectedAppointment.vitals && Object.values(selectedAppointment.vitals).some(v => v) ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {selectedAppointment.vitals.blood_pressure && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Heart className="h-4 w-4 text-[#ff7ad6] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">BP</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.blood_pressure}</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.heart_rate && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Activity className="h-4 w-4 text-[#00e6ff] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">HR</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.heart_rate} bpm</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.temperature && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Thermometer className="h-4 w-4 text-[#f5a524] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">Temp</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.temperature}°F</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.weight && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Scale className="h-4 w-4 text-[#19d67f] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">Weight</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.weight} lbs</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.height && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <User className="h-4 w-4 text-[#b07aff] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">Height</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.height}</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.oxygen_saturation && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Activity className="h-4 w-4 text-[#00e6ff] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">SpO2</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.oxygen_saturation}%</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.respiratory_rate && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Activity className="h-4 w-4 text-[#19d67f] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">RR</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.respiratory_rate}/min</p>
                              </div>
                            )}
                            {selectedAppointment.vitals.bmi && (
                              <div className="p-2 rounded-lg text-center" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <Scale className="h-4 w-4 text-[#f5a524] mx-auto mb-1" />
                                <p className="text-[#98b1c9] text-xs">BMI</p>
                                <p className="text-[#e6f4ff] font-bold">{selectedAppointment.vitals.bmi}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[#98b1c9] text-sm text-center py-2">No vitals recorded for this visit</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* ALLERGIES & CURRENT MEDICATIONS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {selectedAppointment.patients && (selectedAppointment.patients.allergies || selectedAppointment.patients.current_medications) && (
                    <section style={{ 
                      background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #ff7ad644'
                    }}>
                      <SectionHeader 
                        id="allergies" 
                        title="Allergies & Current Medications" 
                        icon={<AlertTriangle className="h-4 w-4 text-[#ff7ad6]" />} 
                      />
                      {expandedSections.has('allergies') && (
                        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 122, 214, 0.1)', border: '1px solid #ff7ad644' }}>
                            <p className="text-[#ff7ad6] text-xs font-semibold mb-1">⚠️ ALLERGIES</p>
                            <p className="text-[#e6f4ff] text-sm whitespace-pre-wrap">
                              {selectedAppointment.patients.allergies || 'NKDA (No Known Drug Allergies)'}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                            <p className="text-[#00e6ff] text-xs font-semibold mb-1">💊 CURRENT MEDICATIONS</p>
                            <p className="text-[#e6f4ff] text-sm whitespace-pre-wrap">
                              {selectedAppointment.patients.current_medications || 'None reported'}
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* CLINICAL NOTES (SOAP) */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                  }}>
                    <SectionHeader 
                      id="clinical-notes" 
                      title="Clinical Notes" 
                      icon={<Stethoscope className="h-4 w-4 text-[#00e6ff]" />}
                      count={selectedAppointment.clinical_notes?.length}
                    />
                    {expandedSections.has('clinical-notes') && (
                      <div className="p-4 pt-0">
                        {selectedAppointment.clinical_notes && selectedAppointment.clinical_notes.length > 0 ? (
                          <div className="space-y-3">
                            {selectedAppointment.clinical_notes.map((note, idx) => (
                              <div key={note.id || idx} className="p-3 rounded-lg" style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[#00e6ff] text-xs font-semibold uppercase">
                                    {note.note_type.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[#98b1c9] text-xs">{formatDateTime(note.created_at)}</p>
                                </div>
                                <p className="text-[#cfe1ff] text-sm whitespace-pre-wrap">{note.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[#98b1c9] text-sm text-center py-2">No clinical notes recorded</p>
                        )}
                        
                        {/* Doctor Notes */}
                        {selectedAppointment.doctor_notes && (
                          <div className="mt-3 p-3 rounded-lg" style={{ background: '#0a1732', border: '1px solid #00e6ff44' }}>
                            <p className="text-[#00e6ff] text-xs font-semibold mb-2">📝 ADDITIONAL NOTES</p>
                            <p className="text-[#cfe1ff] text-sm whitespace-pre-wrap">{selectedAppointment.doctor_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* PROBLEMS LIST */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                  }}>
                    <SectionHeader 
                      id="problems" 
                      title="Problems List" 
                      icon={<ClipboardList className="h-4 w-4 text-[#f5a524]" />}
                      count={selectedAppointment.problems?.length}
                    />
                    {expandedSections.has('problems') && (
                      <div className="p-4 pt-0">
                        {selectedAppointment.problems && selectedAppointment.problems.length > 0 ? (
                          <div className="space-y-2">
                            {selectedAppointment.problems.map((problem, idx) => (
                              <div 
                                key={problem.id || idx} 
                                className="flex items-center justify-between p-2 rounded-lg"
                                style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${problem.status === 'active' ? 'bg-[#f5a524]' : 'bg-[#19d67f]'}`}></span>
                                  <span className="text-[#e6f4ff] text-sm">{problem.problem}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {problem.onset_date && (
                                    <span className="text-[#98b1c9] text-xs">Since {formatDate(problem.onset_date)}</span>
                                  )}
                                  <span 
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ 
                                      background: problem.status === 'active' ? 'rgba(245, 165, 36, 0.2)' : 'rgba(25, 214, 127, 0.2)',
                                      color: problem.status === 'active' ? '#f5a524' : '#19d67f'
                                    }}
                                  >
                                    {problem.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[#98b1c9] text-sm text-center py-2">No problems documented</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* PRESCRIPTIONS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #19d67f44'
                  }}>
                    <SectionHeader 
                      id="prescriptions" 
                      title="Prescriptions" 
                      icon={<Pill className="h-4 w-4 text-[#19d67f]" />}
                      count={selectedAppointment.prescriptions?.length}
                    />
                    {expandedSections.has('prescriptions') && (
                      <div className="p-4 pt-0">
                        {selectedAppointment.prescriptions && selectedAppointment.prescriptions.length > 0 ? (
                          <div className="space-y-2">
                            {selectedAppointment.prescriptions.map((rx, idx) => (
                              <div 
                                key={rx.id || idx} 
                                className="p-3 rounded-lg"
                                style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-[#e6f4ff] font-bold text-sm">{rx.medication}</p>
                                    <p className="text-[#98b1c9] text-xs mt-1">{rx.sig}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-[#98b1c9]">
                                      <span>Qty: {rx.quantity}</span>
                                      <span>Refills: {rx.refills}</span>
                                      {rx.pharmacy_name && <span>📍 {rx.pharmacy_name}</span>}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span 
                                      className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ 
                                        background: rx.status === 'sent' ? 'rgba(25, 214, 127, 0.2)' : 'rgba(245, 165, 36, 0.2)',
                                        color: rx.status === 'sent' ? '#19d67f' : '#f5a524'
                                      }}
                                    >
                                      {rx.status}
                                    </span>
                                    <p className="text-[#98b1c9] text-xs mt-1">{formatDate(rx.created_at)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[#98b1c9] text-sm text-center py-2">No prescriptions for this visit</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* LAB ORDERS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  <section style={{ 
                    background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                  }}>
                    <SectionHeader 
                      id="labs" 
                      title="Lab Orders" 
                      icon={<TestTube className="h-4 w-4 text-[#b07aff]" />}
                      count={selectedAppointment.lab_orders?.length}
                    />
                    {expandedSections.has('labs') && (
                      <div className="p-4 pt-0">
                        {selectedAppointment.lab_orders && selectedAppointment.lab_orders.length > 0 ? (
                          <div className="space-y-2">
                            {selectedAppointment.lab_orders.map((lab, idx) => (
                              <div 
                                key={lab.id || idx} 
                                className="flex items-center justify-between p-2 rounded-lg"
                                style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                              >
                                <div>
                                  <p className="text-[#e6f4ff] text-sm font-medium">{lab.test_name}</p>
                                  <p className="text-[#98b1c9] text-xs">{formatDate(lab.ordered_at)}</p>
                                </div>
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ 
                                    background: lab.status === 'completed' ? 'rgba(25, 214, 127, 0.2)' : 'rgba(245, 165, 36, 0.2)',
                                    color: lab.status === 'completed' ? '#19d67f' : '#f5a524'
                                  }}
                                >
                                  {lab.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[#98b1c9] text-sm text-center py-2">No lab orders for this visit</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* REFERRALS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {selectedAppointment.referrals && selectedAppointment.referrals.length > 0 && (
                    <section style={{ 
                      background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                    }}>
                      <SectionHeader 
                        id="referrals" 
                        title="Referrals" 
                        icon={<ExternalLink className="h-4 w-4 text-[#00e6ff]" />}
                        count={selectedAppointment.referrals.length}
                      />
                      {expandedSections.has('referrals') && (
                        <div className="p-4 pt-0 space-y-2">
                          {selectedAppointment.referrals.map((ref, idx) => (
                            <div 
                              key={ref.id || idx} 
                              className="p-2 rounded-lg"
                              style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[#e6f4ff] text-sm font-medium">{ref.specialty}</p>
                                  <p className="text-[#98b1c9] text-xs">{ref.reason}</p>
                                  {ref.provider_name && <p className="text-[#00e6ff] text-xs">To: {ref.provider_name}</p>}
                                </div>
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ 
                                    background: ref.status === 'completed' ? 'rgba(25, 214, 127, 0.2)' : 'rgba(245, 165, 36, 0.2)',
                                    color: ref.status === 'completed' ? '#19d67f' : '#f5a524'
                                  }}
                                >
                                  {ref.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* DOCUMENTS */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {selectedAppointment.documents && selectedAppointment.documents.length > 0 && (
                    <section style={{ 
                      background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                    }}>
                      <SectionHeader 
                        id="documents" 
                        title="Documents" 
                        icon={<Upload className="h-4 w-4 text-[#f5a524]" />}
                        count={selectedAppointment.documents.length}
                      />
                      {expandedSections.has('documents') && (
                        <div className="p-4 pt-0 space-y-2">
                          {selectedAppointment.documents.map((doc, idx) => (
                            <div 
                              key={doc.id || idx} 
                              className="flex items-center justify-between p-2 rounded-lg"
                              style={{ background: '#0a1732', border: '1px solid #1b2b4d' }}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#f5a524]" />
                                <div>
                                  <p className="text-[#e6f4ff] text-sm">{doc.file_name}</p>
                                  <p className="text-[#98b1c9] text-xs">{doc.file_type} · {formatDate(doc.uploaded_at)}</p>
                                </div>
                              </div>
                              {doc.url && (
                                <a 
                                  href={doc.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[#00e6ff] text-xs hover:underline"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {/* MEDICAL HISTORY (from patient record) */}
                  {/* ═══════════════════════════════════════════════════════════════════════ */}
                  {selectedAppointment.patients?.medical_history && (
                    <section style={{ 
                      background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
                    }}>
                      <SectionHeader 
                        id="medical-history" 
                        title="Medical History" 
                        icon={<History className="h-4 w-4 text-[#98b1c9]" />}
                      />
                      {expandedSections.has('medical-history') && (
                        <div className="p-4 pt-0">
                          <p className="text-[#cfe1ff] text-sm whitespace-pre-wrap">{selectedAppointment.patients.medical_history}</p>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          ) : (
            // Appointments List View
            <section 
              className="p-4"
              style={{ 
                background: 'linear-gradient(180deg, #0d1424, #0b1222)',
                borderRadius: '16px',
                boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d'
              }}
            >
              <h3 className="text-[#e6f4ff] font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#00e6ff]" />
                Appointments ({appointments.length})
              </h3>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00e6ff] mx-auto mb-2"></div>
                  <p className="text-[#98b1c9] text-sm">Loading appointments...</p>
                </div>
              ) : appointments.length === 0 ? (
                <div className="p-8 text-center text-[#98b1c9] text-sm">
                  No appointments found for this patient.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {appointments.map((appt) => (
                    <div 
                      key={appt.id}
                      className="p-3 rounded-xl transition-colors hover:bg-white/5"
                      style={{ 
                        background: '#0a1732', 
                        border: '1px solid #1b2b4d'
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#e6f4ff] font-bold">
                              {appt.chief_complaint || 'Appointment'}
                            </span>
                            {getStatusBadge(appt.status)}
                          </div>
                          <div className="flex items-center gap-2 text-[#98b1c9] text-sm mb-1">
                            {getVisitTypeIcon(appt.visit_type)}
                            <span>Visit Type: {appt.visit_type || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#98b1c9] text-sm">
                            <Clock className="h-3 w-3" />
                            <span>Date: {formatDateTime(appt.requested_date_time)}</span>
                          </div>
                          <div className="text-[#98b1c9] text-xs mt-1">
                            Created: {formatDateTime(appt.created_at)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewDetails(appt.id)}
                          className="font-extrabold px-3.5 py-2 rounded-xl text-sm transition-transform hover:-translate-y-0.5"
                          style={{
                            background: 'linear-gradient(90deg, #00e6ff, #86f3ff)',
                            color: '#021018',
                            boxShadow: '0 0 0 2px #00e6ff33'
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
