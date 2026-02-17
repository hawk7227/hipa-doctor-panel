// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  FlaskConical, Plus, Search, RefreshCw, ArrowLeft, X, AlertTriangle,
  Clock, CheckCircle, XCircle, TrendingUp, FileText, Send, Eye,
  ChevronDown, Filter, Download, Activity, Beaker, ClipboardList
} from 'lucide-react'

interface LabOrder {
  id: string; patient_id: string; order_number: string | null; lab_name: string | null;
  status: string; priority: string; diagnosis_codes: string[] | null; clinical_notes: string | null;
  fasting_required: boolean; ordered_by: string | null; ordered_at: string; resulted_at: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
  patients?: { first_name: string; last_name: string; email: string; date_of_birth: string | null } | null;
  lab_order_items?: { id: string; test_name: string; test_code: string | null; cpt_code: string | null; status: string }[];
}

interface LabResult {
  id: string; patient_id: string; test_name: string; value: string | null; unit: string | null;
  reference_range: string | null; flag: string | null; resulted_at: string; reviewed_by: string | null;
  patients?: { first_name: string; last_name: string } | null;
}

interface OrderSet { id: string; name: string; description: string | null; tests: any[]; category: string }

type LabTab = 'orders' | 'results' | 'new_order' | 'order_sets' | 'trending'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400', sent: 'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-cyan-500/15 text-cyan-400', resulted: 'bg-green-500/15 text-green-400',
  reviewed: 'bg-gray-500/15 text-gray-400', cancelled: 'bg-red-500/15 text-red-400',
}
const FLAG_COLORS: Record<string, string> = {
  normal: 'text-green-400', abnormal: 'text-amber-400', critical: 'text-red-400 font-bold animate-pulse',
  low: 'text-blue-400', high: 'text-red-400',
}
const COMMON_TESTS = [
  { name: 'CBC with Differential', code: '85025', cpt: '85025' },
  { name: 'Comprehensive Metabolic Panel', code: '80053', cpt: '80053' },
  { name: 'Basic Metabolic Panel', code: '80048', cpt: '80048' },
  { name: 'Lipid Panel', code: '80061', cpt: '80061' },
  { name: 'Thyroid Panel (TSH, Free T4)', code: '84443', cpt: '84443' },
  { name: 'Hemoglobin A1c', code: '83036', cpt: '83036' },
  { name: 'Urinalysis Complete', code: '81001', cpt: '81001' },
  { name: 'Urine Culture', code: '87086', cpt: '87086' },
  { name: 'STD Panel (GC/Chlamydia)', code: '87491', cpt: '87491' },
  { name: 'HIV 1/2 Antigen/Antibody', code: '87389', cpt: '87389' },
  { name: 'Vitamin D, 25-Hydroxy', code: '82306', cpt: '82306' },
  { name: 'Ferritin', code: '82728', cpt: '82728' },
  { name: 'B12 Level', code: '82607', cpt: '82607' },
  { name: 'PSA (Prostate)', code: '84153', cpt: '84153' },
  { name: 'Liver Function Panel', code: '80076', cpt: '80076' },
  { name: 'PT/INR', code: '85610', cpt: '85610' },
  { name: 'ESR (Sed Rate)', code: '85651', cpt: '85651' },
  { name: 'CRP (C-Reactive Protein)', code: '86140', cpt: '86140' },
]

