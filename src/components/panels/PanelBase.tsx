// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useState, useCallback, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Inbox, Loader2, ChevronDown, ChevronRight, X, Lock, Unlock, GripVertical } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// PanelBase — Enterprise EHR Panel Foundation
//
// All panels render through this. Enforces:
//   loading → error → empty → success states
//   Drag handle (grid-drag-handle class for react-grid-layout)
//   Lock/unlock toggle
//   Consistent header, skeleton, retry
//   Keyboard accessible (Escape to close)
//
// Used inside react-grid-layout grid items AND as standalone overlays.
// ═══════════════════════════════════════════════════════════════

export interface PanelBaseProps {
  /** Panel title */
  title: string
  /** Lucide icon component */
  icon?: React.ElementType
  /** Top border accent color (hex) */
  accentColor?: string
  /** Data loading state */
  loading: boolean
  /** Error message (null = no error) */
  error: string | null
  /** Is there data to show? (empty state check) */
  hasData: boolean
  /** Custom empty message */
  emptyMessage?: string
  /** Custom empty icon */
  emptyIcon?: React.ElementType
  /** Header action buttons (Add, Sync, etc.) */
  headerActions?: ReactNode
  /** Retry callback for error state */
  onRetry?: () => void
  /** Close callback (X button) — omit to hide X */
  onClose?: () => void
  /** Is panel locked (read-only)? */
  locked?: boolean
  /** Lock toggle callback — omit to hide lock button */
  onLockToggle?: () => void
  /** Can collapse? */
  collapsible?: boolean
  /** Default collapsed */
  defaultCollapsed?: boolean
  /** Badge text/count */
  badge?: string | number
  /** DrChrono sync status */
  syncStatus?: 'synced' | 'syncing' | 'error' | null
  /** Show drag handle? (for grid layout) */
  draggable?: boolean
  /** Children = panel content (only rendered in success state) */
  children: ReactNode
  /** Additional className */
  className?: string
}

// ─── Drag Handle SVG ────────────────────────────────────────────
function DragDots() {
  return (
    <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="13" r="1.5" />
    </svg>
  )
}

// ─── Loading Skeleton ───────────────────────────────────────────
export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-4 bg-[#1a3d3d] rounded`} style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
      <div className="h-8 bg-[#1a3d3d] rounded w-full mt-2" />
    </div>
  )
}

// ─── Error State ────────────────────────────────────────────────
export function PanelError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-red-400 font-medium mb-1">Failed to load</p>
      <p className="text-xs text-gray-500 text-center mb-3 max-w-xs break-words">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg hover:bg-teal-500/20 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────
export function PanelEmpty({ message, icon: Icon }: { message: string; icon?: React.ElementType }) {
  const EmptyIcon = Icon || Inbox
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-10 h-10 rounded-full bg-[#1a3d3d] flex items-center justify-center mb-3">
        <EmptyIcon className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

// ─── Sync Badge ─────────────────────────────────────────────────
export function SyncBadge({ status }: { status: 'synced' | 'syncing' | 'error' }) {
  if (status === 'syncing') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
      <Loader2 className="w-2.5 h-2.5 animate-spin" />Syncing
    </span>
  )
  if (status === 'synced') return (
    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30">Synced</span>
  )
  return (
    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">Sync Error</span>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL BASE COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PanelBase({
  title,
  icon: Icon,
  accentColor = '#14b8a6',
  loading,
  error,
  hasData,
  emptyMessage = 'No data found',
  emptyIcon,
  headerActions,
  onRetry,
  onClose,
  locked = false,
  onLockToggle,
  collapsible = false,
  defaultCollapsed = false,
  badge,
  syncStatus,
  draggable = true,
  children,
  className = '',
}: PanelBaseProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation()
      onClose()
    }
  }, [onClose])

  return (
    <div
      className={`bg-[#0d2626] border border-[#1a3d3d] rounded-xl overflow-hidden flex flex-col h-full ${className}`}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={title}
    >
      {/* ── Header with drag handle ── */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b border-[#1a3d3d] flex-shrink-0 select-none ${
          draggable ? 'grid-drag-handle cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{ borderTop: `2px solid ${accentColor}` }}
      >
        {draggable && <DragDots />}

        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 text-gray-500 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}

        {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />}

        <h3 className="text-sm font-semibold text-white flex-1 truncate">{title}</h3>

        {badge !== undefined && badge !== null && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/10 text-gray-300 border border-white/10">
            {badge}
          </span>
        )}

        {syncStatus && <SyncBadge status={syncStatus} />}

        {loading && <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin flex-shrink-0" />}

        {/* Lock/Unlock */}
        {onLockToggle && (
          <button
            onClick={onLockToggle}
            className={`p-1 rounded transition-colors ${
              locked
                ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title={locked ? 'Unlock panel' : 'Lock panel (read-only)'}
          >
            {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Header actions (Add, Sync buttons etc.) */}
        {headerActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {headerActions}
          </div>
        )}

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Content: loading → error → empty → success ── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <PanelSkeleton />
          ) : error ? (
            <PanelError error={error} onRetry={onRetry} />
          ) : !hasData ? (
            <PanelEmpty message={emptyMessage} icon={emptyIcon} />
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}
