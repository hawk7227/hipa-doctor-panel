// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Shield, RefreshCw, Check, CheckCheck, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

interface Message {
  id: string; conversation_id: string; sender_type: 'admin' | 'doctor';
  sender_name: string; content: string; is_read: boolean; created_at: string;
}

interface Conversation {
  id: string; doctor_id: string; doctor_name: string; last_message: string;
  last_message_at: string; unread_count: number; status: string;
}

export default function DoctorAdminMessagesPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get doctor info and find/create conversation
  const init = useCallback(async () => {
    setLoading(true)
    try {
      const user = await getCurrentUser()
      if (!user) return

      // Get doctor record
      const { data: doctor } = await supabase.from('doctors').select('id, first_name, last_name')
        .eq('auth_user_id', user.id).single()

      if (!doctor) return
      setDoctorId(doctor.id)
      setDoctorName(`Dr. ${doctor.first_name} ${doctor.last_name}`)

      // Find existing conversation
      const res = await fetch(`/api/admin/messaging?action=conversations`)
      const data = await res.json()
      const existing = (data.conversations || []).find((c: Conversation) => c.doctor_id === doctor.id)

      if (existing) {
        setConversation(existing)
        // Fetch messages
        const msgRes = await fetch(`/api/admin/messaging?action=messages&conversationId=${existing.id}`)
        const msgData = await msgRes.json()
        setMessages(msgData.messages || [])
        // Mark as read from doctor side
        await fetch('/api/admin/messaging', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_doctor_read', conversationId: existing.id })
        })
      }
    } catch (err) { console.error('Init error:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { init() }, [init])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (conversation) {
        fetch(`/api/admin/messaging?action=messages&conversationId=${conversation.id}`)
          .then(r => r.json())
          .then(d => { if (d.messages) setMessages(d.messages) })
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [conversation])

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !doctorId) return
    setSending(true)
    try {
      let convId = conversation?.id

      // Create conversation if none exists
      if (!convId) {
        const res = await fetch('/api/admin/messaging', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_conversation', doctorId, doctorName, doctorSpecialty: '' })
        })
        const data = await res.json()
        if (data.conversation) {
          setConversation(data.conversation)
          convId = data.conversation.id
        }
      }

      if (!convId) return

      const res = await fetch('/api/admin/messaging', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', conversationId: convId, content: newMessage, senderType: 'doctor', senderName: doctorName })
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
      }
    } catch (err) { console.error('Send error:', err) }
    finally { setSending(false) }
  }

  const formatTime = (d: string) => {
    const dt = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - dt.getTime()
    if (diffMs < 60000) return 'Just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#030f0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3d3d] px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link href="/doctor/dashboard" className="p-1 text-gray-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Admin Support</h1>
            <p className="text-[10px] text-gray-500">Direct line to Medazon Health administration</p>
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={init} className="p-1.5 text-gray-500 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="text-center py-12 text-gray-500">Loading...</div>}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-gray-600 text-xs mt-1">Send a message to contact the admin team</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_type === 'doctor' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-lg p-3 ${
              msg.sender_type === 'doctor'
                ? 'bg-teal-600/20 border border-teal-500/30'
                : 'bg-red-500/5 border border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold ${msg.sender_type === 'doctor' ? 'text-teal-400' : 'text-red-400'}`}>
                  {msg.sender_type === 'doctor' ? 'You' : 'Admin'}
                </span>
                <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
              {msg.sender_type === 'doctor' && (
                <div className="flex justify-end mt-1">
                  {msg.is_read ? <CheckCheck className="w-3 h-3 text-teal-400" /> : <Check className="w-3 h-3 text-gray-500" />}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1a3d3d] flex-shrink-0">
        <div className="flex gap-2">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message admin..."
            className="flex-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-4 py-2.5 text-white text-sm" />
          <button onClick={handleSend} disabled={sending || !newMessage.trim()}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
