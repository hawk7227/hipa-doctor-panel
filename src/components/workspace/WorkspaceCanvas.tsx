'use client'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — WORKSPACE CANVAS
// Replaces the 7100-line AppointmentDetailModal with a
// react-grid-layout based draggable/resizable panel workspace.
//
// Uses existing foundation:
//   - WorkspaceState (useReducer context)
//   - PanelRegistry (panel configs)
//   - PanelShell (individual panel wrapper)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logViewAppointment } from '@/lib/audit'
import { PROVIDER_TIMEZONE } from '@/lib/constants'
import {
  X, Loader2, CheckCircle, XCircle, RotateCcw, Lock, Edit, Clock,
  FileText, Video, ArrowRight, ChevronLeft, ChevronRight, CalendarPlus, RefreshCw, User, Calendar,
} from 'lucide-react'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'

// ── Grid layout CSS ──
import 'react-grid-layout/css/styles.css'

// Custom overrides for grid items
const gridStyles = `
  .react-grid-item.react-grid-placeholder {
    background: rgba(20, 184, 166, 0.15) !important;
    border: 2px dashed rgba(20, 184, 166, 0.4) !important;
    border-radius: 12px !important;
    opacity: 1 !important;
  }
  .react-grid-item > .react-resizable-handle {
    background-image: none !important;
    width: 20px !important;
    height: 20px !important;
  }
  .react-grid-item > .react-resizable-handle::after {
    content: '' !important;
    position: absolute !important;
    right: 5px !important;
    bottom: 5px !important;
    width: 8px !important;
    height: 8px !important;
    border-right: 2px solid rgba(148, 163, 184, 0.4) !important;
    border-bottom: 2px solid rgba(148, 163, 184, 0.4) !important;
  }
  .react-grid-item > .react-resizable-handle:hover::after {
    border-color: rgba(20, 184, 166, 0.8) !important;
  }
  .react-grid-item.react-draggable-dragging {
    box-shadow: 0 0 20px rgba(20, 184, 166, 0.2) !important;
    border-color: rgba(20, 184, 166, 0.4) !important;
    z-index: 100 !important;
  }
`

// ── Hooks ──
import { useAppointmentData } from '@/components/appointment/hooks/useAppointmentData'
import { useDoctorNotes } from '@/components/appointment/hooks/useDoctorNotes'
import { usePrescriptions } from '@/components/appointment/hooks/usePrescriptions'
import { useProblemsMedications } from '@/components/appointment/hooks/useProblemsMedications'
import { useDocumentUpload } from '@/components/appointment/hooks/useDocumentUpload'
import { useLabResults } from '@/components/appointment/hooks/useLabResults'
import { useReferralsFollowUp } from '@/components/appointment/hooks/useReferralsFollowUp'
import { usePriorAuth } from '@/components/appointment/hooks/usePriorAuth'
import { useChartManagement } from '@/components/appointment/hooks/useChartManagement'
import { useAppointmentActions } from '@/components/appointment/hooks/useAppointmentActions'
import { convertToTimezone } from '@/components/appointment/utils/timezone-utils'
import { usePatientData } from '@/hooks/usePatientData'

// ── Panel Components ──
import ErxComposer from '@/components/appointment/sections/ErxComposer'
import OrdersPanelV2 from '@/components/panels/OrdersPanelV2'
import PrescriptionHistoryPanelV2 from '@/components/panels/PrescriptionHistoryPanelV2'
import ChartManagementPanel from '@/components/ChartManagementPanel'
import MedicationHistoryPanel from '@/components/MedicationHistoryPanel'
import AppointmentsOverlayPanel from '@/components/AppointmentsOverlayPanel'
import AllergiesPanelV2 from '@/components/panels/AllergiesPanelV2'
import VitalsPanelV2 from '@/components/panels/VitalsPanelV2'
import MedicationsPanelV2 from '@/components/panels/MedicationsPanelV2'
import DemographicsPanel from '@/components/DemographicsPanel'
import ProblemsPanelV2 from '@/components/panels/ProblemsPanelV2'
import ClinicalNotesPanel from '@/components/ClinicalNotesPanel'
import LabResultsPanel from '@/components/LabResultsPanel'
import ImmunizationsPanel from '@/components/ImmunizationsPanel'
import DocumentsPanel from '@/components/DocumentsPanel'
import { FamilyHistoryPanel, SocialHistoryPanel, SurgicalHistoryPanel } from '@/components/HistoryPanels'
import PharmacyPanel from '@/components/PharmacyPanel'
import CarePlansPanel from '@/components/CarePlansPanel'
import BillingPanel from '@/components/BillingPanel'
import UnifiedCommHub from '@/components/UnifiedCommHub'
import DailyMeetingEmbed from '@/components/DailycoMeetingPanel'

