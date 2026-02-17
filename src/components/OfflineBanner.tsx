// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// OFFLINE BANNER — Top-of-page notification when offline
//
// Shows: ⚡ You're offline — 3 changes will sync when connected
// Auto-hides when back online
//
// Add to your layout: <OfflineBanner />
// ═══════════════════════════════════════════════════════════════

'use client'

import { useSyncStatus } from '@/lib/offline-store'

export default function OfflineBanner() {
  const { status, pendingCount, isOnline } = useSyncStatus()

  if (isOnline && status !== 'error') return null

  return (
    <div className={`w-full px-4 py-2 text-center text-xs font-medium z-[60] ${
      status === 'error'
        ? 'bg-red-500/20 text-red-300 border-b border-red-500/30'
        : 'bg-orange-500/20 text-orange-300 border-b border-orange-500/30'
    }`}>
      {status === 'error' ? (
        <>⚠ Sync error — {pendingCount} change{pendingCount !== 1 ? 's' : ''} waiting to retry</>
      ) : (
        <>⚡ You&apos;re offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} will sync when connected` : ' — using local data'}</>
      )}
    </div>
  )
}
