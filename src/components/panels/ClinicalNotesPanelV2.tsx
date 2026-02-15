'use client'
import React, { useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function ClinicalNotesPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, drchronoData, loading, error, refetch, create, remove, saving } = usePanelData({ endpoint: 'clinical-notes', patientId })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ note_type: 'progress', content: '' })
  const all = [...data.map((d: any) => ({ ...d, _src: 'local' })), ...drchronoData.map((d: any) => ({ ...d, _src: 'drchrono' }))]

  const handleSave = async () => { if (!form.content.trim()) return; await create(form); setForm({ note_type: 'progress', content: '' }); setShowAdd(false) }
  if (!isOpen) return null
  return (
    <PanelBase title={`Clinical Notes — ${patientName}`} icon={FileText} accentColor="#3b82f6" loading={loading} error={error}
      hasData={all.length > 0} emptyMessage="No clinical notes" onRetry={refetch} onClose={onClose} draggable={false}
      badge={all.length > 0 ? all.length : undefined} syncStatus={drchronoData.length > 0 ? 'synced' : null}
      headerActions={<button onClick={() => setShowAdd(true)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="p-3 space-y-2">
        {showAdd && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
            <select value={form.note_type} onChange={e => setForm({ ...form, note_type: e.target.value })} className="bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm w-full">
              <option value="progress">Progress Note</option><option value="soap">SOAP Note</option><option value="hpi">HPI</option><option value="other">Other</option>
            </select>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Note content..." rows={4} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-gray-400">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.content.trim()} className="px-3 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Add Note'}</button>
            </div>
          </div>
        )}
        {all.map((n: any, i: number) => (
          <div key={n.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">{n.note_type || 'note'}</span>
              {n._src === 'drchrono' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">DrChrono</span>}
              <span className="text-[10px] text-gray-600 ml-auto">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
              {n._src === 'local' && <button onClick={() => remove(n.id)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.content || (n.clinical_note_sections ? (typeof n.clinical_note_sections === 'string' ? n.clinical_note_sections : JSON.stringify(n.clinical_note_sections, null, 2).slice(0, 500)) : n.notes || 'No content')}</p>
            {n.author && <p className="text-[10px] text-gray-600 mt-1">— {n.author}</p>}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
