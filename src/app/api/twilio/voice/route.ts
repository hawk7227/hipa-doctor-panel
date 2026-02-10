import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const to = formData.get('To') as string
    const from = formData.get('From') as string
    const callerId = process.env.TWILIO_PHONE_NUMBER!

    const twiml = new VoiceResponse()

    // Check if this is an INBOUND call (patient calling the Twilio number)
    // Inbound calls have a 'To' that matches our Twilio number
    if (to === callerId || to === callerId.replace('+1', '')) {
      // INBOUND: Patient is calling in
      console.log('📞 Inbound call from:', from)
      
      twiml.say(
        { voice: 'Polly.Joanna' },
        'Thank you for calling Medazon Health. Please hold while we connect you to a provider.'
      )
      
      // Ring the doctor's browser client
      const dial = twiml.dial({
        callerId: from,
        timeout: 30
      })
      // 'doctor' matches the identity used when generating the token
      dial.client('doctor')
      
      // If doctor doesn't answer after 30 seconds
      twiml.say(
        { voice: 'Polly.Joanna' },
        'We are sorry, no one is available to take your call right now. Please try again later or book an appointment online at medazon health dot com.'
      )
    } else if (to) {
      // OUTBOUND: Doctor is calling a patient from the dashboard
      console.log('📞 Outbound call to:', to)
      
      // Normalize the number — ensure +1 prefix
      let normalizedTo = to.replace(/[^\d+]/g, '')
      if (!normalizedTo.startsWith('+')) {
        if (normalizedTo.startsWith('1')) {
          normalizedTo = '+' + normalizedTo
        } else {
          normalizedTo = '+1' + normalizedTo
        }
      }

      const dial = twiml.dial({ callerId })
      dial.number(normalizedTo)
    } else {
      twiml.say('No phone number provided.')
    }

    console.log('📞 TwiML response:', twiml.toString())

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    })
  } catch (error: any) {
    console.error('❌ Error generating TwiML:', error)
    const twiml = new VoiceResponse()
    twiml.say('An error occurred. Please try again.')
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}
