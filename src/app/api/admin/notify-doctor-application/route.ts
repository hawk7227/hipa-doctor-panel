import { NextRequest, NextResponse } from 'next/server'
import { sendDoctorApplicationNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const doctorData = await request.json()

    // Validate required fields
    if (!doctorData.firstName || !doctorData.lastName || !doctorData.email || !doctorData.specialty || !doctorData.licenseNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, email, specialty, licenseNumber' },
        { status: 400 }
      )
    }

    // Send admin notification
    const result = await sendDoctorApplicationNotification(doctorData)

    if (!result.success) {
      console.error('❌ Failed to send admin notification:', result.error)
      return NextResponse.json(
        { error: `Failed to send admin notification: ${result.error}` },
        { status: 500 }
      )
    }

    console.log('✅ Admin notification sent successfully for doctor application')

    return NextResponse.json({
      success: true,
      message: 'Admin notification sent successfully'
    })

  } catch (error: any) {
    console.error('❌ Error in admin notification API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

