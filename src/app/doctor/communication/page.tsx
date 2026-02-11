'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Phone, MessageSquare, Send, Clock, PhoneCall, 
  Play, Pause, Download, X, Mic, MicOff,
  PhoneOff, RefreshCw, ArrowLeft
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Device, Call } from '@twilio/voice-sdk'
import Dialog from '@/components/Dialog'
import PatientSearchBar, { type PatientSearchResult } from '@/components/PatientSearchBar'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────

interface HistoryItem {
  id: string
  type: 'call' | 'sms' | 'video' | 'email'
  direction: 'inbound' | 'outbound'
  to_number?: string
  from_number?: string
  message?: string
  status?: string
  duration?: number
  twilio_sid?: string
  meeting_url?: string
  meeting_id?: string
  recording_url?: string
  created_at: string
  patients?: { id: string; first_name: string; last_name: string; phone: string }
}

// ─── Component ───────────────────────────────────────────────────────
export default function CommunicationPage() {
  // Patient state
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'call' | 'sms'>('call')

  // Call state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [callStatus, setCallStatus] = useState('Initializing...')
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const [isCallLoading, setIsCallLoading] = useState(false)

  // SMS state
  const [smsTo, setSmsTo] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSMS, setIsSendingSMS] = useState(false)

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'call' | 'sms'>('all')

  // Audio device state
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
  const [selectedMic, setSelectedMic] = useState('default')
  const [selectedSpeaker, setSelectedSpeaker] = useState('default')
  const [micGranted, setMicGranted] = useState(false)

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const recordingCache = useRef<Record<string, string>>({})
  const fetchingRecordings = useRef<Set<string>>(new Set())

  // Dialog
  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  // Twilio refs
  const deviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchHistory()
    initTwilioDevice()
    loadAudioDevices()

    const handleDeviceChange = () => loadAudioDevices()
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange)

    return () => {
      deviceRef.current?.destroy()
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [])

  // Set phone/sms fields when patient selected
  useEffect(() => {
    if (selectedPatient) {
      let ph = selectedPatient.phone || ''
      // Ensure +1 prefix for US numbers
      if (ph) {
        const digits = ph.replace(/[\s\-\(\)\+\.]/g, '')
        if (digits.length === 10) {
          ph = `+1${digits}`
        } else if (digits.length === 11 && digits.startsWith('1')) {
          ph = `+${digits}`
        } else if (!ph.startsWith('+')) {
          ph = `+${digits}`
        }
      }
      setPhoneNumber(ph)
      setSmsTo(ph)
    }
  }, [selectedPatient])

  // ─── Data Fetching ───────────────────────────────────────────────
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/communication/history', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        credentials: 'include'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success && data.history) {
        setHistory(data.history)
        // Cache recording URLs
        data.history.forEach((item: HistoryItem) => {
          if (item.recording_url) {
            const key = item.twilio_sid || item.meeting_id
            if (key) recordingCache.current[key] = item.recording_url
          }
        })
      }
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // ─── Twilio Device ───────────────────────────────────────────────
  const initTwilioDevice = async () => {
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !supabaseUser) { setCallStatus('Please login'); return }

      const user = await getCurrentUser()
      if (!user) { setCallStatus('Doctor account not found'); return }

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) { setCallStatus('Session expired'); return }

      const res = await fetch('/api/communication/twilio-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ identity: user.email })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setCallStatus(res.status === 401 ? 'Auth failed — refresh page' : `Error: ${err.error || 'Token failed'}`)
        return
      }

      const { token } = await res.json()
      if (!token) { setCallStatus('Invalid token response'); return }

      const TwilioSDK = await import('@twilio/voice-sdk')
      const DeviceClass = TwilioSDK.Device || (TwilioSDK as any).default || TwilioSDK
      if (typeof DeviceClass !== 'function') throw new Error('Device import failed')

      const device = new DeviceClass(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any,
        enableRingtones: true,
        allowIncomingWhileBusy: false
      } as any)

      device.on('registered', () => {
        console.log('✅ Twilio device registered')
        setCallStatus('Ready')
        setIsDeviceReady(true)
        applyAudioDevices()
      })
      device.on('registering', () => { setCallStatus('Registering...'); setIsDeviceReady(false) })
      device.on('error', (e: any) => { console.error('Device error:', e); setCallStatus(`Error: ${e.message}`); setIsDeviceReady(false) })
      device.on('unregistered', () => { setCallStatus('Disconnected'); setIsDeviceReady(false) })

      device.on('tokenWillExpire', async () => {
        try {
          const r = await fetch('/api/communication/twilio-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            credentials: 'include',
            body: JSON.stringify({ identity: user.email })
          })
          const { token: newToken } = await r.json()
          if (newToken) { device.updateToken(newToken); setCallStatus('Ready') }
        } catch (err) { console.error('Token refresh failed:', err) }
      })

      device.on('incoming', (call: Call) => {
        activeCallRef.current = call
        setIsCalling(true)
        setCallStatus('Incoming call...')
        setupCallHandlers(call)
      })

      deviceRef.current = device
      device.register()
    } catch (error) {
      console.error('Twilio init error:', error)
      setCallStatus('Failed to initialize')
    }
  }

  const setupCallHandlers = (call: Call) => {
    call.on('accept', () => {
      setCallStatus('Connected')
      setIsCalling(true)
      setCallDuration(0)

      // Attach remote audio
      try {
        const remoteStream = (call as any).remoteStream
        if (remoteStream) {
          if (!remoteAudioRef.current) {
            remoteAudioRef.current = new Audio()
            remoteAudioRef.current.autoplay = true
          }
          remoteAudioRef.current.srcObject = remoteStream
          if (selectedSpeaker !== 'default' && typeof remoteAudioRef.current.setSinkId === 'function') {
            (remoteAudioRef.current as any).setSinkId(selectedSpeaker).catch(console.warn)
          }
          remoteAudioRef.current.play().catch((e: any) => {
            setTimeout(() => remoteAudioRef.current?.play().catch(console.error), 500)
          })
        }
      } catch (err) { console.error('Remote audio error:', err) }

      // Enable all audio tracks
      const local = (call as any).localStream?.getAudioTracks() || []
      const remote = (call as any).remoteStream?.getAudioTracks() || []
      local.forEach((t: MediaStreamTrack) => { t.enabled = true })
      remote.forEach((t: MediaStreamTrack) => { t.enabled = true })

      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    })

    call.on('sample', () => {
      const remoteStream = (call as any).remoteStream
      if (remoteStream && remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = remoteStream
        remoteAudioRef.current.play().catch(console.warn)
      }
    })

    call.on('disconnect', () => {
      setCallStatus('Call ended')
      cleanupCall()
      setTimeout(() => { if (!activeCallRef.current) setCallStatus('Ready') }, 2000)
      fetchHistory()
    })
    call.on('cancel', () => { setCallStatus('Call cancelled'); cleanupCall() })
    call.on('reject', () => { setCallStatus('Call rejected'); cleanupCall() })
    call.on('error', (e: any) => { setCallStatus(`Error: ${e.message}`); cleanupCall() })
  }

  const cleanupCall = () => {
    setIsCalling(false)
    setIsCallLoading(false)
    activeCallRef.current = null
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
    setCallDuration(0)
    setIsMuted(false)
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause()
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current = null
    }
  }

  // ─── Call Actions ────────────────────────────────────────────────
  const handleMakeCall = async () => {
    if (isCallLoading || isCalling || !phoneNumber.trim()) return

    // Validate number
    const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, '')
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    const digits = formatted.substring(1)
    if (!/^\d{10,15}$/.test(digits)) {
      setDialog({ isOpen: true, title: 'Invalid Number', message: 'Enter a valid phone number with country code (e.g., +14805551234)', type: 'error' })
      return
    }

    if (!deviceRef.current) {
      setDialog({ isOpen: true, title: 'Not Ready', message: 'Twilio device not initialized. Please wait.', type: 'warning' })
      return
    }

    // Request mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setDialog({ isOpen: true, title: 'Microphone Required', message: 'Allow microphone access to make calls.', type: 'error' })
      return
    }

    setIsCallLoading(true)
    setCallStatus('Connecting...')

    try {
      // Wait for device registration if needed
      if (deviceRef.current.state !== 'registered') {
        await new Promise<void>((resolve, reject) => {
          const start = Date.now()
          const check = () => {
            if (deviceRef.current?.state === 'registered') resolve()
            else if (Date.now() - start > 10000) reject(new Error('Registration timeout'))
            else setTimeout(check, 100)
          }
          check()
        })
      }

      setIsCalling(true)
      applyAudioDevices()

      const audioConstraints = selectedMic !== 'default' ? { deviceId: { exact: selectedMic } } : true
      const call = await deviceRef.current.connect({
        params: { To: formatted },
        rtcConstraints: { audio: audioConstraints }
      } as any)

      activeCallRef.current = call
      setupCallHandlers(call)
      applyAudioDevices(call)

      // Save to history
      saveCallHistory(call, formatted)

      setIsCallLoading(false)
    } catch (error: any) {
      console.error('Call error:', error)
      setCallStatus(`Error: ${error.message}`)
      setIsCallLoading(false)
      setIsCalling(false)
      setDialog({ isOpen: true, title: 'Call Failed', message: error.message || 'Failed to make call', type: 'error' })
    }
  }

  const saveCallHistory = async (call: Call, formattedNumber: string) => {
    try {
      const user = await getCurrentUser()
      if (!user) return
      const { data: doctor } = await supabase.from('doctors').select('id').eq('email', user.email!).single()
      if (!doctor) return

      const saveFn = async (sid: string, status: string) => {
        const { data: existing } = await supabase
          .from('communication_history').select('id')
          .eq('twilio_sid', sid).eq('doctor_id', doctor.id).single()

        const record: any = { doctor_id: doctor.id, type: 'call', direction: 'outbound', to_number: formattedNumber, status, twilio_sid: sid }
        if (selectedPatient?.id) record.patient_id = selectedPatient.id

        if (existing) {
          await supabase.from('communication_history').update({ status, ...(selectedPatient?.id ? { patient_id: selectedPatient.id } : {}) })
            .eq('twilio_sid', sid).eq('doctor_id', doctor.id)
        } else {
          await supabase.from('communication_history').insert(record)
        }
        fetchHistory()
      }

      // Get CallSid when available
      let sid = (call as any).parameters?.CallSid || (call as any).sid
      if (sid) await saveFn(sid, 'initiated')
      else setTimeout(async () => {
        sid = (call as any).parameters?.CallSid || (call as any).sid
        if (sid) await saveFn(sid, 'initiated')
      }, 500)

      call.on('accept', async () => {
        const s = (call as any).parameters?.CallSid || (call as any).sid || sid
        if (s) { sid = s; await saveFn(s, 'connected') }
      })

      call.on('disconnect', async () => {
        const s = (call as any).parameters?.CallSid || (call as any).sid || sid
        if (s) {
          const { data: rec } = await supabase.from('communication_history').select('status')
            .eq('twilio_sid', s).eq('doctor_id', doctor.id).single()
          const finalStatus = rec?.status === 'connected' ? 'completed' : 'ended'
          await supabase.from('communication_history').update({ status: finalStatus, duration: callDuration })
            .eq('twilio_sid', s).eq('doctor_id', doctor.id)
          fetchHistory()
        }
      })
    } catch (err) { console.error('Save history error:', err) }
  }

  const handleEndCall = () => {
    activeCallRef.current?.disconnect()
    cleanupCall()
    setCallStatus('Call ended')
    setTimeout(() => { if (!activeCallRef.current) setCallStatus('Ready') }, 2000)
    fetchHistory()
  }

  const handleToggleMute = () => {
    if (!activeCallRef.current) return
    const next = !isMuted
    activeCallRef.current.mute(next)
    setIsMuted(next)
  }

  // ─── SMS ─────────────────────────────────────────────────────────
  const handleSendSMS = async () => {
    if (isSendingSMS || !smsTo.trim() || !smsMessage.trim()) {
      if (!smsTo.trim() || !smsMessage.trim()) {
        setDialog({ isOpen: true, title: 'Missing Info', message: 'Enter phone number and message', type: 'warning' })
      }
      return
    }

    let formatted = smsTo.trim()
    if (!formatted.startsWith('+')) formatted = `+${formatted}`

    setIsSendingSMS(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/communication/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' },
        credentials: 'include',
        body: JSON.stringify({ to: formatted, message: smsMessage.trim(), patientId: selectedPatient?.id })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send SMS')

      setDialog({ isOpen: true, title: 'Sent', message: 'SMS sent successfully!', type: 'success' })
      setSmsMessage('')
      fetchHistory()
    } catch (err: any) {
      setDialog({ isOpen: true, title: 'Error', message: err.message || 'Failed to send SMS', type: 'error' })
    } finally {
      setIsSendingSMS(false)
    }
  }

  // ─── Audio Devices ───────────────────────────────────────────────
  const loadAudioDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicGranted(true)
    } catch { /* permission denied */ }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter(d => d.kind === 'audioinput'))
      setSpeakers(devices.filter(d => d.kind === 'audiooutput'))
    } catch (err) { console.error('Audio devices error:', err) }
  }

  const applyAudioDevices = (call?: Call | null) => {
    const device = deviceRef.current
    if (!device) return
    if (selectedMic !== 'default' && device.audio) {
      try {
        if (typeof (device.audio as any).setInputDevice === 'function')
          (device.audio as any).setInputDevice(selectedMic).catch(console.warn)
      } catch {}
    }
    if (selectedSpeaker !== 'default') {
      try {
        if (device.audio && typeof (device.audio as any).setOutputDevice === 'function')
          (device.audio as any).setOutputDevice(selectedSpeaker).catch(console.warn)
      } catch {}
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  const handleDialPad = (digit: string) => setPhoneNumber(p => p + digit)
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const formatDate = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (diff === 0) return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff}d ago`
    return new Date(d).toLocaleDateString()
  }

  const filteredHistory = history.filter(h => {
    if (historyFilter !== 'all' && h.type !== historyFilter) return false
    if (selectedPatient) {
      const matchesPatient = h.patients?.id === selectedPatient.id
      const matchesPhone = h.to_number === selectedPatient.phone || h.from_number === selectedPatient.phone
      return matchesPatient || matchesPhone
    }
    return true
  })

  // Fetch recording from Twilio
  const fetchRecording = async (item: HistoryItem) => {
    const key = item.twilio_sid || item.meeting_id
    if (!key || fetchingRecordings.current.has(key)) return
    fetchingRecordings.current.add(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const param = item.twilio_sid ? `callSid=${item.twilio_sid}` : `meetingId=${item.meeting_id}`
      const res = await fetch(`/api/communication/recordings?${param}`, {
        headers: { 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' },
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success && data.recordingUrl) {
        recordingCache.current[key] = data.recordingUrl
        setHistory(prev => prev.map(h => h.id === item.id ? { ...h, recording_url: data.recordingUrl } : h))
        fetchHistory()
      } else {
        setDialog({ isOpen: true, title: 'No Recording', message: data.error || 'Recording not available yet.', type: 'warning' })
      }
    } catch {
      setDialog({ isOpen: true, title: 'Error', message: 'Failed to fetch recording', type: 'error' })
    } finally {
      fetchingRecordings.current.delete(key!)
    }
  }

  const togglePlayback = (id: string) => {
    const audio = audioRefs.current[id]
    if (!audio) return
    if (playingId === id) { audio.pause(); setPlayingId(null) }
    else {
      Object.values(audioRefs.current).forEach(a => a?.pause())
      audio.play().catch(console.error)
      setPlayingId(id)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#071515] to-[#0a1e1e] text-white overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 border-b border-[#1a3d3d]/60 bg-[#0a1a1a]/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link href="/doctor" className="p-1.5 rounded-lg hover:bg-[#164e4e]/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </Link>
            {/* Patient Search — EHR-standard unified search */}
            <PatientSearchBar
              onSelect={(patient) => setSelectedPatient(patient)}
              onClear={() => { setSelectedPatient(null); setPhoneNumber(''); setSmsTo('') }}
              selectedPatient={selectedPatient}
              compact
              showSelected
              className="w-72"
            />
          </div>

          <h1 className="text-base font-semibold text-white tracking-tight">Communication Center</h1>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left Panel: Dial Pad / SMS ── */}
        <div className="w-[380px] flex-shrink-0 border-r border-[#1a3d3d]/40 flex flex-col bg-[#091818]/50">

          {/* Tab Switcher */}
          <div className="flex border-b border-[#1a3d3d]/40">
            <button
              onClick={() => setActiveTab('call')}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'call' ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-400/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Phone className="w-4 h-4" />Call
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'sms' ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-400/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <MessageSquare className="w-4 h-4" />SMS
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'call' ? (
              /* ── CALL TAB ── */
              <div className="space-y-4">
                {/* Phone Input */}
                <div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (480) 555-1234"
                    disabled={isCalling}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-4 py-3 text-white text-lg font-mono tracking-wide focus:outline-none focus:border-teal-500 disabled:opacity-50 placeholder-gray-600"
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <p className={`text-xs ${isDeviceReady ? 'text-teal-500' : 'text-gray-500'}`}>
                      {isCalling && callDuration > 0 ? (
                        <span className="text-teal-400 font-mono font-bold text-sm">{formatDuration(callDuration)}</span>
                      ) : callStatus}
                    </p>
                    {isDeviceReady && !isCalling && (
                      <span className="flex items-center gap-1 text-xs text-teal-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        Ready
                      </span>
                    )}
                  </div>
                </div>

                {/* Audio Devices */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Mic</label>
                    <select
                      value={selectedMic}
                      onChange={(e) => { setSelectedMic(e.target.value); applyAudioDevices() }}
                      disabled={isCalling}
                      className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    >
                      {mics.length === 0 ? <option>No mic found</option> : mics.map(m => (
                        <option key={m.deviceId} value={m.deviceId}>{m.label || 'Microphone'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Speaker</label>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => { setSelectedSpeaker(e.target.value); applyAudioDevices() }}
                      disabled={isCalling}
                      className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    >
                      {speakers.length === 0 ? <option>Default</option> : speakers.map(s => (
                        <option key={s.deviceId} value={s.deviceId}>{s.label || 'Speaker'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dial Pad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                    <button
                      key={d}
                      onClick={() => handleDialPad(d)}
                      disabled={isCalling}
                      className="bg-[#0d2626] hover:bg-[#164e4e] border border-[#1a3d3d] rounded-lg py-3.5 text-white font-semibold text-lg transition-all active:scale-95 disabled:opacity-40"
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Call Controls */}
                <div className="flex gap-2">
                  {isCalling ? (
                    <>
                      <button
                        onClick={handleToggleMute}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${isMuted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1a3d3d] hover:bg-[#225454]'} text-white`}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={handleEndCall}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        <PhoneOff className="w-4 h-4" />End
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setPhoneNumber(''); }}
                        className="px-4 py-3 rounded-lg font-medium bg-[#1a3d3d] hover:bg-[#225454] text-gray-300 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleMakeCall}
                        disabled={!phoneNumber.trim() || !isDeviceReady || isCallLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isCallLoading ? (
                          <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />Connecting...</>
                        ) : (
                          <><Phone className="w-4 h-4" />Call</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* ── SMS TAB ── */
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">To</label>
                  <input
                    type="tel"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="+14805551234"
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Message</label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={8}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 resize-none placeholder-gray-600"
                  />
                  <p className="text-right text-[10px] text-gray-600 mt-1">{smsMessage.length}/1600</p>
                </div>
                <button
                  onClick={handleSendSMS}
                  disabled={isSendingSMS || !smsTo.trim() || !smsMessage.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSendingSMS ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" />Send SMS</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: History ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* History Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#1a3d3d]/40 bg-[#091818]/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <h2 className="text-sm font-semibold text-white">
                History
                {selectedPatient && <span className="text-gray-500 font-normal ml-1">— {selectedPatient.first_name} {selectedPatient.last_name}</span>}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              {(['all', 'call', 'sms'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${historyFilter === f ? 'bg-teal-600/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {f === 'all' ? 'All' : f === 'call' ? 'Calls' : 'SMS'}
                </button>
              ))}
              <button onClick={fetchHistory} className="p-1.5 rounded hover:bg-[#164e4e]/50 transition-colors" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400/30 border-t-teal-400" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <Clock className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No communication history</p>
                <p className="text-xs mt-1">Send an SMS or make a call to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1a3d3d]/30">
                {filteredHistory.map(item => {
                  const name = item.patients ? `${item.patients.first_name} ${item.patients.last_name}` : item.to_number || 'Unknown'
                  const isCall = item.type === 'call'
                  const isSMS = item.type === 'sms'
                  const recUrl = item.recording_url || recordingCache.current[item.twilio_sid || item.meeting_id || '']

                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-[#0d2020]/50 transition-colors group">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`mt-0.5 p-1.5 rounded-lg ${isCall ? 'bg-blue-500/10' : isSMS ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
                          {isCall ? <PhoneCall className="w-3.5 h-3.5 text-blue-400" /> : <MessageSquare className="w-3.5 h-3.5 text-green-400" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium truncate">{name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              item.status === 'completed' || item.status === 'delivered' || item.status === 'sent' ? 'bg-green-500/10 text-green-400' :
                              item.status === 'connected' ? 'bg-blue-500/10 text-blue-400' :
                              item.status === 'failed' || item.status === 'error' ? 'bg-red-500/10 text-red-400' :
                              'bg-gray-500/10 text-gray-400'
                            }`}>
                              {item.status || 'unknown'}
                            </span>
                            <span className="text-[10px] text-gray-600">{item.direction === 'outbound' ? '↗' : '↙'}</span>
                          </div>

                          {/* SMS message preview */}
                          {item.message && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.message}</p>
                          )}

                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-gray-600">{formatDate(item.created_at)}</span>
                            {item.duration && isCall && (
                              <span className="text-[10px] text-gray-600">{formatDuration(item.duration)}</span>
                            )}

                            {/* Recording Controls */}
                            {isCall && (
                              <>
                                {recUrl ? (
                                  <div className="flex items-center gap-1">
                                    <audio
                                      ref={el => { if (el) audioRefs.current[item.id] = el }}
                                      src={recUrl}
                                      onEnded={() => setPlayingId(null)}
                                      onPlay={() => setPlayingId(item.id)}
                                      onPause={() => setPlayingId(null)}
                                      preload="metadata"
                                      crossOrigin="anonymous"
                                    />
                                    <button
                                      onClick={() => togglePlayback(item.id)}
                                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${playingId === item.id ? 'text-teal-300 bg-teal-900/30' : 'text-teal-500 hover:text-teal-400 hover:bg-teal-900/20'}`}
                                    >
                                      {playingId === item.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                      {playingId === item.id ? 'Pause' : 'Play'}
                                    </button>
                                    <a href={recUrl} download className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors">
                                      <Download className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : item.twilio_sid ? (
                                  <button
                                    onClick={() => fetchRecording(item)}
                                    className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
                                  >
                                    Fetch Recording
                                  </button>
                                ) : null}
                              </>
                            )}

                            {/* Call patient from history */}
                            {item.to_number && !isCalling && (
                              <button
                                onClick={() => { setPhoneNumber(item.to_number!); setActiveTab('call') }}
                                className="opacity-0 group-hover:opacity-100 text-[10px] text-teal-600 hover:text-teal-400 transition-all"
                              >
                                Call back
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} title={dialog.title} message={dialog.message} type={dialog.type} />
    </div>
  )
}
































