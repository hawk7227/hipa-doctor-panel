/**
 * API Route: Get Appointment Details
 * 
 * This bypasses browser fetch issues by using server-side fetch.
 * Browser fetch is taking 6-29 seconds, but server-side should be fast.
 */

import { NextRequest, NextResponse } from 'next/server'

// Force Node.js runtime for better performance
export const runtime = 'nodejs'
// Disable dynamic rendering to avoid delays
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = performance.now()
  try {

    const { id: appointmentId } = await params
    
    // Validate appointmentId
    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid appointment ID', data: null },
        { status: 400 }
      )
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error('[API Route] Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error', data: null },
        { status: 500 }
      )
    }
    
    // Build query with joins
    const select = `*,doctors!appointments_doctor_id_fkey(first_name,last_name,specialty,timezone),patients!appointments_patient_id_fkey(id,first_name,last_name,email,phone,date_of_birth,location,allergies,current_medications,active_problems,recent_surgeries_details,ongoing_medical_issues_details,vitals_bp,vitals_hr,vitals_temp,preferred_pharmacy,chief_complaint,ros_general,has_drug_allergies,has_ongoing_medical_issues,has_recent_surgeries)`
    const url = `${supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}&select=${encodeURIComponent(select)}&limit=1`
    
    const fetchStart = performance.now()
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      })
    } catch (fetchError: any) {
      // Network or fetch errors
      console.error(`[API Route] appointments/${appointmentId} FETCH ERROR:`, fetchError.message)
      return NextResponse.json(
        { error: 'Failed to fetch appointment data', data: null },
        { status: 500 }
      )
    }
    
    const fetchEnd = performance.now()
    const fetchDuration = fetchEnd - fetchStart
    
    if (!response.ok) {
      let errorText = 'Unknown error'
      try {
        errorText = await response.text()
      } catch (e) {
        // If we can't read error text, use status text
        errorText = response.statusText || 'Unknown error'
      }
      
      const totalDuration = performance.now() - startTime
      console.error(`[API Route] appointments/${appointmentId} ERROR (${response.status}): ${errorText.substring(0, 200)}`)
      
      // Return appropriate status code, don't always return 500
      return NextResponse.json(
        { error: errorText, data: null },
        { status: response.status >= 400 && response.status < 600 ? response.status : 500 }
      )
    }
    
    let data: any
    try {
      data = await response.json()
    } catch (jsonError: any) {
      console.error(`[API Route] appointments/${appointmentId} JSON PARSE ERROR:`, jsonError.message)
      return NextResponse.json(
        { error: 'Failed to parse response data', data: null },
        { status: 500 }
      )
    }
    
    const jsonEnd = performance.now()
    const jsonDuration = jsonEnd - fetchEnd
    
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null
    const totalDuration = performance.now() - startTime
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Route] appointments/${appointmentId}: fetch=${fetchDuration.toFixed(1)}ms, json=${jsonDuration.toFixed(1)}ms, total=${totalDuration.toFixed(1)}ms`)
    }
    
    return NextResponse.json(
      { data: result, error: null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        }
      }
    )
  } catch (error: any) {
    const totalDuration = performance.now() - startTime
    console.error(`[API Route] appointments UNEXPECTED ERROR:`, error.message || error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error', data: null },
      { status: 500 }
    )
  }
}

