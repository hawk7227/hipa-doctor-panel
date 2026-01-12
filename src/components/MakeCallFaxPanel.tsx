'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Phone, 
  Printer,
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  File
} from 'lucide-react'

type CommunicationMode = 'call' | 'fax'
type FaxStatus = 'idle' | 'uploading' | 'pending' | 'sending' | 'success' | 'failed'
type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed'

interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
}

interface CommunicationHistoryEntry {
  id?: string
  type: 'call' | 'fax'
  direction: 'outbound'
  to_number: string
  status: string
  provider_id?: string | null
  patient_id?: string | null
  document_name?: string
  document_url?: string
  error_code?: string
  error_message?: string
  initiated_at: string
  completed_at?: string
}

interface MakeCallFaxPanelProps {
  // Phone number (can be pre-filled from patient/pharmacy)
  phoneNumber?: string
  // Fax number (can be different from phone)
  faxNumber?: string
  // Provider ID for logging
  providerId?: string | null
  // Patient ID for logging
  patientId?: string | null
  // Appointment ID for context
  appointmentId?: string | null
  // Callback when phone number changes
  onPhoneNumberChange?: (number: string) => void
  // Callback to log communication history
  onLogCommunication?: (entry: CommunicationHistoryEntry) => Promise<void>
  // External call handler (Twilio integration)
  onMakeCall?: (phoneNumber: string) => Promise<void>
  // External call end handler
  onEndCall?: () => void
  // External mute toggle
  onToggleMute?: () => void
  // Is call currently in progress (from parent state)
  isCallInProgress?: boolean
  // Is muted (from parent state)
  isMuted?: boolean
  // Call duration in seconds (from parent)
  callDuration?: number
  // Twilio device ready state
  isDeviceReady?: boolean
  // External error message
  externalError?: string
  // Custom className
  className?: string
}

