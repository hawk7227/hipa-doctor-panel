// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState } from 'react'
import { Syringe, Plus, Pencil, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }
const TABS = ['Administered', 'Due/Overdue'] as const

export default function ImmunizationsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, remove, saving } = usePanelData({ endpoint: 'immunizations', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Administered')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ vaccine_name: '', cvx_code: '', lot_number: '', manufacturer: '', dose_number: '', administration_date: '', site: '', route: 'intramuscular', administered_by: '', notes: '' })

  const handleSave = async () => {
    if (!form.vaccine_name || !form.administration_date) return
    await create({ ...form, patient_id: patientId, dose_number: form.dose_number ? parseInt(form.dose_number) : null })
    setShowAdd(false); setForm({ vaccine_name: '', cvx_code: '', lot_number: '', manufacturer: '', dose_number: '', administration_date: '', site: '', route: 'intramuscular', administered_by: '', notes: '' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Immunizations — ${patientName}`} icon={Syringe} accentColor="#10b981" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No immunizations recorded"
      onRetry={refetch} onClose={onClose} draggable={false} badge={data.length || undefined}
      headerActions={<button onClick={() => setShowAdd(!showAdd)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.vaccine_name} onChange={e => setForm({...form, vaccine_name: e.target.value})}
                placeholder="Vaccine name (e.g., Influenza, COVID-19)..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.cvx_code} onChange={e => setForm({...form, cvx_code: e.target.value})} placeholder="CVX Code" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.lot_number} onChange={e => setForm({...form, lot_number: e.target.value})} placeholder="Lot #" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} placeholder="Manufacturer" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.dose_number} onChange={e => setForm({...form, dose_number: e.target.value})} placeholder="Dose #" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.administration_date} onChange={e => setForm({...form, administration_date: e.target.value})} type="date" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.route} onChange={e => setForm({...form, route: e.target.value})} className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="intramuscular">IM</option><option value="subcutaneous">SubQ</option><option value="intradermal">ID</option><option value="oral">Oral</option><option value="intranasal">Intranasal</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.vaccine_name} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : 'Record'}</button>
              </div>
            </div>
          )}
          {tab === 'Administered' && data.map((v: any) => (
            <div key={v.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{v.vaccine_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {v.administration_date && <span>{new Date(v.administration_date).toLocaleDateString()}</span>}
                  {v.dose_number && <span className="ml-2">Dose #{v.dose_number}</span>}
                  {v.lot_number && <span className="ml-2">Lot: {v.lot_number}</span>}
                  {v.route && <span className="ml-2 capitalize">{v.route}</span>}
                </div>
              </div>
              <button onClick={() => remove(v.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          {tab === 'Due/Overdue' && (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Immunization schedule analysis coming soon</p>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
