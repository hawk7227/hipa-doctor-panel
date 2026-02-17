// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function POST(req: NextRequest) {
  try {
   
 const body = await req.json()
    const { meetingNumber, role = 0 } = body

    if (!meetingNumber) {
      return NextResponse.json(
        { error: 'Meeting number is required' },
        { status: 400 }
      )
    }

    // Get SDK credentials from environment variables
    // Note: SDK Key and Secret are different from API Key and Secret
    // These are obtained from Zoom Marketplace when creating a Meeting SDK app
    const sdkKey = process.env.ZOOM_SDK_KEY || process.env.ZOOM_API_KEY
    const sdkSecret = process.env.ZOOM_SDK_SECRET || process.env.ZOOM_API_SECRET

    if (!sdkKey || !sdkSecret) {
      console.error('❌ Zoom SDK credentials not configured')
      return NextResponse.json(
        { 
          error: 'Zoom SDK credentials not configured',
          message: 'Please set ZOOM_SDK_KEY and ZOOM_SDK_SECRET in your environment variables. These are different from ZOOM_API_KEY and ZOOM_API_SECRET.'
        },
        { status: 500 }
      )
    }

    // Generate JWT token for Zoom SDK
    // Role: 0 = participant, 1 = host
    const iat = Math.floor(Date.now() / 1000) - 30 // Issued at time (30 seconds ago to account for clock skew)
    const exp = iat + 60 * 60 * 2 // Token expires in 2 hours
    
    const payload = {
      iss: sdkKey,
      exp: exp,
      iat: iat
    }

    // Create the signature (JWT token)
    const signature = jwt.sign(payload, sdkSecret, {
      algorithm: 'HS256'
    })

    console.log('✅ Zoom SDK token generated successfully', {
      meetingNumber,
      role,
      hasSignature: !!signature
    })

    return NextResponse.json({
      success: true,
      signature,
      sdkKey,
      meetingNumber,
      role
    })
  } catch (error: any) {
    console.error('❌ Error generating Zoom SDK token:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate Zoom SDK token',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

