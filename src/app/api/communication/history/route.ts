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
      console.error('History auth error:', userError)
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
        error: 'Doctor profile not found' 
      }, { status: 404 })
    }

    console.log('📋 Fetching communication history for doctor:', doctor.id)

      // Fetch communication history with patient info
      // recording_url column now exists, so we can include it directly
      const { data: history, error } = await supabase
        .from('communication_history')
        .select(`
          id,
          type,
          direction,
          to_number,
          from_number,
          message,
          status,
          duration,
          twilio_sid,
          meeting_url,
          meeting_id,
          recording_url,
          created_at,
          updated_at,
          users!communication_history_patient_id_fkey(
            id,
            first_name,
            last_name,
            mobile_phone,
            email
          )
        `)
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('❌ Error fetching communication history:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to fetch communication history',
          details: error
        }, { status: 500 })
      }

      const recordingCount = history?.filter((h: any) => h.recording_url).length || 0
      if (recordingCount > 0) {
        console.log(`✅ Fetched ${recordingCount} records with recording URLs`)
      }

      console.log(`✅ Fetched ${history?.length || 0} communication history records`)

      return NextResponse.json({ 
        success: true,
        history: history || []
      })
  } catch (error: any) {
    console.error('❌ Error in history API:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch history'
    }, { status: 500 })
  }
}

