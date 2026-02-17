// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRCHRONO_TOKEN_URL = 'https://drchrono.com/o/token/'
const DRCHRONO_API_BASE = 'https://app.drchrono.com/api'

// ═══════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════

export async function getAccessToken(): Promise<string | null> {
  // Get the most recent token
  const { data, error } = await supabase
    .from('drchrono_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.log('[DrChrono] No token found:', error?.message)
    return null
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(data.expires_at).getTime()
  const now = Date.now()
  const buffer = 5 * 60 * 1000 // 5 minutes

  if (now >= expiresAt - buffer) {
    console.log('[DrChrono] Token expired, refreshing...')
    return await refreshToken(data.refresh_token, data.id)
  }

  return data.access_token
}

async function refreshToken(refreshToken: string, tokenId: string): Promise<string | null> {
  try {
    const response = await fetch(DRCHRONO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.DRCHRONO_CLIENT_ID!,
        client_secret: process.env.DRCHRONO_CLIENT_SECRET!,
      }),
    })

    if (!response.ok) {
      console.error('[DrChrono] Refresh failed:', response.status)
      return null
    }

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Update in Supabase
    const { error } = await supabase
      .from('drchrono_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenId)

    if (error) {
      console.error('[DrChrono] Failed to save refreshed token:', error)
      return null
    }

    console.log('[DrChrono] Token refreshed successfully')
    return tokens.access_token
  } catch (err) {
    console.error('[DrChrono] Refresh error:', err)
    return null
  }
}

// ═══════════════════════════════════════════════
// API FETCH WRAPPER
// ═══════════════════════════════════════════════

export async function drchronoFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await getAccessToken()

  if (!token) {
    return { ok: false, status: 401, data: { error: 'No valid DrChrono token. Re-authorize at /api/drchrono/auth' } }
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${DRCHRONO_API_BASE}/${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => null)

  return { ok: response.ok, status: response.status, data }
}
