// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUrl, getStoredTokens, deleteTokens, getGmailProfile } from '@/lib/gmail'

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

// GET /api/gmail/auth — initiate OAuth or return status
export async function GET(req: NextRequest) {
  try {
    const doctorId = await getDoctorId(req)
    if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const action = req.nextUrl.searchParams.get('action')

    // Check connection status
    if (action === 'status') {
      const tokens = await getStoredTokens(doctorId)
      if (!tokens) {
        return NextResponse.json({ connected: false })
      }
      try {
        const profile = await getGmailProfile(doctorId)
        return NextResponse.json({
          connected: true,
          email: profile?.email || tokens.gmail_address,
        })
      } catch {
        return NextResponse.json({ connected: true, email: tokens.gmail_address })
      }
    }

    // Disconnect
    if (action === 'disconnect') {
      await deleteTokens(doctorId)
      return NextResponse.json({ disconnected: true })
    }

    // Start OAuth
    const authUrl = getAuthUrl(doctorId)
    return NextResponse.json({ authUrl })
  } catch (err: any) {
    console.error('Gmail auth error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
