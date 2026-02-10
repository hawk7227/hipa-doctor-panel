'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Bug, Clock, CheckCircle, AlertCircle, Search, Filter,
  Video, Image, FileText, ExternalLink, Play, MessageSquare,
  Loader2, RefreshCw, Phone, Bell, BellRing, Volume2, VolumeX,
  X, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

interface Doctor {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface Attachment {
  id: string
  type: 'video' | 'screenshot' | 'file'
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
  status: 'new' | 'investigating' | 'fixed' | 'wont_fix'
  admin_notes: string | null
  admin_read: boolean
  ai_summary: string | null
  attachments: Attachment[]
  admin_response_video_url: string | null
  admin_response_video_name: string | null
  live_session_status: 'requested' | 'active' | 'completed' | null
  live_session_room_url: string | null
  live_session_requested_by: 'admin' | 'doctor' | null
  created_at: string
  updated_at: string
}

// Sound effects
const SOUNDS = {
  notification: 'data:audio/wav;base64,UklGRjQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAEAACAf4GBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAAAAP///v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppZ2ZlZGNiYWBfXl1cW1pZWFdWVVRTUlFQT05NTEtKSUhHRkVEQ0JBQD8+PTw7Ojk4NzY1NDMyMTAvLi0sKyopKCcmJSQjIiEgHx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=',
  newMessage: 'data:audio/wav;base64,UklGRoQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWAFAAB/f4CAgYGCgoODhISFhYaGh4eIiImJioqLi4yMjY2Ojo+PkJCRkZKSk5OUlJWVlpaXl5iYmZmampubm5ycnZ2enp+foKChoaKio6OkpKWlpqanp6ioqamqqqqrrKytra6ur6+wsLGxsrKzs7S0tbW2tre3uLi5ubq6u7u8vL29vr6/v8DAwcHCwsPDxMTFxcbGx8fIyMnJysrLy8zMzc3Ozs/P0NDR0dLS09PU1NXV1tbX19jY2dna2tvb3Nzd3d7e39/g4OHh4uLj4+Tk5eXm5ufn6Ojp6err7Ozt7e7u7+/w8PHx8vLz8/T09fX29vf3+Pj5+fr6+/v8/P39/v7//wAA',
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-500', textColor: 'text-blue-400', bgLight: 'bg-blue-500/10', icon: Clock },
  investigating: { label: 'Investigating', color: 'bg-yellow-500', textColor: 'text-yellow-400', bgLight: 'bg-yellow-500/10', icon: Search },
  fixed: { label: 'Fixed', color: 'bg-green-500', textColor: 'text-green-400', bgLight: 'bg-green-500/10', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-500', textColor: 'text-gray-400', bgLight: 'bg-gray-500/10', icon: AlertCircle },
}

const STORAGE_KEYS = {
  readReports: 'bugReports_read',
  soundEnabled: 'bugReports_soundEnabled',
  lastCheck: 'bugReports_lastCheck',
}

export default function DoctorBugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  const [joiningSession, setJoiningSession] = useState(false)
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set())
  
