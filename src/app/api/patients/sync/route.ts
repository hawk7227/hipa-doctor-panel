// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { drchronoFetch } from '@/lib/drchrono'

// ═══════════════════════════════════════════════════════════════
// POST /api/patients/sync
// Auto-sync a patient into the main patients table
// Called when a patient is selected from search results
//
// Body: { drchrono_id: number } OR { patient_id: string }
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
    const { drchrono_id, patient_id } = body

    if (!drchrono_id && !patient_id) {
      return NextResponse.json({ error: 'drchrono_id or patient_id required' }, { status: 400 })
    }

    // If we have a local patient_id, just return it
    if (patient_id && !drchrono_id) {
      const { data } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', patient_id)
        .single()
      return NextResponse.json({ patient: data, synced: false })
    }

    // Fetch fresh data from DrChrono
    let drchronoPatient: any = null
    if (drchrono_id) {
      const res = await drchronoFetch(`patients/${drchrono_id}`)
      if (res.ok) {
        drchronoPatient = res.data
      } else {
        // Fallback: check drchrono_patients table
        const { data } = await supabaseAdmin
          .from('drchrono_patients')
          .select('*')
          .eq('drchrono_patient_id', drchrono_id)
          .single()
        if (data) {
          drchronoPatient = {
            id: data.drchrono_patient_id,
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            cell_phone: data.cell_phone,
            home_phone: data.home_phone,
            date_of_birth: data.date_of_birth,
            address: data.address,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
            default_pharmacy: data.default_pharmacy,
            gender: data.gender,
            chart_id: data.chart_id,
            preferred_language: data.preferred_language,
            emergency_contact_name: data.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone,
            primary_insurance: data.primary_insurance,
            secondary_insurance: data.secondary_insurance,
          }
        }
      }
    }

    if (!drchronoPatient) {
      return NextResponse.json({ error: 'Patient not found in DrChrono' }, { status: 404 })
    }

    // Build address string
    const addressParts = [
      drchronoPatient.address,
      drchronoPatient.city,
      drchronoPatient.state,
      drchronoPatient.zip_code,
    ].filter(Boolean)
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

    // Build pharmacy string
    const pharmacy = drchronoPatient.default_pharmacy
      ? String(drchronoPatient.default_pharmacy)
      : null

    // Check if patient already exists by drchrono_patient_id (exact match) or email
    let existingPatient: any = null

    // PRIORITY 1: Match by drchrono_patient_id (most reliable)
    if (drchronoPatient.id) {
      const { data } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('drchrono_patient_id', drchronoPatient.id)
        .limit(1)
        .maybeSingle()
      existingPatient = data
      if (existingPatient) {
        console.log(`[PatientSync] Matched by drchrono_patient_id: ${drchronoPatient.id} → ${existingPatient.id}`)
      }
    }

    // PRIORITY 2: Match by email + name (to avoid collisions with shared emails)
    if (!existingPatient && drchronoPatient.email) {
      const { data } = await supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name')
        .eq('email', drchronoPatient.email)
      
      if (data && data.length === 1) {
        existingPatient = data[0]
        console.log(`[PatientSync] Matched by email (unique): ${drchronoPatient.email} → ${existingPatient.id}`)
      } else if (data && data.length > 1) {
        // Multiple patients with same email — match by name too
        const nameMatch = data.find(p => 
          p.first_name?.toLowerCase() === drchronoPatient.first_name?.toLowerCase() &&
          p.last_name?.toLowerCase() === drchronoPatient.last_name?.toLowerCase()
        )
        existingPatient = nameMatch || null
        console.log(`[PatientSync] Multiple patients with email ${drchronoPatient.email} (${data.length}). Name match: ${nameMatch ? nameMatch.id : 'none — will create new'}`)
      }
    }

    // Upsert patient record
    const patientRecord = {
      first_name: drchronoPatient.first_name || '',
      last_name: drchronoPatient.last_name || '',
      email: drchronoPatient.email || null,
      phone: drchronoPatient.cell_phone || drchronoPatient.home_phone || null,
      mobile_phone: drchronoPatient.cell_phone || null,
      date_of_birth: drchronoPatient.date_of_birth || null,
      location: fullAddress,
      preferred_pharmacy: pharmacy,
      gender: drchronoPatient.gender || null,
      preferred_language: drchronoPatient.preferred_language || null,
      emergency_contact_name: drchronoPatient.emergency_contact_name || null,
      emergency_contact_phone: drchronoPatient.emergency_contact_phone || null,
      drchrono_chart_id: drchronoPatient.chart_id || String(drchronoPatient.id),
      drchrono_patient_id: drchronoPatient.id,
      last_synced_from_drchrono: new Date().toISOString(),
    }

    let patient: any
    if (existingPatient?.id) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('patients')
        .update(patientRecord)
        .eq('id', existingPatient.id)
        .select()
        .single()
      if (error) {
        console.error('[PatientSync] Update error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      patient = data
    } else {
      // Insert new
      const { data, error } = await supabaseAdmin
        .from('patients')
        .insert(patientRecord)
        .select()
        .single()
      if (error) {
        console.error('[PatientSync] Insert error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      patient = data
    }

    // Also update drchrono_patients table
    try {
      await supabaseAdmin
        .from('drchrono_patients')
        .upsert({
          drchrono_patient_id: drchronoPatient.id,
          first_name: drchronoPatient.first_name || '',
          last_name: drchronoPatient.last_name || '',
          email: drchronoPatient.email || null,
          cell_phone: drchronoPatient.cell_phone || null,
          home_phone: drchronoPatient.home_phone || null,
          date_of_birth: drchronoPatient.date_of_birth || null,
          address: drchronoPatient.address || null,
          city: drchronoPatient.city || null,
          state: drchronoPatient.state || null,
          zip_code: drchronoPatient.zip_code || null,
          chart_id: drchronoPatient.chart_id || null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'drchrono_patient_id' })
    } catch (err) {
      console.error('[PatientSync] drchrono_patients upsert error (non-fatal):', err)
    }

    return NextResponse.json({
      patient,
      synced: true,
      drchrono_id: drchronoPatient.id,
    })
  } catch (err: any) {
    console.error('[PatientSync] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
