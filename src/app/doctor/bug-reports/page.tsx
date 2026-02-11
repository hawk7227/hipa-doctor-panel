"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Bug, Clock, CheckCircle, AlertCircle, Search, Filter,
  Video, Image, FileText, ExternalLink, Play, MessageSquare,
  Loader2, RefreshCw, Phone, Bell, Volume2, VolumeX,
  X, Eye, Sparkles, ChevronDown, ChevronUp
} from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

interface Attachment {
  id: string
  type: "video" | "screenshot" | "file"
  url: string
  name: string
  size: number
  mime_type: string
  duration_seconds?: number
}

interface BugReport {
  id: string
  doctor_id: string
  description: string
  page_url: string
  github_file_path: string
  github_file_url: string
  browser_info: string
  status: "new" | "investigating" | "fixed" | "wont_fix"
  admin_notes: string | null
  admin_read: boolean
  ai_summary: string | null
  attachments: Attachment[]
  admin_response_video_url: string | null
  admin_response_video_name: string | null
  live_session_status: "requested" | "active" | "completed" | null
  live_session_room_url: string | null
  live_session_requested_by: "admin" | "doctor" | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  new: { label: "New", textColor: "text-blue-400", bgLight: "bg-blue-500/10", icon: Clock },
  investigating: { label: "Investigating", textColor: "text-yellow-400", bgLight: "bg-yellow-500/10", icon: Search },
  fixed: { label: "Fixed", textColor: "text-green-400", bgLight: "bg-green-500/10", icon: CheckCircle },
  wont_fix: { label: "Won't Fix", textColor: "text-gray-400", bgLight: "bg-gray-500/10", icon: AlertCircle },
}

