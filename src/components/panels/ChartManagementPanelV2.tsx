// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield, Lock, Unlock, FileSignature, Clock, AlertTriangle, CheckCircle,
  History, FilePlus, User, Settings, FileEdit, Bell, UserCog, Palette,
  Download, RefreshCw, Eye, Pen, X, Users, ChevronRight
} from 'lucide-react'
import DraggableOverlayWrapper from '@/components/DraggableOverlayWrapper'
import ChartSettingsTab from '@/components/chart-management/ChartSettingsTab'
import LetterGeneratorTab from '@/components/chart-management/LetterGeneratorTab'
import PendingReviewsTab from '@/components/chart-management/PendingReviewsTab'

// ═══════════════════════════════════════════════════════════════
// ChartManagementPanelV2 — ENTERPRISE Floating Panel
//
// Draggable, resizable, lockable from all edges.
// Used in: WorkspaceCanvas (EHR) + AppointmentDetailModal
//
// TABS:
//   📋 Chart   — Sign/Close/Unlock/Addendum/Audit (per-appointment)
//   📄 Letters — AI + manual letter generation
//   ⚙️ Settings — Colors, PDF letterhead, practice info
//   👥 Staff   — Inline staff management link
//   🔔 Reviews — Assistant draft approval queue
// ═══════════════════════════════════════════════════════════════

interface Props {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  appointmentId?: string
  chartStatus?: string
  doctorId?: string | null
  doctorName?: string
  /** When true, renders content directly without DraggableOverlayWrapper (for grid embedding) */
  inline?: boolean
}

type TabKey = 'chart' | 'letters' | 'settings' | 'staff' | 'reviews'

