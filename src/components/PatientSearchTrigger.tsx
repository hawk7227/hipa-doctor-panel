// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React from 'react'
import { Search } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// PatientSearchTrigger — Inline search bar that opens the global
// Ctrl+K patient search modal. Use on any page to give quick access.
// ═══════════════════════════════════════════════════════════════

interface Props {
  placeholder?: string
  className?: string
  compact?: boolean
}

export default function PatientSearchTrigger({
  placeholder = 'Search patients — name, DOB, email, phone...',
  className = '',
  compact = false,
}: Props) {
  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  }

  if (compact) {
    return (
      <button
        onClick={openSearch}
        className={`flex items-center gap-2 px-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-gray-400 hover:border-teal-500/50 hover:text-teal-400 transition-colors ${className}`}
        title="Search patients (Ctrl+K)"
      >
        <Search className="w-4 h-4" />
        <span className="text-xs">Search...</span>
        <kbd className="text-[9px] font-bold text-gray-600 bg-[#0d2626] px-1.5 py-0.5 rounded border border-[#1a3d3d] ml-auto">⌘K</kbd>
      </button>
    )
  }

  return (
    <button
      onClick={openSearch}
      className={`w-full flex items-center gap-3 px-4 py-3 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-gray-400 hover:border-teal-500/50 hover:text-gray-300 transition-colors cursor-text ${className}`}
    >
      <Search className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm flex-1 text-left">{placeholder}</span>
      <kbd className="text-[10px] font-bold text-gray-600 bg-[#0d2626] px-2 py-0.5 rounded border border-[#1a3d3d]">Ctrl+K</kbd>
    </button>
  )
}
