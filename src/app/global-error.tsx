// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html>
      <body className="bg-[#0a1f1f]">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h1>
            <p className="text-sm text-gray-400 mb-2">
              An unexpected error occurred. No patient data was exposed.
            </p>
            {error.digest && (
              <p className="text-[10px] text-gray-600 font-mono mb-6">Error ID: {error.digest}</p>
            )}
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={reset}
                className="flex items-center space-x-2 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <a
                href="/doctor/dashboard"
                className="flex items-center space-x-2 bg-[#0d2626] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
