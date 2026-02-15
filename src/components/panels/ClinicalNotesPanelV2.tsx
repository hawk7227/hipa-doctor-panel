'use client'
import React, { useState, useMemo } from 'react'
import { FileText, Plus, Pencil, Trash2, Lock, CheckCircle, Clock, Mic, Brain, Filter } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Notes', 'New Note', 'Templates'] as const
const NOTE_TYPES = ['soap', 'progress', 'hpi', 'procedure', 'consultation', 'telephone', 'custom'] as const
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  signed: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  locked: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  amended: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export default function ClinicalNotesPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, update, remove, saving } = usePanelData({ endpoint: 'clinical-notes', patientId })
  const [tab, setTab] = useState<typeof TABS[number]>('Notes')
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({
    note_type: 'soap' as string, subjective: '', objective: '', assessment: '', plan: '',
    chief_complaint: '', content: '', em_code: '', time_spent_minutes: '', status: 'draft', notes: ''
  })

  const allNotes = useMemo(() => {
    const dc = (drchronoData || []).map((d: any) => ({ ...d, _source: 'drchrono', note_type: 'progress' }))
    return [...(data || []), ...dc].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [data, drchronoData])

  const resetForm = () => {
    setForm({ note_type: 'soap', subjective: '', objective: '', assessment: '', plan: '',
      chief_complaint: '', content: '', em_code: '', time_spent_minutes: '', status: 'draft', notes: '' })
    setEditId(null)
  }

  const handleSave = async () => {
    const payload: any = { patient_id: patientId, ...form }
    if (form.time_spent_minutes) payload.time_spent_minutes = parseInt(form.time_spent_minutes)
    if (editId) await update(editId, payload)
    else await create(payload)
    resetForm(); setTab('Notes')
  }

  const handleSign = async (id: string) => {
    await update(id, { status: 'signed', signed_at: new Date().toISOString(), signed_by: 'Provider' })
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Clinical Notes — ${patientName}`} icon={FileText} accentColor="#06b6d4" loading={loading}
      error={error} hasData={allNotes.length > 0 || tab === 'New Note'} emptyMessage="No clinical notes"
      onRetry={refetch} onClose={onClose} draggable={false} badge={allNotes.length || undefined}
      syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => { resetForm(); setTab('New Note') }} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* NEW NOTE FORM */}
          {tab === 'New Note' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <select value={form.note_type} onChange={e => setForm({...form, note_type: e.target.value})}
                  className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm flex-1">
                  {NOTE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
                <input value={form.em_code} onChange={e => setForm({...form, em_code: e.target.value})}
                  placeholder="E&M Code" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm w-24" />
                <input value={form.time_spent_minutes} onChange={e => setForm({...form, time_spent_minutes: e.target.value})}
                  placeholder="Min" type="number" className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm w-16" />
              </div>

              {form.note_type === 'soap' ? (
                <>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Chief Complaint</label>
                    <input value={form.chief_complaint} onChange={e => setForm({...form, chief_complaint: e.target.value})}
                      placeholder="Chief complaint..." className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm" />
                  </div>
                  {(['subjective', 'objective', 'assessment', 'plan'] as const).map(section => (
                    <div key={section}>
                      <label className="text-[10px] text-gray-500 uppercase">{section}</label>
                      <textarea value={form[section]} onChange={e => setForm({...form, [section]: e.target.value})}
                        placeholder={`${section.charAt(0).toUpperCase() + section.slice(1)}...`} rows={3}
                        className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
                    </div>
                  ))}
                </>
              ) : (
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Note Content</label>
                  <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})}
                    placeholder="Enter note content..." rows={12}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button onClick={() => { resetForm(); setTab('Notes') }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={() => { setForm({...form, status: 'draft'}); handleSave() }} disabled={saving}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50">Save Draft</button>
                <button onClick={() => { setForm({...form, status: 'completed'}); handleSave() }} disabled={saving}
                  className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">Complete & Sign</button>
              </div>
            </div>
          )}

          {/* NOTES LIST */}
          {tab === 'Notes' && allNotes.map((note: any, idx: number) => {
            const isExpanded = expandedId === (note.id || idx)
            return (
              <div key={note.id || idx} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg">
                <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : (note.id || idx))}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white capitalize">{(note.note_type || 'note').replace('_', ' ')}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${STATUS_COLORS[note.status] || STATUS_COLORS.draft}`}>{(note.status || 'draft').toUpperCase()}</span>
                      {note.ai_generated && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"><Brain className="w-2.5 h-2.5 inline" /> AI</span>}
                      {note._source === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      {note.em_code && <span className="font-mono">{note.em_code}</span>}
                      {note.signed_by && <span>Signed by {note.signed_by}</span>}
                    </div>
                  </div>
                  {!note._source && note.status !== 'signed' && note.status !== 'locked' && (
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); handleSign(note.id) }} className="p-1 text-gray-500 hover:text-green-400" title="Sign"><Lock className="w-3 h-3" /></button>
                      <button onClick={e => { e.stopPropagation(); remove(note.id) }} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div className="border-t border-[#1a3d3d] p-3 space-y-2 text-sm">
                    {note.chief_complaint && <div><span className="text-[10px] text-gray-500 uppercase block">CC</span><p className="text-white">{note.chief_complaint}</p></div>}
                    {note.subjective && <div><span className="text-[10px] text-gray-500 uppercase block">Subjective</span><p className="text-gray-300 whitespace-pre-wrap">{note.subjective}</p></div>}
                    {note.objective && <div><span className="text-[10px] text-gray-500 uppercase block">Objective</span><p className="text-gray-300 whitespace-pre-wrap">{note.objective}</p></div>}
                    {note.assessment && <div><span className="text-[10px] text-gray-500 uppercase block">Assessment</span><p className="text-gray-300 whitespace-pre-wrap">{note.assessment}</p></div>}
                    {note.plan && <div><span className="text-[10px] text-gray-500 uppercase block">Plan</span><p className="text-gray-300 whitespace-pre-wrap">{note.plan}</p></div>}
                    {note.content && <div><span className="text-[10px] text-gray-500 uppercase block">Content</span><p className="text-gray-300 whitespace-pre-wrap">{note.content}</p></div>}
                  </div>
                )}
              </div>
            )
          })}

          {/* TEMPLATES TAB */}
          {tab === 'Templates' && (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Clinical templates coming soon</p>
              <p className="text-[10px] text-gray-600 mt-1">SOAP, HPI, ROS, Physical Exam, Procedure notes</p>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
