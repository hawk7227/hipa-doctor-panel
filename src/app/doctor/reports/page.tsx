'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { BarChart3, RefreshCw, FileText, DollarSign, Activity, Users, Calendar, TrendingUp, Clock, AlertCircle, Target, Stethoscope, CheckCircle, XCircle, Receipt, Building2, Pill, FlaskConical, UserPlus } from 'lucide-react'

type ReportTab = 'overview' | 'clinical' | 'financial' | 'operational' | 'quality'
interface KPI { label: string; value: string; icon: typeof Activity; color: string }
const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50"
const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [data, setData] = useState<any>({})

  useEffect(() => {
    const init = async () => {
      try { const au = await getCurrentUser(); if (!au?.doctor?.id) { router.push('/login'); return }; setDoctorId(au.doctor.id); await fetchData(au.doctor.id) } catch { router.push('/login') }
    }; init()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async (docId: string) => {
    setLoading(true)
    try {
      const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
      const since = new Date(Date.now() - days[dateRange] * 86400000).toISOString()
      const [pR, aR, cR, pmR, rxR, lR, rfR, nR] = await Promise.all([
        supabase.from('patients').select('id, created_at', { count: 'exact' }).eq('doctor_id', docId),
        supabase.from('appointments').select('id, status, created_at').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('billing_claims').select('id, status, total_charge, total_paid, created_at').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('billing_payments').select('id, amount, voided, payment_type').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('prescriptions').select('id, is_controlled, created_at').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('lab_orders').select('id, status, created_at').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('referrals').select('id, status, created_at').eq('doctor_id', docId).gte('created_at', since),
        supabase.from('clinical_notes').select('id, status, created_at').eq('doctor_id', docId).gte('created_at', since),
      ])
      const pts = pR.data || [], apts = aR.data || [], cls = cR.data || []
      const pays = (pmR.data || []).filter((p: any) => !p.voided)
      const rxs = rxR.data || [], labs = lR.data || [], refs = rfR.data || [], notes = nR.data || []
      const tc = cls.reduce((s: number, c: any) => s + (c.total_charge || 0), 0)
      const tp = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0)
      const np = pts.filter((p: any) => new Date(p.created_at) >= new Date(since)).length
      const ca = apts.filter((a: any) => a.status === 'completed' || a.status === 'finished').length
      const xa = apts.filter((a: any) => a.status === 'cancelled' || a.status === 'no_show').length
      const dc = cls.filter((c: any) => c.status === 'denied').length
      const sn = notes.filter((n: any) => n.status === 'signed' || n.status === 'locked').length
      setData({ totalPatients: pR.count || pts.length, newPatients: np, totalApts: apts.length, completedApts: ca, cancelledApts: xa, noShowRate: apts.length > 0 ? Math.round((xa / apts.length) * 100) : 0, totalCharges: tc, totalCollected: tp, collectionRate: tc > 0 ? Math.round((tp / tc) * 100) : 0, outstanding: tc - tp, claimCount: cls.length, deniedClaims: dc, denialRate: cls.length > 0 ? Math.round((dc / cls.length) * 100) : 0, prescriptions: rxs.length, controlledRx: rxs.filter((r: any) => r.is_controlled).length, labOrders: labs.length, pendingLabs: labs.filter((l: any) => l.status === 'pending').length, referrals: refs.length, pendingRefs: refs.filter((r: any) => r.status === 'draft' || r.status === 'pending').length, notes: notes.length, signedNotes: sn, unsignedNotes: notes.length - sn })
    } catch (e) { console.error('Reports:', e) } finally { setLoading(false) }
  }, [dateRange])

  useEffect(() => { if (doctorId) fetchData(doctorId) }, [dateRange, doctorId, fetchData])

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  const TABS: { key: ReportTab; label: string; icon: typeof Activity }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 }, { key: 'clinical', label: 'Clinical', icon: Stethoscope },
    { key: 'financial', label: 'Financial', icon: DollarSign }, { key: 'operational', label: 'Operations', icon: Calendar },
    { key: 'quality', label: 'Quality', icon: Target },
  ]

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><BarChart3 className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Reports & Analytics</h1><p className="text-xs text-gray-500">Practice performance insights</p></div></div>
          <div className="flex items-center gap-2">
            <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className={`${INP} w-auto`}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="1y">Last year</option></select>
            <button onClick={() => doctorId && fetchData(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {TABS.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-[#0a1f1f]'}`}><t.icon className="w-3.5 h-3.5" />{t.label}</button>)}
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'overview' && <Overview d={data} />}
        {activeTab === 'clinical' && <Clinical d={data} />}
        {activeTab === 'financial' && <Financial d={data} />}
        {activeTab === 'operational' && <Operational d={data} />}
        {activeTab === 'quality' && <Quality d={data} />}
      </div>
    </div>
  )
}

function KG({ items }: { items: KPI[] }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{items.map((k, i) => (
    <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
      <k.icon className={`w-4 h-4 ${k.color} mb-2`} /><div className={`text-xl font-bold ${k.color}`}>{k.value}</div><div className="text-[11px] text-gray-500 mt-0.5">{k.label}</div>
    </div>
  ))}</div>
}

function Overview({ d }: { d: any }) {
  return <div className="space-y-6">
    <KG items={[
      { label: 'Total Patients', value: `${d.totalPatients || 0}`, icon: Users, color: 'text-blue-400' },
      { label: 'New Patients', value: `${d.newPatients || 0}`, icon: UserPlus, color: 'text-emerald-400' },
      { label: 'Appointments', value: `${d.totalApts || 0}`, icon: Calendar, color: 'text-cyan-400' },
      { label: 'Collection Rate', value: `${d.collectionRate || 0}%`, icon: TrendingUp, color: d.collectionRate >= 90 ? 'text-green-400' : 'text-amber-400' },
      { label: 'Revenue', value: fmtMoney(d.totalCollected || 0), icon: DollarSign, color: 'text-green-400' },
      { label: 'Outstanding', value: fmtMoney(d.outstanding || 0), icon: Clock, color: 'text-amber-400' },
      { label: 'Denial Rate', value: `${d.denialRate || 0}%`, icon: XCircle, color: d.denialRate > 10 ? 'text-red-400' : 'text-green-400' },
      { label: 'Unsigned Notes', value: `${d.unsignedNotes || 0}`, icon: FileText, color: d.unsignedNotes > 5 ? 'text-red-400' : 'text-emerald-400' },
    ]} />
    <Sec title="Quick Insights"><div className="space-y-2">
      {d.unsignedNotes > 0 && <Ins icon={FileText} c="amber" t={`${d.unsignedNotes} clinical notes need signing`} />}
      {d.pendingLabs > 0 && <Ins icon={FlaskConical} c="cyan" t={`${d.pendingLabs} lab orders pending results`} />}
      {d.pendingRefs > 0 && <Ins icon={Building2} c="blue" t={`${d.pendingRefs} referrals awaiting response`} />}
      {d.denialRate > 10 && <Ins icon={XCircle} c="red" t={`Denial rate ${d.denialRate}% — above 10% threshold`} />}
      {d.noShowRate > 15 && <Ins icon={AlertCircle} c="amber" t={`No-show rate ${d.noShowRate}% — consider reminders`} />}
      {!d.unsignedNotes && !d.pendingLabs && !d.pendingRefs && d.denialRate <= 10 && <Ins icon={CheckCircle} c="green" t="All metrics within normal ranges" />}
    </div></Sec>
  </div>
}

function Clinical({ d }: { d: any }) {
  return <KG items={[
    { label: 'Clinical Notes', value: `${d.notes || 0}`, icon: FileText, color: 'text-blue-400' },
    { label: 'Signed Notes', value: `${d.signedNotes || 0}`, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Prescriptions', value: `${d.prescriptions || 0}`, icon: Pill, color: 'text-purple-400' },
    { label: 'Controlled Rx', value: `${d.controlledRx || 0}`, icon: Pill, color: 'text-amber-400' },
    { label: 'Lab Orders', value: `${d.labOrders || 0}`, icon: FlaskConical, color: 'text-cyan-400' },
    { label: 'Pending Labs', value: `${d.pendingLabs || 0}`, icon: Clock, color: d.pendingLabs > 0 ? 'text-amber-400' : 'text-gray-500' },
    { label: 'Referrals', value: `${d.referrals || 0}`, icon: Building2, color: 'text-teal-400' },
    { label: 'Pending Referrals', value: `${d.pendingRefs || 0}`, icon: Clock, color: d.pendingRefs > 0 ? 'text-amber-400' : 'text-gray-500' },
  ]} />
}

function Financial({ d }: { d: any }) {
  return <KG items={[
    { label: 'Total Charges', value: fmtMoney(d.totalCharges || 0), icon: DollarSign, color: 'text-blue-400' },
    { label: 'Collected', value: fmtMoney(d.totalCollected || 0), icon: CheckCircle, color: 'text-green-400' },
    { label: 'Outstanding', value: fmtMoney(d.outstanding || 0), icon: Clock, color: 'text-amber-400' },
    { label: 'Collection Rate', value: `${d.collectionRate || 0}%`, icon: TrendingUp, color: d.collectionRate >= 90 ? 'text-green-400' : 'text-amber-400' },
    { label: 'Claims Filed', value: `${d.claimCount || 0}`, icon: FileText, color: 'text-cyan-400' },
    { label: 'Denied', value: `${d.deniedClaims || 0}`, icon: XCircle, color: d.deniedClaims > 0 ? 'text-red-400' : 'text-green-400' },
    { label: 'Denial Rate', value: `${d.denialRate || 0}%`, icon: Target, color: d.denialRate > 10 ? 'text-red-400' : 'text-green-400' },
    { label: 'Avg/Claim', value: d.claimCount > 0 ? fmtMoney(Math.round((d.totalCharges || 0) / d.claimCount)) : '$0', icon: Receipt, color: 'text-purple-400' },
  ]} />
}

function Operational({ d }: { d: any }) {
  return <KG items={[
    { label: 'Appointments', value: `${d.totalApts || 0}`, icon: Calendar, color: 'text-blue-400' },
    { label: 'Completed', value: `${d.completedApts || 0}`, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Cancelled', value: `${d.cancelledApts || 0}`, icon: XCircle, color: 'text-red-400' },
    { label: 'No-Show Rate', value: `${d.noShowRate || 0}%`, icon: AlertCircle, color: d.noShowRate > 15 ? 'text-red-400' : 'text-green-400' },
    { label: 'New Patients', value: `${d.newPatients || 0}`, icon: UserPlus, color: 'text-emerald-400' },
    { label: 'Total Patients', value: `${d.totalPatients || 0}`, icon: Users, color: 'text-cyan-400' },
  ]} />
}

function Quality({ d }: { d: any }) {
  return <div className="space-y-6">
    <KG items={[
      { label: 'Note Completion', value: d.notes > 0 ? `${Math.round((d.signedNotes / d.notes) * 100)}%` : '—', icon: FileText, color: 'text-emerald-400' },
      { label: 'Unsigned Notes', value: `${d.unsignedNotes || 0}`, icon: AlertCircle, color: d.unsignedNotes > 0 ? 'text-red-400' : 'text-green-400' },
      { label: 'Clean Claims', value: d.claimCount > 0 ? `${100 - (d.denialRate || 0)}%` : '—', icon: CheckCircle, color: d.denialRate < 5 ? 'text-green-400' : 'text-amber-400' },
      { label: 'Lab Follow-up', value: d.labOrders > 0 ? `${Math.round(((d.labOrders - d.pendingLabs) / d.labOrders) * 100)}%` : '—', icon: FlaskConical, color: 'text-cyan-400' },
    ]} />
    <Sec title="Quality Indicators"><div className="space-y-2">
      <QBar label="Note Sign Rate" value={d.notes > 0 ? Math.round((d.signedNotes / d.notes) * 100) : 100} target={95} />
      <QBar label="Clean Claims" value={100 - (d.denialRate || 0)} target={95} />
      <QBar label="Collection Rate" value={d.collectionRate || 0} target={90} />
      <QBar label="Lab Completion" value={d.labOrders > 0 ? Math.round(((d.labOrders - d.pendingLabs) / d.labOrders) * 100) : 100} target={85} />
    </div></Sec>
  </div>
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div><h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>{children}</div> }
function Ins({ icon: I, c, t }: { icon: typeof FileText; c: string; t: string }) {
  const cs: Record<string, string> = { amber: 'border-amber-500/30 text-amber-400', red: 'border-red-500/30 text-red-400', blue: 'border-blue-500/30 text-blue-400', cyan: 'border-cyan-500/30 text-cyan-400', green: 'border-green-500/30 text-green-400' }
  return <div className={`flex items-center gap-2 p-2.5 bg-[#0a1f1f] border rounded-lg text-xs ${cs[c] || cs.amber}`}><I className="w-4 h-4 shrink-0" />{t}</div>
}
function QBar({ label, value, target }: { label: string; value: number; target: number }) {
  const met = value >= target
  return <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
    <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-300">{label}</span><div className="flex items-center gap-2"><span className={`text-xs font-bold ${met ? 'text-green-400' : 'text-amber-400'}`}>{value}%</span><span className="text-[10px] text-gray-500">Target: {target}%</span></div></div>
    <div className="h-2 bg-[#061818] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : value >= target * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>
  </div>
}
