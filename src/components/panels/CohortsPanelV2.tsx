// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState } from 'react'
import { Users, Plus, Pencil, Trash2, Filter, UserPlus, BarChart3 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Memberships', 'All Cohorts'] as const

export default function CohortsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'cohorts', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Memberships')

  // Filter cohorts that include this patient
  const memberships = (data || []).filter((c: any) => c.members?.includes(patientId) || c.patient_count > 0)

  if (!isOpen) return null

  return (
    <PanelBase title={`Population Health — ${patientName}`} icon={Users} accentColor="#6366f1" loading={loading}
      error={error} hasData={data.length > 0} emptyMessage="No cohorts available"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={memberships.length > 0 ? `${memberships.length} cohorts` : undefined}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tab === 'Memberships' && memberships.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-500">Patient is not in any cohorts</div>
          )}
          {tab === 'Memberships' && memberships.map((c: any) => (
            <div key={c.id} className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{c.cohort_name}</span>
                <span className="text-xs text-gray-500">{c.patient_count || 0} patients</span>
              </div>
              {c.description && <p className="text-xs text-gray-400 mt-1">{c.description}</p>}
              {c.criteria && <p className="text-[10px] text-gray-600 mt-1 font-mono">Criteria: {typeof c.criteria === 'string' ? c.criteria : JSON.stringify(c.criteria)}</p>}
            </div>
          ))}

          {tab === 'All Cohorts' && (data || []).map((c: any) => (
            <div key={c.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-sm text-white">{c.cohort_name}</span>
                  {c.is_auto_generated && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-500/20 text-indigo-400">AUTO</span>}
                </div>
                <span className="text-xs text-gray-500">{c.patient_count || 0}</span>
              </div>
              {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
