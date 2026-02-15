'use client'

import React, { useState } from 'react'
import { Stethoscope, Plus, Pencil, Trash2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName?: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-500/20 text-red-400 border-red-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  chronic: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function ProblemsPanelV2({ isOpen, onClose, patientId, patientName = 'Patient' }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'problems', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', icd_code: '', status: 'active', date_diagnosis: '', notes: '' })

  const resetForm = () => { setForm({ name: '', icd_code: '', status: 'active', date_diagnosis: '', notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editId) { await update(editId, form) } else { await create(form) }
    resetForm()
  }

  if (!isOpen) return null

  const active = data.filter((p: any) => p.status === 'active' || p.status === 'chronic')
  const resolved = data.filter((p: any) => p.status !== 'active' && p.status !== 'chronic')

  return (
    <PanelBase
      title={`Problems — ${patientName}`}
      icon={Stethoscope}
      accentColor="#f97316"
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No problems on record"
      emptyIcon={Stethoscope}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={active.length > 0 ? `${active.length} active` : undefined}
      syncStatus={data.length > 0 ? 'synced' : null}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300" title="Add problem"><Plus className="w-3.5 h-3.5" /></button>
      }
    >
      <div className="p-3 space-y-2">
        {(showAdd || editId) && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Problem name / diagnosis..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input value={form.icd_code} onChange={e => setForm({ ...form, icd_code: e.target.value })}
                placeholder="ICD-10 code" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                <option value="active">Active</option><option value="chronic">Chronic</option>
                <option value="resolved">Resolved</option><option value="inactive">Inactive</option>
              </select>
              <input value={form.date_diagnosis} onChange={e => setForm({ ...form, date_diagnosis: e.target.value })}
                type="date" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
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

        {/* Active Problems */}
        {active.length > 0 && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1">Active / Chronic ({active.length})</p>
            {active.map((item: any) => (
              <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 mb-1 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{item.name}</span>
                    {item.icd_code && <span className="px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 bg-cyan-500/10 rounded border border-cyan-500/20">{item.icd_code}</span>}
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.active}`}>
                      {item.status?.toUpperCase()}
                    </span>
                  </div>
                  {item.date_diagnosis && <p className="text-xs text-gray-500 mt-1">Diagnosed: {new Date(item.date_diagnosis).toLocaleDateString()}</p>}
                  {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(item.id); setForm({ name: item.name || '', icd_code: item.icd_code || '', status: item.status || 'active', date_diagnosis: item.date_diagnosis || '', notes: item.notes || '' }) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1 mt-2">Resolved / Inactive ({resolved.length})</p>
            {resolved.map((item: any) => (
              <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2 mb-1 opacity-60 flex items-center gap-2">
                <span className="text-xs text-gray-400 flex-1">{item.name}</span>
                {item.icd_code && <span className="text-[9px] font-mono text-gray-500">{item.icd_code}</span>}
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.inactive}`}>{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelBase>
  )
}
