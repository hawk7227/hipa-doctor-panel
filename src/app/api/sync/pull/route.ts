// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// SYNC PULL API — Returns records updated since a given timestamp
//
// GET /api/sync/pull?table=patients&since=2024-01-01T00:00:00Z
// Returns: { records: [...], count, timestamp, hasMore }
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Client table name → { supabase table, select fields, page size }
const TABLE_CONFIG: Record<string, { table: string; select: string; pageSize: number }> = {
  patients: {
    table: 'patients',
    select: 'id, user_id, first_name, last_name, email, phone, date_of_birth, location, timezone, preferred_pharmacy, allergies, current_medications, active_problems, chief_complaint, ros_general, vitals_bp, vitals_hr, vitals_temp, has_drug_allergies, has_recent_surgeries, recent_surgeries_details, has_ongoing_medical_issues, ongoing_medical_issues_details, sms_enabled, email_enabled, call_enabled, drchrono_patient_id, created_at, updated_at',
    pageSize: 500,
  },
  appointments: {
    table: 'appointments',
    select: 'id, doctor_id, patient_id, service_type, status, visit_type, requested_date_time, payment_intent_id, payment_status, patient_first_name, patient_last_name, patient_email, patient_phone, symptoms, chief_complaint, preferred_pharmacy, pharmacy_address, daily_room_name, daily_room_url, chart_locked, consent_accepted, notes, drchrono_appointment_id, created_at, updated_at',
    pageSize: 200,
  },
  clinicalNotes: {
    table: 'clinical_notes',
    select: '*',
    pageSize: 200,
  },
  medications: {
    table: 'medication_history',
    select: '*',
    pageSize: 500,
  },
  allergies: {
    table: 'patient_allergies',
    select: '*',
    pageSize: 500,
  },
  messages: {
    table: 'appointment_messages',
    select: '*',
    pageSize: 200,
  },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const table = searchParams.get('table')
    const since = searchParams.get('since') || '2020-01-01T00:00:00Z'

    if (!table || !TABLE_CONFIG[table]) {
      return NextResponse.json(
        { error: `Unknown table: ${table}. Valid: ${Object.keys(TABLE_CONFIG).join(', ')}` },
        { status: 400 }
      )
    }

    const config = TABLE_CONFIG[table]

    const { data: records, error } = await db
      .from(config.table)
      .select(config.select)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(config.pageSize)

    if (error) {
      console.error(`[Sync:Pull] ${table} error:`, error.message)
      // Return empty instead of 500 — table may not exist yet
      return NextResponse.json({ records: [], count: 0, timestamp: since, hasMore: false })
    }

    const count = records?.length || 0
    const timestamp = count > 0 ? (records as any[])[count - 1].updated_at : since
    const hasMore = count === config.pageSize

    return NextResponse.json({ records: records || [], count, timestamp, hasMore })
  } catch (err: any) {
    console.error('[Sync:Pull] Fatal:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
