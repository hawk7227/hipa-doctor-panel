'use client'
import React from 'react'
import { FolderOpen, FileText, ExternalLink } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'
import { usePanelData } from '@/hooks/usePanelData'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

export default function DocumentsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const { data, loading, error, refetch } = usePanelData({ endpoint: 'documents', patientId })
  if (!isOpen) return null
  return (
    <PanelBase title={`Documents — ${patientName}`} icon={FolderOpen} accentColor="#f59e0b" loading={loading} error={error}
      hasData={data.length > 0} emptyMessage="No documents on file" emptyIcon={FolderOpen} onRetry={refetch} onClose={onClose} draggable={false}
      badge={data.length > 0 ? data.length : undefined} syncStatus={data.length > 0 ? 'synced' : null}>
      <div className="p-3 space-y-1.5">
        {data.map((d: any, i: number) => (
          <div key={d.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-center gap-3">
            <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate block">{d.description || d.document_type || 'Document'}</span>
              <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                {d.document_type && <span>{d.document_type}</span>}
                {d.date && <span>• {new Date(d.date).toLocaleDateString()}</span>}
              </div>
            </div>
            {d.document_url && (
              <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-500 hover:text-teal-400"><ExternalLink className="w-3.5 h-3.5" /></a>
            )}
          </div>
        ))}
      </div>
    </PanelBase>
  )
}
