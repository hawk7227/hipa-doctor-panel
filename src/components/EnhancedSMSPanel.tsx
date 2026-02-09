'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  MessageSquare, 
  Send, 
  MoreHorizontal,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Bell,
  BellOff,
  Info,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react'

interface SMSMessage {
  id: string
  direction: 'sent' | 'received'
  content: string
  timestamp: Date
  status: 'sent' | 'delivered' | 'failed' | 'blocked'
  autoResponse?: boolean
}

interface CommunicationHistoryEntry {
  id?: string
  type: 'sms'
  direction: 'outbound' | 'inbound'
  to_number?: string
  from_number?: string
  content: string
  status: string
  auto_response_used?: boolean
  provider_id?: string | null
  patient_id?: string | null
  created_at: string
}

interface EnhancedSMSPanelProps {
  // Phone number to send SMS to
  phoneNumber?: string
  // Provider ID for logging
  providerId?: string | null
  // Patient ID for logging
  patientId?: string | null
  // Appointment ID for context
  appointmentId?: string | null
  // Patient name for display
  patientName?: string
  // Callback when phone number changes
  onPhoneNumberChange?: (number: string) => void
  // Callback to send SMS
  onSendSMS?: (to: string, message: string) => Promise<void>
  // Callback to log communication history
  onLogCommunication?: (entry: CommunicationHistoryEntry) => Promise<void>
  // External loading state
  isSending?: boolean
  // External error
  error?: string
  // Custom className
  className?: string
}

// Default auto-response message
const DEFAULT_AUTO_RESPONSE = "This live chat has ended. To continue the conversation, please schedule an appointment so we can assist you further. We'll be happy to help."

// Mock message history for demo
const generateMockMessages = (): SMSMessage[] => {
  const now = new Date()
  return [
    {
      id: '1',
      direction: 'sent',
      content: 'Your prescription has been sent to Fry\'s Pharmacy.',
      timestamp: new Date(now.getTime() - 30 * 60000), // 30 min ago
      status: 'delivered'
    },
    {
      id: '2',
      direction: 'received',
      content: 'Thanks! I\'ll pick up my medication later today.',
      timestamp: new Date(now.getTime() - 27 * 60000), // 27 min ago
      status: 'delivered'
    },
    {
      id: '3',
      direction: 'sent',
      content: 'Please schedule a follow-up appointment within 2 weeks.',
      timestamp: new Date(now.getTime() - 3 * 3600000), // 3 hours ago
      status: 'delivered'
    },
    {
      id: '4',
      direction: 'sent',
      content: 'Is your blood pressure under control now?',
      timestamp: new Date(now.getTime() - 8 * 3600000), // 8 hours ago
      status: 'delivered'
    },
    {
      id: '5',
      direction: 'received',
      content: 'Yes, it\'s much better. Thank you, doctor!',
      timestamp: new Date(now.getTime() - 7.5 * 3600000),
      status: 'delivered'
    }
  ]
}

