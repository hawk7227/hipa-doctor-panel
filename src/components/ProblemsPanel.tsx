'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { AlertCircle, Plus, Trash2, Loader2, CheckCircle2, Clock } from 'lucide-react'

interface ProblemsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface Problem {
  id: number
  drchrono_problem_id: number
  drchrono_patient_id: number
  name: string
  icd_code: string | null
  snomed_ct_code: string | null
  status: string
  date_diagnosis: string | null
  date_changed: string | null
  notes: string | null
}

export default function ProblemsPanel({ isOpen, onClose, patientId, patientName }: ProblemsPanelProps) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newProblem, setNewProblem] = useState({ name: '', icd_code: '', status: 'active', notes: '' })
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const fetchProblems = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('drchrono_problems')
        .select('*')
        .eq('drchrono_patient_id', patientId)
        .order('date_diagnosis', { ascending: false })
      if (error) throw error
      setProblems((data as unknown as Problem[]) || [])
    } catch (err) {
      console.error('Error fetching problems:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchProblems()
  }, [isOpen, fetchProblems])

  const handleAdd = async () => {
    if (!newProblem.name.trim()) return
    try {
      const { error } = await supabase.from('drchrono_problems').insert({
        drchrono_patient_id: parseInt(patientId),
        drchrono_problem_id: Date.now(),
        name: newProblem.name,
        icd_code: newProblem.icd_code || null,
        status: newProblem.status,
        notes: newProblem.notes || null,
        date_diagnosis: new Date().toISOString().split('T')[0],
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setNewProblem({ name: '', icd_code: '', status: 'active', notes: '' })
      setAdding(false)
      fetchProblems()
    } catch (err) {
      console.error('Error adding problem:', err)
    }
  }

  const handleToggleStatus = async (problem: Problem) => {
    const newStatus = problem.status === 'active' ? 'resolved' : 'active'
    try {
      const { error } = await supabase
        .from('drchrono_problems')
        .update({ status: newStatus, date_changed: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() })
        .eq('id', problem.id)
      if (error) throw error
      setProblems(prev => prev.map(p => p.id === problem.id ? { ...p, status: newStatus } : p))
    } catch (err) {
      console.error('Error toggling problem status:', err)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('drchrono_problems').delete().eq('id', id)
      if (error) throw error
      setProblems(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error deleting problem:', err)
    }
  }

  const filtered = problems.filter(p => filter === 'all' || p.status === filter)
  const activeCount = problems.filter(p => p.status === 'active').length
  const resolvedCount = problems.filter(p => p.status === 'resolved').length

  return (
    <DraggableOverlayWrapper
      panelId="problems"
      isOpen={isOpen}
      onClose={onClose}
      title="Problems List"
      subtitle={patientName ? `${patientName} • ${activeCount} active, ${resolvedCount} resolved` : undefined}
      icon={<AlertCircle className="w-4 h-4" />}
      defaultTheme="orange"
      defaultWidth={540}
      headerActions={
        <button onClick={() => setAdding(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors" title="Add problem">
          <Plus className="w-3.5 h-3.5 text-white/60" />
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['all', 'active', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <span className="ml-1 text-[10px]">({f === 'active' ? activeCount : resolvedCount})</span>}
            </button>
          ))}
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-2">
            <input
              placeholder="Problem name..."
              value={newProblem.name}
              onChange={e => setNewProblem(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500/50 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                placeholder="ICD-10 code"
                value={newProblem.icd_code}
                onChange={e => setNewProblem(prev => ({ ...prev, icd_code: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500/50 focus:outline-none"
              />
              <select
                value={newProblem.status}
                onChange={e => setNewProblem(prev => ({ ...prev, status: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={newProblem.notes}
              onChange={e => setNewProblem(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500/50 focus:outline-none resize-none"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700">Add Problem</button>
            </div>
          </div>
        )}

        {/* Problems list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No problems found</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(problem => (
              <div key={problem.id} className="bg-white/5 rounded-xl border border-white/5 p-3 group hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleStatus(problem)} title={`Mark as ${problem.status === 'active' ? 'resolved' : 'active'}`}>
                        {problem.status === 'active'
                          ? <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          : <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                      </button>
                      <span className={`text-sm font-medium ${problem.status === 'active' ? 'text-white' : 'text-white/50 line-through'}`}>
                        {problem.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-6">
                      {problem.icd_code && (
                        <span className="text-[10px] font-mono bg-white/10 text-white/60 px-1.5 py-0.5 rounded">{problem.icd_code}</span>
                      )}
                      {problem.date_diagnosis && (
                        <span className="text-[10px] text-white/40">Dx: {problem.date_diagnosis}</span>
                      )}
                      {problem.snomed_ct_code && (
                        <span className="text-[10px] text-white/30">SNOMED: {problem.snomed_ct_code}</span>
                      )}
                    </div>
                    {problem.notes && (
                      <p className="text-[11px] text-white/40 mt-1 ml-6">{problem.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(problem.id)}
                    className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
