'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, X, Send, Shield, Users, ChevronRight,
  Paperclip, Phone, Clock, Bell, RefreshCw, ArrowLeft,
  Circle, CheckCircle2, XCircle, AlertCircle, Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { AttachButton, PendingAttachments, AttachmentDisplay, type Attachment } from '@/components/MessageAttachments'

interface AdminMsg { id: string; sender_type: string; sender_name: string; content: string; is_read: boolean; created_at: string; metadata?: any }
interface StaffConv { id: string; type: string; name: string | null; last_message_preview: string | null; last_message_at: string | null; staff_conversation_participants: any[] }
interface StaffMsg { id: string; content: string; message_type: string; created_at: string; sender: { first_name: string; last_name: string; role: string } | null; metadata?: any }
interface StaffMember { id: string; first_name: string; last_name: string; role: string; email: string; active: boolean; last_login_at?: string }

type View = 'home' | 'admin' | 'staff_list' | 'staff_chat' | 'team_status'
const INP = "w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: string) => { const dt = new Date(d); const now = new Date(); const diff = now.getTime() - dt.getTime(); if (diff < 86400000) return fmtTime(d); if (diff < 172800000) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

export default function FloatingMessenger() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('home')
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const [staffId, setStaffId] = useState<string | null>(null)

  // Admin chat
  const [adminConv, setAdminConv] = useState<any>(null)
  const [adminMsgs, setAdminMsgs] = useState<AdminMsg[]>([])
  const [adminMsg, setAdminMsg] = useState('')
  const [unreadAdmin, setUnreadAdmin] = useState(0)
  const adminEndRef = useRef<HTMLDivElement>(null)

  // Staff chat
  const [staffConvs, setStaffConvs] = useState<StaffConv[]>([])
  const [activeStaffConv, setActiveStaffConv] = useState<StaffConv | null>(null)
  const [staffMsgs, setStaffMsgs] = useState<StaffMsg[]>([])
  const [staffMsg, setStaffMsg] = useState('')
  const [unreadStaff, setUnreadStaff] = useState(0)
  const staffEndRef = useRef<HTMLDivElement>(null)

  // Team status
  const [team, setTeam] = useState<StaffMember[]>([])

  // Attachments
  const [pending, setPending] = useState<Attachment[]>([])

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getCurrentUser()
        if (!user?.doctor?.id) return
        setDoctorId(user.doctor.id)
        setDoctorName(`Dr. ${user.doctor.first_name} ${user.doctor.last_name}`)
        const { data: staff } = await supabase.from('practice_staff').select('id').eq('email', user.email).limit(1).single()
        if (staff) setStaffId(staff.id)
        // Fetch team
        const { data: tm } = await supabase.from('practice_staff').select('id, first_name, last_name, role, email, active, last_login_at').eq('doctor_id', user.doctor.id).order('first_name')
        setTeam(tm || [])
        // Fetch admin conversation
        try {
          const res = await fetch('/api/admin/messaging?action=conversations')
          const d = await res.json()
          const myConv = (d.conversations || []).find((c: any) => c.doctor_id === user.doctor.id)
          if (myConv) { setAdminConv(myConv); setUnreadAdmin(myConv.unread_count || 0) }
        } catch {}
        // Fetch staff conversations
        if (staff) {
          try {
            const res = await fetch(`/api/staff-messages?action=conversations&doctorId=${user.doctor.id}&staffId=${staff.id}`)
            const d = await res.json()
            setStaffConvs(d.conversations || [])
          } catch {}
        }
      } catch {}
    }
    init()
    const interval = setInterval(init, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAdminMsgs = useCallback(async () => {
    if (!adminConv) return
    try {
      const res = await fetch(`/api/admin/messaging?action=messages&conversationId=${adminConv.id}`)
      const d = await res.json()
      setAdminMsgs(d.messages || [])
      setTimeout(() => adminEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
  }, [adminConv])

  const fetchStaffMsgs = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/staff-messages?action=messages&doctorId=${doctorId}&conversationId=${convId}`)
      const d = await res.json()
      setStaffMsgs(d.messages || [])
      setTimeout(() => staffEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
  }, [doctorId])

  const sendAdminMsg = async () => {
    if (!adminConv || !adminMsg.trim()) return
    try {
      await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', conversationId: adminConv.id, senderType: 'doctor', senderName: doctorName, content: adminMsg, attachments: pending.length > 0 ? pending : undefined }) })
      setAdminMsg(''); setPending([]); fetchAdminMsgs()
    } catch {}
  }

  const sendStaffMsg = async () => {
    if (!activeStaffConv || !staffMsg.trim() || !staffId || !doctorId) return
    try {
      await fetch('/api/staff-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_message', doctorId, staffId, conversationId: activeStaffConv.id, content: staffMsg, metadata: pending.length > 0 ? { attachments: pending } : {} }) })
      setStaffMsg(''); setPending([]); fetchStaffMsgs(activeStaffConv.id)
    } catch {}
  }

  useEffect(() => { if (view === 'admin' && adminConv) fetchAdminMsgs() }, [view, adminConv, fetchAdminMsgs])

  const totalUnread = unreadAdmin + unreadStaff

  return (
    <>
      {/* FLOATING BUBBLE */}
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && totalUnread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">{totalUnread}</span>}
      </button>

      {/* PANEL */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[60] w-[380px] h-[520px] bg-[#071414] border border-[#1a3d3d]/60 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#0a1f1f] px-4 py-3 border-b border-[#1a3d3d]/40 flex items-center gap-3">
            {view !== 'home' && <button onClick={() => { if (view === 'staff_chat') { setView('staff_list'); setActiveStaffConv(null) } else setView('home') }} className="p-1 hover:bg-[#1a3d3d]/30 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>}
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">
                {view === 'home' ? 'Messages' : view === 'admin' ? 'Admin Support' : view === 'staff_list' ? 'Staff Chat' : view === 'staff_chat' ? (activeStaffConv?.name || 'Chat') : 'Team Status'}
              </h3>
              <p className="text-[10px] text-gray-500">{view === 'home' ? 'Chat with admin, team, or view status' : view === 'team_status' ? 'Staff activity & online status' : ''}</p>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {view === 'home' && <HomeView unreadAdmin={unreadAdmin} unreadStaff={unreadStaff} staffConvCount={staffConvs.length} teamCount={team.length} onNav={setView} hasAdminConv={!!adminConv} />}
            {view === 'admin' && <ChatView msgs={adminMsgs} doctorName={doctorName} senderKey="sender_type" myValue="doctor" otherLabel="Admin" otherColor="text-amber-400" myColor="text-emerald-400" otherBg="bg-amber-600/10" myBg="bg-emerald-600/15" endRef={adminEndRef} />}
            {view === 'staff_list' && <StaffListView convs={staffConvs} onSelect={(c) => { setActiveStaffConv(c); setView('staff_chat'); fetchStaffMsgs(c.id) }} />}
            {view === 'staff_chat' && <ChatView msgs={staffMsgs} doctorName={doctorName} senderKey="sender" myValue="_check_name" otherLabel="" otherColor="text-blue-400" myColor="text-emerald-400" otherBg="bg-[#0a1f1f]" myBg="bg-emerald-600/15" endRef={staffEndRef} isStaff />}
            {view === 'team_status' && <TeamStatusView team={team} />}
          </div>

          {/* Compose — only for chat views */}
          {(view === 'admin' || view === 'staff_chat') && (
            <div className="border-t border-[#1a3d3d]/40">
              {pending.length > 0 && <PendingAttachments attachments={pending} onRemove={(i) => setPending(prev => prev.filter((_, idx) => idx !== i))} />}
              <div className="p-3 flex gap-2">
                <AttachButton onAttach={(a) => setPending(prev => [...prev, a])} />
                <input value={view === 'admin' ? adminMsg : staffMsg} onChange={e => view === 'admin' ? setAdminMsg(e.target.value) : setStaffMsg(e.target.value)} placeholder="Type a message..." className={`${INP} flex-1 text-xs`}
                  onKeyDown={e => { if (e.key === 'Enter') { view === 'admin' ? sendAdminMsg() : sendStaffMsg() } }} />
                <button onClick={view === 'admin' ? sendAdminMsg : sendStaffMsg} className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"><Send className="w-4 h-4 text-white" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ═══ SUB-VIEWS ═══

function HomeView({ unreadAdmin, unreadStaff, staffConvCount, teamCount, onNav, hasAdminConv }: any) {
  return (
    <div className="p-3 space-y-2">
      <button onClick={() => onNav('admin')} className="w-full flex items-center gap-3 p-3.5 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-xl transition-colors text-left">
        <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center"><Shield className="w-5 h-5 text-amber-400" /></div>
        <div className="flex-1"><div className="text-sm font-semibold text-white">Admin Support</div><div className="text-[10px] text-gray-500">{hasAdminConv ? 'Message platform admin' : 'Start a conversation'}</div></div>
        {unreadAdmin > 0 && <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">{unreadAdmin}</span>}
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>

      <button onClick={() => onNav('staff_list')} className="w-full flex items-center gap-3 p-3.5 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-xl transition-colors text-left">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
        <div className="flex-1"><div className="text-sm font-semibold text-white">Staff Chat</div><div className="text-[10px] text-gray-500">{staffConvCount} conversation{staffConvCount !== 1 ? 's' : ''}</div></div>
        {unreadStaff > 0 && <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">{unreadStaff}</span>}
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>

      <button onClick={() => onNav('team_status')} className="w-full flex items-center gap-3 p-3.5 bg-[#0a1f1f] hover:bg-[#0c2828] rounded-xl transition-colors text-left">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center"><Clock className="w-5 h-5 text-purple-400" /></div>
        <div className="flex-1"><div className="text-sm font-semibold text-white">Team Status</div><div className="text-[10px] text-gray-500">{teamCount} staff member{teamCount !== 1 ? 's' : ''} — activity log</div></div>
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  )
}

function ChatView({ msgs, doctorName, senderKey, myValue, otherLabel, otherColor, myColor, otherBg, myBg, endRef, isStaff }: any) {
  return (
    <div className="p-3 space-y-2">
      {msgs.length === 0 && <p className="text-center text-gray-600 text-xs py-8">No messages yet</p>}
      {msgs.map((m: any) => {
        let isMe = false
        if (isStaff) { isMe = m.sender && doctorName.includes(m.sender.first_name) }
        else { isMe = m[senderKey] === myValue }
        const senderLabel = isStaff ? (m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown') : (isMe ? doctorName : (m.sender_name || otherLabel))
        if (m.message_type === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-600 py-1">{m.content}</div>
        return (
          <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMe ? myBg : otherBg}`}>
              <div className={`text-[9px] font-medium mb-0.5 ${isMe ? myColor : otherColor}`}>{senderLabel}</div>
              <p className="text-xs text-gray-200 leading-relaxed">{m.content}</p>
              {(m.metadata?.attachments) && <AttachmentDisplay attachments={m.metadata.attachments} />}
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
        const recentLogin = s.last_login_at && (now - new Date(s.last_login_at).getTime() < 30 * 60 * 1000)
        const statusColor = !s.active ? 'text-red-400' : recentLogin ? 'text-green-400' : 'text-gray-500'
        const statusLabel = !s.active ? 'Inactive' : recentLogin ? 'Online' : (s.last_login_at ? `Last seen ${fmtDate(s.last_login_at)}` : 'Never logged in')
        const statusDot = !s.active ? 'bg-red-500' : recentLogin ? 'bg-green-500' : 'bg-gray-600'
        return (
          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#0a1f1f] rounded-lg">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-[#061818] flex items-center justify-center text-xs font-bold text-gray-400">{s.first_name[0]}{s.last_name[0]}</div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusDot} rounded-full border-2 border-[#0a1f1f]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{s.first_name} {s.last_name}</div>
              <div className="text-[10px] text-gray-500">{s.role}</div>
            </div>
            <div className="text-right">
              <div className={`text-[10px] font-medium ${statusColor}`}>{!s.active ? 'Inactive' : recentLogin ? 'Online' : 'Offline'}</div>
              <div className="text-[9px] text-gray-600">{s.last_login_at ? fmtDate(s.last_login_at) : '—'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
