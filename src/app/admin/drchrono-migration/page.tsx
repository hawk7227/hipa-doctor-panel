'use client'

import { useState, useEffect, useCallback } from 'react'
import { Database, RefreshCw, Play, CheckCircle, XCircle, AlertTriangle, Clock, Pause, Zap } from 'lucide-react'

interface TableCount { [key: string]: number }
interface SyncLog { id: number; sync_type: string; sync_mode: string; status: string; records_synced: number; records_errored: number; started_at: string; metadata: any }

// ═══════════════════════════════════════════════════════════════
// ALL 25 DrChrono entity types — must match cron-sync exactly
// ═══════════════════════════════════════════════════════════════
const ENTITIES = [
  // ── Patient Core (5) ──
  { key: 'patients', table: 'drchrono_patients', label: 'Patients', icon: '👤', desc: 'Demographics, contact, insurance', group: 'Patient Core' },
  { key: 'medications', table: 'drchrono_medications', label: 'Medications', icon: '💊', desc: 'Active & historical meds', group: 'Patient Core' },
  { key: 'allergies', table: 'drchrono_allergies', label: 'Allergies', icon: '⚠️', desc: 'Drug & environmental allergies', group: 'Patient Core' },
  { key: 'problems', table: 'drchrono_problems', label: 'Problems', icon: '🏥', desc: 'Active diagnoses & conditions', group: 'Patient Core' },
  { key: 'vaccines', table: 'drchrono_vaccines', label: 'Vaccines', icon: '💉', desc: 'Immunization records', group: 'Patient Core' },
  // ── Clinical (6) ──
  { key: 'appointments', table: 'drchrono_appointments', label: 'Appointments', icon: '📅', desc: 'All appointment records', group: 'Clinical' },
  { key: 'clinical_notes', table: 'drchrono_clinical_notes', label: 'Clinical Notes', icon: '📋', desc: 'Visit notes & documentation', group: 'Clinical' },
  { key: 'lab_orders', table: 'drchrono_lab_orders', label: 'Lab Orders', icon: '📝', desc: 'Lab order requests', group: 'Clinical' },
  { key: 'lab_results', table: 'drchrono_lab_results', label: 'Lab Results', icon: '🧪', desc: 'Lab test results', group: 'Clinical' },
  { key: 'lab_tests', table: 'drchrono_lab_tests', label: 'Lab Tests', icon: '🔬', desc: 'Lab test definitions', group: 'Clinical' },
  { key: 'documents', table: 'drchrono_documents', label: 'Documents', icon: '📄', desc: 'Patient documents & files', group: 'Clinical' },
  // ── Practice Management (8) ──
  { key: 'doctors', table: 'drchrono_doctors', label: 'Providers', icon: '🩺', desc: 'Doctor/provider records', group: 'Practice' },
  { key: 'offices', table: 'drchrono_offices', label: 'Offices', icon: '🏢', desc: 'Office locations', group: 'Practice' },
  { key: 'users', table: 'drchrono_users', label: 'Users', icon: '👥', desc: 'Staff & user accounts', group: 'Practice' },
  { key: 'appointment_profiles', table: 'drchrono_appointment_profiles', label: 'Appt Profiles', icon: '📑', desc: 'Appointment type templates', group: 'Practice' },
  { key: 'tasks', table: 'drchrono_tasks', label: 'Tasks', icon: '✅', desc: 'Staff tasks & to-dos', group: 'Practice' },
  { key: 'task_categories', table: 'drchrono_task_categories', label: 'Task Categories', icon: '🏷️', desc: 'Task category definitions', group: 'Practice' },
  { key: 'messages', table: 'drchrono_messages', label: 'Messages', icon: '✉️', desc: 'Patient & internal messages', group: 'Practice' },
  { key: 'reminder_profiles', table: 'drchrono_reminder_profiles', label: 'Reminder Profiles', icon: '🔔', desc: 'Appointment reminder templates', group: 'Practice' },
  // ── Patient Communication (2) ──
  { key: 'amendments', table: 'drchrono_amendments', label: 'Amendments', icon: '✏️', desc: 'Chart amendment requests', group: 'Communication' },
  { key: 'patient_communications', table: 'drchrono_communications', label: 'Communications', icon: '📨', desc: 'Patient communication log', group: 'Communication' },
  // ── Billing & Finance (3) ──
  { key: 'patient_payments', table: 'drchrono_patient_payments', label: 'Payments', icon: '💳', desc: 'Patient payment records', group: 'Billing' },
  { key: 'line_items', table: 'drchrono_line_items', label: 'Line Items', icon: '🧾', desc: 'Billing codes & charges', group: 'Billing' },
  { key: 'transactions', table: 'drchrono_transactions', label: 'Transactions', icon: '💰', desc: 'Insurance claims & payments', group: 'Billing' },
  // ── Custom ──
  { key: 'custom_demographics', table: 'drchrono_custom_demographics', label: 'Custom Fields', icon: '🔧', desc: 'Custom demographic fields', group: 'Custom' },
]

