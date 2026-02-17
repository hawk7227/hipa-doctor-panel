// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PatientCache from '@/lib/patient-cache'

// ═══════════════════════════════════════════════════════════════
// usePatientCache — Auto-syncs patient data to IndexedDB
// 
// Usage: const { isOnline, cacheStatus, lastSync } = usePatientCache()
//
// Automatically syncs Supabase → IndexedDB every 15 minutes
// On load, checks if cache is stale and refreshes
// Components can then use PatientCache.searchPatients() etc.
// as offline fallback when Supabase is unreachable.
// ═══════════════════════════════════════════════════════════════

const SYNC_INTERVAL = 15 * 60 * 1000 // 15 minutes
const STALE_THRESHOLD = 30 * 60 * 1000 // 30 minutes

export function usePatientCache(doctorId?: string) {
  const [cacheStatus, setCacheStatus] = useState<{
    available: boolean
    lastSync: string | null
    counts: Record<string, number>
    syncing: boolean
  }>({ available: false, lastSync: null, counts: {}, syncing: false })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncingRef = useRef(false)

  const syncCache = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setCacheStatus(prev => ({ ...prev, syncing: true }))

    try {
      const results = await PatientCache.syncFromSupabase(supabase, doctorId)
      const status = await PatientCache.getCacheStatus()
      setCacheStatus({
        available: status.available,
        lastSync: status.lastSync,
        counts: status.counts,
        syncing: false,
      })
      console.log('[usePatientCache] Cache synced:', results)
    } catch (err) {
      console.error('[usePatientCache] Sync failed:', err)
      setCacheStatus(prev => ({ ...prev, syncing: false }))
    }

    syncingRef.current = false
  }, [doctorId])

  useEffect(() => {
    // Check cache status on mount
    PatientCache.getCacheStatus().then(status => {
      setCacheStatus({ ...status, syncing: false })

      // If cache is stale or empty, sync now
      const lastSync = status.lastSync ? new Date(status.lastSync).getTime() : 0
      const isStale = Date.now() - lastSync > STALE_THRESHOLD
      const isEmpty = Object.values(status.counts).every(c => c === 0)

      if (isStale || isEmpty) {
        syncCache()
      }
    }).catch(() => {
      // IndexedDB not available
      setCacheStatus({ available: false, lastSync: null, counts: {}, syncing: false })
    })

    // Set up periodic sync
    intervalRef.current = setInterval(syncCache, SYNC_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [syncCache])

  return {
    cacheStatus,
    syncCache,
    PatientCache,
  }
}

export default usePatientCache
