import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabaseAdmin
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Get single bug report
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const { data: bugReport, error } = await getSupabaseAdmin()
      .from('bug_reports')
      .select(`
        *,
        doctors:doctor_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching bug report:', error)
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    return NextResponse.json({ bug_report: bugReport })

  } catch (error: any) {
    console.error('Bug report GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update bug report (status, notes, admin response, etc.)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const allowedFields = [
      'status',
      'admin_notes',
      'admin_read',
      'admin_response_video_url',
      'admin_response_video_name',
      'live_session_status',
      'live_session_room_url',
      'live_session_requested_by',
      'live_session_requested_at',
    ]

    // Filter to only allowed fields
    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Always update updated_at
    updateData.updated_at = new Date().toISOString()

    // If marking as read, set admin_read to true
    if (body.mark_as_read) {
      updateData.admin_read = true
    }

    const { data: bugReport, error } = await getSupabaseAdmin()
      .from('bug_reports')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        doctors:doctor_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('Error updating bug report:', error)
      return NextResponse.json({ error: 'Failed to update bug report' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      bug_report: bugReport,
    })

  } catch (error: any) {
    console.error('Bug report PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete bug report (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // First, get the bug report to find any associated files
    const { data: bugReport, error: fetchError } = await getSupabaseAdmin()
      .from('bug_reports')
      .select('attachments, admin_response_video_url')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching bug report for deletion:', fetchError)
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    // Delete associated files from storage
    if (bugReport.attachments && Array.isArray(bugReport.attachments)) {
      for (const attachment of bugReport.attachments) {
        if (attachment.url) {
          try {
            // Extract file path from URL
            const urlParts = attachment.url.split('/bug-reports/')
            if (urlParts[1]) {
              await getSupabaseAdmin().storage
                .from('bug-reports')
                .remove([urlParts[1]])
            }
          } catch (storageError) {
            console.error('Error deleting attachment file:', storageError)
            // Continue with deletion even if file deletion fails
          }
        }
      }
    }

    // Delete the bug report
    const { error: deleteError } = await getSupabaseAdmin()
      .from('bug_reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting bug report:', deleteError)
      return NextResponse.json({ error: 'Failed to delete bug report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Bug report DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
