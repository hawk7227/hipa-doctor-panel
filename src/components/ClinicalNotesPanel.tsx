// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { FileText, Loader2, ChevronDown, ChevronRight, Lock, ExternalLink } from 'lucide-react'

interface ClinicalNotesPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface ClinicalNote {
  id: number
  patient_id: string
  appointment_id: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  history_of_present_illness: string | null
  review_of_systems: string | null
  physical_exam: string | null
  assessment_plan: string | null
  locked: boolean
  pdf_url: string | null
  updated_at: string | null
}

export default function ClinicalNotesPanel({ isOpen, onClose, patientId, patientName }: ClinicalNotesPanelProps) {
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      setNotes((data as unknown as ClinicalNote[]) || [])
    } catch (err) {
      console.error('Error fetching clinical notes:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchNotes()
  }, [isOpen, fetchNotes])

  const renderSOAPSection = (label: string, content: string | null, color: string) => {
    if (!content) return null
    return (
      <div className="mb-3">
        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${color}`}>{label}</div>
        <div className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{content}</div>
      </div>
    )
  }

  return (
    <DraggableOverlayWrapper
      panelId="clinical-notes"
      isOpen={isOpen}
      onClose={onClose}
      title="Clinical Notes"
      subtitle={patientName ? `${patientName} • ${notes.length} notes` : undefined}
      icon={<FileText className="w-4 h-4" />}
      defaultTheme="blue"
      defaultWidth={600}
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No clinical notes found</div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => {
              const isExpanded = expandedId === note.id
              const hasSOAP = note.subjective || note.objective || note.assessment || note.plan
              const hasAdditional = note.history_of_present_illness || note.review_of_systems || note.physical_exam || note.assessment_plan
              const dateStr = note.updated_at ? new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'

              return (
                <div key={note.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : note.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                      <span className="text-xs font-medium text-white">{dateStr}</span>
                      {note.locked && <Lock className="w-3 h-3 text-yellow-400" />}
                      {note.appointment_id && (
                        <span className="text-[10px] text-white/30">Appt #{note.appointment_id}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSOAP && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">SOAP</span>}
                      {note.pdf_url && (
                        <a href={note.pdf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3 h-3 text-white/30 hover:text-white/60" />
                        </a>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/5">
                      {hasSOAP && (
                        <>
                          {renderSOAPSection('Subjective', note.subjective, 'text-blue-400')}
                          {renderSOAPSection('Objective', note.objective, 'text-green-400')}
                          {renderSOAPSection('Assessment', note.assessment, 'text-orange-400')}
                          {renderSOAPSection('Plan', note.plan, 'text-purple-400')}
                        </>
                      )}
                      {hasAdditional && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          {renderSOAPSection('History of Present Illness', note.history_of_present_illness, 'text-cyan-400')}
                          {renderSOAPSection('Review of Systems', note.review_of_systems, 'text-teal-400')}
                          {renderSOAPSection('Physical Exam', note.physical_exam, 'text-amber-400')}
                          {renderSOAPSection('Assessment & Plan', note.assessment_plan, 'text-rose-400')}
                        </div>
                      )}
                      {!hasSOAP && !hasAdditional && (
                        <div className="text-xs text-white/30 italic">No detailed content available</div>
                      )}
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
