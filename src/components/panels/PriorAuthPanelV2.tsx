'use client'
import React, { useState, useMemo } from 'react'
import { ShieldCheck, Plus, Pencil, Trash2, Clock, CheckCircle, XCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Pending', 'All', 'Denied'] as const
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  denied: 'bg-red-500/20 text-red-400 border-red-500/30',
  appealed: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}
const AUTH_TYPES = ['medication', 'procedure', 'imaging', 'referral', 'dme', 'inpatient', 'outpatient'] as const
const URGENCY = ['routine', 'urgent', 'emergent'] as const

export default function PriorAuthPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'prior-auth', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Pending')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({
    auth_type: 'medication', description: '', insurance_name: '', insurance_phone: '',
    auth_number: '', urgency: 'routine', status: 'draft', diagnosis_codes: '',
    requested_service: '', approved_units: '', used_units: '',
    submission_date: '', expiration_date: '', clinical_justification: '', notes: ''
  })

  const filtered = useMemo(() => {
    if (tab === 'Pending') return (data || []).filter((a: any) => ['draft', 'submitted', 'in_review', 'appealed'].includes(a.status))
    if (tab === 'Denied') return (data || []).filter((a: any) => a.status === 'denied')
    return data || []
  }, [data, tab])

  const pendingCount = (data || []).filter((a: any) => ['draft', 'submitted', 'in_review'].includes(a.status)).length

  const resetForm = () => {
    setForm({ auth_type: 'medication', description: '', insurance_name: '', insurance_phone: '',
      auth_number: '', urgency: 'routine', status: 'draft', diagnosis_codes: '',
      requested_service: '', approved_units: '', used_units: '',
      submission_date: '', expiration_date: '', clinical_justification: '', notes: '' })
    setShowAdd(false); setEditId(null)
  }

  const handleSave = async () => {
    if (!form.description.trim()) return
    const payload: any = { ...form, patient_id: patientId }
    if (form.approved_units) payload.approved_units = parseInt(form.approved_units)
    if (form.used_units) payload.used_units = parseInt(form.used_units)
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Prior Auth — ${patientName}`} icon={ShieldCheck} accentColor="#f59e0b" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No prior authorizations"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={pendingCount > 0 ? `${pendingCount} pending` : undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Pending' && pendingCount > 0 && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">{pendingCount}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-amber-400">{editId ? 'Edit' : 'New'} Prior Authorization</div>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Service/medication requiring auth..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.auth_type} onChange={e => setForm({...form, auth_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {AUTH_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {URGENCY.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input value={form.insurance_name} onChange={e => setForm({...form, insurance_name: e.target.value})}
                  placeholder="Insurance name" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.insurance_phone} onChange={e => setForm({...form, insurance_phone: e.target.value})}
                  placeholder="Insurance phone" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.diagnosis_codes} onChange={e => setForm({...form, diagnosis_codes: e.target.value})}
                  placeholder="ICD-10 codes (comma-sep)" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.requested_service} onChange={e => setForm({...form, requested_service: e.target.value})}
                  placeholder="CPT/service code" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.submission_date} onChange={e => setForm({...form, submission_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.expiration_date} onChange={e => setForm({...form, expiration_date: e.target.value})} type="date"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              <textarea value={form.clinical_justification} onChange={e => setForm({...form, clinical_justification: e.target.value})}
                placeholder="Clinical justification..." rows={3} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.description.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : 'Submit'}</button>
              </div>
            </div>
          )}

          {filtered.map((auth: any) => (
            <div key={auth.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg overflow-hidden">
              <div className="p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === auth.id ? null : auth.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{auth.description}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 capitalize">{(auth.auth_type || '').replace('_', ' ')}</span>
                      {auth.auth_number && <span className="text-[10px] font-mono text-gray-500">#{auth.auth_number}</span>}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[auth.status] || ''}`}>{(auth.status || '').toUpperCase()}</span>
                </div>
              </div>
              {expandedId === auth.id && (
                <div className="border-t border-[#1a3d3d] p-3 space-y-1.5 text-xs">
                  {auth.insurance_name && <div className="flex justify-between"><span className="text-gray-500">Insurance</span><span className="text-white">{auth.insurance_name}</span></div>}
                  {auth.urgency && <div className="flex justify-between"><span className="text-gray-500">Urgency</span><span className={`capitalize ${auth.urgency === 'emergent' ? 'text-red-400' : auth.urgency === 'urgent' ? 'text-amber-400' : 'text-white'}`}>{auth.urgency}</span></div>}
                  {auth.approved_units && <div className="flex justify-between"><span className="text-gray-500">Units</span><span className="text-white">{auth.used_units || 0} / {auth.approved_units} used</span></div>}
                  {auth.expiration_date && <div className="flex justify-between"><span className="text-gray-500">Expires</span><span className="text-white">{new Date(auth.expiration_date).toLocaleDateString()}</span></div>}
                  {auth.clinical_justification && <div><span className="text-gray-500">Justification:</span><p className="text-gray-300 mt-0.5">{auth.clinical_justification}</p></div>}
                  <div className="flex gap-2 pt-1">
                    {auth.status === 'denied' && (
                      <button onClick={() => update(auth.id, { status: 'appealed' })}
                        className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 rounded border border-amber-500/20"><RefreshCw className="w-3 h-3 inline mr-1" />Appeal</button>
                    )}
                    <button onClick={() => { setEditId(auth.id); setForm({ ...auth, diagnosis_codes: auth.diagnosis_codes || '', approved_units: auth.approved_units?.toString() || '', used_units: auth.used_units?.toString() || '' }); setShowAdd(true) }}
                      className="px-2 py-1 text-[10px] text-teal-400 bg-teal-500/10 rounded border border-teal-500/20">Edit</button>
                    <button onClick={() => remove(auth.id)}
                      className="px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded border border-red-500/20">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
