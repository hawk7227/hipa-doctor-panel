'use client'
import React, { useState } from 'react'
import { Building2, Pencil, Save } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function PharmacyPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch } = usePanelData({ endpoint: 'pharmacy', patientId })
  const [editing, setEditing] = useState(false)
  const [pharmacyName, setPharmacyName] = useState('')
  const [saving, setSaving] = useState(false)

  const pharmacy = data[0]?.pharmacy || null
  const dc = data[0]?._drchrono || drchronoData[0] || null

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/panels/pharmacy', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, preferred_pharmacy: pharmacyName }) })
      setEditing(false); refetch()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  if (!isOpen) return null
  return (
    <PanelBase title={`Pharmacy — ${patientName}`} icon={Building2} accentColor="#14b8a6" loading={loading} error={error}
      hasData={!!pharmacy || !!dc} emptyMessage="No pharmacy on file" emptyIcon={Building2} onRetry={refetch} onClose={onClose} draggable={false}
      syncStatus={dc ? 'synced' : null}
      headerActions={
        editing
          ? <button onClick={handleSave} disabled={saving} className="p-1 text-teal-400 hover:text-teal-300"><Save className="w-3.5 h-3.5" /></button>
          : <button onClick={() => { setPharmacyName(pharmacy || ''); setEditing(true) }} className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3.5 h-3.5" /></button>
      }>
      <div className="p-3 space-y-3">
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
          <p className="text-[9px] text-gray-500 uppercase mb-1">Preferred Pharmacy</p>
          {editing ? (
            <input value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} placeholder="Pharmacy name / address..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
          ) : (
            <p className="text-sm text-white font-medium">{pharmacy || 'Not specified'}</p>
          )}
        </div>
        {dc && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
            <p className="text-[9px] text-gray-500 uppercase mb-1">DrChrono Pharmacy</p>
            <p className="text-sm text-white">{dc.default_pharmacy || dc.preferred_pharmacy_name || 'N/A'}</p>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
