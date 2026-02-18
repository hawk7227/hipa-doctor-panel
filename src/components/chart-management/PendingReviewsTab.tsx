'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, X, RefreshCw, Clock, User, FileText, AlertCircle, Eye, MessageSquare } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// PendingReviewsTab — Draft approval queue for assistant changes
// Doctor reviews and approves/rejects changes made by assistants
// ═══════════════════════════════════════════════════════════════

interface ChartDraft {
  id: string
  appointment_id: string | null
  patient_id: string
  author_name: string
  author_email: string
  author_role: string
  panel: string
  action: string
  target_table: string
  draft_data: any
  original_data: any
  description: string
  status: string
  review_notes: string | null
  created_at: string
  patients?: { first_name: string; last_name: string } | null
}

const PANEL_LABELS: Record<string, string> = {
  medications: 'Medications',
  allergies: 'Allergies',
  problems: 'Problems',
  vitals: 'Vitals',
  'clinical-notes': 'Clinical Notes',
  documents: 'Documents',
  immunizations: 'Immunizations',
  insurance: 'Insurance',
  prescriptions: 'Prescriptions',
  'lab-results': 'Lab Results',
  billing: 'Billing',
  'care-plans': 'Care Plans',
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  add: { label: 'Add', color: 'text-green-400 bg-green-500/20' },
  edit: { label: 'Edit', color: 'text-amber-400 bg-amber-500/20' },
  delete: { label: 'Delete', color: 'text-red-400 bg-red-500/20' },
  note: { label: 'Note', color: 'text-blue-400 bg-blue-500/20' },
}

export default function PendingReviewsTab({ doctorId, doctorName }: { doctorId: string | null; doctorName: string }) {
  const [drafts, setDrafts] = useState<ChartDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const fetchDrafts = useCallback(async () => {
    if (!doctorId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/patient-data/drafts?doctor_id=${doctorId}&status=${filter}`)
      const json = await res.json()
      setDrafts(json.data || [])
    } catch (err) {
      console.error('[pending-reviews] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [doctorId, filter])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const handleApprove = async (draft: ChartDraft) => {
    setActionLoading(draft.id)
    try {
      const res = await fetch('/api/patient-data/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          status: 'approved',
          reviewed_by: doctorId,
          reviewed_by_name: doctorName,
          reviewed_at: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draft.id))
      }
    } catch (err) {
      console.error('[pending-reviews] approve error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (draft: ChartDraft) => {
    setActionLoading(draft.id)
    try {
      const res = await fetch('/api/patient-data/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          status: 'rejected',
          reviewed_by: doctorId,
          reviewed_by_name: doctorName,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectNote || 'Rejected by provider',
        }),
      })
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draft.id))
        setRejectNote('')
        setExpandedId(null)
      }
    } catch (err) {
      console.error('[pending-reviews] reject error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkApprove = async () => {
    const pending = drafts.filter(d => d.status === 'pending')
    for (const draft of pending) {
      await handleApprove(draft)
    }
  }

  const pendingCount = drafts.filter(d => d.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
              {f === 'pending' ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          {pendingCount > 1 && filter === 'pending' && (
            <button onClick={handleBulkApprove}
              className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-bold hover:bg-green-600/30 transition-colors flex items-center space-x-1">
              <Check className="w-3 h-3" /><span>Approve All</span>
            </button>
          )}
          <button onClick={fetchDrafts} disabled={loading}
            className="p-1.5 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-400 hover:text-teal-400 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{filter === 'pending' ? 'No pending reviews' : `No ${filter} items`}</p>
          {filter === 'pending' && <p className="text-[10px] text-gray-600 mt-1">You&#39;re all caught up!</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => {
            const actionInfo = ACTION_LABELS[draft.action] || ACTION_LABELS.note
            const isExpanded = expandedId === draft.id
            return (
              <div key={draft.id} className="bg-[#0a1f1f] rounded-lg border border-[#1a3d3d] overflow-hidden">
                {/* Summary Row */}
                <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#0d2626] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : draft.id)}>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#0d2626] border border-[#1a3d3d] flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{draft.author_name || draft.author_email}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${actionInfo.color}`}>{actionInfo.label}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#0d2626] text-gray-400">{PANEL_LABELS[draft.panel] || draft.panel}</span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {draft.patients ? `${draft.patients.first_name} ${draft.patients.last_name}` : 'Unknown Patient'}
                        {' • '}{new Date(draft.created_at).toLocaleString()}
                      </p>
                      {draft.description && <p className="text-xs text-gray-400 mt-0.5">{draft.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {draft.status === 'pending' && (
                      <>
                        <button onClick={e => { e.stopPropagation(); handleApprove(draft) }}
                          disabled={actionLoading === draft.id}
                          className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50">
                          {actionLoading === draft.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={e => { e.stopPropagation(); setExpandedId(draft.id) }}
                          className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {draft.status === 'approved' && <Check className="w-4 h-4 text-green-500" />}
                    {draft.status === 'rejected' && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[#1a3d3d] p-3 space-y-3">
                    {/* Draft Data */}
                    <div className="bg-[#0d2626] rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Proposed Changes</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-40">
                        {JSON.stringify(draft.draft_data, null, 2)}
                      </pre>
                    </div>

                    {/* Original Data (for edits) */}
                    {draft.original_data && (
                      <div className="bg-[#0d2626] rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Original Data</p>
                        <pre className="text-xs text-gray-500 whitespace-pre-wrap overflow-auto max-h-40">
                          {JSON.stringify(draft.original_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Reject with note */}
                    {draft.status === 'pending' && (
                      <div className="flex items-center space-x-2">
                        <input value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                          className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-red-500/50"
                          placeholder="Rejection reason (optional)..." />
                        <button onClick={() => handleReject(draft)} disabled={actionLoading === draft.id}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Review notes (for reviewed items) */}
                    {draft.review_notes && (
                      <div className="bg-[#0d2626] rounded-lg p-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Review Notes</p>
                        <p className="text-xs text-gray-300">{draft.review_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
