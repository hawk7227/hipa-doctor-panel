'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Bug, Clock, CheckCircle, AlertCircle, Search,
  Video, Image, FileText, ExternalLink,
  Loader2, RefreshCw, Phone, Lock, Trash2,
  ChevronDown, ChevronUp, Github, Globe, Monitor, X,
  Mic, FileAudio, Camera
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AdminVideoRecorder from '@/components/AdminVideoRecorder'

interface Doctor {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
}

interface Attachment {
  id: string
  type: 'video' | 'screenshot' | 'file'
  url: string
  name: string
  size: number
  mime_type: string
  duration_seconds?: number
  transcript?: string
}

interface BugReport {
  id: string
  doctor_id: string
  doctors: Doctor
  description: string
  page_url: string
  github_file_path: string
  github_file_url: string
  browser_info: string
  status: 'new' | 'investigating' | 'fixed' | 'wont_fix'
  admin_notes: string | null
  admin_read: boolean
  transcript: string | null
  ai_summary: string | null
  attachments: Attachment[]
  admin_response_video_url: string | null
  admin_response_video_name: string | null
  live_session_status: 'requested' | 'active' | 'completed' | null
  live_session_room_url: string | null
  live_session_requested_by: 'admin' | 'doctor' | null
  live_session_requested_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-500', textColor: 'text-blue-400', icon: Clock },
  investigating: { label: 'Investigating', color: 'bg-yellow-500', textColor: 'text-yellow-400', icon: Search },
  fixed: { label: 'Fixed', color: 'bg-green-500', textColor: 'text-green-400', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-500', textColor: 'text-gray-400', icon: AlertCircle },
}

const ADMIN_PASSWORD = 'sk'

export default function AdminBugReportsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [savingNotes, setSavingNotes] = useState<string | null>(null)
  const [requestingSession, setRequestingSession] = useState<string | null>(null)
  const [deletingReport, setDeletingReport] = useState<string | null>(null)
  const [recordingForReport, setRecordingForReport] = useState<string | null>(null)
  const [transcribingReport, setTranscribingReport] = useState<string | null>(null)
  const [endingSession, setEndingSession] = useState<string | null>(null)

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setPasswordError('')
      sessionStorage.setItem('admin_bugs_auth', 'true')
    } else {
      setPasswordError('Incorrect password')
    }
  }

  useEffect(() => {
    const isAuthed = sessionStorage.getItem('admin_bugs_auth') === 'true'
    if (isAuthed) setIsAuthenticated(true)
  }, [])

  const fetchBugReports = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ admin: 'true', ...(statusFilter !== 'all' && { status: statusFilter }) })
      const response = await fetch(\`/api/bug-reports?\${params}\`)
      if (!response.ok) throw new Error('Failed to fetch bug reports')
      const data = await response.json()
      setBugReports(data.bug_reports || [])
      const notesMap: Record<string, string> = {}
      data.bug_reports?.forEach((report: BugReport) => { notesMap[report.id] = report.admin_notes || '' })
      setAdminNotes(notesMap)
    } catch (err: any) {
      console.error('Error fetching bug reports:', err)
      setError(err.message || 'Failed to load bug reports')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { if (isAuthenticated) fetchBugReports() }, [isAuthenticated, fetchBugReports])

  const handleExpandReport = async (reportId: string) => {
    const isExpanding = expandedReport !== reportId
    setExpandedReport(isExpanding ? reportId : null)
    if (isExpanding) {
      const report = bugReports.find(r => r.id === reportId)
      if (report && !report.admin_read) {
        try {
          await fetch(\`/api/bug-reports/\${reportId}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_read: true }) })
          setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_read: true } : r))
        } catch (err) { console.error('Error marking as read:', err) }
      }
    }
  }

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    setUpdatingStatus(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      if (!response.ok) throw new Error('Failed to update status')
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus as any } : r))
    } catch (err) { console.error('Error updating status:', err) } finally { setUpdatingStatus(null) }
  }

  const handleSaveNotes = async (reportId: string) => {
    setSavingNotes(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_notes: adminNotes[reportId] }) })
      if (!response.ok) throw new Error('Failed to save notes')
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_notes: adminNotes[reportId] } : r))
    } catch (err) { console.error('Error saving notes:', err) } finally { setSavingNotes(null) }
  }

  const handleRequestLiveSession = async (reportId: string) => {
    setRequestingSession(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}/live-session\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requested_by: 'admin' }) })
      if (!response.ok) throw new Error('Failed to create session')
      const data = await response.json()
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, live_session_status: 'requested', live_session_room_url: data.room_url, live_session_requested_by: 'admin', live_session_requested_at: new Date().toISOString() } : r))
      if (data.room_url) window.open(data.room_url, '_blank')
    } catch (err) { console.error('Error creating session:', err) } finally { setRequestingSession(null) }
  }

  const handleEndSession = async (reportId: string) => {
    setEndingSession(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}/live-session\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) })
      if (!response.ok) throw new Error('Failed to end session')
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, live_session_status: 'completed' } : r))
    } catch (err) { console.error('Error ending session:', err) } finally { setEndingSession(null) }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this bug report? This cannot be undone.')) return
    setDeletingReport(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}\`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete report')
      setBugReports(prev => prev.filter(r => r.id !== reportId))
      if (expandedReport === reportId) setExpandedReport(null)
    } catch (err) { console.error('Error deleting report:', err) } finally { setDeletingReport(null) }
  }

  const handleTranscribe = async (reportId: string) => {
    setTranscribingReport(reportId)
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}/transcribe\`, { method: 'POST' })
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Transcription failed') }
      const data = await response.json()
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, transcript: data.transcript, ai_summary: data.ai_summary, attachments: data.bug_report?.attachments || r.attachments } : r))
      alert('Transcription complete!')
    } catch (err: any) { console.error('Error transcribing:', err); alert(\`Transcription failed: \${err.message}\`) } finally { setTranscribingReport(null) }
  }

  const handleVideoSave = (reportId: string, videoUrl: string, videoName: string) => {
    setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_response_video_url: videoUrl, admin_response_video_name: videoName } : r))
    setRecordingForReport(null)
  }

  const handleDeleteResponseVideo = async (reportId: string) => {
    if (!confirm('Delete this response video?')) return
    try {
      const response = await fetch(\`/api/bug-reports/\${reportId}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_response_video_url: null, admin_response_video_name: null }) })
      if (!response.ok) throw new Error('Failed to delete video')
      setBugReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_response_video_url: null, admin_response_video_name: null } : r))
    } catch (err) { console.error('Error deleting response video:', err) }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const formatFileSize = (bytes: number) => bytes < 1024 ? \`\${bytes} B\` : bytes < 1024 * 1024 ? \`\${(bytes / 1024).toFixed(1)} KB\` : \`\${(bytes / 1024 / 1024).toFixed(2)} MB\`
  const hasVideoAttachments = (report: BugReport) => report.attachments?.some(a => a.type === 'video')

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-full"><Lock className="w-8 h-8 text-red-400" /></div>
            </div>
            <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Access</h1>
            <p className="text-gray-400 text-center mb-6">Enter admin password to view bug reports</p>
            <form onSubmit={handlePasswordSubmit}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="w-full px-4 py-3 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 mb-4" autoFocus />
              {passwordError && <p className="text-red-400 text-sm mb-4">{passwordError}</p>}
              <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors">Access Bug Reports</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const unreadCount = bugReports.filter(r => !r.admin_read).length

  return (
    <div className="min-h-screen bg-gray-900 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg"><Bug className="w-6 h-6 text-red-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white">Bug Reports Admin</h1>
              <p className="text-sm text-gray-400">{bugReports.length} total reports{unreadCount > 0 && <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadCount} unread</span>}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-white text-sm focus:outline-none focus:border-teal-500">
              <option value="all">All Status</option><option value="new">New</option><option value="investigating">Investigating</option><option value="fixed">Fixed</option><option value="wont_fix">Won't Fix</option>
            </select>
            <button onClick={fetchBugReports} disabled={loading} className="p-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg text-gray-400 hover:text-white hover:border-teal-500 transition-colors disabled:opacity-50"><RefreshCw className={\`w-5 h-5 \${loading ? 'animate-spin' : ''}\`} /></button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-300">{error}</p><button onClick={fetchBugReports} className="ml-auto text-red-400 hover:text-red-300 text-sm underline">Retry</button></div>}
        {loading && bugReports.length === 0 && <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>}
        {!loading && bugReports.length === 0 && <div className="text-center py-12"><Bug className="w-16 h-16 text-gray-600 mx-auto mb-4" /><h3 className="text-xl font-semibold text-white mb-2">No Bug Reports</h3><p className="text-gray-400">No bug reports have been submitted yet.</p></div>}

        <div className="space-y-4">
          {bugReports.map((report) => {
            const statusConfig = STATUS_CONFIG[report.status]
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedReport === report.id
            const doctorName = report.doctors ? \`Dr. \${report.doctors.first_name} \${report.doctors.last_name}\` : 'Unknown Doctor'

            return (
              <div key={report.id} className={\`bg-[#0d2626] border rounded-xl overflow-hidden transition-all \${!report.admin_read ? 'border-blue-500/50' : 'border-[#1a3d3d]'}\`}>
                <div onClick={() => handleExpandReport(report.id)} className="p-4 cursor-pointer hover:bg-[#0a1f1f] transition-colors">
                  <div className="flex items-start gap-4">
                    {!report.admin_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium \${statusConfig.color} text-white\`}><StatusIcon className="w-3 h-3" />{statusConfig.label}</span>
                        <span className="text-sm text-teal-400">{doctorName}</span>
                        <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                        {report.admin_response_video_url && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400"><Video className="w-3 h-3" />Response Sent</span>}
                      </div>
                      <p className="text-white font-medium line-clamp-1">{report.description || 'No description provided'}</p>
                      <p className="text-sm text-gray-500 mt-1"><code className="px-1 py-0.5 bg-[#0a1f1f] rounded text-xs">{report.page_url}</code></p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.attachments?.length > 0 && <span className="text-xs text-gray-500">{report.attachments.length} file{report.attachments.length !== 1 ? 's' : ''}</span>}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#1a3d3d] p-4 space-y-4">
                    {report.ai_summary && <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2">🤖 AI Summary</h4><p className="text-gray-200 whitespace-pre-wrap">{report.ai_summary}</p></div>}
                    <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4><p className="text-gray-200 whitespace-pre-wrap">{report.description || 'No description provided'}</p></div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2"><Globe className="w-4 h-4" />Page URL</h4><code className="text-sm text-teal-400 break-all">{report.page_url}</code></div>
                      <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2"><Github className="w-4 h-4" />Source File</h4><a href={report.github_file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 break-all">{report.github_file_path}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a></div>
                    </div>
                    
                    <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2"><Monitor className="w-4 h-4" />Browser Info</h4><p className="text-sm text-gray-300 break-all">{report.browser_info}</p></div>

                    {report.attachments && report.attachments.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-400">Attachments</h4>
                          {hasVideoAttachments(report) && !report.transcript && <button onClick={() => handleTranscribe(report.id)} disabled={transcribingReport === report.id} className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs rounded-lg border border-purple-600/30 transition-colors flex items-center gap-1">{transcribingReport === report.id ? <><Loader2 className="w-3 h-3 animate-spin" />Transcribing...</> : <><FileAudio className="w-3 h-3" />Transcribe Audio</>}</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {report.attachments.map((attachment) => (
                            <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-[#0a1f1f] hover:bg-[#1a3d3d] border border-[#1a3d3d] rounded-lg transition-colors">
                              {attachment.type === 'video' ? <Video className="w-8 h-8 text-blue-400" /> : attachment.type === 'screenshot' ? <Image className="w-8 h-8 text-green-400" /> : <FileText className="w-8 h-8 text-gray-400" />}
                              <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{attachment.name}</p><p className="text-xs text-gray-500">{formatFileSize(attachment.size)}{attachment.duration_seconds && \` • \${Math.floor(attachment.duration_seconds / 60)}:\${(attachment.duration_seconds % 60).toString().padStart(2, '0')}\`}</p></div>
                              <ExternalLink className="w-4 h-4 text-gray-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.transcript && <div className="p-4 bg-[#0a1f1f] rounded-lg border border-[#1a3d3d]"><h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2"><Mic className="w-4 h-4" />Audio Transcript</h4><p className="text-sm text-gray-300 whitespace-pre-wrap">{report.transcript}</p></div>}

                    {report.admin_response_video_url && (
                      <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-600/30">
                        <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-medium text-purple-400 flex items-center gap-2"><Video className="w-4 h-4" />Your Response Video</h4><button onClick={() => handleDeleteResponseVideo(report.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button></div>
                        <video src={report.admin_response_video_url} controls className="w-full max-h-64 rounded-lg bg-black" />
                      </div>
                    )}

                    <div className="border-t border-[#1a3d3d] pt-4 space-y-4">
                      <h4 className="text-sm font-medium text-white">Admin Controls</h4>
                      
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-400">Status:</label>
                        <select value={report.status} onChange={(e) => handleStatusChange(report.id, e.target.value)} disabled={updatingStatus === report.id} className="px-3 py-1.5 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50">
                          <option value="new">New</option><option value="investigating">Investigating</option><option value="fixed">Fixed</option><option value="wont_fix">Won't Fix</option>
                        </select>
                        {updatingStatus === report.id && <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />}
                      </div>

                      <div>
                        <label className="text-sm text-gray-400 block mb-2">Admin Notes (visible to doctor):</label>
                        <textarea value={adminNotes[report.id] || ''} onChange={(e) => setAdminNotes(prev => ({ ...prev, [report.id]: e.target.value }))} placeholder="Add notes for the doctor..." className="w-full h-24 px-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none" />
                        <button onClick={() => handleSaveNotes(report.id)} disabled={savingNotes === report.id} className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
                          {savingNotes === report.id ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Notes'}
                        </button>
                      </div>

                      {recordingForReport === report.id ? (
                        <AdminVideoRecorder reportId={report.id} onSave={(videoUrl, videoName) => handleVideoSave(report.id, videoUrl, videoName)} onCancel={() => setRecordingForReport(null)} />
                      ) : !report.admin_response_video_url && (
                        <button onClick={() => setRecordingForReport(report.id)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"><Camera className="w-4 h-4" />Record Response Video</button>
                      )}

                      <div className="flex flex-wrap gap-3 pt-2">
                        {report.live_session_status !== 'active' && report.live_session_status !== 'requested' ? (
                          <button onClick={() => handleRequestLiveSession(report.id)} disabled={requestingSession === report.id} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
                            {requestingSession === report.id ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : <><Phone className="w-4 h-4" />Start Live Session</>}
                          </button>
                        ) : (
                          <>
                            {report.live_session_room_url && <a href={report.live_session_room_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"><Video className="w-4 h-4" />Join Session<ExternalLink className="w-3 h-3" /></a>}
                            <button onClick={() => handleEndSession(report.id)} disabled={endingSession === report.id} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
                              {endingSession === report.id ? <><Loader2 className="w-4 h-4 animate-spin" />Ending...</> : <><X className="w-4 h-4" />End Session</>}
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteReport(report.id)} disabled={deletingReport === report.id} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg border border-red-600/30 transition-colors flex items-center gap-2 ml-auto">
                          {deletingReport === report.id ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete Report</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
