// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Total Patients ──
    const { count: localPatients, error: lpErr } = await db.from('patients').select('*', { count: 'exact', head: true })
    if (lpErr) console.error('[Stats] patients count error:', lpErr.message)
    const totalPatients = localPatients || 0
    console.log(`[Stats] Patients: total=${totalPatients}`)

    // ── Active Patients (appointments in last 30 days) ──
    let activePatients = 0
    try {
      const { data: localActive } = await db.from('appointments')
        .select('patient_id')
        .gte('requested_date_time', thirtyDaysAgo)
        .in('status', ['accepted', 'pending', 'completed'])
      const localActiveSet = new Set((localActive || []).map((a: any) => a.patient_id).filter(Boolean))

      activePatients = localActiveSet.size
    } catch { /* tables may not exist */ }

    // ── New This Month ──
    let newThisMonth = 0
    try {
      const { count: localNew } = await db.from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart)
      newThisMonth = localNew || 0
    } catch { /* ok */ }

    // ── Today's Appointments ──
    let appointmentsToday = 0
    let upcomingAppointments: any[] = []
    try {
      // Local
      const todayStart = `${todayStr}T00:00:00`
      const todayEnd = `${todayStr}T23:59:59`
      const { data: localToday } = await db.from('appointments')
        .select('id, patient_id, requested_date_time, status, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)')
        .gte('requested_date_time', todayStart)
        .lte('requested_date_time', todayEnd)
        .in('status', ['accepted', 'pending'])

      appointmentsToday = (localToday || []).length

      // Upcoming (next 5 appointments after today)
      const { data: localUpcoming } = await db.from('appointments')
        .select('id, patient_id, requested_date_time, status, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)')
        .gt('requested_date_time', todayEnd)
        .in('status', ['accepted', 'pending'])
        .order('requested_date_time', { ascending: true })
        .limit(5)

      upcomingAppointments = (localUpcoming || []).map((a: any) => ({
        id: a.id,
        requested_date_time: a.requested_date_time,
        status: a.status,
        visit_type: a.visit_type,
        patient_name: a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : null,
        _source: 'local',
      }))
    } catch (err) {
      console.error('Dashboard appointments error:', err)
    }

    // ── Avg Appointments per day (last 30 days) ──
    let avgAppointments = 0
    try {
      const { count: totalAppts30d } = await db.from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('requested_date_time', thirtyDaysAgo)
      const total = totalAppts30d || 0
      avgAppointments = total > 0 ? Math.round((total / 30) * 10) / 10 : 0
    } catch { /* ok */ }

    // ── Sync status ──
    let lastSyncedAt = null

    // ── Notifications ──
    const notifications: any[] = []
    try {
      // Pending local appointments = new appointment requests
      const { data: pendingApts } = await db.from('appointments')
        .select('id, patient_id, requested_date_time, visit_type, created_at, patients!appointments_patient_id_fkey(first_name, last_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)
      
      for (const apt of (pendingApts || [])) {
        const p = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients
        const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Patient'
        notifications.push({
          id: `apt-pending-${apt.id}`,
          type: 'appointment_request',
          title: 'New Appointment Request',
          message: `${name} requested a ${apt.visit_type || 'video'} visit for ${apt.requested_date_time ? new Date(apt.requested_date_time).toLocaleDateString() : 'TBD'}`,
          is_read: false,
          created_at: apt.created_at,
        })
      }

      // Today's appointments = reminders
      const todayStart2 = `${todayStr}T00:00:00`
      const todayEnd2 = `${todayStr}T23:59:59`
      const { data: todayApts } = await db.from('appointments')
        .select('id, patient_id, requested_date_time, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)')
        .gte('requested_date_time', todayStart2)
        .lte('requested_date_time', todayEnd2)
        .in('status', ['accepted', 'pending'])
        .limit(5)

      for (const apt of (todayApts || [])) {
        const p = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients
        const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Patient'
        notifications.push({
          id: `apt-today-${apt.id}`,
          type: 'appointment_reminder',
          title: 'Appointment Today',
          message: `${name} — ${apt.visit_type || 'video'} visit at ${apt.requested_date_time ? new Date(apt.requested_date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}`,
          is_read: false,
          created_at: apt.requested_date_time,
        })
      }

      // New lab results (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: newLabCount } = await db.from('lab_results')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday)
      if (newLabCount && newLabCount > 0) {
        notifications.push({
          id: 'lab-results-new',
          type: 'lab_results',
          title: 'New Lab Results',
          message: `${newLabCount} new lab result${newLabCount > 1 ? 's' : ''} received in the last 24 hours`,
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Notifications generation error:', err)
    }

    // Sort notifications by date, newest first
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      totalPatients,
      activePatients,
      newThisMonth,
      appointmentsToday,
      avgAppointments,
      upcomingAppointments,
      notifications,
      lastSyncedAt,
      sources: {
        local_patients: localPatients || 0,
      }
    })
  } catch (err: any) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
