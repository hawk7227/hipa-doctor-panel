'use client'

import { useState, useEffect, useCallback } from 'react'
import { Database, Download, Shield, RefreshCw, HardDrive, CheckCircle, Lock, Trash2 } from 'lucide-react'

async function getToken(): Promise<string> {
  const { supabase } = await import('@/lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}

export default function PatientBackupPage() {
  const [cacheStatus, setCacheStatus] = useState<any>(null)
  const [backupInfo, setBackupInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [password, setPassword] = useState('')
  const [backupResult, setBackupResult] = useState<any>(null)

  // Load cache status from IndexedDB
  const loadCacheStatus = useCallback(async () => {
    try {
      const { PatientCache } = await import('@/lib/patient-cache')
      const status = await PatientCache.getCacheStatus()
      setCacheStatus(status)
    } catch { setCacheStatus({ available: false }) }
  }, [])

  // Load backup info from API
  const loadBackupInfo = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch('/api/patient-backup', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setBackupInfo(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadCacheStatus(); loadBackupInfo() }, [loadCacheStatus, loadBackupInfo])

  // Sync cache now
  const syncCacheNow = async () => {
    setSyncing(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { PatientCache } = await import('@/lib/patient-cache')
      await PatientCache.syncFromSupabase(supabase)
      await loadCacheStatus()
    } catch (e: any) { alert('Cache sync failed: ' + e.message) }
    setSyncing(false)
  }

  // Clear cache
  const clearCache = async () => {
    if (!confirm('Clear all cached patient data from this browser?')) return
    try {
      const { PatientCache } = await import('@/lib/patient-cache')
      await PatientCache.clearAll()
      await loadCacheStatus()
    } catch {}
  }

  // Generate encrypted backup
  const generateBackup = async () => {
    if (!password || password.length < 8) { alert('Password must be at least 8 characters'); return }
    setGenerating(true)
    setBackupResult(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/patient-backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', password }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Backup failed'); setGenerating(false); return }
      setBackupResult(data)
      loadBackupInfo()
    } catch (e: any) { alert('Error: ' + e.message) }
    setGenerating(false)
  }

  // Download backup as encrypted file
  const downloadBackup = () => {
    if (!backupResult?.backup) return
    const blob = new Blob([JSON.stringify(backupResult.backup)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medazon-patient-backup-${new Date().toISOString().split('T')[0]}.enc.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCached = cacheStatus?.counts ? Object.values(cacheStatus.counts as Record<string, number>).reduce((s: number, n: number) => s + n, 0) : 0
  const totalLive = backupInfo?.total_records || 0

  return (
    <div className="p-6 text-white max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <Shield className="w-6 h-6 text-teal-400" />
        <div>
          <h1 className="text-xl font-bold">Patient Data Backup</h1>
          <p className="text-[11px] text-gray-500">Browser cache for offline access + encrypted file downloads</p>
        </div>
      </div>

      {/* ── BROWSER CACHE (IndexedDB) ─────────────────────── */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold">Browser Cache (Offline Fallback)</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncCacheNow} disabled={syncing}
              className="px-3 py-1.5 bg-teal-600/15 text-teal-400 rounded-lg text-[10px] font-medium hover:bg-teal-600/25 disabled:opacity-40 flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button onClick={clearCache}
              className="px-3 py-1.5 bg-red-600/10 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-600/20 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>

        {cacheStatus?.available ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#061818] rounded-lg p-2.5">
                <div className="text-lg font-bold text-teal-400">{totalCached.toLocaleString()}</div>
                <div className="text-[9px] text-gray-500">Records Cached</div>
              </div>
              <div className="bg-[#061818] rounded-lg p-2.5">
                <div className="text-lg font-bold">{Object.values(cacheStatus.counts).filter((c: any) => c > 0).length}<span className="text-sm text-gray-500">/6</span></div>
                <div className="text-[9px] text-gray-500">Data Types</div>
              </div>
              <div className="bg-[#061818] rounded-lg p-2.5">
                <div className="text-[11px] font-bold text-gray-300">{cacheStatus.lastSync ? new Date(cacheStatus.lastSync).toLocaleString() : 'Never'}</div>
                <div className="text-[9px] text-gray-500">Last Synced</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(cacheStatus.counts as Record<string, number>).map(([key, count]) => (
                <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-[#061818] rounded">
                  {count > 0 ? <CheckCircle className="w-2.5 h-2.5 text-green-400" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />}
                  <span className="text-[9px] text-gray-400">{key}</span>
                  <span className="text-[9px] text-teal-400 font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Auto-syncs every 15 minutes. If Supabase or DrChrono are unreachable, the doctor can still search patients and view their info from this cached data.
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-500">IndexedDB not available in this browser</p>
        )}
      </div>

      {/* ── ENCRYPTED FILE BACKUP ─────────────────────────── */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold">Encrypted File Backup</h2>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">
          Generate an AES-256 encrypted backup file containing all patient data. Download and store securely. Only you can decrypt it with your password.
        </p>

        {backupInfo && (
          <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-400">
            <span>Last backup: {backupInfo.last_backup ? new Date(backupInfo.last_backup).toLocaleString() : 'Never'}</span>
            {backupInfo.last_backup_records > 0 && <span>({backupInfo.last_backup_records.toLocaleString()} records)</span>}
            <span>Live: {totalLive.toLocaleString()} records</span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Encryption password (min 8 chars)"
            className="flex-1 px-3 py-2 bg-[#061818] border border-[#1a3d3d] rounded-lg text-sm text-white placeholder-gray-600 focus:border-teal-500 outline-none" />
          <button onClick={generateBackup} disabled={generating || !password || password.length < 8}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-40 flex items-center gap-1.5 shrink-0">
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            {generating ? 'Encrypting...' : 'Generate Backup'}
          </button>
        </div>

        {backupResult && (
          <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-green-400">Backup Ready</span>
              </div>
              <button onClick={downloadBackup}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download Encrypted File
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] text-gray-400">
              <span>{backupResult.records?.toLocaleString()} records</span>
              <span>·</span>
              <span>{(backupResult.size_bytes / 1024 / 1024).toFixed(1)} MB encrypted</span>
              <span>·</span>
              <span>{backupResult.elapsed_ms}ms</span>
              <span>·</span>
              <span>AES-256-GCM</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {backupResult.counts && Object.entries(backupResult.counts as Record<string, number>).map(([k, v]) => (
                <span key={k} className="text-[9px] text-teal-400">{k}: {v.toLocaleString()}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 bg-amber-600/10 border border-amber-500/20 rounded-lg p-2.5">
          <p className="text-[10px] text-amber-400">
            <strong>HIPAA Compliance:</strong> Backup is encrypted with AES-256-GCM before leaving the server. 
            The encryption password is never stored — only you know it. Keep the downloaded file and password in a secure location.
            To restore, upload the file and enter your password.
          </p>
        </div>
      </div>
    </div>
  )
}
