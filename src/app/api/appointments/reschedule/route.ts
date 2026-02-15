import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { zoomService } from '@/lib/zoom'
import { sendAppointmentRescheduledEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  console.log('🔄 Reschedule appointment API called')
  
  try {
   
 const body = await req.json()
    console.log('📤 Request body:', body)
    
    const { appointmentId, newDateTime } = body

    if (!appointmentId || !newDateTime) {
      console.error('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Appointment ID and new date/time are required' },
        { status: 400 }
      )
    }
    
    console.log('🔍 Processing reschedule for appointment ID:', appointmentId)
    console.log('📅 New date/time:', newDateTime)

    // Get appointment details with related data
    console.log('🔍 Fetching appointment details from database...')
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        doctors!appointments_doctor_id_fkey(first_name, last_name, email, timezone),
        users!appointments_user_id_fkey(first_name, last_name, email)
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
      hasZoomMeeting: !!appointment.calendly_event_uuid,
      currentDateTime: appointment.requested_date_time
    })

    const oldDateTime = appointment.requested_date_time
    const newDate = new Date(newDateTime)
    const oldDate = oldDateTime ? new Date(oldDateTime) : null

    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
    // This must match the calendar which always uses Phoenix timezone
    const doctorTimezone = PROVIDER_TIMEZONE
    console.log('🌍 Using doctor timezone:', doctorTimezone)

    // Step 1: Update Zoom meeting if it exists
    let updatedMeeting = null
    if (appointment.calendly_event_uuid && appointment.visit_type === 'video') {
      console.log('📹 Updating Zoom meeting for video appointment...')
      try {
        // Check if Zoom credentials are configured
        if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET || !process.env.ZOOM_ACCOUNT_ID) {
          console.warn('⚠️ Zoom API credentials not configured. Skipping meeting update.')
        } else {
          const meetingParams = {
            start_time: newDate.toISOString(),
            duration: 30, // Keep default duration
            timezone: doctorTimezone
          }
          
          console.log('📋 Zoom meeting update parameters:', meetingParams)
          updatedMeeting = await zoomService.updateMeeting(appointment.calendly_event_uuid, meetingParams)
          console.log('✅ Zoom meeting updated successfully:', updatedMeeting?.id)
        }
      } catch (zoomError: any) {
        console.error('❌ Zoom meeting update failed:', zoomError)
        // Continue with reschedule even if Zoom update fails - we'll update the database anyway
      }
    } else if (appointment.visit_type === 'video' && !appointment.calendly_event_uuid) {
      // If it's a video appointment but no meeting exists, create one
      console.log('📹 Creating new Zoom meeting for rescheduled video appointment...')
      try {
        if (process.env.ZOOM_API_KEY && process.env.ZOOM_API_SECRET && process.env.ZOOM_ACCOUNT_ID) {
          const doctorName = appointment.doctors ? 
            `Dr. ${appointment.doctors.first_name} ${appointment.doctors.last_name}` : 
            'Dr. Healthcare Provider'
          
          const meetingParams = {
            topic: `Appointment with ${doctorName}`,
            start_time: newDate.toISOString(),
            duration: 30,
            timezone: doctorTimezone,
            waiting_room: true
          }
          
          console.log('📋 Zoom meeting creation parameters:', meetingParams)
          updatedMeeting = await zoomService.createMeeting(meetingParams)
          console.log('✅ Zoom meeting created successfully:', updatedMeeting?.id)
        }
      } catch (zoomError: any) {
        console.error('❌ Zoom meeting creation failed:', zoomError)
        // Continue without Zoom meeting
      }
    }

    // Step 2: Update appointment in database
    console.log('💾 Updating appointment in database...')
    const updateData: any = {
      requested_date_time: newDate.toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Update notes with reschedule information
    const rescheduleNote = `Rescheduled from ${oldDate ? oldDate.toLocaleString() : 'TBD'} to ${newDate.toLocaleString()} on ${new Date().toLocaleString()}`
    updateData.notes = appointment.notes ? 
      `${appointment.notes}\n\n${rescheduleNote}` :
      rescheduleNote
    
    // Update Zoom meeting details if we updated/created a meeting
    if (updatedMeeting) {
      updateData.zoom_meeting_url = updatedMeeting.join_url
      updateData.zoom_start_url = updatedMeeting.start_url
      updateData.zoom_meeting_id = updatedMeeting.id
      updateData.zoom_meeting_password = updatedMeeting.password || ''
      updateData.calendly_meeting_location = 'Zoom Video Call'
      if (appointment.notes && !appointment.notes.includes('Zoom Meeting ID')) {
        updateData.notes = `${updateData.notes}\nZoom Meeting ID: ${updatedMeeting.id}\nMeeting Password: ${updatedMeeting.password || 'No password required'}`
      }
    }
    
    console.log('📋 Update data:', updateData)
    
    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (updateError) {
      console.error('❌ Error updating appointment:', updateError)
      return NextResponse.json(
        { error: 'Failed to update appointment' },
        { status: 500 }
      )
    }

    console.log('✅ Appointment updated successfully in database')

    // Step 3: Send email notification to patient
    try {
      const patientName = `${appointment.users?.first_name || ''} ${appointment.users?.last_name || ''}`.trim() || 'Patient'
      const doctorName = `${appointment.doctors?.first_name || ''} ${appointment.doctors?.last_name || ''}`.trim() || 'Doctor'
      
      // Format dates in doctor's timezone (New York)
      const formatDateInTimezone = (date: Date | null, timezone: string) => {
        if (!date) return 'TBD'
        return date.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      }
      
      const oldDateString = formatDateInTimezone(oldDate, doctorTimezone)
      const newDateString = formatDateInTimezone(newDate, doctorTimezone)

      console.log('📧 Sending reschedule email notification...', {
        patientEmail: appointment.users?.email,
        patientName,
        doctorName,
        oldDateString,
        newDateString
      })
      
      if (appointment.users?.email) {
        await sendAppointmentRescheduledEmail(
          appointment.users.email,
          patientName,
          doctorName,
          oldDateString,
          newDateString,
          updatedMeeting?.join_url || appointment.zoom_meeting_url
        )
        console.log('✅ Reschedule email sent successfully')
      } else {
        console.warn('⚠️ Patient email not found, skipping email notification')
      }
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError)
      // Don't fail the entire operation if email fails
    }

    // Step 4: Create notification for doctor
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: appointment.doctor_id,
          type: 'appointment_reminder',
          title: 'Appointment Rescheduled',
          message: `You have rescheduled an appointment with ${appointment.users?.first_name} ${appointment.users?.last_name} to ${newDate.toLocaleString()}`,
          is_read: false
        })
      console.log('✅ Notification created for doctor')
    } catch (notificationError) {
      console.error('❌ Notification creation failed:', notificationError)
    }

    // Step 5: Create notification for patient
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: appointment.user_id,
          type: 'appointment_reminder',
          title: 'Appointment Rescheduled',
          message: `Your appointment with ${appointment.doctors?.first_name} ${appointment.doctors?.last_name} has been rescheduled to ${newDate.toLocaleString()}`,
          is_read: false
        })
      console.log('✅ Notification created for patient')
    } catch (notificationError) {
      console.error('❌ Notification creation failed:', notificationError)
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: {
        appointmentId: appointment.id,
        oldDateTime: oldDate?.toISOString(),
        newDateTime: newDate.toISOString(),
        zoomMeetingUpdated: !!updatedMeeting,
        zoomMeeting: updatedMeeting ? {
          id: updatedMeeting.id,
          join_url: updatedMeeting.join_url,
          start_url: updatedMeeting.start_url
        } : null
      }
    })
  } catch (error: any) {
    console.error('❌ Error rescheduling appointment:', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { 
        error: 'Failed to reschedule appointment',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

