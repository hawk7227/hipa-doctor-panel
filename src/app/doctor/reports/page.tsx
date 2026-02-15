'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  BarChart3, ArrowLeft, RefreshCw, FileText, DollarSign, Activity,
  Users, Calendar, TrendingUp, Download, Clock, AlertCircle,
  PieChart, Target, Stethoscope, ChevronRight
} from 'lucide-react'

type ReportTab = 'overview' | 'clinical' | 'financial' | 'operational' | 'quality'

interface KPI { label: string; value: string; change: string; trend: 'up' | 'down' | 'flat'; icon: typeof Activity }

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [dateRange, setDateRange] = useState('30')
  const [kpis, setKpis] = useState<Record<string, number>>({})

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    init()
  }, [router])

  const fetchKPIs = useCallback(async () => {
    if (!doctorId) return
    const since = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString()
    const [appts, patients, claims, payments] = await Promise.all([
      supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('doctor_id', doctorId).gte('created_at', since),
      supabase.from('patients').select('*', { count: 'exact', head: true }).eq('doctor_id', doctorId).gte('created_at', since),
      supabase.from('claims').select('total_charge, total_paid, status').eq('doctor_id', doctorId).gte('created_at', since),
      supabase.from('payments').select('amount').eq('doctor_id', doctorId).gte('created_at', since),
    ])
    const totalRevenue = (payments.data || []).reduce((s, p) => s + (parseFloat(p.amount as any) || 0), 0)
    const totalCharges = (claims.data || []).reduce((s, c) => s + (parseFloat(c.total_charge as any) || 0), 0)
    setKpis({
      appointments: appts.count || 0, newPatients: patients.count || 0,
      totalRevenue, totalCharges, claimsSubmitted: (claims.data || []).length,
      claimsPaid: (claims.data || []).filter(c => c.status === 'paid').length,
    })
  }, [doctorId, dateRange])

  useEffect(() => { if (doctorId) fetchKPIs() }, [doctorId, dateRange, fetchKPIs])

  if (loading) return <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center"><RefreshCw className="w-8 h-8 text-teal-400 animate-spin" /></div>

  const kpiCards: KPI[] = [
    { label: 'Appointments', value: (kpis.appointments || 0).toString(), change: '+12%', trend: 'up', icon: Calendar },
    { label: 'New Patients', value: (kpis.newPatients || 0).toString(), change: '+8%', trend: 'up', icon: Users },
    { label: 'Revenue', value: `$${(kpis.totalRevenue || 0).toLocaleString()}`, change: '+15%', trend: 'up', icon: DollarSign },
    { label: 'Claims Submitted', value: (kpis.claimsSubmitted || 0).toString(), change: '', trend: 'flat', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-[#0a1f1f] overflow-y-auto">
      <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-[#1a3d3d] text-gray-400"><ArrowLeft className="w-4 h-4" /></button>
            <h1 className="text-lg font-bold text-white flex items-center space-x-2"><BarChart3 className="w-5 h-5 text-teal-400" /><span>Reports & Analytics</span></h1>
          </div>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-1.5 text-xs text-white">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option>
          </select>
        </div>
        <div className="flex mt-3 space-x-1 overflow-x-auto">
          {([
            { key: 'overview' as ReportTab, label: 'Overview', icon: PieChart },
            { key: 'clinical' as ReportTab, label: 'Clinical', icon: Stethoscope },
            { key: 'financial' as ReportTab, label: 'Financial', icon: DollarSign },
            { key: 'operational' as ReportTab, label: 'Operational', icon: Activity },
            { key: 'quality' as ReportTab, label: 'Quality', icon: Target },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${activeTab === tab.key ? 'bg-teal-600/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'}`}>
              <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpiCards.map(k => (
            <div key={k.label} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
              <div className="flex items-center justify-between mb-2">
                <k.icon className="w-5 h-5 text-teal-400" />
                {k.change && <span className={`text-[10px] font-bold ${k.trend === 'up' ? 'text-green-400' : k.trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>{k.change}</span>}
              </div>
              <p className="text-2xl font-bold text-white">{k.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white">Dashboard Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue chart placeholder */}
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <h3 className="text-xs font-bold text-gray-300 mb-3">Revenue Trend</h3>
                <div className="h-40 flex items-end space-x-1">
                  {Array.from({ length: 12 }, (_, i) => {
                    const h = 20 + Math.random() * 80
                    return <div key={i} className="flex-1 bg-teal-500/30 rounded-t" style={{ height: `${h}%` }} />
                  })}
                </div>
                <div className="flex justify-between mt-2"><span className="text-[9px] text-gray-500">Jan</span><span className="text-[9px] text-gray-500">Jun</span><span className="text-[9px] text-gray-500">Dec</span></div>
              </div>
              {/* Appointment types */}
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <h3 className="text-xs font-bold text-gray-300 mb-3">Appointments by Type</h3>
                <div className="space-y-2">
                  {[
                    { type: 'Telehealth', pct: 45, color: 'bg-teal-500' },
                    { type: 'In-Person', pct: 30, color: 'bg-blue-500' },
                    { type: 'Follow-Up', pct: 15, color: 'bg-cyan-500' },
                    { type: 'New Patient', pct: 10, color: 'bg-amber-500' },
                  ].map(t => (
                    <div key={t.type}>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5"><span>{t.type}</span><span>{t.pct}%</span></div>
                      <div className="h-2 bg-[#1a3d3d] rounded-full overflow-hidden"><div className={`h-full ${t.color} rounded-full`} style={{ width: `${t.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Quick reports */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-300">Quick Reports</h3>
              {[
                { name: 'Patient Demographics Summary', desc: 'Age, gender, location distribution', icon: Users },
                { name: 'Appointment No-Show Rate', desc: 'Missed appointments analysis', icon: Calendar },
                { name: 'Revenue by Service Type', desc: 'CPT code breakdown', icon: DollarSign },
                { name: 'Clinical Quality Measures', desc: 'MIPS/HEDIS compliance', icon: Target },
                { name: 'Provider Productivity', desc: 'Patients seen, RVU generation', icon: Activity },
                { name: 'Claim Denial Analysis', desc: 'Top denial reasons and trends', icon: AlertCircle },
              ].map(r => (
                <div key={r.name} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d] flex items-center justify-between hover:border-teal-500/30 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <r.icon className="w-4 h-4 text-teal-400" />
                    <div><p className="text-xs font-medium text-white">{r.name}</p><p className="text-[10px] text-gray-500">{r.desc}</p></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-2 py-1 rounded text-[10px] bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Generate</button>
                    <Download className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'clinical' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Clinical Reports</h2>
            {['Patient Visit Summary', 'Diagnosis Frequency', 'Medication Prescribing Patterns', 'Lab Order Volume', 'Referral Completion Rates', 'Chronic Disease Registry', 'Preventive Care Compliance', 'Immunization Coverage'].map(r => (
              <div key={r} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d] flex items-center justify-between">
                <span className="text-xs text-white">{r}</span>
                <button className="px-2 py-1 rounded text-[10px] bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Run</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Financial Reports</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <p className="text-[10px] text-gray-500">Total Charges</p>
                <p className="text-xl font-bold text-white">${(kpis.totalCharges || 0).toLocaleString()}</p>
              </div>
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <p className="text-[10px] text-gray-500">Collections</p>
                <p className="text-xl font-bold text-green-400">${(kpis.totalRevenue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <p className="text-[10px] text-gray-500">Claims Paid</p>
                <p className="text-xl font-bold text-teal-400">{kpis.claimsPaid || 0}</p>
              </div>
              <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <p className="text-[10px] text-gray-500">Collection Rate</p>
                <p className="text-xl font-bold text-amber-400">{kpis.totalCharges ? ((kpis.totalRevenue / kpis.totalCharges * 100).toFixed(1)) : 0}%</p>
              </div>
            </div>
            {['Aging Report (30/60/90/120)', 'Payer Mix Analysis', 'CPT Code Revenue', 'Denial Report', 'Patient Balance Report', 'Payment Posting Summary', 'ERA Reconciliation', 'Fee Schedule Comparison'].map(r => (
              <div key={r} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d] flex items-center justify-between">
                <span className="text-xs text-white">{r}</span>
                <button className="px-2 py-1 rounded text-[10px] bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Run</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'operational' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Operational Reports</h2>
            {['Scheduling Utilization', 'No-Show/Cancellation Analysis', 'Wait Time Analysis', 'Staff Productivity', 'Telehealth vs In-Person', 'Room Utilization', 'Patient Throughput', 'Chart Completion Rates'].map(r => (
              <div key={r} className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d] flex items-center justify-between">
                <span className="text-xs text-white">{r}</span>
                <button className="px-2 py-1 rounded text-[10px] bg-teal-600/20 text-teal-400 hover:bg-teal-600/40">Run</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Quality Measures</h2>
            <p className="text-[10px] text-gray-500">MIPS/HEDIS quality measure tracking for value-based care reporting</p>
            {[
              { measure: 'Controlling High Blood Pressure', id: 'CMS165', target: 90, current: 78 },
              { measure: 'Diabetes: HbA1c Control', id: 'CMS122', target: 85, current: 72 },
              { measure: 'Breast Cancer Screening', id: 'CMS125', target: 80, current: 65 },
              { measure: 'Colorectal Cancer Screening', id: 'CMS130', target: 75, current: 58 },
              { measure: 'Depression Screening', id: 'CMS002', target: 90, current: 85 },
              { measure: 'BMI Screening & Follow-Up', id: 'CMS069', target: 85, current: 92 },
            ].map(m => (
              <div key={m.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                <div className="flex items-center justify-between mb-2">
                  <div><p className="text-xs font-medium text-white">{m.measure}</p><p className="text-[9px] text-gray-500">{m.id}</p></div>
                  <span className={`text-sm font-bold ${m.current >= m.target ? 'text-green-400' : m.current >= m.target * 0.8 ? 'text-amber-400' : 'text-red-400'}`}>{m.current}%</span>
                </div>
                <div className="h-2 bg-[#1a3d3d] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.current >= m.target ? 'bg-green-500' : m.current >= m.target * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.current}%` }} />
                </div>
                <p className="text-[9px] text-gray-500 mt-1">Target: {m.target}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
