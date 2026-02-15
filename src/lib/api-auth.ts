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
 * Extract the access token from Supabase cookies.
 * Supabase stores auth in cookies like:
 *   sb-{ref}-auth-token (single cookie, base64 JSON)
 *   sb-{ref}-auth-token.0, sb-{ref}-auth-token.1 (chunked)
 */
function extractTokenFromCookies(req: NextRequest): string | null {
  const cookies = req.cookies
  const allCookies = cookies.getAll()
  
  // Find auth token cookies (may be chunked: .0, .1, .2, etc.)
  const authCookies = allCookies.filter(c => c.name.includes('auth-token'))
  if (authCookies.length === 0) return null

  // Sort chunks: base cookie first, then .0, .1, .2...
  authCookies.sort((a, b) => {
    const aNum = a.name.match(/\.(\d+)$/)?.[1]
    const bNum = b.name.match(/\.(\d+)$/)?.[1]
    if (!aNum && !bNum) return 0
    if (!aNum) return -1
    if (!bNum) return 1
    return parseInt(aNum) - parseInt(bNum)
  })

  // Combine chunked cookie values
  let combined = ''
  const hasChunks = authCookies.some(c => /\.\d+$/.test(c.name))
  
  if (hasChunks) {
    // Chunked: combine .0, .1, .2... (skip the base cookie if chunks exist)
    const chunks = authCookies.filter(c => /\.\d+$/.test(c.name))
    combined = chunks.map(c => c.value).join('')
  } else {
    // Single cookie
    combined = authCookies[0].value
  }

  if (!combined) return null

  // Try to parse as JSON (may be base64-encoded or raw JSON)
  try {
    // Try decoding URI component first
    const decoded = decodeURIComponent(combined)
    
    // Try base64 decode
    let jsonStr = decoded
    try {
      const b64decoded = Buffer.from(decoded, 'base64').toString('utf-8')
      if (b64decoded.startsWith('{') || b64decoded.startsWith('[')) {
        jsonStr = b64decoded
      }
    } catch { /* not base64 */ }

    // Parse JSON
    const parsed = JSON.parse(jsonStr)
    
    // Handle array format: [{access_token, ...}]
    if (Array.isArray(parsed)) {
      return parsed[0]?.access_token || null
    }
    // Handle object format: {access_token, ...}
    return parsed?.access_token || null
  } catch {
    // Not JSON — might be raw token
    return combined
  }
}

/**
 * Verify the user is authenticated via Supabase JWT.
 * Checks: Authorization header → Supabase auth cookies
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult | AuthError> {
  try {
    // Try Authorization header first (API clients)
    let token = req.headers.get('authorization')?.replace('Bearer ', '')

    // Fallback: Supabase cookies
    if (!token) {
      token = extractTokenFromCookies(req) || undefined
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
 */
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
  const result = await requireAuth(req)
  if ('error' in result && result.error) return null
  return result.user || null
}
