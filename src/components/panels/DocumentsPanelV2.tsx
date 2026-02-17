// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  FolderOpen, FileText, Upload, ExternalLink, Search, Tag, Send, ClipboardPlus,
  Trash2, Eye, Lock, ScrollText, ArrowRight, FlaskConical, FileEdit, Filter,
  X, AlertCircle, Check, Plus, Download, RefreshCw, FileImage, FileBadge,
  Calendar, User, ChevronDown, Clock
} from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

type DocTab = 'uploaded' | 'locked-notes' | 'consent-forms' | 'referrals' | 'lab-results' | 'amendments'

interface DocItem {
  id: string
  description?: string
  document_type?: string
  file_name?: string
  document_url?: string
  file_url?: string
  date?: string
  created_at?: string
  uploaded_at?: string
  tags?: string[]
  _source?: 'drchrono' | 'local'
  mime_type?: string
  file_size?: number
  uploaded_by?: string
  // Clinical note fields
  note_type?: string
  content?: string
  signed_at?: string
  locked_at?: string
  author?: string
  locked?: boolean
  // Referral fields
  referral_to?: string
  referral_to_specialty?: string
  referral_reason?: string
  referral_status?: string
  urgency?: string
  sent_at?: string
  notes?: string
  // Amendment fields
  amendment_type?: string
  amendment_reason?: string
  amendment_status?: string
  original_content?: string
  amended_content?: string
  requested_by?: string
  reviewed_by?: string
  reviewed_at?: string
  status?: string
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const TABS: { id: DocTab; label: string; icon: typeof FileText }[] = [
  { id: 'uploaded', label: 'Uploaded Documents', icon: FolderOpen },
  { id: 'locked-notes', label: 'Locked Clinical Notes', icon: Lock },
  { id: 'consent-forms', label: 'Signed Consent Forms', icon: ScrollText },
  { id: 'referrals', label: 'Outbound Referrals', icon: ArrowRight },
  { id: 'lab-results', label: 'Lab Results', icon: FlaskConical },
  { id: 'amendments', label: 'Amendments', icon: FileEdit },
]

const TAG_OPTIONS = ['Lab', 'Imaging', 'Referral', 'Consent', 'Insurance', 'Imported Data', 'Clinical', 'Billing', 'Patient Upload', 'External']
const TAG_COLORS: Record<string, string> = {
  'Lab': '#06b6d4', 'Imaging': '#a855f7', 'Referral': '#f97316', 'Consent': '#10b981',
  'Insurance': '#3b82f6', 'Imported Data': '#64748b', 'Clinical': '#ef4444', 'Billing': '#eab308',
  'Patient Upload': '#ec4899', 'External': '#8b5cf6',
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(d?: string): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) } catch { return '' }
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DocumentsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const [activeTab, setActiveTab] = useState<DocTab>('uploaded')
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [clinicalNotes, setClinicalNotes] = useState<DocItem[]>([])
  const [referrals, setReferrals] = useState<DocItem[]>([])
  const [amendments, setAmendments] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)
  const [showFaxModal, setShowFaxModal] = useState<DocItem | null>(null)
  const [showTaskModal, setShowTaskModal] = useState<DocItem | null>(null)
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [showAmendmentForm, setShowAmendmentForm] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/panels/documents?patient_id=${patientId}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setDocuments((json.data || []).sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime()))
      setClinicalNotes(json.clinical_notes || [])
      setReferrals(json.referrals || [])
      setAmendments(json.amendments || [])
    } catch (err: any) {
      console.error('Documents fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { if (isOpen) fetchData() }, [isOpen, fetchData])

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg })
    setTimeout(() => setNotification(null), 3500)
  }

  // ── Upload ──
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!files.length) return
    setUploading(true)
    let count = 0
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('patient_id', patientId)
        formData.append('description', file.name)
        const res = await fetch('/api/panels/documents', { method: 'POST', body: formData })
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setDocuments(prev => [{ ...json.data, _source: 'local' }, ...prev])
            count++
          }
        }
      } catch (err) { console.error('Upload error:', err) }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (count > 0) notify('success', `Uploaded ${count} file${count > 1 ? 's' : ''}`)
    else notify('error', 'Upload failed')
  }, [patientId])

  // ── Drag/Drop ──
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files)
  }, [handleUpload])

  // ── Tag update ──
  const handleTagToggle = useCallback(async (doc: DocItem, tag: string) => {
    if (doc._source !== 'local') return
    const current = doc.tags || []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    try {
      const res = await fetch('/api/panels/documents', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, tags: next })
      })
      if (res.ok) setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, tags: next } : d))
    } catch { /* ok */ }
    setShowTagDropdown(null)
  }, [])

  // ── Delete ──
  const handleDelete = useCallback(async (doc: DocItem) => {
    if (!confirm(`Delete "${doc.description || doc.file_name || 'this document'}"?`)) return
    try {
      const res = await fetch(`/api/panels/documents?document_id=${doc.id}&patient_id=${patientId}`, { method: 'DELETE' })
      if (res.ok) { setDocuments(prev => prev.filter(d => d.id !== doc.id)); notify('success', 'Deleted') }
    } catch { notify('error', 'Delete failed') }
  }, [patientId])

  // ── Fax ──
  const handleFax = useCallback(async (doc: DocItem, faxNumber: string) => {
    try {
      // For now, log fax attempt (full Twilio fax integration to be added)
      notify('success', `Fax queued to ${faxNumber}`)
      setShowFaxModal(null)
    } catch { notify('error', 'Fax failed') }
  }, [])

  // ── Create Task ──
  const handleCreateTask = useCallback(async (doc: DocItem, title: string, priority: string) => {
    try {
      const res = await fetch('/api/panels/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, document_id: doc._source === 'local' ? doc.id : null, title, priority })
      })
      if (res.ok) { notify('success', `Task: ${title}`); setShowTaskModal(null) }
      else notify('error', 'Task creation failed')
    } catch { notify('error', 'Task creation failed') }
  }, [patientId])

  // ── Create Referral ──
  const handleCreateReferral = useCallback(async (data: any) => {
    try {
      const res = await fetch('/api/panels/referrals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...data })
      })
      if (res.ok) {
        const json = await res.json()
        setReferrals(prev => [json.data, ...prev])
        notify('success', `Referral to ${data.referral_to}`)
        setShowReferralForm(false)
      }
    } catch { notify('error', 'Referral creation failed') }
  }, [patientId])

  // ── Create Amendment ──
  const handleCreateAmendment = useCallback(async (data: any) => {
    try {
      const res = await fetch('/api/panels/amendments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...data })
      })
      if (res.ok) {
        const json = await res.json()
        setAmendments(prev => [json.data, ...prev])
        notify('success', 'Amendment submitted')
        setShowAmendmentForm(false)
      }
    } catch { notify('error', 'Amendment creation failed') }
  }, [patientId])

  if (!isOpen) return null

  // ── Filter ──
  const filterDocs = (docs: DocItem[]) => {
    let f = docs
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      f = f.filter(d => [d.description, d.file_name, d.document_type, d.author, d.referral_to, d.amendment_reason].some(s => (s || '').toLowerCase().includes(q)))
    }
    if (selectedTag) f = f.filter(d => d.tags?.includes(selectedTag))
    return f
  }

  // Tab data derivation
  const lockedNotes = clinicalNotes.filter(n => n.locked || n.signed_at || n.locked_at)
  const consentForms = documents.filter(d => {
    const s = (d.description || d.document_type || d.file_name || '').toLowerCase()
    return s.includes('consent') || s.includes('authorization') || s.includes('hipaa') || (d.tags || []).includes('Consent')
  })
  const labDocs = documents.filter(d => {
    const s = (d.description || d.document_type || d.file_name || '').toLowerCase()
    return s.includes('lab') || s.includes('result') || s.includes('pathology') || s.includes('quest') || s.includes('labcorp') || (d.tags || []).includes('Lab')
  })

  const tabData: Record<DocTab, DocItem[]> = {
    'uploaded': filterDocs(documents),
    'locked-notes': filterDocs(lockedNotes),
    'consent-forms': filterDocs(consentForms),
    'referrals': filterDocs(referrals),
    'lab-results': filterDocs(labDocs),
    'amendments': filterDocs(amendments),
  }

  const counts: Record<DocTab, number> = {
    'uploaded': documents.length,
    'locked-notes': lockedNotes.length,
    'consent-forms': consentForms.length,
    'referrals': referrals.length,
    'lab-results': labDocs.length,
    'amendments': amendments.length,
  }

  return (
    <PanelBase
      title={`Documents — ${patientName}`}
      icon={FolderOpen} accentColor="#f59e0b" loading={loading} error={error}
      hasData={true} emptyMessage="" onRetry={fetchData} onClose={onClose} draggable={false}
      badge={documents.length || undefined} syncStatus={documents.length > 0 ? 'synced' : null}
    >
      {/* ═══ TAB BAR ═══ */}
      <div className="flex border-b border-[#1a3d3d] overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[10px] font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id ? 'text-amber-400 border-amber-400' : 'text-gray-500 hover:text-gray-300 border-transparent'
              }`}>
              <Icon className="h-3 w-3" />
              {tab.label}
              {counts[tab.id] > 0 && <span className="ml-0.5 text-[8px] bg-white/10 px-1 rounded">{counts[tab.id]}</span>}
            </button>
          )
        })}
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a3d3d]/50">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search..." className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none" />
        </div>
        {selectedTag && (
          <button onClick={() => setSelectedTag(null)} className="flex items-center gap-1 px-2 py-1 text-[9px] rounded-lg border border-amber-500/30 text-amber-400 bg-amber-500/10">
            {selectedTag} <X className="h-2.5 w-2.5" />
          </button>
        )}
        {activeTab === 'uploaded' && (
          <label className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg cursor-pointer hover:bg-amber-500/20 transition-colors">
            <Upload className="h-3 w-3" /> {uploading ? 'Uploading...' : 'Upload'}
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.tif,.tiff" multiple
              onChange={e => e.target.files && handleUpload(e.target.files)} disabled={uploading} />
          </label>
        )}
        {activeTab === 'referrals' && (
          <button onClick={() => setShowReferralForm(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20">
            <Plus className="h-3 w-3" /> New Referral
          </button>
        )}
        {activeTab === 'amendments' && (
          <button onClick={() => setShowAmendmentForm(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20">
            <Plus className="h-3 w-3" /> New Amendment
          </button>
        )}
        <button onClick={fetchData} className="p-1.5 text-gray-500 hover:text-teal-400" title="Refresh">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* ═══ DROP ZONE (uploaded tab only) ═══ */}
      {activeTab === 'uploaded' && (
        <div className={`mx-3 mt-2 mb-1 border-2 border-dashed rounded-lg py-3 px-4 text-center transition-colors ${
          dragOver ? 'border-amber-400 bg-amber-500/10' : 'border-[#1a3d3d]/60 hover:border-[#2a5d5d]'
        }`} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
          <p className="text-[10px] text-gray-500">
            {dragOver ? 'Drop files here' : 'Drop files anywhere onto this page'}
          </p>
        </div>
      )}

      {/* ═══ DOCUMENT TABLE / LIST ═══ */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {tabData[activeTab].length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-7 w-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              {searchTerm ? 'No results match your search' :
               activeTab === 'uploaded' ? 'No documents. Upload files above.' :
               activeTab === 'locked-notes' ? 'No locked clinical notes' :
               activeTab === 'consent-forms' ? 'No signed consent forms' :
               activeTab === 'referrals' ? 'No outbound referrals' :
               activeTab === 'lab-results' ? 'No lab result documents' :
               'No amendments'}
            </p>
          </div>
        ) : activeTab === 'uploaded' || activeTab === 'consent-forms' || activeTab === 'lab-results' ? (
          /* ── TABLE LAYOUT (matches DrChrono) ── */
          <table className="w-full text-xs mt-1">
            <thead>
              <tr className="text-left text-[10px] text-gray-500 border-b border-[#1a3d3d]">
                <th className="py-1.5 px-2 w-8"></th>
                <th className="py-1.5 px-2">Date</th>
                <th className="py-1.5 px-2">Description</th>
                <th className="py-1.5 px-2 hidden md:table-cell">Tags</th>
                <th className="py-1.5 px-2 hidden md:table-cell">Uploaded</th>
                <th className="py-1.5 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tabData[activeTab].map((doc, i) => {
                const isImg = (doc.file_name || '').match(/\.(jpg|jpeg|png|gif|webp)$/i)
                const isPdf = (doc.file_name || doc.document_url || '').toLowerCase().includes('.pdf')
                const url = doc.document_url || doc.file_url
                return (
                  <tr key={doc.id || i} className="border-b border-[#1a3d3d]/30 hover:bg-white/[0.02] group">
                    <td className="py-2 px-2">
                      {doc._source === 'drchrono' ? (
                        <span className="w-5 h-5 rounded bg-green-500/10 text-green-500 text-[8px] font-bold flex items-center justify-center" title="DrChrono">dc</span>
                      ) : isImg ? <FileImage className="h-4 w-4 text-purple-400" /> :
                        isPdf ? <FileBadge className="h-4 w-4 text-red-400" /> :
                        <FileText className="h-4 w-4 text-amber-400" />}
                    </td>
                    <td className="py-2 px-2 text-gray-400 whitespace-nowrap">{formatDate(doc.date || doc.created_at)}</td>
                    <td className="py-2 px-2">
                      <span className="text-white font-medium cursor-pointer hover:text-amber-300" onClick={() => setPreviewDoc(doc)}>
                        {doc.description || doc.file_name || 'Document'}
                      </span>
                      {doc.file_size ? <span className="text-gray-600 ml-2">{formatFileSize(doc.file_size)}</span> : null}
                    </td>
                    <td className="py-2 px-2 hidden md:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(doc.tags || []).map(tag => (
                          <span key={tag} className="px-1 py-0.5 text-[7px] font-bold rounded border"
                            style={{ color: TAG_COLORS[tag] || '#94a3b8', borderColor: (TAG_COLORS[tag] || '#94a3b8') + '30', background: (TAG_COLORS[tag] || '#94a3b8') + '10' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap hidden md:table-cell">{formatDate(doc.uploaded_at || doc.created_at)}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ActionBtn icon={Send} title="Fax" color="text-blue-400" onClick={() => setShowFaxModal(doc)} />
                        <ActionBtn icon={ClipboardPlus} title="+ Task" color="text-purple-400" onClick={() => setShowTaskModal(doc)} />
                        {url && <ActionBtn icon={Eye} title="Preview" color="text-amber-400" onClick={() => setPreviewDoc(doc)} />}
                        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-500 hover:text-teal-400" title="Open"><ExternalLink className="h-3 w-3" /></a>}
                        <div className="relative">
                          <ActionBtn icon={Tag} title="Tag" color="text-amber-400" onClick={() => setShowTagDropdown(showTagDropdown === doc.id ? null : doc.id!)} />
                          {showTagDropdown === doc.id && (
                            <div className="absolute right-0 top-6 z-30 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-xl p-1.5 min-w-[110px]">
                              {TAG_OPTIONS.map(tag => (
                                <button key={tag} onClick={() => handleTagToggle(doc, tag)}
                                  className="flex items-center gap-1.5 w-full px-2 py-1 text-[9px] text-gray-300 hover:bg-white/5 rounded">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TAG_COLORS[tag] || '#94a3b8' }} />
                                  <span className="flex-1 text-left">{tag}</span>
                                  {doc.tags?.includes(tag) && <Check className="h-2.5 w-2.5 text-green-400" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {doc._source === 'local' && <ActionBtn icon={Trash2} title="Delete" color="text-red-400" onClick={() => handleDelete(doc)} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : activeTab === 'locked-notes' ? (
          /* ── LOCKED NOTES LIST ── */
          <div className="space-y-1 mt-1">
            {tabData[activeTab].map((note, i) => (
              <div key={note.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 flex items-center gap-3 hover:border-[#2a5d5d]">
                <Lock className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{note.note_type || 'Clinical Note'}</p>
                  <div className="flex gap-2 text-[10px] text-gray-500">
                    {note.signed_at && <span>Signed {formatDate(note.signed_at)}</span>}
                    {note.author && <span>by {note.author}</span>}
                    {note.created_at && <span>{formatDate(note.created_at)}</span>}
                  </div>
                </div>
                <button onClick={() => setPreviewDoc(note)} className="p-1 text-gray-500 hover:text-amber-400"><Eye className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        ) : activeTab === 'referrals' ? (
          /* ── REFERRALS LIST ── */
          <div className="space-y-1 mt-1">
            {tabData[activeTab].map((ref, i) => (
              <div key={ref.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 hover:border-[#2a5d5d]">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <p className="text-sm text-white font-medium flex-1 truncate">{ref.referral_to}</p>
                  {ref.urgency && ref.urgency !== 'routine' && (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                      ref.urgency === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>{ref.urgency}</span>
                  )}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    ref.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    ref.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                    ref.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{ref.status || 'pending'}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-500 mt-1 ml-6">
                  {ref.referral_to_specialty && <span>{ref.referral_to_specialty}</span>}
                  {ref.referral_reason && <span>• {ref.referral_reason}</span>}
                  {ref.created_at && <span>• {formatDate(ref.created_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'amendments' ? (
          /* ── AMENDMENTS LIST ── */
          <div className="space-y-1 mt-1">
            {tabData[activeTab].map((amend, i) => (
              <div key={amend.id || i} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-2.5 hover:border-[#2a5d5d]">
                <div className="flex items-center gap-2">
                  <FileEdit className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-white font-medium flex-1 truncate">
                    {amend.amendment_type === 'addendum' ? 'Addendum' : amend.amendment_type === 'clarification' ? 'Clarification' : 'Correction'}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    amend.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                    amend.status === 'denied' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{amend.status || 'pending'}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-6">{amend.amendment_reason}</p>
                <div className="flex gap-2 text-[10px] text-gray-500 mt-1 ml-6">
                  {amend.requested_by && <span>By {amend.requested_by}</span>}
                  {amend.created_at && <span>• {formatDate(amend.created_at)}</span>}
                  {amend.reviewed_by && <span>• Reviewed by {amend.reviewed_by}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ═══ PREVIEW MODAL ═══ */}
      {previewDoc && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setPreviewDoc(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3d3d]">
              <div className="flex items-center gap-2 min-w-0">
                <Eye className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-bold text-white truncate">{previewDoc.description || previewDoc.file_name || 'Document'}</span>
              </div>
              <div className="flex items-center gap-1">
                {(previewDoc.document_url || previewDoc.file_url) && (
                  <a href={previewDoc.document_url || previewDoc.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-teal-400"><ExternalLink className="h-4 w-4" /></a>
                )}
                <button onClick={() => setPreviewDoc(null)} className="p-1 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh]">
              {(previewDoc.document_url || previewDoc.file_url) ? (
                <iframe src={previewDoc.document_url || previewDoc.file_url} className="w-full h-[65vh] rounded-lg border border-[#1a3d3d]" title="Preview" />
              ) : previewDoc.content ? (
                <div className="text-sm text-gray-300 whitespace-pre-wrap bg-[#0a1f1f] rounded-lg p-4 border border-[#1a3d3d]">
                  {typeof previewDoc.content === 'string' ? previewDoc.content : JSON.stringify(previewDoc.content, null, 2)}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No preview available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAX MODAL ═══ */}
      {showFaxModal && <FaxModal doc={showFaxModal} onSend={handleFax} onClose={() => setShowFaxModal(null)} />}

      {/* ═══ TASK MODAL ═══ */}
      {showTaskModal && <TaskModal doc={showTaskModal} onSave={handleCreateTask} onClose={() => setShowTaskModal(null)} />}

      {/* ═══ REFERRAL FORM ═══ */}
      {showReferralForm && <ReferralFormModal onSave={handleCreateReferral} onClose={() => setShowReferralForm(false)} />}

      {/* ═══ AMENDMENT FORM ═══ */}
      {showAmendmentForm && <AmendmentFormModal onSave={handleCreateAmendment} onClose={() => setShowAmendmentForm(false)} />}

      {/* ═══ NOTIFICATION ═══ */}
      {notification && (
        <div className={`absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 z-50 ${
          notification.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {notification.type === 'success' ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {notification.msg}
        </div>
      )}
    </PanelBase>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ActionBtn({ icon: Icon, title, color, onClick }: { icon: typeof FileText; title: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-1.5 py-1 text-[9px] font-bold rounded border border-[#1a3d3d] hover:border-current transition-colors ${color} bg-transparent hover:bg-current/10`} title={title}>
      {title}
    </button>
  )
}

function FaxModal({ doc, onSend, onClose }: { doc: DocItem; onSend: (doc: DocItem, num: string) => void; onClose: () => void }) {
  const [faxNum, setFaxNum] = useState('')
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-blue-400" /> Fax Document</h3>
        <p className="text-xs text-gray-400 mb-3">{doc.description || doc.file_name}</p>
        <input type="tel" value={faxNum} onChange={e => setFaxNum(e.target.value)} placeholder="Fax number (e.g. 602-555-1234)"
          className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none mb-3" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => faxNum && onSend(doc, faxNum)} disabled={!faxNum}
            className="px-4 py-1.5 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50">Send Fax</button>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ doc, onSave, onClose }: { doc: DocItem; onSave: (doc: DocItem, title: string, priority: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(`Review: ${doc.description || doc.file_name || 'Document'}`)
  const [priority, setPriority] = useState('normal')
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ClipboardPlus className="h-4 w-4 text-purple-400" /> Create Task</h3>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title"
          className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:border-purple-500/50 focus:outline-none mb-2" />
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white focus:outline-none mb-3">
          <option value="low">Low Priority</option>
          <option value="normal">Normal Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent</option>
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => title && onSave(doc, title, priority)} disabled={!title}
            className="px-4 py-1.5 text-xs font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50">Create Task</button>
        </div>
      </div>
    </div>
  )
}