export default function LabOrdersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [activeTab, setActiveTab] = useState<LabTab>('orders')
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [results, setResults] = useState<LabResult[]>([])
  const [orderSets, setOrderSets] = useState<OrderSet[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notif, setNotif] = useState<{ type: string; msg: string } | null>(null)

  // New order form
  const [orderForm, setOrderForm] = useState({ patientId: '', labName: 'Quest Diagnostics', priority: 'routine', clinicalNotes: '', fastingRequired: false, diagnosisCodes: '' })
  const [selectedTests, setSelectedTests] = useState<typeof COMMON_TESTS>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  // Stats
  const [stats, setStats] = useState({ pending: 0, resulted: 0, abnormal: 0, total: 0 })

  const showNotif = (type: string, msg: string) => { setNotif({ type, msg }); setTimeout(() => setNotif(null), 4000) }

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        setDoctorName(`Dr. ${authUser.doctor.first_name || ''} ${authUser.doctor.last_name || ''}`.trim())
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    init()
  }, [router])

  const fetchOrders = useCallback(async () => {
    if (!doctorId) return
    const { data } = await supabase.from('lab_orders')
      .select('*, patients(first_name, last_name, email, date_of_birth), lab_order_items(*)')
      .eq('doctor_id', doctorId)
      .order('ordered_at', { ascending: false }).limit(200)
    if (data) {
      setOrders(data as any)
      const pending = data.filter(o => o.status === 'pending' || o.status === 'sent').length
      const resulted = data.filter(o => o.status === 'resulted').length
      setStats({ pending, resulted, abnormal: 0, total: data.length })
    }
  }, [doctorId])

  const fetchResults = useCallback(async () => {
    if (!doctorId) return
    const { data } = await supabase.from('lab_results')
      .select('*, patients(first_name, last_name)')
      .eq('doctor_id', doctorId)
      .order('resulted_at', { ascending: false }).limit(200)
    if (data) {
      setResults(data as any)
      setStats(p => ({ ...p, abnormal: data.filter(r => r.flag && r.flag !== 'normal').length }))
    }
  }, [doctorId])

  const fetchOrderSets = useCallback(async () => {
    if (!doctorId) return
    const { data } = await supabase.from('lab_order_sets').select('*').eq('doctor_id', doctorId).eq('is_active', true)
    if (data) setOrderSets(data as any)
  }, [doctorId])

  useEffect(() => {
    if (!doctorId) return
    fetchOrders()
    fetchResults()
    fetchOrderSets()
  }, [doctorId, fetchOrders, fetchResults, fetchOrderSets])

  // Patient search
  useEffect(() => {
    if (!patientSearch.trim() || !doctorId) { setPatientResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('patients')
        .select('id, first_name, last_name, email, date_of_birth').eq('doctor_id', doctorId)
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%`).limit(10)
      setPatientResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [patientSearch, doctorId])

  const submitOrder = async () => {
    if (!orderForm.patientId || selectedTests.length === 0 || !doctorId) { showNotif('error', 'Patient and tests required'); return }
    try {
      const { data: order, error } = await supabase.from('lab_orders').insert({
        doctor_id: doctorId, patient_id: orderForm.patientId, lab_name: orderForm.labName,
        priority: orderForm.priority, clinical_notes: orderForm.clinicalNotes,
        fasting_required: orderForm.fastingRequired, ordered_by: doctorName,
        diagnosis_codes: orderForm.diagnosisCodes ? orderForm.diagnosisCodes.split(',').map(s => s.trim()) : null,
        status: 'pending', order_number: `LAB-${Date.now().toString(36).toUpperCase()}`
      }).select().single()

      if (error) throw error

      // Insert line items
      const items = selectedTests.map(t => ({ lab_order_id: order.id, test_name: t.name, test_code: t.code, cpt_code: t.cpt, status: 'pending' }))
      await supabase.from('lab_order_items').insert(items)

      showNotif('success', `Lab order created with ${selectedTests.length} tests`)
      setOrderForm({ patientId: '', labName: 'Quest Diagnostics', priority: 'routine', clinicalNotes: '', fastingRequired: false, diagnosisCodes: '' })
      setSelectedTests([])
      setSelectedPatient(null)
      setActiveTab('orders')
      fetchOrders()
    } catch (err: any) { showNotif('error', err.message) }
  }

  const markReviewed = async (orderId: string) => {
    await supabase.from('lab_orders').update({ status: 'reviewed', reviewed_by: doctorName, reviewed_at: new Date().toISOString() }).eq('id', orderId)
    showNotif('success', 'Order marked as reviewed')
    fetchOrders()
  }

  const filteredOrders = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(o => o.patients?.first_name?.toLowerCase().includes(q) || o.patients?.last_name?.toLowerCase().includes(q) || o.lab_order_items?.some(i => i.test_name.toLowerCase().includes(q))) }
    return list
  }, [orders, statusFilter, search])

  if (loading) return <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center"><RefreshCw className="w-8 h-8 text-teal-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#0a1f1f] overflow-y-auto">
      {notif && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-xl border ${notif.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-teal-500/20 border-teal-500/30 text-teal-300'}`}>{notif.msg}</div>}

      <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3">
        <div className="flex items-center space-x-3">
          <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-[#1a3d3d] text-gray-400"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-lg font-bold text-white flex items-center space-x-2"><FlaskConical className="w-5 h-5 text-teal-400" /><span>Lab Orders & Results</span></h1>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-amber-400', icon: Clock },
            { label: 'Resulted', value: stats.resulted, color: 'text-green-400', icon: CheckCircle },
            { label: 'Abnormal', value: stats.abnormal, color: 'text-red-400', icon: AlertTriangle },
            { label: 'Total Orders', value: stats.total, color: 'text-blue-400', icon: ClipboardList },
          ].map(s => (
            <div key={s.label} className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
              <div className="flex items-center space-x-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className={`text-xl font-bold ${s.color}`}>{s.value}</span></div>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex mt-3 space-x-1 overflow-x-auto">
          {([
            { key: 'orders' as LabTab, label: 'Orders', icon: ClipboardList },
            { key: 'results' as LabTab, label: 'Results', icon: FileText },
            { key: 'new_order' as LabTab, label: 'New Order', icon: Plus },
            { key: 'order_sets' as LabTab, label: 'Order Sets', icon: Beaker },
            { key: 'trending' as LabTab, label: 'Trending', icon: TrendingUp },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${activeTab === tab.key ? 'bg-teal-600/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'}`}>
              <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* ═══ ORDERS TAB ═══ */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..."
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-xs text-white">
                <option value="all">All Status</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="resulted">Resulted</option><option value="reviewed">Reviewed</option>
              </select>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg p-8 text-center border border-[#1a3d3d]">
                <FlaskConical className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No lab orders found</p>
                <button onClick={() => setActiveTab('new_order')} className="mt-2 text-xs text-teal-400 hover:underline">Create new order →</button>
              </div>
            ) : filteredOrders.map(order => (
              <div key={order.id} className={`bg-[#0d2626] rounded-lg p-4 border ${order.status === 'resulted' ? 'border-green-500/30' : 'border-[#1a3d3d]'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>{order.status}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${order.priority === 'stat' ? 'bg-red-500/20 text-red-400 font-bold' : order.priority === 'urgent' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/15 text-gray-400'}`}>{order.priority}</span>
                      {order.fasting_required && <span className="text-[9px] text-cyan-400">FASTING</span>}
                    </div>
                    <p className="text-sm font-medium text-white">{order.patients?.first_name} {order.patients?.last_name}</p>
                    <p className="text-[10px] text-gray-500">{order.order_number} &bull; {order.lab_name} &bull; {new Date(order.ordered_at).toLocaleDateString()}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {order.lab_order_items?.map(item => (
                        <span key={item.id} className="px-1.5 py-0.5 bg-[#1a3d3d] rounded text-[9px] text-gray-300">{item.test_name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1 ml-3">
                    {order.status === 'resulted' && (
                      <button onClick={() => markReviewed(order.id)} className="px-2 py-1 rounded text-[10px] font-bold bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Review</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ RESULTS TAB ═══ */}
        {activeTab === 'results' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Lab Results</h2>
            {results.length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg p-8 text-center border border-[#1a3d3d]"><p className="text-xs text-gray-500">No results available</p></div>
            ) : results.map(r => (
              <div key={r.id} className={`bg-[#0d2626] rounded-lg p-3 border ${r.flag === 'critical' ? 'border-red-500/50' : r.flag === 'abnormal' || r.flag === 'high' || r.flag === 'low' ? 'border-amber-500/30' : 'border-[#1a3d3d]'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">{r.test_name}</p>
                    <p className="text-[10px] text-gray-500">{r.patients?.first_name} {r.patients?.last_name} &bull; {new Date(r.resulted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${FLAG_COLORS[r.flag || ''] || 'text-white'}`}>{r.value} {r.unit || ''}</p>
                    <p className="text-[9px] text-gray-500">Ref: {r.reference_range || 'N/A'}</p>
                    {r.flag && r.flag !== 'normal' && <span className={`text-[9px] font-bold ${FLAG_COLORS[r.flag]}`}>{r.flag.toUpperCase()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ NEW ORDER TAB ═══ */}
        {activeTab === 'new_order' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-sm font-bold text-white">New Lab Order</h2>

            {/* Patient search */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Patient <span className="text-red-400">*</span></label>
              {selectedPatient ? (
                <div className="flex items-center space-x-2 bg-teal-600/10 border border-teal-500/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-white font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                  <button onClick={() => { setSelectedPatient(null); setOrderForm(p => ({ ...p, patientId: '' })) }} className="ml-auto text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patient..."
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg z-10 max-h-40 overflow-y-auto">
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setOrderForm(prev => ({ ...prev, patientId: p.id })); setPatientSearch(''); setPatientResults([]) }}
                          className="w-full text-left px-3 py-2 hover:bg-[#1a3d3d] text-xs text-white border-b border-[#1a3d3d]/50">{p.first_name} {p.last_name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Lab</label>
                <select value={orderForm.labName} onChange={e => setOrderForm(p => ({ ...p, labName: e.target.value }))}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white">
                  <option>Quest Diagnostics</option><option>LabCorp</option><option>BioReference</option><option>In-House</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select value={orderForm.priority} onChange={e => setOrderForm(p => ({ ...p, priority: e.target.value }))}
                  className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                </select>
              </div>
            </div>

            <label className="flex items-center space-x-2 text-xs text-gray-300">
              <input type="checkbox" checked={orderForm.fastingRequired} onChange={e => setOrderForm(p => ({ ...p, fastingRequired: e.target.checked }))} />
              <span>Fasting Required</span>
            </label>

            {/* Test selection */}
            <div>
              <label className="text-xs text-gray-400 font-medium mb-2 block">Select Tests <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto bg-[#0d2626] border border-[#1a3d3d] rounded-lg p-3">
                {COMMON_TESTS.map(test => {
                  const selected = selectedTests.some(t => t.code === test.code)
                  return (
                    <button key={test.code} onClick={() => selected ? setSelectedTests(p => p.filter(t => t.code !== test.code)) : setSelectedTests(p => [...p, test])}
                      className={`text-left px-2 py-1.5 rounded text-[11px] transition-all ${selected ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30' : 'text-gray-300 hover:bg-[#1a3d3d]'}`}>
                      {selected && '✓ '}{test.name}
                    </button>
                  )
                })}
              </div>
              {selectedTests.length > 0 && <p className="text-[10px] text-teal-400 mt-1">{selectedTests.length} test(s) selected</p>}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">ICD-10 Codes (comma-separated)</label>
              <input value={orderForm.diagnosisCodes} onChange={e => setOrderForm(p => ({ ...p, diagnosisCodes: e.target.value }))} placeholder="Z00.00, R10.9"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Clinical Notes</label>
              <textarea value={orderForm.clinicalNotes} onChange={e => setOrderForm(p => ({ ...p, clinicalNotes: e.target.value }))} rows={2} placeholder="Clinical indication..."
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none" />
            </div>

            <button onClick={submitOrder} disabled={!orderForm.patientId || selectedTests.length === 0}
              className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Submit Lab Order ({selectedTests.length} tests)
            </button>
          </div>
        )}

        {/* ═══ ORDER SETS TAB ═══ */}
        {activeTab === 'order_sets' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Order Sets</h2>
            <p className="text-[10px] text-gray-500">Preconfigured test panels for common clinical scenarios</p>
            {[
              { name: 'Annual Physical', tests: ['CBC', 'CMP', 'Lipid Panel', 'TSH', 'HbA1c', 'Urinalysis'], category: 'preventive' },
              { name: 'Diabetes Monitoring', tests: ['HbA1c', 'CMP', 'Lipid Panel', 'Urinalysis', 'Microalbumin'], category: 'chronic' },
              { name: 'Pre-Op Panel', tests: ['CBC', 'BMP', 'PT/INR', 'Type & Screen'], category: 'surgical' },
              { name: 'STD Screening', tests: ['GC/Chlamydia', 'HIV', 'RPR', 'Hepatitis B/C'], category: 'screening' },
              { name: 'Thyroid Workup', tests: ['TSH', 'Free T4', 'Free T3', 'TPO Antibodies'], category: 'endocrine' },
              { name: 'Iron Studies', tests: ['Ferritin', 'Iron', 'TIBC', 'CBC'], category: 'hematology' },
            ].map(set => (
              <div key={set.name} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d] hover:border-teal-500/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{set.name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#1a3d3d] text-gray-400">{set.category}</span>
                  </div>
                  <button onClick={() => { setActiveTab('new_order'); showNotif('success', `${set.name} loaded — select patient to proceed`) }}
                    className="px-3 py-1.5 rounded text-[10px] font-bold bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Use Set</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {set.tests.map(t => <span key={t} className="px-1.5 py-0.5 bg-[#0a1f1f] rounded text-[9px] text-gray-300">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ TRENDING TAB ═══ */}
        {activeTab === 'trending' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2"><TrendingUp className="w-4 h-4 text-teal-400" /><span>Lab Trending</span></h2>
            <p className="text-[10px] text-gray-500">View trends for a patient&apos;s lab values over time. Select a patient to view their trending data.</p>
            <div className="bg-[#0d2626] rounded-lg p-6 text-center text-gray-500 text-xs border border-[#1a3d3d] border-dashed">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Select a patient from the patient panel to view their lab value trends over time</p>
              <p className="text-[10px] mt-2 text-gray-600">AI-powered trend analysis and alerts coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
