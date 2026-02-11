'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Search, FileText, Upload, Download, X, File, Image,
  ClipboardList, AlertCircle, MoreVertical, Share2, Printer,
  Calendar, User, FolderOpen, Eye, ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface MedRecord {
  id: string
  user_id: string
  appointment_id?: string | null
  record_type: string
  title: string
  description?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  ai_summary?: string | null
  is_shared: boolean
  created_at: string
  updated_at: string
  users?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null
  appointments?: { id: string; created_at?: string } | null
}

type RecFilter = 'all' | 'prescription' | 'lab_result' | 'imaging' | 'visit_summary' | 'other'

const REC_TYPES: { id: RecFilter; label: string; color: string; bg: string }[] = [
  { id: 'all', label: 'All Records', color: '#E8ECF1', bg: 'rgba(255,255,255,0.05)' },
  { id: 'prescription', label: 'Prescriptions', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  { id: 'lab_result', label: 'Lab Results', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  { id: 'imaging', label: 'Imaging', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  { id: 'visit_summary', label: 'Visit Summaries', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { id: 'other', label: 'Other', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
]

function RecIcon({ type, cn }: { type: string; cn?: string }) {
  const c = cn || 'w-4 h-4'
  if (type === 'prescription') return <ClipboardList className={c} />
  if (type === 'lab_result') return <FileText className={c} />
  if (type === 'imaging') return <Image className={c} />
  if (type === 'visit_summary') return <FileText className={c} />
  return <File className={c} />
}

function ThreeDotMenu({ onAction }: { onAction?: (a: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-[#1E2A3A]/40"><MoreVertical className="w-4 h-4 text-[#7B8CA3]" /></button>
      {open && (
        <div className="absolute right-0 top-8 w-40 bg-[#151D28] border border-[#2A3A4F] rounded-xl shadow-2xl z-50 py-1">
          {['Upload', 'Download', 'View', 'Fax', 'Email', 'Share', 'Print', 'Save'].map(a => (
            <button key={a} onClick={() => { onAction?.(a); setOpen(false) }} className="w-full text-left px-3 py-2 text-xs text-[#E8ECF1] hover:bg-[#1E2A3A]/40 hover:text-[#E8ECF1] transition-colors">{a}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DoctorRecords() {
  const [records, setRecords] = useState<MedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RecFilter>('all')
  const [searchQ, setSearchQ] = useState('')
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState<RecFilter>('other')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const auth = await getCurrentUser()
        if (auth?.doctor) { setDoctorId(auth.doctor.id) }
        else { setError('Unable to load doctor profile'); setLoading(false) }
      } catch { setError('Auth error'); setLoading(false) }
    })()
  }, [])

  useEffect(() => { if (doctorId) fetchRecords() }, [filter, doctorId])

  const fetchRecords = async () => {
    try {
      setLoading(true); setError(null)
      let q = supabase.from('medical_records').select(`*, users!medical_records_user_id_fkey(first_name, last_name, email), appointments!medical_records_appointment_id_fkey(id, created_at)`).eq('is_shared', true).order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('record_type', filter)
      const { data, error: fe } = await q
      if (fe) { console.error('Fetch error:', fe); setError('Failed to load records'); return }
      setRecords((data || []).map((r: any) => ({ ...r, users: Array.isArray(r.users) ? r.users[0] : r.users || null, appointments: Array.isArray(r.appointments) ? r.appointments[0] : r.appointments || null })))
    } catch (e: any) { console.error(e); setError(e.message || 'Error') } finally { setLoading(false) }
  }

  const filtered = records.filter(r => {
    if (!searchQ) return true
    const s = searchQ.toLowerCase()
    const pn = `${r.users?.first_name || ''} ${r.users?.last_name || ''}`.toLowerCase()
    return r.title.toLowerCase().includes(s) || pn.includes(s) || (r.description || '').toLowerCase().includes(s) || (r.file_name || '').toLowerCase().includes(s) || (r.users?.email || '').toLowerCase().includes(s)
  })

  const downloadFile = async (rec: MedRecord) => {
    if (!rec.file_url) return
    try { const res = await fetch(rec.file_url); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = rec.file_name || 'record'; a.click(); window.URL.revokeObjectURL(url) } catch (e) { console.error('Download error:', e) }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle || !doctorId) return
    try {
      setUploading(true)
      const ext = uploadFile.name.split('.').pop()
      const path = `medical-records/${doctorId}/${Date.now()}.${ext}`
      const { error: ue } = await supabase.storage.from('medical-files').upload(path, uploadFile)
      if (ue) { setError('Upload failed'); setUploading(false); return }
      const { data: pub } = supabase.storage.from('medical-files').getPublicUrl(path)
      const { error: ie } = await supabase.from('medical_records').insert({ title: uploadTitle, description: uploadDesc || null, record_type: uploadType === 'all' ? 'other' : uploadType, file_url: pub.publicUrl, file_name: uploadFile.name, file_size: uploadFile.size, mime_type: uploadFile.type, is_shared: true, shared_with_doctor_id: doctorId, user_id: doctorId })
      if (ie) { setError('Save failed') } else { setShowUpload(false); setUploadTitle(''); setUploadDesc(''); setUploadFile(null); fetchRecords() }
    } catch (e: any) { setError(e.message) } finally { setUploading(false) }
  }

  const counts: Record<string, number> = { all: records.length }
  records.forEach(r => { counts[r.record_type] = (counts[r.record_type] || 0) + 1 })

  const fmtSize = (b?: number | null) => { if (!b) return 'N/A'; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB` }

  const getTypeConf = (t: string) => REC_TYPES.find(x => x.id === t) || REC_TYPES[5]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Medical Records</h1>
          <p className="text-[#7B8CA3] text-sm mt-1">{records.length} record{records.length !== 1 ? 's' : ''} across all categories</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-500 transition-colors">
          <Upload className="w-4 h-4" /> Upload Record
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111820] border border-[#1E2A3A] rounded-xl">
        <Search className="w-5 h-5 text-[#7B8CA3] flex-shrink-0" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none" placeholder="Search records by title, patient name, email, or description..." />
        {searchQ && <button onClick={() => setSearchQ('')} className="text-[#7B8CA3] hover:text-[#E8ECF1]"><X className="w-4 h-4" /></button>}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {REC_TYPES.map(rt => (
          <button key={rt.id} onClick={() => setFilter(rt.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border transition-colors ${filter === rt.id ? 'border-teal-500/40 bg-teal-500/10 text-[#00D4AA]' : 'border-[#1E2A3A] bg-[#111820] text-[#7B8CA3] hover:bg-[#1A2332]'}`}>
            <RecIcon type={rt.id === 'all' ? 'folder' : rt.id} />
            {rt.label}
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${filter === rt.id ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-[#1E2A3A]/40 text-[#7B8CA3]'}`}>{counts[rt.id] || 0}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center justify-center py-16"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mx-auto mb-4" /><p className="text-[#7B8CA3] text-sm">Loading records...</p></div></div>}

      {/* Error */}
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400 text-sm flex-1">{error}</p><button onClick={fetchRecords} className="text-red-400 text-sm font-medium hover:text-red-300">Retry</button></div>}

      {/* Empty State */}
      {!loading && filtered.length === 0 && <div className="bg-[#111820] border border-[#1E2A3A] rounded-xl p-12 text-center"><FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-[#7B8CA3] text-sm mb-1">No records found</p><p className="text-[#7B8CA3] text-xs">{searchQ ? 'Try a different search term' : 'Upload your first medical record'}</p></div>}

      {/* Records List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(rec => {
            const tc = getTypeConf(rec.record_type)
            const pn = rec.users ? `${rec.users.first_name || ''} ${rec.users.last_name || ''}`.trim() : 'Unknown'
            return (
              <div key={rec.id} className="bg-[#111820] border border-[#1E2A3A] rounded-xl p-4 hover:border-[#2A3A4F] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: tc.bg }}><div style={{ color: tc.color }}><RecIcon type={rec.record_type} /></div></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white truncate">{rec.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#7B8CA3]">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {pn}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(rec.created_at).toLocaleDateString()}</span>
                          {rec.file_size && <span>{fmtSize(rec.file_size)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>{rec.record_type.replace('_', ' ').toUpperCase()}</span>
                        <ThreeDotMenu onAction={(a) => { if (a === 'Download') downloadFile(rec); else console.log(`${a} on ${rec.id}`) }} />
                      </div>
                    </div>
                    {rec.description && <p className="text-xs text-[#7B8CA3] mt-2 line-clamp-2">{rec.description}</p>}
                    {rec.ai_summary && <div className="mt-2 px-3 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg"><p className="text-[10px] text-indigo-400 font-medium mb-1">AI Summary</p><p className="text-xs text-[#E8ECF1] line-clamp-2">{rec.ai_summary}</p></div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-[#111820] border border-[#1E2A3A] rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#1E2A3A] flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Upload Medical Record</h3><button onClick={() => setShowUpload(false)}><X className="w-5 h-5 text-[#7B8CA3]" /></button></div>
            <div className="p-4 space-y-4">
              <div><label className="text-xs font-medium text-[#7B8CA3] uppercase mb-1.5 block">Title *</label><input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="w-full px-3 py-2.5 bg-[#0d1218] border border-[#1E2A3A] rounded-lg text-white text-sm outline-none focus:border-teal-500/50" placeholder="Record title..." /></div>
              <div><label className="text-xs font-medium text-[#7B8CA3] uppercase mb-1.5 block">Record Type</label><select value={uploadType} onChange={e => setUploadType(e.target.value as RecFilter)} className="w-full px-3 py-2.5 bg-[#0d1218] border border-[#1E2A3A] rounded-lg text-white text-sm outline-none"><option value="prescription">Prescription</option><option value="lab_result">Lab Result</option><option value="imaging">Imaging</option><option value="visit_summary">Visit Summary</option><option value="other">Other</option></select></div>
              <div><label className="text-xs font-medium text-[#7B8CA3] uppercase mb-1.5 block">Description</label><textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} className="w-full px-3 py-2.5 bg-[#0d1218] border border-[#1E2A3A] rounded-lg text-white text-sm outline-none resize-none" rows={3} placeholder="Optional description..." /></div>
              <div><label className="text-xs font-medium text-[#7B8CA3] uppercase mb-1.5 block">File *</label><input ref={fileRef} type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-[#7B8CA3] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-500/10 file:text-[#00D4AA] hover:file:bg-[#00D4AA]/20" />{uploadFile && <p className="text-xs text-[#7B8CA3] mt-1">{uploadFile.name} ({fmtSize(uploadFile.size)})</p>}</div>
            </div>
            <div className="p-4 border-t border-[#1E2A3A] flex gap-3">
              <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 rounded-lg bg-[#151D28] border border-[#1E2A3A] text-[#E8ECF1] text-sm font-medium">Cancel</button>
              <button onClick={handleUpload} disabled={uploading || !uploadTitle || !uploadFile} className="flex-[2] py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-teal-500 transition-colors flex items-center justify-center gap-2">{uploading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
