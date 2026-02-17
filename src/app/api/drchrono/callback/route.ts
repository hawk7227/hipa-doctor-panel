// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No authorization code received' }, { status: 400 })
  }

  // Check env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientId = process.env.DRCHRONO_CLIENT_ID
  const clientSecret = process.env.DRCHRONO_CLIENT_SECRET
  const redirectUri = process.env.DRCHRONO_REDIRECT_URI

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      error: 'Missing Supabase env vars',
      has_url: !!supabaseUrl,
      has_key: !!supabaseKey,
    }, { status: 500 })
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ 
      error: 'Missing DrChrono env vars',
      has_client_id: !!clientId,
      has_client_secret: !!clientSecret,
      has_redirect_uri: !!redirectUri,
    }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Exchange code for tokens
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    })

    const tokenResponse = await fetch('https://drchrono.com/o/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const tokenText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      return NextResponse.json({ 
        error: 'Token exchange failed', 
        status: tokenResponse.status,
        details: tokenText,
        redirect_uri_used: redirectUri,
      }, { status: 400 })
    }

    let tokens
    try {
      tokens = JSON.parse(tokenText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from DrChrono', raw: tokenText }, { status: 500 })
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json({ error: 'Missing tokens in response', tokens_keys: Object.keys(tokens) }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString()

    // Store tokens in Supabase (upsert to handle existing row)
    const { data, error: dbError } = await supabase
      .from('drchrono_tokens')
      .upsert({
        id: 1,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()

    if (dbError) {
      return NextResponse.json({ 
        error: 'Failed to save tokens to database', 
        db_error: dbError.message,
        db_code: dbError.code,
        db_details: dbError.details,
      }, { status: 500 })
    }

    // Success — redirect to appointments
    return NextResponse.redirect(new URL('/doctor/appointments', req.url))
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Unexpected error', 
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 3),
    }, { status: 500 })
  }
}

