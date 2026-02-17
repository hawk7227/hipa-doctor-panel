// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import { AttachButton, PendingAttachments, AttachmentDisplay, type Attachment } from '@/components/MessageAttachments'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Search, Plus, User, Users, Bell, Check, CheckCheck, Clock, Phone, Video, Archive, Pin, Star, RefreshCw } from 'lucide-react'

interface Doctor {
  id: string; first_name: string; last_name: string; email: string; specialty: string | null; is_approved: boolean;
}

interface Conversation {
  id: string; doctor_id: string; doctor_name: string; doctor_specialty: string;
  last_message: string; last_message_at: string; unread_count: number;
  is_pinned: boolean; is_archived: boolean; status: string;
}

interface Message {
  id: string; conversation_id: string; sender_type: 'admin' | 'doctor';
  sender_name: string; content: string; message_type: string;
  is_read: boolean; created_at: string; metadata?: any;
}

export default function AdminMessagingPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [showNewConv, setShowNewConv] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messaging?action=conversations')
      const data = await res.json()
      if (data.conversations) setConversations(data.conversations)
    } catch (err) { console.error('Failed to fetch conversations:', err) }
    finally { setLoading(false) }
  }, [])

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/admin/messaging?action=messages&conversationId=${convId}`)
      const data = await res.json()
      if (data.messages) setMessages(data.messages)
      // Mark as read
      await fetch('/api/admin/messaging', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', conversationId: convId })
      })
      // Update unread count locally
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    } catch (err) { console.error('Failed to fetch messages:', err) }
  }, [])

  // Fetch doctors for new conversation
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messaging?action=doctors')
      const data = await res.json()
      if (data.doctors) setDoctors(data.doctors)
    } catch (err) { console.error('Failed to fetch doctors:', err) }
  }, [])

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', conversationId: selectedConv.id, content: newMessage, senderType: 'admin', senderName: 'Admin', attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined })
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setNewMessage(''); setPendingAttachments([])
        // Update conversation preview
        setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, last_message: newMessage, last_message_at: new Date().toISOString() } : c))
      }
    } catch (err) { console.error('Failed to send:', err) }
    finally { setSending(false) }
  }

  // Start new conversation with a doctor
  const startConversation = async (doctor: Doctor) => {
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_conversation', doctorId: doctor.id, doctorName: `Dr. ${doctor.first_name} ${doctor.last_name}`, doctorSpecialty: doctor.specialty || '' })
      })
      const data = await res.json()
      if (data.conversation) {
        setConversations(prev => [data.conversation, ...prev])
        setSelectedConv(data.conversation)
        setMessages([])
        setShowNewConv(false)
      }
    } catch (err) { console.error('Failed to create conversation:', err) }
  }

  // Toggle pin/archive
  const togglePin = async (convId: string, pinned: boolean) => {
    await fetch('/api/admin/messaging', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_pin', conversationId: convId, isPinned: !pinned })
    })
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: !pinned } : c))
  }

  useEffect(() => { fetchConversations(); fetchDoctors() }, [fetchConversations, fetchDoctors])
  useEffect(() => { if (selectedConv) fetchMessages(selectedConv.id) }, [selectedConv, fetchMessages])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations()
      if (selectedConv) fetchMessages(selectedConv.id)
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedConv, fetchConversations, fetchMessages])

  const filteredConvs = conversations.filter(c => {
    if (filter === 'unread') return c.unread_count > 0
    if (filter === 'pinned') return c.is_pinned
    if (filter === 'archived') return c.is_archived
    return !c.is_archived
  }).filter(c => !search || c.doctor_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return new Date(b.last_message_at || b.id).getTime() - new Date(a.last_message_at || a.id).getTime()
    })

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  const formatTime = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - dt.getTime()
    if (diffMs < 60000) return 'Just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="h-screen flex flex-col bg-[#030f0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3d3d] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <h1 className="text-lg font-bold">Admin ↔ Doctor Messaging</h1>
          {totalUnread > 0 && <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">{totalUnread}</span>}
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/bug-reports" className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-600/30 text-sm">
            🐛 Bug Reports
          </a>
          <button onClick={() => { setShowNewConv(true); fetchDoctors() }}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 text-sm">
            <Plus className="w-4 h-4" />New Message
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversation List */}
        <div className="w-80 border-r border-[#1a3d3d] flex flex-col flex-shrink-0">
          {/* Search + Filters */}
          <div className="p-3 space-y-2 border-b border-[#1a3d3d]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors..."
                className="w-full pl-9 pr-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white text-sm" />
            </div>
            <div className="flex gap-1">
              {(['all', 'unread', 'pinned', 'archived'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-[10px] font-medium rounded ${filter === f ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'unread' && totalUnread > 0 && <span className="ml-1 text-red-400">({totalUnread})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>}
            {filteredConvs.map(conv => (
              <div key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`px-4 py-3 cursor-pointer border-b border-[#0d2626] transition-colors ${
                  selectedConv?.id === conv.id ? 'bg-teal-500/10 border-l-2 border-l-teal-400' : 'hover:bg-[#0a1f1f]'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {conv.is_pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    <span className={`text-sm font-medium truncate ${conv.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>{conv.doctor_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {conv.unread_count > 0 && <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-teal-500 text-white">{conv.unread_count}</span>}
                    <span className="text-[10px] text-gray-600">{formatTime(conv.last_message_at)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{conv.doctor_specialty}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{conv.last_message || 'No messages yet'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConv && !showNewConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">Select a conversation or start a new one</p>
              </div>
            </div>
          ) : showNewConv ? (
            <div className="flex-1 p-6">
              <h2 className="text-lg font-bold mb-4">Start New Conversation</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {doctors.filter(d => d.is_approved).map(doctor => (
                  <button key={doctor.id} onClick={() => startConversation(doctor)}
                    className="w-full flex items-center gap-3 p-3 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg hover:bg-[#0d2a2a] text-left">
                    <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Dr. {doctor.first_name} {doctor.last_name}</div>
                      <div className="text-xs text-gray-500">{doctor.specialty || 'General'} · {doctor.email}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowNewConv(false)} className="mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-[#1a3d3d] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{selectedConv?.doctor_name}</div>
                    <div className="text-[10px] text-gray-500">{selectedConv?.doctor_specialty}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => selectedConv && togglePin(selectedConv.id, selectedConv.is_pinned)}
                    className={`p-1.5 rounded ${selectedConv?.is_pinned ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400'}`}>
                    <Pin className="w-4 h-4" />
                  </button>
                  <button onClick={() => fetchMessages(selectedConv!.id)} className="p-1.5 text-gray-500 hover:text-white">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      msg.sender_type === 'admin'
                        ? 'bg-teal-600/20 border border-teal-500/30'
                        : 'bg-[#0a1f1f] border border-[#1a3d3d]'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold ${msg.sender_type === 'admin' ? 'text-teal-400' : 'text-blue-400'}`}>
                          {msg.sender_type === 'admin' ? 'Admin' : msg.sender_name}
                        </span>
                        <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.attachments && <AttachmentDisplay attachments={msg.metadata.attachments} />}
                      {msg.sender_type === 'admin' && (
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
              {pendingAttachments.length > 0 && <PendingAttachments attachments={pendingAttachments} onRemove={(i: number) => setPendingAttachments((prev: Attachment[]) => prev.filter((_: any, idx: number) => idx !== i))} />}
              <div className="p-4 border-t border-[#1a3d3d] flex-shrink-0">
                <div className="flex gap-2">
                  <AttachButton onAttach={(a: Attachment) => setPendingAttachments((prev: Attachment[]) => [...prev, a])} />
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-4 py-2.5 text-white text-sm" />
                  <button onClick={handleSend} disabled={sending || !newMessage.trim()}
                    className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
