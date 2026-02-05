'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Video, Camera, Upload, Trash2, Play, Pause, Square, 
  Mic, MicOff, Loader2, CheckCircle, AlertCircle,
  ArrowRight, Circle, Type, Pencil, MousePointer
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import AnnotationEditor from './AnnotationEditor'

interface Attachment {
  id: string
  type: 'video' | 'screenshot' | 'file'
  blob?: Blob
  url?: string
  name: string
  size: number
  mime_type: string
  duration_seconds?: number
  preview_url?: string
  annotations?: any[]
}

interface BugReportFormProps {
  onSubmitSuccess: () => void
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'processing'

const GITHUB_REPO_BASE = 'https://github.com/hawk7227/hipa-doctor-panel/blob/master'

function urlToGithubPath(pathname: string): { filePath: string; fileUrl: string } {
  // Remove query params and hash
  const cleanPath = pathname.split('?')[0].split('#')[0]
  
  // Handle dynamic routes - keep [id] format for display
  const filePath = `src/app${cleanPath}/page.tsx`
  const fileUrl = `${GITHUB_REPO_BASE}/${filePath}`
  
  return { filePath, fileUrl }
}

export default function BugReportForm({ onSubmitSuccess }: BugReportFormProps) {
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false)
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'record' | 'screenshot' | 'upload'>('record')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start screen recording
  const startRecording = async () => {
    try {
      setRecordingState('requesting')
      
      // Request screen capture with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true, // System audio if available
      })

      let combinedStream = displayStream

