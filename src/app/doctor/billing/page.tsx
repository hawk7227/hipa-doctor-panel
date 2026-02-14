'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  DollarSign, TrendingUp, Calendar, RefreshCw, Search,
  Download, Filter, ChevronRight, CreditCard, Clock,
  CheckCircle, XCircle, Users, BarChart3
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface PaymentRecord {
  id: string
  appointment_id: string
  amount: number
  status: string
  stripe_payment_intent_id: string | null
  created_at: string
  updated_at: string | null
  appointments: {
    id: string
    status: string
    visit_type: string | null
    scheduled_time: string | null
    created_at: string
    patients: {
      first_name: string | null
      last_name: string | null
      email: string | null
    } | null
  } | null
}

type DateRange = 'today' | '7d' | '30d' | '90d' | 'year' | 'all'
type StatusFilter = 'all' | 'captured' | 'authorized' | 'cancelled'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getDateStart(range: DateRange): Date | null {
  const now = new Date()
  if (range === 'all') return null
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === '7d') return new Date(now.getTime() - 7 * 86400000)
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000)
  if (range === '90d') return new Date(now.getTime() - 90 * 86400000)
  return new Date(now.getFullYear(), 0, 1) // year
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function BillingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // ── Fetch ──
  const fetchPayments = useCallback(async (docId: string) => {
    const { data, error } = await supabase
      .from('payment_records')
      .select(`
        id, appointment_id, amount, status,
        stripe_payment_intent_id, created_at, updated_at,
        appointments!payment_records_appointment_id_fkey(
          id, status, visit_type, scheduled_time, created_at,
          patients!appointments_patient_id_fkey(first_name, last_name, email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Billing fetch error:', error)
      setPayments([])
    } else {
      setPayments((data || []) as unknown as PaymentRecord[])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        logAudit({ action: 'VIEW_BILLING' as any, resourceType: 'system' as any, description: 'Viewed billing page' })
        await fetchPayments(authUser.doctor.id)
      } catch (err) {
        console.error('Billing init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, fetchPayments])

  const handleRefresh = async () => {
    if (!doctorId || refreshing) return
    setRefreshing(true)
    await fetchPayments(doctorId)
    setRefreshing(false)
  }

  // ── Computed ──
  const filtered = useMemo(() => {
    let list = payments

    // Date range
    const start = getDateStart(dateRange)
    if (start) {
      list = list.filter(p => new Date(p.created_at) >= start)
    }

    // Status
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => {
        const name = `${p.appointments?.patients?.first_name || ''} ${p.appointments?.patients?.last_name || ''}`.toLowerCase()
        return name.includes(q) || p.id.includes(q) || (p.stripe_payment_intent_id || '').includes(q)
      })
    }

    return list
  }, [payments, dateRange, statusFilter, search])

  const stats = useMemo(() => {
    const captured = filtered.filter(p => p.status === 'captured')
    const totalRevenue = captured.reduce((sum, p) => sum + p.amount, 0)
    const avgPayment = captured.length > 0 ? totalRevenue / captured.length : 0
    const uniquePatients = new Set(
      captured.map(p => `${p.appointments?.patients?.first_name} ${p.appointments?.patients?.last_name}`)
    ).size

    // Visit type breakdown
    const byType: Record<string, { count: number; revenue: number }> = {}
    captured.forEach(p => {
      const type = p.appointments?.visit_type || 'unknown'
      if (!byType[type]) byType[type] = { count: 0, revenue: 0 }
      byType[type].count++
      byType[type].revenue += p.amount
    })

    return {
      totalRevenue,
      totalPayments: captured.length,
      avgPayment,
      uniquePatients,
      pendingCount: filtered.filter(p => p.status === 'authorized').length,
      cancelledCount: filtered.filter(p => p.status === 'cancelled').length,
      byType,
    }
  }, [filtered])

  // ── Export ──
  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ['Date', 'Patient', 'Amount', 'Status', 'Visit Type', 'Payment ID']
    const rows = filtered.map(p => [
      formatDate(p.created_at),
      `${p.appointments?.patients?.first_name || ''} ${p.appointments?.patients?.last_name || ''}`.trim(),
      (p.amount / 100).toFixed(2),
      p.status,
      p.appointments?.visit_type || '',
      p.stripe_payment_intent_id || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billing-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    logAudit({ action: 'EXPORT_PDF' as any, resourceType: 'system' as any, description: `Exported billing CSV (${filtered.length} records)` })
  }

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
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Billing & Revenue</h1>
              <p className="text-xs text-gray-400">Payment history, revenue analytics, exports</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleExport} disabled={filtered.length === 0} className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-green-500/50 text-gray-300 hover:text-green-400 transition-colors text-xs font-medium disabled:opacity-40">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export CSV</span>
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-green-400">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{stats.totalPayments} payment{stats.totalPayments !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-teal-400">Average</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.avgPayment)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">per visit</p>
          </div>

          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-blue-400">Patients</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.uniquePatients}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">unique paying</p>
          </div>

          <div className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.pendingCount}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">authorized, not captured</p>
          </div>
        </div>

        {/* Visit Type Breakdown */}
        {Object.keys(stats.byType).length > 0 && (
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4">
            <div className="flex items-center space-x-2 mb-3">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">Revenue by Visit Type</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.byType).sort((a, b) => b[1].revenue - a[1].revenue).map(([type, data]) => {
                const pct = stats.totalRevenue > 0 ? Math.round((data.revenue / stats.totalRevenue) * 100) : 0
                return (
                  <div key={type} className="flex items-center space-x-3 bg-[#0a1f1f] rounded-lg px-3 py-2 border border-[#1a3d3d]">
                    <div>
                      <p className="text-xs font-bold text-white capitalize">{type}</p>
                      <p className="text-[10px] text-gray-500">{data.count} visits</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-green-400">{formatCurrency(data.revenue)}</p>
                      <p className="text-[10px] text-gray-500">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or payment ID..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="flex items-center bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-0.5">
            {(['today', '7d', '30d', '90d', 'year', 'all'] as DateRange[]).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                  dateRange === range ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'year' ? 'YTD' : range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-0.5">
            {(['all', 'captured', 'authorized', 'cancelled'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors capitalize ${
                  statusFilter === s ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-[#1a3d3d] bg-[#0a1f1f]/50 text-[10px] uppercase tracking-widest font-bold text-gray-500">
            <div className="col-span-3">Patient</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Visit Type</div>
            <div className="col-span-1"></div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No payments found</p>
              <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a3d3d]/50 max-h-[50vh] overflow-y-auto">
              {filtered.map(payment => {
                const patientName = `${payment.appointments?.patients?.first_name || ''} ${payment.appointments?.patients?.last_name || ''}`.trim() || 'Unknown'
                const statusColors: Record<string, string> = {
                  captured: 'bg-green-500/15 text-green-400',
                  authorized: 'bg-amber-500/15 text-amber-400',
                  cancelled: 'bg-red-500/15 text-red-400',
                }
                const statusIcons: Record<string, typeof CheckCircle> = {
                  captured: CheckCircle,
                  authorized: Clock,
                  cancelled: XCircle,
                }
                const StatusIcon = statusIcons[payment.status] || CreditCard
                const statusColor = statusColors[payment.status] || 'bg-gray-500/15 text-gray-400'

                return (
                  <div key={payment.id}>
                    {/* Desktop */}
                    <div
                      className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => payment.appointments?.id && router.push(`/doctor/appointments?apt=${payment.appointments.id}`)}
                    >
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{patientName}</p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{payment.stripe_payment_intent_id?.slice(-8) || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-300">{formatDate(payment.created_at)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-bold text-green-400">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{payment.status}</span>
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400 capitalize">{payment.appointments?.visit_type || '—'}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-500 inline-block" />
                      </div>
                    </div>

                    {/* Mobile */}
                    <div
                      className="md:hidden px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => payment.appointments?.id && router.push(`/doctor/appointments?apt=${payment.appointments.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white truncate flex-1">{patientName}</p>
                        <p className="text-sm font-bold text-green-400 ml-2">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                        <span>{formatDate(payment.created_at)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${statusColor}`}>{payment.status}</span>
                        <span className="capitalize">{payment.appointments?.visit_type || '—'}</span>
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
          <span>Showing {filtered.length} of {payments.length} payments</span>
          <span>Revenue: {formatCurrency(stats.totalRevenue)}</span>
        </div>
      </div>
    </div>
  )
}
