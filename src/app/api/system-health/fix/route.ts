import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FIX_HISTORY } from '@/lib/system-manifest'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { fixId, runAll } = body
  const results: any[] = []

  const fixesToRun = runAll
    ? FIX_HISTORY.filter(f => f.sqlFix)
    : FIX_HISTORY.filter(f => f.id === fixId && f.sqlFix)

  if (fixesToRun.length === 0) {
    return NextResponse.json({ error: 'No applicable fixes found', fixId, runAll }, { status: 400 })
  }

  for (const fix of fixesToRun) {
    const t0 = Date.now()
    try {
      if (fix.sqlFix) {
        // Split multi-statement SQL and run each
        const statements = fix.sqlFix.split(';').map(s => s.trim()).filter(Boolean)
        let applied = 0
        let errors: string[] = []
        for (const sql of statements) {
          const { error } = await db.rpc('exec_sql', { sql_text: sql }).catch(() => ({ error: { message: 'rpc not available' } }))
          // If rpc doesn't exist, try direct
          if (error?.message === 'rpc not available') {
            // Can't run raw SQL without rpc — log it
            errors.push(`Cannot run: ${sql.substring(0, 60)}...`)
          } else if (error) {
            errors.push(error.message)
          } else {
            applied++
          }
        }
        results.push({
          fixId: fix.id, title: fix.title, severity: fix.severity,
          status: errors.length === 0 ? 'applied' : applied > 0 ? 'partial' : 'failed',
          statements: statements.length, applied, errors,
          ms: Date.now() - t0,
        })
      }
    } catch (err: any) {
      results.push({
        fixId: fix.id, title: fix.title, status: 'error', message: err.message,
        ms: Date.now() - t0,
      })
    }
  }

  // Log fix attempt
  try {
    await db.from('system_fix_log').insert({
      fixes_attempted: results.length,
      fixes_applied: results.filter(r => r.status === 'applied').length,
      results,
      triggered_by: runAll ? 'auto-fix-all' : `manual-${fixId}`,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Table might not exist yet
  }

  return NextResponse.json({
    success: true,
    fixes_attempted: results.length,
    fixes_applied: results.filter(r => r.status === 'applied').length,
    results,
  })
}
