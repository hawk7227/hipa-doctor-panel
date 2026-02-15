'use client'

import React, { useState } from 'react'
import { Pill, Plus, Pencil, Trash2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  discontinued: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  on_hold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

export default function MedicationsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'medications', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '', route: '', status: 'active', notes: '' })

  const allItems = [
    ...data,
    ...drchronoData.map((d: any) => ({ ...d, _source: 'drchrono', name: d.name || d.medication_name || 'Unknown' })),
  ]

  const resetForm = () => { setForm({ name: '', dosage: '', frequency: '', route: '', status: 'active', notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editId) { await update(editId, form) } else { await create(form) }
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase
      title={`Medications — ${patientName}`}
      icon={Pill}
      accentColor="#06b6d4"
      loading={loading}
      error={error}
      hasData={allItems.length > 0}
      emptyMessage="No medications on record"
      emptyIcon={Pill}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={allItems.length > 0 ? allItems.length : undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300" title="Add medication"><Plus className="w-3.5 h-3.5" /></button>
      }
    >
      <div className="p-3 space-y-2">
        {(showAdd || editId) && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Medication name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })}
                placeholder="Dosage (e.g. 500mg)" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                placeholder="Frequency (e.g. BID)" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.route} onChange={e => setForm({ ...form, route: e.target.value })}
                placeholder="Route (e.g. oral)" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                <option value="active">Active</option><option value="discontinued">Discontinued</option>
                <option value="completed">Completed</option><option value="on_hold">On Hold</option>
              </select>
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {allItems.map((item: any, idx: number) => (
          <div key={item.id || idx} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{item.name || item.medication_name || 'Unknown'}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.active}`}>
                  {(item.status || 'active').toUpperCase()}
                </span>
                {item._source === 'drchrono' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>
                )}
              </div>
              <div className="flex gap-3 mt-1 text-xs text-gray-400">
                {item.dosage && <span>{item.dosage}</span>}
                {item.frequency && <span>• {item.frequency}</span>}
                {item.route && <span>• {item.route}</span>}
              </div>
              {item.sig && <p className="text-xs text-gray-500 mt-1 italic">Sig: {item.sig}</p>}
              {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
            </div>
            {!item._source && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditId(item.id); setForm({ name: item.name || '', dosage: item.dosage || '', frequency: item.frequency || '', route: item.route || '', status: item.status || 'active', notes: item.notes || '' }) }}
                  className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => remove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
