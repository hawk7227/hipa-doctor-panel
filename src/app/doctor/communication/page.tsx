// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Phone, MessageSquare, Send, Clock, PhoneCall, Video,
  Play, Pause, Download, X, Mic, MicOff, PhoneOff, RefreshCw,
  ArrowLeft, Users, Shield, Search, Plus, Check, CheckCheck,
  Mail, Hash, Smile, Paperclip, MoreHorizontal, ChevronRight,
  Bell, Archive, Pin, Star, Filter, CircleDot, UserPlus,
  PhoneForwarded, PhoneIncoming, PhoneMissed, MessageCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Device, Call } from '@twilio/voice-sdk'
import { AttachButton, PendingAttachments, AttachmentDisplay, type Attachment } from '@/components/MessageAttachments'
import PatientSearchBar, { type PatientSearchResult } from '@/components/PatientSearchBarInline'

// ═══ TYPES ═══
interface HistoryItem {
  id: string; type: 'call' | 'sms' | 'video' | 'email'; direction: 'inbound' | 'outbound'
  to_number?: string; from_number?: string; message?: string; status?: string
  duration?: number; twilio_sid?: string; recording_url?: string; created_at: string
  patients?: { id: string; first_name: string; last_name: string; phone: string }
}
interface PatientMsg { id: string; patient_id: string; direction: string; subject: string | null; body: string; is_read: boolean; created_at: string; patients?: { first_name: string; last_name: string } }
interface AdminConv { id: string; doctor_name: string; last_message: string; last_message_at: string; unread_count: number; status: string }
interface AdminMsg { id: string; sender_type: string; sender_name: string; content: string; is_read: boolean; created_at: string; metadata?: any }
interface StaffConv { id: string; type: string; name: string | null; last_message_preview: string | null; last_message_at: string | null; staff_conversation_participants: any[] }
interface StaffMsg { id: string; content: string; message_type: string; created_at: string; sender: { first_name: string; last_name: string; role: string } | null; metadata?: any }

type MainTab = 'calls' | 'sms' | 'patient_msgs' | 'staff_chat' | 'admin'
const TAB_CONFIG: { key: MainTab; label: string; icon: typeof Phone }[] = [
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'patient_msgs', label: 'Patient Portal', icon: Mail },
  { key: 'staff_chat', label: 'Staff Chat', icon: Users },
  { key: 'admin', label: 'Admin', icon: Shield },
]

