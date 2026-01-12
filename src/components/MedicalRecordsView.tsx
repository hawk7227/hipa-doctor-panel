'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Eye, Calendar, User, X } from 'lucide-react'

interface AppointmentDocument {
  id: string
  file_name: string
  file_type: string | null
  file_url: string
  file_size?: number | null
  uploaded_by_type?: 'user' | 'doctor' | null
  created_at: string
  // Legacy fields for backward compatibility
  document_name?: string
  document_type?: string
  description?: string | null
  mime_type?: string
}

interface MedicalRecordsViewProps {
  appointmentId?: string
  patientId: string | null
}

export default function MedicalRecordsView({ appointmentId, patientId }: MedicalRecordsViewProps) {
  const [records, setRecords] = useState<AppointmentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<AppointmentDocument | null>(null)

  useEffect(() => {
    fetchAppointmentDocuments()
  }, [appointmentId, patientId])

  const fetchAppointmentDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!appointmentId) {
        console.log('No appointmentId provided')
        setRecords([])
        setLoading(false)
        return
      }

      console.log('📋 Fetching documents for appointment:', appointmentId)

      let query = supabase
        .from('files')
        .select('*')
        .eq('appointment_id', appointmentId)
        // Removed .eq('is_shared', true) - column doesn't exist in files table
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('❌ Error fetching documents:', error)
        throw error
      }

      console.log(`📊 Found ${data?.length || 0} documents`)

      if (!data || data.length === 0) {
        setRecords([])
        setLoading(false)
        return
      }

      // Convert relative file paths to signed Supabase Storage URLs (for private buckets)
      console.log('🔐 Converting file paths to signed URLs...')
      const recordsWithSignedUrls = await Promise.all(
        data.map(async (record, index) => {
          console.log(`\n🔄 Processing document ${index + 1}:`, {
            name: record.file_name || record.document_name,
            originalPath: record.file_url
          })

          // Check if file_url is already a full URL
          if (record.file_url.startsWith('http://') || record.file_url.startsWith('https://')) {
            console.log('✅ Already a full URL, skipping conversion')
            return record
          }
          
          try {
            // Generate signed URL from storage path (valid for 1 hour)
            // Keep the full path including bucket name if present, or use as-is
            let storagePath = record.file_url
            
            // If path doesn't start with bucket name, it's just the file path
            // If it does start with bucket name, use it as-is (Supabase will handle it)
            if (!storagePath.startsWith('appointment-documents/')) {
              // Path is relative, use it directly
              // No change needed
            }
            // If it starts with 'appointment-documents/', keep it as-is
            
            console.log('🔑 Creating signed URL for:', storagePath, '(original:', record.file_url, ')')
            const { data: urlData, error: urlError } = await supabase.storage
              .from('appointment-documents')
              .createSignedUrl(storagePath, 3600) // 3600 seconds = 1 hour
            
            if (urlError) {
              // Only log non-"Object not found" errors as errors (missing files are expected)
              if (urlError.message && !urlError.message.includes('Object not found') && !urlError.message.includes('not found')) {
              console.error('❌ Error creating signed URL:', {
                file: record.file_url,
                error: urlError
              })
              }
              // Try public URL as fallback, otherwise return empty URL
              const { data: publicUrlData } = supabase.storage
                .from('appointment-documents')
                .getPublicUrl(storagePath)
              if (publicUrlData?.publicUrl) {
                return {
                  ...record,
                  file_url: publicUrlData.publicUrl
                }
              }
              // Return with empty URL to prevent relative path issues
              return { ...record, file_url: '' }
            }

            if (!urlData?.signedUrl) {
              console.error('❌ No signed URL returned, urlData:', urlData)
              // Try public URL as fallback
              const { data: publicUrlData } = supabase.storage
                .from('appointment-documents')
                .getPublicUrl(storagePath)
              if (publicUrlData?.publicUrl) {
                return {
                  ...record,
                  file_url: publicUrlData.publicUrl
                }
              }
              return { ...record, file_url: '' }
            }
            
            // Use the signed URL directly - it should already include the token
            const signedUrl = urlData.signedUrl
            
            // Log for debugging
            console.log('✅ Signed URL generated:', {
              hasToken: signedUrl.includes('token='),
              urlLength: signedUrl.length,
              urlPreview: signedUrl.substring(0, 150),
              originalPath: record.file_url,
              storagePath: storagePath
            })
            
            // Return the signed URL as-is (it should already have the token)
            return {
              ...record,
              file_url: signedUrl
            }
          } catch (signError) {
            console.error('❌ Exception creating signed URL:', signError)
            return record
          }
        })
      )

      console.log('✅ All documents processed, setting records')
      setRecords(recordsWithSignedUrls)
    } catch (err: any) {
      console.error('❌ Error fetching documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDownload = async (record: AppointmentDocument) => {
    try {
      console.log('📥 Downloading file:', {
        name: record.file_name || record.document_name,
        url: record.file_url,
        type: record.file_type || record.mime_type
      })
      
      const response = await fetch(record.file_url, {
        method: 'GET',
        headers: record.file_type || record.mime_type ? {
          'Content-Type': record.file_type || record.mime_type || 'application/octet-stream'
        } : {}
      })
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = record.file_name || record.document_name || 'document'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('✅ Download successful')
    } catch (err) {
      console.error('❌ Download failed:', err)
      alert(`Failed to download file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleView = (record: AppointmentDocument) => {
    setSelectedRecord(record)
  }

  if (loading) {
    return (
      <div className="bg-slate-700/50 rounded-lg border border-white/10 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-700/50 rounded-lg border border-red-500/30 p-4">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-700/50 rounded-lg border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-cyan-600 text-white text-xs font-medium px-2 py-1 rounded-full">
          {records.length} file{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No documents found for this appointment</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {records.map((record) => (
            <div key={record.id} className="border border-white/10 rounded-lg p-3 bg-slate-600/30 hover:bg-slate-600/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="font-medium text-white text-sm">{record.file_name || record.document_name || 'Unknown'}</h4>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                      {record.document_type}
                    </span>
                  </div>
                  
                  {record.description && (
                    <p className="text-sm text-gray-300 mb-2">{record.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="capitalize">{record.uploaded_by_type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(record.created_at)}
                    </div>
                    {record.file_size && <span>{formatFileSize(record.file_size)}</span>}
                    <span className="capitalize">
                      {record.file_type 
                        ? record.file_type.includes('/') 
                          ? record.file_type.split('/')[1] 
                          : record.file_type
                        : record.mime_type 
                          ? record.mime_type.includes('/') 
                            ? record.mime_type.split('/')[1] 
                            : record.mime_type
                          : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleView(record)}
                    className="p-2 text-cyan-400 hover:bg-cyan-600/20 rounded-md transition-colors"
                    title="View file"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(record)}
                    className="p-2 text-green-400 hover:bg-green-600/20 rounded-md transition-colors"
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Viewer Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{selectedRecord.file_name || selectedRecord.document_name || 'Unknown'}</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] bg-slate-900">
              {(selectedRecord.file_type?.startsWith('image/') || selectedRecord.mime_type?.startsWith('image/')) ? (
                selectedRecord.file_url && selectedRecord.file_url.startsWith('http') ? (
                <img 
                  src={selectedRecord.file_url} 
                    alt={selectedRecord.file_name || selectedRecord.document_name || 'Document'}
                  className="max-w-full h-auto rounded-lg"
                  onError={(e) => {
                    console.error('❌ Image failed to load:', selectedRecord.file_url)
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = `
                        <div class="text-center py-8">
                          <p class="text-red-400 mb-4">Failed to load image. The file may not exist or is not accessible.</p>
                          <p class="text-xs text-gray-400 mb-4">${selectedRecord.file_url}</p>
                        </div>
                      `
                    }
                  }}
                />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-4">Image URL is not available. The file may not exist or is not accessible.</p>
                    <p className="text-xs text-gray-400 mb-4">Path: {selectedRecord.file_url || 'N/A'}</p>
                  </div>
                )
              ) : (selectedRecord.file_type === 'application/pdf' || selectedRecord.mime_type === 'application/pdf') ? (
                <iframe
                  src={selectedRecord.file_url}
                  className="w-full h-96 border-0 rounded-lg"
                  title={selectedRecord.file_name || selectedRecord.document_name || 'Document'}
                  onError={() => {
                    console.error('❌ PDF failed to load:', selectedRecord.file_url)
                  }}
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-300 mb-4">Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownload(selectedRecord)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
