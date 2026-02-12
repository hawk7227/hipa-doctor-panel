import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.DRCHRONO_CLIENT_ID
  const redirectUri = process.env.DRCHRONO_REDIRECT_URI
  const scopes = process.env.DRCHRONO_SCOPES || 'user:read patients:read patients:summary:read clinical:read'

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'DrChrono credentials not configured' }, { status: 500 })
  }

  const authUrl = `https://drchrono.com/o/authorize/?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`

  return NextResponse.redirect(authUrl)
}
