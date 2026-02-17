// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState, useMemo } from 'react'
import { Bell, AlertTriangle, CheckCircle, XCircle, ShieldAlert, Pill, FlaskConical, Syringe, Heart, Clock } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Active', 'All', 'Dismissed'] as const
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
}
const TYPE_ICONS: Record<string, React.ElementType> = {
  drug_interaction: Pill, allergy_alert: ShieldAlert, duplicate_therapy: Pill,
  lab_critical: FlaskConical, overdue_screening: Clock, immunization_due: Syringe,
  care_gap: Heart, abnormal_result: AlertTriangle,
}

export default function AlertsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, update } = usePanelData({ endpoint: 'alerts', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')

  const filtered = useMemo(() => {
    if (tab === 'Active') return (data || []).filter((a: any) => a.is_active && !a.acknowledged_at)
    if (tab === 'Dismissed') return (data || []).filter((a: any) => !a.is_active || a.acknowledged_at)
    return data || []
  }, [data, tab])

  const activeCount = (data || []).filter((a: any) => a.is_active && !a.acknowledged_at).length
  const criticalCount = (data || []).filter((a: any) => a.is_active && a.severity === 'critical').length

  const handleAcknowledge = async (id: string, override_reason?: string) => {
    await update(id, { acknowledged_at: new Date().toISOString(), acknowledged_by: 'Provider', override_reason })
  }

  const handleDismiss = async (id: string) => {
    await update(id, { is_active: false, acknowledged_at: new Date().toISOString(), acknowledged_by: 'Provider' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Clinical Alerts — ${patientName}`} icon={Bell} accentColor="#ef4444" loading={loading}
      error={error} hasData={data.length > 0} emptyMessage="No clinical alerts"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={activeCount > 0 ? (criticalCount > 0 ? `${criticalCount} critical` : `${activeCount} active`) : undefined}>
      <div className="flex flex-col h-full">
        {criticalCount > 0 && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-3 py-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-xs font-bold text-red-400">{criticalCount} CRITICAL ALERT{criticalCount > 1 ? 'S' : ''}</span>
          </div>
        )}
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-red-400 text-red-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Active' && activeCount > 0 && <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded">{activeCount}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-sm text-green-400">{tab === 'Active' ? 'No active alerts' : 'No alerts found'}</p>
            </div>
          )}
          {filtered.map((alert: any) => {
            const Icon = TYPE_ICONS[alert.alert_type] || AlertTriangle
            return (
              <div key={alert.id} className={`bg-[#0a1f1f] border rounded-lg p-3 ${
                alert.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                alert.severity === 'high' ? 'border-orange-500/30' : 'border-[#1a3d3d]'
              }`}>
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-400 animate-pulse' :
                    alert.severity === 'high' ? 'text-orange-400' : 'text-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{alert.title || alert.message}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${SEVERITY_COLORS[alert.severity] || ''}`}>{(alert.severity || '').toUpperCase()}</span>
                      <span className="text-[10px] text-gray-600 capitalize">{(alert.alert_type || '').replace('_', ' ')}</span>
                    </div>
                    {alert.message && alert.title && <p className="text-xs text-gray-400 mt-1">{alert.message}</p>}
                    {alert.recommendation && <p className="text-xs text-teal-400 mt-1">→ {alert.recommendation}</p>}
                    {alert.acknowledged_at && <p className="text-[10px] text-gray-600 mt-1">Acknowledged {new Date(alert.acknowledged_at).toLocaleString()} by {alert.acknowledged_by}</p>}
                  </div>
                </div>
                {!alert.acknowledged_at && alert.is_active && (
                  <div className="flex gap-2 mt-2 ml-6">
                    <button onClick={() => handleAcknowledge(alert.id)}
                      className="px-2 py-1 text-[10px] bg-green-500/10 text-green-400 rounded border border-green-500/20">Acknowledge</button>
                    <button onClick={() => handleDismiss(alert.id)}
                      className="px-2 py-1 text-[10px] bg-gray-500/10 text-gray-400 rounded border border-gray-500/20">Dismiss</button>
                    {(alert.severity === 'high' || alert.severity === 'critical') && (
                      <button onClick={() => { const reason = prompt('Override reason:'); if (reason) handleAcknowledge(alert.id, reason) }}
                        className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 rounded border border-red-500/20">Override</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </PanelBase>
  )
}
