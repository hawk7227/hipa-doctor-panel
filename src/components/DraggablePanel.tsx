// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import {
  X, Minimize2, Maximize2, Lock, Unlock, GripVertical,
  ChevronDown, ChevronRight, HelpCircle, BookOpen, Pin, PinOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// DraggablePanel — Universal movable/resizable panel
//
// Features:
//   ✓ Drag by header bar
//   ✓ Resize from corners/edges
//   ✓ Lock/Unlock position
//   ✓ Minimize (collapse to title bar)
//   ✓ Maximize (full width)
//   ✓ Close/Open
//   ✓ Built-in "How To" guide button
//   ✓ Z-index management (click to bring to front)
// ═══════════════════════════════════════════════════════════════

export interface HowToGuide {
  title: string
  steps: string[]
  tips?: string[]
}

interface DraggablePanelProps {
  id: string
  title: string
  icon: LucideIcon
  accentColor: string
  children: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  defaultX?: number
  defaultY?: number
  minWidth?: number
  minHeight?: number
  howTo?: HowToGuide
  onClose?: () => void
  /** If true, panel starts minimized */
  defaultMinimized?: boolean
  /** If true, panel starts locked */
  defaultLocked?: boolean
  /** If true, panel cannot be closed */
  unclosable?: boolean
  /** If true, renders inline (not absolute positioned) */
  inline?: boolean
}

