'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { CHART_STATUS_CONFIG } from '@/lib/constants'
import type { ChartStatus } from '@/lib/constants'
import {
  Shield, FileText, Clock, AlertTriangle, CheckCircle, Lock,
  RefreshCw, Search, ChevronRight, Edit3, Filter, Pen,
  X, FileSignature, CheckSquare, Square, Download,
  BarChart3, Users, AlertCircle, Eye, History,
  Unlock, UserCheck, GitBranch
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ChartRecord {
  id: string
  patient_id: string
  doctor_id: string
  status: string
  visit_type: string
  chart_status: string | null
  chart_locked: boolean | null
  chart_signed_at: string | null
  chart_signed_by: string | null
  chart_closed_at: string | null
  chart_closed_by: string | null
  clinical_note_pdf_url: string | null
  scheduled_time: string | null
  created_at: string
  updated_at: string | null
  // Cosign / supervising
  cosigned_by: string | null
  cosigned_at: string | null
  needs_cosign: boolean | null
  patients: {
    first_name: string
    last_name: string
    email: string
  } | null
  clinical_notes: {
    id: string
    note_type: string
    content: any
    created_at: string
    updated_at: string | null
  }[] | null
}

interface AuditEntry {
  id: string
  appointment_id: string
  action: string
  performed_by_name: string
  performed_by_role: string
  reason: string | null
  details: any
  created_at: string
}

type ChartFilter = 'all' | 'draft' | 'preliminary' | 'signed' | 'closed' | 'amended' | 'overdue' | 'unsigned' | 'needs_cosign'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function deriveChartStatus(record: ChartRecord): ChartStatus {
  if (record.chart_status) {
    const s = record.chart_status as ChartStatus
    if (['draft', 'preliminary', 'signed', 'closed', 'amended'].includes(s)) return s
  }
  if (record.chart_locked) return 'closed'
  if (record.status === 'completed') return 'signed'
  return 'draft'
}

function isOverdue(record: ChartRecord): boolean {
  if (record.chart_locked) return false
  if (record.status !== 'completed') return false
  const cs = deriveChartStatus(record)
  if (cs === 'closed' || cs === 'amended') return false
  const completedAt = record.updated_at || record.scheduled_time || record.created_at
  const hoursAgo = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60)
  return hoursAgo > 24
}

