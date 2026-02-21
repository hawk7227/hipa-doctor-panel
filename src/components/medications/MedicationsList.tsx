// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
'use client'

import React, { useState, useMemo } from 'react'
import { Pill, Plus, Pencil, Trash2, XCircle, Loader2, WifiOff, Clock } from 'lucide-react'
import { useMedications } from '@/hooks/useMedications'

interface Props {
  patientId: string
  patientName: string
  compact?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  discontinued: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const ROUTES = ['oral', 'topical', 'inhalation', 'injection', 'intravenous', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'transdermal', 'other'] as const

const TABS = ['Active', 'All'] as const

export default function MedicationsList({ patientId, patientName, compact }: Props) {
  const { medications, loading, error, isStale, isOffline, add, update, discontinue, remove, refresh } = useMedications(patientId)
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [discontinueId, setDiscontinueId] = useState<string | null>(null)
  const [discontinueReason, setDiscontinueReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    medication_name: '', dosage: '', frequency: '', route: 'oral', prescriber: '',
    start_date: '', end_date: '', is_prn: false, prn_reason: '',
    side_effects: '', notes: '', status: 'active',
  })

  const filtered = useMemo(() => {
    if (tab === 'Active') return medications.filter(m => m.status === 'active' || m.status === 'on_hold')
    return medications
  }, [medications, tab])

  const activeCount = medications.filter(m => m.status === 'active').length

  const resetForm = () => {
    setForm({ medication_name: '', dosage: '', frequency: '', route: 'oral', prescriber: '', start_date: '', end_date: '', is_prn: false, prn_reason: '', side_effects: '', notes: '', status: 'active' })
    setShowAdd(false)
    setEditId(null)
  }

  const handleSave = async () => {
    if (!form.medication_name.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await update(editId, form as any)
      } else {
        await add({ ...form, patient_id: patientId })
      }
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const handleDiscontinue = async () => {
    if (!discontinueId) return
    setSaving(true)
    try {
      await discontinue(discontinueId, discontinueReason || undefined)
      setDiscontinueId(null)
      setDiscontinueReason('')
    } finally {
      setSaving(false)
    }
  }

  const timeSinceSync = useMemo(() => {
    if (!isStale) return null
    // Show generic "cached data" message
    return 'Showing cached data'
  }, [isStale])

  return (
    <div className="flex flex-col h-full">
      {/* Offline banner */}
      {isOffline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
          <WifiOff className="w-3 h-3 flex-shrink-0" />
          <span>You&apos;re offline — changes will sync when reconnected</span>
        </div>
      )}

      {/* Stale data banner */}
      {isStale && !isOffline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-400 text-xs">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{timeSinceSync}</span>
          <button onClick={refresh} className="ml-auto text-blue-300 hover:text-blue-200 underline">Retry</button>
        </div>
      )}

      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-[#1a3d3d] px-3">
        <div className="flex">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Active' && activeCount > 0 && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">{activeCount}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300" title="Add Medication">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Loading */}
        {loading && medications.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-4 text-red-400 text-xs">
            {error}
            <button onClick={refresh} className="ml-2 text-teal-400 hover:underline">Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && medications.length === 0 && !showAdd && (
          <div className="text-center py-8">
            <Pill className="w-8 h-8 mx-auto mb-2 text-white/20" />
            <div className="text-white/40 text-sm">No medications recorded</div>
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-teal-400 hover:text-teal-300">+ Add medication</button>
          </div>
        )}

        {/* Add/Edit form */}
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.medication_name} onChange={e => setForm({ ...form, medication_name: e.target.value })}
              placeholder="Medication name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} placeholder="Dosage (e.g., 10mg)"
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} placeholder="Frequency (e.g., BID)"
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <select value={form.route} onChange={e => setForm({ ...form, route: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={form.prescriber} onChange={e => setForm({ ...form, prescriber: e.target.value })} placeholder="Prescriber"
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} type="date"
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              {editId && (
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="discontinued">Discontinued</option>
                  <option value="completed">Completed</option>
                </select>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={form.is_prn} onChange={e => setForm({ ...form, is_prn: e.target.checked })} /> PRN (as needed)
            </label>
            {form.is_prn && (
              <input value={form.prn_reason} onChange={e => setForm({ ...form, prn_reason: e.target.value })} placeholder="PRN reason..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            )}
            <input value={form.side_effects} onChange={e => setForm({ ...form, side_effects: e.target.value })} placeholder="Known side effects..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.medication_name.trim()}
                className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? '...' : editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Discontinue confirmation */}
        {discontinueId && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
            <div className="text-xs text-red-400 font-medium">Discontinue medication?</div>
            <input value={discontinueReason} onChange={e => setDiscontinueReason(e.target.value)}
              placeholder="Reason for discontinuation (optional)..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDiscontinueId(null); setDiscontinueReason('') }} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleDiscontinue} disabled={saving}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50">
                {saving ? '...' : 'Discontinue'}
              </button>
            </div>
          </div>
        )}

        {/* Medication list */}
        {filtered.map(m => (
          <div key={m.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <Pill className={`w-4 h-4 flex-shrink-0 mt-0.5 ${m.status === 'active' ? 'text-purple-400' : 'text-gray-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{m.medication_name}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[m.status] || STATUS_COLORS.active}`}>
                  {(m.status || 'active').toUpperCase()}
                </span>
                {m.is_prn && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">PRN</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {m.dosage && <span>{m.dosage}</span>}
                {m.frequency && <span className="ml-2">{m.frequency}</span>}
                {m.route && m.route !== 'oral' && <span className="ml-2 capitalize">{m.route}</span>}
              </div>
              {m.prescriber && !compact && <div className="text-xs text-gray-600 mt-0.5">Rx: {m.prescriber}</div>}
              {m.start_date && !compact && (
                <div className="text-xs text-gray-600 mt-0.5">
                  Started {new Date(m.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              {m.side_effects && <p className="text-xs text-amber-400 mt-0.5">⚠ {m.side_effects}</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {m.status === 'active' && (
                <button onClick={() => setDiscontinueId(m.id)} className="p-1 text-gray-500 hover:text-red-400" title="Discontinue">
                  <XCircle className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => {
                setEditId(m.id)
                setForm({
                  medication_name: m.medication_name, dosage: m.dosage || '', frequency: m.frequency || '',
                  route: m.route || 'oral', prescriber: m.prescriber || '', start_date: m.start_date || '',
                  end_date: m.end_date || '', is_prn: m.is_prn || false, prn_reason: m.prn_reason || '',
                  side_effects: m.side_effects || '', notes: m.notes || '', status: m.status || 'active',
                })
                setShowAdd(true)
              }} className="p-1 text-gray-500 hover:text-teal-400" title="Edit">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => remove(m.id)} className="p-1 text-gray-500 hover:text-red-400" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