export default function DoctorBugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set())
  const [joiningSession, setJoiningSession] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [readReports, setReadReports] = useState<Set<string>>(new Set())
  const [newResponseCount, setNewResponseCount] = useState(0)
  const [lastKnownResponses, setLastKnownResponses] = useState<Set<string>>(new Set())
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null)
  const [playingVideoTitle, setPlayingVideoTitle] = useState("")

  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const pollIntervalRef = useRef<any>(null)

  // Initialize
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bugReports_soundEnabled")
      if (saved !== null) setSoundEnabled(saved === "true")
      const savedRead = localStorage.getItem("bugReports_read")
      if (savedRead) { try { setReadReports(new Set(JSON.parse(savedRead))) } catch {} }
    }
  }, [])

  useEffect(() => {
    if (readReports.size > 0) localStorage.setItem("bugReports_read", JSON.stringify([...readReports]))
  }, [readReports])

  const playSound = useCallback(() => {
    if (!soundEnabled) return
    try { new Audio("data:audio/wav;base64,UklGRjQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAEAAB/f4B+").play().catch(() => {}) } catch {}
  }, [soundEnabled])

  const toggleSound = () => {
    const v = !soundEnabled; setSoundEnabled(v)
    localStorage.setItem("bugReports_soundEnabled", String(v))
  }

  const markAsRead = (id: string) => setReadReports(prev => new Set([...prev, id]))

  const fetchBugReports = useCallback(async (silent = false) => {
    if (!doctorId) return
    try {
      if (!silent) setLoading(true)
      setError(null)
      const params = new URLSearchParams({ doctor_id: doctorId, ...(statusFilter !== "all" && { status: statusFilter }) })
      const res = await fetch(`/api/bug-reports?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      const reports: BugReport[] = data.bug_reports || []

      const currentResponses = new Set(reports.filter(r => r.admin_response_video_url || r.admin_notes).map(r => r.id + "-" + r.updated_at))
      if (lastKnownResponses.size > 0) {
        const newR = [...currentResponses].filter(id => !lastKnownResponses.has(id))
        if (newR.length > 0) playSound()
      }
      setLastKnownResponses(currentResponses)
      setNewResponseCount(reports.filter(r => (r.admin_response_video_url || r.admin_notes) && !readReports.has(r.id)).length)
      setBugReports(reports)
    } catch (e: any) { if (!silent) setError(e.message) } finally { if (!silent) setLoading(false) }
  }, [doctorId, statusFilter, readReports, lastKnownResponses, playSound])

  useEffect(() => {
    (async () => { const u = await getCurrentUser(); if (u?.doctor?.id) setDoctorId(u.doctor.id) })()
  }, [])

  useEffect(() => { if (doctorId) fetchBugReports() }, [doctorId, fetchBugReports])

  useEffect(() => {
    if (!doctorId) return
    pollIntervalRef.current = setInterval(() => fetchBugReports(true), 30000)
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }
  }, [doctorId, fetchBugReports])

  const toggleExpanded = (id: string) => {
    setExpandedReports(prev => {
      const s = new Set(prev); if (s.has(id)) s.delete(id); else { s.add(id); if (!readReports.has(id)) markAsRead(id) }; return s
    })
  }

  const joinLiveSession = async (r: BugReport) => {
    if (!r.live_session_room_url) return
    setJoiningSession(true)
    try {
      await fetch(`/api/bug-reports/${r.id}/live-session`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) })
      window.open(r.live_session_room_url, "_blank"); fetchBugReports()
    } catch (e) { console.error(e) } finally { setJoiningSession(false) }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const fmtRel = (d: string) => { const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms / 60000); if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(ms / 3600000); if (h < 24) return `${h}h ago`; return `${Math.floor(ms / 86400000)}d ago` }
  const fmtSize = (b: number) => { if (b < 1024) return `${b}B`; if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`; return `${(b / 1048576).toFixed(2)}MB` }

  const stats = {
    total: bugReports.length,
    newC: bugReports.filter(r => r.status === "new").length,
    investigating: bugReports.filter(r => r.status === "investigating").length,
    fixed: bugReports.filter(r => r.status === "fixed").length,
  }

  const filtered = statusFilter === "all" ? bugReports : bugReports.filter(r => r.status === statusFilter)

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA]" /></div>
  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.2)] rounded-xl p-6 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-[#FF4757] mx-auto mb-3" />
        <p className="text-sm text-[#7B8CA3] mb-4">{error}</p>
        <button onClick={() => fetchBugReports()} className="px-4 py-2 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-sm font-semibold">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(255,71,87,0.12)] flex items-center justify-center">
            <Bug className="w-5 h-5 text-[#FF4757]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#E8ECF1] flex items-center gap-2">
              My Bug Reports
              {newResponseCount > 0 && <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FF4757] text-white rounded-full animate-pulse">{newResponseCount} NEW</span>}
            </h2>
            <p className="text-xs text-[#7B8CA3]">Track and manage your submitted bug reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleSound} className="p-2 rounded-lg bg-[#151D28] border border-[#1E2A3A] text-[#7B8CA3] hover:text-[#E8ECF1]">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={() => fetchBugReports()} className="p-2 rounded-lg bg-[#151D28] border border-[#1E2A3A] text-[#7B8CA3] hover:text-[#E8ECF1]">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", value: stats.total, color: "#7B8CA3" },
          { label: "New", value: stats.newC, color: "#3B82F6" },
          { label: "In Progress", value: stats.investigating, color: "#F59E0B" },
          { label: "Fixed", value: stats.fixed, color: "#22C55E" },
        ].map((s, i) => (
          <div key={i} className="bg-[#151D28] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-[#E8ECF1]">{s.value}</p>
            <p className="text-[11px] font-mono" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#151D28] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none">
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="investigating">Investigating</option>
          <option value="fixed">Fixed</option>
          <option value="wont_fix">Won&apos;t Fix</option>
        </select>
        <span className="ml-auto text-xs text-[#4A5568]">{filtered.length} reports</span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-10 text-center">
            <Bug className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
            <p className="text-[#7B8CA3] text-sm">No bug reports found</p>
          </div>
        ) : filtered.map(report => {
          const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.new
          const SIcon = sc.icon
          const expanded = expandedReports.has(report.id)
          const hasLive = report.live_session_status === "requested" || report.live_session_status === "active"

          return (
            <div key={report.id} className={`bg-[#151D28] border rounded-xl overflow-hidden ${hasLive ? "border-[#FF4757]/30" : "border-[#1E2A3A]"}`}>
              {hasLive && (
                <div className="px-4 py-2 bg-[rgba(255,71,87,0.08)] border-b border-[rgba(255,71,87,0.2)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF4757] animate-pulse" />
                    <span className="text-xs font-semibold text-[#FF4757]">Live Support Session {report.live_session_status === "requested" ? "Requested" : "Active"}</span>
                  </div>
                  <button onClick={() => joinLiveSession(report)} disabled={joiningSession}
                    className="px-3 py-1.5 bg-[#FF4757] text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                    {joiningSession ? "Joining..." : "Join Now"}
                  </button>
                </div>
              )}
              <button onClick={() => toggleExpanded(report.id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sc.bgLight}`}>
                  <SIcon className={`w-4 h-4 ${sc.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#E8ECF1] truncate">{report.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.bgLight} ${sc.textColor}`}>{sc.label}</span>
                    <span className="text-[10px] text-[#4A5568]">{fmtRel(report.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {report.attachments?.length > 0 && <span className="text-[10px] text-[#7B8CA3]">{report.attachments.length} files</span>}
                  {!readReports.has(report.id) && (report.admin_response_video_url || report.admin_notes) && <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />}
                  {expanded ? <ChevronUp className="w-4 h-4 text-[#4A5568]" /> : <ChevronDown className="w-4 h-4 text-[#4A5568]" />}
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-4 border-t border-[#1E2A3A] pt-3 space-y-3">
                  <div className="bg-[#111820] rounded-xl p-3">
                    <p className="text-xs text-[#7B8CA3] leading-relaxed">{report.description}</p>
                    <p className="text-[10px] text-[#4A5568] mt-2">Filed: {fmtDate(report.created_at)}</p>
                  </div>
                  {report.ai_summary && (
                    <div className="bg-[rgba(129,140,248,0.08)] border border-[rgba(129,140,248,0.2)] rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5 text-[#818CF8]" /><span className="text-[10px] font-semibold text-[#818CF8]">AI Analysis</span></div>
                      <p className="text-xs text-[#7B8CA3]">{report.ai_summary}</p>
                    </div>
                  )}
                  {report.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {report.attachments.map(att => (
                        <button key={att.id} onClick={() => att.type === "video" ? (setPlayingVideoUrl(att.url), setPlayingVideoTitle(att.name), setShowVideoPlayer(true)) : window.open(att.url, "_blank")}
                          className="flex items-center gap-2 px-3 py-2 bg-[#111820] border border-[#1E2A3A] rounded-lg hover:border-[#2A3A4F]">
                          {att.type === "video" ? <Play className="w-3 h-3 text-[#FF4757]" /> : att.type === "screenshot" ? <Image className="w-3 h-3 text-[#3B82F6]" /> : <FileText className="w-3 h-3 text-[#7B8CA3]" />}
                          <span className="text-xs text-[#E8ECF1] max-w-[120px] truncate">{att.name}</span>
                          <span className="text-[9px] text-[#4A5568]">{fmtSize(att.size)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {report.admin_notes && (
                    <div className="bg-[rgba(0,212,170,0.06)] border border-[rgba(0,212,170,0.15)] rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-[#00D4AA] mb-1">Admin Response</p>
                      <p className="text-xs text-[#7B8CA3]">{report.admin_notes}</p>
                    </div>
                  )}
                  {report.admin_response_video_url && (
                    <button onClick={() => { setPlayingVideoUrl(report.admin_response_video_url!); setPlayingVideoTitle(report.admin_response_video_name || "Response"); setShowVideoPlayer(true) }}
                      className="flex items-center gap-2 px-3 py-2 bg-[#111820] border border-[#1E2A3A] rounded-lg hover:border-[#00D4AA]/30">
                      <Play className="w-3.5 h-3.5 text-[#00D4AA]" /><span className="text-xs text-[#E8ECF1]">Watch Admin Response Video</span>
                    </button>
                  )}
                  {report.github_file_url && (
                    <a href={report.github_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#7B8CA3] hover:text-[#00D4AA]">
                      <ExternalLink className="w-3 h-3" /> View on GitHub
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && playingVideoUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111820] border border-[#1E2A3A] rounded-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E2A3A] flex items-center justify-between">
              <span className="text-sm font-semibold text-[#E8ECF1]">{playingVideoTitle}</span>
              <button onClick={() => setShowVideoPlayer(false)} className="text-[#7B8CA3] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4"><video src={playingVideoUrl} controls autoPlay className="w-full rounded-xl" /></div>
          </div>
        </div>
      )}
    </div>
  )
}
