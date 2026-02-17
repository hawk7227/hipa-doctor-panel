// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'

export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'

// POST /api/drchrono/sync-all
// Triggers full sync of ALL 25 DrChrono entity types
// Calls cron-sync internally, bypassing CRON_SECRET check
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;

  // Build the internal URL
  const origin = req.nextUrl.origin
  const cronSecret = process.env.CRON_SECRET || 'admin-triggered'

  try {
    const res = await fetch(`${origin}/api/drchrono/cron-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        error: data.error || 'Sync failed',
        hint: res.status === 401 ? 'DrChrono token may be expired. Visit /api/drchrono/auth to re-authorize.' : undefined,
      }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[SyncAll] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
