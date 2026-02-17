// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import MedicalRecordsUpload from '@/components/MedicalRecordsUpload'
import PatientAppointmentChat from '@/components/PatientAppointmentChat'
import {
  Calendar, Clock, User, FileText, MessageCircle, Video, Phone,
  MapPin, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  RefreshCw, Bell, Shield, Pill, CreditCard, ExternalLink, Plus, Search,
  Filter, ArrowLeft
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Appointment {
  id: string
  service_type: string
  status: string
  visit_type: string
  requested_date_time: string | null
  zoom_meeting_url: string | null
  zoom_meeting_id: string | null
  zoom_meeting_password: string | null
  dailyco_meeting_url: string | null
  notes: string | null
  chief_complaint: string | null
  duration_minutes: number | null
  copay_amount: number | null
  copay_paid: boolean
  chart_status: string | null
  created_at: string
  updated_at: string | null
  doctors: {
    first_name: string
    last_name: string
    specialty: string
    phone: string | null
  } | null
  payment_records: Array<{
    id: string
    amount: number
    status: string
    stripe_payment_intent_id: string | null
  }> | null
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Pending Review' },
  accepted: { color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Confirmed' },
  completed: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Completed' },
  rejected: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Declined' },
  cancelled: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: XCircle, label: 'Cancelled' },
  in_progress: { color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200', icon: Video, label: 'In Progress' },
  no_show: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle, label: 'No Show' },
}

const TABS = ['Upcoming', 'Past', 'All'] as const

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getRelativeTime(dateString: string) {
  const diff = new Date(dateString).getTime() - Date.now()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0

  if (absDiff < 3600000) {
    const mins = Math.floor(absDiff / 60000)
    return isPast ? `${mins}m ago` : `in ${mins}m`
  }
  if (absDiff < 86400000) {
    const hours = Math.floor(absDiff / 3600000)
    return isPast ? `${hours}h ago` : `in ${hours}h`
  }
  const days = Math.floor(absDiff / 86400000)
  return isPast ? `${days}d ago` : `in ${days}d`
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<typeof TABS[number]>('Upcoming')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showRecords, setShowRecords] = useState<string | null>(null)
  const [showChat, setShowChat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAppointments = useCallback(async () => {
    try {
      setError(null)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { setError('Please log in to view appointments'); setLoading(false); return }
      setUser(currentUser)

      const { data, error: fetchErr } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors!appointments_doctor_id_fkey(first_name, last_name, specialty, phone),
          payment_records!payment_records_appointment_id_fkey(id, amount, status, stripe_payment_intent_id)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (fetchErr) { setError(fetchErr.message); return }
      setAppointments(data || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const handleRefresh = () => { setRefreshing(true); fetchAppointments() }

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, cancelledBy: 'patient', reason: 'Patient cancelled' })
      })
      if (res.ok) fetchAppointments()
      else { const data = await res.json(); setError(data.error || 'Failed to cancel') }
    } catch (err: any) { setError(err.message) }
  }

  // Filter appointments
  const now = new Date()
  const filtered = useMemo(() => {
    let items = appointments
    if (tab === 'Upcoming') items = items.filter(a => {
      const d = a.requested_date_time ? new Date(a.requested_date_time) : new Date(a.created_at)
      return d >= now && !['cancelled', 'completed', 'rejected', 'no_show'].includes(a.status)
    })
    if (tab === 'Past') items = items.filter(a => {
      const d = a.requested_date_time ? new Date(a.requested_date_time) : new Date(a.created_at)
      return d < now || ['completed', 'cancelled', 'rejected', 'no_show'].includes(a.status)
    })
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(a =>
        a.service_type?.toLowerCase().includes(q) ||
        a.doctors?.first_name?.toLowerCase().includes(q) ||
        a.doctors?.last_name?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q)
      )
    }
    return items
  }, [appointments, tab, search, now])

  const upcomingCount = appointments.filter(a => {
    const d = a.requested_date_time ? new Date(a.requested_date_time) : new Date(a.created_at)
    return d >= now && !['cancelled', 'completed', 'rejected', 'no_show'].includes(a.status)
  }).length

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
              <p className="text-sm text-gray-500 mt-1">
                {upcomingCount > 0 ? `${upcomingCount} upcoming appointment${upcomingCount > 1 ? 's' : ''}` : 'No upcoming appointments'}
              </p>
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Tabs + Search */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}>
                  {t}
                  {t === 'Upcoming' && upcomingCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">{upcomingCount}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search appointments..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Appointments List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {tab === 'Upcoming' ? 'No upcoming appointments' : 'No appointments found'}
            </h3>
            <p className="text-gray-500 text-sm">
              {tab === 'Upcoming' ? "You don't have any scheduled appointments." : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          filtered.map(apt => {
            const config = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending
            const StatusIcon = config.icon
            const isExpanded = expandedId === apt.id
            const isUpcoming = apt.requested_date_time && new Date(apt.requested_date_time) > now
            const meetingUrl = apt.dailyco_meeting_url || apt.zoom_meeting_url
            const VisitIcon = apt.visit_type === 'video' ? Video : apt.visit_type === 'phone' ? Phone : MapPin

            return (
              <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Main Row */}
                <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : apt.id)}>
                  <div className="flex items-start gap-4">
                    {/* Date Block */}
                    {apt.requested_date_time && (
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-xs font-semibold text-gray-500 uppercase">
                          {new Date(apt.requested_date_time).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {new Date(apt.requested_date_time).getDate()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(apt.requested_date_time).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${config.bg} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                          <VisitIcon className="w-3 h-3" />
                          {apt.visit_type === 'video' ? 'Video' : apt.visit_type === 'async' ? 'Async' : apt.visit_type === 'phone' ? 'Phone' : 'In-Person'}
                        </span>
                        {apt.requested_date_time && isUpcoming && (
                          <span className="text-xs text-blue-600 font-medium">{getRelativeTime(apt.requested_date_time)}</span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900">
                        {apt.service_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Consultation'}
                      </h3>

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        {apt.doctors && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            Dr. {apt.doctors.first_name} {apt.doctors.last_name}
                            {apt.doctors.specialty && <span className="text-gray-400">· {apt.doctors.specialty}</span>}
                          </span>
                        )}
                        {apt.requested_date_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(apt.requested_date_time)}
                          </span>
                        )}
                        {apt.duration_minutes && (
                          <span>{apt.duration_minutes} min</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {meetingUrl && apt.status === 'accepted' && isUpcoming && (
                        <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                          <Video className="w-4 h-4" />Join
                        </a>
                      )}
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Detail Grid */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {apt.requested_date_time && (
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Date & Time</div>
                            <div className="text-sm text-gray-900">{formatDate(apt.requested_date_time)}</div>
                            <div className="text-sm text-gray-600">{formatTime(apt.requested_date_time)}</div>
                          </div>
                        </div>
                      )}

                      {apt.doctors && (
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Provider</div>
                            <div className="text-sm text-gray-900">Dr. {apt.doctors.first_name} {apt.doctors.last_name}</div>
                            <div className="text-sm text-gray-600">{apt.doctors.specialty}</div>
                            {apt.doctors.phone && <div className="text-sm text-blue-600">{apt.doctors.phone}</div>}
                          </div>
                        </div>
                      )}

                      {apt.chief_complaint && (
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Chief Complaint</div>
                            <div className="text-sm text-gray-900">{apt.chief_complaint}</div>
                          </div>
                        </div>
                      )}

                      {(apt.copay_amount || apt.payment_records?.length) && (
                        <div className="flex items-start gap-3">
                          <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500 uppercase font-medium">Payment</div>
                            {apt.copay_amount && <div className="text-sm text-gray-900">Copay: ${apt.copay_amount}</div>}
                            {apt.payment_records?.[0] && (
                              <div className={`text-sm ${apt.payment_records[0].status === 'captured' ? 'text-green-600' : 'text-amber-600'}`}>
                                ${(apt.payment_records[0].amount / 100).toFixed(2)} — {apt.payment_records[0].status}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {apt.notes && (
                      <div className="px-5 pb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800"><strong>Doctor&apos;s Notes:</strong> {apt.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Video Meeting */}
                    {meetingUrl && apt.status === 'accepted' && (
                      <div className="px-5 pb-4">
                        <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                          <Video className="w-4 h-4" />Join Video Consultation
                        </a>
                        {apt.zoom_meeting_id && (
                          <div className="mt-2 text-xs text-gray-500">
                            Meeting ID: {apt.zoom_meeting_id}
                            {apt.zoom_meeting_password && <span className="ml-3">Password: {apt.zoom_meeting_password}</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                      <button onClick={() => setShowRecords(showRecords === apt.id ? null : apt.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                        <FileText className="w-4 h-4" />
                        {showRecords === apt.id ? 'Hide Records' : 'Upload Records'}
                      </button>

                      {apt.visit_type === 'async' && apt.status === 'accepted' && user && (
                        <button onClick={() => setShowChat(showChat === apt.id ? null : apt.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                          <MessageCircle className="w-4 h-4" />
                          {showChat === apt.id ? 'Hide Chat' : 'Chat with Doctor'}
                        </button>
                      )}

                      {['pending', 'accepted'].includes(apt.status) && isUpcoming && (
                        <button onClick={() => handleCancel(apt.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                          <XCircle className="w-4 h-4" />Cancel Appointment
                        </button>
                      )}

                      <div className="flex-1" />
                      <span className="text-xs text-gray-400">Booked {formatDateTime(apt.created_at)}</span>
                    </div>

                    {/* Records Upload */}
                    {showRecords === apt.id && (
                      <div className="p-5 border-t border-gray-100">
                        <MedicalRecordsUpload
                          appointmentId={apt.id}
                          userId={user?.id}
                          onUploadSuccess={() => console.log('Records uploaded')}
                        />
                      </div>
                    )}

                    {/* Chat */}
                    {showChat === apt.id && user && (
                      <div className="p-5 border-t border-gray-100">
                        <PatientAppointmentChat
                          appointmentId={apt.id}
                          currentUserId={user.id}
                          doctorName={apt.doctors ? `Dr. ${apt.doctors.first_name} ${apt.doctors.last_name}` : 'Dr. Provider'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
