// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// POST /api/patients/sync
// Fetch a patient record from the patients table
// Called when a patient is selected from search results
//
// Body: { patient_id: string }
// ═══════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { patient_id } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }

    // Fetch the patient record
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', patient_id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ patient: data, synced: false })
  } catch (err: any) {
    console.error('[PatientSync] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
