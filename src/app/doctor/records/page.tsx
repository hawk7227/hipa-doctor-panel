// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Records functionality has been consolidated into Chart Management
export default function RecordsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/doctor/chart-management') }, [router])
  return (
    <div className="min-h-screen bg-[#030f0f] flex items-center justify-center text-white">
      <p className="text-xs text-gray-500">Redirecting to Chart Management...</p>
    </div>
  )
}
