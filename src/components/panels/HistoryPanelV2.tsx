'use client'
import React, { useState, useMemo } from 'react'
import { BookOpen, Plus, Pencil, Trash2, Heart, Scissors, Users, Coffee } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; historyType?: string }

const TABS = ['Medical', 'Surgical', 'Family', 'Social'] as const
const TAB_ICONS: Record<string, React.ElementType> = { Medical: Heart, Surgical: Scissors, Family: Users, Social: Coffee }
const TAB_TYPES: Record<string, string> = { Medical: 'medical', Surgical: 'surgical', Family: 'family', Social: 'social' }

const SOCIAL_CATEGORIES = ['smoking', 'alcohol', 'drugs', 'exercise', 'diet', 'occupation', 'sexual_health', 'housing', 'education', 'stress'] as const
const RELATIONSHIPS = ['mother', 'father', 'sister', 'brother', 'grandmother', 'grandfather', 'aunt', 'uncle', 'child', 'other'] as const

export default function HistoryPanelV2({ isOpen, onClose, patientId, patientName, historyType }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'history', patientId })
  const initialTab = historyType ? (TABS.find(t => TAB_TYPES[t] === historyType) || 'Medical') : 'Medical'
  const [tab, setTab] = useState<typeof TABS[number]>(initialTab as typeof TABS[number])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    description: '', icd10_code: '', onset_date: '', status: 'active', notes: '',
    relationship: '', age_at_onset: '', is_deceased: false, cause_of_death: '',
    category: '', value: '', quantity: '', frequency: '', duration: ''
  })

  const filtered = useMemo(() => (data || []).filter((h: any) => h.history_type === TAB_TYPES[tab]), [data, tab])

  const resetForm = () => {
    setForm({ description: '', icd10_code: '', onset_date: '', status: 'active', notes: '',
      relationship: '', age_at_onset: '', is_deceased: false, cause_of_death: '',
      category: '', value: '', quantity: '', frequency: '', duration: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.description.trim()) return
    const payload: any = { ...form, patient_id: patientId, history_type: TAB_TYPES[tab] }
    if (form.age_at_onset) payload.age_at_onset = parseInt(form.age_at_onset)
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  const startEdit = (item: any) => {
    setEditId(item.id)
    setForm({
      description: item.description || '', icd10_code: item.icd10_code || '', onset_date: item.onset_date || '',
      status: item.status || 'active', notes: item.notes || '', relationship: item.relationship || '',
      age_at_onset: item.age_at_onset?.toString() || '', is_deceased: item.is_deceased || false,
      cause_of_death: item.cause_of_death || '', category: item.category || '',
      value: item.value || '', quantity: item.quantity || '', frequency: item.frequency || '', duration: item.duration || ''
    })
    setShowAdd(true)
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`History — ${patientName}`} icon={BookOpen} accentColor="#f97316" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No history recorded"
      onRetry={refetch} onClose={onClose} draggable={false} badge={data.length || undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => {
            const Icon = TAB_ICONS[t]
            const count = (data || []).filter((h: any) => h.history_type === TAB_TYPES[t]).length
            return (
              <button key={t} onClick={() => { setTab(t); resetForm() }}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-orange-400 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <Icon className="w-3 h-3" />{t}
                {count > 0 && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1 rounded">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-orange-400 mb-1">{editId ? 'Edit' : 'Add'} {tab} History</div>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder={tab === 'Social' ? 'Category description...' : tab === 'Family' ? 'Condition...' : 'Condition / procedure...'}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              
              <div className="grid grid-cols-2 gap-2">
                {(tab === 'Medical' || tab === 'Surgical') && (
                  <>
                    <input value={form.icd10_code} onChange={e => setForm({...form, icd10_code: e.target.value})}
                      placeholder="ICD-10 code" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                    <input value={form.onset_date} onChange={e => setForm({...form, onset_date: e.target.value})} type="date"
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                  </>
                )}
                {tab === 'Family' && (
                  <>
                    <select value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})}
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                      <option value="">Relationship...</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                    <input value={form.age_at_onset} onChange={e => setForm({...form, age_at_onset: e.target.value})}
                      placeholder="Age at onset" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                  </>
                )}
                {tab === 'Social' && (
                  <>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                      <option value="">Category...</option>
                      {SOCIAL_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                    <input value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})}
                      placeholder="Frequency" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                  </>
                )}
              </div>
              {tab === 'Family' && (
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={form.is_deceased} onChange={e => setForm({...form, is_deceased: e.target.checked})} /> Deceased
                </label>
              )}
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes..." rows={2}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.description.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add'}</button>
              </div>
            </div>
          )}

          {filtered.map((item: any) => (
            <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white">{item.description}</span>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                  {item.icd10_code && <span className="font-mono bg-[#0d2626] px-1.5 py-0.5 rounded">{item.icd10_code}</span>}
                  {item.onset_date && <span>Onset: {new Date(item.onset_date).toLocaleDateString()}</span>}
                  {item.relationship && <span className="capitalize text-orange-400">{item.relationship}</span>}
                  {item.age_at_onset && <span>Age {item.age_at_onset}</span>}
                  {item.is_deceased && <span className="text-red-400">Deceased</span>}
                  {item.category && <span className="capitalize">{item.category.replace('_', ' ')}</span>}
                  {item.frequency && <span>{item.frequency}</span>}
                  {item.duration && <span>{item.duration}</span>}
                </div>
                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(item)} className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => remove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !showAdd && (
            <div className="text-center py-6 text-xs text-gray-500">No {tab.toLowerCase()} history recorded</div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
