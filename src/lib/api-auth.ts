// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — API AUTH MIDDLEWARE
// HIPAA: All API routes accessing PHI must verify authentication
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface AuthResult {
  user: { id: string; email?: string }
  error?: never
}

interface AuthError {
  user?: never
  error: NextResponse
}

/**
 * Verify the user is authenticated via Supabase JWT in the Authorization header or cookie.
 * Returns { user } on success or { error: NextResponse } on failure.
 *
 * Usage in route handlers:
 * ```
 * import { requireAuth } from '@/lib/api-auth'
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(req)
 *   if (auth.error) return auth.error
 *   // auth.user is available
 * }
 * ```
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult | AuthError> {
  try {
    // Try Authorization header first (API clients)
    let token = req.headers.get('authorization')?.replace('Bearer ', '')

    // Fallback: Supabase stores the token in cookies
    if (!token) {
      // Supabase client-side stores tokens in sb-*-auth-token cookie
      const cookies = req.cookies
      const authCookie = cookies.getAll().find(c => c.name.includes('auth-token'))
      if (authCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(authCookie.value))
          token = parsed?.access_token || parsed?.[0]?.access_token
        } catch {
          // Try raw value
          token = authCookie.value
        }
      }
    }

    if (!token) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      }
    }

    // Verify the token with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return {
        error: NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        ),
      }
    }

    return { user: { id: user.id, email: user.email } }
  } catch (err) {
    console.error('[API Auth] Error:', err)
    return {
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Quick helper that returns just the user or throws.
 * For routes where you want cleaner code:
 * ```
 * const user = await getAuthUser(req)
 * if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 * ```
 */
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
  const result = await requireAuth(req)
  if ('error' in result && result.error) return null
  return result.user || null
}
