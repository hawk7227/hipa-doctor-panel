import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { twilioService } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  // CRITICAL FIX: Check Twilio config FIRST before doing expensive auth operations
  // This prevents 27-second delays when Twilio is not configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_TWIML_APP_SID) {
    // Fail fast - return immediately without doing auth
    return NextResponse.json(
      { error: 'Twilio not configured', details: 'Missing Twilio credentials' },
      { status: 503 } // 503 Service Unavailable - more appropriate than 500
    )
  }

  try {
    const requestHeaders = new Headers(request.headers)
    
    // Check for Authorization header (Bearer token)
    const authHeader = requestHeaders.get('authorization')
    let user = null
    let userError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use the access token directly to get user
      const accessToken = authHeader.replace('Bearer ', '')
      
      try {
        // Verify the token and get user using Supabase client
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createClient(
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
        
        // Get user with the access token
        const { data: { user: verifiedUser }, error: verifyError } = await supabaseAdmin.auth.getUser(accessToken)
        
        if (!verifyError && verifiedUser) {
          user = verifiedUser
        } else {
          userError = verifyError
        }
      } catch (tokenError: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Token verification error:', tokenError)
        }
        userError = { message: tokenError.message || 'Token verification failed' } as any
      }
    } else {
      // Fallback to cookie-based auth
      const cookieStore = await cookies()
      
      // Extract cookies from request headers
      const cookieHeader = requestHeaders.get('cookie') || ''
      const cookiesFromRequest = cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          acc[name] = decodeURIComponent(value)
        }
        return acc
      }, {} as Record<string, string>)
      
      // Create Supabase client with proper cookie handling
      const supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              // Try request headers first, then cookie store
              return cookiesFromRequest[name] || cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Cookie setting might fail in middleware, ignore
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Cookie removal might fail in middleware, ignore
              }
            }
          }
        }
      )

      const authResult = await supabaseClient.auth.getUser()
      user = authResult.data.user
      userError = authResult.error
    }
    
    if (userError || !user) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth error:', {
          message: userError?.message,
          status: userError?.status,
          name: userError?.name,
          hasAuthHeader: !!authHeader
        })
      }
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Auth session missing!' },
        { status: 401 }
      )
    }

    const { identity } = await request.json()

    // Use identity from request or fallback to user email
    const tokenIdentity = identity || user.email
    if (!tokenIdentity) {
      console.error('No identity provided for token generation')
      return NextResponse.json(
        { error: 'Identity required', details: 'User email or identity must be provided' },
        { status: 400 }
      )
    }

    // Generate token with doctor's email as identity
    const result = await twilioService.generateVoiceToken(tokenIdentity)

    if (!result.success) {
      console.error('Token generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      token: result.token,
      identity: identity || user.email
    })
  } catch (error: any) {
    console.error('Error generating Twilio token:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    )
  }
}

