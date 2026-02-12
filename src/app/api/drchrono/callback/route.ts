import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No authorization code received' }, { status: 400 })
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://drchrono.com/o/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.DRCHRONO_CLIENT_ID!,
        client_secret: process.env.DRCHRONO_CLIENT_SECRET!,
        redirect_uri: process.env.DRCHRONO_REDIRECT_URI!,
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('[DrChrono Callback] Token exchange failed:', err)
      return NextResponse.json({ error: 'Token exchange failed', details: err }, { status: 400 })
    }

    const tokens = await tokenResponse.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store tokens in Supabase
    const { error: dbError } = await supabase
      .from('drchrono_tokens')
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
      })

    if (dbError) {
      console.error('[DrChrono Callback] DB save failed:', dbError)
      return NextResponse.json({ error: 'Failed to save tokens' }, { status: 500 })
    }

    console.log('[DrChrono Callback] OAuth complete, tokens saved')

    // Redirect back to doctor dashboard
    return NextResponse.redirect(new URL('/doctor/appointments', req.url))
  } catch (err: any) {
    console.error('[DrChrono Callback] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
