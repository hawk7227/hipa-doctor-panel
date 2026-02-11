"use client"

import { ReactNode, useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import AuthWrapper from "@/components/AuthWrapper"
import { signOutAndRedirect, getCurrentUser } from "@/lib/auth"
import {
  LayoutDashboard, CalendarDays, Users, FolderOpen, DollarSign,
  Zap, Phone, Settings, Menu, X, Search, Bell, Mic
} from "lucide-react"
import { BugsyWidget } from "@/components/bugsy"
import LiveSessionAlert from "@/components/LiveSessionAlert"
import NotificationBell from "@/components/NotificationBell"

// ═══ Design tokens from JSX demo ═══
// C.bg=#0B0F14 C.surface=#111820 C.card=#151D28 C.border=#1E2A3A
// C.accent=#00D4AA C.accentDim=rgba(0,212,170,0.12)
// C.mary=#818CF8 C.maryDim=rgba(129,140,248,0.12)

const NAV_ITEMS = [
  { id: "dashboard", href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "schedule", href: "/doctor/schedule", label: "Schedule", icon: CalendarDays },
  { id: "patients", href: "/doctor/patients", label: "Patients", icon: Users },
  { id: "records", href: "/doctor/records", label: "Records", icon: FolderOpen },
  { id: "billing", href: "/doctor/billing", label: "Billing", icon: DollarSign },
]

interface DoctorLayoutProps { children: ReactNode }

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState("Doctor")
  const [doctorInitials, setDoctorInitials] = useState("DR")
  const [queueCount, setQueueCount] = useState(0)
  const [clock, setClock] = useState("")
  const [showComm, setShowComm] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [commTab, setCommTab] = useState("phone")
  const [maryActive, setMaryActive] = useState(true)
  const [showMary, setShowMary] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const [wavePhase, setWavePhase] = useState(0)

  const isActive = (href: string) => {
    if (href.includes("?")) return pathname === href.split("?")[0]
    return pathname === href || pathname?.startsWith(href + "/")
  }

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const f = async () => {
      try {
        const auth = await getCurrentUser()
        if (auth?.doctor) {
          setDoctorId(auth.doctor.id)
          const fn = auth.doctor.first_name || ""
          const ln = auth.doctor.last_name || ""
          setDoctorName(`Dr. ${fn} ${ln}`.trim())
          setDoctorInitials(`${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase() || "DR")
        }
      } catch (e) { console.log("Auth error:", e) }
    }
    f()
  }, [])

  // Queue polling
  useEffect(() => {
    const poll = async () => {
      if (!doctorId) return
      try {
        const { supabase } = await import("@/lib/supabase")
        const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true }).eq("doctor_id", doctorId).eq("status", "pending")
        setQueueCount(count || 0)
      } catch (e) { console.log("Queue poll error:", e) }
    }
    poll()
    const iv = setInterval(poll, 30000)
    return () => clearInterval(iv)
  }, [doctorId])

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Phoenix" }) + " MST")
    tick()
    const iv = setInterval(tick, 60000)
    return () => clearInterval(iv)
  }, [])

  // Wave animation for Mary
  useEffect(() => {
    const iv = setInterval(() => setWavePhase(p => p + 1), 150)
    return () => clearInterval(iv)
  }, [])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "unset"
    return () => { document.body.style.overflow = "unset" }
  }, [mobileOpen])

  // Listen for comm panel toggle from sidebar
  useEffect(() => {
    const handler = () => setShowComm(prev => !prev)
    window.addEventListener("toggle-comm-panel", handler)
    return () => window.removeEventListener("toggle-comm-panel", handler)
  }, [])

  const getTitle = () => {
    if (pathname?.includes("dashboard")) return "Dashboard"
    if (pathname?.includes("schedule") || pathname?.includes("appointments")) return "Schedule"
    if (pathname?.includes("patients")) return "Patients"
    if (pathname?.includes("records")) return "Medical Records"
    if (pathname?.includes("billing")) return "Billing"
    if (pathname?.includes("profile")) return "Settings"
    if (pathname?.includes("new-patient")) return "New Patient"
    if (pathname?.includes("bug-reports")) return "Bug Reports"
    if (pathname?.includes("availability")) return "Availability"
    if (pathname?.includes("communication")) return "Communication"
    return "Dashboard"
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-[#0B0F14] flex">

        {/* ═══ MOBILE HAMBURGER ═══ */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-3 left-3 z-[80] p-2 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#7B8CA3] hover:text-[#E8ECF1]" aria-label="Menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* ═══ MOBILE BACKDROP ═══ */}
        {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setMobileOpen(false)} />}

        {/* ═══════════════════════════════════════════════
            SIDEBAR — 72px, icons + tiny labels
        ═══════════════════════════════════════════════ */}
        <nav className={`fixed left-0 top-0 h-screen w-[72px] bg-[#111820] border-r border-[#1E2A3A] z-[70] flex flex-col items-center pt-5 pb-4 gap-1 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          {/* Logo */}
          <Link href="/doctor/dashboard" className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-[#00D4AA] to-[#00B894] flex items-center justify-center mb-5 hover:scale-105 transition-transform">
            <span className="text-[#0B0F14] font-bold text-lg">M</span>
          </Link>

          {/* Top nav items */}
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)}
                className={`w-[52px] h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-[3px] transition-all ${active ? "bg-[rgba(0,212,170,0.12)]" : "bg-transparent hover:bg-[#1E2A3A]/30"}`}>
                <Icon className="w-5 h-5" style={{ color: active ? "#00D4AA" : "#7B8CA3" }} />
                <span className="text-[9px] font-medium tracking-wide" style={{ color: active ? "#00D4AA" : "#4A5568" }}>{item.label}</span>
              </Link>
            )
          })}

          <div className="flex-1" />

          {/* Queue button */}
          <button onClick={() => { setShowQueue(!showQueue); if (showComm) setShowComm(false) }}
            className={`w-[52px] h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-[3px] relative transition-all ${showQueue ? "bg-[rgba(255,71,87,0.15)]" : "bg-transparent hover:bg-[#1E2A3A]/30"}`}>
            <Zap className="w-5 h-5" style={{ color: showQueue ? "#FF4757" : "#7B8CA3" }} />
            <span className="text-[9px] font-medium" style={{ color: showQueue ? "#FF4757" : "#4A5568" }}>Queue</span>
            {queueCount > 0 && (
              <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-[#FF4757] flex items-center justify-center animate-pulse">
                <span className="text-[10px] font-bold text-white">{queueCount > 9 ? "9+" : queueCount}</span>
              </div>
            )}
          </button>

          {/* Comms button */}
          <button onClick={() => { setShowComm(!showComm); if (showQueue) setShowQueue(false) }}
            className={`w-[52px] h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-[3px] transition-all ${showComm ? "bg-[rgba(0,212,170,0.12)]" : "bg-transparent hover:bg-[#1E2A3A]/30"}`}>
            <Phone className="w-5 h-5" style={{ color: showComm ? "#00D4AA" : "#7B8CA3" }} />
            <span className="text-[9px] font-medium" style={{ color: showComm ? "#00D4AA" : "#4A5568" }}>Comms</span>
          </button>

          {/* Settings */}
          <Link href="/doctor/profile" onClick={() => setMobileOpen(false)} className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[#1E2A3A]/30">
            <Settings className="w-[18px] h-[18px] text-[#4A5568]" />
          </Link>

          {/* Avatar */}
          <Link href="/doctor/profile" className="w-9 h-9 rounded-[10px] mt-1 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center hover:scale-105 transition-transform">
            <span className="text-[13px] font-semibold text-white">{doctorInitials}</span>
          </Link>
        </nav>

        {/* ═══════════════════════════════════════════════
            MAIN CONTENT
        ═══════════════════════════════════════════════ */}
        <div className="flex-1 lg:ml-[72px] flex flex-col min-h-screen">

          {/* ── TOP BAR (56px, matches demo) ── */}
          <header className="sticky top-0 z-[50] h-14 bg-[#111820] border-b border-[#1E2A3A] flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
            <span className="text-[15px] font-semibold text-[#E8ECF1] pl-10 lg:pl-0">{getTitle()}</span>
            <span className="text-xs text-[#4A5568] font-mono hidden sm:inline">{clock}</span>
            <div className="flex-1" />

            {/* Mary AI button */}
            <button onClick={() => setShowMary(!showMary)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all"
              style={{
                background: showMary ? "rgba(129,140,248,0.12)" : "transparent",
                borderColor: showMary ? "rgba(129,140,248,0.25)" : "#1E2A3A",
              }}>
              <div className="flex items-center gap-[2px] h-4">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-[2.5px] rounded-full transition-all" style={{
                    background: maryActive ? "#818CF8" : "#4A5568",
                    height: maryActive ? `${30 + Math.sin(wavePhase * 0.3 + i * 1.2) * 50}%` : "25%",
                    minHeight: 3, maxHeight: 14,
                  }} />
                ))}
              </div>
              <span className="text-xs font-semibold hidden sm:inline" style={{ color: maryActive ? "#818CF8" : "#4A5568" }}>Mary</span>
            </button>

            {/* Search */}
            <button onClick={() => setSearchOpen(!searchOpen)}
              className="flex items-center gap-2 px-3.5 py-[7px] bg-[#151D28] rounded-[10px] border border-[#1E2A3A] min-w-[180px] lg:min-w-[220px]">
              <Search className="w-[15px] h-[15px] text-[#4A5568]" />
              <span className="text-[13px] text-[#4A5568]">Search...</span>
              <span className="ml-auto text-[11px] text-[#4A5568] font-mono bg-[#1A2332] px-1.5 py-0.5 rounded hidden sm:inline">{"\u2318"}K</span>
            </button>

            {/* Notification */}
            {doctorId && (
              <div className="flex items-center">
                <NotificationBell userId={doctorId} userRole="provider" userName={doctorName} />
              </div>
            )}
          </header>

          {/* ── BODY: page content + side panels ── */}
          <div className="flex-1 flex overflow-hidden">
            {/* Page content */}
            <main className="flex-1 overflow-auto p-4 lg:p-6">
              {children}
            </main>

            {/* Communication Hub — right side panel */}
            {showComm && (
              <aside className="w-[360px] bg-[#111820] border-l border-[#1E2A3A] flex flex-col flex-shrink-0 animate-in slide-in-from-right hidden lg:flex">
                <div className="px-4 py-3.5 border-b border-[#1E2A3A] flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#E8ECF1]">Communication Hub</span>
                  <button onClick={() => setShowComm(false)} className="text-[#7B8CA3] hover:text-[#E8ECF1]"><X className="w-4 h-4" /></button>
                </div>
                {/* Comm tabs */}
                <div className="flex border-b border-[#1E2A3A] px-2">
                  {[
                    { id: "phone", label: "Call", color: "#A78BFA" },
                    { id: "video", label: "Video", color: "#22C55E" },
                    { id: "sms", label: "SMS", color: "#60A5FA" },
                    { id: "email", label: "Email", color: "#FBBF24" },
                    { id: "fax", label: "Fax", color: "#94A3B8" },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setCommTab(tab.id)}
                      className="flex-1 py-2.5 flex flex-col items-center gap-1 border-b-2 transition-all"
                      style={{
                        borderColor: commTab === tab.id ? tab.color : "transparent",
                        opacity: commTab === tab.id ? 1 : 0.5,
                      }}>
                      <Phone className="w-4 h-4" style={{ color: tab.color }} />
                      <span className="text-[10px] font-medium" style={{ color: commTab === tab.id ? tab.color : "#4A5568" }}>{tab.label}</span>
                    </button>
                  ))}
                </div>
                {/* Phone dialer (default) */}
                <div className="flex-1 overflow-auto p-4">
                  <CommContent tab={commTab} />
                </div>
                {/* Recent contacts */}
                <div className="border-t border-[#1E2A3A] p-3">
                  <p className="text-[11px] font-semibold text-[#4A5568] mb-2">RECENT</p>
                  {[
                    { name: "Sarah Chen", type: "call", time: "4:22" },
                    { name: "James Rodriguez", type: "sms", time: "9:15 AM" },
                    { name: "Priya Patel", type: "video", time: "12:08" },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <Phone className="w-3 h-3 text-[#A78BFA]" />
                      <span className="text-xs text-[#E8ECF1] flex-1">{r.name}</span>
                      <span className="text-[10px] text-[#4A5568] font-mono">{r.time}</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-[#4A5568] text-center mt-2">Avg wait: <span className="text-[#00D4AA] font-semibold">4m 12s</span></p>
                </div>
              </aside>
            )}

            {/* Instant Visit Queue — right side panel */}
            {showQueue && (
              <aside className="w-[360px] bg-[#111820] border-l border-[#1E2A3A] flex flex-col flex-shrink-0 hidden lg:flex">
                <div className="px-4 py-3.5 border-b border-[rgba(255,71,87,0.3)] bg-[rgba(255,71,87,0.05)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#FF4757]" />
                    <span className="text-sm font-semibold text-[#E8ECF1]">Instant Visit Queue</span>
                    {queueCount > 0 && (
                      <span className="px-2 py-0.5 rounded-[10px] bg-[#FF4757] text-white text-[11px] font-bold animate-pulse">{queueCount}</span>
                    )}
                  </div>
                  <button onClick={() => setShowQueue(false)} className="text-[#7B8CA3] hover:text-[#E8ECF1]"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-auto">
                  <QueueContent />
                </div>
                <div className="border-t border-[#1E2A3A] p-3 text-center">
                  <span className="text-[11px] text-[#4A5568]">Avg wait: <span className="text-[#00D4AA] font-semibold">4m 12s</span></span>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* ═══ GLOBAL WIDGETS ═══ */}
        <BugsyWidget />
        <LiveSessionAlert />
      </div>
    </AuthWrapper>
  )
}

