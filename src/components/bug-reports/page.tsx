// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Bug, Clock, CheckCircle, AlertCircle, Search, Filter,
  Video, Image, FileText, ExternalLink, Play, MessageSquare,
  Loader2, RefreshCw, Phone
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

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-500', textColor: 'text-blue-400', icon: Clock },
  investigating: { label: 'Investigating', color: 'bg-yellow-500', textColor: 'text-yellow-400', icon: Search },
  fixed: { label: 'Fixed', color: 'bg-green-500', textColor: 'text-green-400', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-500', textColor: 'text-gray-400', icon: AlertCircle },
}

export default function DoctorBugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)
  const [joiningSession, setJoiningSession] = useState(false)

  // Fetch bug reports
  const fetchBugReports = useCallback(async () => {
    if (!doctorId) return

    try {
      setLoading(true)
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
      setBugReports(data.bug_reports || [])

    } catch (err: any) {
      console.error('Error fetching bug reports:', err)
      setError(err.message || 'Failed to load bug reports')
    } finally {
      setLoading(false)
    }
  }, [doctorId, statusFilter])

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

  // Join live session
  const joinLiveSession = async (report: BugReport) => {
    if (!report.live_session_room_url) return

    setJoiningSession(true)
    try {
      // Update session status to active
      await fetch(`/api/bug-reports/${report.id}/live-session`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      })

      // Open Daily room in new tab
      window.open(report.live_session_room_url, '_blank')
      
      // Refresh to update status
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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
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
              <h1 className="text-2xl font-bold text-white">My Bug Reports</h1>
              <p className="text-sm text-gray-400">Track your submitted issues and their status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="investigating">Investigating</option>
              <option value="fixed">Fixed</option>
              <option value="wont_fix">Won't Fix</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchBugReports}
              disabled={loading}
              className="p-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-gray-400 hover:text-white hover:border-teal-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchBugReports}
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

            return (
              <div
                key={report.id}
                className={`bg-[#0d2626] border rounded-xl overflow-hidden transition-colors ${
                  hasLiveSession && report.live_session_requested_by === 'admin'
                    ? 'border-red-500 animate-pulse'
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

                <div className="p-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} text-white`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {hasAdminResponse && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400">
                            <MessageSquare className="w-3 h-3" />
                            Admin Responded
                          </span>
                        )}
                      </div>
                      <p className="text-white font-medium line-clamp-2">
                        {report.description || 'No description provided'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(report.created_at)}
                    </span>
                  </div>

                  {/* AI Summary */}
                  {report.ai_summary && (
                    <div className="mb-3 p-3 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]">
                      <p className="text-xs text-gray-500 mb-1">AI Summary</p>
                      <p className="text-sm text-gray-300">{report.ai_summary}</p>
                    </div>
                  )}

                  {/* Page URL */}
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <span>Page:</span>
                    <code className="px-2 py-0.5 bg-[#0a1f1f] rounded text-gray-300">{report.page_url}</code>
                  </div>

                  {/* Attachments */}
                  {report.attachments && report.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {report.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
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
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Admin Response */}
                  {hasAdminResponse && (
                    <div className="mt-4 pt-4 border-t border-[#1a3d3d]">
                      <p className="text-xs text-gray-500 mb-2">Admin Response</p>
                      
                      {report.admin_notes && (
                        <p className="text-sm text-gray-300 mb-2">{report.admin_notes}</p>
                      )}

                      {report.admin_response_video_url && (
                        <a
                          href={report.admin_response_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-600/30 rounded-lg text-sm text-teal-400 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Watch Response Video
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
