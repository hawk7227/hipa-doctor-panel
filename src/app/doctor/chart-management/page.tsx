'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { CHART_STATUS_CONFIG } from '@/lib/constants'
import type { ChartStatus } from '@/lib/constants'
import {
  Shield, FileText, Clock, AlertTriangle, CheckCircle, Lock,
  RefreshCw, Search, ChevronRight, Edit3, Filter
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ChartRecord {
  id: string
  patient_id: string
  doctor_id: string
  status: string
  visit_type: string
  chart_status: string | null
  chart_locked: boolean | null
  scheduled_time: string | null
  created_at: string
  updated_at: string | null
  patients: {
    first_name: string
    last_name: string
    email: string
  } | null
  clinical_notes: {
    id: string
    note_type: string
    content: any
    created_at: string
    updated_at: string | null
  }[] | null
}

type ChartFilter = 'all' | 'draft' | 'preliminary' | 'signed' | 'closed' | 'amended' | 'overdue' | 'unsigned'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function deriveChartStatus(record: ChartRecord): ChartStatus {
  if (record.chart_status) {
    const s = record.chart_status as ChartStatus
    if (['draft', 'preliminary', 'signed', 'closed', 'amended'].includes(s)) return s
  }
  if (record.chart_locked) return 'closed'
  if (record.status === 'completed') return 'signed'
  return 'draft'
}

function isOverdue(record: ChartRecord): boolean {
  if (record.chart_locked) return false
  if (record.status !== 'completed') return false
  const cs = deriveChartStatus(record)
  if (cs === 'closed' || cs === 'amended') return false
  const completedAt = record.updated_at || record.scheduled_time || record.created_at
  const hoursAgo = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60)
  return hoursAgo > 24
}

