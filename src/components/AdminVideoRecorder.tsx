// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Video, Square, Mic, MicOff, Loader2, X, Check, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AdminVideoRecorderProps {
  reportId: string
  onSave: (videoUrl: string, videoName: string) => void
  onCancel: () => void
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'processing' | 'preview'

export default function AdminVideoRecorder({ reportId, onSave, onCancel }: AdminVideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording
  const startRecording = async () => {
    try {
      setRecordingState('requesting')
      setError(null)

      // Request screen + audio capture
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
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

          const audioTrack = audioStream.getAudioTracks()[0]
          if (audioTrack) {
            combinedStream = new MediaStream([
              ...displayStream.getVideoTracks(),
              audioTrack,
            ])
          }
        } catch (audioError) {
          console.warn('Could not capture microphone audio:', audioError)
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
        videoBitsPerSecond: 2500000,
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        setRecordedBlob(blob)
        setPreviewUrl(url)
        setRecordingState('preview')

        // Cleanup stream
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
      mediaRecorder.start(1000)

      setRecordingState('recording')
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error: any) {
      console.error('Failed to start recording:', error)
      setRecordingState('idle')
      
      if (error.name === 'NotAllowedError') {
        setError('Screen recording permission was denied.')
      } else {
        setError('Failed to start recording. Please try again.')
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

  // Re-record
  const handleReRecord = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setRecordedBlob(null)
    setPreviewUrl(null)
    setRecordingTime(0)
    setRecordingState('idle')
  }

  // Upload and save
  const handleSave = async () => {
    if (!recordedBlob) return

    setIsUploading(true)
    setError(null)

    try {
      const fileName = `admin-response-${reportId}-${Date.now()}.webm`
      const filePath = `admin-responses/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bug-reports')
        .upload(filePath, recordedBlob, {
          contentType: recordedBlob.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('bug-reports')
        .getPublicUrl(filePath)

      // Update bug report with response video
      const response = await fetch(`/api/bug-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_response_video_url: urlData.publicUrl,
          admin_response_video_name: fileName,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save response video')
      }

      onSave(urlData.publicUrl, fileName)

    } catch (error: any) {
      console.error('Error saving video:', error)
      setError(error.message || 'Failed to save video')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-medium flex items-center gap-2">
          <Video className="w-5 h-5 text-teal-400" />
          Record Response Video
        </h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-[#1a3d3d] rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Idle State */}
      {recordingState === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Record your screen to show the doctor how to fix the issue or explain what was done.
          </p>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                isAudioEnabled
                  ? 'bg-teal-600/20 text-teal-400 border border-teal-600'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
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
        </div>
      )}

      {/* Requesting State */}
      {recordingState === 'requesting' && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin mr-2" />
          <span className="text-gray-300">Requesting permission...</span>
        </div>
      )}

      {/* Recording State */}
      {recordingState === 'recording' && (
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
      )}

      {/* Processing State */}
      {recordingState === 'processing' && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin mr-2" />
          <span className="text-gray-300">Processing recording...</span>
        </div>
      )}

      {/* Preview State */}
      {recordingState === 'preview' && previewUrl && (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoPreviewRef}
              src={previewUrl}
              controls
              className="w-full max-h-64 object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Duration: {formatTime(recordingTime)}</span>
            <span>Size: {recordedBlob ? (recordedBlob.size / 1024 / 1024).toFixed(2) : 0} MB</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReRecord}
              disabled={isUploading}
              className="flex-1 py-2 bg-[#1a3d3d] hover:bg-[#245454] disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Re-record
            </button>
            <button
              onClick={handleSave}
              disabled={isUploading}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save & Send
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
