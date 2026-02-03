'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Edit, Save, Calendar, Clock, CheckCircle, XCircle, ArrowRight, RotateCcw, Pill, FileText, ClipboardList, CalendarDays, AlertTriangle, Activity, Minimize2, Maximize2, ChevronDown, ChevronUp, MoreHorizontal, Copy, Check, Phone, PhoneCall, PhoneOff, Send, Link2, Lock, Unlock, GripVertical, MessageSquare, ExternalLink } from 'lucide-react'
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
// COPY BUTTON HELPER
// ═══════════════════════════════════════════════════════════════
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-0.5 transition-colors"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#00cba9' : '#6b7280' }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

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
  const [isMinimized, setIsMinimized] = useState(false)
  
  // NEW: Track which right-panel view is active (null = SOAP notes default)
  const [activeRightPanel, setActiveRightPanel] = useState<string | null>(null)
  // NEW: Patient card collapsed state
  const [patientCardCollapsed, setPatientCardCollapsed] = useState(false)
  // NEW: Actions dropdown
  const [showActionsDropdown, setShowActionsDropdown] = useState(false)
  // NEW: Call timer
  const [callTime, setCallTime] = useState(0)
  const [callActive, setCallActive] = useState(false)
  
  // NEW: Quick actions from video panel
  const [showQuickSMS, setShowQuickSMS] = useState(false)
  const [quickSMSMessage, setQuickSMSMessage] = useState('')
  const [sendingQuickSMS, setSendingQuickSMS] = useState(false)
  const [quickSMSSent, setQuickSMSSent] = useState(false)
  const [showDialpad, setShowDialpad] = useState(false)
  const [dialpadNumber, setDialpadNumber] = useState('')
  const [showResendLink, setShowResendLink] = useState(false)
  const [resendingLink, setResendingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkResent, setLinkResent] = useState(false)
  
  // NEW: Daily.co Dialout
  const [isDialingOut, setIsDialingOut] = useState(false)
  const [dialoutActive, setDialoutActive] = useState(false)
  const [dialoutError, setDialoutError] = useState<string | null>(null)
  
  // NEW: Video signal / call fallback
  const [videoSignalWeak, setVideoSignalWeak] = useState(false)
  const [showCallFallback, setShowCallFallback] = useState(false)
  
  // NEW: Doctor self-view overlay (UI only — does not interfere with Daily.co)
  const [drSelfViewExpanded, setDrSelfViewExpanded] = useState(false)
  const [drSelfViewHidden, setDrSelfViewHidden] = useState(false)
  
  // NEW: Mobile-first — detect viewport, swipeable tab panels
  const [isMobile, setIsMobile] = useState(false)
  const [mobileTab, setMobileTab] = useState<'video' | 'soap' | 'chart' | 'comms'>('video')
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Swipe handler for mobile tab navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    // Only swipe if horizontal movement > 60px and > vertical
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      const tabs: Array<'video' | 'soap' | 'chart' | 'comms'> = ['video', 'soap', 'chart', 'comms']
      const idx = tabs.indexOf(mobileTab)
      if (dx < 0 && idx < tabs.length - 1) setMobileTab(tabs[idx + 1]) // swipe left → next
      if (dx > 0 && idx > 0) setMobileTab(tabs[idx - 1]) // swipe right → prev
    }
    touchStartRef.current = null
  }, [mobileTab])
  
  // NEW: Resizable/movable/lockable panel
  const [panelWidth, setPanelWidth] = useState<number | null>(null) // null = full width
  const [panelHeight, setPanelHeight] = useState<number | null>(null) // null = full height
  const [panelX, setPanelX] = useState<number | null>(null) // null = right-aligned
  const [panelY, setPanelY] = useState<number | null>(null) // null = top-aligned
  const [panelLocked, setPanelLocked] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [panelMode, setPanelMode] = useState<'full' | 'floating'>('full') // full = old behavior, floating = resizable
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; edge: string } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPanelX: number; startPanelY: number } | null>(null)
  
  const [patientAppointments, setPatientAppointments] = useState<Array<{
    id: string
    status: string
    service_type: string
    visit_type: string
    created_at: string
    requested_date_time: string | null
  }>>([])

  // ═══════════════════════════════════════════════════════════════
  // CALL TIMER — Track active video calls
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!callActive) return
    const interval = setInterval(() => setCallTime(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [callActive])

  const formatCallTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // ═══════════════════════════════════════════════════════════════
  // IDLE ALARM — Remind doctor if minimized too long during call
  // Doctor sets the threshold (default 2 min). Fires sound + vibrate.
  // ═══════════════════════════════════════════════════════════════
  const [idleAlarmEnabled, setIdleAlarmEnabled] = useState(true)
  const [idleAlarmMinutes, setIdleAlarmMinutes] = useState(2) // doctor-configurable
  const [idleAlarmFiring, setIdleAlarmFiring] = useState(false)
  const [idleAlarmDismissed, setIdleAlarmDismissed] = useState(false)
  const [showIdleAlarmSettings, setShowIdleAlarmSettings] = useState(false)
  const idleMinimizedAtRef = useRef<number | null>(null)
  const idleAlarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Track when panel was minimized during an active call
  useEffect(() => {
    if (isMinimized && callActive) {
      idleMinimizedAtRef.current = Date.now()
      setIdleAlarmDismissed(false)
      setIdleAlarmFiring(false)
    } else {
      idleMinimizedAtRef.current = null
      setIdleAlarmFiring(false)
      setIdleAlarmDismissed(false)
      // Stop any ongoing alarm sounds
      if (idleAlarmIntervalRef.current) {
        clearInterval(idleAlarmIntervalRef.current)
        idleAlarmIntervalRef.current = null
      }
    }
  }, [isMinimized, callActive])

  // Check idle threshold every second
  useEffect(() => {
    if (!isMinimized || !callActive || !idleAlarmEnabled || idleAlarmDismissed) return
    const check = setInterval(() => {
      if (!idleMinimizedAtRef.current) return
      const elapsed = (Date.now() - idleMinimizedAtRef.current) / 1000
      if (elapsed >= idleAlarmMinutes * 60 && !idleAlarmFiring) {
        setIdleAlarmFiring(true)
      }
    }, 1000)
    return () => clearInterval(check)
  }, [isMinimized, callActive, idleAlarmEnabled, idleAlarmMinutes, idleAlarmDismissed, idleAlarmFiring])

  // Fire alarm: sound beep + vibrate pattern
  useEffect(() => {
    if (!idleAlarmFiring) return
    
    // Vibrate (mobile) — repeating pattern: 200ms on, 100ms off, 200ms on
    const vibrate = () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
    }
    vibrate()
    
    // Audio beep using Web Audio API (no external files needed)
    const playBeep = () => {
      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext()
        const ctx = audioContextRef.current
        // Triple beep: medical-style urgent tone
        const playTone = (startTime: number, freq: number, duration: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.3, startTime)
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
          osc.start(startTime)
          osc.stop(startTime + duration)
        }
        const now = ctx.currentTime
        playTone(now, 880, 0.15)        // A5
        playTone(now + 0.2, 880, 0.15)  // A5
        playTone(now + 0.4, 1109, 0.25) // C#6 — higher urgency
      } catch (e) { /* audio not available */ }
    }
    playBeep()
    
    // Repeat every 5 seconds until dismissed
    idleAlarmIntervalRef.current = setInterval(() => {
      vibrate()
      playBeep()
    }, 5000)
    
    return () => {
      if (idleAlarmIntervalRef.current) {
        clearInterval(idleAlarmIntervalRef.current)
        idleAlarmIntervalRef.current = null
      }
    }
  }, [idleAlarmFiring])

  // Dismiss alarm — snooze for another cycle or disable
  const dismissIdleAlarm = useCallback((snooze?: boolean) => {
    setIdleAlarmFiring(false)
    if (idleAlarmIntervalRef.current) {
      clearInterval(idleAlarmIntervalRef.current)
      idleAlarmIntervalRef.current = null
    }
    if (navigator.vibrate) navigator.vibrate(0) // stop vibration
    if (snooze) {
      // Reset the timer — alarm will fire again after another idleAlarmMinutes
      idleMinimizedAtRef.current = Date.now()
      setIdleAlarmDismissed(false)
    } else {
      setIdleAlarmDismissed(true)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // QUICK SMS — send SMS directly from video panel
  // ═══════════════════════════════════════════════════════════════
  // NOTE: handleLogSMSCommunication is defined later in the file (line ~1143).
  // We use a ref to avoid block-scoped "used before declaration" TS error.
  const handleLogSMSCommunicationRef = useRef<((entry: any) => Promise<void>) | null>(null)
  const handleLogCallCommunicationRef = useRef<((entry: any) => Promise<void>) | null>(null)
  const handleLogEmailCommunicationRef = useRef<((entry: any) => Promise<void>) | null>(null)
  
  const handleQuickSMS = useCallback(async () => {
    if (!quickSMSMessage.trim() || !appointment?.patients?.phone) return
    setSendingQuickSMS(true)
    try {
      communication.handleSmsToChange(appointment.patients.phone)
      communication.handleSmsMessageChange(quickSMSMessage)
      await new Promise(resolve => setTimeout(resolve, 0))
      await communication.handleSendSMS()
      if (handleLogSMSCommunicationRef.current) {
        await handleLogSMSCommunicationRef.current({
          type: 'sms', direction: 'outbound',
          to_number: appointment.patients.phone,
          content: quickSMSMessage,
          status: 'sent',
          patient_id: appointment?.patient_id,
          created_at: new Date().toISOString()
        })
      }
      setQuickSMSMessage('')
      setShowQuickSMS(false)
    } catch (err: any) {
      console.error('Quick SMS error:', err)
      setError(err.message || 'Failed to send SMS')
    } finally {
      setSendingQuickSMS(false)
    }
  }, [quickSMSMessage, appointment, communication, setError])

  // ═══════════════════════════════════════════════════════════════
  // DIALPAD — call patient directly (Twilio fallback from video)
  // ═══════════════════════════════════════════════════════════════
  const handleDialpadCall = useCallback(async (phoneNumber?: string) => {
    const numberToCall = phoneNumber || dialpadNumber || appointment?.patients?.phone
    if (!numberToCall) {
      setError('No phone number available')
      return
    }
    try {
      communication.handleCallPhoneNumberChange(numberToCall)
      await communication.handleMakeCall()
      if (handleLogCallCommunicationRef.current) {
        await handleLogCallCommunicationRef.current({
          type: 'call', direction: 'outbound',
          to_number: numberToCall,
          status: 'initiated',
          patient_id: appointment?.patient_id,
          initiated_at: new Date().toISOString()
        })
      }
      setShowDialpad(false)
    } catch (err: any) {
      console.error('Dialpad call error:', err)
      setError(err.message || 'Failed to initiate call')
    }
  }, [dialpadNumber, appointment, communication, setError])

  const handleDialpadDigit = useCallback((digit: string) => {
    setDialpadNumber(prev => prev + digit)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // RESEND APPOINTMENT LINK — copy or SMS the Daily.co link
  // ═══════════════════════════════════════════════════════════════
  const getMeetingLink = useCallback(() => {
    const apt = appointment as any
    return apt?.dailyco_meeting_url || apt?.meeting_url || apt?.video_link || null
  }, [appointment])

  const handleCopyMeetingLink = useCallback(() => {
    const link = getMeetingLink()
    if (link) {
      navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }, [getMeetingLink])

  const handleResendLinkSMS = useCallback(async () => {
    const link = getMeetingLink()
    const phone = appointment?.patients?.phone
    if (!link || !phone) {
      setError('Missing meeting link or patient phone number')
      return
    }
    setResendingLink(true)
    try {
      const patientName = `${appointment?.patients?.first_name || ''}`.trim() || 'Patient'
      const message = `Hi ${patientName}, here is your appointment video link: ${link}`
      communication.handleSmsToChange(phone)
      communication.handleSmsMessageChange(message)
      await new Promise(resolve => setTimeout(resolve, 0))
      await communication.handleSendSMS()
      if (handleLogSMSCommunicationRef.current) {
        await handleLogSMSCommunicationRef.current({
          type: 'sms', direction: 'outbound',
          to_number: phone,
          content: message,
          status: 'sent',
          patient_id: appointment?.patient_id,
          created_at: new Date().toISOString()
        })
      }
      setShowResendLink(false)
    } catch (err: any) {
      console.error('Resend link error:', err)
      setError(err.message || 'Failed to resend link')
    } finally {
      setResendingLink(false)
    }
  }, [appointment, communication, getMeetingLink, setError])

  // ═══════════════════════════════════════════════════════════════
  // PANEL RESIZE/MOVE/LOCK — drag to resize edges, drag to move
  // ═══════════════════════════════════════════════════════════════
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    if (panelLocked || panelMode !== 'floating') return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    const rect = panelRef.current?.getBoundingClientRect()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: rect?.width || window.innerWidth * 0.85,
      startH: rect?.height || window.innerHeight,
      edge
    }
  }, [panelLocked, panelMode])

  const handleDragPanelStart = useCallback((e: React.MouseEvent) => {
    if (panelLocked || panelMode !== 'floating') return
    e.preventDefault()
    setIsDraggingPanel(true)
    const rect = panelRef.current?.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanelX: rect?.left || 0,
      startPanelY: rect?.top || 0
    }
  }, [panelLocked, panelMode])

  // Mouse move/up handlers for resize and drag
  useEffect(() => {
    if (!isResizing && !isDraggingPanel) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX
        const dy = e.clientY - resizeRef.current.startY
        const { edge, startW, startH } = resizeRef.current
        
        const minW = 500
        const minH = 400
        
        if (edge.includes('right')) {
          setPanelWidth(Math.max(minW, startW + dx))
        }
        if (edge.includes('left')) {
          const newW = Math.max(minW, startW - dx)
          setPanelWidth(newW)
          if (panelX !== null) setPanelX(prev => (prev || 0) + (startW - newW))
        }
        if (edge.includes('bottom')) {
          setPanelHeight(Math.max(minH, startH + dy))
        }
        if (edge.includes('top')) {
          const newH = Math.max(minH, startH - dy)
          setPanelHeight(newH)
          if (panelY !== null) setPanelY(prev => (prev || 0) + (startH - newH))
        }
      }
      
      if (isDraggingPanel && dragRef.current) {
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        setPanelX(Math.max(0, dragRef.current.startPanelX + dx))
        setPanelY(Math.max(0, dragRef.current.startPanelY + dy))
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setIsDraggingPanel(false)
      resizeRef.current = null
      dragRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, isDraggingPanel, panelX, panelY])

  // Save panel size/position to localStorage
  const handleLockPanel = useCallback(() => {
    setPanelLocked(true)
    if (panelMode === 'floating') {
      try {
        const panelState = { panelWidth, panelHeight, panelX, panelY, panelMode }
        localStorage.setItem('medazon_panel_layout', JSON.stringify(panelState))
      } catch (e) { /* localStorage may not be available */ }
    }
  }, [panelWidth, panelHeight, panelX, panelY, panelMode])

  const handleUnlockPanel = useCallback(() => {
    setPanelLocked(false)
  }, [])

  // Restore saved panel layout on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medazon_panel_layout')
      if (saved) {
        const state = JSON.parse(saved)
        if (state.panelMode === 'floating') {
          setPanelMode('floating')
          if (state.panelWidth) setPanelWidth(state.panelWidth)
          if (state.panelHeight) setPanelHeight(state.panelHeight)
          if (state.panelX !== null) setPanelX(state.panelX)
          if (state.panelY !== null) setPanelY(state.panelY)
          setPanelLocked(true) // Restore as locked
        }
      }
    } catch (e) { /* localStorage may not be available */ }
  }, [])

  const handleTogglePanelMode = useCallback(() => {
    if (panelMode === 'full') {
      setPanelMode('floating')
      setPanelWidth(Math.round(window.innerWidth * 0.75))
      setPanelHeight(Math.round(window.innerHeight * 0.8))
      setPanelX(Math.round(window.innerWidth * 0.12))
      setPanelY(Math.round(window.innerHeight * 0.05))
      setPanelLocked(false)
    } else {
      setPanelMode('full')
      setPanelWidth(null)
      setPanelHeight(null)
      setPanelX(null)
      setPanelY(null)
      setPanelLocked(false)
      try { localStorage.removeItem('medazon_panel_layout') } catch (e) {}
    }
  }, [panelMode])

  // ═══════════════════════════════════════════════════════════════
  // TOOLBAR PANEL TOGGLE — opens EHR panel in right column OR overlay
  // ═══════════════════════════════════════════════════════════════
  const handleToolbarPanelClick = useCallback((panelId: string) => {
    switch (panelId) {
      case 'medication-history':
        setShowMedicationHistoryPanel(true)
        break
      case 'orders':
        setShowOrdersPanel(true)
        break
      case 'prescription-history':
        setShowPrescriptionHistoryPanel(true)
        break
      case 'appointments':
        setShowAppointmentsOverlay(true)
        break
      case 'allergies':
        setShowAllergiesPanel(true)
        break
      case 'vitals':
        setShowVitalsPanel(true)
        break
      case 'medications':
        setShowMedicationsPanel(true)
        break
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // ALL EXISTING useEffect HOOKS — UNCHANGED
  // ═══════════════════════════════════════════════════════════════

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

  const handleLogSMSCommunication = useCallback(async (entry: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: doctor } = await supabase.from('doctors').select('id').eq('email', user.email).single()
      if (!doctor) return
      const { error } = await supabase.from('communication_history').insert([{
        type: 'sms', direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
        to_number: entry.to_number || entry.to, from_number: entry.from_number || null,
        message: entry.content || entry.message, status: entry.status || 'sent',
        doctor_id: doctor.id, patient_id: entry.patient_id || appointment?.patient_id,
        created_at: entry.created_at || new Date().toISOString()
      }])
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging SMS:', error)
      }
    } catch (error) { console.error('Error logging SMS:', error) }
  }, [appointment?.patient_id])
  
  // Populate ref so early callbacks (handleQuickSMS, handleResendLinkSMS) can use it
  handleLogSMSCommunicationRef.current = handleLogSMSCommunication

  const handleLogCallCommunication = useCallback(async (entry: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: doctor } = await supabase.from('doctors').select('id').eq('email', user.email).single()
      if (!doctor) return
      const { error } = await supabase.from('communication_history').insert([{
        type: 'call', direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
        to_number: entry.to_number || entry.to, from_number: entry.from_number || null,
        message: entry.message || null, status: entry.status || 'initiated',
        duration: entry.duration || null, twilio_sid: entry.twilio_sid || null,
        recording_url: entry.recording_url || null, doctor_id: doctor.id,
        patient_id: entry.patient_id || appointment?.patient_id,
        created_at: entry.initiated_at || entry.created_at || new Date().toISOString()
      }])
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging call:', error)
      }
    } catch (error) { console.error('Error logging call:', error) }
  }, [appointment?.patient_id])

  const handleLogEmailCommunication = useCallback(async (entry: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: doctor } = await supabase.from('doctors').select('id').eq('email', user.email).single()
      if (!doctor) return
      const emailContent = entry.subject ? `Subject: ${entry.subject}\n\n${entry.body || ''}` : entry.body || ''
      const { error } = await supabase.from('communication_history').insert([{
        type: 'email', direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
        to_number: entry.to_email || null, from_number: entry.from_email || null,
        message: emailContent, status: entry.status || 'sent', doctor_id: doctor.id,
        patient_id: entry.patient_id || appointment?.patient_id,
        created_at: entry.created_at || new Date().toISOString()
      }])
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error logging email:', error)
      }
    } catch (error) { console.error('Error logging email:', error) }
  }, [appointment?.patient_id])

  // Populate refs so early callbacks (handleDialpadCall) can use them
  handleLogCallCommunicationRef.current = handleLogCallCommunication
  handleLogEmailCommunicationRef.current = handleLogEmailCommunication

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
            <DailyMeetingEmbed
              key={sectionId}
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
                  try {
                    await communication.handleSendSMS()
                    await handleLogSMSCommunication({ type: 'sms', direction: 'outbound', to_number: to, content: message, status: 'sent', patient_id: appointment?.patient_id, created_at: new Date().toISOString() })
                  } catch (err: any) {
                    console.error('Error sending SMS:', err)
                    await handleLogSMSCommunication({ type: 'sms', direction: 'outbound', to_number: to, content: message, status: 'failed', patient_id: appointment?.patient_id, created_at: new Date().toISOString() })
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
                  await handleLogCallCommunication({ type: 'call', direction: 'outbound', to_number: phoneNumber, status: 'initiated', patient_id: appointment?.patient_id, initiated_at: new Date().toISOString() })
                }}
                onEndCall={async () => {
                  await communication.handleEndCall()
                  await handleLogCallCommunication({ type: 'call', direction: 'outbound', to_number: communication.callPhoneNumber, status: 'completed', duration: communication.callDuration, patient_id: appointment?.patient_id, completed_at: new Date().toISOString() })
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
            <LabResultsSection key={sectionId} labResults={labResults.labResults} isLoadingLabs={labResults.isLoadingLabs} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps} onLoadLabResults={labResults.loadLabResults} />
          )

        case 'referrals-followup':
          return (
            <ReferralsFollowUpSection key={sectionId} referrals={referralsFollowUp.referrals} showReferralForm={referralsFollowUp.showReferralForm} setShowReferralForm={referralsFollowUp.setShowReferralForm} newReferral={referralsFollowUp.newReferral} setNewReferral={referralsFollowUp.setNewReferral} showFollowUpScheduler={referralsFollowUp.showFollowUpScheduler} setShowFollowUpScheduler={referralsFollowUp.setShowFollowUpScheduler} followUpData={referralsFollowUp.followUpData} setFollowUpData={referralsFollowUp.setFollowUpData} isSchedulingFollowUp={referralsFollowUp.isSchedulingFollowUp} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps}
              onCreateReferral={async () => { try { await referralsFollowUp.handleCreateReferral() } catch (err: any) { setError(err.message) } }}
              onScheduleFollowUp={async () => { try { await referralsFollowUp.handleScheduleFollowUp(); onStatusChange() } catch (err: any) { setError(err.message) } }}
              error={error}
            />
          )

        case 'prior-auth':
          return (
            <PriorAuthSection key={sectionId} priorAuths={priorAuth.priorAuths} showPriorAuthForm={priorAuth.showPriorAuthForm} setShowPriorAuthForm={priorAuth.setShowPriorAuthForm} newPriorAuth={priorAuth.newPriorAuth} setNewPriorAuth={priorAuth.setNewPriorAuth} isSubmitting={priorAuth.isSubmitting} isCustomizeMode={layout.isCustomizeMode} sectionProps={sectionProps}
              onSubmitPriorAuth={async () => { try { await priorAuth.handleSubmitPriorAuth() } catch (err: any) { setError(err.message) } }}
              error={error}
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
    [layout, appointment, currentUser, problemsMedications, renderDoctorNotes, problemsMedicationsHandlers, surgeriesDetails, prescriptions, communication, error, setError, labResults, referralsFollowUp, priorAuth, handleSendEmail, handleLogEmailCommunication, handleLogSMSCommunication, handleLogCallCommunication, onStatusChange]
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

  // ═══════════════════════════════════════════════════════════════════════
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  UPGRADED RENDER — NEW "CALL MODE" LAYOUT                          ║
  // ║  Video pinned left, Patient card below, SOAP/Panels right          ║
  // ║  Grouped toolbar, action dropdown, always-visible video            ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* Backdrop */}
      {!isMinimized && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300" onClick={onClose} />
      )}
      
      {isMinimized ? (
        /* ═══ MINIMIZED STATE — Compact bar, shows call-active indicator ═══ */
        isMobile ? (
          /* ── Mobile minimized: slim bottom bar with call pulse + restore ── */
          <div className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'linear-gradient(90deg, #0a1628, #0f172a, #0a1628)', borderTop: idleAlarmFiring ? '2px solid #ef4444' : '1px solid rgba(0, 230, 255, 0.2)', boxShadow: '0 -4px 24px rgba(0,0,0,0.5)' }}>
            {/* ═══ IDLE ALARM BANNER (mobile) ═══ */}
            {idleAlarmFiring && (
              <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.25), rgba(239,68,68,0.15))', borderBottom: '1px solid rgba(239,68,68,0.3)', animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">🔔</span>
                  <div>
                    <span className="text-[11px] font-bold text-red-300 block">Patient waiting!</span>
                    <span className="text-[9px] text-red-400/70">Minimized {idleAlarmMinutes}+ min during call</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { dismissIdleAlarm(false); setIsMinimized(false) }}
                    className="px-2.5 py-1.5 rounded text-[10px] font-bold text-white" style={{ background: '#0e7490' }}>
                    Return
                  </button>
                  <button onClick={() => dismissIdleAlarm(true)}
                    className="px-2 py-1.5 rounded text-[10px] font-bold text-slate-300" style={{ background: '#334155' }}>
                    +{idleAlarmMinutes}m
                  </button>
                  <button onClick={() => dismissIdleAlarm(false)}
                    className="px-2 py-1.5 rounded text-[10px] text-slate-400" style={{ background: '#1e293b' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {callActive && (
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(22, 163, 74, 0.15)', border: '1px solid rgba(22, 163, 74, 0.3)' }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-green-400">{formatCallTime(callTime)}</span>
                  </span>
                )}
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-white truncate block">
                    {appointment?.patients?.first_name} {appointment?.patients?.last_name}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate block">
                    {callActive ? 'Video call in progress' : 'Appointment'}
                    {appointment?.requested_date_time && ` • ${(() => {
                      const d = convertToTimezone(appointment.requested_date_time, 'America/Phoenix')
                      return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
                    })()}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Idle alarm settings gear */}
                {callActive && (
                  <button onClick={() => setShowIdleAlarmSettings(!showIdleAlarmSettings)}
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white"
                    style={{ background: idleAlarmEnabled ? 'rgba(22, 163, 74, 0.15)' : '#1e293b', border: idleAlarmEnabled ? '1px solid rgba(22,163,74,0.3)' : '1px solid transparent' }}
                    title="Idle alarm settings">
                    {idleAlarmEnabled ? '🔔' : '🔕'}
                  </button>
                )}
                <button onClick={() => setIsMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                  style={{ background: callActive ? '#0e7490' : '#334155', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Maximize2 className="h-3.5 w-3.5" />{callActive ? 'Return to Call' : 'Open'}
                </button>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white" style={{ background: '#1e293b' }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Idle alarm settings dropdown (mobile) */}
            {showIdleAlarmSettings && (
              <div className="px-3 py-2" style={{ background: '#0f172a', borderTop: '1px solid #1e293b' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">Idle Alarm</span>
                    <button onClick={() => setIdleAlarmEnabled(!idleAlarmEnabled)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: idleAlarmEnabled ? 'rgba(22,163,74,0.2)' : '#1e293b', color: idleAlarmEnabled ? '#4ade80' : '#64748b', border: `1px solid ${idleAlarmEnabled ? 'rgba(22,163,74,0.3)' : '#334155'}` }}>
                      {idleAlarmEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500">Alert after</span>
                    {[1, 2, 3, 5, 10].map(m => (
                      <button key={m} onClick={() => setIdleAlarmMinutes(m)}
                        className="w-7 h-6 rounded text-[10px] font-bold"
                        style={{ background: idleAlarmMinutes === m ? '#0e7490' : '#1e293b', color: idleAlarmMinutes === m ? '#fff' : '#64748b', border: `1px solid ${idleAlarmMinutes === m ? '#06b6d4' : '#334155'}` }}>
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Desktop minimized: full bottom bar with EHR shortcuts ── */
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-2xl" style={{ borderTop: idleAlarmFiring ? '2px solid #ef4444' : '1px solid rgba(6,182,212,0.3)' }}>
            {/* ═══ IDLE ALARM BANNER (desktop) ═══ */}
            {idleAlarmFiring && (
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.1), rgba(239,68,68,0.2), rgba(239,68,68,0.1))', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔔</span>
                  <div>
                    <span className="text-sm font-bold text-red-300">Patient is still waiting!</span>
                    <span className="text-xs text-red-400/70 ml-2">You've been away from the call for {idleAlarmMinutes}+ minutes</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { dismissIdleAlarm(false); setIsMinimized(false) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#0e7490' }}>
                    <Maximize2 className="h-3.5 w-3.5" />Return to Call
                  </button>
                  <button onClick={() => dismissIdleAlarm(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300" style={{ background: '#334155' }}>
                    Snooze +{idleAlarmMinutes}m
                  </button>
                  <button onClick={() => dismissIdleAlarm(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400" style={{ background: '#1e293b' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {callActive && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(22, 163, 74, 0.15)', border: '1px solid rgba(22, 163, 74, 0.3)' }}>
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-bold text-green-400">{formatCallTime(callTime)}</span>
                      <span className="text-[10px] text-slate-400">Call Active</span>
                    </span>
                  )}
                  <h2 className="text-white font-bold text-sm">
                    <span className="text-cyan-400">APPOINTMENT</span>
                    {appointment?.requested_date_time && (
                      <> • {(() => {
                        const doctorTimezone = 'America/Phoenix'
                        const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                        return appointmentDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      })()}</>
                    )}
                    {appointment?.status && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${appointment.status === 'pending' ? 'bg-yellow-600' : appointment.status === 'accepted' ? 'bg-green-600' : appointment.status === 'completed' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                        {appointment.status.toUpperCase()}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {EHR_PANELS.map(panel => (
                    <button key={panel.id} onClick={() => { setIsMinimized(false); handleToolbarPanelClick(panel.id) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg transition-colors text-xs font-medium ${panel.hoverBg}`}
                      style={{ backgroundColor: panel.color + '99' }}>
                      <panel.icon className="h-3.5 w-3.5" />{panel.label}
                    </button>
                  ))}
                  {appointment && appointment.status === 'pending' && (
                    <>
                      <button onClick={() => handleAppointmentAction('accept')} disabled={actionLoading === 'accept'} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50"><CheckCircle className="h-3.5 w-3.5" />Accept</button>
                      <button onClick={() => handleAppointmentAction('reject')} disabled={actionLoading === 'reject'} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Reject</button>
                    </>
                  )}
                  <button onClick={() => setIsMinimized(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs"><ArrowRight className="h-3.5 w-3.5" />Move</button>
                  <button onClick={() => setIsMinimized(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs"><RotateCcw className="h-3.5 w-3.5" />Reschedule</button>
                  <button onClick={() => setIsMinimized(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs"><XCircle className="h-3.5 w-3.5" />Cancel Appt</button>
                  <button onClick={() => { setIsMinimized(false); layout.setIsCustomizeMode(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs"><Edit className="h-3.5 w-3.5" />Customize</button>
                  {/* Idle alarm toggle (desktop) */}
                  {callActive && (
                    <div className="relative">
                      <button onClick={() => setShowIdleAlarmSettings(!showIdleAlarmSettings)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: idleAlarmEnabled ? 'rgba(22,163,74,0.15)' : '#1e293b', border: `1px solid ${idleAlarmEnabled ? 'rgba(22,163,74,0.3)' : '#334155'}`, color: idleAlarmEnabled ? '#4ade80' : '#64748b' }}>
                        {idleAlarmEnabled ? '🔔' : '🔕'} Idle Alarm {idleAlarmEnabled ? `${idleAlarmMinutes}m` : 'Off'}
                      </button>
                      {showIdleAlarmSettings && (
                        <div className="absolute bottom-full left-0 mb-2 p-3 rounded-xl shadow-2xl z-50" style={{ background: '#0f172a', border: '1px solid #1e293b', width: '240px' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white">Idle Alarm</span>
                            <button onClick={() => setIdleAlarmEnabled(!idleAlarmEnabled)}
                              className="px-2.5 py-0.5 rounded text-[10px] font-bold"
                              style={{ background: idleAlarmEnabled ? 'rgba(22,163,74,0.2)' : '#1e293b', color: idleAlarmEnabled ? '#4ade80' : '#64748b', border: `1px solid ${idleAlarmEnabled ? 'rgba(22,163,74,0.3)' : '#334155'}` }}>
                              {idleAlarmEnabled ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 mb-2">Alert me if minimized during a call for:</div>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 5, 10].map(m => (
                              <button key={m} onClick={() => setIdleAlarmMinutes(m)}
                                className="flex-1 py-1.5 rounded text-xs font-bold"
                                style={{ background: idleAlarmMinutes === m ? '#0e7490' : '#1e293b', color: idleAlarmMinutes === m ? '#fff' : '#64748b', border: `1px solid ${idleAlarmMinutes === m ? '#06b6d4' : '#334155'}` }}>
                                {m}m
                              </button>
                            ))}
                          </div>
                          <div className="text-[9px] text-slate-600 mt-2">Sound + vibration will repeat every 5s until dismissed</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsMinimized(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-xs font-medium" title="Restore panel"><Maximize2 className="h-4 w-4" /></button>
                  <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs"><X className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : isMobile ? (
        /* ═══════════════════════════════════════════════════════════════
           MOBILE LAYOUT — Full-screen, tab-based, swipeable panels
           Video stays on top, doctor swipes between panels below
           ═══════════════════════════════════════════════════════════════ */
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a1018' }}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          
          {/* ── Mobile Header — compact, no wasted space ── */}
          <div className="flex-shrink-0" style={{ background: 'linear-gradient(90deg, #0a1628, #0f172a, #0a1628)', borderBottom: '1px solid #1e293b' }}>
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-extrabold tracking-wider" style={{ background: 'linear-gradient(90deg, #00e6ff, #00cba9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MEDAZON</span>
                <span className="text-[9px] text-slate-500 truncate">
                  {appointment?.requested_date_time && (() => {
                    const d = convertToTimezone(appointment.requested_date_time, 'America/Phoenix')
                    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  })()}
                </span>
                {appointment?.status && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${appointment.status === 'pending' ? 'bg-yellow-600' : appointment.status === 'accepted' ? 'bg-green-600' : appointment.status === 'completed' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                    {appointment.status.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {callActive && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: '#16653430', border: '1px solid #16653480', color: '#00e6ff' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {formatCallTime(callTime)}
                  </span>
                )}
                <button onClick={() => setIsMinimized(true)} className="w-7 h-7 flex items-center justify-center rounded text-white" style={{ background: '#1e293b' }}>—</button>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-white" style={{ background: '#1e293b' }}><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            
            {/* ── Mobile EHR toolbar — horizontally scrollable ── */}
            <div className="flex items-center gap-1 px-3 py-1 overflow-x-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', scrollbarWidth: 'none' }}>
              {EHR_PANELS.map(panel => {
                const Icon = panel.icon
                return (
                  <button key={panel.id} onClick={() => handleToolbarPanelClick(panel.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border"
                    style={{ borderColor: '#1e293b', color: '#94a3b8', background: 'transparent', flexShrink: 0 }}>
                    <Icon className="h-3 w-3" />{panel.label}
                  </button>
                )
              })}
              <button onClick={() => { setShowRescheduleForm(!showRescheduleForm); setShowCancelConfirm(false) }}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold whitespace-nowrap text-white"
                style={{ background: '#ea580c', flexShrink: 0 }}>
                <RotateCcw className="h-3 w-3" />Reschedule
              </button>
              <button onClick={() => { setShowCancelConfirm(!showCancelConfirm); setShowRescheduleForm(false) }}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold whitespace-nowrap text-white"
                style={{ background: '#dc2626', flexShrink: 0 }}>
                <XCircle className="h-3 w-3" />Cancel
              </button>
            </div>
            
            {/* Reschedule / Cancel forms (mobile) */}
            {showRescheduleForm && (
              <div className="px-3 py-2" style={{ background: 'rgba(249, 115, 22, 0.08)', borderTop: '1px solid rgba(249, 115, 22, 0.2)' }}>
                <div className="flex items-center gap-2">
                  <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} className="flex-1 px-2 py-1 bg-slate-800 border border-white/20 rounded text-white text-[11px]" />
                  <button onClick={handleReschedule} disabled={!newDateTime || rescheduleLoading} className="px-2 py-1 bg-orange-600 text-white rounded text-[10px] font-bold disabled:opacity-50">
                    {rescheduleLoading ? '...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
            {showCancelConfirm && (
              <div className="px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.08)', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-red-300 text-[10px]">Cancel this appointment?</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowCancelConfirm(false)} className="px-2 py-1 bg-gray-600 text-white rounded text-[10px]">No</button>
                    <button onClick={handleCancelAppointment} disabled={cancelling} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold disabled:opacity-50">
                      {cancelling ? '...' : 'Yes, Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* ── Mobile Video Area — compact, always visible at top ── */}
          <div className="flex-shrink-0 relative" style={{ height: mobileTab === 'video' ? '45vh' : '0px', minHeight: mobileTab === 'video' ? '200px' : '0px', background: '#000', transition: 'height 0.3s ease, min-height 0.3s ease', overflow: 'hidden' }}>
            {renderSection('meeting-info', 'left')}
            
            {/* Doctor self-view */}
            {!drSelfViewHidden && (
              <div className="absolute top-2 right-2 z-20 cursor-pointer overflow-hidden flex items-center justify-center"
                style={{ width: drSelfViewExpanded ? 120 : 40, height: drSelfViewExpanded ? 75 : 40, borderRadius: 8, border: '2px solid rgba(0, 203, 169, 0.4)', background: 'linear-gradient(135deg, #1e293b, #0f172a)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}
                onClick={() => setDrSelfViewExpanded(!drSelfViewExpanded)}>
                {drSelfViewExpanded ? (
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-[10px] text-slate-400 font-semibold">{(appointment as any)?.providers?.full_name || (appointment as any)?.providers?.first_name ? `Dr. ${(appointment as any).providers.last_name || (appointment as any).providers.first_name}` : 'Dr.'}</div>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}>
                    {((appointment as any)?.providers?.first_name?.[0] || 'D')}{((appointment as any)?.providers?.last_name?.[0] || 'H')}
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setDrSelfViewHidden(!drSelfViewHidden)}
              className="absolute z-20 px-1.5 py-0.5 rounded text-[8px] font-bold hover:text-white"
              style={{ top: drSelfViewHidden ? 8 : (drSelfViewExpanded ? 82 : 48), right: 8, background: 'rgba(15,23,42,0.8)', border: '1px solid #334155', color: '#94a3b8' }}>
              {drSelfViewHidden ? 'Show' : 'Hide'} self
            </button>
            
            {/* AI Scribe */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded"
              style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', border: '1px solid #1e293b' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-red-400 font-bold">AI Scribe</span>
            </div>
            
            {/* Dialpad / Quick SMS / Resend Link — mobile compact */}
            <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center gap-1.5 pointer-events-none">
              <div className="flex items-center gap-1 pointer-events-auto">
                <button onClick={() => { setShowDialpad(!showDialpad); setShowQuickSMS(false); setShowResendLink(false) }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', backdropFilter: 'blur(8px)' }}>
                  <Phone className="h-3 w-3" />Call
                </button>
                <button onClick={() => { setShowQuickSMS(!showQuickSMS); setShowDialpad(false); setShowResendLink(false) }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', backdropFilter: 'blur(8px)' }}>
                  <MessageSquare className="h-3 w-3" />SMS
                </button>
                <button onClick={() => { setShowResendLink(!showResendLink); setShowDialpad(false); setShowQuickSMS(false) }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', backdropFilter: 'blur(8px)' }}>
                  <Link2 className="h-3 w-3" />Link
                </button>
              </div>
            </div>
          </div>
          
          {/* ── Mini video bar when not on video tab ── */}
          {mobileTab !== 'video' && (
            <button onClick={() => setMobileTab('video')}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5"
              style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-cyan-400 font-bold">Video Call Active</span>
              {callActive && <span className="text-[10px] text-slate-500">{formatCallTime(callTime)}</span>}
              <span className="text-[10px] text-slate-600 ml-auto">Tap to return</span>
            </button>
          )}
          
          {/* ── Mobile Tab Bar — bottom-anchored pill selector ── */}
          <div className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1" style={{ background: '#0a1018', borderBottom: '1px solid #1e293b' }}>
            {([
              { id: 'video' as const, label: 'Call', icon: '📹' },
              { id: 'soap' as const, label: 'SOAP', icon: '📋' },
              { id: 'chart' as const, label: 'Chart', icon: '📊' },
              { id: 'comms' as const, label: 'Comms', icon: '💬' },
            ]).map(tab => (
              <button key={tab.id} onClick={() => setMobileTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold transition-all"
                style={{
                  background: mobileTab === tab.id ? '#1e293b' : 'transparent',
                  color: mobileTab === tab.id ? '#00e6ff' : '#64748b',
                  borderBottom: mobileTab === tab.id ? '2px solid #00e6ff' : '2px solid transparent'
                }}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
          
          {/* ── Mobile Panel Content — fills remaining space, no blank areas ── */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#0a1018' }}>
            
            {/* VIDEO TAB: Patient card + quick info */}
            {mobileTab === 'video' && appointment && (
              <div className="p-3 space-y-3">
                {renderSection('patient-header', 'left')}
              </div>
            )}
            
            {/* SOAP TAB: Doctor notes, SOAP forms, CDSS */}
            {mobileTab === 'soap' && appointment && (
              <div className="p-3 space-y-3">
                {layout.leftPanelSections.filter(id => id !== 'patient-header' && id !== 'meeting-info').map(id => renderSection(id, 'left'))}
                {layout.rightPanelSections.filter(id => id === 'doctor-notes' || id === 'erx-composer').map(id => renderSection(id, 'right'))}
              </div>
            )}
            
            {/* CHART TAB: Problems, medications, labs, vitals, referrals */}
            {mobileTab === 'chart' && appointment && (
              <div className="p-3 space-y-3">
                {layout.rightPanelSections.filter(id => id !== 'doctor-notes' && id !== 'erx-composer' && id !== 'sms-section' && id !== 'call-section' && id !== 'email-section' && id !== 'communication-history').map(id => renderSection(id, 'right'))}
              </div>
            )}
            
            {/* COMMS TAB: SMS, Call, Email, Communication History */}
            {mobileTab === 'comms' && appointment && (
              <div className="p-3 space-y-3">
                {layout.rightPanelSections.filter(id => id === 'sms-section' || id === 'call-section' || id === 'email-section' || id === 'communication-history').map(id => renderSection(id, 'right'))}
              </div>
            )}
            
            {/* Loading / Error states */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
              </div>
            )}
            {error && !appointment && (
              <div className="p-4"><div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">{error}</div></div>
            )}
          </div>
          
          {/* ── Mobile bottom status bar ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1" style={{ borderTop: '1px solid #1e293b', background: '#0a1018' }}>
            <span className="text-[9px] text-green-400 flex items-center gap-1">
              <CheckCircle className="h-2.5 w-2.5" />{soapSaveStatus === 'saving' ? 'Saving...' : soapSaveStatus === 'saved' ? 'Auto-saved' : 'Ready'}
            </span>
            <span className="text-[9px] text-slate-600">Swipe ← → to switch tabs</span>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           DESKTOP LAYOUT — EXPANDED "CALL MODE" (unchanged)
           ═══════════════════════════════════════════════════════════════ */
        <div className="fixed top-0 right-0 h-full w-full z-50 flex"
          ref={panelRef}
          style={panelMode === 'floating' ? {
            top: panelY !== null ? `${panelY}px` : '2%',
            left: panelX !== null ? `${panelX}px` : '8%',
            right: 'auto',
            width: panelWidth ? `${panelWidth}px` : '84%',
            height: panelHeight ? `${panelHeight}px` : '96%',
            borderRadius: '12px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            transition: (isResizing || isDraggingPanel) ? 'none' : 'border-radius 0.3s ease',
            overflow: 'hidden'
          } : {}}>
          
          {/* Resize handles (floating mode only) */}
          {panelMode === 'floating' && !panelLocked && (
            <>
              <div className="absolute top-0 left-0 w-full h-1.5 cursor-n-resize z-50 hover:bg-cyan-500/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'top')} />
              <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-s-resize z-50 hover:bg-cyan-500/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'bottom')} />
              <div className="absolute top-0 left-0 h-full w-1.5 cursor-w-resize z-50 hover:bg-cyan-500/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'left')} />
              <div className="absolute top-0 right-0 h-full w-1.5 cursor-e-resize z-50 hover:bg-cyan-500/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'right')} />
              {/* Corner handles */}
              <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'top-left')} />
              <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'top-right')} />
              <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')} />
              <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')} />
            </>
          )}
          {/* Left Calendar Sidebar — UNCHANGED */}
          <div style={{ width: '12%', minWidth: '140px', maxWidth: '200px', height: '100%', borderRight: '1px solid #1b2b4d', background: 'linear-gradient(180deg, #0d1424, #0b1222)', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>
            {renderCurrentDaySlots()}
          </div>
          
          {/* ═══ MAIN PANEL (replaces old right panel) ═══ */}
          <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/20 shadow-2xl flex flex-col overflow-hidden">
            
            {/* ═══ HEADER — Compact with grouped toolbar ═══ */}
            <div className="sticky top-0 z-10 flex-shrink-0" style={{ background: 'linear-gradient(90deg, #0a1628 0%, #0f172a 50%, #0a1628 100%)', borderBottom: '1px solid #1e293b' }}>
              {/* Row 1: Branding + Appointment info + Window controls */}
              <div className="flex items-center justify-between px-4 py-1.5"
                style={{ cursor: panelMode === 'floating' && !panelLocked ? 'grab' : 'default' }}
                onMouseDown={(e) => {
                  // Only drag if clicking on the header itself (not buttons)
                  if ((e.target as HTMLElement).closest('button')) return
                  handleDragPanelStart(e)
                }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold tracking-tight">
                    <span className="text-cyan-400">MEDAZON</span>
                    <span className="text-white/30 mx-1">+</span>
                    <span className="text-white">HEALTH</span>
                  </span>
                  {panelMode === 'floating' && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                      style={{ background: panelLocked ? '#16653430' : '#1e293b', border: `1px solid ${panelLocked ? '#16653460' : '#334155'}`, color: panelLocked ? '#00cba9' : '#64748b' }}>
                      {panelLocked ? '🔒 Locked' : '↕ Floating'}
                    </span>
                  )}
                  <span className="w-px h-4 bg-white/10" />
                  <span className="text-xs text-cyan-400 font-bold">APPOINTMENT</span>
                  {appointment?.requested_date_time && (
                    <span className="text-xs text-slate-400">
                      • {(() => {
                        const doctorTimezone = 'America/Phoenix'
                        const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                        return appointmentDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      })()}
                    </span>
                  )}
                  {appointment?.status && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      appointment.status === 'pending' ? 'bg-yellow-600/80' :
                      appointment.status === 'accepted' ? 'bg-green-600/80' :
                      appointment.status === 'completed' ? 'bg-blue-600/80' : 'bg-gray-600/80'
                    } text-white`}>
                      {appointment.status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Panel mode: floating / full */}
                  <button onClick={handleTogglePanelMode}
                    className="w-6 h-6 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600 text-white rounded text-xs"
                    title={panelMode === 'full' ? 'Float panel (resize/move)' : 'Full screen'}>
                    {panelMode === 'full' ? <GripVertical className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  {/* Lock / Unlock */}
                  {panelMode === 'floating' && (
                    <button onClick={panelLocked ? handleUnlockPanel : handleLockPanel}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs transition-all"
                      style={{
                        background: panelLocked ? '#16653440' : '#1e293b80',
                        border: `1px solid ${panelLocked ? '#16653480' : '#334155'}`,
                        color: panelLocked ? '#00cba9' : '#94a3b8'
                      }}
                      title={panelLocked ? 'Unlock panel (saved)' : 'Lock panel size & position'}>
                      {panelLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                  )}
                  <span className="w-px h-4 bg-white/10" />
                  <button onClick={() => setIsMinimized(true)} className="w-6 h-6 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600 text-white rounded text-xs" title="Minimize">—</button>
                  <button onClick={() => setIsMinimized(false)} className="w-6 h-6 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600 text-white rounded text-xs" title="Restore">□</button>
                  <button onClick={onClose} className="w-6 h-6 flex items-center justify-center bg-slate-700/80 hover:bg-red-600 text-white rounded" title="Close"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              
              {/* Row 2: EHR Panel Toolbar + Action Buttons */}
              <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {/* EHR Panel buttons — compact icon + short label */}
                {!layout.isCustomizeMode && appointment && EHR_PANELS.map(panel => {
                  const Icon = panel.icon
                  return (
                    <button key={panel.id} onClick={() => handleToolbarPanelClick(panel.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all duration-150 border"
                      style={{ borderColor: '#1e293b', color: '#94a3b8', background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = panel.color + '80'; e.currentTarget.style.color = panel.color }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#94a3b8' }}
                    >
                      <Icon className="h-3.5 w-3.5" />{panel.label}
                    </button>
                  )
                })}
                
                <span className="flex-1" />
                
                {/* Action buttons — separated by divider */}
                {!layout.isCustomizeMode && appointment && (
                  <div className="flex items-center gap-1 pl-2 ml-1" style={{ borderLeft: '1px solid #1e293b' }}>
                    {appointment.status === 'pending' && (
                      <>
                        <button onClick={() => handleAppointmentAction('accept')} disabled={actionLoading === 'accept'}
                          className="px-2 py-1 rounded text-[10px] font-bold text-green-400 disabled:opacity-50 transition-all"
                          style={{ background: '#16653450' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#16653490'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#16653450'}>
                          {actionLoading === 'accept' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Accept'}
                        </button>
                        <button onClick={() => handleAppointmentAction('reject')} disabled={actionLoading === 'reject'}
                          className="px-2 py-1 rounded text-[10px] font-bold text-red-400 disabled:opacity-50 transition-all"
                          style={{ background: '#991b1b50' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#991b1b90'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#991b1b50'}>
                          {actionLoading === 'reject' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Reject'}
                        </button>
                      </>
                    )}
                    {appointment.status === 'accepted' && (
                      <button onClick={() => handleAppointmentAction('complete')} disabled={actionLoading === 'complete'}
                        className="px-2 py-1 rounded text-[10px] font-bold text-blue-400 disabled:opacity-50 transition-all"
                        style={{ background: '#1e3a5f50' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#1e3a5f90'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e3a5f50'}>
                        {actionLoading === 'complete' ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Complete'}
                      </button>
                    )}
                    
                    {/* More actions dropdown */}
                    <div className="relative">
                      <button onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-slate-400 transition-all"
                        style={{ background: showActionsDropdown ? '#1e293b' : 'transparent', border: '1px solid #1e293b' }}>
                        <MoreHorizontal className="h-3.5 w-3.5" />More
                      </button>
                      {showActionsDropdown && (
                        <div className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-2xl py-1 min-w-[160px]" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                          <button onClick={() => { setShowMoveForm(!showMoveForm); setShowRescheduleForm(false); setShowCancelConfirm(false); setShowActionsDropdown(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-cyan-400 hover:bg-slate-800 transition-colors">
                            <ArrowRight className="h-3.5 w-3.5" />{showMoveForm ? 'Cancel Move' : 'Move'}
                          </button>
                          <button onClick={() => { setShowRescheduleForm(!showRescheduleForm); setShowMoveForm(false); setShowCancelConfirm(false); setShowActionsDropdown(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-orange-400 hover:bg-slate-800 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" />{showRescheduleForm ? 'Cancel' : 'Reschedule'}
                          </button>
                          <button onClick={() => { setShowCancelConfirm(!showCancelConfirm); setShowMoveForm(false); setShowRescheduleForm(false); setShowActionsDropdown(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-slate-800 transition-colors">
                            <XCircle className="h-3.5 w-3.5" />Cancel Appt
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Always-visible CTA: Reschedule + Cancel Appt (matching prototype) */}
                {!layout.isCustomizeMode && appointment && (
                  <div className="flex items-center gap-1 pl-2 ml-1" style={{ borderLeft: '1px solid #1e293b' }}>
                    <button onClick={() => { setShowRescheduleForm(!showRescheduleForm); setShowMoveForm(false); setShowCancelConfirm(false); setShowActionsDropdown(false) }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white transition-all"
                      style={{ background: '#ea580c' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#c2410c'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ea580c'}>
                      <RotateCcw className="h-3 w-3" />Reschedule
                    </button>
                    <button onClick={() => { setShowCancelConfirm(!showCancelConfirm); setShowMoveForm(false); setShowRescheduleForm(false); setShowActionsDropdown(false) }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white transition-all"
                      style={{ background: '#dc2626' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}>
                      <XCircle className="h-3 w-3" />Cancel Appt
                    </button>
                  </div>
                )}
                
                {/* Customize mode buttons */}
                {layout.isCustomizeMode ? (
                  <>
                    <button onClick={layout.saveLayout} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs"><Save className="h-3.5 w-3.5" />Save Layout</button>
                    <button onClick={() => layout.setIsCustomizeMode(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs"><X className="h-3.5 w-3.5" />Cancel</button>
                  </>
                ) : (
                  <button onClick={() => layout.setIsCustomizeMode(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-purple-400 transition-all border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10">
                    <Edit className="h-3.5 w-3.5" />Customize
                  </button>
                )}
              </div>
              
              {/* Action Forms (Move/Reschedule/Cancel) — slide down */}
              {showMoveForm && (
                <div className="px-4 py-2" style={{ background: 'rgba(6, 182, 212, 0.08)', borderTop: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <div className="flex items-center justify-between">
                    <div className="text-cyan-300 text-xs"><Clock className="h-3.5 w-3.5 inline mr-2" />Select a new time slot from the calendar on the left{selectedMoveTime && <span className="ml-2 font-bold">Selected: {selectedMoveTime}</span>}</div>
                    <button onClick={handleMoveAppointment} disabled={!selectedMoveTime || moveLoading} className="px-3 py-1 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2">
                      {moveLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Confirm Move'}
                    </button>
                  </div>
                </div>
              )}
              {showRescheduleForm && (
                <div className="px-4 py-2" style={{ background: 'rgba(249, 115, 22, 0.08)', borderTop: '1px solid rgba(249, 115, 22, 0.2)' }}>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-3.5 w-3.5 text-orange-300" />
                    <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} className="flex-1 px-3 py-1 bg-slate-800 border border-white/20 rounded-lg text-white text-xs" />
                    <button onClick={handleReschedule} disabled={!newDateTime || rescheduleLoading} className="px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2">
                      {rescheduleLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Confirm Reschedule'}
                    </button>
                  </div>
                </div>
              )}
              {showCancelConfirm && (
                <div className="px-4 py-2" style={{ background: 'rgba(239, 68, 68, 0.08)', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div className="flex items-center justify-between">
                    <div className="text-red-300 text-xs">Are you sure you want to cancel this appointment? This action cannot be undone.</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-xs">No, Keep It</button>
                      <button onClick={handleCancelAppointment} disabled={cancelling} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs flex items-center gap-2">
                        {cancelling ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : 'Yes, Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ CONTENT: Two-column "Call Mode" layout ═══ */}
            <div className="flex-1 flex overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center w-full py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
                </div>
              ) : error && !appointment ? (
                <div className="w-full p-4">
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">{error}</div>
                </div>
              ) : appointment ? (
                <>
                  {/* ═══ LEFT COLUMN: Video (sticky) + Patient Card ═══ */}
                  <div className="flex flex-col overflow-hidden" style={{ width: '45%', minWidth: '380px', borderRight: '1px solid #1e293b', transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    {/* Video Area — fills available space, never scrolls away */}
                    <div className="flex-1 min-h-0 relative" style={{ background: '#000' }}>
                      {renderSection('meeting-info', 'left')}
                      
                      {/* ═══ VIDEO OVERLAY ACTION BAR ═══ */}
                      {/* Floating buttons: Call Patient, Quick SMS, Resend Link */}
                      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between pointer-events-none">
                        {/* Left: Quick actions */}
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          {/* Call Patient (dialpad / direct call) */}
                          <div className="relative">
                            <button onClick={() => { setShowDialpad(!showDialpad); setShowQuickSMS(false); setShowResendLink(false) }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                              style={{
                                background: communication.isCalling ? '#dc2626' : showDialpad ? '#0f172a' : 'rgba(15, 23, 42, 0.85)',
                                border: `1px solid ${communication.isCalling ? '#ef4444' : showDialpad ? '#00e6ff' : 'rgba(255,255,255,0.15)'}`,
                                color: communication.isCalling ? '#fca5a5' : '#e2e8f0',
                                backdropFilter: 'blur(8px)'
                              }}
                              title={communication.isCalling ? 'Call in progress' : 'Call patient directly'}>
                              {communication.isCalling ? <><PhoneOff className="h-3.5 w-3.5" />In Call</> : <><Phone className="h-3.5 w-3.5" />Call</>}
                            </button>
                            {/* Dialpad dropdown */}
                            {showDialpad && !communication.isCalling && (
                              <div className="absolute bottom-full left-0 mb-2 z-30 rounded-xl shadow-2xl p-3 w-[220px]"
                                style={{ background: '#0f172a', border: '1px solid #1e293b', backdropFilter: 'blur(12px)' }}>
                                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Call Patient</div>
                                {/* Quick call button — one tap to patient's number */}
                                {appointment?.patients?.phone && (
                                  <button onClick={() => handleDialpadCall(appointment.patients?.phone || '')}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-green-400 mb-2 transition-all"
                                    style={{ background: '#16653440', border: '1px solid #16653480' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#16653470'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#16653440'}>
                                    <PhoneCall className="h-3.5 w-3.5" />
                                    Call {appointment.patients.phone}
                                  </button>
                                )}
                                {/* Dial custom number */}
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="tel"
                                    value={dialpadNumber}
                                    onChange={(e) => setDialpadNumber(e.target.value)}
                                    placeholder="Enter number..."
                                    className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white"
                                    style={{ background: '#1e293b', border: '1px solid #334155', outline: 'none' }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleDialpadCall() }}
                                  />
                                  <button onClick={() => handleDialpadCall()}
                                    disabled={!dialpadNumber.trim()}
                                    className="p-1.5 rounded-lg text-green-400 disabled:opacity-30 transition-all"
                                    style={{ background: '#16653440', border: '1px solid #16653480' }}>
                                    <Phone className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {/* Dialpad grid */}
                                <div className="grid grid-cols-3 gap-1 mt-2">
                                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                                    <button key={d} onClick={() => handleDialpadDigit(d)}
                                      className="py-1.5 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                                      style={{ background: '#1e293b' }}>
                                      {d}
                                    </button>
                                  ))}
                                </div>
                                {dialpadNumber && (
                                  <button onClick={() => setDialpadNumber('')}
                                    className="w-full mt-1.5 py-1 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 transition-all"
                                    style={{ background: '#1e293b40' }}>
                                    Clear
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Active call controls */}
                            {communication.isCalling && (
                              <div className="absolute bottom-full left-0 mb-2 z-30 rounded-xl shadow-2xl p-3 w-[200px]"
                                style={{ background: '#0f172a', border: '1px solid #dc2626', backdropFilter: 'blur(12px)' }}>
                                <div className="text-[10px] font-bold text-red-400 mb-2 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                  Call in progress — {communication.formatDuration(communication.callDuration)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={communication.handleToggleMute}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: communication.isMuted ? '#f59e0b30' : '#1e293b', color: communication.isMuted ? '#f59e0b' : '#94a3b8', border: `1px solid ${communication.isMuted ? '#f59e0b50' : '#334155'}` }}>
                                    {communication.isMuted ? 'Unmute' : 'Mute'}
                                  </button>
                                  <button onClick={async () => {
                                    await communication.handleEndCall()
                                    await handleLogCallCommunication({ type: 'call', direction: 'outbound', to_number: communication.callPhoneNumber, status: 'completed', duration: communication.callDuration, patient_id: appointment?.patient_id, completed_at: new Date().toISOString() })
                                  }}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-bold text-red-400 transition-all"
                                    style={{ background: '#dc262640', border: '1px solid #dc262680' }}>
                                    End Call
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick SMS */}
                          <div className="relative">
                            <button onClick={() => { setShowQuickSMS(!showQuickSMS); setShowDialpad(false); setShowResendLink(false) }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                              style={{
                                background: showQuickSMS ? '#0f172a' : 'rgba(15, 23, 42, 0.85)',
                                border: `1px solid ${showQuickSMS ? '#00cba9' : 'rgba(255,255,255,0.15)'}`,
                                color: '#e2e8f0',
                                backdropFilter: 'blur(8px)'
                              }}
                              title="Send SMS to patient">
                              <MessageSquare className="h-3.5 w-3.5" />SMS
                            </button>
                            {/* Quick SMS panel */}
                            {showQuickSMS && (
                              <div className="absolute bottom-full left-0 mb-2 z-30 rounded-xl shadow-2xl p-3 w-[280px]"
                                style={{ background: '#0f172a', border: '1px solid #1e293b', backdropFilter: 'blur(12px)' }}>
                                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                                  <span>Quick SMS to {appointment?.patients?.first_name || 'Patient'}</span>
                                  <span className="text-slate-600 font-normal">{appointment?.patients?.phone}</span>
                                </div>
                                <textarea
                                  value={quickSMSMessage}
                                  onChange={(e) => setQuickSMSMessage(e.target.value)}
                                  placeholder="Type message..."
                                  rows={3}
                                  className="w-full px-3 py-2 rounded-lg text-xs text-white resize-none"
                                  style={{ background: '#1e293b', border: '1px solid #334155', outline: 'none' }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickSMS() } }}
                                />
                                <div className="flex items-center justify-between mt-2">
                                  {/* Quick templates */}
                                  <div className="flex gap-1">
                                    {['Running late', 'Please join video', 'Connection issue'].map(tpl => (
                                      <button key={tpl} onClick={() => setQuickSMSMessage(tpl)}
                                        className="px-1.5 py-0.5 rounded text-[9px] text-slate-500 hover:text-slate-300 transition-all"
                                        style={{ background: '#1e293b40', border: '1px solid #334155' }}>
                                        {tpl}
                                      </button>
                                    ))}
                                  </div>
                                  <button onClick={handleQuickSMS}
                                    disabled={!quickSMSMessage.trim() || sendingQuickSMS}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-green-400 disabled:opacity-30 transition-all"
                                    style={{ background: '#16653440', border: '1px solid #16653480' }}>
                                    {sendingQuickSMS ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-400" /> : <><Send className="h-3 w-3" />Send</>}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Resend Link */}
                          <div className="relative">
                            <button onClick={() => { setShowResendLink(!showResendLink); setShowDialpad(false); setShowQuickSMS(false) }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                              style={{
                                background: showResendLink ? '#0f172a' : 'rgba(15, 23, 42, 0.85)',
                                border: `1px solid ${showResendLink ? '#818cf8' : 'rgba(255,255,255,0.15)'}`,
                                color: '#e2e8f0',
                                backdropFilter: 'blur(8px)'
                              }}
                              title="View/resend appointment link">
                              <Link2 className="h-3.5 w-3.5" />Link
                            </button>
                            {/* Resend link panel */}
                            {showResendLink && (
                              <div className="absolute bottom-full left-0 mb-2 z-30 rounded-xl shadow-2xl p-3 w-[300px]"
                                style={{ background: '#0f172a', border: '1px solid #1e293b', backdropFilter: 'blur(12px)' }}>
                                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Appointment Link</div>
                                {getMeetingLink() ? (
                                  <>
                                    <div className="flex items-center gap-1.5 p-2 rounded-lg mb-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                                      <span className="flex-1 text-[10px] text-cyan-300 truncate font-mono">{getMeetingLink()}</span>
                                      <button onClick={handleCopyMeetingLink}
                                        className="p-1 rounded transition-all"
                                        style={{ color: linkCopied ? '#00cba9' : '#94a3b8' }}>
                                        {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                      </button>
                                      <a href={getMeetingLink()!} target="_blank" rel="noopener noreferrer"
                                        className="p-1 rounded text-slate-400 hover:text-white transition-all">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                    <button onClick={handleResendLinkSMS}
                                      disabled={resendingLink || !appointment?.patients?.phone}
                                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold text-indigo-300 disabled:opacity-30 transition-all"
                                      style={{ background: '#4338ca30', border: '1px solid #4338ca60' }}>
                                      {resendingLink ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-300" />
                                        : <><Send className="h-3 w-3" />SMS Link to {appointment?.patients?.phone || 'Patient'}</>}
                                    </button>
                                  </>
                                ) : (
                                  <div className="text-[11px] text-slate-500 text-center py-3">No meeting link available for this appointment</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Call timer (when active) */}
                        {callActive && (
                          <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                            style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(0, 230, 255, 0.3)', backdropFilter: 'blur(8px)', color: '#00e6ff' }}>
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            {formatCallTime(callTime)}
                          </div>
                        )}
                      </div>
                    
                      {/* ═══ DOCTOR SELF-VIEW — Pure UI overlay, does NOT interfere with Daily.co ═══ */}
                      {!drSelfViewHidden && (
                        <div
                          className="absolute top-3 right-3 z-20 cursor-pointer overflow-hidden flex items-center justify-center"
                          style={{
                            width: drSelfViewExpanded ? 160 : 48,
                            height: drSelfViewExpanded ? 100 : 48,
                            borderRadius: 10,
                            border: '2px solid rgba(0, 203, 169, 0.4)',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onClick={() => setDrSelfViewExpanded(!drSelfViewExpanded)}
                          title={drSelfViewExpanded ? 'Minimize self-view' : 'Expand self-view'}>
                          {drSelfViewExpanded ? (
                            <div style={{ textAlign: 'center' }}>
                              <div className="text-[11px] text-slate-400 font-semibold">
                                {(appointment as any)?.providers?.full_name || (appointment as any)?.providers?.first_name ? `Dr. ${(appointment as any).providers.last_name || (appointment as any).providers.first_name}` : 'Dr.'}
                              </div>
                              <div className="text-[8px] text-slate-600 mt-0.5">Click to minimize</div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white"
                              style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}>
                              {((appointment as any)?.providers?.first_name?.[0] || 'D')}{((appointment as any)?.providers?.last_name?.[0] || 'H')}
                            </div>
                          )}
                          <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded flex items-center justify-center" style={{ background: 'rgba(15, 23, 42, 0.8)' }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              {drSelfViewExpanded
                                ? <><path d="M4 14h6v6"/><path d="M20 10h-6V4"/></>
                                : <><path d="M15 3h6v6"/><path d="M9 21H3v-6"/></>
                              }
                            </svg>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setDrSelfViewHidden(!drSelfViewHidden)}
                        className="absolute z-20 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all hover:text-white"
                        style={{
                          top: drSelfViewHidden ? 12 : (drSelfViewExpanded ? 120 : 68),
                          right: 12,
                          background: 'rgba(15, 23, 42, 0.8)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid #334155',
                          color: '#94a3b8'
                        }}>
                        {drSelfViewHidden ? 'Show self' : 'Hide self'}
                      </button>

                      {/* AI Scribe indicator — pure UI, no SDK dependency */}
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid #1e293b' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[11px] text-red-400 font-bold">AI Scribe Recording</span>
                      </div>

                      {/* NOTE: Camera/Mic/EndCall controls are handled by DailyMeetingEmbed's built-in UI.
                           No duplicate SVG controls here — they would NOT connect to Daily.co SDK and would confuse the doctor. */}
                    </div>
                    
                    {/* Patient Card — below video, collapsible */}
                    <div style={{ borderTop: '1px solid #1e293b', background: 'linear-gradient(180deg, #0d1424, #0a1018)', flexShrink: 0, maxHeight: patientCardCollapsed ? '40px' : '45%', transition: 'max-height 0.3s ease', overflow: 'hidden' }}>
                      {/* Collapse toggle */}
                      <button onClick={() => setPatientCardCollapsed(!patientCardCollapsed)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        style={{ background: 'rgba(10, 16, 24, 0.5)' }}>
                        <span className="flex items-center gap-2">
                          <span className="text-cyan-400">{appointment?.patients?.first_name} {appointment?.patients?.last_name}</span>
                          <span className="text-slate-500">• {(appointment as any)?.patients?.date_of_birth ? `DOB: ${(appointment as any).patients.date_of_birth}` : `${appointment?.patients?.phone || ''}`}</span>
                          {/* Allergy alert badge */}
                          {(problemsMedications as any).allergies && ((problemsMedications as any).allergies as any[]).length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 border border-red-500/50 text-red-300 animate-pulse">
                              ⚠ ALLERGIES
                            </span>
                          )}
                        </span>
                        {patientCardCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </button>
                      {/* Patient details — uses existing PatientHeader section */}
                      {!patientCardCollapsed && (
                        <div className="overflow-auto px-2 pb-2" style={{ maxHeight: 'calc(100% - 36px)' }}>
                          {renderSection('patient-header', 'left')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ═══ RIGHT COLUMN: SOAP Notes + all other sections (scrollable) ═══ */}
                  <div className="flex-1 flex flex-col overflow-hidden" style={{ transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    {/* SOAP Tab bar */}
                    <div className="flex gap-0 flex-shrink-0" style={{ borderBottom: '1px solid #1e293b', background: 'rgba(10, 18, 32, 0.5)' }}>
                      {['Subjective', 'Objective', 'Assessment', 'Plan'].map((tab, i) => (
                        <button key={tab}
                          className="flex-1 py-2 text-xs font-bold transition-all"
                          style={{
                            color: i === 0 ? '#00cba9' : '#64748b',
                            borderBottom: i === 0 ? '2px solid #00cba9' : '2px solid transparent',
                            background: i === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent'
                          }}>
                          {tab.charAt(0)}<span className="text-[10px] font-normal ml-0.5">{tab.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    
                    {/* Scrollable content area — all sections */}
                    <div ref={layout.scrollContainerRef} className="flex-1 overflow-y-auto p-4"
                      style={{ scrollBehavior: 'auto', scrollPaddingTop: '0' }}
                      onFocus={(e) => {
                        if (preventAutoScrollRef.current && layout.scrollContainerRef.current) {
                          e.stopPropagation()
                          setTimeout(() => { if (layout.scrollContainerRef.current) layout.scrollContainerRef.current.scrollTop = 0 }, 0)
                        }
                      }}>
                      {/* Doctor Notes (SOAP) — primary content */}
                      <div className="space-y-4">
                        {/* Filter out patient-header and meeting-info since they're in left column now */}
                        {layout.leftPanelSections.filter(id => id !== 'patient-header' && id !== 'meeting-info').map((sectionId) => renderSection(sectionId, 'left'))}
                        {layout.rightPanelSections.map((sectionId) => renderSection(sectionId, 'right'))}
                      </div>
                    </div>
                    
                    {/* Bottom bar — auto-save status */}
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5" style={{ borderTop: '1px solid #1e293b', background: 'rgba(10, 16, 24, 0.5)' }}>
                      <span className="text-[11px] text-green-400 flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3" />{soapSaveStatus === 'saving' ? 'Saving...' : soapSaveStatus === 'saved' ? 'Auto-saved' : 'Ready'}
                      </span>
                      {error && <span className="text-[11px] text-red-400 truncate max-w-xs">{error}</span>}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         ALL EXISTING OVERLAY PANELS — UNCHANGED
         ═══════════════════════════════════════════════════════════════ */}

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

      {/* Close actions dropdown on outside click */}
      {showActionsDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowActionsDropdown(false)} />
      )}
    </>
  )
}

























































































































































































































































































































































































































































































































































































