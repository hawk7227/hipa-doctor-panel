// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    // Authentication
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

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
              // Ignore cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Ignore cookie removal errors
            }
          }
        }
      }
    )

    let user = null
    let userError = null

    if (accessToken) {
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    // Optimize: Fetch appointment and doctor in parallel, then check access
    const [appointmentResult, doctorResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('user_id, doctor_id')
        .eq('id', appointmentId)
        .single(),
      supabase
        .from('doctors')
        .select('id')
        .eq('email', user.email!)
        .single()
    ])

    const { data: appointment, error: appointmentError } = appointmentResult
    const { data: doctor } = doctorResult

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Check if user is the doctor or patient
    const isDoctor = doctor && appointment.doctor_id === doctor.id
    const isPatient = user.id === appointment.user_id

    if (!isDoctor && !isPatient) {
      return NextResponse.json(
        { error: 'Unauthorized to view messages' },
        { status: 403 }
      )
    }

    // Fetch messages (optimized query)
    const { data: messages, error } = await supabase
      .from('appointment_messages')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true })
      .limit(100) // Limit to prevent large responses

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('Error in messages API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    // Authentication
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

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
              // Ignore cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Ignore cookie removal errors
            }
          }
        }
      }
    )

    let user = null
    let userError = null

    if (accessToken) {
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { appointmentId, senderId, senderType, messageText, messageType } = body

    if (!appointmentId || !senderId || !senderType || !messageText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify user has access to this appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('user_id, doctor_id')
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Verify sender is authorized (doctor or patient)
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('email', user.email!)
      .single()

    const isDoctor = doctor && appointment.doctor_id === doctor.id && senderType === 'doctor' && senderId === doctor.id
    const isPatient = user.id === appointment.user_id && senderType === 'user' && senderId === user.id

    if (!isDoctor && !isPatient) {
      return NextResponse.json(
        { error: 'Unauthorized to send messages' },
        { status: 403 }
      )
    }

    const { data: messageData, error } = await supabase
      .from('appointment_messages')
      .insert({
        appointment_id: appointmentId,
        sender_id: senderId,
        sender_type: senderType,
        message_text: messageText,
        message_type: messageType || 'text',
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating message:', error)
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: messageData })
  } catch (error) {
    console.error('Error in messages API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
