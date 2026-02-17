// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST /api/system-health/log
// Body: { type: 'fix' | 'build' | 'change', title, description, files_changed, fix_id? }
// Auto-saves to system_fix_log for permanent history
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, title, description, files_changed, fix_id, severity, category } = body

    if (!title || !type) {
      return NextResponse.json({ error: 'title and type required' }, { status: 400 })
    }

    const entry = {
      fixes_attempted: 1,
      fixes_applied: 1,
      triggered_by: `${type}: ${title}`,
      results: [{
        type,
        title,
        description: description || '',
        files_changed: files_changed || [],
        fix_id: fix_id || null,
        severity: severity || 'medium',
        category: category || 'general',
        timestamp: new Date().toISOString(),
      }],
      created_at: new Date().toISOString(),
    }

    const { error } = await db.from('system_fix_log').insert(entry)

    if (error) {
      console.error('Failed to log:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logged: entry.triggered_by })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/system-health/log — retrieve recent logs
export async function GET() {
  try {
    const { data, error } = await db
      .from('system_fix_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ logs: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
