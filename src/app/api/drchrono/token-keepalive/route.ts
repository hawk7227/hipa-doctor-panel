// ═══════════════════════════════════════════════════════════════
// DrChrono Token Keepalive — NEVER let the token expire
//
// Runs every 30 minutes via Vercel cron.
// Proactively refreshes the token when >50% of its lifetime has passed.
// Validates the token actually works by hitting DrChrono /api/users/current.
// Logs all results to drchrono_sync_log for monitoring.
//
// If refresh fails, retries 3 times with backoff.
// If all retries fail, logs CRITICAL error — doctor must re-auth.
//
// Vercel cron: { "path": "/api/drchrono/token-keepalive", "schedule": "*/30 * * * *" }
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRCHRONO_TOKEN_URL = 'https://drchrono.com/o/token/'
const DRCHRONO_VALIDATE_URL = 'https://app.drchrono.com/api/users/current'

async function refreshWithRetry(refreshToken: string, attempt = 0): Promise<any | null> {
  const MAX_RETRIES = 3
  const BACKOFF_MS = [2000, 5000, 10000]

  try {
    const res = await fetch(DRCHRONO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.DRCHRONO_CLIENT_ID || '',
        client_secret: process.env.DRCHRONO_CLIENT_SECRET || '',
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[TokenKeepAlive] Refresh attempt ${attempt + 1} failed: ${res.status} — ${errorText}`)

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]))
        return refreshWithRetry(refreshToken, attempt + 1)
      }
      return null
    }

    return await res.json()
  } catch (err: any) {
    console.error(`[TokenKeepAlive] Refresh attempt ${attempt + 1} network error:`, err.message)
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]))
      return refreshWithRetry(refreshToken, attempt + 1)
    }
    return null
  }
}

async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(DRCHRONO_VALIDATE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  try {
    // Get current token
    const { data: tokenRow, error: fetchErr } = await supabase
      .from('drchrono_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchErr || !tokenRow) {
      console.error('[TokenKeepAlive] CRITICAL: No token row in database')
      return NextResponse.json({
        status: 'CRITICAL',
        error: 'No DrChrono token found. Doctor must re-authorize at /api/drchrono/auth',
      }, { status: 500 })
    }

    const now = Date.now()
    const expiresAt = new Date(tokenRow.expires_at).getTime()
    const updatedAt = new Date(tokenRow.updated_at).getTime()
    const tokenAge = now - updatedAt
    const tokenLifetime = expiresAt - updatedAt
    const percentUsed = tokenLifetime > 0 ? (tokenAge / tokenLifetime) * 100 : 100
    const minutesUntilExpiry = Math.round((expiresAt - now) / 60000)

    console.log(`[TokenKeepAlive] Token age: ${Math.round(tokenAge / 60000)}min, expires in: ${minutesUntilExpiry}min, ${Math.round(percentUsed)}% used`)

    // Decision: refresh if >50% of lifetime used OR <60 minutes until expiry
    const needsRefresh = percentUsed > 50 || minutesUntilExpiry < 60

    if (!needsRefresh) {
      // Token is still fresh — just validate it works
      const isValid = await validateToken(tokenRow.access_token)

      if (isValid) {
        console.log('[TokenKeepAlive] Token valid, no refresh needed')
        return NextResponse.json({
          status: 'HEALTHY',
          minutes_until_expiry: minutesUntilExpiry,
          percent_used: Math.round(percentUsed),
          validated: true,
          elapsed_ms: Date.now() - startTime,
        })
      }

      // Token says it shouldn't be expired but doesn't work — force refresh
      console.log('[TokenKeepAlive] Token not expired but INVALID — forcing refresh')
    }

    // Refresh the token
    console.log(`[TokenKeepAlive] Refreshing token (${Math.round(percentUsed)}% used, ${minutesUntilExpiry}min left)`)
    const newTokens = await refreshWithRetry(tokenRow.refresh_token)

    if (!newTokens) {
      // ALL retries failed — log critical
      console.error('[TokenKeepAlive] CRITICAL: All refresh attempts failed')

      try {
        await supabase.from('drchrono_sync_log').insert({
          sync_type: 'token_keepalive',
          sync_mode: 'cron',
          status: 'CRITICAL_FAILURE',
          records_synced: 0,
          records_errored: 1,
          metadata: {
            error: 'Token refresh failed after 3 retries',
            minutes_until_expiry: minutesUntilExpiry,
            action_required: 'Doctor must re-authorize at /api/drchrono/auth',
          },
        })
      } catch {}

      return NextResponse.json({
        status: 'CRITICAL',
        error: 'Token refresh failed. Doctor must re-authorize at /api/drchrono/auth',
        minutes_until_expiry: minutesUntilExpiry,
      }, { status: 500 })
    }

    // Save new tokens
    const newExpiresAt = new Date(now + (newTokens.expires_in || 7200) * 1000).toISOString()

    const { error: saveErr } = await supabase
      .from('drchrono_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id)

    if (saveErr) {
      console.error('[TokenKeepAlive] Failed to save refreshed token:', saveErr)
      return NextResponse.json({
        status: 'ERROR',
        error: 'Token refreshed but failed to save: ' + saveErr.message,
      }, { status: 500 })
    }

    // Validate the new token actually works
    const isValid = await validateToken(newTokens.access_token)

    // Log success
    try {
      await supabase.from('drchrono_sync_log').insert({
        sync_type: 'token_keepalive',
        sync_mode: 'cron',
        status: isValid ? 'success' : 'refreshed_but_invalid',
        records_synced: 1,
        records_errored: isValid ? 0 : 1,
        metadata: {
          old_expiry: tokenRow.expires_at,
          new_expiry: newExpiresAt,
          validated: isValid,
          elapsed_ms: Date.now() - startTime,
        },
      })
    } catch {}

    console.log(`[TokenKeepAlive] Token refreshed successfully. Valid: ${isValid}. New expiry: ${newExpiresAt}`)

    return NextResponse.json({
      status: isValid ? 'REFRESHED' : 'REFRESHED_UNVALIDATED',
      new_expires_at: newExpiresAt,
      validated: isValid,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error('[TokenKeepAlive] Unexpected error:', err.message)
    return NextResponse.json({
      status: 'ERROR',
      error: err.message,
    }, { status: 500 })
  }
}
