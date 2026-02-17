// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { startTransition } from 'react'
import type { Device, Call } from '@twilio/voice-sdk'

export function useCommunication(appointmentId: string | null, appointment: any) {
  // Messages state
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesSubscriptionRef = useRef<any>(null)

  // SMS state
  const [smsTo, setSmsTo] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSMS, setIsSendingSMS] = useState(false)

  // Call state
  const [callPhoneNumber, setCallPhoneNumber] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [isCallLoading, setIsCallLoading] = useState(false)
  const [callStatus, setCallStatus] = useState('Ready')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeviceReady, setIsDeviceReady] = useState(false)

  // Twilio refs
  const twilioDeviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const callDurationRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // Communication History state
  const [communicationHistory, setCommunicationHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})

  // Optimized message input handler
  const handleMessageChange = useCallback((value: string) => {
    startTransition(() => {
      setNewMessage(value)
    })
  }, [])

  // Optimized SMS input handlers
  const handleSmsToChange = useCallback((value: string) => {
    // Direct state update for better typing performance
    setSmsTo(value)
  }, [])

  const handleSmsMessageChange = useCallback((value: string) => {
    // Direct state update for better typing performance
    setSmsMessage(value)
  }, [])

  // Optimized call input handler
  const handleCallPhoneNumberChange = useCallback((value: string) => {
    // Direct state update for better typing performance
    setCallPhoneNumber(value)
  }, [])

  const fetchAppointmentMessages = useCallback(async () => {
    if (!appointmentId) return
    
    setIsLoadingMessages(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      try {
        const response = await fetch(`/api/appointments/messages?appointmentId=${appointmentId}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include'
        })
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          if (data.messages) {
            const transformedMessages = data.messages.map((msg: any) => ({
              id: msg.id,
              text: msg.message_text,
              sender: msg.sender_type === 'doctor' ? 'doctor' : 'patient',
              timestamp: new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type: msg.message_type === 'system' ? 'System' : 'SMS',
              raw: msg
            }))
            setMessages(transformedMessages)
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name !== 'AbortError') {
          throw fetchError
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching messages:', error)
      }
    } finally {
      setIsLoadingMessages(false)
    }
  }, [appointmentId])

  const setupMessagesSubscription = useCallback(() => {
    if (!appointmentId) return
    
    if (messagesSubscriptionRef.current) {
      messagesSubscriptionRef.current.unsubscribe()
    }

    const subscription = supabase
      .channel(`appointment-messages-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointment_messages',
          filter: `appointment_id=eq.${appointmentId}`
        },
        (payload) => {
          const newMsg = payload.new as any
          const transformedMessage = {
            id: newMsg.id,
            text: newMsg.message_text,
            sender: newMsg.sender_type === 'doctor' ? 'doctor' : 'patient',
            timestamp: new Date(newMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: newMsg.message_type === 'system' ? 'System' : 'SMS',
            raw: newMsg
          }
          setMessages(prev => [...prev, transformedMessage])
        }
      )
      .subscribe()

    messagesSubscriptionRef.current = subscription
  }, [appointmentId])

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !appointmentId || !appointment) return
    
    setIsSendingMessage(true)
    const messageText = newMessage.trim()
    setNewMessage('') // Clear immediately for better UX
    
    try {
      const user = await getCurrentUser()
      if (!user || !user.doctor) {
        setIsSendingMessage(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Send SMS if patient has phone number
      if (appointment.patients?.phone) {
        try {
          await fetch('/api/communication/sms', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            },
            credentials: 'include',
            body: JSON.stringify({
              to: appointment.patients.phone,
              message: messageText,
              patientId: appointment.patients.id
            })
          })
        } catch (smsError) {
          console.error('Error sending SMS:', smsError)
        }
      }

      // Save to appointment_messages table
      try {
        await fetch('/api/appointments/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          body: JSON.stringify({
            appointmentId: appointmentId,
            messageText: messageText,
            senderType: 'doctor'
          })
        })
      } catch (msgError) {
        console.error('Error saving message:', msgError)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSendingMessage(false)
    }
  }, [newMessage, appointmentId, appointment])

  const handleSendSMS = useCallback(async () => {
    if (!smsTo || !smsMessage.trim()) return

    setIsSendingSMS(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/communication/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: smsTo,
          message: smsMessage.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send SMS')
      }

      setSmsMessage('')
    } catch (error: any) {
      console.error('Error sending SMS:', error)
    } finally {
      setIsSendingSMS(false)
    }
  }, [smsTo, smsMessage])

  const handleMakeCall = useCallback(async () => {
    if (!callPhoneNumber || !isDeviceReady || !twilioDeviceRef.current) return
    
    setIsCallLoading(true)
    setCallStatus('Connecting...')
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      stream.getTracks().forEach(track => track.stop())

      // Format phone number
      const formattedNumber = callPhoneNumber.startsWith('+') 
        ? callPhoneNumber 
        : `+${callPhoneNumber}`

      console.log(`📞 Making call to: ${formattedNumber}`)

      const call = await twilioDeviceRef.current.connect({
        params: { To: formattedNumber },
        rtcConstraints: { audio: true }
      } as any)

      activeCallRef.current = call

      call.on('accept', () => {
        console.log('✅ Call accepted')
        setCallStatus('Connected')
        setIsCalling(true)
        setCallDuration(0)
        setIsCallLoading(false)

        // Attach remote audio
        try {
          const remoteStream = (call as any).remoteStream
          if (remoteStream) {
            if (!remoteAudioRef.current) {
              remoteAudioRef.current = new Audio()
              remoteAudioRef.current.autoplay = true
            }
            remoteAudioRef.current.srcObject = remoteStream
            remoteAudioRef.current.play().catch(console.error)
          }
        } catch (err) {
          console.error('Error setting up remote audio:', err)
        }

        // Start duration timer
        callDurationRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      })

      call.on('disconnect', () => {
        console.log('📞 Call disconnected')
        setCallStatus('Call ended')
        setIsCalling(false)
        setIsCallLoading(false)
        activeCallRef.current = null
        if (callDurationRef.current) {
          clearInterval(callDurationRef.current)
          callDurationRef.current = null
        }
        setCallDuration(0)
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause()
          remoteAudioRef.current.srcObject = null
          remoteAudioRef.current = null
        }
      })

      call.on('cancel', () => {
        setCallStatus('Call cancelled')
        setIsCalling(false)
        setIsCallLoading(false)
        activeCallRef.current = null
        if (callDurationRef.current) {
          clearInterval(callDurationRef.current)
          callDurationRef.current = null
        }
        setCallDuration(0)
      })

      call.on('error', (error: any) => {
        console.error('❌ Call error:', error)
        setCallStatus(`Error: ${error.message || 'Call failed'}`)
        setIsCalling(false)
        setIsCallLoading(false)
        activeCallRef.current = null
        if (callDurationRef.current) {
          clearInterval(callDurationRef.current)
          callDurationRef.current = null
        }
        setCallDuration(0)
      })

    } catch (error: any) {
      console.error('Error making call:', error)
      setCallStatus(`Failed: ${error.message || 'Unknown error'}`)
      setIsCallLoading(false)
      setIsCalling(false)
    }
  }, [callPhoneNumber, isDeviceReady])

  const handlePlayRecording = useCallback((id: string) => {
    const audio = audioRefs.current[id]
    if (!audio) return

    if (playingRecordingId === id) {
      // Pause if already playing
      audio.pause()
      setPlayingRecordingId(null)
    } else {
      // Stop any currently playing recording
      if (playingRecordingId) {
        const currentAudio = audioRefs.current[playingRecordingId]
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }
      }
      // Play the new recording
      audio.play()
      setPlayingRecordingId(id)
      
      // Reset when finished
      audio.onended = () => {
        setPlayingRecordingId(null)
      }
    }
  }, [playingRecordingId])

  const handleEndCall = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect()
      activeCallRef.current = null
    }
    if (callDurationRef.current) {
      clearInterval(callDurationRef.current)
      callDurationRef.current = null
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause()
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current = null
    }
    setIsCalling(false)
    setCallDuration(0)
    setCallStatus('Call ended')
    setIsMuted(false)
    
    // Reset status after a moment
    setTimeout(() => setCallStatus('Ready'), 2000)
  }, [])

  const handleToggleMute = useCallback(() => {
    if (activeCallRef.current) {
      const newMuted = !isMuted
      activeCallRef.current.mute(newMuted)
      setIsMuted(newMuted)
    }
  }, [isMuted])

  const fetchCommunicationHistory = useCallback(async (patientPhone: string) => {
    if (!patientPhone) return
    
    setLoadingHistory(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/communication/history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.history) {
          const normalizePhone = (phone: string) => phone?.replace(/[\s\-\(\)]/g, '').toLowerCase() || ''
          const normalizedPatientPhone = normalizePhone(patientPhone)
          
          const filteredHistory = data.history.filter((item: any) => {
            const toNumber = normalizePhone(item.to_number || '')
            const fromNumber = normalizePhone(item.from_number || '')
            const patientPhoneFromUser = normalizePhone(item.users?.mobile_phone || '')
            
            return toNumber === normalizedPatientPhone || 
                   fromNumber === normalizedPatientPhone || 
                   patientPhoneFromUser === normalizedPatientPhone
          })
          
          setCommunicationHistory(filteredHistory)
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching communication history:', error)
      }
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  // Initialize phone numbers from appointment
  useEffect(() => {
    if (appointment?.patients?.phone) {
      setSmsTo(appointment.patients.phone)
      setCallPhoneNumber(appointment.patients.phone)
    }
  }, [appointment?.patients?.phone])

  // Setup messages subscription
  useEffect(() => {
    if (appointmentId) {
      setupMessagesSubscription()
      fetchAppointmentMessages().catch(() => {})
    }

    return () => {
      if (messagesSubscriptionRef.current) {
        messagesSubscriptionRef.current.unsubscribe()
        messagesSubscriptionRef.current = null
      }
    }
  }, [appointmentId, setupMessagesSubscription, fetchAppointmentMessages])

  // Initialize Twilio Device for calling
  useEffect(() => {
    let cancelled = false

    const initTwilioDevice = async () => {
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !supabaseUser || cancelled) return

        const user = await getCurrentUser()
        if (!user || cancelled) return

        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        if (!accessToken || cancelled) return

        // Get Twilio token
        const response = await fetch('/api/communication/twilio-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body: JSON.stringify({ identity: user.email })
        })

        if (!response.ok || cancelled) {
          console.error('Failed to get Twilio token:', response.status)
          setCallStatus('Twilio not available')
          return
        }

        const data = await response.json()
        if (!data.token || cancelled) return

        // Dynamically import Twilio Device
        const TwilioSDK = await import('@twilio/voice-sdk')
        const Device = TwilioSDK.Device || (TwilioSDK as any).default || TwilioSDK

        if (typeof Device !== 'function' || cancelled) return

        const device = new Device(data.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'] as any,
          enableRingtones: true,
          allowIncomingWhileBusy: false
        } as any)

        device.on('registered', () => {
          if (!cancelled) {
            console.log('✅ Twilio device registered (appointment modal)')
            setCallStatus('Ready')
            setIsDeviceReady(true)
          }
        })

        device.on('error', (error: any) => {
          if (!cancelled) {
            console.error('❌ Twilio device error:', error)
            setCallStatus(`Error: ${error.message || error}`)
            setIsDeviceReady(false)
          }
        })

        device.on('tokenWillExpire', async () => {
          try {
            const refreshResponse = await fetch('/api/communication/twilio-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              credentials: 'include',
              body: JSON.stringify({ identity: user.email })
            })
            const { token: newToken } = await refreshResponse.json()
            if (newToken) device.updateToken(newToken)
          } catch (err) {
            console.error('Token refresh failed:', err)
          }
        })

        if (!cancelled) {
          twilioDeviceRef.current = device
          device.register()
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error initializing Twilio device:', error)
          setCallStatus('Failed to initialize')
        }
      }
    }

    initTwilioDevice()

    return () => {
      cancelled = true
    }
  }, [])

  // Cleanup Twilio on unmount
  useEffect(() => {
    return () => {
      if (activeCallRef.current) {
        activeCallRef.current.disconnect()
        activeCallRef.current = null
      }
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current)
        callDurationRef.current = null
      }
      if (twilioDeviceRef.current) {
        twilioDeviceRef.current.destroy()
        twilioDeviceRef.current = null
      }
    }
  }, [])

  return {
    messages,
    newMessage,
    isLoadingMessages,
    isSendingMessage,
    smsTo,
    smsMessage,
    isSendingSMS,
    callPhoneNumber,
    isCalling,
    isCallLoading,
    callStatus,
    callDuration,
    isMuted,
    isDeviceReady,
    communicationHistory,
    loadingHistory,
    playingRecordingId,
    audioRefs,
    twilioDeviceRef,
    activeCallRef,
    callDurationRef,
    remoteAudioRef,
    setNewMessage,
    setSmsTo,
    setSmsMessage,
    setCallPhoneNumber,
    setIsCalling,
    setIsCallLoading,
    setCallStatus,
    setCallDuration,
    setIsMuted,
    setIsDeviceReady,
    setPlayingRecordingId,
    handleMessageChange,
    handleSmsToChange,
    handleSmsMessageChange,
    handleCallPhoneNumberChange,
    handleSendMessage,
    handleSendSMS,
    handleMakeCall,
    handleEndCall,
    handleToggleMute,
    fetchCommunicationHistory,
    formatDuration,
    formatHistoryDate,
    setupMessagesSubscription,
    handlePlayRecording
  }
}



