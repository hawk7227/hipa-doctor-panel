'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Bell, Search, Filter, RefreshCw, ShieldAlert, CheckCircle, AlertTriangle, Pill, FlaskConical, Syringe, Heart, Clock, XCircle } from 'lucide-react'

interface ClinicalAlert {
  id: string; patient_id: string; patient_name?: string; alert_type: string;
  title: string; message: string; severity: string; recommendation: string;
  is_active: boolean; acknowledged_at: string; acknowledged_by: string;
  override_reason: string; created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  medium: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-600/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-600/20 text-red-400 border-red-500/30',
}
const TYPE_ICONS: Record<string, React.ElementType> = {
  drug_interaction: Pill, allergy_alert: ShieldAlert, duplicate_therapy: Pill,
  lab_critical: FlaskConical, overdue_screening: Clock, immunization_due: Syringe,
  care_gap: Heart, abnormal_result: AlertTriangle,
}
const ALERT_TYPES = ['drug_interaction', 'allergy_alert', 'duplicate_therapy', 'lab_critical', 'overdue_screening', 'immunization_due', 'care_gap', 'abnormal_result'] as const
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showDismissed, setShowDismissed] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/panels/alerts?patient_id=all')
      const data = await res.json()
      setAlerts(data.data || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const filtered = useMemo(() => {
    let items = alerts
    if (!showDismissed) items = items.filter(a => a.is_active && !a.acknowledged_at)
    if (severityFilter !== 'all') items = items.filter(a => a.severity === severityFilter)
    if (typeFilter !== 'all') items = items.filter(a => a.alert_type === typeFilter)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(a => a.title?.toLowerCase().includes(q) || a.message?.toLowerCase().includes(q) || a.patient_name?.toLowerCase().includes(q))
    }
    // Sort: critical first, then high, medium, low
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return items.sort((a, b) => (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4))
  }, [alerts, severityFilter, typeFilter, search, showDismissed])

  const counts = useMemo(() => ({
    critical: alerts.filter(a => a.is_active && a.severity === 'critical' && !a.acknowledged_at).length,
    high: alerts.filter(a => a.is_active && a.severity === 'high' && !a.acknowledged_at).length,
    active: alerts.filter(a => a.is_active && !a.acknowledged_at).length,
    total: alerts.length,
  }), [alerts])

  const handleAcknowledge = async (id: string) => {
    try {
      await fetch('/api/panels/alerts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, acknowledged_at: new Date().toISOString(), acknowledged_by: 'Provider' })
      })
      fetchAlerts()
    } catch (err: any) { setError(err.message) }
  }

  const handleDismiss = async (id: string) => {
    try {
      await fetch('/api/panels/alerts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false, acknowledged_at: new Date().toISOString(), acknowledged_by: 'Provider' })
      })
      fetchAlerts()
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3d3d] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-red-400" />
            <div>
              <h1 className="text-xl font-bold">Clinical Alerts</h1>
              <p className="text-xs text-gray-500">Drug interactions, critical labs, care gaps, and clinical decision support</p>
            </div>
          </div>
          <button onClick={fetchAlerts} className="flex items-center gap-2 px-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] text-white rounded-lg hover:bg-[#0d2a2a] text-sm">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      {/* Critical Banner */}
      {counts.critical > 0 && (
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-red-400">{counts.critical} CRITICAL ALERT{counts.critical > 1 ? 'S' : ''} REQUIRE IMMEDIATE ATTENTION</div>
            <div className="text-xs text-red-400/70 mt-0.5">These alerts indicate potentially dangerous conditions that need provider review</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[
          { label: 'Critical', count: counts.critical, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'High Priority', count: counts.high, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          { label: 'Active Alerts', count: counts.active, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Total', count: counts.total, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#1a3d3d]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts..."
            className="w-full pl-10 pr-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm" />
        </div>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All Severity</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All Types</option>
          {ALERT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} />
          Show dismissed
        </label>
      </div>

      {/* Alert List */}
      <div className="px-6 py-4 space-y-2">
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}
        {loading && <div className="text-center py-8 text-gray-500">Loading alerts...</div>}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
            <div className="text-lg font-semibold text-green-400">All Clear</div>
            <div className="text-xs text-gray-500 mt-1">{showDismissed ? 'No alerts match your filters' : 'No active clinical alerts requiring attention'}</div>
          </div>
        )}

        {filtered.map(alert => {
          const Icon = TYPE_ICONS[alert.alert_type] || AlertTriangle
          const isDismissed = !alert.is_active || !!alert.acknowledged_at
          return (
            <div key={alert.id} className={`border rounded-lg overflow-hidden transition-all ${
              alert.severity === 'critical' ? 'bg-red-500/5 border-red-500/40' :
              alert.severity === 'high' ? 'bg-orange-500/5 border-orange-500/30' :
              isDismissed ? 'bg-[#0a1f1f] border-[#1a3d3d] opacity-60' : 'bg-[#0a1f1f] border-[#1a3d3d]'
            }`}>
              <div className="p-4 flex items-start gap-4">
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  alert.severity === 'critical' ? 'text-red-400 animate-pulse' :
                  alert.severity === 'high' ? 'text-orange-400' :
                  alert.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{alert.title || alert.message}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${SEVERITY_COLORS[alert.severity] || ''}`}>{alert.severity?.toUpperCase()}</span>
                    <span className="text-[10px] text-gray-600 capitalize">{alert.alert_type?.replace('_', ' ')}</span>
                    {isDismissed && <span className="px-2 py-0.5 text-[10px] rounded bg-gray-600/20 text-gray-500">ACKNOWLEDGED</span>}
                  </div>
                  {alert.message && alert.title && <p className="text-sm text-gray-400 mt-1">{alert.message}</p>}
                  {alert.recommendation && (
                    <div className="flex items-start gap-1.5 mt-2 text-sm text-teal-400">
                      <span className="font-bold">→</span>
                      <span>{alert.recommendation}</span>
                    </div>
                  )}
                  {alert.patient_name && <div className="text-xs text-gray-600 mt-1">Patient: {alert.patient_name}</div>}
                  {alert.acknowledged_at && (
                    <div className="text-[10px] text-gray-600 mt-1">
                      Acknowledged {new Date(alert.acknowledged_at).toLocaleString()} by {alert.acknowledged_by}
                      {alert.override_reason && <span className="ml-2 text-amber-400">Override: {alert.override_reason}</span>}
                    </div>
                  )}
                </div>
                {!isDismissed && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleAcknowledge(alert.id)}
                      className="px-3 py-1.5 text-xs bg-green-600/20 text-green-400 rounded border border-green-500/30 hover:bg-green-600/30">
                      <CheckCircle className="w-3 h-3 inline mr-1" />Acknowledge
                    </button>
                    <button onClick={() => handleDismiss(alert.id)}
                      className="px-3 py-1.5 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-500/30 hover:bg-gray-600/30">
                      <XCircle className="w-3 h-3 inline mr-1" />Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
