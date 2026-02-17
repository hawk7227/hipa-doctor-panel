// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Get user from cookies or Bearer token
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    let supabaseClient: any
    let user = null
    let userError = null

    if (accessToken) {
      const { createClient } = await import('@supabase/supabase-js')
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      )
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Ignore cookie setting errors
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Ignore cookie removal errors
              }
            }
          }
        }
      )
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Convert File to Blob and then to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Call OpenAI Whisper API
    const formDataForOpenAI = new FormData()
    const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' })
    formDataForOpenAI.append('file', blob, audioFile.name || 'audio.webm')
    formDataForOpenAI.append('model', 'whisper-1')
    formDataForOpenAI.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formDataForOpenAI
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('OpenAI Whisper API error:', errorData)
      return NextResponse.json(
        { error: 'Transcription failed', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ text: data.text })

  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

