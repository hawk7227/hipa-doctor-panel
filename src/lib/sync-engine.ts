// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// SYNC ENGINE — Manages data sync between IndexedDB and server
//
// Write: UI → IndexedDB → SyncQueue → Server (background)
// Read:  IndexedDB (instant) → Server pull (background update)
// Offline: writes queue up, flush when connection returns
//
// Install: npm install dexie
// ═══════════════════════════════════════════════════════════════

import { getLocalDB, getDeviceId, nowISO, type SyncQueueItem } from './local-db'

// ── Types ────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'
type SyncListener = (status: SyncStatus, detail?: string) => void

interface PullResult {
  table: string
  count: number
  timestamp: string
}

// ── Constants ────────────────────────────────────────────────

const SYNCABLE_TABLES = [
  'patients', 'appointments', 'clinicalNotes',
  'medications', 'allergies', 'messages',
] as const

const FLUSH_DEBOUNCE_MS = 500
const PULL_INTERVAL_MS = 60_000  // 60 seconds
const INITIAL_PULL_DELAY_MS = 2_000
const BATCH_SIZE = 10
const MAX_RETRY_ATTEMPTS = 5

// ── Sync Engine ──────────────────────────────────────────────

class SyncEngine {
  private _isOnline: boolean = true
  private _status: SyncStatus = 'idle'
  private _listeners: Set<SyncListener> = new Set()
  private _flushTimer: ReturnType<typeof setTimeout> | null = null
  private _pullTimer: ReturnType<typeof setInterval> | null = null
  private _initialized = false
  private _syncing = false

  // ── Lifecycle ──────────────────────────────────────────────

