'use client'

import { authFetch } from '@/lib/auth-fetch'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, Loader2, Cloud } from 'lucide-react'
import type { SyncStatus } from '@/lib/hooks/useData'

// ═══════════════════════════════════════════════════════════════
// DRCHRONO SYNC STATUS INDICATOR
// Phase D: Shows sync state, triggers manual sync
// ═══════════════════════════════════════════════════════════════

interface SyncIndicatorProps {
  doctorId: string | null
  compact?: boolean
}

export default function SyncIndicator({ doctorId, compact = false }: SyncIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check sync status on mount
  useEffect(() => {
    if (!doctorId) return
    checkStatus()
  }, [doctorId])

  const checkStatus = async () => {
    try {
      const res = await authFetch('/api/drchrono/sync-status')
      if (res.ok) {
        const data = await res.json()
        if (data.lastSynced) setLastSynced(data.lastSynced)
      }
    } catch { /* silent */ }
  }

  const triggerSync = useCallback(async () => {
    if (!doctorId || status === 'syncing') return
    setStatus('syncing')
    setError(null)

    try {
      const res = await fetch('/api/drchrono/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Sync failed (${res.status})`)
      }

      setStatus('success')
      setLastSynced(new Date().toISOString())
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message || 'Sync failed')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }, [doctorId, status])

  const statusConfig = {
    idle: { icon: Cloud, color: 'text-gray-400', bg: 'bg-[#0a1f1f]', border: 'border-[#1a3d3d]', label: 'DrChrono' },
    syncing: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Syncing...' },
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Synced' },
    error: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Sync Error' },
  }

  const cfg = statusConfig[status]
  const Icon = cfg.icon

  if (compact) {
    return (
      <button
        onClick={triggerSync}
        disabled={status === 'syncing'}
        className={`p-2 rounded-lg border transition-colors ${cfg.bg} ${cfg.border} ${cfg.color} hover:brightness-125 disabled:opacity-50`}
        title={error || cfg.label + (lastSynced ? ` — Last: ${new Date(lastSynced).toLocaleTimeString()}` : '')}
      >
        <Icon className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      </button>
    )
  }

  return (
    <button
      onClick={triggerSync}
      disabled={status === 'syncing'}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color} hover:brightness-125 disabled:opacity-50`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{cfg.label}</span>
      {lastSynced && status === 'idle' && (
        <span className="text-[9px] text-gray-500 ml-1">
          {new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
    </button>
  )
}
