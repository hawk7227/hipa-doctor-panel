// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ArrowLeft, Users, ChevronRight, Phone, Video, PhoneOff, Loader2, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DoctorConv {
  id: string; doctor_id: string; doctor_name: string; doctor_specialty: string
  last_message: string; last_message_at: string; unread_count: number
  is_pinned: boolean; status: string
}
interface Msg { id: string; sender_type: string; sender_name: string; content: string; is_read: boolean; created_at: string; message_type: string; metadata?: any }

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: string) => { const dt = new Date(d); const diff = Date.now() - dt.getTime(); if (diff < 86400000) return fmtTime(d); if (diff < 172800000) return 'Yesterday'; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

export default function AdminFloatingMessenger() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [convs, setConvs] = useState<DoctorConv[]>([])
  const [activeConv, setActiveConv] = useState<DoctorConv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastSender, setLastSender] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const prevTotalRef = useRef(0)

  const totalUnread = convs.reduce((s, c) => s + (c.unread_count || 0), 0)

  // Track last sender for bubble preview
  useEffect(() => {
    if (totalUnread > 0) {
      const latest = convs.filter(c => c.unread_count > 0).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())[0]
      if (latest) setLastSender(latest.doctor_name)
    } else { setLastSender(null) }
  }, [convs, totalUnread])

  // Play sound on new messages
  useEffect(() => {
    if (totalUnread > prevTotalRef.current && prevTotalRef.current >= 0) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        const p = (f: number, t: number, d: number) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = f; g.gain.setValueAtTime(0.3, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d) }
        p(523, 0, 0.15); p(659, 0.12, 0.15); p(784, 0.24, 0.15); p(1047, 0.36, 0.3)
        setTimeout(() => ctx.close(), 2000)
      } catch {}
    }
    prevTotalRef.current = totalUnread
  }, [totalUnread])

  const fetchConvs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messaging?action=conversations')
      const data = await res.json()
      setConvs(data.conversations || [])
    } catch {}
    setLoading(false)
  }, [])

  const fetchMsgs = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/admin/messaging?action=messages&conversationId=${convId}`)
      const data = await res.json()
      setMsgs(data.messages || [])
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      // Mark as read
      await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read', conversationId: convId }) })
      fetchConvs() // refresh unread counts
    } catch {}
  }, [fetchConvs])

  useEffect(() => { fetchConvs(); const i = setInterval(fetchConvs, 15000); return () => clearInterval(i) }, [fetchConvs])
  useEffect(() => { if (view === 'chat' && activeConv) { fetchMsgs(activeConv.id); const i = setInterval(() => fetchMsgs(activeConv.id), 10000); return () => clearInterval(i) } }, [view, activeConv, fetchMsgs])

  const sendMsg = async () => {
    if (!activeConv || !newMsg.trim()) return
    await fetch('/api/admin/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', conversationId: activeConv.id, senderType: 'admin', senderName: 'Admin', content: newMsg }) })
    setNewMsg(''); fetchMsgs(activeConv.id)
  }

  return (
    <>
      {/* BUBBLE — always visible */}
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-900/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95" style={{ position: 'fixed' }}>
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center animate-pulse">
            {totalUnread}
          </span>
        )}
      </button>

      {/* UNREAD PREVIEW TOAST — shows who messaged */}
      {!open && lastSender && totalUnread > 0 && (
        <div onClick={() => setOpen(true)} className="fixed bottom-[88px] right-6 z-[9999] bg-[#0a1f1f] border border-emerald-500/30 rounded-xl px-3 py-2 shadow-lg cursor-pointer hover:bg-[#0c2828] transition-colors max-w-[240px] animate-bounce-once" style={{ position: 'fixed' }}>
          <div className="text-[10px] text-emerald-400 font-bold">New message from</div>
          <div className="text-xs text-white font-medium truncate">{lastSender}</div>
          <div className="text-[9px] text-gray-500 truncate">{convs.find(c => c.doctor_name === lastSender)?.last_message || ''}</div>
        </div>
      )}

      {/* PANEL */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[9998] w-[380px] h-[520px] bg-[#071414] border border-[#1a3d3d]/60 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden" style={{ position: 'fixed' }}>
          {/* Header */}
          <div className="bg-[#0a1f1f] px-4 py-2.5 border-b border-[#1a3d3d]/40 flex items-center gap-2 shrink-0">
            {view === 'chat' && <button onClick={() => { setView('list'); setActiveConv(null) }} className="p-1 hover:bg-[#1a3d3d]/30 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>}
            <h3 className="text-sm font-bold text-white flex-1">{view === 'chat' ? (activeConv?.doctor_name || 'Chat') : 'Doctor Messages'}</h3>
            {view === 'chat' && activeConv?.doctor_specialty && <span className="text-[9px] text-gray-500">{activeConv.doctor_specialty}</span>}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {view === 'list' ? (
              <div className="p-2 space-y-1">
                {loading && <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div>}
                {!loading && convs.length === 0 && <div className="text-center py-10 text-gray-600 text-xs">No doctor conversations yet</div>}
                {convs.map(c => (
                  <button key={c.id} onClick={() => { setActiveConv(c); setView('chat') }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#0a1f1f] rounded-lg transition-colors text-left">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-teal-600/20 flex items-center justify-center text-xs font-bold text-teal-400">
                        {c.doctor_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      {c.unread_count > 0 && <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{c.unread_count}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium truncate ${c.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>{c.doctor_name}</span>
                        <span className="text-[9px] text-gray-600 shrink-0 ml-2">{c.last_message_at ? fmtDate(c.last_message_at) : ''}</span>
                      </div>
                      <div className={`text-[10px] truncate ${c.unread_count > 0 ? 'text-gray-300 font-medium' : 'text-gray-600'}`}>{c.last_message || 'No messages'}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {msgs.length === 0 && <p className="text-center text-gray-600 text-xs py-8">No messages yet</p>}
                {msgs.map(m => {
                  const isAdmin = m.sender_type === 'admin'
                  if (m.message_type === 'call') {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg px-3 py-2 text-center">
                          <div className="text-xs text-blue-400">{m.content}</div>
                          {m.metadata?.room_url && <a href={m.metadata.room_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-300 underline hover:text-blue-200 block mt-1">Join Call →</a>}
                          <div className="text-[8px] text-gray-600 mt-1">{fmtTime(m.created_at)}</div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isAdmin ? 'bg-teal-600/15' : 'bg-[#0a1f1f]'}`}>
                        <div className={`text-[9px] font-medium mb-0.5 ${isAdmin ? 'text-teal-500' : 'text-amber-400'}`}>{m.sender_name}</div>
                        <p className="text-xs text-gray-200 leading-relaxed">{m.content}</p>
                        <div className={`text-[8px] mt-1 ${isAdmin ? 'text-teal-600 text-right' : 'text-gray-600'}`}>{fmtTime(m.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Compose */}
          {view === 'chat' && (
            <div className="p-2.5 border-t border-[#1a3d3d]/40 flex gap-1.5 shrink-0">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a reply..." className="flex-1 px-3 py-2 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
                onKeyDown={e => { if (e.key === 'Enter') sendMsg() }} />
              <button onClick={sendMsg} className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"><Send className="w-3.5 h-3.5 text-white" /></button>
            </div>
          )}
        </div>
      )}

      {/* CSS for bounce animation */}
      <style jsx global>{`
        @keyframes bounce-once { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} 60%{transform:translateY(-3px)} }
        .animate-bounce-once { animation: bounce-once 0.6s ease-out; }
      `}</style>
    </>
  )
}