  init() {
    if (this._initialized || typeof window === 'undefined') return
    this._initialized = true
    this._isOnline = navigator.onLine

    window.addEventListener('online', this._handleOnline)
    window.addEventListener('offline', this._handleOffline)

    // Listen for SW background sync requests
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SYNC_REQUESTED') this.flush()
      })
    }

    // Auto-pull on interval
    this._pullTimer = setInterval(() => {
      if (this._isOnline && !this._syncing) this.pullAll()
    }, PULL_INTERVAL_MS)

    // Initial pull with delay
    if (this._isOnline) {
      setTimeout(() => this.pullAll(), INITIAL_PULL_DELAY_MS)
    } else {
      this._setStatus('offline')
    }

    console.log('[Sync] ✅ Initialized | device:', getDeviceId(), '| online:', this._isOnline)
  }

  destroy() {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this._handleOnline)
    window.removeEventListener('offline', this._handleOffline)
    if (this._pullTimer) clearInterval(this._pullTimer)
    if (this._flushTimer) clearTimeout(this._flushTimer)
    this._listeners.clear()
    this._initialized = false
  }

  private _handleOnline = () => {
    console.log('[Sync] 🟢 Online')
    this._isOnline = true
    this._setStatus('idle')
    this.flush()
    this.pullAll()
  }

  private _handleOffline = () => {
    console.log('[Sync] 🔴 Offline')
    this._isOnline = false
    this._setStatus('offline')
  }

  // ── Status ─────────────────────────────────────────────────

  get isOnline() { return this._isOnline }
  get status() { return this._status }

  subscribe(fn: SyncListener): () => void {
    this._listeners.add(fn)
    return () => { this._listeners.delete(fn) }
  }

  private _setStatus(status: SyncStatus, detail?: string) {
    this._status = status
    this._listeners.forEach(fn => fn(status, detail))
  }

  // ── Enqueue (local write + queue for sync) ─────────────────

  async enqueue(
    table: string,
    recordId: string,
    action: 'create' | 'update' | 'delete',
    data: Record<string, any>
  ): Promise<void> {
    const db = getLocalDB()
    const deviceId = getDeviceId()
    const now = nowISO()

    // 1. Write to IndexedDB immediately
    if (action === 'create' || action === 'update') {
      const localData = { ...data, id: recordId, updated_at: now, _synced: 0, _device_id: deviceId }
      await (db as any)[table].put(localData)
    } else if (action === 'delete') {
      try { await (db as any)[table].delete(recordId) } catch { /* may not exist */ }
    }

    // 2. Add to sync queue
    await db.syncQueue.add({
      table,
      record_id: recordId,
      action,
      data: JSON.stringify(data),
      device_id: deviceId,
      created_at: now,
      synced: 0,
      attempts: 0,
      last_error: null,
    })

    // 3. Schedule flush
    this._scheduleFlush()
  }

  // ── Flush (push queued changes to server) ──────────────────

  private _scheduleFlush() {
    if (this._flushTimer) clearTimeout(this._flushTimer)
    this._flushTimer = setTimeout(() => this.flush(), FLUSH_DEBOUNCE_MS)
  }

  async flush(): Promise<number> {
    if (!this._isOnline || this._syncing) return 0
    this._syncing = true
    this._setStatus('syncing', 'Pushing changes...')

    const db = getLocalDB()
    let synced = 0

    try {
      const pending = await db.syncQueue
        .where('synced').equals(0)
        .sortBy('created_at')

      if (pending.length === 0) {
        this._setStatus('idle')
        return 0
      }

      console.log(`[Sync] 📤 Flushing ${pending.length} pending changes`)

      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE)

        try {
          const res = await fetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: batch }),
          })

          if (res.ok) {
            // Mark items synced
            for (const item of batch) {
              if (item.id != null) {
                await db.syncQueue.update(item.id, { synced: 1 })
                try {
                  await (db as any)[item.table].update(item.record_id, { _synced: 1 })
                } catch { /* record may have been deleted */ }
              }
            }
            synced += batch.length
          } else {
            // Server error — mark with error
            const errText = await res.text().catch(() => `HTTP ${res.status}`)
            for (const item of batch) {
              if (item.id != null) {
                const newAttempts = (item.attempts || 0) + 1
                await db.syncQueue.update(item.id, {
                  attempts: newAttempts,
                  last_error: errText,
                  synced: newAttempts >= MAX_RETRY_ATTEMPTS ? -1 : 0,
                })
              }
            }
            console.error(`[Sync] Push error (${res.status}):`, errText)
            break
          }
        } catch (err: any) {
          console.warn('[Sync] Network error during flush:', err.message)
          this._isOnline = false
          this._setStatus('offline')
          break
        }
      }

      // Register background sync if supported
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        try { await (reg as any).sync.register('medazon-sync') } catch { /* ok */ }
      }

      this._setStatus(synced > 0 ? 'idle' : 'error')
      console.log(`[Sync] ✅ Flushed ${synced}/${pending.length}`)
    } finally {
      this._syncing = false
    }

    return synced
  }

  // ── Pull (fetch latest from server) ────────────────────────

  async pull(table: string): Promise<PullResult> {
    if (!this._isOnline) return { table, count: 0, timestamp: '' }

    const db = getLocalDB()
    const metaKey = `last_pull_${table}`
    const meta = await db.syncMeta.get(metaKey).catch(() => null)
    const since = meta?.value || '2020-01-01T00:00:00Z'

    try {
      const res = await fetch(`/api/sync/pull?table=${encodeURIComponent(table)}&since=${encodeURIComponent(since)}`)
      if (!res.ok) {
        console.error(`[Sync] Pull ${table} failed: ${res.status}`)
        return { table, count: 0, timestamp: since }
      }

      const { records, timestamp, hasMore } = await res.json()

      if (records?.length > 0) {
        // Merge: only update local records if server version is newer
        const localRecords = records.map((r: any) => ({
          ...r,
          _synced: 1,
          _device_id: r._device_id || 'server',
        }))

        await (db as any)[table].bulkPut(localRecords)

        await db.syncMeta.put({
          key: metaKey,
          value: timestamp || nowISO(),
          updated_at: nowISO(),
        })

        console.log(`[Sync] 📥 Pulled ${records.length} ${table}`)

        // If there's more data, pull again
        if (hasMore) {
          return this.pull(table)
        }

        return { table, count: records.length, timestamp }
      }

      return { table, count: 0, timestamp: since }
    } catch (err: any) {
      // Network error is fine — we're offline-first
      if (err.message?.includes('Failed to fetch')) {
        this._isOnline = false
        this._setStatus('offline')
      }
      return { table, count: 0, timestamp: since }
    }
  }

  async pullAll(): Promise<PullResult[]> {
    if (!this._isOnline || this._syncing) return []
    this._syncing = true
    this._setStatus('syncing', 'Pulling latest...')

    const results: PullResult[] = []

    try {
      for (const table of SYNCABLE_TABLES) {
        results.push(await this.pull(table))
      }
      this._setStatus('idle')
    } catch {
      this._setStatus('error')
    } finally {
      this._syncing = false
    }

    return results
  }

  // ── Bootstrap (initial full sync from Supabase) ────────────
  // Call once when user first logs in to populate IndexedDB

  async bootstrap(): Promise<void> {
    console.log('[Sync] 🔄 Bootstrapping — full initial sync...')
    const db = getLocalDB()

    // Reset all pull timestamps to force full download
    await db.syncMeta.clear()

    // Pull everything
    const results = await this.pullAll()
    const total = results.reduce((sum, r) => sum + r.count, 0)
    console.log(`[Sync] 🎉 Bootstrap complete: ${total} records`)
  }

  // ── Stats ──────────────────────────────────────────────────

  async getPendingCount(): Promise<number> {
    return getLocalDB().syncQueue.where('synced').equals(0).count()
  }

  async getFailedCount(): Promise<number> {
    return getLocalDB().syncQueue.where('synced').equals(-1).count()
  }

  async retryFailed(): Promise<void> {
    await getLocalDB().syncQueue.where('synced').equals(-1).modify({ synced: 0, attempts: 0 })
    this.flush()
  }

  async clearSynced(): Promise<void> {
    await getLocalDB().syncQueue.where('synced').equals(1).delete()
  }

  async getQueueSize(): Promise<number> {
    return getLocalDB().syncQueue.count()
  }
}

// ── Singleton ────────────────────────────────────────────────

let _engine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!_engine) _engine = new SyncEngine()
  return _engine
}

export { SyncEngine, SYNCABLE_TABLES }
export type { SyncStatus, PullResult }