const INP = "w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtTime = (d: string) => { const dt = new Date(d); return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
const fmtDate = (d: string) => { const dt = new Date(d); const now = new Date(); const diff = now.getTime() - dt.getTime(); if (diff < 86400000) return fmtTime(d); if (diff < 172800000) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
const fmtDuration = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toString().padStart(2, '0')}` }

export default function CommunicationCenter() {
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [activeTab, setActiveTab] = useState<MainTab>('calls')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Patient search
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)

  // Calls
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [callStatus, setCallStatus] = useState('Initializing...')
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const deviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // SMS
  const [smsTo, setSmsTo] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSMS, setIsSendingSMS] = useState(false)

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'call' | 'sms'>('all')

  // Patient Messages
  const [patientMsgs, setPatientMsgs] = useState<PatientMsg[]>([])
  const [selectedPtMsg, setSelectedPtMsg] = useState<PatientMsg | null>(null)
  const [ptReply, setPtReply] = useState('')

  // Staff Chat
  const [staffConvs, setStaffConvs] = useState<StaffConv[]>([])
  const [activeStaffConv, setActiveStaffConv] = useState<StaffConv | null>(null)
  const [staffMsgs, setStaffMsgs] = useState<StaffMsg[]>([])
  const [staffNewMsg, setStaffNewMsg] = useState('')
  const [staffId, setStaffId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const addAttachment = (a: Attachment) => setPendingAttachments(prev => [...prev, a])
  const removeAttachment = (i: number) => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))
  const clearAttachments = () => setPendingAttachments([])
  const staffEndRef = useRef<HTMLDivElement>(null)

  // Admin
  const [adminConv, setAdminConv] = useState<AdminConv | null>(null)
  const [adminMsgs, setAdminMsgs] = useState<AdminMsg[]>([])
  const [adminNewMsg, setAdminNewMsg] = useState('')
  const adminEndRef = useRef<HTMLDivElement>(null)

  // Badge counts
  const [unreadPatient, setUnreadPatient] = useState(0)
  const [unreadAdmin, setUnreadAdmin] = useState(0)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const user = await getCurrentUser()
        if (!user?.doctor?.id) return
        setDoctorId(user.doctor.id)
        setDoctorEmail(user.email || '')
        setDoctorName(`${user.doctor.first_name || ''} ${user.doctor.last_name || ''}`.trim())

        // Get staff record for this doctor (for staff chat)
        const { data: staff } = await supabase.from('practice_staff').select('id').eq('email', user.email).limit(1).maybeSingle()
        if (staff) setStaffId(staff.id)

        await Promise.all([fetchHistory(user.doctor.id), fetchPatientMsgs(user.doctor.id), initTwilio(user.email || '')])
        await fetchAdminConv(user.doctor.id, `Dr. ${user.doctor.first_name} ${user.doctor.last_name}`)
        if (staff) await fetchStaffConvs(user.doctor.id, staff.id)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    init()
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); deviceRef.current?.destroy() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ TWILIO ═══
  const initTwilio = async (email: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setCallStatus('No session'); return }
      const res = await fetch('/api/twilio/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ identity: email }) })
      if (!res.ok) { setCallStatus('Token failed'); return }
      const { token } = await res.json()
      if (!token) { setCallStatus('Invalid token'); return }
      const { Device: TwilioDevice } = await import('@twilio/voice-sdk')
      const device = new TwilioDevice(token, { edge: 'ashburn', closeProtection: true })
      device.on('registered', () => { setCallStatus('Ready'); setIsDeviceReady(true) })
      device.on('error', (e: any) => setCallStatus(`Error: ${e.message}`))
      await device.register()
      deviceRef.current = device
    } catch { setCallStatus('Twilio unavailable') }
  }

  const makeCall = async () => {
    if (!deviceRef.current || !phoneNumber) return
    setIsCalling(true); setCallDuration(0); setCallStatus('Connecting...')
    try {
      const call = await deviceRef.current.connect({ params: { To: phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}` } })
      activeCallRef.current = call
      call.on('accept', () => { setCallStatus('Connected'); callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000) })
      call.on('disconnect', () => endCall('Ended'))
      call.on('cancel', () => endCall('Cancelled'))
      call.on('error', () => endCall('Error'))
    } catch { endCall('Failed') }
  }

  const endCall = (status: string) => {
    activeCallRef.current?.disconnect(); activeCallRef.current = null
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    setIsCalling(false); setCallStatus(status)
    if (doctorId) setTimeout(() => fetchHistory(doctorId), 2000)
  }

  // ═══ FETCH FUNCTIONS ═══
  const fetchHistory = async (docId: string) => {
    try {
      const { data } = await supabase.from('communication_logs').select('*, patients(id, first_name, last_name, phone)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(100)
      setHistory((data || []).map((h: any) => ({ ...h, patients: Array.isArray(h.patients) ? h.patients[0] : h.patients })))
    } catch { /* table may not exist */ }
  }

  const fetchPatientMsgs = async (docId: string) => {
    try {
      const { data } = await supabase.from('patient_messages').select('*, patients(first_name, last_name)').eq('doctor_id', docId).order('created_at', { ascending: false }).limit(100)
      const msgs = (data || []).map((m: any) => ({ ...m, patients: Array.isArray(m.patients) ? m.patients[0] : m.patients }))
      setPatientMsgs(msgs)
      setUnreadPatient(msgs.filter((m: PatientMsg) => !m.is_read && m.direction === 'incoming').length)
    } catch { /* table may not exist */ }
  }

  const fetchAdminConv = async (docId: string, name: string) => {
    try {
      const res = await fetch('/api/admin/messaging?action=conversations')
      const d = await res.json()
      const myConv = (d.conversations || []).find((c: any) => c.doctor_id === docId)
      if (myConv) { setAdminConv(myConv); setUnreadAdmin(myConv.unread_count || 0); await fetchAdminMsgs(myConv.id) }
    } catch { /* ok */ }
  }

  const fetchAdminMsgs = async (convId: string) => {
    try {
      const res = await fetch(`/api/admin/messaging?action=messages&conversationId=${convId}`)
      const d = await res.json()
      setAdminMsgs(d.messages || [])
      setTimeout(() => adminEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
  }

  const fetchStaffConvs = async (docId: string, sId: string) => {
    try {
      const res = await fetch(`/api/staff-messages?action=conversations&doctorId=${docId}&staffId=${sId}`)
      const d = await res.json()
      setStaffConvs(d.conversations || [])
    } catch {}
  }

  const fetchStaffMsgs = async (convId: string) => {
    try {
      const res = await fetch(`/api/staff-messages?action=messages&doctorId=${doctorId}&conversationId=${convId}`)
      const d = await res.json()
      setStaffMsgs(d.messages || [])
      setTimeout(() => staffEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
  }

  // ═══ SEND FUNCTIONS ═══
  const sendSMS = async () => {
    if (!smsTo || !smsMessage) return
    setIsSendingSMS(true)
    try {
      const res = await fetch('/api/communication/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: smsTo.startsWith('+') ? smsTo : `+1${smsTo.replace(/\D/g, '')}`, message: smsMessage, patientId: selectedPatient?.id, doctorId }) })
      if (res.ok) { setSmsMessage(''); setSuccess('SMS sent'); setTimeout(() => setSuccess(null), 3000); if (doctorId) fetchHistory(doctorId) }
      else { const e = await res.json(); setError(e.error || 'SMS failed') }
    } catch { setError('SMS failed') }
    finally { setIsSendingSMS(false) }
  }

  const sendPatientReply = async () => {
    if (!selectedPtMsg || !ptReply || !doctorId) return
    try {
      await supabase.from('patient_messages').insert({ patient_id: selectedPtMsg.patient_id, doctor_id: doctorId, direction: 'outgoing', body: ptReply, message_type: 'reply', reply_to_id: selectedPtMsg.id, sent_via: 'portal', attachment_urls: pendingAttachments.length > 0 ? pendingAttachments : null })
      setPtReply(''); clearAttachments(); setSuccess('Reply sent'); setTimeout(() => setSuccess(null), 3000); fetchPatientMsgs(doctorId)
    } catch { setError('Reply failed') }
  }

  const sendAdminMsg = async () => {
    if (!adminConv || !adminNewMsg || !doctorId) return
    try {
      await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', conversationId: adminConv.id, senderType: 'doctor', senderName: doctorName, content: adminNewMsg, attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined }) })
      setAdminNewMsg(''); clearAttachments(); fetchAdminMsgs(adminConv.id)
    } catch { setError('Send failed') }
  }

  const sendStaffMsg = async () => {
    if (!activeStaffConv || !staffNewMsg || !staffId || !doctorId) return
    try {
      await fetch('/api/staff-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_message', doctorId, staffId, conversationId: activeStaffConv.id, content: staffNewMsg, metadata: pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {} }) })
      setStaffNewMsg(''); clearAttachments(); fetchStaffMsgs(activeStaffConv.id)
    } catch { setError('Send failed') }
  }

  // Patient selection
  useEffect(() => {
    if (selectedPatient) {
      const ph = selectedPatient.phone || ''
      setPhoneNumber(ph); setSmsTo(ph)
    }
  }, [selectedPatient])

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history
    return history.filter(h => h.type === historyFilter)
  }, [history, historyFilter])

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white flex flex-col">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#061818] to-[#0a1f1f] border-b border-[#1a3d3d]/30 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold">Communication Center</h1>
              <p className="text-xs text-gray-500">Calls • SMS • Patient Portal • Staff Chat • Admin Messages</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDeviceReady ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-xs text-gray-400">{callStatus}</span>
          </div>
        </div>
        <PatientSearchBar onSelect={setSelectedPatient} placeholder="Search patient for call/message..." />
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#1a3d3d]/30 px-2 overflow-x-auto">
        {TAB_CONFIG.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === t.key ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === 'patient_msgs' && unreadPatient > 0 && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">{unreadPatient}</span>}
            {t.key === 'admin' && unreadAdmin > 0 && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">{unreadAdmin}</span>}
          </button>
        ))}
      </div>

      {/* ALERTS */}
      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400">{success}</div>}

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'calls' && <CallsTab phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} isCalling={isCalling} callStatus={callStatus} callDuration={callDuration} isMuted={isMuted} isDeviceReady={isDeviceReady} makeCall={makeCall} endCall={() => endCall('Ended')} toggleMute={() => { activeCallRef.current?.mute(!isMuted); setIsMuted(!isMuted) }} history={filteredHistory} historyFilter={historyFilter} setHistoryFilter={setHistoryFilter} selectedPatient={selectedPatient} />}
        {activeTab === 'sms' && <SMSTab smsTo={smsTo} setSmsTo={setSmsTo} smsMessage={smsMessage} setSmsMessage={setSmsMessage} isSending={isSendingSMS} sendSMS={sendSMS} history={filteredHistory.filter(h => h.type === 'sms')} selectedPatient={selectedPatient} />}
        {activeTab === 'patient_msgs' && <PatientMsgsTab msgs={patientMsgs} selected={selectedPtMsg} setSelected={setSelectedPtMsg} reply={ptReply} setReply={setPtReply} sendReply={sendPatientReply} pending={pendingAttachments} addAttach={addAttachment} removeAttach={removeAttachment} />}
        {activeTab === 'staff_chat' && <StaffChatTab convs={staffConvs} activeConv={activeStaffConv} setActiveConv={(c: any) => { setActiveStaffConv(c); if (c) fetchStaffMsgs(c.id) }} msgs={staffMsgs} newMsg={staffNewMsg} setNewMsg={setStaffNewMsg} send={sendStaffMsg} endRef={staffEndRef} doctorName={doctorName} pending={pendingAttachments} addAttach={addAttachment} removeAttach={removeAttachment} />}
        {activeTab === 'admin' && <AdminTab conv={adminConv} msgs={adminMsgs} newMsg={adminNewMsg} setNewMsg={setAdminNewMsg} send={sendAdminMsg} endRef={adminEndRef} doctorName={doctorName} pending={pendingAttachments} addAttach={addAttachment} removeAttach={removeAttachment} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════

function CallsTab({ phoneNumber, setPhoneNumber, isCalling, callStatus, callDuration, isMuted, isDeviceReady, makeCall, endCall, toggleMute, history, historyFilter, setHistoryFilter, selectedPatient }: any) {
  const dialPad = ['1','2','3','4','5','6','7','8','9','*','0','#']
  return (
    <div className="flex h-full">
      {/* Dialer */}
      <div className="w-80 border-r border-[#1a3d3d]/30 p-5 flex flex-col">
        {selectedPatient && <div className="mb-3 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-xs"><span className="text-emerald-400 font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span><span className="text-gray-500 ml-2">{selectedPatient.phone}</span></div>}
        <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="Enter phone number" className={`${INP} text-center text-lg font-mono tracking-wider mb-3`} />
        <div className="grid grid-cols-3 gap-2 mb-4">
          {dialPad.map(d => <button key={d} onClick={() => setPhoneNumber((p: string) => p + d)} className="py-3 rounded-lg bg-[#0a1f1f] hover:bg-[#0c2828] text-lg font-semibold transition-colors">{d}</button>)}
        </div>
        {!isCalling ? (
          <button onClick={makeCall} disabled={!isDeviceReady || !phoneNumber} className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"><Phone className="w-5 h-5" />Call</button>
        ) : (
          <div className="space-y-2">
            <div className="text-center"><p className="text-emerald-400 font-bold text-lg">{fmtDuration(callDuration)}</p><p className="text-xs text-gray-500">{callStatus}</p></div>
            <div className="flex gap-2">
              <button onClick={toggleMute} className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${isMuted ? 'bg-amber-600/20 text-amber-400' : 'bg-[#0a1f1f] text-gray-300'}`}>{isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}{isMuted ? 'Unmute' : 'Mute'}</button>
              <button onClick={endCall} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"><PhoneOff className="w-4 h-4" />End</button>
            </div>
          </div>
        )}
      </div>
      {/* History */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a3d3d]/30">
          <h3 className="text-sm font-bold flex-1">Call History</h3>
          {['all','call','sms'].map(f => <button key={f} onClick={() => setHistoryFilter(f)} className={`px-3 py-1 text-xs rounded-full ${historyFilter === f ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}>{f === 'all' ? 'All' : f.toUpperCase()}</button>)}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {history.length === 0 ? <p className="text-center text-gray-600 text-sm py-10">No call history</p> : history.map((h: HistoryItem) => (
            <div key={h.id} className="flex items-center gap-3 p-3 bg-[#0a1f1f] rounded-lg hover:bg-[#0c2828] transition-colors">
              <HistoryIcon type={h.type} direction={h.direction} status={h.status} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{h.patients ? `${h.patients.first_name} ${h.patients.last_name}` : h.to_number || h.from_number || 'Unknown'}</div>
                <div className="text-[10px] text-gray-500">{h.type === 'sms' ? (h.message || '').slice(0, 50) : h.duration ? fmtDuration(h.duration) : h.status || 'No answer'}</div>
              </div>
              <div className="text-[10px] text-gray-600">{fmtDate(h.created_at)}</div>
              {h.type === 'call' && <button onClick={() => setPhoneNumber(h.to_number || h.from_number || '')} className="p-1.5 hover:bg-[#1a3d3d] rounded-lg"><Phone className="w-3.5 h-3.5 text-gray-500" /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SMSTab({ smsTo, setSmsTo, smsMessage, setSmsMessage, isSending, sendSMS, history, selectedPatient }: any) {
  return (
    <div className="flex h-full">
      <div className="w-96 border-r border-[#1a3d3d]/30 p-5 flex flex-col">
        <h3 className="text-sm font-bold mb-3">Send SMS</h3>
        {selectedPatient && <div className="mb-3 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-xs"><span className="text-emerald-400 font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span></div>}
        <input value={smsTo} onChange={e => setSmsTo(e.target.value)} placeholder="Recipient phone number" className={`${INP} mb-3`} />
        <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} placeholder="Type your message..." className={`${INP} flex-1 resize-none min-h-[120px] mb-3`} />
        <button onClick={sendSMS} disabled={isSending || !smsTo || !smsMessage} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2"><Send className="w-4 h-4" />{isSending ? 'Sending...' : 'Send SMS'}</button>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-[#1a3d3d]/30"><h3 className="text-sm font-bold">SMS History</h3></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {history.length === 0 ? <p className="text-center text-gray-600 text-sm py-10">No SMS history</p> : history.map((h: HistoryItem) => (
            <div key={h.id} className="flex items-start gap-3 p-3 bg-[#0a1f1f] rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${h.direction === 'outbound' ? 'bg-emerald-600/20' : 'bg-blue-600/20'}`}>
                <MessageSquare className={`w-4 h-4 ${h.direction === 'outbound' ? 'text-emerald-400' : 'text-blue-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="text-xs font-medium">{h.patients ? `${h.patients.first_name} ${h.patients.last_name}` : h.to_number || 'Unknown'}</span><span className="text-[10px] text-gray-600">{fmtDate(h.created_at)}</span></div>
                <p className="text-xs text-gray-400 mt-0.5">{h.message || '(no content)'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PatientMsgsTab({ msgs, selected, setSelected, reply, setReply, sendReply, pending, addAttach, removeAttach }: any) {
  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-[#1a3d3d]/30 flex flex-col">
        <div className="px-4 py-3 border-b border-[#1a3d3d]/30"><h3 className="text-sm font-bold">Patient Messages</h3></div>
        <div className="flex-1 overflow-y-auto">
          {msgs.length === 0 ? <p className="text-center text-gray-600 text-sm py-10">No patient messages</p> : msgs.map((m: PatientMsg) => (
            <div key={m.id} onClick={() => setSelected(m)} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#1a3d3d]/20 ${selected?.id === m.id ? 'bg-emerald-600/10' : 'hover:bg-[#0a1f1f]'}`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 ${!m.is_read && m.direction === 'incoming' ? 'bg-blue-400' : 'bg-transparent'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between"><span className="text-xs font-medium">{m.patients?.first_name} {m.patients?.last_name}</span><span className="text-[10px] text-gray-600">{fmtDate(m.created_at)}</span></div>
                <p className="text-[11px] text-gray-500 truncate">{m.subject || m.body.slice(0, 60)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="px-5 py-4 border-b border-[#1a3d3d]/30">
              <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${selected.direction === 'incoming' ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>{selected.direction}</span><h3 className="text-sm font-bold">{selected.patients?.first_name} {selected.patients?.last_name}</h3></div>
              {selected.subject && <p className="text-xs text-gray-400 mt-1">{selected.subject}</p>}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-[#0a1f1f] rounded-xl p-4 text-sm text-gray-300 leading-relaxed">{selected.body}</div>
              {selected.attachment_urls && <AttachmentDisplay attachments={selected.attachment_urls} />}
            </div>
            {pending.length > 0 && <PendingAttachments attachments={pending} onRemove={removeAttach} />}
            <div className="p-4 border-t border-[#1a3d3d]/30 flex gap-2">
              <AttachButton onAttach={addAttach} />
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type reply..." className={`${INP} flex-1`} onKeyDown={e => e.key === 'Enter' && sendReply()} />
              <button onClick={sendReply} disabled={!reply} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg"><Send className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><Mail className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500 text-sm">Select a message to view</p></div></div>
        )}
      </div>
    </div>
  )
}

function StaffChatTab({ convs, activeConv, setActiveConv, msgs, newMsg, setNewMsg, send, endRef, doctorName, pending, addAttach, removeAttach }: any) {
  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-[#1a3d3d]/30 flex flex-col">
        <div className="px-4 py-3 border-b border-[#1a3d3d]/30 flex items-center justify-between"><h3 className="text-sm font-bold">Conversations</h3><span className="text-[10px] text-gray-500">{convs.length}</span></div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? <p className="text-center text-gray-600 text-xs py-10">No conversations yet<br /><span className="text-gray-700">Start one in Staff Hub</span></p> : convs.map((c: StaffConv) => {
            const parts = (c.staff_conversation_participants || []).map((p: any) => Array.isArray(p.practice_staff) ? p.practice_staff[0] : p.practice_staff).filter(Boolean)
            const name = c.name || parts.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'Conversation'
            return (
              <div key={c.id} onClick={() => setActiveConv(c)} className={`px-4 py-3 cursor-pointer border-b border-[#1a3d3d]/20 transition-colors ${activeConv?.id === c.id ? 'bg-emerald-600/10' : 'hover:bg-[#0a1f1f]'}`}>
                <div className="flex items-center justify-between"><span className="text-xs font-medium truncate">{name}</span>{c.last_message_at && <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(c.last_message_at)}</span>}</div>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{c.last_message_preview || 'No messages yet'}</p>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {activeConv ? (
          <>
            <div className="px-5 py-3 border-b border-[#1a3d3d]/30"><h3 className="text-sm font-bold">{activeConv.name || 'Chat'}</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.map((m: StaffMsg) => {
                const isMe = m.sender?.first_name && doctorName.includes(m.sender.first_name)
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${m.message_type === 'system' ? 'bg-[#1a3d3d]/30 text-gray-500 text-[10px] text-center w-full max-w-full' : isMe ? 'bg-emerald-600/20 text-emerald-100' : 'bg-[#0a1f1f] text-gray-300'}`}>
                      {!isMe && m.message_type !== 'system' && <div className="text-[10px] text-gray-500 mb-0.5">{m.sender?.first_name} {m.sender?.last_name}</div>}
                      <p className="text-xs leading-relaxed">{m.content}</p>
                      {m.metadata?.attachments && <AttachmentDisplay attachments={m.metadata.attachments} />}
                      <div className={`text-[9px] mt-1 ${isMe ? 'text-emerald-500 text-right' : 'text-gray-600'}`}>{fmtTime(m.created_at)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            {pending.length > 0 && <PendingAttachments attachments={pending} onRemove={removeAttach} />}
            <div className="p-3 border-t border-[#1a3d3d]/30 flex gap-2">
              <AttachButton onAttach={addAttach} />
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className={`${INP} flex-1`} onKeyDown={e => e.key === 'Enter' && send()} />
              <button onClick={send} disabled={!newMsg} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg"><Send className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><Users className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500 text-sm">Select a conversation</p><p className="text-gray-700 text-xs mt-1">or start one in Staff Hub</p></div></div>
        )}
      </div>
    </div>
  )
}

function AdminTab({ conv, msgs, newMsg, setNewMsg, send, endRef, doctorName, pending, addAttach, removeAttach }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-[#1a3d3d]/30 flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-bold">Admin Messages</h3></div>
      {!conv ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-center"><Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500 text-sm">No admin conversation yet</p><p className="text-gray-700 text-xs mt-1">Admin will reach out when needed</p></div></div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {msgs.length === 0 && <p className="text-center text-gray-600 text-xs py-10">No messages yet — send the first one</p>}
            {msgs.map((m: AdminMsg) => {
              const isMe = m.sender_type === 'doctor'
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${isMe ? 'bg-emerald-600/20 text-emerald-100' : 'bg-amber-600/10 text-amber-100'}`}>
                    <div className={`text-[10px] mb-0.5 ${isMe ? 'text-emerald-500' : 'text-amber-500'}`}>{isMe ? doctorName : m.sender_name || 'Admin'}</div>
                    <p className="text-xs leading-relaxed">{m.content}</p>
                    {m.metadata?.attachments && <AttachmentDisplay attachments={m.metadata.attachments} />}
                    <div className={`text-[9px] mt-1 ${isMe ? 'text-emerald-500 text-right' : 'text-amber-600'}`}>{fmtTime(m.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
          {pending.length > 0 && <PendingAttachments attachments={pending} onRemove={removeAttach} />}
          <div className="p-3 border-t border-[#1a3d3d]/30 flex gap-2">
            <AttachButton onAttach={addAttach} />
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Message admin..." className={`${INP} flex-1`} onKeyDown={e => e.key === 'Enter' && send()} />
            <button onClick={send} disabled={!newMsg} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg"><Send className="w-4 h-4" /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ═══ HELPER COMPONENTS ═══
function HistoryIcon({ type, direction, status }: { type: string; direction: string; status?: string }) {
  const missed = status === 'no-answer' || status === 'busy' || status === 'failed'
  if (type === 'sms') return <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-purple-400" /></div>
  if (missed) return <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center"><PhoneMissed className="w-4 h-4 text-red-400" /></div>
  if (direction === 'inbound') return <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center"><PhoneIncoming className="w-4 h-4 text-blue-400" /></div>
  return <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center"><PhoneForwarded className="w-4 h-4 text-green-400" /></div>
}
