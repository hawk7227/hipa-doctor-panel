// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { Users, Wine, Scissors, Loader2, Plus, Trash2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// SHARED TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════
interface HistoryRecord {
  id: string
  patient_id: string
  category: string
  description: string
  date?: string | null
  notes?: string | null
  status?: string | null
  created_at: string
}

interface BasePanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

function useHistoryData(patientId: string, category: string, isOpen: boolean) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patient_history')
        .select('*')
        .eq('patient_id', patientId)
        .eq('category', category)
        .order('created_at', { ascending: false })
      if (error) {
        // Table might not exist yet — fail silently
        console.log(`patient_history table query for ${category}:`, error.message)
        setRecords([])
      } else {
        setRecords(data || [])
      }
    } catch (err) {
      console.error(`Error fetching ${category}:`, err)
    } finally {
      setLoading(false)
    }
  }, [patientId, category])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const addRecord = async (description: string, date?: string, notes?: string) => {
    try {
      const { error } = await supabase.from('patient_history').insert({
        patient_id: patientId,
        category,
        description,
        date: date || null,
        notes: notes || null,
        status: 'active',
      })
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error(`Error adding ${category} record:`, err)
    }
  }

  const deleteRecord = async (id: string) => {
    try {
      await supabase.from('patient_history').delete().eq('id', id)
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error(`Error deleting ${category} record:`, err)
    }
  }

  return { records, loading, addRecord, deleteRecord, refetch: fetchData }
}

// ═══════════════════════════════════════════════════════════════
// GENERIC HISTORY LIST COMPONENT
// ═══════════════════════════════════════════════════════════════
function HistoryList({
  records, loading, adding, setAdding, newDesc, setNewDesc, newDate, setNewDate, newNotes, setNewNotes,
  onAdd, onDelete, accentColor, emptyText,
}: {
  records: HistoryRecord[]
  loading: boolean
  adding: boolean
  setAdding: (v: boolean) => void
  newDesc: string
  setNewDesc: (v: string) => void
  newDate: string
  setNewDate: (v: string) => void
  newNotes: string
  setNewNotes: (v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  accentColor: string
  emptyText: string
}) {
  return (
    <div className="p-4 space-y-3">
      {adding && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-2">
          <input placeholder="Description..." value={newDesc} onChange={e => setNewDesc(e.target.value)}
            className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-${accentColor}-500/50 focus:outline-none`} autoFocus />
          <div className="flex gap-2">
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
            <input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
            <button onClick={onAdd} className={`px-3 py-1.5 bg-${accentColor}-600 text-white text-xs rounded-lg hover:bg-${accentColor}-700`}>Add</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {records.map(rec => (
            <div key={rec.id} className="bg-white/5 rounded-xl border border-white/5 p-3 group hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{rec.description}</div>
                  <div className="flex items-center gap-3 mt-1">
                    {rec.date && <span className="text-[10px] text-white/40">{new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    {rec.status && rec.status !== 'active' && <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">{rec.status}</span>}
                  </div>
                  {rec.notes && <p className="text-[11px] text-white/30 mt-1">{rec.notes}</p>}
                </div>
                <button onClick={() => onDelete(rec.id)} className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FAMILY HISTORY PANEL
// ═══════════════════════════════════════════════════════════════
export function FamilyHistoryPanel({ isOpen, onClose, patientId, patientName }: BasePanelProps) {
  const { records, loading, addRecord, deleteRecord } = useHistoryData(patientId, 'family', isOpen)
  const [adding, setAdding] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleAdd = () => {
    if (!newDesc.trim()) return
    addRecord(newDesc, newDate, newNotes)
    setNewDesc(''); setNewDate(''); setNewNotes(''); setAdding(false)
  }

  return (
    <DraggableOverlayWrapper panelId="family-history" isOpen={isOpen} onClose={onClose}
      title="Family History" subtitle={patientName ? `${patientName} • ${records.length} records` : undefined}
      icon={<Users className="w-4 h-4" />} defaultTheme="rose" defaultWidth={500}
      headerActions={<button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"><Plus className="w-3.5 h-3.5 text-white/60" /></button>}>
      <HistoryList records={records} loading={loading} adding={adding} setAdding={setAdding}
        newDesc={newDesc} setNewDesc={setNewDesc} newDate={newDate} setNewDate={setNewDate}
        newNotes={newNotes} setNewNotes={setNewNotes} onAdd={handleAdd} onDelete={deleteRecord}
        accentColor="rose" emptyText="No family history records" />
    </DraggableOverlayWrapper>
  )
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL HISTORY PANEL
// ═══════════════════════════════════════════════════════════════
export function SocialHistoryPanel({ isOpen, onClose, patientId, patientName }: BasePanelProps) {
  const { records, loading, addRecord, deleteRecord } = useHistoryData(patientId, 'social', isOpen)
  const [adding, setAdding] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleAdd = () => {
    if (!newDesc.trim()) return
    addRecord(newDesc, newDate, newNotes)
    setNewDesc(''); setNewDate(''); setNewNotes(''); setAdding(false)
  }

  return (
    <DraggableOverlayWrapper panelId="social-history" isOpen={isOpen} onClose={onClose}
      title="Social History" subtitle={patientName ? `${patientName} • ${records.length} records` : undefined}
      icon={<Wine className="w-4 h-4" />} defaultTheme="amber" defaultWidth={500}
      headerActions={<button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"><Plus className="w-3.5 h-3.5 text-white/60" /></button>}>
      <HistoryList records={records} loading={loading} adding={adding} setAdding={setAdding}
        newDesc={newDesc} setNewDesc={setNewDesc} newDate={newDate} setNewDate={setNewDate}
        newNotes={newNotes} setNewNotes={setNewNotes} onAdd={handleAdd} onDelete={deleteRecord}
        accentColor="amber" emptyText="No social history records" />
    </DraggableOverlayWrapper>
  )
}

// ═══════════════════════════════════════════════════════════════
// SURGICAL HISTORY PANEL
// ═══════════════════════════════════════════════════════════════
export function SurgicalHistoryPanel({ isOpen, onClose, patientId, patientName }: BasePanelProps) {
  const { records, loading, addRecord, deleteRecord } = useHistoryData(patientId, 'surgical', isOpen)
  const [adding, setAdding] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleAdd = () => {
    if (!newDesc.trim()) return
    addRecord(newDesc, newDate, newNotes)
    setNewDesc(''); setNewDate(''); setNewNotes(''); setAdding(false)
  }

  return (
    <DraggableOverlayWrapper panelId="surgical-history" isOpen={isOpen} onClose={onClose}
      title="Surgical History" subtitle={patientName ? `${patientName} • ${records.length} records` : undefined}
      icon={<Scissors className="w-4 h-4" />} defaultTheme="red" defaultWidth={500}
      headerActions={<button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"><Plus className="w-3.5 h-3.5 text-white/60" /></button>}>
      <HistoryList records={records} loading={loading} adding={adding} setAdding={setAdding}
        newDesc={newDesc} setNewDesc={setNewDesc} newDate={newDate} setNewDate={setNewDate}
        newNotes={newNotes} setNewNotes={setNewNotes} onAdd={handleAdd} onDelete={deleteRecord}
        accentColor="red" emptyText="No surgical history records" />
    </DraggableOverlayWrapper>
  )
}
