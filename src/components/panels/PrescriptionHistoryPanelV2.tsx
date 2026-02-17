// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { FileText, Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const TABS = ['Active', 'All', 'Refills Due'] as const
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  filled: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function PrescriptionHistoryPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'prescriptions', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    medication_name: '', dosage: '', frequency: '', quantity: '', refills: '0',
    dea_schedule: '', pharmacy: '', sig: '', dispense_as_written: false,
    prior_auth_required: false, notes: '', status: 'pending'
  })

  const allItems = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', medication_name: d.name || d.medication_name || 'Unknown' }))
    return [...(data || []), ...dc].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [data, drchronoData])

  const filtered = useMemo(() => {
    if (tab === 'Active') return allItems.filter((r: any) => ['active', 'sent', 'filled', 'pending'].includes(r.status))
    if (tab === 'Refills Due') return allItems.filter((r: any) => ['active', 'filled'].includes(r.status) && r.refills != null && r.refills <= 1)
    return allItems
  }, [allItems, tab])

  const refillsDue = allItems.filter((r: any) => ['active', 'filled'].includes(r.status) && r.refills != null && r.refills <= 1).length

  const resetForm = () => {
    setForm({ medication_name: '', dosage: '', frequency: '', quantity: '', refills: '0', dea_schedule: '', pharmacy: '', sig: '', dispense_as_written: false, prior_auth_required: false, notes: '', status: 'pending' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.medication_name.trim()) return
    const payload: any = { ...form, patient_id: patientId, refills: parseInt(form.refills) || 0, quantity: form.quantity ? parseInt(form.quantity) : null }
    if (appointmentId) payload.appointment_id = appointmentId
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Prescriptions — ${patientName}`} icon={FileText} accentColor="#ec4899" loading={loading}
      error={error} hasData={allItems.length > 0 || showAdd} emptyMessage="No prescriptions"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={refillsDue > 0 ? `${refillsDue} refills due` : allItems.length || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-pink-400 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Refills Due' && refillsDue > 0 && <span className="ml-1 text-[9px] bg-pink-500/20 text-pink-400 px-1 rounded">{refillsDue}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.medication_name} onChange={e => setForm({...form, medication_name: e.target.value})}
                placeholder="Medication name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} placeholder="Dosage" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} placeholder="Frequency" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} placeholder="Qty" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.refills} onChange={e => setForm({...form, refills: e.target.value})} placeholder="Refills" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.dea_schedule} onChange={e => setForm({...form, dea_schedule: e.target.value})} className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="">No DEA Schedule</option><option value="II">Schedule II</option><option value="III">Schedule III</option><option value="IV">Schedule IV</option><option value="V">Schedule V</option>
                </select>
                <input value={form.pharmacy} onChange={e => setForm({...form, pharmacy: e.target.value})} placeholder="Pharmacy" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <input value={form.sig} onChange={e => setForm({...form, sig: e.target.value})} placeholder="SIG (directions)..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="flex gap-4 text-xs text-gray-400">
                <label className="flex items-center gap-1"><input type="checkbox" checked={form.dispense_as_written} onChange={e => setForm({...form, dispense_as_written: e.target.checked})} /> DAW</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={form.prior_auth_required} onChange={e => setForm({...form, prior_auth_required: e.target.checked})} /> Prior Auth Required</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.medication_name.trim()} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? '...' : 'Prescribe'}</button>
              </div>
            </div>
          )}

          {filtered.map((rx: any, i: number) => (
            <div key={rx.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
              <FileText className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{rx.medication_name}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[rx.status] || STATUS_COLORS.pending}`}>{(rx.status || 'pending').toUpperCase()}</span>
                  {rx.dea_schedule && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">C-{rx.dea_schedule}</span>}
                  {rx.prior_auth_required && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400">PA REQ</span>}
                  {rx._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {rx.dosage && <span>{rx.dosage}</span>}
                  {rx.frequency && <span className="ml-2">{rx.frequency}</span>}
                  {rx.quantity && <span className="ml-2">Qty: {rx.quantity}</span>}
                  {rx.refills != null && <span className="ml-2">Refills: {rx.refills}</span>}
                </div>
                {rx.sig && <p className="text-xs text-gray-400 mt-0.5 italic">{rx.sig}</p>}
                {rx.pharmacy && <div className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" />{rx.pharmacy}</div>}
              </div>
              {!rx._source && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(rx.id); setForm({ medication_name: rx.medication_name, dosage: rx.dosage || '', frequency: rx.frequency || '', quantity: rx.quantity?.toString() || '', refills: rx.refills?.toString() || '0', dea_schedule: rx.dea_schedule || '', pharmacy: rx.pharmacy || '', sig: rx.sig || '', dispense_as_written: rx.dispense_as_written || false, prior_auth_required: rx.prior_auth_required || false, notes: rx.notes || '', status: rx.status || 'pending' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(rx.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
