'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Edit, Save, Calendar, Clock, CheckCircle, XCircle, ArrowRight, RotateCcw, Pill, FileText, ClipboardList, CalendarDays, AlertTriangle, Activity, Mic, Phone, ExternalLink, Lock, Unlock } from 'lucide-react'
import ZoomMeetingEmbed from './ZoomMeetingEmbed'
import MedicalRecordsView from './MedicalRecordsView'
import OrdersPanel from './OrdersPanel'
import PrescriptionHistoryPanel from './PrescriptionHistoryPanel'

// Hooks
import { useAppointmentData } from './appointment/hooks/useAppointmentData'
import { usePrescriptions } from './appointment/hooks/usePrescriptions'
import { useDoctorNotes } from './appointment/hooks/useDoctorNotes'
import { useProblemsMedications } from './appointment/hooks/useProblemsMedications'
import { useCommunication } from './appointment/hooks/useCommunication'
import { useLayoutCustomization } from './appointment/hooks/useLayoutCustomization'
import { useDocumentUpload } from './appointment/hooks/useDocumentUpload'
import { useLabResults } from './appointment/hooks/useLabResults'
import { useReferralsFollowUp } from './appointment/hooks/useReferralsFollowUp'
import { usePriorAuth } from './appointment/hooks/usePriorAuth'

// Sections
import PatientHeader from './appointment/sections/PatientHeader'
import ErxComposer from './appointment/sections/ErxComposer'
import DoctorNotesSection from './appointment/sections/DoctorNotesSection'
import ProblemsMedicationsSection from './appointment/sections/ProblemsMedicationsSection'
import DocumentViewer from './appointment/sections/DocumentViewer'
import LabResultsSection from './appointment/sections/LabResultsSection'
import ReferralsFollowUpSection from './appointment/sections/ReferralsFollowUpSection'
import PriorAuthSection from './appointment/sections/PriorAuthSection'
import CommunicationHistorySection from './appointment/sections/CommunicationHistorySection'
import GmailStyleEmailPanel from './GmailStyleEmailPanel'
import EnhancedSMSPanel from './EnhancedSMSPanel'
import MakeCallFaxPanel from './MakeCallFaxPanel'
import MedicationHistoryPanel from './MedicationHistoryPanel'
import AppointmentsOverlayPanel from './AppointmentsOverlayPanel'

// EHR Panels
import AllergiesPanel from './AllergiesPanel'
import VitalsPanel from './VitalsPanel'
import MedicationsPanel from './MedicationsPanel'

// Utils
import { convertToTimezone, convertDateTimeLocalToUTC } from './appointment/utils/timezone-utils'

// Styles
import '../app/doctor/availability/availability.css'
import DailyMeetingEmbed from './DailycoMeetingPanel'

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

