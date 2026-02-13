'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { Lock, Unlock, FileText, Clock, Edit, Save, Loader2, AlertTriangle, CheckCircle, Download, Shield, RotateCcw, X, Eye } from 'lucide-react'

interface ChartManagementPanelProps {
  isOpen: boolean
  onClose: () => void
  appointmentId: string
  chartStatus: 'draft' | 'signed' | 'closed' | 'amended'
  chartSignedAt: string | null
  chartSignedBy: string | null
  chartClosedAt: string | null
  chartClosedBy: string | null
  clinicalNotePdfUrl: string | null
  addendums: Array<{ id: string; text: string; addendum_type?: string; reason?: string; created_at: string; created_by: string; created_by_name?: string; created_by_role?: string }>
  currentUserName: string
  currentUserRole?: string
  onChartStatusChange: () => void
  onSetChartStatus: (status: 'draft' | 'signed' | 'closed' | 'amended') => void
  onSetChartLocked: (locked: boolean) => void
  onSetChartSignedAt: (val: string | null) => void
  onSetChartSignedBy: (val: string | null) => void
  onSetChartClosedAt: (val: string | null) => void
  onSetChartClosedBy: (val: string | null) => void
  onSetClinicalNotePdfUrl: (val: string | null) => void
  onSetAddendums: (fn: (prev: any[]) => any[]) => void
  onSetAppointment: (fn: (prev: any) => any) => void
  onSetError: (msg: string) => void
  chartActionLoading: string | null
  onSetChartActionLoading: (val: string | null) => void
}

interface AuditEntry { id: string; action: string; performed_by_name: string; performed_by_role: string; reason?: string; details?: any; created_at: string }

const STATUS_CONFIG = {
  draft:   { label: 'Draft',           icon: Edit,     bg: 'bg-amber-500/10',  border: 'border-amber-500/30', text: 'text-amber-400',  dot: 'bg-amber-400',  desc: 'Chart is editable. Sign when ready.' },
  signed:  { label: 'Signed & Locked', icon: Lock,     bg: 'bg-green-500/10',  border: 'border-green-500/30', text: 'text-green-400',  dot: 'bg-green-400',  desc: 'SOAP notes locked. Close to generate PDF.' },
  closed:  { label: 'Closed — Final',  icon: Shield,   bg: 'bg-purple-500/10', border: 'border-purple-500/30',text: 'text-purple-400', dot: 'bg-purple-400', desc: 'PDF generated. Add addendums if needed.' },
  amended: { label: 'Amended',         icon: FileText, bg: 'bg-blue-500/10',   border: 'border-blue-500/30',  text: 'text-blue-400',   dot: 'bg-blue-400',   desc: 'Addendums appended. PDF regenerated.' },
} as const

const AUDIT_COLORS: Record<string, string> = {
  signed: 'bg-green-500', closed: 'bg-purple-500', unlocked: 'bg-amber-500',
  reopened: 'bg-amber-500', addendum_added: 'bg-blue-500', correction_added: 'bg-red-400',
  late_entry_added: 'bg-cyan-500', pdf_generated: 'bg-cyan-500', pdf_viewed: 'bg-gray-500',
  pdf_downloaded: 'bg-gray-500', draft_created: 'bg-gray-500', draft_edited: 'bg-gray-500', cosigned: 'bg-teal-500',
}

