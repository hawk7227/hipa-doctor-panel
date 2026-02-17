// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { memo, Suspense, type ReactNode } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — PANEL WRAPPER
// Phase E: Every panel gets error boundary + loading + memo
// ═══════════════════════════════════════════════════════════════

interface PanelWrapperProps {
  children: ReactNode
  label?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  skeletonRows?: number
  className?: string
  isEmpty?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
}

/**
 * Wrap any panel component for:
 * 1. Error boundary (catches render crashes)
 * 2. Loading skeleton (shows pulse animation)
 * 3. Error state (shows retry button)
 * 4. Empty state (shows placeholder)
 */
function PanelWrapperInner({
  children,
  label,
  loading,
  error,
  onRetry,
  skeletonRows = 4,
  className = '',
  isEmpty,
  emptyMessage,
  emptyIcon,
}: PanelWrapperProps) {
  // Loading
  if (loading) {
    return (
      <div className={className}>
        <PanelSkeleton rows={skeletonRows} />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className}`}>
        <div className="w-10 h-10 bg-red-500/15 rounded-lg flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-xs font-bold text-white mb-1">{label ? `${label} Error` : 'Error'}</p>
        <p className="text-[11px] text-gray-400 mb-3 max-w-xs">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-1.5 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    )
  }

  // Empty
  if (isEmpty) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className}`}>
        {emptyIcon || <div className="w-8 h-8 bg-gray-500/10 rounded-lg mb-2" />}
        <p className="text-xs text-gray-500 mt-2">{emptyMessage || 'No data available'}</p>
      </div>
    )
  }

  return <div className={className}>{children}</div>
}

// Memoized version
const MemoizedPanelWrapper = memo(PanelWrapperInner)

// Export with ErrorBoundary wrapping
export default function PanelWrapper(props: PanelWrapperProps) {
  return (
    <ErrorBoundary label={props.label}>
      <MemoizedPanelWrapper {...props} />
    </ErrorBoundary>
  )
}

/**
 * HOC to wrap any existing panel with memo + error boundary + loading.
 * Usage: const SafeAllergiesPanel = withPanelWrapper(AllergiesPanel, 'Allergies')
 */
export function withPanelWrapper<P extends object>(
  Component: React.ComponentType<P>,
  label: string
) {
  const Wrapped = memo(function WrappedPanel(props: P) {
    return (
      <ErrorBoundary label={label}>
        <Suspense fallback={<PanelSkeleton />}>
          <Component {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  })
  Wrapped.displayName = `PanelWrapper(${label})`
  return Wrapped
}
