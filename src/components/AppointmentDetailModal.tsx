'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Edit, Save, Calendar, Clock, CheckCircle, XCircle, ArrowRight, RotateCcw, Pill, FileText, ClipboardList, CalendarDays, AlertTriangle, AlertCircle, Activity, Mic, Phone, ExternalLink, Lock, Unlock, Stethoscope, User, FlaskConical, Syringe, FolderOpen, Users, Wine, Scissors, Building2, ClipboardCheck, DollarSign, MessageSquare, Video, Loader2, Download, Eye } from 'lucide-react'
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

// Phase 1B EHR Overlay Panels
import DemographicsPanel from './DemographicsPanel'
import ProblemsPanel from './ProblemsPanel'
import ClinicalNotesPanel from './ClinicalNotesPanel'
import LabResultsPanel from './LabResultsPanel'
import ImmunizationsPanel from './ImmunizationsPanel'
import DocumentsPanel from './DocumentsPanel'
import { FamilyHistoryPanel, SocialHistoryPanel, SurgicalHistoryPanel } from './HistoryPanels'
import PharmacyPanel from './PharmacyPanel'
import CarePlansPanel from './CarePlansPanel'
import BillingPanel from './BillingPanel'
import UnifiedCommHub from './UnifiedCommHub'

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
  doctorId?: string
  doctorName?: string
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
  { id: 'demographics', label: 'Demo', icon: User, color: '#64748b', hoverBg: 'hover:bg-slate-700' },
  { id: 'problems', label: 'Problems', icon: AlertCircle, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'clinical-notes', label: 'Notes', icon: FileText, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'lab-results-panel', label: 'Labs', icon: FlaskConical, color: '#06b6d4', hoverBg: 'hover:bg-cyan-700' },
  { id: 'immunizations', label: 'Immun', icon: Syringe, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'documents', label: 'Docs', icon: FolderOpen, color: '#f59e0b', hoverBg: 'hover:bg-amber-700' },
  { id: 'family-history', label: 'Fam Hx', icon: Users, color: '#f43f5e', hoverBg: 'hover:bg-rose-700' },
  { id: 'social-history', label: 'Social', icon: Wine, color: '#f59e0b', hoverBg: 'hover:bg-amber-700' },
  { id: 'surgical-history', label: 'Surg Hx', icon: Scissors, color: '#ef4444', hoverBg: 'hover:bg-red-700' },
  { id: 'pharmacy', label: 'Pharmacy', icon: Building2, color: '#14b8a6', hoverBg: 'hover:bg-teal-700' },
  { id: 'care-plans', label: 'Care Plan', icon: ClipboardCheck, color: '#a855f7', hoverBg: 'hover:bg-purple-700' },
  { id: 'billing', label: 'Billing', icon: DollarSign, color: '#10b981', hoverBg: 'hover:bg-emerald-700' },
  { id: 'comm-hub', label: 'Comms', icon: MessageSquare, color: '#3b82f6', hoverBg: 'hover:bg-blue-700' },
  { id: 'lab-results-inline', label: 'Lab Orders', icon: FlaskConical, color: '#0ea5e9', hoverBg: 'hover:bg-sky-700' },
  { id: 'referrals-followup', label: 'Referrals', icon: ArrowRight, color: '#f97316', hoverBg: 'hover:bg-orange-700' },
  { id: 'prior-auth', label: 'Prior Auth', icon: ClipboardCheck, color: '#8b5cf6', hoverBg: 'hover:bg-violet-700' },
  { id: 'drchrono-erx', label: 'eRx', icon: Stethoscope, color: '#22c55e', hoverBg: 'hover:bg-green-700' },
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

  // Sync chart_locked and chart status from appointment data
  // Note: chart_locked exists on appointments table but hook type may not include it
  const appointmentChartLocked = (appointment as any)?.chart_locked
  const appointmentChartStatus = (appointment as any)?.chart_status
  const appointmentSignedAt = (appointment as any)?.chart_signed_at
  const appointmentSignedBy = (appointment as any)?.chart_signed_by
  const appointmentClosedAt = (appointment as any)?.chart_closed_at
  const appointmentClosedBy = (appointment as any)?.chart_closed_by
  const appointmentPdfUrl = (appointment as any)?.clinical_note_pdf_url
  useEffect(() => {
    if (appointmentChartLocked !== undefined) {
      setChartLocked(!!appointmentChartLocked)
    }
    if (appointmentChartStatus) {
      // Handle migration: 'addendum' → 'amended'
      const status = appointmentChartStatus === 'addendum' ? 'amended' : appointmentChartStatus
      setChartStatus(status as 'draft' | 'signed' | 'closed' | 'amended')
    } else if (appointmentChartLocked) {
      setChartStatus('signed')
    } else {
      setChartStatus('draft')
    }
    if (appointmentSignedAt) setChartSignedAt(appointmentSignedAt)
    if (appointmentSignedBy) setChartSignedBy(appointmentSignedBy)
    if (appointmentClosedAt) setChartClosedAt(appointmentClosedAt)
    if (appointmentClosedBy) setChartClosedBy(appointmentClosedBy)
    if (appointmentPdfUrl) setClinicalNotePdfUrl(appointmentPdfUrl)
  }, [appointmentChartLocked, appointmentChartStatus, appointmentSignedAt, appointmentSignedBy, appointmentClosedAt, appointmentClosedBy, appointmentPdfUrl])

  // Fetch addendums when appointment loads
  useEffect(() => {
    if (!appointmentId) return
    const fetchAddendums = async () => {
      try {
        const { data, error } = await supabase
          .from('chart_addendums')
          .select('id, text, addendum_type, reason, created_at, created_by, created_by_name, created_by_role')
          .eq('appointment_id', appointmentId)
          .order('created_at', { ascending: true })
        if (!error && data) setAddendums(data)
      } catch { /* table may not exist yet */ }
    }
    fetchAddendums()
  }, [appointmentId])

  const problemsMedications = useProblemsMedications(
    appointmentId,
    appointment?.patient_id || null
  )

  const prescriptions = usePrescriptions(appointmentId, problemsMedications.medicationHistory)

  const handleMedicationsAutoAdded = useCallback((medications: any[]) => {
    if (medications && medications.length > 0) {
      prescriptions.setRxList((prev: any[]) => {
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
    documentUpload.appointmentDocuments?.map((doc: any) => doc.id).join(',') || '',
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
  const [showDemographicsPanel, setShowDemographicsPanel] = useState(false)
  const [showProblemsPanel, setShowProblemsPanel] = useState(false)
  const [showClinicalNotesPanel, setShowClinicalNotesPanel] = useState(false)
  const [showLabResultsPanel, setShowLabResultsPanel] = useState(false)
  const [showImmunizationsPanel, setShowImmunizationsPanel] = useState(false)
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(false)
  const [showFamilyHistoryPanel, setShowFamilyHistoryPanel] = useState(false)
  const [showSocialHistoryPanel, setShowSocialHistoryPanel] = useState(false)
  const [showSurgicalHistoryPanel, setShowSurgicalHistoryPanel] = useState(false)
  const [showPharmacyPanel, setShowPharmacyPanel] = useState(false)
  const [showCarePlansPanel, setShowCarePlansPanel] = useState(false)
  const [showBillingPanel, setShowBillingPanel] = useState(false)
  const [showCommHub, setShowCommHub] = useState(false)
  const [showLabResultsInline, setShowLabResultsInline] = useState(false)
  const [showReferralsPanel, setShowReferralsPanel] = useState(false)
  const [showPriorAuthPanel, setShowPriorAuthPanel] = useState(false)
  const [showVideoPanel, setShowVideoPanel] = useState(false)

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
      case 'demographics': setShowDemographicsPanel(v => !v); break
      case 'problems': setShowProblemsPanel(v => !v); break
      case 'clinical-notes': setShowClinicalNotesPanel(v => !v); break
      case 'lab-results-panel': setShowLabResultsPanel(v => !v); break
      case 'immunizations': setShowImmunizationsPanel(v => !v); break
      case 'documents': setShowDocumentsPanel(v => !v); break
      case 'family-history': setShowFamilyHistoryPanel(v => !v); break
      case 'social-history': setShowSocialHistoryPanel(v => !v); break
      case 'surgical-history': setShowSurgicalHistoryPanel(v => !v); break
      case 'pharmacy': setShowPharmacyPanel(v => !v); break
      case 'care-plans': setShowCarePlansPanel(v => !v); break
      case 'billing': setShowBillingPanel(v => !v); break
      case 'comm-hub': setShowCommHub(v => !v); break
      case 'lab-results-inline': setShowLabResultsInline(v => !v); break
      case 'referrals-followup': setShowReferralsPanel(v => !v); break
      case 'prior-auth': setShowPriorAuthPanel(v => !v); break
      case 'drchrono-erx': {
        // Open DrChrono eRx as a side-by-side popup — positioned to the LEFT of the dashboard
        // so the doctor can see both at once without switching windows
        const patientChartId = (appointment as any)?.patients?.chart_id || (appointment as any)?.chart_id || ''
        const drchronoPatientId = (appointment as any)?.drchrono_patient_id || ''
        const erxUrl = patientChartId
          ? `https://app.drchrono.com/clinical/#/patient/${patientChartId}/erx`
          : drchronoPatientId
          ? `https://app.drchrono.com/clinical/#/patient/${drchronoPatientId}/erx`
          : `https://app.drchrono.com/clinical/`

        // Calculate positioning: left half of screen for eRx, right half for dashboard
        const screenW = window.screen.availWidth || 1920
        const screenH = window.screen.availHeight || 1080
        const popupW = Math.floor(screenW / 2)
        const popupH = screenH
        const popupLeft = 0  // eRx on the left side
        const popupTop = 0

        // Also resize the current browser window to the right half
        try {
          window.resizeTo(popupW, screenH)
          window.moveTo(popupW, 0)
        } catch { /* some browsers block resizing — that's OK */ }

        window.open(
          erxUrl,
          'DrChrono_eRx',
          `width=${popupW},height=${popupH},left=${popupLeft},top=${popupTop},scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=yes,status=no`
        )
        break
      }
    }
  }, [])

  // ═══ Whole-panel resize + persist ═══
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [panelLocked, setPanelLocked] = useState(true)
  const [chartLocked, setChartLocked] = useState(false)
  const [chartStatus, setChartStatus] = useState<'draft' | 'signed' | 'closed' | 'amended'>('draft')
  const [chartSignedAt, setChartSignedAt] = useState<string | null>(null)
  const [chartSignedBy, setChartSignedBy] = useState<string | null>(null)
  const [chartClosedAt, setChartClosedAt] = useState<string | null>(null)
  const [chartClosedBy, setChartClosedBy] = useState<string | null>(null)
  const [clinicalNotePdfUrl, setClinicalNotePdfUrl] = useState<string | null>(null)
  const [addendumText, setAddendumText] = useState('')
  const [addendumType, setAddendumType] = useState<'addendum' | 'late_entry' | 'correction'>('addendum')
  const [addendumReason, setAddendumReason] = useState('')
  const [addendums, setAddendums] = useState<Array<{ id: string; text: string; addendum_type?: string; reason?: string; created_at: string; created_by: string; created_by_name?: string; created_by_role?: string }>>([])
  const [showAddendumForm, setShowAddendumForm] = useState(false)
  const [savingAddendum, setSavingAddendum] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [auditEntries, setAuditEntries] = useState<Array<{ id: string; action: string; performed_by_name: string; performed_by_role: string; reason?: string; details?: any; created_at: string }>>([])
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [chartActionLoading, setChartActionLoading] = useState<string | null>(null)
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
      
      fetchAppointmentDetails().then((result: any) => {
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
      }).catch((err: unknown) => {
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
        .update({ chart_locked: newLocked, is_locked: newLocked })
        .eq('id', appointmentId)
      if (error) throw error
      setChartLocked(newLocked)
      setAppointment((prev: any) => prev ? { ...prev, chart_locked: newLocked, is_locked: newLocked } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error toggling chart lock:', err)
      setError(err.message || 'Failed to toggle chart lock')
    }
  }, [appointmentId, chartLocked, onStatusChange, setAppointment, setError])

  // ─── Sign & Lock Chart (via API) ─────────────────────────────
  const handleSignAndLockChart = useCallback(async () => {
    if (!appointmentId || !currentUser) return
    const doctorName = currentUser.full_name || currentUser.email || 'Provider'
    setChartActionLoading('sign')
    try {
      const res = await fetch('/api/chart/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, providerName: doctorName, providerRole: 'provider' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sign chart')

      setChartLocked(true)
      setChartStatus('signed')
      setChartSignedAt(data.signed_at)
      setChartSignedBy(data.signed_by)
      setAppointment((prev: any) => prev ? { ...prev, chart_locked: true, is_locked: true, chart_status: 'signed', chart_signed_at: data.signed_at, chart_signed_by: data.signed_by } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error signing chart:', err)
      setError(err.message || 'Failed to sign chart')
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId, currentUser, onStatusChange, setAppointment, setError])

  // ─── Close Chart (via API — generates PDF) ──────────────────
  const handleCloseChart = useCallback(async () => {
    if (!appointmentId || !currentUser) return
    const doctorName = currentUser.full_name || currentUser.email || 'Provider'
    setChartActionLoading('close')
    try {
      const res = await fetch('/api/chart/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, providerName: doctorName, providerRole: 'provider' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close chart')

      setChartStatus('closed')
      setChartClosedAt(data.closed_at)
      setChartClosedBy(data.closed_by)
      setClinicalNotePdfUrl(data.pdf_url)
      setAppointment((prev: any) => prev ? { ...prev, chart_status: 'closed', chart_closed_at: data.closed_at, chart_closed_by: data.closed_by, clinical_note_pdf_url: data.pdf_url } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error closing chart:', err)
      setError(err.message || 'Failed to close chart')
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId, currentUser, onStatusChange, setAppointment, setError])

  // ─── Unlock Chart (via API — requires reason) ──────────────
  const handleUnlockChart = useCallback(async () => {
    if (!appointmentId || !currentUser || !unlockReason.trim()) return
    const doctorName = currentUser.full_name || currentUser.email || 'Provider'
    setChartActionLoading('unlock')
    try {
      const res = await fetch('/api/chart/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, providerName: doctorName, providerRole: 'provider', reason: unlockReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to unlock chart')

      setChartLocked(false)
      setChartStatus('draft')
      setChartSignedAt(null)
      setChartSignedBy(null)
      setUnlockReason('')
      setShowUnlockDialog(false)
      setAppointment((prev: any) => prev ? { ...prev, chart_locked: false, is_locked: false, chart_status: 'draft', chart_signed_at: null, chart_signed_by: null } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error unlocking chart:', err)
      setError(err.message || 'Failed to unlock chart')
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId, currentUser, unlockReason, onStatusChange, setAppointment, setError])

  // ─── Save Addendum (via API — regenerates PDF) ─────────────
  const handleSaveAddendum = useCallback(async () => {
    if (!appointmentId || !currentUser || !addendumText.trim()) return
    const authorName = currentUser.full_name || currentUser.email || 'Provider'
    setSavingAddendum(true)
    try {
      const res = await fetch('/api/chart/addendum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          text: addendumText.trim(),
          addendumType,
          reason: addendumType === 'correction' ? addendumReason.trim() : undefined,
          authorName,
          authorRole: 'provider',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save addendum')

      if (data.addendum) setAddendums(prev => [...prev, { ...data.addendum, created_by: authorName }])
      setChartStatus('amended')
      if (data.pdf_url) setClinicalNotePdfUrl(data.pdf_url)
      setAddendumText('')
      setAddendumType('addendum')
      setAddendumReason('')
      setShowAddendumForm(false)
      setAppointment((prev: any) => prev ? { ...prev, chart_status: 'amended', clinical_note_pdf_url: data.pdf_url || prev.clinical_note_pdf_url } : prev)
      onStatusChange()
    } catch (err: any) {
      console.error('Error saving addendum:', err)
      setError(err.message || 'Failed to save addendum')
    } finally {
      setSavingAddendum(false)
    }
  }, [appointmentId, currentUser, addendumText, addendumType, addendumReason, onStatusChange, setAppointment, setError])

  // ─── Fetch Audit Trail ──────────────────────────────────────
  const handleFetchAuditTrail = useCallback(async () => {
    if (!appointmentId) return
    try {
      const res = await fetch(`/api/chart/audit?appointmentId=${appointmentId}`)
      const data = await res.json()
      if (data.audit_trail) setAuditEntries(data.audit_trail)
      setShowAuditTrail(true)
    } catch (err: any) {
      console.error('Error fetching audit trail:', err)
    }
  }, [appointmentId])

  // ─── View Clinical Note PDF ─────────────────────────────────
  const handleViewPdf = useCallback(async () => {
    if (!appointmentId) return
    try {
      const res = await fetch(`/api/chart/pdf?appointmentId=${appointmentId}&action=view`)
      const data = await res.json()
      if (data.pdf_url) {
        setClinicalNotePdfUrl(data.pdf_url)
        setShowPdfViewer(true)
      }
    } catch (err: any) {
      console.error('Error fetching PDF:', err)
      setError(err.message || 'Failed to load clinical note')
    }
  }, [appointmentId, setError])

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
      fetchAppointmentDetails().catch((err: unknown) => console.error('Error refreshing details:', err))
    } catch (err: any) {
      setError(err.message || 'Failed to move appointment')
    } finally {
      setMoveLoading(false)
    }
  }, [appointmentId, selectedMoveTime, fetchAppointmentDetails, setError, onStatusChange])

  const handleSignAndLock = handleSignAndLockChart

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
          prescriptions.setRxList((prev: any[]) => [...prev, ...medications])
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
        appointmentDocuments={memoizedAppointmentDocuments}
        uploadingDocument={documentUpload.uploadingDocument}
        selectedDocument={documentUpload.selectedDocument}
        uploadError={documentUpload.uploadError}
        onDocumentUpload={documentUpload.handleDocumentUpload}
        onDocumentSelect={documentUpload.setSelectedDocument}
        onDocumentDownload={handleDocumentDownload}
      />
    ),
    [appointment, memoizedSoapNotes, doctorNotes, activeTab, soapSaveStatus, isSigning, layout.isCustomizeMode, handleSoapNotesChange, handleDoctorNotesChangeMemoized, setActiveTab, handleSignAndLock, memoizedAppointmentDocuments, documentUpload.uploadingDocument, documentUpload.selectedDocument, documentUpload.uploadError, documentUpload.handleDocumentUpload, documentUpload.setSelectedDocument, handleDocumentDownload]
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
          return null

        case 'erx-composer':
          return null


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
                {/* Chart Status Badge */}
                <span className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                  chartStatus === 'draft'
                    ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
                    : chartStatus === 'signed'
                    ? 'bg-green-600/20 text-green-400 border border-green-500/40'
                    : chartStatus === 'closed'
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                }`}>
                  {chartStatus === 'draft' ? (
                    <><Edit className="h-3 w-3" />Draft</>
                  ) : chartStatus === 'signed' ? (
                    <><Lock className="h-3 w-3" />Signed</>
                  ) : chartStatus === 'closed' ? (
                    <><Lock className="h-3 w-3" />Closed</>
                  ) : (
                    <><FileText className="h-3 w-3" />Amended ({addendums.length})</>
                  )}
                </span>

                {/* Close Chart button — only when signed */}
                {chartStatus === 'signed' && (
                  <button
                    onClick={() => {
                      if (confirm('Close this chart? This will generate a clinical note PDF and lock the chart permanently. Use addendums for any future changes.')) {
                        handleCloseChart()
                      }
                    }}
                    disabled={chartActionLoading === 'close'}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/40 hover:bg-purple-600/40 transition-all disabled:opacity-50"
                    title="Close chart — generates clinical note PDF"
                  >
                    {chartActionLoading === 'close' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    {chartActionLoading === 'close' ? 'Generating PDF...' : 'Close Chart'}
                  </button>
                )}

                {/* Unlock button — only when signed (not closed/amended) */}
                {chartStatus === 'signed' && (
                  <button
                    onClick={() => setShowUnlockDialog(true)}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:border-white/30 transition-all"
                    title="Unlock chart — requires reason"
                  >
                    <Unlock className="h-3 w-3" />Unlock
                  </button>
                )}

                {/* View Clinical Note — when closed or amended */}
                {(chartStatus === 'closed' || chartStatus === 'amended') && (
                  <button
                    onClick={handleViewPdf}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/40 hover:bg-purple-600/40 transition-all"
                    title="View clinical note PDF"
                  >
                    <FileText className="h-3 w-3" />View Clinical Note
                  </button>
                )}

                {/* Add Addendum — only when closed or amended */}
                {(chartStatus === 'closed' || chartStatus === 'amended') && (
                  <button
                    onClick={() => setShowAddendumForm(v => !v)}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/40 transition-all"
                    title="Add addendum to closed chart"
                  >
                    <FileText className="h-3 w-3" />+ Addendum
                  </button>
                )}

                {/* Audit Trail — always available when not draft */}
                {chartStatus !== 'draft' && (
                  <button
                    onClick={handleFetchAuditTrail}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:border-white/30 transition-all"
                    title="View audit trail"
                  >
                    <Clock className="h-3 w-3" />Audit
                  </button>
                )}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* EHR Panel Buttons */}
                {!layout.isCustomizeMode && appointment && EHR_PANELS.map(panel => {
                  const Icon = panel.icon
                  const isErx = panel.id === 'drchrono-erx'
                  return (
                    <button key={panel.id} onClick={() => handleToolbarPanelClick(panel.id)}
                      className={`flex items-center gap-1 rounded-lg font-bold whitespace-nowrap transition-all border hover:text-white ${
                        isErx
                          ? 'px-4 py-2.5 text-sm border-green-500/60 bg-green-600/20 text-green-300 hover:bg-green-600/40 hover:border-green-400 shadow-lg shadow-green-900/30 animate-pulse-subtle'
                          : 'px-2 py-1.5 text-[11px] border-white/10 hover:border-white/30 text-slate-300'
                      }`}
                      style={isErx ? {} : { background: 'rgba(255,255,255,0.05)' }}>
                      <Icon className={isErx ? 'h-5 w-5' : 'h-3.5 w-3.5'} style={{ color: panel.color }} />{panel.label}
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

          {/* ─── Chart Status Bar (Signed info + Addendum form) ─── */}
          {appointment && (chartStatus === 'signed' || chartStatus === 'closed' || chartStatus === 'amended') && (
            <div className="flex-shrink-0 border-b border-white/10 bg-slate-900/80">
              {/* Signed banner */}
              <div className="px-4 py-2 flex items-center gap-3 bg-green-900/20 border-b border-green-500/20">
                <Lock className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                <span className="text-xs text-green-400 font-medium">
                  Chart signed{chartSignedBy ? ` by ${chartSignedBy}` : ''}{chartSignedAt ? ` on ${new Date(chartSignedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                </span>
                {addendums.length > 0 && (
                  <span className="text-xs text-blue-400 ml-auto">{addendums.length} addendum{addendums.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Addendum history */}
              {addendums.length > 0 && (
                <div className="px-4 py-2 space-y-2 max-h-32 overflow-y-auto">
                  {addendums.map((a) => (
                    <div key={a.id} className="p-2 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px] text-blue-400 font-bold">ADDENDUM</span>
                        <span className="text-[10px] text-gray-500">{a.created_by} — {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{a.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Addendum form — Enterprise */}
              {showAddendumForm && (
                <div className="px-4 py-3 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs text-blue-400 font-bold">NEW ADDENDUM</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {(['addendum', 'late_entry', 'correction'] as const).map(type => (
                      <button key={type} onClick={() => setAddendumType(type)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          addendumType === type
                            ? type === 'correction' ? 'bg-red-600/30 text-red-300 border-red-500/50' : 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/30'
                        }`}>
                        {type === 'addendum' ? 'Addendum' : type === 'late_entry' ? 'Late Entry' : 'Correction'}
                      </button>
                    ))}
                  </div>
                  {addendumType === 'correction' && (
                    <input value={addendumReason} onChange={(e) => setAddendumReason(e.target.value)}
                      placeholder="Reason for correction (required)..."
                      className="w-full px-3 py-2 mb-2 rounded-lg border border-red-500/30 bg-slate-700/50 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  )}
                  <textarea value={addendumText} onChange={(e) => setAddendumText(e.target.value)}
                    placeholder={`Add ${addendumType === 'correction' ? 'correction' : addendumType === 'late_entry' ? 'late entry' : 'addendum'}...`}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleSaveAddendum}
                      disabled={!addendumText.trim() || savingAddendum || (addendumType === 'correction' && addendumReason.trim().length < 5)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold disabled:opacity-50 transition-colors">
                      {savingAddendum ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save {addendumType === 'correction' ? 'Correction' : addendumType === 'late_entry' ? 'Late Entry' : 'Addendum'}
                    </button>
                    <button onClick={() => { setShowAddendumForm(false); setAddendumText(''); setAddendumReason(''); setAddendumType('addendum') }}
                      className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg hover:text-white text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Unlock Dialog */}
              {showUnlockDialog && (
                <div className="px-4 py-3 border-t border-white/5 bg-amber-900/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Unlock className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400 font-bold">UNLOCK CHART — REASON REQUIRED</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">This action will be recorded in the audit trail. The chart will revert to Draft status.</p>
                  <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)}
                    placeholder="Reason for unlocking (e.g., 'Need to correct medication dosage')..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-amber-500/30 bg-slate-700/50 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleUnlockChart}
                      disabled={unlockReason.trim().length < 5 || chartActionLoading === 'unlock'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold disabled:opacity-50 transition-colors">
                      {chartActionLoading === 'unlock' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                      Confirm Unlock
                    </button>
                    <button onClick={() => { setShowUnlockDialog(false); setUnlockReason('') }}
                      className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg hover:text-white text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* PDF Viewer Modal */}
              {showPdfViewer && clinicalNotePdfUrl && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPdfViewer(false)}>
                  <div className="bg-slate-800 rounded-xl border border-white/10 shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-bold text-white">Clinical Note PDF</span>
                        <span className="text-xs text-gray-400">{chartStatus === 'amended' ? `(Amended — ${addendums.length} addendum${addendums.length > 1 ? 's' : ''})` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={clinicalNotePdfUrl} target="_blank" rel="noopener noreferrer" download
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors">
                          <Download className="h-3 w-3" />Download
                        </a>
                        <button onClick={() => setShowPdfViewer(false)}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <iframe src={clinicalNotePdfUrl} className="w-full h-full border-0" title="Clinical Note PDF" />
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Trail Modal */}
              {showAuditTrail && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowAuditTrail(false)}>
                  <div className="bg-slate-800 rounded-xl border border-white/10 shadow-2xl w-[90vw] max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-bold text-white">Chart Audit Trail</span>
                      </div>
                      <button onClick={() => setShowAuditTrail(false)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {auditEntries.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No audit entries found</p>
                      ) : auditEntries.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            entry.action === 'signed' ? 'bg-green-500' :
                            entry.action === 'closed' ? 'bg-purple-500' :
                            entry.action === 'unlocked' ? 'bg-amber-500' :
                            entry.action.includes('addendum') || entry.action.includes('correction') ? 'bg-blue-500' :
                            entry.action.includes('pdf') ? 'bg-cyan-500' : 'bg-gray-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{entry.action.replace(/_/g, ' ').toUpperCase()}</span>
                              <span className="text-[10px] text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-400">by {entry.performed_by_name} ({entry.performed_by_role})</p>
                            {entry.reason && <p className="text-xs text-amber-400 mt-0.5">Reason: {entry.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content — Original 2-column grid layout */}
          <div 
            ref={layout.scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 min-w-0"
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
              <>
                {/* ─── Open Video Consultation Button ─── */}
                <button 
                  onClick={() => setShowVideoPanel(true)}
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl font-bold text-base text-white transition-all hover:brightness-110 mb-5 shadow-lg shadow-cyan-900/30"
                  style={{ background: 'linear-gradient(135deg, #0e7490, #1e40af)' }}>
                  <Video className="h-5 w-5" />
                  Open Video Consultation
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Left Panel */}
                  <div className="space-y-4 sm:space-y-6">
                    {layout.leftPanelSections.map((sectionId: string) => renderSection(sectionId, 'left'))}
                  </div>

                  {/* Right Panel */}
                  <div className="space-y-4 sm:space-y-6">
                    {layout.rightPanelSections.map((sectionId: string) => renderSection(sectionId, 'right'))}
                  </div>
                </div>
              </>
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
          onReconcile={(medications: any[]) => {
            const newMeds = medications.map((med: any, idx: number) => ({ id: `reconciled-${Date.now()}-${idx}`, medication: med.medication_name, provider: med.prescriber || 'Surescripts', date: med.start_date || new Date().toISOString().split('T')[0] }))
            newMeds.forEach((med: any) => { problemsMedications.handleAddMedicationHistory(med.medication, med.provider, med.date) })
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
          onViewAppointment={(apptId: string) => { setShowAppointmentsOverlay(false); if (onAppointmentSwitch) onAppointmentSwitch(apptId) }}
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

      {/* Phase 1B: New EHR Overlay Panels */}
      {appointment?.patient_id && (
        <DemographicsPanel isOpen={showDemographicsPanel} onClose={() => setShowDemographicsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <ProblemsPanel isOpen={showProblemsPanel} onClose={() => setShowProblemsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <ClinicalNotesPanel isOpen={showClinicalNotesPanel} onClose={() => setShowClinicalNotesPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <LabResultsPanel isOpen={showLabResultsPanel} onClose={() => setShowLabResultsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <ImmunizationsPanel isOpen={showImmunizationsPanel} onClose={() => setShowImmunizationsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <DocumentsPanel isOpen={showDocumentsPanel} onClose={() => setShowDocumentsPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <FamilyHistoryPanel isOpen={showFamilyHistoryPanel} onClose={() => setShowFamilyHistoryPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <SocialHistoryPanel isOpen={showSocialHistoryPanel} onClose={() => setShowSocialHistoryPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <SurgicalHistoryPanel isOpen={showSurgicalHistoryPanel} onClose={() => setShowSurgicalHistoryPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <PharmacyPanel isOpen={showPharmacyPanel} onClose={() => setShowPharmacyPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <CarePlansPanel isOpen={showCarePlansPanel} onClose={() => setShowCarePlansPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {appointment?.patient_id && (
        <BillingPanel isOpen={showBillingPanel} onClose={() => setShowBillingPanel(false)} patientId={appointment.patient_id} patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'} />
      )}

      {/* Lab Results Overlay (moved from inline section to EHR toolbar) */}
      {showLabResultsInline && appointment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLabResultsInline(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6 m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FlaskConical className="h-5 w-5 text-sky-400" />Lab Orders</h2>
              <button onClick={() => setShowLabResultsInline(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <LabResultsSection labResults={labResults.labResults} isLoadingLabs={labResults.isLoadingLabs} isCustomizeMode={false} sectionProps={{}} onLoadLabResults={labResults.loadLabResults} patientId={appointment?.patient_id || undefined} appointmentId={appointmentId || undefined} />
          </div>
        </div>
      )}

      {/* Referrals & Follow-Up Overlay (moved from inline section to EHR toolbar) */}
      {showReferralsPanel && appointment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowReferralsPanel(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6 m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><ArrowRight className="h-5 w-5 text-orange-400" />Referrals & Follow-Up</h2>
              <button onClick={() => setShowReferralsPanel(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <ReferralsFollowUpSection referrals={referralsFollowUp.referrals} showReferralForm={referralsFollowUp.showReferralForm} setShowReferralForm={referralsFollowUp.setShowReferralForm} newReferral={referralsFollowUp.newReferral} setNewReferral={referralsFollowUp.setNewReferral} showFollowUpScheduler={referralsFollowUp.showFollowUpScheduler} setShowFollowUpScheduler={referralsFollowUp.setShowFollowUpScheduler} followUpData={referralsFollowUp.followUpData} setFollowUpData={referralsFollowUp.setFollowUpData} isSchedulingFollowUp={referralsFollowUp.isSchedulingFollowUp} isCustomizeMode={false} sectionProps={{}}
              onCreateReferral={async () => { try { await referralsFollowUp.handleCreateReferral() } catch (err: any) { setError(err.message) } }}
              onScheduleFollowUp={async () => { try { await referralsFollowUp.handleScheduleFollowUp(); onStatusChange() } catch (err: any) { setError(err.message) } }}
              error={error}
              patientId={appointment?.patient_id || undefined}
              appointmentId={appointmentId || undefined}
            />
          </div>
        </div>
      )}

      {/* Prior Authorization Overlay (moved from inline section to EHR toolbar) */}
      {showPriorAuthPanel && appointment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPriorAuthPanel(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6 m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-violet-400" />Prior Authorization</h2>
              <button onClick={() => setShowPriorAuthPanel(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <PriorAuthSection priorAuths={priorAuth.priorAuths} showPriorAuthForm={priorAuth.showPriorAuthForm} setShowPriorAuthForm={priorAuth.setShowPriorAuthForm} newPriorAuth={priorAuth.newPriorAuth} setNewPriorAuth={priorAuth.setNewPriorAuth} isSubmitting={priorAuth.isSubmitting} isCustomizeMode={false} sectionProps={{}}
              onSubmitPriorAuth={async () => { try { await priorAuth.handleSubmitPriorAuth() } catch (err: any) { setError(err.message) } }}
              error={error}
              patientId={appointment?.patient_id || undefined}
              appointmentId={appointmentId || undefined}
            />
          </div>
        </div>
      )}

      {/* Floating Video Consultation Panel — only shows after doctor clicks Start Video Call */}
      {showVideoPanel && (
        <DailyMeetingEmbed
          {...{
            appointment: appointment ? {
              id: appointment.id,
              requested_date_time: appointment.requested_date_time,
              dailyco_meeting_url: (appointment as any).dailyco_meeting_url || null,
              dailyco_room_name: (appointment as any).dailyco_room_name || null,
              dailyco_owner_token: (appointment as any).dailyco_owner_token || null,
              recording_url: (appointment as any).recording_url || null
            } : null,
            currentUser,
            patientPhone: appointment?.patients?.phone || '',
            patientName: `${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim(),
            patientEmail: appointment?.patients?.email || '',
            providerId: currentUser?.id,
            providerEmail: currentUser?.email || '',
            onOpenCommHub: () => { setShowCommHub(true) },
            onClose: () => setShowVideoPanel(false),
            onSoapGenerated: (soap: any) => {
              if (handleSoapNotesChange) {
                handleSoapNotesChange('chiefComplaint', soap.subjective)
                handleSoapNotesChange('assessmentPlan', soap.assessment + '\n\n' + soap.plan)
              }
            }
          } as any}
        />
      )}

      {/* Unified Communication Hub */}
      <UnifiedCommHub
        isOpen={showCommHub}
        onClose={() => setShowCommHub(false)}
        patientId={appointment?.patient_id || undefined}
        patientName={`${appointment?.patients?.first_name || ''} ${appointment?.patients?.last_name || ''}`.trim() || 'Patient'}
        patientPhone={appointment?.patients?.phone || ''}
        patientEmail={appointment?.patients?.email || ''}
        appointmentId={appointmentId}
        providerId={currentUser?.id}
        providerName={currentUser?.name || 'Provider'}
        providerEmail={currentUser?.email || ''}
        onSendEmail={handleSendEmail}
        onSmsSent={onSmsSent}
      />
    </>
  )
}







































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































