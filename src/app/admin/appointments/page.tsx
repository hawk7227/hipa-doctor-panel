// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import { useState, useEffect } from 'react'
import { Calendar, Clock, Search, Filter, RefreshCw, User, Video, Phone, CheckCircle, XCircle, AlertCircle, Zap, Pill, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-500/20 text-amber-400', confirmed: 'bg-green-500/20 text-green-400', completed: 'bg-blue-500/20 text-blue-400', cancelled: 'bg-red-500/20 text-red-400', no_show: 'bg-gray-500/20 text-gray-400' }

export default function AdminAppointmentsPage() {
  const [appts, setAppts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('appointments').select('*, patients(first_name, last_name, email, phone), doctors(first_name, last_name, specialty)').order('requested_date_time', { ascending: false }).limit(200)
      setAppts((data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients, doctors: Array.isArray(a.doctors) ? a.doctors[0] : a.doctors })))
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = appts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (a.patients?.first_name + ' ' + a.patients?.last_name).toLowerCase().includes(s) || (a.doctors?.first_name + ' ' + a.doctors?.last_name).toLowerCase().includes(s)
    }
    return true
  })

  const stats = { total: appts.length, pending: appts.filter(a => a.status === 'pending').length, today: appts.filter(a => a.requested_date_time && new Date(a.requested_date_time).toDateString() === new Date().toDateString()).length }

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Calendar className="w-6 h-6 text-teal-400" /><h1 className="text-xl font-bold">All Appointments</h1></div>
        <button onClick={() => window.location.reload()} className="p-2 hover:bg-[#1a3d3d] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-gray-500">Total Appointments</div></div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4"><div className="text-2xl font-bold text-amber-400">{stats.pending}</div><div className="text-xs text-gray-500">Pending</div></div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4"><div className="text-2xl font-bold text-teal-400">{stats.today}</div><div className="text-xs text-gray-500">Today</div></div>
      </div>
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or doctor..." className="w-full pl-10 pr-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-sm text-white" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-sm text-white">
          <option value="all">All Status</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading ? <div className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div> : (
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#1a3d3d] text-gray-500 text-xs"><th className="px-4 py-3 text-left">Patient</th><th className="px-4 py-3 text-left">Doctor</th><th className="px-4 py-3 text-left">Date/Time</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Status</th></tr></thead>
            <tbody>{filtered.map(a => (
              <tr key={a.id} className="border-b border-[#1a3d3d]/30 hover:bg-[#0c2828]">
                <td className="px-4 py-3"><div className="font-medium">{a.patients?.first_name} {a.patients?.last_name}</div><div className="text-[10px] text-gray-500">{a.patients?.phone}</div></td>
                <td className="px-4 py-3 text-gray-400">Dr. {a.doctors?.first_name} {a.doctors?.last_name}</td>
                <td className="px-4 py-3 text-gray-400">{a.requested_date_time ? new Date(a.requested_date_time).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">{
                  a.visit_type === 'video' ? <span title="Video Visit"><Video className="w-4 h-4 text-blue-400" /></span>
                  : a.visit_type === 'phone' ? <span title="Phone Visit"><Phone className="w-4 h-4 text-green-400" /></span>
                  : a.visit_type === 'instant' ? <span title="Instant Visit (Async)"><Zap className="w-4 h-4 text-yellow-400" /></span>
                  : a.visit_type === 'refill' ? <span title="Rx Refill (Async)"><Pill className="w-4 h-4 text-purple-400" /></span>
                  : <span title="Async Consultation"><MessageSquare className="w-4 h-4 text-orange-400" /></span>
                }</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${STATUS_COLORS[a.status] || 'bg-gray-600/20 text-gray-400'}`}>{a.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No appointments found</div>}
        </div>
      )}
    </div>
  )
}
