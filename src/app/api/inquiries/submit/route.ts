// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { full_name, email, phone, practice_name, practice_size, interest_type, message } = body

    // Validate required fields
    if (!full_name || !email || !phone) {
      return NextResponse.json(
        { error: 'Full name, email, and phone are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Generate reference number
    const refNumber = 'MZ-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('inquiries')
      .insert({
        full_name,
        email,
        phone,
        practice_name: practice_name || null,
        practice_size: practice_size || null,
        interest_type: interest_type || 'general',
        message: message || null,
        reference_number: refNumber,
        status: 'new',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.log('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to submit inquiry. Please try again.' },
        { status: 500 }
      )
    }

    // Try to notify admin (non-blocking)
    try {
      await fetch(new URL('/api/admin/notify-doctor-application', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'inquiry',
          name: full_name,
          email,
          interest_type,
          reference_number: refNumber,
        }),
      })
    } catch (notifyError) {
      console.log('Admin notification failed (non-blocking):', notifyError)
    }

    return NextResponse.json({
      success: true,
      reference_number: refNumber,
      message: 'Inquiry submitted successfully',
    })
  } catch (err) {
    console.log('Inquiry submit error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
