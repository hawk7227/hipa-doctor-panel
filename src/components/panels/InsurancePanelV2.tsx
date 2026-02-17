// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { Shield, Plus, Pencil, Trash2, CreditCard, CheckCircle, AlertTriangle, Star } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Coverage', 'Eligibility', 'Benefits'] as const
const COVERAGE_ORDER = ['primary', 'secondary', 'tertiary']
const PLAN_TYPES = ['hmo', 'ppo', 'epo', 'pos', 'hdhp', 'medicare', 'medicaid', 'tricare', 'workers_comp', 'self_pay'] as const

export default function InsurancePanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'insurance', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Coverage')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    insurance_name: '', plan_type: 'ppo', coverage_type: 'primary', payer_id: '',
    member_id: '', group_number: '', subscriber_name: '', subscriber_relationship: 'self',
    copay_amount: '', coinsurance_pct: '', deductible_amount: '', deductible_met: '',
    effective_date: '', termination_date: '', is_active: true, notes: ''
  })

  const sorted = useMemo(() =>
    [...(data || [])].sort((a: any, b: any) => COVERAGE_ORDER.indexOf(a.coverage_type) - COVERAGE_ORDER.indexOf(b.coverage_type)),
  [data])

  const resetForm = () => {
    setForm({ insurance_name: '', plan_type: 'ppo', coverage_type: 'primary', payer_id: '',
      member_id: '', group_number: '', subscriber_name: '', subscriber_relationship: 'self',
      copay_amount: '', coinsurance_pct: '', deductible_amount: '', deductible_met: '',
      effective_date: '', termination_date: '', is_active: true, notes: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.insurance_name.trim()) return
    const payload: any = { ...form, patient_id: patientId }
    if (form.copay_amount) payload.copay_amount = parseFloat(form.copay_amount)
    if (form.coinsurance_pct) payload.coinsurance_pct = parseFloat(form.coinsurance_pct)
    if (form.deductible_amount) payload.deductible_amount = parseFloat(form.deductible_amount)
    if (form.deductible_met) payload.deductible_met = parseFloat(form.deductible_met)
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Insurance — ${patientName}`} icon={Shield} accentColor="#0ea5e9" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No insurance on file"
      onRetry={refetch} onClose={onClose} draggable={false} badge={data.length || undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-sky-400 text-sky-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-sky-400">{editId ? 'Edit' : 'Add'} Insurance</div>
              <input value={form.insurance_name} onChange={e => setForm({...form, insurance_name: e.target.value})}
                placeholder="Insurance company name..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.coverage_type} onChange={e => setForm({...form, coverage_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="tertiary">Tertiary</option>
                </select>
                <select value={form.plan_type} onChange={e => setForm({...form, plan_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {PLAN_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
                <input value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})} placeholder="Member ID"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.group_number} onChange={e => setForm({...form, group_number: e.target.value})} placeholder="Group #"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.subscriber_name} onChange={e => setForm({...form, subscriber_name: e.target.value})} placeholder="Subscriber name"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <select value={form.subscriber_relationship} onChange={e => setForm({...form, subscriber_relationship: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="self">Self</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option>
                </select>
                <input value={form.copay_amount} onChange={e => setForm({...form, copay_amount: e.target.value})} placeholder="Copay ($)" type="number" step="0.01"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.deductible_amount} onChange={e => setForm({...form, deductible_amount: e.target.value})} placeholder="Deductible ($)" type="number" step="0.01"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.termination_date} onChange={e => setForm({...form, termination_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.insurance_name.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          {tab === 'Coverage' && sorted.map((ins: any) => (
            <div key={ins.id} className={`bg-[#0a1f1f] border rounded-lg p-3 ${ins.coverage_type === 'primary' ? 'border-sky-500/40' : 'border-[#1a3d3d]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {ins.coverage_type === 'primary' && <Star className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />}
                  <span className="text-sm font-semibold text-white">{ins.insurance_name}</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-sky-500/20 text-sky-400 capitalize">{ins.coverage_type}</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-500/20 text-gray-400 uppercase">{ins.plan_type}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(ins.id); setForm({ ...ins, copay_amount: ins.copay_amount?.toString() || '', coinsurance_pct: ins.coinsurance_pct?.toString() || '', deductible_amount: ins.deductible_amount?.toString() || '', deductible_met: ins.deductible_met?.toString() || '' }); setShowAdd(true) }}
                    className="p-1 text-gray-500 hover:text-teal-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(ins.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
                {ins.member_id && <span>Member: <span className="text-white font-mono">{ins.member_id}</span></span>}
                {ins.group_number && <span>Group: <span className="text-white font-mono">{ins.group_number}</span></span>}
                {ins.copay_amount && <span>Copay: <span className="text-white">${ins.copay_amount}</span></span>}
                {ins.deductible_amount && <span>Deductible: <span className="text-white">${ins.deductible_amount}</span>{ins.deductible_met ? <span className="text-green-400"> (${ins.deductible_met} met)</span> : null}</span>}
                {ins.effective_date && <span>Eff: {new Date(ins.effective_date).toLocaleDateString()}</span>}
                {ins.termination_date && <span>Term: {new Date(ins.termination_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}

          {tab === 'Eligibility' && (
            <div className="space-y-2">
              {sorted.map((ins: any) => (
                <div key={ins.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${ins.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1">
                    <span className="text-sm text-white">{ins.insurance_name}</span>
                    <span className={`ml-2 text-xs ${ins.is_active ? 'text-green-400' : 'text-red-400'}`}>{ins.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <button className="px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Check Eligibility</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'Benefits' && (
            <div className="text-center py-8">
              <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Benefits verification</p>
              <p className="text-[10px] text-gray-600 mt-1">Copay, deductible, and coverage details shown per plan above</p>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
