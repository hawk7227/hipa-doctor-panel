// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getOAuth2Client, upsertTokens } from '@/lib/gmail'
import { google } from 'googleapis'

// GET /api/gmail/callback?code=XXX&state=doctorId
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const doctorId = req.nextUrl.searchParams.get('state')

    if (!code || !doctorId) {
      return NextResponse.redirect(new URL('/doctor/dashboard?gmail=error&reason=missing_params', req.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/doctor/dashboard?gmail=error&reason=no_tokens', req.url))
    }

    // Get the user's email
    const client = getOAuth2Client()
    client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const userInfo = await oauth2.userinfo.get()
    const gmailAddress = userInfo.data.email || null

    // Store tokens
    await upsertTokens(
      doctorId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      gmailAddress,
    )

    // Redirect back to dashboard with success
    return NextResponse.redirect(new URL('/doctor/dashboard?gmail=connected', req.url))
  } catch (err: any) {
    console.error('Gmail callback error:', err)
    return NextResponse.redirect(new URL(`/doctor/dashboard?gmail=error&reason=${encodeURIComponent(err.message || 'unknown')}`, req.url))
  }
}
