'use client'

import { useState, useRef, useEffect } from 'react'
import { X, GripHorizontal, Calendar, ArrowLeft, Video, Phone, MessageSquare, User, FileText, Pill, Stethoscope, ClipboardList, Heart, Activity, Thermometer, Scale, AlertTriangle, TestTube, Upload, ChevronDown, ChevronUp, Clock, MapPin, Mail, Shield, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Appointment {
  id: string
  status: string
  service_type: string
  visit_type: string
  created_at: string
  requested_date_time: string | null
}

interface AppointmentDetail {
  id: string
  visit_type: string | null
  requested_date_time: string | null
  status: string | null
  created_at: string
  chief_complaint?: string | null
  subjective_notes?: string | null
  objective_notes?: string | null
  assessment_notes?: string | null
  plan_notes?: string | null
  service_type?: string | null
  doctors?: {
    first_name?: string
    last_name?: string
    specialty?: string
  } | null
  patients?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    date_of_birth?: string
  } | null
}

interface AppointmentsOverlayPanelProps {
  isOpen: boolean
  onClose: () => void
  patientName: string
  patientDOB?: string
  appointments: Appointment[]
  onViewAppointment: (appointmentId: string) => void
}

export default function AppointmentsOverlayPanel({
  isOpen,
  onClose,
  patientName,
  patientDOB,
  appointments,
  onViewAppointment
}: AppointmentsOverlayPanelProps) {
  // Selected appointment for mini chart view
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [clinicalNotes, setClinicalNotes] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [problems, setProblems] = useState<any[]>([])
  const [labOrders, setLabOrders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [referrals, setReferrals] = useState<any[]>([])
  
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    'visit-info', 'patient-demographics', 'soap-notes', 'clinical-notes', 'prescriptions'
  ]))

  // Draggable state
  const [position, setPosition] = useState({ x: 60, y: 30 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAppointment(null)
      setFetchError(null)
      setClinicalNotes([])
      setPrescriptions([])
      setProblems([])
      setLabOrders([])
      setDocuments([])
      setReferrals([])
    }
  }, [isOpen])

  const fetchAppointmentDetail = async (appointmentId: string) => {
    setLoadingDetail(true)
    setFetchError(null)
    console.log('Fetching appointment detail for:', appointmentId)
    
    try {
      // Fetch appointment with patient and doctor data
      // Using explicit foreign key pattern for reliability
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          doctor_id,
          visit_type,
          requested_date_time,
          status,
          created_at,
          chief_complaint,
          subjective_notes,
          objective_notes,
          assessment_notes,
          plan_notes,
          service_type,
          doctors!appointments_doctor_id_fkey (
            first_name,
            last_name,
            specialty
          ),
          patients!appointments_patient_id_fkey (
            first_name,
            last_name,
            email,
            phone,
            date_of_birth
          )
        `)
        .eq('id', appointmentId)
        .single()

      console.log('Appointment query result:', { appointmentData, appointmentError })

      if (appointmentError) {
        console.error('Appointment query error:', appointmentError)
        setFetchError(`Failed to load appointment: ${appointmentError.message}`)
        setLoadingDetail(false)
        return
      }

      if (!appointmentData) {
        setFetchError('Appointment not found')
        setLoadingDetail(false)
        return
      }

      // Transform Supabase array joins to objects
      const transformed = {
        ...appointmentData,
        doctors: Array.isArray(appointmentData.doctors) ? appointmentData.doctors[0] || null : appointmentData.doctors,
        patients: Array.isArray(appointmentData.patients) ? appointmentData.patients[0] || null : appointmentData.patients
      }

      console.log('Transformed appointment:', transformed)
      setSelectedAppointment(transformed)

      // Fetch clinical notes
      const { data: notesData } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      setClinicalNotes(notesData || [])

      // Fetch prescription logs
      const { data: rxData } = await supabase
        .from('prescription_logs')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      setPrescriptions(rxData || [])

      // Fetch problems for this patient
      if (transformed.patients && appointmentData.patient_id) {
        const { data: problemsData } = await supabase
          .from('problems')
          .select('*')
          .eq('patient_id', appointmentData.patient_id)
          .order('created_at', { ascending: false })
        setProblems(problemsData || [])
      }

      // Fetch lab orders
      const { data: labData } = await supabase
        .from('lab_orders')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      setLabOrders(labData || [])

      // Fetch documents
      const { data: docsData } = await supabase
        .from('files')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      setDocuments(docsData || [])

      // Fetch referrals
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('*')
        .eq('appointment_id', appointmentId)
      setReferrals(referralsData || [])

    } catch (error: any) {
      console.error('Error fetching appointment detail:', error)
      setFetchError(error?.message || 'Failed to load appointment details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleViewMiniChart = (appointmentId: string) => {
    fetchAppointmentDetail(appointmentId)
  }

  const handleBackToList = () => {
    setSelectedAppointment(null)
    setFetchError(null)
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

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const getVisitTypeIcon = (visitType: string | null) => {
    switch (visitType?.toLowerCase()) {
      case 'video': return <Video className="h-4 w-4 text-cyan-400" />
      case 'phone': return <Phone className="h-4 w-4 text-green-400" />
      case 'chat': return <MessageSquare className="h-4 w-4 text-purple-400" />
      default: return <User className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string | null) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return colors[status || ''] || 'bg-gray-100 text-gray-800'
  }

  // Parse vitals from intake_answers
  const parseVitals = (intake: any) => {
    if (!intake) return null
    const parsed = typeof intake === 'string' ? JSON.parse(intake) : intake
    return {
      blood_pressure: parsed.blood_pressure || parsed.bp,
      heart_rate: parsed.heart_rate || parsed.pulse || parsed.hr,
      temperature: parsed.temperature || parsed.temp,
      weight: parsed.weight,
      height: parsed.height,
      oxygen_saturation: parsed.oxygen_saturation || parsed.spo2,
      respiratory_rate: parsed.respiratory_rate || parsed.rr
    }
  }

  // Section Header Component
  const SectionHeader = ({ id, title, icon: Icon, count, color = 'cyan' }: { 
    id: string, title: string, icon: any, count?: number, color?: string 
  }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-3 rounded-t-lg transition-colors hover:bg-white/5"
      style={{ background: '#0a1732', borderBottom: '1px solid #1b2b4d' }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: color === 'cyan' ? '#00e6ff' : color === 'pink' ? '#ff7ad6' : color === 'green' ? '#19d67f' : color === 'orange' ? '#f5a524' : '#00e6ff' }} />
        <span className="font-semibold text-white text-sm">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#1b2b4d] text-[#00e6ff]">{count}</span>
        )}
      </div>
      {expandedSections.has(id) ? (
        <ChevronUp className="h-4 w-4 text-gray-400" />
      ) : (
        <ChevronDown className="h-4 w-4 text-gray-400" />
      )}
    </button>
  )

  if (!isOpen) return null

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />
      
      {/* Draggable Panel */}
      <div
        ref={panelRef}
        className="fixed z-[60] overflow-hidden flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: selectedAppointment ? '900px' : '700px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 60px)',
          cursor: isDragging ? 'grabbing' : 'default',
          background: 'linear-gradient(180deg, #0d1424, #0b1222)',
          borderRadius: '16px',
          boxShadow: '0 12px 60px rgba(0,0,0,.45), inset 0 0 0 1px #1b2b4d',
          transition: 'width 0.3s ease'
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
            
            {(selectedAppointment || fetchError) ? (
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1.5 text-[#00e6ff] hover:text-white transition-colors text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Appointments
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-400" />
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
            
            {selectedAppointment && (
              <button
                onClick={() => onViewAppointment(selectedAppointment.id)}
                className="ml-auto mr-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Open Full Chart
              </button>
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
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            </div>
          ) : fetchError ? (
            /* Error State */
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-red-400 mb-4">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                <p className="text-lg font-medium">Error Loading Appointment</p>
                <p className="text-sm text-gray-400 mt-2">{fetchError}</p>
              </div>
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
              >
                Back to Appointments
              </button>
            </div>
          ) : selectedAppointment ? (
            /* ═══════════════════════════════════════════════════════════════
               MINI PATIENT CHART VIEW
               ═══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* Visit Information */}
              <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                <SectionHeader id="visit-info" title="Visit Information" icon={Calendar} color="orange" />
                {expandedSections.has('visit-info') && (
                  <div className="p-4 space-y-3" style={{ background: '#0a1220' }}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Date & Time</p>
                        <p className="text-white text-sm font-medium">
                          {selectedAppointment.requested_date_time 
                            ? formatDateTime(selectedAppointment.requested_date_time)
                            : 'Not scheduled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Status</p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusBadge(selectedAppointment.status)}`}>
                          {selectedAppointment.status || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Visit Type</p>
                        <div className="flex items-center gap-2">
                          {getVisitTypeIcon(selectedAppointment.visit_type)}
                          <span className="text-white text-sm capitalize">{selectedAppointment.visit_type || 'N/A'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Service</p>
                        <p className="text-white text-sm">{selectedAppointment.service_type?.replace(/_/g, ' ') || 'N/A'}</p>
                      </div>
                    </div>
                    {selectedAppointment.doctors && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Provider</p>
                        <p className="text-white text-sm">
                          Dr. {selectedAppointment.doctors.first_name} {selectedAppointment.doctors.last_name}
                          {selectedAppointment.doctors.specialty && ` — ${selectedAppointment.doctors.specialty}`}
                        </p>
                      </div>
                    )}
                    {selectedAppointment.chief_complaint && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Chief Complaint</p>
                        <p className="text-white text-sm">{selectedAppointment.chief_complaint}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Patient Demographics */}
              {selectedAppointment.patients && (
                <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                  <SectionHeader id="patient-demographics" title="Patient Demographics" icon={User} color="cyan" />
                  {expandedSections.has('patient-demographics') && (
                    <div className="p-4" style={{ background: '#0a1220' }}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Name</p>
                          <p className="text-white text-sm font-medium">
                            {selectedAppointment.patients.first_name} {selectedAppointment.patients.last_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">DOB / Age</p>
                          <p className="text-white text-sm">
                            {selectedAppointment.patients.date_of_birth 
                              ? `${formatDate(selectedAppointment.patients.date_of_birth)} (${calculateAge(selectedAppointment.patients.date_of_birth)} yrs)`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Phone</p>
                          <p className="text-white text-sm">{selectedAppointment.patients.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Email</p>
                          <p className="text-white text-sm break-all">{selectedAppointment.patients.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Clinical Notes */}
              <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                <SectionHeader id="clinical-notes" title="Clinical Notes" icon={FileText} count={clinicalNotes.length} color="cyan" />
                {expandedSections.has('clinical-notes') && (
                  <div className="p-4" style={{ background: '#0a1220' }}>
                    {clinicalNotes.length === 0 ? (
                      <p className="text-gray-400 text-sm">No clinical notes recorded</p>
                    ) : (
                      <div className="space-y-3">
                        {clinicalNotes.map((note, idx) => (
                          <div key={note.id || idx} className="p-3 rounded-lg bg-[#0d1424] border border-[#1b2b4d]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[#00e6ff] uppercase">{note.note_type || 'Note'}</span>
                              <span className="text-xs text-gray-400">{note.created_at ? formatDateTime(note.created_at) : ''}</span>
                            </div>
                            <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SOAP Notes */}
              {(selectedAppointment.subjective_notes || selectedAppointment.objective_notes || selectedAppointment.assessment_notes || selectedAppointment.plan_notes) && (
                <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                  <SectionHeader id="soap-notes" title="SOAP Notes" icon={Stethoscope} color="cyan" />
                  {expandedSections.has('soap-notes') && (
                    <div className="p-4 space-y-4" style={{ background: '#0a1220' }}>
                      {selectedAppointment.subjective_notes && (
                        <div>
                          <p className="text-xs text-cyan-400 font-medium mb-1">Subjective</p>
                          <p className="text-white text-sm whitespace-pre-wrap">{selectedAppointment.subjective_notes}</p>
                        </div>
                      )}
                      {selectedAppointment.objective_notes && (
                        <div>
                          <p className="text-xs text-green-400 font-medium mb-1">Objective</p>
                          <p className="text-white text-sm whitespace-pre-wrap">{selectedAppointment.objective_notes}</p>
                        </div>
                      )}
                      {selectedAppointment.assessment_notes && (
                        <div>
                          <p className="text-xs text-yellow-400 font-medium mb-1">Assessment</p>
                          <p className="text-white text-sm whitespace-pre-wrap">{selectedAppointment.assessment_notes}</p>
                        </div>
                      )}
                      {selectedAppointment.plan_notes && (
                        <div>
                          <p className="text-xs text-pink-400 font-medium mb-1">Plan</p>
                          <p className="text-white text-sm whitespace-pre-wrap">{selectedAppointment.plan_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prescriptions */}
              <div className="rounded-lg overflow-hidden border border-[#1b4d2b]">
                <SectionHeader id="prescriptions" title="Prescriptions" icon={Pill} count={prescriptions.length} color="green" />
                {expandedSections.has('prescriptions') && (
                  <div className="p-4" style={{ background: '#0a1a12' }}>
                    {prescriptions.length === 0 ? (
                      <p className="text-gray-400 text-sm">No prescriptions for this visit</p>
                    ) : (
                      <div className="space-y-2">
                        {prescriptions.map((rx, idx) => (
                          <div key={rx.id || idx} className="p-3 rounded-lg bg-[#0d1424] border border-[#1b4d2b]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium text-sm">{rx.notes || rx.medication || 'Prescription'}</p>
                                <p className="text-xs text-gray-400 mt-1">{rx.action_at ? formatDateTime(rx.action_at) : ''}</p>
                              </div>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                rx.action === 'sent' ? 'bg-green-100 text-green-800' :
                                rx.action === 'pending' ? 'bg-amber-100 text-amber-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {rx.action || 'created'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Problems List */}
              <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                <SectionHeader id="problems" title="Problems List" icon={ClipboardList} count={problems.length} color="orange" />
                {expandedSections.has('problems') && (
                  <div className="p-4" style={{ background: '#0a1220' }}>
                    {problems.length === 0 ? (
                      <p className="text-gray-400 text-sm">No problems documented</p>
                    ) : (
                      <div className="space-y-2">
                        {problems.map((problem, idx) => (
                          <div key={problem.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-[#0d1424]">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${problem.status === 'active' ? 'bg-amber-400' : 'bg-gray-400'}`} />
                              <span className="text-white text-sm">{problem.problem_name || problem.problem}</span>
                            </div>
                            <span className="text-xs text-gray-400">{problem.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lab Orders */}
              <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                <SectionHeader id="lab-orders" title="Lab Orders" icon={TestTube} count={labOrders.length} color="cyan" />
                {expandedSections.has('lab-orders') && (
                  <div className="p-4" style={{ background: '#0a1220' }}>
                    {labOrders.length === 0 ? (
                      <p className="text-gray-400 text-sm">No lab orders for this visit</p>
                    ) : (
                      <div className="space-y-2">
                        {labOrders.map((lab, idx) => (
                          <div key={lab.id || idx} className="p-3 rounded-lg bg-[#0d1424] border border-[#1b2b4d]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium text-sm">{lab.test_name || lab.order_name || 'Lab Order'}</p>
                                {lab.results && <p className="text-xs text-cyan-300 mt-1">Results: {lab.results}</p>}
                              </div>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                lab.status === 'completed' ? 'bg-green-100 text-green-800' :
                                lab.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {lab.status || 'ordered'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                <SectionHeader id="documents" title="Documents" icon={Upload} count={documents.length} color="cyan" />
                {expandedSections.has('documents') && (
                  <div className="p-4" style={{ background: '#0a1220' }}>
                    {documents.length === 0 ? (
                      <p className="text-gray-400 text-sm">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc, idx) => (
                          <div key={doc.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-[#0d1424]">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-white text-sm">{doc.file_name || doc.name || 'Document'}</span>
                            </div>
                            <span className="text-xs text-gray-400">{doc.file_type || doc.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Referrals */}
              {referrals.length > 0 && (
                <div className="rounded-lg overflow-hidden border border-[#1b2b4d]">
                  <SectionHeader id="referrals" title="Referrals" icon={History} count={referrals.length} color="cyan" />
                  {expandedSections.has('referrals') && (
                    <div className="p-4" style={{ background: '#0a1220' }}>
                      <div className="space-y-2">
                        {referrals.map((ref, idx) => (
                          <div key={ref.id || idx} className="p-3 rounded-lg bg-[#0d1424] border border-[#1b2b4d]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium text-sm">{ref.specialty || 'Referral'}</p>
                                <p className="text-xs text-gray-400 mt-1">{ref.reason}</p>
                                {ref.provider_name && <p className="text-xs text-cyan-300 mt-1">To: {ref.provider_name}</p>}
                              </div>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                ref.status === 'completed' ? 'bg-green-100 text-green-800' :
                                ref.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {ref.status || 'pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               APPOINTMENTS LIST VIEW
               ═══════════════════════════════════════════════════════════════ */
            <div className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Appointments ({appointments.length})</h3>
              {appointments.length === 0 ? (
                <p className="text-gray-400">No appointments found</p>
              ) : (
                <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="bg-slate-700/50 rounded-lg p-4 border border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer"
                      onClick={() => handleViewMiniChart(appointment.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-semibold">
                              {appointment.service_type?.replace(/_/g, ' ') || 'Appointment'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              appointment.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            <p>Visit Type: {appointment.visit_type || 'N/A'}</p>
                            {appointment.requested_date_time && (
                              <p>Date: {formatDateTime(appointment.requested_date_time)}</p>
                            )}
                            <p>Created: {formatDateTime(appointment.created_at)}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewMiniChart(appointment.id)
                          }}
                          className="ml-4 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}










