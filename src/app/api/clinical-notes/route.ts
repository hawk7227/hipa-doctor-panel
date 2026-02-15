/**
 * API Route: Get Clinical Notes
 * 
 * Server-side fetch to bypass browser fetch delays.
 */

import { NextRequest, NextResponse } from 'next/server'

// Force Node.js runtime for better performance
export const runtime = 'nodejs'
// Disable dynamic rendering to avoid delays
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const startTime = performance.now()
  try {
   
 const { searchParams } = new URL(req.url)
    const appointmentId = searchParams.get('appointment_id')
    
    if (!appointmentId) {
      return NextResponse.json(
        { error: 'appointment_id is required' },
        { status: 400 }
      )
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const url = `${supabaseUrl}/rest/v1/clinical_notes?appointment_id=eq.${appointmentId}&select=*&order=created_at.asc`
    
    const fetchStart = performance.now()
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })
    const fetchEnd = performance.now()
    const fetchDuration = fetchEnd - fetchStart
    
    if (!response.ok) {
      const errorText = await response.text()
      const totalDuration = performance.now() - startTime
      console.log(`[API Route] clinical-notes ERROR: fetch=${fetchDuration.toFixed(1)}ms, total=${totalDuration.toFixed(1)}ms`)
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      )
    }
    
    const jsonStart = performance.now()
    const data = await response.json()
    const jsonEnd = performance.now()
    const jsonDuration = jsonEnd - jsonStart
    const totalDuration = performance.now() - startTime
    
    console.log(`[API Route] clinical-notes/${appointmentId}: fetch=${fetchDuration.toFixed(1)}ms, json=${jsonDuration.toFixed(1)}ms, total=${totalDuration.toFixed(1)}ms`)
    
    return NextResponse.json(
      { data, error: null },
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
    console.log(`[API Route] clinical-notes ERROR: ${error.message}, total=${totalDuration.toFixed(1)}ms`)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