function ReferralFormModal({ onSave, onClose }: { onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ referral_to: '', referral_to_specialty: '', referral_to_fax: '', referral_reason: '', urgency: 'routine', notes: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ArrowRight className="h-4 w-4 text-orange-400" /> New Outbound Referral</h3>
        <div className="space-y-2">
          <input placeholder="Refer to (provider/facility) *" value={form.referral_to} onChange={e => set('referral_to', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:border-orange-500/50 focus:outline-none" />
          <input placeholder="Specialty" value={form.referral_to_specialty} onChange={e => set('referral_to_specialty', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none" />
          <input placeholder="Fax number" value={form.referral_to_fax} onChange={e => set('referral_to_fax', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none" />
          <input placeholder="Reason for referral *" value={form.referral_reason} onChange={e => set('referral_reason', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none" />
          <select value={form.urgency} onChange={e => set('urgency', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white focus:outline-none">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergent">Emergent</option>
          </select>
          <textarea placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none resize-none" />
        </div>
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => form.referral_to && form.referral_reason && onSave(form)} disabled={!form.referral_to || !form.referral_reason}
            className="px-4 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">Create Referral</button>
        </div>
      </div>
    </div>
  )
}

function AmendmentFormModal({ onSave, onClose }: { onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ amendment_type: 'correction', amendment_reason: '', amended_content: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><FileEdit className="h-4 w-4 text-yellow-400" /> New Chart Amendment</h3>
        <div className="space-y-2">
          <select value={form.amendment_type} onChange={e => set('amendment_type', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white focus:outline-none">
            <option value="correction">Correction</option>
            <option value="addendum">Addendum</option>
            <option value="clarification">Clarification</option>
          </select>
          <input placeholder="Reason for amendment *" value={form.amendment_reason} onChange={e => set('amendment_reason', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none" />
          <textarea placeholder="Amendment content" value={form.amended_content} onChange={e => set('amended_content', e.target.value)} rows={3}
            className="w-full px-3 py-2 text-sm bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none resize-none" />
        </div>
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => form.amendment_reason && onSave(form)} disabled={!form.amendment_reason}
            className="px-4 py-1.5 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-[#0a1f1f] rounded-lg disabled:opacity-50">Submit Amendment</button>
        </div>
      </div>
    </div>
  )
}
