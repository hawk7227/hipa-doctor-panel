'use client'
import React, { useState, useMemo } from 'react'
import { AlertTriangle, Plus, Pencil, Trash2, ShieldAlert, CheckCircle } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Active', 'All', 'By Severity'] as const
const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  severe: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  life_threatening: 'bg-red-500/20 text-red-400 border-red-500/30',
}
const SEVERITIES = ['life_threatening', 'severe', 'moderate', 'mild'] as const
const TYPES = ['medication', 'food', 'environmental', 'biologic', 'other'] as const

export default function AllergiesPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'allergies', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ allergen_name: '', allergy_type: 'medication', severity: 'moderate', reaction: '', status: 'active', onset_date: '', notes: '' })

  const allItems = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', allergen_name: d.description || d.name || 'Unknown', status: d.status || 'active' }))
    return [...(data || []), ...dc]
  }, [data, drchronoData])

  const filtered = useMemo(() => {
    if (tab === 'Active') return allItems.filter((a: any) => a.status === 'active' || a.status === 'confirmed')
    return allItems
  }, [allItems, tab])

  const activeCount = allItems.filter((a: any) => a.status === 'active' || a.status === 'confirmed').length

  const resetForm = () => { setForm({ allergen_name: '', allergy_type: 'medication', severity: 'moderate', reaction: '', status: 'active', onset_date: '', notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.allergen_name.trim()) return
    if (editId) await update(editId, { ...form, patient_id: patientId })
    else await create({ ...form, patient_id: patientId })
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Allergies — ${patientName}`} icon={AlertTriangle} accentColor="#ef4444" loading={loading}
      error={error} hasData={allItems.length > 0 || showAdd} emptyMessage="No known allergies (NKA)"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={activeCount > 0 ? activeCount : 'NKA'}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-red-400 text-red-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Active' && activeCount > 0 && <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded">{activeCount}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.allergen_name} onChange={e => setForm({...form, allergen_name: e.target.value})}
                placeholder="Allergen name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.allergy_type} onChange={e => setForm({...form, allergy_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <input value={form.reaction} onChange={e => setForm({...form, reaction: e.target.value})}
                placeholder="Reaction (e.g., hives, anaphylaxis)..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.onset_date} onChange={e => setForm({...form, onset_date: e.target.value})} type="date"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes..." rows={2}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.allergen_name.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? '...' : editId ? 'Update' : 'Add'}</button>
              </div>
            </div>
          )}

          {/* By Severity tab - grouped */}
          {tab === 'By Severity' && SEVERITIES.map(sev => {
            const items = allItems.filter((a: any) => a.severity === sev)
            if (items.length === 0) return null
            return (
              <div key={sev}>
                <div className={`text-[10px] uppercase tracking-wide font-bold mb-1 ${SEVERITY_COLORS[sev]?.split(' ')[1] || 'text-gray-400'}`}>
                  {sev.replace('_', ' ')} ({items.length})
                </div>
                {items.map((a: any, i: number) => (
                  <div key={a.id || i} className={`bg-[#0a1f1f] border rounded-lg p-2.5 mb-1 ${sev === 'life_threatening' ? 'border-red-500/40' : 'border-[#1a3d3d]'}`}>
                    <span className="text-sm text-white">{a.allergen_name}</span>
                    {a.reaction && <span className="text-xs text-gray-500 ml-2">→ {a.reaction}</span>}
                  </div>
                ))}
              </div>
            )
          })}

          {/* Active / All tabs */}
          {tab !== 'By Severity' && filtered.map((a: any, i: number) => (
            <div key={a.id || i} className={`bg-[#0a1f1f] border rounded-lg p-3 flex items-start gap-3 ${
              a.severity === 'life_threatening' ? 'border-red-500/40' : a.severity === 'severe' ? 'border-orange-500/30' : 'border-[#1a3d3d]'
            }`}>
              <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                a.severity === 'life_threatening' ? 'text-red-400' : a.severity === 'severe' ? 'text-orange-400' : 'text-amber-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{a.allergen_name}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.moderate}`}>
                    {(a.severity || 'moderate').replace('_', ' ').toUpperCase()}
                  </span>
                  {a._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {a.allergy_type && <span className="capitalize">{a.allergy_type}</span>}
                  {a.reaction && <span className="ml-2">Reaction: {a.reaction}</span>}
                  {a.onset_date && <span className="ml-2">Since {new Date(a.onset_date).toLocaleDateString()}</span>}
                </div>
                {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
              </div>
              {!a._source && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(a.id); setForm({ allergen_name: a.allergen_name, allergy_type: a.allergy_type || 'medication', severity: a.severity || 'moderate', reaction: a.reaction || '', status: a.status || 'active', onset_date: a.onset_date || '', notes: a.notes || '' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(a.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