// ── Toolbar config ──
import { EHR_PANELS } from '@/components/appointment/sections/ToolbarButtons'
import type { PanelId } from '@/components/appointment/hooks/usePanelVisibility'

// ── react-grid-layout (direct import, SSR guarded in render) ──
import { ResponsiveGridLayout as RGL } from 'react-grid-layout'

// ═══════════════════════════════════════════════════════════════
// GRID LAYOUT CONFIG
// ═══════════════════════════════════════════════════════════════
const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }
const ROW_HEIGHT = 40
const MARGIN: [number, number] = [8, 8]

// Default layout for the main panels
const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'patient-info', x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'soap-notes', x: 4, y: 0, w: 8, h: 16, minW: 4, minH: 8 },
    { i: 'video-panel', x: 0, y: 6, w: 4, h: 8, minW: 3, minH: 4 },
  ],
  md: [
    { i: 'patient-info', x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'soap-notes', x: 4, y: 0, w: 4, h: 16, minW: 4, minH: 8 },
    { i: 'video-panel', x: 0, y: 6, w: 4, h: 8, minW: 3, minH: 4 },
  ],
  sm: [
    { i: 'patient-info', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
    { i: 'soap-notes', x: 0, y: 5, w: 4, h: 14, minW: 2, minH: 8 },
    { i: 'video-panel', x: 0, y: 19, w: 4, h: 8, minW: 2, minH: 4 },
  ],
  xs: [
    { i: 'patient-info', x: 0, y: 0, w: 2, h: 6 },
    { i: 'soap-notes', x: 0, y: 6, w: 2, h: 16 },
    { i: 'video-panel', x: 0, y: 22, w: 2, h: 8 },
  ],
  xxs: [
    { i: 'patient-info', x: 0, y: 0, w: 1, h: 6 },
    { i: 'soap-notes', x: 0, y: 6, w: 1, h: 16 },
    { i: 'video-panel', x: 0, y: 22, w: 1, h: 8 },
  ],
}

// ═══════════════════════════════════════════════════════════════
// PROPS (same interface as old modal for calendar compatibility)
// ═══════════════════════════════════════════════════════════════
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
  doctors?: { timezone: string }
}

interface WorkspaceCanvasProps {
  appointmentId: string | null
  /** Patient-only mode: open chart without appointment */
  patientId?: string | null
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
    id: string; first_name: string; last_name: string; email: string; mobile_phone: string
  }, date: Date, time: Date) => void
  /** Called when "Schedule Appointment" is clicked in patient-only mode */
  onScheduleAppointment?: (patientData: {
    id: string; first_name: string; last_name: string; email: string; mobile_phone: string
  }) => void
}

