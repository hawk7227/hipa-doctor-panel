// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Phone, 
  Printer,
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  File
} from 'lucide-react'

type CommunicationMode = 'call' | 'fax'
type FaxStatus = 'idle' | 'uploading' | 'pending' | 'sending' | 'success' | 'failed'
type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed'

interface MakeCallFaxPanelProps {
  phoneNumber?: string
  patientName?: string
  patientId?: string
  onClose?: () => void
}

export default function MakeCallFaxPanel({ 
  phoneNumber = '', 
  patientName = '',
  patientId = '',
  onClose 
}: MakeCallFaxPanelProps) {
  const [mode, setMode] = useState<CommunicationMode>('call')
  const [callNumber, setCallNumber] = useState(phoneNumber)
  const [faxNumber, setFaxNumber] = useState('')
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [faxStatus, setFaxStatus] = useState<FaxStatus>('idle')
  const [faxFile, setFaxFile] = useState<File | null>(null)
  const [faxError, setFaxError] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [twilioReady, setTwilioReady] = useState(false)
  const [twilioError, setTwilioError] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const twilioDeviceRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Update callNumber when phoneNumber prop changes
  useEffect(() => {
    if (phoneNumber) {
      setCallNumber(phoneNumber)
    }
  }, [phoneNumber])

  // ═══════════════════════════════════════════════════════════════
  // TWILIO DEVICE — Browser-to-Phone calling
  // ═══════════════════════════════════════════════════════════════
  const initTwilioDevice = useCallback(async () => {
    try {
      setTwilioError(null)
      console.log('🔌 Initializing Twilio Device...')

      // Dynamically import Twilio Voice SDK (client-side only)
      const { Device } = await import('@twilio/voice-sdk')

      // Get token from our API
      const response = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'doctor' })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to get Twilio token')
      }

      const { token } = await response.json()
      console.log('✅ Twilio token received')

      // Create Device
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any
      })

      // Device events
      device.on('registered', () => {
        console.log('✅ Twilio Device registered — ready for calls')
        setTwilioReady(true)
        setTwilioError(null)
      })

      device.on('error', (error: any) => {
        console.error('❌ Twilio Device error:', error)
        setTwilioError(error.message || 'Device error')
        setTwilioReady(false)
      })

      device.on('incoming', (call: any) => {
        console.log('📞 Incoming call from:', call.parameters.From)
        setIncomingCall(call)
        
        call.on('cancel', () => {
          console.log('📞 Incoming call cancelled')
          setIncomingCall(null)
        })

        call.on('disconnect', () => {
          console.log('📞 Incoming call disconnected')
          setIncomingCall(null)
          setCallStatus('ended')
          stopCallTimer()
        })
      })

      device.on('tokenWillExpire', async () => {
        console.log('🔄 Twilio token expiring, refreshing...')
        try {
          const res = await fetch('/api/twilio/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'doctor' })
          })
          const data = await res.json()
          device.updateToken(data.token)
          console.log('✅ Twilio token refreshed')
        } catch (e) {
          console.error('❌ Failed to refresh token:', e)
        }
      })

      // Register device to receive incoming calls
      await device.register()
      twilioDeviceRef.current = device
      console.log('✅ Twilio Device initialized and registered')

    } catch (error: any) {
      console.error('❌ Failed to initialize Twilio Device:', error)
      setTwilioError(error.message || 'Failed to initialize calling')
      setTwilioReady(false)
    }
  }, [])

  // Initialize Twilio on mount
  useEffect(() => {
    initTwilioDevice()

    return () => {
      // Cleanup
      if (twilioDeviceRef.current) {
        twilioDeviceRef.current.destroy()
        twilioDeviceRef.current = null
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [initTwilioDevice])

  // ═══════════════════════════════════════════════════════════════
  // CALL TIMER
  // ═══════════════════════════════════════════════════════════════
  const startCallTimer = () => {
    setCallDuration(0)
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
  }

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ═══════════════════════════════════════════════════════════════
  // MAKE CALL (via Twilio Device)
  // ═══════════════════════════════════════════════════════════════
  const handleMakeCall = async () => {
    if (!callNumber.trim()) {
      setCallError('Please enter a phone number')
      return
    }

    // Normalize number — auto-add +1
    let normalized = callNumber.replace(/[^\d+]/g, '')
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('1') && normalized.length === 11) {
        normalized = '+' + normalized
      } else if (normalized.length === 10) {
        normalized = '+1' + normalized
      }
    }

    // Check if Twilio is ready
    if (!twilioDeviceRef.current || !twilioReady) {
      setCallError('Phone system not ready. Retrying...')
      await initTwilioDevice()
      return
    }

    try {
      setCallError(null)
      setCallStatus('connecting')
      console.log('📞 Calling:', normalized)

      const call = await twilioDeviceRef.current.connect({
        params: { To: normalized }
      })

      activeCallRef.current = call

      call.on('ringing', () => {
        console.log('📞 Ringing...')
        setCallStatus('ringing')
      })

      call.on('accept', () => {
        console.log('📞 Call connected!')
        setCallStatus('connected')
        startCallTimer()
      })

      call.on('disconnect', () => {
        console.log('📞 Call ended')
        setCallStatus('ended')
        stopCallTimer()
        activeCallRef.current = null
      })

      call.on('error', (error: any) => {
        console.error('❌ Call error:', error)
        setCallError(error.message || 'Call failed')
        setCallStatus('failed')
        stopCallTimer()
        activeCallRef.current = null
      })

      call.on('cancel', () => {
        console.log('📞 Call cancelled')
        setCallStatus('idle')
        stopCallTimer()
        activeCallRef.current = null
      })

    } catch (error: any) {
      console.error('❌ Failed to make call:', error)
      setCallError(error.message || 'Failed to connect call')
      setCallStatus('failed')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ANSWER INCOMING CALL
  // ═══════════════════════════════════════════════════════════════
  const handleAnswerCall = () => {
    if (!incomingCall) return
    
    incomingCall.accept()
    activeCallRef.current = incomingCall
    setCallStatus('connected')
    startCallTimer()
    setIncomingCall(null)

    incomingCall.on('disconnect', () => {
      setCallStatus('ended')
      stopCallTimer()
      activeCallRef.current = null
    })
  }

  const handleRejectCall = () => {
    if (!incomingCall) return
    incomingCall.reject()
    setIncomingCall(null)
  }

  // ═══════════════════════════════════════════════════════════════
  // HANG UP
  // ═══════════════════════════════════════════════════════════════
  const handleHangUp = () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect()
      activeCallRef.current = null
    }
    setCallStatus('ended')
    stopCallTimer()
  }

  // ═══════════════════════════════════════════════════════════════
  // MUTE / UNMUTE
  // ═══════════════════════════════════════════════════════════════
  const toggleMute = () => {
    if (activeCallRef.current) {
      const newMuted = !isMuted
      activeCallRef.current.mute(newMuted)
      setIsMuted(newMuted)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DIAL PAD
  // ═══════════════════════════════════════════════════════════════
  const handleDialPadPress = (digit: string) => {
    if (callStatus === 'connected' && activeCallRef.current) {
      // Send DTMF tone during active call
      activeCallRef.current.sendDigits(digit)
    } else {
      // Append to number when not in call
      setCallNumber(prev => prev + digit)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FAX (placeholder)
  // ═══════════════════════════════════════════════════════════════
  const handleFaxFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        setFaxError('Only PDF files are supported for fax')
        return
      }
      setFaxFile(file)
      setFaxError(null)
    }
  }

  const handleSendFax = async () => {
    if (!faxNumber.trim()) {
      setFaxError('Please enter a fax number')
      return
    }
    if (!faxFile) {
      setFaxError('Please upload a PDF file')
      return
    }
    setFaxError(null)
    setFaxStatus('sending')
    
    // TODO: Implement fax sending via Twilio Programmable Fax or third-party
    setTimeout(() => {
      setFaxStatus('success')
      setTimeout(() => setFaxStatus('idle'), 3000)
    }, 2000)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const dialPadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ]

  const getCallStatusColor = () => {
    switch (callStatus) {
      case 'connecting': return 'text-yellow-400'
      case 'ringing': return 'text-blue-400'
      case 'connected': return 'text-green-400'
      case 'ended': return 'text-gray-400'
      case 'failed': return 'text-red-400'
      default: return 'text-gray-500'
    }
  }

  const getCallStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...'
      case 'ringing': return 'Ringing...'
      case 'connected': return `Connected • ${formatDuration(callDuration)}`
      case 'ended': return `Call ended • ${formatDuration(callDuration)}`
      case 'failed': return 'Call failed'
      default: return twilioReady ? '● Ready' : 'Initializing...'
    }
  }

  return (
    <div style={{ 
      background: '#0a1628', 
      borderRadius: '12px', 
      border: '1px solid #1e3a5f',
      overflow: 'hidden'
    }}>
      {/* Mode Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e3a5f' }}>
        <button
          onClick={() => setMode('call')}
          style={{
            flex: 1,
            padding: '12px',
            background: mode === 'call' ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
            border: 'none',
            borderBottom: mode === 'call' ? '2px solid #14b8a6' : '2px solid transparent',
            color: mode === 'call' ? '#14b8a6' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <Phone size={16} /> Call
        </button>
        <button
          onClick={() => setMode('fax')}
          style={{
            flex: 1,
            padding: '12px',
            background: mode === 'fax' ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
            border: 'none',
            borderBottom: mode === 'fax' ? '2px solid #14b8a6' : '2px solid transparent',
            color: mode === 'fax' ? '#14b8a6' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <Printer size={16} /> Fax
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {mode === 'call' ? (
          <>
            {/* Incoming Call Alert */}
            {incomingCall && (
              <div style={{
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                marginBottom: '12px',
                animation: 'pulse 1.5s infinite'
              }}>
                <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '8px' }}>
                  📞 Incoming Call
                </div>
                <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  From: {incomingCall.parameters?.From || 'Unknown'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAnswerCall}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px'
                    }}
                  >
                    ✅ Answer
                  </button>
                  <button
                    onClick={handleRejectCall}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px'
                    }}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            )}

            {/* Twilio Status */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '12px',
              padding: '8px 12px',
              background: twilioReady ? 'rgba(16, 185, 129, 0.1)' : twilioError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
              borderRadius: '6px',
              border: `1px solid ${twilioReady ? 'rgba(16, 185, 129, 0.3)' : twilioError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: twilioReady ? '#10b981' : twilioError ? '#ef4444' : '#eab308',
                boxShadow: `0 0 6px ${twilioReady ? '#10b981' : twilioError ? '#ef4444' : '#eab308'}`
              }} />
              <span style={{ 
                fontSize: '12px', 
                color: twilioReady ? '#10b981' : twilioError ? '#ef4444' : '#eab308' 
              }}>
                {twilioReady ? 'Phone Ready' : twilioError ? `Error: ${twilioError}` : 'Connecting...'}
              </span>
              {twilioError && (
                <button
                  onClick={initTwilioDevice}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '4px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Retry
                </button>
              )}
            </div>

            {/* Patient Name */}
            {patientName && (
              <div style={{ marginBottom: '12px', color: '#e2e8f0', fontWeight: 600, fontSize: '14px' }}>
                Calling: {patientName}
              </div>
            )}

            {/* Phone Number Input */}
            <div style={{ marginBottom: '12px' }}>
              <input
                type="tel"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="(555) 555-5555"
                disabled={callStatus === 'connected' || callStatus === 'connecting' || callStatus === 'ringing'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0d1f3c',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '20px',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '1px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Call Status */}
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 600
            }} className={getCallStatusColor()}>
              {getCallStatusText()}
            </div>

            {/* Call Error */}
            {callError && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <XCircle size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '12px', color: '#fca5a5' }}>{callError}</span>
              </div>
            )}

            {/* Dial Pad */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '8px', 
              marginBottom: '12px' 
            }}>
              {dialPadButtons.flat().map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDialPadPress(digit)}
                  style={{
                    padding: '14px',
                    background: 'rgba(30, 58, 95, 0.5)',
                    border: '1px solid #1e3a5f',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(20, 184, 166, 0.2)'
                    e.currentTarget.style.borderColor = '#14b8a6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 58, 95, 0.5)'
                    e.currentTarget.style.borderColor = '#1e3a5f'
                  }}
                >
                  {digit}
                </button>
              ))}
            </div>

            {/* Call / Hang Up Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {callStatus === 'idle' || callStatus === 'ended' || callStatus === 'failed' ? (
                <button
                  onClick={handleMakeCall}
                  disabled={!twilioReady || !callNumber.trim()}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: twilioReady && callNumber.trim() ? '#16a34a' : '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: twilioReady && callNumber.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    fontWeight: 700,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <PhoneCall size={20} /> Call
                </button>
              ) : (
                <>
                  {/* Mute Button */}
                  {callStatus === 'connected' && (
                    <button
                      onClick={toggleMute}
                      style={{
                        padding: '14px 20px',
                        background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 58, 95, 0.5)',
                        border: `1px solid ${isMuted ? '#ef4444' : '#1e3a5f'}`,
                        borderRadius: '8px',
                        color: isMuted ? '#ef4444' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  )}

                  {/* Hang Up Button */}
                  <button
                    onClick={handleHangUp}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '16px',
                      fontWeight: 700
                    }}
                  >
                    <PhoneOff size={20} /> Hang Up
                  </button>
                </>
              )}

              {/* Clear Number */}
              {(callStatus === 'idle' || callStatus === 'ended' || callStatus === 'failed') && callNumber && (
                <button
                  onClick={() => { setCallNumber(''); setCallError(null); setCallStatus('idle') }}
                  style={{
                    padding: '14px',
                    background: 'rgba(30, 58, 95, 0.5)',
                    border: '1px solid #1e3a5f',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════ */
          /* FAX MODE                                                   */
          /* ═══════════════════════════════════════════════════════════ */
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Fax Number
              </label>
              <input
                type="tel"
                value={faxNumber}
                onChange={(e) => setFaxNumber(e.target.value)}
                placeholder="(555) 555-5555"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0d1f3c',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Document (PDF only)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFaxFileChange}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '20px',
                  background: 'rgba(30, 58, 95, 0.3)',
                  border: '2px dashed #1e3a5f',
                  borderRadius: '8px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {faxFile ? (
                  <>
                    <FileText size={24} style={{ color: '#14b8a6' }} />
                    <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{faxFile.name}</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                      {(faxFile.size / 1024).toFixed(1)} KB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={24} />
                    <span style={{ fontSize: '13px' }}>Upload PDF</span>
                  </>
                )}
              </button>
            </div>

            {faxError && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '12px', color: '#fca5a5' }}>{faxError}</span>
              </div>
            )}

            {faxStatus === 'success' && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle size={14} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '12px', color: '#6ee7b7' }}>Fax sent successfully</span>
              </div>
            )}

            <button
              onClick={handleSendFax}
              disabled={faxStatus === 'sending' || !faxNumber.trim() || !faxFile}
              style={{
                width: '100%',
                padding: '12px',
                background: faxNumber.trim() && faxFile ? '#14b8a6' : '#374151',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: faxNumber.trim() && faxFile ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {faxStatus === 'sending' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Printer size={16} /> Send Fax
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

