// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Shield, Search, RefreshCw, Filter, ChevronDown,
  Eye, Edit3, Lock, FileText, Users, AlertTriangle,
  Download, Calendar, MessageSquare, Pill
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface AuditLog {
  id: string
  actor_id: string
  actor_email: string | null
  actor_role: string
  action: string
  resource_type: string
  resource_id: string | null
  description: string | null
  metadata: Record<string, any>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

type FilterAction = 'all' | 'view' | 'update' | 'create' | 'delete' | 'auth' | 'export'

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const ACTION_CATEGORIES: Record<FilterAction, { label: string; actions: string[] }> = {
  all: { label: 'All Actions', actions: [] },
  view: { label: 'Views / Access', actions: ['VIEW_PATIENT', 'VIEW_APPOINTMENT', 'VIEW_CHART', 'VIEW_CLINICAL_NOTE', 'VIEW_PRESCRIPTIONS', 'VIEW_MESSAGES', 'VIEW_DOCUMENT', 'SEARCH_PATIENTS'] },
  update: { label: 'Updates', actions: ['UPDATE_PATIENT', 'UPDATE_APPOINTMENT', 'UPDATE_CHART', 'UPDATE_CLINICAL_NOTE', 'SIGN_CHART', 'LOCK_CHART', 'AMEND_CHART', 'COMPLETE_APPOINTMENT', 'SETTINGS_CHANGE'] },
  create: { label: 'Creations', actions: ['CREATE_PATIENT', 'CREATE_APPOINTMENT', 'CREATE_PRESCRIPTION', 'SEND_MESSAGE', 'UPLOAD_DOCUMENT', 'ADD_STAFF'] },
  delete: { label: 'Deletions', actions: ['CANCEL_APPOINTMENT', 'REMOVE_STAFF'] },
  auth: { label: 'Auth Events', actions: ['LOGIN', 'LOGOUT', 'SESSION_REFRESH'] },
  export: { label: 'Exports', actions: ['EXPORT_PDF'] },
}

function getActionIcon(action: string) {
  if (action.startsWith('VIEW')) return Eye
  if (action.includes('CHART') || action.includes('CLINICAL')) return FileText
  if (action.includes('APPOINTMENT') || action.includes('CALENDAR')) return Calendar
  if (action.includes('PATIENT')) return Users
  if (action.includes('MESSAGE')) return MessageSquare
  if (action.includes('PRESCRIPTION')) return Pill
  if (action.includes('LOCK') || action.includes('SIGN')) return Lock
  if (action.includes('EXPORT')) return Download
  if (action.includes('STAFF')) return Users
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return Shield
  if (action.includes('ERROR')) return AlertTriangle
  return Edit3
}

function getActionColor(action: string): string {
  if (action.startsWith('VIEW') || action === 'SEARCH_PATIENTS') return 'text-blue-400'
  if (action.includes('SIGN') || action.includes('LOCK') || action.includes('COMPLETE')) return 'text-green-400'
  if (action.includes('CREATE') || action.includes('ADD') || action.includes('SEND') || action.includes('UPLOAD')) return 'text-teal-400'
  if (action.includes('UPDATE') || action.includes('AMEND') || action.includes('SETTINGS')) return 'text-amber-400'
  if (action.includes('CANCEL') || action.includes('REMOVE') || action.includes('DELETE')) return 'text-red-400'
  if (action.includes('EXPORT')) return 'text-purple-400'
  if (action.includes('ERROR')) return 'text-red-400'
  if (action.includes('LOGIN')) return 'text-green-400'
  if (action.includes('LOGOUT')) return 'text-gray-400'
  return 'text-gray-400'
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AuditLogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filterAction, setFilterAction] = useState<FilterAction>('all')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('7d')
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const fetchLogs = useCallback(async (pageNum: number = 0) => {
    try {
      const authUser = await getCurrentUser()
      if (!authUser?.doctor) { router.push('/login'); return }

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('actor_id', authUser.id)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

      // Date range filter
      if (dateRange !== 'all') {
        const now = new Date()
        let from: Date
        if (dateRange === 'today') { from = new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
        else if (dateRange === '7d') { from = new Date(now.getTime() - 7 * 86400000) }
        else if (dateRange === '30d') { from = new Date(now.getTime() - 30 * 86400000) }
        else { from = new Date(now.getTime() - 90 * 86400000) }
        query = query.gte('created_at', from.toISOString())
      }

      // Action filter
      if (filterAction !== 'all') {
        const actions = ACTION_CATEGORIES[filterAction].actions
        if (actions.length > 0) {
          query = query.in('action', actions)
        }
      }

      // Search
      if (search.trim()) {
        query = query.or(`description.ilike.%${search}%,action.ilike.%${search}%,resource_id.eq.${search}`)
      }

      const { data, count, error } = await query
      if (error) {
        console.error('Audit fetch error:', error)
        // Table might not exist yet — show empty
        setLogs([])
        setTotal(0)
      } else {
        setLogs((data || []) as AuditLog[])
        setTotal(count || 0)
      }
    } catch (err) {
      console.error('Audit init error:', err)
      setLogs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router, dateRange, filterAction, search, PAGE_SIZE])

  useEffect(() => { fetchLogs(page) }, [fetchLogs, page])

  const handleRefresh = () => { setRefreshing(true); fetchLogs(page) }

  const handleExportCSV = useCallback(() => {
    if (logs.length === 0) return
    const headers = ['Timestamp', 'Action', 'Resource Type', 'Resource ID', 'Description', 'Actor Email', 'Actor Role']
    const rows = logs.map(l => [
      l.created_at, l.action, l.resource_type, l.resource_id || '', l.description || '', l.actor_email || '', l.actor_role
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [logs])

  if (loading) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
      </div>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Audit Log</h1>
              <p className="text-xs text-gray-400">HIPAA-compliant activity trail — all PHI access is recorded</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleExportCSV} disabled={logs.length === 0} className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-purple-500/50 text-gray-300 hover:text-purple-400 transition-colors text-xs font-medium disabled:opacity-40">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export CSV</span>
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search description, action, or resource ID..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-0.5">
            {(['today', '7d', '30d', '90d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => { setDateRange(range); setPage(0) }}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                  dateRange === range ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          {/* Action category */}
          <div className="flex items-center bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-0.5 overflow-x-auto">
            {(Object.keys(ACTION_CATEGORIES) as FilterAction[]).map(cat => (
              <button
                key={cat}
                onClick={() => { setFilterAction(cat); setPage(0) }}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${
                  filterAction === cat ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {ACTION_CATEGORIES[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{total} event{total !== 1 ? 's' : ''} found</span>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded bg-[#0d2626] border border-[#1a3d3d] text-gray-400 disabled:opacity-30">Prev</button>
              <span className="text-gray-400">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded bg-[#0d2626] border border-[#1a3d3d] text-gray-400 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>

        {/* Log entries */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No audit events found</p>
              <p className="text-xs text-gray-500 mt-1">
                {total === 0 ? 'Activity will appear here as you use the platform.' : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a3d3d]/50 max-h-[60vh] overflow-y-auto">
              {logs.map(log => {
                const Icon = getActionIcon(log.action)
                const color = getActionColor(log.action)
                const expanded = expandedId === log.id

                return (
                  <div key={log.id} className="hover:bg-white/[0.01] transition-colors">
                    <div
                      className="flex items-center space-x-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color} bg-white/5`}>
                            {log.action}
                          </span>
                          <span className="text-[10px] text-gray-500">{log.resource_type}</span>
                          {log.resource_id && <span className="text-[10px] text-gray-600 font-mono truncate max-w-[80px]">{log.resource_id.slice(0, 8)}...</span>}
                        </div>
                        {log.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{log.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-gray-500">{formatTimestamp(log.created_at)}</p>
                        <p className="text-[9px] text-gray-600">{log.actor_role}</p>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="px-4 pb-3 ml-11 space-y-2 text-[11px]">
                        <div className="grid grid-cols-2 gap-2 bg-[#0a1f1f] rounded-lg p-3">
                          <div>
                            <span className="text-gray-500 block">Actor</span>
                            <span className="text-gray-300">{log.actor_email || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Role</span>
                            <span className="text-gray-300 capitalize">{log.actor_role}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Resource</span>
                            <span className="text-gray-300">{log.resource_type} / {log.resource_id || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Timestamp</span>
                            <span className="text-gray-300">{new Date(log.created_at).toISOString()}</span>
                          </div>
                          {log.ip_address && (
                            <div>
                              <span className="text-gray-500 block">IP Address</span>
                              <span className="text-gray-300 font-mono">{log.ip_address}</span>
                            </div>
                          )}
                          {log.user_agent && (
                            <div className="col-span-2">
                              <span className="text-gray-500 block">User Agent</span>
                              <span className="text-gray-300 font-mono text-[9px] break-all">{log.user_agent}</span>
                            </div>
                          )}
                          {Object.keys(log.metadata || {}).length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500 block">Metadata</span>
                              <pre className="text-gray-300 font-mono text-[9px] bg-[#0d2626] rounded p-2 mt-1 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[10px] text-gray-600 text-center">
          Audit logs are immutable and cannot be deleted or modified per HIPAA §164.312(b)
        </div>
      </div>
    </div>
  )
}
