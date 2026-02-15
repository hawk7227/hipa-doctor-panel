import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
   
 const { appointmentId, reason } = await req.json()

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    // 1. Fetch appointment
    const { data: existingAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        requested_date_time,
        doctor_id,
        patients!appointments_patient_id_fkey(first_name, last_name)
      `)
      .eq('id', appointmentId)
      .single()

    if (fetchError || !existingAppointment) {
      console.error('❌ Appointment fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    if (existingAppointment.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        message: 'Appointment already cancelled',
        data: { appointmentId }
      })
    }

    // 2. Update appointment
    const cancellationNote = reason
      ? `Cancelled: ${reason}`
      : 'Appointment cancelled by provider'

    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: cancellationNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)

    if (updateError) {
      console.error('❌ Error cancelling appointment:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel appointment' },
        { status: 500 }
      )
    }

    // 3. Fire-and-forget notification only
    if (existingAppointment.doctor_id) {
      ;(async () => {
        try {
          const patient = Array.isArray(existingAppointment.patients) 
            ? existingAppointment.patients[0] 
            : existingAppointment.patients
          const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim()

          const { error } = await supabase
            .from('notifications')
            .insert({
              user_id: existingAppointment.doctor_id,
              type: 'appointment_cancelled',
              title: 'Appointment Cancelled',
              message: patientName
                ? `Appointment cancelled with ${patientName}`
                : 'Appointment cancelled',
              is_read: false
            })
            .select() // Add select() to get a Promise that can be awaited

          if (error) {
            console.error('❌ Notification error:', error)
          }
        } catch (err) {
          console.error('❌ Notification exception:', err)
        }
      })()
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointmentId }
    })

  } catch (error: any) {
    console.error('❌ Unexpected cancel error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment', details: error?.message },
      { status: 500 }
    )
  }
}
