// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useRef, useCallback } from 'react'
import { Paperclip, X, FileText, Image as ImageIcon, File, Download, Eye, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const BUCKET = 'messaging-attachments'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/png','image/jpeg','image/gif','image/webp','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

export interface Attachment {
  name: string; url: string; type: string; size: number; path: string
}

// ═══ UPLOAD BUTTON ═══
export function AttachButton({ onAttach, disabled }: { onAttach: (a: Attachment) => void; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) { alert('File too large (max 10MB)'); return }
    setUploading(true)
    try {
      // Ensure bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.some(b => b.name === BUCKET)) {
        await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE })
      }
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      onAttach({ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size, path })
    } catch (e: any) { alert('Upload failed: ' + (e.message || 'Unknown error')) }
    finally { setUploading(false) }
  }, [onAttach])

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" accept={ALLOWED.join(',')} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      <button onClick={() => inputRef.current?.click()} disabled={disabled || uploading} className="p-2 hover:bg-[#1a3d3d]/50 rounded-lg transition-colors disabled:opacity-40" title="Attach file">
        {uploading ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <Paperclip className="w-4 h-4 text-gray-400" />}
      </button>
    </>
  )
}

// ═══ PENDING ATTACHMENTS (before send) ═══
export function PendingAttachments({ attachments, onRemove }: { attachments: Attachment[]; onRemove: (i: number) => void }) {
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-[#1a3d3d]/20">
      {attachments.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/40 rounded-lg max-w-[200px]">
          <FileIcon type={a.type} />
          <span className="text-[10px] text-gray-300 truncate flex-1">{a.name}</span>
          <span className="text-[9px] text-gray-600">{fmtSize(a.size)}</span>
          <button onClick={() => onRemove(i)} className="p-0.5 hover:bg-red-600/20 rounded"><X className="w-3 h-3 text-gray-500 hover:text-red-400" /></button>
        </div>
      ))}
    </div>
  )
}

// ═══ ATTACHMENT DISPLAY (in messages) ═══
export function AttachmentDisplay({ attachments }: { attachments: Attachment[] | string[] | any[] }) {
  const [preview, setPreview] = useState<string | null>(null)
  
  if (!attachments || attachments.length === 0) return null
  
  // Normalize — could be string URLs or Attachment objects
  const items: Attachment[] = attachments.map((a: any) => {
    if (typeof a === 'string') return { name: a.split('/').pop() || 'file', url: a, type: guessType(a), size: 0, path: '' }
    return a
  })

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {items.map((a, i) => {
          const isImage = a.type.startsWith('image/')
          return isImage ? (
            <div key={i} className="relative group cursor-pointer" onClick={() => setPreview(a.url)}>
              <img src={a.url} alt={a.name} className="w-32 h-24 object-cover rounded-lg border border-[#1a3d3d]/30" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                <Eye className="w-5 h-5 text-white" />
              </div>
            </div>
          ) : (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-[#061818] border border-[#1a3d3d]/40 rounded-lg hover:border-[#1a3d3d] transition-colors max-w-[200px]">
              <FileIcon type={a.type} />
              <span className="text-[10px] text-gray-300 truncate flex-1">{a.name}</span>
              <Download className="w-3 h-3 text-gray-500" />
            </a>
          )
        })}
      </div>

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/70"><X className="w-6 h-6 text-white" /></button>
          <img src={preview} alt="Preview" className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <a href={preview} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Download className="w-4 h-4" />Download
          </a>
        </div>
      )}
    </>
  )
}

// ═══ HELPERS ═══
function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
  if (type.includes('pdf')) return <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
  if (type.includes('word') || type.includes('document')) return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileText className="w-3.5 h-3.5 text-green-400 shrink-0" />
  return <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
}

function fmtSize(bytes: number) {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function guessType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', csv: 'text/csv', txt: 'text/plain' }
  return map[ext] || 'application/octet-stream'
}