const GROUPS = ['Patient Core', 'Clinical', 'Practice', 'Communication', 'Billing', 'Custom']

async function getToken(): Promise<string> {
  const { supabase } = await import('@/lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}

export default function DrChronoMigrationPage() {
  const [tableCounts, setTableCounts] = useState<TableCount>({})
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null) // 'all' | entity key | null
  const [syncResult, setSyncResult] = useState<any>(null)
  const [drchronoStatus, setDrchronoStatus] = useState<'connected' | 'expired' | 'unknown'>('unknown')
  const [singleProgress, setSingleProgress] = useState<Record<string, { synced: number; errored: number; pages: number; done: boolean }>>({})

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch('/api/drchrono/sync-status', { headers: { Authorization: `Bearer ${token}` } })
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

  useEffect(() => { fetchStatus(); const i = setInterval(fetchStatus, 15000); return () => clearInterval(i) }, [fetchStatus])

  // ── AUTO-SYNC: Trigger full sync automatically on load ──
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false)
  useEffect(() => {
    if (autoSyncTriggered || loading) return
    // Once status is loaded, auto-trigger if not already syncing
    if (drchronoStatus === 'connected' && !syncing) {
      setAutoSyncTriggered(true)
      syncAll()
    }
  }, [loading, drchronoStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SYNC ALL 25 entities at once via cron-sync ──
  const syncAll = async () => {
    setSyncing('all')
    setSyncResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/drchrono/sync-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setSyncResult(data)
      if (!res.ok) alert(data.error || 'Sync failed')
    } catch (e: any) {
      alert('Sync error: ' + e.message)
    }
    setSyncing(null)
    fetchStatus()
  }

  // ── SYNC single entity (pages through all via bulk-sync) ──
  const syncOne = async (entity: string) => {
    setSyncing(entity)
    setSingleProgress(p => ({ ...p, [entity]: { synced: 0, errored: 0, pages: 0, done: false } }))
    let cursor: string | null = null
    let totalSynced = 0, totalErrored = 0, pages = 0
    try {
      const token = await getToken()
      do {
        const resp: Response = await fetch('/api/drchrono/bulk-sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity, cursor }),
        })
        const data = await resp.json()
        if (!resp.ok) { alert(data.error || 'Sync failed'); break }
        cursor = data.next_cursor || null
        totalSynced += data.upserted || 0
        totalErrored += data.errored || 0
        pages++
        setSingleProgress(p => ({ ...p, [entity]: { synced: totalSynced, errored: totalErrored, pages, done: !cursor } }))
      } while (cursor)
    } catch (e: any) { alert('Error: ' + e.message) }
    setSyncing(null)
    fetchStatus()
  }

  const totalRecords = Object.values(tableCounts).reduce((s, n) => s + n, 0)
  const syncedTypes = ENTITIES.filter(e => (tableCounts[e.table] || 0) > 0).length

  return (
    <div className="p-6 text-white max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-teal-400" />
          <div>
            <h1 className="text-xl font-bold">DrChrono → Medazon Migration</h1>
            <p className="text-[11px] text-gray-500">Sync all 25 data types from DrChrono to local system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold ${drchronoStatus === 'connected' ? 'bg-green-600/20 text-green-400' : drchronoStatus === 'expired' ? 'bg-red-600/20 text-red-400' : 'bg-gray-600/20 text-gray-400'}`}>
            {drchronoStatus === 'connected' ? '● Connected' : drchronoStatus === 'expired' ? '● Token Expired' : '● Checking...'}
          </span>
          <button onClick={fetchStatus} className="p-2 hover:bg-[#1a3d3d] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
      </div>

      {drchronoStatus === 'expired' && (
        <div className="mb-4 p-3 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1"><p className="text-sm text-red-400 font-medium">DrChrono token expired</p><p className="text-xs text-red-400/70">Re-authorize to continue syncing</p></div>
          <a href="/api/drchrono/auth" className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium">Re-Authorize →</a>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-3">
          <div className="text-2xl font-bold text-teal-400">{totalRecords.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">Total Records</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-3">
          <div className="text-2xl font-bold">{syncedTypes}<span className="text-sm text-gray-500">/{ENTITIES.length}</span></div>
          <div className="text-[10px] text-gray-500">Types Synced</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-3">
          <div className="text-2xl font-bold">{(tableCounts['drchrono_patients'] || 0).toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">Patients</div>
        </div>
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-3">
          <div className="text-2xl font-bold">{(tableCounts['drchrono_appointments'] || 0).toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">Appointments</div>
        </div>
      </div>

      {/* SYNC ALL button */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={syncAll} disabled={syncing !== null || drchronoStatus === 'expired'}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-40 flex items-center gap-2">
          {syncing === 'all' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {syncing === 'all' ? 'Syncing All 25 Types...' : 'Sync Everything Now'}
        </button>
        {syncing === 'all' && <span className="text-xs text-teal-400 animate-pulse">This may take up to 5 minutes...</span>}
        {syncResult && !syncing && (
          <div className="text-xs text-gray-400">
            Last sync: <span className="text-green-400">{syncResult.total_upserted?.toLocaleString()} records</span> in {((syncResult.total_elapsed_ms || 0) / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {/* Sync result details */}
      {syncResult?.results && !syncing && (
        <div className="mb-5 bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-3 max-h-48 overflow-y-auto">
          <div className="text-xs font-bold text-gray-400 mb-2">Last Sync Results</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(syncResult.results as Record<string, any>).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-[#061818] rounded">
                {val.upserted > 0 ? <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" /> :
                 val.errored > 0 ? <XCircle className="w-2.5 h-2.5 text-red-400 shrink-0" /> :
                 <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />}
                <span className="text-[9px] text-gray-400 truncate">{key}</span>
                <span className="text-[9px] text-green-400 ml-auto shrink-0">{val.upserted || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity groups */}
      {GROUPS.map(group => {
        const groupEntities = ENTITIES.filter(e => e.group === group)
        const groupTotal = groupEntities.reduce((s, e) => s + (tableCounts[e.table] || 0), 0)
        const groupSynced = groupEntities.filter(e => (tableCounts[e.table] || 0) > 0).length
        return (
          <div key={group} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{group}</h2>
              <span className="text-[9px] text-gray-600">{groupSynced}/{groupEntities.length} synced · {groupTotal.toLocaleString()} records</span>
            </div>
            <div className="space-y-1">
              {groupEntities.map(e => {
                const count = tableCounts[e.table] || 0
                const prog = singleProgress[e.key]
                const isSyncing = syncing === e.key
                return (
                  <div key={e.key} className={`bg-[#0a1f1f] border rounded-lg px-3 py-2 flex items-center gap-3 ${isSyncing ? 'border-teal-500/40' : 'border-[#1a3d3d]/60'}`}>
                    <span className="text-base">{e.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{e.label}</span>
                        {count > 0 && <CheckCircle className="w-3 h-3 text-green-400" />}
                      </div>
                      <div className="text-[9px] text-gray-600">{e.desc}</div>
                      {prog && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {!prog.done && <RefreshCw className="w-2.5 h-2.5 text-teal-400 animate-spin" />}
                          <span className="text-[9px] text-teal-400">{prog.synced.toLocaleString()} synced</span>
                          {prog.errored > 0 && <span className="text-[9px] text-red-400">{prog.errored} err</span>}
                          <span className="text-[9px] text-gray-600">p{prog.pages}</span>
                          {prog.done && <span className="text-[9px] text-green-400">✓ done</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 min-w-[55px]">
                      <div className={`text-sm font-bold tabular-nums ${count > 0 ? 'text-white' : 'text-gray-700'}`}>{count.toLocaleString()}</div>
                    </div>
                    <button onClick={() => syncOne(e.key)} disabled={syncing !== null || drchronoStatus === 'expired'}
                      className="px-2 py-1 bg-teal-600/15 text-teal-400 rounded text-[10px] font-medium hover:bg-teal-600/25 disabled:opacity-30 shrink-0 flex items-center gap-1 min-w-[52px] justify-center">
                      {isSyncing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                      {count > 0 ? 'Update' : 'Sync'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Recent sync logs */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-4 mt-2">
        <h2 className="text-sm font-bold mb-2">Sync History</h2>
        {loading ? <div className="text-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-teal-400 mx-auto" /></div> : (
          <div className="space-y-1">
            {syncLogs.length === 0 && <p className="text-xs text-gray-600 text-center py-3">No sync history yet — click "Sync Everything Now" to start</p>}
            {syncLogs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#061818] rounded-lg">
                {log.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> :
                 log.status === 'failed' ? <XCircle className="w-3 h-3 text-red-400 shrink-0" /> :
                 <Clock className="w-3 h-3 text-amber-400 shrink-0" />}
                <span className="text-[10px] font-medium flex-1">{log.sync_type}</span>
                <span className="text-[9px] text-green-400">+{log.records_synced}</span>
                {log.records_errored > 0 && <span className="text-[9px] text-red-400">-{log.records_errored}</span>}
                <span className="text-[9px] text-gray-600">{log.started_at ? new Date(log.started_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-4 text-[10px] text-gray-600 text-center">
        Once all 25 types show ✓, your system has all DrChrono data locally. Future syncs will only pull updates.
      </div>
    </div>
  )
}
