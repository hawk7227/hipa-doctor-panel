import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Authenticate API caller from session cookie or Authorization header.
 * Returns { userId, email, doctorId } or a 401 NextResponse.
 */
export async function requireAuth(req?: NextRequest): Promise<
  { userId: string; email: string; doctorId: string | null } | NextResponse
> {
  try {
    let accessToken: string | null = null

    // 1. Check Authorization header
    const authHeader = req?.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // 2. Check cookies
    if (!accessToken) {
      const cookieStore = await cookies()
      const allCookies = cookieStore.getAll()
      
      // Find auth token cookie (may be chunked)
      const tokenCookie = allCookies.find(c => c.name.includes('auth-token') && !c.name.includes('.'))
      const chunks = allCookies.filter(c => c.name.includes('auth-token.')).sort((a, b) => a.name.localeCompare(b.name))
      
      const raw = tokenCookie?.value || (chunks.length > 0 ? chunks.map(c => c.value).join('') : null)
      
      if (raw) {
        try {
          const decoded = Buffer.from(raw, 'base64').toString()
          const parsed = JSON.parse(decoded)
          accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token || parsed
        } catch {
          accessToken = raw
        }
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized - invalid session' }, { status: 401 })
    }

    // Look up doctor
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('email', user.email).single()

    return { userId: user.id, email: user.email, doctorId: doctor?.id || null }
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}

/**
 * Require the caller to be a doctor.
 */
export async function requireDoctor(req?: NextRequest): Promise<
  { userId: string; email: string; doctorId: string } | NextResponse
> {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.doctorId) return NextResponse.json({ error: 'Forbidden - not a doctor' }, { status: 403 })
  return { ...auth, doctorId: auth.doctorId }
}