interface AppointmentDetailModalProps {
  appointmentId: string | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: () => void
  onSmsSent?: (message: string) => void
  appointments?: CalendarAppointment[]
  currentDate?: Date
  onAppointmentSwitch?: (appointmentId: string) => void
  onFollowUp?: (patientData: {
    id: string
    first_name: string
    last_name: string
    email: string
    mobile_phone: string
  }, date: Date, time: Date) => void
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// TOOLBAR PANEL DEFINITIONS (for the grouped header bar)
// ═══════════════════════════════════════════════════════════════
const EHR_PANELS = [
  { id: 'medication-history', label: 'Med Hx', icon: Pill, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
  { id: 'orders', label: 'Orders', icon: ClipboardList, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'prescription-history', label: 'Rx Hx', icon: FileText, color: '#14b8a6', hoverBg: 'hover:bg-teal-700' },
  { id: 'appointments', label: 'Appts', icon: CalendarDays, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'allergies', label: 'Allergy', icon: AlertTriangle, color: '#ef4444', hoverBg: 'hover:bg-red-700' },
  { id: 'vitals', label: 'Vitals', icon: Activity, color: '#06b6d4', hoverBg: 'hover:bg-cyan-700' },
  { id: 'medications', label: 'Meds', icon: Pill, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
] as const

export default function AppointmentDetailModal({ 
  appointmentId, 
  isOpen, 
  onClose, 
  onStatusChange,
  onSmsSent,
  appointments = [],
  currentDate,
  onAppointmentSwitch,
  onFollowUp
}: AppointmentDetailModalProps) {
  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING HOOKS — UNCHANGED
  // ═══════════════════════════════════════════════════════════════
  
  const appointmentsIdsString = useMemo(() => 
    appointments.map(a => a.id).sort().join(','), 
    [appointments]
  )
  const stableAppointments = useMemo(() => appointments, [appointmentsIdsString])
  
  const {
    appointment,
    loading,
    error,
    newDateTime,
    setNewDateTime,
    currentUser,
    setAppointment,
    setError,
    fetchAppointmentDetails
  } = useAppointmentData(appointmentId, isOpen, stableAppointments)

  // Sync chart_locked from appointment data
  // Note: chart_locked exists on appointments table but hook type may not include it
  const appointmentChartLocked = (appointment as any)?.chart_locked
  useEffect(() => {
    if (appointmentChartLocked !== undefined) {
      setChartLocked(!!appointmentChartLocked)
    }
  }, [appointmentChartLocked])

  const problemsMedications = useProblemsMedications(
    appointmentId,
    appointment?.patient_id || null
  )

  const prescriptions = usePrescriptions(appointmentId, problemsMedications.medicationHistory)

  const handleMedicationsAutoAdded = useCallback((medications: any[]) => {
    if (medications && medications.length > 0) {
      prescriptions.setRxList(prev => {
        const existingMedications = prev.map(rx => rx.medication.toLowerCase())
        const newMedications = medications.filter(med => 
          !existingMedications.includes(med.medication.toLowerCase())
        )
        return [...prev, ...newMedications]
      })
    }
  }, [prescriptions.setRxList])

  const doctorNotesHook = useDoctorNotes(
    appointmentId,
    appointment,
    problemsMedications.activeProblems,
    problemsMedications.resolvedProblems,
    problemsMedications.medicationHistory,
    problemsMedications.activeMedOrders,
    problemsMedications.pastMedOrders,
    problemsMedications.prescriptionLogs,
    undefined,
    handleMedicationsAutoAdded
  )

  const {
    doctorNotes,
    soapNotes,
    isSigning,
    soapSaveStatus,
    surgeriesDetails,
    cdssResponse,
    isGeneratingCDSS,
    showCDSSResults,
    isApplyingCDSS,
    cdssError,
    handleGenerateCDSS,
    handleApplyCDSS,
    setShowCDSSResults,
    setCdssError,
    checkAndLoadCDSS,
    generateCDSSResponse,
    setDoctorNotes,
    handleSoapNotesChange,
    initializeSoapNotes,
    handleSaveDoctorNotes
  } = doctorNotesHook

  const documentUpload = useDocumentUpload(appointmentId)
  const communication = useCommunication(appointmentId, appointment)
  const labResults = useLabResults(appointmentId, appointment?.patient_id || null)
  const referralsFollowUp = useReferralsFollowUp(appointmentId, appointment, onFollowUp)
  const priorAuth = usePriorAuth(appointmentId, appointment?.patient_id || null)
  const layout = useLayoutCustomization(isOpen)

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING MEMOIZED HANDLERS — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

  const problemsMedicationsHandlers = useMemo(() => ({
    onAddActiveProblem: problemsMedications.handleAddActiveProblem,
    onRemoveActiveProblem: problemsMedications.handleRemoveActiveProblem,
    onAddResolvedProblem: problemsMedications.handleAddResolvedProblem,
    onRemoveResolvedProblem: problemsMedications.handleRemoveResolvedProblem,
    onAddMedicationHistory: problemsMedications.handleAddMedicationHistory,
    onRemoveMedicationHistory: problemsMedications.handleRemoveMedicationHistory,
    onAddPrescriptionLog: problemsMedications.handleAddPrescriptionLog,
    onRemovePrescriptionLog: problemsMedications.handleRemovePrescriptionLog,
  }), [
    problemsMedications.handleAddActiveProblem,
    problemsMedications.handleRemoveActiveProblem,
    problemsMedications.handleAddResolvedProblem,
    problemsMedications.handleRemoveResolvedProblem,
    problemsMedications.handleAddMedicationHistory,
    problemsMedications.handleRemoveMedicationHistory,
    problemsMedications.handleAddPrescriptionLog,
    problemsMedications.handleRemovePrescriptionLog,
  ])

  const prescriptionsHandlers = useMemo(() => ({
    handleAddToRxList: prescriptions.handleAddToRxList,
    handleRemoveFromRxList: prescriptions.handleRemoveFromRxList,
    handleClearRxList: prescriptions.handleClearRxList,
    handleStartEditRx: prescriptions.handleStartEditRx,
    handleCancelEditRx: prescriptions.handleCancelEditRx,
    handleSaveEditRx: prescriptions.handleSaveEditRx,
    handleSendERx: prescriptions.handleSendERx,
    checkDrugInteractions: prescriptions.checkDrugInteractions,
    handleSelectFavoriteMedication: prescriptions.handleSelectFavoriteMedication,
    handleAddToFavorites: prescriptions.handleAddToFavorites,
  }), [
    prescriptions.handleAddToRxList,
    prescriptions.handleRemoveFromRxList,
    prescriptions.handleClearRxList,
    prescriptions.handleStartEditRx,
    prescriptions.handleCancelEditRx,
    prescriptions.handleSaveEditRx,
    prescriptions.handleSendERx,
    prescriptions.checkDrugInteractions,
    prescriptions.handleSelectFavoriteMedication,
    prescriptions.handleAddToFavorites,
  ])

  const communicationHandlers = useMemo(() => ({
    handleSendSMS: communication.handleSendSMS,
    handleMakeCall: communication.handleMakeCall,
    handleEndCall: communication.handleEndCall,
    handleToggleMute: communication.handleToggleMute,
    formatDuration: communication.formatDuration,
    formatHistoryDate: communication.formatHistoryDate,
  }), [
    communication.handleSendSMS,
    communication.handleMakeCall,
    communication.handleEndCall,
    communication.handleToggleMute,
    communication.formatDuration,
    communication.formatHistoryDate,
  ])

  const handleDoctorNotesChangeMemoized = useCallback((value: string) => {
    setDoctorNotes(value)
    handleSaveDoctorNotes(value)
  }, [setDoctorNotes, handleSaveDoctorNotes])

  const handleGenerateCDSSMemoized = useCallback(() => {
    if (setCdssError) setCdssError(null)
    handleGenerateCDSS(prescriptions.rxList)
  }, [setCdssError, handleGenerateCDSS, prescriptions.rxList])

  const memoizedSoapNotes = useMemo(() => soapNotes, [
    soapNotes.chiefComplaint,
    soapNotes.rosGeneral,
    soapNotes.assessmentPlan
  ])

  const cdssResponseId = cdssResponse?.id || null
  const hasCdssResponse = !!cdssResponse
  const memoizedCdssResponse = useMemo(() => cdssResponse, [cdssResponseId, hasCdssResponse])

  const appointmentDocumentsIds = useMemo(() => 
    documentUpload.appointmentDocuments?.map(doc => doc.id).join(',') || '',
    [documentUpload.appointmentDocuments]
  )
  const memoizedAppointmentDocuments = useMemo(() => 
    documentUpload.appointmentDocuments || [],
    [appointmentDocumentsIds]
  )

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING LOCAL UI STATE — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

  const [activeTab, setActiveTab] = useState<'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit'>('SOAP')
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [smartAlerts, setSmartAlerts] = useState<string[]>(['ID Verified'])
  
  const [showMoveForm, setShowMoveForm] = useState(false)
  const [selectedMoveTime, setSelectedMoveTime] = useState<string>('')
  const [moveLoading, setMoveLoading] = useState(false)

  const [showMedicationHistoryPanel, setShowMedicationHistoryPanel] = useState(false)
  const [showOrdersPanel, setShowOrdersPanel] = useState(false)
  const [showPrescriptionHistoryPanel, setShowPrescriptionHistoryPanel] = useState(false)
  const [showAppointmentsOverlay, setShowAppointmentsOverlay] = useState(false)
  const [showAllergiesPanel, setShowAllergiesPanel] = useState(false)
  const [showVitalsPanel, setShowVitalsPanel] = useState(false)
  const [showMedicationsPanel, setShowMedicationsPanel] = useState(false)

  // Map EHR toolbar panel ids to their state setters
  const handleToolbarPanelClick = useCallback((panelId: string) => {
    switch (panelId) {
      case 'medication-history': setShowMedicationHistoryPanel(v => !v); break
      case 'orders': setShowOrdersPanel(v => !v); break
      case 'prescription-history': setShowPrescriptionHistoryPanel(v => !v); break
      case 'appointments': setShowAppointmentsOverlay(v => !v); break
      case 'allergies': setShowAllergiesPanel(v => !v); break
      case 'vitals': setShowVitalsPanel(v => !v); break
      case 'medications': setShowMedicationsPanel(v => !v); break
    }
  }, [])

  // ═══ Whole-panel resize + persist ═══
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [panelLocked, setPanelLocked] = useState(true)
  const [chartLocked, setChartLocked] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const panelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Load saved width from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medazon_panel_width')
      if (saved) {
        const w = parseInt(saved, 10)
        if (!isNaN(w) && w >= 280) setPanelWidth(w)
      }
      const locked = localStorage.getItem('medazon_panel_locked')
      if (locked !== null) setPanelLocked(locked === 'true')
    } catch {}
  }, [])

  // Save width to localStorage whenever it changes
  useEffect(() => {
    if (panelWidth !== null) {
      try { localStorage.setItem('medazon_panel_width', String(panelWidth)) } catch {}
    }
  }, [panelWidth])

  // Save lock state
  useEffect(() => {
    try { localStorage.setItem('medazon_panel_locked', String(panelLocked)) } catch {}
  }, [panelLocked])

