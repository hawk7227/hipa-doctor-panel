'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Database, RefreshCw, Play, CheckCircle, XCircle, AlertTriangle, Clock, ArrowRight, Pause, BarChart3, Zap } from 'lucide-react'

interface TableCount { [key: string]: number }
interface SyncLog { id: number; sync_type: string; sync_mode: string; status: string; records_synced: number; records_errored: number; started_at: string; completed_at: string; metadata: any }

const ENTITIES = [
  { key: 'patients', label: 'Patients', icon: '👤', description: 'Demographics, contact info, insurance' },
  { key: 'medications', label: 'Medications', icon: '💊', description: 'Active & historical medications' },
  { key: 'allergies', label: 'Allergies', icon: '⚠️', description: 'Drug & environmental allergies' },
  { key: 'problems', label: 'Problems', icon: '🏥', description: 'Active diagnoses & conditions' },
  { key: 'lab_results', label: 'Lab Results', icon: '🧪', description: 'Lab orders & results' },
  { key: 'clinical_notes', label: 'Clinical Notes', icon: '📋', description: 'Visit notes & documentation' },
  { key: 'vaccines', label: 'Vaccines', icon: '💉', description: 'Immunization records' },
]

const TABLE_MAP: Record<string, string> = {
  patients: 'drchrono_patients',
  medications: 'drchrono_medications',
  allergies: 'drchrono_allergies',
  problems: 'drchrono_problems',
  lab_results: 'drchrono_lab_results',
  clinical_notes: 'drchrono_clinical_notes',
  vaccines: 'drchrono_vaccines',
}

