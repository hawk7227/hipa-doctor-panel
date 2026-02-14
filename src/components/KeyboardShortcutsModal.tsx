'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Keyboard } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS HELP
// Triggered by pressing ? (shift + /)
// ═══════════════════════════════════════════════════════════════

const SHORTCUTS = [
  {
    group: 'Calendar',
    shortcuts: [
      { keys: ['←', '→'], description: 'Navigate days/weeks' },
      { keys: ['T'], description: 'Go to today' },
      { keys: ['D'], description: 'Day view' },
      { keys: ['W'], description: 'Week view' },
      { keys: ['L'], description: 'List view' },
      { keys: ['N'], description: 'New appointment' },
      { keys: ['R'], description: 'Refresh' },
      { keys: ['Ctrl', 'P'], description: 'Print' },
    ],
  },
  {
    group: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'A'], description: 'Go to Appointments' },
      { keys: ['G', 'P'], description: 'Go to Patients' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    group: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close modal / dismiss' },
    ],
  },
]

export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    if (e.key === '?') {
      e.preventDefault()
      setIsOpen(prev => !prev)
    }
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { isOpen, setIsOpen }
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3d3d]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-teal-400" />
            </div>
            <h2 className="text-base font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {SHORTCUTS.map(group => (
            <div key={group.group}>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">{group.group}</p>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center space-x-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          {j > 0 && <span className="text-[10px] text-gray-600 mx-0.5">+</span>}
                          <kbd className="inline-block min-w-[24px] text-center bg-[#0a1f1f] border border-[#1a3d3d] rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-300 shadow-sm">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1a3d3d] text-center">
          <p className="text-[10px] text-gray-500">
            Press <kbd className="bg-[#0a1f1f] border border-[#1a3d3d] rounded px-1 py-0.5 text-[9px] font-mono text-gray-400">?</kbd> anywhere to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}
