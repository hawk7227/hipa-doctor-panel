'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Activity, Wrench, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  Database, Zap, Clock, ChevronDown, ChevronRight, Server, FileText, Cpu, Download,
} from 'lucide-react'

interface CheckResult { id: string; name: string; status: 'pass' | 'fail' | 'warn'; message: string; ms: number; fixIds?: string[] }
interface FixPattern { id: string; title: string; symptoms: string[]; rootCause: string; fix: string; dateFixed: string; severity: string; category: string }
interface HealthData {
  status: string
  summary: { passing: number; failing: number; warning: number; total: number }
  duration_ms: number
  checks: CheckResult[]
  fix_history: FixPattern[]
  system_map_count: number
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)
  const [expandedFix, setExpandedFix] = useState<string | null>(null)
  const [showAllChecks, setShowAllChecks] = useState(false)

  const runHealthCheck = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/system-health')
      const data = await res.json()
      setHealth(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const runAutoFix = async () => {
    setFixing(true)
    try {
      const res = await fetch('/api/system-health/fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runAll: true }),
      })
      const data = await res.json()
      setFixResult(data)
      // Re-check health after fix
      await runHealthCheck()
    } catch (e) { console.error(e) }
    setFixing(false)
  }

  useEffect(() => { runHealthCheck() }, [])

  const statusColor = health?.status === 'healthy' ? 'text-green-400' : health?.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
  const statusBg = health?.status === 'healthy' ? 'bg-green-600/20 border-green-500/30' : health?.status === 'degraded' ? 'bg-amber-600/20 border-amber-500/30' : 'bg-red-600/20 border-red-500/30'
  const StatusIcon = health?.status === 'healthy' ? CheckCircle : health?.status === 'degraded' ? AlertTriangle : XCircle

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-teal-400" />
            System Health & Build Manifest
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Self-documenting architecture — every system, connection, and known fix in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={runHealthCheck} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking...' : 'Run Health Check'}
          </button>
          <button onClick={runAutoFix} disabled={fixing} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">
            <Wrench className={`w-4 h-4 ${fixing ? 'animate-spin' : ''}`} />
            {fixing ? 'Fixing...' : 'Auto-Fix All'}
          </button>
        </div>
      </div>

      {/* STATUS BANNER */}
      {health && (
        <div className={`${statusBg} border rounded-xl p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-8 h-8 ${statusColor}`} />
            <div>
              <div className={`text-xl font-bold ${statusColor} uppercase`}>{health.status}</div>
              <div className="text-sm text-gray-400">
                {health.summary.passing} passing · {health.summary.warning} warnings · {health.summary.failing} failing · {health.duration_ms}ms
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Stat label="Systems" value={health.system_map_count} color="text-white" />
            <Stat label="Checks" value={health.summary.total} color="text-teal-400" />
            <Stat label="Fix Patterns" value={health.fix_history.length} color="text-amber-400" />
          </div>
        </div>
      )}

      {/* FIX RESULT TOAST */}
      {fixResult && (
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4">
          <div className="text-sm font-bold text-blue-300 mb-1">Auto-Fix Result</div>
          <div className="text-xs text-gray-400">
            Attempted: {fixResult.fixes_attempted} · Applied: {fixResult.fixes_applied}
          </div>
          {fixResult.results?.map((r: any) => (
            <div key={r.fixId} className="flex items-center gap-2 mt-1 text-xs">
              {r.status === 'applied' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
              <span className="text-gray-300">{r.fixId}: {r.title} — {r.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* HEALTH CHECKS */}
      {health && (
        <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
          <button onClick={() => setShowAllChecks(!showAllChecks)} className="w-full flex items-center justify-between px-5 py-4 border-b border-[#1a3d3d]/30 hover:bg-[#0d2828] transition-colors">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Health Checks ({health.checks.length})</h2>
            </div>
            {showAllChecks ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {showAllChecks && (
            <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
              {health.checks.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#061818] rounded-lg">
                  <div className="flex items-center gap-2">
                    {c.status === 'pass' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> :
                     c.status === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
                     <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-xs text-white font-medium">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">{c.message}</span>
                    <span className="text-[10px] text-gray-600">{c.ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUILD MANIFEST — FIX HISTORY */}
      {health && (
        <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1a3d3d]/30">
            <Wrench className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Build & Fix History ({health.fix_history.length} documented fixes)</h2>
          </div>
          <div className="p-4 space-y-2">
            {health.fix_history.map(fix => (
              <div key={fix.id} className="bg-[#061818] rounded-lg border border-[#1a3d3d]/30 overflow-hidden">
                <button onClick={() => setExpandedFix(expandedFix === fix.id ? null : fix.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0c2828] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      fix.severity === 'critical' ? 'bg-red-600/20 text-red-400' :
                      fix.severity === 'high' ? 'bg-amber-600/20 text-amber-400' :
                      'bg-blue-600/20 text-blue-400'
                    }`}>{fix.severity.toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      fix.category === 'rls' ? 'bg-purple-600/20 text-purple-400' :
                      fix.category === 'api' ? 'bg-teal-600/20 text-teal-400' :
                      fix.category === 'ui' ? 'bg-blue-600/20 text-blue-400' :
                      fix.category === 'data' ? 'bg-emerald-600/20 text-emerald-400' :
                      fix.category === 'deploy' ? 'bg-orange-600/20 text-orange-400' :
                      'bg-gray-600/20 text-gray-400'
                    }`}>{fix.category}</span>
                    <span className="text-sm font-semibold text-white">{fix.id}: {fix.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{fix.dateFixed}</span>
                    {expandedFix === fix.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {expandedFix === fix.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[#1a3d3d]/20 pt-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Symptoms</div>
                      <div className="flex flex-wrap gap-1">
                        {fix.symptoms.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-900/30 text-red-300 text-[10px] rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Root Cause</div>
                      <p className="text-xs text-gray-300">{fix.rootCause}</p>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fix Applied</div>
                      <p className="text-xs text-teal-300">{fix.fix}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARCHITECTURE OVERVIEW */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1a3d3d]/30">
          <Cpu className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-bold text-white">Architecture Overview</h2>
        </div>
        <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ArchCard icon={Server} label="Pages" count={8} color="text-blue-400" items={['Dashboard', 'Appointments', 'Patients', 'Data Export', 'System Health', 'Availability', 'Staff Hub', 'Chart Mgmt']} />
          <ArchCard icon={Database} label="EHR Panels" count={28} color="text-teal-400" items={['Meds', 'Allergies', 'Problems', 'Vitals', 'Labs', 'Notes', 'Demographics', 'Immunizations', 'Documents', 'History', 'Pharmacy', 'Care Plans', 'Billing', 'Insurance', 'Alerts', 'AI', 'Quality', 'Cohorts', 'Orders', 'Rx Hx', 'Med Hx', 'Comms', 'Prior Auth', 'Chart Mgmt', 'eRx', 'Lab Orders', 'Referrals', 'Appts']} />
          <ArchCard icon={Zap} label="API Routes" count={50} color="text-amber-400" items={['26 panel APIs', 'Dashboard stats', 'Patient CRUD', 'DrChrono sync', 'Cron export', 'Stripe payments', 'Twilio SMS', 'Email', 'Zoom', 'Prescriptions']} />
          <ArchCard icon={FileText} label="Data Sources" count={3} color="text-purple-400" items={['Tier 1: Live DrChrono', 'Tier 2: Supabase backup', 'Tier 3: Static JSON (4.3MB)']} />
        </div>
      </div>

      {/* KEY NUMBERS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <NumCard label="Patients" value="6,968" color="text-white" />
        <NumCard label="Medications" value="20,132" color="text-teal-400" />
        <NumCard label="Allergies" value="620" color="text-amber-400" />
        <NumCard label="Problems" value="1,401" color="text-purple-400" />
        <NumCard label="Appointments" value="263" color="text-blue-400" />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  )
}

function ArchCard({ icon: Icon, label, count, color, items }: { icon: typeof Server; label: string; count: number; color: string; items: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[#061818] rounded-lg p-4 border border-[#1a3d3d]/30">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color} mb-1`}>{count}</div>
      <button onClick={() => setOpen(!open)} className="text-[10px] text-gray-500 hover:text-gray-300">
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && (
        <div className="mt-2 space-y-0.5">
          {items.map((item, i) => (
            <div key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className={`w-1 h-1 rounded-full ${color.replace('text-', 'bg-')}`} />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NumCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-1">{label}</div>
    </div>
  )
}
