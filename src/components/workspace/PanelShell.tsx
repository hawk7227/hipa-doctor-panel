'use client'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — PANEL SHELL
// Universal wrapper for all workspace panels
// Provides: drag, resize, lock, minimize, close, bring-to-front
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useRef, useState, useEffect } from 'react'
import { X, Minus, Lock, Unlock, Maximize2, GripVertical } from 'lucide-react'
import { usePanelState } from '@/lib/workspace/WorkspaceState'
import { getPanelConfig } from '@/lib/workspace/PanelRegistry'
import { Z_INDEX, BREAKPOINT } from '@/lib/constants'
import type { PanelId } from '@/lib/constants'

interface PanelShellProps {
  panelId: PanelId
  children: React.ReactNode
  /** Override title from registry */
  title?: string
  /** Additional header actions */
  headerActions?: React.ReactNode
  /** Hide default header controls */
  hideControls?: boolean
  /** Custom class for the panel body */
  bodyClassName?: string
}

function PanelShellInner({
  panelId,
  children,
  title,
  headerActions,
  hideControls = false,
  bodyClassName = '',
}: PanelShellProps) {
  const panel = usePanelState(panelId)
  const config = getPanelConfig(panelId)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < BREAKPOINT.MOBILE)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Don't render if not open
  if (!panel.isOpen) return null

  const displayTitle = title || config?.label || panelId
  const accentColor = config?.color || '#5eead4'

  // ─── DRAG HANDLERS ─────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (panel.isLocked || isMobile) return
    e.preventDefault()
    panel.bringToFront()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: panel.position.x,
      startPosY: panel.position.y,
    }
    setIsDragging(true)

    const handleDragMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      panel.move({
        x: Math.max(0, dragRef.current.startPosX + dx),
        y: Math.max(0, dragRef.current.startPosY + dy),
      })
    }

    const handleDragEnd = () => {
      dragRef.current = null
      setIsDragging(false)
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }

    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }, [panel, isMobile])

  // ─── RESIZE HANDLERS ───────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (panel.isLocked || isMobile) return
    e.preventDefault()
    e.stopPropagation()
    panel.bringToFront()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: panel.size.width,
      startH: panel.size.height,
    }
    setIsResizing(true)

    const minW = config?.minSize.width || 280
    const minH = config?.minSize.height || 300

    const handleResizeMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dw = ev.clientX - resizeRef.current.startX
      const dh = ev.clientY - resizeRef.current.startY
      panel.resize({
        width: Math.max(minW, resizeRef.current.startW + dw),
        height: Math.max(minH, resizeRef.current.startH + dh),
      })
    }

    const handleResizeEnd = () => {
      resizeRef.current = null
      setIsResizing(false)
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
    }

    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }, [panel, config, isMobile])

  // ─── CLICK TO FOCUS ────────────────────────────────
  const handleFocus = useCallback(() => {
    panel.bringToFront()
  }, [panel])

  // ─── MINIMIZED STATE ───────────────────────────────
  if (panel.isMinimized) {
    return (
      <div
        style={{
          position: isMobile ? 'relative' : 'absolute',
          left: isMobile ? 'auto' : panel.position.x,
          bottom: isMobile ? 'auto' : 0,
          zIndex: panel.zIndex,
        }}
        className="bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-lg cursor-pointer hover:border-[#2a5d5d] transition-colors"
        onClick={panel.maximize}
        role="button"
        tabIndex={0}
        aria-label={`Restore ${displayTitle} panel`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') panel.maximize() }}
      >
        <div className="flex items-center space-x-2 px-3 py-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-xs font-medium text-gray-300 truncate max-w-[120px]">{displayTitle}</span>
          <Maximize2 className="w-3 h-3 text-gray-500" />
        </div>
      </div>
    )
  }

  // ─── FULL PANEL ────────────────────────────────────
  return (
    <div
      ref={panelRef}
      style={{
        position: isMobile ? 'relative' : 'absolute',
        left: isMobile ? 'auto' : panel.position.x,
        top: isMobile ? 'auto' : panel.position.y,
        width: isMobile ? '100%' : panel.size.width,
        height: isMobile ? 'auto' : panel.size.height,
        zIndex: panel.zIndex,
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease',
      }}
      className={`bg-[#0d2626] border rounded-xl shadow-2xl flex flex-col overflow-hidden ${
        isDragging ? 'border-[#2a5d5d] shadow-[0_0_20px_rgba(94,234,212,0.15)]' : 'border-[#1a3d3d]'
      }`}
      onMouseDown={handleFocus}
    >
      {/* ─── HEADER ─────────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-[#1a3d3d] select-none ${
          panel.isLocked ? 'cursor-default' : 'cursor-grab'
        } ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleDragStart}
        style={{ borderTop: `2px solid ${accentColor}` }}
      >
        {/* Left: drag handle + title */}
        <div className="flex items-center space-x-2 min-w-0">
          {!panel.isLocked && !isMobile && (
            <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
          )}
          {config?.icon && (
            <config.icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          )}
          <span className="text-sm font-semibold text-white truncate">{displayTitle}</span>
          {panel.chartLocked && panel.isLocked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">READ ONLY</span>
          )}
        </div>

        {/* Right: controls */}
        {!hideControls && (
          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
            {headerActions}

            {/* Lock/Unlock */}
            {!isMobile && (
              <button
                onClick={(e) => { e.stopPropagation(); panel.isLocked ? panel.unlock() : panel.lock() }}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title={panel.isLocked ? 'Unlock panel position' : 'Lock panel position'}
                aria-label={panel.isLocked ? 'Unlock panel position' : 'Lock panel position'}
              >
                {panel.isLocked
                  ? <Lock className="w-3.5 h-3.5 text-amber-400" />
                  : <Unlock className="w-3.5 h-3.5 text-gray-500" />
                }
              </button>
            )}

            {/* Minimize */}
            <button
              onClick={(e) => { e.stopPropagation(); panel.minimize() }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Minimize panel"
              aria-label={`Minimize ${displayTitle} panel`}
            >
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Close */}
            <button
              onClick={(e) => { e.stopPropagation(); panel.close() }}
              className="p-1 rounded hover:bg-red-500/20 transition-colors"
              title="Close panel"
              aria-label={`Close ${displayTitle} panel`}
            >
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* ─── BODY ───────────────────────────────────── */}
      <div className={`flex-1 overflow-auto ${bodyClassName}`}>
        {children}
      </div>

      {/* ─── RESIZE HANDLE ──────────────────────────── */}
      {!panel.isLocked && !isMobile && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-label={`Resize ${displayTitle} panel`}
          tabIndex={0}
        >
          <svg
            className="w-3 h-3 absolute bottom-1 right-1 text-gray-600 group-hover:text-gray-400 transition-colors"
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="8" cy="4" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  )
}

// Wrap in React.memo — panels only re-render when THEIR state changes
const PanelShell = React.memo(PanelShellInner)
PanelShell.displayName = 'PanelShell'

export default PanelShell
export { PanelShell }
