// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { refundPayment } from '@/lib/payment'
import { sendAppointmentStatusEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    const { appointmentId, reason } = await request.json()

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    // Get appointment details with related data
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        doctors!appointments_doctor_id_fkey(first_name, last_name, email),
        payment_records!payment_records_appointment_id_fkey(*)
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Check if appointment is in pending status
    if (appointment.status !== 'pending') {
      return NextResponse.json(
        { error: 'Appointment is not in pending status' },
        { status: 400 }
      )
    }

    // Check if payment exists and is authorized
    const paymentRecord = appointment.payment_records?.[0]
    let refundResult = null

    if (paymentRecord && paymentRecord.status === 'authorized') {
      // Refund the payment
      refundResult = await refundPayment(paymentRecord.stripe_payment_intent_id)
      if (!refundResult.success) {
        console.error('Payment refund failed:', refundResult.error)
        // Continue with rejection even if refund fails
      }
    }

    // Update appointment status
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'rejected',
        notes: reason ? `Rejection reason: ${reason}` : 'Appointment rejected by doctor'
      })
      .eq('id', appointmentId)

    if (updateError) {
      console.error('Error updating appointment:', updateError)
      return NextResponse.json(
        { error: 'Failed to update appointment status' },
        { status: 500 }
      )
    }

    // Send email notification to patient
    try {
      const patientName = `${appointment.users?.first_name} ${appointment.users?.last_name}`
      const doctorName = `${appointment.doctors?.first_name} ${appointment.doctors?.last_name}`
      const appointmentDate = appointment.requested_date_time ? 
        new Date(appointment.requested_date_time).toLocaleString() : 
        'Date to be confirmed'

      await sendAppointmentStatusEmail(
        appointment.users?.email || '',
        patientName,
        doctorName,
        appointmentDate,
        'rejected',
        undefined,
        reason || 'Doctor unavailable at this time'
      )
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Don't fail the entire operation if email fails
    }

    // Create notification for doctor
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: appointment.doctor_id,
          type: 'appointment_cancelled',
          title: 'Appointment Rejected',
          message: `You have rejected an appointment with ${appointment.users?.first_name} ${appointment.users?.last_name}`,
          is_read: false
        })
    } catch (notificationError) {
      console.error('Notification creation failed:', notificationError)
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: {
        appointmentId,
        paymentRefunded: refundResult?.success || false,
        refundAmount: refundResult?.amount || 0
      }
    })

  } catch (error) {
    console.error('Error in reject appointment API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
