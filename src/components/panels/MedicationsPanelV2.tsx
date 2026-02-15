'use client'
import React, { useState, useMemo } from 'react'
import { Pill, Plus, Pencil, Trash2, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Active', 'All', 'Adherence'] as const
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  discontinued: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}
const ROUTES = ['oral', 'topical', 'inhalation', 'injection', 'intravenous', 'sublingual', 'rectal', 'ophthalmic', 'otic', 'nasal', 'transdermal', 'other'] as const

export default function MedicationsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'medications', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    medication_name: '', dosage: '', frequency: '', route: 'oral', prescriber: '',
    start_date: '', end_date: '', is_prn: false, prn_reason: '',
    side_effects: '', adherence_score: '', status: 'active', notes: ''
  })

  const allItems = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', medication_name: d.name || d.medication_name || 'Unknown', status: 'active' }))
    return [...(data || []), ...dc]
  }, [data, drchronoData])

  const filtered = useMemo(() => {
    if (tab === 'Active') return allItems.filter((m: any) => m.status === 'active' || m.status === 'on_hold')
    return allItems
  }, [allItems, tab])

  const activeCount = allItems.filter((m: any) => m.status === 'active').length

  const resetForm = () => {
    setForm({ medication_name: '', dosage: '', frequency: '', route: 'oral', prescriber: '',
      start_date: '', end_date: '', is_prn: false, prn_reason: '',
      side_effects: '', adherence_score: '', status: 'active', notes: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.medication_name.trim()) return
    const payload: any = { ...form, patient_id: patientId }
    if (form.adherence_score) payload.adherence_score = parseInt(form.adherence_score)
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Medications — ${patientName}`} icon={Pill} accentColor="#8b5cf6" loading={loading}
      error={error} hasData={allItems.length > 0 || showAdd} emptyMessage="No medications recorded"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={activeCount || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Active' && activeCount > 0 && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">{activeCount}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.medication_name} onChange={e => setForm({...form, medication_name: e.target.value})}
                placeholder="Medication name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} placeholder="Dosage (e.g., 10mg)"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} placeholder="Frequency (e.g., BID)"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.route} onChange={e => setForm({...form, route: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={form.prescriber} onChange={e => setForm({...form, prescriber: e.target.value})} placeholder="Prescriber"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.adherence_score} onChange={e => setForm({...form, adherence_score: e.target.value})} placeholder="Adherence (0-100)" type="number"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={form.is_prn} onChange={e => setForm({...form, is_prn: e.target.checked})} /> PRN (as needed)
              </label>
              {form.is_prn && <input value={form.prn_reason} onChange={e => setForm({...form, prn_reason: e.target.value})} placeholder="PRN reason..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />}
              <input value={form.side_effects} onChange={e => setForm({...form, side_effects: e.target.value})} placeholder="Known side effects..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.medication_name.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? '...' : editId ? 'Update' : 'Add'}</button>
              </div>
            </div>
          )}

          {/* Adherence Tab */}
          {tab === 'Adherence' && (
            <div className="space-y-2">
              {allItems.filter((m: any) => m.status === 'active').map((m: any, i: number) => {
                const score = m.adherence_score || 0
                return (
                  <div key={m.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">{m.medication_name}</span>
                      <span className={`text-xs font-bold ${score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{score}%</span>
                    </div>
                    <div className="w-full bg-[#0d2626] rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${score}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Active / All tabs */}
          {tab !== 'Adherence' && filtered.map((m: any, i: number) => (
            <div key={m.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
              <Pill className={`w-4 h-4 flex-shrink-0 mt-0.5 ${m.status === 'active' ? 'text-purple-400' : 'text-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{m.medication_name}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[m.status] || STATUS_COLORS.active}`}>{(m.status || 'active').toUpperCase()}</span>
                  {m.is_prn && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">PRN</span>}
                  {m._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {m.dosage && <span>{m.dosage}</span>}
                  {m.frequency && <span className="ml-2">{m.frequency}</span>}
                  {m.route && m.route !== 'oral' && <span className="ml-2 capitalize">{m.route}</span>}
                </div>
                {m.side_effects && <p className="text-xs text-amber-400 mt-0.5">⚠ {m.side_effects}</p>}
              </div>
              {!m._source && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(m.id); setForm({ medication_name: m.medication_name, dosage: m.dosage || '', frequency: m.frequency || '', route: m.route || 'oral', prescriber: m.prescriber || '', start_date: m.start_date || '', end_date: m.end_date || '', is_prn: m.is_prn || false, prn_reason: m.prn_reason || '', side_effects: m.side_effects || '', adherence_score: m.adherence_score?.toString() || '', status: m.status || 'active', notes: m.notes || '' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(m.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
