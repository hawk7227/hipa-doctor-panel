'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, X, Send, Shield, Users, ChevronRight,
  Phone, Clock, ArrowLeft, Video, VideoOff, Mic, MicOff,
  PhoneOff, Monitor, MonitorOff, Circle, Square,
  Volume2, VolumeX, Bell, BellOff, Settings, Download,
  Loader2, Play, Pause, CheckCircle2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { AttachButton, PendingAttachments, AttachmentDisplay, type Attachment } from '@/components/MessageAttachments'

// ═══ TYPES ═══
interface AdminMsg { id: string; sender_type: string; sender_name: string; content: string; is_read: boolean; created_at: string; metadata?: any }
interface StaffConv { id: string; type: string; name: string | null; last_message_preview: string | null; last_message_at: string | null; staff_conversation_participants: any[] }
interface StaffMsg { id: string; content: string; message_type: string; created_at: string; sender: { first_name: string; last_name: string; role: string } | null; metadata?: any }
interface StaffMember { id: string; first_name: string; last_name: string; role: string; email: string; active: boolean; last_login_at?: string }

type View = 'home' | 'admin' | 'staff_list' | 'staff_chat' | 'team_status' | 'call' | 'settings'
type SoundTheme = 'chime' | 'pop' | 'ding' | 'retro' | 'none'
const THEMES: { key: SoundTheme; label: string }[] = [
  { key: 'chime', label: '🔔 Chime' }, { key: 'pop', label: '💬 Pop' },
  { key: 'ding', label: '🛎️ Ding' }, { key: 'retro', label: '🕹️ Retro' },
  { key: 'none', label: '🔇 Silent' },
]

const INP = "w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: string) => { const dt = new Date(d); const diff = Date.now() - dt.getTime(); if (diff < 86400000) return fmtTime(d); if (diff < 172800000) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

// ═══ SOUND ENGINE ═══
function playSound(theme: SoundTheme, type: 'message' | 'call' | 'send' = 'message') {
  if (theme === 'none') return
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const play = (freq: number, start: number, dur: number, wave: OscillatorType = 'sine', vol = 0.12) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = wave
      g.gain.setValueAtTime(vol, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur)
    }
    if (type === 'call') { // Ring
      for (let i = 0; i < 3; i++) { play(800, i * 0.3, 0.15); play(1000, i * 0.3 + 0.15, 0.12) }
    } else if (theme === 'chime') { play(880, 0, 0.2); play(1320, 0.12, 0.2) }
    else if (theme === 'pop') { play(600, 0, 0.08, 'triangle', 0.15); play(900, 0.06, 0.1, 'triangle', 0.1) }
    else if (theme === 'ding') { play(1200, 0, 0.3, 'sine', 0.08) }
    else if (theme === 'retro') { play(440, 0, 0.05, 'square', 0.08); play(660, 0.06, 0.05, 'square', 0.08); play(880, 0.12, 0.08, 'square', 0.06) }
    setTimeout(() => ctx.close(), 3000)
  } catch {}
}

