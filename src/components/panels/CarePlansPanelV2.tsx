'use client'
import React, { useState } from 'react'
import { ClipboardCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function CarePlansPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'care-plans', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', goals: '', status: 'active' })

  const resetForm = () => { setForm({ title: '', description: '', goals: '', status: 'active' }); setShowAdd(false); setEditId(null) }
  const handleSave = async () => {
    if (!form.title.trim()) return
    if (editId) await update(editId, form); else await create(form)
    resetForm()
  }

  if (!isOpen) return null
  const active = data.filter((p: any) => p.status === 'active')
  const other = data.filter((p: any) => p.status !== 'active')

  return (
    <PanelBase title={`Care Plans — ${patientName}`} icon={ClipboardCheck} accentColor="#a855f7" loading={loading} error={error}
      hasData={data.length > 0} emptyMessage="No care plans" emptyIcon={ClipboardCheck} onRetry={refetch} onClose={onClose} draggable={false}
      badge={active.length > 0 ? `${active.length} active` : undefined}
      headerActions={<button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="p-3 space-y-2">
        {(showAdd || editId) && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Plan title..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." rows={2}
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <textarea value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} placeholder="Goals..." rows={2}
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm w-full">
              <option value="active">Active</option><option value="completed">Completed</option><option value="on_hold">On Hold</option><option value="cancelled">Cancelled</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="px-3 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Create Plan'}</button>
            </div>
          </div>
        )}
        {active.map((p: any) => (
          <div key={p.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{p.title}</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30">ACTIVE</span></div>
              {p.description && <p className="text-xs text-gray-400 mt-1">{p.description}</p>}
              {p.goals && <p className="text-xs text-teal-400 mt-1">Goals: {p.goals}</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditId(p.id); setForm({ title: p.title||'', description: p.description||'', goals: p.goals||'', status: p.status||'active' }) }} className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => remove(p.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {other.length > 0 && (
          <div><p className="text-[9px] text-gray-500 uppercase font-semibold mt-2">Completed / Other ({other.length})</p>
            {other.map((p: any) => (
              <div key={p.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2 mb-1 opacity-60 flex items-center gap-2">
                <span className="text-xs text-gray-400 flex-1 truncate">{p.title}</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">{p.status}</span>
              </div>))}
          </div>
        )}
      </div>
    </PanelBase>
  )
}
