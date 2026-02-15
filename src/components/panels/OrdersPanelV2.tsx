'use client'

import React, { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, ClipboardList } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const ORDER_TYPES = ['lab', 'imaging', 'referral', 'procedure', 'medication', 'other'] as const
const PRIORITIES = ['stat', 'urgent', 'routine'] as const

const PRIORITY_COLORS: Record<string, string> = {
  stat: 'bg-red-500/20 text-red-400 border-red-500/30',
  urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  routine: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}
const TYPE_ICONS: Record<string, string> = { lab: '🧪', imaging: '📷', referral: '➡️', procedure: '⚕️', medication: '💊', other: '📋' }

export default function OrdersPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'orders', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ order_type: 'lab', description: '', priority: 'routine', status: 'pending', notes: '' })

  const resetForm = () => { setForm({ order_type: 'lab', description: '', priority: 'routine', status: 'pending', notes: '' }); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.description.trim()) return
    const payload = { ...form, appointment_id: appointmentId || null }
    if (editId) { await update(editId, payload) } else { await create(payload) }
    resetForm()
  }

  if (!isOpen) return null

  const pending = data.filter((o: any) => o.status === 'pending' || o.status === 'in_progress')
  const completed = data.filter((o: any) => o.status === 'completed' || o.status === 'cancelled')

  return (
    <PanelBase
      title={`Orders — ${patientName}`}
      icon={ClipboardList}
      accentColor="#3b82f6"
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No orders on record"
      emptyIcon={ClipboardList}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={pending.length > 0 ? `${pending.length} pending` : undefined}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300" title="New order"><Plus className="w-3.5 h-3.5" /></button>
      }
    >
      <div className="p-3 space-y-2">
        {(showAdd || editId) && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select value={form.order_type} onChange={e => setForm({ ...form, order_type: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                {ORDER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                <option value="pending">Pending</option><option value="in_progress">In Progress</option>
                <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Order description..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.description.trim()}
                className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create Order'}
              </button>
            </div>
          </div>
        )}

        {/* Pending Orders */}
        {pending.map((item: any) => (
          <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <span className="text-lg flex-shrink-0">{TYPE_ICONS[item.order_type] || '📋'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{item.description || item.order_type}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.routine}`}>
                  {item.priority?.toUpperCase()}
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}>
                  {item.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
              {item.created_at && <p className="text-[10px] text-gray-600 mt-1">{new Date(item.created_at).toLocaleString()}</p>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { setEditId(item.id); setForm({ order_type: item.order_type || 'lab', description: item.description || '', priority: item.priority || 'routine', status: item.status || 'pending', notes: item.notes || '' }) }}
                className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => remove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1 mt-2">Completed / Cancelled ({completed.length})</p>
            {completed.map((item: any) => (
              <div key={item.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2 mb-1 opacity-60 flex items-center gap-2">
                <span className="text-sm">{TYPE_ICONS[item.order_type] || '📋'}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{item.description || item.order_type}</span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}>{item.status || 'completed'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelBase>
  )
}
