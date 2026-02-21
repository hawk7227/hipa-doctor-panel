// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { FolderOpen, Loader2, ExternalLink, FileText, Image, File } from 'lucide-react'

interface DocumentsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface PatientDocument {
  id: number
  patient_id: string
  description: string | null
  document_type: string | null
  document_url: string | null
  date: string | null
  metatags: Record<string, unknown>
  doctor: number | null
}

const getDocIcon = (type: string | null) => {
  if (!type) return <File className="w-4 h-4 text-white/40" />
  const t = type.toLowerCase()
  if (t.includes('image') || t.includes('photo') || t.includes('xray')) return <Image className="w-4 h-4 text-blue-400" />
  if (t.includes('lab') || t.includes('report')) return <FileText className="w-4 h-4 text-green-400" />
  return <FileText className="w-4 h-4 text-white/40" />
}

export default function DocumentsPanel({ isOpen, onClose, patientId, patientName }: DocumentsPanelProps) {
  const [docs, setDocs] = useState<PatientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
      if (error) throw error
      setDocs(data || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const docTypes = ['all', ...new Set(docs.map(d => d.document_type || 'Other').filter(Boolean))]
  const filtered = typeFilter === 'all' ? docs : docs.filter(d => (d.document_type || 'Other') === typeFilter)

  return (
    <DraggableOverlayWrapper
      panelId="documents"
      isOpen={isOpen}
      onClose={onClose}
      title="Documents"
      subtitle={patientName ? `${patientName} • ${docs.length} documents` : undefined}
      icon={<FolderOpen className="w-4 h-4" />}
      defaultTheme="amber"
      defaultWidth={520}
    >
      <div className="p-4 space-y-3">
        {/* Type filter */}
        {docTypes.length > 2 && (
          <div className="flex gap-1 flex-wrap">
            {docTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${typeFilter === t ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">No documents found</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(doc => (
              <div key={doc.id} className="bg-white/5 rounded-xl border border-white/5 p-3 hover:border-white/10 transition-colors flex items-center gap-3">
                {getDocIcon(doc.document_type)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{doc.description || 'Untitled Document'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.document_type && <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">{doc.document_type}</span>}
                    {doc.date && <span className="text-[10px] text-white/30">{new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  </div>
                </div>
                {doc.document_url && (
                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-white/40" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