export default function ChartManagementPanelV2({
  isOpen, onClose, patientId, patientName, appointmentId, chartStatus,
  doctorId, doctorName, inline = false,
}: Props) {
  const [tab, setTab] = useState<TabKey>('chart')
  const [chartSub, setChartSub] = useState<'audit' | 'addendums'>('audit')
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [addendums, setAddendums] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddendum, setShowAddendum] = useState(false)
  const [addendumForm, setAddendumForm] = useState({ content: '', reason: '', addendum_type: 'addendum' })
  const [pendingCount, setPendingCount] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg })
    setTimeout(() => setNotification(null), 3000)
  }

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    if (!appointmentId || !isOpen) return
    setLoading(true)
    try {
      const [auditRes, amendRes] = await Promise.all([
        fetch(`/api/chart/sign?appointment_id=${appointmentId}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/panels/amendments?patient_id=${patientId}&appointment_id=${appointmentId}`).then(r => r.json()).catch(() => ({ data: [] }))
      ])
      setAuditLog(auditRes.audit_log || [])
      setAddendums(amendRes.data || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [appointmentId, patientId, isOpen])

  useEffect(() => { fetchChartData() }, [fetchChartData])

  // Fetch pending review count
  useEffect(() => {
    if (!doctorId || !isOpen) return
    fetch(`/api/patient-data/drafts?doctor_id=${doctorId}&status=pending`)
      .then(r => r.json())
      .then(json => setPendingCount((json.data || []).length))
      .catch(() => {})
  }, [doctorId, isOpen])

  // ── Chart Actions ──
  const handleChartAction = async (action: 'sign' | 'close' | 'unlock') => {
    if (!appointmentId) return
    setActionLoading(true)
    setError(null)
    const endpoint = action === 'sign' ? '/api/chart/sign' : action === 'close' ? '/api/chart/close' : '/api/chart/unlock'
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, providerName: doctorName || 'Provider', providerRole: 'provider' })
      })
      const data = await res.json()
      if (data.error) { setError(data.error); notify('error', data.error) }
      else { notify('success', `Chart ${action}ed successfully`); fetchChartData() }
    } catch (err: any) { setError(err.message) }
    finally { setActionLoading(false) }
  }

  const handleAddendum = async () => {
    if (!addendumForm.content.trim() || !appointmentId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/chart/addendum', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId, text: addendumForm.content, addendumType: addendumForm.addendum_type,
          reason: addendumForm.reason, authorName: doctorName || 'Provider', authorRole: 'provider',
        })
      })
      const data = await res.json()
      if (data.error) { setError(data.error) }
      else {
        setAddendums(prev => [data.data || { ...addendumForm, created_at: new Date().toISOString(), author_name: doctorName }, ...prev])
        setShowAddendum(false)
        setAddendumForm({ content: '', reason: '', addendum_type: 'addendum' })
        notify('success', 'Addendum saved')
      }
    } catch (err: any) { setError(err.message) }
    finally { setActionLoading(false) }
  }

  // Status display
  const cs = chartStatus || 'draft'
  const STATUS_MAP: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
    draft:       { color: 'text-gray-300',   bg: 'bg-gray-500/20',   border: 'border-gray-500/40',   icon: FileEdit,      label: 'DRAFT' },
    preliminary: { color: 'text-amber-400',  bg: 'bg-amber-500/20',  border: 'border-amber-500/40',  icon: Clock,         label: 'PRELIMINARY' },
    signed:      { color: 'text-green-400',  bg: 'bg-green-500/20',  border: 'border-green-500/40',  icon: CheckCircle,   label: 'SIGNED' },
    closed:      { color: 'text-blue-400',   bg: 'bg-blue-500/20',   border: 'border-blue-500/40',   icon: Lock,          label: 'CLOSED' },
    amended:     { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40', icon: Pen,           label: 'AMENDED' },
    locked:      { color: 'text-red-400',    bg: 'bg-red-500/20',    border: 'border-red-500/40',    icon: Lock,          label: 'LOCKED' },
    open:        { color: 'text-teal-400',   bg: 'bg-teal-500/20',   border: 'border-teal-500/40',   icon: Unlock,        label: 'OPEN' },
  }
  const s = STATUS_MAP[cs] || STATUS_MAP.draft
  const StatusIcon = s.icon

  // GTR-style color map for inline styles
  const STATUS_COLOR_MAP: Record<string, string> = {
    draft: '#6b7280', preliminary: '#f59e0b', signed: '#22c55e',
    closed: '#3b82f6', amended: '#a855f7', locked: '#ef4444', open: '#14b8a6',
  }

  if (!isOpen) return null

  // ── Content shared between inline and overlay modes ──
  const panelContent = (
      <div className="flex flex-col h-full">

        {/* ═══ NOTIFICATION TOAST ═══ */}
        {notification && (
          <div className={`mx-3 mt-2 px-3 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 ${notification.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* ═══ MAIN TAB BAR — big colorful tabs ═══ */}
        <div className="flex px-2 pt-2 pb-0 space-x-1 overflow-x-auto scrollbar-hide">
          {([
            { key: 'chart' as TabKey,    label: 'Chart',    icon: Shield,   color: 'purple', badge: 0 },
            { key: 'letters' as TabKey,  label: 'Letters',  icon: FileEdit, color: 'teal',   badge: 0 },
            { key: 'settings' as TabKey, label: 'Settings', icon: Settings, color: 'amber',  badge: 0 },
            { key: 'staff' as TabKey,    label: 'Staff',    icon: Users,    color: 'blue',   badge: 0 },
            { key: 'reviews' as TabKey,  label: 'Reviews',  icon: Bell,     color: 'orange', badge: pendingCount },
          ]).map(({ key, label, icon: TabIcon, color, badge }) => {
            const active = tab === key
            const colors: Record<string, string> = {
              purple: active ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'text-gray-500 hover:text-purple-300 hover:bg-purple-500/10 border-transparent',
              teal:   active ? 'bg-teal-500/20 text-teal-400 border-teal-500/40'       : 'text-gray-500 hover:text-teal-300 hover:bg-teal-500/10 border-transparent',
              amber:  active ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'    : 'text-gray-500 hover:text-amber-300 hover:bg-amber-500/10 border-transparent',
              blue:   active ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'        : 'text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 border-transparent',
              orange: active ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'  : 'text-gray-500 hover:text-orange-300 hover:bg-orange-500/10 border-transparent',
            }
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border transition-all whitespace-nowrap ${colors[color]}`}>
                <TabIcon className="w-4 h-4" />
                <span className="text-[11px]">{label}</span>
                {badge > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
              </button>
            )
          })}
        </div>

        {/* ═══ TAB CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {/* ════════════════════════════════════════════ */}
          {/* CHART TAB                                    */}
          {/* ════════════════════════════════════════════ */}
          {tab === 'chart' && (
            <div className="space-y-3">

              {/* ── GTR-STYLE STATUS HERO CARD ── */}
              {/* Color bar + Status icon + Locked/Unlocked badge + View Clinical Note button */}
              <div className={`rounded-xl overflow-hidden border ${s.border}`}
                style={{ borderLeftWidth: '5px', borderLeftColor: STATUS_COLOR_MAP[cs] || '#6b7280' }}>
                {/* Color gradient bar */}
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${STATUS_COLOR_MAP[cs] || '#6b7280'}, ${STATUS_COLOR_MAP[cs] || '#6b7280'}66)` }} />

                <div className={`${s.bg} p-4 space-y-3`}>
                  {/* Icon + Label + Lock Badge row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: (STATUS_COLOR_MAP[cs] || '#6b7280') + '20', border: `2px solid ${(STATUS_COLOR_MAP[cs] || '#6b7280')}40` }}>
                        {(cs === 'closed' || cs === 'locked') ? (
                          <Lock className="w-7 h-7" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 6px #fbbf2480)' }} />
                        ) : cs === 'signed' ? (
                          <CheckCircle className="w-7 h-7" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 6px #fbbf2480)' }} />
                        ) : cs === 'amended' ? (
                          <Pen className="w-7 h-7" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 6px #fbbf2480)' }} />
                        ) : (
                          <StatusIcon className={`w-7 h-7 ${s.color}`} />
                        )}
                      </div>
                      <div>
                        <div className={`text-xl font-black tracking-wide ${s.color}`}>{s.label}</div>
                        <div className="text-[10px] text-gray-500">
                          {(cs === 'closed' || cs === 'locked') ? 'Chart is locked — read only' :
                           cs === 'signed' ? 'Chart signed — complete' :
                           cs === 'draft' || cs === 'open' ? 'Chart unlocked — editable' :
                           'Chart status for this encounter'}
                        </div>
                      </div>
                    </div>
                    {(cs === 'closed' || cs === 'locked' || cs === 'amended') ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Lock className="w-3 h-3" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 3px #fbbf2480)' }} />LOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
                        <Unlock className="w-3 h-3" />UNLOCKED
                      </span>
                    )}
                  </div>

                  {/* View Clinical Note Button — GTR style */}
                  <button className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-white text-sm font-black transition-all shadow-lg hover:brightness-110"
                    style={{ background: `linear-gradient(135deg, ${STATUS_COLOR_MAP[cs] || '#6b7280'}, ${STATUS_COLOR_MAP[cs] || '#6b7280'}bb)`, boxShadow: `0 4px 14px ${STATUS_COLOR_MAP[cs] || '#6b7280'}30` }}
                    onClick={() => { if (appointmentId) window.open(`/api/chart/pdf?appointment_id=${appointmentId}`, '_blank') }}>
                    {(cs === 'closed' || cs === 'locked' || cs === 'amended') ? (
                      <Lock className="w-5 h-5" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 3px #fbbf2480)' }} />
                    ) : cs === 'signed' ? (
                      <CheckCircle className="w-5 h-5" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 3px #fbbf2480)' }} />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                    <span>{(cs === 'closed' || cs === 'locked') ? '🔒 View Clinical Note' : cs === 'signed' ? '✅ View Clinical Note' : '✎ View Clinical Note'}</span>
                  </button>
                </div>
              </div>

              {/* ── BIG ACTION BUTTONS ── */}
              <div className="grid grid-cols-2 gap-2">
                {(!chartStatus || chartStatus === 'draft' || chartStatus === 'open' || chartStatus === 'preliminary') && (
                  <button onClick={() => handleChartAction('sign')} disabled={actionLoading}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl text-white text-sm font-black hover:from-green-500 hover:to-emerald-600 transition-all shadow-lg shadow-green-900/30 disabled:opacity-50">
                    {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileSignature className="w-5 h-5" />}
                    <span className="text-base">Sign Chart</span>
                  </button>
                )}
                {chartStatus === 'signed' && (
                  <button onClick={() => handleChartAction('close')} disabled={actionLoading}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white text-sm font-black hover:from-blue-500 hover:to-indigo-600 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50">
                    {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                    <span className="text-base">Close & Lock</span>
                  </button>
                )}
                {(chartStatus === 'signed' || chartStatus === 'closed' || chartStatus === 'amended') && (
                  <button onClick={() => { setChartSub('addendums'); setShowAddendum(true) }}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-amber-600 to-orange-700 rounded-xl text-white text-sm font-black hover:from-amber-500 hover:to-orange-600 transition-all shadow-lg shadow-amber-900/30">
                    <FilePlus className="w-5 h-5" />
                    <span className="text-base">Add Addendum</span>
                  </button>
                )}
                {(chartStatus === 'closed' || chartStatus === 'locked') && (
                  <button onClick={() => handleChartAction('unlock')} disabled={actionLoading}
                    className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl text-white text-sm font-black hover:from-red-500 hover:to-rose-600 transition-all shadow-lg shadow-red-900/30 disabled:opacity-50">
                    {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                    <span className="text-base">Unlock Chart</span>
                  </button>
                )}
                <button onClick={() => setTab('letters')}
                  className="flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-teal-600 to-cyan-700 rounded-xl text-white text-sm font-black hover:from-teal-500 hover:to-cyan-600 transition-all shadow-lg shadow-teal-900/30">
                  <FileEdit className="w-5 h-5" />
                  <span className="text-base">Generate Letter</span>
                </button>
              </div>

              {/* ── Sub-tabs: Audit / Addendums ── */}
              <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
                {(['audit', 'addendums'] as const).map(sub => (
                  <button key={sub} onClick={() => setChartSub(sub)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all capitalize ${chartSub === sub ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-white'}`}>
                    {sub === 'addendums' ? `Addendums (${addendums.length})` : 'Audit Trail'}
                  </button>
                ))}
              </div>

              {/* Audit Trail */}
              {chartSub === 'audit' && (
                <div className="space-y-2">
                  {loading && <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>}
                  {!loading && auditLog.length === 0 && <div className="text-center py-6 text-sm text-gray-500 font-bold">No audit entries yet</div>}
                  {auditLog.map((entry: any, i: number) => (
                    <div key={i} className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-start gap-3">
                      <History className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm text-white font-bold capitalize">{(entry.action || '').replace(/_/g, ' ')}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {entry.performed_by_name && <span className="font-bold text-gray-400">{entry.performed_by_name}</span>}
                          {entry.performed_by_role && <span className="ml-1">({entry.performed_by_role})</span>}
                          <span className="ml-2">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                        </div>
                        {entry.reason && <p className="text-xs text-gray-400 mt-1 italic">{entry.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Addendums */}
              {chartSub === 'addendums' && (
                <div className="space-y-2">
                  {showAddendum && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-black text-amber-400">New Addendum</p>
                      <select value={addendumForm.addendum_type} onChange={e => setAddendumForm({...addendumForm, addendum_type: e.target.value})}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-bold">
                        <option value="addendum">Addendum</option><option value="late_entry">Late Entry</option><option value="correction">Correction</option>
                      </select>
                      <textarea value={addendumForm.content} onChange={e => setAddendumForm({...addendumForm, content: e.target.value})}
                        placeholder="Addendum content..." rows={4} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y" />
                      {addendumForm.addendum_type === 'correction' && (
                        <input value={addendumForm.reason} onChange={e => setAddendumForm({...addendumForm, reason: e.target.value})}
                          placeholder="Reason for correction (required)..." className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddendum(false)} className="px-4 py-2 text-sm text-gray-400 font-bold hover:text-white">Cancel</button>
                        <button onClick={handleAddendum} disabled={!addendumForm.content.trim() || actionLoading}
                          className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-black rounded-lg hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 shadow-lg">
                          {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit Addendum'}
                        </button>
                      </div>
                    </div>
                  )}
                  {!showAddendum && (
                    <button onClick={() => setShowAddendum(true)}
                      className="w-full px-4 py-3 text-sm font-black text-amber-400 bg-amber-500/10 border-2 border-dashed border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all">
                      <FilePlus className="w-4 h-4 inline mr-2" />New Addendum
                    </button>
                  )}
                  {addendums.map((a: any, i: number) => (
                    <div key={i} className="bg-black/20 border border-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 text-amber-400 capitalize">{(a.addendum_type || a.amendment_type || 'addendum').replace('_', ' ')}</span>
                        <span className="text-[11px] text-gray-500 font-bold">{a.author_name || a.created_by_name || 'Provider'}</span>
                        <span className="text-[10px] text-gray-600">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{a.content || a.text}</p>
                      {a.reason && <p className="text-xs text-gray-500 mt-1 italic">Reason: {a.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* LETTERS TAB                                  */}
          {/* ════════════════════════════════════════════ */}
          {tab === 'letters' && (
            <LetterGeneratorTab
              doctorId={doctorId || null}
              doctorName={doctorName || 'Provider'}
              patientId={patientId}
              patientName={patientName}
            />
          )}

          {/* ════════════════════════════════════════════ */}
          {/* SETTINGS TAB                                 */}
          {/* ════════════════════════════════════════════ */}
          {tab === 'settings' && (
            <ChartSettingsTab doctorId={doctorId || null} />
          )}

          {/* ════════════════════════════════════════════ */}
          {/* STAFF TAB                                    */}
          {/* ════════════════════════════════════════════ */}
          {tab === 'staff' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
                <Users className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <p className="text-lg font-black text-white mb-1">Staff Management</p>
                <p className="text-sm text-gray-400 mb-4">Invite staff, manage permissions, schedules, and audit logs</p>
                <a href="/doctor/settings/staff" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-900/30">
                  <UserCog className="w-5 h-5" />
                  <span>Open Staff Settings</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
              <a href="/doctor/staff-hub" target="_blank" rel="noopener noreferrer"
                className="block bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 text-center hover:bg-teal-500/15 transition-colors">
                <p className="text-sm font-black text-teal-400">Staff Hub</p>
                <p className="text-[11px] text-gray-500">Messages, Tasks, Notifications</p>
              </a>
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* REVIEWS TAB                                  */}
          {/* ════════════════════════════════════════════ */}
          {tab === 'reviews' && (
            <PendingReviewsTab doctorId={doctorId || null} doctorName={doctorName || 'Provider'} />
          )}

        </div>
      </div>
  )

  // Inline mode: render content directly (for grid embedding)
  if (inline) {
    return panelContent
  }

  // Overlay mode: wrap in DraggableOverlayWrapper
  return (
    <DraggableOverlayWrapper
      panelId="chart-management-enterprise"
      isOpen={isOpen}
      onClose={onClose}
      title="Chart Management"
      icon={<Shield className="w-4 h-4" />}
      subtitle={patientName}
      defaultTheme="purple"
      defaultWidth={580}
      defaultHeight={650}
    >
      {panelContent}
    </DraggableOverlayWrapper>
  )
}
