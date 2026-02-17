// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
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
 * Also handles the case where someone passes a drchrono_patient_id directly (integer).
 */
export async function getDrchronoPatientId(patientId: string): Promise<number | null> {
  try {
    // Check if patientId is actually a drchrono_patient_id (integer, not UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)

    if (!isUuid) {
      // It's likely a drchrono_patient_id directly — try parsing as integer
      const asInt = parseInt(patientId, 10)
      if (!isNaN(asInt) && asInt > 0) {
        // Verify it exists in drchrono_medications or drchrono_patients
        const { data: dcPatient } = await db
          .from('drchrono_patients')
          .select('drchrono_patient_id')
          .eq('drchrono_patient_id', asInt)
          .limit(1)
          .maybeSingle()
        if (dcPatient?.drchrono_patient_id) return dcPatient.drchrono_patient_id
        // Even if not in drchrono_patients, it may still be valid
        return asInt
      }
      return null
    }

    // Standard path: look up patient by UUID
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

/**
 * Resolve a patient UUID from any identifier (UUID or drchrono_patient_id).
 * This is the core function that prevents "invalid input syntax for type uuid" errors.
 */
export async function resolvePatientUuid(patientId: string): Promise<string | null> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)

    if (isUuid) {
      // Already a UUID — verify it exists
      const { data } = await db.from('patients').select('id').eq('id', patientId).maybeSingle()
      return data?.id || null
    }

    // It's an integer drchrono_patient_id — find the UUID
    const asInt = parseInt(patientId, 10)
    if (!isNaN(asInt) && asInt > 0) {
      const { data } = await db.from('patients').select('id').eq('drchrono_patient_id', asInt).limit(1).maybeSingle()
      return data?.id || null
    }
    return null
  } catch { return null }
}

/**
 * Master resolver: takes any patient_id input (UUID or drchrono integer)
 * and returns both the local UUID and the drchrono_patient_id.
 * This is the single function all panel routes should call.
 */
export async function resolvePatientIds(rawPatientId: string): Promise<{
  uuid: string | null
  dcId: number | null
}> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPatientId)

  if (isUuid) {
    const dcId = await getDrchronoPatientId(rawPatientId)
    return { uuid: rawPatientId, dcId }
  }

  // Not a UUID — try as drchrono_patient_id
  const asInt = parseInt(rawPatientId, 10)
  if (!isNaN(asInt) && asInt > 0) {
    const { data } = await db.from('patients').select('id').eq('drchrono_patient_id', asInt).limit(1).maybeSingle()
    return { uuid: data?.id || null, dcId: asInt }
  }

  return { uuid: null, dcId: null }
}

export { db }
