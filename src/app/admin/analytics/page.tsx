// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import { useState, useEffect } from 'react'
import { BarChart3, Users, Calendar, DollarSign, TrendingUp, Activity, Clock, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState({ doctors: 0, patients: 0, appointments: 0, revenue: 0, activeToday: 0, avgAppts: 0 })
  const [loading, setLoading] = useState(true)
  const [recentDoctors, setRecentDoctors] = useState<any[]>([])

  useEffect(() => {
    const fetch = async () => {
      const [d, p, a, docs] = await Promise.all([
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        supabase.from('doctors').select('id, first_name, last_name, specialty, is_approved, created_at').order('created_at', { ascending: false }).limit(10),
      ])
      setStats({ doctors: d.count || 0, patients: p.count || 0, appointments: a.count || 0, revenue: 0, activeToday: 0, avgAppts: a.count && d.count ? Math.round(((a.count || 0) / (d.count || 1)) * 10) / 10 : 0 })
      setRecentDoctors(docs.data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const cards = [
    { label: 'Total Doctors', value: stats.doctors, icon: Users, color: 'text-teal-400', bg: 'bg-teal-600/20' },
    { label: 'Total Patients', value: stats.patients, icon: Users, color: 'text-blue-400', bg: 'bg-blue-600/20' },
    { label: 'Appointments', value: stats.appointments, icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-600/20' },
    { label: 'Avg Appts/Doctor', value: stats.avgAppts, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-600/20' },
  ]

  return (
    <div className="p-6 text-white">
      <div className="flex items-center gap-3 mb-6"><BarChart3 className="w-6 h-6 text-teal-400" /><h1 className="text-xl font-bold">Analytics</h1></div>
      {loading ? <div className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div> : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {cards.map(c => <div key={c.label} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5"><div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}><c.icon className={`w-5 h-5 ${c.color}`} /></div><div className="text-2xl font-bold">{c.value}</div><div className="text-xs text-gray-500">{c.label}</div></div>)}
          </div>
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5">
            <h2 className="text-sm font-bold mb-3">Recent Doctor Registrations</h2>
            <div className="space-y-2">{recentDoctors.map(d => (
              <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-[#061818] rounded-lg">
                <div><div className="text-sm font-medium">Dr. {d.first_name} {d.last_name}</div><div className="text-[10px] text-gray-500">{d.specialty || 'General'}</div></div>
                <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>{d.is_approved ? 'Approved' : 'Pending'}</span><span className="text-[10px] text-gray-600">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</span></div>
              </div>
            ))}</div>
          </div>
        </>
      )}
    </div>
  )
}
