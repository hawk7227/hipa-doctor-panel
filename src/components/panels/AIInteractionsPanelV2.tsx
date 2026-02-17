// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import React, { useState, useMemo } from 'react'
import { Brain, Sparkles, CheckCircle, XCircle, Clock, Lightbulb, Stethoscope, FileText, Pill, FlaskConical } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Suggestions', 'History', 'Stats'] as const
const TYPE_ICONS: Record<string, React.ElementType> = {
  cdss: Stethoscope, scribe: FileText, note_generation: FileText, coding_suggestion: FileText,
  drug_interaction: Pill, diagnosis_assist: Lightbulb, lab_interpretation: FlaskConical,
}
const ACCEPTANCE: Record<string, string> = {
  accepted: 'text-green-400', rejected: 'text-red-400', modified: 'text-amber-400', pending: 'text-gray-400',
}

export default function AIInteractionsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'ai-interactions', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Suggestions')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pending = useMemo(() => (data || []).filter((a: any) => !a.acceptance_status || a.acceptance_status === 'pending'), [data])
  const sorted = useMemo(() => [...(data || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [data])

  const stats = useMemo(() => {
    const total = (data || []).length
    const accepted = (data || []).filter((a: any) => a.acceptance_status === 'accepted').length
    const avgConfidence = total > 0 ? (data || []).reduce((s: number, a: any) => s + (a.confidence_score || 0), 0) / total : 0
    return { total, accepted, rate: total > 0 ? ((accepted / total) * 100).toFixed(0) : '0', avgConfidence: (avgConfidence * 100).toFixed(0) }
  }, [data])

  if (!isOpen) return null

  return (
    <PanelBase title={`AI Assistant — ${patientName}`} icon={Brain} accentColor="#a855f7" loading={loading}
      error={error} hasData={data.length > 0} emptyMessage="No AI interactions yet"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={pending.length > 0 ? `${pending.length} pending` : undefined}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Suggestions' && pending.length > 0 && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">{pending.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tab === 'Suggestions' && pending.map((ai: any) => {
            const Icon = TYPE_ICONS[ai.interaction_type] || Sparkles
            return (
              <div key={ai.id} className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white capitalize">{(ai.interaction_type || '').replace('_', ' ')}</span>
                      {ai.confidence_score && <span className="text-[10px] text-gray-500">{(ai.confidence_score * 100).toFixed(0)}% confidence</span>}
                    </div>
                    <p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap">{ai.response?.substring(0, 300)}{ai.response?.length > 300 ? '...' : ''}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {tab === 'Suggestions' && pending.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <Sparkles className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-xs text-gray-500">No pending AI suggestions</p>
            </div>
          )}

          {tab === 'History' && sorted.map((ai: any) => {
            const Icon = TYPE_ICONS[ai.interaction_type] || Sparkles
            return (
              <div key={ai.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg overflow-hidden">
                <div className="p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === ai.id ? null : ai.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-sm text-white capitalize">{(ai.interaction_type || '').replace('_', ' ')}</span>
                      <span className={`text-[10px] font-medium capitalize ${ACCEPTANCE[ai.acceptance_status] || 'text-gray-500'}`}>
                        {ai.acceptance_status || 'pending'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">{ai.created_at ? new Date(ai.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                {expandedId === ai.id && (
                  <div className="border-t border-[#1a3d3d] p-3 space-y-2 text-xs">
                    {ai.prompt && <div><span className="text-gray-500">Prompt:</span><p className="text-gray-300 mt-0.5">{ai.prompt}</p></div>}
                    {ai.response && <div><span className="text-gray-500">Response:</span><p className="text-gray-300 mt-0.5 whitespace-pre-wrap">{ai.response}</p></div>}
                    {ai.model && <span className="text-gray-600">Model: {ai.model}</span>}
                    {ai.tokens_used && <span className="text-gray-600 ml-2">Tokens: {ai.tokens_used}</span>}
                  </div>
                )}
              </div>
            )
          })}

          {tab === 'Stats' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-[10px] text-gray-500">Total Interactions</div>
                </div>
                <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.rate}%</div>
                  <div className="text-[10px] text-gray-500">Acceptance Rate</div>
                </div>
                <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.avgConfidence}%</div>
                  <div className="text-[10px] text-gray-500">Avg Confidence</div>
                </div>
                <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.accepted}</div>
                  <div className="text-[10px] text-gray-500">Accepted</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
