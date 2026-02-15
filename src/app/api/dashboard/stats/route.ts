import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Total Patients ──
    // Local patients
    const { count: localPatients } = await db.from('patients').select('*', { count: 'exact', head: true })
    // DrChrono patients
    const { count: dcPatients } = await db.from('drchrono_patients').select('*', { count: 'exact', head: true })
    const totalPatients = Math.max(localPatients || 0, dcPatients || 0)

    // ── Active Patients (appointments in last 30 days) ──
    let activePatients = 0
    try {
      // Local appointments
      const { data: localActive } = await db.from('appointments')
        .select('patient_id')
        .gte('requested_date_time', thirtyDaysAgo)
        .in('status', ['accepted', 'pending', 'completed'])
      const localActiveSet = new Set((localActive || []).map((a: any) => a.patient_id).filter(Boolean))

      // DrChrono appointments
      const { data: dcActive } = await db.from('drchrono_appointments')
        .select('drchrono_patient_id')
        .gte('scheduled_time', thirtyDaysAgo)
      const dcActiveSet = new Set((dcActive || []).map((a: any) => a.drchrono_patient_id).filter(Boolean))

      activePatients = Math.max(localActiveSet.size, dcActiveSet.size)
    } catch { /* tables may not exist */ }

    // ── New This Month ──
    let newThisMonth = 0
    try {
      const { count: localNew } = await db.from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart)
      const { count: dcNew } = await db.from('drchrono_patients')
        .select('*', { count: 'exact', head: true })
        .gte('last_synced_at', monthStart)
      // For DC, we approximate "new" by checking if drchrono_updated_at is recent
      // More accurate: check patient_status or first appearance
      newThisMonth = Math.max(localNew || 0, dcNew || 0)
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
      
      // DrChrono today
      const { data: dcToday } = await db.from('drchrono_appointments')
        .select('drchrono_appointment_id, drchrono_patient_id, scheduled_time, status, reason')
        .gte('scheduled_time', todayStart)
        .lte('scheduled_time', todayEnd)
        .neq('status', 'Cancelled')

      const localCount = (localToday || []).length
      const dcCount = (dcToday || []).length
      appointmentsToday = Math.max(localCount, dcCount)

      // Upcoming (next 5 appointments after today)
      const { data: localUpcoming } = await db.from('appointments')
        .select('id, patient_id, requested_date_time, status, visit_type, patients!appointments_patient_id_fkey(first_name, last_name)')
        .gt('requested_date_time', todayEnd)
        .in('status', ['accepted', 'pending'])
        .order('requested_date_time', { ascending: true })
        .limit(5)

      const { data: dcUpcoming } = await db.from('drchrono_appointments')
        .select('drchrono_appointment_id, drchrono_patient_id, scheduled_time, status, reason')
        .gt('scheduled_time', todayEnd)
        .neq('status', 'Cancelled')
        .order('scheduled_time', { ascending: true })
        .limit(5)

      // Merge and return upcoming — prefer local, supplement with DC
      upcomingAppointments = (localUpcoming || []).map((a: any) => ({
        id: a.id,
        requested_date_time: a.requested_date_time,
        status: a.status,
        visit_type: a.visit_type,
        patient_name: a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : null,
        _source: 'local',
      }))

      // Add DC appointments if we don't have enough local ones
      if (upcomingAppointments.length < 5 && dcUpcoming && dcUpcoming.length > 0) {
        for (const dca of dcUpcoming) {
          if (upcomingAppointments.length >= 5) break
          // Look up patient name from drchrono_patients
          let patientName = null
          if (dca.drchrono_patient_id) {
            const { data: p } = await db.from('drchrono_patients')
              .select('first_name, last_name')
              .eq('drchrono_patient_id', dca.drchrono_patient_id)
              .single()
            if (p) patientName = `${p.first_name} ${p.last_name}`
          }
          upcomingAppointments.push({
            id: dca.drchrono_appointment_id,
            requested_date_time: dca.scheduled_time,
            status: dca.status,
            visit_type: dca.reason,
            patient_name: patientName,
            _source: 'drchrono',
          })
        }
      }
    } catch (err) {
      console.error('Dashboard appointments error:', err)
    }

    // ── Avg Appointments per day (last 30 days) ──
    let avgAppointments = 0
    try {
      const { count: totalAppts30d } = await db.from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('requested_date_time', thirtyDaysAgo)
      const { count: dcAppts30d } = await db.from('drchrono_appointments')
        .select('*', { count: 'exact', head: true })
        .gte('scheduled_time', thirtyDaysAgo)
      const total = Math.max(totalAppts30d || 0, dcAppts30d || 0)
      avgAppointments = total > 0 ? Math.round((total / 30) * 10) / 10 : 0
    } catch { /* ok */ }

    // ── Sync status ──
    let lastSyncedAt = null
    try {
      const { data: syncLog } = await db.from('drchrono_patients')
        .select('last_synced_at')
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .single()
      lastSyncedAt = syncLog?.last_synced_at || null
    } catch { /* ok */ }

    return NextResponse.json({
      totalPatients,
      activePatients,
      newThisMonth,
      appointmentsToday,
      avgAppointments,
      upcomingAppointments,
      lastSyncedAt,
      sources: {
        local_patients: localPatients || 0,
        dc_patients: dcPatients || 0,
      }
    })
  } catch (err: any) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