export default function DraggablePanel({
  id, title, icon: Icon, accentColor, children,
  defaultWidth = 500, defaultHeight = 400,
  defaultX = 50, defaultY = 50,
  minWidth = 320, minHeight = 200,
  howTo, onClose, defaultMinimized = false, defaultLocked = false,
  unclosable = false, inline = false,
}: DraggablePanelProps) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY })
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight })
  const [minimized, setMinimized] = useState(defaultMinimized)
  const [maximized, setMaximized] = useState(false)
  const [locked, setLocked] = useState(defaultLocked)
  const [zIndex, setZIndex] = useState(10)
  const [showHowTo, setShowHowTo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<string | null>(null)
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, startPosX: 0, startPosY: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Bring to front on click
  const bringToFront = useCallback(() => {
    setZIndex(Date.now() % 10000 + 10)
  }, [])

  // ── DRAG ──
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (locked) return
    e.preventDefault()
    bringToFront()
    setDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }
  }, [locked, pos, bringToFront])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPos({ x: dragRef.current.startPosX + dx, y: Math.max(0, dragRef.current.startPosY + dy) })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  // ── RESIZE ──
  const onResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    if (locked) return
    e.preventDefault()
    e.stopPropagation()
    bringToFront()
    setResizing(handle)
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPosX: pos.x, startPosY: pos.y }
  }, [locked, size, pos, bringToFront])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeRef.current.startX
      const dy = e.clientY - resizeRef.current.startY
      const r = resizeRef.current
      let newW = r.startW, newH = r.startH, newX = r.startPosX, newY = r.startPosY

      if (resizing.includes('e')) newW = Math.max(minWidth, r.startW + dx)
      if (resizing.includes('w')) { newW = Math.max(minWidth, r.startW - dx); newX = r.startPosX + dx }
      if (resizing.includes('s')) newH = Math.max(minHeight, r.startH + dy)
      if (resizing.includes('n')) { newH = Math.max(minHeight, r.startH - dy); newY = Math.max(0, r.startPosY + dy) }

      setSize({ w: newW, h: newH })
      setPos({ x: newX, y: newY })
    }
    const onUp = () => setResizing(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [resizing, minWidth, minHeight])

  // ── MAXIMIZE ──
  const toggleMaximize = () => {
    if (maximized) { setMaximized(false); return }
    setMaximized(true)
    setMinimized(false)
  }

  const panelStyle = inline ? {} : maximized ? {
    position: 'fixed' as const, left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 9999,
  } : {
    position: 'absolute' as const, left: pos.x, top: pos.y, width: size.w,
    height: minimized ? 'auto' : size.h, zIndex,
  }

  return (
    <div
      ref={panelRef}
      onClick={bringToFront}
      style={panelStyle}
      className={`bg-[#0a1f1f] border border-[#1a3d3d]/60 rounded-xl overflow-hidden flex flex-col shadow-2xl shadow-black/40 ${
        dragging ? 'opacity-90 cursor-grabbing' : ''
      } ${inline ? 'w-full' : ''}`}
    >
      {/* ═══ TITLE BAR ═══ */}
      <div
        onMouseDown={!inline ? onDragStart : undefined}
        className={`flex items-center justify-between px-3 py-2 border-b border-[#1a3d3d]/40 select-none flex-shrink-0 ${
          locked ? 'cursor-default' : inline ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!inline && <GripVertical className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-sm font-bold text-white truncate">{title}</span>
          {locked && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* How To button */}
          {howTo && (
            <button onClick={(e) => { e.stopPropagation(); setShowHowTo(!showHowTo) }}
              className={`p-1 rounded transition-colors ${showHowTo ? 'text-teal-400 bg-teal-600/20' : 'text-gray-500 hover:text-teal-400 hover:bg-teal-600/10'}`}
              title="How to use this panel">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Lock/Unlock */}
          {!inline && (
            <button onClick={() => setLocked(!locked)}
              className="p-1 text-gray-500 hover:text-amber-400 rounded hover:bg-amber-600/10 transition-colors"
              title={locked ? 'Unlock panel' : 'Lock panel'}>
              {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Minimize */}
          <button onClick={() => { setMinimized(!minimized); setMaximized(false) }}
            className="p-1 text-gray-500 hover:text-blue-400 rounded hover:bg-blue-600/10 transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}>
            {minimized ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {/* Maximize */}
          {!inline && (
            <button onClick={toggleMaximize}
              className="p-1 text-gray-500 hover:text-green-400 rounded hover:bg-green-600/10 transition-colors"
              title={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Close */}
          {!unclosable && onClose && (
            <button onClick={onClose}
              className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-600/10 transition-colors"
              title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ HOW TO GUIDE (inline) ═══ */}
      {showHowTo && howTo && (
        <div className="px-4 py-3 bg-teal-900/20 border-b border-teal-500/20 max-h-[250px] overflow-y-auto flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold text-teal-400">{howTo.title}</span>
          </div>
          <div className="space-y-1.5 mb-2">
            {howTo.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-teal-600/30 text-teal-400 text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-xs text-gray-300">{step}</span>
              </div>
            ))}
          </div>
          {howTo.tips && howTo.tips.length > 0 && (
            <div className="border-t border-teal-500/20 pt-2 mt-2">
              <span className="text-[10px] text-amber-400 font-bold">💡 Tips:</span>
              {howTo.tips.map((tip, i) => (
                <div key={i} className="text-[11px] text-amber-200/70 mt-0.5">▸ {tip}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      {!minimized && (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}

      {/* ═══ RESIZE HANDLES (only when not inline, not locked, not minimized, not maximized) ═══ */}
      {!inline && !locked && !minimized && !maximized && (
        <>
          <div onMouseDown={e => onResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" />
          <div onMouseDown={e => onResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10" />
          <div onMouseDown={e => onResizeStart(e, 'ne')} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10" />
          <div onMouseDown={e => onResizeStart(e, 'e')} className="absolute top-1/2 right-0 w-2 h-8 -translate-y-1/2 cursor-e-resize z-10" />
          <div onMouseDown={e => onResizeStart(e, 'w')} className="absolute top-1/2 left-0 w-2 h-8 -translate-y-1/2 cursor-w-resize z-10" />
          <div onMouseDown={e => onResizeStart(e, 's')} className="absolute bottom-0 left-1/2 w-8 h-2 -translate-x-1/2 cursor-s-resize z-10" />
          {/* Visual resize indicator */}
          <div className="absolute bottom-1 right-1 pointer-events-none opacity-30">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" /></svg>
          </div>
        </>
      )}
    </div>
  )
}

// ═══ PANEL LAYOUT CONTAINER ═══
// Wraps multiple DraggablePanels with relative positioning
export function PanelLayout({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-full min-h-screen ${className}`}>
      {children}
    </div>
  )
}
