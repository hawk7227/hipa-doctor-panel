'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ShieldCheck, Plus, Search, Filter, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Phone, FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface PriorAuth {
  id: string; patient_id: string; patient_name?: string; auth_type: string; description: string;
  insurance_name: string; insurance_phone: string; auth_number: string; urgency: string;
  status: string; diagnosis_codes: string; requested_service: string; approved_units: number;
  used_units: number; submission_date: string; expiration_date: string;
  clinical_justification: string; notes: string; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
  submitted: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
  approved: 'bg-green-600/20 text-green-400 border-green-500/30',
  denied: 'bg-red-600/20 text-red-400 border-red-500/30',
  appealed: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  expired: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
}
const AUTH_TYPES = ['medication', 'procedure', 'imaging', 'referral', 'dme', 'inpatient', 'outpatient'] as const
const STATUSES = ['draft', 'submitted', 'in_review', 'approved', 'denied', 'appealed', 'expired'] as const

export default function PriorAuthPage() {
  const [auths, setAuths] = useState<PriorAuth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    patient_id: '', auth_type: 'medication', description: '', insurance_name: '',
    insurance_phone: '', urgency: 'routine', diagnosis_codes: '', requested_service: '',
    clinical_justification: '', notes: ''
  })

  const fetchAuths = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Fetch all prior auths (in production, this would be a dedicated endpoint)
      const res = await fetch('/api/panels/prior-auth?patient_id=all')
      const data = await res.json()
      setAuths(data.data || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAuths() }, [fetchAuths])

  const filtered = useMemo(() => {
    let items = auths
    if (statusFilter !== 'all') items = items.filter(a => a.status === statusFilter)
    if (typeFilter !== 'all') items = items.filter(a => a.auth_type === typeFilter)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(a => a.description?.toLowerCase().includes(q) || a.insurance_name?.toLowerCase().includes(q) || a.auth_number?.toLowerCase().includes(q))
    }
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [auths, statusFilter, typeFilter, search])

  const counts = useMemo(() => ({
    pending: auths.filter(a => ['draft', 'submitted', 'in_review'].includes(a.status)).length,
    approved: auths.filter(a => a.status === 'approved').length,
    denied: auths.filter(a => a.status === 'denied').length,
    appealed: auths.filter(a => a.status === 'appealed').length,
  }), [auths])

  const handleSubmit = async () => {
    if (!form.description || !form.patient_id) return
    try {
      await fetch('/api/panels/prior-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'submitted', submission_date: new Date().toISOString() })
      })
      setShowAdd(false)
      setForm({ patient_id: '', auth_type: 'medication', description: '', insurance_name: '', insurance_phone: '', urgency: 'routine', diagnosis_codes: '', requested_service: '', clinical_justification: '', notes: '' })
      fetchAuths()
    } catch (err: any) { setError(err.message) }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/panels/prior-auth', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      fetchAuths()
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3d3d] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-xl font-bold">Prior Authorizations</h1>
              <p className="text-xs text-gray-500">Manage insurance pre-approvals for medications, procedures, and services</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 text-sm font-medium">
            <Plus className="w-4 h-4" />New Prior Auth
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Approved', count: counts.approved, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Denied', count: counts.denied, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Appealed', count: counts.appealed, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#1a3d3d]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by description, insurance, auth #..."
            className="w-full pl-10 pr-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All Types</option>
          {AUTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={fetchAuths} className="p-2 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mx-6 mt-4 bg-[#0a1f1f] border border-amber-500/30 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold text-amber-400">New Prior Authorization Request</h3>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} placeholder="Patient ID *"
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
            <select value={form.auth_type} onChange={e => setForm({...form, auth_type: e.target.value})}
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
              {AUTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})}
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
              <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergent">Emergent</option>
            </select>
          </div>
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Service/medication requiring authorization *"
            className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.insurance_name} onChange={e => setForm({...form, insurance_name: e.target.value})} placeholder="Insurance company"
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
            <input value={form.diagnosis_codes} onChange={e => setForm({...form, diagnosis_codes: e.target.value})} placeholder="ICD-10 codes"
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
            <input value={form.requested_service} onChange={e => setForm({...form, requested_service: e.target.value})} placeholder="CPT/service code"
              className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <textarea value={form.clinical_justification} onChange={e => setForm({...form, clinical_justification: e.target.value})}
            placeholder="Clinical justification..." rows={3} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm resize-y" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleSubmit} disabled={!form.description || !form.patient_id}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50">Submit Request</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-6 py-4 space-y-2">
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}
        {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}
        {!loading && filtered.length === 0 && <div className="text-center py-8 text-gray-500">No prior authorizations found</div>}

        {filtered.map(auth => (
          <div key={auth.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg overflow-hidden">
            <div className="p-4 cursor-pointer hover:bg-[#0d2a2a] transition-colors flex items-center gap-4"
              onClick={() => setExpandedId(expandedId === auth.id ? null : auth.id)}>
              <div className="flex-shrink-0">
                {expandedId === auth.id ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{auth.description}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${STATUS_COLORS[auth.status] || ''}`}>{auth.status?.replace('_', ' ').toUpperCase()}</span>
                  <span className="px-2 py-0.5 text-[10px] rounded bg-gray-600/20 text-gray-400 capitalize">{auth.auth_type}</span>
                  {auth.urgency === 'emergent' && <span className="px-2 py-0.5 text-[10px] rounded bg-red-600/20 text-red-400 font-bold">EMERGENT</span>}
                  {auth.urgency === 'urgent' && <span className="px-2 py-0.5 text-[10px] rounded bg-amber-600/20 text-amber-400 font-bold">URGENT</span>}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {auth.auth_number && <span className="font-mono mr-3">#{auth.auth_number}</span>}
                  {auth.insurance_name && <span className="mr-3">{auth.insurance_name}</span>}
                  {auth.submission_date && <span>Submitted: {new Date(auth.submission_date).toLocaleDateString()}</span>}
                  {auth.expiration_date && <span className="ml-3">Expires: {new Date(auth.expiration_date).toLocaleDateString()}</span>}
                </div>
              </div>
              {auth.approved_units && (
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white">{auth.used_units || 0}/{auth.approved_units}</div>
                  <div className="text-[10px] text-gray-500">units used</div>
                </div>
              )}
            </div>

            {expandedId === auth.id && (
              <div className="border-t border-[#1a3d3d] p-4 space-y-3">
                {auth.clinical_justification && (
                  <div><span className="text-[10px] text-gray-500 uppercase">Clinical Justification</span><p className="text-sm text-gray-300 mt-1">{auth.clinical_justification}</p></div>
                )}
                {auth.diagnosis_codes && <div className="text-xs"><span className="text-gray-500">ICD-10:</span> <span className="text-white font-mono">{auth.diagnosis_codes}</span></div>}
                {auth.requested_service && <div className="text-xs"><span className="text-gray-500">Service:</span> <span className="text-white font-mono">{auth.requested_service}</span></div>}
                {auth.notes && <div className="text-xs"><span className="text-gray-500">Notes:</span> <span className="text-gray-300">{auth.notes}</span></div>}

                <div className="flex gap-2 pt-2">
                  {auth.status === 'submitted' && (
                    <button onClick={() => updateStatus(auth.id, 'approved')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-500">Approve</button>
                  )}
                  {auth.status === 'submitted' && (
                    <button onClick={() => updateStatus(auth.id, 'denied')} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-500">Deny</button>
                  )}
                  {auth.status === 'denied' && (
                    <button onClick={() => updateStatus(auth.id, 'appealed')} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-500"><RefreshCw className="w-3 h-3 inline mr-1" />Appeal</button>
                  )}
                  {auth.insurance_phone && (
                    <a href={`tel:${auth.insurance_phone}`} className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-600/30">
                      <Phone className="w-3 h-3 inline mr-1" />Call Insurance
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
