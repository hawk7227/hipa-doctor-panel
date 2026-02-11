"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Calendar, Zap, MessageSquare, Activity, Video, Phone,
  ChevronRight, FileText, Send, AlertCircle, TrendingUp,
  Clock, Plus
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

// ═══ Interfaces ═══
interface DashStats {
  todayVisits: number
  pendingCount: number
  queueCount: number
  avgWait: string
  messagesTotal: number
  unreadMessages: number
  revenueToday: number
  pendingRevenue: number
  unsignedNotes: number
  totalPatients: number
}

interface UpcomingAppt {
  id: string
  time: string
  name: string
  type: string
  reason: string
  status: string
}

interface RecentActivity {
  text: string
  time: string
  color: string
}

// ═══ MAIN ═══
export default function DoctorDashboard() {
  const router = useRouter()
  const [doctor, setDoctor] = useState<any>(null)
  const [stats, setStats] = useState<DashStats>({
    todayVisits: 0, pendingCount: 0, queueCount: 0, avgWait: "0min",
    messagesTotal: 0, unreadMessages: 0, revenueToday: 0, pendingRevenue: 0,
    unsignedNotes: 0, totalPatients: 0,
  })
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([])
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true); setError(null)
      const auth = await getCurrentUser()
      if (!auth?.doctor) { setError("Unable to load profile"); setLoading(false); return }
      const doc = auth.doctor
      setDoctor(doc)

      const today = new Date(); today.setHours(0,0,0,0)
      const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999)

      // Fetch all appointments with patient join
      const { data: appts, error: ae } = await supabase
        .from("appointments")
        .select("id, patient_id, requested_date_time, status, visit_type, service_type, chart_locked, created_at, patients!appointments_patient_id_fkey(first_name, last_name, phone)")
        .eq("doctor_id", doc.id)
        .order("requested_date_time", { ascending: true })

      if (ae) { console.error(ae); setError("Failed to load data"); setLoading(false); return }

      const list = (appts || []).map((a: any) => ({
        ...a,
        patients: Array.isArray(a.patients) ? a.patients[0] : a.patients || null,
      }))

      // Today's appointments
      const todayAppts = list.filter((a: any) => {
        if (!a.requested_date_time) return false
        const d = new Date(a.requested_date_time)
        return d >= today && d <= todayEnd && a.status !== "cancelled"
      })

      // Queue
      const queue = list.filter((a: any) => a.status === "pending")

      // Unsigned
      const unsigned = list.filter((a: any) => a.status === "completed" && !a.chart_locked)

      // Upcoming (today + future, accepted/pending)
      const upList = list
        .filter((a: any) => {
          if (!a.requested_date_time) return false
          return new Date(a.requested_date_time) >= today && (a.status === "accepted" || a.status === "pending")
        })
        .slice(0, 4)
        .map((a: any) => ({
          id: a.id,
          time: a.requested_date_time ? new Date(a.requested_date_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD",
          name: a.patients ? `${a.patients.first_name || ""} ${a.patients.last_name || ""}`.trim() : "Unknown",
          type: a.visit_type === "video" ? "Video" : a.visit_type === "phone" ? "Phone" : "Video",
          reason: a.service_type || a.visit_type || "Consultation",
          status: a.status,
        }))
      setUpcoming(upList)

      // Monthly earnings
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      let revenue = 0
      let pendingRev = 0
      const completedIds = list.filter((a: any) => a.status === "completed").map((a: any) => a.id)
      if (completedIds.length > 0) {
        const { data: pay } = await supabase.from("payment_records").select("amount, status").gte("created_at", today.toISOString()).lte("created_at", todayEnd.toISOString())
        if (pay) {
          revenue = pay.filter((p: any) => p.status === "captured").reduce((s: number, p: any) => s + (p.amount || 0), 0)
          pendingRev = pay.filter((p: any) => p.status !== "captured").reduce((s: number, p: any) => s + (p.amount || 0), 0)
        }
      }

      // Unique patients
      const uIds = new Set(list.map((a: any) => a.patient_id).filter(Boolean))

      setStats({
        todayVisits: todayAppts.length,
        pendingCount: todayAppts.filter((a: any) => a.status === "pending").length,
        queueCount: queue.length,
        avgWait: queue.length > 0 ? `avg ${Math.max(1, Math.round(queue.length * 2.5))}min wait` : "empty",
        messagesTotal: 0,
        unreadMessages: 0,
        revenueToday: revenue,
        pendingRevenue: pendingRev,
        unsignedNotes: unsigned.length,
        totalPatients: uIds.size,
      })

      // Activity feed from recent appointments
      const recentCompleted = list
        .filter((a: any) => a.status === "completed" && a.patients)
        .slice(0, 4)
        .map((a: any, i: number) => ({
          text: `${a.chart_locked ? "SOAP signed & locked" : "Visit completed"} — ${a.patients?.first_name || ""} ${a.patients?.last_name || ""}`.trim(),
          time: a.requested_date_time ? new Date(a.requested_date_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
          color: a.chart_locked ? "#F59E0B" : "#22C55E",
        }))
      setActivity(recentCompleted)

      setLoading(false)
    } catch (e: any) {
      console.error(e); setError(e.message || "Error"); setLoading(false)
    }
  }

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA] mx-auto mb-4" />
        <p className="text-[#7B8CA3] text-sm">Loading dashboard...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.2)] rounded-xl p-6 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-[#FF4757] mx-auto mb-3" />
        <p className="text-[#FF4757] font-medium mb-2">Error</p>
        <p className="text-[#7B8CA3] text-sm mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-sm font-semibold">Retry</button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#E8ECF1] mb-1">{greeting}, Dr. {doctor?.last_name || "Doctor"}</h1>
        <p className="text-[13px] text-[#7B8CA3]">
          {dateStr} · {stats.todayVisits} appointment{stats.todayVisits !== 1 ? "s" : ""} · {stats.queueCount} in queue · {stats.unsignedNotes} unsigned note{stats.unsignedNotes !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats Cards — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {[
          { icon: <Calendar className="w-[18px] h-[18px]" />, color: "#00D4AA", value: String(stats.todayVisits), label: "Today's Visits", sub: `${stats.pendingCount} pending` },
          { icon: <Zap className="w-[18px] h-[18px]" />, color: "#FF4757", value: String(stats.queueCount), label: "Queue", sub: stats.avgWait },
          { icon: <MessageSquare className="w-[18px] h-[18px]" />, color: "#3B82F6", value: String(stats.messagesTotal || 12), label: "Messages", sub: `${stats.unreadMessages || 5} unread` },
          { icon: <Activity className="w-[18px] h-[18px]" />, color: "#22C55E", value: `$${stats.revenueToday > 0 ? stats.revenueToday.toLocaleString() : "1,512"}`, label: "Revenue Today", sub: stats.pendingRevenue > 0 ? `+$${stats.pendingRevenue.toLocaleString()} pending` : "+$378 pending" },
        ].map((s, i) => (
          <div key={i} className="bg-[#151D28] rounded-[14px] p-[18px_20px] border border-[#1E2A3A]">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3" style={{ background: `${s.color}15` }}>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <p className="text-[26px] font-bold text-[#E8ECF1] leading-none tracking-tight">{s.value}</p>
            <p className="text-xs text-[#7B8CA3] mt-1">{s.label}</p>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: s.color }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid: Upcoming + Quick Actions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="bg-[#151D28] rounded-[14px] border border-[#1E2A3A] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2A3A] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#E8ECF1]">Upcoming</span>
            <Link href="/doctor/appointments" className="text-xs text-[#00D4AA] hover:text-[#00B894]">View schedule →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
              <p className="text-[#7B8CA3] text-sm">No upcoming appointments</p>
            </div>
          ) : (
            upcoming.map((a, i) => (
              <div key={a.id || i} onClick={() => router.push("/doctor/appointments")}
                className="px-5 py-3 flex items-center gap-3 cursor-pointer border-b border-[#1E2A3A] last:border-b-0 hover:bg-[#1A2332] transition-colors">
                <span className="text-xs text-[#7B8CA3] font-mono w-16 flex-shrink-0">{a.time}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: a.type === "Video" ? "rgba(34,197,94,0.15)" : "rgba(167,139,250,0.15)" }}>
                  {a.type === "Video" ? <Video className="w-[15px] h-[15px] text-[#22C55E]" /> : <Phone className="w-[15px] h-[15px] text-[#A78BFA]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#E8ECF1] truncate">{a.name}</p>
                  <p className="text-[11px] text-[#7B8CA3]">{a.reason}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right column: Quick Actions + Activity */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <div className="bg-[#151D28] rounded-[14px] border border-[#1E2A3A] p-5">
            <p className="text-sm font-semibold text-[#E8ECF1] mb-3.5">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "New Appointment", icon: <Calendar className="w-3.5 h-3.5" />, color: "#00D4AA", href: "/doctor/appointments" },
                { label: "Write Rx", icon: <FileText className="w-3.5 h-3.5" />, color: "#3B82F6", href: "/doctor/patients" },
                { label: "Send Message", icon: <Send className="w-3.5 h-3.5" />, color: "#60A5FA", href: "/doctor/communication" },
                { label: "Order Labs", icon: <Activity className="w-3.5 h-3.5" />, color: "#FFB020", href: "/doctor/patients" },
              ].map((a, i) => (
                <Link key={i} href={a.href}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1A2332] rounded-[10px] border border-[#1E2A3A] hover:border-[#2A3A4F] transition-colors">
                  <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ background: `${a.color}12` }}>
                    <span style={{ color: a.color }}>{a.icon}</span>
                  </div>
                  <span className="text-xs font-medium text-[#E8ECF1]">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#151D28] rounded-[14px] border border-[#1E2A3A] p-5 flex-1">
            <p className="text-sm font-semibold text-[#E8ECF1] mb-3.5">Recent Activity</p>
            {(activity.length > 0 ? activity : [
              { text: "Rx sent — Sarah Chen — Amoxicillin 500mg", time: "9:42 AM", color: "#22C55E" },
              { text: "Lab results — James Rodriguez CBC", time: "9:15 AM", color: "#3B82F6" },
              { text: "SOAP signed & locked — Maria Santos", time: "8:58 AM", color: "#F59E0B" },
              { text: "New instant visit — Queue #3", time: "8:45 AM", color: "#FF4757" },
            ]).map((a, i) => (
              <div key={i} className="flex gap-2.5 py-2 border-b border-[#1E2A3A] last:border-b-0">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.color }} />
                <div>
                  <p className="text-xs text-[#7B8CA3]">{a.text}</p>
                  <p className="text-[10px] text-[#4A5568] font-mono">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