// Format timestamp for display
function formatMessageTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // If today, show time only
  if (diff < 24 * 3600000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  // If this week, show day and time
  if (diff < 7 * 24 * 3600000) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
  
  // Otherwise show date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export default function EnhancedSMSPanel({
  phoneNumber: initialPhoneNumber = '',
  providerId,
  patientId,
  appointmentId,
  patientName,
  onPhoneNumberChange,
  onSendSMS,
  onLogCommunication,
  isSending: externalIsSending = false,
  error: externalError,
  className = ''
}: EnhancedSMSPanelProps) {
  // Form state
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Do Not Reply feature
  const [doNotReply, setDoNotReply] = useState(true) // ON by default
  const [autoResponseMessage, setAutoResponseMessage] = useState(DEFAULT_AUTO_RESPONSE)
  const [showAutoResponseSettings, setShowAutoResponseSettings] = useState(false)
  
  // Message history
  const [messages, setMessages] = useState<SMSMessage[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load mock messages on mount
  useEffect(() => {
    setMessages(generateMockMessages())
  }, [])

  // Sync phone number from props
  useEffect(() => {
    if (initialPhoneNumber) {
      setPhoneNumber(initialPhoneNumber)
    }
  }, [initialPhoneNumber])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle phone number change
  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value)
    onPhoneNumberChange?.(value)
    setError(null)
  }

  // Quick message templates
  const messageTemplates = [
    'Your prescription has been sent to your pharmacy.',
    'Please schedule a follow-up appointment within 2 weeks.',
    'Your lab results are ready. Please check your patient portal.',
    'Reminder: Please take your medication as prescribed.',
    'Is there anything else you need help with?'
  ]

  // Handle Send SMS
  const handleSendSMS = async () => {
    if (!phoneNumber.trim() || !message.trim() || isSending) return
    
    setIsSending(true)
    setError(null)
    
    const newMessage: SMSMessage = {
      id: `msg-${Date.now()}`,
      direction: 'sent',
      content: message,
      timestamp: new Date(),
      status: 'sent'
    }
    
    // Optimistically add message
    setMessages(prev => [...prev, newMessage])
    
    // Log to communication history
    const entry: CommunicationHistoryEntry = {
      type: 'sms',
      direction: 'outbound',
      to_number: phoneNumber,
      content: message,
      status: 'sent',
      provider_id: providerId,
      patient_id: patientId,
      created_at: new Date().toISOString()
    }
    
    try {
      await onLogCommunication?.(entry)
      await onSendSMS?.(phoneNumber, message)
      
      // Update message status to delivered
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, status: 'delivered' as const } : msg
      ))
      
      setMessage('') // Clear input
    } catch (err: any) {
      setError(err.message || 'Failed to send SMS')
      
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, status: 'failed' as const } : msg
      ))
      
      // Log failure
      await onLogCommunication?.({
        ...entry,
        status: 'failed'
      })
    } finally {
      setIsSending(false)
    }
  }

  // Handle template selection
  const handleTemplateSelect = (template: string) => {
    setMessage(template)
    setShowTemplates(false)
  }

  // Separate messages into sent and received
  const sentMessages = messages.filter(m => m.direction === 'sent')
  const receivedMessages = messages.filter(m => m.direction === 'received')

  const currentError = externalError || error

  return (
    <div className={`bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10 ${className}`}>
      {/* Header */}
      <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
        Send SMS
      </h3>

      {/* Phone Number Input */}
      <div className="mb-4">
        <label className="block text-xs sm:text-sm text-gray-400 mb-2">To</label>
        <div className="relative">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="(602)-549-8598"
            className="w-full h-10 px-4 pr-12 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base"
          />
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-white/5"
            title="Quick templates"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Message Input */}
      <div className="mb-4">
        <label className="block text-xs sm:text-sm text-gray-400 mb-2">Message</label>
        
        {/* Templates Dropdown */}
        {showTemplates && (
          <div className="mb-2 p-2 bg-slate-700/50 rounded-lg border border-white/10">
            <p className="text-xs text-gray-400 mb-2">Quick templates:</p>
            <div className="space-y-1">
              {messageTemplates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none text-base"
        />
      </div>

      {/* Message History - Two Column Layout */}
      <div className="mb-4 p-4 bg-slate-700/30 rounded-lg border border-white/10">
        <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-white/10">
          <Send className="h-4 w-4 text-cyan-400" />
          <span className="text-sm text-gray-300">Send SMS</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Sent Messages Column */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-3">Messages</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {sentMessages.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No messages sent</p>
              ) : (
                sentMessages.map(msg => (
                  <div 
                    key={msg.id}
                    className="p-2.5 bg-slate-600/50 rounded-lg border-l-2 border-cyan-500"
                  >
                    <p className="text-white text-sm leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      <span className="text-xs text-gray-400">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                      {msg.status === 'delivered' && (
                        <CheckCircle className="h-3 w-3 text-green-400" />
                      )}
                      {msg.status === 'failed' && (
                        <AlertCircle className="h-3 w-3 text-red-400" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Received Messages Column */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-3">Received</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {receivedMessages.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No replies</p>
              ) : (
                receivedMessages.map(msg => (
                  <div 
                    key={msg.id}
                    className="p-2.5 bg-slate-700/50 rounded-lg border-r-2 border-gray-500"
                  >
                    <p className="text-gray-300 text-sm leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-end mt-1.5">
                      <span className="text-xs text-gray-500">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Do Not Reply Toggle */}
      <div className="mb-4 p-3 bg-slate-700/30 rounded-lg border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {doNotReply ? (
              <BellOff className="h-4 w-4 text-yellow-400" />
            ) : (
              <Bell className="h-4 w-4 text-green-400" />
            )}
            <span className="text-sm text-white font-medium">Do Not Reply</span>
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-white/20 rounded-lg text-xs text-gray-300 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                When enabled, patients cannot reply. An automatic message is sent instead.
              </div>
            </div>
          </div>
          <button
            onClick={() => setDoNotReply(!doNotReply)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              doNotReply ? 'bg-yellow-600' : 'bg-slate-600'
            }`}
          >
            <div 
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                doNotReply ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
        
        {/* Auto Response Settings */}
        {doNotReply && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              onClick={() => setShowAutoResponseSettings(!showAutoResponseSettings)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Auto-response message</span>
              {showAutoResponseSettings ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            
            {showAutoResponseSettings && (
              <div className="mt-2">
                <textarea
                  value={autoResponseMessage}
                  onChange={(e) => setAutoResponseMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-800/50 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
                <button
                  onClick={() => setAutoResponseMessage(DEFAULT_AUTO_RESPONSE)}
                  className="mt-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Reset to default
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {currentError && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-xs">{currentError}</p>
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSendSMS}
        disabled={!phoneNumber.trim() || !message.trim() || isSending || externalIsSending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
      >
        {isSending || externalIsSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send SMS
          </>
        )}
      </button>
    </div>
  )
}

export type { SMSMessage, CommunicationHistoryEntry as SMSCommunicationHistoryEntry, EnhancedSMSPanelProps }

