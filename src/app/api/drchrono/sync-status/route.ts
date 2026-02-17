// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ═══════════════════════════════════════════════════════════════════
// GET /api/drchrono/sync-status
// Returns recent sync history and current sync state.
// Query params: ?limit=10&sync_id=123
// ═══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {

    const syncId = req.nextUrl.searchParams.get('sync_id')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10)

    if (syncId) {
      // Get specific sync log
      const { data, error } = await supabaseAdmin
        .from('drchrono_sync_log')
        .select('*')
        .eq('id', parseInt(syncId, 10))
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Sync log not found' }, { status: 404 })
      }

      return NextResponse.json({ sync: data })
    }

    // Get recent sync logs
    const { data, error } = await supabaseAdmin
      .from('drchrono_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 50))

    if (error) {
      console.error('[SyncStatus] Error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 })
    }

    // Get record counts for each synced table
    const tableCounts: Record<string, number> = {}
    // Check ALL DrChrono tables
    const tables = [
      // Patient Core
      'drchrono_patients', 'drchrono_medications', 'drchrono_allergies',
      'drchrono_problems', 'drchrono_vaccines',
      // Clinical
      'drchrono_appointments', 'drchrono_clinical_notes', 'drchrono_lab_orders',
      'drchrono_lab_results', 'drchrono_lab_tests', 'drchrono_documents',
      // Practice
      'drchrono_doctors', 'drchrono_offices', 'drchrono_users',
      'drchrono_appointment_profiles', 'drchrono_tasks', 'drchrono_task_categories',
      'drchrono_messages', 'drchrono_reminder_profiles',
      // Communication
      'drchrono_amendments', 'drchrono_communications',
      // Billing
      'drchrono_patient_payments', 'drchrono_line_items', 'drchrono_transactions',
      // Custom
      'drchrono_custom_demographics',
      // Legacy (may exist from earlier migrations)
      'drchrono_procedures',
    ]

    for (const table of tables) {
      const { count, error: countErr } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!countErr && count !== null) {
        tableCounts[table] = count
      }
    }

    // Check DrChrono token health
    let tokenStatus: 'valid' | 'expired' | 'missing' = 'missing'
    try {
      const { data: tokenData } = await supabaseAdmin
        .from('drchrono_tokens')
        .select('access_token, expires_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      
      if (tokenData) {
        const expiresAt = new Date(tokenData.expires_at).getTime()
        tokenStatus = Date.now() < expiresAt - 60000 ? 'valid' : 'expired'
      }
    } catch {}

    return NextResponse.json({
      syncs: data || [],
      table_counts: tableCounts,
      last_sync: data && data.length > 0 ? data[0] : null,
      token_status: tokenStatus,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SyncStatus] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
