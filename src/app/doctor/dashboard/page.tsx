'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { authFetch } from '@/lib/auth-fetch'
import PatientSearchTrigger from '@/components/PatientSearchTrigger'
import {
  Calendar, Users, Clock, DollarSign, FileText,
  CheckCircle, Bell, ChevronRight, RefreshCw,
  Pill, FlaskConical, Building2, ClipboardList, TrendingUp, Activity,
  UserPlus, MessageSquare, Shield, Video, BarChart3, Download, Database, Wifi, WifiOff
} from 'lucide-react'

interface Notification { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string }
interface Apt { id: string; requested_date_time: string | null; status: string; visit_type: string | null; patient_name: string | null }

export default function DoctorDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctor, setDoctor] = useState<any>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [stats, setStats] = useState({ totalPatients: 0, activePatients: 0, newThisMonth: 0, appointmentsToday: 0, avgAppointments: 0 })
  const [upcomingApts, setUpcomingApts] = useState<Apt[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [inbox, setInbox] = useState<any[]>([])
  const [revenue, setRevenue] = useState({ collected: 0, outstanding: 0, pendingLabs: 0, pendingAuths: 0 })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const au = await getCurrentUser()
        if (!au?.doctor?.id) { router.push('/login'); return }
        setDoctor(au.doctor)
        setDoctorId(au.doctor.id)
        await fetchAll(au.doctor.id)
      } catch { router.push('/login') }
    }
    init()
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async (docId: string) => {
    setLoading(true)
    try {
      // 1. Dashboard stats API (DrChrono + local)
      try {
        const res = await authFetch('/api/dashboard/stats')
        if (res.ok) {
          const d = await res.json()
          setStats({ totalPatients: d.totalPatients || 0, activePatients: d.activePatients || 0, newThisMonth: d.newThisMonth || 0, appointmentsToday: d.appointmentsToday || 0, avgAppointments: d.avgAppointments || 0 })
          if (d.upcomingAppointments) setUpcomingApts(d.upcomingAppointments.map((a: any) => ({ id: a.id, requested_date_time: a.requested_date_time, status: a.status, visit_type: a.visit_type, patient_name: a.patient_name })))
          if (d.notifications) setNotifications(d.notifications)
        }
      } catch (e) { console.error('Stats API:', e) }

      // 2. Clinical inbox - each query wrapped independently so one failure doesn't block others
      try {
        const safeQuery = async (queryBuilder: PromiseLike<any>) => { try { const r = await queryBuilder; return r.data || [] } catch { return [] } }
        const [notes, labs, refs, auths, pendApts] = await Promise.all([
          safeQuery(supabase.from('clinical_notes').select('id, note_type, created_at').eq('doctor_id', docId).in('status', ['draft', 'in_progress']).order('created_at', { ascending: false }).limit(10)),
          safeQuery(supabase.from('lab_orders').select('id, lab_name, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10)),
          safeQuery(supabase.from('referrals').select('id, referred_to_name, created_at').eq('doctor_id', docId).in('status', ['draft', 'pending']).order('created_at', { ascending: false }).limit(10)),
          safeQuery(supabase.from('prior_authorizations').select('id, service_description, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10)),
          safeQuery(supabase.from('appointments').select('id, requested_date_time, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10)),
        ])
        const items: any[] = []
        ;(notes).forEach((n: any) => items.push({ type: 'unsigned_note', id: n.id, label: `Unsigned ${n.note_type || 'note'}`, sub: fmtAgo(n.created_at), time: n.created_at }))
        ;(labs).forEach((l: any) => items.push({ type: 'pending_lab', id: l.id, label: `Lab: ${l.lab_name || 'Pending'}`, sub: fmtAgo(l.created_at), time: l.created_at }))
        ;(refs).forEach((r: any) => items.push({ type: 'pending_ref', id: r.id, label: `Referral: ${r.referred_to_name || 'Pending'}`, sub: fmtAgo(r.created_at), time: r.created_at }))
        ;(auths).forEach((a: any) => items.push({ type: 'pending_auth', id: a.id, label: `Prior Auth: ${a.service_description || 'Pending'}`, sub: fmtAgo(a.created_at), time: a.created_at }))
        ;(pendApts).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients }))
          .forEach((a: any) => items.push({ type: 'pending_apt', id: a.id, label: `New request: ${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || 'Patient', sub: a.visit_type || 'video', time: a.requested_date_time || '' }))
        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setInbox(items.slice(0, 15))

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const [paysR, claimsR] = await Promise.all([
          supabase.from('billing_payments').select('amount, voided').eq('doctor_id', docId).gte('created_at', monthStart),
          supabase.from('billing_claims').select('total_charge, total_paid').eq('doctor_id', docId).gte('created_at', monthStart),
        ])
        const collected = (paysR.data || []).filter((p: any) => !p.voided).reduce((s: number, p: any) => s + (p.amount || 0), 0)
        const charges = (claimsR.data || []).reduce((s: number, c: any) => s + (c.total_charge || 0), 0)
        setRevenue({ collected, outstanding: charges - collected, pendingLabs: labs.length, pendingAuths: auths.length })
      } catch (e) { console.error('Inbox:', e) }
    } catch (err) { console.error('Dashboard:', err) }
    finally { setLoading(false) }
  }, [])

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* ═══ HERO HEADER ═══ */}
      <div className="bg-gradient-to-r from-[#061818] to-[#0a1f1f] border-b border-[#1a3d3d]/30 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-xl font-bold">{doctor?.first_name?.[0]}{doctor?.last_name?.[0]}</div>
            <div>
              <h1 className="text-xl font-bold">Welcome back, Dr. {doctor?.first_name} {doctor?.last_name}</h1>
              <p className="text-sm text-emerald-400">{doctor?.specialty || 'Family Medicine'} • {doctor?.experience_years || ''} {doctor?.experience_years ? 'years experience' : ''}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-300">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-sm text-emerald-400 font-semibold">Appointments Today: {stats.appointmentsToday}</p>
          </div>
        </div>
      </div>

      {/* ═══ ACTION BUTTONS ═══ */}
      <div className="px-6 py-4 flex flex-wrap gap-3 border-b border-[#1a3d3d]/20">
        <ActionBtn label="Create Meeting Link" color="bg-blue-600 hover:bg-blue-700" href="/doctor/appointments" />
        <ActionBtn label="Start No-Call Review" color="bg-rose-500 hover:bg-rose-600" href="/doctor/chart-management" />
        <ActionBtn label="Open Calendar" color="bg-[#1a3d3d] hover:bg-[#245050]" href="/doctor/schedule" />
        <ActionBtn label="Manage Staff" color="bg-amber-500 hover:bg-amber-600" href="/doctor/staff-hub" />
        <ActionBtn label="Chart Management" color="bg-emerald-600 hover:bg-emerald-700" href="/doctor/chart-management" />
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="px-6 py-3">
        <PatientSearchTrigger placeholder="Search patients — name, DOB, email, phone..." />
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users} label="Total Patients" value={stats.totalPatients.toLocaleString()} iconBg="bg-cyan-600/20" iconColor="text-cyan-400" onClick={() => router.push('/doctor/patients')} />
          <KPICard icon={Calendar} label="Active Patients" value={`${stats.activePatients}`} iconBg="bg-emerald-600/20" iconColor="text-emerald-400" />
          <KPICard icon={Clock} label="New This Month" value={`${stats.newThisMonth}`} iconBg="bg-amber-600/20" iconColor="text-amber-400" />
          <KPICard icon={BarChart3} label="Avg. Appointments" value={`${stats.avgAppointments}`} iconBg="bg-purple-600/20" iconColor="text-purple-400" />
        </div>

        {/* ═══ APPOINTMENTS + NOTIFICATIONS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming Appointments */}
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1a3d3d]/30">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold">Upcoming Appointments</h2>
            </div>
            <div className="p-4">
              {upcomingApts.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No upcoming appointments</p>
              ) : (
                <div className="space-y-2">
                  {upcomingApts.map(a => (
                    <Link key={a.id} href="/doctor/appointments" className="flex items-center justify-between p-3 bg-[#061818] rounded-lg hover:bg-[#0c2828] transition-colors">
                      <div>
                        <div className="text-sm font-semibold">{a.patient_name || 'Patient'}</div>
                        <div className="text-xs text-gray-500">{a.requested_date_time ? new Date(a.requested_date_time).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-md text-xs font-bold ${a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : a.status === 'accepted' || a.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{a.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1a3d3d]/30">
              <Bell className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold">Recent Notifications</h2>
            </div>
            <div className="p-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm mb-3">No recent notifications</p>
                  <button onClick={() => setShowNotifications(!showNotifications)} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">Open Drawer</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 6).map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-3 bg-[#061818] rounded-lg">
                      <NotifIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{n.title}</div>
                        <div className="text-[11px] text-gray-500 truncate">{n.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ CLINICAL INBOX ═══ */}
        {inbox.length > 0 && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1a3d3d]/30">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold">Clinical Inbox</h2>
              <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full font-bold">{inbox.length}</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {inbox.map((item, i) => (
                <div key={`${item.type}-${item.id}-${i}`} className="flex items-center gap-3 p-3 bg-[#061818] rounded-lg hover:bg-[#0c2828] transition-colors cursor-pointer"
                  onClick={() => {
                    if (item.type === 'unsigned_note') router.push('/doctor/chart-management')
                    else if (item.type === 'pending_lab') router.push('/doctor/labs')
                    else if (item.type === 'pending_ref') router.push('/doctor/referrals')
                    else if (item.type === 'pending_auth') router.push('/doctor/prior-auth')
                    else if (item.type === 'pending_apt') router.push('/doctor/appointments')
                  }}>
                  <InboxIcon type={item.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] text-gray-500">{item.sub}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ REVENUE SNAPSHOT ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniCard label="Collected" value={`$${revenue.collected.toLocaleString()}`} color="text-green-400" />
          <MiniCard label="Outstanding" value={`$${revenue.outstanding.toLocaleString()}`} color="text-amber-400" />
          <MiniCard label="Pending Labs" value={`${revenue.pendingLabs}`} color="text-cyan-400" />
          <MiniCard label="Pending Auths" value={`${revenue.pendingAuths}`} color="text-purple-400" />
        </div>

        {/* ═══ DATA HEALTH TRACKER ═══ */}
        <DataHealthTracker />

        {/* ═══ QUICK ACTION CARDS — big colorful like old dashboard ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <QuickCard icon={Calendar} label="View All Appointments" sub="Manage slots, reschedule, and join visits." href="/doctor/appointments" iconBg="bg-blue-600/20" iconColor="text-blue-400" btnColor="bg-blue-600 hover:bg-blue-700" />
          <QuickCard icon={Users} label="Manage Patients" sub="Charts, messages, and prescriptions." href="/doctor/patients" iconBg="bg-emerald-600/20" iconColor="text-emerald-400" btnColor="bg-emerald-600 hover:bg-emerald-700" />
          <QuickCard icon={BarChart3} label="Review Documents" sub="Lab results, uploads, and forms." href="/doctor/labs" iconBg="bg-amber-600/20" iconColor="text-amber-400" btnColor="bg-amber-500 hover:bg-amber-600" />
          <QuickCard icon={Shield} label="Staff Management" sub="Add assistants, manage permissions, view activity logs." href="/doctor/staff-hub" iconBg="bg-purple-600/20" iconColor="text-purple-400" btnColor="bg-purple-600 hover:bg-purple-700" />
          <QuickCard icon={ClipboardList} label="Chart Management" sub="Sign notes, close charts, manage addendums, audit trail." href="/doctor/chart-management" iconBg="bg-rose-600/20" iconColor="text-rose-400" btnColor="bg-rose-600 hover:bg-rose-700" />
        </div>
      </div>
    </div>
  )
}

// ═══ COMPONENTS ═══

function ActionBtn({ label, color, href }: { label: string; color: string; href: string }) {
  return <Link href={href} className={`px-5 py-2.5 ${color} text-white text-sm font-bold rounded-lg transition-colors`}>{label}</Link>
}

function KPICard({ icon: I, label, value, iconBg, iconColor, onClick }: { icon: typeof Users; label: string; value: string; iconBg: string; iconColor: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-[#1a3d3d]' : ''} transition-colors`}>
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}><I className={`w-5 h-5 ${iconColor}`} /></div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  )
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-4 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function QuickCard({ icon: I, label, sub, href, iconBg, iconColor, btnColor }: { icon: typeof Users; label: string; sub: string; href: string; iconBg: string; iconColor: string; btnColor: string }) {
  return (
    <Link href={href} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-5 hover:border-[#1a3d3d] transition-colors flex flex-col">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}><I className={`w-5 h-5 ${iconColor}`} /></div>
      <div className="text-sm font-bold mb-1">{label}</div>
      <div className="text-[11px] text-gray-500 mb-4 flex-1">{sub}</div>
      <div className={`${btnColor} text-white text-xs font-bold px-4 py-2 rounded-lg text-center transition-colors`}>
        {label.includes('Appointment') ? 'Manage' : label.includes('Patient') ? 'Open' : label.includes('Document') ? 'Review' : label.includes('Staff') ? 'Manage' : 'Open'} <span className="ml-1">›</span>
      </div>
    </Link>
  )
}

function NotifIcon({ type }: { type: string }) {
  const m: Record<string, { icon: typeof Bell; color: string }> = { appointment_request: { icon: Calendar, color: 'text-amber-400' }, appointment_reminder: { icon: Clock, color: 'text-blue-400' }, lab_results: { icon: FlaskConical, color: 'text-cyan-400' }, messages: { icon: MessageSquare, color: 'text-purple-400' } }
  const { icon: I, color } = m[type] || { icon: Bell, color: 'text-gray-400' }
  return <I className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
}

function InboxIcon({ type }: { type: string }) {
  const m: Record<string, { icon: typeof FileText; color: string }> = { unsigned_note: { icon: FileText, color: 'text-red-400' }, pending_lab: { icon: FlaskConical, color: 'text-cyan-400' }, pending_ref: { icon: Building2, color: 'text-blue-400' }, pending_auth: { icon: Shield, color: 'text-purple-400' }, pending_apt: { icon: Calendar, color: 'text-amber-400' } }
  const { icon: I, color } = m[type] || { icon: Bell, color: 'text-gray-400' }
  return <div className={`w-8 h-8 rounded-lg ${color.replace('text-', 'bg-').replace('-400', '-600/20')} flex items-center justify-center`}><I className={`w-4 h-4 ${color}`} /></div>
}

function fmtAgo(d: string) { const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }

// ═══ DATA HEALTH TRACKER ═══
function DataHealthTracker() {
  const [exportInfo, setExportInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastCheck, setLastCheck] = useState<string | null>(null)

  useEffect(() => { checkExportStatus() }, [])

  const checkExportStatus = async () => {
    try {
      const { data } = await supabase
        .from('patient_data_exports')
        .select('summary, generated_at, patient_count, medication_count')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single()
      if (data) { setExportInfo(data); setLastCheck(new Date().toISOString()) }
    } catch {}
  }

  const runExport = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/export-patient-data')
      const data = await res.json()
      if (data.patients) {
        // Save to Supabase
        await supabase.from('patient_data_exports').upsert({
          id: '00000000-0000-0000-0000-000000000001',
          export_type: 'full_patient_data',
          generated_at: new Date().toISOString(),
          summary: data.export_info ? { total_patients: data.patients.length, total_medications: data.patients.reduce((s: number, p: any) => s + (p.medications?.length || 0), 0), total_allergies: data.patients.reduce((s: number, p: any) => s + (p.allergies?.length || 0), 0), total_problems: data.patients.reduce((s: number, p: any) => s + (p.problems?.length || 0), 0), total_appointments: data.patients.reduce((s: number, p: any) => s + (p.appointments?.length || 0), 0) } : data.summary,
          patient_count: data.patients?.length || data.summary?.total_patients || 0,
          medication_count: data.patients?.reduce((s: number, p: any) => s + (p.medications?.length || 0), 0) || data.summary?.total_medications || 0,
          data: data.patients,
        })
        await checkExportStatus()
      }
    } catch (e) { console.error('Export failed:', e) }
    setSyncing(false)
  }

  const downloadJson = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/export-patient-data')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `medazon-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { console.error('Download failed:', e) }
    setLoading(false)
  }

  const s = exportInfo?.summary || {}
  const genAt = exportInfo?.generated_at
  const isStale = genAt ? (Date.now() - new Date(genAt).getTime()) > 24 * 60 * 60 * 1000 : true
  const isHealthy = !isStale && (s.total_patients || 0) > 0

  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3d3d]/30">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold">Data Health Tracker</h2>
          {isHealthy ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded-full font-bold"><Wifi className="w-3 h-3" /> Healthy</span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full font-bold"><WifiOff className="w-3 h-3" /> {isStale ? 'Stale' : 'No Data'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runExport} disabled={syncing} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={downloadJson} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            <Download className="w-3.5 h-3.5" />
            {loading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-5 gap-3 mb-3">
          <HealthStat label="Patients" value={s.total_patients || exportInfo?.patient_count || 0} color="text-white" />
          <HealthStat label="Medications" value={s.total_medications || exportInfo?.medication_count || 0} color="text-teal-400" />
          <HealthStat label="Allergies" value={s.total_allergies || 0} color="text-amber-400" />
          <HealthStat label="Problems" value={s.total_problems || 0} color="text-purple-400" />
          <HealthStat label="Appointments" value={s.total_appointments || 0} color="text-blue-400" />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Last backup: {genAt ? new Date(genAt).toLocaleString() : 'Never'}</span>
          <span>{isStale ? '⚠️ Backup is over 24h old — click Sync Now' : '✅ Backup is current'}</span>
        </div>
      </div>
    </div>
  )
}

function HealthStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#061818] rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
