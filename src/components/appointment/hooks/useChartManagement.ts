// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Addendum {
  id: string
  text: string
  addendum_type?: string
  reason?: string
  created_at: string
  created_by: string
  created_by_name?: string
  created_by_role?: string
}

interface AuditEntry {
  id: string
  action: string
  performed_by_name: string
  performed_by_role: string
  reason?: string
  details?: any
  created_at: string
}

interface ChartState {
  chartLocked: boolean
  chartStatus: 'draft' | 'preliminary' | 'signed' | 'closed' | 'amended'
  chartSignedAt: string | null
  chartSignedBy: string | null
  chartClosedAt: string | null
  chartClosedBy: string | null
  clinicalNotePdfUrl: string | null
  addendums: Addendum[]
  auditEntries: AuditEntry[]
  addendumText: string
  addendumType: 'addendum' | 'late_entry' | 'correction'
  addendumReason: string
  showAddendumForm: boolean
  savingAddendum: boolean
  showPdfViewer: boolean
  showAuditTrail: boolean
  unlockReason: string
  showUnlockDialog: boolean
  chartActionLoading: string | null
}

export function useChartManagement(appointmentId: string | null, currentUserEmail?: string) {
  const [chartLocked, setChartLocked] = useState(false)
  const [chartStatus, setChartStatus] = useState<ChartState['chartStatus']>('draft')
  const [chartSignedAt, setChartSignedAt] = useState<string | null>(null)
  const [chartSignedBy, setChartSignedBy] = useState<string | null>(null)
  const [chartClosedAt, setChartClosedAt] = useState<string | null>(null)
  const [chartClosedBy, setChartClosedBy] = useState<string | null>(null)
  const [clinicalNotePdfUrl, setClinicalNotePdfUrl] = useState<string | null>(null)
  const [addendums, setAddendums] = useState<Addendum[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [addendumText, setAddendumText] = useState('')
  const [addendumType, setAddendumType] = useState<ChartState['addendumType']>('addendum')
  const [addendumReason, setAddendumReason] = useState('')
  const [showAddendumForm, setShowAddendumForm] = useState(false)
  const [savingAddendum, setSavingAddendum] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [chartActionLoading, setChartActionLoading] = useState<string | null>(null)

  // Sync from appointment data
  const syncFromAppointment = useCallback((appointment: any) => {
    if (!appointment) return
    const locked = appointment.chart_locked ?? false
    const status = appointment.chart_status ?? 'draft'
    setChartLocked(locked)
    setChartStatus(status)
    setChartSignedAt(appointment.chart_signed_at ?? null)
    setChartSignedBy(appointment.chart_signed_by ?? null)
    setChartClosedAt(appointment.chart_closed_at ?? null)
    setChartClosedBy(appointment.chart_closed_by ?? null)
    setClinicalNotePdfUrl(appointment.clinical_note_pdf_url ?? null)
    if (appointment.addendums) {
      setAddendums(appointment.addendums)
    }
  }, [])

  // Sign chart
  const signChart = useCallback(async () => {
    if (!appointmentId) return
    setChartActionLoading('sign')
    try {
      console.log('[Chart] Signing chart for appointment:', appointmentId)
      const res = await fetch('/api/chart/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sign chart')
      setChartStatus('signed')
      setChartLocked(true)
      setChartSignedAt(new Date().toISOString())
      setChartSignedBy(currentUserEmail || 'Provider')
      console.log('[Chart] Chart signed successfully')
    } catch (err: any) {
      console.error('[Chart] Sign error:', err)
      throw err
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId, currentUserEmail])

  // Close chart (generates PDF)
  const closeChart = useCallback(async () => {
    if (!appointmentId) return
    setChartActionLoading('close')
    try {
      console.log('[Chart] Closing chart for appointment:', appointmentId)
      const res = await fetch('/api/chart/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close chart')
      setChartStatus('closed')
      setChartClosedAt(new Date().toISOString())
      setChartClosedBy(currentUserEmail || 'Provider')
      if (data.pdfUrl) setClinicalNotePdfUrl(data.pdfUrl)
      console.log('[Chart] Chart closed successfully')
    } catch (err: any) {
      console.error('[Chart] Close error:', err)
      throw err
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId, currentUserEmail])

  // Unlock chart
  const unlockChart = useCallback(async (reason: string) => {
    if (!appointmentId || !reason.trim()) return
    setChartActionLoading('unlock')
    try {
      console.log('[Chart] Unlocking chart for appointment:', appointmentId)
      const res = await fetch('/api/chart/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to unlock chart')
      setChartStatus('draft')
      setChartLocked(false)
      setShowUnlockDialog(false)
      setUnlockReason('')
      console.log('[Chart] Chart unlocked successfully')
    } catch (err: any) {
      console.error('[Chart] Unlock error:', err)
      throw err
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId])

  // Save addendum
  const saveAddendum = useCallback(async () => {
    if (!appointmentId || !addendumText.trim()) return
    setSavingAddendum(true)
    try {
      console.log('[Chart] Saving addendum for appointment:', appointmentId)
      const res = await fetch('/api/chart/addendum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          text: addendumText,
          addendumType,
          reason: addendumReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save addendum')
      setChartStatus('amended')
      if (data.addendum) {
        setAddendums(prev => [...prev, data.addendum])
      }
      setAddendumText('')
      setAddendumReason('')
      setShowAddendumForm(false)
      if (data.pdfUrl) setClinicalNotePdfUrl(data.pdfUrl)
      console.log('[Chart] Addendum saved successfully')
    } catch (err: any) {
      console.error('[Chart] Addendum error:', err)
      throw err
    } finally {
      setSavingAddendum(false)
    }
  }, [appointmentId, addendumText, addendumType, addendumReason])

  // Fetch audit trail
  const fetchAuditTrail = useCallback(async () => {
    if (!appointmentId) return
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        console.error('[Chart] Audit fetch error:', error)
        return
      }
      setAuditEntries((data || []).map((entry: any) => ({
        id: entry.id?.toString() || '',
        action: entry.action || entry.event_type || '',
        performed_by_name: entry.user_email || 'Unknown',
        performed_by_role: entry.user_role || 'provider',
        reason: entry.details?.reason,
        details: entry.details,
        created_at: entry.created_at,
      })))
    } catch (err) {
      console.error('[Chart] Audit fetch error:', err)
    }
  }, [appointmentId])

  // View PDF
  const viewPdf = useCallback(async () => {
    if (!appointmentId) return
    setChartActionLoading('pdf')
    try {
      const res = await fetch('/api/chart/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate PDF')
      if (data.pdfUrl) {
        setClinicalNotePdfUrl(data.pdfUrl)
        setShowPdfViewer(true)
      }
    } catch (err: any) {
      console.error('[Chart] PDF error:', err)
      throw err
    } finally {
      setChartActionLoading(null)
    }
  }, [appointmentId])

  return {
    // State
    chartLocked, chartStatus, chartSignedAt, chartSignedBy,
    chartClosedAt, chartClosedBy, clinicalNotePdfUrl,
    addendums, auditEntries,
    addendumText, setAddendumText,
    addendumType, setAddendumType,
    addendumReason, setAddendumReason,
    showAddendumForm, setShowAddendumForm,
    savingAddendum,
    showPdfViewer, setShowPdfViewer,
    showAuditTrail, setShowAuditTrail,
    unlockReason, setUnlockReason,
    showUnlockDialog, setShowUnlockDialog,
    chartActionLoading,
    // Actions
    syncFromAppointment,
    signChart, closeChart, unlockChart,
    saveAddendum, fetchAuditTrail, viewPdf,
    // Manual overrides
    setChartStatus, setChartLocked,
  }
}
