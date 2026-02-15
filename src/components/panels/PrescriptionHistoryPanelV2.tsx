'use client'

import React, { useState } from 'react'
import { Pill, Plus, Pencil, Trash2, FileText } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  filled: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  denied: 'bg-red-500/20 text-red-400 border-red-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export default function PrescriptionHistoryPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const { data, drchronoData, loading, error, refetch, create, remove, saving } = usePanelData({ endpoint: 'prescriptions', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ medication_name: '', dosage: '', frequency: '', quantity: '', refills: '0', pharmacy: '', notes: '' })

  const handleSave = async () => {
    if (!form.medication_name.trim()) return
    await create({ ...form, refills: parseInt(form.refills) || 0, appointment_id: appointmentId || null })
    setForm({ medication_name: '', dosage: '', frequency: '', quantity: '', refills: '0', pharmacy: '', notes: '' })
    setShowAdd(false)
  }

  if (!isOpen) return null

  // Merge: local prescriptions + DrChrono meds as Rx history
  const allRx = [
    ...data.map((d: any) => ({ ...d, _source: 'local' })),
    ...drchronoData.map((d: any) => ({
      id: `dc-${d.id}`, _source: 'drchrono',
      medication_name: d.name || d.medication_name || 'Unknown',
      dosage: d.dosage || (d.dosage_quantity ? `${d.dosage_quantity}${d.dosage_unit ? ' ' + d.dosage_unit : ''}` : null) || d.dose || null,
      frequency: d.frequency || null,
      status: d.status || 'active',
      created_at: d.date_prescribed || d.created_at,
      pharmacy: null, notes: d.sig || null,
      quantity: d.quantity || null, refills: d.refills || null,
    })),
  ].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  return (
    <PanelBase
      title={`Prescription History — ${patientName}`}
      icon={Pill}
      accentColor="#8b5cf6"
      loading={loading}
      error={error}
      hasData={allRx.length > 0}
      emptyMessage="No prescriptions on record"
      emptyIcon={Pill}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={allRx.length > 0 ? allRx.length : undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300" title="New Rx"><Plus className="w-3.5 h-3.5" /></button>
      }
    >
      <div className="p-3 space-y-2">
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.medication_name} onChange={e => setForm({ ...form, medication_name: e.target.value })}
              placeholder="Medication name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })}
                placeholder="Dosage" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                placeholder="Frequency" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                placeholder="Qty" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.refills} onChange={e => setForm({ ...form, refills: e.target.value })}
                placeholder="Refills" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.pharmacy} onChange={e => setForm({ ...form, pharmacy: e.target.value })}
                placeholder="Pharmacy" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Sig / Notes..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.medication_name.trim()}
                className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? 'Saving...' : 'Add Prescription'}
              </button>
            </div>
          </div>
        )}

        {allRx.map((rx: any) => (
          <div key={rx.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{rx.medication_name}</span>
                {rx.status && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[rx.status] || STATUS_COLORS.pending}`}>
                    {(rx.status || 'pending').toUpperCase()}
                  </span>
                )}
                {rx._source === 'drchrono' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>
                )}
              </div>
              <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                {rx.dosage && <span>{rx.dosage}</span>}
                {rx.frequency && <span>• {rx.frequency}</span>}
                {rx.quantity && <span>• Qty: {rx.quantity}</span>}
                {rx.refills != null && <span>• Refills: {rx.refills}</span>}
              </div>
              {rx.pharmacy && <p className="text-xs text-gray-500 mt-1">Pharmacy: {rx.pharmacy}</p>}
              {rx.notes && <p className="text-xs text-gray-500 mt-1 italic">{rx.notes}</p>}
              {rx.created_at && <p className="text-[10px] text-gray-600 mt-1">{new Date(rx.created_at).toLocaleDateString()}</p>}
            </div>
            {rx._source === 'local' && (
              <button onClick={() => remove(rx.id)} className="p-1 text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
            )}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
