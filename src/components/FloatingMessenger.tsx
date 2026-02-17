// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, X, Send, Shield, Users, ChevronRight,
  Phone, Clock, ArrowLeft, Video,
  PhoneOff, Circle, Square,
  Volume2, VolumeX, Bell, BellOff, Settings, Download,
  Loader2, Play, Pause, CheckCircle2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/auth-fetch'
import { getCurrentUser } from '@/lib/auth'
import { AttachButton, PendingAttachments, AttachmentDisplay, type Attachment } from '@/components/MessageAttachments'

// ═══ TYPES ═══
interface AdminMsg { id: string; sender_type: string; sender_name: string; content: string; is_read: boolean; created_at: string; metadata?: any }
interface StaffConv { id: string; type: string; name: string | null; last_message_preview: string | null; last_message_at: string | null; staff_conversation_participants: any[] }
interface StaffMsg { id: string; content: string; message_type: string; created_at: string; sender: { first_name: string; last_name: string; role: string } | null; metadata?: any }
interface StaffMember { id: string; first_name: string; last_name: string; role: string; email: string; active: boolean; last_login_at?: string }

type View = 'home' | 'admin' | 'staff_list' | 'staff_chat' | 'team_status' | 'call' | 'settings'
type SoundTheme = 'chime' | 'pop' | 'ding' | 'retro' | 'bubble' | 'marimba' | 'arcade' | 'xylophone' | 'doorbell' | 'none'
const THEMES: { key: SoundTheme; label: string; desc: string }[] = [
  { key: 'chime', label: '🔔 Chime', desc: 'Melodic 4-note bell' },
  { key: 'pop', label: '💬 Pop', desc: 'Bouncy triple pop' },
  { key: 'ding', label: '🛎️ Ding', desc: 'Rich resonant bell' },
  { key: 'retro', label: '🕹️ Retro', desc: '8-bit game sound' },
  { key: 'bubble', label: '🫧 Bubble', desc: 'Rising underwater bubbles' },
  { key: 'marimba', label: '🎵 Marimba', desc: 'Warm wooden notes' },
  { key: 'arcade', label: '🪙 Arcade', desc: 'Coin collect cascade' },
  { key: 'xylophone', label: '🎶 Xylophone', desc: 'Bright sparkling notes' },
  { key: 'doorbell', label: '🚪 Doorbell', desc: 'Classic ding-dong' },
  { key: 'none', label: '🔇 Silent', desc: 'No sound' },
]

const INP = "w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: string) => { const dt = new Date(d); const diff = Date.now() - dt.getTime(); if (diff < 86400000) return fmtTime(d); if (diff < 172800000) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

