// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ═══════════════════════════════════════════════════════════════
// SYNC PUSH API — Receives queued changes from client devices
//
// POST /api/sync/push
// Body: { changes: [{ table, record_id, action, data, device_id }] }
//
// Applies to Supabase with last-write-wins conflict resolution
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Client table names → Supabase table names
const TABLE_MAP: Record<string, string> = {
  patients: 'patients',
  appointments: 'appointments',
  clinicalNotes: 'clinical_notes',
  medications: 'medication_history',
  allergies: 'patient_allergies',
  messages: 'appointment_messages',
  documents: 'appointment_documents',
}

// Fields to strip before Supabase write (local-only metadata)
const LOCAL_FIELDS = ['_synced', '_device_id']

function cleanRecord(data: any): Record<string, any> {
  const cleaned = typeof data === 'string' ? JSON.parse(data) : { ...data }
  for (const f of LOCAL_FIELDS) delete cleaned[f]
  return cleaned
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const changes = body?.changes

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: 'Expected { changes: [...] }' }, { status: 400 })
    }

    const results: { record_id: string; status: 'ok' | 'error' | 'skipped'; error?: string }[] = []

    for (const change of changes) {
      const { table, record_id, action, data, device_id } = change
      const supaTable = TABLE_MAP[table]

      if (!supaTable) {
        results.push({ record_id, status: 'error', error: `Unknown table: ${table}` })
        continue
      }

      try {
        const record = cleanRecord(data)

        if (action === 'create') {
          const { error } = await db.from(supaTable).upsert(record, { onConflict: 'id' })
          results.push(error
            ? { record_id, status: 'error', error: error.message }
            : { record_id, status: 'ok' }
          )

        } else if (action === 'update') {
          // Last-write-wins: check if server has newer
          const { data: existing } = await db.from(supaTable)
            .select('updated_at')
            .eq('id', record_id)
            .single()

          if (existing?.updated_at && existing.updated_at > record.updated_at) {
            // Server is newer — skip client update
            results.push({ record_id, status: 'skipped' })
          } else {
            const { error } = await db.from(supaTable).upsert(record, { onConflict: 'id' })
            results.push(error
              ? { record_id, status: 'error', error: error.message }
              : { record_id, status: 'ok' }
            )
          }

        } else if (action === 'delete') {
          const { error } = await db.from(supaTable).delete().eq('id', record_id)
          results.push(error
            ? { record_id, status: 'error', error: error.message }
            : { record_id, status: 'ok' }
          )
        }
      } catch (err: any) {
        results.push({ record_id, status: 'error', error: err.message })
      }
    }

    const ok = results.filter(r => r.status === 'ok').length
    const errors = results.filter(r => r.status === 'error').length
    console.log(`[Sync:Push] ${changes.length} changes → ${ok} ok, ${errors} errors`)

    return NextResponse.json({ results, processed: changes.length, ok, errors })
  } catch (err: any) {
    console.error('[Sync:Push] Fatal:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
