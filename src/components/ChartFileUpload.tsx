'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, Download, Share2, Trash2, FileText, Image, File, X, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ChartFile {
  id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  section: string
  uploaded_at: string
  uploaded_by?: string
}

interface ChartFileUploadProps {
  patientId: string
  appointmentId: string
  section: 'labs' | 'referrals' | 'prior-auth' | 'general'
  compact?: boolean // minimal UI mode
}

export default function ChartFileUpload({ patientId, appointmentId, section, compact = false }: ChartFileUploadProps) {
  const [files, setFiles] = useState<ChartFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch existing files for this patient + section
  useEffect(() => {
    if (!patientId) return
    fetchFiles()
  }, [patientId, section])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chart_files')
        .select('*')
        .eq('patient_id', patientId)
        .eq('section', section)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setFiles(data || [])
    } catch (err: any) {
      console.error('Error fetching chart files:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const timestamp = Date.now()
        const storagePath = `patient-charts/${patientId}/${section}/${timestamp}_${file.name}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('chart-files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Save metadata to chart_files table
        const { error: dbError } = await supabase
          .from('chart_files')
          .insert({
            patient_id: patientId,
            appointment_id: appointmentId,
            section,
            file_name: file.name,
            file_path: storagePath,
            file_type: file.type || `application/${fileExt}`,
            file_size: file.size
          })

        if (dbError) throw dbError
      }

      // Refresh file list
      await fetchFiles()
    } catch (err: any) {
      console.error('Error uploading file:', err)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (file: ChartFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('chart-files')
        .download(file.file_path)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error downloading file:', err)
      setError(err.message || 'Download failed')
    }
  }

  const handleShare = async (file: ChartFile) => {
    try {
      // Generate a signed URL (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from('chart-files')
        .createSignedUrl(file.file_path, 3600)

      if (error) throw error

      // Copy to clipboard
      await navigator.clipboard.writeText(data.signedUrl)
      alert('Share link copied to clipboard (valid for 1 hour)')
    } catch (err: any) {
      console.error('Error sharing file:', err)
      setError(err.message || 'Failed to generate share link')
    }
  }

  const handlePreview = async (file: ChartFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('chart-files')
        .createSignedUrl(file.file_path, 3600)

      if (error) throw error
      setPreviewUrl(data.signedUrl)
    } catch (err: any) {
      console.error('Error previewing file:', err)
    }
  }

  const handleDelete = async (file: ChartFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return

    try {
      // Delete from storage
      await supabase.storage.from('chart-files').remove([file.file_path])

      // Delete from database
      await supabase.from('chart_files').delete().eq('id', file.id)

      // Refresh
      await fetchFiles()
    } catch (err: any) {
      console.error('Error deleting file:', err)
      setError(err.message || 'Delete failed')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-3.5 w-3.5 text-purple-400" />
    if (fileType.includes('pdf')) return <FileText className="h-3.5 w-3.5 text-red-400" />
    return <File className="h-3.5 w-3.5 text-gray-400" />
  }

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith('image/') || fileType.includes('pdf')
  }

  return (
    <div className="mt-3">
      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
        {files.length > 0 && (
          <span className="text-[10px] text-gray-500">{files.length} file{files.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-700/40 rounded-lg border border-white/5 group">
              {getFileIcon(file.file_type)}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{file.file_name}</div>
                <div className="text-[10px] text-gray-500">{formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {isPreviewable(file.file_type) && (
                  <button onClick={() => handlePreview(file)} className="p-1 hover:bg-white/10 rounded" title="Preview">
                    <Eye className="h-3 w-3 text-blue-400" />
                  </button>
                )}
                <button onClick={() => handleDownload(file)} className="p-1 hover:bg-white/10 rounded" title="Download">
                  <Download className="h-3 w-3 text-green-400" />
                </button>
                <button onClick={() => handleShare(file)} className="p-1 hover:bg-white/10 rounded" title="Share link">
                  <Share2 className="h-3 w-3 text-cyan-400" />
                </button>
                <button onClick={() => handleDelete(file)} className="p-1 hover:bg-white/10 rounded" title="Delete">
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 z-10 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700"
            >
              <X className="h-4 w-4" />
            </button>
            {previewUrl.includes('.pdf') || previewUrl.includes('application/pdf') ? (
              <iframe src={previewUrl} className="w-full h-[85vh] rounded-lg" />
            ) : (
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg mx-auto object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