// ═══ SOUND ENGINE — LOUDER, LONGER, MORE FUN ═══
function playSound(theme: SoundTheme, type: 'message' | 'call' | 'send' = 'message', volume = 0.8, repeat = 1) {
  if (theme === 'none') return
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const v = volume * 0.5 // scale to safe range but much louder than before
    const p = (freq: number, start: number, dur: number, wave: OscillatorType = 'sine', vol = v) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = wave
      g.gain.setValueAtTime(vol, ctx.currentTime + start)
      g.gain.setValueAtTime(vol, ctx.currentTime + start + dur * 0.6)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur)
    }
    const playOnce = (offset: number) => {
      if (type === 'call') { // Long ring — 6 alternating tones
        for (let i = 0; i < 6; i++) { p(880, offset + i * 0.18, 0.12, 'sine', v * 1.2); p(1100, offset + i * 0.18 + 0.09, 0.12, 'sine', v * 1.2) }
      } else if (type === 'send') { // Quick whoosh-up
        p(400, offset, 0.06, 'sine', v * 0.5); p(800, offset + 0.05, 0.06, 'sine', v * 0.4); p(1200, offset + 0.1, 0.1, 'sine', v * 0.3)
      } else if (theme === 'chime') { // Melodic 4-note chime — C E G C
        p(523, offset, 0.2, 'sine', v); p(659, offset + 0.15, 0.2, 'sine', v); p(784, offset + 0.3, 0.2, 'sine', v * 1.1); p(1047, offset + 0.45, 0.4, 'sine', v * 1.3)
      } else if (theme === 'pop') { // Bouncy double pop
        p(600, offset, 0.1, 'triangle', v * 1.2); p(900, offset + 0.08, 0.12, 'triangle', v * 1.0); p(1200, offset + 0.2, 0.15, 'triangle', v * 0.8)
      } else if (theme === 'ding') { // Rich bell with harmonics
        p(1200, offset, 0.5, 'sine', v * 1.0); p(2400, offset, 0.3, 'sine', v * 0.3); p(3600, offset, 0.15, 'sine', v * 0.1)
      } else if (theme === 'retro') { // 8-bit game notification
        p(440, offset, 0.06, 'square', v * 0.6); p(554, offset + 0.07, 0.06, 'square', v * 0.6); p(659, offset + 0.14, 0.06, 'square', v * 0.6); p(880, offset + 0.21, 0.12, 'square', v * 0.8)
      } else if (theme === 'bubble') { // Underwater bubble rising
        p(300, offset, 0.08, 'sine', v * 0.8); p(500, offset + 0.06, 0.08, 'sine', v * 0.9); p(800, offset + 0.12, 0.1, 'sine', v * 1.0); p(1300, offset + 0.2, 0.15, 'sine', v * 0.7)
      } else if (theme === 'marimba') { // Warm marimba hit
        p(523, offset, 0.3, 'triangle', v * 1.0); p(659, offset + 0.12, 0.3, 'triangle', v * 0.9); p(784, offset + 0.24, 0.4, 'triangle', v * 1.1)
      } else if (theme === 'arcade') { // Coin collect
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => p(f, offset + i * 0.06, 0.08, 'square', v * (0.4 + i * 0.1)))
      } else if (theme === 'xylophone') { // Bright xylophone
        p(1047, offset, 0.2, 'sine', v * 1.0); p(1319, offset + 0.1, 0.2, 'sine', v * 0.9); p(1568, offset + 0.2, 0.3, 'sine', v * 1.1); p(2093, offset + 0.35, 0.5, 'sine', v * 0.6)
      } else if (theme === 'doorbell') { // Classic ding-dong
        p(659, offset, 0.4, 'sine', v * 1.2); p(523, offset + 0.45, 0.6, 'sine', v * 1.2)
      }
    }
    for (let r = 0; r < Math.min(repeat, 5); r++) playOnce(r * 1.2)
    setTimeout(() => ctx.close(), 8000)
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
  const [unreadStaff, setUnreadStaff] = useState(0)
  const [lastSender, setLastSender] = useState<string | null>(null)
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
  const [callRoomUrl, setCallRoomUrl] = useState('')
  const [callRoomName, setCallRoomName] = useState('')
  const [callLoading, setCallLoading] = useState(false)
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
        // Staff lookup - may not exist, use maybeSingle to avoid 406
        try {
          const { data: staffData } = await supabase.from('practice_staff').select('id').eq('email', user.email).limit(1).maybeSingle()
          if (staffData) setStaffId(staffData.id)
          const { data: tm } = await supabase.from('practice_staff').select('id, first_name, last_name, role, email, active, last_login_at').eq('doctor_id', user.doctor.id).order('first_name')
          setTeam(tm || [])
          // Staff convs
          if (staffData) {
            try {
              const res = await authFetch(`/api/staff-messages?action=conversations&doctorId=${user.doctor.id}&staffId=${staffData.id}`)
              const sData = await res.json()
              setStaffConvs(sData.conversations || [])
              try {
                const uRes = await authFetch(`/api/staff-messages?action=unread&doctorId=${user.doctor.id}&staffId=${staffData.id}`)
                const uData = await uRes.json()
                const total = Object.values(uData.unreadCounts || {}).reduce((s: number, n: any) => s + (n || 0), 0)
                setUnreadStaff(total as number)
              } catch {}
            } catch {}
          }
        } catch { /* practice_staff table may not exist */ }
        // Admin conv
        try {
          const res = await authFetch('/api/admin/messaging?action=conversations')
          const d = await res.json()
          const myConv = (d.conversations || []).find((c: any) => c.doctor_id === user?.doctor?.id)
          if (myConv) { setAdminConv(myConv); setUnreadAdmin(myConv.unread_count || 0) }
        } catch {}
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
      const res = await authFetch(`/api/admin/messaging?action=messages&conversationId=${adminConv.id}`)
      const d = await res.json()
      setAdminMsgs(d.messages || [])
      setTimeout(() => adminEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { console.error('fetchAdminMsgs:', e) }
  }, [adminConv])

  const fetchStaffMsgs = useCallback(async (convId: string) => {
    try {
      const res = await authFetch(`/api/staff-messages?action=messages&doctorId=${doctorId}&conversationId=${convId}`)
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
        const createRes = await authFetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_conversation', doctorId, doctorName, doctorSpecialty: '' }) })
        const createData = await createRes.json()
        if (createData.conversation) { setAdminConv(createData.conversation); convId = createData.conversation.id }
        else { console.error('Failed to create conversation:', createData); return }
      }
      const res = await authFetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', conversationId: convId, senderType: 'doctor', senderName: doctorName, content: adminMsg, attachments: pending.length > 0 ? pending : undefined }) })
      const data = await res.json()
      if (data.error) { console.error('Send error:', data.error); return }
      if (soundEnabled) playSound(soundTheme, 'send')
      setAdminMsg(''); setPending([]); fetchAdminMsgs()
    } catch (e) { console.error('sendAdmin error:', e) }
  }
  const sendStaff = async () => {
    if (!activeStaffConv || !staffMsg.trim() || !staffId || !doctorId) return
    await authFetch('/api/staff-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_message', doctorId, staffId, conversationId: activeStaffConv.id, content: staffMsg, metadata: pending.length > 0 ? { attachments: pending } : {} }) })
    if (soundEnabled) playSound(soundTheme, 'send')
    setStaffMsg(''); setPending([]); fetchStaffMsgs(activeStaffConv.id)
  }

  useEffect(() => { if (view === 'admin' && adminConv) fetchAdminMsgs() }, [view, adminConv, fetchAdminMsgs])

  // ═══ CALL — Daily.co real video rooms ═══
  const startCall = async (type: 'audio' | 'video', target: string) => {
    setCallLoading(true)
    try {
      const res = await authFetch('/api/messenger/call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', doctorId, doctorName, callType: type, targetType: target.includes('Admin') ? 'admin' : 'staff' })
      })
      const data = await res.json()
      if (!data.room_url) throw new Error(data.error || 'Failed to create call')
      setCallRoomUrl(data.room_url); setCallRoomName(data.room_name)
      setCallActive(true); setCallType(type); setCallTarget(target); setCallDuration(0)
      if (soundEnabled) playSound(soundTheme, 'call')
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    } catch (e: any) { alert('Call failed: ' + (e.message || 'Unknown error')) }
    finally { setCallLoading(false) }
  }
  const stopCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    setCallActive(false); setCallRoomUrl(''); setCallRoomName('')
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

  const totalUnread = unreadAdmin + unreadStaff
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Track last sender for preview
  useEffect(() => {
    if (totalUnread > 0) {
      if (unreadAdmin > 0) setLastSender('Admin')
      else if (staffConvs.length > 0) {
        const latest = staffConvs.filter((c: any) => c.last_message_preview).sort((a: any, b: any) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())[0]
        if (latest) setLastSender(latest.name || 'Staff')
      }
    } else setLastSender(null)
  }, [totalUnread, unreadAdmin, staffConvs])

  return (
    <>
      {/* BUBBLE */}
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95" style={{ position: 'fixed' }}>
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center animate-pulse">
            {totalUnread}
          </span>
        )}
      </button>

      {/* UNREAD PREVIEW — shows who messaged */}
      {!open && lastSender && totalUnread > 0 && (
        <div onClick={() => setOpen(true)} className="fixed bottom-[88px] right-6 z-[9999] bg-[#0a1f1f] border border-emerald-500/30 rounded-xl px-3 py-2 shadow-lg cursor-pointer hover:bg-[#0c2828] transition-colors max-w-[220px]" style={{ position: 'fixed' }}>
          <div className="text-[10px] text-emerald-400 font-bold">New message</div>
          <div className="text-xs text-white font-medium truncate">from {lastSender}</div>
        </div>
      )}

      {/* PANEL */}
      {open && (
        <div className={`fixed z-[9998] bg-[#071414] border border-[#1a3d3d]/60 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden transition-all ${callActive ? 'bottom-6 right-6 w-[520px] h-[640px]' : 'bottom-24 right-6 w-[380px] h-[520px]'}`}>
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
                  <button onClick={() => startCall('audio', view === 'admin' ? 'Admin' : activeStaffConv?.name || 'Staff')} disabled={callLoading} className="p-1.5 hover:bg-green-600/20 rounded-lg disabled:opacity-40" title="Audio Call">{callLoading ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" /> : <Phone className="w-3.5 h-3.5 text-green-400" />}</button>
                  <button onClick={() => startCall('video', view === 'admin' ? 'Admin' : activeStaffConv?.name || 'Staff')} disabled={callLoading} className="p-1.5 hover:bg-blue-600/20 rounded-lg disabled:opacity-40" title="Video Call"><Video className="w-3.5 h-3.5 text-blue-400" /></button>
                </>
              )}
              {view === 'home' && <button onClick={() => setView('settings')} className="p-1.5 hover:bg-[#1a3d3d]/30 rounded-lg"><Settings className="w-3.5 h-3.5 text-gray-400" /></button>}
            </div>
          </div>

          {/* CALL UI — Daily.co embedded */}
          {callActive ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 bg-black relative">
                <iframe
                  src={`${callRoomUrl}?t=${Date.now()}`}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="w-full h-full border-0"
                  style={{ minHeight: '300px' }}
                />
              </div>
              <div className="p-2 bg-[#0a1f1f] border-t border-[#1a3d3d]/40 flex items-center justify-between">
                <span className="text-emerald-400 font-mono text-xs">{fmtDur(callDuration)}</span>
                <div className="flex items-center gap-2">
                  <a href={callRoomUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-600/20 text-blue-400 text-[10px] rounded hover:bg-blue-600/30">Open Full</a>
                  <button onClick={stopCall} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1"><PhoneOff className="w-3.5 h-3.5" />End</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {view === 'home' && <HomeView unreadAdmin={unreadAdmin} unreadStaff={unreadStaff} staffConvCount={staffConvs.length} teamCount={team.length} onNav={setView} hasAdminConv={!!adminConv} isRecording={isRecording} recordedBlob={recordedBlob} recordingTime={recordingTime} startRecording={startRecording} stopRecording={stopRecording} sendRecording={sendRecording} fmtDur={fmtDur} />}
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

function HomeView({ unreadAdmin, unreadStaff, staffConvCount, teamCount, onNav, hasAdminConv, isRecording, recordedBlob, recordingTime, startRecording, stopRecording, sendRecording, fmtDur }: any) {
  return (
    <div className="p-3 space-y-2">
      <NavBtn icon={Shield} iconBg="bg-amber-600/20" iconColor="text-amber-400" label="Admin Support" sub={hasAdminConv ? 'Message platform admin' : 'Start conversation'} badge={unreadAdmin} onClick={() => onNav('admin')} />
      <NavBtn icon={Users} iconBg="bg-blue-600/20" iconColor="text-blue-400" label="Staff Chat" sub={`${staffConvCount} conversation${staffConvCount !== 1 ? 's' : ''}`} badge={unreadStaff} onClick={() => onNav('staff_list')} />
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
  const [volume, setVolume] = useState(() => { try { return parseFloat(localStorage.getItem('msg_sound_volume') || '0.8') } catch { return 0.8 } })
  const [repeat, setRepeat] = useState(() => { try { return parseInt(localStorage.getItem('msg_sound_repeat') || '1') } catch { return 1 } })
  const [msgNotif, setMsgNotif] = useState(true)
  const [callNotif, setCallNotif] = useState(true)
  const [flashTab, setFlashTab] = useState(() => localStorage.getItem('msg_flash_tab') === 'true')

  useEffect(() => { localStorage.setItem('msg_sound_volume', String(volume)) }, [volume])
  useEffect(() => { localStorage.setItem('msg_sound_repeat', String(repeat)) }, [repeat])
  useEffect(() => { localStorage.setItem('msg_flash_tab', String(flashTab)) }, [flashTab])

  // Sync with global notification system
  useEffect(() => {
    try {
      const raw = localStorage.getItem('medazon_notification_settings')
      if (raw) {
        const ns = JSON.parse(raw)
        ns.soundEnabled = soundEnabled
        ns.soundVolume = volume
        if (soundTheme === 'retro') ns.soundTheme = 'retro'
        else if (soundTheme === 'none') ns.soundTheme = 'minimal'
        else if (soundTheme === 'chime' || soundTheme === 'doorbell') ns.soundTheme = 'default'
        else ns.soundTheme = 'gentle'
        ns.soundRepeat = repeat
        localStorage.setItem('medazon_notification_settings', JSON.stringify(ns))
      }
    } catch {}
  }, [soundEnabled, soundTheme, volume, repeat])

  const Toggle = ({ val, onChange }: { val: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`w-10 h-5 rounded-full transition-colors flex items-center ${val ? 'bg-emerald-600 justify-end' : 'bg-gray-700 justify-start'}`}>
      <div className="w-4 h-4 bg-white rounded-full mx-0.5" />
    </button>
  )

  return (
    <div className="p-4 space-y-4 text-white">
      {/* Master sound */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-emerald-400" /><span className="text-sm font-medium">Message Sounds</span></div>
        <Toggle val={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} />
      </div>

      {/* Volume slider */}
      <div>
        <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Volume</span><span className="text-[10px] text-emerald-400 font-mono">{Math.round(volume * 100)}%</span></div>
        <input type="range" min="0.1" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-[#1a3d3d] rounded-lg appearance-none cursor-pointer accent-emerald-500" />
        <div className="flex justify-between text-[9px] text-gray-600"><span>Quiet</span><span>Loud</span></div>
      </div>

      {/* Repeat count */}
      <div>
        <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Alert Repeat</span><span className="text-[10px] text-emerald-400">{repeat}×</span></div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRepeat(n)} className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${repeat === n ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40' : 'bg-[#0a1f1f] text-gray-500 hover:text-gray-300'}`}>{n}×</button>
          ))}
        </div>
      </div>

      {/* Sound theme */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">Sound Theme</p>
        <div className="grid grid-cols-1 gap-1 max-h-[180px] overflow-y-auto pr-1">
          {THEMES.map(t => (
            <button key={t.key} onClick={() => { setSoundTheme(t.key); if (t.key !== 'none') playSound(t.key, 'message', volume) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${soundTheme === t.key ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-[#0a1f1f] hover:bg-[#0c2828] border border-transparent'}`}>
              <span className={`text-xs ${soundTheme === t.key ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>{t.label}</span>
              <span className="text-[9px] text-gray-600 flex-1">{t.desc}</span>
              {soundTheme === t.key && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Per-type toggles */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">Notify For</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 bg-[#0a1f1f] rounded-lg"><span className="text-xs">New Messages</span><Toggle val={msgNotif} onChange={() => setMsgNotif(!msgNotif)} /></div>
          <div className="flex items-center justify-between px-3 py-2 bg-[#0a1f1f] rounded-lg"><span className="text-xs">Incoming Calls</span><Toggle val={callNotif} onChange={() => setCallNotif(!callNotif)} /></div>
          <div className="flex items-center justify-between px-3 py-2 bg-[#0a1f1f] rounded-lg"><span className="text-xs">Flash Browser Tab</span><Toggle val={flashTab} onChange={() => setFlashTab(!flashTab)} /></div>
        </div>
      </div>

      {/* Desktop notifications */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">Desktop Notifications</p>
        {desktopNotifs ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg"><Bell className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400">Enabled — you'll see pop-ups</span></div>
        ) : (
          <button onClick={requestDesktopNotifs} className="w-full px-3 py-2 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-lg text-xs text-gray-400 flex items-center gap-2"><BellOff className="w-4 h-4" />Enable Desktop Notifications</button>
        )}
      </div>

      {/* Preview buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={() => playSound(soundTheme, 'message', volume, repeat)} disabled={soundTheme === 'none'} className="px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-600/30 disabled:opacity-40 flex items-center justify-center gap-1.5">
          <Play className="w-3 h-3" />Message
        </button>
        <button onClick={() => playSound(soundTheme, 'call', volume, 1)} disabled={soundTheme === 'none'} className="px-3 py-2 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30 disabled:opacity-40 flex items-center justify-center gap-1.5">
          <Phone className="w-3 h-3" />Ring
        </button>
      </div>
      <p className="text-[9px] text-gray-600 text-center">Settings sync with global notification system</p>
    </div>
  )
}
