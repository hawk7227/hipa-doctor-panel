import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Create Supabase client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Transcribe a bug report's video attachments
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Get the bug report
    const { data: bugReport, error: fetchError } = await supabaseAdmin
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !bugReport) {
      console.error('Error fetching bug report:', fetchError)
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 })
    }

    // Find video attachments
    const attachments = bugReport.attachments || []
    const videoAttachments = attachments.filter((a: any) => 
      a.type === 'video' && a.url
    )

    if (videoAttachments.length === 0) {
      return NextResponse.json(
        { error: 'No video attachments found to transcribe' },
        { status: 400 }
      )
    }

    let fullTranscript = ''
    const transcribedAttachments = [...attachments]

    // Process each video attachment
    for (const attachment of videoAttachments) {
      try {
        console.log(`Transcribing video: ${attachment.name}`)

        // Download the video file
        const videoResponse = await fetch(attachment.url)
        if (!videoResponse.ok) {
          console.error(`Failed to download video: ${attachment.url}`)
          continue
        }

        const videoBlob = await videoResponse.blob()
        
        // Convert to File object for OpenAI API
        const videoFile = new File([videoBlob], attachment.name, { 
          type: attachment.mime_type || 'video/webm' 
        })

        // Check file size (Whisper has a 25MB limit)
        if (videoFile.size > 25 * 1024 * 1024) {
          console.warn(`Video too large for transcription: ${attachment.name} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`)
          continue
        }

        // Transcribe with Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: videoFile,
          model: 'whisper-1',
          response_format: 'text',
          language: 'en',
        })

        if (transcription) {
          // Update the attachment with transcript
          const attachmentIndex = transcribedAttachments.findIndex(
            (a: any) => a.id === attachment.id
          )
          if (attachmentIndex !== -1) {
            transcribedAttachments[attachmentIndex] = {
              ...transcribedAttachments[attachmentIndex],
              transcript: transcription,
            }
          }

          fullTranscript += (fullTranscript ? '\n\n' : '') + 
            `[${attachment.name}]:\n${transcription}`
        }

      } catch (transcribeError: any) {
        console.error(`Error transcribing ${attachment.name}:`, transcribeError)
        // Continue with other attachments
      }
    }

    if (!fullTranscript) {
      return NextResponse.json(
        { error: 'Could not transcribe any videos. They may not contain audio.' },
        { status: 400 }
      )
    }

    // Generate AI summary with the transcript
    let aiSummary = bugReport.ai_summary
    try {
      const summaryResponse = await openai.chat.completions.create({
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
- Key details from the audio narration
Keep it brief and technical.`
          },
          {
            role: 'user',
            content: `Summarize this bug report from a doctor using our telehealth platform:

Page: ${bugReport.page_url}
Description: ${bugReport.description || 'No written description'}

Audio transcript from screen recording:
${fullTranscript}`
          }
        ],
        max_tokens: 400,
      })

      aiSummary = summaryResponse.choices[0]?.message?.content || aiSummary
    } catch (summaryError) {
      console.error('Error generating summary:', summaryError)
      // Keep existing summary if regeneration fails
    }

    // Update the bug report with transcript and updated summary
    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from('bug_reports')
      .update({
        transcript: fullTranscript,
        ai_summary: aiSummary,
        attachments: transcribedAttachments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bug report:', updateError)
      return NextResponse.json(
        { error: 'Failed to save transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transcript: fullTranscript,
      ai_summary: aiSummary,
      bug_report: updatedReport,
    })

  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