// ── COMM CONTENT ──
function CommContent({ tab }: { tab: string }) {
  const [dialNum, setDialNum] = useState("")
  const dialPress = (d: string) => setDialNum(prev => prev + d)

  if (tab === "phone") return (
    <div>
      <p className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-2.5">Patient Phone</p>
      <div className="px-3.5 py-2.5 bg-[#151D28] rounded-[10px] border border-[#1E2A3A] text-lg font-mono text-[#E8ECF1] tracking-widest text-center mb-3 min-h-[44px]">
        {dialNum || "(602) 549-8598"}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3.5">
        {["1","2","3","4","5","6","7","8","9","*","0","#"].map(d => (
          <button key={d} onClick={() => dialPress(d)} className="h-[42px] rounded-[10px] border border-[#1E2A3A] bg-[#151D28] text-[#E8ECF1] text-base font-medium font-mono hover:bg-[#1A2332] active:bg-[#00D4AA]/20 transition-colors">
            {d}
          </button>
        ))}
      </div>
      <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-sm font-semibold flex items-center justify-center gap-2">
        <Phone className="w-4 h-4" /> Call Patient
      </button>
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF4757] animate-pulse" />
        <span className="text-[10px] text-[#4A5568]">Calls are recorded and transcribed</span>
      </div>
    </div>
  )

  if (tab === "sms") return (
    <div>
      <p className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-2.5">Send SMS</p>
      <div className="px-3 py-2 bg-[#151D28] rounded-lg border border-[#1E2A3A] mb-2 text-xs text-[#7B8CA3]">To: Sarah Chen · (602) 549-8598</div>
      <textarea className="w-full h-[120px] p-3 bg-[#151D28] rounded-[10px] border border-[#1E2A3A] text-[#E8ECF1] text-[13px] resize-none outline-none focus:border-[#60A5FA]/50" placeholder="Type your message..." />
      <div className="flex gap-2 mt-2">
        <select className="flex-1 px-3 py-2 bg-[#151D28] border border-[#1E2A3A] rounded-lg text-[#7B8CA3] text-xs outline-none"><option>Quick templates...</option></select>
        <button className="px-5 py-2 rounded-lg bg-[#60A5FA] text-white text-xs font-semibold">Send</button>
      </div>
    </div>
  )

  if (tab === "email") return (
    <div>
      <p className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-2.5">Compose Email</p>
      <input className="w-full px-3 py-2 bg-[#151D28] rounded-lg border border-[#1E2A3A] text-[#E8ECF1] text-xs outline-none mb-1.5" placeholder="To: patient@email.com" />
      <input className="w-full px-3 py-2 bg-[#151D28] rounded-lg border border-[#1E2A3A] text-[#E8ECF1] text-xs outline-none mb-1.5" placeholder="Subject" />
      <textarea className="w-full h-[140px] p-3 bg-[#151D28] rounded-[10px] border border-[#1E2A3A] text-[#E8ECF1] text-[13px] resize-none outline-none" placeholder="Compose..." />
      <button className="mt-2 px-5 py-2 rounded-lg bg-[#FBBF24] text-[#0B0F14] text-xs font-semibold">Send</button>
    </div>
  )

  if (tab === "video") return (
    <div className="text-center py-5">
      <div className="w-[60px] h-[60px] rounded-[20px] bg-[rgba(34,197,94,0.15)] inline-flex items-center justify-center mb-3">
        <Phone className="w-7 h-7 text-[#22C55E]" />
      </div>
      <p className="font-semibold text-[#E8ECF1] mb-1">Video Visit</p>
      <p className="text-xs text-[#7B8CA3] mb-4">HIPAA-secure video consultation</p>
      <button className="px-6 py-2.5 rounded-[10px] bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-[13px] font-semibold">Start Video Call</button>
      <div className="mt-4 p-3 bg-[#151D28] rounded-[10px] border border-[#1E2A3A] text-left">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Mic className="w-3.5 h-3.5 text-[#00D4AA]" />
          <span className="text-xs font-semibold text-[#00D4AA]">AI Scribe</span>
        </div>
        <span className="text-[11px] text-[#7B8CA3]">Auto-transcribes and generates SOAP notes in real-time.</span>
      </div>
    </div>
  )

  // Fax
  return (
    <div className="text-center py-5">
      <FolderOpen className="w-8 h-8 text-[#94A3B8] mx-auto" />
      <p className="font-medium text-[#E8ECF1] mt-2 mb-4">Send Fax</p>
      <div className="p-5 border-2 border-dashed border-[#1E2A3A] rounded-xl mb-3">
        <span className="text-xs text-[#4A5568]">Drop file or click to upload</span>
      </div>
      <input className="w-full px-3 py-2 bg-[#151D28] rounded-lg border border-[#1E2A3A] text-[#E8ECF1] text-xs outline-none" placeholder="Fax: (xxx) xxx-xxxx" />
    </div>
  )
}

