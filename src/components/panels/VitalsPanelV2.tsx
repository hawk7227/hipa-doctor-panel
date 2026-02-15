'use client'

import React, { useState } from 'react'
import { Activity, Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

// Normal ranges for abnormal highlighting
const RANGES: Record<string, { min: number; max: number; unit: string }> = {
  systolic: { min: 90, max: 140, unit: 'mmHg' },
  diastolic: { min: 60, max: 90, unit: 'mmHg' },
  heart_rate: { min: 60, max: 100, unit: 'bpm' },
  temperature: { min: 97, max: 99.5, unit: '°F' },
  respiratory_rate: { min: 12, max: 20, unit: '/min' },
  oxygen_saturation: { min: 95, max: 100, unit: '%' },
}

function isAbnormal(field: string, value: number | null): boolean {
  if (value == null) return false
  const range = RANGES[field]
  if (!range) return false
  return value < range.min || value > range.max
}

const FIELDS = [
  { key: 'systolic', label: 'Systolic', placeholder: '120' },
  { key: 'diastolic', label: 'Diastolic', placeholder: '80' },
  { key: 'heart_rate', label: 'HR', placeholder: '72' },
  { key: 'temperature', label: 'Temp', placeholder: '98.6' },
  { key: 'respiratory_rate', label: 'RR', placeholder: '16' },
  { key: 'oxygen_saturation', label: 'SpO2', placeholder: '99' },
  { key: 'weight', label: 'Weight', placeholder: 'lbs' },
  { key: 'height', label: 'Height', placeholder: 'in' },
  { key: 'pain_level', label: 'Pain', placeholder: '0-10' },
] as const

export default function VitalsPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const { data, loading, error, refetch, create, remove, saving } = usePanelData({ endpoint: 'vitals', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const handleSave = async () => {
    const numericForm: Record<string, any> = { appointment_id: appointmentId || null }
    FIELDS.forEach(f => { if (form[f.key]) numericForm[f.key] = parseFloat(form[f.key]) })
    if (Object.keys(numericForm).length <= 1) return
    await create(numericForm)
    setForm({})
    setShowAdd(false)
  }

  if (!isOpen) return null

  const latest = data[0]

  return (
    <PanelBase
      title={`Vitals — ${patientName}`}
      icon={Activity}
      accentColor="#f59e0b"
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No vitals recorded"
      emptyIcon={Activity}
      onRetry={refetch}
      onClose={onClose}
      draggable={false}
      badge={data.length > 0 ? `${data.length} records` : undefined}
      headerActions={
        <button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300" title="Add vitals"><Plus className="w-3.5 h-3.5" /></button>
      }
    >
      <div className="p-3 space-y-3">
        {/* Add Form */}
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-white mb-1">Record New Vitals</p>
            <div className="grid grid-cols-3 gap-2">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-[9px] text-gray-500 uppercase">{f.label}</label>
                  <input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} type="number" step="any"
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1 text-white text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => { setShowAdd(false); setForm({}) }} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Vitals'}
              </button>
            </div>
          </div>
        )}

        {/* Latest Vitals Grid */}
        {latest && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
            <p className="text-[9px] text-gray-500 uppercase mb-2">Latest — {(latest.recorded_at || latest.created_at) ? new Date(latest.recorded_at || latest.created_at).toLocaleString() : ''}</p>
            <div className="grid grid-cols-3 gap-2">
              {FIELDS.map(f => {
                const val = (latest as any)[f.key]
                if (val == null) return null
                const abnormal = isAbnormal(f.key, val)
                return (
                  <div key={f.key} className={`rounded px-2 py-1.5 ${abnormal ? 'bg-red-500/10 border border-red-500/30' : 'bg-[#0d2626]'}`}>
                    <p className="text-[9px] text-gray-500 uppercase">{f.label}</p>
                    <p className={`text-sm font-bold ${abnormal ? 'text-red-400' : 'text-white'}`}>
                      {val} <span className="text-[9px] font-normal text-gray-500">{RANGES[f.key]?.unit || ''}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* History */}
        {data.length > 1 && (
          <div className="space-y-1">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">History</p>
            {data.slice(1).map((v: any) => (
              <div key={v.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2 flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-400">
                  {v.systolic && v.diastolic && <span>BP: {v.systolic}/{v.diastolic}</span>}
                  {v.heart_rate && <span>HR: {v.heart_rate}</span>}
                  {v.temperature && <span>T: {v.temperature}</span>}
                  {v.oxygen_saturation && <span>SpO2: {v.oxygen_saturation}%</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600">{(v.recorded_at || v.created_at) ? new Date(v.recorded_at || v.created_at).toLocaleDateString() : ''}</span>
                  <button onClick={() => remove(v.id)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelBase>
  )
}