// Format duration as MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Validate file type for fax
const ALLOWED_FAX_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export default function MakeCallFaxPanel({
  phoneNumber: initialPhoneNumber = '',
  faxNumber: initialFaxNumber,
  providerId,
  patientId,
  appointmentId,
  onPhoneNumberChange,
  onLogCommunication,
  onMakeCall,
  onEndCall,
  onToggleMute,
  isCallInProgress = false,
  isMuted = false,
  callDuration = 0,
  isDeviceReady = true,
  externalError,
  className = ''
}: MakeCallFaxPanelProps) {
  // Mode state
  const [mode, setMode] = useState<CommunicationMode>('call')
  
  // Call state
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callError, setCallError] = useState<string | null>(null)
  const [isCallLoading, setIsCallLoading] = useState(false)
  
  // Fax state
  const [faxPhoneNumber, setFaxPhoneNumber] = useState(initialFaxNumber || initialPhoneNumber)
  const [faxStatus, setFaxStatus] = useState<FaxStatus>('idle')
  const [faxError, setFaxError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [faxResult, setFaxResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper function to format phone number with +1 prefix
  const formatPhoneWithUSPrefix = (phone: string): string => {
    if (!phone) return '+1'
    
    let cleaned = phone.replace(/[^\d+]/g, '')
    
    // If it starts with +1, keep it
    if (cleaned.startsWith('+1')) {
      cleaned = '+1' + cleaned.slice(2).replace(/\D/g, '')
    } else if (cleaned.startsWith('1')) {
      // If it starts with 1, add + prefix
      cleaned = '+1' + cleaned.slice(1).replace(/\D/g, '')
    } else {
      // Otherwise, add +1 prefix
      cleaned = '+1' + cleaned.replace(/\D/g, '')
    }
    
    // Limit to 10 digits after +1
    const digits = cleaned.slice(2)
    if (digits.length > 10) {
      cleaned = '+1' + digits.slice(0, 10)
    }
    
    return cleaned
  }

  // Sync phone number from props - ensure +1 prefix for USA
  useEffect(() => {
    if (initialPhoneNumber) {
      const formatted = formatPhoneWithUSPrefix(initialPhoneNumber)
      setPhoneNumber(formatted)
      if (!initialFaxNumber) {
        setFaxPhoneNumber(formatted)
      }
    } else {
      setPhoneNumber('+1')
    }
  }, [initialPhoneNumber, initialFaxNumber])

  // Sync fax number from props - ensure +1 prefix for USA
  useEffect(() => {
    if (initialFaxNumber) {
      const formatted = formatPhoneWithUSPrefix(initialFaxNumber)
      setFaxPhoneNumber(formatted)
    } else if (initialPhoneNumber) {
      const formatted = formatPhoneWithUSPrefix(initialPhoneNumber)
      setFaxPhoneNumber(formatted)
    } else {
      setFaxPhoneNumber('+1')
    }
  }, [initialFaxNumber, initialPhoneNumber])

  // Handle phone number change - ensure +1 prefix for USA
  const handlePhoneChange = (value: string) => {
    // Remove any existing +1 prefix and non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '')
    
    // If it starts with +1, keep it
    if (cleaned.startsWith('+1')) {
      cleaned = '+1' + cleaned.slice(2).replace(/\D/g, '')
    } else if (cleaned.startsWith('1')) {
      // If it starts with 1, add + prefix
      cleaned = '+1' + cleaned.slice(1).replace(/\D/g, '')
    } else {
      // Otherwise, add +1 prefix
      cleaned = '+1' + cleaned.replace(/\D/g, '')
    }
    
    // Limit to 10 digits after +1 (US phone numbers)
    const digits = cleaned.slice(2)
    if (digits.length > 10) {
      cleaned = '+1' + digits.slice(0, 10)
    }
    
    setPhoneNumber(cleaned)
    onPhoneNumberChange?.(cleaned)
    setCallError(null)
  }

  // Handle fax number change - ensure +1 prefix for USA
  const handleFaxNumberChange = (value: string) => {
    // Remove any existing +1 prefix and non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '')
    
    // If it starts with +1, keep it
    if (cleaned.startsWith('+1')) {
      cleaned = '+1' + cleaned.slice(2).replace(/\D/g, '')
    } else if (cleaned.startsWith('1')) {
      // If it starts with 1, add + prefix
      cleaned = '+1' + cleaned.slice(1).replace(/\D/g, '')
    } else {
      // Otherwise, add +1 prefix
      cleaned = '+1' + cleaned.replace(/\D/g, '')
    }
    
    // Limit to 10 digits after +1 (US phone numbers)
    const digits = cleaned.slice(2)
    if (digits.length > 10) {
      cleaned = '+1' + digits.slice(0, 10)
    }
    
    setFaxPhoneNumber(cleaned)
    setFaxError(null)
  }

  // Handle Make Call
  const handleMakeCall = async () => {
    if (!phoneNumber.trim() || isCallLoading) return
    
    setIsCallLoading(true)
    setCallError(null)
    setCallStatus('connecting')
    
    // Log to communication history
    const entry: CommunicationHistoryEntry = {
      type: 'call',
      direction: 'outbound',
      to_number: phoneNumber,
      status: 'initiated',
      provider_id: providerId,
      patient_id: patientId,
      initiated_at: new Date().toISOString()
    }
    
    try {
      await onLogCommunication?.(entry)
      await onMakeCall?.(phoneNumber)
      setCallStatus('connected')
    } catch (err: any) {
      setCallError(err.message || 'Failed to connect call')
      setCallStatus('failed')
      
      // Log failure
      await onLogCommunication?.({
        ...entry,
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString()
      })
    } finally {
      setIsCallLoading(false)
    }
  }

  // Handle End Call
  const handleEndCall = async () => {
    onEndCall?.()
    setCallStatus('ended')
    
    // Log call end
    await onLogCommunication?.({
      type: 'call',
      direction: 'outbound',
      to_number: phoneNumber,
      status: 'completed',
      provider_id: providerId,
      patient_id: patientId,
      initiated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      setFaxError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
      return
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFaxError(`File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`)
      return
    }
    
    setFaxError(null)
    setUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type
    })
    
    // Simulate upload (in production, this would upload to secure storage)
    simulateUpload(file)
  }

  // Simulate file upload
  const simulateUpload = async (file: File) => {
    setFaxStatus('uploading')
    setUploadProgress(0)
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setUploadProgress(i)
    }
    
    // In production: POST to /api/communications/fax/upload
    setUploadedFile(prev => prev ? {
      ...prev,
      url: `https://secure-uploads.medazonhealth.com/fax/${file.name}`
    } : null)
    
    setFaxStatus('idle')
  }

  // Handle Send Fax
  const handleSendFax = async () => {
    if (!faxPhoneNumber.trim() || !uploadedFile?.url) return
    
    setFaxStatus('sending')
    setFaxError(null)
    setFaxResult(null)
    
    // Log to communication history
    const entry: CommunicationHistoryEntry = {
      type: 'fax',
      direction: 'outbound',
      to_number: faxPhoneNumber,
      status: 'pending',
      provider_id: providerId,
      patient_id: patientId,
      document_name: uploadedFile.name,
      document_url: uploadedFile.url,
      initiated_at: new Date().toISOString()
    }
    
    try {
      await onLogCommunication?.(entry)
      
      // Simulate fax sending (in production: POST to /api/communications/fax)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate success (90% success rate for demo)
      const success = Math.random() > 0.1
      
      if (success) {
        setFaxStatus('success')
        setFaxResult({
          success: true,
          message: `Document successfully faxed to ${faxPhoneNumber}`
        })
        
        await onLogCommunication?.({
          ...entry,
          status: 'success',
          completed_at: new Date().toISOString()
        })
      } else {
        throw new Error('Fax transmission failed. Please try again.')
      }
    } catch (err: any) {
      setFaxStatus('failed')
      setFaxError(err.message || 'Failed to send fax')
      setFaxResult({
        success: false,
        message: err.message || 'Fax failed'
      })
      
      await onLogCommunication?.({
        ...entry,
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString()
      })
    }
  }

  // Clear uploaded file
  const handleClearFile = () => {
    setUploadedFile(null)
    setFaxStatus('idle')
    setFaxResult(null)
    setFaxError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Determine current error to display
  const currentError = mode === 'call' 
    ? (externalError || callError) 
    : faxError

  return (
    <div className={`bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10 ${className}`}>
      {/* Header */}
      <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
        Make Call
      </h3>

      {/* Phone Number Input */}
      <div className="mb-4">
        <label className="block text-xs sm:text-sm text-gray-400 mb-2">Phone Number</label>
        <input
          type="tel"
          value={mode === 'call' ? phoneNumber : faxPhoneNumber}
          onChange={(e) => mode === 'call' 
            ? handlePhoneChange(e.target.value)
            : handleFaxNumberChange(e.target.value)
          }
          placeholder="+1 (602) 549-8598"
          disabled={isCallInProgress || faxStatus === 'sending'}
          className="w-full h-10 px-4 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-base"
        />
      </div>

      {/* Error Display (Call mode only when Twilio error) */}
      {mode === 'call' && currentError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400 text-xs leading-relaxed">
              {currentError}
            </p>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-700/50 rounded-lg">
        <button
          onClick={() => setMode('call')}
          disabled={isCallInProgress || faxStatus === 'sending'}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'call'
              ? 'bg-slate-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-slate-600/50'
          } disabled:opacity-50`}
        >
          <div className={`w-3 h-3 rounded-full border-2 ${
            mode === 'call' ? 'border-white bg-white' : 'border-gray-400'
          }`} />
          Call
        </button>
        <button
          onClick={() => setMode('fax')}
          disabled={isCallInProgress}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'fax'
              ? 'bg-teal-600/30 text-teal-400 border border-teal-500/50'
              : 'text-gray-400 hover:text-white hover:bg-slate-600/50'
          } disabled:opacity-50`}
        >
          <Printer className="h-4 w-4" />
          Fax
          {mode === 'fax' && <CheckCircle className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Fax Mode Content */}
      {mode === 'fax' && (
        <div className="space-y-4 mb-4">
          {/* File Upload */}
          {!uploadedFile ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={faxStatus === 'sending'}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Upload Document to Fax</span>
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Accepted: PDF, DOC, DOCX, JPG, PNG (Max 20MB)
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-700/50 rounded-lg border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <FileText className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[200px]">
                      {uploadedFile.name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                </div>
                {faxStatus !== 'sending' && (
                  <button
                    onClick={handleClearFile}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Upload Progress */}
              {faxStatus === 'uploading' && (
                <div className="mt-3">
                  <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Uploading... {uploadProgress}%</p>
                </div>
              )}
            </div>
          )}

          {/* Fax Status */}
          {faxResult && (
            <div className={`p-3 rounded-lg border ${
              faxResult.success 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {faxResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <div>
                  <p className={`font-medium text-sm ${
                    faxResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {faxResult.success ? 'Faxed:' : 'Fax Failed:'}
                  </p>
                  <p className={`text-xs ${
                    faxResult.success ? 'text-green-300/80' : 'text-red-300/80'
                  }`}>
                    {faxResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fax Error */}
          {faxError && !faxResult && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-xs">{faxError}</p>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {mode === 'call' ? (
        // Call Mode Buttons
        <div className="space-y-3">
          {isCallInProgress ? (
            <div className="space-y-3">
              {/* Call Duration */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Connected</span>
                <span className="text-teal-400 font-mono font-semibold">
                  {formatDuration(callDuration)}
                </span>
              </div>
              
              {/* Call Controls */}
              <div className="flex gap-2">
                <button
                  onClick={onToggleMute}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    isMuted 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'bg-slate-600 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Mute
                    </>
                  )}
                </button>
                <button
                  onClick={handleEndCall}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Call
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleMakeCall}
              disabled={!phoneNumber.trim() || !isDeviceReady || isCallLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
            >
              {isCallLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4" />
                  Make Call
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        // Fax Mode Button
        <button
          onClick={handleSendFax}
          disabled={!faxPhoneNumber.trim() || !uploadedFile?.url || faxStatus === 'sending' || faxStatus === 'uploading'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
        >
          {faxStatus === 'sending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending Fax...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" />
              Send Fax
            </>
          )}
        </button>
      )}
    </div>
  )
}

export type { 
  CommunicationMode, 
  FaxStatus, 
  CallStatus, 
  UploadedFile, 
  CommunicationHistoryEntry,
  MakeCallFaxPanelProps 
}
