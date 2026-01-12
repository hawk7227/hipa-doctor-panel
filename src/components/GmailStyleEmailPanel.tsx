'use client'

import { useState, useEffect } from 'react'
import { 
  Mail,
  Inbox,
  Send,
  Star,
  StarOff,
  FileText,
  Edit,
  Search,
  ChevronDown,
  Reply,
  X,
  RefreshCw,
  Plus,
  CheckCheck,
  Paperclip
} from 'lucide-react'

type EmailFolder = 'inbox' | 'starred' | 'sent' | 'drafts'
type EmailStatus = 'sent' | 'delivered' | 'read' | 'draft' | 'failed'

interface EmailMessage {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  subject: string
  body: string
  timestamp: Date
  status: EmailStatus
  isStarred: boolean
  isRead: boolean
  direction: 'sent' | 'received'
}

interface EmailThread {
  id: string
  subject: string
  participants: string[]
  messages: EmailMessage[]
  lastMessageDate: Date
  isStarred: boolean
  hasUnread: boolean
}

interface CommunicationHistoryEntry {
  id?: string
  type: 'email'
  direction: 'outbound' | 'inbound'
  to_email?: string
  from_email?: string
  subject: string
  body: string
  status: string
  provider_id?: string | null
  patient_id?: string | null
  created_at: string
}

interface GmailStyleEmailPanelProps {
  patientEmail?: string
  patientName?: string
  patientAvatar?: string
  providerEmail?: string
  providerName?: string
  providerAvatar?: string
  providerId?: string | null
  patientId?: string | null
  onSendEmail?: (to: string, subject: string, body: string) => Promise<void>
  onLogCommunication?: (entry: CommunicationHistoryEntry) => Promise<void>
  className?: string
}

// Mock email generator
const generateMockEmails = (
  patientEmail: string, 
  patientName: string,
  providerEmail: string,
  providerName: string
): EmailThread[] => {
  const now = new Date()
  const firstName = patientName.split(' ')[0]
  
  return [
    {
      id: 'thread-1',
      subject: 'Prescription Sent Confirmation',
      participants: [patientEmail, providerEmail],
      isStarred: false,
      hasUnread: false,
      lastMessageDate: new Date(now.getTime() - 2 * 24 * 3600000),
      messages: [
        {
          id: 'email-1',
          from: providerEmail,
          fromName: providerName,
          to: patientEmail,
          toName: patientName,
          subject: 'Prescription Sent Confirmation',
          body: `Hi ${firstName},\n\nYour prescription has been sent to Fry's Pharmacy, 4724 N 20th St, Phoenix, AZ 85016.\nPlease pick up at your convenience.\n\nLet me know if you need anything else.\n\nBest regards,\n${providerName}`,
          timestamp: new Date(now.getTime() - 2 * 24 * 3600000 - 30 * 60000),
          status: 'delivered',
          isStarred: false,
          isRead: true,
          direction: 'sent'
        },
        {
          id: 'email-2',
          from: patientEmail,
          fromName: patientName,
          to: providerEmail,
          toName: providerName,
          subject: 'Re: Prescription Sent Confirmation',
          body: `Thank you, Dr. Bennett.\nI'll pick up the medication later today.`,
          timestamp: new Date(now.getTime() - 2 * 24 * 3600000),
          status: 'read',
          isStarred: false,
          isRead: true,
          direction: 'received'
        }
      ]
    },
    {
      id: 'thread-2',
      subject: 'Follow-Up Appointment',
      participants: [patientEmail, providerEmail],
      isStarred: true,
      hasUnread: false,
      lastMessageDate: new Date(now.getTime() - 5 * 24 * 3600000),
      messages: [
        {
          id: 'email-3',
          from: providerEmail,
          fromName: providerName,
          to: patientEmail,
          toName: patientName,
          subject: 'Follow-Up Appointment',
          body: `Hi ${firstName},\n\nJust a reminder to schedule your follow-up appointment within two weeks.\nI'll be available most afternoons during the week.\n\nBest,\n${providerName}`,
          timestamp: new Date(now.getTime() - 5 * 24 * 3600000 - 2 * 3600000),
          status: 'delivered',
          isStarred: true,
          isRead: true,
          direction: 'sent'
        },
        {
          id: 'email-4',
          from: patientEmail,
          fromName: patientName,
          to: providerEmail,
          toName: providerName,
          subject: 'Re: Follow-Up Appointment',
          body: `Got it. I'll schedule the appointment and let you know by tomorrow.\nThanks for following up.`,
          timestamp: new Date(now.getTime() - 5 * 24 * 3600000),
          status: 'read',
          isStarred: false,
          isRead: true,
          direction: 'received'
        }
      ]
    }
  ]
}

function formatEmailTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 24 * 3600000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + 
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function GmailStyleEmailPanel({
  patientEmail = 'hawk727@yahoo.com',
  patientName = 'Marcus Hawkins',
  patientAvatar,
  providerEmail = 'dr.bennett@medazonhealth.com',
  providerName = 'Dr. Lisa Bennett, MD',
  providerAvatar,
  providerId,
  patientId,
  onSendEmail,
  onLogCommunication,
  className = ''
}: GmailStyleEmailPanelProps) {
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox')
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [isReply, setIsReply] = useState(false)
  const [replyToThread, setReplyToThread] = useState<EmailThread | null>(null)

  useEffect(() => {
    setThreads(generateMockEmails(patientEmail, patientName, providerEmail, providerName))
  }, [patientEmail, patientName, providerEmail, providerName])

  const filteredThreads = threads.filter(thread => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return thread.subject.toLowerCase().includes(query) ||
        thread.messages.some(m => m.body.toLowerCase().includes(query))
    }
    
    switch (activeFolder) {
      case 'starred': return thread.isStarred
      case 'sent': return thread.messages.some(m => m.direction === 'sent')
      case 'drafts': return thread.messages.some(m => m.status === 'draft')
      default: return true
    }
  })

  const handleCompose = () => {
    setIsComposing(true)
    setIsReply(false)
    setReplyToThread(null)
    setComposeSubject('')
    setComposeBody('')
  }

  const handleReply = (thread: EmailThread) => {
    setIsComposing(true)
    setIsReply(true)
    setReplyToThread(thread)
    setComposeSubject(`Re: ${thread.subject}`)
    setComposeBody('')
  }

  const handleSendEmail = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) return
    
    setIsSending(true)
    
    const newEmail: EmailMessage = {
      id: `email-${Date.now()}`,
      from: providerEmail,
      fromName: providerName,
      to: patientEmail,
      toName: patientName,
      subject: composeSubject,
      body: composeBody,
      timestamp: new Date(),
      status: 'sent',
      isStarred: false,
      isRead: true,
      direction: 'sent'
    }
    
    try {
      await onLogCommunication?.({
        type: 'email',
        direction: 'outbound',
        to_email: patientEmail,
        from_email: providerEmail,
        subject: composeSubject,
        body: composeBody,
        status: 'sent',
        provider_id: providerId,
        patient_id: patientId,
        created_at: new Date().toISOString()
      })
      
      await onSendEmail?.(patientEmail, composeSubject, composeBody)
      
      if (isReply && replyToThread) {
        setThreads(prev => prev.map(t => 
          t.id === replyToThread.id
            ? { ...t, messages: [...t.messages, newEmail], lastMessageDate: new Date() }
            : t
        ))
      } else {
        const newThread: EmailThread = {
          id: `thread-${Date.now()}`,
          subject: composeSubject,
          participants: [patientEmail, providerEmail],
          messages: [newEmail],
          lastMessageDate: new Date(),
          isStarred: false,
          hasUnread: false
        }
        setThreads(prev => [newThread, ...prev])
      }
      
      setIsComposing(false)
      setComposeSubject('')
      setComposeBody('')
    } catch (err) {
      console.error('Failed to send email:', err)
    } finally {
      setIsSending(false)
    }
  }

  const toggleStar = (threadId: string) => {
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, isStarred: !t.isStarred } : t
    ))
  }

  const inboxCount = threads.filter(t => t.hasUnread).length

  return (
    <div className={`bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[600px] ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Mail className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-white font-bold">Medazon</span>
          </div>
          <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email"
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-white/10 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 border-r border-white/10 p-3 flex flex-col">
          <button
            onClick={handleCompose}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium mb-4"
          >
            <Edit className="h-4 w-4" />
            Compose
          </button>

          <nav className="space-y-1">
            {(['inbox', 'starred', 'sent', 'drafts'] as EmailFolder[]).map(folder => {
              const icons = { inbox: Inbox, starred: Star, sent: Send, drafts: FileText }
              const Icon = icons[folder]
              return (
                <button
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                    activeFolder === folder 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{folder === 'sent' ? 'Sent Mail' : folder}</span>
                  {folder === 'inbox' && inboxCount > 0 && (
                    <span className="ml-auto text-xs bg-cyan-500/30 px-1.5 py-0.5 rounded">{inboxCount}</span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white font-medium">
                {getInitials(patientName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{patientName}</p>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isComposing ? (
            <div className="flex-1 flex flex-col p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{isReply ? `Reply to ${patientName}` : 'New Message'}</h3>
                <button onClick={() => setIsComposing(false)} className="p-1 text-gray-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-3 flex-1 flex flex-col">
                <input
                  type="email"
                  value={patientEmail}
                  disabled
                  className="w-full h-9 px-3 rounded-lg border border-white/10 bg-slate-700/50 text-gray-300 text-sm"
                />
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full h-9 px-3 rounded-lg border border-white/10 bg-slate-700/50 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  className="flex-1 min-h-[200px] px-3 py-2 rounded-lg border border-white/10 bg-slate-700/50 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
                <div className="flex items-center justify-between pt-2">
                  <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!composeSubject.trim() || !composeBody.trim() || isSending}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <Send className="h-4 w-4" />
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedThread ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <button onClick={() => setSelectedThread(null)} className="text-gray-400 hover:text-white text-sm">
                    ← Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStar(selectedThread.id)} className="p-1.5 text-gray-400 hover:text-yellow-400 rounded-lg">
                      {selectedThread.isStarred ? <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : <StarOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => handleReply(selectedThread)} className="p-1.5 text-gray-400 hover:text-white rounded-lg">
                      <Reply className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h2 className="text-white font-semibold mt-2">{selectedThread.subject}</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedThread.messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-medium flex-shrink-0 ${
                      message.direction === 'sent' ? 'bg-cyan-600' : 'bg-slate-600'
                    }`}>
                      {getInitials(message.direction === 'sent' ? providerName : patientName)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium text-sm">
                          {message.direction === 'sent' ? providerName : patientName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{formatEmailTime(message.timestamp)}</span>
                          {message.direction === 'sent' && <CheckCheck className="h-3.5 w-3.5 text-cyan-400" />}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-white/10">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => handleReply(selectedThread)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-white/20 text-gray-400 rounded-lg hover:text-white hover:bg-white/5 text-sm"
                >
                  <Reply className="h-4 w-4" />
                  Reply to {patientName}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-white/10 bg-slate-900/30">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Sent to {patientName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Mail className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">No emails yet</p>
                  <button onClick={handleCompose} className="mt-3 text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Compose first email
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filteredThreads.map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className="w-full p-4 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleStar(thread.id) }}
                          className="p-1 -ml-1 text-gray-400 hover:text-yellow-400 cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleStar(thread.id)
                            }
                          }}
                        >
                          {thread.isStarred ? <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : <Star className="h-4 w-4" />}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm text-white font-medium flex-shrink-0">
                          {getInitials(patientName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium text-sm ${thread.hasUnread ? 'text-white' : 'text-gray-300'}`}>
                              {thread.subject}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatEmailTime(thread.lastMessageDate)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {thread.messages[thread.messages.length - 1]?.body.split('\n')[0]}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { EmailFolder, EmailStatus, EmailMessage, EmailThread, CommunicationHistoryEntry as EmailCommunicationHistoryEntry, GmailStyleEmailPanelProps }