  // Video player state
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null)
  const [playingVideoTitle, setPlayingVideoTitle] = useState<string>('')
  
  // Notification state
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [readReports, setReadReports] = useState<Set<string>>(new Set())
  const [newResponseCount, setNewResponseCount] = useState(0)
  const [lastKnownResponses, setLastKnownResponses] = useState<Set<string>>(new Set())
  
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio and load preferences
  useEffect(() => {
    // Initialize audio
    Object.entries(SOUNDS).forEach(([key, src]) => {
      const audio = new Audio(src)
      audio.volume = 0.5
      audioRefs.current[key] = audio
    })

    // Load preferences from localStorage
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem(STORAGE_KEYS.soundEnabled)
      if (savedSound !== null) {
        setSoundEnabled(savedSound === 'true')
      }

      const savedRead = localStorage.getItem(STORAGE_KEYS.readReports)
      if (savedRead) {
        try {
          setReadReports(new Set(JSON.parse(savedRead)))
        } catch (e) {
          console.error('Failed to parse read reports:', e)
        }
      }
    }
  }, [])

  // Save read reports to localStorage
  useEffect(() => {
    if (readReports.size > 0) {
      localStorage.setItem(STORAGE_KEYS.readReports, JSON.stringify([...readReports]))
    }
  }, [readReports])

  // Play sound helper
  const playSound = useCallback((soundName: keyof typeof SOUNDS) => {
    if (!soundEnabled) return
    const audio = audioRefs.current[soundName]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }
  }, [soundEnabled])

  // Toggle sound
  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem(STORAGE_KEYS.soundEnabled, String(newValue))
  }

  // Fetch bug reports
  const fetchBugReports = useCallback(async (silent = false) => {
    if (!doctorId) return

    try {
      if (!silent) setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        doctor_id: doctorId,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })

      const response = await fetch(`/api/bug-reports?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch bug reports')
      }

      const data = await response.json()
      const reports = data.bug_reports || []
      
      // Check for new admin responses
      const currentResponses: Set<string> = new Set(
        reports
          .filter((r: BugReport) => r.admin_response_video_url || r.admin_notes)
          .map((r: BugReport) => r.id + '-' + r.updated_at)
      )
      
      // If we have previous responses and there are new ones, play notification
      if (lastKnownResponses.size > 0) {
        const newResponses = [...currentResponses].filter((id: string) => !lastKnownResponses.has(id))
        if (newResponses.length > 0) {
          playSound('newMessage')
        }
      }
      setLastKnownResponses(currentResponses)
      
      // Count unread responses
      const unread = reports.filter((r: BugReport) => 
        (r.admin_response_video_url || r.admin_notes) && !readReports.has(r.id)
      ).length
      setNewResponseCount(unread)
      
      setBugReports(reports)

    } catch (err: any) {
      console.error('Error fetching bug reports:', err)
      if (!silent) setError(err.message || 'Failed to load bug reports')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [doctorId, statusFilter, readReports, lastKnownResponses, playSound])

  // Get current doctor
  useEffect(() => {
    const loadDoctor = async () => {
      const user = await getCurrentUser()
      if (user?.doctor?.id) {
        setDoctorId(user.doctor.id)
      }
    }
    loadDoctor()
  }, [])

  // Fetch reports when doctor ID is available
  useEffect(() => {
    if (doctorId) {
      fetchBugReports()
    }
  }, [doctorId, fetchBugReports])

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (!doctorId) return

    pollIntervalRef.current = setInterval(() => {
      fetchBugReports(true) // Silent refresh
    }, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [doctorId, fetchBugReports])

  // Mark report as read
  const markAsRead = (reportId: string) => {
    setReadReports(prev => new Set([...prev, reportId]))
    setNewResponseCount(prev => Math.max(0, prev - 1))
  }

  // Toggle report expansion
  const toggleExpanded = (reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reportId)) {
        newSet.delete(reportId)
      } else {
        newSet.add(reportId)
        // Mark as read when expanded
        if (!readReports.has(reportId)) {
          markAsRead(reportId)
        }
      }
      return newSet
    })
  }

  // Open video player
  const openVideoPlayer = (url: string, title: string) => {
    setPlayingVideoUrl(url)
    setPlayingVideoTitle(title)
    setShowVideoPlayer(true)
  }

  // Join live session
  const joinLiveSession = async (report: BugReport) => {
    if (!report.live_session_room_url) return

    setJoiningSession(true)
    try {
      await fetch(`/api/bug-reports/${report.id}/live-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      })

      window.open(report.live_session_room_url, '_blank')
      fetchBugReports()
    } catch (err) {
      console.error('Error joining session:', err)
    } finally {
      setJoiningSession(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  // Stats
  const stats = {
    total: bugReports.length,
    new: bugReports.filter(r => r.status === 'new').length,
    investigating: bugReports.filter(r => r.status === 'investigating').length,
    fixed: bugReports.filter(r => r.status === 'fixed').length,
    withResponses: bugReports.filter(r => r.admin_response_video_url || r.admin_notes).length,
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Bug className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                My Bug Reports
                {newResponseCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
                    {newResponseCount} NEW
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-400">Track your submitted issues and admin responses</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled 
                  ? 'bg-teal-600/20 text-teal-400 border border-teal-600/30' 
                  : 'bg-[#0d2626] text-gray-500 border border-[#1a3d3d]'
              }`}
              title={soundEnabled ? 'Notifications on' : 'Notifications off'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Status ({stats.total})</option>
              <option value="new">New ({stats.new})</option>
              <option value="investigating">Investigating ({stats.investigating})</option>
              <option value="fixed">Fixed ({stats.fixed})</option>
              <option value="wont_fix">Won't Fix</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => fetchBugReports()}
              disabled={loading}
              className="p-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-gray-400 hover:text-white hover:border-teal-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Bug className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#0d2626] border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-400">New</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
          </div>
          <div className="bg-[#0d2626] border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.investigating}</p>
          </div>
          <div className="bg-[#0d2626] border border-green-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Fixed</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.fixed}</p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => fetchBugReports()}
              className="ml-auto text-red-400 hover:text-red-300 text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && bugReports.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && bugReports.length === 0 && (
          <div className="text-center py-12">
            <Bug className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Bug Reports Yet</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              When you submit bug reports using the floating bug button, they'll appear here so you can track their status.
            </p>
          </div>
        )}

        {/* Bug Reports List */}
        <div className="space-y-4">
          {bugReports.map((report) => {
            const statusConfig = STATUS_CONFIG[report.status]
            const StatusIcon = statusConfig.icon
            const hasLiveSession = report.live_session_status === 'requested' || report.live_session_status === 'active'
            const hasAdminResponse = !!report.admin_response_video_url || !!report.admin_notes
            const isUnread = hasAdminResponse && !readReports.has(report.id)
            const isExpanded = expandedReports.has(report.id)

            return (
              <div
                key={report.id}
                className={`bg-[#0d2626] border rounded-xl overflow-hidden transition-all ${
                  hasLiveSession && report.live_session_requested_by === 'admin'
                    ? 'border-red-500'
                    : isUnread
                    ? 'border-teal-500 ring-1 ring-teal-500/50'
                    : 'border-[#1a3d3d]'
                }`}
              >
                {/* Live Session Alert */}
                {hasLiveSession && report.live_session_requested_by === 'admin' && (
                  <div className="px-4 py-3 bg-red-500/20 border-b border-red-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-red-400 animate-bounce" />
                      <span className="text-red-300 font-medium">Live Support Session Requested</span>
                    </div>
                    <button
                      onClick={() => joinLiveSession(report)}
                      disabled={joiningSession}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {joiningSession ? 'Joining...' : 'Join Now'}
                    </button>
                  </div>
                )}

                {/* Clickable Header */}
                <button
                  onClick={() => toggleExpanded(report.id)}
                  className="w-full p-4 text-left hover:bg-[#0a1f1f] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} text-white`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500 text-white animate-pulse">
                            <Sparkles className="w-3 h-3" />
                            NEW RESPONSE
                          </span>
                        )}
                        {hasAdminResponse && !isUnread && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400">
                            <MessageSquare className="w-3 h-3" />
                            Admin Responded
                          </span>
                        )}
                      </div>
                      <p className="text-white font-medium line-clamp-2">
                        {report.description || 'No description provided'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{formatRelativeTime(report.created_at)}</span>
                        <span>•</span>
                        <code className="px-1.5 py-0.5 bg-[#0a1f1f] rounded text-gray-400">{report.page_url}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#1a3d3d]">
                    {/* AI Summary */}
                    {report.ai_summary && (
                      <div className="mt-4 p-3 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          AI Summary
                        </p>
                        <p className="text-sm text-gray-300">{report.ai_summary}</p>
                      </div>
                    )}

                    {/* Your Attachments */}
                    {report.attachments && report.attachments.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-500 mb-2">Your Attachments</p>
                        <div className="flex flex-wrap gap-2">
                          {report.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              onClick={() => {
                                if (attachment.type === 'video') {
                                  openVideoPlayer(attachment.url, attachment.name)
                                } else {
                                  window.open(attachment.url, '_blank')
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0a1f1f] hover:bg-[#1a3d3d] border border-[#1a3d3d] rounded-lg text-sm text-gray-300 transition-colors"
                            >
                              {attachment.type === 'video' ? (
                                <Video className="w-4 h-4 text-blue-400" />
                              ) : attachment.type === 'screenshot' ? (
                                <Image className="w-4 h-4 text-green-400" />
                              ) : (
                                <FileText className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="truncate max-w-[150px]">{attachment.name}</span>
                              <span className="text-xs text-gray-500">{formatFileSize(attachment.size)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Response Section */}
                    {hasAdminResponse && (
                      <div className="mt-4 p-4 bg-teal-900/20 rounded-lg border border-teal-600/30">
                        <p className="text-xs text-teal-400 mb-3 font-semibold flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Admin Response
                        </p>
                        
                        {report.admin_notes && (
                          <p className="text-sm text-gray-300 mb-3">{report.admin_notes}</p>
                        )}

                        {report.admin_response_video_url && (
                          <button
                            onClick={() => openVideoPlayer(
                              report.admin_response_video_url!,
                              report.admin_response_video_name || 'Admin Response Video'
                            )}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            Watch Response Video
                          </button>
                        )}
                      </div>
                    )}

                    {/* No Admin Response Yet */}
                    {!hasAdminResponse && (
                      <div className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30 text-center">
                        <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Waiting for admin response...</p>
                        <p className="text-xs text-gray-500 mt-1">You'll be notified when there's an update</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="mt-4 pt-3 border-t border-[#1a3d3d] flex items-center justify-between text-xs text-gray-500">
                      <span>Created: {formatDate(report.created_at)}</span>
                      <span>Updated: {formatDate(report.updated_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && playingVideoUrl && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowVideoPlayer(false)}
        >
          <div 
            className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#1a3d3d]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-teal-400" />
                {playingVideoTitle}
              </h3>
              <button
                onClick={() => setShowVideoPlayer(false)}
                className="p-1 hover:bg-[#1a3d3d] rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <video
                src={playingVideoUrl}
                controls
                autoPlay
                className="w-full max-h-[60vh] rounded-lg bg-black"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



