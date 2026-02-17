// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  const twiml = new twilio.twiml.VoiceResponse()
  
  // Log ALL incoming data to debug
  console.log('🔵 ========== TwiML REQUEST START ==========')
  console.log('📥 Method:', request.method)
  console.log('📥 URL:', request.url)
  console.log('📥 Headers:', Object.fromEntries(request.headers.entries()))
  
  // Check if this is a WebRTC call (from Voice SDK)
  const userAgent = request.headers.get('user-agent') || ''
  const isWebRTCCall = userAgent.includes('TwilioClient') || 
                       request.headers.get('x-twilio-client') !== null
  console.log('📞 Call type:', isWebRTCCall ? 'WebRTC (Voice SDK)' : 'Regular PSTN')
  
  try {
    let toNumber: string | null = null
    let formDataObj: Record<string, string> = {}
    
    // Handle GET vs POST differently
    if (request.method === 'GET') {
      // GET requests use query parameters
      const url = new URL(request.url)
      toNumber = url.searchParams.get('To') || url.searchParams.get('to')
      
      // Log query params
      const queryParams: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value
      })
      console.log('📦 Query Params:', queryParams)
    } else {
      // POST requests use form data
      const formData = await request.formData()
      
      // Log all form data
      for (const [key, value] of formData.entries()) {
        formDataObj[key] = value.toString()
      }
      console.log('📦 Form Data:', formDataObj)
      
      toNumber = formData.get('To')?.toString() || 
                 new URL(request.url).searchParams.get('To') ||
                 new URL(request.url).searchParams.get('to')
    }

    console.log('📞 TwiML Request received:', {
      method: request.method,
      url: request.url,
      toNumber: toNumber,
      data: request.method === 'GET' ? 'from query params' : formDataObj
    })

    if (!toNumber) {
      console.error('❌ No To number provided in TwiML request')
      twiml.say('No number provided. Please try again.')
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Validate phone number format
    if (!toNumber.startsWith('+')) {
      console.warn('⚠️ Phone number missing country code, adding +:', toNumber)
    }

    // Get caller ID from environment or use Twilio number
    const callerId = process.env.TWILIO_PHONE_NUMBER
    
    if (!callerId) {
      console.error('❌ TWILIO_PHONE_NUMBER not set')
      twiml.say('Call configuration error. Please contact support.')
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    console.log('📞 Dialing number:', {
      to: toNumber,
      callerId: callerId
    })

    // Dial the number with caller ID
    // For Voice SDK calls, we need to dial the client (identity) that initiated the call
    // But since this is an outgoing call, we dial the 'To' number
    // answerOnMedia='true' ensures media connection starts immediately when answered
    // Note: answerOnMedia is valid TwiML but not in TypeScript definitions, using type assertion
    
    // Get the base URL for recording status callback
    // IMPORTANT: Must be publicly accessible (ngrok URL, not localhost)
    // Check if request came through ngrok to determine correct base URL
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || ''
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    
    // Use ngrok URL if detected, otherwise use environment variable
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // If request came through ngrok, use that URL
    if (host.includes('ngrok') || host.includes('ngrok-free.app')) {
      baseUrl = `${proto}://${host}`
      console.log('🌐 Using ngrok URL for callbacks:', baseUrl)
    } else if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
      console.log('🌐 Using configured APP_URL:', baseUrl)
    } else {
      console.warn('⚠️ WARNING: Using localhost for recording callback - Twilio cannot reach this!')
      console.warn('⚠️ Set NEXT_PUBLIC_APP_URL to your ngrok URL')
    }
    
    const recordingStatusCallback = `${baseUrl}/api/communication/twiml/recording-status`
    console.log('📞 Recording callback URL:', recordingStatusCallback)
    
    // For Voice SDK WebRTC calls, configure for proper bidirectional audio
    // CRITICAL SETTINGS for WebRTC-to-PSTN calls:
    // 1. answerOnBridge: false - Start media immediately to avoid one-way audio
    // 2. record: 'record-from-answer' - Records after call is answered
    // 3. ringTone: Play ringback tone to browser while waiting
    
    const dial = twiml.dial({ 
      callerId: callerId,
      timeout: 30, // Wait up to 30 seconds for answer
      timeLimit: 3600, // Maximum call duration: 1 hour
      answerOnBridge: false, // FALSE = Start media connection immediately (fixes one-way audio)
      record: 'record-from-answer', // Records mixed audio after answer
      recordingStatusCallback: recordingStatusCallback,
      recordingStatusCallbackMethod: 'POST',
      ringTone: 'us' // Play US ringback tone to caller while waiting
    } as any)
    
    // Dial the destination number
    dial.number(toNumber)
    
    console.log('✅ TwiML generated successfully with config:', {
      answerOnBridge: false,
      record: 'record-from-answer',
      callerId: callerId,
      to: toNumber,
      recordingCallback: recordingStatusCallback
    })
    
  } catch (error: any) {
    console.error('❌ Error generating TwiML:', error)
    console.error('Error stack:', error.stack)
    twiml.say('An error occurred processing your call. Please try again.')
  }

  const twimlResponse = twiml.toString()
  console.log('📋 TwiML Response XML:')
  console.log(twimlResponse)
  console.log('🔵 ========== TwiML REQUEST END ==========')

  return new NextResponse(twimlResponse, {
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache',
      'X-Twilio-Debug': 'true' // Custom header for debugging
    }
  })
}

// Also handle GET requests for TwiML
export async function GET(request: NextRequest) {
  return POST(request)
}

