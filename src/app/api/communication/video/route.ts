import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { zoomService } from '@/lib/zoom'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    // Get user from cookies or Bearer token
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    // Check for Bearer token in header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // Create Supabase client with proper cookie handling
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Ignore cookie setting errors in API routes
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Ignore cookie removal errors in API routes
            }
          }
        }
      }
    )

    // Try to get user from Bearer token first
    let user = null
    let userError = null

    if (accessToken) {
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      // Fall back to cookie-based authentication
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      console.error('Video call auth error:', {
        message: userError?.message,
        status: userError?.status,
        hasAuthHeader: !!authHeader
      })
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'No user found' },
        { status: 401 }
      )
    }

    // Get doctor data including timezone
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', user.email!)
      .single()

    if (doctorError || !doctor) {
      console.error('Unauthorized: Doctor not found', {
        email: user.email,
        error: doctorError?.message
      })
      return NextResponse.json(
        { error: 'Doctor not found', details: doctorError?.message },
        { status: 401 }
      )
    }

    const { patientId, patientName } = await request.json()

    if (!patientName) {
      return NextResponse.json(
        { error: 'Patient name is required' },
        { status: 400 }
      )
    }

    console.log('📹 Creating video call meeting for:', {
      doctorId: doctor.id,
      patientId,
      patientName
    })

    // Use doctor's timezone for meeting, default to America/New_York
    const doctorTimezone = doctor.timezone || 'America/New_York'
    console.log('🌍 Using doctor timezone:', doctorTimezone)

    // Create Zoom meeting
    const startTime = new Date()
    startTime.setMinutes(startTime.getMinutes() + 5) // Start in 5 minutes

    try {
      const meeting = await zoomService.createMeeting({
        topic: `Consultation with ${patientName}`,
        start_time: startTime.toISOString(),
        duration: 30,
        timezone: doctorTimezone,
        password: Math.random().toString(36).substring(2, 8),
        waiting_room: true
      })

      console.log('✅ Zoom meeting created successfully:', {
        meetingId: meeting.id,
        hasJoinUrl: !!meeting.join_url,
        hasStartUrl: !!meeting.start_url
      })

      // Save to communication history
      if (patientId) {
        try {
          const { error: historyError } = await supabase.from('communication_history').insert({
            doctor_id: doctor.id,
            patient_id: patientId,
            type: 'video',
            direction: 'outbound',
            status: 'scheduled',
            meeting_url: meeting.join_url,
            meeting_id: meeting.id.toString()
          })

          if (historyError) {
            console.error('Error saving communication history:', historyError)
          } else {
            console.log('✅ Communication history saved')
          }
        } catch (error) {
          console.error('Error saving communication history:', error)
        }
      }

      return NextResponse.json({
        success: true,
        meeting: {
          id: meeting.id,
          join_url: meeting.join_url,
          start_url: meeting.start_url,
          password: meeting.password,
          topic: meeting.topic,
          start_time: meeting.start_time,
          duration: meeting.duration
        }
      })
    } catch (zoomError: any) {
      console.error('❌ Zoom meeting creation failed:', {
        message: zoomError.message,
        stack: zoomError.stack
      })
      return NextResponse.json(
        { 
          error: 'Failed to create meeting',
          details: zoomError.message || 'Zoom API error'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ Error creating video call:', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: error.message || 'Failed to create video call' },
      { status: 500 }
    )
  }
}

