// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone, MessageSquare, Send, PhoneCall,
  Mic, MicOff, PhoneOff, ArrowLeft
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Device, Call } from '@twilio/voice-sdk'
import Dialog from '@/components/Dialog'
import PatientSearchBar, { type PatientSearchResult } from '@/components/PatientSearchBarInline'

// ─── Types ───────────────────────────────────────────────────────────

interface CommunicationDialerProps {
  /** Pre-fill phone number (from patient record) */
  initialPhone?: string
  /** Patient name for display */
  patientName?: string
  /** Patient ID for linking to communication_history */
  patientId?: string
  /** Start on SMS tab instead of Call */
  defaultTab?: 'call' | 'sms'
  /** Called when call status changes — parent can react (e.g. start scribe) */
  onCallStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'ended') => void
  /** Called after SMS sent successfully */
  onSmsSent?: () => void
  /** Callback after any history-changing action (call end, SMS sent) */
  onHistoryUpdate?: () => void
  /** Compact mode — slightly smaller padding for embedded use */
  compact?: boolean
  /** Show patient search bar at top (for standalone use, hidden in video panel) */
  showPatientSearch?: boolean
  /** Back button click handler (for standalone page navigation) */
  onBack?: () => void
}

// ─── Component ───────────────────────────────────────────────────────
export default function CommunicationDialer({
  initialPhone = '',
  patientName,
  patientId,
  defaultTab = 'call',
  onCallStatusChange,
  onSmsSent,
  onHistoryUpdate,
  compact = false,
  showPatientSearch = false,
  onBack,
}: CommunicationDialerProps) {

  // Patient search state (only used when showPatientSearch is true)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'call' | 'sms'>(defaultTab)

  // Call state
  const [phoneNumber, setPhoneNumber] = useState(initialPhone)
  const [isCalling, setIsCalling] = useState(false)
  const [callStatus, setCallStatus] = useState('Initializing...')
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const [isCallLoading, setIsCallLoading] = useState(false)

  // SMS state
  const [smsTo, setSmsTo] = useState(initialPhone)
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSMS, setIsSendingSMS] = useState(false)

  // Audio device state
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
  const [selectedMic, setSelectedMic] = useState('default')
  const [selectedSpeaker, setSelectedSpeaker] = useState('default')

  // Dialog
  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  // Twilio refs
  const deviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Sync initialPhone when it changes ────────────────────────────
  useEffect(() => {
    if (initialPhone) {
      let ph = initialPhone
      const digits = ph.replace(/[\s\-\(\)\+\.]/g, '')
      if (digits.length === 10) ph = `+1${digits}`
      else if (digits.length === 11 && digits.startsWith('1')) ph = `+${digits}`
      else if (!ph.startsWith('+')) ph = `+${digits}`
      setPhoneNumber(ph)
      setSmsTo(ph)
    }
  }, [initialPhone])

  // ─── Sync patient search selection to phone fields ────────────────
  useEffect(() => {
    if (selectedPatient) {
      let ph = selectedPatient.phone || ''
      const digits = ph.replace(/[\s\-\(\)\+\.]/g, '')
      if (digits.length === 10) ph = `+1${digits}`
      else if (digits.length === 11 && digits.startsWith('1')) ph = `+${digits}`
      else if (!ph.startsWith('+')) ph = `+${digits}`
      setPhoneNumber(ph)
      setSmsTo(ph)
    }
  }, [selectedPatient])

  // ─── Effective patient ID (from prop or search) ───────────────────
  const effectivePatientId = selectedPatient?.id || patientId

  // ─── Init ────────────────────────────────────────────────────────
  useEffect(() => {
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
      onCallStatusChange?.('connected')

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
      onCallStatusChange?.('ended')
      onHistoryUpdate?.()
      setTimeout(() => { if (!activeCallRef.current) setCallStatus('Ready') }, 2000)
    })
    call.on('cancel', () => { setCallStatus('Call cancelled'); cleanupCall(); onCallStatusChange?.('ended') })
    call.on('reject', () => { setCallStatus('Call rejected'); cleanupCall(); onCallStatusChange?.('ended') })
    call.on('error', (e: any) => { setCallStatus(`Error: ${e.message}`); cleanupCall(); onCallStatusChange?.('ended') })
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
    onCallStatusChange?.('connecting')

    try {
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
      onCallStatusChange?.('ended')
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
        if (effectivePatientId) record.patient_id = effectivePatientId

        if (existing) {
          await supabase.from('communication_history').update({ status, ...(effectivePatientId ? { patient_id: effectivePatientId } : {}) })
            .eq('twilio_sid', sid).eq('doctor_id', doctor.id)
        } else {
          await supabase.from('communication_history').insert(record)
        }
      }

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
        }
      })
    } catch (err) { console.error('Save history error:', err) }
  }

  const handleEndCall = () => {
    activeCallRef.current?.disconnect()
    cleanupCall()
    setCallStatus('Call ended')
    onCallStatusChange?.('ended')
    onHistoryUpdate?.()
    setTimeout(() => { if (!activeCallRef.current) setCallStatus('Ready') }, 2000)
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
        body: JSON.stringify({ to: formatted, message: smsMessage.trim(), effectivePatientId })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send SMS')

      setDialog({ isOpen: true, title: 'Sent', message: 'SMS sent successfully!', type: 'success' })
      setSmsMessage('')
      onSmsSent?.()
      onHistoryUpdate?.()
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

  const py = compact ? 'py-2.5' : 'py-3.5'
  const px = compact ? 'px-3' : 'px-4'

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Patient Search Bar (shown on standalone page, hidden in video panel) */}
      {showPatientSearch && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a3d3d]/40 flex-shrink-0 bg-[#091818]/30">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#164e4e]/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <PatientSearchBar
            onSelect={(patient) => setSelectedPatient(patient)}
            onClear={() => { setSelectedPatient(null); setPhoneNumber(''); setSmsTo('') }}
            selectedPatient={selectedPatient}
            compact
            showSelected
            className="flex-1"
          />
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-[#1a3d3d]/40 flex-shrink-0">
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
                  className={`bg-[#0d2626] hover:bg-[#164e4e] border border-[#1a3d3d] rounded-lg ${py} text-white font-semibold text-lg transition-all active:scale-95 disabled:opacity-40`}
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
                    onClick={() => { setPhoneNumber('') }}
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
                rows={compact ? 4 : 8}
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

      {/* Dialog */}
      <Dialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} title={dialog.title} message={dialog.message} type={dialog.type} />
    </div>
  )
}

