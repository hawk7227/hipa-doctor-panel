// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  DollarSign, TrendingUp, RefreshCw, Search, Plus, X,
  Filter, ChevronRight, CreditCard, Clock, CheckCircle, XCircle,
  Users, BarChart3, FileText, Send, AlertTriangle, Download,
  Receipt, Wallet, ShieldCheck, ArrowLeft, Edit3, Trash2,
  Calendar, Building2, Phone, ChevronDown, Eye, Copy, AlertCircle
} from 'lucide-react'

type BillingTab = 'claims' | 'payments' | 'superbills' | 'fee_schedule' | 'statements' | 'eligibility'
interface Claim { id: string; patient_id: string; appointment_id: string | null; claim_number: string | null; status: string; payer_name: string | null; payer_id: string | null; subscriber_id: string | null; group_number: string | null; total_charge: number; total_allowed: number | null; total_paid: number; patient_responsibility: number; copay: number | null; deductible: number | null; coinsurance: number | null; service_date: string | null; submitted_at: string | null; paid_at: string | null; place_of_service: string; rendering_provider_npi: string | null; billing_provider_npi: string | null; denial_reason: string | null; denial_code: string | null; appeal_deadline: string | null; notes: string | null; created_at: string; patients?: { first_name: string; last_name: string; email: string } | null }
interface Payment { id: string; patient_id: string | null; claim_id: string | null; payment_type: string; method: string | null; amount: number; reference_number: string | null; stripe_payment_id: string | null; posted_date: string; notes: string | null; posted_by: string | null; voided: boolean; created_at: string; patients?: { first_name: string; last_name: string } | null }
interface Superbill { id: string; patient_id: string; service_date: string; diagnosis_codes: string[]; procedure_codes: any[]; total_charge: number; status: string; notes: string | null; patients?: { first_name: string; last_name: string } | null }
interface FeeItem { id: string; name: string; cpt_code: string; description: string | null; fee: number; effective_date: string; is_active: boolean }
interface Statement { id: string; patient_id: string; statement_date: string; due_date: string | null; total_due: number; status: string; pdf_url: string | null; sent_via: string | null; patients?: { first_name: string; last_name: string } | null }
interface EligibilityCheck { id: string; patient_id: string; payer_name: string | null; subscriber_id: string | null; status: string | null; copay: number | null; deductible: number | null; deductible_met: number | null; coinsurance_pct: number | null; plan_name: string | null; checked_at: string; patients?: { first_name: string; last_name: string } | null }

const STATUS_COLORS: Record<string, string> = { draft: 'bg-gray-600/20 text-gray-400 border-gray-500/30', ready: 'bg-blue-600/20 text-blue-400 border-blue-500/30', submitted: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30', accepted: 'bg-teal-600/20 text-teal-400 border-teal-500/30', denied: 'bg-red-600/20 text-red-400 border-red-500/30', partial: 'bg-amber-600/20 text-amber-400 border-amber-500/30', paid: 'bg-green-600/20 text-green-400 border-green-500/30', appealed: 'bg-purple-600/20 text-purple-400 border-purple-500/30', void: 'bg-gray-600/20 text-gray-500 border-gray-600/30', generated: 'bg-blue-600/20 text-blue-400 border-blue-500/30', sent: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30', finalized: 'bg-green-600/20 text-green-400 border-green-500/30', billed: 'bg-teal-600/20 text-teal-400 border-teal-500/30', active: 'bg-green-600/20 text-green-400 border-green-500/30', eligible: 'bg-green-600/20 text-green-400 border-green-500/30', ineligible: 'bg-red-600/20 text-red-400 border-red-500/30', pending: 'bg-amber-600/20 text-amber-400 border-amber-500/30' }
const TABS: { key: BillingTab; label: string; icon: typeof DollarSign }[] = [ { key: 'claims', label: 'Claims', icon: FileText }, { key: 'payments', label: 'Payments', icon: CreditCard }, { key: 'superbills', label: 'Superbills', icon: Receipt }, { key: 'fee_schedule', label: 'Fee Schedule', icon: DollarSign }, { key: 'statements', label: 'Statements', icon: Wallet }, { key: 'eligibility', label: 'Eligibility', icon: ShieldCheck } ]
const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—'
const fmtMoney = (n: number | null | undefined) => typeof n === 'number' ? `$${n.toFixed(2)}` : '—'

