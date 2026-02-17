// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const router = useRouter()
  const hasChecked = useRef(false)

  useEffect(() => {
    // Only check once using useRef to prevent multiple checks
    if (!hasChecked.current) {
      hasChecked.current = true
      checkAuth()
    }
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      // Handle refresh token errors - clear session and redirect to login
      if (error) {
        // Check if it's a refresh token error
        if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid Refresh Token')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Refresh token invalid, clearing session and redirecting to login')
          }
          // Clear the session
          await supabase.auth.signOut()
          router.push('/login')
          return
        }
        
        // Other auth errors - redirect to login
        if (process.env.NODE_ENV === 'development') {
          console.warn('Auth error:', error.message)
        }
        router.push('/login')
        return
      }
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check if user is a doctor
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', user.email!)
        .single()

      if (doctorError || !doctor) {
        router.push('/login')
        return
      }

      setAuthenticated(true)
    } catch (error: any) {
      // Handle any unexpected errors
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth check error:', error)
      }
      // Clear session on any error
      await supabase.auth.signOut().catch(() => {})
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }


  if (!authenticated) {
    return null
  }

  return <>{children}</>
}
