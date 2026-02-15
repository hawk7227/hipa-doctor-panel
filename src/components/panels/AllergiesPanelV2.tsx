'use client'

import React, { useState } from 'react'
import { AlertTriangle, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  moderate: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  severe: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function AllergiesPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'allergies', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ allergen: '', reaction: '', severity: 'mild', status: 'active', notes: '' })

  const allItems = [...data, ...drchronoData.map((d: any) => ({ ...d, _source: 'drchrono', allergen: d.reaction || d.description || 'Unknown' }))]

  const resetForm = () => { setForm({ allergen: '', reaction: '', severity: 'mild', status: 'active', notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.allergen.trim()) return
    if (editId) {
      await update(editId, form)
    } else {
      await create(form)
    }
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase
      title={`Allergies — ${patientName}`}
      icon={AlertTriangle}
      accentColor="#ef4444"
      loading={loading}
      error={error}
      hasData={allItems.length > 0}
      emptyMessage="No known allergies"
      emptyIcon={ShieldAlert}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={allItems.length > 0 ? allItems.length : undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300 transition-colors" title="Add allergy">
          <Plus className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="p-3 space-y-2">
        {/* Add/Edit Form */}
        {(showAdd || editId) && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.allergen} onChange={e => setForm({ ...form, allergen: e.target.value })}
              placeholder="Allergen name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <input value={form.reaction} onChange={e => setForm({ ...form, reaction: e.target.value })}
              placeholder="Reaction (e.g. hives, anaphylaxis)..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="flex gap-2">
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm flex-1">
                <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
              </select>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm flex-1">
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="resolved">Resolved</option>
              </select>
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.allergen.trim()}
                className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Allergy List */}
        {allItems.map((item: any, idx: number) => (
          <div key={item.id || idx} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{item.allergen || item.reaction || 'Unknown'}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.mild}`}>
                  {(item.severity || 'mild').toUpperCase()}
                </span>
                {item.status && item.status !== 'active' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">{item.status}</span>
                )}
                {item._source === 'drchrono' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>
                )}
              </div>
              {item.reaction && item.reaction !== item.allergen && (
                <p className="text-xs text-gray-400 mt-1">Reaction: {item.reaction}</p>
              )}
              {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
            </div>
            {!item._source && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditId(item.id); setForm({ allergen: item.allergen || '', reaction: item.reaction || '', severity: item.severity || 'mild', status: item.status || 'active', notes: item.notes || '' }) }}
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
