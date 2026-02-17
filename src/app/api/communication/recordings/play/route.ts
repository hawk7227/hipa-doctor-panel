// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''

/**
 * Proxy endpoint to serve Twilio recordings with authentication
 * GET /api/communication/recordings/play?recordingSid={sid}
 * This endpoint authenticates the request and streams the audio
 */
export async function GET(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url)
    const recordingSid = searchParams.get('recordingSid')

    if (!recordingSid) {
      return NextResponse.json({
        error: 'Recording SID is required'
      }, { status: 400 })
    }

    // Authenticate user
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
          }
        }
      }
    )

    let user = null
    if (accessToken) {
      const { data } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
    } else {
      const { data } = await supabaseClient.auth.getUser()
      user = data?.user
    }

    if (!user) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Verify the recording belongs to a call by this doctor
    const { data: callRecord } = await supabase
      .from('communication_history')
      .select('id, doctor_id, twilio_sid, recording_url')
      .eq('recording_url', `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`)
      .single()

    if (!callRecord) {
      // Try alternative format
      const { data: altRecord } = await supabase
        .from('communication_history')
        .select('id, doctor_id, twilio_sid, recording_url')
        .like('recording_url', `%${recordingSid}%`)
        .single()

      if (!altRecord) {
        return NextResponse.json({
          error: 'Recording not found or access denied'
        }, { status: 404 })
      }
    }

    // Get doctor to verify access
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('email', user.email!)
      .single()

    if (!doctor || (callRecord && callRecord.doctor_id !== doctor.id)) {
      return NextResponse.json({
        error: 'Access denied'
      }, { status: 403 })
    }

    // Fetch recording from Twilio using authenticated request
    const client = twilio(accountSid, authToken)
    
    try {
      // Get the recording URI with authentication
      const recording = await client.recordings(recordingSid).fetch()
      
      // Construct authenticated URL
      const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`
      
      // Fetch the actual audio file with authentication
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const audioResponse = await fetch(recordingUrl, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      })

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch recording: ${audioResponse.statusText}`)
      }

      const audioBuffer = await audioResponse.arrayBuffer()

      // Return the audio file with proper headers
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': 'bytes'
        }
      })
    } catch (twilioError: any) {
      console.error('Error fetching recording from Twilio:', twilioError)
      return NextResponse.json({
        error: 'Failed to fetch recording from Twilio'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error in recording playback API:', error)
    return NextResponse.json({
      error: error.message || 'Failed to serve recording'
    }, { status: 500 })
  }
}





















