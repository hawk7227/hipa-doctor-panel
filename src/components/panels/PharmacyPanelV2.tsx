// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState } from 'react'
import { Building2, Plus, Star, Pencil, Trash2, Phone, MapPin } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function PharmacyPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'pharmacy', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ pharmacy_name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', is_preferred: false, pharmacy_type: 'retail', notes: '' })

  const handleSave = async () => {
    if (!form.pharmacy_name) return
    await create({ ...form, patient_id: patientId })
    setShowAdd(false); setForm({ pharmacy_name: '', phone: '', fax: '', address: '', city: '', state: '', zip: '', is_preferred: false, pharmacy_type: 'retail', notes: '' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Pharmacy — ${patientName}`} icon={Building2} accentColor="#ec4899" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No pharmacies on file"
      onRetry={refetch} onClose={onClose} draggable={false} badge={data.length || undefined}
      headerActions={<button onClick={() => setShowAdd(!showAdd)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="p-3 space-y-2">
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <input value={form.pharmacy_name} onChange={e => setForm({...form, pharmacy_name: e.target.value})}
              placeholder="Pharmacy name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.fax} onChange={e => setForm({...form, fax: e.target.value})} placeholder="Fax" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="City" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} placeholder="State" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <input value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} placeholder="ZIP" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={form.is_preferred} onChange={e => setForm({...form, is_preferred: e.target.checked})} /> Preferred pharmacy
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.pharmacy_name} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </div>
        )}
        {data.map((p: any) => (
          <div key={p.id} className={`bg-[#0a1f1f] border rounded-lg p-3 ${p.is_preferred ? 'border-pink-500/40' : 'border-[#1a3d3d]'}`}>
            <div className="flex items-center gap-2">
              {p.is_preferred && <Star className="w-3.5 h-3.5 text-pink-400 fill-pink-400 flex-shrink-0" />}
              <span className="text-sm font-semibold text-white flex-1">{p.pharmacy_name}</span>
              <button onClick={() => remove(p.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
            {p.phone && <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</div>}
            {p.address && <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.address}{p.city ? `, ${p.city}` : ''}{p.state ? `, ${p.state}` : ''} {p.zip}</div>}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
