'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, UserPlus, UserCheck, UserX, Calendar, MessageSquare,
  Bell, Bug, Shield, Search, RefreshCw, ChevronDown, ChevronRight, Clock,
  CheckCircle, XCircle, AlertTriangle, Mail, Phone, ExternalLink, Eye,
  BarChart3, TrendingUp, Activity, FileText, Filter, User
} from 'lucide-react'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type TabType = 'overview' | 'inquiries' | 'applications' | 'doctors' | 'appointments' | 'activity' | 'bug_reports'

interface Inquiry {
  id: string; full_name: string; email: string; phone: string; practice_name: string | null;
  practice_size: string | null; interest_type: string; message: string | null;
  reference_number: string; status: string; admin_notes: string | null; created_at: string;
}

interface Doctor {
  id: string; first_name: string; last_name: string; email: string; phone: string;
  specialty: string | null; license_number: string | null; npi_number: string | null;
  is_approved: boolean; created_at: string; auth_user_id: string | null;
  experience_years: number | null; consultation_fee: number | null; bio: string | null;
}

interface AppointmentSummary {
  id: string; status: string; service_type: string; visit_type: string;
  requested_date_time: string | null; created_at: string;
  doctors: { first_name: string; last_name: string } | null;
}

interface BugReport {
  id: string; title: string; description: string; priority: string; status: string;
  reporter_name: string; reporter_email: string; category: string; created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([])
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null)
  const [doctorFilter, setDoctorFilter] = useState<'all' | 'pending' | 'approved'>('all')

  const db = useMemo(() => getSupabase(), [])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Fetch inquiries
      const { data: inqData } = await db.from('inquiries').select('*').order('created_at', { ascending: false })
      if (inqData) setInquiries(inqData)

      // Fetch doctors
      const { data: docData } = await db.from('doctors').select('*').order('created_at', { ascending: false })
      if (docData) setDoctors(docData)

      // Fetch recent appointments
      const { data: aptData } = await db.from('appointments')
        .select('id, status, service_type, visit_type, requested_date_time, created_at, doctors!appointments_doctor_id_fkey(first_name, last_name)')
        .order('created_at', { ascending: false }).limit(50)
      if (aptData) setAppointments(aptData as any)

      // Fetch bug reports
      const { data: bugData } = await db.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(50)
      if (bugData) setBugReports(bugData)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [db])

  useEffect(() => { fetchData() }, [fetchData])

  // Stats
  const stats = useMemo(() => ({
    totalDoctors: doctors.length,
    approvedDoctors: doctors.filter(d => d.is_approved).length,
    pendingDoctors: doctors.filter(d => !d.is_approved).length,
    newInquiries: inquiries.filter(i => i.status === 'new').length,
    totalAppointments: appointments.length,
    pendingAppointments: appointments.filter(a => a.status === 'pending').length,
    completedAppointments: appointments.filter(a => a.status === 'completed').length,
    openBugs: bugReports.filter(b => b.status !== 'resolved' && b.status !== 'closed').length,
  }), [doctors, inquiries, appointments, bugReports])

  // Doctor actions
  const handleApprove = async (doctorId: string) => {
    await db.from('doctors').update({ is_approved: true, approved_at: new Date().toISOString() }).eq('id', doctorId)
    // Notify doctor
    try {
      await fetch('/api/admin/notify-doctor-application', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, action: 'approved' })
      })
    } catch { /* ok */ }
    fetchData()
  }

  const handleReject = async (doctorId: string) => {
    const reason = prompt('Rejection reason:')
    if (!reason) return
    await db.from('doctors').update({ is_approved: false, rejection_reason: reason }).eq('id', doctorId)
    fetchData()
  }

  const updateInquiryStatus = async (id: string, status: string) => {
    await db.from('inquiries').update({ status, admin_notes: adminNotes || null }).eq('id', id)
    setSelectedInquiry(null); setAdminNotes('')
    fetchData()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const filteredDoctors = useMemo(() => {
    let items = doctors
    if (doctorFilter === 'pending') items = items.filter(d => !d.is_approved)
    if (doctorFilter === 'approved') items = items.filter(d => d.is_approved)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
    }
    return items
  }, [doctors, doctorFilter, search])

  // ═══════════════════════════════════════════════════════════════
  // TABS CONFIG
  // ═══════════════════════════════════════════════════════════════

  const tabs: { key: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'inquiries', label: 'Inquiries', icon: Mail, badge: stats.newInquiries },
    { key: 'applications', label: 'Applications', icon: UserPlus, badge: stats.pendingDoctors },
    { key: 'doctors', label: 'Doctors', icon: UserCheck },
    { key: 'appointments', label: 'Appointments', icon: Calendar },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'bug_reports', label: 'Bug Reports', icon: Bug, badge: stats.openBugs },
  ]

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3d3d] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-teal-400" />Master Admin Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Full platform access · Approvals · Analytics · Bug Reports</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg hover:bg-[#0d2a2a] text-gray-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.key ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
                {t.badge ? <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500 text-white ml-1">{t.badge}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}

      <div className="p-6">
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Doctors', value: stats.totalDoctors, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Pending Approvals', value: stats.pendingDoctors, icon: UserPlus, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'New Inquiries', value: stats.newInquiries, icon: Mail, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
                { label: 'Total Appointments', value: stats.totalAppointments, icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                { label: 'Approved Doctors', value: stats.approvedDoctors, icon: UserCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                { label: 'Pending Appts', value: stats.pendingAppointments, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                { label: 'Completed Appts', value: stats.completedAppointments, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Open Bugs', value: stats.openBugs, icon: Bug, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className={`rounded-lg border p-4 ${s.bg}`}>
                    <div className="flex items-center justify-between">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                      <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{s.label}</div>
                  </div>
                )
              })}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent Appointments */}
              <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400" />Recent Appointments</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {appointments.slice(0, 8).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[#0d2626] last:border-0">
                      <div>
                        <span className="text-xs text-white">{a.service_type?.replace(/_/g, ' ') || 'Consultation'}</span>
                        {a.doctors && <span className="text-[10px] text-gray-500 ml-2">Dr. {a.doctors.first_name} {a.doctors.last_name}</span>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        a.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        a.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                        a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Applications */}
              <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4 text-amber-400" />Pending Applications</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {doctors.filter(d => !d.is_approved).slice(0, 8).map(d => (
                    <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-[#0d2626] last:border-0">
                      <div>
                        <span className="text-xs text-white">Dr. {d.first_name} {d.last_name}</span>
                        <span className="text-[10px] text-gray-500 ml-2">{d.specialty || 'General'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleApprove(d.id)} className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">Approve</button>
                        <button onClick={() => handleReject(d.id)} className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Reject</button>
                      </div>
                    </div>
                  ))}
                  {doctors.filter(d => !d.is_approved).length === 0 && <p className="text-xs text-gray-600">No pending applications</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ INQUIRIES TAB ═══ */}
        {activeTab === 'inquiries' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inquiries..."
                  className="w-full pl-10 pr-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Inquiry List */}
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {inquiries.filter(i => !search || i.full_name.toLowerCase().includes(search.toLowerCase()) || i.email.toLowerCase().includes(search.toLowerCase())).map(inq => (
                  <div key={inq.id} onClick={() => { setSelectedInquiry(inq); setAdminNotes(inq.admin_notes || '') }}
                    className={`bg-[#0a1f1f] border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedInquiry?.id === inq.id ? 'border-teal-500/40 bg-teal-500/5' : 'border-[#1a3d3d] hover:bg-[#0d2a2a]'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{inq.full_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        inq.status === 'new' ? 'bg-teal-500/20 text-teal-400' :
                        inq.status === 'contacted' ? 'bg-blue-500/20 text-blue-400' :
                        inq.status === 'converted' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{inq.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{inq.email} · {inq.interest_type} · {formatDate(inq.created_at)}</div>
                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">#{inq.reference_number}</div>
                  </div>
                ))}
              </div>

              {/* Inquiry Detail */}
              {selectedInquiry && (
                <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-5 space-y-4 sticky top-0">
                  <h3 className="text-lg font-bold text-white">{selectedInquiry.full_name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Email</span><p className="text-white">{selectedInquiry.email}</p></div>
                    <div><span className="text-gray-500">Phone</span><p className="text-white">{selectedInquiry.phone}</p></div>
                    <div><span className="text-gray-500">Interest</span><p className="text-white capitalize">{selectedInquiry.interest_type}</p></div>
                    <div><span className="text-gray-500">Ref #</span><p className="text-white font-mono">{selectedInquiry.reference_number}</p></div>
                    {selectedInquiry.practice_name && <div><span className="text-gray-500">Practice</span><p className="text-white">{selectedInquiry.practice_name}</p></div>}
                    {selectedInquiry.practice_size && <div><span className="text-gray-500">Size</span><p className="text-white">{selectedInquiry.practice_size}</p></div>}
                  </div>
                  {selectedInquiry.message && (
                    <div><span className="text-xs text-gray-500">Message</span><p className="text-sm text-gray-300 mt-1 bg-[#0d2626] rounded p-3">{selectedInquiry.message}</p></div>
                  )}
                  <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Admin notes..."
                    rows={3} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => updateInquiryStatus(selectedInquiry.id, 'contacted')}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500">Mark Contacted</button>
                    <button onClick={() => updateInquiryStatus(selectedInquiry.id, 'converted')}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500">Mark Converted</button>
                    <button onClick={() => updateInquiryStatus(selectedInquiry.id, 'dismissed')}
                      className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-500">Dismiss</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ APPLICATIONS TAB ═══ */}
        {activeTab === 'applications' && (
          <div className="space-y-3">
            {doctors.filter(d => !d.is_approved).map(doctor => (
              <div key={doctor.id} className="bg-[#0a1f1f] border border-amber-500/20 rounded-lg overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">Dr. {doctor.first_name} {doctor.last_name}</span>
                        <div className="text-xs text-gray-500">{doctor.specialty || 'General'} · {doctor.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); handleApprove(doctor.id) }}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500">Approve</button>
                      <button onClick={e => { e.stopPropagation(); handleReject(doctor.id) }}
                        className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-500">Reject</button>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expandedDoctor === doctor.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                {expandedDoctor === doctor.id && (
                  <div className="border-t border-[#1a3d3d] p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">Phone</span><p className="text-white">{doctor.phone}</p></div>
                    <div><span className="text-gray-500">License</span><p className="text-white font-mono">{doctor.license_number || 'N/A'}</p></div>
                    <div><span className="text-gray-500">NPI</span><p className="text-white font-mono">{doctor.npi_number || 'N/A'}</p></div>
                    <div><span className="text-gray-500">Experience</span><p className="text-white">{doctor.experience_years || 'N/A'} years</p></div>
                    <div><span className="text-gray-500">Fee</span><p className="text-white">{doctor.consultation_fee ? `$${(doctor.consultation_fee / 100).toFixed(2)}` : 'N/A'}</p></div>
                    <div><span className="text-gray-500">Applied</span><p className="text-white">{formatDate(doctor.created_at)}</p></div>
                    {doctor.bio && <div className="col-span-full"><span className="text-gray-500">Bio</span><p className="text-gray-300 mt-1">{doctor.bio}</p></div>}
                  </div>
                )}
              </div>
            ))}
            {doctors.filter(d => !d.is_approved).length === 0 && (
              <div className="text-center py-12"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" /><p className="text-gray-500">No pending applications</p></div>
            )}
          </div>
        )}

        {/* ═══ DOCTORS TAB ═══ */}
        {activeTab === 'doctors' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors..."
                  className="w-full pl-10 pr-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm" />
              </div>
              <div className="flex gap-1">
                {(['all', 'pending', 'approved'] as const).map(f => (
                  <button key={f} onClick={() => setDoctorFilter(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg ${doctorFilter === f ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {filteredDoctors.map(doctor => (
              <div key={doctor.id} className={`bg-[#0a1f1f] border rounded-lg p-4 flex items-center justify-between ${doctor.is_approved ? 'border-[#1a3d3d]' : 'border-amber-500/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${doctor.is_approved ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div>
                    <span className="text-sm font-semibold text-white">Dr. {doctor.first_name} {doctor.last_name}</span>
                    <div className="text-xs text-gray-500">{doctor.specialty || 'General'} · {doctor.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${doctor.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {doctor.is_approved ? 'APPROVED' : 'PENDING'}
                  </span>
                  {!doctor.is_approved && <button onClick={() => handleApprove(doctor.id)} className="px-2 py-1 text-[10px] bg-green-600 text-white rounded">Approve</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ APPOINTMENTS TAB ═══ */}
        {activeTab === 'appointments' && (
          <div className="space-y-2">
            {appointments.map(a => (
              <div key={a.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">{a.service_type?.replace(/_/g, ' ') || 'Consultation'}</span>
                  {a.doctors && <span className="text-xs text-gray-500 ml-2">Dr. {a.doctors.first_name} {a.doctors.last_name}</span>}
                  {a.requested_date_time && <span className="text-xs text-gray-600 ml-2">{formatDate(a.requested_date_time)} {formatTime(a.requested_date_time)}</span>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  a.status === 'completed' ? 'bg-green-500/20 text-green-400' : a.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                  a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ACTIVITY TAB ═══ */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Recent platform activity from all doctors and appointments.</p>
            {[...appointments.slice(0, 10).map(a => ({
              type: 'appointment', time: a.created_at,
              text: `${a.service_type?.replace(/_/g, ' ')} — ${a.status}`,
              sub: a.doctors ? `Dr. ${a.doctors.first_name} ${a.doctors.last_name}` : ''
            })), ...doctors.slice(0, 5).map(d => ({
              type: 'doctor', time: d.created_at,
              text: `Dr. ${d.first_name} ${d.last_name} ${d.is_approved ? 'approved' : 'applied'}`,
              sub: d.specialty || 'General'
            }))].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15).map((item, i) => (
              <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.type === 'appointment' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                <div className="flex-1">
                  <span className="text-sm text-white">{item.text}</span>
                  {item.sub && <span className="text-xs text-gray-500 ml-2">{item.sub}</span>}
                </div>
                <span className="text-[10px] text-gray-600">{formatDate(item.time)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ BUG REPORTS TAB ═══ */}
        {activeTab === 'bug_reports' && (
          <div className="space-y-2">
            {bugReports.map(bug => (
              <div key={bug.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      bug.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      bug.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{bug.priority?.toUpperCase()}</span>
                    <span className="text-sm font-semibold text-white">{bug.title}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    bug.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                    bug.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{bug.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{bug.description}</p>
                <div className="text-[10px] text-gray-600 mt-1">{bug.reporter_name} · {bug.category} · {formatDate(bug.created_at)}</div>
              </div>
            ))}
            {bugReports.length === 0 && <p className="text-center text-gray-500 py-8">No bug reports</p>}
          </div>
        )}
      </div>
    </div>
  )
}
