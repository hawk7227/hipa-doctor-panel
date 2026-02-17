// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, type ReactNode } from 'react'
import {
  ChevronDown, ChevronRight, Maximize2, Minimize2, Lock, Unlock,
  HelpCircle, BookOpen, X, GripVertical,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// InlinePanel — Wraps existing content with panel controls
// Use this to add minimize/maximize/lock/help to any section
// without changing the underlying page structure.
//
// Controls: Minimize (collapse), Maximize (fullscreen),
//   Lock (disable resize/drag), How To (built-in guide)
// ═══════════════════════════════════════════════════════════════

export interface PanelHowTo {
  title: string
  description: string
  steps: string[]
  tips?: string[]
}

interface InlinePanelProps {
  title: string
  icon: LucideIcon
  accentColor: string
  children: ReactNode
  howTo?: PanelHowTo
  /** Show how-to on first open */
  showHowToOnMount?: boolean
  /** Can this panel be closed? */
  closable?: boolean
  onClose?: () => void
  /** Extra buttons in header */
  headerActions?: ReactNode
  /** Default collapsed state */
  defaultCollapsed?: boolean
  className?: string
}

export default function InlinePanel({
  title, icon: Icon, accentColor, children, howTo,
  showHowToOnMount = false, closable = false, onClose,
  headerActions, defaultCollapsed = false, className = '',
}: InlinePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [maximized, setMaximized] = useState(false)
  const [locked, setLocked] = useState(false)
  const [showHelp, setShowHelp] = useState(showHowToOnMount)

  if (maximized) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a1118] flex flex-col">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d2626] border-b border-[#1a3d3d]"
          style={{ borderTop: `3px solid ${accentColor}` }}>
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
            <span className="text-base font-bold text-white">{title}</span>
            {locked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <div className="flex items-center gap-1">
            {howTo && (
              <button onClick={() => setShowHelp(!showHelp)} className={`p-1.5 rounded-lg transition-colors ${showHelp ? 'bg-teal-600/20 text-teal-400' : 'text-gray-500 hover:text-teal-400'}`}>
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setMaximized(false)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {showHelp && howTo && <HowToContent howTo={howTo} onClose={() => setShowHelp(false)} accentColor={accentColor} />}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    )
  }

  return (
    <div className={`bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden ${className}`}
      style={{ borderTop: `3px solid ${accentColor}` }}>
      {/* ═══ PANEL HEADER ═══ */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d2626]/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-sm font-bold text-white truncate">{title}</span>
          {locked && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* How To — PROMINENT */}
          {howTo && (
            <button onClick={() => setShowHelp(!showHelp)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                showHelp
                  ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                  : 'bg-teal-600/10 text-teal-400 border border-teal-500/20 hover:bg-teal-600/20 hover:border-teal-500/40'
              }`}>
              <HelpCircle className="w-3.5 h-3.5" />
              How To Use
            </button>
          )}
          {headerActions}
          {/* Lock */}
          <button onClick={() => setLocked(!locked)}
            className="p-1.5 text-gray-500 hover:text-amber-400 rounded-lg hover:bg-amber-600/10 transition-colors"
            title={locked ? 'Unlock' : 'Lock'}>
            {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          {/* Collapse */}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-blue-600/10 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {/* Maximize */}
          <button onClick={() => setMaximized(true)}
            className="p-1.5 text-gray-500 hover:text-green-400 rounded-lg hover:bg-green-600/10 transition-colors"
            title="Maximize">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {/* Close */}
          {closable && onClose && (
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-600/10 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ HOW TO GUIDE ═══ */}
      {showHelp && howTo && <HowToContent howTo={howTo} onClose={() => setShowHelp(false)} accentColor={accentColor} />}

      {/* ═══ CONTENT ═══ */}
      {!collapsed && <div className="overflow-auto">{children}</div>}
    </div>
  )
}

function HowToContent({ howTo, onClose, accentColor }: { howTo: PanelHowTo; onClose: () => void; accentColor: string }) {
  return (
    <div className="px-4 py-3 bg-teal-900/15 border-b border-teal-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-bold text-teal-400">{howTo.title}</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-white rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">{howTo.description}</p>
      <div className="space-y-2 mb-2">
        {howTo.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${accentColor}30`, color: accentColor }}>{i + 1}</span>
            <span className="text-xs text-gray-300">{step}</span>
          </div>
        ))}
      </div>
      {howTo.tips && howTo.tips.length > 0 && (
        <div className="border-t border-teal-500/15 pt-2 mt-2">
          <span className="text-[10px] text-amber-400 font-bold">💡 Pro Tips</span>
          {howTo.tips.map((tip, i) => (
            <div key={i} className="text-[11px] text-amber-200/70 mt-1">▸ {tip}</div>
          ))}
        </div>
      )}
    </div>
  )
}
