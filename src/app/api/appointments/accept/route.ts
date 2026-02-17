// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { capturePayment } from '@/lib/payment'
import { zoomService } from '@/lib/zoom'
import { sendAppointmentStatusEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  console.log('📋 Accept appointment API called')
  
  try {
    const body = await request.json()
    console.log('📤 Request body:', body)
    
    const { appointmentId } = body

    if (!appointmentId) {
      console.error('❌ Missing appointment ID')
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }
    
    console.log('🔍 Processing appointment ID:', appointmentId)

    // Get appointment details with related data
    console.log('🔍 Fetching appointment details from database...')
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        doctors!appointments_doctor_id_fkey(first_name, last_name, email, timezone),
        payment_records!payment_records_appointment_id_fkey(*)
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError) {
      console.error('❌ Database error fetching appointment:', appointmentError)
      return NextResponse.json(
        { error: `Database error: ${appointmentError.message}` },
        { status: 500 }
      )
    }

    if (!appointment) {
      console.error('❌ Appointment not found:', appointmentId)
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }
    
    console.log('✅ Appointment found:', {
      id: appointment.id,
      status: appointment.status,
      hasUser: !!appointment.users,
      hasDoctor: !!appointment.doctors,
      hasPaymentRecords: !!appointment.payment_records?.length
    })

    // Check if appointment is in pending status
    if (appointment.status !== 'pending') {
      console.error('❌ Appointment not in pending status:', appointment.status)
      return NextResponse.json(
        { error: `Appointment is not in pending status. Current status: ${appointment.status}` },
        { status: 400 }
      )
    }

    // Check if payment exists and is authorized
    const paymentRecord = appointment.payment_records?.[0]
    console.log('💳 Payment record check:', {
      hasPaymentRecord: !!paymentRecord,
      paymentStatus: paymentRecord?.status,
      paymentIntentId: paymentRecord?.stripe_payment_intent_id
    })
    
    if (!paymentRecord) {
      console.error('❌ No payment record found for appointment')
      return NextResponse.json(
        { error: 'No payment record found for this appointment' },
        { status: 400 }
      )
    }
    
    // Check if payment is already captured or needs to be captured
    let paymentCaptured = false
    if (paymentRecord.status === 'authorized') {
      // Step 1: Capture the payment
      console.log('💰 Capturing payment:', paymentRecord.stripe_payment_intent_id)
      const paymentResult = await capturePayment(paymentRecord.stripe_payment_intent_id)
      console.log('💳 Payment capture result:', paymentResult)
      
      if (!paymentResult.success) {
        console.error('❌ Payment capture failed:', paymentResult.error)
        return NextResponse.json(
          { error: `Payment capture failed: ${paymentResult.error}` },
          { status: 400 }
        )
      }
      
      console.log('✅ Payment captured successfully')
      paymentCaptured = true
    } else if (paymentRecord.status === 'captured') {
      console.log('✅ Payment already captured')
      paymentCaptured = true
    } else {
      console.error('❌ Payment not in valid state:', paymentRecord.status)
      return NextResponse.json(
        { error: `Payment is not in a valid state. Current status: ${paymentRecord.status}` },
        { status: 400 }
      )
    }

    // Step 2: Create Zoom meeting (only for video appointments)
    console.log('📹 Checking appointment type...')
    let zoomMeeting = null
    
    if (appointment.visit_type === 'video') {
      console.log('📹 Creating Zoom meeting for video appointment...')
      try {
        // Check if Zoom credentials are configured
        if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET || !process.env.ZOOM_ACCOUNT_ID) {
          console.warn('⚠️ Zoom API credentials not configured. Skipping meeting creation.')
          console.warn('📝 To enable Zoom meetings, add ZOOM_API_KEY, ZOOM_API_SECRET, and ZOOM_ACCOUNT_ID to your .env.local file')
        } else {
          const doctorName = appointment.doctors ? 
            `Dr. ${appointment.doctors.first_name} ${appointment.doctors.last_name}` : 
            'Dr. Healthcare Provider'
          
          // Use doctor's timezone for the Zoom meeting, default to America/New_York
          const doctorTimezone = appointment.doctors?.timezone || 'America/New_York'
          
          const meetingParams = {
            topic: `Appointment with ${doctorName}`,
            start_time: appointment.requested_date_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default to 24 hours from now
            duration: 30, // 30 minutes default
            timezone: doctorTimezone,
            waiting_room: true
          }
          
          console.log('📋 Zoom meeting parameters:', meetingParams)
          console.log('🌍 Using doctor timezone:', doctorTimezone)
          zoomMeeting = await zoomService.createMeeting(meetingParams)
          console.log('✅ Zoom meeting created successfully:', zoomMeeting?.id)
        }
      } catch (zoomError) {
        console.error('❌ Zoom meeting creation failed:', zoomError)
        // Continue without Zoom meeting - we can still accept the appointment
      }
    } else {
      console.log('💬 Text-based appointment - no Zoom meeting needed')
    }

    // Step 3: Update appointment status with Zoom meeting details
    console.log('💾 Updating appointment with meeting details...')
    const updateData: any = {
      status: 'accepted',
      provider_accepted_at: new Date().toISOString()
    }
    
    if (zoomMeeting) {
      updateData.zoom_meeting_url = zoomMeeting.join_url
      updateData.zoom_start_url = zoomMeeting.start_url
      updateData.zoom_meeting_id = zoomMeeting.id
      updateData.zoom_meeting_password = zoomMeeting.password || ''
      updateData.calendly_meeting_location = 'Zoom Video Call'
      updateData.notes = `Zoom Meeting ID: ${zoomMeeting.id}\nMeeting Password: ${zoomMeeting.password || 'No password required'}`
    }
    
    console.log('📋 Update data:', updateData)
    
    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (updateError) {
      console.error('Error updating appointment:', updateError)
      return NextResponse.json(
        { error: 'Failed to update appointment status' },
        { status: 500 }
      )
    }

    // Step 4: Send email notification to patient
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
        'accepted',
        zoomMeeting?.join_url,
        undefined
      )
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Don't fail the entire operation if email fails
    }

    // Step 5: Create notification for doctor
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: appointment.doctor_id,
          type: 'appointment_confirmed',
          title: 'Appointment Accepted',
          message: `You have accepted an appointment with ${appointment.users?.first_name} ${appointment.users?.last_name}`,
          is_read: false
        })
    } catch (notificationError) {
      console.error('Notification creation failed:', notificationError)
    }

    console.log('🎉 Appointment acceptance process completed')
    
    return NextResponse.json({
      success: true,
      message: 'Appointment accepted successfully',
      data: {
        appointmentId,
        paymentCaptured: paymentCaptured,
        zoomMeeting: zoomMeeting ? {
          id: zoomMeeting.id,
          join_url: zoomMeeting.join_url,
          password: zoomMeeting.password
        } : null
      }
    })

  } catch (error) {
    console.error('Error in accept appointment API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
