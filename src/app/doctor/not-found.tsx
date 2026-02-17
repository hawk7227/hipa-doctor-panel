// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, LayoutDashboard } from 'lucide-react'

export default function DoctorNotFound() {
  return (
    <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center space-x-3">
          <Link
            href="/doctor/dashboard"
            className="flex items-center space-x-2 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/doctor/appointments"
            className="flex items-center space-x-2 bg-[#0d2626] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Appointments</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
