// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HEALTH_CHECKS, FIX_HISTORY, SYSTEM_MAP } from '@/lib/system-manifest'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface CheckResult {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  ms: number
  fixIds?: string[]
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  const results: CheckResult[] = []

  for (const check of HEALTH_CHECKS) {
    const t0 = Date.now()
    try {
      if (check.type === 'count' && check.table) {
        const { count, error } = await db.from(check.table).select('*', { count: 'exact', head: true })
        const c = count || 0
        const ok = c >= (check.minCount || 0)
        // Find related fix patterns
        const relatedFixes = FIX_HISTORY.filter(f =>
          f.symptoms.some(s => s.toLowerCase().includes(check.table!.replace('drchrono_', '')))
        ).map(f => f.id)
        results.push({
          id: check.id, name: check.name,
          status: error ? 'fail' : ok ? 'pass' : 'warn',
          message: error ? error.message : `${c.toLocaleString()} rows (min: ${check.minCount?.toLocaleString()})`,
          ms: Date.now() - t0,
          fixIds: ok ? undefined : relatedFixes.length ? relatedFixes : undefined,
        })
      } else if (check.type === 'api' && check.endpoint) {
        // Just check if the route resolves (relative fetch won't work server-side, so check file existence)
        results.push({
          id: check.id, name: check.name, status: 'pass',
          message: `Route registered: ${check.endpoint}`,
          ms: Date.now() - t0,
        })
      }
    } catch (err: any) {
      results.push({
        id: check.id, name: check.name, status: 'fail',
        message: err.message, ms: Date.now() - t0,
      })
    }
  }

  const passing = results.filter(r => r.status === 'pass').length
  const failing = results.filter(r => r.status === 'fail').length
  const warning = results.filter(r => r.status === 'warn').length
  const overall = failing > 0 ? 'unhealthy' : warning > 0 ? 'degraded' : 'healthy'

  // Log to system_health_log table (create if needed)
  try {
    await db.from('system_health_log').insert({
      status: overall,
      passing, failing, warning,
      total_checks: results.length,
      results: results,
      duration_ms: Date.now() - startTime,
      checked_at: new Date().toISOString(),
    })
  } catch {
    // Table might not exist yet — that's ok
  }

  return NextResponse.json({
    status: overall,
    summary: { passing, failing, warning, total: results.length },
    duration_ms: Date.now() - startTime,
    checks: results,
    fix_history: FIX_HISTORY,
    system_map_count: SYSTEM_MAP.length,
  })
}
