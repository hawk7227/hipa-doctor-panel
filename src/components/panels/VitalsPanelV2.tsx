'use client'

import React, { useState, useMemo } from 'react'
import { Activity, Plus, TrendingUp, AlertTriangle, Pencil, Trash2, ChevronDown, ChevronRight, Thermometer, Heart, Wind, Droplets, Weight, Ruler, Brain } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const TABS = ['Current', 'History', 'Trends'] as const
type Tab = typeof TABS[number]

const ABNORMAL_RANGES: Record<string, { low?: number; high?: number; unit?: string }> = {
  blood_pressure_systolic: { low: 90, high: 140 },
  blood_pressure_diastolic: { low: 60, high: 90 },
  heart_rate: { low: 60, high: 100 },
  respiratory_rate: { low: 12, high: 20 },
  temperature: { low: 97, high: 99.5 },
  oxygen_saturation: { low: 95, high: 100 },
  bmi: { low: 18.5, high: 30 },
}

function isAbnormal(key: string, value: number | null | undefined): boolean {
  if (value == null) return false
  const range = ABNORMAL_RANGES[key]
  if (!range) return false
  return (range.low != null && value < range.low) || (range.high != null && value > range.high)
}

function VitalBadge({ label, value, unit, vitalKey }: { label: string; value: any; unit?: string; vitalKey?: string }) {
  if (value == null || value === '') return null
  const abnormal = vitalKey ? isAbnormal(vitalKey, Number(value)) : false
  return (
    <div className={`px-3 py-2 rounded-lg border ${abnormal ? 'bg-red-500/10 border-red-500/30' : 'bg-[#0a1f1f] border-[#1a3d3d]'}`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold ${abnormal ? 'text-red-400' : 'text-white'}`}>{value}<span className="text-xs text-gray-500 ml-1">{unit}</span></div>
    </div>
  )
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VitalsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'vitals', patientId })
  const [tab, setTab] = useState<Tab>('Current')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    blood_pressure_systolic: '', blood_pressure_diastolic: '', heart_rate: '', respiratory_rate: '',
    temperature: '', temperature_unit: 'F', oxygen_saturation: '', weight: '', weight_unit: 'lbs',
    height: '', height_unit: 'in', pain_level: '', blood_glucose: '', notes: ''
  })

  const latest = data?.[0]
  const sorted = useMemo(() => [...(data || [])].sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()), [data])

  const resetForm = () => {
    setForm({ blood_pressure_systolic: '', blood_pressure_diastolic: '', heart_rate: '', respiratory_rate: '',
      temperature: '', temperature_unit: 'F', oxygen_saturation: '', weight: '', weight_unit: 'lbs',
      height: '', height_unit: 'in', pain_level: '', blood_glucose: '', notes: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    const payload: any = { patient_id: patientId }
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) payload[k] = isNaN(Number(v)) ? v : Number(v) })
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  const startEdit = (v: any) => {
    setEditId(v.id)
    setForm({
      blood_pressure_systolic: v.blood_pressure_systolic?.toString() || '',
      blood_pressure_diastolic: v.blood_pressure_diastolic?.toString() || '',
      heart_rate: v.heart_rate?.toString() || '',
      respiratory_rate: v.respiratory_rate?.toString() || '',
      temperature: v.temperature?.toString() || '',
      temperature_unit: v.temperature_unit || 'F',
      oxygen_saturation: v.oxygen_saturation?.toString() || '',
      weight: v.weight?.toString() || '',
      weight_unit: v.weight_unit || 'lbs',
      height: v.height?.toString() || '',
      height_unit: v.height_unit || 'in',
      pain_level: v.pain_level?.toString() || '',
      blood_glucose: v.blood_glucose?.toString() || '',
      notes: v.notes || ''
    })
    setShowAdd(true)
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Vitals — ${patientName}`} icon={Activity} accentColor="#22c55e" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No vitals recorded"
      onRetry={refetch} onClose={onClose} draggable={false} badge={data.length || undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        {/* Sub-tabs */}
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-teal-400 text-teal-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Add/Edit Form */}
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-teal-400 mb-2">{editId ? 'Edit Vitals' : 'Record New Vitals'}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500">Systolic</label>
                  <input value={form.blood_pressure_systolic} onChange={e => setForm({...form, blood_pressure_systolic: e.target.value})}
                    placeholder="120" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Diastolic</label>
                  <input value={form.blood_pressure_diastolic} onChange={e => setForm({...form, blood_pressure_diastolic: e.target.value})}
                    placeholder="80" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Heart Rate</label>
                  <input value={form.heart_rate} onChange={e => setForm({...form, heart_rate: e.target.value})}
                    placeholder="72" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Resp Rate</label>
                  <input value={form.respiratory_rate} onChange={e => setForm({...form, respiratory_rate: e.target.value})}
                    placeholder="16" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Temp (°{form.temperature_unit})</label>
                  <div className="flex gap-1">
                    <input value={form.temperature} onChange={e => setForm({...form, temperature: e.target.value})}
                      placeholder="98.6" type="number" step="0.1" className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                    <select value={form.temperature_unit} onChange={e => setForm({...form, temperature_unit: e.target.value})}
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-1 text-white text-xs w-12">
                      <option value="F">°F</option><option value="C">°C</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">O₂ Sat (%)</label>
                  <input value={form.oxygen_saturation} onChange={e => setForm({...form, oxygen_saturation: e.target.value})}
                    placeholder="98" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Weight ({form.weight_unit})</label>
                  <div className="flex gap-1">
                    <input value={form.weight} onChange={e => setForm({...form, weight: e.target.value})}
                      placeholder="165" type="number" step="0.1" className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                    <select value={form.weight_unit} onChange={e => setForm({...form, weight_unit: e.target.value})}
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-1 text-white text-xs w-14">
                      <option value="lbs">lbs</option><option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Height ({form.height_unit})</label>
                  <div className="flex gap-1">
                    <input value={form.height} onChange={e => setForm({...form, height: e.target.value})}
                      placeholder="70" type="number" step="0.1" className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                    <select value={form.height_unit} onChange={e => setForm({...form, height_unit: e.target.value})}
                      className="bg-[#0d2626] border border-[#1a3d3d] rounded px-1 text-white text-xs w-14">
                      <option value="in">in</option><option value="cm">cm</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Pain (0-10)</label>
                  <input value={form.pain_level} onChange={e => setForm({...form, pain_level: e.target.value})}
                    placeholder="0" type="number" min="0" max="10" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Blood Glucose</label>
                  <input value={form.blood_glucose} onChange={e => setForm({...form, blood_glucose: e.target.value})}
                    placeholder="mg/dL" type="number" className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                </div>
              </div>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Notes..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Record'}
                </button>
              </div>
            </div>
          )}

          {/* CURRENT TAB */}
          {tab === 'Current' && latest && (
            <div className="space-y-3">
              <div className="text-[10px] text-gray-500 mb-1">Latest — {formatDate(latest.recorded_at)}</div>
              <div className="grid grid-cols-3 gap-2">
                <VitalBadge label="BP" value={latest.blood_pressure_systolic && latest.blood_pressure_diastolic ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}` : null} unit="mmHg" vitalKey="blood_pressure_systolic" />
                <VitalBadge label="HR" value={latest.heart_rate} unit="bpm" vitalKey="heart_rate" />
                <VitalBadge label="RR" value={latest.respiratory_rate} unit="/min" vitalKey="respiratory_rate" />
                <VitalBadge label="Temp" value={latest.temperature} unit={`°${latest.temperature_unit || 'F'}`} vitalKey="temperature" />
                <VitalBadge label="SpO₂" value={latest.oxygen_saturation} unit="%" vitalKey="oxygen_saturation" />
                <VitalBadge label="Weight" value={latest.weight} unit={latest.weight_unit || 'lbs'} />
                <VitalBadge label="Height" value={latest.height} unit={latest.height_unit || 'in'} />
                <VitalBadge label="BMI" value={latest.bmi} unit="" vitalKey="bmi" />
                <VitalBadge label="Pain" value={latest.pain_level} unit="/10" />
                {latest.blood_glucose && <VitalBadge label="Glucose" value={latest.blood_glucose} unit={latest.blood_glucose_unit || 'mg/dL'} />}
              </div>
              {latest.notes && <div className="text-xs text-gray-400 bg-[#0a1f1f] rounded p-2 mt-2">{latest.notes}</div>}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'History' && sorted.map((v: any) => (
            <div key={v.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{formatDate(v.recorded_at)}</span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(v)} className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(v.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {v.blood_pressure_systolic && <span className={isAbnormal('blood_pressure_systolic', v.blood_pressure_systolic) ? 'text-red-400' : 'text-white'}>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}</span>}
                {v.heart_rate && <span className={isAbnormal('heart_rate', v.heart_rate) ? 'text-red-400' : 'text-white'}>HR: {v.heart_rate}</span>}
                {v.respiratory_rate && <span className={isAbnormal('respiratory_rate', v.respiratory_rate) ? 'text-red-400' : 'text-white'}>RR: {v.respiratory_rate}</span>}
                {v.temperature && <span className={isAbnormal('temperature', v.temperature) ? 'text-red-400' : 'text-white'}>T: {v.temperature}°{v.temperature_unit || 'F'}</span>}
                {v.oxygen_saturation && <span className={isAbnormal('oxygen_saturation', v.oxygen_saturation) ? 'text-red-400' : 'text-white'}>SpO₂: {v.oxygen_saturation}%</span>}
                {v.weight && <span className="text-white">Wt: {v.weight}{v.weight_unit || 'lbs'}</span>}
                {v.bmi && <span className={isAbnormal('bmi', v.bmi) ? 'text-red-400' : 'text-white'}>BMI: {v.bmi}</span>}
                {v.pain_level != null && <span className={v.pain_level >= 7 ? 'text-red-400' : v.pain_level >= 4 ? 'text-yellow-400' : 'text-white'}>Pain: {v.pain_level}/10</span>}
              </div>
              {v.notes && <p className="text-xs text-gray-500 mt-1.5">{v.notes}</p>}
            </div>
          ))}

          {/* TRENDS TAB - Simple sparkline-like display */}
          {tab === 'Trends' && sorted.length >= 2 && (
            <div className="space-y-3">
              {(['blood_pressure_systolic', 'heart_rate', 'weight', 'bmi', 'oxygen_saturation'] as const).map(key => {
                const values = sorted.filter((v: any) => v[key] != null).slice(0, 10).reverse()
                if (values.length < 2) return null
                const label = { blood_pressure_systolic: 'Blood Pressure', heart_rate: 'Heart Rate', weight: 'Weight', bmi: 'BMI', oxygen_saturation: 'SpO₂' }[key]
                const latest = values[values.length - 1]
                const prev = values[values.length - 2]
                const diff = (latest as any)[key] - (prev as any)[key]
                return (
                  <div key={key} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white">{label}</span>
                      <span className={`text-xs font-bold ${diff > 0 ? 'text-amber-400' : diff < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-end gap-1 h-8">
                      {values.map((v: any, i: number) => {
                        const vals = values.map((x: any) => x[key])
                        const min = Math.min(...vals)
                        const max = Math.max(...vals)
                        const range = max - min || 1
                        const pct = ((v[key] - min) / range) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col justify-end" title={`${formatDate(v.recorded_at)}: ${v[key]}`}>
                            <div className={`rounded-t ${isAbnormal(key, v[key]) ? 'bg-red-500' : 'bg-teal-500'}`}
                              style={{ height: `${Math.max(10, pct)}%`, minHeight: '4px' }} />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] text-gray-600">
                      <span>{formatDate((values[0] as any).recorded_at)}</span>
                      <span>{formatDate((values[values.length-1] as any).recorded_at)}</span>
                    </div>
                  </div>
                )
              })}
              {sorted.length < 2 && <p className="text-xs text-gray-500 text-center py-4">Need at least 2 readings for trends</p>}
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
