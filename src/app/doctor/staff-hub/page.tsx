// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  MessageSquare, CheckSquare, Bell, Users, Send, Search,
  Plus, Phone, Video, MoreVertical, Clock, AlertCircle,
  CheckCircle, Circle, ArrowLeft, X, RefreshCw, Hash,
  User, Shield, Filter, Calendar, Flag, Tag,
  PhoneCall, PhoneOff, VideoOff, Mic, MicOff,
  ChevronRight, Edit3, Trash2, Pin, Star, Archive
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StaffMember {
  id: string; first_name: string; last_name: string;
  role: string; email: string; active: boolean;
}

interface Conversation {
  id: string; type: string; name: string | null; description: string | null;
  patient_id: string | null; is_archived: boolean;
  last_message_at: string | null; last_message_preview: string | null;
  created_at: string; my_last_read_at: string | null; is_muted: boolean;
  staff_conversation_participants: Array<{
    staff_id: string; role: string; last_read_at: string;
    practice_staff: StaffMember;
  }>;
}

interface Message {
  id: string; conversation_id: string; content: string;
  message_type: string; reply_to_id: string | null;
  metadata: any; is_edited: boolean; is_deleted: boolean;
  created_at: string;
  sender: StaffMember;
}

interface Task {
  id: string; title: string; description: string | null;
  priority: string; status: string; category: string;
  due_date: string | null; notes: string | null;
  created_at: string; updated_at: string; completed_at: string | null;
  patient_id: string | null; appointment_id: string | null;
  assigned_to_staff: StaffMember | null;
  assigned_by_staff: StaffMember | null;
  completed_by_staff: { first_name: string; last_name: string; role: string } | null;
  patients: { first_name: string; last_name: string } | null;
  staff_task_comments: Array<{
    id: string; content: string; created_at: string;
    practice_staff: { first_name: string; last_name: string };
  }>;
}

interface Notification {
  id: string; type: string; title: string; body: string | null;
  link: string | null; is_read: boolean; created_at: string;
  reference_type: string | null; reference_id: string | null;
}

type HubTab = 'messages' | 'tasks' | 'notifications' | 'team'

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Low' },
  normal: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Normal' },
  high: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'High' },
  urgent: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Urgent' },
}

const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  general: { icon: '📋', label: 'General' },
  chart_review: { icon: '📝', label: 'Chart Review' },
  billing: { icon: '💰', label: 'Billing' },
  scheduling: { icon: '📅', label: 'Scheduling' },
  patient_followup: { icon: '🏥', label: 'Patient Follow-up' },
  lab_review: { icon: '🔬', label: 'Lab Review' },
  prescription: { icon: '💊', label: 'Prescription' },
  referral: { icon: '🔗', label: 'Referral' },
  documentation: { icon: '📄', label: 'Documentation' },
  admin: { icon: '⚙️', label: 'Admin' },
}

