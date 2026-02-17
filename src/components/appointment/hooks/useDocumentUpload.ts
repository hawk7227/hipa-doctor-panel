// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface AppointmentDocument {
  id: string
  document_name: string
  document_type?: string
  file_url: string
  file_size?: number
  mime_type?: string
  uploaded_by_type?: 'user' | 'doctor'
  created_at: string
}

export function useDocumentUpload(appointmentId: string | null) {
  const [appointmentDocuments, setAppointmentDocuments] = useState<AppointmentDocument[]>([])
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<AppointmentDocument | null>(null)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Fetch appointment documents
  const fetchAppointmentDocuments = useCallback(async () => {
    if (!appointmentId) return
    
    setLoadingDocuments(true)
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      
      if (error) throw error

      if (!data || data.length === 0) {
        setAppointmentDocuments([])
        setLoadingDocuments(false)
        return
      }

      // Convert file paths to signed URLs for private buckets
      const documentsWithSignedUrls = await Promise.all(
        data.map(async (doc) => {
          // If file_url is already a full URL (legacy), check if it needs conversion
          if (doc.file_url && (doc.file_url.startsWith('http://') || doc.file_url.startsWith('https://'))) {
            // If it's a Supabase URL but might be broken, try to extract the path
            const urlMatch = doc.file_url.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
            if (urlMatch) {
              const filePath = decodeURIComponent(urlMatch[1])
              const { data: urlData, error: urlError } = await supabase.storage
                .from('appointment-documents')
                .createSignedUrl(filePath, 3600)
              
              if (urlError) {
                console.error('Error creating signed URL from legacy URL:', urlError)
                return { ...doc, document_name: doc.file_name || doc.document_name || 'Unknown' }
              }
              
              if (urlData?.signedUrl) {
                return { ...doc, file_url: urlData.signedUrl, document_name: doc.file_name || doc.document_name || 'Unknown' }
              }
            }
            return { ...doc, document_name: doc.file_name || doc.document_name || 'Unknown' }
          }
          
          // If file_url is a storage path (new format), create signed URL
          // Keep the full path as stored - Supabase will handle bucket name correctly
          if (doc.file_url && !doc.file_url.startsWith('http')) {
            let storagePath = doc.file_url
            // Use the path as-is - if it includes bucket name, keep it
            // Supabase createSignedUrl will handle the path correctly
            
            // Ensure we have a valid path (not empty)
            if (!storagePath || storagePath.trim() === '') {
              console.warn('Empty storage path for document:', doc)
              return { ...doc, document_name: doc.file_name || doc.document_name || 'Unknown', file_url: '' }
            }
            
            const { data: urlData, error: urlError } = await supabase.storage
              .from('appointment-documents')
              .createSignedUrl(storagePath, 3600)
            
            if (urlError) {
              // Only log non-"Object not found" errors as errors (missing files are expected)
              if (urlError.message && !urlError.message.includes('Object not found') && !urlError.message.includes('not found')) {
                console.error('Error creating signed URL:', {
                  error: urlError,
                  path: storagePath,
                  originalPath: doc.file_url
                })
              }
              // Try public URL as fallback before returning empty
              const { data: publicUrlData } = supabase.storage
                .from('appointment-documents')
                .getPublicUrl(storagePath)
              if (publicUrlData?.publicUrl) {
                return { ...doc, file_url: publicUrlData.publicUrl, document_name: doc.file_name || doc.document_name || 'Unknown' }
              }
              // Return document with empty URL so it can still be displayed (with download option)
              return { ...doc, document_name: doc.file_name || doc.document_name || 'Unknown', file_url: '' }
            }
            
            // Check if we got a signed URL
            if (urlData?.signedUrl) {
              const signedUrl = urlData.signedUrl
              
              // Log for debugging
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Signed URL generated:', {
                  hasToken: signedUrl.includes('token='),
                  urlLength: signedUrl.length,
                  path: storagePath,
                  urlPreview: signedUrl.substring(0, 150),
                  originalPath: doc.file_url
                })
              }
              
              // Return the signed URL as-is (it should already have the token from Supabase)
              return { ...doc, file_url: signedUrl, document_name: doc.file_name || doc.document_name || 'Unknown' }
            }
          }
          
          return { ...doc, document_name: doc.file_name || doc.document_name || 'Unknown' }
        })
      )

      setAppointmentDocuments(documentsWithSignedUrls)
    } catch (err: any) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoadingDocuments(false)
    }
  }, [appointmentId])

  // Upload document
  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !appointmentId) return
    
    setUploadingDocument(true)
    setUploadError(null)
    
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) throw new Error('User not found')

      // Get doctor ID
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', currentUser.email)
        .single()
      
      if (!doctorData) {
        throw new Error('Doctor not found')
      }
      
      // Get patient ID from appointment
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single()

      if (!appointmentData?.patient_id) {
        throw new Error('Patient ID not found')
      }
      
      // Upload to Supabase Storage
      const bucketName = 'appointment-documents'
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      // Store path: {appointmentId}/{fileName} (bucket name is specified in .from())
      // This matches the pattern used in other components (AppointmentChat, MedicalRecordsUpload)
      const filePath = `${appointmentId}/${fileName}`
      
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
      
      console.log('Uploading file to storage:', { bucketName, filePath, fileName, fileSize: file.size, fileType: file.type })
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) {
        console.error('Storage upload error:', {
          message: uploadError.message,
          error: uploadError
        })
        throw new Error(`Failed to upload file to storage: ${uploadError.message || 'Unknown storage error'}`)
      }

      console.log('File uploaded successfully to storage:', uploadData)
      
      // Save to database (using normalized files table)
      // Only insert columns that exist: patient_id, appointment_id, file_name, file_url, file_type
      // (id and created_at are auto-generated)
      const insertData = {
        patient_id: appointmentData.patient_id,
        appointment_id: appointmentId,
        file_name: file.name,
        file_url: filePath, // Store the path: {appointmentId}/{fileName}
        file_type: file.type || 'application/octet-stream'
      }

      console.log('Inserting document to database:', JSON.stringify(insertData, null, 2))
      
      const { error: dbError, data: insertedData } = await supabase
        .from('files')
        .insert(insertData)
        .select()
      
      if (dbError) {
        const errorInfo = {
          message: dbError?.message || 'No message',
          details: dbError?.details || 'No details',
          hint: dbError?.hint || 'No hint',
          code: dbError?.code || 'No code',
          error: dbError
        }
        console.error('Database insert error details:', errorInfo)
        console.error('Full error object:', dbError)
        const errorMessage = dbError.message || dbError.details || dbError.hint || 'Unknown database error'
        throw new Error(`Failed to save document: ${errorMessage}`)
      }

      if (!insertedData || insertedData.length === 0) {
        throw new Error('Document saved but no data returned')
      }
      
      console.log('Successfully saved document:', insertedData)
      
      // Refresh documents list
      await fetchAppointmentDocuments()
      
      // Clear file input
      if (event.target) {
        event.target.value = ''
      }
      
      setUploadError(null)
    } catch (err: any) {
      console.error('Error uploading document:', {
        message: err?.message || 'Unknown error',
        error: err,
        stack: err?.stack,
        name: err?.name,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      })
      
      // Set error state for UI display
      const errorMessage = err?.message || err?.details || err?.hint || 'Failed to upload document. Please check your connection and try again.'
      setUploadError(errorMessage)
      
      // Re-throw with a more descriptive error message
      throw new Error(errorMessage)
    } finally {
      setUploadingDocument(false)
    }
  }, [appointmentId, fetchAppointmentDocuments])

  // Load documents when appointment changes
  useEffect(() => {
    if (appointmentId) {
      fetchAppointmentDocuments()
    } else {
      setAppointmentDocuments([])
    }
  }, [appointmentId, fetchAppointmentDocuments])

  return {
    appointmentDocuments,
    uploadingDocument,
    selectedDocument,
    loadingDocuments,
    uploadError,
    setSelectedDocument,
    handleDocumentUpload,
    fetchAppointmentDocuments
  }
}

