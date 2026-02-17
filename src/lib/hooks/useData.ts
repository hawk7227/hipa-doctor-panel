// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — DATA HOOKS
// Phase D: AbortController fetch, loading/error states, retry
// ═══════════════════════════════════════════════════════════════

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Generic async data hook ──
interface UseFetchOptions<T> {
  /** Async function that returns data. Receives AbortSignal for cancellation. */
  fetcher: (signal: AbortSignal) => Promise<T>
  /** Dependencies that trigger re-fetch */
  deps?: any[]
  /** Don't fetch on mount (manual trigger only) */
  manual?: boolean
  /** Skip fetch if condition is false */
  enabled?: boolean
}

interface UseFetchReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
  setData: (data: T | null) => void
}

export function useFetch<T>({ fetcher, deps = [], manual = false, enabled = true }: UseFetchOptions<T>): UseFetchReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!manual && enabled)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const execute = useCallback(async () => {
    // Abort previous request
    if (controllerRef.current) controllerRef.current.abort()
    
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher(controller.signal)
      if (mountedRef.current && !controller.signal.aborted) {
        setData(result)
        setLoading(false)
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return // Silently ignore aborts
      if (mountedRef.current) {
        setError(err?.message || 'An error occurred')
        setLoading(false)
      }
    }
  }, [fetcher])

  // Auto-fetch on mount/deps change
  useEffect(() => {
    if (!manual && enabled) execute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (controllerRef.current) controllerRef.current.abort()
    }
  }, [])

  return { data, loading, error, refetch: execute, setData }
}

// ── Supabase table fetch hook ──
interface UseSupabaseQueryOptions {
  table: string
  select?: string
  filters?: Record<string, any>
  order?: { column: string; ascending?: boolean }
  limit?: number
  enabled?: boolean
}

export function useSupabaseQuery<T = any>({
  table, select = '*', filters = {}, order, limit, enabled = true
}: UseSupabaseQueryOptions) {
  return useFetch<T[]>({
    enabled,
    deps: [table, select, JSON.stringify(filters), JSON.stringify(order), limit],
    fetcher: async (signal) => {
      let query = supabase.from(table).select(select)
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })

      if (order) {
        query = query.order(order.column, { ascending: order.ascending ?? false })
      }
      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data || []) as T[]
    },
  })
}

// ── Sync status for external APIs (DrChrono, etc.) ──
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface UseSyncOptions {
  syncFn: (signal: AbortSignal) => Promise<void>
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useSync({ syncFn, onSuccess, onError }: UseSyncOptions) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const sync = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus('syncing')
    setError(null)

    try {
      await syncFn(controller.signal)
      if (!controller.signal.aborted) {
        setStatus('success')
        setLastSynced(new Date())
        onSuccess?.()
        // Auto-reset to idle after 3s
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const msg = err?.message || 'Sync failed'
      setStatus('error')
      setError(msg)
      onError?.(msg)
    }
  }, [syncFn, onSuccess, onError])

  const cancel = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort()
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => { if (controllerRef.current) controllerRef.current.abort() }
  }, [])

  return { status, lastSynced, error, sync, cancel }
}
