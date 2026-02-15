import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Authenticate the calling doctor from the Supabase session cookie.
 * Returns { doctorId, email } or a 401 NextResponse.
 */
export async function authenticateDoctor(req?: NextRequest): Promise<
  { doctorId: string; email: string } | NextResponse
> {
  try {
    // Create a client using the user's session
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    // Find the Supabase auth token from cookies
    const authCookie = allCookies.find(c => 
      c.name.includes('sb-') && c.name.includes('-auth-token')
    )
    
    if (!authCookie) {
      // Fallback: check Authorization header
      const authHeader = req?.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user }, error } = await db.auth.getUser(token)
        if (error || !user?.email) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { data: doctor } = await db.from('doctors').select('id').eq('email', user.email).single()
        if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 403 })
        return { doctorId: doctor.id, email: user.email }
      }
      
      // Try parsing cookie value that might be JSON array
      // Supabase stores tokens as base64 JSON in cookies
      const tokenCookie = allCookies.find(c => c.name.includes('auth-token'))
      if (!tokenCookie) {
        return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 })
      }
    }

    // Parse the session from cookies - Supabase stores as JSON array [access, refresh]
    let accessToken: string | null = null
    const tokenCookie = authCookie || allCookies.find(c => c.name.includes('auth-token'))
    
    if (tokenCookie) {
      try {
        // Could be base64-encoded JSON array
        const decoded = Buffer.from(tokenCookie.value, 'base64').toString()
        const parsed = JSON.parse(decoded)
        accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token || parsed
      } catch {
        // Could be just the plain token
        accessToken = tokenCookie.value
      }
    }

    // Also check chunked cookies (sb-xxx-auth-token.0, sb-xxx-auth-token.1, etc.)
    if (!accessToken) {
      const chunks = allCookies
        .filter(c => c.name.includes('auth-token.'))
        .sort((a, b) => a.name.localeCompare(b.name))
      if (chunks.length > 0) {
        const combined = chunks.map(c => c.value).join('')
        try {
          const decoded = Buffer.from(combined, 'base64').toString()
          const parsed = JSON.parse(decoded)
          accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token || parsed
        } catch {
          accessToken = combined
        }
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    const { data: { user }, error } = await db.auth.getUser(accessToken)
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized - invalid session' }, { status: 401 })
    }

    const { data: doctor } = await db.from('doctors').select('id').eq('email', user.email).single()
    if (!doctor) {
      return NextResponse.json({ error: 'Forbidden - not a doctor' }, { status: 403 })
    }

    return { doctorId: doctor.id, email: user.email }
  } catch (err) {
    console.error('[auth] Error:', err)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}

/**
 * Resolve drchrono_patient_id from a local patient UUID.
 * 1. Check patients.drchrono_patient_id
 * 2. Fallback: match by email in drchrono_patients table
 * Returns null if not found.
 */
export async function getDrchronoPatientId(patientId: string): Promise<number | null> {
  try {
    // Primary: check patients table
    const { data: patient } = await db
      .from('patients')
      .select('drchrono_patient_id, email')
      .eq('id', patientId)
      .single()

    if (patient?.drchrono_patient_id) {
      return patient.drchrono_patient_id
    }

    // Fallback: match by email in drchrono_patients
    if (patient?.email) {
      const { data: dcPatient } = await db
        .from('drchrono_patients')
        .select('drchrono_patient_id')
        .eq('email', patient.email)
        .limit(1)
        .single()

      if (dcPatient?.drchrono_patient_id) {
        return dcPatient.drchrono_patient_id
      }
    }

    return null
  } catch {
    return null
  }
}

export { db }
