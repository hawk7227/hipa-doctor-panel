// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useEffect } from 'react'
import { Shield, Lock, Unlock, FileSignature, Clock, AlertTriangle, CheckCircle, History, FilePlus, User } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string; chartStatus?: string }

const TABS = ['Status', 'Audit Trail', 'Addendums'] as const

export default function ChartManagementPanelV2({ isOpen, onClose, patientId, patientName, appointmentId, chartStatus }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>('Status')
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [addendums, setAddendums] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddendum, setShowAddendum] = useState(false)
  const [addendumForm, setAddendumForm] = useState({ content: '', reason: '', addendum_type: 'addendum' })

  useEffect(() => {
    if (!appointmentId || !isOpen) return
    setLoading(true)
    Promise.all([
      fetch(`/api/chart/sign?appointment_id=${appointmentId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/panels/amendments?patient_id=${patientId}&appointment_id=${appointmentId}`).then(r => r.json()).catch(() => ({ data: [] }))
    ]).then(([auditData, amendData]) => {
      setAuditLog(auditData.audit_log || [])
      setAddendums(amendData.data || [])
    }).catch(err => setError(err.message))
    .finally(() => setLoading(false))
  }, [appointmentId, patientId, isOpen])

  const handleChartAction = async (action: string) => {
    if (!appointmentId) return
    const endpoint = action === 'sign' ? '/api/chart/sign' : action === 'close' ? '/api/chart/close' : '/api/chart/unlock'
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
    } catch (err: any) { setError(err.message) }
  }

  const handleAddendum = async () => {
    if (!addendumForm.content.trim() || !appointmentId) return
    try {
      const res = await fetch('/api/chart/addendum', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId, ...addendumForm })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else {
        setAddendums(prev => [data.data || { ...addendumForm, created_at: new Date().toISOString() }, ...prev])
        setShowAddendum(false); setAddendumForm({ content: '', reason: '', addendum_type: 'addendum' })
      }
    } catch (err: any) { setError(err.message) }
  }

  const statusColor = chartStatus === 'signed' ? 'text-green-400' : chartStatus === 'closed' ? 'text-blue-400' : chartStatus === 'locked' ? 'text-amber-400' : 'text-gray-400'
  const StatusIcon = chartStatus === 'signed' ? CheckCircle : chartStatus === 'locked' ? Lock : chartStatus === 'closed' ? Shield : Unlock

  if (!isOpen) return null

  return (
    <PanelBase title={`Chart Management — ${patientName}`} icon={Shield} accentColor="#eab308" loading={loading}
      error={error} hasData={!!appointmentId} emptyMessage="No appointment selected"
      onClose={onClose} draggable={false}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Addendums' && addendums.length > 0 && <span className="ml-1 text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">{addendums.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Status Tab */}
          {tab === 'Status' && (
            <div className="space-y-3">
              <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4 text-center">
                <StatusIcon className={`w-8 h-8 mx-auto mb-2 ${statusColor}`} />
                <div className={`text-lg font-bold capitalize ${statusColor}`}>{chartStatus || 'Open'}</div>
                <div className="text-xs text-gray-500 mt-1">Chart status for this encounter</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(!chartStatus || chartStatus === 'open') && (
                  <button onClick={() => handleChartAction('sign')}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-medium hover:bg-green-600/30">
                    <FileSignature className="w-4 h-4" />Sign Chart
                  </button>
                )}
                {chartStatus === 'signed' && (
                  <button onClick={() => handleChartAction('close')}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-600/30">
                    <Lock className="w-4 h-4" />Close Chart
                  </button>
                )}
                {(chartStatus === 'signed' || chartStatus === 'closed') && (
                  <button onClick={() => { setTab('Addendums'); setShowAddendum(true) }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-600/20 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-600/30">
                    <FilePlus className="w-4 h-4" />Add Addendum
                  </button>
                )}
                {chartStatus === 'locked' && (
                  <button onClick={() => handleChartAction('unlock')}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium hover:bg-red-600/30">
                    <Unlock className="w-4 h-4" />Request Unlock
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Audit Trail */}
          {tab === 'Audit Trail' && (
            <div className="space-y-2">
              {auditLog.length === 0 && <div className="text-center py-6 text-xs text-gray-500">No audit entries</div>}
              {auditLog.map((entry: any, i: number) => (
                <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
                  <History className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium capitalize">{(entry.action || '').replace('_', ' ')}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {entry.performed_by_name && <span>{entry.performed_by_name}</span>}
                      {entry.performed_by_role && <span className="ml-1 text-gray-600">({entry.performed_by_role})</span>}
                      <span className="ml-2">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                    </div>
                    {entry.reason && <p className="text-xs text-gray-400 mt-1">{entry.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Addendums */}
          {tab === 'Addendums' && (
            <div className="space-y-2">
              {showAddendum && (
                <div className="bg-[#0a1f1f] border border-amber-500/30 rounded-lg p-3 space-y-2">
                  <select value={addendumForm.addendum_type} onChange={e => setAddendumForm({...addendumForm, addendum_type: e.target.value})}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                    <option value="addendum">Addendum</option><option value="late_entry">Late Entry</option><option value="correction">Correction</option>
                  </select>
                  <textarea value={addendumForm.content} onChange={e => setAddendumForm({...addendumForm, content: e.target.value})}
                    placeholder="Addendum content..." rows={4} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
                  <input value={addendumForm.reason} onChange={e => setAddendumForm({...addendumForm, reason: e.target.value})}
                    placeholder="Reason for addendum..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddendum(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                    <button onClick={handleAddendum} disabled={!addendumForm.content.trim()}
                      className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-500 disabled:opacity-50">Submit</button>
                  </div>
                </div>
              )}
              {!showAddendum && (
                <button onClick={() => setShowAddendum(true)}
                  className="w-full px-3 py-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20">
                  <FilePlus className="w-3.5 h-3.5 inline mr-1" />New Addendum
                </button>
              )}
              {addendums.map((a: any, i: number) => (
                <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 capitalize">{(a.addendum_type || 'addendum').replace('_', ' ')}</span>
                    <span className="text-xs text-gray-500">{a.author_name} · {a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{a.content}</p>
                  {a.reason && <p className="text-xs text-gray-500 mt-1">Reason: {a.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
