'use client'
import React, { useState, useMemo } from 'react'
import { ClipboardList, Plus, Pencil, Trash2, Clock, CheckCircle, Image, Stethoscope, Package } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const TABS = ['All', 'Imaging', 'Procedures', 'DME'] as const
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}
const ORDER_TYPES = ['imaging', 'procedure', 'dme', 'therapy', 'consultation', 'other'] as const
const PRIORITIES = ['routine', 'urgent', 'stat', 'asap'] as const

export default function OrdersPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'orders', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('All')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    order_type: 'imaging', description: '', cpt_code: '', priority: 'routine',
    performing_facility: '', performing_provider: '', diagnosis_codes: '',
    special_instructions: '', status: 'pending', notes: ''
  })

  const filtered = useMemo(() => {
    if (tab === 'All') return data || []
    const typeMap: Record<string, string> = { Imaging: 'imaging', Procedures: 'procedure', DME: 'dme' }
    return (data || []).filter((o: any) => o.order_type === typeMap[tab])
  }, [data, tab])

  const pendingCount = (data || []).filter((o: any) => o.status === 'pending' || o.status === 'draft').length

  const resetForm = () => {
    setForm({ order_type: 'imaging', description: '', cpt_code: '', priority: 'routine',
      performing_facility: '', performing_provider: '', diagnosis_codes: '',
      special_instructions: '', status: 'pending', notes: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.description.trim()) return
    const payload: any = { ...form, patient_id: patientId }
    if (appointmentId) payload.appointment_id = appointmentId
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Orders — ${patientName}`} icon={ClipboardList} accentColor="#06b6d4" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No orders placed"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={pendingCount > 0 ? `${pendingCount} pending` : data.length || undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => {
            const Icon = t === 'Imaging' ? Image : t === 'Procedures' ? Stethoscope : t === 'DME' ? Package : ClipboardList
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <Icon className="w-3 h-3" />{t}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Order description..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.order_type} onChange={e => setForm({...form, order_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
                <input value={form.cpt_code} onChange={e => setForm({...form, cpt_code: e.target.value})} placeholder="CPT code"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.diagnosis_codes} onChange={e => setForm({...form, diagnosis_codes: e.target.value})} placeholder="ICD-10 codes"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.performing_facility} onChange={e => setForm({...form, performing_facility: e.target.value})} placeholder="Facility"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.performing_provider} onChange={e => setForm({...form, performing_provider: e.target.value})} placeholder="Provider"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <textarea value={form.special_instructions} onChange={e => setForm({...form, special_instructions: e.target.value})}
                placeholder="Special instructions..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.description.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? '...' : 'Place Order'}</button>
              </div>
            </div>
          )}

          {filtered.map((order: any) => {
            const TypeIcon = order.order_type === 'imaging' ? Image : order.order_type === 'procedure' ? Stethoscope : order.order_type === 'dme' ? Package : ClipboardList
            return (
              <div key={order.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
                <TypeIcon className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{order.description}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[order.status] || ''}`}>{(order.status || '').toUpperCase()}</span>
                    {order.priority !== 'routine' && <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${order.priority === 'stat' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{order.priority?.toUpperCase()}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {order.cpt_code && <span className="font-mono mr-2">{order.cpt_code}</span>}
                    {order.performing_facility && <span>{order.performing_facility}</span>}
                    {order.ordered_date && <span className="ml-2">{new Date(order.ordered_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(order.id); setForm({ order_type: order.order_type || 'imaging', description: order.description, cpt_code: order.cpt_code || '', priority: order.priority || 'routine', performing_facility: order.performing_facility || '', performing_provider: order.performing_provider || '', diagnosis_codes: order.diagnosis_codes || '', special_instructions: order.special_instructions || '', status: order.status || 'pending', notes: order.notes || '' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(order.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PanelBase>
  )
}
