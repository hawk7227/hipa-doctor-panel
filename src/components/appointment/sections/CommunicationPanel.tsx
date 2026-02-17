// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import React, { memo, startTransition, useState, useEffect } from 'react'
import { GripVertical, MessageSquare, Phone, Send, Clock, PhoneCall, Video, Play, Pause, User, UserX } from 'lucide-react'
import VideoCallPanel from './VideoCallPanel'

interface CommunicationPanelProps {
  smsTo: string
  smsMessage: string
  isSendingSMS: boolean
  callPhoneNumber: string
  isCalling: boolean
  isCallLoading: boolean
  callStatus: string
  callDuration: number
  isMuted: boolean
  isDeviceReady: boolean
  communicationHistory: any[]
  loadingHistory: boolean
  playingRecordingId: string | null
  error?: string | null
  isCustomizeMode?: boolean
  sectionProps?: any
  sectionId?: string
  // Patient info (optional - panel works without patient)
  patientName?: string
  patientPhone?: string
  patientId?: string | null
  doctorName?: string
  onSmsToChange: (value: string) => void
  onSmsMessageChange: (value: string) => void
  onCallPhoneNumberChange: (value: string) => void
  onSendSMS: () => void
  onMakeCall: () => void
  onEndCall: () => void
  onToggleMute: () => void
  formatDuration: (seconds: number) => string
  formatHistoryDate: (dateString: string) => string
  onPlayRecording?: (id: string) => void
  audioRefs?: React.MutableRefObject<{ [key: string]: HTMLAudioElement | null }>
  // Optional callbacks for video call
  onSaveTranscript?: (transcript: string) => void
  onSaveSOAP?: (soap: { subjective: string; objective: string; assessment: string; plan: string }) => void
}