      // Add microphone audio if enabled
      if (isAudioEnabled) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          })

          // Combine video from screen with audio from microphone
          const audioTrack = audioStream.getAudioTracks()[0]
          if (audioTrack) {
            combinedStream = new MediaStream([
              ...displayStream.getVideoTracks(),
              audioTrack,
            ])
          }
        } catch (audioError) {
          console.warn('Could not capture microphone audio:', audioError)
          // Continue with just screen recording
        }
      }

      streamRef.current = combinedStream

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const previewUrl = URL.createObjectURL(blob)
        
        const newAttachment: Attachment = {
          id: `video-${Date.now()}`,
          type: 'video',
          blob,
          name: `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`,
          size: blob.size,
          mime_type: mimeType,
          duration_seconds: recordingTime,
          preview_url: previewUrl,
        }

        setAttachments(prev => [...prev, newAttachment])
        setRecordingState('idle')
        setRecordingTime(0)

        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      // Handle user stopping screen share via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Capture in 1-second chunks

      // Start timer
      setRecordingState('recording')
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error: any) {
      console.error('Failed to start recording:', error)
      setRecordingState('idle')
      
      if (error.name === 'NotAllowedError') {
        setSubmitError('Screen recording permission was denied. Please allow access and try again.')
      } else {
        setSubmitError('Failed to start screen recording. Please try again.')
      }
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setRecordingState('processing')
      mediaRecorderRef.current.stop()
    }
  }

  // Take screenshot
  const takeScreenshot = async () => {
    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
      })

      const video = document.createElement('video')
      video.srcObject = stream

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
          resolve()
        }
      })

      // Wait a moment for the video to render
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture frame to canvas
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)

      // Stop the stream
      stream.getTracks().forEach(track => track.stop())

      // Get data URL for annotation editor
      const dataUrl = canvas.toDataURL('image/png')
      setScreenshotDataUrl(dataUrl)
      setShowAnnotationEditor(true)

    } catch (error: any) {
      console.error('Failed to take screenshot:', error)
      if (error.name === 'NotAllowedError') {
        setSubmitError('Screenshot permission was denied. Please allow access and try again.')
      } else {
        setSubmitError('Failed to take screenshot. Please try again.')
      }
    }
  }

  // Handle annotated screenshot save
  const handleAnnotationSave = (annotatedDataUrl: string, annotations: any[]) => {
    // Convert data URL to blob
    const byteString = atob(annotatedDataUrl.split(',')[1])
    const mimeString = annotatedDataUrl.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: mimeString })

    const newAttachment: Attachment = {
      id: `screenshot-${Date.now()}`,
      type: 'screenshot',
      blob,
      name: `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`,
      size: blob.size,
      mime_type: 'image/png',
      preview_url: annotatedDataUrl,
      annotations,
    }

    setAttachments(prev => [...prev, newAttachment])
    setShowAnnotationEditor(false)
    setScreenshotDataUrl(null)
  }

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const newAttachment: Attachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'file',
        blob: file,
        name: file.name,
        size: file.size,
        mime_type: file.type,
        preview_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }

      setAttachments(prev => [...prev, newAttachment])
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id)
      if (attachment?.preview_url) {
        URL.revokeObjectURL(attachment.preview_url)
      }
      return prev.filter(a => a.id !== id)
    })
  }

  // Submit bug report
  const handleSubmit = async () => {
    if (!description.trim() && attachments.length === 0) {
      setSubmitError('Please provide a description or attach a recording/screenshot.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Get current user/doctor
      const user = await getCurrentUser()
      if (!user?.doctor) {
        throw new Error('You must be logged in as a doctor to submit bug reports.')
      }

      // Get current page info
      const pageUrl = window.location.pathname
      const { filePath, fileUrl } = urlToGithubPath(pageUrl)
      const browserInfo = `${navigator.userAgent}`

      // Upload attachments to Supabase Storage
      const uploadedAttachments = []

      for (const attachment of attachments) {
        if (attachment.blob) {
          const fileName = `${user.doctor.id}/${Date.now()}-${attachment.name}`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('bug-reports')
            .upload(fileName, attachment.blob, {
              contentType: attachment.mime_type,
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            throw new Error(`Failed to upload ${attachment.name}: ${uploadError.message}`)
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('bug-reports')
            .getPublicUrl(fileName)

          uploadedAttachments.push({
            id: attachment.id,
            type: attachment.type,
            url: urlData.publicUrl,
            name: attachment.name,
            size: attachment.size,
            mime_type: attachment.mime_type,
            duration_seconds: attachment.duration_seconds,
            annotations: attachment.annotations,
            created_at: new Date().toISOString(),
          })
        }
      }

      // Create bug report via API (handles email notification + AI processing)
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctor_id: user.doctor.id,
          description: description.trim(),
          page_url: pageUrl,
          github_file_path: filePath,
          github_file_url: fileUrl,
          browser_info: browserInfo,
          attachments: uploadedAttachments,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit bug report')
      }

      setSubmitSuccess(true)
      
      // Reset form after short delay
      setTimeout(() => {
        setDescription('')
        setAttachments([])
        setSubmitSuccess(false)
        onSubmitSuccess()
      }, 2000)

    } catch (error: any) {
      console.error('Submit error:', error)
      setSubmitError(error.message || 'Failed to submit bug report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render annotation editor if active
  if (showAnnotationEditor && screenshotDataUrl) {
    return (
      <AnnotationEditor
        imageDataUrl={screenshotDataUrl}
        onSave={handleAnnotationSave}
        onCancel={() => {
          setShowAnnotationEditor(false)
          setScreenshotDataUrl(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      {/* Success Message */}
      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-900/30 border border-green-600 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-300 font-medium">Bug report submitted!</p>
            <p className="text-green-400/70 text-sm">Thank you for your feedback.</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {submitError && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Error</p>
            <p className="text-red-400/70 text-sm">{submitError}</p>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          What went wrong?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the bug you encountered..."
          className="w-full h-24 px-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
        />
      </div>

      {/* Capture Options */}
      <div className="mb-4">
        <div className="flex gap-1 mb-3 bg-[#0a1f1f] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'record'
                ? 'bg-[#164e4e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4 inline mr-1.5" />
            Record
          </button>
          <button
            onClick={() => setActiveTab('screenshot')}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'screenshot'
                ? 'bg-[#164e4e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4 inline mr-1.5" />
            Screenshot
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'upload'
                ? 'bg-[#164e4e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-1.5" />
            Upload
          </button>
        </div>

        {/* Record Tab */}
        {activeTab === 'record' && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
            {recordingState === 'idle' ? (
              <>
                <p className="text-sm text-gray-400 mb-3">
                  Record your screen and voice to show the bug in action.
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isAudioEnabled
                        ? 'bg-teal-600/20 text-teal-400 border border-teal-600'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                    }`}
                  >
                    {isAudioEnabled ? (
                      <Mic className="w-4 h-4" />
                    ) : (
                      <MicOff className="w-4 h-4" />
                    )}
                    Microphone {isAudioEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <button
                  onClick={startRecording}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Video className="w-5 h-5" />
                  Start Recording
                </button>
              </>
            ) : recordingState === 'requesting' ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin mr-2" />
                <span className="text-gray-300">Requesting permission...</span>
              </div>
            ) : recordingState === 'recording' ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-2xl font-mono text-white">{formatTime(recordingTime)}</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">Recording in progress...</p>
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 mx-auto transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop Recording
                </button>
              </div>
            ) : recordingState === 'processing' ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin mr-2" />
                <span className="text-gray-300">Processing recording...</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Screenshot Tab */}
        {activeTab === 'screenshot' && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">
              Take a screenshot and annotate it with arrows, circles, and text.
            </p>
            <button
              onClick={takeScreenshot}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Take Screenshot + Annotate
            </button>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">
              Upload existing screenshots, videos, or other files.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-[#1a3d3d] hover:bg-[#245454] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-[#2a5454]"
            >
              <Upload className="w-5 h-5" />
              Choose Files
            </button>
          </div>
        )}
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Attachments ({attachments.length})
          </label>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg"
              >
                {/* Preview */}
                {attachment.preview_url && attachment.type === 'screenshot' && (
                  <img
                    src={attachment.preview_url}
                    alt="Preview"
                    className="w-16 h-12 object-cover rounded"
                  />
                )}
                {attachment.preview_url && attachment.type === 'video' && (
                  <video
                    src={attachment.preview_url}
                    className="w-16 h-12 object-cover rounded"
                  />
                )}
                {!attachment.preview_url && (
                  <div className="w-16 h-12 bg-[#1a3d3d] rounded flex items-center justify-center">
                    {attachment.type === 'video' ? (
                      <Video className="w-6 h-6 text-gray-500" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{attachment.name}</p>
                  <p className="text-xs text-gray-500">
                    {(attachment.size / 1024 / 1024).toFixed(2)} MB
                    {attachment.duration_seconds && ` • ${formatTime(attachment.duration_seconds)}`}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="p-2 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || recordingState !== 'idle'}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Submit Bug Report
            </>
          )}
        </button>
      </div>
    </div>
  )
}
