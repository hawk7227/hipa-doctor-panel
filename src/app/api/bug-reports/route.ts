import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { sendAdminNotification } from '@/lib/email'

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null
let openai: OpenAI | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabaseAdmin
}

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

interface Attachment {
  id: string
  type: 'video' | 'screenshot' | 'file'
  url: string
  name: string
  size: number
  mime_type: string
  duration_seconds?: number
  annotations?: any[]
  transcript?: string
  created_at: string
}

interface BugReportPayload {
  doctor_id: string
  description: string
  page_url: string
  github_file_path: string
  github_file_url: string
  browser_info: string
  attachments: Attachment[]
}

// POST - Create new bug report
export async function POST(request: NextRequest) {
  try {
    const body: BugReportPayload = await request.json()
    
    const {
      doctor_id,
      description,
      page_url,
      github_file_path,
      github_file_url,
      browser_info,
      attachments,
    } = body

    // Validate required fields
    if (!doctor_id) {
      return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })
    }

    // Get doctor info for notification
    const { data: doctor, error: doctorError } = await getSupabaseAdmin()
      .from('doctors')
      .select('first_name, last_name, email')
      .eq('id', doctor_id)
      .single()

    if (doctorError) {
      console.error('Error fetching doctor:', doctorError)
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Process video attachments for transcription
    let processedAttachments = [...attachments]
    let transcript: string | null = null
    let aiSummary: string | null = null

    // Find video attachments and transcribe them
    const videoAttachments = attachments.filter(a => a.type === 'video' && a.url)
    
    if (videoAttachments.length > 0 && process.env.OPENAI_API_KEY) {
      try {
        // For now, we'll note that transcription requires downloading the video
        // In production, you'd want to use a background job for this
        console.log('Video attachments found, transcription would be processed here')
        
        // Generate AI summary from description
        if (description) {
          const summaryResponse = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a helpful assistant that summarizes bug reports for developers. 
                Create a concise, structured summary with:
                - A one-sentence description of the issue
                - Steps to reproduce (if mentioned)
                - Expected vs actual behavior (if mentioned)
                - Affected page/component
                Keep it brief and technical.`
              },
              {
                role: 'user',
                content: `Summarize this bug report from a doctor using our telehealth platform:
                
Page: ${page_url}
Description: ${description}
${transcript ? `\nTranscript from screen recording:\n${transcript}` : ''}`
              }
            ],
            max_tokens: 300,
          })

          aiSummary = summaryResponse.choices[0]?.message?.content || null
        }
      } catch (aiError) {
        console.error('AI processing error:', aiError)
        // Continue without AI summary - not critical
      }
    } else if (description && process.env.OPENAI_API_KEY) {
      // Generate summary from description alone
      try {
        const summaryResponse = await getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant that summarizes bug reports for developers. 
              Create a concise, structured summary with:
              - A one-sentence description of the issue
              - Steps to reproduce (if mentioned)
              - Expected vs actual behavior (if mentioned)
              - Affected page/component
              Keep it brief and technical.`
            },
            {
              role: 'user',
              content: `Summarize this bug report from a doctor using our telehealth platform:
              
Page: ${page_url}
Description: ${description}`
            }
          ],
          max_tokens: 300,
        })

        aiSummary = summaryResponse.choices[0]?.message?.content || null
      } catch (aiError) {
        console.error('AI summary error:', aiError)
      }
    }

    // Insert bug report into database
    const { data: bugReport, error: insertError } = await getSupabaseAdmin()
      .from('bug_reports')
      .insert({
        doctor_id,
        description,
        page_url,
        github_file_path,
        github_file_url,
        browser_info,
        attachments: processedAttachments,
        transcript,
        ai_summary: aiSummary,
        status: 'new',
        admin_read: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting bug report:', insertError)
      return NextResponse.json({ error: 'Failed to create bug report' }, { status: 500 })
    }

    // Send email notification to admin
    const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name}`
    const adminPanelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://doctor.medazonhealth.com'}/doctor/admin-bugs?id=${bugReport.id}`

    try {
      await sendAdminNotification(
        `🐛 New Bug Report — ${doctorName}`,
        `${doctorName} submitted a bug report.

Description:
${description || 'No description provided'}

${aiSummary ? `AI Summary:\n${aiSummary}\n` : ''}
Page: ${page_url}
Browser: ${browser_info}
Attachments: ${attachments.length} file(s)

View and manage this report in the admin panel.`,
        {
          'Report ID': bugReport.id,
          'Doctor': doctorName,
          'Page URL': page_url,
          'GitHub File': github_file_url,
          'Submitted At': new Date().toLocaleString(),
          'Admin Panel': adminPanelUrl,
        }
      )
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      bug_report: bugReport,
    })

  } catch (error: any) {
    console.error('Bug report POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List bug reports (for admin or doctor's own reports)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctor_id')
    const status = searchParams.get('status')
    const adminView = searchParams.get('admin') === 'true'

    let query = getSupabaseAdmin()
      .from('bug_reports')
      .select(`
        *,
        doctors:doctor_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by doctor if specified (for doctor's own reports view)
    if (doctorId && !adminView) {
      query = query.eq('doctor_id', doctorId)
    }

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: bugReports, error } = await query

    if (error) {
      console.error('Error fetching bug reports:', error)
      return NextResponse.json({ error: 'Failed to fetch bug reports' }, { status: 500 })
    }

    // Get unread count for admin badge
    const { count: unreadCount } = await getSupabaseAdmin()
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('admin_read', false)

    return NextResponse.json({
      bug_reports: bugReports,
      unread_count: unreadCount || 0,
    })

  } catch (error: any) {
    console.error('Bug report GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