// ── QUEUE CONTENT ──
function QueueContent() {
  const queue = [
    { name: "Emily Torres", reason: "Sore throat 2 days", type: "Video", wait: "3 min", paid: "$189" },
    { name: "Robert Mitchell", reason: "Skin rash spreading", type: "Video", wait: "7 min", paid: "$189" },
    { name: "Anna Nguyen", reason: "UTI symptoms", type: "Phone", wait: "12 min", paid: "$189" },
  ]

  return (
    <>
      {queue.map((p, i) => (
        <div key={i} className="p-4 border-b border-[#1E2A3A]">
          <div className="flex justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-[#E8ECF1]">{p.name}</p>
              <p className="text-xs text-[#7B8CA3] mt-0.5">{p.reason}</p>
            </div>
            <span className="text-[10px] font-mono text-[#4A5568]">{p.paid}</span>
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <Phone className="w-3 h-3 text-[#22C55E]" />
            <span className="text-[11px] text-[#7B8CA3]">{p.type}</span>
            <span className="text-[11px] text-[#FFB020] font-medium ml-1">Waiting {p.wait}</span>
          </div>
          <div className="flex gap-1.5">
            <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0B0F14] text-xs font-semibold">Accept</button>
            <button className="px-3.5 py-2 rounded-lg border border-[#1E2A3A] text-[#7B8CA3] text-xs">Skip</button>
          </div>
        </div>
      ))}
    </>
  )
}
