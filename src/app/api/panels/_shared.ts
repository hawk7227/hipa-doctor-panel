import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Admin client (service role - bypasses RLS)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Authenticate the calling doctor using Supabase SSR cookie handling.
 * Returns { doctorId, email } or a 401 NextResponse.
 */
export async function authenticateDoctor(req?: NextRequest): Promise<
  { doctorId: string; email: string } | NextResponse
> {
  try {
    const cookieStore = await cookies()

    // Create a Supabase server client that reads auth from cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user?.email) {
      // Fallback: check Authorization header
      if (req) {
        const authHeader = req.headers.get('authorization')
        if (authHeader?.startsWith('Bearer ')) {
          const { data: { user: headerUser }, error: hErr } = await db.auth.getUser(authHeader.substring(7))
          if (!hErr && headerUser?.email) {
            const { data: doc } = await db.from('doctors').select('id').eq('email', headerUser.email).single()
            if (doc) return { doctorId: doc.id, email: headerUser.email }
          }
        }
      }
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 })
    }

    const { data: doctor } = await db.from('doctors').select('id').eq('email', user.email).single()
    if (!doctor) {
      return NextResponse.json({ error: 'Forbidden - not a doctor' }, { status: 403 })
    }

    return { doctorId: doctor.id, email: user.email }
  } catch (err) {
    console.error('[authenticateDoctor]', err)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}

/**
 * Resolve drchrono_patient_id from a local patient UUID.
 */
export async function getDrchronoPatientId(patientId: string): Promise<number | null> {
  try {
    const { data: patient } = await db
      .from('patients')
      .select('drchrono_patient_id, email')
      .eq('id', patientId)
      .single()

    if (patient?.drchrono_patient_id) return patient.drchrono_patient_id

    if (patient?.email) {
      const { data: dcPatient } = await db
        .from('drchrono_patients')
        .select('drchrono_patient_id')
        .eq('email', patient.email)
        .limit(1)
        .single()
      if (dcPatient?.drchrono_patient_id) return dcPatient.drchrono_patient_id
    }
    return null
  } catch { return null }
}

export { db }
