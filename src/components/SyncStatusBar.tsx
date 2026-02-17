// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// SYNC STATUS BAR — Floating online/offline indicator
//
// Shows: ● Online | ● Syncing (3 pending) | ● Offline (5 queued)
// Click to force sync or retry failed
//
// Add to your layout: <SyncStatusBar />
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState } from 'react'
import { useSyncStatus, useManualSync, useLocalDBStats } from '@/lib/offline-store'

export default function SyncStatusBar() {
  const { status, pendingCount, isOnline } = useSyncStatus()
  const { sync, bootstrap, syncing, retryFailed } = useManualSync()
  const stats = useLocalDBStats()
  const [expanded, setExpanded] = useState(false)

  const statusConfig = {
    idle: { color: 'bg-emerald-500', text: 'Synced', textColor: 'text-emerald-400' },
    syncing: { color: 'bg-blue-500 animate-pulse', text: 'Syncing...', textColor: 'text-blue-400' },
    offline: { color: 'bg-orange-500', text: 'Offline', textColor: 'text-orange-400' },
    error: { color: 'bg-red-500', text: 'Sync Error', textColor: 'text-red-400' },
  }

  const cfg = statusConfig[status] || statusConfig.idle

  return (
    <>
      {/* Floating pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d1b1b] border border-white/10 shadow-lg hover:border-white/20 transition-all text-xs"
        title={`${cfg.text} | ${pendingCount} pending`}
      >
        <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
        <span className={`${cfg.textColor} font-medium`}>{cfg.text}</span>
        {pendingCount > 0 && (
          <span className="text-gray-500">({pendingCount})</span>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="fixed bottom-14 right-4 z-50 w-72 rounded-xl bg-[#0d1b1b] border border-white/10 shadow-2xl p-4 text-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-white">Local Database</span>
            <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white">✕</button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Patients', value: stats.patients },
              { label: 'Appts', value: stats.appointments },
              { label: 'Notes', value: stats.notes },
              { label: 'Meds', value: stats.meds },
              { label: 'Allergies', value: stats.allergies },
              { label: 'Messages', value: stats.messages },
            ].map((s) => (
              <div key={s.label} className="bg-black/30 rounded-lg p-2 text-center">
                <div className="text-white font-bold">{s.value}</div>
                <div className="text-gray-500 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sync queue */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <span className="text-gray-400">Pending: </span>
              <span className={stats.pending > 0 ? 'text-orange-400 font-bold' : 'text-emerald-400'}>{stats.pending}</span>
            </div>
            <div>
              <span className="text-gray-400">Failed: </span>
              <span className={stats.failed > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>{stats.failed}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={sync}
              disabled={syncing || !isOnline}
              className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            {stats.failed > 0 && (
              <button
                onClick={retryFailed}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-all"
              >
                Retry ({stats.failed})
              </button>
            )}
          </div>

          {/* Bootstrap (first-time setup) */}
          {stats.patients === 0 && stats.appointments === 0 && isOnline && (
            <button
              onClick={bootstrap}
              disabled={syncing}
              className="w-full mt-2 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 disabled:opacity-50 transition-all"
            >
              {syncing ? 'Downloading...' : '⬇ Download All Data'}
            </button>
          )}

          {/* Offline banner */}
          {!isOnline && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-center">
              Working offline — changes will sync when connected
            </div>
          )}
        </div>
      )}
    </>
  )
}
