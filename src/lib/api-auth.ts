// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Authenticate API caller using Supabase SSR cookie handling.
 */
export async function requireAuth(req?: NextRequest): Promise<
  { userId: string; email: string; doctorId: string | null } | NextResponse
> {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user?.email) {
      // Fallback: Authorization header
      if (req) {
        const authHeader = req.headers.get('authorization')
        if (authHeader?.startsWith('Bearer ')) {
          const { data: { user: hUser }, error: hErr } = await supabaseAdmin.auth.getUser(authHeader.substring(7))
          if (!hErr && hUser?.email) {
            const { data: doc } = await supabaseAdmin.from('doctors').select('id').eq('email', hUser.email).single()
            return { userId: hUser.id, email: hUser.email, doctorId: doc?.id || null }
          }
        }
      }
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 })
    }

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
