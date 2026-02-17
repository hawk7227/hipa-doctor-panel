// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!

export async function POST(request: NextRequest) {
  try {
    const { identity } = await request.json()
    
    if (!identity) {
      return NextResponse.json({ error: 'Identity required' }, { status: 400 })
    }

    if (!accountSid || !authToken || !twimlAppSid) {
      console.error('Missing Twilio credentials:', {
        hasAccountSid: !!accountSid,
        hasAuthToken: !!authToken,
        hasTwimlAppSid: !!twimlAppSid
      })
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
    }

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    })

    const token = new AccessToken(
      accountSid,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity }
    )

    token.addGrant(voiceGrant)

    console.log('✅ Twilio token generated for identity:', identity)

    return NextResponse.json({ 
      token: token.toJwt(),
      identity 
    })
  } catch (error: any) {
    console.error('❌ Error generating Twilio token:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate token' }, { status: 500 })
  }
}
