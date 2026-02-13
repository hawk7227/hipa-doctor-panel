'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import {
  MessageSquare, Phone, Mail, History, Send, Loader2,
  PhoneCall, PhoneOff, Mic, MicOff, Copy, Play, Pause,
  Clock, ArrowUpRight, ArrowDownLeft, Voicemail, FileText,
  ChevronDown, Search, Paperclip, X
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface UnifiedCommHubProps {
  isOpen: boolean
  onClose: () => void
  patientId?: string
  patientName?: string
  patientPhone?: string
  patientEmail?: string
  appointmentId?: string | null
  providerId?: string
  providerName?: string
  providerEmail?: string
  onSendEmail?: (to: string, subject: string, body: string) => Promise<void>
  onSmsSent?: (message: string) => void
}

type CommTab = 'sms' | 'call' | 'email' | 'history'

interface CommRecord {
  id: string
  type: 'sms' | 'call' | 'email' | 'fax'
  direction: 'inbound' | 'outbound'
  from_number?: string | null
  to_number?: string | null
  from_email?: string | null
  to_email?: string | null
  subject?: string | null
  body?: string | null
  status?: string | null
  duration?: number | null
  recording_url?: string | null
  created_at: string
}

// ═══════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const TABS: { id: CommTab; label: string; icon: React.ElementType }[] = [
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'call', label: 'Call', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'history', label: 'History', icon: History },
]

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function UnifiedCommHub({
  isOpen,
  onClose,
  patientId,
  patientName = 'Patient',
  patientPhone = '',
  patientEmail = '',
  appointmentId,
  providerId,
  providerName = 'Provider',
  providerEmail = '',
  onSendEmail,
  onSmsSent,
}: UnifiedCommHubProps) {
  const [activeTab, setActiveTab] = useState<CommTab>('sms')

  // ── SMS State ──
  const [smsTo, setSmsTo] = useState(patientPhone)
  const [smsMessage, setSmsMessage] = useState('')
  const [sendingSms, setSendingSms] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)
  const [smsSuccess, setSmsSuccess] = useState(false)
  const [smsTemplateOpen, setSmsTemplateOpen] = useState(false)

  // ── Call State ──
  const [callActive, setCallActive] = useState(false)
  const [callMuted, setCallMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callStatus, setCallStatus] = useState<string>('idle')
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Email State ──
  const [emailTo, setEmailTo] = useState(patientEmail)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  // ── History State ──
  const [history, setHistory] = useState<CommRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sms' | 'call' | 'email'>('all')
  const [historySearch, setHistorySearch] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── Sync phone/email when props change ──
  useEffect(() => { setSmsTo(patientPhone) }, [patientPhone])
  useEffect(() => { setEmailTo(patientEmail) }, [patientEmail])

  // ── Fetch history ──
  const fetchHistory = useCallback(async () => {
    if (!patientPhone && !patientEmail && !patientId) return
    setLoadingHistory(true)
    try {
      let query = supabase
        .from('communication_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (patientId) {
        query = query.eq('patient_id', patientId)
      } else if (patientPhone) {
        query = query.or(`from_number.eq.${patientPhone},to_number.eq.${patientPhone}`)
      }

      const { data, error } = await query
      if (error) {
        console.log('Communication history query:', error.message)
        setHistory([])
      } else {
        setHistory((data as unknown as CommRecord[]) || [])
      }
    } catch (err) {
      console.error('Error fetching comm history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [patientPhone, patientEmail, patientId])

  useEffect(() => {
    if (isOpen) fetchHistory()
  }, [isOpen, fetchHistory])

  // ═══════════════════════════════════════════════════════════════
  // SMS HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const SMS_TEMPLATES = [
    { label: 'Appointment Reminder', text: `Hi ${patientName}, this is a reminder about your upcoming appointment. Please reply CONFIRM to confirm.` },
    { label: 'Follow Up', text: `Hi ${patientName}, we wanted to follow up on your recent visit. How are you feeling? Let us know if you have any questions.` },
    { label: 'Prescription Ready', text: `Hi ${patientName}, your prescription is ready for pickup at your pharmacy.` },
    { label: 'Lab Results', text: `Hi ${patientName}, your lab results are available. Please log in to your patient portal or call our office to discuss.` },
  ]

  const handleSendSms = useCallback(async () => {
    if (!smsTo.trim() || !smsMessage.trim()) return
    setSendingSms(true)
    setSmsError(null)
    setSmsSuccess(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/communication/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          to: smsTo,
          message: smsMessage,
          patientId,
          appointmentId,
        }),
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to send SMS')
      }
      setSmsSuccess(true)
      if (onSmsSent) onSmsSent(smsMessage)
      setSmsMessage('')
      setTimeout(() => setSmsSuccess(false), 3000)
      fetchHistory()
    } catch (err: any) {
      setSmsError(err.message || 'Failed to send SMS')
    } finally {
      setSendingSms(false)
    }
  }, [smsTo, smsMessage, patientId, appointmentId, onSmsSent, fetchHistory])

  // ═══════════════════════════════════════════════════════════════
  // CALL HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleStartCall = useCallback(async () => {
    if (!patientPhone) return
    setCallStatus('connecting')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/communication/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          to: patientPhone,
          patientId,
          appointmentId,
        }),
      })
      if (!response.ok) throw new Error('Failed to initiate call')
      setCallActive(true)
      setCallStatus('connected')
      setCallDuration(0)
      callTimerRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Call error:', err)
      setCallStatus('failed')
      setTimeout(() => setCallStatus('idle'), 3000)
    }
  }, [patientPhone, patientId, appointmentId])

  const handleEndCall = useCallback(() => {
    setCallActive(false)
    setCallStatus('ended')
    setCallMuted(false)
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    setTimeout(() => setCallStatus('idle'), 3000)
    fetchHistory()
  }, [fetchHistory])

  const handleToggleMute = useCallback(() => {
    setCallMuted(v => !v)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // EMAIL HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleSendEmailAction = useCallback(async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return
    setSendingEmail(true)
    setEmailError(null)
    setEmailSuccess(false)
    try {
      if (onSendEmail) {
        await onSendEmail(emailTo, emailSubject, emailBody)
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch('/api/communication/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
          },
          body: JSON.stringify({
            to: emailTo,
            subject: emailSubject,
            body: emailBody,
            patientId,
            appointmentId,
          }),
        })
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || 'Failed to send email')
        }
      }
      setEmailSuccess(true)
      setEmailSubject('')
      setEmailBody('')
      setTimeout(() => setEmailSuccess(false), 3000)
      fetchHistory()
    } catch (err: any) {
      setEmailError(err.message || 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }, [emailTo, emailSubject, emailBody, patientId, appointmentId, onSendEmail, fetchHistory])

  // ═══════════════════════════════════════════════════════════════
  // HISTORY HELPERS
  // ═══════════════════════════════════════════════════════════════

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  const getTypeIcon = (type: string, direction: string) => {
    switch (type) {
      case 'sms': return direction === 'outbound' ? <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
      case 'call': return direction === 'outbound' ? <PhoneCall className="w-3.5 h-3.5 text-emerald-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />
      case 'email': return direction === 'outbound' ? <Mail className="w-3.5 h-3.5 text-purple-400" /> : <Mail className="w-3.5 h-3.5 text-cyan-400" />
      default: return <FileText className="w-3.5 h-3.5 text-white/40" />
    }
  }

  const handlePlayRecording = useCallback((id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(url)
    audio.onended = () => setPlayingId(null)
    audio.play()
    audioRef.current = audio
    setPlayingId(id)
  }, [playingId])

  const filteredHistory = history.filter(h => {
    if (historyFilter !== 'all' && h.type !== historyFilter) return false
    if (historySearch) {
      const q = historySearch.toLowerCase()
      return (
        (h.body && h.body.toLowerCase().includes(q)) ||
        (h.subject && h.subject.toLowerCase().includes(q)) ||
        (h.from_number && h.from_number.includes(q)) ||
        (h.to_number && h.to_number.includes(q)) ||
        (h.from_email && h.from_email.toLowerCase().includes(q)) ||
        (h.to_email && h.to_email.toLowerCase().includes(q))
      )
    }
    return true
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <DraggableOverlayWrapper
      panelId="unified-comm-hub"
      isOpen={isOpen}
      onClose={onClose}
      title="Communications"
      subtitle={patientName}
      icon={<MessageSquare className="w-4 h-4" />}
      defaultTheme="blue"
      defaultWidth={480}
      defaultPosition={{ x: 120, y: 60 }}
    >
      {/* ── Tab Bar ── */}
      <div className="flex border-b border-white/10 px-1 flex-shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const unreadCount = tab.id === 'history' ? history.filter(h => h.direction === 'inbound' && h.status === 'unread').length : 0
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 relative ${
                isActive
                  ? 'text-white border-blue-400'
                  : 'text-white/40 border-transparent hover:text-white/60 hover:border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ════════════════ SMS TAB ════════════════ */}
        {activeTab === 'sms' && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            {/* To field */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-bold w-8">To</span>
              <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <Phone className="w-3.5 h-3.5 text-white/30" />
                <input
                  value={smsTo}
                  onChange={e => setSmsTo(e.target.value)}
                  placeholder="Phone number"
                  className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
                />
                {patientPhone && (
                  <button onClick={() => copyToClipboard(patientPhone)} className="text-[10px] text-blue-400 hover:text-blue-300">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Template selector */}
            <div className="relative">
              <button
                onClick={() => setSmsTemplateOpen(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                <FileText className="w-3 h-3" />Quick templates
                <ChevronDown className={`w-3 h-3 transition-transform ${smsTemplateOpen ? 'rotate-180' : ''}`} />
              </button>
              {smsTemplateOpen && (
                <div className="absolute left-0 top-6 w-full bg-slate-900 border border-white/20 rounded-xl shadow-xl z-20 py-1">
                  {SMS_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => { setSmsMessage(tmpl.text); setSmsTemplateOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <div className="font-medium text-white/90">{tmpl.label}</div>
                      <div className="text-[10px] text-white/40 truncate mt-0.5">{tmpl.text}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message area */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 min-h-[120px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-blue-500/50 focus:outline-none leading-relaxed"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendSms() }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-white/30">{smsMessage.length}/1600 • ⌘+Enter to send</span>
                <button
                  onClick={handleSendSms}
                  disabled={sendingSms || !smsMessage.trim() || !smsTo.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {sendingSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send SMS
                </button>
              </div>
            </div>

            {/* Status */}
            {smsError && <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">{smsError}</div>}
            {smsSuccess && <div className="px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-xs">SMS sent successfully!</div>}
          </div>
        )}

        {/* ════════════════ CALL TAB ════════════════ */}
        {activeTab === 'call' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
            {/* Phone display */}
            <div className="text-center">
              <div className="text-lg font-bold text-white">{patientName}</div>
              <div className="text-sm font-mono text-white/50 mt-1">{patientPhone || 'No phone number'}</div>
            </div>

            {/* Call status */}
            <div className={`text-sm font-bold ${
              callStatus === 'connected' ? 'text-green-400' :
              callStatus === 'connecting' ? 'text-yellow-400 animate-pulse' :
              callStatus === 'ended' ? 'text-white/40' :
              callStatus === 'failed' ? 'text-red-400' :
              'text-white/30'
            }`}>
              {callStatus === 'connected' ? formatDuration(callDuration) :
               callStatus === 'connecting' ? 'Connecting...' :
               callStatus === 'ended' ? `Call ended • ${formatDuration(callDuration)}` :
               callStatus === 'failed' ? 'Call failed' :
               'Ready to call'}
            </div>

            {/* Call controls */}
            <div className="flex items-center gap-4">
              {!callActive ? (
                <button
                  onClick={handleStartCall}
                  disabled={!patientPhone || callStatus === 'connecting'}
                  className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-green-600/30"
                >
                  <Phone className="w-7 h-7 text-white" />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleToggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      callMuted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {callMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/30"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                </>
              )}
            </div>

            {/* Quick copy */}
            {patientPhone && (
              <button
                onClick={() => copyToClipboard(patientPhone)}
                className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                <Copy className="w-3 h-3" />Copy number
              </button>
            )}
          </div>
        )}

        {/* ════════════════ EMAIL TAB ════════════════ */}
        {activeTab === 'email' && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            {/* To */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-bold w-14">To</span>
              <input
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="patient@email.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500/50"
              />
            </div>

            {/* From */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-bold w-14">From</span>
              <div className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white/50 text-xs">
                {providerEmail || providerName}
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-bold w-14">Subject</span>
              <input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Subject..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Body */}
            <textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder="Compose your email..."
              className="flex-1 min-h-[160px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-purple-500/50 focus:outline-none leading-relaxed"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendEmailAction() }}
            />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">⌘+Enter to send</span>
              <button
                onClick={handleSendEmailAction}
                disabled={sendingEmail || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Email
              </button>
            </div>

            {emailError && <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">{emailError}</div>}
            {emailSuccess && <div className="px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-xs">Email sent successfully!</div>}
          </div>
        )}

        {/* ════════════════ HISTORY TAB ════════════════ */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 flex-shrink-0">
              <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 flex-shrink-0">
                {(['all', 'sms', 'call', 'email'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      historyFilter === f ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
                <Search className="w-3 h-3 text-white/30" />
                <input
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-white text-[11px] outline-none"
                />
                {historySearch && (
                  <button onClick={() => setHistorySearch('')}><X className="w-3 h-3 text-white/30" /></button>
                )}
              </div>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  {history.length === 0 ? 'No communication history' : 'No matching records'}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredHistory.map(record => (
                    <div key={record.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {getTypeIcon(record.type, record.direction)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {record.type === 'sms' ? 'SMS' : record.type === 'call' ? 'Call' : record.type === 'email' ? 'Email' : record.type.toUpperCase()}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              record.direction === 'outbound' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                            }`}>
                              {record.direction === 'outbound' ? 'Sent' : 'Received'}
                            </span>
                            {record.status && record.status !== 'delivered' && record.status !== 'completed' && (
                              <span className="text-[10px] text-white/30">{record.status}</span>
                            )}
                            <span className="text-[10px] text-white/20 ml-auto flex-shrink-0">
                              <Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatDate(record.created_at)}
                            </span>
                          </div>

                          {/* Contact info */}
                          <div className="text-[10px] text-white/30 mt-0.5">
                            {record.type === 'email'
                              ? `${record.direction === 'outbound' ? 'To' : 'From'}: ${record.direction === 'outbound' ? record.to_email : record.from_email}`
                              : `${record.direction === 'outbound' ? 'To' : 'From'}: ${record.direction === 'outbound' ? record.to_number : record.from_number}`}
                          </div>

                          {/* Subject line for emails */}
                          {record.subject && (
                            <div className="text-xs text-white/60 font-medium mt-1">{record.subject}</div>
                          )}

                          {/* Body preview */}
                          {record.body && (
                            <div className="text-[11px] text-white/40 mt-1 line-clamp-2">{record.body}</div>
                          )}

                          {/* Call duration */}
                          {record.type === 'call' && record.duration != null && (
                            <div className="text-[10px] text-white/30 mt-1">Duration: {formatDuration(record.duration)}</div>
                          )}

                          {/* Recording playback */}
                          {record.recording_url && (
                            <button
                              onClick={() => handlePlayRecording(record.id, record.recording_url!)}
                              className="flex items-center gap-1.5 mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {playingId === record.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {playingId === record.id ? 'Pause' : 'Play recording'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
