// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Bell, Search, RefreshCw, ShieldAlert, CheckCircle, AlertTriangle, Pill, FlaskConical, Heart, Clock, XCircle, X, Filter, Eye } from 'lucide-react'

interface ClinicalAlert {
  id: string; patient_id: string; alert_type: string; severity: string
  title: string; description: string | null; recommendation: string | null
  evidence_source: string | null; status: string
  acknowledged_by: string | null; acknowledged_at: string | null
  overridden: boolean; override_reason: string | null; created_at: string
  patients?: { first_name: string; last_name: string } | null
}

const SEV_COLORS: Record<string, string> = { info: 'bg-blue-600/20 text-blue-400 border-blue-500/30', low: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30', medium: 'bg-amber-600/20 text-amber-400 border-amber-500/30', high: 'bg-orange-600/20 text-orange-400 border-orange-500/30', critical: 'bg-red-600/20 text-red-400 border-red-500/30' }
const TYPE_ICONS: Record<string, typeof Pill> = { drug_interaction: Pill, allergy_alert: ShieldAlert, duplicate_therapy: Pill, lab_critical: FlaskConical, vital_abnormal: Heart, preventive_care: Clock, default: AlertTriangle }
const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"

export default function AlertsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([])
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try { const au = await getCurrentUser(); if (!au?.doctor?.id) { router.push('/login'); return }; setDoctorId(au.doctor.id); await fetchAlerts(au.doctor.id) } catch { router.push('/login') }
    }; init()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAlerts = useCallback(async (docId: string) => {
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase.from('cdss_alerts').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(200)
      if (e) throw e
      setAlerts((data || []).map((a: any) => ({ ...a, patients: Array.isArray(a.patients) ? a.patients[0] : a.patients })) as ClinicalAlert[])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  const acknowledgeAlert = async (id: string) => {
    if (!doctorId) return
    try {
      const { error: e } = await supabase.from('cdss_alerts').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: 'doctor' }).eq('id', id)
      if (e) throw e
      setSuccess('Alert acknowledged'); setTimeout(() => setSuccess(null), 3000)
      await fetchAlerts(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const overrideAlert = async (id: string, reason: string) => {
    if (!doctorId) return
    try {
      const { error: e } = await supabase.from('cdss_alerts').update({ status: 'overridden', overridden: true, override_reason: reason, acknowledged_at: new Date().toISOString() }).eq('id', id)
      if (e) throw e
      setSuccess('Alert overridden'); setTimeout(() => setSuccess(null), 3000)
      await fetchAlerts(doctorId)
    } catch (e: any) { setError(e.message) }
  }

  const filtered = useMemo(() => {
    let list = alerts
    if (statusFilter !== 'all') list = list.filter(a => statusFilter === 'active' ? a.status === 'active' : a.status !== 'active')
    if (sevFilter !== 'all') list = list.filter(a => a.severity === sevFilter)
    if (search) { const q = search.toLowerCase(); list = list.filter(a => a.title.toLowerCase().includes(q) || a.patients?.first_name?.toLowerCase().includes(q) || a.patients?.last_name?.toLowerCase().includes(q)) }
    return list
  }, [alerts, statusFilter, sevFilter, search])

  const activeCount = alerts.filter(a => a.status === 'active').length
  const criticalCount = alerts.filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high')).length

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Clinical Alerts (CDSS)</h1><p className="text-xs text-gray-500">{activeCount} active{criticalCount > 0 ? ` • ${criticalCount} critical/high` : ''}</p></div></div>
          <button onClick={() => doctorId && fetchAlerts(doctorId)} className="p-2 hover:bg-[#0a1f1f] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts..." className={`${INP} pl-8`} /></div>
          <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className={`${INP} w-auto`}><option value="all">All Severity</option>{['critical','high','medium','low','info'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${INP} w-auto`}><option value="active">Active</option><option value="resolved">Resolved</option><option value="all">All</option></select>
        </div>
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      <div className="p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16"><Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">{statusFilter === 'active' ? 'No active alerts' : 'No alerts found'}</p><p className="text-gray-600 text-xs mt-1">CDSS alerts appear when clinical decision support detects issues</p></div>
        ) : (
          <div className="space-y-2">{filtered.map(a => {
            const Icon = TYPE_ICONS[a.alert_type] || TYPE_ICONS.default
            return (
              <div key={a.id} className={`bg-[#0a1f1f] border rounded-lg p-3 transition-colors ${a.status === 'active' ? 'border-[#1a3d3d]/50 hover:border-[#1a3d3d]' : 'border-[#1a3d3d]/20 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'high' ? 'text-orange-400' : a.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${SEV_COLORS[a.severity] || SEV_COLORS.info}`}>{a.severity}</span>
                      {a.status !== 'active' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-600/20 text-gray-400 border border-gray-500/30">{a.status}</span>}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient'} • {a.alert_type.replace(/_/g, ' ')}</div>
                    {a.description && <div className="text-[11px] text-gray-300 mt-1">{a.description}</div>}
                    {a.recommendation && <div className="text-[11px] text-emerald-400 mt-1">Recommendation: {a.recommendation}</div>}
                    {a.overridden && a.override_reason && <div className="text-[10px] text-amber-400 mt-1">Override reason: {a.override_reason}</div>}
                  </div>
                  {a.status === 'active' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => acknowledgeAlert(a.id)} className="px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-600/10 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" />Ack</button>
                      <button onClick={() => { const r = prompt('Override reason:'); if (r) overrideAlert(a.id, r) }} className="px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-600/10 rounded flex items-center gap-1"><XCircle className="w-3 h-3" />Override</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}</div>
        )}
      </div>
    </div>
  )
}
