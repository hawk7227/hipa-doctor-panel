'use client'
import React, { useState } from 'react'
import { User, Pencil, Save } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const FIELD_ROWS = [
  ['first_name', 'last_name'], ['email', 'phone'], ['mobile_phone', 'date_of_birth'],
  ['gender', 'preferred_language'], ['location', 'preferred_pharmacy'],
  ['emergency_contact_name', 'emergency_contact_phone'],
]

export default function DemographicsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, update, saving } = usePanelData({ endpoint: 'demographics', patientId })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const patient = data[0] || null
  const dc = patient?._drchrono || drchronoData[0] || null

  const startEdit = () => {
    if (!patient) return
    const f: Record<string, string> = {}
    FIELD_ROWS.flat().forEach(k => { f[k] = (patient as any)[k] || '' })
    setForm(f); setEditing(true)
  }
  const handleSave = async () => {
    if (!patient) return
    await update(patient.id, form)
    setEditing(false); refetch()
  }

  if (!isOpen) return null
  return (
    <PanelBase title={`Demographics — ${patientName}`} icon={User} accentColor="#64748b" loading={loading} error={error}
      hasData={!!patient} emptyMessage="Patient not found" onRetry={refetch} onClose={onClose} draggable={false}
      syncStatus={dc ? 'synced' : null}
      headerActions={
        editing ? <button onClick={handleSave} disabled={saving} className="p-1 text-teal-400 hover:text-teal-300"><Save className="w-3.5 h-3.5" /></button>
        : <button onClick={startEdit} className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3.5 h-3.5" /></button>
      }>
      <div className="p-3 space-y-2">
        {FIELD_ROWS.map((row, ri) => (
          <div key={ri} className="grid grid-cols-2 gap-2">
            {row.map(field => (
              <div key={field}>
                <p className="text-[9px] text-gray-500 uppercase">{field.replace(/_/g, ' ')}</p>
                {editing ? (
                  <input value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1 text-white text-sm mt-0.5" />
                ) : (
                  <p className="text-sm text-white">{(patient as any)?.[field] || (dc as any)?.[field] || 'N/A'}</p>
                )}
              </div>
            ))}
          </div>
        ))}
        {dc && (
          <div className="mt-3 pt-3 border-t border-[#1a3d3d]">
            <p className="text-[9px] text-gray-500 uppercase mb-1">DrChrono Data</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dc.race && <div><span className="text-gray-500">Race:</span> <span className="text-white">{dc.race}</span></div>}
              {dc.ethnicity && <div><span className="text-gray-500">Ethnicity:</span> <span className="text-white">{dc.ethnicity}</span></div>}
              {dc.ssn && <div><span className="text-gray-500">SSN:</span> <span className="text-white">***-**-{dc.ssn?.slice(-4)}</span></div>}
              {dc.employer && <div><span className="text-gray-500">Employer:</span> <span className="text-white">{dc.employer}</span></div>}
            </div>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
