// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState, useMemo } from 'react'
import { MessageSquare, Phone, Video, Mail, Clock, Send, PhoneIncoming, PhoneOutgoing, PhoneMissed, FileText, Plus } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string; appointmentId?: string }

const TABS = ['Messages', 'Calls', 'Email'] as const

interface CommItem {
  id: string; type: string; direction: string; content: string; timestamp: string;
  status: string; duration_seconds?: number; from?: string; to?: string;
}

export default function CommHubPanelV2({ isOpen, onClose, patientId, patientName, appointmentId }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>('Messages')
  const [messages, setMessages] = useState<CommItem[]>([])
  const [calls, setCalls] = useState<CommItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [showCompose, setShowCompose] = useState(false)

  // Fetch comm history on mount
  React.useEffect(() => {
    if (!patientId || !isOpen) return
    setLoading(true)
    setError(null)
    fetch(`/api/communication/history?patient_id=${patientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          setMessages((data.messages || []).map((m: any) => ({ ...m, type: 'sms' })))
          setCalls((data.calls || []).map((c: any) => ({ ...c, type: 'call' })))
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [patientId, isOpen])

  const handleSendSMS = async () => {
    if (!newMessage.trim()) return
    try {
      const res = await fetch('/api/communication/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, message: newMessage })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else {
        setMessages(prev => [{ id: Date.now().toString(), type: 'sms', direction: 'outbound', content: newMessage, timestamp: new Date().toISOString(), status: 'sent' }, ...prev])
        setNewMessage('')
      }
    } catch (err: any) { setError(err.message) }
  }

  const allItems = useMemo(() => [...messages, ...calls].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [messages, calls])

  const formatTime = (t: string) => {
    if (!t) return ''
    const d = new Date(t)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDuration = (s?: number) => {
    if (!s) return ''
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <PanelBase title={`Communications — ${patientName}`} icon={MessageSquare} accentColor="#6366f1" loading={loading}
      error={error} hasData={allItems.length > 0 || showCompose} emptyMessage="No communication history"
      onClose={onClose} draggable={false} badge={allItems.length || undefined}
      headerActions={<button onClick={() => setShowCompose(!showCompose)} className="p-1 text-teal-400 hover:text-teal-300"><Plus className="w-3.5 h-3.5" /></button>}>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t}
              {t === 'Messages' && messages.length > 0 && <span className="ml-1 text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded">{messages.length}</span>}
              {t === 'Calls' && calls.length > 0 && <span className="ml-1 text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded">{calls.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* SMS Compose */}
          {(showCompose || tab === 'Messages') && (
            <div className="flex gap-2 mb-3">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendSMS()}
                placeholder="Type a message..."
                className="flex-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-white text-sm" />
              <button onClick={handleSendSMS} disabled={!newMessage.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Messages Tab */}
          {tab === 'Messages' && messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-2.5 ${
                msg.direction === 'outbound' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-[#0a1f1f] border border-[#1a3d3d]'
              }`}>
                <p className="text-sm text-white">{msg.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                  {msg.status && <span className="text-[10px] text-gray-600">{msg.status}</span>}
                </div>
              </div>
            </div>
          ))}

          {/* Calls Tab */}
          {tab === 'Calls' && calls.map((call) => {
            const CallIcon = call.direction === 'inbound' ? PhoneIncoming : 
              call.status === 'missed' ? PhoneMissed : PhoneOutgoing
            const iconColor = call.status === 'missed' ? 'text-red-400' : 
              call.direction === 'inbound' ? 'text-green-400' : 'text-blue-400'
            return (
              <div key={call.id} className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 flex items-center gap-3">
                <CallIcon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white capitalize">{call.direction} {call.type === 'video' ? 'Video' : 'Voice'}</span>
                    {call.status === 'missed' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400">MISSED</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatTime(call.timestamp)}
                    {call.duration_seconds && <span className="ml-2">Duration: {formatDuration(call.duration_seconds)}</span>}
                  </div>
                </div>
                <button className="p-1.5 text-gray-500 hover:text-green-400 bg-[#0d2626] rounded-lg">
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {/* Email Tab */}
          {tab === 'Email' && (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Email integration via Gmail panel</p>
              <p className="text-[10px] text-gray-600 mt-1">Use Communication page for full email access</p>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
