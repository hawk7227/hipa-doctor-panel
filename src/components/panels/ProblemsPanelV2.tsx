// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { Stethoscope, Plus, Pencil, Trash2, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  recurrence: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}
const CATEGORIES = ['problem', 'diagnosis', 'health_concern', 'symptom', 'finding'] as const
const TABS = ['Active', 'All', 'Resolved'] as const

export default function ProblemsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'problems', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', icd10_code: '', status: 'active', category: 'problem', severity: '', onset_date: '', is_chronic: false, notes: '' })

  const allItems = useMemo(() => {
    const local = data || []
    const dc = (drchronoData || []).map((d: any) => ({
      ...d, _source: 'drchrono', description: d.description || d.name || 'Unknown',
      icd10_code: d.icd_code || d.icd10_code, status: d.status || 'active'
    }))
    return [...local, ...dc]
  }, [data, drchronoData])

  const filtered = useMemo(() => {
    if (tab === 'Active') return allItems.filter((i: any) => i.status === 'active' || i.status === 'recurrence')
    if (tab === 'Resolved') return allItems.filter((i: any) => i.status === 'resolved' || i.status === 'inactive')
    return allItems
  }, [allItems, tab])

  const resetForm = () => { setForm({ description: '', icd10_code: '', status: 'active', category: 'problem', severity: '', onset_date: '', is_chronic: false, notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.description.trim()) return
    const payload = { ...form, patient_id: patientId }
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Problems — ${patientName}`} icon={Stethoscope} accentColor="#f97316" loading={loading}
      error={error} hasData={allItems.length > 0 || showAdd} emptyMessage="No problems/conditions recorded"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={allItems.filter((i: any) => i.status === 'active').length || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-orange-400 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t} {t === 'Active' && allItems.filter((i: any) => i.status === 'active').length > 0 && <span className="ml-1 text-[9px] bg-orange-500/20 text-orange-400 px-1 rounded">{allItems.filter((i: any) => i.status === 'active').length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Problem/condition description..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.icd10_code} onChange={e => setForm({...form, icd10_code: e.target.value})}
                  placeholder="ICD-10 code..." className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="resolved">Resolved</option><option value="recurrence">Recurrence</option>
                </select>
                <input value={form.onset_date} onChange={e => setForm({...form, onset_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={form.is_chronic} onChange={e => setForm({...form, is_chronic: e.target.checked})} className="rounded" /> Chronic condition
              </label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes..." rows={2}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.description.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {filtered.map((item: any, idx: number) => (
            <div key={item.id || idx} className={`bg-[#0a1f1f] border rounded-lg p-3 flex items-start gap-3 ${item.is_principal ? 'border-orange-500/40' : 'border-[#1a3d3d]'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{item.description}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.active}`}>{(item.status || 'active').toUpperCase()}</span>
                  {item.is_chronic && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">CHRONIC</span>}
                  {item._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {item.icd10_code && <span className="font-mono bg-[#0d2626] px-1.5 py-0.5 rounded">{item.icd10_code}</span>}
                  {item.category && item.category !== 'problem' && <span>{item.category.replace('_', ' ')}</span>}
                  {item.onset_date && <span>Onset: {new Date(item.onset_date).toLocaleDateString()}</span>}
                </div>
                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
              </div>
              {!item._source && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(item.id); setForm({ description: item.description, icd10_code: item.icd10_code || '', status: item.status || 'active', category: item.category || 'problem', severity: item.severity || '', onset_date: item.onset_date || '', is_chronic: item.is_chronic || false, notes: item.notes || '' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
