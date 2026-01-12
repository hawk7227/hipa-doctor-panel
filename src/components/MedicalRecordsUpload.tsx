'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'

interface MedicalRecord {
  id: string
  title: string
  record_type: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
}

interface MedicalRecordsUploadProps {
  appointmentId: string
  userId: string
  onUploadSuccess?: () => void
}

export default function MedicalRecordsUpload({ 
  appointmentId, 
  userId, 
  onUploadSuccess 
}: MedicalRecordsUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<MedicalRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress(0)

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]

        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} is not a supported format. Please upload PDF, images, or text files.`)
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`)
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        // Store in appointment-documents bucket with medical-records folder structure
        const bucketName = 'appointment-documents'
        const filePath = `medical-records/${appointmentId}/${fileName}`

        // Check if bucket exists, create if it doesn't
        const { data: buckets, error: listError } = await supabase.storage.listBuckets()
        if (listError) {
          console.warn('Could not list buckets:', listError)
        } else {
          const bucketExists = buckets?.some(b => b.name === bucketName)
          if (!bucketExists) {
            console.log(`Creating storage bucket: ${bucketName}`)
            const { error: createError } = await supabase.storage.createBucket(bucketName, {
              public: false,
              fileSizeLimit: 52428800, // 50MB
              allowedMimeTypes: null
            })
            if (createError) {
              console.warn('Bucket creation error (may already exist):', createError)
            }
          }
        }

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        }

        // Store the file path (not signed URL) - we'll generate signed URLs when fetching
        // This ensures URLs are always fresh and don't expire

        // Save record to database
        const { data: record, error: dbError } = await supabase
          .from('medical_records')
          .insert({
            user_id: userId,
            appointment_id: appointmentId,
            record_type: 'other', // Default type, can be updated later
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            description: `Uploaded medical record for appointment`,
            file_url: filePath, // Store the path, not a signed URL
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            is_shared: true, // Automatically share with doctor for this appointment
          })
          .select()
          .single()

        if (dbError) {
          throw new Error(`Failed to save record: ${dbError.message}`)
        }

        return record
      })

      const results = await Promise.all(uploadPromises)
      setUploadedFiles(prev => [...prev, ...results])
      setSuccess(`Successfully uploaded ${results.length} file(s)`)
      setUploadProgress(100)
      
      if (onUploadSuccess) {
        onUploadSuccess()
      }

    } catch (err: any) {
      setError(err.message)
      setUploadProgress(0)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeFile = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('medical_records')
        .delete()
        .eq('id', recordId)

      if (error) {
        setError(`Failed to remove file: ${error.message}`)
        return
      }

      setUploadedFiles(prev => prev.filter(file => file.id !== recordId))
      setSuccess('File removed successfully')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Medical Records</h3>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="flex flex-col items-center gap-3">
          <Upload className="h-8 w-8 text-gray-400" />
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Click to upload medical records'}
            </button>
            <p className="text-sm text-gray-500 mt-1">
              PDF, images, or text files up to 10MB each
            </p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">Uploading... {uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Uploaded Files</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)} • {file.mime_type}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Uploaded medical records will be automatically shared with your doctor for this appointment. 
          This helps your doctor better understand your medical history and provide appropriate care.
        </p>
      </div>
    </div>
  )
}