// ═══════════════════════════════════════════════════════════════
// WORKSPACE CANVAS COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function WorkspaceCanvas({
  appointmentId, patientId: propPatientId, isOpen, onClose, onStatusChange, onSmsSent,
  appointments = [], currentDate, onAppointmentSwitch, onFollowUp, onScheduleAppointment,
}: WorkspaceCanvasProps) {
  // ── Stable appointments ──
  const idsString = useMemo(() => appointments.map(a => a.id).sort().join(','), [appointments])
  const stableAppointments = useMemo(() => appointments, [idsString])

  // ── Mode detection ──
  const isPatientOnlyMode = !appointmentId && !!propPatientId

  // ── Core data (appointment mode) ──
  const {
    appointment, loading: aptLoading, error: aptError, newDateTime, setNewDateTime,
    currentUser, setAppointment, setError, fetchAppointmentDetails,
  } = useAppointmentData(appointmentId, isOpen && !isPatientOnlyMode, stableAppointments)

  // ── Patient-only data ──
  const {
    patient: directPatient,
    loading: patientLoading,
    error: patientError,
    refetch: refetchPatient,
  } = usePatientData(isPatientOnlyMode ? propPatientId! : null)

  // ── Unified loading/error ──
  const loading = isPatientOnlyMode ? patientLoading : aptLoading
  const error = isPatientOnlyMode ? patientError : aptError

  // ── Chart management ──
  const chart = useChartManagement(appointmentId, currentUser?.email)

  // ── Actions ──
  const actions = useAppointmentActions(
    appointmentId, onStatusChange, onClose,
    setAppointment as any, setError
  )

  // ── Derived data (needed by hooks below) ──
  const patientId = isPatientOnlyMode ? propPatientId! : (appointment?.patient_id || null)

  // ── Content hooks ──
  const doctorNotes = useDoctorNotes(appointmentId, appointment)
  const prescriptions = usePrescriptions(appointmentId)
  const documentUpload = useDocumentUpload(appointmentId)
  const labResults = useLabResults(appointmentId, patientId)
  const referrals = useReferralsFollowUp(appointmentId, appointment)
  const priorAuth = usePriorAuth(appointmentId, patientId)

  // ── Open overlay panels ──
  const [openOverlays, setOpenOverlays] = useState<Set<string>>(new Set())
  const toggleOverlay = useCallback((id: string) => {
    setOpenOverlays(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const closeOverlay = useCallback((id: string) => {
    setOpenOverlays(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // ── SSR guard ──
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ── Grid container width measurement ──
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(1200)

  useEffect(() => {
    const measure = () => {
      if (gridContainerRef.current) {
        setGridWidth(gridContainerRef.current.offsetWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Re-measure when appointment loads (container might change)
  useEffect(() => {
    if (appointment && gridContainerRef.current) {
      // Small delay to let DOM settle
      const t = setTimeout(() => {
        if (gridContainerRef.current) {
          setGridWidth(gridContainerRef.current.offsetWidth)
        }
      }, 100)
      return () => clearTimeout(t)
    }
  }, [appointment])

  // ── Grid layout state ──
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS)
  const [showVideo, setShowVideo] = useState(false)
  const [activeTab, setActiveTab] = useState<'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit'>('SOAP')

  // ── Sync chart from appointment ──
  useEffect(() => {
    if (appointment) chart.syncFromAppointment(appointment)
  }, [appointment, chart.syncFromAppointment])

  // ── Audit log on open ──
  useEffect(() => {
    if (isOpen && appointmentId && currentUser) {
      try { logViewAppointment(appointmentId) } catch (e) { console.error(e) }
    }
  }, [isOpen, appointmentId, currentUser])

  // ── Reset overlays when appointment changes ──
  useEffect(() => {
    setOpenOverlays(new Set())
    setShowVideo(false)
    setActiveTab('SOAP')
  }, [appointmentId])

  // ── Derived display data ──
  // Supabase joins may return patients as array or object — normalize
  // ── Patient data normalization (handles both modes) ──
  const aptPatientData = appointment?.patients
    ? (Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients)
    : null
  const patientData = isPatientOnlyMode ? directPatient : aptPatientData
  const patientName = patientData
    ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'N/A'
    : 'N/A'
  const patientEmail = patientData?.email || 'N/A'
  const patientPhone = patientData?.phone || (patientData as any)?.mobile_phone || 'N/A'
  const patientDob = patientData?.date_of_birth || 'N/A'

  // ── Layout change handler ──
  const handleLayoutChange = useCallback((_layout: any, allLayouts: any) => {
    setLayouts(allLayouts)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  if (!isOpen) return null

  return (
    <div className="h-full flex flex-col bg-[#0a1118] overflow-hidden">
      {/* Grid custom styles */}
      <style dangerouslySetInnerHTML={{ __html: gridStyles }} />
      {/* ═══ TOOLBAR HEADER ═══ */}
      <div className="flex-shrink-0 bg-[#0d1a24] border-b border-white/10 px-4 py-2">
        {/* Row 1: Title + Status/Patient + Close */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isPatientOnlyMode ? (
              <>
                <span className="text-teal-400 font-bold text-sm">PATIENT CHART</span>
                <span className="px-2 py-0.5 bg-white/10 text-white text-xs font-bold rounded">{patientName}</span>
                {patientDob !== 'N/A' && (
                  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded border border-orange-500/30">
                    DOB {new Date(patientDob + 'T00:00:00').toLocaleDateString()}
                  </span>
                )}
                {(directPatient as any)?.drchrono_synced && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30">
                    DrChrono Synced
                  </span>
                )}
                {(directPatient as any)?.chart_id && (
                  <span className="text-[10px] text-gray-500">Chart #{(directPatient as any).chart_id}</span>
                )}
              </>
            ) : (
              <>
                <span className="text-cyan-400 font-bold text-sm">APPOINTMENT</span>
                {appointment?.requested_date_time && (
                  <span className="text-white text-sm">
                    • {convertToTimezone(appointment.requested_date_time, PROVIDER_TIMEZONE).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                )}
                {appointment?.status && (
                  <select
                    value={appointment.status}
                    onChange={(e) => actions.handleStatusChange(e.target.value)}
                    disabled={actions.statusUpdating}
                    className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer border-0 outline-none ${
                      appointment.status === 'pending' ? 'bg-yellow-600 text-white' :
                      appointment.status === 'accepted' ? 'bg-green-600 text-white' :
                      appointment.status === 'completed' ? 'bg-blue-600 text-white' :
                      appointment.status === 'cancelled' ? 'bg-gray-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}
                  >
                    <option value="pending">PENDING</option>
                    <option value="accepted">ACCEPTED</option>
                    <option value="completed">COMPLETED</option>
                    <option value="cancelled">CANCELLED</option>
                    <option value="no_show">NO SHOW</option>
                  </select>
                )}
                {/* Chart status badge */}
                <button
                  onClick={() => toggleOverlay('chart-management')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all hover:opacity-80 ${
                    chart.chartStatus === 'draft' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40' :
                    chart.chartStatus === 'signed' ? 'bg-green-600/20 text-green-400 border border-green-500/40' :
                    chart.chartStatus === 'closed' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40' :
                    chart.chartStatus === 'preliminary' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40' :
                    'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                  }`}
                >
                  {chart.chartStatus === 'draft' && <><Edit className="h-3 w-3" />Draft</>}
                  {chart.chartStatus === 'preliminary' && <><Clock className="h-3 w-3" />Preliminary</>}
                  {chart.chartStatus === 'signed' && <><Lock className="h-3 w-3" />Signed</>}
                  {chart.chartStatus === 'closed' && <><Lock className="h-3 w-3" />Closed</>}
                  {chart.chartStatus === 'amended' && <><FileText className="h-3 w-3" />Amended</>}
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPatientOnlyMode && (
              <button onClick={() => refetchPatient()} className="p-1.5 text-gray-500 hover:text-teal-400 rounded-lg hover:bg-white/5 transition-colors" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Row 2: EHR Panel Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          {EHR_PANELS.map(panel => {
            const Icon = panel.icon
            const isErx = panel.id === 'drchrono-erx'
            const isActive = openOverlays.has(panel.id)
            return (
              <button
                key={panel.id}
                onClick={() => toggleOverlay(panel.id)}
                className={`flex items-center gap-1 rounded-lg font-bold whitespace-nowrap transition-all border hover:text-white relative ${
                  isErx
                    ? 'px-3 py-2 text-sm border-green-500/60 bg-green-600/20 text-green-300 hover:bg-green-600/40 hover:border-green-400 shadow-lg shadow-green-900/30'
                    : isActive
                    ? 'px-2 py-1 text-[11px] border-white/30 text-white bg-white/10'
                    : 'px-2 py-1 text-[11px] border-white/10 hover:border-white/30 text-slate-300 bg-white/5'
                }`}
              >
                <Icon className={isErx ? 'h-4 w-4' : 'h-3 w-3'} style={{ color: panel.color }} />
                {panel.label}
                {isActive && !isErx && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: panel.color }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Row 3: Action Buttons */}
        {isPatientOnlyMode && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={() => {
                if (onScheduleAppointment && patientData) {
                  onScheduleAppointment({
                    id: (patientData as any).id || propPatientId!,
                    first_name: patientData.first_name || '',
                    last_name: patientData.last_name || '',
                    email: patientData.email || '',
                    mobile_phone: (patientData as any).mobile_phone || patientData.phone || '',
                  })
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-400 hover:to-cyan-500 transition-all text-xs font-bold shadow-lg shadow-teal-900/30"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Schedule Appointment
            </button>
            {(directPatient?.appointments_count || 0) > 0 && (
              <button
                onClick={() => toggleOverlay('appointments')}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 text-xs font-medium"
              >
                <Calendar className="h-3 w-3" />
                View {directPatient?.appointments_count} Appointment{(directPatient?.appointments_count || 0) > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
        {!isPatientOnlyMode && appointment && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {appointment.visit_type === 'video' && (
              <button onClick={() => setShowVideo(!showVideo)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all text-xs font-bold">
                <Video className="h-3.5 w-3.5" />{showVideo ? 'Hide Video' : 'Video Call'}
              </button>
            )}
            <button onClick={() => { actions.setShowRescheduleForm(!actions.showRescheduleForm); actions.setShowCancelConfirm(false) }}
              className={`flex items-center gap-1 px-3 py-1.5 ${actions.showRescheduleForm ? 'bg-orange-700' : 'bg-orange-600'} text-white rounded-lg hover:bg-orange-700 text-xs`}>
              <RotateCcw className="h-3 w-3" />Reschedule
            </button>
            <button onClick={() => { actions.setShowCancelConfirm(!actions.showCancelConfirm); actions.setShowRescheduleForm(false) }}
              className={`flex items-center gap-1 px-3 py-1.5 ${actions.showCancelConfirm ? 'bg-red-700' : 'bg-red-600'} text-white rounded-lg hover:bg-red-700 text-xs`}>
              <XCircle className="h-3 w-3" />Cancel
            </button>
            {appointment.status === 'accepted' && (
              <button onClick={actions.handleComplete} disabled={actions.actionLoading === 'complete'}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50">
                {actions.actionLoading === 'complete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                Complete
              </button>
            )}
            {appointment.status === 'pending' && (
              <>
                <button onClick={() => actions.handleAppointmentAction('accept')} disabled={actions.actionLoading === 'accept'}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs disabled:opacity-50">
                  <CheckCircle className="h-3 w-3" />Accept
                </button>
                <button onClick={() => actions.handleAppointmentAction('reject')} disabled={actions.actionLoading === 'reject'}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs disabled:opacity-50">
                  <XCircle className="h-3 w-3" />Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ LOADING / ERROR / CONTENT ═══ */}
      <div className="flex-1 overflow-auto p-2">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading appointment...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-900/20 text-red-300 m-4">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchAppointmentDetails()}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !appointment && !isPatientOnlyMode && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No appointment selected
          </div>
        )}

        {!loading && !error && (appointment || isPatientOnlyMode) && mounted && (
          <div ref={gridContainerRef} className="w-full">
          <RGL
            className="layout"
            width={gridWidth}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            margin={MARGIN}
            containerPadding={[4, 4]}
            dragConfig={{ handle: '.grid-drag-handle' }}
            onLayoutChange={handleLayoutChange as any}
          >
            {/* ── PATIENT INFO PANEL ── */}
            <div key="patient-info" className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl overflow-hidden relative">
              <div className="grid-drag-handle flex items-center gap-2 px-3 py-2 border-b border-[#1a3d3d] cursor-grab active:cursor-grabbing bg-[#0d2626] select-none"
                style={{ borderTop: '2px solid #14b8a6' }}>
                <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="4" cy="3" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
                  <circle cx="4" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                  <circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/>
                </svg>
                <span className="text-sm font-semibold text-white">Patient Info</span>
              </div>
              <div className="p-3 overflow-auto h-[calc(100%-36px)]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Name</p>
                    <p className="text-white font-bold text-sm">{patientName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Email</p>
                    <p className="text-white text-sm truncate">{patientEmail}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Phone</p>
                    <p className="text-white text-sm">{patientPhone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">DOB</p>
                    <p className="text-white text-sm">{patientDob}</p>
                  </div>
                </div>
                {/* Chief Complaint (appointment mode only) */}
                {!isPatientOnlyMode && appointment && (
                <div className="mt-3 pt-3 border-t border-[#1a3d3d]">
                  <p className="text-[10px] text-gray-500 uppercase">Chief Complaint</p>
                  <p className="text-teal-300 text-sm font-medium mt-1">
                    {appointment.chief_complaint || (appointment as any).reason || 'N/A'}
                  </p>
                </div>
                )}
                {/* Visit Type (appointment mode only) */}
                {!isPatientOnlyMode && appointment && (
                <div className="mt-2">
                  <p className="text-[10px] text-gray-500 uppercase">Visit Type</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${
                    appointment.visit_type === 'video' ? 'bg-cyan-600/20 text-cyan-300' :
                    appointment.visit_type === 'phone' ? 'bg-amber-600/20 text-amber-300' :
                    'bg-blue-600/20 text-blue-300'
                  }`}>
                    {(appointment.visit_type || 'video').toUpperCase()}
                  </span>
                </div>
                )}
                {/* Patient-only: extra fields */}
                {isPatientOnlyMode && directPatient && (
                <>
                  <div className="mt-3 pt-3 border-t border-[#1a3d3d] grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Gender</p>
                      <p className="text-white text-sm capitalize">{directPatient.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Language</p>
                      <p className="text-white text-sm">{directPatient.preferred_language || 'English'}</p>
                    </div>
                  </div>
                  {directPatient.address && (
                    <div className="mt-2">
                      <p className="text-[10px] text-gray-500 uppercase">Address</p>
                      <p className="text-white text-sm">{directPatient.address}</p>
                    </div>
                  )}
                  {directPatient.preferred_pharmacy && (
                    <div className="mt-2">
                      <p className="text-[10px] text-gray-500 uppercase">Pharmacy</p>
                      <p className="text-white text-sm">{directPatient.preferred_pharmacy}</p>
                    </div>
                  )}
                  {directPatient.emergency_contact_name && (
                    <div className="mt-2">
                      <p className="text-[10px] text-gray-500 uppercase">Emergency Contact</p>
                      <p className="text-white text-sm">{directPatient.emergency_contact_name} — {directPatient.emergency_contact_phone || 'N/A'}</p>
                    </div>
                  )}
                </>
                )}
              </div>
            </div>

            {/* ── SOAP NOTES PANEL ── */}
            <div key="soap-notes" className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl overflow-hidden flex flex-col relative">
              <div className="grid-drag-handle flex items-center gap-2 justify-between px-3 py-2 border-b border-[#1a3d3d] cursor-grab active:cursor-grabbing select-none"
                style={{ borderTop: '2px solid #3b82f6' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="4" cy="3" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
                    <circle cx="4" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                    <circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/>
                  </svg>
                  <span className="text-sm font-semibold text-white">Clinical</span>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-[#1a3d3d] flex-shrink-0">
                {(['SOAP', 'Orders', 'Files', 'Notes', 'Billing', 'Audit'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5' : 'text-gray-400 hover:text-gray-200'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-3">
                {activeTab === 'SOAP' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase block mb-1">Chief Complaint</label>
                      <textarea
                        value={doctorNotes.soapNotes?.chiefComplaint || appointment?.chief_complaint || (appointment as any)?.reason || ''}
                        onChange={(e) => doctorNotes.handleSoapNotesChange?.('chiefComplaint', e.target.value)}
                        readOnly={chart.chartLocked}
                        className="w-full bg-[#0a1a1a] border border-[#1a3d3d] rounded-lg p-2 text-white text-sm min-h-[50px] resize-y"
                        placeholder="Chief complaint..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase block mb-1">ROS — General</label>
                        <textarea
                          value={doctorNotes.soapNotes?.rosGeneral || ''}
                          onChange={(e) => doctorNotes.handleSoapNotesChange?.('rosGeneral', e.target.value)}
                          readOnly={chart.chartLocked}
                          className="w-full bg-[#0a1a1a] border border-[#1a3d3d] rounded-lg p-2 text-white text-sm min-h-[120px] resize-y"
                          placeholder="ROS..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase block mb-1">Assessment & Plan</label>
                        <textarea
                          value={doctorNotes.soapNotes?.assessmentPlan || ''}
                          onChange={(e) => doctorNotes.handleSoapNotesChange?.('assessmentPlan', e.target.value)}
                          readOnly={chart.chartLocked}
                          className="w-full bg-[#0a1a1a] border border-[#1a3d3d] rounded-lg p-2 text-white text-sm min-h-[120px] resize-y"
                          placeholder="Assessment & plan..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase block mb-1">Doctor Notes</label>
                      <textarea
                        value={doctorNotes.doctorNotes || ''}
                        onChange={(e) => doctorNotes.setDoctorNotes?.(e.target.value)}
                        readOnly={chart.chartLocked}
                        className="w-full bg-[#0a1a1a] border border-[#1a3d3d] rounded-lg p-2 text-white text-sm min-h-[80px] resize-y"
                        placeholder="Additional notes..."
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">
                        {doctorNotes.soapSaveStatus === 'saving' ? 'Saving...' : doctorNotes.soapSaveStatus === 'saved' ? 'Saved ✓' : 'Auto-saves as you type'}
                      </span>
                      {!chart.chartLocked && (
                        <button onClick={chart.signChart} disabled={doctorNotes.isSigning}
                          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-bold text-sm hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50">
                          {doctorNotes.isSigning ? 'Signing...' : '◇ Sign & Lock'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'Orders' && patientId && (
                  <OrdersPanelV2 isOpen patientId={patientId} patientName={patientName} appointmentId={appointmentId || ''} onClose={() => setActiveTab('SOAP')} />
                )}
                {activeTab === 'Files' && (
                  <div className="space-y-2">
                    {documentUpload.appointmentDocuments?.length === 0 && <p className="text-gray-500 text-sm">No documents uploaded.</p>}
                    {documentUpload.appointmentDocuments?.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between bg-[#0a1a1a] border border-[#1a3d3d] rounded-lg p-2">
                        <span className="text-white text-sm truncate">{doc.file_name || 'Document'}</span>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline">View</a>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'Notes' && patientId && (
                  <ClinicalNotesPanel isOpen patientId={patientId} patientName={patientName} onClose={() => setActiveTab('SOAP')} />
                )}
                {activeTab === 'Billing' && patientId && (
                  <BillingPanel isOpen patientId={patientId} patientName={patientName} onClose={() => setActiveTab('SOAP')} />
                )}
                {activeTab === 'Audit' && (
                  <div className="text-sm">
                    <button onClick={chart.fetchAuditTrail}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-xs mb-3">
                      Load Audit Trail
                    </button>
                    {chart.auditEntries.length === 0 && <p className="text-gray-500">No audit entries.</p>}
                    {chart.auditEntries.map(entry => (
                      <div key={entry.id} className="border-b border-white/5 py-2">
                        <p className="text-white text-xs font-bold">{entry.action}</p>
                        <p className="text-gray-500 text-xs">{entry.performed_by_name} • {new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── VIDEO PANEL (conditional) ── */}
            {showVideo && (
              <div key="video-panel" className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl overflow-hidden flex flex-col">
                <div className="grid-drag-handle flex items-center justify-between px-3 py-2 border-b border-[#1a3d3d] cursor-grab"
                  style={{ borderTop: '2px solid #06b6d4' }}>
                  <span className="text-sm font-semibold text-white">Video Consultation</span>
                  <button onClick={() => setShowVideo(false)} className="p-1 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {(appointment as any)?.dailyco_meeting_url ? (
                    <DailyMeetingEmbed
                      appointment={appointment as any}
                      currentUser={currentUser as any}
                      patientName={patientName}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                      No video meeting configured.
                    </div>
                  )}
                </div>
              </div>
            )}
          </RGL>
          </div>
        )}
      </div>

      {/* ═══ OVERLAY PANELS (EHR panels from toolbar) ═══ */}
      {Array.from(openOverlays).map(panelId => {
        const pid = patientId || ''
        const aid = appointmentId || ''
        const pname = patientName || 'Patient'
        const close = () => closeOverlay(panelId)

        const PANEL_MAP: Record<string, React.ReactNode> = {
          'medication-history': <MedicationHistoryPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'orders': <OrdersPanelV2 isOpen patientId={pid} patientName={pname} appointmentId={aid} onClose={close} />,
          'prescription-history': <PrescriptionHistoryPanelV2 isOpen patientId={pid} patientName={pname} appointmentId={aid} onClose={close} />,
          'appointments': <AppointmentsOverlayPanel isOpen patientName={pname} appointments={[]} onClose={close} onViewAppointment={() => {}} />,
          'allergies': <AllergiesPanelV2 isOpen patientId={pid} patientName={pname} onClose={close} />,
          'vitals': <VitalsPanelV2 isOpen patientId={pid} patientName={pname} appointmentId={aid} onClose={close} />,
          'medications': <MedicationsPanelV2 isOpen patientId={pid} patientName={pname} onClose={close} />,
          'demographics': <DemographicsPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'problems': <ProblemsPanelV2 isOpen patientId={pid} patientName={pname} onClose={close} />,
          'clinical-notes': <ClinicalNotesPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'lab-results-panel': <LabResultsPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'immunizations': <ImmunizationsPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'documents': <DocumentsPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'family-history': <FamilyHistoryPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'social-history': <SocialHistoryPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'surgical-history': <SurgicalHistoryPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'pharmacy': <PharmacyPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'care-plans': <CarePlansPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'billing': <BillingPanel isOpen patientId={pid} patientName={pname} onClose={close} />,
          'comm-hub': <UnifiedCommHub isOpen patientId={pid} patientName={pname} appointmentId={aid} onClose={close} />,
          'chart-management': <ChartManagementPanel
            isOpen onClose={close} appointmentId={aid}
            chartStatus={chart.chartStatus as any} chartSignedAt={chart.chartSignedAt} chartSignedBy={chart.chartSignedBy}
            chartClosedAt={chart.chartClosedAt} chartClosedBy={chart.chartClosedBy}
            clinicalNotePdfUrl={chart.clinicalNotePdfUrl}
            addendums={chart.addendums}
            currentUserName={currentUser?.email || 'Provider'}
            chartActionLoading={chart.chartActionLoading}
            onChartStatusChange={() => {}}
            onSetChartStatus={chart.setChartStatus as any}
            onSetChartLocked={chart.setChartLocked}
            onSetChartSignedAt={() => {}}
            onSetChartSignedBy={() => {}}
            onSetChartClosedAt={() => {}}
            onSetChartClosedBy={() => {}}
            onSetClinicalNotePdfUrl={() => {}}
            onSetAddendums={() => {}}
            onSetAppointment={() => {}}
            onSetError={(msg: string) => setError(msg)}
            onSetChartActionLoading={() => {}}
          />,
          'drchrono-erx': prescriptions ? <ErxComposer {...prescriptions as any} onClose={close} /> : null,





















        }

        const content = PANEL_MAP[panelId]
        if (!content) return null

        return (
          <div key={panelId} className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
            <div className="absolute inset-0 bg-black/50" onClick={close} />
            <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto z-10">
              <button onClick={close} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white z-20">
                <X className="h-5 w-5" />
              </button>
              {content}
            </div>
          </div>
        )
      })}

      {/* Cancel Confirmation Dialog */}
      {actions.showCancelConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => actions.setShowCancelConfirm(false)} />
          <div className="relative bg-[#0d2626] border border-red-500/30 rounded-xl p-6 max-w-md z-10">
            <h3 className="text-white font-bold text-lg mb-2">Cancel Appointment?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => actions.setShowCancelConfirm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Keep</button>
              <button onClick={() => actions.handleCancel()} disabled={actions.cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50">
                {actions.cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Dialog */}
      {chart.showUnlockDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => chart.setShowUnlockDialog(false)} />
          <div className="relative bg-[#0d2626] border border-amber-500/30 rounded-xl p-6 max-w-md z-10">
            <h3 className="text-white font-bold text-lg mb-2">Unlock Chart</h3>
            <p className="text-gray-400 text-sm mb-3">HIPAA requires a reason for unlocking.</p>
            <textarea value={chart.unlockReason} onChange={(e) => chart.setUnlockReason(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm mb-4 min-h-[80px]"
              placeholder="Reason..." />
            <div className="flex gap-3 justify-end">
              <button onClick={() => chart.setShowUnlockDialog(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={() => chart.unlockChart(chart.unlockReason)}
                disabled={!chart.unlockReason.trim() || chart.chartActionLoading === 'unlock'}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm disabled:opacity-50">
                {chart.chartActionLoading === 'unlock' ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