const ROLE_COLORS: Record<string, string> = {
  doctor: 'text-teal-400', nurse: 'text-cyan-400', assistant: 'text-blue-400',
  admin: 'text-purple-400', billing: 'text-amber-400', front_desk: 'text-pink-400',
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Auth
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null)
  const [currentStaffName, setCurrentStaffName] = useState('')
  const [currentStaffRole, setCurrentStaffRole] = useState('')
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])

  // Tabs
  const [activeTab, setActiveTab] = useState<HubTab>('messages')

  // Messages
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const [convSearch, setConvSearch] = useState('')
  const [showNewConv, setShowNewConv] = useState(false)
  const [newConvType, setNewConvType] = useState<'direct' | 'group'>('direct')
  const [newConvName, setNewConvName] = useState('')
  const [newConvParticipants, setNewConvParticipants] = useState<string[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskFilter, setTaskFilter] = useState<string>('all')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', category: 'general', assignedTo: '', dueDate: '' })
  const [taskComment, setTaskComment] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifUnread, setNotifUnread] = useState(0)

  // Presence
  const [onlineStaff, setOnlineStaff] = useState<Set<string>>(new Set())

  // Calls
  const [activeCall, setActiveCall] = useState<any>(null)
  const [callStatus, setCallStatus] = useState<string>('')

  // ── Notification toast ──
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null)
  const showToast = (type: string, message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000) }

  // ═══ INIT ═══
  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        const docId = authUser.doctor.id
        setDoctorId(docId)

        // Check if user is staff or doctor
        const { data: staffRecord } = await supabase
          .from('practice_staff')
          .select('id, first_name, last_name, role, email')
          .eq('email', authUser.email)
          .eq('doctor_id', docId)
          .eq('active', true)
          .maybeSingle()

        if (staffRecord) {
          setCurrentStaffId(staffRecord.id)
          setCurrentStaffName(`${staffRecord.first_name || ''} ${staffRecord.last_name || ''}`.trim())
          setCurrentStaffRole(staffRecord.role)
        } else {
          // Doctor is also a staff entry (self) — check or create
          const { data: doctorStaff } = await supabase
            .from('practice_staff')
            .select('id, first_name, last_name, role')
            .eq('doctor_id', docId)
            .eq('role', 'doctor')
            .maybeSingle()

          if (doctorStaff) {
            setCurrentStaffId(doctorStaff.id)
            setCurrentStaffName(`Dr. ${doctorStaff.first_name || authUser.doctor.first_name || ''} ${doctorStaff.last_name || authUser.doctor.last_name || ''}`.trim())
            setCurrentStaffRole('doctor')
          } else {
            setCurrentStaffName(`Dr. ${authUser.doctor.first_name || ''} ${authUser.doctor.last_name || ''}`.trim())
            setCurrentStaffRole('doctor')
          }
        }

        // Fetch all staff
        const { data: staff } = await supabase
          .from('practice_staff')
          .select('id, first_name, last_name, role, email, active')
          .eq('doctor_id', docId)
          .eq('active', true)
          .order('role')

        setAllStaff(staff || [])
      } catch (err) {
        console.error('Staff hub init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // ═══ REALTIME SETUP ═══
  useEffect(() => {
    if (!currentStaffId || !doctorId) return

    // Subscribe to presence channel
    const presenceChannel = supabase.channel(`staff-presence:${doctorId}`)
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online = new Set<string>()
        Object.values(state).flat().forEach((p: any) => online.add(p.staff_id))
        setOnlineStaff(online)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ staff_id: currentStaffId, name: currentStaffName, role: currentStaffRole })
        }
      })

    // Subscribe to notifications via broadcast
    const notifChannel = supabase.channel(`staff-notif:${currentStaffId}`)
    notifChannel
      .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
        setNotifications(prev => [payload, ...prev])
        setNotifUnread(prev => prev + 1)
        showToast('info', payload.title)
        // Play notification sound
        try { new Audio('/notification.mp3').play().catch(() => {}) } catch {}
      })
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        if (payload.conversation_id === activeConv?.id) {
          setMessages(prev => [...prev, payload])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
        // Update unread counts
        if (payload.sender?.id !== currentStaffId) {
          setUnreadCounts(prev => ({
            ...prev,
            [payload.conversation_id]: (prev[payload.conversation_id] || 0) + 1
          }))
        }
      })
      .on('broadcast', { event: 'call_incoming' }, ({ payload }) => {
        setActiveCall(payload)
        setCallStatus('ringing')
        showToast('call', `Incoming ${payload.call_type} call`)
        try { new Audio('/ringtone.mp3').play().catch(() => {}) } catch {}
      })
      .subscribe()

    channelRef.current = notifChannel

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(notifChannel)
    }
  }, [currentStaffId, doctorId, activeConv?.id, currentStaffName, currentStaffRole])

  // ═══ DATA FETCHING ═══
  const fetchConversations = useCallback(async () => {
    if (!doctorId || !currentStaffId) return
    try {
      const res = await fetch(`/api/staff-messages?action=conversations&doctorId=${doctorId}&staffId=${currentStaffId}`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) { console.error('Fetch conversations error:', err) }
  }, [doctorId, currentStaffId])

  const fetchMessages = useCallback(async (convId: string) => {
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/staff-messages?action=messages&doctorId=${doctorId}&conversationId=${convId}`)
      const data = await res.json()
      setMessages(data.messages || [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) { console.error('Fetch messages error:', err) }
    finally { setMsgLoading(false) }
  }, [doctorId])

  const fetchTasks = useCallback(async () => {
    if (!doctorId || !currentStaffId) return
    try {
      const res = await fetch(`/api/staff-tasks?doctorId=${doctorId}&staffId=${currentStaffId}&status=${taskFilter}`)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) { console.error('Fetch tasks error:', err) }
  }, [doctorId, currentStaffId, taskFilter])

  const fetchNotifications = useCallback(async () => {
    if (!currentStaffId) return
    try {
      const res = await fetch(`/api/staff-notifications?staffId=${currentStaffId}`)
      const data = await res.json()
      setNotifications(data.notifications || [])
      setNotifUnread(data.unreadCount || 0)
    } catch (err) { console.error('Fetch notifications error:', err) }
  }, [currentStaffId])

  const fetchUnreadCounts = useCallback(async () => {
    if (!doctorId || !currentStaffId) return
    try {
      const res = await fetch(`/api/staff-messages?action=unread&doctorId=${doctorId}&staffId=${currentStaffId}`)
      const data = await res.json()
      setUnreadCounts(data.unreadCounts || {})
    } catch (err) { console.error('Fetch unread error:', err) }
  }, [doctorId, currentStaffId])

  useEffect(() => {
    if (!doctorId || !currentStaffId) return
    fetchConversations()
    fetchUnreadCounts()
    fetchNotifications()
    if (activeTab === 'tasks') fetchTasks()
  }, [doctorId, currentStaffId, activeTab, fetchConversations, fetchUnreadCounts, fetchNotifications, fetchTasks])

  // ═══ ACTIONS ═══

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeConv || !currentStaffId || !doctorId) return
    const content = msgInput.trim()
    setMsgInput('')
    try {
      const res = await fetch('/api/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', doctorId, staffId: currentStaffId, conversationId: activeConv.id, content })
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        // Broadcast to channel
        channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data.message })
      }
    } catch (err) { showToast('error', 'Failed to send message') }
  }

  const createConversation = async () => {
    if (!currentStaffId || !doctorId || !newConvParticipants.length) return
    try {
      const res = await fetch('/api/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_conversation', doctorId, staffId: currentStaffId,
          type: newConvType, name: newConvName || null,
          participantIds: newConvParticipants
        })
      })
      const data = await res.json()
      if (data.conversation) {
        setShowNewConv(false)
        setNewConvParticipants([])
        setNewConvName('')
        await fetchConversations()
        openConversation(data.conversation)
      }
    } catch (err) { showToast('error', 'Failed to create conversation') }
  }

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv)
    await fetchMessages(conv.id)
    // Mark as read
    if (currentStaffId && doctorId) {
      fetch('/api/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', doctorId, staffId: currentStaffId, conversationId: conv.id })
      }).catch(() => {})
      setUnreadCounts(prev => ({ ...prev, [conv.id]: 0 }))
    }
  }

  const createTask = async () => {
    if (!newTask.title.trim() || !currentStaffId || !doctorId) return
    try {
      const res = await fetch('/api/staff-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', doctorId, staffId: currentStaffId,
          title: newTask.title, description: newTask.description,
          priority: newTask.priority, category: newTask.category,
          assignedTo: newTask.assignedTo || null,
          dueDate: newTask.dueDate || null
        })
      })
      const data = await res.json()
      if (data.task) {
        setShowNewTask(false)
        setNewTask({ title: '', description: '', priority: 'normal', category: 'general', assignedTo: '', dueDate: '' })
        showToast('success', 'Task created')
        fetchTasks()
      }
    } catch (err) { showToast('error', 'Failed to create task') }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!currentStaffId || !doctorId) return
    try {
      await fetch('/api/staff-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', doctorId, staffId: currentStaffId, taskId, status: newStatus })
      })
      showToast('success', `Task ${newStatus}`)
      fetchTasks()
    } catch (err) { showToast('error', 'Failed to update task') }
  }

  const initiateCall = async (calleeId: string, callType: 'voice' | 'video') => {
    if (!currentStaffId || !doctorId) return
    try {
      const res = await fetch('/api/staff-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiate', doctorId, staffId: currentStaffId, calleeId, callType })
      })
      const data = await res.json()
      if (data.call) {
        setActiveCall(data.call)
        setCallStatus('calling')
        showToast('info', `Calling...`)
        // Broadcast call event
        const calleeChannel = supabase.channel(`staff-notif:${calleeId}`)
        calleeChannel.subscribe(async () => {
          await calleeChannel.send({ type: 'broadcast', event: 'call_incoming', payload: data.call })
          supabase.removeChannel(calleeChannel)
        })
        // Open Daily.co room for video
        if (data.call.daily_room_url) {
          window.open(data.call.daily_room_url, '_blank', 'width=800,height=600')
        }
      }
    } catch (err) { showToast('error', 'Failed to initiate call') }
  }

  const markAllNotificationsRead = async () => {
    if (!currentStaffId) return
    try {
      await fetch('/api/staff-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', staffId: currentStaffId })
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setNotifUnread(0)
    } catch (err) { console.error(err) }
  }

  // ═══ HELPERS ═══
  const getConvDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name
    if (conv.type === 'direct') {
      const other = conv.staff_conversation_participants?.find(p => p.staff_id !== currentStaffId)
      if (other?.practice_staff) return `${other.practice_staff.first_name} ${other.practice_staff.last_name}`
    }
    return 'Conversation'
  }

  const getInitials = (firstName: string, lastName: string) =>
    `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?'

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts])

  const filteredConversations = useMemo(() => {
    if (!convSearch.trim()) return conversations
    const q = convSearch.toLowerCase()
    return conversations.filter(c =>
      getConvDisplayName(c).toLowerCase().includes(q) ||
      (c.last_message_preview || '').toLowerCase().includes(q)
    )
  }, [conversations, convSearch, currentStaffId])

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks
    return tasks.filter(t => t.status === taskFilter)
  }, [tasks, taskFilter])

  const taskCounts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, completed: 0, overdue: 0 }
    tasks.forEach(t => {
      if (t.status === 'pending') c.pending++
      if (t.status === 'in_progress') c.in_progress++
      if (t.status === 'completed') c.completed++
      if (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' && t.status !== 'cancelled') c.overdue++
    })
    return c
  }, [tasks])

  // ═══ RENDER ═══
  if (loading) return (
    <div className="min-h-screen bg-[#0a1f1f] flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a1f1f] flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-xl border ${
          toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' :
          toast.type === 'call' ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' :
          'bg-teal-500/20 border-teal-500/30 text-teal-300'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.push('/doctor/dashboard')} className="p-1.5 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Staff Communication Hub</h1>
              <p className="text-[10px] text-gray-500">{onlineStaff.size} online &bull; {allStaff.length} team members</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right mr-3">
              <p className="text-xs text-white font-medium">{currentStaffName}</p>
              <p className="text-[10px] text-gray-500 capitalize">{currentStaffRole}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-[10px] font-bold text-white">
              {getInitials(currentStaffName.split(' ')[0] || '', currentStaffName.split(' ').slice(1).join(' ') || '')}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex mt-3 space-x-1">
          {([
            { key: 'messages' as HubTab, label: 'Messages', icon: MessageSquare, badge: totalUnread },
            { key: 'tasks' as HubTab, label: 'Tasks', icon: CheckSquare, badge: taskCounts.pending + taskCounts.overdue },
            { key: 'notifications' as HubTab, label: 'Alerts', icon: Bell, badge: notifUnread },
            { key: 'team' as HubTab, label: 'Team', icon: Users, badge: 0 },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative ${
                activeTab === tab.key ? 'bg-teal-600/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-hidden">

        {/* ═══ MESSAGES TAB ═══ */}
        {activeTab === 'messages' && (
          <div className="flex h-[calc(100vh-130px)]">
            {/* Conversation List */}
            <div className={`${activeConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-[#1a3d3d] bg-[#0d2626]`}>
              <div className="p-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search conversations..."
                      className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
                  </div>
                  <button onClick={() => setShowNewConv(true)} className="p-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-xs">No conversations yet. Start one!</div>
                ) : (
                  filteredConversations.map(conv => {
                    const name = getConvDisplayName(conv)
                    const unread = unreadCounts[conv.id] || 0
                    const isActive = activeConv?.id === conv.id
                    return (
                      <button key={conv.id} onClick={() => openConversation(conv)}
                        className={`w-full text-left px-3 py-3 border-b border-[#1a3d3d]/50 hover:bg-[#1a3d3d]/50 transition-colors ${
                          isActive ? 'bg-teal-600/10 border-l-2 border-l-teal-500' : ''
                        }`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                            conv.type === 'group' ? 'bg-purple-600' : conv.type === 'channel' ? 'bg-blue-600' : 'bg-gray-600'
                          }`}>
                            {conv.type === 'group' ? <Users className="w-4 h-4" /> : conv.type === 'channel' ? <Hash className="w-4 h-4" /> : getInitials(name.split(' ')[0], name.split(' ')[1] || '')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium truncate ${unread > 0 ? 'text-white' : 'text-gray-300'}`}>{name}</p>
                              {conv.last_message_at && <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[11px] text-gray-500 truncate">{conv.last_message_preview || 'No messages'}</p>
                              {unread > 0 && (
                                <span className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Message Area */}
            <div className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-[#0a1f1f]`}>
              {activeConv ? (
                <>
                  {/* Conv Header */}
                  <div className="bg-[#0d2626] border-b border-[#1a3d3d] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button onClick={() => setActiveConv(null)} className="md:hidden p-1 rounded hover:bg-[#1a3d3d] text-gray-400">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="text-sm font-bold text-white">{getConvDisplayName(activeConv)}</p>
                        <p className="text-[10px] text-gray-500">
                          {activeConv.staff_conversation_participants?.length || 0} participants
                          {activeConv.type === 'direct' && (() => {
                            const other = activeConv.staff_conversation_participants?.find(p => p.staff_id !== currentStaffId)
                            return other?.staff_id && onlineStaff.has(other.staff_id) ? ' • Online' : ' • Offline'
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {activeConv.type === 'direct' && (() => {
                        const other = activeConv.staff_conversation_participants?.find(p => p.staff_id !== currentStaffId)
                        return other ? (
                          <>
                            <button onClick={() => other.staff_id && initiateCall(other.staff_id, 'voice')}
                              className="p-2 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-green-400 transition-colors" title="Voice call">
                              <Phone className="w-4 h-4" />
                            </button>
                            <button onClick={() => other.staff_id && initiateCall(other.staff_id, 'video')}
                              className="p-2 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-blue-400 transition-colors" title="Video call">
                              <Video className="w-4 h-4" />
                            </button>
                          </>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {msgLoading ? (
                      <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 text-gray-500 animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-gray-500 text-xs py-8">No messages yet. Say hello!</div>
                    ) : (
                      messages.map(msg => {
                        const isMe = msg.sender?.id === currentStaffId
                        const isSystem = msg.message_type === 'system'
                        if (isSystem) return (
                          <div key={msg.id} className="text-center">
                            <span className="text-[10px] text-gray-500 bg-[#0d2626] px-3 py-1 rounded-full">{msg.content}</span>
                          </div>
                        )
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                              {!isMe && (
                                <p className={`text-[10px] font-medium mb-0.5 ${ROLE_COLORS[msg.sender?.role || ''] || 'text-gray-400'}`}>
                                  {msg.sender?.first_name} {msg.sender?.last_name}
                                  <span className="text-gray-600 ml-1 capitalize">({msg.sender?.role})</span>
                                </p>
                              )}
                              <div className={`px-3 py-2 rounded-xl text-sm ${
                                isMe ? 'bg-teal-600 text-white rounded-br-sm' : 'bg-[#0d2626] text-gray-200 border border-[#1a3d3d] rounded-bl-sm'
                              }`}>
                                {msg.content}
                              </div>
                              <p className={`text-[9px] text-gray-600 mt-0.5 ${isMe ? 'text-right' : ''}`}>
                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {msg.is_edited && ' (edited)'}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="bg-[#0d2626] border-t border-[#1a3d3d] p-3">
                    <div className="flex items-center space-x-2">
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Type a message..." autoFocus
                        className="flex-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
                      <button onClick={sendMessage} disabled={!msgInput.trim()}
                        className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a conversation or start a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TASKS TAB ═══ */}
        {activeTab === 'tasks' && (
          <div className="p-4 space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto">
            {/* Task Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Pending', count: taskCounts.pending, color: 'text-amber-400', bg: 'bg-amber-500/15', filter: 'pending' },
                { label: 'In Progress', count: taskCounts.in_progress, color: 'text-blue-400', bg: 'bg-blue-500/15', filter: 'in_progress' },
                { label: 'Completed', count: taskCounts.completed, color: 'text-green-400', bg: 'bg-green-500/15', filter: 'completed' },
                { label: 'Overdue', count: taskCounts.overdue, color: 'text-red-400', bg: 'bg-red-500/15', filter: 'overdue' },
              ].map(s => (
                <button key={s.label} onClick={() => setTaskFilter(taskFilter === s.filter ? 'all' : s.filter)}
                  className={`bg-[#0d2626] rounded-lg p-3 border transition-all ${taskFilter === s.filter ? 'border-teal-500/50 ring-1 ring-teal-500/20' : 'border-[#1a3d3d] hover:border-teal-500/30'}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </button>
              ))}
            </div>

            {/* New Task Button */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Tasks ({filteredTasks.length})</h2>
              <button onClick={() => setShowNewTask(true)} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5" /><span>New Task</span>
              </button>
            </div>

            {/* Task List */}
            <div className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="bg-[#0d2626] rounded-lg p-8 text-center text-gray-500 text-xs border border-[#1a3d3d]">No tasks found</div>
              ) : (
                filteredTasks.map(task => {
                  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal
                  const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.general
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' && task.status !== 'cancelled'
                  return (
                    <div key={task.id} className={`bg-[#0d2626] rounded-lg p-4 border transition-all hover:border-teal-500/30 ${
                      isOverdue ? 'border-red-500/40' : 'border-[#1a3d3d]'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pri.bg} ${pri.color}`}>{pri.label}</span>
                            <span className="text-[10px] text-gray-500">{cat.icon} {cat.label}</span>
                            {isOverdue && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400">OVERDUE</span>}
                          </div>
                          <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</p>
                          {task.description && <p className="text-[11px] text-gray-400 mt-1">{task.description}</p>}
                          <div className="flex items-center flex-wrap gap-2 mt-2">
                            {task.assigned_to_staff && (
                              <span className="text-[10px] text-gray-400 flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{task.assigned_to_staff.first_name} {task.assigned_to_staff.last_name}</span>
                              </span>
                            )}
                            {task.assigned_by_staff && (
                              <span className="text-[10px] text-gray-500">from {task.assigned_by_staff.first_name} {task.assigned_by_staff.last_name}</span>
                            )}
                            {task.due_date && (
                              <span className={`text-[10px] flex items-center space-x-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.due_date).toLocaleDateString()}</span>
                              </span>
                            )}
                            {task.patients && (
                              <span className="text-[10px] text-cyan-400">Patient: {task.patients.first_name} {task.patients.last_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-3">
                          {task.status === 'pending' && (
                            <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors">
                              Start
                            </button>
                          )}
                          {(task.status === 'pending' || task.status === 'in_progress') && (
                            <button onClick={() => updateTaskStatus(task.id, 'completed')} className="px-2 py-1 rounded text-[10px] font-bold bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors">
                              Done
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Task Comments */}
                      {task.staff_task_comments?.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-[#1a3d3d] space-y-1">
                          {task.staff_task_comments.slice(0, 3).map(c => (
                            <p key={c.id} className="text-[10px] text-gray-400">
                              <span className="font-medium text-gray-300">{c.practice_staff?.first_name}:</span> {c.content}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ═══ NOTIFICATIONS TAB ═══ */}
        {activeTab === 'notifications' && (
          <div className="p-4 space-y-3 max-h-[calc(100vh-130px)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Notifications ({notifUnread} unread)</h2>
              {notifUnread > 0 && (
                <button onClick={markAllNotificationsRead} className="text-[10px] text-teal-400 hover:text-teal-300 font-medium">Mark all read</button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg p-8 text-center text-gray-500 text-xs border border-[#1a3d3d]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notif => {
                const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
                  message: { icon: MessageSquare, color: 'text-teal-400' },
                  task_assigned: { icon: CheckSquare, color: 'text-blue-400' },
                  task_completed: { icon: CheckCircle, color: 'text-green-400' },
                  task_due: { icon: Clock, color: 'text-amber-400' },
                  mention: { icon: User, color: 'text-purple-400' },
                  call_incoming: { icon: PhoneCall, color: 'text-green-400' },
                  call_missed: { icon: PhoneOff, color: 'text-red-400' },
                  chart_update: { icon: Edit3, color: 'text-cyan-400' },
                  urgent: { icon: AlertCircle, color: 'text-red-400' },
                  system: { icon: Shield, color: 'text-gray-400' },
                }
                const tc = typeConfig[notif.type] || typeConfig.system
                const Icon = tc.icon
                return (
                  <div key={notif.id} className={`bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d] flex items-start space-x-3 ${
                    !notif.is_read ? 'border-l-2 border-l-teal-500' : 'opacity-70'
                  }`}>
                    <div className={`w-8 h-8 rounded-full bg-[#0a1f1f] flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${!notif.is_read ? 'text-white' : 'text-gray-400'}`}>{notif.title}</p>
                      {notif.body && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{notif.body}</p>}
                      <p className="text-[9px] text-gray-600 mt-1">{formatTime(notif.created_at)}</p>
                    </div>
                    {notif.link && (
                      <button onClick={() => { if (notif.link) router.push(notif.link) }}
                        className="text-[10px] text-teal-400 hover:text-teal-300 flex-shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ═══ TEAM TAB ═══ */}
        {activeTab === 'team' && (
          <div className="p-4 space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto">
            <h2 className="text-sm font-bold text-white">Team Members ({allStaff.length})</h2>
            <div className="grid gap-2">
              {allStaff.map(member => {
                const isOnline = onlineStaff.has(member.id)
                const isMe = member.id === currentStaffId
                return (
                  <div key={member.id} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          member.role === 'doctor' ? 'bg-teal-600' : 'bg-gray-600'
                        }`}>
                          {getInitials(member.first_name, member.last_name)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d2626] ${
                          isOnline ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {member.first_name} {member.last_name}
                          {isMe && <span className="text-[10px] text-gray-500 ml-1">(you)</span>}
                        </p>
                        <p className={`text-[10px] capitalize ${ROLE_COLORS[member.role] || 'text-gray-400'}`}>{member.role}</p>
                      </div>
                    </div>
                    {!isMe && (
                      <div className="flex items-center space-x-1">
                        <button onClick={() => {
                          // Start direct message
                          setNewConvType('direct')
                          setNewConvParticipants([member.id])
                          createConversation()
                          setActiveTab('messages')
                        }} className="p-2 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-teal-400 transition-colors" title="Message">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button onClick={() => initiateCall(member.id, 'voice')}
                          className="p-2 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-green-400 transition-colors" title="Call">
                          <Phone className="w-4 h-4" />
                        </button>
                        <button onClick={() => initiateCall(member.id, 'video')}
                          className="p-2 rounded-lg hover:bg-[#1a3d3d] text-gray-400 hover:text-blue-400 transition-colors" title="Video">
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ NEW CONVERSATION MODAL ═══ */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">New Conversation</h3>
              <button onClick={() => { setShowNewConv(false); setNewConvParticipants([]) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Type selector */}
            <div className="flex space-x-2">
              {(['direct', 'group'] as const).map(t => (
                <button key={t} onClick={() => setNewConvType(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${newConvType === t ? 'bg-teal-600 text-white' : 'bg-[#0a1f1f] text-gray-400 border border-[#1a3d3d]'}`}>
                  {t === 'direct' ? 'Direct Message' : 'Group Chat'}
                </button>
              ))}
            </div>

            {/* Group name */}
            {newConvType === 'group' && (
              <input value={newConvName} onChange={e => setNewConvName(e.target.value)} placeholder="Group name..."
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
            )}

            {/* Participant picker */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs text-gray-400 font-medium">Select {newConvType === 'direct' ? 'person' : 'participants'}:</p>
              {allStaff.filter(s => s.id !== currentStaffId).map(member => {
                const selected = newConvParticipants.includes(member.id)
                return (
                  <button key={member.id} onClick={() => {
                    if (newConvType === 'direct') {
                      setNewConvParticipants([member.id])
                    } else {
                      setNewConvParticipants(prev => selected ? prev.filter(id => id !== member.id) : [...prev, member.id])
                    }
                  }} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selected ? 'bg-teal-600/20 border border-teal-500/30' : 'hover:bg-[#1a3d3d] border border-transparent'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${selected ? 'bg-teal-600' : 'bg-gray-600'}`}>
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                    <div>
                      <p className="text-xs text-white font-medium">{member.first_name} {member.last_name}</p>
                      <p className={`text-[10px] capitalize ${ROLE_COLORS[member.role] || 'text-gray-500'}`}>{member.role}</p>
                    </div>
                    {selected && <CheckCircle className="w-4 h-4 text-teal-400 ml-auto" />}
                  </button>
                )
              })}
            </div>

            <div className="flex space-x-3">
              <button onClick={() => { setShowNewConv(false); setNewConvParticipants([]) }}
                className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Cancel</button>
              <button onClick={createConversation} disabled={newConvParticipants.length === 0}
                className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW TASK MODAL ═══ */}
      {showNewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">New Task</h3>
              <button onClick={() => setShowNewTask(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Title <span className="text-red-400">*</span></label>
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title..."
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50" />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Description</label>
              <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Optional details..." rows={3}
                className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Priority</label>
                <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                  className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Category</label>
                <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Assign To</label>
                <select value={newTask.assignedTo} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                  className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50">
                  <option value="">Unassigned</option>
                  {allStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Due Date</label>
                <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50" />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button onClick={() => setShowNewTask(false)}
                className="flex-1 py-2 rounded-lg border border-[#1a3d3d] text-gray-400 hover:text-white text-sm font-medium transition-colors">Cancel</button>
              <button onClick={createTask} disabled={!newTask.title.trim()}
                className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INCOMING CALL OVERLAY ═══ */}
      {activeCall && callStatus === 'ringing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0d2626] border border-[#1a3d3d] rounded-2xl p-8 text-center space-y-6 w-full max-w-sm">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
              {activeCall.call_type === 'video' ? <Video className="w-10 h-10 text-green-400" /> : <Phone className="w-10 h-10 text-green-400" />}
            </div>
            <div>
              <p className="text-lg font-bold text-white">Incoming {activeCall.call_type} call</p>
              <p className="text-sm text-gray-400 mt-1">from staff member</p>
            </div>
            <div className="flex items-center justify-center space-x-6">
              <button onClick={async () => {
                setCallStatus('')
                setActiveCall(null)
                await fetch('/api/staff-calls', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update_status', doctorId, staffId: currentStaffId, callId: activeCall.id, status: 'declined' })
                }).catch(() => {})
              }} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-colors">
                <PhoneOff className="w-6 h-6" />
              </button>
              <button onClick={async () => {
                setCallStatus('connected')
                await fetch('/api/staff-calls', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update_status', doctorId, staffId: currentStaffId, callId: activeCall.id, status: 'connected' })
                }).catch(() => {})
                if (activeCall.daily_room_url) window.open(activeCall.daily_room_url, '_blank', 'width=800,height=600')
                setActiveCall(null)
                setCallStatus('')
              }} className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white transition-colors">
                <Phone className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
