'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Calendar, Bell, X, UserPlus, Clock, BarChart3, Users, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import PatientSearchTrigger from '@/components/PatientSearchTrigger'

interface DashboardStats {
  totalPatients: number
  activePatients: number
  newThisMonth: number
  avgAppointments: number
  monthlyEarnings: number
  pendingDocuments: number
  upcomingAppointments: number
  appointmentsToday: number
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

interface AppointmentWithUser {
  id: string
  requested_date_time: string | null
  status: string
  visit_type: string | null
  patients?: {
    first_name?: string | null
    last_name?: string | null
  } | null
}

export default function DoctorDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    activePatients: 0,
    newThisMonth: 0,
    avgAppointments: 0,
    monthlyEarnings: 0,
    pendingDocuments: 0,
    upcomingAppointments: 0,
    appointmentsToday: 0
  })
  const [doctor, setDoctor] = useState<any>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentWithUser[]>([])
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false)
  const [chartAlerts, setChartAlerts] = useState({ overdue: 0, unsigned: 0 })
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    // Update date every minute
    const interval = setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get current doctor
      const authUser = await getCurrentUser()
      if (!authUser || !authUser.doctor) {
        console.error('No doctor found')
        return
      }
      
      const currentDoctor = authUser.doctor
      setDoctor(currentDoctor)

      // Fetch aggregated stats from API (combines local + drchrono data)
      try {
        const statsRes = await fetch('/api/dashboard/stats')
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(prev => ({
            ...prev,
            totalPatients: statsData.totalPatients || 0,
            activePatients: statsData.activePatients || 0,
            newThisMonth: statsData.newThisMonth || 0,
            avgAppointments: statsData.avgAppointments || 0,
            appointmentsToday: statsData.appointmentsToday || 0,
          }))
          if (statsData.upcomingAppointments && statsData.upcomingAppointments.length > 0) {
            setUpcomingAppointments(statsData.upcomingAppointments.map((a: any) => ({
              id: a.id,
              requested_date_time: a.requested_date_time,
              status: a.status,
              visit_type: a.visit_type,
              patients: a.patient_name ? {
                first_name: a.patient_name.split(' ')[0],
                last_name: a.patient_name.split(' ').slice(1).join(' '),
              } : null,
            })))
          }
        }
      } catch (err) {
        console.error('Dashboard stats API error:', err)
      }

      // Also try local appointments as fallback for upcoming list
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)
      
      // Fetch local appointments for earnings/documents/chart queries
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, patient_id, requested_date_time, status, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)')
        .eq('doctor_id', currentDoctor.id)
        .order('requested_date_time', { ascending: true })

      // If API stats returned 0 patients, fallback to local upcoming
      if (upcomingAppointments.length === 0 && appointments) {
        const upcoming = appointments.filter((apt: any) => {
          if (!apt.requested_date_time) return false
          return new Date(apt.requested_date_time) > todayEnd && (apt.status === 'accepted' || apt.status === 'pending')
        }).slice(0, 5).map((apt: any) => ({
          id: apt.id,
          requested_date_time: apt.requested_date_time,
          status: apt.status,
          visit_type: apt.visit_type,
          patients: Array.isArray(apt.patients) ? apt.patients[0] : apt.patients || null,
        }))
        if (upcoming.length > 0) setUpcomingAppointments(upcoming as AppointmentWithUser[])
      }

      // Fetch monthly earnings (current month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

      const { data: earningsData, error: earningsError } = await supabase
        .from('payment_records')
        .select('amount')
        .eq('status', 'captured')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .in('appointment_id', 
          (appointments || []).filter((apt: any) => apt.status === 'completed')
            .map((apt: any) => apt.id).filter(Boolean)
        )

      if (!earningsError && earningsData) {
        const totalEarnings = earningsData.reduce((sum: number, record: any) => sum + (record.amount || 0), 0)
        setStats(prev => ({
          ...prev,
          monthlyEarnings: totalEarnings
        }))
      }

      // Fetch pending documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('files')
        .select('id')
        .eq('is_shared', true)
        .in('appointment_id', 
          (appointments || []).filter((apt: any) => apt.status === 'pending' || apt.status === 'accepted')
            .map((apt: any) => apt.id).filter(Boolean)
        )

      if (!documentsError && documentsData) {
        setStats(prev => ({
          ...prev,
          pendingDocuments: documentsData.length
        }))
      }

      // For doctors, we'll create mock notifications based on appointments
      // In a real app, you'd have a separate notifications table for doctors
      const appointmentNotifications: Notification[] = []
      const recentAppointments = (appointments || []).slice(0, 5)
      
      recentAppointments.forEach((apt: any) => {
        if (apt.status === 'pending') {
          appointmentNotifications.push({
            id: `apt-${apt.id}`,
            type: 'appointment_reminder',
            title: 'New Appointment Request',
            message: `New appointment request from ${apt.users?.first_name || 'Patient'} ${apt.users?.last_name || ''}`,
            is_read: false,
            created_at: apt.created_at || new Date().toISOString()
          })
        }
      })
      
      setNotifications(appointmentNotifications)

      // Chart alerts
      try {
        const { data: chartData } = await supabase
          .from('appointments')
          .select('id, status, chart_status, chart_locked, updated_at, scheduled_time, created_at')
          .eq('doctor_id', currentDoctor.id)
          .neq('status', 'cancelled')
        
        if (chartData) {
          let overdue = 0
          let unsigned = 0
          chartData.forEach((r: any) => {
            const cs = r.chart_status || (r.chart_locked ? 'closed' : r.status === 'completed' ? 'signed' : 'draft')
            if (cs === 'draft' || cs === 'preliminary') unsigned++
            // Overdue: completed but not locked, >24 hours
            if (!r.chart_locked && r.status === 'completed' && cs !== 'closed' && cs !== 'amended') {
              const hrs = (Date.now() - new Date(r.updated_at || r.scheduled_time || r.created_at).getTime()) / 3600000
              if (hrs > 24) overdue++
            }
          })
          setChartAlerts({ overdue, unsigned })
        }
      } catch { /* silent — chart alerts are bonus info */ }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleCreateMeetingLink = async () => {
    try {
      // Navigate to availability page where they can create meeting links
      router.push('/doctor/availability')
    } catch (error) {
      console.error('Error creating meeting link:', error)
      alert('Failed to create meeting link. Please try again.')
    }
  }

  const handleStartNoCallReview = () => {
    // Navigate to appointments page with async filter
    router.push('/doctor/appointments?type=async')
  }

  const handleOpenCalendar = () => {
    router.push('/doctor/appointments')
  }

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
          isRead: true
        })
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const doctorName = doctor
    ? `Dr. ${doctor.first_name} ${doctor.last_name}`
    : 'Doctor'
  const specialty = doctor?.specialty || 'Family Medicine'
  const experience = doctor?.experience_years
    ? `${doctor.experience_years} years experience`
    : '5 years experience'

  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-[#0d2626] w-full max-w-md h-full overflow-y-auto border-l border-[#1a3d3d]">
            <div className="p-4 sm:p-6 border-b border-[#1a3d3d] flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400 mr-2 sm:mr-3" />
                Notifications
              </h2>
              <button
                onClick={() => setShowNotificationsDrawer(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {notifications.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  No notifications
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border ${
                        notification.is_read
                          ? 'bg-[#164e4e] border-[#1a5a5a]'
                          : 'bg-[#0d2626] border-teal-600'
                      } cursor-pointer`}
                      onClick={() => handleMarkNotificationRead(notification.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-300">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-teal-400 rounded-full ml-4"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Header */}
      <div className="pt-16 lg:pt-0 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 sm:mb-6">
          {/* Welcome Section */}
          <div className="flex items-center space-x-3 sm:space-x-4 bg-gradient-to-r from-teal-600/20 to-teal-500/20 rounded-lg p-3 sm:p-4 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-400 rounded-full"></div>
            </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">Welcome back, {doctorName}</h2>
                <p className="text-teal-400 text-xs sm:text-sm">{specialty} • {experience}</p>
              </div>
            </div>

          {/* Date and Appointments */}
          <div className="text-xs sm:text-sm text-gray-300 lg:text-right">
            {formatDate(currentDate)} • Appointments Today: {stats.appointmentsToday}
          </div>
        </div>

          {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={handleCreateMeetingLink}
            className="bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
              Create Meeting Link
            </button>
          <button
            onClick={handleStartNoCallReview}
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
              Start No-Call Review
            </button>
          <button
            onClick={handleOpenCalendar}
            className="bg-blue-400 hover:bg-blue-500 text-[#0a1f1f] px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
              Open Calendar
            </button>
          <button
            onClick={() => router.push('/doctor/settings/staff')}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
              Manage Staff
            </button>
          <button
            onClick={() => router.push('/doctor/chart-management')}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
              Chart Management
            </button>
          </div>

          {/* Patient Search */}
          <div className="mb-4 sm:mb-6">
            <PatientSearchTrigger placeholder="Search patients — name, DOB, email, phone..." />
          </div>

          {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Total Patients</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stats.totalPatients}</div>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Active Patients</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stats.activePatients}</div>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">New This Month</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stats.newThisMonth}</div>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Avg. Appointments</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stats.avgAppointments.toFixed(1)}</div>
            </div>
          </div>

        {/* Large Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Upcoming Appointments Card */}
          <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
            <div className="flex items-center mb-3 sm:mb-4">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400 mr-2 sm:mr-3" />
              <h3 className="text-lg sm:text-xl font-semibold text-white">Upcoming Appointments</h3>
              </div>
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  Loading...
            </div>
              ) : upcomingAppointments.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  No upcoming appointments
                      </div>
              ) : (
                upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-3 bg-[#164e4e] rounded-lg border border-[#1a5a5a]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm sm:text-base truncate">
                          {appointment.patients?.first_name && appointment.patients?.last_name
                            ? `${appointment.patients.first_name} ${appointment.patients.last_name}`
                            : 'Patient'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">
                          {appointment.requested_date_time
                            ? new Date(appointment.requested_date_time).toLocaleString()
                            : 'Date TBD'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap self-start sm:self-auto ${
                        appointment.status === 'accepted'
                          ? 'bg-green-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
                </div>
              </div>

          {/* ── Chart Alerts ── */}
          {(chartAlerts.overdue > 0 || chartAlerts.unsigned > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
              {chartAlerts.overdue > 0 && (
                <Link href="/doctor/chart-management?filter=overdue" className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg p-4 hover:bg-red-500/15 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Overdue Charts</p>
                      <p className="text-[10px] text-gray-400">Unsigned &gt; 24 hours</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-red-400">{chartAlerts.overdue}</span>
                </Link>
              )}
              {chartAlerts.unsigned > 0 && (
                <Link href="/doctor/chart-management?filter=unsigned" className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 hover:bg-amber-500/15 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Unsigned Notes</p>
                      <p className="text-[10px] text-gray-400">Draft + Preliminary</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-amber-400">{chartAlerts.unsigned}</span>
                </Link>
              )}
            </div>
          )}

          {/* Recent Notifications Card */}
          <div className="bg-[#0d2626] rounded-lg p-4 sm:p-6 border border-[#1a3d3d]">
            <div className="flex items-center mb-3 sm:mb-4">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400 mr-2 sm:mr-3" />
              <h3 className="text-lg sm:text-xl font-semibold text-white">Recent Notifications</h3>
                </div>
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <div className="text-gray-400 mb-4">No recent notifications</div>
                  <button
                    onClick={() => setShowNotificationsDrawer(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Open Drawer
                  </button>
                </div>
              ) : (
                <>
                  {notifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border ${
                        notification.is_read
                          ? 'bg-[#164e4e] border-[#1a5a5a]'
                          : 'bg-[#1a5a5a] border-teal-600'
                      }`}
                    >
                      <p className="text-white font-medium text-sm mb-1">
                        {notification.title}
                      </p>
                      <p className="text-gray-300 text-xs line-clamp-2">
                        {notification.message}
                      </p>
              </div>
                  ))}
                  <button
                    onClick={() => setShowNotificationsDrawer(true)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors mt-4"
                  >
                    Open Drawer
                  </button>
                </>
              )}
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-5 border border-[#1a3d3d] flex flex-col">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-teal-400" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">View All Appointments</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3">Manage slots, reschedule, and join visits.</p>
              <Link href="/doctor/appointments" className="bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-4 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-sm w-fit mt-auto">
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-5 border border-[#1a3d3d] flex flex-col">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mb-3">
                <UserPlus className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Manage Patients</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3">Charts, messages, and prescriptions.</p>
              <Link href="/doctor/patients" className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-sm w-fit mt-auto">
                Open <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-5 border border-[#1a3d3d] flex flex-col">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Review Documents</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3">Lab results, uploads, and forms.</p>
              <Link href="/doctor/records" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-sm w-fit mt-auto">
                Review <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-5 border border-[#1a3d3d] flex flex-col">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Staff Management</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3">Add assistants, manage permissions, view activity logs.</p>
              <Link href="/doctor/settings/staff" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-sm w-fit mt-auto">
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-[#0d2626] rounded-lg p-4 sm:p-5 border border-[#1a3d3d] flex flex-col">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Chart Management</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3">Sign notes, close charts, manage addendums, audit trail.</p>
              <Link href="/doctor/chart-management" className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-sm w-fit mt-auto">
                Open <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
    </div>
  )
}


