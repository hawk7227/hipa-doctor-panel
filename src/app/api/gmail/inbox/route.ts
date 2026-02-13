import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getInbox } from '@/lib/gmail'

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

// GET /api/gmail/inbox?maxResults=20&pageToken=xxx&q=search
export async function GET(req: NextRequest) {
  try {
    const doctorId = await getDoctorId(req)
    if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const maxResults = parseInt(req.nextUrl.searchParams.get('maxResults') || '20', 10)
    const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined
    const query = req.nextUrl.searchParams.get('q') || undefined

    const result = await getInbox(doctorId, { maxResults, pageToken, query })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Gmail inbox error:', err)
    if (err.message === 'Gmail not connected') {
      return NextResponse.json({ error: 'Gmail not connected', connected: false }, { status: 403 })
    }
    return NextResponse.json({ error: err.message || 'Failed to fetch inbox' }, { status: 500 })
  }
}
