'use client'
import React, { useState, useMemo } from 'react'
import { ClipboardCheck, Plus, Pencil, Trash2, Target, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Active', 'All', 'Goals'] as const
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  revoked: 'bg-red-500/20 text-red-400 border-red-500/30',
}
const CATEGORIES = ['treatment', 'preventive', 'chronic_management', 'wellness', 'rehabilitation', 'discharge', 'follow_up'] as const

export default function CarePlansPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'care-plans', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', category: 'treatment', status: 'active', start_date: '', end_date: '', review_date: '', notes: '' })
  const [goalInput, setGoalInput] = useState('')
  const [goals, setGoals] = useState<string[]>([])

  const filtered = useMemo(() => {
    if (tab === 'Active') return (data || []).filter((p: any) => p.status === 'active' || p.status === 'draft')
    if (tab === 'Goals') {
      const allGoals: any[] = []
      ;(data || []).forEach((p: any) => {
        if (p.goals?.length) p.goals.forEach((g: any) => allGoals.push({ ...g, plan_title: p.title, plan_id: p.id }))
      })
      return allGoals
    }
    return data || []
  }, [data, tab])

  const resetForm = () => { setForm({ title: '', description: '', category: 'treatment', status: 'active', start_date: '', end_date: '', review_date: '', notes: '' }); setGoals([]); setShowAdd(false); setEditId(null) }

  const handleSave = async () => {
    if (!form.title.trim()) return
    const payload: any = { ...form, patient_id: patientId, goals: goals.map(g => ({ description: g, status: 'in_progress' })) }
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Care Plans — ${patientName}`} icon={ClipboardCheck} accentColor="#8b5cf6" loading={loading}
      error={error} hasData={data.length > 0 || showAdd} emptyMessage="No care plans"
      onRetry={refetch} onClose={onClose} draggable={false}
      badge={(data || []).filter((p: any) => p.status === 'active').length || undefined}
      headerActions={<button onClick={() => { resetForm(); setShowAdd(true) }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Care plan title..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Description..." rows={2} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm">
                  <option value="draft">Draft</option><option value="active">Active</option><option value="on_hold">On Hold</option><option value="completed">Completed</option>
                </select>
                <input value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} type="date" placeholder="Start"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                <input value={form.review_date} onChange={e => setForm({...form, review_date: e.target.value})} type="date" placeholder="Review"
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
              </div>
              {/* Goals */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Goals</label>
                <div className="flex gap-1 mt-1">
                  <input value={goalInput} onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && goalInput.trim()) { setGoals([...goals, goalInput.trim()]); setGoalInput('') } }}
                    placeholder="Add goal and press Enter..." className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1 text-white text-xs" />
                </div>
                {goals.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1 text-xs">
                    <Target className="w-3 h-3 text-purple-400" />
                    <span className="text-gray-300 flex-1">{g}</span>
                    <button onClick={() => setGoals(goals.filter((_, idx) => idx !== i))} className="text-red-400 text-[10px]">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          {(tab === 'Active' || tab === 'All') && filtered.map((plan: any) => (
            <div key={plan.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg overflow-hidden">
              <div className="p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{plan.title}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[plan.status] || ''}`}>{(plan.status || '').toUpperCase()}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize">{(plan.category || '').replace('_', ' ')}
                  {plan.review_date && <span className="ml-2">Review: {new Date(plan.review_date).toLocaleDateString()}</span>}
                </div>
              </div>
              {expandedId === plan.id && (
                <div className="border-t border-[#1a3d3d] p-3 space-y-2">
                  {plan.description && <p className="text-xs text-gray-300">{plan.description}</p>}
                  {plan.goals?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase">Goals</span>
                      {plan.goals.map((g: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 mt-1 text-xs">
                          <Target className="w-3 h-3 text-purple-400" />
                          <span className="text-gray-300">{g.description || g}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setEditId(plan.id); setForm({ title: plan.title, description: plan.description || '', category: plan.category || 'treatment', status: plan.status || 'active', start_date: plan.start_date || '', end_date: plan.end_date || '', review_date: plan.review_date || '', notes: plan.notes || '' }); setGoals((plan.goals || []).map((g: any) => g.description || g)); setShowAdd(true) }}
                      className="px-2 py-1 text-[10px] text-teal-400 bg-teal-500/10 rounded border border-teal-500/20">Edit</button>
                    <button onClick={() => remove(plan.id)}
                      className="px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded border border-red-500/20">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {tab === 'Goals' && filtered.map((goal: any, i: number) => (
            <div key={i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center gap-3">
              <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-sm text-white">{goal.description || goal}</span>
                <span className="text-xs text-gray-500 block mt-0.5">Plan: {goal.plan_title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelBase>
  )
}