function formatTimeAgo(dateStr: string): string {
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ChartManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<ChartRecord[]>([])
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ChartFilter>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // ── Auth + Fetch ──
  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)

        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id, patient_id, doctor_id, status, visit_type,
            chart_status, chart_locked, scheduled_time,
            created_at, updated_at,
            patients!appointments_patient_id_fkey(first_name, last_name, email),
            clinical_notes(id, note_type, content, created_at, updated_at)
          `)
          .eq('doctor_id', authUser.doctor.id)
          .neq('status', 'cancelled')
          .order('scheduled_time', { ascending: false })
          .limit(200)

        if (error) {
          console.error('Chart management fetch error:', error)
        } else {
          setRecords((data || []) as unknown as ChartRecord[])
        }
      } catch (err) {
        console.error('Chart management init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const handleRefresh = useCallback(async () => {
    if (!doctorId || refreshing) return
    setRefreshing(true)
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, doctor_id, status, visit_type,
        chart_status, chart_locked, scheduled_time,
        created_at, updated_at,
        patients!appointments_patient_id_fkey(first_name, last_name, email),
        clinical_notes(id, note_type, content, created_at, updated_at)
      `)
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .order('scheduled_time', { ascending: false })
      .limit(200)
    if (data) setRecords(data as unknown as ChartRecord[])
    setRefreshing(false)
  }, [doctorId, refreshing])

  // ── Computed ──
  const counts = useMemo(() => {
    const c = { draft: 0, preliminary: 0, signed: 0, closed: 0, amended: 0, overdue: 0, unsigned: 0 }
    records.forEach(r => {
      const cs = deriveChartStatus(r)
      c[cs]++
      if (isOverdue(r)) c.overdue++
      if (cs === 'draft' || cs === 'preliminary') c.unsigned++
    })
    return c
  }, [records])

  const filtered = useMemo(() => {
    let list = records
    if (filter === 'overdue') list = list.filter(isOverdue)
    else if (filter === 'unsigned') list = list.filter(r => { const cs = deriveChartStatus(r); return cs === 'draft' || cs === 'preliminary' })
    else if (filter !== 'all') list = list.filter(r => deriveChartStatus(r) === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => `${r.patients?.first_name || ''} ${r.patients?.last_name || ''}`.toLowerCase().includes(q))
    }
    return list
  }, [records, filter, search])

  if (loading) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Chart Management</h1>
              <p className="text-xs text-gray-400">Chart lifecycle, cosign queue, timeliness compliance</p>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {([
            { key: 'draft' as ChartFilter, label: 'Draft', icon: FileText, color: 'text-gray-400', count: counts.draft },
            { key: 'preliminary' as ChartFilter, label: 'Preliminary', icon: Clock, color: 'text-amber-400', count: counts.preliminary },
            { key: 'signed' as ChartFilter, label: 'Signed', icon: CheckCircle, color: 'text-green-400', count: counts.signed },
            { key: 'closed' as ChartFilter, label: 'Closed', icon: Lock, color: 'text-blue-400', count: counts.closed },
            { key: 'amended' as ChartFilter, label: 'Amended', icon: Edit3, color: 'text-purple-400', count: counts.amended },
          ]).map(({ key, label, icon: Icon, color, count }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`bg-[#0d2626] rounded-lg p-4 border transition-all text-left ${
                filter === key ? 'border-teal-500/50 ring-1 ring-teal-500/20' : 'border-[#1a3d3d] hover:border-[#2a5d5d]'
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`text-[10px] uppercase tracking-widest font-bold ${color}`}>{label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </button>
          ))}
        </div>

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
            className={`bg-[#0d2626] rounded-lg p-4 border transition-all flex items-center justify-between ${
              filter === 'overdue' ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-[#1a3d3d] hover:border-red-500/30'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-red-500/15 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Overdue Charts</p>
                <p className="text-[10px] text-gray-500">Unsigned &gt; 24 hours after completion</p>
              </div>
            </div>
            <span className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {counts.overdue > 0 ? counts.overdue : '✓'}
            </span>
          </button>

          <button
            onClick={() => setFilter(filter === 'unsigned' ? 'all' : 'unsigned')}
            className={`bg-[#0d2626] rounded-lg p-4 border transition-all flex items-center justify-between ${
              filter === 'unsigned' ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-[#1a3d3d] hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Unsigned Notes</p>
                <p className="text-[10px] text-gray-500">Draft + Preliminary needing attention</p>
              </div>
            </div>
            <span className={`text-2xl font-bold ${counts.unsigned > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {counts.unsigned > 0 ? counts.unsigned : '✓'}
            </span>
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400 font-medium">
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </span>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold ml-1">Clear</button>
            )}
          </div>
        </div>

        {/* Chart Records Table */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-[#1a3d3d] bg-[#0a1f1f]/50 text-[10px] uppercase tracking-widest font-bold text-gray-500">
            <div className="col-span-3">Patient</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Visit Type</div>
            <div className="col-span-2">Chart Status</div>
            <div className="col-span-2">Notes</div>
            <div className="col-span-1"></div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{filter === 'all' ? 'No charts found' : `No ${filter} charts`}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a3d3d]/50 max-h-[50vh] overflow-y-auto">
              {filtered.map(record => {
                const cs = deriveChartStatus(record)
                const config = CHART_STATUS_CONFIG[cs]
                const overdue = isOverdue(record)
                const noteCount = record.clinical_notes?.length || 0
                const patientName = `${record.patients?.first_name || ''} ${record.patients?.last_name || ''}`.trim() || 'Unknown'
                const dateStr = record.scheduled_time
                  ? new Date(record.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'
                const timeAgo = record.updated_at ? formatTimeAgo(record.updated_at) : record.scheduled_time ? formatTimeAgo(record.scheduled_time) : ''

                return (
                  <div
                    key={record.id}
                    onClick={() => router.push(`/doctor/appointments?apt=${record.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.02] ${overdue ? 'bg-red-500/[0.03]' : ''}`}
                    style={{ borderLeft: `3px solid ${config.color}` }}
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{patientName}</p>
                        {overdue && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-bold">OVERDUE</span>}
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-300">{dateStr}</p>
                        <p className="text-[10px] text-gray-500">{timeAgo}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400 capitalize">{record.visit_type || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                          {config.icon} {cs}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400">{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-500 inline-block" />
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white truncate flex-1">{patientName}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ml-2" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                          {config.icon} {cs}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-400">
                        <span>{dateStr}</span>
                        <span className="capitalize">{record.visit_type || '—'}</span>
                        <span>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                        {overdue && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-bold">OVERDUE</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
          <span>Showing {filtered.length} of {records.length} charts</span>
          <span>Last refreshed: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}
