'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Edit, Save, Calendar, Clock, CheckCircle, XCircle, ArrowRight, RotateCcw, Pill, FileText, ClipboardList, CalendarDays, AlertTriangle, Activity, Minimize2, Maximize2 } from 'lucide-react'
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
  // 🔥 CRITICAL: Memoize currentDate to prevent re-renders from new Date() on every parent render
  // Note: stableCurrentDate is kept for potential future use but currently unused
  // const stableCurrentDate = useMemo(() => currentDate || new Date(), [currentDate?.getTime()])
  
  // 🔥 CRITICAL FIX: Memoize appointments array to prevent unnecessary re-renders
  // Only recreate if appointment IDs actually change
  const appointmentsIdsString = useMemo(() => 
    appointments.map(a => a.id).sort().join(','), 
    [appointments]
  )
  const stableAppointments = useMemo(() => appointments, [appointmentsIdsString])
  
  // Appointment Data Hook
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

  // Problems & Medications Hook (load first to get medication history)
  const problemsMedications = useProblemsMedications(
    appointmentId,
    appointment?.patient_id || null
  )

  // Prescriptions Hook (with medication history)
  const prescriptions = usePrescriptions(appointmentId, problemsMedications.medicationHistory)

  // Callback to auto-add medications to rxList when CDSS response is loaded
  const handleMedicationsAutoAdded = useCallback((medications: any[]) => {
    if (medications && medications.length > 0) {
      prescriptions.setRxList(prev => {
        // Check for duplicates before adding
        const existingMedications = prev.map(rx => rx.medication.toLowerCase())
        const newMedications = medications.filter(med => 
          !existingMedications.includes(med.medication.toLowerCase())
        )
        return [...prev, ...newMedications]
      })
    }
  }, [prescriptions.setRxList])

  // Doctor Notes Hook (with all required data)
  const doctorNotesHook = useDoctorNotes(
    appointmentId,
    appointment,
    problemsMedications.activeProblems,
    problemsMedications.resolvedProblems,
    problemsMedications.medicationHistory,
    problemsMedications.activeMedOrders,
    problemsMedications.pastMedOrders,
    problemsMedications.prescriptionLogs,
    undefined, // rxList will be passed when generating CDSS
    handleMedicationsAutoAdded // Callback to auto-add medications to rxList
  )

  const {
    // Doctor Notes
    doctorNotes,
    soapNotes,
    isSigning,
    soapSaveStatus,
    surgeriesDetails,
    
    // CDSS States - INCLUDE ALL
    cdssResponse,
    isGeneratingCDSS,
    showCDSSResults,
    isApplyingCDSS,
    cdssError,
    
    // CDSS Functions - INCLUDE ALL
    handleGenerateCDSS,
    handleApplyCDSS,
    setShowCDSSResults,
    setCdssError,
    checkAndLoadCDSS,
    generateCDSSResponse, // 🔥 YEH ADD KARO!
    
    // Other functions
    setDoctorNotes,
    handleSoapNotesChange,
    initializeSoapNotes,
    handleSaveDoctorNotes
    
  } = doctorNotesHook

  // Document Upload Hook
  const documentUpload = useDocumentUpload(appointmentId)

  // Communication Hook
  const communication = useCommunication(appointmentId, appointment)

  // Lab Results Hook
  const labResults = useLabResults(appointmentId, appointment?.patient_id || null)

  // Referrals & Follow-up Hook
  const referralsFollowUp = useReferralsFollowUp(
    appointmentId,
    appointment,
    onFollowUp
  )

  // Prior Authorization Hook
  const priorAuth = usePriorAuth(appointmentId, appointment?.patient_id || null)

  // Layout Customization Hook
  const layout = useLayoutCustomization(isOpen)

  // Memoize stable handler references to prevent renderSection recreation
  // Map to component's expected prop names (onXxx instead of handleXxx)
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

  // 🔥 CRITICAL: Memoize onDoctorNotesChange to prevent DoctorNotesSection re-renders
  const handleDoctorNotesChangeMemoized = useCallback((value: string) => {
    setDoctorNotes(value)
    handleSaveDoctorNotes(value)
  }, [setDoctorNotes, handleSaveDoctorNotes])

  // 🔥 CRITICAL: Memoize onGenerateCDSS to prevent DoctorNotesSection re-renders
  const handleGenerateCDSSMemoized = useCallback(() => {
    if (setCdssError) setCdssError(null)
    handleGenerateCDSS(prescriptions.rxList)
  }, [setCdssError, handleGenerateCDSS, prescriptions.rxList])

  // 🔥 CRITICAL: Memoize soapNotes object to prevent unnecessary re-renders
  const memoizedSoapNotes = useMemo(() => soapNotes, [
    soapNotes.chiefComplaint,
    soapNotes.rosGeneral,
    soapNotes.assessmentPlan
  ])

  // 🔥 CRITICAL: Memoize cdssResponse to prevent unnecessary re-renders
  // Only recreate if the response ID changes or if it becomes null/defined
  const cdssResponseId = cdssResponse?.id || null
  const hasCdssResponse = !!cdssResponse
  const memoizedCdssResponse = useMemo(() => cdssResponse, [
    cdssResponseId,
    hasCdssResponse
  ])

  // 🔥 CRITICAL: Memoize appointmentDocuments array to prevent unnecessary re-renders
  // Only recreate if the array length or document IDs change
  const appointmentDocumentsIds = useMemo(() => 
    documentUpload.appointmentDocuments?.map(doc => doc.id).join(',') || '',
    [documentUpload.appointmentDocuments]
  )
  const memoizedAppointmentDocuments = useMemo(() => 
    documentUpload.appointmentDocuments || [],
    [appointmentDocumentsIds]
  )

  // Local UI State
  const [activeTab, setActiveTab] = useState<'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit'>('SOAP')
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [smartAlerts, setSmartAlerts] = useState<string[]>(['ID Verified'])
  
  // Move appointment state
  const [showMoveForm, setShowMoveForm] = useState(false)
  const [selectedMoveTime, setSelectedMoveTime] = useState<string>('')
  const [moveLoading, setMoveLoading] = useState(false)

  // EHR Panel states (header buttons)
  const [showMedicationHistoryPanel, setShowMedicationHistoryPanel] = useState(false)
  const [showOrdersPanel, setShowOrdersPanel] = useState(false)
  const [showPrescriptionHistoryPanel, setShowPrescriptionHistoryPanel] = useState(false)
  const [showAppointmentsOverlay, setShowAppointmentsOverlay] = useState(false)
  
  // NEW: EHR Panel states for Allergies, Vitals, Medications
  const [showAllergiesPanel, setShowAllergiesPanel] = useState(false)
  const [showVitalsPanel, setShowVitalsPanel] = useState(false)
  const [showMedicationsPanel, setShowMedicationsPanel] = useState(false)
  
  // Minimize/restore state for panel
  const [isMinimized, setIsMinimized] = useState(false)
  
  const [patientAppointments, setPatientAppointments] = useState<Array<{
    id: string
    status: string
    service_type: string
    visit_type: string
    created_at: string
    requested_date_time: string | null
  }>>([])

  // Fetch patient appointments when overlay is opened
  // Need to get ALL appointments from ALL patient records with same email (like patients page does)
  useEffect(() => {
    if (showAppointmentsOverlay && appointment?.patient_id) {
      const fetchPatientAppointments = async () => {
        try {
          // First get the patient's email
          const { data: currentPatient, error: patientError } = await supabase
            .from('patients')
            .select('email')
            .eq('id', appointment.patient_id)
            .single()

          if (patientError || !currentPatient?.email) {
            console.error('Error fetching patient email:', patientError)
            // Fallback: just get appointments for this patient_id
            const { data: fallbackData } = await supabase
              .from('patients')
              .select(`
                id,
                appointments:appointments!appointments_patient_id_fkey (
                  id,
                  status,
                  service_type,
                  visit_type,
                  created_at,
                  requested_date_time
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

          // Get ALL patient records with the same email (handles duplicates like patients page)
          const { data: allPatientsData, error: allPatientsError } = await supabase
            .from('patients')
            .select(`
              id,
              appointments:appointments!appointments_patient_id_fkey (
                id,
                status,
                service_type,
                visit_type,
                created_at,
                requested_date_time
              )
            `)
            .eq('email', currentPatient.email)

          if (allPatientsError) {
            console.error('Error fetching all patients by email:', allPatientsError)
            return
          }

          // Merge all appointments from all patient records (like consolidatePatientsByEmail does)
          const allAppointments: any[] = []
          if (allPatientsData) {
            allPatientsData.forEach(patient => {
              if (patient.appointments && Array.isArray(patient.appointments)) {
                allAppointments.push(...patient.appointments)
              }
            })
          }

          // Sort by created_at descending
          const sorted = allAppointments.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          
          console.log('Found appointments for patient:', sorted.length)
          setPatientAppointments(sorted)
        } catch (err) {
          console.error('Error fetching patient appointments:', err)
        }
      }
      fetchPatientAppointments()
    }
  }, [showAppointmentsOverlay, appointment?.patient_id])

  // Initialize SOAP notes when appointment data loads (from normalized clinical_notes table)
  // Also check and auto-generate CDSS if needed
  const initializedRef = useRef<string | null>(null)
  const cdssCheckedRef = useRef<string | null>(null)
  
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    let idleCallbackId: number | null = null
    
    // Only initialize once per appointment ID
    if (appointment && appointmentId && initializedRef.current !== appointmentId) {
      initializedRef.current = appointmentId
      cdssCheckedRef.current = null // Reset CDSS check for new appointment
      
      // Load data in background - don't block UI
      fetchAppointmentDetails().then((result) => {
        // Check if component is still mounted and appointment hasn't changed
        if (!isMounted || initializedRef.current !== appointmentId) return
        
        if (result) {
          // Initialize from normalized clinical_notes table
          initializeSoapNotes(result.clinicalNotes || [], result.appointmentData)
          
          // TIER 3: Defer CDSS checking - this is heavy and not immediately visible
          // Load after Patient Header, SOAP Notes, and Problems/Medications are visible
          if (checkAndLoadCDSS && cdssCheckedRef.current !== appointmentId) {
            cdssCheckedRef.current = appointmentId
            // Use longer delay (500-800ms) to ensure critical data loads first
            const scheduleCDSS = (callback: () => void) => {
              if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                idleCallbackId = (window as any).requestIdleCallback(callback, { timeout: 3000 })
              } else {
                timeoutId = setTimeout(callback, 600) // 600ms delay - after Problems/Medications load
              }
            }
            
            scheduleCDSS(() => {
              // Check if component is still mounted and appointment hasn't changed
              if (!isMounted || initializedRef.current !== appointmentId) return
              
              // Only log in development
              if (process.env.NODE_ENV === 'development') {
                console.log('🚀 AppointmentDetailModal: Calling checkAndLoadCDSS (deferred)', {
                  appointmentId,
                  hasCheckAndLoadCDSS: !!checkAndLoadCDSS,
                  cdssCheckedRef: cdssCheckedRef.current,
                  hasChiefComplaint: !!appointment.chief_complaint,
                  hasSubjectiveNotes: !!appointment.subjective_notes,
                  hasNotes: !!appointment.notes,
                  appointmentDataKeys: result.appointmentData ? Object.keys(result.appointmentData) : null
                })
              }
              checkAndLoadCDSS(appointmentId, result.appointmentData)
            })
          } else {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
              console.log('⚠️ AppointmentDetailModal: Skipping checkAndLoadCDSS', {
                hasCheckAndLoadCDSS: !!checkAndLoadCDSS,
                cdssCheckedRef: cdssCheckedRef.current,
                appointmentId,
                reason: !checkAndLoadCDSS ? 'checkAndLoadCDSS is null' : 'Already checked for this appointment'
              })
            }
          }
        }
      }).catch((err) => {
        // Only log errors, don't throw - this is background loading
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching appointment details:', err)
        }
      })
    }
    
    // Reset refs when appointment changes
    if (!appointmentId) {
      initializedRef.current = null
      cdssCheckedRef.current = null
    }
    
    // Cleanup function
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (idleCallbackId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId)
        idleCallbackId = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, appointment?.id])

  // Handle appointment actions
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
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
      // This must match the calendar which always uses Phoenix timezone
      const doctorTimezone = 'America/Phoenix'
      const utcDateTime = convertDateTimeLocalToUTC(newDateTime, doctorTimezone)
      
      const response = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId, 
          newDateTime: utcDateTime
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reschedule appointment')
      }

      const result = await response.json()
      
      setShowRescheduleForm(false)
      setNewDateTime('')
      setSmartAlerts(prev => [...prev, 'Appointment rescheduled'])
      
      // Show success message with new date
      if (onSmsSent) {
        const newDateObj = new Date(result.data?.newDateTime || utcDateTime)
        onSmsSent(`Appointment rescheduled to ${newDateObj.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}. Navigate to that date on the calendar to see it.`)
      }
      
      // Refresh calendar
      onStatusChange()
      
      // Close the modal so user can navigate to new date
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRescheduleLoading(false)
    }
  }, [appointmentId, newDateTime, setError, setNewDateTime, onStatusChange, onSmsSent, onClose])

  // Cancel appointment
  const handleCancelAppointment = useCallback(async () => {
    if (!appointment?.id) return
    
    setCancelling(true)
    setError(null)
    
    try {
      const response = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.id,
          reason: 'Cancelled by provider'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel appointment')
      }

      if (onSmsSent) {
        onSmsSent('Appointment cancelled successfully')
      }

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

  // Move appointment (same day, different time)
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
        body: JSON.stringify({ 
          appointmentId, 
          newTime: selectedMoveTime
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to move appointment')
      }

      setMoveLoading(false)
      setShowMoveForm(false)
      setSelectedMoveTime('')
      setSmartAlerts(prev => [...prev, 'Appointment moved'])

      setTimeout(() => {
        onStatusChange()
      }, 0)
      
      fetchAppointmentDetails().catch(err => {
        console.error('Error refreshing details:', err)
      })
    } catch (err: any) {
      setError(err.message || 'Failed to move appointment')
    } finally {
      setMoveLoading(false)
    }
  }, [appointmentId, selectedMoveTime, fetchAppointmentDetails, setError, onStatusChange])

  const handleSignAndLock = useCallback(async () => {
    if (!appointmentId || !currentUser) return
    // Implementation is in useDoctorNotes hook - this is just a placeholder
    // The actual sign and lock is handled in the hook
  }, [appointmentId, currentUser])

  // Handle document download
  const handleDocumentDownload = useCallback(async (doc: any) => {
    let downloadUrl: string | null = null
    let blobUrl: string | null = null
    let anchorElement: HTMLAnchorElement | null = null
    
    try {
      const { supabase } = await import('@/lib/supabase')
      downloadUrl = doc.file_url
      
      if (!downloadUrl) {
        throw new Error('Invalid download URL')
      }
      
      // Check if we need to generate a signed URL
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
        if (urlData?.signedUrl) {
          downloadUrl = urlData.signedUrl
        } else {
          throw new Error('Failed to generate download URL')
        }
      }
      
      // At this point, downloadUrl is guaranteed to be a string
      if (!downloadUrl) {
        throw new Error('Invalid download URL')
      }
      
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
      // Cleanup: Always remove anchor element and revoke blob URL
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl)
      }
      if (anchorElement && document.body.contains(anchorElement)) {
        try {
          document.body.removeChild(anchorElement)
        } catch (e) {
          // Element may have already been removed, ignore error
        }
      }
    }
  }, [setError])

  // Handle email send
  const handleSendEmail = useCallback(async (to: string, subject: string, body: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Send email via API
      const response = await fetch('/api/communication/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        body: JSON.stringify({
          to,
          subject,
          body,
          patientId: appointment?.patient_id,
          appointmentId
        })
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

  // Handle SMS communication logging
  const handleLogSMSCommunication = useCallback(async (entry: any) => {
    try {
      // Log to communication_history table
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!doctor) return

      const { error } = await supabase
        .from('communication_history')
        .insert([{
          type: 'sms',
          direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
          to_number: entry.to_number || entry.to,
          from_number: entry.from_number || null,
          message: entry.content || entry.message,
          status: entry.status || 'sent',
          doctor_id: doctor.id,
          patient_id: entry.patient_id || appointment?.patient_id,
          created_at: entry.created_at || new Date().toISOString()
        }])

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging SMS to communication_history:', error)
      }
    } catch (error) {
      console.error('Error logging SMS:', error)
    }
  }, [appointment?.patient_id])

  // Handle Call communication logging
  const handleLogCallCommunication = useCallback(async (entry: any) => {
    try {
      // Log to communication_history table
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!doctor) return

      const { error } = await supabase
        .from('communication_history')
        .insert([{
          type: 'call',
          direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
          to_number: entry.to_number || entry.to,
          from_number: entry.from_number || null,
          message: entry.message || null,
          status: entry.status || 'initiated',
          duration: entry.duration || null,
          twilio_sid: entry.twilio_sid || null,
          recording_url: entry.recording_url || null,
          doctor_id: doctor.id,
          patient_id: entry.patient_id || appointment?.patient_id,
          created_at: entry.initiated_at || entry.created_at || new Date().toISOString()
        }])

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging call to communication_history:', error)
      }
    } catch (error) {
      console.error('Error logging call:', error)
    }
  }, [appointment?.patient_id])

  // Handle email communication logging
  const handleLogEmailCommunication = useCallback(async (entry: any) => {
    try {
      // Log to communication_history table (matches actual database structure)
      // Table structure: type, direction, to_number, from_number, message, status, doctor_id, patient_id
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Get current user/doctor
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!doctor) return

      // Format email content for message field (subject + body)
      const emailContent = entry.subject 
        ? `Subject: ${entry.subject}\n\n${entry.body || ''}`
        : entry.body || ''

      // Insert into communication_history table
      // Note: communication_history doesn't have to_email/from_email columns
      // We store email addresses in message field or use to_number/from_number as text
      const { error } = await supabase
        .from('communication_history')
        .insert([{
          type: 'email', // Valid: 'call', 'sms', 'video', 'fax', 'email'
          direction: entry.direction === 'outbound' ? 'outbound' : 'inbound', // 'inbound' or 'outbound'
          to_number: entry.to_email || null, // Store email address in to_number field (as text)
          from_number: entry.from_email || null, // Store email address in from_number field (as text)
          message: emailContent, // Store email subject + body in message field
          status: entry.status || 'sent',
          doctor_id: doctor.id,
          patient_id: entry.patient_id || appointment?.patient_id,
          created_at: entry.created_at || new Date().toISOString()
        }])

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging email to communication_history:', error)
      }
    } catch (error) {
      console.error('Error logging email:', error)
      // Don't throw - logging is not critical
    }
  }, [appointment?.patient_id])

  // Handle CDSS apply with medication addition
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

  const useSectionProps = (
    sectionId: string,
    panel: 'left' | 'right',
    layout: any
  ) => {
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
      className: `relative ${
        layout.isCustomizeMode ? 'cursor-move' : ''
      } ${isDragging ? 'opacity-50' : ''} ${
        isDragOver ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
      } transition-all`,
      style: { contain: 'layout style paint' }
    }
  }

  // 🔥 CRITICAL: Memoize onCloseCDSS to prevent recreation on every render
  const handleCloseCDSS = useCallback(() => {
    setShowCDSSResults(false)
    setCdssError?.(null)
  }, [setCdssError])

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
    [
      appointment,
      memoizedSoapNotes,
      doctorNotes,
      activeTab,
      soapSaveStatus,
      isSigning,
      layout.isCustomizeMode,
      handleSoapNotesChange,
      handleDoctorNotesChangeMemoized,
      setActiveTab,
      handleSignAndLock,
      handleGenerateCDSSMemoized,
      isGeneratingCDSS,
      showCDSSResults,
      memoizedCdssResponse,
      cdssError,
      isApplyingCDSS,
      handleApplyCDSSWithMedications,
      handleCloseCDSS,
      memoizedAppointmentDocuments,
      documentUpload.uploadingDocument,
      documentUpload.selectedDocument,
      documentUpload.uploadError,
      documentUpload.handleDocumentUpload,
      documentUpload.setSelectedDocument,
      handleDocumentDownload
    ]
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
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
            />
          )
  
        case 'doctor-notes':
          return <React.Fragment key={sectionId}>{renderDoctorNotes(sectionProps)}</React.Fragment>

        case 'meeting-info':
          return (
            <ZoomMeetingEmbed
              key={sectionId}
              appointment={appointment}
              currentUser={currentUser}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              sectionId={sectionId}
            />
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
              onEditingRxDataChange={(data) => {
                prescriptions.setEditingRxData(data)
              }}
              onSendERx={async () => {
                if (appointment) {
                  await prescriptions.handleSendERx(appointment, setError)
                }
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
                  // Update communication state first
                  communication.handleSmsToChange(to)
                  communication.handleSmsMessageChange(message)
                  
                  // Wait a tick for state to update, then send
                  await new Promise(resolve => setTimeout(resolve, 0))
                  
                  // Send SMS via existing handler (it uses state values)
                  try {
                    await communication.handleSendSMS()
                    
                    // Log to communication history after successful send
                    await handleLogSMSCommunication({
                      type: 'sms',
                      direction: 'outbound',
                      to_number: to,
                      content: message,
                      status: 'sent',
                      patient_id: appointment?.patient_id,
                      created_at: new Date().toISOString()
                    })
                  } catch (err: any) {
                    console.error('Error sending SMS:', err)
                    // Log failure
                    await handleLogSMSCommunication({
                      type: 'sms',
                      direction: 'outbound',
                      to_number: to,
                      content: message,
                      status: 'failed',
                      patient_id: appointment?.patient_id,
                      created_at: new Date().toISOString()
                    })
                    throw err
                  }
                }}
                onLogCommunication={handleLogSMSCommunication}
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
                onLogCommunication={handleLogCallCommunication}
                onMakeCall={async (phoneNumber) => {
                  communication.handleCallPhoneNumberChange(phoneNumber)
                  await communication.handleMakeCall()
                  await handleLogCallCommunication({
                    type: 'call',
                    direction: 'outbound',
                    to_number: phoneNumber,
                    status: 'initiated',
                    patient_id: appointment?.patient_id,
                    initiated_at: new Date().toISOString()
                  })
                }}
                onEndCall={async () => {
                  await communication.handleEndCall()
                  await handleLogCallCommunication({
                    type: 'call',
                    direction: 'outbound',
                    to_number: communication.callPhoneNumber,
                    status: 'completed',
                    duration: communication.callDuration,
                    patient_id: appointment?.patient_id,
                    completed_at: new Date().toISOString()
                  })
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
                onLogCommunication={handleLogEmailCommunication}
              />
            </div>
          )

        case 'lab-results':
          return (
            <LabResultsSection
              key={sectionId}
              labResults={labResults.labResults}
              isLoadingLabs={labResults.isLoadingLabs}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              onLoadLabResults={labResults.loadLabResults}
            />
          )

        case 'referrals-followup':
          return (
            <ReferralsFollowUpSection
              key={sectionId}
              referrals={referralsFollowUp.referrals}
              showReferralForm={referralsFollowUp.showReferralForm}
              setShowReferralForm={referralsFollowUp.setShowReferralForm}
              newReferral={referralsFollowUp.newReferral}
              setNewReferral={referralsFollowUp.setNewReferral}
              showFollowUpScheduler={referralsFollowUp.showFollowUpScheduler}
              setShowFollowUpScheduler={referralsFollowUp.setShowFollowUpScheduler}
              followUpData={referralsFollowUp.followUpData}
              setFollowUpData={referralsFollowUp.setFollowUpData}
              isSchedulingFollowUp={referralsFollowUp.isSchedulingFollowUp}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              onCreateReferral={async () => {
                try {
                  await referralsFollowUp.handleCreateReferral()
                } catch (err: any) {
                  setError(err.message)
                }
              }}
              onScheduleFollowUp={async () => {
                try {
                  await referralsFollowUp.handleScheduleFollowUp()
                  onStatusChange() // Refresh calendar
                } catch (err: any) {
                  setError(err.message)
                }
              }}
              error={error}
            />
          )

        case 'prior-auth':
          return (
            <PriorAuthSection
              key={sectionId}
              priorAuths={priorAuth.priorAuths}
              showPriorAuthForm={priorAuth.showPriorAuthForm}
              setShowPriorAuthForm={priorAuth.setShowPriorAuthForm}
              newPriorAuth={priorAuth.newPriorAuth}
              setNewPriorAuth={priorAuth.setNewPriorAuth}
              isSubmitting={priorAuth.isSubmitting}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              onSubmitPriorAuth={async () => {
                try {
                  await priorAuth.handleSubmitPriorAuth()
                } catch (err: any) {
                  setError(err.message)
                }
              }}
              error={error}
            />
          )

        case 'communication-history':
          return (
            <CommunicationHistorySection
              key={sectionId}
              communicationHistory={communication.communicationHistory}
              loadingHistory={communication.loadingHistory}
              playingRecordingId={communication.playingRecordingId}
              isCustomizeMode={layout.isCustomizeMode}
              sectionProps={sectionProps}
              formatDuration={communication.formatDuration}
              formatHistoryDate={communication.formatHistoryDate}
              onPlayRecording={communication.handlePlayRecording}
              audioRefs={communication.audioRefs}
            />
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
              <MedicalRecordsView
                appointmentId={appointmentId || undefined}
                patientId={appointment?.patient_id || null}
              />
            </div>
          )

        default:
          return null
      }
    },
    [layout, appointment, currentUser, problemsMedications, renderDoctorNotes, problemsMedicationsHandlers, surgeriesDetails, prescriptions, communication, error, setError, labResults, referralsFollowUp, priorAuth, handleSendEmail, handleLogEmailCommunication, handleLogSMSCommunication, handleLogCallCommunication, onStatusChange]
  )
  
  
  // Removed debug useEffect - it was causing unnecessary re-renders

  // Fetch communication history when appointment loads
  useEffect(() => {
    if (appointment?.patients?.phone) {
      communication.fetchCommunicationHistory(appointment.patients.phone)
    }
  }, [appointment?.patients?.phone, communication.fetchCommunicationHistory])

  // Reset scroll position when modal opens or appointment changes
  // Use a ref to track if we should prevent auto-scroll
  const preventAutoScrollRef = useRef(false)
  const scrollResetIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (isOpen && layout.scrollContainerRef.current) {
      // Set flag to prevent auto-scroll for 800ms after modal opens
      preventAutoScrollRef.current = true
      
      const container = layout.scrollContainerRef.current
      
      // Immediately set scroll to top
      container.scrollTop = 0
      
      // Aggressively reset scroll position multiple times to prevent any auto-scroll
      const resetScroll = () => {
        if (container && preventAutoScrollRef.current) {
          container.scrollTop = 0
        }
      }
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(resetScroll)
      
      // Multiple timeouts to catch scroll at different render stages
      const timers = [
        setTimeout(resetScroll, 0),
        setTimeout(resetScroll, 50),
        setTimeout(resetScroll, 100),
        setTimeout(resetScroll, 200),
        setTimeout(resetScroll, 300),
        setTimeout(resetScroll, 500),
      ]
      
      // Set up interval to continuously reset scroll during prevent period
      scrollResetIntervalRef.current = setInterval(() => {
        if (preventAutoScrollRef.current && container.scrollTop > 10) {
          container.scrollTop = 0
        }
      }, 50)
      
      // Reset prevent flag after 800ms
      const timer4 = setTimeout(() => {
        preventAutoScrollRef.current = false
        if (scrollResetIntervalRef.current) {
          clearInterval(scrollResetIntervalRef.current)
          scrollResetIntervalRef.current = null
        }
      }, 800)
      
      return () => {
        timers.forEach(timer => clearTimeout(timer))
        clearTimeout(timer4)
        if (scrollResetIntervalRef.current) {
          clearInterval(scrollResetIntervalRef.current)
          scrollResetIntervalRef.current = null
        }
        preventAutoScrollRef.current = false
      }
    } else {
      preventAutoScrollRef.current = false
      if (scrollResetIntervalRef.current) {
        clearInterval(scrollResetIntervalRef.current)
        scrollResetIntervalRef.current = null
      }
    }
  }, [isOpen, appointmentId])

  // Helper function to format time
  // CRITICAL: Slots are created with setHours() which sets local browser time,
  // but they represent Phoenix time visually. Format using local time methods
  // to match the main calendar display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Helper function to get date string in YYYY-MM-DD format for comparison
  const getDateString = (date: Date, timezone?: string): string => {
    if (timezone) {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
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

  // Helper function to round a time to the nearest 30-minute slot
  // Use UTC methods since convertToTimezone returns UTC dates
  const roundToNearestSlot = (appointmentDate: Date): Date => {
    const rounded = new Date(appointmentDate)
    const minutes = appointmentDate.getUTCMinutes()
    const hours = appointmentDate.getUTCHours()
    
    // Round to nearest 30-minute slot
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

  // Helper function to get appointment for a specific slot (matching main calendar logic)
  const getAppointmentForSlot = (date: Date, time: Date): CalendarAppointment | null => {
    if (!stableAppointments || stableAppointments.length === 0) return null
    
    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
    // This must match the main calendar which always uses Phoenix timezone
    const doctorTimezone = 'America/Phoenix'
    
    // Convert the date to Phoenix timezone first (matching how appointments are mapped)
    const dateInPhoenix = convertToTimezone(date.toISOString(), doctorTimezone)
    // Format the date string from the converted date (which has UTC values representing Phoenix local time)
    const slotDateStr = getDateString(dateInPhoenix, doctorTimezone)
    
    // CRITICAL: Time slots are created with setHours() which sets local browser time.
    // However, they are MEANT to represent Phoenix time visually (5 AM - 8 PM Phoenix).
    // The appointment mapping uses convertToTimezone() which returns UTC values representing Phoenix local time,
    // and extracts hours/minutes using getUTCHours()/getUTCMinutes().
    // To match, we need to treat the time slot's hour/minute as Phoenix time directly,
    // and create a UTC Date representing that Phoenix time, then extract UTC hours/minutes.
    // We use the date's year/month/day in Phoenix timezone, and the time slot's hour/minute as Phoenix time.
    const phoenixYear = dateInPhoenix.getUTCFullYear()
    const phoenixMonth = dateInPhoenix.getUTCMonth()
    const phoenixDay = dateInPhoenix.getUTCDate()
    // Time slots are created to represent Phoenix time visually, so use hour/minute directly as Phoenix time
    // (even though setHours() sets browser local time, we treat it as Phoenix time for matching)
    const phoenixHour = time.getHours()
    const phoenixMinute = time.getMinutes()
    // Create a UTC Date representing this Phoenix time (matching convertToTimezone format)
    // This creates a Date where UTC values represent Phoenix local time
    const timeSlotAsPhoenix = new Date(Date.UTC(phoenixYear, phoenixMonth, phoenixDay, phoenixHour, phoenixMinute, 0))
    // Extract UTC hours/minutes (which represent Phoenix local time, matching appointment mapping)
    const hour = timeSlotAsPhoenix.getUTCHours()
    const minute = timeSlotAsPhoenix.getUTCMinutes()
    
    const slotKey = `${slotDateStr}_${hour}_${minute}`
    
    // Create appointment map using same logic as main calendar
    const appointmentMap = new Map<string, CalendarAppointment>()
    
    stableAppointments.forEach(apt => {
      if (!apt.requested_date_time) return
      
      const aptDate = convertToTimezone(apt.requested_date_time, doctorTimezone)
      const roundedSlot = roundToNearestSlot(aptDate)
      
      // Use UTC methods to avoid browser timezone issues (matching main calendar)
      const dateStr = getDateString(aptDate, doctorTimezone)
      const aptHour = roundedSlot.getUTCHours()
      const aptMinute = roundedSlot.getUTCMinutes()
      const key = `${dateStr}_${aptHour}_${aptMinute}`
      
      appointmentMap.set(key, apt)
    })
    
    return appointmentMap.get(slotKey) || null
  }

  // Helper function to get appointment reason (matching main calendar)
  const getAppointmentReason = (apt: CalendarAppointment): string => {
    // Check clinical_notes if available
    if ((apt as any).clinical_notes && Array.isArray((apt as any).clinical_notes) && (apt as any).clinical_notes.length > 0) {
      const reasonNote = (apt as any).clinical_notes.find(
        (note: any) => note.note_type === 'chief_complaint' || note.note_type === 'subjective'
      )
      if (reasonNote?.content) {
        return reasonNote.content
      }
    }
    
    // Check appointment-level fields
    const aptAny = apt as any
    return aptAny.chief_complaint || 
           aptAny.reason || 
           ''
  }

// Render current day slots (left sidebar) - Updated to match new design
const renderCurrentDaySlots = () => {
      if (!appointment?.requested_date_time) return null
      
      // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
      // This must match the main calendar which always uses Phoenix timezone
      const doctorTimezone = 'America/Phoenix'
      const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
      
      // Generate time slots (5 AM to 8 PM, 30-min intervals)
      const slots: Date[] = []
      for (let hour = 5; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = new Date(appointmentDate)
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
            {appointmentDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          
          {/* Time Slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {slots.map((time) => {
              const slotAppointment = getAppointmentForSlot(appointmentDate, time)
              const isSelected = slotAppointment?.id === appointment?.id
              const isAvailable = !slotAppointment
              const isMoveSelected = showMoveForm && selectedMoveTime === `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
  
              return (
                <div 
                  key={time.getTime()}
                  onClick={() => {
                    if (showMoveForm && isAvailable) {
                      setSelectedMoveTime(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`)
                    } else if (slotAppointment && slotAppointment.id !== appointment?.id) {
                      if (onAppointmentSwitch) {
                        onAppointmentSwitch(slotAppointment.id)
                      }
                    }
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isMoveSelected
                      ? 'linear-gradient(135deg, rgba(0, 230, 255, 0.3), rgba(0, 230, 255, 0.2))'
                      : isSelected
                        ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.3), rgba(211, 47, 47, 0.2))'
                        : slotAppointment
                          ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.2), rgba(211, 47, 47, 0.15))'
                          : 'linear-gradient(135deg, rgba(25,214,127,.18), rgba(25,214,127,.12))',
                    border: isMoveSelected
                      ? '2px solid #00e6ff'
                      : isSelected
                        ? '2px solid #00e6ff'
                        : slotAppointment
                          ? '2px solid rgba(229, 57, 53, 0.6)'
                          : '2px solid rgba(25,214,127,.6)',
                    boxShadow: isMoveSelected
                      ? '0 0 12px rgba(0, 230, 255, 0.4)'
                      : isSelected
                        ? '0 0 12px rgba(229, 57, 53, 0.4), 0 0 20px rgba(0, 230, 255, 0.3)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    color: slotAppointment ? '#ffcdd2' : '#cde7da'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{formatTime(time)}</div>
                  {slotAppointment && (
                    <>
                      <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>
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
                        {slotAppointment.visit_type || 'visit'}
                      </span>
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
      {/* Backdrop - hide when minimized */}
      {!isMinimized && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      {/* Main container - changes based on minimized state */}
      {isMinimized ? (
        /* MINIMIZED STATE - Fixed bottom bar */
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-cyan-500/30 shadow-2xl">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Left: Appointment info */}
              <div className="flex items-center gap-3">
                <h2 className="text-white font-bold text-sm">
                  <span className="text-cyan-400">APPOINTMENT</span>
                  {appointment?.requested_date_time && (
                    <> • {(() => {
                      const doctorTimezone = 'America/Phoenix'
                      const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                      return appointmentDate.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                    })()}</>
                  )}
                  {appointment?.status && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      appointment.status === 'pending' ? 'bg-yellow-600' :
                      appointment.status === 'accepted' ? 'bg-green-600' :
                      appointment.status === 'completed' ? 'bg-blue-600' :
                      appointment.status === 'cancelled' ? 'bg-gray-600' : 'bg-gray-600'
                    }`}>
                      {appointment.status.toUpperCase()}
                    </span>
                  )}
                </h2>
              </div>
              
              {/* Middle: Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* EHR Quick Access Buttons */}
                <button
                  onClick={() => { setIsMinimized(false); setShowMedicationHistoryPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
                >
                  <Pill className="h-3.5 w-3.5" />
                  Medication History
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowOrdersPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Orders
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowPrescriptionHistoryPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs font-medium"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Prescription History
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowAppointmentsOverlay(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Appointments
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowAllergiesPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Allergies
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowVitalsPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Vitals
                </button>
                <button
                  onClick={() => { setIsMinimized(false); setShowMedicationsPanel(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
                >
                  <Pill className="h-3.5 w-3.5" />
                  Medications
                </button>
                
                {/* Status action buttons */}
                {appointment && appointment.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAppointmentAction('accept')}
                      disabled={actionLoading === 'accept'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleAppointmentAction('reject')}
                      disabled={actionLoading === 'reject'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </>
                )}
                
                {/* Move/Reschedule/Cancel buttons */}
                <button
                  onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move
                </button>
                <button
                  onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reschedule
                </button>
                <button
                  onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel Appt
                </button>
                
                {/* Customize button */}
                <button
                  onClick={() => { setIsMinimized(false); layout.setIsCustomizeMode(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Customize
                </button>
              </div>
              
              {/* Right: Restore and Close buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs font-medium"
                  title="Restore panel"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* EXPANDED STATE - Original full panel */
        <div className="fixed top-0 right-0 h-full w-full z-50 flex">
          {/* Left Calendar Sidebar - Updated styling */}
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
          
          {/* Right Panel - 90% width */}
          <div className={`flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/20 shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10 flex-shrink-0 px-4 py-2">
            {/* Top row: Window controls (minimize/restore/close) on left */}
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                title="Minimize"
              >
                <span className="text-sm font-medium">—</span>
              </button>
              <button
                onClick={() => setIsMinimized(false)}
                className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                title="Restore"
              >
                <span className="text-sm font-medium">□</span>
              </button>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-red-600 text-white rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Second row: Appointment info and action buttons */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-sm sm:text-base">
                <span className="text-cyan-400">APPOINTMENT</span>
                {appointment?.requested_date_time && (
                  <> • {(() => {
                    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
                    // This must match the main calendar which always uses Phoenix timezone
                    const doctorTimezone = 'America/Phoenix'
                    const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                    return appointmentDate.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  })()}</>
                )}
                {appointment?.status && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    appointment.status === 'pending' ? 'bg-yellow-600' :
                    appointment.status === 'accepted' ? 'bg-green-600' :
                    appointment.status === 'completed' ? 'bg-blue-600' :
                    appointment.status === 'cancelled' ? 'bg-gray-600' : 'bg-gray-600'
                  }`}>
                    {appointment.status.toUpperCase()}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Buttons - only show when not in customize mode */}
              {!layout.isCustomizeMode && appointment && (
                <>
                  {/* EHR Quick Access Buttons - Always visible */}
                  <button
                    onClick={() => setShowMedicationHistoryPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Medication History
                  </button>
                  <button
                    onClick={() => setShowOrdersPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Orders
                  </button>
                  <button
                    onClick={() => setShowPrescriptionHistoryPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs font-medium"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Prescription History
                  </button>
                  <button
                    onClick={() => setShowAppointmentsOverlay(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Appointments
                  </button>
                  
                  {/* NEW: Allergies, Vitals, Medications buttons */}
                  <button
                    onClick={() => setShowAllergiesPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Allergies
                  </button>
                  <button
                    onClick={() => setShowVitalsPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs font-medium"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Vitals
                  </button>
                  <button
                    onClick={() => setShowMedicationsPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium"
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Medications
                  </button>

                  {/* Accept/Reject for pending appointments */}
                  {appointment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAppointmentAction('accept')}
                        disabled={actionLoading === 'accept'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50"
                      >
                        {actionLoading === 'accept' ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleAppointmentAction('reject')}
                        disabled={actionLoading === 'reject'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50"
                      >
                        {actionLoading === 'reject' ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </button>
                    </>
                  )}
                  
                  {/* Move button */}
                  <button
                    onClick={() => {
                      setShowMoveForm(!showMoveForm)
                      setShowRescheduleForm(false)
                      setShowCancelConfirm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showMoveForm ? 'bg-cyan-700' : 'bg-cyan-600'} text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {showMoveForm ? 'Cancel Move' : 'Move'}
                  </button>
                  
                  {/* Reschedule button */}
                  <button
                    onClick={() => {
                      setShowRescheduleForm(!showRescheduleForm)
                      setShowMoveForm(false)
                      setShowCancelConfirm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showRescheduleForm ? 'bg-orange-700' : 'bg-orange-600'} text-white rounded-lg hover:bg-orange-700 transition-colors text-xs`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {showRescheduleForm ? 'Cancel' : 'Reschedule'}
                  </button>
                  
                  {/* Cancel appointment button */}
                  <button
                    onClick={() => {
                      setShowCancelConfirm(!showCancelConfirm)
                      setShowMoveForm(false)
                      setShowRescheduleForm(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${showCancelConfirm ? 'bg-red-700' : 'bg-red-600'} text-white rounded-lg hover:bg-red-700 transition-colors text-xs`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel Appt
                  </button>
                  
                  {/* Complete button for accepted appointments */}
                  {appointment.status === 'accepted' && (
                    <button
                      onClick={() => handleAppointmentAction('complete')}
                      disabled={actionLoading === 'complete'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs disabled:opacity-50"
                    >
                      {actionLoading === 'complete' ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Complete
                    </button>
                  )}
                </>
              )}
              
              {layout.isCustomizeMode ? (
                <>
                  <button
                    onClick={layout.saveLayout}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm"
                  >
                    <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Save Layout</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  <button
                    onClick={() => layout.setIsCustomizeMode(false)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => layout.setIsCustomizeMode(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm"
                  >
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Customize</span>
                    <span className="sm:hidden">Edit</span>
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
                  {selectedMoveTime && (
                    <span className="ml-2 font-bold">Selected: {selectedMoveTime}</span>
                  )}
                </div>
                <button
                  onClick={handleMoveAppointment}
                  disabled={!selectedMoveTime || moveLoading}
                  className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  {moveLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Confirm Move'
                  )}
                </button>
              </div>
            </div>
          )}
          
          {showRescheduleForm && (
            <div className="mt-3 p-3 bg-orange-900/50 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-orange-300" />
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-white/20 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleReschedule}
                  disabled={!newDateTime || rescheduleLoading}
                  className="px-4 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  {rescheduleLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Confirm Reschedule'
                  )}
                </button>
              </div>
            </div>
          )}
          
          {showCancelConfirm && (
            <div className="mt-3 p-3 bg-red-900/50 rounded-lg border border-red-500/30">
              <div className="flex items-center justify-between">
                <div className="text-red-300 text-sm">
                  Are you sure you want to cancel this appointment? This action cannot be undone.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-4 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                  >
                    No, Keep It
                  </button>
                  <button
                    onClick={handleCancelAppointment}
                    disabled={cancelling}
                    className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-2"
                  >
                    {cancelling ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Yes, Cancel Appointment'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          ref={layout.scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
          style={{ 
            scrollBehavior: 'auto',
            scrollPaddingTop: '0'
          }}
          onFocus={(e) => {
            // Prevent focus from causing scroll during initial load
            if (preventAutoScrollRef.current && layout.scrollContainerRef.current) {
              e.stopPropagation()
              // Reset scroll if it moved
              setTimeout(() => {
                if (layout.scrollContainerRef.current) {
                  layout.scrollContainerRef.current.scrollTop = 0
                }
              }, 0)
            }
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
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
      )}

      {/* Document Viewer Modal */}
      {documentUpload.selectedDocument && (
        <DocumentViewer
          document={documentUpload.selectedDocument}
          onClose={() => documentUpload.setSelectedDocument(null)}
        />
      )}

      {/* Medication History Panel (Surescripts) */}
      {appointment?.patient_id && (
        <MedicationHistoryPanel
          isOpen={showMedicationHistoryPanel}
          onClose={() => setShowMedicationHistoryPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
          patientDOB={appointment?.patients?.date_of_birth ?? undefined}
          onReconcile={(medications) => {
            // Add reconciled medications to the medication history
            const newMeds = medications.map((med, idx) => ({
              id: `reconciled-${Date.now()}-${idx}`,
              medication: med.medication_name,
              provider: med.prescriber || 'Surescripts',
              date: med.start_date || new Date().toISOString().split('T')[0]
            }))
            // Add to problemsMedications hook
            newMeds.forEach(med => {
              problemsMedications.handleAddMedicationHistory(med.medication, med.provider, med.date)
            })
          }}
        />
      )}

      {/* Orders Panel - BLUE THEME */}
      {appointment?.patient_id && (
        <OrdersPanel
          isOpen={showOrdersPanel}
          onClose={() => setShowOrdersPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment.patients?.first_name || ''} ${appointment.patients?.last_name || ''}`}
          appointmentId={appointment.id}
        />
      )}

      {/* Prescription History Panel - TEAL THEME */}
      {appointment?.patient_id && (
        <PrescriptionHistoryPanel
          isOpen={showPrescriptionHistoryPanel}
          onClose={() => setShowPrescriptionHistoryPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment.patients?.first_name || ''} ${appointment.patients?.last_name || ''}`}
          appointmentId={appointment.id}
        />
      )}

      {/* Appointments Overlay Panel */}
      {appointment?.patient_id && (
        <AppointmentsOverlayPanel
          isOpen={showAppointmentsOverlay}
          onClose={() => setShowAppointmentsOverlay(false)}
          patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
          patientDOB={appointment?.patients?.date_of_birth ?? undefined}
          appointments={patientAppointments}
          onViewAppointment={(apptId) => {
            setShowAppointmentsOverlay(false)
            if (onAppointmentSwitch) {
              onAppointmentSwitch(apptId)
            }
          }}
        />
      )}

      {/* NEW: Allergies Panel */}
      {appointment?.patient_id && (
        <AllergiesPanel
          isOpen={showAllergiesPanel}
          onClose={() => setShowAllergiesPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
        />
      )}

      {/* NEW: Vitals Panel */}
      {appointment?.patient_id && (
        <VitalsPanel
          isOpen={showVitalsPanel}
          onClose={() => setShowVitalsPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
          appointmentId={appointmentId ?? undefined}
        />
      )}

      {/* NEW: Medications Panel */}
      {appointment?.patient_id && (
        <MedicationsPanel
          isOpen={showMedicationsPanel}
          onClose={() => setShowMedicationsPanel(false)}
          patientId={appointment.patient_id}
          patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
        />
      )}
    </>
  )
}




























































































































































































































































