export default function FloatingMessenger() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('home')
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')
  const [staffId, setStaffId] = useState<string | null>(null)

  // Admin
  const [adminConv, setAdminConv] = useState<any>(null)
  const [adminMsgs, setAdminMsgs] = useState<AdminMsg[]>([])
  const [adminMsg, setAdminMsg] = useState('')
  const [unreadAdmin, setUnreadAdmin] = useState(0)
  const adminEndRef = useRef<HTMLDivElement>(null)
  const prevAdminCount = useRef(0)

  // Staff
  const [staffConvs, setStaffConvs] = useState<StaffConv[]>([])
  const [activeStaffConv, setActiveStaffConv] = useState<StaffConv | null>(null)
  const [staffMsgs, setStaffMsgs] = useState<StaffMsg[]>([])
  const [staffMsg, setStaffMsg] = useState('')
  const staffEndRef = useRef<HTMLDivElement>(null)
  const prevStaffCount = useRef(0)

  // Team
  const [team, setTeam] = useState<StaffMember[]>([])

  // Attachments
  const [pending, setPending] = useState<Attachment[]>([])

  // Call state
  const [callActive, setCallActive] = useState(false)
  const [callType, setCallType] = useState<'audio' | 'video'>('audio')
  const [callTarget, setCallTarget] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Screen recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recChunksRef = useRef<Blob[]>([])
  const recTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Settings
  const [soundTheme, setSoundTheme] = useState<SoundTheme>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('msg_sound_theme') as SoundTheme) || 'chime'
    return 'chime'
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('msg_sound_enabled') !== 'false'
    return true
  })
  const [desktopNotifs, setDesktopNotifs] = useState(false)

  useEffect(() => { localStorage.setItem('msg_sound_theme', soundTheme) }, [soundTheme])
  useEffect(() => { localStorage.setItem('msg_sound_enabled', String(soundEnabled)) }, [soundEnabled])

  // ═══ INIT ═══
  useEffect(() => {
    const init = async () => {
      try {
        const user = await getCurrentUser()
        if (!user?.doctor?.id) return
        setDoctorId(user.doctor.id)
        setDoctorEmail(user.email || '')
        setDoctorName(`Dr. ${user.doctor.first_name} ${user.doctor.last_name}`)
        const { data: staff } = await supabase.from('practice_staff').select('id').eq('email', user.email).limit(1).single()
        if (staff) setStaffId(staff.id)
        const { data: tm } = await supabase.from('practice_staff').select('id, first_name, last_name, role, email, active, last_login_at').eq('doctor_id', user.doctor.id).order('first_name')
        setTeam(tm || [])
        // Admin conv
        try {
          const res = await fetch('/api/admin/messaging?action=conversations')
          const d = await res.json()
          const myConv = (d.conversations || []).find((c: any) => c.doctor_id === user?.doctor?.id)
          if (myConv) { setAdminConv(myConv); setUnreadAdmin(myConv.unread_count || 0) }
        } catch {}
        // Staff convs
        if (staff) {
          try {
            const res = await fetch(`/api/staff-messages?action=conversations&doctorId=${user.doctor.id}&staffId=${staff.id}`)
            setStaffConvs((await res.json()).conversations || [])
          } catch {}
        }
        // Desktop notif permission
        if ('Notification' in window && Notification.permission === 'granted') setDesktopNotifs(true)
      } catch {}
    }
    init()
    const interval = setInterval(init, 30000)
    return () => { clearInterval(interval); stopCall(); stopRecording() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sound on new messages
  useEffect(() => {
    if (adminMsgs.length > prevAdminCount.current && prevAdminCount.current > 0 && soundEnabled) {
      const last = adminMsgs[adminMsgs.length - 1]
      if (last?.sender_type !== 'doctor') playSound(soundTheme)
    }
    prevAdminCount.current = adminMsgs.length
  }, [adminMsgs.length, soundEnabled, soundTheme]) // eslint-disable-line

  useEffect(() => {
    if (staffMsgs.length > prevStaffCount.current && prevStaffCount.current > 0 && soundEnabled) {
      const last = staffMsgs[staffMsgs.length - 1]
      if (last?.sender && !doctorName.includes(last.sender.first_name)) playSound(soundTheme)
    }
    prevStaffCount.current = staffMsgs.length
  }, [staffMsgs.length, soundEnabled, soundTheme, doctorName])

  // ═══ FETCH ═══
  const fetchAdminMsgs = useCallback(async () => {
    if (!adminConv?.id) return
    try {
      const res = await fetch(`/api/admin/messaging?action=messages&conversationId=${adminConv.id}`)
      const d = await res.json()
      setAdminMsgs(d.messages || [])
      setTimeout(() => adminEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { console.error('fetchAdminMsgs:', e) }
  }, [adminConv])

  const fetchStaffMsgs = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/staff-messages?action=messages&doctorId=${doctorId}&conversationId=${convId}`)
      setStaffMsgs((await res.json()).messages || [])
      setTimeout(() => staffEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
  }, [doctorId])

  // ═══ SEND ═══
  const sendAdmin = async () => {
    if (!adminMsg.trim() || !doctorId) return
    try {
      let convId = adminConv?.id
      // Auto-create conversation if none exists
      if (!convId) {
        const createRes = await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_conversation', doctorId, doctorName, doctorSpecialty: '' }) })
        const createData = await createRes.json()
        if (createData.conversation) { setAdminConv(createData.conversation); convId = createData.conversation.id }
        else { console.error('Failed to create conversation:', createData); return }
      }
      const res = await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', conversationId: convId, senderType: 'doctor', senderName: doctorName, content: adminMsg, attachments: pending.length > 0 ? pending : undefined }) })
      const data = await res.json()
      if (data.error) { console.error('Send error:', data.error); return }
      if (soundEnabled) playSound(soundTheme, 'send')
      setAdminMsg(''); setPending([]); fetchAdminMsgs()
    } catch (e) { console.error('sendAdmin error:', e) }
  }
  const sendStaff = async () => {
    if (!activeStaffConv || !staffMsg.trim() || !staffId || !doctorId) return
    await fetch('/api/staff-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_message', doctorId, staffId, conversationId: activeStaffConv.id, content: staffMsg, metadata: pending.length > 0 ? { attachments: pending } : {} }) })
    if (soundEnabled) playSound(soundTheme, 'send')
    setStaffMsg(''); setPending([]); fetchStaffMsgs(activeStaffConv.id)
  }

  useEffect(() => { if (view === 'admin' && adminConv) fetchAdminMsgs() }, [view, adminConv, fetchAdminMsgs])

  // ═══ CALL ═══
  const startCall = async (type: 'audio' | 'video', target: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
      localStreamRef.current = stream
      if (type === 'video' && localVideoRef.current) { localVideoRef.current.srcObject = stream }
      setCallActive(true); setCallType(type); setCallTarget(target); setCallDuration(0)
      if (soundEnabled) playSound(soundTheme, 'call')
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    } catch { alert('Could not access microphone/camera') }
  }
  const stopCall = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null; screenStreamRef.current = null
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    setCallActive(false); setIsScreenSharing(false); setIsMuted(false); setIsVideoOff(false)
  }
  const toggleMute = () => {
    const audio = localStreamRef.current?.getAudioTracks()[0]
    if (audio) { audio.enabled = !audio.enabled; setIsMuted(!audio.enabled) }
  }
  const toggleVideo = () => {
    const video = localStreamRef.current?.getVideoTracks()[0]
    if (video) { video.enabled = !video.enabled; setIsVideoOff(!video.enabled) }
  }
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; setIsScreenSharing(false)
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenStreamRef.current = screen; setIsScreenSharing(true)
        screen.getVideoTracks()[0].onended = () => { setIsScreenSharing(false); screenStreamRef.current = null }
      } catch {}
    }
  }

  // ═══ SCREEN RECORDING ═══
  const startRecording = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true })
      const recorder = new MediaRecorder(screen, { mimeType: 'video/webm;codecs=vp9,opus' })
      recChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        screen.getTracks().forEach(t => t.stop())
        if (recTimerRef.current) clearInterval(recTimerRef.current)
      }
      screen.getVideoTracks()[0].onended = () => recorder.stop()
      recorder.start(1000)
      recorderRef.current = recorder; setIsRecording(true); setRecordingTime(0)
      recTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
    } catch {}
  }
  const stopRecording = () => { recorderRef.current?.stop(); setIsRecording(false); if (recTimerRef.current) clearInterval(recTimerRef.current) }

  const sendRecording = async () => {
    if (!recordedBlob) return
    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.some(b => b.name === 'messaging-attachments')) await supabase.storage.createBucket('messaging-attachments', { public: true })
      const path = `recordings/${Date.now()}-screen.webm`
      await supabase.storage.from('messaging-attachments').upload(path, recordedBlob)
      const { data: urlData } = supabase.storage.from('messaging-attachments').getPublicUrl(path)
      const att: Attachment = { name: 'Screen Recording.webm', url: urlData.publicUrl, type: 'video/webm', size: recordedBlob.size, path }
      setPending(prev => [...prev, att])
      setRecordedBlob(null)
    } catch { alert('Upload failed') }
  }

  const requestDesktopNotifs = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission()
      setDesktopNotifs(perm === 'granted')
    }
  }

  const totalUnread = unreadAdmin
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <>
      {/* BUBBLE */}
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95" style={{ position: 'fixed' }}>
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && totalUnread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">{totalUnread}</span>}
      </button>

      {/* PANEL */}
      {open && (
        <div className={`fixed z-[9998] bg-[#071414] border border-[#1a3d3d]/60 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden transition-all ${callActive && callType === 'video' ? 'bottom-6 right-6 w-[480px] h-[600px]' : 'bottom-24 right-6 w-[380px] h-[520px]'}`}>
          {/* Header */}
          <div className="bg-[#0a1f1f] px-4 py-2.5 border-b border-[#1a3d3d]/40 flex items-center gap-2 shrink-0">
            {view !== 'home' && !callActive && <button onClick={() => { if (view === 'staff_chat') { setView('staff_list'); setActiveStaffConv(null) } else setView('home') }} className="p-1 hover:bg-[#1a3d3d]/30 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {callActive ? `${callType === 'video' ? '📹' : '📞'} ${callTarget}` : view === 'home' ? 'Messages' : view === 'admin' ? 'Admin Support' : view === 'staff_list' ? 'Staff Chat' : view === 'staff_chat' ? (activeStaffConv?.name || 'Chat') : view === 'team_status' ? 'Team Status' : 'Settings'}
              </h3>
              {callActive && <p className="text-[10px] text-emerald-400 font-mono">{fmtDur(callDuration)}</p>}
            </div>
            <div className="flex items-center gap-1">
              {(view === 'admin' || view === 'staff_chat') && !callActive && (
                <>
                  <button onClick={() => startCall('audio', view === 'admin' ? 'Admin' : activeStaffConv?.name || 'Staff')} className="p-1.5 hover:bg-green-600/20 rounded-lg" title="Audio Call"><Phone className="w-3.5 h-3.5 text-green-400" /></button>
                  <button onClick={() => startCall('video', view === 'admin' ? 'Admin' : activeStaffConv?.name || 'Staff')} className="p-1.5 hover:bg-blue-600/20 rounded-lg" title="Video Call"><Video className="w-3.5 h-3.5 text-blue-400" /></button>
                </>
              )}
              {view === 'home' && <button onClick={() => setView('settings')} className="p-1.5 hover:bg-[#1a3d3d]/30 rounded-lg"><Settings className="w-3.5 h-3.5 text-gray-400" /></button>}
            </div>
          </div>

          {/* CALL UI */}
          {callActive ? (
            <div className="flex-1 flex flex-col">
              {callType === 'video' && (
                <div className="flex-1 bg-black relative">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {isVideoOff && <div className="absolute inset-0 bg-[#071414] flex items-center justify-center"><VideoOff className="w-12 h-12 text-gray-600" /></div>}
                  {isScreenSharing && <div className="absolute top-2 left-2 px-2 py-1 bg-red-600/80 rounded text-[10px] text-white font-bold flex items-center gap-1"><Monitor className="w-3 h-3" />Sharing Screen</div>}
                </div>
              )}
              {callType === 'audio' && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center"><div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-3"><Phone className="w-8 h-8 text-emerald-400" /></div><p className="text-sm font-bold">{callTarget}</p><p className="text-emerald-400 font-mono text-lg">{fmtDur(callDuration)}</p></div>
                </div>
              )}
              {/* Call controls */}
              <div className="p-3 bg-[#0a1f1f] border-t border-[#1a3d3d]/40 flex items-center justify-center gap-3">
                <button onClick={toggleMute} className={`p-2.5 rounded-full ${isMuted ? 'bg-red-600/20 text-red-400' : 'bg-[#1a3d3d]/30 text-white'}`}>{isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
                {callType === 'video' && <button onClick={toggleVideo} className={`p-2.5 rounded-full ${isVideoOff ? 'bg-red-600/20 text-red-400' : 'bg-[#1a3d3d]/30 text-white'}`}>{isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}</button>}
                <button onClick={toggleScreenShare} className={`p-2.5 rounded-full ${isScreenSharing ? 'bg-blue-600/20 text-blue-400' : 'bg-[#1a3d3d]/30 text-white'}`} title="Share Screen">{isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}</button>
                <button onClick={stopCall} className="p-2.5 rounded-full bg-red-600 text-white hover:bg-red-700"><PhoneOff className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <>
              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {view === 'home' && <HomeView unreadAdmin={unreadAdmin} staffConvCount={staffConvs.length} teamCount={team.length} onNav={setView} hasAdminConv={!!adminConv} isRecording={isRecording} recordedBlob={recordedBlob} recordingTime={recordingTime} startRecording={startRecording} stopRecording={stopRecording} sendRecording={sendRecording} fmtDur={fmtDur} />}
                {view === 'admin' && <ChatView msgs={adminMsgs} doctorName={doctorName} isStaff={false} endRef={adminEndRef} />}
                {view === 'staff_list' && <StaffListView convs={staffConvs} onSelect={(c: StaffConv) => { setActiveStaffConv(c); setView('staff_chat'); fetchStaffMsgs(c.id) }} />}
                {view === 'staff_chat' && <ChatView msgs={staffMsgs} doctorName={doctorName} isStaff endRef={staffEndRef} />}
                {view === 'team_status' && <TeamStatusView team={team} />}
                {view === 'settings' && <SettingsView soundTheme={soundTheme} setSoundTheme={setSoundTheme} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} desktopNotifs={desktopNotifs} requestDesktopNotifs={requestDesktopNotifs} />}
              </div>

              {/* Compose */}
              {(view === 'admin' || view === 'staff_chat') && (
                <div className="border-t border-[#1a3d3d]/40 shrink-0">
                  {pending.length > 0 && <PendingAttachments attachments={pending} onRemove={(i) => setPending(prev => prev.filter((_, idx) => idx !== i))} />}
                  <div className="p-2.5 flex gap-1.5">
                    <AttachButton onAttach={(a) => setPending(prev => [...prev, a])} />
                    <input value={view === 'admin' ? adminMsg : staffMsg} onChange={e => view === 'admin' ? setAdminMsg(e.target.value) : setStaffMsg(e.target.value)} placeholder="Type a message..." className={`${INP} flex-1 text-xs py-1.5`}
                      onKeyDown={e => { if (e.key === 'Enter') { view === 'admin' ? sendAdmin() : sendStaff() } }} />
                    <button onClick={view === 'admin' ? sendAdmin : sendStaff} className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"><Send className="w-3.5 h-3.5 text-white" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

// ═══ SUB-VIEWS ═══

function HomeView({ unreadAdmin, staffConvCount, teamCount, onNav, hasAdminConv, isRecording, recordedBlob, recordingTime, startRecording, stopRecording, sendRecording, fmtDur }: any) {
  return (
    <div className="p-3 space-y-2">
      <NavBtn icon={Shield} iconBg="bg-amber-600/20" iconColor="text-amber-400" label="Admin Support" sub={hasAdminConv ? 'Message platform admin' : 'Start conversation'} badge={unreadAdmin} onClick={() => onNav('admin')} />
      <NavBtn icon={Users} iconBg="bg-blue-600/20" iconColor="text-blue-400" label="Staff Chat" sub={`${staffConvCount} conversation${staffConvCount !== 1 ? 's' : ''}`} onClick={() => onNav('staff_list')} />
      <NavBtn icon={Clock} iconBg="bg-purple-600/20" iconColor="text-purple-400" label="Team Status" sub={`${teamCount} staff — activity log`} onClick={() => onNav('team_status')} />

      {/* Screen Recording */}
      <div className="pt-2 border-t border-[#1a3d3d]/30">
        <p className="text-[10px] text-gray-500 px-1 mb-2 font-medium uppercase tracking-wider">Screen Recording</p>
        {isRecording ? (
          <div className="flex items-center gap-2 p-3 bg-red-600/10 border border-red-500/30 rounded-xl">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-mono flex-1">Recording {fmtDur(recordingTime)}</span>
            <button onClick={stopRecording} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 flex items-center gap-1"><Square className="w-3 h-3" />Stop</button>
          </div>
        ) : recordedBlob ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-600/10 border border-emerald-500/30 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 flex-1">Recording ready ({(recordedBlob.size / 1024 / 1024).toFixed(1)}MB)</span>
            <button onClick={sendRecording} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"><Send className="w-3 h-3" />Attach</button>
          </div>
        ) : (
          <button onClick={startRecording} className="w-full flex items-center gap-3 p-3 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center"><Circle className="w-5 h-5 text-red-400" /></div>
            <div className="text-left"><div className="text-xs font-semibold">Record Screen</div><div className="text-[10px] text-gray-500">Capture & send via message</div></div>
          </button>
        )}
      </div>
    </div>
  )
}

function NavBtn({ icon: I, iconBg, iconColor, label, sub, badge, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-xl transition-colors text-left">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}><I className={`w-5 h-5 ${iconColor}`} /></div>
      <div className="flex-1"><div className="text-xs font-semibold text-white">{label}</div><div className="text-[10px] text-gray-500">{sub}</div></div>
      {badge > 0 && <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">{badge}</span>}
      <ChevronRight className="w-4 h-4 text-gray-600" />
    </button>
  )
}

function ChatView({ msgs, doctorName, isStaff, endRef }: any) {
  return (
    <div className="p-3 space-y-2">
      {msgs.length === 0 && <p className="text-center text-gray-600 text-xs py-8">No messages yet</p>}
      {msgs.map((m: any) => {
        let isMe = isStaff ? (m.sender && doctorName.includes(m.sender.first_name)) : m.sender_type === 'doctor'
        const sender = isStaff ? (m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : '') : (isMe ? doctorName : (m.sender_name || 'Admin'))
        if (m.message_type === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-600 py-1">{m.content}</div>
        return (
          <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMe ? 'bg-emerald-600/15' : isStaff ? 'bg-[#0a1f1f]' : 'bg-amber-600/10'}`}>
              <div className={`text-[9px] font-medium mb-0.5 ${isMe ? 'text-emerald-500' : isStaff ? 'text-blue-400' : 'text-amber-400'}`}>{sender}</div>
              <p className="text-xs text-gray-200 leading-relaxed">{m.content}</p>
              {m.metadata?.attachments && <AttachmentDisplay attachments={m.metadata.attachments} />}
              <div className={`text-[8px] mt-1 ${isMe ? 'text-emerald-600 text-right' : 'text-gray-600'}`}>{fmtTime(m.created_at)}</div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}

function StaffListView({ convs, onSelect }: { convs: StaffConv[]; onSelect: (c: StaffConv) => void }) {
  return (
    <div className="p-2 space-y-1">
      {convs.length === 0 ? <p className="text-center text-gray-600 text-xs py-8">No conversations<br /><span className="text-gray-700">Start one from Staff Hub</span></p> : convs.map(c => {
        const parts = (c.staff_conversation_participants || []).map((p: any) => Array.isArray(p.practice_staff) ? p.practice_staff[0] : p.practice_staff).filter(Boolean)
        const name = c.name || parts.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'Chat'
        return (
          <button key={c.id} onClick={() => onSelect(c)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#0a1f1f] rounded-lg transition-colors text-left">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center"><Users className="w-4 h-4 text-blue-400" /></div>
            <div className="flex-1 min-w-0"><div className="text-xs font-medium truncate">{name}</div><div className="text-[10px] text-gray-500 truncate">{c.last_message_preview || 'No messages'}</div></div>
            {c.last_message_at && <span className="text-[9px] text-gray-600 shrink-0">{fmtDate(c.last_message_at)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function TeamStatusView({ team }: { team: StaffMember[] }) {
  const now = Date.now()
  return (
    <div className="p-3 space-y-1">
      {team.length === 0 ? <p className="text-center text-gray-600 text-xs py-8">No staff members</p> : team.map(s => {
        const online = s.last_login_at && (now - new Date(s.last_login_at).getTime() < 30 * 60 * 1000)
        const dot = !s.active ? 'bg-red-500' : online ? 'bg-green-500' : 'bg-gray-600'
        const label = !s.active ? 'Inactive' : online ? 'Online' : 'Offline'
        const color = !s.active ? 'text-red-400' : online ? 'text-green-400' : 'text-gray-500'
        return (
          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1f1f] rounded-lg">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-[#061818] flex items-center justify-center text-xs font-bold text-gray-400">{s.first_name[0]}{s.last_name[0]}</div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${dot} rounded-full border-2 border-[#0a1f1f]`} />
            </div>
            <div className="flex-1 min-w-0"><div className="text-xs font-medium">{s.first_name} {s.last_name}</div><div className="text-[10px] text-gray-500">{s.role}</div></div>
            <div className="text-right"><div className={`text-[10px] font-medium ${color}`}>{label}</div><div className="text-[9px] text-gray-600">{s.last_login_at ? fmtDate(s.last_login_at) : '—'}</div></div>
          </div>
        )
      })}
    </div>
  )
}

function SettingsView({ soundTheme, setSoundTheme, soundEnabled, setSoundEnabled, desktopNotifs, requestDesktopNotifs }: any) {
  return (
    <div className="p-4 space-y-4">
      {/* Sound toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-gray-400" /><span className="text-sm">Message Sounds</span></div>
        <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-10 h-5 rounded-full transition-colors flex items-center ${soundEnabled ? 'bg-emerald-600 justify-end' : 'bg-gray-700 justify-start'}`}>
          <div className="w-4 h-4 bg-white rounded-full mx-0.5" />
        </button>
      </div>

      {/* Sound theme */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">Sound Theme</p>
        <div className="grid grid-cols-1 gap-1.5">
          {THEMES.map(t => (
            <button key={t.key} onClick={() => { setSoundTheme(t.key); if (t.key !== 'none') playSound(t.key) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${soundTheme === t.key ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400' : 'bg-[#0a1f1f] text-gray-400 hover:bg-[#0c2828]'}`}>
              <span>{t.label}</span>
              {soundTheme === t.key && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop notifications */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">Desktop Notifications</p>
        {desktopNotifs ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg"><Bell className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400">Enabled</span></div>
        ) : (
          <button onClick={requestDesktopNotifs} className="w-full px-3 py-2 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-lg text-xs text-gray-400 flex items-center gap-2"><BellOff className="w-4 h-4" />Enable Desktop Notifications</button>
        )}
      </div>

      {/* Preview */}
      <button onClick={() => playSound(soundTheme)} disabled={soundTheme === 'none'} className="w-full px-3 py-2.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-600/30 disabled:opacity-40 flex items-center justify-center gap-2">
        <Play className="w-3.5 h-3.5" />Preview Sound
      </button>
    </div>
  )
}
