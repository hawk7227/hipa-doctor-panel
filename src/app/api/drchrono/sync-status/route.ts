import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ═══════════════════════════════════════════════════════════════════
// GET /api/drchrono/sync-status
// Returns recent sync history and current sync state.
// Query params: ?limit=10&sync_id=123
// ═══════════════════════════════════════════════════════════════════

import { requireAuth } from '@/lib/api-auth'
export async function GET(req: NextRequest) {
  try {
  const auth = await requireAuth(req)
  if ('error' in auth && auth.error) return auth.error

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
    const tables = [
      'drchrono_patients',
      'drchrono_medications',
      'drchrono_allergies',
      'drchrono_problems',
      'drchrono_appointments',
      'drchrono_clinical_notes',
      'drchrono_lab_orders',
      'drchrono_lab_results',
      'drchrono_vaccines',
      'drchrono_documents',
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

    return NextResponse.json({
      syncs: data || [],
      table_counts: tableCounts,
      last_sync: data && data.length > 0 ? data[0] : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SyncStatus] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
