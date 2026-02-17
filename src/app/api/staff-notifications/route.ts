// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch notifications
export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

    let query = supabaseAdmin
      .from('staff_notifications')
      .select('*')
      .eq('recipient_id', staffId)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (unreadOnly) query = query.eq('is_read', false)

    const { data: notifications, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also get unread count
    const { count } = await supabaseAdmin
      .from('staff_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', staffId)
      .eq('is_read', false)
      .eq('is_dismissed', false)

    return NextResponse.json({ notifications: notifications || [], unreadCount: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Mark read, dismiss, create
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json()
    const { action, staffId } = body

    if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

    if (action === 'mark_read') {
      const { notificationId } = body
      if (notificationId) {
        await supabaseAdmin.from('staff_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId)
      } else {
        // Mark all as read
        await supabaseAdmin.from('staff_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('recipient_id', staffId)
          .eq('is_read', false)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'dismiss') {
      const { notificationId } = body
      await supabaseAdmin.from('staff_notifications')
        .update({ is_dismissed: true })
        .eq('id', notificationId)
      return NextResponse.json({ success: true })
    }

    if (action === 'create') {
      const { doctorId, recipientId, type, title, body: notifBody, link, referenceType, referenceId } = body
      const { data, error } = await supabaseAdmin.from('staff_notifications').insert({
        doctor_id: doctorId,
        recipient_id: recipientId,
        type, title, body: notifBody, link,
        reference_type: referenceType,
        reference_id: referenceId
      }).select().single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ notification: data })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