  // Resize handler for the whole panel
  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = panelWidth || window.innerWidth - 240
    panelResizeRef.current = { startX: e.clientX, startWidth: currentWidth }
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!panelResizeRef.current) return
      const delta = panelResizeRef.current.startX - moveEvent.clientX
      const newWidth = Math.max(280, panelResizeRef.current.startWidth + delta)
      setPanelWidth(newWidth)
    }
    const handleMouseUp = () => {
      panelResizeRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth])

  // Reset panel width to default
  const handlePanelResetWidth = useCallback(() => {
    setPanelWidth(null)
    try { localStorage.removeItem('medazon_panel_width') } catch {}
  }, [])
  
  const [patientAppointments, setPatientAppointments] = useState<Array<{
    id: string
    status: string
    service_type: string
    visit_type: string
    created_at: string
    requested_date_time: string | null
  }>>([])

  // Fetch patient appointments when overlay is opened
  useEffect(() => {
    if (showAppointmentsOverlay && appointment?.patient_id) {
      const fetchPatientAppointments = async () => {
        try {
          const { data: currentPatient, error: patientError } = await supabase
            .from('patients')
            .select('email')
            .eq('id', appointment.patient_id)
            .single()

          if (patientError || !currentPatient?.email) {
            console.error('Error fetching patient email:', patientError)
            const { data: fallbackData } = await supabase
              .from('patients')
              .select(`
                id,
                appointments:appointments!appointments_patient_id_fkey (
                  id, status, service_type, visit_type, created_at, requested_date_time
                )
              `)
              .eq('id', appointment.patient_id)
              .single()
            
            if (fallbackData?.appointments) {
              const sorted = [...(fallbackData.appointments as any[])].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              setPatientAppointments(sorted)
            }
            return
          }

          const { data: allPatientsData, error: allPatientsError } = await supabase
            .from('patients')
            .select(`
              id,
              appointments:appointments!appointments_patient_id_fkey (
                id, status, service_type, visit_type, created_at, requested_date_time
              )
            `)
            .eq('email', currentPatient.email)

          if (allPatientsError) {
            console.error('Error fetching all patients by email:', allPatientsError)
            return
          }

          const allAppointments: any[] = []
          if (allPatientsData) {
            allPatientsData.forEach(patient => {
              if (patient.appointments && Array.isArray(patient.appointments)) {
                allAppointments.push(...patient.appointments)
              }
            })
          }

          const sorted = allAppointments.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setPatientAppointments(sorted)
        } catch (err) {
          console.error('Error fetching patient appointments:', err)
        }
      }
      fetchPatientAppointments()
    }
  }, [showAppointmentsOverlay, appointment?.patient_id])

  // Initialize SOAP notes when appointment data loads
  const initializedRef = useRef<string | null>(null)
  const cdssCheckedRef = useRef<string | null>(null)
  
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    let idleCallbackId: number | null = null
    
    if (appointment && appointmentId && initializedRef.current !== appointmentId) {
      initializedRef.current = appointmentId
      cdssCheckedRef.current = null
      
      fetchAppointmentDetails().then((result) => {
        if (!isMounted || initializedRef.current !== appointmentId) return
        
        if (result) {
          initializeSoapNotes(result.clinicalNotes || [], result.appointmentData)
          
          if (checkAndLoadCDSS && cdssCheckedRef.current !== appointmentId) {
            cdssCheckedRef.current = appointmentId
            const scheduleCDSS = (callback: () => void) => {
              if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                idleCallbackId = (window as any).requestIdleCallback(callback, { timeout: 3000 })
              } else {
                timeoutId = setTimeout(callback, 600)
              }
            }
            
            scheduleCDSS(() => {
              if (!isMounted || initializedRef.current !== appointmentId) return
              if (process.env.NODE_ENV === 'development') {
                console.log('🚀 AppointmentDetailModal: Calling checkAndLoadCDSS (deferred)', { appointmentId })
              }
              checkAndLoadCDSS(appointmentId, result.appointmentData)
            })
          }
        }
      }).catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching appointment details:', err)
        }
      })
    }
    
    if (!appointmentId) {
      initializedRef.current = null
      cdssCheckedRef.current = null
    }
    
    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      if (idleCallbackId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, appointment?.id])

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING ACTION HANDLERS — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

  // Cleanup any active media streams (mic/camera) when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Release all active media tracks to stop mic/camera indicators
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          // Stop any getUserMedia streams that may be lingering
          navigator.mediaDevices.enumerateDevices().then(() => {
            // Get all active tracks from the page
            const streams = (window as any).__activeMediaStreams as MediaStream[] | undefined
            if (streams) {
              streams.forEach(stream => {
                stream.getTracks().forEach(track => track.stop())
              })
              ;(window as any).__activeMediaStreams = []
            }
          }).catch(() => {})
        } catch {}
      }
    }
  }, [isOpen])

  const handleAppointmentAction = useCallback(async (action: 'accept' | 'reject' | 'complete') => {
    if (!appointmentId) return
    setActionLoading(action)
    try {
      if (action === 'complete') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)
        if (error) throw error
      } else {
        const response = await fetch(`/api/appointments/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId })
        })
        if (!response.ok) throw new Error(`Failed to ${action} appointment`)
      }
      onStatusChange()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }, [appointmentId, onStatusChange, onClose, setError])

  const handleReschedule = useCallback(async () => {
    if (!appointmentId || !newDateTime) {
      setError('Please select a new date and time')
      return
    }
    setRescheduleLoading(true)
    try {
      const doctorTimezone = 'America/Phoenix'
      const utcDateTime = convertDateTimeLocalToUTC(newDateTime, doctorTimezone)
      
      const response = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, newDateTime: utcDateTime })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reschedule appointment')
      }

      const result = await response.json()
      setShowRescheduleForm(false)
      setNewDateTime('')
      setSmartAlerts(prev => [...prev, 'Appointment rescheduled'])
      
      if (onSmsSent) {
        const newDateObj = new Date(result.data?.newDateTime || utcDateTime)
        onSmsSent(`Appointment rescheduled to ${newDateObj.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        })}. Navigate to that date on the calendar to see it.`)
      }
      
      onStatusChange()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRescheduleLoading(false)
    }
  }, [appointmentId, newDateTime, setError, setNewDateTime, onStatusChange, onSmsSent, onClose])

  const handleCancelAppointment = useCallback(async () => {
    if (!appointment?.id) return
    setCancelling(true)
    setError(null)
    try {
      const response = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, reason: 'Cancelled by provider' })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to cancel appointment')
      if (onSmsSent) onSmsSent('Appointment cancelled successfully')
      onStatusChange()
      setCancelling(false)
      setShowCancelConfirm(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment')
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }, [appointment?.id, onStatusChange, onClose, onSmsSent, setError])

  // Update appointment status (light — just updates the field)
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!appointmentId) return
    setStatusUpdating(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)
      if (error) throw error
      setAppointment((prev: any) => prev ? { ...prev, status: newStatus } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error updating status:', err)
      setError(err.message || 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }, [appointmentId, onStatusChange, setAppointment, setError])

  // Toggle chart lock
  const handleChartLockToggle = useCallback(async () => {
    if (!appointmentId) return
    const newLocked = !chartLocked
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ chart_locked: newLocked })
        .eq('id', appointmentId)
      if (error) throw error
      setChartLocked(newLocked)
      setAppointment((prev: any) => prev ? { ...prev, chart_locked: newLocked } : prev)
      onStatusChange() // refresh calendar to show/hide lock icon
    } catch (err: any) {
      console.error('Error toggling chart lock:', err)
      setError(err.message || 'Failed to toggle chart lock')
    }
  }, [appointmentId, chartLocked, onStatusChange, setAppointment, setError])

  const handleMoveAppointment = useCallback(async () => {
    if (!appointmentId || !selectedMoveTime) {
      setError('Please select a new time')
      return
    }
    setMoveLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/appointments/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, newTime: selectedMoveTime })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to move appointment')
      }
      setMoveLoading(false)
      setShowMoveForm(false)
      setSelectedMoveTime('')
      setSmartAlerts(prev => [...prev, 'Appointment moved'])
      setTimeout(() => { onStatusChange() }, 0)
      fetchAppointmentDetails().catch(err => console.error('Error refreshing details:', err))
    } catch (err: any) {
      setError(err.message || 'Failed to move appointment')
    } finally {
      setMoveLoading(false)
    }
  }, [appointmentId, selectedMoveTime, fetchAppointmentDetails, setError, onStatusChange])

  const handleSignAndLock = useCallback(async () => {
    if (!appointmentId || !currentUser) return
  }, [appointmentId, currentUser])

  const handleDocumentDownload = useCallback(async (doc: any) => {
    let downloadUrl: string | null = null
    let blobUrl: string | null = null
    let anchorElement: HTMLAnchorElement | null = null
    try {
      const { supabase } = await import('@/lib/supabase')
      downloadUrl = doc.file_url
      if (!downloadUrl) throw new Error('Invalid download URL')
      if (!downloadUrl.startsWith('http') || downloadUrl.includes('/storage/v1/object/public/')) {
        let filePath = downloadUrl
        if (downloadUrl.includes('/storage/v1/object/public/appointment-documents/')) {
          const match = downloadUrl.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
          filePath = match ? decodeURIComponent(match[1]) : downloadUrl
        }
        const { data: urlData, error: urlError } = await supabase.storage
          .from('appointment-documents')
          .createSignedUrl(filePath, 3600)
        if (urlError) throw new Error('Failed to generate download URL')
        if (urlData?.signedUrl) downloadUrl = urlData.signedUrl
        else throw new Error('Failed to generate download URL')
      }
      if (!downloadUrl) throw new Error('Invalid download URL')
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      blobUrl = window.URL.createObjectURL(blob)
      anchorElement = document.createElement('a')
      anchorElement.href = blobUrl
      anchorElement.download = doc.document_name || doc.file_name || 'document'
      document.body.appendChild(anchorElement)
      anchorElement.click()
    } catch (err: any) {
      console.error('Download error:', err)
      setError(`Failed to download file: ${err.message}`)
    } finally {
      if (blobUrl) window.URL.revokeObjectURL(blobUrl)
      if (anchorElement && document.body.contains(anchorElement)) {
        try { document.body.removeChild(anchorElement) } catch (e) {}
      }
    }
  }, [setError])

  const handleSendEmail = useCallback(async (to: string, subject: string, body: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      const response = await fetch('/api/communication/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        body: JSON.stringify({ to, subject, body, patientId: appointment?.patient_id, appointmentId })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send email')
      }
    } catch (error: any) {
      console.error('Error sending email:', error)
      throw error
    }
  }, [appointmentId, appointment?.patient_id])

  const handleApplyCDSSWithMedications = useCallback(async () => {
    if (!handleApplyCDSS) return
    try {
      await handleApplyCDSS((medications: any[]) => {
        if (medications && medications.length > 0) {
          prescriptions.setRxList(prev => [...prev, ...medications])
        }
      })
    } catch (err: any) {
      setError(err.message || 'Failed to apply CDSS suggestions')
    }
  }, [handleApplyCDSS, prescriptions, setError])

  const useSectionProps = (sectionId: string, panel: 'left' | 'right', layout: any) => {
    const isDragging = layout.draggedSection === sectionId
    const isDragOver = layout.dragOverSection === sectionId
    return {
      draggable: layout.isCustomizeMode,
      onDragStart: (e: React.DragEvent) => layout.handleDragStart(e, sectionId),
      onDragOver: (e: React.DragEvent) => layout.handleDragOver(e, sectionId, panel),
      onDragLeave: layout.handleDragLeave,
      onDrop: (e: React.DragEvent) => layout.handleDrop(e, sectionId, panel),
      onDragEnd: layout.handleDragEnd,
      'data-section-id': sectionId,
      className: `relative ${layout.isCustomizeMode ? 'cursor-move' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-cyan-500 ring-offset-2' : ''} transition-all`,
      style: { contain: 'layout style paint' }
    }
  }

  const handleCloseCDSS = useCallback(() => {
    setShowCDSSResults(false)
    setCdssError?.(null)
  }, [setCdssError])

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING renderSection and renderDoctorNotes — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

  const renderDoctorNotes = useCallback(
    (sectionProps: any) => (
      <DoctorNotesSection
        appointment={appointment}
        soapNotes={memoizedSoapNotes}
        doctorNotes={doctorNotes}
        activeTab={activeTab}
        soapSaveStatus={soapSaveStatus}
        isSigning={isSigning}
        isCustomizeMode={layout.isCustomizeMode}
        sectionProps={sectionProps}
        onSoapNotesChange={handleSoapNotesChange}
        onDoctorNotesChange={handleDoctorNotesChangeMemoized}
        onTabChange={setActiveTab}
        onSignAndLock={handleSignAndLock}
        onGenerateCDSS={handleGenerateCDSSMemoized}
        isGeneratingCDSS={isGeneratingCDSS}
        showCDSSResults={showCDSSResults}
        cdssResponse={memoizedCdssResponse}
        cdssError={cdssError}
        isApplyingCDSS={isApplyingCDSS}
        onApplyCDSS={handleApplyCDSSWithMedications}
        onCloseCDSS={handleCloseCDSS}
        appointmentDocuments={memoizedAppointmentDocuments}
        uploadingDocument={documentUpload.uploadingDocument}
        selectedDocument={documentUpload.selectedDocument}
        uploadError={documentUpload.uploadError}
        onDocumentUpload={documentUpload.handleDocumentUpload}
        onDocumentSelect={documentUpload.setSelectedDocument}
        onDocumentDownload={handleDocumentDownload}
      />
    ),
    [appointment, memoizedSoapNotes, doctorNotes, activeTab, soapSaveStatus, isSigning, layout.isCustomizeMode, handleSoapNotesChange, handleDoctorNotesChangeMemoized, setActiveTab, handleSignAndLock, handleGenerateCDSSMemoized, isGeneratingCDSS, showCDSSResults, memoizedCdssResponse, cdssError, isApplyingCDSS, handleApplyCDSSWithMedications, handleCloseCDSS, memoizedAppointmentDocuments, documentUpload.uploadingDocument, documentUpload.selectedDocument, documentUpload.uploadError, documentUpload.handleDocumentUpload, documentUpload.setSelectedDocument, handleDocumentDownload]
  )
  
  const renderSection = useCallback(
    (sectionId: string, panel: 'left' | 'right') => {
      const sectionProps = useSectionProps(sectionId, panel, layout)
  
      switch (sectionId) {
        case 'patient-header':
          return (
            <PatientHeader
              key={sectionId}
              appointment={appointment}
              surgeriesDetails={surgeriesDetails}
              medicalIssuesDetails={problemsMedications.medicalIssuesDetails}
              chiefComplaint={soapNotes.chiefComplaint}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
            />
          )
  
        case 'doctor-notes':
          return <React.Fragment key={sectionId}>{renderDoctorNotes(sectionProps)}</React.Fragment>

        case 'meeting-info':
          return (
            <div key={sectionId} {...sectionProps}>
              {layout.isCustomizeMode && (
                <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              <DailyMeetingEmbed
                appointment={appointment && {
                  id: appointment.id,
                  requested_date_time: appointment.requested_date_time,
                  dailyco_meeting_url: (appointment as any).dailyco_meeting_url || null,
                  dailyco_room_name: (appointment as any).dailyco_room_name || null,
                  dailyco_owner_token: (appointment as any).dailyco_owner_token || null,
                  recording_url: (appointment as any).recording_url || null
                }}
                currentUser={currentUser}
                isCustomizeMode={layout.isCustomizeMode}
                sectionProps={{}}
                sectionId={sectionId}
              />

              {/* ─── Seamless panel attached below video ─── */}
              {!layout.isCustomizeMode && appointment && (
                <div className="border-x border-b border-white/10 rounded-b-xl overflow-hidden" style={{ background: '#0d1424', marginTop: '-1px' }}>
                  {/* Grasshopper phone bar */}
                  {appointment?.patients?.phone && (
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5" style={{ background: 'rgba(14,165,233,0.04)' }}>
                      <Phone className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                      <span className="text-xs font-mono text-white font-bold flex-1 truncate">{appointment.patients.phone}</span>
                      <button onClick={() => navigator.clipboard?.writeText(appointment?.patients?.phone || '')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400 transition-all flex-shrink-0">Copy</button>
                      <a href={`https://app.grasshopper.com/calls/make?number=${encodeURIComponent(appointment.patients.phone)}`} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-400 transition-all flex items-center gap-1 flex-shrink-0">
                        <Phone className="h-3 w-3" />Call
                      </a>
                      <a href="https://app.grasshopper.com" target="_blank" rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-gray-400 hover:text-sky-300 border border-white/10 hover:border-sky-400/50 transition-all flex items-center gap-1 flex-shrink-0">
                        <ExternalLink className="h-3 w-3" />Grasshopper
                      </a>
                    </div>
                  )}

                  {/* Bottom tab bar: SOAP · Codes · Instructions — matches DailyMeetingEmbed style */}
                  <div className="flex border-b border-white/5">
                    {(['SOAP', 'Codes', 'Instructions'] as const).map((tab) => (
                      <button key={tab}
                        onClick={() => setActiveTab(tab === 'Codes' ? 'Billing' : tab === 'Instructions' ? 'Notes' : 'SOAP')}
                        className={`flex-1 px-3 py-2 text-xs font-bold transition-all ${
                          (tab === 'SOAP' && activeTab === 'SOAP') || (tab === 'Codes' && activeTab === 'Billing') || (tab === 'Instructions' && activeTab === 'Notes')
                            ? 'text-emerald-300 border-b-2 border-emerald-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}>
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Freed AI content — scrollable SOAP notes */}
                  <div className="max-h-[350px] overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
                    {/* Freed header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5" style={{ background: 'rgba(16,185,129,0.06)' }}>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-300">Freed AI</span>
                      <span className="text-[10px] text-emerald-500/60">Scribe</span>
                      <div className="flex-1" />
                      <a href="https://secure.getfreed.ai" target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-white/10 transition-colors" title="Open Freed">
                        <ExternalLink className="h-3 w-3 text-gray-500 hover:text-emerald-400" />
                      </a>
                    </div>

                    {/* Mic icon + start session */}
                    <div className="px-4 py-3 border-b border-white/5 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Mic className="h-5 w-5 text-emerald-400" />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2">Open Freed to capture this conversation and auto-generate SOAP notes</p>
                      <a href="https://secure.getfreed.ai" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                        <ExternalLink className="h-4 w-4" />Start Freed Session
                      </a>
                    </div>

                    {/* SOAP Notes preview */}
                    <div className="px-3 py-3">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">SOAP NOTES</div>
                      <div className="space-y-2">
                        {([
                          { label: 'SUBJECTIVE', value: soapNotes.chiefComplaint || '', color: 'text-emerald-400/70' },
                          { label: 'OBJECTIVE', value: soapNotes.rosGeneral || '', color: 'text-yellow-400/70' },
                          { label: 'ASSESSMENT', value: soapNotes.assessmentPlan?.split('\n\nPlan:')[0]?.replace('Assessment:', '')?.trim() || '', color: 'text-orange-400/70' },
                          { label: 'PLAN', value: soapNotes.assessmentPlan?.split('\n\nPlan:')[1]?.trim() || soapNotes.assessmentPlan || '', color: 'text-cyan-400/70' }
                        ]).map((item) => (
                          <div key={item.label} className="rounded-lg border border-white/5 p-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${item.color}`}>{item.label}</div>
                            <div className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[16px]">
                              {item.value || <span className="text-gray-600 italic">Waiting for Freed transcription...</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Open Video Consultation button — full width at bottom */}
                  <a href={(appointment as any).dailyco_meeting_url || '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 font-bold text-sm text-white transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)' }}>
                    <ExternalLink className="h-4 w-4" />Open Video Consultation
                  </a>
                </div>
              )}
            </div>
          )
  
        case 'problems-medications':
          return (
            <ProblemsMedicationsSection
              key={sectionId}
              {...problemsMedications}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              {...problemsMedicationsHandlers}
            />
          )

        case 'erx-composer':
          return (
            <ErxComposer
              key={sectionId}
              rxData={prescriptions.rxData}
              rxList={prescriptions.rxList}
              recipientAddress={prescriptions.recipientAddress}
              editingRxId={prescriptions.editingRxId}
              editingRxData={prescriptions.editingRxData}
              addingRx={prescriptions.addingRx}
              sendingRx={prescriptions.sendingRx}
              showRxHistory={prescriptions.showRxHistory}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              sectionId={sectionId}
              onRxDataChange={(field: string, value: string) => {
                prescriptions.handleRxDataChange(field as keyof typeof prescriptions.rxData, value)
              }}
              onRecipientAddressChange={prescriptions.setRecipientAddress}
              onAddToRxList={prescriptions.handleAddToRxList}
              onRemoveFromRxList={prescriptions.handleRemoveFromRxList}
              onClearRxList={prescriptions.handleClearRxList}
              onStartEditRx={prescriptions.handleStartEditRx}
              onCancelEditRx={prescriptions.handleCancelEditRx}
              onSaveEditRx={prescriptions.handleSaveEditRx}
              onEditingRxDataChange={(data) => { prescriptions.setEditingRxData(data) }}
              onSendERx={async () => {
                if (appointment) await prescriptions.handleSendERx(appointment, setError)
              }}
              onToggleRxHistory={() => prescriptions.setShowRxHistory(!prescriptions.showRxHistory)}
              rxHistory={prescriptions.rxHistory}
              drugInteractions={prescriptions.drugInteractions}
              isCheckingInteractions={prescriptions.isCheckingInteractions}
              onCheckDrugInteractions={prescriptions.checkDrugInteractions}
              favoriteMedications={prescriptions.favoriteMedications}
              showFavoritesDropdown={prescriptions.showFavoritesDropdown}
              onSelectFavoriteMedication={prescriptions.handleSelectFavoriteMedication}
              onAddToFavorites={() => {
                if (prescriptions.rxData?.medication) {
                  prescriptions.handleAddToFavorites({
                    medication: prescriptions.rxData.medication,
                    sig: prescriptions.rxData.sig,
                    quantity: prescriptions.rxData.quantity,
                    refills: prescriptions.rxData.refills
                  })
                }
              }}
              onToggleFavoritesDropdown={() => prescriptions.setShowFavoritesDropdown(!prescriptions.showFavoritesDropdown)}
            />
          )

        case 'sms-section':
          return (
            <div key={sectionId} {...sectionProps}>
              {layout.isCustomizeMode && (
                <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              <EnhancedSMSPanel
                phoneNumber={communication.smsTo || appointment?.patients?.phone || ''}
                providerId={currentUser?.id}
                patientId={appointment?.patient_id}
                appointmentId={appointmentId}
                patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
                onPhoneNumberChange={communication.handleSmsToChange}
                onSendSMS={async (to, message) => {
                  communication.handleSmsToChange(to)
                  communication.handleSmsMessageChange(message)
                  await new Promise(resolve => setTimeout(resolve, 0))
                  await communication.handleSendSMS()
                }}
                isSending={communication.isSendingSMS}
                error={error && error.includes('SMS') ? error : undefined}
              />
            </div>
          )

        case 'call-section':
          return (
            <div key={sectionId} {...sectionProps} data-section-id="call-section">
              {layout.isCustomizeMode && (
                <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              <MakeCallFaxPanel
                phoneNumber={communication.callPhoneNumber || appointment?.patients?.phone || ''}
                providerId={currentUser?.id}
                patientId={appointment?.patient_id}
                appointmentId={appointmentId}
                onPhoneNumberChange={communication.handleCallPhoneNumberChange}
                onMakeCall={async (phoneNumber) => {
                  communication.handleCallPhoneNumberChange(phoneNumber)
                  await communication.handleMakeCall()
                }}
                onEndCall={async () => {
                  await communication.handleEndCall()
                }}
                onToggleMute={communication.handleToggleMute}
                isCallInProgress={communication.isCalling}
                isMuted={communication.isMuted}
                callDuration={communication.callDuration}
                isDeviceReady={communication.isDeviceReady}
                externalError={error && error.includes('call') ? error : undefined}
              />
            </div>
          )

        case 'email-section':
          return (
            <div key={sectionId} {...sectionProps}>
              {layout.isCustomizeMode && (
                <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              <GmailStyleEmailPanel
                patientEmail={appointment?.patients?.email || ''}
                patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
                providerEmail={currentUser?.email || ''}
                providerName={currentUser?.name || 'Provider'}
                providerId={currentUser?.id}
                patientId={appointment?.patient_id}
                onSendEmail={handleSendEmail}
              />
            </div>
          )

        case 'lab-results':
          return (
            <LabResultsSection key={sectionId} labResults={labResults.labResults} isLoadingLabs={labResults.isLoadingLabs} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps} onLoadLabResults={labResults.loadLabResults} patientId={appointment?.patient_id || undefined} appointmentId={appointmentId || undefined} />
          )

        case 'referrals-followup':
          return (
            <ReferralsFollowUpSection key={sectionId} referrals={referralsFollowUp.referrals} showReferralForm={referralsFollowUp.showReferralForm} setShowReferralForm={referralsFollowUp.setShowReferralForm} newReferral={referralsFollowUp.newReferral} setNewReferral={referralsFollowUp.setNewReferral} showFollowUpScheduler={referralsFollowUp.showFollowUpScheduler} setShowFollowUpScheduler={referralsFollowUp.setShowFollowUpScheduler} followUpData={referralsFollowUp.followUpData} setFollowUpData={referralsFollowUp.setFollowUpData} isSchedulingFollowUp={referralsFollowUp.isSchedulingFollowUp} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps}
              onCreateReferral={async () => { try { await referralsFollowUp.handleCreateReferral() } catch (err: any) { setError(err.message) } }}
              onScheduleFollowUp={async () => { try { await referralsFollowUp.handleScheduleFollowUp(); onStatusChange() } catch (err: any) { setError(err.message) } }}
              error={error}
              patientId={appointment?.patient_id || undefined}
              appointmentId={appointmentId || undefined}
            />
          )

        case 'prior-auth':
          return (
            <PriorAuthSection key={sectionId} priorAuths={priorAuth.priorAuths} showPriorAuthForm={priorAuth.showPriorAuthForm} setShowPriorAuthForm={priorAuth.setShowPriorAuthForm} newPriorAuth={priorAuth.newPriorAuth} setNewPriorAuth={priorAuth.setNewPriorAuth} isSubmitting={priorAuth.isSubmitting} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps}
              onSubmitPriorAuth={async () => { try { await priorAuth.handleSubmitPriorAuth() } catch (err: any) { setError(err.message) } }}
              error={error}
              patientId={appointment?.patient_id || undefined}
              appointmentId={appointmentId || undefined}
            />
          )

        case 'communication-history':
          return (
            <CommunicationHistorySection key={sectionId} communicationHistory={communication.communicationHistory} loadingHistory={communication.loadingHistory} playingRecordingId={communication.playingRecordingId} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps} formatDuration={communication.formatDuration} formatHistoryDate={communication.formatHistoryDate} onPlayRecording={communication.handlePlayRecording} audioRefs={communication.audioRefs} />
          )

        case 'medical-records':
          return (
            <div key={sectionId} {...sectionProps}>
              {layout.isCustomizeMode && (
                <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              <MedicalRecordsView appointmentId={appointmentId || undefined} patientId={appointment?.patient_id || null} />
            </div>
          )

        default:
          return null
      }
    },
    [layout, appointment, currentUser, problemsMedications, renderDoctorNotes, problemsMedicationsHandlers, surgeriesDetails, prescriptions, communication, error, setError, labResults, referralsFollowUp, priorAuth, handleSendEmail, onStatusChange, soapNotes, setActiveTab]
  )

  // Fetch communication history when appointment loads
  useEffect(() => {
    if (appointment?.patients?.phone) {
      communication.fetchCommunicationHistory(appointment.patients.phone)
    }
  }, [appointment?.patients?.phone, communication.fetchCommunicationHistory])

  // Reset scroll position
  const preventAutoScrollRef = useRef(false)
  const scrollResetIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (isOpen && layout.scrollContainerRef.current) {
      preventAutoScrollRef.current = true
      const container = layout.scrollContainerRef.current
      container.scrollTop = 0
      const resetScroll = () => { if (container && preventAutoScrollRef.current) container.scrollTop = 0 }
      requestAnimationFrame(resetScroll)
      const timers = [setTimeout(resetScroll, 0), setTimeout(resetScroll, 50), setTimeout(resetScroll, 100), setTimeout(resetScroll, 200), setTimeout(resetScroll, 300), setTimeout(resetScroll, 500)]
      scrollResetIntervalRef.current = setInterval(() => { if (preventAutoScrollRef.current && container.scrollTop > 10) container.scrollTop = 0 }, 50)
      const timer4 = setTimeout(() => {
        preventAutoScrollRef.current = false
        if (scrollResetIntervalRef.current) { clearInterval(scrollResetIntervalRef.current); scrollResetIntervalRef.current = null }
      }, 800)
      return () => { timers.forEach(t => clearTimeout(t)); clearTimeout(timer4); if (scrollResetIntervalRef.current) { clearInterval(scrollResetIntervalRef.current); scrollResetIntervalRef.current = null }; preventAutoScrollRef.current = false }
    } else {
      preventAutoScrollRef.current = false
      if (scrollResetIntervalRef.current) { clearInterval(scrollResetIntervalRef.current); scrollResetIntervalRef.current = null }
    }
  }, [isOpen, appointmentId])

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING HELPER FUNCTIONS — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const getDateString = (date: Date, timezone?: string): string => {
    if (timezone) {
      const options: Intl.DateTimeFormatOptions = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }
      const formatter = new Intl.DateTimeFormat('en-US', options)
      const parts = formatter.formatToParts(date)
      const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
      return `${getValue('year')}-${getValue('month')}-${getValue('day')}`
    }
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const roundToNearestSlot = (appointmentDate: Date): Date => {
    const rounded = new Date(appointmentDate)
    const minutes = appointmentDate.getUTCMinutes()
    const hours = appointmentDate.getUTCHours()
    if (minutes < 15) { rounded.setUTCMinutes(0, 0, 0); rounded.setUTCHours(hours) }
    else if (minutes < 45) { rounded.setUTCMinutes(30, 0, 0); rounded.setUTCHours(hours) }
    else { rounded.setUTCMinutes(0, 0, 0); rounded.setUTCHours(hours + 1) }
    return rounded
  }

  const getAppointmentForSlot = (date: Date, time: Date): CalendarAppointment | null => {
    if (!stableAppointments || stableAppointments.length === 0) return null
    const doctorTimezone = 'America/Phoenix'
    const dateInPhoenix = convertToTimezone(date.toISOString(), doctorTimezone)
    const slotDateStr = getDateString(dateInPhoenix, doctorTimezone)
    const phoenixYear = dateInPhoenix.getUTCFullYear()
    const phoenixMonth = dateInPhoenix.getUTCMonth()
    const phoenixDay = dateInPhoenix.getUTCDate()
    const phoenixHour = time.getHours()
    const phoenixMinute = time.getMinutes()
    const timeSlotAsPhoenix = new Date(Date.UTC(phoenixYear, phoenixMonth, phoenixDay, phoenixHour, phoenixMinute, 0))
    const hour = timeSlotAsPhoenix.getUTCHours()
    const minute = timeSlotAsPhoenix.getUTCMinutes()
    const slotKey = `${slotDateStr}_${hour}_${minute}`
    const appointmentMap = new Map<string, CalendarAppointment>()
    stableAppointments.forEach(apt => {
      if (!apt.requested_date_time) return
      const aptDate = convertToTimezone(apt.requested_date_time, doctorTimezone)
      const roundedSlot = roundToNearestSlot(aptDate)
      const dateStr = getDateString(aptDate, doctorTimezone)
      const aptHour = roundedSlot.getUTCHours()
      const aptMinute = roundedSlot.getUTCMinutes()
      const key = `${dateStr}_${aptHour}_${aptMinute}`
      appointmentMap.set(key, apt)
    })
    return appointmentMap.get(slotKey) || null
  }

  const getAppointmentReason = (apt: CalendarAppointment): string => {
    if ((apt as any).clinical_notes && Array.isArray((apt as any).clinical_notes) && (apt as any).clinical_notes.length > 0) {
      const reasonNote = (apt as any).clinical_notes.find((note: any) => note.note_type === 'chief_complaint' || note.note_type === 'subjective')
      if (reasonNote?.content) return reasonNote.content
    }
    const aptAny = apt as any
    return aptAny.chief_complaint || aptAny.reason || ''
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Left sidebar time slots — UNCHANGED
  // ═══════════════════════════════════════════════════════════════
  const renderCurrentDaySlots = () => {
    if (!appointment?.requested_date_time) return null
    const doctorTimezone = 'America/Phoenix'
    const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
    const slots: Date[] = []
    for (let hour = 5; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date(appointmentDate)
        time.setHours(hour, minute, 0, 0)
        slots.push(time)
      }
    }
    
    return (
      <div style={{ padding: '12px', background: 'linear-gradient(180deg, #0d1424, #0b1222)', height: '100%', overflowY: 'auto', borderRight: '1px solid #1b2b4d', scrollbarWidth: 'thin', scrollbarColor: '#1b2b4d #0a1222' }} className="scrollbar-thin scrollbar-thumb-[#1b2b4d] scrollbar-track-[#0a1222]">
        <div style={{ color: '#cfe1ff', fontWeight: 'bold', fontSize: '14px', marginBottom: '16px', position: 'sticky', top: 0, background: 'linear-gradient(180deg, #0d1424, #0b1222)', paddingBottom: '12px', borderBottom: '1px solid #1b2b4d', zIndex: 10 }}>
          {appointmentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {slots.map((time) => {
            const slotAppointment = getAppointmentForSlot(appointmentDate, time)
            const isSelected = slotAppointment?.id === appointment?.id
            const isAvailable = !slotAppointment
            const isMoveSelected = showMoveForm && selectedMoveTime === `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
            return (
              <div key={time.getTime()}
                onClick={() => {
                  if (showMoveForm && isAvailable) setSelectedMoveTime(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`)
                  else if (slotAppointment && slotAppointment.id !== appointment?.id && onAppointmentSwitch) onAppointmentSwitch(slotAppointment.id)
                }}
                style={{
                  padding: '10px', borderRadius: '10px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  background: isMoveSelected ? 'linear-gradient(135deg, rgba(0, 230, 255, 0.3), rgba(0, 230, 255, 0.2))' : isSelected ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.3), rgba(211, 47, 47, 0.2))' : slotAppointment ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.2), rgba(211, 47, 47, 0.15))' : 'linear-gradient(135deg, rgba(25,214,127,.18), rgba(25,214,127,.12))',
                  border: isMoveSelected ? '2px solid #00e6ff' : isSelected ? '2px solid #00e6ff' : slotAppointment ? '2px solid rgba(229, 57, 53, 0.6)' : '2px solid rgba(25,214,127,.6)',
                  boxShadow: isMoveSelected ? '0 0 12px rgba(0, 230, 255, 0.4)' : isSelected ? '0 0 12px rgba(229, 57, 53, 0.4), 0 0 20px rgba(0, 230, 255, 0.3)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  color: slotAppointment ? '#ffcdd2' : '#cde7da'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{formatTime(time)}</div>
                {slotAppointment && (
                  <>
                    <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>{slotAppointment.patients?.first_name} {slotAppointment.patients?.last_name}</div>
                    <span style={{
                      display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase',
                      background: slotAppointment.visit_type === 'video' ? 'rgba(0, 230, 255, 0.25)' : slotAppointment.visit_type === 'phone' ? 'rgba(0, 194, 110, 0.25)' : slotAppointment.visit_type === 'async' ? 'rgba(176, 122, 255, 0.25)' : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${slotAppointment.visit_type === 'video' ? '#00e6ff' : slotAppointment.visit_type === 'phone' ? '#00c26e' : slotAppointment.visit_type === 'async' ? '#b07aff' : 'transparent'}`,
                      color: slotAppointment.visit_type === 'video' ? '#00e6ff' : slotAppointment.visit_type === 'phone' ? '#00c26e' : slotAppointment.visit_type === 'async' ? '#b07aff' : '#fff'
                    }}>
                      {slotAppointment.visit_type || 'visit'}
                    </span>
                  </>
                )}
                {isAvailable && <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, fontWeight: '600' }}>Available</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  // ═══════════════════════════════════════════════════════════════
  // ORIGINAL RENDER — Standard slide-out panel layout
  // ═══════════════════════════════════════════════════════════════

  return (
    <>
      <div 
        className="fixed top-0 right-0 bottom-0 bg-black/40 z-40 transition-opacity duration-300"
        style={{ left: panelWidth ? `calc(100vw - ${panelWidth}px)` : 'var(--sidebar-width, 240px)' }}
        onClick={onClose}
      />
      
      {/* Main container — resizable panel */}
      <div className="fixed top-0 right-0 h-full z-50 flex" style={{ left: panelWidth ? `calc(100vw - ${panelWidth}px)` : 'var(--sidebar-width, 240px)' }}>
        {/* ─── Resize handle (left edge) — only active when unlocked ─── */}
        <div
          onMouseDown={panelLocked ? undefined : handlePanelResizeStart}
          className={`w-2 h-full flex-shrink-0 group relative z-10 ${panelLocked ? 'cursor-default' : 'cursor-col-resize'}`}
          style={{ background: 'rgba(255,255,255,0.03)' }}
          title={panelLocked ? 'Panel locked — click unlock button to resize' : 'Drag to resize panel'}
        >
          {!panelLocked && (
            <>
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-1 rounded-full bg-cyan-400" />
                  <div className="w-0.5 h-8 rounded-full bg-cyan-400/60" />
                  <div className="w-1 h-1 rounded-full bg-cyan-400" />
                </div>
              </div>
              <div className="absolute inset-y-0 left-0 w-full group-hover:bg-cyan-500/20 transition-colors" />
            </>
          )}
        </div>

        {/* Panel */}
        <div className={`flex-1 h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/20 shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10 flex-shrink-0 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-sm sm:text-base">
                <span className="text-cyan-400">APPOINTMENT</span>
                {appointment?.requested_date_time && (
                  <> • {(() => {
                    const doctorTimezone = 'America/Phoenix'
                    const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                    return appointmentDate.toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })
                  })()}</>
                )}
                {appointment?.status && (
                  <select
                    value={appointment.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusUpdating}
                    className={`ml-2 px-2 py-0.5 rounded text-xs font-bold cursor-pointer border-0 outline-none ${
                      appointment.status === 'pending' ? 'bg-yellow-600 text-white' :
                      appointment.status === 'accepted' ? 'bg-green-600 text-white' :
                      appointment.status === 'completed' ? 'bg-blue-600 text-white' :
                      appointment.status === 'cancelled' ? 'bg-gray-600 text-white' :
                      appointment.status === 'no_show' ? 'bg-red-800 text-white' : 'bg-gray-600 text-white'
                    }`}
                  >
                    <option value="pending">PENDING</option>
                    <option value="accepted">ACCEPTED</option>
                    <option value="completed">COMPLETED</option>
                    <option value="cancelled">CANCELLED</option>
                    <option value="no_show">NO SHOW</option>
                  </select>
                )}
                <button
                  onClick={handleChartLockToggle}
                  className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all ${
                    chartLocked
                      ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:border-white/30'
                  }`}
                  title={chartLocked ? 'Chart locked — click to unlock' : 'Chart unlocked — click to lock'}
                >
                  {chartLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {chartLocked ? 'Locked' : 'Unlock'}
                </button>
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* EHR Panel Buttons */}
                {!layout.isCustomizeMode && appointment && EHR_PANELS.map(panel => {
                  const Icon = panel.icon
                  return (
                    <button key={panel.id} onClick={() => handleToolbarPanelClick(panel.id)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border border-white/10 hover:border-white/30 text-slate-300 hover:text-white"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: panel.color }} />{panel.label}
                    </button>
                  )
                })}

                {/* Action Buttons */}
                {!layout.isCustomizeMode && appointment && (
                  <>
                    {appointment.status === 'pending' && (
                      <>
                        <button onClick={() => handleAppointmentAction('accept')} disabled={actionLoading === 'accept'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50">
                          {actionLoading === 'accept' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          Accept
                        </button>
                        <button onClick={() => handleAppointmentAction('reject')} disabled={actionLoading === 'reject'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50">
                          {actionLoading === 'reject' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </button>
                      </>
                    )}
                    
                    <button onClick={() => { setShowMoveForm(!showMoveForm); setShowRescheduleForm(false); setShowCancelConfirm(false) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 ${showMoveForm ? 'bg-cyan-700' : 'bg-cyan-600'} text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs`}>
                      <ArrowRight className="h-3.5 w-3.5" />{showMoveForm ? 'Cancel Move' : 'Move'}
                    </button>
                    
                    <button onClick={() => { setShowRescheduleForm(!showRescheduleForm); setShowMoveForm(false); setShowCancelConfirm(false) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 ${showRescheduleForm ? 'bg-orange-700' : 'bg-orange-600'} text-white rounded-lg hover:bg-orange-700 transition-colors text-xs`}>
                      <RotateCcw className="h-3.5 w-3.5" />{showRescheduleForm ? 'Cancel' : 'Reschedule'}
                    </button>
                    
                    <button onClick={() => { setShowCancelConfirm(!showCancelConfirm); setShowMoveForm(false); setShowRescheduleForm(false) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 ${showCancelConfirm ? 'bg-red-700' : 'bg-red-600'} text-white rounded-lg hover:bg-red-700 transition-colors text-xs`}>
                      <XCircle className="h-3.5 w-3.5" />Cancel Appt
                    </button>
                    
                    {appointment.status === 'accepted' && (
                      <button onClick={() => handleAppointmentAction('complete')} disabled={actionLoading === 'complete'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs disabled:opacity-50">
                        {actionLoading === 'complete' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Complete
                      </button>
                    )}
                  </>
                )}
                
                {layout.isCustomizeMode ? (
                  <>
                    <button onClick={layout.saveLayout} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm">
                      <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Save Layout</span><span className="sm:hidden">Save</span>
                    </button>
                    <button onClick={() => layout.setIsCustomizeMode(false)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm">
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Cancel</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Panel width controls */}
                    <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
                      <button
                        onClick={() => setPanelLocked(!panelLocked)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${panelLocked ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/30'}`}
                        title={panelLocked ? 'Panel size locked — click to unlock' : 'Panel size unlocked — drag left edge to resize'}
                      >
                        {panelLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        <span className="hidden sm:inline">{panelLocked ? 'Locked' : 'Resize'}</span>
                      </button>
                      {panelWidth !== null && (
                        <button
                          onClick={handlePanelResetWidth}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 hover:text-orange-400 border border-white/10 hover:border-orange-400/30 transition-all"
                          title="Reset to default width"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span className="hidden sm:inline">Reset</span>
                        </button>
                      )}
                      {panelWidth !== null && (
                        <span className="text-[9px] text-gray-600 font-mono hidden lg:block">{panelWidth}px</span>
                      )}
                    </div>

                    <button onClick={() => layout.setIsCustomizeMode(true)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm">
                      <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Customize</span><span className="sm:hidden">Edit</span>
                    </button>
                    <button onClick={onClose} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm">
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Action Forms */}
            {showMoveForm && (
              <div className="mt-3 p-3 bg-cyan-900/50 rounded-lg border border-cyan-500/30">
                <div className="flex items-center justify-between">
                  <div className="text-cyan-300 text-sm">
                    <Clock className="h-4 w-4 inline mr-2" />
                    Select a new time slot from the calendar on the left
                    {selectedMoveTime && <span className="ml-2 font-bold">Selected: {selectedMoveTime}</span>}
                  </div>
                  <button onClick={handleMoveAppointment} disabled={!selectedMoveTime || moveLoading}
                    className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2">
                    {moveLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Confirm Move'}
                  </button>
                </div>
              </div>
            )}
            
            {showRescheduleForm && (
              <div className="mt-3 p-3 bg-orange-900/50 rounded-lg border border-orange-500/30">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-orange-300" />
                  <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-white/20 rounded-lg text-white text-sm" />
                  <button onClick={handleReschedule} disabled={!newDateTime || rescheduleLoading}
                    className="px-4 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2">
                    {rescheduleLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Confirm Reschedule'}
                  </button>
                </div>
              </div>
            )}
            
            {showCancelConfirm && (
              <div className="mt-3 p-3 bg-red-900/50 rounded-lg border border-red-500/30">
                <div className="flex items-center justify-between">
                  <div className="text-red-300 text-sm">Are you sure you want to cancel this appointment? This action cannot be undone.</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCancelConfirm(false)} className="px-4 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">No, Keep It</button>
                    <button onClick={handleCancelAppointment} disabled={cancelling}
                      className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-2">
                      {cancelling ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Yes, Cancel Appointment'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Content — Original 2-column grid layout */}
          <div 
            ref={layout.scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6"
            style={{ scrollBehavior: 'auto', scrollPaddingTop: '0' }}
            onFocus={(e) => {
              if (preventAutoScrollRef.current && layout.scrollContainerRef.current) {
                e.stopPropagation()
                setTimeout(() => { if (layout.scrollContainerRef.current) layout.scrollContainerRef.current.scrollTop = 0 }, 0)
              }
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">{error}</div>
            ) : appointment ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Left Panel */}
                <div className="space-y-4 sm:space-y-6">
                  {layout.leftPanelSections.map((sectionId) => renderSection(sectionId, 'left'))}
                </div>

                {/* Right Panel */}
                <div className="space-y-4 sm:space-y-6">
                  {layout.rightPanelSections.map((sectionId) => renderSection(sectionId, 'right'))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ═══ OVERLAY PANELS ═══ */}

      {documentUpload.selectedDocument && (
        <DocumentViewer document={documentUpload.selectedDocument} onClose={() => documentUpload.setSelectedDocument(null)} />
      )}

      {appointment?.patient_id && (
        <MedicationHistoryPanel isOpen={showMedicationHistoryPanel} onClose={() => setShowMedicationHistoryPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} patientDOB={appointment?.patients?.date_of_birth ?? undefined}
          onReconcile={(medications) => {
            const newMeds = medications.map((med, idx) => ({ id: `reconciled-${Date.now()}-${idx}`, medication: med.medication_name, provider: med.prescriber || 'Surescripts', date: med.start_date || new Date().toISOString().split('T')[0] }))
            newMeds.forEach(med => { problemsMedications.handleAddMedicationHistory(med.medication, med.provider, med.date) })
          }}
        />
      )}

      {appointment?.patient_id && (
        <OrdersPanel isOpen={showOrdersPanel} onClose={() => setShowOrdersPanel(false)} patientId={appointment.patient_id} patientName={`${appointment.patients?.first_name || ''} ${appointment.patients?.last_name || ''}`} appointmentId={appointment.id} />
      )}

      {appointment?.patient_id && (
        <PrescriptionHistoryPanel isOpen={showPrescriptionHistoryPanel} onClose={() => setShowPrescriptionHistoryPanel(false)} patientId={appointment.patient_id} patientName={`${appointment.patients?.first_name || ''} ${appointment.patients?.last_name || ''}`} appointmentId={appointment.id} />
      )}

      {appointment?.patient_id && (
        <AppointmentsOverlayPanel isOpen={showAppointmentsOverlay} onClose={() => setShowAppointmentsOverlay(false)} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} patientDOB={appointment?.patients?.date_of_birth ?? undefined} appointments={patientAppointments}
          onViewAppointment={(apptId) => { setShowAppointmentsOverlay(false); if (onAppointmentSwitch) onAppointmentSwitch(apptId) }}
        />
      )}

      {appointment?.patient_id && (
        <AllergiesPanel isOpen={showAllergiesPanel} onClose={() => setShowAllergiesPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <VitalsPanel isOpen={showVitalsPanel} onClose={() => setShowVitalsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} appointmentId={appointmentId ?? undefined} />
      )}

      {appointment?.patient_id && (
        <MedicationsPanel isOpen={showMedicationsPanel} onClose={() => setShowMedicationsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}
    </>
  )
}






















