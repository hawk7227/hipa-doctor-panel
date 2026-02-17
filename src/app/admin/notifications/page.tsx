// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import { useState, useEffect } from 'react'
import { Bell, Search, RefreshCw, CheckCircle, AlertCircle, Info, Trash2, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AdminNotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('staff_notifications').select('*, practice_staff(first_name, last_name)').order('created_at', { ascending: false }).limit(200)
      setNotifs((data || []).map((n: any) => ({ ...n, practice_staff: Array.isArray(n.practice_staff) ? n.practice_staff[0] : n.practice_staff })))
      setLoading(false)
    }
    fetch()
  }, [])

  const markAllRead = async () => {
    await supabase.from('staff_notifications').update({ read: true }).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const filtered = filter === 'unread' ? notifs.filter(n => !n.read) : notifs
  const unread = notifs.filter(n => !n.read).length
  const typeIcon = (t: string) => t === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : t === 'success' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Info className="w-4 h-4 text-blue-400" />

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Bell className="w-6 h-6 text-teal-400" /><h1 className="text-xl font-bold">Notifications</h1>{unread > 0 && <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">{unread}</span>}</div>
        <div className="flex gap-2">
          <button onClick={markAllRead} className="px-3 py-1.5 bg-teal-600/20 text-teal-400 text-sm rounded-lg hover:bg-teal-600/30 flex items-center gap-2"><CheckCheck className="w-4 h-4" />Mark All Read</button>
          <button onClick={() => setFilter(f => f === 'all' ? 'unread' : 'all')} className={`px-3 py-1.5 text-sm rounded-lg ${filter === 'unread' ? 'bg-amber-600/20 text-amber-400' : 'bg-[#1a3d3d]/30 text-gray-400'}`}>{filter === 'unread' ? 'Unread Only' : 'All'}</button>
        </div>
      </div>
      {loading ? <div className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 && <div className="text-center py-10 text-gray-500">No notifications</div>}
          {filtered.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${n.read ? 'bg-[#0a1f1f] border-[#1a3d3d]/30' : 'bg-[#0a1f1f] border-teal-500/30'}`}>
              {typeIcon(n.type || 'info')}
              <div className="flex-1"><div className="text-sm font-medium">{n.title || 'Notification'}</div><div className="text-xs text-gray-400 mt-0.5">{n.body || n.message || ''}</div><div className="text-[10px] text-gray-600 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ''} {n.practice_staff ? `• ${n.practice_staff.first_name} ${n.practice_staff.last_name}` : ''}</div></div>
              {!n.read && <div className="w-2 h-2 bg-teal-400 rounded-full mt-1.5" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