const CommunicationPanel = memo(function CommunicationPanel({
  smsTo,
  smsMessage,
  isSendingSMS,
  callPhoneNumber,
  isCalling,
  isCallLoading,
  callStatus,
  callDuration,
  isMuted,
  isDeviceReady,
  communicationHistory,
  loadingHistory,
  playingRecordingId,
  error,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = 'sms-section',
  patientName = '',
  patientPhone = '',
  patientId = null,
  doctorName = 'Dr. Smith',
  onSmsToChange,
  onSmsMessageChange,
  onCallPhoneNumberChange,
  onSendSMS,
  onMakeCall,
  onEndCall,
  onToggleMute,
  formatDuration,
  formatHistoryDate,
  onPlayRecording,
  audioRefs,
  onSaveTranscript,
  onSaveSOAP
}: CommunicationPanelProps) {
  // Video call active state
  const [isVideoCallActive, setIsVideoCallActive] = useState(false)
  
  // Track if using patient's number vs manual entry
  const [isUsingPatientPhone, setIsUsingPatientPhone] = useState(false)

  // Auto-sync patient phone when patient changes
  useEffect(() => {
    if (patientPhone) {
      // Only auto-fill if fields are empty or were using patient's number
      if (!smsTo || isUsingPatientPhone) {
        onSmsToChange(patientPhone)
        setIsUsingPatientPhone(true)
      }
      if (!callPhoneNumber || isUsingPatientPhone) {
        onCallPhoneNumberChange(patientPhone)
        setIsUsingPatientPhone(true)
      }
    }
  }, [patientPhone, patientId])

  // Helper to use patient's phone number
  const usePatientPhoneForSMS = () => {
    if (patientPhone) {
      onSmsToChange(patientPhone)
      setIsUsingPatientPhone(true)
    }
  }

  const usePatientPhoneForCall = () => {
    if (patientPhone) {
      onCallPhoneNumberChange(patientPhone)
      setIsUsingPatientPhone(true)
    }
  }

  // Helper to clear and enter manual number
  const clearForManualEntry = (type: 'sms' | 'call') => {
    if (type === 'sms') {
      onSmsToChange('')
    } else {
      onCallPhoneNumberChange('')
    }
    setIsUsingPatientPhone(false)
  }

  // Check if currently showing patient's number
  const isSmsToPatient = patientPhone && smsTo === patientPhone
  const isCallToPatient = patientPhone && callPhoneNumber === patientPhone

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <PhoneCall className="w-4 h-4 text-blue-400" />
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-green-400" />
      case 'video':
        return <Video className="w-4 h-4 text-purple-400" />
      case 'email':
        return <MessageSquare className="w-4 h-4 text-orange-400" />
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeLabel = (item: any) => {
    switch (item.type) {
      case 'call':
        return item.direction === 'outbound' ? 'Outbound Call' : 'Inbound Call'
      case 'sms':
        return item.direction === 'outbound' ? 'Sent SMS' : 'Received SMS'
      case 'video':
        return 'Video Call'
      case 'email':
        return item.direction === 'outbound' ? 'Sent Email' : 'Received Email'
      default:
        return item.type
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'connected' || status === 'sent' || status === 'delivered') {
      return 'text-green-400'
    }
    if (status === 'completed' || status === 'initiated') {
      return 'text-blue-400'
    }
    if (status === 'failed' || status === 'error') {
      return 'text-red-400'
    }
    return 'text-yellow-400'
  }

  // NEW: Handle starting video call
  const handleStartVideoCall = () => {
    setIsVideoCallActive(true)
  }

  // NEW: Handle closing video call
  const handleCloseVideoCall = () => {
    setIsVideoCallActive(false)
  }

  // =============================================
  // RENDER: Video Call Mode (Option B - Replace Content)
  // =============================================
  if (isVideoCallActive) {
    return (
      <div {...sectionProps} style={{ contain: 'layout style paint' }}>
        {isCustomizeMode && (
          <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <VideoCallPanel
          patientName={patientName}
          patientPhone={patientPhone || smsTo || callPhoneNumber}
          doctorName={doctorName}
          onClose={handleCloseVideoCall}
          onSaveTranscript={onSaveTranscript}
          onSaveSOAP={onSaveSOAP}
        />
      </div>
    )
  }

  // =============================================
  // RENDER: Normal Communication Panel
  // =============================================
  return (
    <div {...sectionProps} style={{ contain: 'layout style paint' }}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
        
        {/* Patient Context Banner - shows when patient selected */}
        {patientName && patientId && (
          <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 text-sm font-medium">Communicating with: {patientName}</span>
              </div>
              {patientPhone && (
                <span className="text-cyan-300 text-xs">{patientPhone}</span>
              )}
            </div>
          </div>
        )}

        {/* No Patient Mode Banner */}
        {!patientId && (
          <div className="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-sm">Manual mode - Enter any phone number</span>
            </div>
          </div>
        )}

        {/* Video Call Button - Only show if patient selected */}
        {patientName && patientId && (
          <div className="mb-6">
            <button
              onClick={handleStartVideoCall}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl hover:from-purple-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-purple-500/25 text-base font-semibold"
            >
              <Video className="h-5 w-5" />
              <span>Start Video Call + AI Scribe</span>
            </button>
            <p className="text-center text-slate-500 text-xs mt-2">
              Video visit with real-time transcription & SOAP notes
            </p>
          </div>
        )}

        <div className={patientId ? "border-t border-white/10 pt-6" : ""}>
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            Send SMS
            {isSmsToPatient && (
              <span className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                To Patient
              </span>
            )}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm text-gray-400">To</label>
                {patientPhone && !isSmsToPatient && (
                  <button
                    onClick={usePatientPhoneForSMS}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
                    Use Patient #{patientPhone.slice(-4)}
                  </button>
                )}
                {isSmsToPatient && (
                  <button
                    onClick={() => clearForManualEntry('sms')}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Enter different number
                  </button>
                )}
              </div>
              <input
                type="tel"
                value={smsTo}
                onChange={(e) => {
                  startTransition(() => {
                    onSmsToChange(e.target.value)
                    if (e.target.value !== patientPhone) {
                      setIsUsingPatientPhone(false)
                    }
                  })
                }}
                placeholder="Phone number (e.g., +1234567890)"
                className="w-full h-9 sm:h-10 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                style={{ contain: 'layout style' }}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Message</label>
              <textarea
                value={smsMessage}
                onChange={(e) => {
                  startTransition(() => {
                    onSmsMessageChange(e.target.value)
                  })
                }}
                placeholder="Type your message..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none text-sm sm:text-base"
                style={{ contain: 'layout style' }}
              />
            </div>
            <button
              onClick={onSendSMS}
              disabled={isSendingSMS || !smsTo || !smsMessage.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
            >
              {isSendingSMS ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send SMS</span>
                </>
              )}
            </button>
            {error && error.includes('SMS') && (
              <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Call Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            Make Call
            {isCallToPatient && (
              <span className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                To Patient
              </span>
            )}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm text-gray-400">Phone Number</label>
                {patientPhone && !isCallToPatient && (
                  <button
                    onClick={usePatientPhoneForCall}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
                    Use Patient #{patientPhone.slice(-4)}
                  </button>
                )}
                {isCallToPatient && (
                  <button
                    onClick={() => clearForManualEntry('call')}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Enter different number
                  </button>
                )}
              </div>
              <input
                type="tel"
                value={callPhoneNumber}
                onChange={(e) => {
                  startTransition(() => {
                    onCallPhoneNumberChange(e.target.value)
                    if (e.target.value !== patientPhone) {
                      setIsUsingPatientPhone(false)
                    }
                  })
                }}
                placeholder="Phone number (e.g., +1234567890)"
                disabled={isCalling}
                className="w-full h-9 sm:h-10 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                style={{ contain: 'layout style' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{callStatus}</span>
              {isCalling && callDuration > 0 && (
                <span className="text-teal-400 font-semibold">{formatDuration(callDuration)}</span>
              )}
            </div>
            <div className="flex gap-2">
              {isCalling ? (
                <>
                  <button
                    onClick={onToggleMute}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm sm:text-base font-medium ${
                      isMuted 
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                  </button>
                  <button
                    onClick={onEndCall}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
                  >
                    <Phone className="h-4 w-4 rotate-135" />
                    <span>End Call</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onMakeCall}
                  disabled={!callPhoneNumber || !isDeviceReady || isCallLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
                >
                  {isCallLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4" />
                      <span>Make Call</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {error && error.includes('call') && (
              <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Communication History */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            Communication History
          </h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                <p className="text-gray-400 text-sm mt-2">Loading history...</p>
              </div>
            ) : communicationHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No communication history for this patient</p>
                <p className="text-gray-500 text-xs mt-2">Start by sending an SMS or making a call</p>
              </div>
            ) : (
              communicationHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-700/50 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium text-xs sm:text-sm">
                            {getTypeLabel(item)}
                          </p>
                          {item.status && (
                            <span className={`text-xs ${getStatusColor(item.status)}`}>
                              • {item.status}
                            </span>
                          )}
                        </div>
                        {item.message && (
                          <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                            {item.message}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{formatHistoryDate(item.created_at)}</span>
                          {item.duration && (item.type === 'call' || item.type === 'video') && (
                            <span>Duration: {formatDuration(item.duration)}</span>
                          )}
                        </div>
                        {item.type === 'call' && item.recording_url && onPlayRecording && audioRefs && (
                          <div className="flex items-center gap-2 mt-2">
                            <audio
                              ref={(el) => {
                                if (el) audioRefs.current[item.id] = el
                              }}
                              src={item.recording_url}
                              className="hidden"
                            />
                            <button
                              onClick={() => onPlayRecording(item.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs transition-colors"
                            >
                              {playingRecordingId === item.id ? (
                                <>
                                  <Pause className="w-3 h-3" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>Play Recording</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.smsTo === nextProps.smsTo &&
    prevProps.smsMessage === nextProps.smsMessage &&
    prevProps.isSendingSMS === nextProps.isSendingSMS &&
    prevProps.callPhoneNumber === nextProps.callPhoneNumber &&
    prevProps.isCalling === nextProps.isCalling &&
    prevProps.communicationHistory.length === nextProps.communicationHistory.length &&
    prevProps.loadingHistory === nextProps.loadingHistory &&
    prevProps.isCustomizeMode === nextProps.isCustomizeMode &&
    prevProps.patientName === nextProps.patientName &&
    prevProps.patientPhone === nextProps.patientPhone &&
    prevProps.patientId === nextProps.patientId &&
    prevProps.doctorName === nextProps.doctorName
  )
})

export default CommunicationPanel