export default function DrChronoMigrationPage() {
  const [tableCounts, setTableCounts] = useState<TableCount>({})
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<Record<string, { synced: number; errored: number; pages: number; running: boolean }>>({})
  const [autoSyncEntity, setAutoSyncEntity] = useState<string | null>(null)
  const autoSyncRef = useRef(false)
  const [drchronoStatus, setDrchronoStatus] = useState<'connected' | 'expired' | 'unknown'>('unknown')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/drchrono/sync-status', {
        headers: { 'Authorization': `Bearer ${(await getToken())}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTableCounts(data.table_counts || {})
        setSyncLogs(data.syncs || [])
        setDrchronoStatus('connected')
      } else if (res.status === 401) {
        setDrchronoStatus('expired')
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatus(); const i = setInterval(fetchStatus, 30000); return () => clearInterval(i) }, [fetchStatus])

  // Sync one page of an entity
  const syncPage = async (entity: string, cursor: string | null = null): Promise<{ next: string | null; synced: number; errored: number }> => {
    const token = await getToken()
    const res = await fetch('/api/drchrono/bulk-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entity, cursor }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Sync failed')
    return { next: data.next_cursor || null, synced: data.upserted || 0, errored: data.errored || 0 }
  }

  // Full sync — pages through all data for an entity
  const runFullSync = async (entity: string) => {
    setSyncing(entity)
    setSyncProgress(prev => ({ ...prev, [entity]: { synced: 0, errored: 0, pages: 0, running: true } }))
    let cursor: string | null = null
    let totalSynced = 0
    let totalErrored = 0
    let pages = 0

    try {
      do {
        if (!autoSyncRef.current && syncing !== entity) break // stopped
        const result = await syncPage(entity, cursor)
        cursor = result.next
        totalSynced += result.synced
        totalErrored += result.errored
        pages++
        setSyncProgress(prev => ({ ...prev, [entity]: { synced: totalSynced, errored: totalErrored, pages, running: !!cursor } }))
      } while (cursor)
    } catch (e: any) {
      console.error(`Sync ${entity} failed:`, e)
      setSyncProgress(prev => ({ ...prev, [entity]: { ...prev[entity], running: false } }))
    }

    setSyncing(null)
    fetchStatus() // refresh counts
    return { totalSynced, totalErrored, pages }
  }

  // Auto-sync all entities sequentially
  const runFullMigration = async () => {
    autoSyncRef.current = true
    for (const e of ENTITIES) {
      if (!autoSyncRef.current) break
      setAutoSyncEntity(e.key)
      await runFullSync(e.key)
    }
    autoSyncRef.current = false
    setAutoSyncEntity(null)
  }

  const stopSync = () => {
    autoSyncRef.current = false
    setSyncing(null)
    setAutoSyncEntity(null)
  }

  const totalRecords = Object.values(tableCounts).reduce((s, n) => s + n, 0)
  const totalEntities = ENTITIES.filter(e => (tableCounts[TABLE_MAP[e.key]] || 0) > 0).length

  return (
    <div className="p-6 text-white max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-teal-400" />
          <div>
            <h1 className="text-xl font-bold">DrChrono → Medazon Migration</h1>
            <p className="text-xs text-gray-500">Sync all patient data from DrChrono to your local system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold ${drchronoStatus === 'connected' ? 'bg-green-600/20 text-green-400' : drchronoStatus === 'expired' ? 'bg-red-600/20 text-red-400' : 'bg-gray-600/20 text-gray-400'}`}>
            {drchronoStatus === 'connected' ? '● Connected' : drchronoStatus === 'expired' ? '● Token Expired' : '● Unknown'}
          </span>
          <button onClick={fetchStatus} className="p-2 hover:bg-[#1a3d3d] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
      </div>

      {drchronoStatus === 'expired' && (
        <div className="mb-4 p-3 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1"><p className="text-sm text-red-400 font-medium">DrChrono token expired</p><p className="text-xs text-red-400/70">Re-authorize to continue syncing</p></div>
          <a href="/api/drchrono/auth" className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium">Re-Authorize</a>
        </div>
      )}

      {/* Overall stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4">
          <div className="text-2xl font-bold text-teal-400">{totalRecords.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">Total Records Synced</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4">
          <div className="text-2xl font-bold">{totalEntities}/{ENTITIES.length}</div>
          <div className="text-[10px] text-gray-500">Data Types Synced</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4">
          <div className="text-2xl font-bold">{tableCounts['drchrono_patients']?.toLocaleString() || '0'}</div>
          <div className="text-[10px] text-gray-500">Patients Synced</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{syncLogs.length}</div>
          <div className="text-[10px] text-gray-500">Sync Operations</div>
        </div>
      </div>

      {/* Full migration button */}
      <div className="mb-6 flex gap-3">
        {autoSyncRef.current ? (
          <button onClick={stopSync} className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 flex items-center gap-2">
            <Pause className="w-4 h-4" />Stop Migration
          </button>
        ) : (
          <button onClick={runFullMigration} disabled={syncing !== null || drchronoStatus === 'expired'} className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-40 flex items-center gap-2">
            <Zap className="w-4 h-4" />Run Full Migration (All Data)
          </button>
        )}
        {autoSyncEntity && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-600/10 border border-teal-500/20 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />
            <span className="text-xs text-teal-400">Migrating: {ENTITIES.find(e => e.key === autoSyncEntity)?.label}...</span>
          </div>
        )}
      </div>

      {/* Entity cards */}
      <div className="space-y-2 mb-6">
        <h2 className="text-sm font-bold text-gray-400 mb-2">Data Types</h2>
        {ENTITIES.map(e => {
          const count = tableCounts[TABLE_MAP[e.key]] || 0
          const progress = syncProgress[e.key]
          const isSyncing = syncing === e.key
          return (
            <div key={e.key} className={`bg-[#0a1f1f] border rounded-xl p-4 flex items-center gap-4 ${isSyncing ? 'border-teal-500/40' : 'border-[#1a3d3d]'}`}>
              <div className="text-2xl">{e.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{e.label}</span>
                  {count > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                </div>
                <div className="text-[10px] text-gray-500">{e.description}</div>
                {progress && (
                  <div className="mt-1 flex items-center gap-2">
                    {progress.running && <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />}
                    <span className="text-[10px] text-teal-400">{progress.synced.toLocaleString()} synced</span>
                    {progress.errored > 0 && <span className="text-[10px] text-red-400">{progress.errored} errors</span>}
                    <span className="text-[10px] text-gray-600">({progress.pages} pages)</span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-bold ${count > 0 ? 'text-white' : 'text-gray-600'}`}>{count.toLocaleString()}</div>
                <div className="text-[9px] text-gray-600">records</div>
              </div>
              <button
                onClick={() => runFullSync(e.key)}
                disabled={syncing !== null || drchronoStatus === 'expired'}
                className="px-3 py-1.5 bg-teal-600/20 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-600/30 disabled:opacity-30 shrink-0 flex items-center gap-1"
              >
                {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {count > 0 ? 'Re-sync' : 'Sync'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Recent sync logs */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4">
        <h2 className="text-sm font-bold mb-3">Recent Sync History</h2>
        {loading ? <div className="text-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-teal-400 mx-auto" /></div> : (
          <div className="space-y-1.5">
            {syncLogs.length === 0 && <p className="text-xs text-gray-600 text-center py-4">No sync history yet</p>}
            {syncLogs.slice(0, 15).map(log => (
              <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-[#061818] rounded-lg">
                {log.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" /> :
                 log.status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" /> :
                 <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">{log.sync_type}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{log.sync_mode}</span>
                </div>
                <span className="text-[10px] text-green-400 shrink-0">+{log.records_synced}</span>
                {log.records_errored > 0 && <span className="text-[10px] text-red-400 shrink-0">-{log.records_errored}</span>}
                <span className="text-[10px] text-gray-600 shrink-0">{log.started_at ? new Date(log.started_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

async function getToken(): Promise<string> {
  const { supabase } = await import('@/lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}
