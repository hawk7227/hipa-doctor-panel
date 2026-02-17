// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import React from 'react'
import { X, FileText, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DocumentViewerProps {
  document: any
  onClose: () => void
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const handleDownload = async () => {
    try {
      let downloadUrl = document.file_url
      
      if (!downloadUrl.startsWith('http') || downloadUrl.includes('/storage/v1/object/public/')) {
        let filePath = downloadUrl
        
        if (downloadUrl.includes('/storage/v1/object/public/appointment-documents/')) {
          const match = downloadUrl.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
          filePath = match ? decodeURIComponent(match[1]) : downloadUrl
        } else if (downloadUrl.startsWith('appointment-documents/')) {
          // Remove bucket name prefix if present
          filePath = downloadUrl.replace('appointment-documents/', '')
        }
        
        const { data: urlData, error: urlError } = await supabase.storage
          .from('appointment-documents')
          .createSignedUrl(filePath, 3600)
        
        if (urlError) {
          console.error('Error creating signed URL for download:', urlError)
          throw new Error('Failed to generate download URL')
        }
        
        if (urlData?.signedUrl) {
          downloadUrl = urlData.signedUrl
        } else {
          throw new Error('Failed to generate download URL')
        }
      }
      
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = document.document_name || document.file_name || 'document'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Download error:', err)
      alert(`Failed to download file: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl max-h-[95vh] sm:max-h-[90vh] w-full overflow-hidden border border-white/10 flex flex-col">
        <div className="flex items-center justify-between p-2 sm:p-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate pr-2">
            {document.document_name || document.file_name || 'Document'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 sm:p-2 flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
          </button>
        </div>
        <div className="p-2 sm:p-4 overflow-auto flex-1 bg-slate-900">
          {document.mime_type?.startsWith('image/') ? (
            <img 
              src={document.file_url} 
              alt={document.document_name || document.file_name || 'Document'}
              className="max-w-full h-auto rounded-lg mx-auto"
              onError={(e) => {
                console.error('❌ Image failed to load:', document.file_url)
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div class="text-center py-8">
                      <p class="text-red-400 mb-4">Failed to load image. The file may not exist or is not accessible.</p>
                      <button 
                        onclick="window.location.reload()" 
                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mt-4"
                      >
                        Retry
                      </button>
                    </div>
                  `
                }
              }}
            />
          ) : document.mime_type === 'application/pdf' ? (
            <iframe
              src={document.file_url}
              className="w-full h-96 border-0 rounded-lg"
              title={document.document_name || document.file_name || 'Document'}
              onError={() => {
                console.error('❌ PDF failed to load:', document.file_url)
              }}
            />
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-300 mb-4">Preview not available for this file type</p>
              <button
                onClick={handleDownload}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4 inline mr-2" />
                Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

