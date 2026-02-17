// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    checkAuthAndRedirect()
  }, [])

  const checkAuthAndRedirect = async () => {
    try {
      const user = await getCurrentUser()
      if (user) {
        // User is authenticated, redirect to appointments
        router.push('/doctor/appointments')
      } else {
        // User is not authenticated, redirect to login
        router.push('/login')
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      // On error, redirect to login
      router.push('/login')
    }
  }

  // Show loading while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-700">Redirecting...</p>
      </div>
    </div>
  )
}