function formatTimeAgo(dateStr: string): string {
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ChartManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<ChartRecord[]>([])
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [filter, setFilter] = useState<ChartFilter>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Action states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modals
  const [signModal, setSignModal] = useState<ChartRecord | null>(null)
  const [addendumModal, setAddendumModal] = useState<ChartRecord | null>(null)
  const [auditModal, setAuditModal] = useState<ChartRecord | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [unlockModal, setUnlockModal] = useState<ChartRecord | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [timelineModal, setTimelineModal] = useState<ChartRecord | null>(null)
  const [timelineEntries, setTimelineEntries] = useState<AuditEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Addendum form
  const [addendumText, setAddendumText] = useState('')
  const [addendumType, setAddendumType] = useState<'addendum' | 'late_entry' | 'correction'>('addendum')
  const [addendumReason, setAddendumReason] = useState('')

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  // ── Auth + Fetch ──
  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        setDoctorName(`Dr. ${authUser.doctor.first_name || ''} ${authUser.doctor.last_name || ''}`.trim())
        await fetchRecords(authUser.doctor.id)
      } catch (err) {
        console.error('Chart management init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const fetchRecords = async (docId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, doctor_id, status, visit_type,
        chart_status, chart_locked, chart_signed_at, chart_signed_by,
        chart_closed_at, chart_closed_by, clinical_note_pdf_url,
        cosigned_by, cosigned_at, needs_cosign,
        scheduled_time, created_at, updated_at,
        patients!appointments_patient_id_fkey(first_name, last_name, email),
        clinical_notes(id, note_type, content, created_at, updated_at)
      `)
      .eq('doctor_id', docId)
      .neq('status', 'cancelled')
      .order('scheduled_time', { ascending: false })
      .limit(500)
    if (error) console.error('Chart fetch error:', error)
    else setRecords((data || []) as unknown as ChartRecord[])
  }

  const handleRefresh = useCallback(async () => {
    if (!doctorId || refreshing) return
    setRefreshing(true)
    await fetchRecords(doctorId)
    setRefreshing(false)
  }, [doctorId, refreshing])

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════

  const handleSign = async (record: ChartRecord) => {
    setActionLoading(record.id)
    try {
      const res = await fetch('/api/chart/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: record.id, providerName: doctorName, providerRole: 'provider' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sign failed')
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, chart_status: 'signed', chart_signed_at: data.signed_at, chart_signed_by: doctorName, chart_locked: true } : r))
      showNotification('success', `Chart signed for ${record.patients?.first_name || 'patient'}`)
      setSignModal(null)
    } catch (err: any) {
      showNotification('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleClose = async (record: ChartRecord) => {
    setActionLoading(record.id)
    try {
      const res = await fetch('/api/chart/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: record.id, providerName: doctorName, providerRole: 'provider' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Close failed')
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, chart_status: 'closed', chart_closed_at: data.closed_at, chart_closed_by: doctorName, chart_locked: true, clinical_note_pdf_url: data.pdf_url } : r))
      showNotification('success', `Chart closed & PDF generated`)
    } catch (err: any) {
      showNotification('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddendum = async () => {
    if (!addendumModal || !addendumText.trim()) return
    setActionLoading(addendumModal.id)
    try {
      const res = await fetch('/api/chart/addendum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: addendumModal.id, text: addendumText.trim(),
          addendumType, reason: addendumReason.trim() || undefined,
          authorName: doctorName, authorRole: 'provider',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Addendum failed')
      setRecords(prev => prev.map(r => r.id === addendumModal.id ? { ...r, chart_status: 'amended', clinical_note_pdf_url: data.pdf_url || r.clinical_note_pdf_url } : r))
      showNotification('success', 'Addendum added to chart')
      setAddendumModal(null)
      setAddendumText('')
      setAddendumReason('')
      setAddendumType('addendum')
    } catch (err: any) {
      showNotification('error', err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkSign = async () => {
    const signable = filtered.filter(r => selectedIds.has(r.id) && deriveChartStatus(r) === 'draft')
    if (signable.length === 0) { showNotification('error', 'No draft charts selected'); return }
    setBulkLoading(true)
    let success = 0, failed = 0
    for (const record of signable) {
      try {
        const res = await fetch('/api/chart/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: record.id, providerName: doctorName, providerRole: 'provider' }),
        })
        if (res.ok) {
          success++
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, chart_status: 'signed', chart_signed_at: new Date().toISOString(), chart_signed_by: doctorName, chart_locked: true } : r))
        } else { failed++ }
      } catch { failed++ }
    }
    setSelectedIds(new Set())
    setBulkLoading(false)
    showNotification(failed === 0 ? 'success' : 'error', `Bulk sign: ${success} signed${failed > 0 ? `, ${failed} failed` : ''}`)
  }

  const handleViewAudit = async (record: ChartRecord) => {
    setAuditModal(record)
    setAuditLoading(true)
    try {
      const { data } = await supabase.from('chart_audit_log').select('*').eq('appointment_id', record.id).order('created_at', { ascending: false })
      setAuditEntries((data || []) as AuditEntry[])
    } catch (err) { console.error('Audit fetch error:', err) }
    finally { setAuditLoading(false) }
  }

  // ── Unlock/Reopen Chart ──
  const handleUnlock = async () => {
    if (!unlockModal || !unlockReason.trim()) return
    setActionLoading(unlockModal.id)
    try {
      const res = await fetch('/api/chart/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: unlockModal.id, providerName: doctorName, providerRole: 'provider', reason: unlockReason.trim(), forceReset: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unlock failed')
      setRecords(prev => prev.map(r => r.id === unlockModal.id ? { ...r, chart_status: 'draft', chart_locked: false } : r))
      showNotification('success', 'Chart unlocked and returned to draft')
      setUnlockModal(null)
      setUnlockReason('')
    } catch (err: any) { showNotification('error', err.message) }
    finally { setActionLoading(null) }
  }

  // ── Cosign (supervising provider signs off) ──
  const handleCosign = async (record: ChartRecord) => {
    setActionLoading(record.id)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('appointments').update({ cosigned_by: doctorName, cosigned_at: now, needs_cosign: false }).eq('id', record.id)
      if (error) throw new Error(error.message)
      // Audit log
      await supabase.from('chart_audit_log').insert({ appointment_id: record.id, action: 'cosigned', performed_by_name: doctorName, performed_by_role: 'provider', details: { cosigned_at: now } })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, cosigned_by: doctorName, cosigned_at: now, needs_cosign: false } : r))
      showNotification('success', `Chart co-signed for ${record.patients?.first_name || 'patient'}`)
    } catch (err: any) { showNotification('error', err.message) }
    finally { setActionLoading(null) }
  }

  // ── Bulk Close ──
  const handleBulkClose = async () => {
    const closeable = filtered.filter(r => selectedIds.has(r.id) && deriveChartStatus(r) === 'signed')
    if (closeable.length === 0) { showNotification('error', 'No signed charts selected'); return }
    setBulkLoading(true)
    let success = 0, failed = 0
    for (const record of closeable) {
      try {
        const res = await fetch('/api/chart/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: record.id, providerName: doctorName, providerRole: 'provider' }),
        })
        if (res.ok) {
          success++
          const data = await res.json()
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, chart_status: 'closed', chart_closed_at: new Date().toISOString(), chart_closed_by: doctorName, chart_locked: true, clinical_note_pdf_url: data.pdf_url } : r))
        } else { failed++ }
      } catch { failed++ }
    }
    setSelectedIds(new Set())
    setBulkLoading(false)
    showNotification(failed === 0 ? 'success' : 'error', `Bulk close: ${success} closed${failed > 0 ? `, ${failed} failed` : ''}`)
  }

  // ── View Timeline ──
  const handleViewTimeline = async (record: ChartRecord) => {
    setTimelineModal(record)
    setTimelineLoading(true)
    try {
      const { data } = await supabase.from('chart_audit_log').select('*').eq('appointment_id', record.id).order('created_at', { ascending: true })
      setTimelineEntries((data || []) as AuditEntry[])
    } catch (err) { console.error('Timeline fetch error:', err) }
    finally { setTimelineLoading(false) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(r => r.id)))
  }

  // ── Computed ──
  const counts = useMemo(() => {
    const c = { draft: 0, preliminary: 0, signed: 0, closed: 0, amended: 0, overdue: 0, unsigned: 0, needs_cosign: 0 }
    records.forEach(r => { const cs = deriveChartStatus(r); c[cs]++; if (isOverdue(r)) c.overdue++; if (cs === 'draft' || cs === 'preliminary') c.unsigned++; if (r.needs_cosign) c.needs_cosign++ })
    return c
  }, [records])

  const filtered = useMemo(() => {
    let list = records
    if (filter === 'overdue') list = list.filter(isOverdue)
    else if (filter === 'unsigned') list = list.filter(r => { const cs = deriveChartStatus(r); return cs === 'draft' || cs === 'preliminary' })
    else if (filter === 'needs_cosign') list = list.filter(r => r.needs_cosign)
    else if (filter !== 'all') list = list.filter(r => deriveChartStatus(r) === filter)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(r => `${r.patients?.first_name || ''} ${r.patients?.last_name || ''}`.toLowerCase().includes(q)) }
    return list
  }, [records, filter, search])

  const metrics = useMemo(() => {
    const completed = records.filter(r => r.status === 'completed')
    const signed = records.filter(r => deriveChartStatus(r) !== 'draft' && r.chart_signed_at)
    const avgSignTimeHrs = signed.length > 0
      ? signed.reduce((sum, r) => sum + (new Date(r.chart_signed_at!).getTime() - new Date(r.scheduled_time || r.created_at).getTime()) / 3600000, 0) / signed.length
      : 0
    const closedOrAmended = records.filter(r => deriveChartStatus(r) === 'closed' || deriveChartStatus(r) === 'amended').length
    const complianceRate = completed.length > 0 ? Math.round((closedOrAmended / completed.length) * 100) : 100
    return { avgSignTimeHrs: Math.round(avgSignTimeHrs * 10) / 10, complianceRate, totalCompleted: completed.length, totalSigned: signed.length }
  }, [records])

  if (loading) return <div className="h-full bg-[#0a1f1f] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" /></div>

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center"><Shield className="w-5 h-5 text-purple-400" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">Chart Management</h1>
              <p className="text-xs text-gray-400">Sign, close, amend charts &bull; Audit trail &bull; Compliance</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedIds.size > 0 && (<>
              <button onClick={handleBulkSign} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center space-x-1.5">
                {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSignature className="w-3 h-3" />}
                <span>Bulk Sign ({selectedIds.size})</span>
              </button>
              <button onClick={handleBulkClose} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center space-x-1.5">
                {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                <span>Bulk Close</span>
              </button>
            </>)}
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: BarChart3, color: 'text-teal-400', label: 'Avg Sign Time', value: `${metrics.avgSignTimeHrs}h` },
            { icon: CheckCircle, color: metrics.complianceRate >= 90 ? 'text-green-400' : metrics.complianceRate >= 70 ? 'text-amber-400' : 'text-red-400', label: 'Compliance', value: `${metrics.complianceRate}%` },
            { icon: Users, color: 'text-blue-400', label: 'Completed', value: String(metrics.totalCompleted) },
            { icon: FileSignature, color: 'text-purple-400', label: 'Signed', value: String(metrics.totalSigned) },
          ].map(({ icon: Icon, color, label, value }, i) => (
            <div key={i} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d]">
              <div className="flex items-center space-x-2 mb-1"><Icon className={`w-3.5 h-3.5 ${color}`} /><span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</span></div>
              <p className={`text-lg font-bold ${color === 'text-teal-400' || color === 'text-blue-400' || color === 'text-purple-400' ? 'text-white' : color}`}>{value}</p>
            </div>
          ))}
        </div>


        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {([
            { key: 'draft' as ChartFilter, label: 'Draft', icon: FileText, color: 'text-gray-400', count: counts.draft },
            { key: 'preliminary' as ChartFilter, label: 'Preliminary', icon: Clock, color: 'text-amber-400', count: counts.preliminary },
            { key: 'signed' as ChartFilter, label: 'Signed', icon: CheckCircle, color: 'text-green-400', count: counts.signed },
            { key: 'closed' as ChartFilter, label: 'Closed', icon: Lock, color: 'text-blue-400', count: counts.closed },
            { key: 'amended' as ChartFilter, label: 'Amended', icon: Edit3, color: 'text-purple-400', count: counts.amended },
          ]).map(({ key, label, icon: Icon, color, count }) => (
            <button key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`bg-[#0d2626] rounded-lg p-4 border transition-all text-left ${filter === key ? 'border-teal-500/50 ring-1 ring-teal-500/20' : 'border-[#1a3d3d] hover:border-[#2a5d5d]'}`}>
              <div className="flex items-center space-x-2 mb-2"><Icon className={`w-4 h-4 ${color}`} /><span className={`text-[10px] uppercase tracking-widest font-bold ${color}`}>{label}</span></div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </button>
          ))}
        </div>

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
            className={`bg-[#0d2626] rounded-lg p-4 border transition-all flex items-center justify-between ${filter === 'overdue' ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-[#1a3d3d] hover:border-red-500/30'}`}>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-red-500/15 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-400" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">Overdue Charts</p><p className="text-[10px] text-gray-500">Unsigned &gt; 24 hours after completion</p></div>
            </div>
            <span className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-red-400' : 'text-green-400'}`}>{counts.overdue > 0 ? counts.overdue : '✓'}</span>
          </button>
          <button onClick={() => setFilter(filter === 'unsigned' ? 'all' : 'unsigned')}
            className={`bg-[#0d2626] rounded-lg p-4 border transition-all flex items-center justify-between ${filter === 'unsigned' ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-[#1a3d3d] hover:border-amber-500/30'}`}>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center"><FileText className="w-4 h-4 text-amber-400" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">Unsigned Notes</p><p className="text-[10px] text-gray-500">Draft + Preliminary needing attention</p></div>
            </div>
            <span className={`text-2xl font-bold ${counts.unsigned > 0 ? 'text-amber-400' : 'text-green-400'}`}>{counts.unsigned > 0 ? counts.unsigned : '✓'}</span>
          </button>
          <button onClick={() => setFilter(filter === 'needs_cosign' ? 'all' : 'needs_cosign')}
            className={`bg-[#0d2626] rounded-lg p-4 border transition-all flex items-center justify-between ${filter === 'needs_cosign' ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-[#1a3d3d] hover:border-cyan-500/30'}`}>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-cyan-500/15 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-cyan-400" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">Needs Co-sign</p><p className="text-[10px] text-gray-500">Awaiting supervising provider sign-off</p></div>
            </div>
            <span className={`text-2xl font-bold ${counts.needs_cosign > 0 ? 'text-cyan-400' : 'text-green-400'}`}>{counts.needs_cosign > 0 ? counts.needs_cosign : '✓'}</span>
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient name..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
          </div>
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400 font-medium">{filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
            {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold ml-1">Clear</button>}
          </div>
        </div>

        {/* Chart Records Table */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-[#1a3d3d] bg-[#0a1f1f]/50 text-[10px] uppercase tracking-widest font-bold text-gray-500">
            <div className="col-span-1 flex items-center">
              <button onClick={toggleSelectAll} className="text-gray-500 hover:text-teal-400">
                {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="col-span-2">Patient</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Notes</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center"><Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500">{filter === 'all' ? 'No charts found' : `No ${filter} charts`}</p></div>
          ) : (
            <div className="divide-y divide-[#1a3d3d]/50 max-h-[50vh] overflow-y-auto">
              {filtered.map(record => {
                const cs = deriveChartStatus(record)
                const config = CHART_STATUS_CONFIG[cs]
                const overdue = isOverdue(record)
                const noteCount = record.clinical_notes?.length || 0
                const patientName = `${record.patients?.first_name || ''} ${record.patients?.last_name || ''}`.trim() || 'Unknown'
                const dateStr = record.scheduled_time ? new Date(record.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                const isActing = actionLoading === record.id
                const isSelected = selectedIds.has(record.id)

                return (
                  <div key={record.id} className={`transition-colors hover:bg-white/[0.02] ${overdue ? 'bg-red-500/[0.03]' : ''} ${isSelected ? 'bg-teal-500/[0.05]' : ''}`}
                    style={{ borderLeft: `3px solid ${config.color}` }}>
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-1">
                        <button onClick={() => toggleSelect(record.id)} className="text-gray-500 hover:text-teal-400">
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-teal-400" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{patientName}</p>
                        {overdue && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-bold">OVERDUE</span>}
                      </div>
                      <div className="col-span-1"><p className="text-xs text-gray-300">{dateStr}</p></div>
                      <div className="col-span-1"><span className="text-xs text-gray-400 capitalize">{record.visit_type || '—'}</span></div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${config.color}20`, color: config.color }}>{config.icon} {cs}</span>
                        {record.chart_signed_by && <p className="text-[9px] text-gray-500 mt-0.5">by {record.chart_signed_by}</p>}
                        {record.cosigned_by && <p className="text-[9px] text-cyan-500 mt-0.5">✓ co-signed: {record.cosigned_by}</p>}
                        {record.needs_cosign && !record.cosigned_by && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 rounded font-bold">NEEDS CO-SIGN</span>}
                      </div>
                      <div className="col-span-1"><span className="text-xs text-gray-400">{noteCount} note{noteCount !== 1 ? 's' : ''}</span></div>
                      <div className="col-span-4 flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                        {cs === 'draft' && (
                          <button onClick={() => setSignModal(record)} disabled={isActing} className="px-2 py-1 rounded text-[10px] font-bold bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors disabled:opacity-50 flex items-center space-x-1">
                            <Pen className="w-3 h-3" /><span>Sign</span>
                          </button>
                        )}
                        {cs === 'signed' && (
                          <button onClick={() => handleClose(record)} disabled={isActing} className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors disabled:opacity-50 flex items-center space-x-1">
                            {isActing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}<span>Close</span>
                          </button>
                        )}
                        {(cs === 'closed' || cs === 'amended') && (
                          <button onClick={() => setAddendumModal(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 transition-colors flex items-center space-x-1">
                            <Edit3 className="w-3 h-3" /><span>Addendum</span>
                          </button>
                        )}
                        {record.needs_cosign && (
                          <button onClick={() => handleCosign(record)} disabled={isActing} className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 transition-colors disabled:opacity-50 flex items-center space-x-1">
                            <UserCheck className="w-3 h-3" /><span>Co-sign</span>
                          </button>
                        )}
                        {(cs === 'signed' || cs === 'closed' || cs === 'amended') && (
                          <button onClick={() => setUnlockModal(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors flex items-center space-x-1">
                            <Unlock className="w-3 h-3" /><span>Unlock</span>
                          </button>
                        )}
                        {record.clinical_note_pdf_url && (
                          <a href={record.clinical_note_pdf_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-[10px] font-bold bg-teal-600/20 text-teal-400 hover:bg-teal-600/40 transition-colors flex items-center space-x-1">
                            <Download className="w-3 h-3" /><span>PDF</span>
                          </a>
                        )}
                        <button onClick={() => handleViewTimeline(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 transition-colors flex items-center space-x-1">
                          <GitBranch className="w-3 h-3" /><span>Timeline</span>
                        </button>
                        <button onClick={() => handleViewAudit(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-gray-600/20 text-gray-400 hover:bg-gray-600/40 transition-colors flex items-center space-x-1">
                          <History className="w-3 h-3" /><span>Audit</span>
                        </button>
                        <button onClick={() => router.push(`/doctor/appointments?apt=${record.id}`)} className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => toggleSelect(record.id)}>{isSelected ? <CheckSquare className="w-3.5 h-3.5 text-teal-400" /> : <Square className="w-3.5 h-3.5 text-gray-500" />}</button>
                          <p className="text-sm font-bold text-white truncate">{patientName}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${config.color}20`, color: config.color }}>{config.icon} {cs}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cs === 'draft' && <button onClick={() => setSignModal(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-green-600/20 text-green-400">Sign</button>}
                        {cs === 'signed' && <button onClick={() => handleClose(record)} disabled={isActing} className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400">Close</button>}
                        {(cs === 'closed' || cs === 'amended') && <button onClick={() => setAddendumModal(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-purple-600/20 text-purple-400">Addendum</button>}
                        {record.needs_cosign && <button onClick={() => handleCosign(record)} disabled={isActing} className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-400">Co-sign</button>}
                        {(cs === 'signed' || cs === 'closed' || cs === 'amended') && <button onClick={() => setUnlockModal(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-amber-600/20 text-amber-400">Unlock</button>}
                        <button onClick={() => handleViewTimeline(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-indigo-600/20 text-indigo-400">Timeline</button>
                        <button onClick={() => handleViewAudit(record)} className="px-2 py-1 rounded text-[10px] font-bold bg-gray-600/20 text-gray-400">Audit</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
          <span>Showing {filtered.length} of {records.length} charts</span>
          <span>Last refreshed: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ═══ SIGN MODAL ═══ */}
      {signModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2"><FileSignature className="w-5 h-5 text-green-400" /><span>E-Sign Chart</span></h3>
              <button onClick={() => setSignModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#0a1f1f] rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-300">Patient: <span className="text-white font-bold">{signModal.patients?.first_name} {signModal.patients?.last_name}</span></p>
              <p className="text-sm text-gray-300">Date: <span className="text-white">{signModal.scheduled_time ? new Date(signModal.scheduled_time).toLocaleDateString() : 'N/A'}</span></p>
              <p className="text-sm text-gray-300">Type: <span className="text-white capitalize">{signModal.visit_type || 'N/A'}</span></p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-300">By signing, you confirm that you have reviewed the clinical notes and that the information is accurate and complete. This action creates a permanent audit trail entry.</p>
            </div>
            <div className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
              <p className="text-xs text-gray-500 mb-1">Electronic Signature</p>
              <p className="text-sm text-white font-bold">{doctorName}</p>
              <p className="text-[10px] text-gray-500">{new Date().toLocaleString()}</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setSignModal(null)} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white hover:border-[#2a5d5d] text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => handleSign(signModal)} disabled={actionLoading === signModal.id}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                {actionLoading === signModal.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Pen className="w-4 h-4" /><span>Sign Chart</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADDENDUM MODAL ═══ */}
      {addendumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2"><Edit3 className="w-5 h-5 text-purple-400" /><span>Add Addendum</span></h3>
              <button onClick={() => { setAddendumModal(null); setAddendumText(''); setAddendumReason('') }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#0a1f1f] rounded-lg p-3">
              <p className="text-sm text-gray-300">Patient: <span className="text-white font-bold">{addendumModal.patients?.first_name} {addendumModal.patients?.last_name}</span></p>
            </div>
            {/* Type selector */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Addendum Type</label>
              <div className="flex space-x-2">
                {(['addendum', 'late_entry', 'correction'] as const).map(t => (
                  <button key={t} onClick={() => setAddendumType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${addendumType === t ? 'bg-purple-600 text-white' : 'bg-[#0a1f1f] text-gray-400 border border-[#1a3d3d] hover:border-purple-500/50'}`}>
                    {t === 'late_entry' ? 'Late Entry' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {/* Reason (required for corrections) */}
            {addendumType === 'correction' && (
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">Reason for Correction <span className="text-red-400">*</span></label>
                <input type="text" value={addendumReason} onChange={e => setAddendumReason(e.target.value)} placeholder="Explain what is being corrected..."
                  className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" />
              </div>
            )}
            {/* Text */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Addendum Text <span className="text-red-400">*</span></label>
              <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} rows={5} placeholder="Enter addendum text..."
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none" />
              <p className="text-[10px] text-gray-500 mt-1">{addendumText.length} characters (min 3)</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => { setAddendumModal(null); setAddendumText(''); setAddendumReason('') }} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleAddendum} disabled={actionLoading === addendumModal.id || addendumText.trim().length < 3 || (addendumType === 'correction' && addendumReason.trim().length < 5)}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                {actionLoading === addendumModal.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Edit3 className="w-4 h-4" /><span>Add Addendum</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AUDIT TRAIL MODAL ═══ */}
      {auditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2"><History className="w-5 h-5 text-gray-400" /><span>Audit Trail</span></h3>
              <button onClick={() => setAuditModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-400">Patient: {auditModal.patients?.first_name} {auditModal.patients?.last_name}</p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {auditLoading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>
              ) : auditEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No audit entries found</div>
              ) : (
                auditEntries.map(entry => (
                  <div key={entry.id} className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        entry.action === 'signed' ? 'bg-green-500/20 text-green-400' :
                        entry.action === 'closed' ? 'bg-blue-500/20 text-blue-400' :
                        entry.action.includes('addendum') || entry.action.includes('correction') || entry.action.includes('late_entry') ? 'bg-purple-500/20 text-purple-400' :
                        entry.action === 'pdf_generated' ? 'bg-teal-500/20 text-teal-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{entry.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-300">By: <span className="text-white font-medium">{entry.performed_by_name}</span> <span className="text-gray-500">({entry.performed_by_role})</span></p>
                    {entry.reason && <p className="text-xs text-amber-400 mt-1">Reason: {entry.reason}</p>}
                    {entry.details && typeof entry.details === 'object' && entry.details.text_length && (
                      <p className="text-[10px] text-gray-500 mt-1">{entry.details.text_length} characters</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setAuditModal(null)} className="w-full py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Close</button>
          </div>
        </div>
      )}

      {/* ═══ UNLOCK MODAL ═══ */}
      {unlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2"><Unlock className="w-5 h-5 text-amber-400" /><span>Unlock Chart</span></h3>
              <button onClick={() => { setUnlockModal(null); setUnlockReason('') }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#0a1f1f] rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-300">Patient: <span className="text-white font-bold">{unlockModal.patients?.first_name} {unlockModal.patients?.last_name}</span></p>
              <p className="text-sm text-gray-300">Current Status: <span className="text-white font-bold capitalize">{deriveChartStatus(unlockModal)}</span></p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs text-red-300"><strong>Warning:</strong> Unlocking returns this chart to <strong>draft</strong> status. The existing PDF will remain in storage but the chart will need to be re-signed, re-closed, and a new PDF generated. This action is fully audited.</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Reason for Unlocking <span className="text-red-400">*</span></label>
              <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} rows={3} placeholder="Explain why this chart needs to be unlocked..."
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none" />
              <p className="text-[10px] text-gray-500 mt-1">{unlockReason.length} characters (min 5)</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => { setUnlockModal(null); setUnlockReason('') }} className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleUnlock} disabled={actionLoading === unlockModal.id || unlockReason.trim().length < 5}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                {actionLoading === unlockModal.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4" /><span>Unlock Chart</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TIMELINE MODAL ═══ */}
      {timelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2"><GitBranch className="w-5 h-5 text-indigo-400" /><span>Chart Lifecycle</span></h3>
              <button onClick={() => setTimelineModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#0a1f1f] rounded-lg p-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">Patient: <span className="text-white font-bold">{timelineModal.patients?.first_name} {timelineModal.patients?.last_name}</span></p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${CHART_STATUS_CONFIG[deriveChartStatus(timelineModal)].color}20`, color: CHART_STATUS_CONFIG[deriveChartStatus(timelineModal)].color }}>
                {deriveChartStatus(timelineModal)}
              </span>
            </div>

            {/* Built-in lifecycle events */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative pl-6 space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#1a3d3d]" />

                {/* Created */}
                <div className="relative pb-4">
                  <div className="absolute left-[-15px] w-5 h-5 rounded-full bg-gray-600 border-2 border-[#0d2626] flex items-center justify-center"><FileText className="w-2.5 h-2.5 text-white" /></div>
                  <p className="text-xs font-bold text-white">Chart Created</p>
                  <p className="text-[10px] text-gray-500">{new Date(timelineModal.created_at).toLocaleString()}</p>
                </div>

                {/* Signed */}
                {timelineModal.chart_signed_at && (
                  <div className="relative pb-4">
                    <div className="absolute left-[-15px] w-5 h-5 rounded-full bg-green-600 border-2 border-[#0d2626] flex items-center justify-center"><Pen className="w-2.5 h-2.5 text-white" /></div>
                    <p className="text-xs font-bold text-white">Signed</p>
                    <p className="text-[10px] text-gray-400">by {timelineModal.chart_signed_by}</p>
                    <p className="text-[10px] text-gray-500">{new Date(timelineModal.chart_signed_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Co-signed */}
                {timelineModal.cosigned_at && (
                  <div className="relative pb-4">
                    <div className="absolute left-[-15px] w-5 h-5 rounded-full bg-cyan-600 border-2 border-[#0d2626] flex items-center justify-center"><UserCheck className="w-2.5 h-2.5 text-white" /></div>
                    <p className="text-xs font-bold text-white">Co-signed</p>
                    <p className="text-[10px] text-gray-400">by {timelineModal.cosigned_by}</p>
                    <p className="text-[10px] text-gray-500">{new Date(timelineModal.cosigned_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Closed */}
                {timelineModal.chart_closed_at && (
                  <div className="relative pb-4">
                    <div className="absolute left-[-15px] w-5 h-5 rounded-full bg-blue-600 border-2 border-[#0d2626] flex items-center justify-center"><Lock className="w-2.5 h-2.5 text-white" /></div>
                    <p className="text-xs font-bold text-white">Closed & Locked</p>
                    <p className="text-[10px] text-gray-400">by {timelineModal.chart_closed_by} &bull; PDF generated</p>
                    <p className="text-[10px] text-gray-500">{new Date(timelineModal.chart_closed_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Audit entries */}
                {timelineLoading ? (
                  <div className="py-4 flex justify-center"><RefreshCw className="w-4 h-4 animate-spin text-gray-500" /></div>
                ) : (
                  timelineEntries.filter(e => !['signed', 'closed'].includes(e.action)).map(entry => (
                    <div key={entry.id} className="relative pb-4">
                      <div className={`absolute left-[-15px] w-5 h-5 rounded-full border-2 border-[#0d2626] flex items-center justify-center ${
                        entry.action.includes('addendum') || entry.action.includes('amended') ? 'bg-purple-600' :
                        entry.action.includes('unlock') ? 'bg-amber-600' :
                        entry.action.includes('cosign') ? 'bg-cyan-600' :
                        entry.action === 'pdf_generated' ? 'bg-teal-600' : 'bg-gray-600'
                      }`}><History className="w-2.5 h-2.5 text-white" /></div>
                      <p className="text-xs font-bold text-white capitalize">{entry.action.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-gray-400">by {entry.performed_by_name}</p>
                      {entry.reason && <p className="text-[10px] text-amber-400">Reason: {entry.reason}</p>}
                      <p className="text-[10px] text-gray-500">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={() => setTimelineModal(null)} className="w-full py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
