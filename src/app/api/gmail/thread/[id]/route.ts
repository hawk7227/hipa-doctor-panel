import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getThread, markAsRead } from '@/lib/gmail'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function getDoctorId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const sb = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user } } = await sb.auth.getUser(token)
  return user?.id || null
}

// GET /api/gmail/thread/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const doctorId = await getDoctorId(req)
    if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: threadId } = await params

    if (!threadId) {
      return NextResponse.json({ error: 'Missing thread ID' }, { status: 400 })
    }

    const messages = await getThread(doctorId, threadId)

    // Mark unread messages as read
    for (const msg of messages) {
      if (!msg.isRead) {
        try {
          await markAsRead(doctorId, msg.id)
        } catch {
          // silent
        }
      }
    }

    return NextResponse.json({ messages })
  } catch (err: any) {
    console.error('Gmail thread error:', err)
    if (err.message === 'Gmail not connected') {
      return NextResponse.json({ error: 'Gmail not connected', connected: false }, { status: 403 })
    }
    return NextResponse.json({ error: err.message || 'Failed to fetch thread' }, { status: 500 })
  }
}