export default function BillingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<BillingTab>('claims')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [superbills, setSuperbills] = useState<Superbill[]>([])
  const [feeSchedule, setFeeSchedule] = useState<FeeItem[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [eligibility, setEligibility] = useState<EligibilityCheck[]>([])
  const [showNewClaim, setShowNewClaim] = useState(false)
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [showNewFee, setShowNewFee] = useState(false)
  const [stats, setStats] = useState({ totalCharges: 0, totalPaid: 0, totalOutstanding: 0, claimCount: 0, denialRate: 0, avgDaysAR: 0 })

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor?.id) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        await fetchAll(authUser.doctor.id)
      } catch { router.push('/login') }
    }
    init()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async (docId: string) => {
    setLoading(true); setError(null)
    try {
      const [claimsRes, paymentsRes, superbillsRes, feeRes, statementsRes, eligRes] = await Promise.all([
        supabase.from('billing_claims').select('*, patients(first_name, last_name, email)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(200),
        supabase.from('billing_payments').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(200),
        supabase.from('superbills').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('service_date', { ascending: false }).limit(200),
        supabase.from('fee_schedule').select('*').eq('doctor_id', docId).order('cpt_code'),
        supabase.from('patient_statements').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('statement_date', { ascending: false }).limit(100),
        supabase.from('insurance_eligibility_checks').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('checked_at', { ascending: false }).limit(100),
      ])
      const c = (claimsRes.data || []) as Claim[]
      const p = (paymentsRes.data || []) as Payment[]
      setClaims(c); setPayments(p)
      setSuperbills((superbillsRes.data || []) as Superbill[])
      setFeeSchedule((feeRes.data || []) as FeeItem[])
      setStatements((statementsRes.data || []) as Statement[])
      setEligibility((eligRes.data || []) as EligibilityCheck[])
      const totalCharges = c.reduce((s, x) => s + (x.total_charge || 0), 0)
      const totalPaid = p.filter(x => !x.voided).reduce((s, x) => s + (x.amount || 0), 0)
      const denied = c.filter(x => x.status === 'denied').length
      const openSubmitted = c.filter(x => x.status !== 'paid' && x.submitted_at)
      setStats({ totalCharges, totalPaid, totalOutstanding: totalCharges - totalPaid, claimCount: c.length, denialRate: c.length > 0 ? Math.round((denied / c.length) * 100) : 0, avgDaysAR: openSubmitted.length > 0 ? Math.round(openSubmitted.reduce((s, x) => s + Math.floor((Date.now() - new Date(x.submitted_at!).getTime()) / 86400000), 0) / openSubmitted.length) : 0 })
    } catch (err: any) { console.error('Billing fetch:', err); setError(err.message || 'Failed to load billing data') }
    finally { setLoading(false) }
  }, [])

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  const createClaim = async (data: any) => { if (!doctorId) return; setError(null); try { const { error: e } = await supabase.from('billing_claims').insert({ ...data, doctor_id: doctorId }); if (e) throw e; flash('Claim created'); setShowNewClaim(false); await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }
  const updateClaimStatus = async (id: string, status: string) => { if (!doctorId) return; setError(null); try { const u: any = { status }; if (status === 'submitted') u.submitted_at = new Date().toISOString(); if (status === 'paid') u.paid_at = new Date().toISOString(); const { error: e } = await supabase.from('billing_claims').update(u).eq('id', id); if (e) throw e; flash(`Claim ${status}`); await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }
  const createPayment = async (data: any) => { if (!doctorId) return; setError(null); try { const { error: e } = await supabase.from('billing_payments').insert({ ...data, doctor_id: doctorId }); if (e) throw e; flash('Payment posted'); setShowNewPayment(false); await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }
  const voidPayment = async (id: string) => { if (!doctorId || !confirm('Void this payment?')) return; try { const { error: e } = await supabase.from('billing_payments').update({ voided: true, voided_at: new Date().toISOString() }).eq('id', id); if (e) throw e; flash('Payment voided'); await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }
  const createFeeItem = async (data: any) => { if (!doctorId) return; try { const { error: e } = await supabase.from('fee_schedule').insert({ ...data, doctor_id: doctorId }); if (e) throw e; flash('Fee added'); setShowNewFee(false); await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }
  const deleteFeeItem = async (id: string) => { if (!doctorId || !confirm('Delete this fee?')) return; try { const { error: e } = await supabase.from('fee_schedule').delete().eq('id', id); if (e) throw e; await fetchAll(doctorId) } catch (e: any) { setError(e.message) } }

  const filteredClaims = useMemo(() => { let l = claims; if (statusFilter !== 'all') l = l.filter(c => c.status === statusFilter); if (search) { const q = search.toLowerCase(); l = l.filter(c => c.claim_number?.toLowerCase().includes(q) || c.payer_name?.toLowerCase().includes(q) || c.patients?.first_name?.toLowerCase().includes(q) || c.patients?.last_name?.toLowerCase().includes(q)) }; return l }, [claims, statusFilter, search])
  const filteredPayments = useMemo(() => { if (!search) return payments; const q = search.toLowerCase(); return payments.filter(p => p.reference_number?.toLowerCase().includes(q) || p.patients?.first_name?.toLowerCase().includes(q) || p.patients?.last_name?.toLowerCase().includes(q)) }, [payments, search])

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <div><h1 className="text-lg font-bold">Billing & Revenue Cycle</h1><p className="text-xs text-gray-500">Claims • Payments • Fee Schedule</p></div>
          </div>
          <button onClick={() => doctorId && fetchAll(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
          {[
            { label: 'Total Charges', value: fmtMoney(stats.totalCharges), icon: DollarSign, color: 'text-blue-400' },
            { label: 'Collected', value: fmtMoney(stats.totalPaid), icon: CheckCircle, color: 'text-green-400' },
            { label: 'Outstanding', value: fmtMoney(stats.totalOutstanding), icon: Clock, color: 'text-amber-400' },
            { label: 'Claims', value: `${stats.claimCount}`, icon: FileText, color: 'text-cyan-400' },
            { label: 'Denial Rate', value: `${stats.denialRate}%`, icon: XCircle, color: stats.denialRate > 10 ? 'text-red-400' : 'text-green-400' },
            { label: 'Avg Days AR', value: `${stats.avgDaysAR}`, icon: TrendingUp, color: stats.avgDaysAR > 45 ? 'text-red-400' : 'text-emerald-400' },
          ].map((k, i) => (
            <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2 text-center">
              <k.icon className={`w-3.5 h-3.5 ${k.color} mx-auto mb-1`} /><div className={`text-sm font-bold ${k.color}`}>{k.value}</div><div className="text-[10px] text-gray-500">{k.label}</div>
            </div>
          ))}
        </div>
        {/* TABS */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(''); setStatusFilter('all') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-[#0a1f1f]'}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
        {/* TOOLBAR */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${activeTab}...`} className={`${INP} pl-8`} />
          </div>
          {activeTab === 'claims' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={INP + ' w-auto'}>
              <option value="all">All Status</option>
              {['draft','submitted','accepted','denied','paid','appealed'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {['claims','payments','fee_schedule'].includes(activeTab) && (
            <button onClick={() => activeTab === 'claims' ? setShowNewClaim(true) : activeTab === 'payments' ? setShowNewPayment(true) : setShowNewFee(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs hover:bg-emerald-600/30 whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" />New {activeTab === 'claims' ? 'Claim' : activeTab === 'payments' ? 'Payment' : 'Fee'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}

      <div className="p-4">
        {activeTab === 'claims' && <ClaimsView claims={filteredClaims} onStatus={updateClaimStatus} />}
        {activeTab === 'payments' && <PaymentsView payments={filteredPayments} onVoid={voidPayment} />}
        {activeTab === 'superbills' && <SuperbillsView superbills={superbills} />}
        {activeTab === 'fee_schedule' && <FeeView fees={feeSchedule} onDelete={deleteFeeItem} search={search} />}
        {activeTab === 'statements' && <StatementsView statements={statements} />}
        {activeTab === 'eligibility' && <EligibilityView checks={eligibility} />}
      </div>

      {showNewClaim && <NewClaimModal doctorId={doctorId!} onSave={createClaim} onClose={() => setShowNewClaim(false)} />}
      {showNewPayment && <NewPaymentModal doctorId={doctorId!} onSave={createPayment} onClose={() => setShowNewPayment(false)} />}
      {showNewFee && <NewFeeModal onSave={createFeeItem} onClose={() => setShowNewFee(false)} />}
    </div>
  )
}

// ═══ CLAIMS ═══
function ClaimsView({ claims, onStatus }: { claims: Claim[]; onStatus: (id: string, s: string) => void }) {
  if (!claims.length) return <Empty icon={FileText} label="No claims found" sub="Create your first claim to start billing" />
  return <div className="space-y-2">{claims.map(c => (
    <div key={c.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3 hover:border-[#1a3d3d] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : 'Unknown'}</span>
            <Badge s={c.status} />
            {c.claim_number && <span className="text-[10px] text-gray-500 font-mono">#{c.claim_number}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
            {c.payer_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.payer_name}</span>}
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />DOS: {fmtDate(c.service_date)}</span>
            {c.submitted_at && <span className="flex items-center gap-1"><Send className="w-3 h-3" />{fmtDate(c.submitted_at)}</span>}
          </div>
          {c.denial_reason && <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Denial: {c.denial_reason}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{fmtMoney(c.total_charge)}</div>
          {c.total_paid > 0 && <div className="text-[11px] text-green-400">Paid: {fmtMoney(c.total_paid)}</div>}
          {c.patient_responsibility > 0 && <div className="text-[11px] text-amber-400">Pt: {fmtMoney(c.patient_responsibility)}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#1a3d3d]/30">
        {c.status === 'draft' && <Btn label="Submit" icon={Send} color="cyan" onClick={() => onStatus(c.id, 'submitted')} />}
        {c.status === 'submitted' && <><Btn label="Mark Paid" icon={CheckCircle} color="green" onClick={() => onStatus(c.id, 'paid')} /><Btn label="Denied" icon={XCircle} color="red" onClick={() => onStatus(c.id, 'denied')} /></>}
        {c.status === 'denied' && <Btn label="Appeal" icon={FileText} color="purple" onClick={() => onStatus(c.id, 'appealed')} />}
        {c.status === 'denied' && c.appeal_deadline && <span className="text-[10px] text-red-400 ml-auto">Appeal by: {fmtDate(c.appeal_deadline)}</span>}
      </div>
    </div>
  ))}</div>
}

// ═══ PAYMENTS ═══
function PaymentsView({ payments, onVoid }: { payments: Payment[]; onVoid: (id: string) => void }) {
  if (!payments.length) return <Empty icon={CreditCard} label="No payments recorded" sub="Post payments from Claims or add manually" />
  return <div className="space-y-2">{payments.map(p => (
    <div key={p.id} className={`bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3 ${p.voided ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : 'Bulk Payment'}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.payment_type === 'insurance' ? 'bg-blue-600/20 text-blue-400' : p.payment_type === 'patient' ? 'bg-amber-600/20 text-amber-400' : 'bg-gray-600/20 text-gray-400'}`}>{p.payment_type}</span>
            {p.voided && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-600/20 text-red-400">VOIDED</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
            {p.method && <span>{p.method}</span>}
            {p.reference_number && <span className="font-mono">Ref: {p.reference_number}</span>}
            <span>{fmtDate(p.posted_date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${p.voided ? 'text-gray-500 line-through' : 'text-green-400'}`}>{fmtMoney(p.amount)}</span>
          {!p.voided && <button onClick={() => onVoid(p.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
    </div>
  ))}</div>
}

// ═══ SUPERBILLS ═══
function SuperbillsView({ superbills }: { superbills: Superbill[] }) {
  if (!superbills.length) return <Empty icon={Receipt} label="No superbills" sub="Superbills are auto-generated from chart encounters" />
  return <div className="space-y-2">{superbills.map(s => (
    <div key={s.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="text-sm font-medium">{s.patients ? `${s.patients.first_name} ${s.patients.last_name}` : 'Patient'}</span><Badge s={s.status} /></div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
            <span>DOS: {fmtDate(s.service_date)}</span>
            {s.diagnosis_codes?.length > 0 && <span>Dx: {s.diagnosis_codes.join(', ')}</span>}
            {Array.isArray(s.procedure_codes) && s.procedure_codes.length > 0 && <span>CPT: {s.procedure_codes.map((p: any) => p.code || p).join(', ')}</span>}
          </div>
        </div>
        <span className="text-sm font-bold">{fmtMoney(s.total_charge)}</span>
      </div>
    </div>
  ))}</div>
}

// ═══ FEE SCHEDULE ═══
function FeeView({ fees, onDelete, search }: { fees: FeeItem[]; onDelete: (id: string) => void; search: string }) {
  const filtered = useMemo(() => { if (!search) return fees; const q = search.toLowerCase(); return fees.filter(f => f.cpt_code.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q)) }, [fees, search])
  if (!filtered.length) return <Empty icon={DollarSign} label="No fee schedule items" sub="Add CPT codes and fees to build your schedule" />
  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-[#1a3d3d]/50 text-gray-500"><th className="text-left p-3">CPT</th><th className="text-left p-3">Description</th><th className="text-right p-3">Fee</th><th className="text-center p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
        <tbody>{filtered.map(f => (
          <tr key={f.id} className="border-b border-[#1a3d3d]/20 hover:bg-[#0a2a2a]">
            <td className="p-3 font-mono text-emerald-400">{f.cpt_code}</td>
            <td className="p-3 text-gray-300">{f.description || '—'}</td>
            <td className="p-3 text-right font-bold">{fmtMoney(f.fee)}</td>
            <td className="p-3 text-center"><Badge s={f.is_active ? 'active' : 'void'} /></td>
            <td className="p-3 text-right"><button onClick={() => onDelete(f.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// ═══ STATEMENTS ═══
function StatementsView({ statements }: { statements: Statement[] }) {
  if (!statements.length) return <Empty icon={Wallet} label="No statements" sub="Statements are created from outstanding balances" />
  return <div className="space-y-2">{statements.map(s => (
    <div key={s.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="text-sm font-medium">{s.patients ? `${s.patients.first_name} ${s.patients.last_name}` : 'Patient'}</span><Badge s={s.status} /></div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400"><span>Issued: {fmtDate(s.statement_date)}</span>{s.due_date && <span>Due: {fmtDate(s.due_date)}</span>}{s.sent_via && <span>Sent: {s.sent_via}</span>}</div>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-amber-400">{fmtMoney(s.total_due)}</span>
          {s.pdf_url && <a href={s.pdf_url} target="_blank" rel="noreferrer" className="block text-[10px] text-emerald-400 hover:underline mt-0.5">View PDF</a>}
        </div>
      </div>
    </div>
  ))}</div>
}

// ═══ ELIGIBILITY ═══
function EligibilityView({ checks }: { checks: EligibilityCheck[] }) {
  if (!checks.length) return <Empty icon={ShieldCheck} label="No eligibility checks" sub="Run insurance eligibility from patient records" />
  return <div className="space-y-2">{checks.map(e => (
    <div key={e.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="text-sm font-medium">{e.patients ? `${e.patients.first_name} ${e.patients.last_name}` : 'Patient'}</span><Badge s={e.status || 'pending'} /></div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">{e.payer_name && <span>{e.payer_name}</span>}{e.plan_name && <span>{e.plan_name}</span>}<span>Checked: {fmtDate(e.checked_at)}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
          <div><div className="text-gray-500">Copay</div><div className="font-bold">{fmtMoney(e.copay)}</div></div>
          <div><div className="text-gray-500">Deductible</div><div className="font-bold">{fmtMoney(e.deductible)}</div></div>
          <div><div className="text-gray-500">Coins</div><div className="font-bold">{e.coinsurance_pct != null ? `${e.coinsurance_pct}%` : '—'}</div></div>
        </div>
      </div>
    </div>
  ))}</div>
}

// ═══ MODALS ═══
function NewClaimModal({ doctorId, onSave, onClose }: { doctorId: string; onSave: (d: any) => void; onClose: () => void }) {
  const [pts, setPts] = useState<any[]>([])
  const [f, setF] = useState({ patient_id: '', payer_name: '', subscriber_id: '', group_number: '', service_date: new Date().toISOString().split('T')[0], total_charge: '', place_of_service: '11', notes: '' })
  useEffect(() => { supabase.from('patients').select('id,first_name,last_name').eq('doctor_id', doctorId).order('last_name').then(({ data }) => setPts(data || [])) }, [doctorId])
  return (
    <Overlay title="New Claim" onClose={onClose}>
      <FL label="Patient *"><select value={f.patient_id} onChange={e => setF({...f, patient_id: e.target.value})} className={INP}><option value="">Select...</option>{pts.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}</select></FL>
      <div className="grid grid-cols-2 gap-3"><FL label="Payer"><input value={f.payer_name} onChange={e => setF({...f, payer_name: e.target.value})} className={INP} placeholder="Insurance company" /></FL><FL label="Subscriber ID"><input value={f.subscriber_id} onChange={e => setF({...f, subscriber_id: e.target.value})} className={INP} /></FL></div>
      <div className="grid grid-cols-3 gap-3"><FL label="Group #"><input value={f.group_number} onChange={e => setF({...f, group_number: e.target.value})} className={INP} /></FL><FL label="DOS *"><input type="date" value={f.service_date} onChange={e => setF({...f, service_date: e.target.value})} className={INP} /></FL><FL label="Charge *"><input type="number" step="0.01" value={f.total_charge} onChange={e => setF({...f, total_charge: e.target.value})} className={INP} placeholder="0.00" /></FL></div>
      <FL label="Notes"><textarea value={f.notes} onChange={e => setF({...f, notes: e.target.value})} className={`${INP} h-16 resize-none`} /></FL>
      <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button><button onClick={() => { if (f.patient_id && f.total_charge) onSave({...f, total_charge: parseFloat(f.total_charge), status: 'draft', claim_number: `CLM-${Date.now().toString(36).toUpperCase()}`}) }} disabled={!f.patient_id||!f.total_charge} className="px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Create</button></div>
    </Overlay>
  )
}

function NewPaymentModal({ doctorId, onSave, onClose }: { doctorId: string; onSave: (d: any) => void; onClose: () => void }) {
  const [pts, setPts] = useState<any[]>([])
  const [f, setF] = useState({ patient_id: '', payment_type: 'patient', method: 'credit_card', amount: '', reference_number: '', posted_date: new Date().toISOString().split('T')[0], notes: '' })
  useEffect(() => { supabase.from('patients').select('id,first_name,last_name').eq('doctor_id', doctorId).order('last_name').then(({ data }) => setPts(data || [])) }, [doctorId])
  return (
    <Overlay title="Post Payment" onClose={onClose}>
      <FL label="Patient"><select value={f.patient_id} onChange={e => setF({...f, patient_id: e.target.value})} className={INP}><option value="">— Bulk —</option>{pts.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}</select></FL>
      <div className="grid grid-cols-2 gap-3">
        <FL label="Type"><select value={f.payment_type} onChange={e => setF({...f, payment_type: e.target.value})} className={INP}>{['patient','insurance','copay','adjustment'].map(o => <option key={o} value={o}>{o}</option>)}</select></FL>
        <FL label="Method"><select value={f.method} onChange={e => setF({...f, method: e.target.value})} className={INP}>{['credit_card','check','cash','eft','era'].map(o => <option key={o} value={o}>{o}</option>)}</select></FL>
      </div>
      <div className="grid grid-cols-3 gap-3"><FL label="Amount *"><input type="number" step="0.01" value={f.amount} onChange={e => setF({...f, amount: e.target.value})} className={INP} placeholder="0.00" /></FL><FL label="Ref #"><input value={f.reference_number} onChange={e => setF({...f, reference_number: e.target.value})} className={INP} /></FL><FL label="Date"><input type="date" value={f.posted_date} onChange={e => setF({...f, posted_date: e.target.value})} className={INP} /></FL></div>
      <FL label="Notes"><textarea value={f.notes} onChange={e => setF({...f, notes: e.target.value})} className={`${INP} h-16 resize-none`} /></FL>
      <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button><button onClick={() => { if (f.amount) onSave({...f, amount: parseFloat(f.amount), patient_id: f.patient_id||null}) }} disabled={!f.amount} className="px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Post</button></div>
    </Overlay>
  )
}

function NewFeeModal({ onSave, onClose }: { onSave: (d: any) => void; onClose: () => void }) {
  const [f, setF] = useState({ cpt_code: '', description: '', fee: '', effective_date: new Date().toISOString().split('T')[0] })
  return (
    <Overlay title="Add Fee" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3"><FL label="CPT *"><input value={f.cpt_code} onChange={e => setF({...f, cpt_code: e.target.value})} className={INP} placeholder="99213" /></FL><FL label="Fee *"><input type="number" step="0.01" value={f.fee} onChange={e => setF({...f, fee: e.target.value})} className={INP} placeholder="150.00" /></FL></div>
      <FL label="Description"><input value={f.description} onChange={e => setF({...f, description: e.target.value})} className={INP} placeholder="Office visit, est patient" /></FL>
      <FL label="Effective"><input type="date" value={f.effective_date} onChange={e => setF({...f, effective_date: e.target.value})} className={INP} /></FL>
      <div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button><button onClick={() => { if (f.cpt_code&&f.fee) onSave({...f, fee: parseFloat(f.fee), is_active: true}) }} disabled={!f.cpt_code||!f.fee} className="px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Add</button></div>
    </Overlay>
  )
}

// ═══ SHARED ═══
function Badge({ s }: { s: string }) { return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[s] || STATUS_COLORS.draft}`}>{s.replace(/_/g,' ')}</span> }
function Btn({ label, icon: I, color, onClick }: { label: string; icon: typeof Send; color: string; onClick: () => void }) {
  const c: Record<string,string> = { cyan:'text-cyan-400 hover:bg-cyan-600/10', green:'text-green-400 hover:bg-green-600/10', red:'text-red-400 hover:bg-red-600/10', purple:'text-purple-400 hover:bg-purple-600/10' }
  return <button onClick={onClick} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${c[color]||c.cyan}`}><I className="w-3 h-3" />{label}</button>
}
function Empty({ icon: I, label, sub }: { icon: typeof FileText; label: string; sub: string }) { return <div className="text-center py-16"><I className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">{label}</p><p className="text-gray-600 text-xs mt-1">{sub}</p></div> }
function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}><div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-1"><h3 className="text-sm font-bold">{title}</h3><button onClick={onClose}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button></div>{children}</div></div>
}
function FL({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-[11px] text-gray-400 mb-1">{label}</label>{children}</div> }
