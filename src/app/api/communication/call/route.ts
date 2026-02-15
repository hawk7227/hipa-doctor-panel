import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { twilioService } from '@/lib/twilio'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    // Get user from cookies
    const cookieStore = await cookies()
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get doctor data
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', user.email!)
      .single()

    if (doctorError || !doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 401 })
    }

    const { to, patientId } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Generate TwiML URL for call handling
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const twimlUrl = `${baseUrl}/api/communication/twiml/call?to=${encodeURIComponent(to)}`

    // Create call via Twilio
    const result = await twilioService.createCall(to, '', twimlUrl)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Save to communication history
    if (patientId) {
      try {
        await supabase.from('communication_history').insert({
          doctor_id: doctor.id,
          patient_id: patientId,
          type: 'call',
          direction: 'outbound',
          to_number: to,
          status: result.status || 'initiated',
          twilio_sid: result.callSid
        })
      } catch (error) {
        console.error('Error saving communication history:', error)
      }
    }

    return NextResponse.json({
      success: true,
      callSid: result.callSid,
      status: result.status
    })
  } catch (error: any) {
    console.error('Error creating call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create call' },
      { status: 500 }
    )
  }
}



