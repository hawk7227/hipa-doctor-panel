'use client';

// ============================================================================
// ADMIN BUG REPORTS DASHBOARD
// Route: /admin/bug-reports
// Password-protected. Shows all bug reports with video, transcript, status mgmt
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bug, Clock, CheckCircle, AlertCircle, Search, Filter,
  Video, FileText, ExternalLink, Play, Pause, MessageSquare,
  Loader2, RefreshCw, Eye, Lock, Trash2, ChevronDown,
  ChevronUp, Globe, Monitor, X, Send, Volume2, VolumeX,
  SkipBack, ArrowLeft, MousePointer2, Pencil, Tag,
  BarChart3, Inbox, Wrench, Ban, User,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface BugReport {
  id: string;
  doctor_id: string;
  doctors?: { first_name: string; last_name: string; email: string };
  description: string;
  page_url: string;
  page_name: string;
  browser_info: string;
  status: 'new' | 'investigating' | 'fixed' | 'wont_fix';
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  admin_notes: string | null;
  admin_read: boolean;
  transcript: string | null;
  ai_summary: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  attachments: any[];
  markers: any[];
  interactions: any[];
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  new: { label: 'New', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: Inbox },
  investigating: { label: 'Investigating', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Wrench },
  fixed: { label: 'Fixed', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: Ban },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  high: { label: 'High', bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
  medium: { label: 'Medium', bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  low: { label: 'Low', bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-500' },
};

const ADMIN_PASSWORD = 'sk';

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminBugReportsPage() {
  // Auth
  const [isAuthed, setIsAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');

  // Data
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // UI
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // ── Auth ──
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('admin_bugs_auth') === 'true') setIsAuthed(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { setIsAuthed(true); setPwError(''); sessionStorage.setItem('admin_bugs_auth', 'true'); }
    else setPwError('Incorrect password');
  };

  // ── Fetch reports ──
  const fetchReports = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/bugsy/admin/reports');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReports(data.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load bug reports. Make sure the API route exists.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAuthed) fetchReports(); }, [isAuthed, fetchReports]);

  // ── Actions ──
  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/bugsy/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      setReports(p => p.map(r => r.id === id ? { ...r, status: status as any } : r));
    } catch (err) { console.error('Update error:', err); }
    finally { setUpdatingId(null); }
  };

  const updatePriority = async (id: string, priority: string) => {
    try {
      await fetch(`/api/bugsy/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }) });
      setReports(p => p.map(r => r.id === id ? { ...r, priority: priority as any } : r));
    } catch (err) { console.error('Priority error:', err); }
  };

  const saveNotes = async (id: string) => {
    setSavingNotes(id);
    try {
      await fetch(`/api/bugsy/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_notes: notes[id] || '' }) });
      setReports(p => p.map(r => r.id === id ? { ...r, admin_notes: notes[id] || '' } : r));
    } catch (err) { console.error('Notes error:', err); }
    finally { setSavingNotes(null); }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/bugsy/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_read: true }) });
      setReports(p => p.map(r => r.id === id ? { ...r, admin_read: true } : r));
    } catch {}
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report permanently?')) return;
    try {
      await fetch(`/api/bugsy/admin/reports/${id}`, { method: 'DELETE' });
      setReports(p => p.filter(r => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) { console.error('Delete error:', err); }
  };

  // ── Helpers ──
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ago = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
    if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`; return `${dy}d ago`;
  };

  // ── Filtered reports ──
  const filtered = reports.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.description?.toLowerCase().includes(q) || r.page_url?.toLowerCase().includes(q) || r.transcript?.toLowerCase().includes(q) || r.doctors?.first_name?.toLowerCase().includes(q) || r.doctors?.last_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: reports.length,
    unread: reports.filter(r => !r.admin_read).length,
    new: reports.filter(r => r.status === 'new').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    fixed: reports.filter(r => r.status === 'fixed').length,
  };

  // ============================================================================
  // LOGIN SCREEN
  // ============================================================================
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <Lock className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Access</h1>
            <p className="text-gray-500 text-sm">Bug Reports Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" autoFocus className="w-full bg-[#12121a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50" />
            {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
            <button type="submit" className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30"><Bug className="w-5 h-5 text-red-400" /></div>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">Bug Reports {stats.unread > 0 && <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">{stats.unread} new</span>}</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchReports} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={() => { sessionStorage.removeItem('admin_bugs_auth'); setIsAuthed(false); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-gray-400' },
            { label: 'Unread', value: stats.unread, icon: Inbox, color: 'text-red-400' },
            { label: 'New', value: stats.new, icon: Clock, color: 'text-blue-400' },
            { label: 'Investigating', value: stats.investigating, icon: Wrench, color: 'text-yellow-400' },
            { label: 'Fixed', value: stats.fixed, icon: CheckCircle, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#12121a] rounded-xl border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-2xl font-bold">{s.value}</span></div>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search reports..." className="w-full bg-[#12121a] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/30" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#12121a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white appearance-none cursor-pointer">
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="bg-[#12121a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white appearance-none cursor-pointer">
            <option value="all">All Priority</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        {/* Loading */}
        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20"><Bug className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-500">No bug reports found</p></div>
        )}

        {/* Reports List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(report => {
              const isExpanded = expandedId === report.id;
              const sc = STATUS_CONFIG[report.status];
              const pc = report.priority ? PRIORITY_CONFIG[report.priority] : null;
              const docName = report.doctors ? `Dr. ${report.doctors.first_name} ${report.doctors.last_name}` : 'Unknown';

              return (
                <div key={report.id} className={`bg-[#12121a] rounded-xl border transition-all ${!report.admin_read ? 'border-red-500/30 shadow-lg shadow-red-500/5' : 'border-white/[0.06]'}`}>
                  {/* Header row */}
                  <div
                    className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => { setExpandedId(isExpanded ? null : report.id); if (!report.admin_read) markRead(report.id); }}
                  >
                    {/* Unread dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${!report.admin_read ? 'bg-red-500 animate-pulse' : 'bg-transparent'}`} />

                    {/* Status */}
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${sc.bg} ${sc.text} border ${sc.border}`}>
                      <sc.icon className="w-3 h-3" />{sc.label}
                    </div>

                    {/* Priority */}
                    {pc && <div className={`px-2 py-1 rounded-lg text-xs font-medium ${pc.bg} ${pc.text}`}>{pc.label}</div>}

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{report.description || 'No description'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <User className="w-3 h-3" /> {docName}
                        <Globe className="w-3 h-3 ml-2" /> {report.page_name || report.page_url}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                      {report.recording_url && <Video className="w-4 h-4 text-blue-400" />}
                      {report.markers?.length > 0 && <span className="flex items-center gap-1"><MousePointer2 className="w-3 h-3 text-yellow-400" />{report.markers.length}</span>}
                      <span>{ago(report.created_at)}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-white/[0.06]">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                        {/* Left: Video + transcript */}
                        <div className="space-y-4">
                          {/* Video */}
                          {report.recording_url && (
                            <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black">
                              <video
                                ref={el => { videoRefs.current[report.id] = el; }}
                                src={report.recording_url}
                                className="w-full max-h-[300px] object-contain"
                                controls
                                preload="metadata"
                              />
                              {report.recording_duration_seconds && (
                                <div className="px-3 py-2 bg-[#12121a] text-xs text-gray-500 flex items-center gap-2">
                                  <Video className="w-3 h-3 text-blue-400" />
                                  {Math.floor(report.recording_duration_seconds / 60)}:{(report.recording_duration_seconds % 60).toString().padStart(2, '0')} recording
                                </div>
                              )}
                            </div>
                          )}

                          {/* Transcript */}
                          {report.transcript && (
                            <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                              <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-teal-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">Doctor's Words</span></div>
                              <p className="text-sm text-gray-300 leading-relaxed italic">&ldquo;{report.transcript}&rdquo;</p>
                            </div>
                          )}

                          {/* Description */}
                          <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                            <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">Description</span></div>
                            <p className="text-sm text-gray-300">{report.description}</p>
                          </div>

                          {/* Click markers */}
                          {report.markers?.length > 0 && (
                            <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                              <div className="flex items-center gap-2 mb-2"><MousePointer2 className="w-4 h-4 text-yellow-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">{report.markers.length} Screen Markers</span></div>
                              <div className="space-y-1.5">
                                {report.markers.map((m: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-yellow-400 text-yellow-900 font-bold flex items-center justify-center text-[10px]">{m.number}</span>
                                    <span className="text-gray-400">{m.element_tag}</span>
                                    {m.element_text && <span className="text-gray-500 truncate max-w-[200px]">{m.element_text.slice(0, 40)}</span>}
                                    <span className="text-gray-600 ml-auto">{(m.timestamp_ms / 1000).toFixed(1)}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right: Controls */}
                        <div className="space-y-4">
                          {/* Meta info */}
                          <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Page</span><span className="text-white">{report.page_name || report.page_url}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Browser</span><span className="text-white truncate max-w-[200px]">{report.browser_info || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Submitted</span><span className="text-white">{fmt(report.created_at)}</span></div>
                            {report.confidence_score != null && <div className="flex justify-between"><span className="text-gray-500">Confidence</span><span className="text-white">{report.confidence_score}%</span></div>}
                          </div>

                          {/* Status changer */}
                          <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                            <span className="text-xs text-gray-500 uppercase tracking-wide block mb-3">Status</span>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <button
                                  key={key}
                                  onClick={() => updateStatus(report.id, key)}
                                  disabled={updatingId === report.id}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${report.status === key ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'border-white/[0.06] text-gray-500 hover:border-white/10 hover:text-gray-300'}`}
                                >
                                  <cfg.icon className="w-3.5 h-3.5" />{cfg.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Priority */}
                          <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                            <span className="text-xs text-gray-500 uppercase tracking-wide block mb-3">Priority</span>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                <button
                                  key={key}
                                  onClick={() => updatePriority(report.id, key)}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${report.priority === key ? `${cfg.bg} ${cfg.text} border-${key === 'critical' ? 'red' : key === 'high' ? 'orange' : key === 'medium' ? 'yellow' : 'gray'}-500/30` : 'border-white/[0.06] text-gray-500 hover:text-gray-300'}`}
                                >
                                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />{cfg.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Admin notes */}
                          <div className="bg-[#0a0a12] rounded-xl border border-white/[0.06] p-4">
                            <span className="text-xs text-gray-500 uppercase tracking-wide block mb-3">Admin Notes</span>
                            <textarea
                              value={notes[report.id] ?? report.admin_notes ?? ''}
                              onChange={e => setNotes(p => ({ ...p, [report.id]: e.target.value }))}
                              placeholder="Add notes about this bug..."
                              className="w-full bg-[#12121a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/30 resize-none"
                              rows={3}
                            />
                            <button
                              onClick={() => saveNotes(report.id)}
                              disabled={savingNotes === report.id}
                              className="mt-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {savingNotes === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Save Notes
                            </button>
                          </div>

                          {/* Delete */}
                          <button onClick={() => deleteReport(report.id)} className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Delete Report
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
