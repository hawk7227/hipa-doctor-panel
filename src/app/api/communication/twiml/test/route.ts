// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple test endpoint to verify Twilio can reach your server
 * Access this URL: https://729433e994cc.ngrok-free.app/api/communication/twiml/test
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'TwiML endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  return NextResponse.json({
    success: true,
    message: 'TwiML POST endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.url,
    body: body,
    headers: Object.fromEntries(request.headers.entries())
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

