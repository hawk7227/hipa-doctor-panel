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
  UserPlus, Stethoscope, MessageSquare, Shield, Video, Star, ArrowRight
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
      // 1. Use the existing dashboard/stats API (pulls DrChrono + local)
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.ok) {
          const d = await res.json()
          setStats({
            totalPatients: d.totalPatients || 0,
            activePatients: d.activePatients || 0,
            newThisMonth: d.newThisMonth || 0,
            appointmentsToday: d.appointmentsToday || 0,
            avgAppointments: d.avgAppointments || 0,
          })
          if (d.upcomingAppointments) {
            setUpcomingApts(d.upcomingAppointments.map((a: any) => ({
              id: a.id, requested_date_time: a.requested_date_time,
              status: a.status, visit_type: a.visit_type, patient_name: a.patient_name,
            })))
          }
          if (d.notifications) setNotifications(d.notifications)
        }
      } catch (e) { console.error('Stats API:', e) }

      // 2. Clinical inbox — unsigned notes, pending labs, referrals, prior auths, pending apts
      try {
        const [notesR, labsR, refsR, authsR, pendAptsR] = await Promise.all([
          supabase.from('clinical_notes').select('id, note_type, created_at').eq('doctor_id', docId).in('status', ['draft', 'in_progress']).order('created_at', { ascending: false }).limit(10),
          supabase.from('lab_orders').select('id, lab_name, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
          supabase.from('referrals').select('id, referred_to_name, created_at').eq('doctor_id', docId).in('status', ['draft', 'pending']).order('created_at', { ascending: false }).limit(10),
          supabase.from('prior_authorizations').select('id, service_description, created_at').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
          supabase.from('appointments').select('id, requested_date_time, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)').eq('doctor_id', docId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        ])

        const items: any[] = []
        ;(notesR.data || []).forEach((n: any) => items.push({ type: 'unsigned_note', id: n.id, label: `Unsigned ${n.note_type || 'note'}`, sub: fmtAgo(n.created_at), time: n.created_at }))
        ;(labsR.data || []).forEach((l: any) => items.push({ type: 'pending_lab', id: l.id, label: `Lab: ${l.lab_name || 'Pending'}`, sub: fmtAgo(l.created_at), time: l.created_at }))
        ;(refsR.data || []).forEach((r: any) => items.push({ type: 'pending_ref', id: r.id, label: `Referral: ${r.referred_to_name || 'Pending'}`, sub: fmtAgo(r.created_at), time: r.created_at }))
        ;(authsR.data || []).forEach((a: any) => items.push({ type: 'pending_auth', id: a.id, label: `Prior Auth: ${a.service_description || 'Pending'}`, sub: fmtAgo(a.created_at), time: a.created_at }))
        ;(pendAptsR.data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients }))
          .forEach((a: any) => items.push({ type: 'pending_apt', id: a.id, label: `New request: ${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || 'Patient', sub: a.visit_type || 'video', time: a.requested_date_time || '' }))
        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setInbox(items.slice(0, 15))

        // Revenue
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const [paysR, claimsR] = await Promise.all([
          supabase.from('billing_payments').select('amount, voided').eq('doctor_id', docId).gte('created_at', monthStart),
          supabase.from('billing_claims').select('total_charge, total_paid').eq('doctor_id', docId).gte('created_at', monthStart),
        ])
        const collected = (paysR.data || []).filter((p: any) => !p.voided).reduce((s: number, p: any) => s + (p.amount || 0), 0)
        const charges = (claimsR.data || []).reduce((s: number, c: any) => s + (c.total_charge || 0), 0)
        setRevenue({ collected, outstanding: charges - collected, pendingLabs: (labsR.data || []).length, pendingAuths: (authsR.data || []).length })
      } catch (e) { console.error('Inbox:', e) }
    } catch (err) { console.error('Dashboard:', err) }
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
            <p className="text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • {doctor?.specialty || 'Family Medicine'}</p>
          </div>
          <button onClick={() => doctorId && fetchAll(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        <PatientSearchTrigger placeholder="Search patients — name, DOB, email, phone..." />
      </div>

      <div className="p-4 space-y-4">
        {/* KPI ROW — matches old dashboard style */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard icon={Users} label="Total Patients" value={stats.totalPatients.toLocaleString()} color="text-cyan-400" onClick={() => router.push('/doctor/patients')} />
          <KPICard icon={Activity} label="Active Patients" value={`${stats.activePatients}`} color="text-green-400" />
          <KPICard icon={UserPlus} label="New This Month" value={`${stats.newThisMonth}`} color="text-emerald-400" />
          <KPICard icon={Calendar} label="Appointments Today" value={`${stats.appointmentsToday}`} color="text-blue-400" onClick={() => router.push('/doctor/appointments')} />
          <KPICard icon={TrendingUp} label="Avg. Appointments" value={`${stats.avgAppointments}`} color="text-purple-400" />
          <KPICard icon={Bell} label="Inbox" value={`${inbox.length + notifications.length}`} color={inbox.length > 0 ? 'text-amber-400' : 'text-gray-500'} />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-4">
            {/* Upcoming Appointments */}
            <Section title="Upcoming Appointments" count={upcomingApts.length} action={{ label: 'View All', href: '/doctor/appointments' }}>
              {upcomingApts.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">No upcoming appointments</div>
              ) : (
                <div className="space-y-1.5">
                  {upcomingApts.map(a => (
                    <Link key={a.id} href="/doctor/appointments" className="flex items-center gap-3 p-2.5 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors group">
                      <div className="text-[11px] text-gray-500 w-28 shrink-0">
                        {a.requested_date_time ? new Date(a.requested_date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + new Date(a.requested_date_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{a.patient_name || 'Patient'}</div>
                        <div className="text-[10px] text-gray-500">{a.visit_type || 'Visit'}</div>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {/* Recent Notifications */}
            <Section title="Recent Notifications" count={notifications.length}>
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">No recent notifications</div>
              ) : (
                <div className="space-y-1.5">
                  {notifications.slice(0, 8).map(n => (
                    <div key={n.id} className="flex items-start gap-2.5 p-2.5 bg-[#061818] rounded-lg">
                      <NotifIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium">{n.title}</div>
                        <div className="text-[10px] text-gray-500">{n.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Revenue Snapshot */}
            <Section title="Revenue Snapshot (This Month)">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniStat label="Collected" value={`$${revenue.collected.toLocaleString()}`} color="text-green-400" />
                <MiniStat label="Outstanding" value={`$${revenue.outstanding.toLocaleString()}`} color="text-amber-400" />
                <MiniStat label="Pending Labs" value={`${revenue.pendingLabs}`} color={revenue.pendingLabs > 0 ? 'text-cyan-400' : 'text-gray-500'} />
                <MiniStat label="Pending Auths" value={`${revenue.pendingAuths}`} color={revenue.pendingAuths > 0 ? 'text-purple-400' : 'text-gray-500'} />
              </div>
            </Section>
          </div>

          {/* RIGHT COLUMN — Clinical Inbox + Quick Actions */}
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
                      <InboxIcon type={item.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium truncate">{item.label}</div>
                        <div className="text-[10px] text-gray-500">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Quick Actions — matches old dashboard style */}
            <Section title="Quick Actions">
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { label: 'View All Appointments', sub: 'Manage slots, reschedule, and join visits', icon: Calendar, href: '/doctor/appointments', color: 'text-blue-400', bg: 'bg-blue-600/10' },
                  { label: 'Manage Patients', sub: 'Charts, messages, and prescriptions', icon: Users, href: '/doctor/patients', color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
                  { label: 'New Patient', sub: 'Register a new patient', icon: UserPlus, href: '/doctor/new-patient', color: 'text-cyan-400', bg: 'bg-cyan-600/10' },
                  { label: 'Staff Management', sub: 'Add assistants, manage permissions', icon: Shield, href: '/doctor/staff-hub', color: 'text-purple-400', bg: 'bg-purple-600/10' },
                  { label: 'Chart Management', sub: 'Sign notes, close charts, audit trail', icon: ClipboardList, href: '/doctor/chart-management', color: 'text-amber-400', bg: 'bg-amber-600/10' },
                ].map(qa => (
                  <Link key={qa.label} href={qa.href} className="flex items-center gap-3 p-2.5 bg-[#061818] rounded-lg hover:bg-[#0a2222] transition-colors group">
                    <div className={`p-2 rounded-lg ${qa.bg}`}><qa.icon className={`w-4 h-4 ${qa.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{qa.label}</div>
                      <div className="text-[10px] text-gray-500">{qa.sub}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400" />
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

// ═══ COMPONENTS ═══
function KPICard({ icon: I, label, value, color, onClick }: { icon: typeof Users; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-4 ${onClick ? 'cursor-pointer hover:border-[#1a3d3d]' : ''} transition-colors`}>
      <I className={`w-5 h-5 ${color} mb-2`} />
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function Section({ title, count, action, children }: { title: string; count?: number; action?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3d3d]/30">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          {typeof count === 'number' && count > 0 && <span className="px-1.5 py-0.5 bg-emerald-600/20 text-emerald-400 text-[10px] rounded-full font-medium">{count}</span>}
        </div>
        {action && <Link href={action.href} className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5">{action.label}<ChevronRight className="w-3 h-3" /></Link>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-[#061818] rounded-lg p-3 text-center"><div className={`text-lg font-bold ${color}`}>{value}</div><div className="text-[10px] text-gray-500">{label}</div></div>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { accepted: 'bg-green-600/20 text-green-400', pending: 'bg-amber-600/20 text-amber-400', completed: 'bg-blue-600/20 text-blue-400', Confirmed: 'bg-green-600/20 text-green-400', cancelled: 'bg-red-600/20 text-red-400' }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[status] || 'bg-gray-600/20 text-gray-400'}`}>{status}</span>
}

function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: typeof Bell; color: string }> = {
    appointment_request: { icon: Calendar, color: 'text-amber-400' },
    appointment_reminder: { icon: Clock, color: 'text-blue-400' },
    lab_results: { icon: FlaskConical, color: 'text-cyan-400' },
    messages: { icon: MessageSquare, color: 'text-purple-400' },
  }
  const { icon: I, color } = icons[type] || { icon: Bell, color: 'text-gray-400' }
  return <I className={`w-3.5 h-3.5 ${color} shrink-0 mt-0.5`} />
}

function InboxIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: typeof FileText; color: string }> = {
    unsigned_note: { icon: FileText, color: 'text-red-400' },
    pending_lab: { icon: FlaskConical, color: 'text-cyan-400' },
    pending_ref: { icon: Building2, color: 'text-blue-400' },
    pending_auth: { icon: Shield, color: 'text-purple-400' },
    pending_apt: { icon: Calendar, color: 'text-amber-400' },
  }
  const { icon: I, color } = icons[type] || { icon: Bell, color: 'text-gray-400' }
  return <I className={`w-3.5 h-3.5 ${color} shrink-0 mt-0.5`} />
}

function fmtAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
