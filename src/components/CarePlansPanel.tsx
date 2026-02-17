// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { ClipboardCheck, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface CarePlansPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface CarePlan {
  id: number
  patient_id: string
  title: string
  description: string | null
  status: string
  goals: string[] | null
  interventions: string[] | null
  start_date: string | null
  target_date: string | null
  created_at: string
  updated_at: string
}

export default function CarePlansPanel({ isOpen, onClose, patientId, patientName }: CarePlansPanelProps) {
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [newPlan, setNewPlan] = useState({ title: '', description: '', goals: '', interventions: '', target_date: '' })

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patient_care_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      if (error) {
        console.log('patient_care_plans query:', error.message)
        setPlans([])
      } else {
        setPlans(data || [])
      }
    } catch (err) {
      console.error('Error fetching care plans:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const handleAdd = async () => {
    if (!newPlan.title.trim()) return
    try {
      const { error } = await supabase.from('patient_care_plans').insert({
        patient_id: patientId,
        title: newPlan.title,
        description: newPlan.description || null,
        goals: newPlan.goals ? newPlan.goals.split('\n').filter(Boolean) : null,
        interventions: newPlan.interventions ? newPlan.interventions.split('\n').filter(Boolean) : null,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        target_date: newPlan.target_date || null,
      })
      if (error) throw error
      setNewPlan({ title: '', description: '', goals: '', interventions: '', target_date: '' })
      setAdding(false)
      fetchData()
    } catch (err) {
      console.error('Error adding care plan:', err)
    }
  }

  const handleToggleStatus = async (plan: CarePlan) => {
    const newStatus = plan.status === 'active' ? 'completed' : 'active'
    try {
      await supabase.from('patient_care_plans').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', plan.id)
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: newStatus } : p))
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await supabase.from('patient_care_plans').delete().eq('id', id)
      setPlans(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error deleting care plan:', err)
    }
  }

  return (
    <DraggableOverlayWrapper
      panelId="care-plans"
      isOpen={isOpen}
      onClose={onClose}
      title="Care Plans"
      subtitle={patientName ? `${patientName} • ${plans.filter(p => p.status === 'active').length} active` : undefined}
      icon={<ClipboardCheck className="w-4 h-4" />}
      defaultTheme="purple"
      defaultWidth={540}
      headerActions={
        <button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
          <Plus className="w-3.5 h-3.5 text-white/60" />
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {adding && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-2">
            <input placeholder="Plan title..." value={newPlan.title} onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-purple-500/50 focus:outline-none" autoFocus />
            <textarea placeholder="Description..." value={newPlan.description} onChange={e => setNewPlan(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none resize-none" rows={2} />
            <textarea placeholder="Goals (one per line)" value={newPlan.goals} onChange={e => setNewPlan(p => ({ ...p, goals: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none resize-none" rows={2} />
            <textarea placeholder="Interventions (one per line)" value={newPlan.interventions} onChange={e => setNewPlan(p => ({ ...p, interventions: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none resize-none" rows={2} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">Target date:</span>
              <input type="date" value={newPlan.target_date} onChange={e => setNewPlan(p => ({ ...p, target_date: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none" />
              <div className="flex-1" />
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">Add Plan</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No care plans found</div>
        ) : (
          <div className="space-y-2">
            {plans.map(plan => {
              const isExpanded = expandedId === plan.id
              return (
                <div key={plan.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                  <button onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                      <span className={`text-xs font-medium ${plan.status === 'active' ? 'text-white' : 'text-white/50'}`}>{plan.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${plan.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'}`}>{plan.status}</span>
                      {plan.target_date && <span className="text-[10px] text-white/30">Due: {plan.target_date}</span>}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-2">
                      {plan.description && <p className="text-xs text-white/60">{plan.description}</p>}
                      {plan.goals && plan.goals.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Goals</div>
                          {plan.goals.map((g, i) => <div key={i} className="text-xs text-white/60 pl-3 before:content-['•'] before:mr-2 before:text-purple-400">{g}</div>)}
                        </div>
                      )}
                      {plan.interventions && plan.interventions.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Interventions</div>
                          {plan.interventions.map((item, idx) => <div key={idx} className="text-xs text-white/60 pl-3 before:content-['•'] before:mr-2 before:text-cyan-400">{item}</div>)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => handleToggleStatus(plan)} className="text-[10px] text-white/40 hover:text-white">
                          Mark as {plan.status === 'active' ? 'completed' : 'active'}
                        </button>
                        <button onClick={() => handleDelete(plan.id)} className="text-[10px] text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
