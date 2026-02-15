import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { clicksendService } from '@/lib/clicksend'
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
      console.error('SMS auth error:', userError)
      return NextResponse.json({
        success: false,
        error: 'Unauthorized. Please log in again.'
      }, { status: 401 })
    }

    // Get doctor data
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id, email')
      .eq('email', user.email!)
      .single()

    if (doctorError || !doctor) {
      console.error('Doctor lookup error:', doctorError)
      return NextResponse.json({
        success: false,
        error: 'Doctor profile not found. Please complete your profile.'
      }, { status: 404 })
    }

    const { to, message, patientId } = await request.json()

    if (!to || !message) {
      return NextResponse.json({
        success: false,
        error: 'Phone number and message are required'
      }, { status: 400 })
    }

    // Format phone number (ensure it starts with +)
    let formattedTo = to.trim()
    if (!formattedTo.startsWith('+')) {
      // If no country code, assume it needs one
      console.warn('⚠️ Phone number missing country code, adding +:', formattedTo)
      formattedTo = `+${formattedTo}`
    }

    // Validate phone number format (basic check)
    if (formattedTo.length < 10 || formattedTo.length > 16) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phone number format. Please include country code (e.g., +1234567890)'
      }, { status: 400 })
    }

    console.log('📱 Sending SMS:', {
      to: formattedTo,
      messageLength: message.length,
      doctorId: doctor.id,
      patientId: patientId || 'none'
    })

    // Send SMS via ClickSend
    const result = await clicksendService.sendSMS(formattedTo, message)

    if (!result.success) {
      console.error('❌ ClickSend SMS error:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send SMS. Please check your ClickSend configuration.'
      }, { status: 500 })
    }

    console.log('✅ SMS sent successfully:', {
      messageId: result.messageId,
      status: result.status
    })

    // Save to communication history
    try {
      const { error: historyError } = await supabase.from('communication_history').insert({
        doctor_id: doctor.id,
        patient_id: patientId || null,
        type: 'sms',
        direction: 'outbound',
        to_number: formattedTo,
        message: message,
        status: result.status || 'sent',
        twilio_sid: result.messageId // Mapping ClickSend ID to twilio_sid column as per schema
      })

      if (historyError) {
        console.error('⚠️ Error saving communication history:', historyError)
        // Don't fail the request if history save fails
      } else {
        console.log('✅ Communication history saved')
      }
    } catch (error: any) {
      console.error('⚠️ Error saving communication history:', error)
      // Don't fail the request if history save fails
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      message: 'SMS sent successfully'
    })
  } catch (error: any) {
    console.error('❌ Error sending SMS:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send SMS. Please try again.'
    }, { status: 500 })
  }
}

