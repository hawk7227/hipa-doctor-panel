'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import PatientSearchTrigger from '@/components/PatientSearchTrigger'
import {
  LayoutDashboard, Calendar, Users, Clock, DollarSign, FileText,
  CheckCircle, XCircle, AlertTriangle, Bell, ChevronRight, RefreshCw,
  Pill, FlaskConical, Building2, ClipboardList, TrendingUp, Activity,
  UserPlus, Stethoscope, MessageSquare, Shield, Star, ArrowRight
} from 'lucide-react'

interface DoctorInfo { id: string; first_name: string; last_name: string; specialty: string | null; experience_years: number | null }
interface Apt { id: string; requested_date_time: string | null; scheduled_time: string | null; status: string; visit_type: string | null; patients?: { first_name: string; last_name: string } | null }
interface Task { id: string; title: string; priority: string; status: string; category: string; due_date: string | null; patient_id: string | null }
interface InboxItem { type: 'unsigned_note' | 'pending_lab' | 'pending_ref' | 'pending_auth' | 'pending_apt'; id: string; label: string; sub: string; time: string; priority: string }

export default function DoctorDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctor, setDoctor] = useState<DoctorInfo | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [todayApts, setTodayApts] = useState<Apt[]>([])
  const [upcomingApts, setUpcomingApts] = useState<Apt[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [kpis, setKpis] = useState({ patients: 0, newThisMonth: 0, aptsToday: 0, aptsWeek: 0, revenue: 0, outstanding: 0, unsignedNotes: 0, pendingLabs: 0, pendingRefs: 0, pendingAuths: 0, pendingApts: 0 })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const init = async () => {
      try {
        const au = await getCurrentUser()
        if (!au?.doctor?.id) { router.push('/login'); return }
        setDoctor(au.doctor as DoctorInfo)
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
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
      const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [ptsR, aptsR, notesR, labsR, refsR, authsR, claimsR, paysR, tasksR, pendAptsR] = await Promise.all([
        supabase.from('patients').select('id, created_at', { count: 'exact' }).eq('doctor_id', docId),
        supabase.from('appointments').select('id, requested_date_time, scheduled_time, status, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)').eq('doctor_id', docId).gte('requested_date_time', todayStart).lte('requested_date_time', weekEnd).order('requested_date_time'),
        supabase.from('clinical_notes').select('id, patient_id, status, note_type, created_at').eq('doctor_id', docId).in('status', ['draft', 'in_progress']).order('created_at', { ascending: false }).limit(20),
        supabase.from('lab_orders').select('id, patient_id, status, lab_name, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
        supabase.from('referrals').select('id, patient_id, status, referred_to_name, created_at').eq('doctor_id', docId).in('status', ['draft', 'pending']).order('created_at', { ascending: false }).limit(10),
        supabase.from('prior_authorizations').select('id, patient_id, status, service_description, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        supabase.from('billing_claims').select('id, total_charge, total_paid, status').eq('doctor_id', docId).gte('created_at', monthStart),
        supabase.from('billing_payments').select('id, amount, voided').eq('doctor_id', docId).gte('created_at', monthStart),
        supabase.from('staff_tasks').select('id, title, priority, status, category, due_date, patient_id').eq('doctor_id', docId).in('status', ['pending', 'in_progress']).order('priority').order('due_date').limit(10),
        supabase.from('appointments').select('id, requested_date_time, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
      ])

      const pts = ptsR.data || []
      const apts = (aptsR.data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients })) as Apt[]
      const notes = notesR.data || []
      const labs = labsR.data || []
      const refs = refsR.data || []
      const auths = authsR.data || []
      const claims = claimsR.data || []
      const pays = (paysR.data || []).filter((p: any) => !p.voided)
      const tks = (tasksR.data || []) as Task[]
      const pendApts = (pendAptsR.data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients }))

      // Today's appointments
      const today = apts.filter(a => {
        const t = a.requested_date_time || a.scheduled_time
        if (!t) return false
        const d = new Date(t)
        return d >= new Date(todayStart) && d <= new Date(todayEnd)
      })
      setTodayApts(today)
      setUpcomingApts(apts.filter(a => !today.includes(a)).slice(0, 8))
      setTasks(tks)

      // Revenue
      const revenue = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0)
      const charges = claims.reduce((s: number, c: any) => s + (c.total_charge || 0), 0)
      const newPts = pts.filter((p: any) => new Date(p.created_at) >= new Date(monthStart)).length

      setKpis({
        patients: ptsR.count || pts.length, newThisMonth: newPts,
        aptsToday: today.length, aptsWeek: apts.length,
        revenue, outstanding: charges - revenue,
        unsignedNotes: notes.length, pendingLabs: labs.length,
        pendingRefs: refs.length, pendingAuths: auths.length,
        pendingApts: pendApts.length,
      })

      // Build clinical inbox
      const items: InboxItem[] = []
      notes.forEach((n: any) => items.push({ type: 'unsigned_note', id: n.id, label: `Unsigned ${n.note_type || 'note'}`, sub: `Created ${fmtAgo(n.created_at)}`, time: n.created_at, priority: 'high' }))
      labs.forEach((l: any) => items.push({ type: 'pending_lab', id: l.id, label: `Lab: ${l.lab_name || 'Pending order'}`, sub: `Ordered ${fmtAgo(l.created_at)}`, time: l.created_at, priority: 'medium' }))
      refs.forEach((r: any) => items.push({ type: 'pending_ref', id: r.id, label: `Referral: ${r.referred_to_name || 'Pending'}`, sub: fmtAgo(r.created_at), time: r.created_at, priority: 'medium' }))
      auths.forEach((a: any) => items.push({ type: 'pending_auth', id: a.id, label: `Prior Auth: ${a.service_description || 'Pending'}`, sub: fmtAgo(a.created_at), time: a.created_at, priority: 'high' }))
      pendApts.forEach((a: any) => items.push({ type: 'pending_apt', id: a.id, label: `New request: ${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || 'Patient', sub: a.visit_type || 'Appointment', time: a.requested_date_time || '', priority: 'medium' }))
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setInbox(items.slice(0, 15))
    } catch (err) { console.error('Dashboard fetch:', err) }
    finally { setLoading(false) }
  }, [])

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  const greeting = currentTime.getHours() < 12 ? 'Good morning' : currentTime.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* HEADER */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1a3d3d]/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold">{greeting}, Dr. {doctor?.last_name || 'Doctor'}</h1>
            <p className="text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • {doctor?.specialty || 'General Practice'}</p>
          </div>
          <button onClick={() => doctorId && fetchAll(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        <PatientSearchTrigger placeholder="Search patients — name, DOB, email, phone..." />
      </div>

      <div className="p-4 space-y-4">
        {/* KPI ROW */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KPI icon={Calendar} label="Today" value={`${kpis.aptsToday}`} color="text-cyan-400" onClick={() => router.push('/doctor/appointments')} />
          <KPI icon={Users} label="Patients" value={`${kpis.patients}`} color="text-blue-400" onClick={() => router.push('/doctor/patients')} />
          <KPI icon={UserPlus} label="New/Month" value={`${kpis.newThisMonth}`} color="text-emerald-400" />
          <KPI icon={DollarSign} label="Revenue" value={`$${(kpis.revenue / 1000).toFixed(1)}k`} color="text-green-400" onClick={() => router.push('/doctor/billing')} />
          <KPI icon={FileText} label="Unsigned" value={`${kpis.unsignedNotes}`} color={kpis.unsignedNotes > 0 ? 'text-red-400' : 'text-gray-500'} />
          <KPI icon={Bell} label="Inbox" value={`${inbox.length}`} color={inbox.length > 0 ? 'text-amber-400' : 'text-gray-500'} />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Today's Schedule */}
          <div className="lg:col-span-2 space-y-4">
            <Section title="Today's Schedule" count={todayApts.length} action={{ label: 'View All', href: '/doctor/appointments' }}>
              {todayApts.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">No appointments scheduled for today</div>
              ) : (
                <div className="space-y-1.5">
                  {todayApts.map(a => (
                    <Link key={a.id} href={`/doctor/appointments?apt=${a.id}`} className="flex items-center gap-3 p-2.5 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors group">
                      <div className="text-[11px] text-gray-500 w-14 shrink-0 font-mono">
                        {(a.requested_date_time || a.scheduled_time) ? new Date(a.requested_date_time || a.scheduled_time!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient'}</div>
                        <div className="text-[10px] text-gray-500">{a.visit_type || 'Visit'}</div>
                      </div>
                      <StatusDot status={a.status} />
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400" />
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {/* Upcoming This Week */}
            {upcomingApts.length > 0 && (
              <Section title="Upcoming This Week" count={upcomingApts.length}>
                <div className="space-y-1.5">
                  {upcomingApts.slice(0, 5).map(a => (
                    <Link key={a.id} href={`/doctor/appointments?apt=${a.id}`} className="flex items-center gap-3 p-2 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors">
                      <div className="text-[10px] text-gray-500 w-20 shrink-0">
                        {(a.requested_date_time || a.scheduled_time) ? new Date(a.requested_date_time || a.scheduled_time!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                      </div>
                      <div className="flex-1 min-w-0 text-xs truncate">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient'}</div>
                      <span className="text-[10px] text-gray-500">{a.visit_type || 'Visit'}</span>
                      <StatusDot status={a.status} />
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Revenue Snapshot */}
            <Section title="Revenue Snapshot (This Month)">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniStat label="Collected" value={`$${kpis.revenue.toLocaleString()}`} color="text-green-400" />
                <MiniStat label="Outstanding" value={`$${kpis.outstanding.toLocaleString()}`} color="text-amber-400" />
                <MiniStat label="Pending Labs" value={`${kpis.pendingLabs}`} color={kpis.pendingLabs > 0 ? 'text-cyan-400' : 'text-gray-500'} />
                <MiniStat label="Pending Auths" value={`${kpis.pendingAuths}`} color={kpis.pendingAuths > 0 ? 'text-purple-400' : 'text-gray-500'} />
              </div>
            </Section>
          </div>

          {/* RIGHT: Clinical Inbox + Tasks */}
          <div className="space-y-4">
            <Section title="Clinical Inbox" count={inbox.length}>
              {inbox.length === 0 ? (
                <div className="text-center py-6"><CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" /><p className="text-xs text-gray-500">All caught up!</p></div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {inbox.map((item, i) => (
                    <div key={`${item.type}-${item.id}-${i}`} className="flex items-start gap-2.5 p-2 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors cursor-pointer"
                      onClick={() => {
                        if (item.type === 'unsigned_note') router.push('/doctor/chart-management')
                        else if (item.type === 'pending_lab') router.push('/doctor/labs')
                        else if (item.type === 'pending_ref') router.push('/doctor/referrals')
                        else if (item.type === 'pending_auth') router.push('/doctor/prior-auth')
                        else if (item.type === 'pending_apt') router.push('/doctor/appointments')
                      }}>
                      <InboxIcon type={item.type} priority={item.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium truncate">{item.label}</div>
                        <div className="text-[10px] text-gray-500">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Task Queue */}
            <Section title="Task Queue" count={tasks.length} action={{ label: 'Staff Hub', href: '/doctor/staff-hub' }}>
              {tasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">No pending tasks</div>
              ) : (
                <div className="space-y-1">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 bg-[#061818] rounded-lg">
                      <PriorityDot priority={t.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] truncate">{t.title}</div>
                        <div className="text-[10px] text-gray-500">{t.category.replace(/_/g, ' ')}</div>
                      </div>
                      {t.due_date && <span className="text-[10px] text-gray-500">{new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Quick Actions */}
            <Section title="Quick Actions">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'New Patient', icon: UserPlus, href: '/doctor/new-patient', color: 'text-emerald-400' },
                  { label: 'Prescribe', icon: Pill, href: '/doctor/prescriptions', color: 'text-purple-400' },
                  { label: 'Order Lab', icon: FlaskConical, href: '/doctor/labs', color: 'text-cyan-400' },
                  { label: 'New Referral', icon: Building2, href: '/doctor/referrals', color: 'text-blue-400' },
                  { label: 'Reports', icon: TrendingUp, href: '/doctor/reports', color: 'text-green-400' },
                  { label: 'Billing', icon: DollarSign, href: '/doctor/billing', color: 'text-amber-400' },
                ].map(qa => (
                  <Link key={qa.label} href={qa.href} className="flex items-center gap-2 p-2.5 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors">
                    <qa.icon className={`w-3.5 h-3.5 ${qa.color}`} />
                    <span className="text-[11px] text-gray-300">{qa.label}</span>
                  </Link>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══ SHARED COMPONENTS ═══
function KPI({ icon: I, label, value, color, onClick }: { icon: typeof Calendar; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-2.5 text-center ${onClick ? 'cursor-pointer hover:border-[#1a3d3d]' : ''} transition-colors`}>
      <I className={`w-3.5 h-3.5 ${color} mx-auto mb-1`} />
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  )
}

function Section({ title, count, action, children }: { title: string; count?: number; action?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a3d3d]/30">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-300">{title}</h3>
          {typeof count === 'number' && count > 0 && <span className="px-1.5 py-0.5 bg-emerald-600/20 text-emerald-400 text-[10px] rounded-full font-medium">{count}</span>}
        </div>
        {action && <Link href={action.href} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5">{action.label}<ChevronRight className="w-3 h-3" /></Link>}
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-[#061818] rounded-lg p-2.5 text-center"><div className={`text-sm font-bold ${color}`}>{value}</div><div className="text-[10px] text-gray-500">{label}</div></div>
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = { accepted: 'bg-green-400', pending: 'bg-amber-400', completed: 'bg-blue-400', cancelled: 'bg-red-400', finished: 'bg-blue-400' }
  return <div className={`w-2 h-2 rounded-full ${c[status] || 'bg-gray-500'}`} title={status} />
}

function PriorityDot({ priority }: { priority: string }) {
  const c: Record<string, string> = { urgent: 'bg-red-400', high: 'bg-amber-400', normal: 'bg-blue-400', low: 'bg-gray-400' }
  return <div className={`w-1.5 h-1.5 rounded-full ${c[priority] || 'bg-gray-400'}`} />
}

function InboxIcon({ type, priority }: { type: string; priority: string }) {
  const icons: Record<string, { icon: typeof FileText; color: string }> = {
    unsigned_note: { icon: FileText, color: 'text-red-400' },
    pending_lab: { icon: FlaskConical, color: 'text-cyan-400' },
    pending_ref: { icon: Building2, color: 'text-blue-400' },
    pending_auth: { icon: Shield, color: 'text-purple-400' },
    pending_apt: { icon: Calendar, color: 'text-amber-400' },
  }
  const { icon: I, color } = icons[type] || icons.unsigned_note
  return <I className={`w-3.5 h-3.5 ${color} shrink-0 mt-0.5`} />
}

function fmtAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}
