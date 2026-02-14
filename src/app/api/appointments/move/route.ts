import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { zoomService } from '@/lib/zoom'
import { sendAppointmentRescheduledEmail } from '@/lib/email'

import { requireAuth } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  try {
   
  const auth = await requireAuth(req)
  if ('error' in auth && auth.error) return auth.error
  const request = req
 const { appointmentId, newTime } = await request.json()

    if (!appointmentId || !newTime) {
      return NextResponse.json(
        { error: 'Appointment ID and new time are required' },
        { status: 400 }
      )
    }

    // Get appointment details - FAST
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        doctors!appointments_doctor_id_fkey(timezone, first_name, last_name)
      `)
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    if (!appointment.requested_date_time) {
      return NextResponse.json(
        { error: 'Appointment does not have a scheduled time' },
        { status: 400 }
      )
    }

    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
    // This must match the calendar which always uses Phoenix timezone
    const doctorTimezone = PROVIDER_TIMEZONE
    const oldDateTimeUTC = new Date(appointment.requested_date_time) // UTC from DB
    
    // Parse new time (format: "HH:MM")
    const [hours, minutes] = newTime.split(':').map(Number)
    
    // Get old date components in doctor's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: doctorTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    const oldParts = formatter.formatToParts(oldDateTimeUTC)
    const getValue = (type: string) => oldParts.find(p => p.type === type)?.value || '0'
    
    const year = parseInt(getValue('year'))
    const month = parseInt(getValue('month')) - 1
    const day = parseInt(getValue('day'))
    
    // Validate same day (already have it from above)
    const oldDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    // Find UTC time that represents new time in doctor's timezone
    // Use brute force search (similar to convertDateTimeLocalToUTC)
    const approximateUTC = new Date(Date.UTC(year, month, day, hours, minutes, 0))
    let newDateTimeUTC: Date | null = null
    
    // Search for UTC time that formats to our target time in doctor's timezone
    for (let offsetHours = -12; offsetHours <= 12; offsetHours++) {
      const testUTC = new Date(approximateUTC.getTime() + offsetHours * 60 * 60 * 1000)
      const testParts = formatter.formatToParts(testUTC)
      const testYear = parseInt(testParts.find(p => p.type === 'year')?.value || '0')
      const testMonth = parseInt(testParts.find(p => p.type === 'month')?.value || '0') - 1
      const testDay = parseInt(testParts.find(p => p.type === 'day')?.value || '0')
      const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0')
      const testMinute = parseInt(testParts.find(p => p.type === 'minute')?.value || '0')
      
      if (testYear === year && testMonth === month && testDay === day && 
          testHour === hours && testMinute === minutes) {
        newDateTimeUTC = testUTC
        break
      }
    }
    
    if (!newDateTimeUTC) {
      // Fallback: use approximate
      newDateTimeUTC = approximateUTC
    }
    
    // Validate same day in doctor's timezone after conversion
    const newParts = formatter.formatToParts(newDateTimeUTC)
    const newYear = parseInt(newParts.find(p => p.type === 'year')?.value || '0')
    const newMonth = parseInt(newParts.find(p => p.type === 'month')?.value || '0') - 1
    const newDay = parseInt(newParts.find(p => p.type === 'day')?.value || '0')
    const newDateStr = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`
    
    if (oldDateStr !== newDateStr) {
      return NextResponse.json(
        { error: 'Move operation can only change time, not date. Use reschedule to change date.' },
        { status: 400 }
      )
    }

    // Update appointment immediately - FAST
    const moveNote = `Moved to ${newTime} on ${new Date().toLocaleString()}`
    const updateData: any = {
      requested_date_time: newDateTimeUTC.toISOString(),
      updated_at: new Date().toISOString(),
      notes: appointment.notes ? 
        `${appointment.notes}\n\n${moveNote}` :
        moveNote
    }
    
    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (updateError) {
      console.error('❌ Error updating appointment:', updateError)
      return NextResponse.json(
        { error: 'Failed to move appointment' },
        { status: 500 }
      )
    }

    // Update Zoom meeting asynchronously (don't wait)
    if (appointment.zoom_meeting_id && appointment.visit_type === 'video') {
      // Use zoomService directly instead of HTTP call
      zoomService.updateMeeting(appointment.zoom_meeting_id, {
        start_time: newDateTimeUTC.toISOString(),
        timezone: doctorTimezone
      }).catch(err => {
        console.error('Zoom update error:', err)
        // Don't fail the request if Zoom update fails
      })
    }

    // Send email and notifications asynchronously (don't wait)
    // Fetch patient details for email
    const { data: patientData } = await supabase
      .from('patients')
      .select('first_name, last_name, email')
      .eq('id', appointment.patient_id)
      .single()

    if (patientData?.email) {
      // Format dates in doctor's timezone
      const formatDateInTimezone = (date: Date, timezone: string) => {
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

      const patientName = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Patient'
      const doctorName = appointment.doctors ? 
        `Dr. ${appointment.doctors.first_name || ''} ${appointment.doctors.last_name || ''}`.trim() : 
        'Doctor'
      
      const oldDateString = formatDateInTimezone(oldDateTimeUTC, doctorTimezone)
      const newDateString = formatDateInTimezone(newDateTimeUTC, doctorTimezone)

      sendAppointmentRescheduledEmail(
        patientData.email,
        patientName,
        doctorName,
        oldDateString,
        newDateString,
        appointment.zoom_meeting_url || undefined
      ).catch(err => {
        console.error('Email send error:', err)
        // Don't fail the request if email fails
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment moved successfully',
      data: {
        appointmentId: appointment.id,
        oldDateTime: oldDateTimeUTC.toISOString(),
        newDateTime: newDateTimeUTC.toISOString()
      }
    })
  } catch (error: any) {
    console.error('❌ Error moving appointment:', error)
    return NextResponse.json(
      { 
        error: 'Failed to move appointment',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

