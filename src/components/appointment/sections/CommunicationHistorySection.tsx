// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import React from 'react'
import { Clock, PhoneCall, MessageSquare, Video, Play, Pause } from 'lucide-react'

interface CommunicationHistorySectionProps {
  communicationHistory: any[]
  loadingHistory: boolean
  playingRecordingId: string | null
  isCustomizeMode: boolean
  sectionProps: any
  formatDuration: (seconds: number) => string
  formatHistoryDate: (dateString: string) => string
  onPlayRecording?: (id: string) => void
  audioRefs?: React.MutableRefObject<{ [key: string]: HTMLAudioElement | null }>
}

export default function CommunicationHistorySection({
  communicationHistory,
  loadingHistory,
  playingRecordingId,
  isCustomizeMode,
  sectionProps,
  formatDuration,
  formatHistoryDate,
  onPlayRecording,
  audioRefs
}: CommunicationHistorySectionProps) {
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'initiated':
        return 'Initiated'
      case 'connected':
        return 'Connected'
      case 'completed':
        return 'Completed'
      case 'ended':
        return 'Ended'
      case 'failed':
        return 'Failed'
      case 'error':
        return 'Error'
      default:
        return status || 'Unknown'
    }
  }

  return (
    <div {...sectionProps}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
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
                            • {getStatusLabel(item.status)}
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
                      {item.type === 'call' && item.recording_url && (
                        <div className="flex items-center gap-2 mt-2">
                          <audio
                            ref={(el) => {
                              if (el && audioRefs) audioRefs.current[item.id] = el
                            }}
                            src={item.recording_url}
                            onEnded={() => {
                              if (onPlayRecording) onPlayRecording('')
                            }}
                            onPlay={() => {
                              if (onPlayRecording) onPlayRecording(item.id)
                            }}
                            onPause={() => {
                              if (onPlayRecording) onPlayRecording('')
                            }}
                            preload="metadata"
                            crossOrigin="anonymous"
                            className="hidden"
                          />
                          <button
                            onClick={() => {
                              if (onPlayRecording) {
                                onPlayRecording(playingRecordingId === item.id ? '' : item.id)
                              }
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-600 hover:bg-slate-700 rounded text-xs text-white transition-colors"
                          >
                            {playingRecordingId === item.id ? (
                              <>
                                <Pause className="h-3 w-3" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Play Recording
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
  )
}