export default function ChartManagementPanel({
  isOpen, onClose, appointmentId, chartStatus, chartSignedAt, chartSignedBy,
  chartClosedAt, chartClosedBy, clinicalNotePdfUrl, addendums, currentUserName,
  currentUserRole = 'provider',
  onChartStatusChange, onSetChartStatus, onSetChartLocked, onSetChartSignedAt,
  onSetChartSignedBy, onSetChartClosedAt, onSetChartClosedBy, onSetClinicalNotePdfUrl,
  onSetAddendums, onSetAppointment, onSetError, chartActionLoading, onSetChartActionLoading,
}: ChartManagementPanelProps) {

  const isDoctor = !currentUserRole || currentUserRole === 'provider' || currentUserRole === 'doctor'

  const [activeTab, setActiveTab] = useState<'status' | 'addendum' | 'audit'>('status')
  const [addendumText, setAddendumText] = useState('')
  const [addendumType, setAddendumType] = useState<'addendum' | 'late_entry' | 'correction'>('addendum')
  const [addendumReason, setAddendumReason] = useState('')
  const [savingAddendum, setSavingAddendum] = useState(false)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)

  const cfg = STATUS_CONFIG[chartStatus] || STATUS_CONFIG.draft
  const StatusIcon = cfg.icon

  const fetchAudit = useCallback(async () => {
    if (!appointmentId) return
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/chart/audit?appointmentId=${appointmentId}`)
      const data = await res.json()
      if (data.audit_trail) setAuditEntries(data.audit_trail)
    } catch (err) { console.error('Error fetching audit:', err) }
    finally { setAuditLoading(false) }
  }, [appointmentId])

  useEffect(() => { if (isOpen && activeTab === 'audit') fetchAudit() }, [isOpen, activeTab, fetchAudit])

  const callApi = useCallback(async (url: string, body: Record<string, any>) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [])

  const handleSign = useCallback(async () => {
    if (!appointmentId || !currentUserName) return
    onSetChartActionLoading('sign')
    try {
      const data = await callApi('/api/chart/sign', { appointmentId, providerName: currentUserName, providerRole: isDoctor ? 'provider' : currentUserRole })
      onSetChartLocked(true); onSetChartStatus('signed'); onSetChartSignedAt(data.signed_at); onSetChartSignedBy(data.signed_by)
      onSetAppointment((prev: any) => prev ? { ...prev, chart_locked: true, is_locked: true, chart_status: 'signed', chart_signed_at: data.signed_at, chart_signed_by: data.signed_by } : prev)
      onChartStatusChange()
    } catch (err: any) { onSetError(err.message) }
    finally { onSetChartActionLoading(null) }
  }, [appointmentId, currentUserName, isDoctor, currentUserRole, callApi, onSetChartActionLoading, onSetChartLocked, onSetChartStatus, onSetChartSignedAt, onSetChartSignedBy, onSetAppointment, onChartStatusChange, onSetError])

  const handleClose = useCallback(async () => {
    if (!appointmentId || !currentUserName) return
    onSetChartActionLoading('close')
    try {
      const data = await callApi('/api/chart/close', { appointmentId, providerName: currentUserName, providerRole: isDoctor ? 'provider' : currentUserRole })
      onSetChartStatus('closed'); onSetChartClosedAt(data.closed_at); onSetChartClosedBy(data.closed_by); onSetClinicalNotePdfUrl(data.pdf_url)
      onSetAppointment((prev: any) => prev ? { ...prev, chart_status: 'closed', chart_closed_at: data.closed_at, chart_closed_by: data.closed_by, clinical_note_pdf_url: data.pdf_url } : prev)
      onChartStatusChange()
    } catch (err: any) { onSetError(err.message) }
    finally { onSetChartActionLoading(null) }
  }, [appointmentId, currentUserName, isDoctor, currentUserRole, callApi, onSetChartActionLoading, onSetChartStatus, onSetChartClosedAt, onSetChartClosedBy, onSetClinicalNotePdfUrl, onSetAppointment, onChartStatusChange, onSetError])

  const handleUnlockOrReset = useCallback(async () => {
    if (!appointmentId || !currentUserName) return
    onSetChartActionLoading('unlock')
    try {
      await callApi('/api/chart/unlock', { appointmentId, providerName: currentUserName, providerRole: isDoctor ? 'provider' : currentUserRole, forceReset: chartStatus === 'closed' || chartStatus === 'amended' })
      onSetChartLocked(false); onSetChartStatus('draft'); onSetChartSignedAt(null); onSetChartSignedBy(null); onSetChartClosedAt(null); onSetChartClosedBy(null); onSetClinicalNotePdfUrl(null)
      onSetAppointment((prev: any) => prev ? { ...prev, chart_locked: false, is_locked: false, chart_status: 'draft', chart_signed_at: null, chart_signed_by: null, chart_closed_at: null, chart_closed_by: null, clinical_note_pdf_url: null } : prev)
      onChartStatusChange()
    } catch (err: any) { onSetError(err.message) }
    finally { onSetChartActionLoading(null) }
  }, [appointmentId, currentUserName, isDoctor, currentUserRole, chartStatus, callApi, onSetChartActionLoading, onSetChartLocked, onSetChartStatus, onSetChartSignedAt, onSetChartSignedBy, onSetChartClosedAt, onSetChartClosedBy, onSetClinicalNotePdfUrl, onSetAppointment, onChartStatusChange, onSetError])

  const handleSaveAddendum = useCallback(async () => {
    if (!appointmentId || !currentUserName || !addendumText.trim()) return
    setSavingAddendum(true)
    try {
      const data = await callApi('/api/chart/addendum', { appointmentId, text: addendumText.trim(), addendumType, reason: addendumType === 'correction' ? addendumReason.trim() : undefined, authorName: currentUserName, authorRole: isDoctor ? 'provider' : currentUserRole })
      if (data.addendum) onSetAddendums((prev: any[]) => [...prev, { ...data.addendum, created_by: currentUserName }])
      onSetChartStatus('amended'); if (data.pdf_url) onSetClinicalNotePdfUrl(data.pdf_url)
      setAddendumText(''); setAddendumType('addendum'); setAddendumReason('')
      onSetAppointment((prev: any) => prev ? { ...prev, chart_status: 'amended', clinical_note_pdf_url: data.pdf_url || prev.clinical_note_pdf_url } : prev)
      onChartStatusChange()
    } catch (err: any) { onSetError(err.message) }
    finally { setSavingAddendum(false) }
  }, [appointmentId, currentUserName, isDoctor, currentUserRole, addendumText, addendumType, addendumReason, callApi, onSetAddendums, onSetChartStatus, onSetClinicalNotePdfUrl, onSetAppointment, onChartStatusChange, onSetError])

  const handleViewPdf = useCallback(async () => {
    if (!appointmentId) return
    try {
      const res = await fetch(`/api/chart/pdf?appointmentId=${appointmentId}&action=view`)
      const data = await res.json()
      if (data.pdf_url) { onSetClinicalNotePdfUrl(data.pdf_url); setShowPdfViewer(true) }
    } catch (err: any) { onSetError(err.message || 'Failed to load PDF') }
  }, [appointmentId, onSetClinicalNotePdfUrl, onSetError])

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

  const TABS = [
    { id: 'status' as const, label: 'Status', icon: Shield },
    { id: 'addendum' as const, label: `Addendums (${addendums.length})`, icon: FileText },
    { id: 'audit' as const, label: 'Audit Trail', icon: Clock },
  ]

  return (
    <>
      <DraggableOverlayWrapper panelId="chart-management" isOpen={isOpen} onClose={onClose} title="Chart Management" icon={<Shield className="w-4 h-4" />} defaultTheme="purple" defaultWidth={480}>
        <div className="flex border-b border-white/10">
          {TABS.map(tab => { const TabIcon = tab.icon; return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-all border-b-2 ${activeTab === tab.id ? 'text-white border-purple-400 bg-white/5' : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/5'}`}>
              <TabIcon className="h-3.5 w-3.5" />{tab.label}
            </button>
          )})}
        </div>
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">

          {activeTab === 'status' && (<>
            <div className={`rounded-xl ${cfg.bg} ${cfg.border} border p-4`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}><StatusIcon className={`h-4 w-4 ${cfg.text}`} /></div>
                <div>
                  <div className="flex items-center gap-2"><span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span><span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} /></div>
                  <p className="text-[11px] text-white/40">{cfg.desc}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 pl-11">
                {chartSignedBy && (<div className="flex items-center gap-2 text-[11px]"><Lock className="h-3 w-3 text-green-400/60" /><span className="text-white/50">Signed by</span><span className="text-white/80 font-medium">{chartSignedBy}</span><span className="text-white/30">{fmtDate(chartSignedAt)}</span></div>)}
                {chartClosedBy && (<div className="flex items-center gap-2 text-[11px]"><Shield className="h-3 w-3 text-purple-400/60" /><span className="text-white/50">Closed by</span><span className="text-white/80 font-medium">{chartClosedBy}</span><span className="text-white/30">{fmtDate(chartClosedAt)}</span></div>)}
                {addendums.length > 0 && (<div className="flex items-center gap-2 text-[11px]"><FileText className="h-3 w-3 text-blue-400/60" /><span className="text-white/50">Addendums</span><span className="text-white/80 font-medium">{addendums.length}</span></div>)}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {['draft','signed','closed','amended'].map((step, i) => { const s = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG]; const isPast = ['draft','signed','closed','amended'].indexOf(chartStatus) >= i; return (<React.Fragment key={step}><div className={`flex-1 h-1.5 rounded-full transition-all ${isPast ? s.dot : 'bg-white/10'}`} />{i < 3 && <div className={`w-1 h-1 rounded-full ${isPast ? 'bg-white/40' : 'bg-white/10'}`} />}</React.Fragment>) })}
            </div>
            <div className="flex justify-between text-[9px] text-white/30 px-1">
              <span className={chartStatus === 'draft' ? 'text-amber-400' : ''}>Draft</span>
              <span className={chartStatus === 'signed' ? 'text-green-400' : ''}>Signed</span>
              <span className={chartStatus === 'closed' ? 'text-purple-400' : ''}>Closed</span>
              <span className={chartStatus === 'amended' ? 'text-blue-400' : ''}>Amended</span>
            </div>

            {isDoctor ? (<div className="space-y-2">
              {chartStatus === 'draft' && (<button onClick={handleSign} disabled={!!chartActionLoading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all disabled:opacity-50">{chartActionLoading === 'sign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Sign & Lock</button>)}

              {chartStatus === 'signed' && (<>
                <button onClick={handleClose} disabled={!!chartActionLoading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all disabled:opacity-50">{chartActionLoading === 'close' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}{chartActionLoading === 'close' ? 'Generating PDF...' : 'Close Chart & Generate PDF'}</button>
                <button onClick={handleUnlockOrReset} disabled={!!chartActionLoading} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium border border-white/10 transition-all disabled:opacity-50">{chartActionLoading === 'unlock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}Unlock</button>
              </>)}

              {(chartStatus === 'closed' || chartStatus === 'amended') && (<>
                <button onClick={handleViewPdf} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-sm font-bold border border-purple-500/30 transition-all"><Eye className="h-4 w-4" />View Clinical Note PDF</button>
                <button onClick={() => setActiveTab('addendum')} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all"><FileText className="h-3.5 w-3.5" />+ Add Addendum</button>
              </>)}

              {chartStatus !== 'draft' && (<div className="pt-3 border-t border-white/5">
                <button onClick={handleUnlockOrReset} disabled={!!chartActionLoading} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 text-[11px] font-medium border border-red-500/20 transition-all disabled:opacity-50">{chartActionLoading === 'unlock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Reset to Draft</button>
              </div>)}
            </div>) : (<div className="space-y-2">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3"><p className="text-[11px] text-white/40 text-center"><Lock className="h-3 w-3 inline mr-1 mb-0.5" />Chart actions restricted to provider.{(chartStatus === 'closed' || chartStatus === 'amended') && ' You can add addendums.'}</p></div>
              {(chartStatus === 'closed' || chartStatus === 'amended') && (<button onClick={() => setActiveTab('addendum')} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all"><FileText className="h-3.5 w-3.5" />+ Add Addendum</button>)}
            </div>)}
          </>)}

          {activeTab === 'addendum' && (<>
            {(chartStatus === 'closed' || chartStatus === 'amended') && (<div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
              <h4 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />New Addendum</h4>
              <div className="flex gap-2 mb-3">
                {(['addendum','late_entry','correction'] as const).map(type => (<button key={type} onClick={() => setAddendumType(type)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${addendumType === type ? (type === 'correction' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40') : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'}`}>{type === 'addendum' ? 'Addendum' : type === 'late_entry' ? 'Late Entry' : 'Correction'}</button>))}
              </div>
              {addendumType === 'correction' && (<input value={addendumReason} onChange={(e) => setAddendumReason(e.target.value)} placeholder="Reason for correction (required)..." className="w-full px-3 py-2 mb-2 rounded-lg border border-red-500/20 bg-black/20 text-white text-xs placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-500/50" />)}
              <textarea value={addendumText} onChange={(e) => setAddendumText(e.target.value)} placeholder="Enter addendum text..." rows={4} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/20 text-white text-xs placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none" />
              <div className="flex justify-end mt-2">
                <button onClick={handleSaveAddendum} disabled={!addendumText.trim() || savingAddendum || (addendumType === 'correction' && addendumReason.trim().length < 5)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">{savingAddendum ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save {addendumType === 'correction' ? 'Correction' : addendumType === 'late_entry' ? 'Late Entry' : 'Addendum'}</button>
              </div>
            </div>)}
            {chartStatus !== 'closed' && chartStatus !== 'amended' && addendums.length === 0 && (<div className="text-center py-8"><FileText className="h-8 w-8 text-white/10 mx-auto mb-2" /><p className="text-xs text-white/30">Addendums can only be added to closed charts.</p></div>)}
            {addendums.length > 0 && (<div className="space-y-2">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Previous Addendums ({addendums.length})</h4>
              {addendums.map((a, i) => (<div key={a.id} className={`rounded-xl border p-3 ${a.addendum_type === 'correction' ? 'bg-red-500/5 border-red-500/20' : a.addendum_type === 'late_entry' ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                <div className="flex items-center gap-2 mb-1.5"><span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${a.addendum_type === 'correction' ? 'bg-red-500/20 text-red-400' : a.addendum_type === 'late_entry' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{a.addendum_type === 'correction' ? 'Correction' : a.addendum_type === 'late_entry' ? 'Late Entry' : 'Addendum'} #{i + 1}</span><span className="text-[9px] text-white/30">{fmtDate(a.created_at)}</span></div>
                <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{a.text}</p>
                {a.reason && <p className="text-[10px] text-red-400/70 mt-1 italic">Reason: {a.reason}</p>}
                <p className="text-[10px] text-white/30 mt-1.5">— {a.created_by_name || a.created_by} ({a.created_by_role || 'provider'})</p>
              </div>))}
            </div>)}
          </>)}

          {activeTab === 'audit' && (<>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Audit Trail ({auditEntries.length})</h4>
              <button onClick={fetchAudit} disabled={auditLoading} className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">{auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}Refresh</button>
            </div>
            {auditLoading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 text-white/20 animate-spin" /></div>)
            : auditEntries.length === 0 ? (<div className="text-center py-8"><Clock className="h-8 w-8 text-white/10 mx-auto mb-2" /><p className="text-xs text-white/30">No audit entries yet</p></div>)
            : (<div className="space-y-1">
              {auditEntries.map(entry => (<div key={entry.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-all">
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${AUDIT_COLORS[entry.action] || 'bg-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] font-bold text-white/80">{entry.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span><span className="text-[9px] text-white/25">{fmtDate(entry.created_at)}</span></div>
                  <p className="text-[10px] text-white/40 mt-0.5">{entry.performed_by_name} ({entry.performed_by_role})</p>
                  {entry.reason && <p className="text-[10px] text-amber-400/60 mt-0.5 italic">Reason: {entry.reason}</p>}
                </div>
              </div>))}
            </div>)}
          </>)}
        </div>
      </DraggableOverlayWrapper>

      {showPdfViewer && clinicalNotePdfUrl && (<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPdfViewer(false)}>
        <div className="bg-slate-800 rounded-xl border border-white/10 shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-purple-400" /><span className="text-sm font-bold text-white">Clinical Note PDF</span>{chartStatus === 'amended' && <span className="text-xs text-blue-400">({addendums.length} addendum{addendums.length !== 1 ? 's' : ''})</span>}</div>
            <div className="flex items-center gap-2">
              <a href={clinicalNotePdfUrl} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"><Download className="h-3 w-3" />Download</a>
              <button onClick={() => setShowPdfViewer(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden"><iframe src={clinicalNotePdfUrl} className="w-full h-full border-0" title="Clinical Note PDF" /></div>
        </div>
      </div>)}
    </>
  )
}

