'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Phone, MessageSquare, Video, Send, Clock, PhoneCall, Play, Pause, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import type { Device, Call } from '@twilio/voice-sdk'
import Dialog from '@/components/Dialog'

interface Patient {
  id: string
  first_name: string
  last_name: string
  mobile_phone: string
  email: string
}

interface CommunicationHistory {
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
  updated_at?: string
  users?: {
    id: string
    first_name: string
    last_name: string
    mobile_phone: string
    email?: string
  }
}

export default function CommunicationPanel() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [history, setHistory] = useState<CommunicationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showPatientList, setShowPatientList] = useState(false)

  // SMS State
  const [smsTo, setSmsTo] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [isSendingSMS, setIsSendingSMS] = useState(false)

  // Call State
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [callStatus, setCallStatus] = useState('Initializing...')
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDeviceReady, setIsDeviceReady] = useState(false)
  const [isCallLoading, setIsCallLoading] = useState(false)

  // Video State
  const [videoMeeting, setVideoMeeting] = useState<any>(null)

  // Dial Pad State
  const [dialPadNumber, setDialPadNumber] = useState('')

  // Audio Device State
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([])
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('default')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('default')
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean>(false)
  const [micPermissionStatus, setMicPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('prompt')

  // Audio Player State
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})
  const recordingUrlCache = useRef<{ [key: string]: string }>({}) // Key: twilio_sid or meeting_id
  const fetchingRecordings = useRef<Set<string>>(new Set()) // Key: twilio_sid or meeting_id

  // Dialog State
  const [dialog, setDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  // Twilio Device
  const deviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<any>(null)
  const callDurationRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null) // CRITICAL: For playing remote audio

  // Phone number validation function
  const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
    if (!phone || !phone.trim()) {
      return { valid: false, error: 'Phone number is required' }
    }

    // Remove spaces, dashes, and parentheses for validation
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '')
    
    // Check if it starts with + (required for international format)
    if (!cleaned.startsWith('+')) {
      // If no +, add it but warn user
      if (!/^\d+$/.test(cleaned)) {
        return {
          valid: false,
          error: 'Phone number must include country code. Format: +1234567890'
        }
      }
    }

    // After adding +, validate the format
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    
    // Phone number should be 10-16 digits after +
    const digitsAfterPlus = formatted.substring(1)
    
    if (!/^\d+$/.test(digitsAfterPlus)) {
      return {
        valid: false,
        error: 'Phone number can only contain numbers and +. Remove spaces, dashes, or letters.'
      }
    }

    if (digitsAfterPlus.length < 10) {
      return {
        valid: false,
        error: 'Phone number is too short. Minimum 10 digits required (including country code).'
      }
    }

    if (digitsAfterPlus.length > 15) {
      return {
        valid: false,
        error: 'Phone number is too long. Maximum 15 digits allowed (including country code).'
      }
    }

    // Common invalid patterns
    if (digitsAfterPlus.match(/^0+$/)) {
      return {
        valid: false,
        error: 'Invalid phone number. Number cannot be all zeros.'
      }
    }

    // Check for obviously invalid numbers (too many repeated digits)
    if (/(\d)\1{8,}/.test(digitsAfterPlus)) {
      return {
        valid: false,
        error: 'Phone number appears invalid. Too many repeated digits.'
      }
    }

    return { valid: true }
  }

  useEffect(() => {
    fetchPatients()
    fetchHistory()
    initializeTwilioDevice()
    // Try to load devices with permission request
    loadAudioDevices(true)
    
    // Listen for device changes (e.g., user plugs in new device)
    const handleDeviceChange = () => {
      loadAudioDevices(false) // Don't re-request permission on device change
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  useEffect(() => {
    if (selectedPatient) {
      const patientPhone = selectedPatient.mobile_phone || ''
      setSmsTo(patientPhone)
      setPhoneNumber(patientPhone)
      
      // Validate patient's phone number and show warning if invalid
      if (patientPhone) {
        const phoneValidation = validatePhoneNumber(patientPhone)
        if (!phoneValidation.valid) {
          setDialog({
            isOpen: true,
            title: 'Invalid Patient Phone Number',
            message: `The selected patient has an invalid phone number format: ${phoneValidation.error}. Please update the patient's phone number or enter a different number.`,
            type: 'warning'
          })
        }
      }
    }
  }, [selectedPatient])

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          email
        `)
        .not('phone', 'is', null)

      if (error) throw error

      const patientsList: Patient[] = (data || []).map((item: any) => ({
        id: item.id,
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        mobile_phone: item.phone || '',
        email: item.email || ''
      }))

      setPatients(patientsList)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      // Get access token for authentication
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch history:', response.status, errorData)
        setDialog({
          isOpen: true,
          title: 'Error',
          message: errorData.error || `Failed to fetch history (${response.status})`,
          type: 'error'
        })
        return
      }

      const data = await response.json()
      
      if (data.success && data.history) {
        console.log(`✅ Loaded ${data.history.length} history records`)
        setHistory(data.history)
        
        // Cache recording URLs to avoid re-fetching
        data.history.forEach((item: CommunicationHistory) => {
          if (item.recording_url) {
            // Cache by twilio_sid for calls or meeting_id for video calls
            const cacheKey = item.twilio_sid || item.meeting_id
            if (cacheKey) {
              recordingUrlCache.current[cacheKey] = item.recording_url
            }
          }
        })
      } else {
        console.warn('No history data received:', data)
        setHistory([])
      }
    } catch (error) {
      console.error('❌ Error fetching history:', error)
      setHistory([])
    }
  }

  const initializeTwilioDevice = async () => {
    try {
      // First, verify the user is authenticated with Supabase client
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !supabaseUser) {
        console.error('Not authenticated:', authError)
        setCallStatus('Please login to make calls')
        return
      }

      // Get user data
      const user = await getCurrentUser()
      if (!user) {
        console.error('User not found or not a doctor')
        setCallStatus('Doctor account not found. Please login as a doctor.')
        return
      }

      console.log('User authenticated, fetching Twilio token...', { email: user.email })

      // Get the access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        console.error('No access token found in session')
        setCallStatus('Session expired. Please refresh and login again.')
        return
      }

      // Get Twilio token - send access token as Authorization header
      const response = await fetch('/api/communication/twilio-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({ identity: user.email })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to get Twilio token:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        
        if (response.status === 401) {
          setCallStatus('Authentication failed. Please refresh the page and login again.')
        } else {
          setCallStatus(`Error: ${errorData.error || errorData.details || 'Failed to get Twilio token'}`)
        }
        return
      }

      const data = await response.json()
      const { token } = data
      
      if (!token) {
        console.error('Failed to get Twilio token: No token in response', data)
        setCallStatus('Failed to get Twilio token: Invalid response')
        return
      }

      console.log('Twilio token received, initializing device...')

      // Dynamically import Twilio Device
      // Twilio Voice SDK v2.x exports Device as a named export
      const TwilioSDK = await import('@twilio/voice-sdk')
      // Device can be exported as default, named export, or in Device property
      const Device = TwilioSDK.Device || (TwilioSDK as any).default || TwilioSDK
      
      // Verify Device is a constructor
      if (typeof Device !== 'function') {
        console.error('Device is not a constructor:', typeof Device, Device)
        throw new Error('Failed to import Twilio Device class')
      }

      // Initialize Twilio Device with WebSocket support
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any,
        enableRingtones: true,
        allowIncomingWhileBusy: false
      } as any)

      // Track device state changes
      device.on('registered', () => {
        console.log('✅ Twilio device registered and ready')
        setCallStatus('Ready to make calls')
        setIsDeviceReady(true)
      })

      device.on('registering', () => {
        console.log('🔄 Twilio device registering...')
        setCallStatus('Registering device...')
        setIsDeviceReady(false)
      })

      device.on('tokenWillExpire', async () => {
        console.log('🔄 Token expiring, refreshing...')
        setCallStatus('Refreshing token...')
        // Refresh token
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
        if (newToken) {
          device.updateToken(newToken)
          setCallStatus('Ready to make calls')
        }
      })

      device.on('error', (error: any) => {
        console.error('❌ Twilio device error:', error)
        setCallStatus(`Error: ${error.message || error}`)
        setIsCalling(false)
        setIsDeviceReady(false)
      })

      device.on('unregistered', () => {
        console.log('⚠️ Twilio device unregistered')
        setCallStatus('Device disconnected. Reconnecting...')
        setIsDeviceReady(false)
      })

      device.on('incoming', (call: Call) => {
        console.log('📞 Incoming call:', call)
        activeCallRef.current = call
        setIsCalling(true)
        setCallStatus('Incoming call...')
        
        // Setup incoming call event handlers
        setupCallHandlers(call)
      })

      deviceRef.current = device
      
      // Register the device immediately
      device.register()
      
      // Apply audio devices when device is ready
      device.on('registered', () => {
        applyAudioDevices()
      })
      
      // Set initial status
      console.log('Device state:', device.state)
      if (device.state === 'registered') {
        setCallStatus('Ready to make calls')
        setIsDeviceReady(true)
        applyAudioDevices()
      } else {
        setCallStatus('Registering device...')
      }
    } catch (error) {
      console.error('Error initializing Twilio device:', error)
      setCallStatus('Failed to initialize device')
    }
  }

  const setupCallHandlers = (call: Call) => {
    console.log('📞 Setting up call handlers for call:', {
      direction: (call as any).direction,
      status: (call as any).status,
      parameters: (call as any).parameters
    })

    call.on('accept', () => {
      console.log('✅ Call accepted - connection established')
      console.log('Call details:', {
        sid: (call as any).parameters?.CallSid || (call as any).sid,
        to: (call as any).parameters?.To,
        from: (call as any).parameters?.From
      })
      setCallStatus('Call connected')
      setIsCalling(true)
      setCallDuration(0)
      
      // Apply selected audio devices when call is accepted
      applyAudioDevices(call)
      
      // Verify audio tracks are active
      const localAudioTracks = (call as any).localStream?.getAudioTracks() || []
      const remoteAudioTracks = (call as any).remoteStream?.getAudioTracks() || []
      
      console.log('📊 Audio tracks:', {
        local: localAudioTracks.length,
        remote: remoteAudioTracks.length,
        localEnabled: localAudioTracks.filter((t: MediaStreamTrack) => t.enabled).length,
        remoteEnabled: remoteAudioTracks.filter((t: MediaStreamTrack) => t.enabled).length
      })
      
      // CRITICAL: Check if local audio tracks exist
      if (localAudioTracks.length === 0) {
        console.error('❌ NO LOCAL AUDIO TRACKS! Microphone not working!')
        console.error('This means the recipient CANNOT hear you!')
        console.error('Check: 1) Microphone permission 2) Selected microphone device 3) rtcConstraints')
      }

      // Detailed audio diagnostics
      localAudioTracks.forEach((track: MediaStreamTrack, idx: number) => {
        const settings = track.getSettings ? track.getSettings() : {}
        console.log(`🎤 Local audio track ${idx}:`, {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          deviceId: settings.deviceId,
          groupId: settings.groupId,
          settings: track.getSettings ? track.getSettings() : 'N/A'
        })
        
        // CRITICAL WARNING if track is disabled or muted
        if (!track.enabled) {
          console.error(`❌ Local audio track ${idx} is DISABLED! Recipient cannot hear you!`)
        }
        if (track.muted) {
          console.warn(`⚠️ Local audio track ${idx} is MUTED!`)
        }
        if (track.readyState !== 'live') {
          console.error(`❌ Local audio track ${idx} is not LIVE! Current state: ${track.readyState}`)
        }
      })
      
      remoteAudioTracks.forEach((track: MediaStreamTrack, idx: number) => {
        console.log(`🔊 Remote audio track ${idx}:`, {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        })
      })
      
      // CRITICAL: Ensure remote audio is unmuted and enabled
      // Sometimes Twilio starts with muted remote audio
      if ((call as any).isMuted && (call as any).isMuted()) {
        console.log('⚠️ Call is muted, attempting to unmute...')
        try {
          ;(call as any).mute(false)
        } catch (err) {
          console.error('Failed to unmute call:', err)
        }
      }
      
      // Ensure all audio tracks are enabled
      remoteAudioTracks.forEach((track: MediaStreamTrack) => {
        if (!track.enabled) {
          console.log('⚠️ Enabling disabled remote audio track:', track.id)
          track.enabled = true
        }
      })
      
      localAudioTracks.forEach((track: MediaStreamTrack) => {
        if (!track.enabled) {
          console.log('⚠️ Enabling disabled local audio track:', track.id)
          track.enabled = true
        }
      })
      
      // ✨ CRITICAL FIX: Manually attach and play remote audio stream
      // Twilio Voice SDK doesn't automatically play remote audio to speakers
      // We must create an HTMLAudioElement and attach the remote stream
      try {
        const remoteStream = (call as any).remoteStream
        if (remoteStream) {
          console.log('🔊 Creating audio element for remote stream')
          
          // Create or reuse audio element
          if (!remoteAudioRef.current) {
            remoteAudioRef.current = new Audio()
            remoteAudioRef.current.autoplay = true
            console.log('✅ Created new audio element')
          }
          
          // Attach remote stream to audio element
          remoteAudioRef.current.srcObject = remoteStream
          
          // Set output device if selected
          if (selectedSpeakerId && selectedSpeakerId !== 'default') {
            if (typeof remoteAudioRef.current.setSinkId === 'function') {
              remoteAudioRef.current.setSinkId(selectedSpeakerId)
                .then(() => console.log('✅ Remote audio output device set:', selectedSpeakerId))
                .catch((err: any) => console.warn('⚠️ Failed to set output device:', err))
            }
          }
          
          // Ensure audio plays
          remoteAudioRef.current.play()
            .then(() => console.log('✅ Remote audio playing'))
            .catch((err: any) => {
              console.error('❌ Failed to play remote audio:', err)
              // Try again after a short delay
              setTimeout(() => {
                remoteAudioRef.current?.play()
                  .then(() => console.log('✅ Remote audio playing (retry)'))
                  .catch((e: any) => console.error('❌ Failed to play remote audio (retry):', e))
              }, 500)
            })
          
          console.log('🔊 Remote audio element configured:', {
            hasStream: !!remoteAudioRef.current.srcObject,
            paused: remoteAudioRef.current.paused,
            muted: remoteAudioRef.current.muted,
            volume: remoteAudioRef.current.volume
          })
        } else {
          console.warn('⚠️ No remote stream available yet')
        }
      } catch (error) {
        console.error('❌ Error setting up remote audio:', error)
      }
      
      // Start call duration timer
      callDurationRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    })

    // Listen for when remote stream becomes available
    // Sometimes the remote stream arrives after the accept event
    call.on('sample', () => {
      // This event fires when audio samples are received
      // Use it as a signal that remote audio is flowing
      const remoteStream = (call as any).remoteStream
      if (remoteStream && remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
        console.log('🔊 Remote stream now available, attaching to audio element')
        remoteAudioRef.current.srcObject = remoteStream
        remoteAudioRef.current.play().catch((err: any) => 
          console.warn('⚠️ Failed to play remote audio on sample event:', err)
        )
      }
    })

    // Monitor media connection status
    call.on('mute', (isMuted: boolean) => {
      console.log('🎤 Call muted:', isMuted)
      setCallStatus(isMuted ? 'Call connected (muted)' : 'Call connected')
    })


    call.on('disconnect', () => {
      console.log('📞 Call disconnected')
      const disconnectReason = (call as any).disconnectReason || 'Unknown'
      const disconnectCause = (call as any).disconnectCause || 'Unknown'
      console.log('Disconnect details:', {
        reason: disconnectReason,
        cause: disconnectCause,
        status: (call as any).status
      })
      setCallStatus(`Call ended (${disconnectReason})`)
      setIsCalling(false)
      activeCallRef.current = null
      
      // Clear call duration timer
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current)
        callDurationRef.current = null
      }
      setCallDuration(0)
      
      // Cleanup remote audio element
      if (remoteAudioRef.current) {
        console.log('🧹 Cleaning up remote audio element')
        remoteAudioRef.current.pause()
        remoteAudioRef.current.srcObject = null
        remoteAudioRef.current = null
      }
    })

    call.on('cancel', () => {
      console.log('❌ Call cancelled')
      setCallStatus('Call cancelled')
      setIsCalling(false)
      activeCallRef.current = null
      
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current)
        callDurationRef.current = null
      }
      setCallDuration(0)
    })

    call.on('reject', () => {
      console.log('❌ Call rejected')
      setCallStatus('Call rejected')
      setIsCalling(false)
      activeCallRef.current = null
    })

    call.on('warning', (warningName: string, warningData: any) => {
      console.warn('⚠️ Call warning:', warningName, warningData)
      
      // Handle audio/network quality warnings
      if (warningName === 'high-rtt' || warningName === 'high-jitter' || warningName === 'high-packet-loss') {
        console.warn('📊 Network quality warning - this may affect audio quality')
        setCallStatus('Call connected (poor network quality)')
      }
      
      if (warningName === 'low-mos' || warningName === 'mos-degradation') {
        console.warn('📉 Call quality degradation detected')
        setCallStatus('Call connected (low quality)')
      }
    })

    call.on('warning-cleared', (warningName: string) => {
      console.log('✅ Warning cleared:', warningName)
    })

    call.on('error', (error: any) => {
      console.error('❌ Call error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      })
      setCallStatus(`Call error: ${error.message || error.code || 'Unknown error'}`)
      setIsCalling(false)
      activeCallRef.current = null
      
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current)
        callDurationRef.current = null
      }
      setCallDuration(0)
    })
  }

  const handleSendSMS = async () => {
    // Prevent multiple simultaneous sends
    if (isSendingSMS) {
      return
    }

    if (!smsTo || !smsMessage) {
      setDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please enter phone number and message',
        type: 'warning'
      })
      return
    }

    if (!smsMessage.trim()) {
      setDialog({
        isOpen: true,
        title: 'Invalid Message',
        message: 'Please enter a message',
        type: 'warning'
      })
      return
    }

    // Validate phone number format
    const phoneValidation = validatePhoneNumber(smsTo)
    if (!phoneValidation.valid) {
      setDialog({
        isOpen: true,
        title: 'Invalid Phone Number',
        message: phoneValidation.error || 'Please enter a valid phone number with country code (e.g., +1234567890)',
        type: 'error'
      })
      return
    }

    // If patient is selected, validate their phone number too
    if (selectedPatient && selectedPatient.mobile_phone) {
      const patientPhoneValidation = validatePhoneNumber(selectedPatient.mobile_phone)
      if (!patientPhoneValidation.valid && smsTo === selectedPatient.mobile_phone) {
        setDialog({
          isOpen: true,
          title: 'Invalid Patient Phone Number',
          message: `The selected patient has an invalid phone number format: ${patientPhoneValidation.error}. Please enter a different number or contact support.`,
          type: 'error'
        })
        return
      }
    }

    setIsSendingSMS(true)

    try {
      // Get current user for authentication
      const user = await getCurrentUser()
      if (!user) {
        setIsSendingSMS(false)
        setDialog({
          isOpen: true,
          title: 'Authentication Required',
          message: 'Please log in to send SMS',
          type: 'warning'
        })
        return
      }

      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Format phone number
      let formattedTo = smsTo.trim()
      if (!formattedTo.startsWith('+')) {
        formattedTo = `+${formattedTo}`
      }

      console.log('📱 Sending SMS:', {
        to: formattedTo,
        messageLength: smsMessage.length,
        patientId: selectedPatient?.id || 'none'
      })

      const response = await fetch('/api/communication/sms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: formattedTo,
          message: smsMessage.trim(),
          patientId: selectedPatient?.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ SMS API error:', response.status, data)
        setIsSendingSMS(false)
        setDialog({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to send SMS. Please try again.',
          type: 'error'
        })
        return
      }

      if (data.success) {
        console.log('✅ SMS sent successfully:', data.sid)
        setIsSendingSMS(false)
        setDialog({
          isOpen: true,
          title: 'Success',
          message: 'SMS sent successfully!',
          type: 'success'
        })
        setSmsMessage('')
        setSmsTo('') // Clear the phone number too
        fetchHistory()
      } else {
        console.error('❌ SMS failed:', data.error)
        setIsSendingSMS(false)
        setDialog({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to send SMS. Please try again.',
          type: 'error'
        })
      }
    } catch (error: any) {
      console.error('❌ Error sending SMS:', error)
      setIsSendingSMS(false)
      setDialog({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Network error. Please try again.',
        type: 'error'
      })
    }
  }

  const handleMakeCall = async () => {
    // Prevent multiple simultaneous calls
    if (isCallLoading || isCalling) {
      return
    }

    if (!phoneNumber) {
      setDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please enter a phone number',
        type: 'warning'
      })
      return
    }

    // Request microphone permissions before making the call
    // Use selected microphone if available
    try {
      const audioConstraints: MediaTrackConstraints = selectedMicId !== 'default' && selectedMicId 
        ? { deviceId: { exact: selectedMicId } }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints, 
        video: false 
      })
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())
      console.log('✅ Microphone permission granted')
      
      // Reload devices after permission is granted (to get full device labels)
      await loadAudioDevices()
    } catch (error: any) {
      console.error('❌ Microphone permission denied:', error)
      setDialog({
        isOpen: true,
        title: 'Microphone Permission Required',
        message: 'Please allow microphone access to make calls. Click the microphone icon in your browser\'s address bar and allow access.',
        type: 'error'
      })
      setIsCallLoading(false)
      return
    }

    // Validate phone number format
    const phoneValidation = validatePhoneNumber(phoneNumber)
    if (!phoneValidation.valid) {
      setDialog({
        isOpen: true,
        title: 'Invalid Phone Number',
        message: phoneValidation.error || 'Please enter a valid phone number with country code (e.g., +1234567890)',
        type: 'error'
      })
      return
    }

    // If patient is selected, validate their phone number too
    if (selectedPatient && selectedPatient.mobile_phone) {
      const patientPhoneValidation = validatePhoneNumber(selectedPatient.mobile_phone)
      if (!patientPhoneValidation.valid && phoneNumber === selectedPatient.mobile_phone) {
        setDialog({
          isOpen: true,
          title: 'Invalid Patient Phone Number',
          message: `The selected patient has an invalid phone number format: ${patientPhoneValidation.error}. Please enter a different number or contact support.`,
          type: 'error'
        })
        return
      }
    }

    if (!deviceRef.current) {
      setDialog({
        isOpen: true,
        title: 'Device Not Ready',
        message: 'Twilio device not initialized. Please wait a moment and try again.',
        type: 'warning'
      })
      return
    }

    setIsCallLoading(true)

    try {
      // Check device state
      const device = deviceRef.current
      
      // If device is not registered, wait for it (with timeout)
      if (!device || device.state !== 'registered') {
        setCallStatus('Waiting for device to register...')
        
        // Wait for device to be ready with timeout (10 seconds)
        const timeout = 10000
        const startTime = Date.now()
        
        await new Promise<void>((resolve, reject) => {
          const checkReady = () => {
            const elapsed = Date.now() - startTime
            
            if (device?.state === 'registered') {
              console.log('✅ Device is now registered')
              resolve()
            } else if (elapsed > timeout) {
              console.error('❌ Device registration timeout')
              setIsCallLoading(false)
              reject(new Error('Device registration timeout. Please refresh the page.'))
        } else {
              // Check again in 100ms
              setTimeout(checkReady, 100)
            }
          }
          checkReady()
          
          // Also listen for registered event
          device.once('registered', () => {
            console.log('✅ Device registered via event')
            resolve()
          })
        })
      }

      setIsCalling(true)
      setCallStatus('Connecting...')

      // Format phone number (ensure it starts with +)
      const formattedNumber = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+${phoneNumber}`

      console.log(`📞 Making call to: ${formattedNumber}`)

      // Apply audio devices BEFORE making the call to ensure correct mic is selected
      applyAudioDevices()

      // Use Voice SDK to make the call with WebSocket support
      // CRITICAL: Must pass rtcConstraints to enable audio with specific device
      const audioConstraints = selectedMicId && selectedMicId !== 'default' 
        ? { deviceId: { exact: selectedMicId } }
        : true

      console.log('🎤 Audio constraints for call:', audioConstraints)

      const call = await deviceRef.current.connect({
        params: {
          To: formattedNumber
        },
        rtcConstraints: {
          audio: audioConstraints  // Enable audio with selected microphone
        }
      } as any)

      activeCallRef.current = call
      
      // Setup call event handlers
      setupCallHandlers(call)
      
      // Apply audio devices again after call is created (for speaker)
      applyAudioDevices(call)

      // Save to communication history immediately when call starts
      // Save even without selected patient - patient_id will be null
      try {
        const user = await getCurrentUser()
        if (user) {
          const { data: doctor } = await supabase
            .from('doctors')
            .select('id')
            .eq('email', user.email!)
            .single()

          if (doctor) {
            // Function to save or update call history
            const saveCallHistory = async (callSid: string, status: string) => {
              try {
                // Check if record already exists
                const { data: existing } = await supabase
                  .from('communication_history')
                  .select('id')
                  .eq('twilio_sid', callSid)
                  .eq('doctor_id', doctor.id)
                  .single()

                if (existing) {
                  // Update existing record
                  const updateData: any = { status }
                  if (selectedPatient?.id) {
                    updateData.patient_id = selectedPatient.id
                  }
                  
                  const { error: updateError } = await supabase
                    .from('communication_history')
                    .update(updateData)
                    .eq('twilio_sid', callSid)
                    .eq('doctor_id', doctor.id)
                  
                  if (updateError) {
                    console.error('Error updating call status:', updateError)
                  } else {
                    console.log(`✅ Call status updated to ${status}`)
                    fetchHistory()
                  }
                } else {
                  // Insert new record
                  const insertData: any = {
                    doctor_id: doctor.id,
                    type: 'call',
                    direction: 'outbound',
                    to_number: formattedNumber,
                    status: status,
                    twilio_sid: callSid
                  }
                  
                  if (selectedPatient?.id) {
                    insertData.patient_id = selectedPatient.id
                  }
                  
                  const { error: insertError } = await supabase.from('communication_history').insert(insertData)
                  
                  if (insertError) {
                    console.error('Error saving communication history:', insertError)
                    console.error('Insert data:', insertData)
                  } else {
                    console.log(`✅ Communication history saved (${status})`)
                    fetchHistory()
                  }
                }
              } catch (err: any) {
                console.error('Error saving/updating call history:', err)
              }
            }

            // Store callSid for later use (using ref-like pattern)
            let callSid: string | null = (call as any).parameters?.CallSid || (call as any).sid || null
            
            // Wait a moment for CallSid to be available if not immediate
            if (!callSid) {
              console.log('⏳ Waiting for CallSid...')
              // Try again after a short delay
              setTimeout(async () => {
                const delayedCallSid = (call as any).parameters?.CallSid || (call as any).sid || null
                if (delayedCallSid) {
                  callSid = delayedCallSid
                  await saveCallHistory(delayedCallSid, 'initiated')
                } else {
                  console.warn('⚠️ CallSid still not available after delay')
                }
              }, 500)
            } else {
              // Save immediately if CallSid is available
              await saveCallHistory(callSid, 'initiated')
            }
            
            // Also try to get CallSid when call state changes
            call.on('ringing', () => {
              if (!callSid) {
                const ringingCallSid = (call as any).parameters?.CallSid || (call as any).sid || null
                if (ringingCallSid) {
                  callSid = ringingCallSid
                  saveCallHistory(ringingCallSid, 'initiated').catch(console.error)
                }
              }
            })

            // Update when call is accepted (CallSid should definitely be available now)
            call.on('accept', async () => {
              const acceptedCallSid = (call as any).parameters?.CallSid || (call as any).sid || callSid
              if (acceptedCallSid) {
                callSid = acceptedCallSid // Store for later use
                await saveCallHistory(acceptedCallSid, 'connected')
              }
            })

            // Update call duration and status when disconnected
            call.on('disconnect', async () => {
              const disconnectedCallSid = (call as any).parameters?.CallSid || (call as any).sid || callSid
              if (disconnectedCallSid) {
                try {
                  // Check current status before updating
                  const { data: currentRecord } = await supabase
                    .from('communication_history')
                    .select('status')
                    .eq('twilio_sid', disconnectedCallSid)
                    .eq('doctor_id', doctor.id)
                    .single()

                  const finalDuration = callDuration
                  const updateData: any = {
                    duration: finalDuration
                  }

                  // Only update status to 'completed' if call was 'connected'
                  // Otherwise keep the status as 'initiated' or whatever it was
                  if (currentRecord?.status === 'connected') {
                    updateData.status = 'completed'
                  } else if (!currentRecord?.status || currentRecord.status === 'initiated') {
                    // If never connected, update to 'ended' instead of 'completed'
                    updateData.status = 'ended'
                  }

                  await supabase
                    .from('communication_history')
                    .update(updateData)
                    .eq('twilio_sid', disconnectedCallSid)
                    .eq('doctor_id', doctor.id)
                  
                  console.log(`✅ Call ${updateData.status || 'ended'}, duration: ${finalDuration}s`)
                  // Refresh history after call ends
                  fetchHistory()
                } catch (err: any) {
                  console.error('Error updating call duration:', err)
                }
              }
            })
          }
        }
      } catch (error) {
        console.error('Error saving communication history:', error)
      }

      setIsCallLoading(false)
      fetchHistory()
    } catch (error: any) {
      console.error('❌ Error making call:', error)
      setIsCallLoading(false)
      setIsCalling(false)
      setCallStatus(`Error: ${error.message || 'Failed to make call'}`)
      setDialog({
        isOpen: true,
        title: 'Call Failed',
        message: error.message || 'Failed to make call. Please try again.',
        type: 'error'
      })
    }
  }

  const handleEndCall = async () => {
    if (activeCallRef.current) {
      console.log('📞 Ending call...')
      activeCallRef.current.disconnect()
      activeCallRef.current = null
    }
    
    if (callDurationRef.current) {
      clearInterval(callDurationRef.current)
      callDurationRef.current = null
    }
    
    setIsCalling(false)
    setCallStatus('Call ended')
    setCallDuration(0)
    fetchHistory()
  }

  const handleToggleMute = () => {
    if (activeCallRef.current) {
      if (isMuted) {
        activeCallRef.current.mute(false)
        setIsMuted(false)
        console.log('🔊 Unmuted')
      } else {
        activeCallRef.current.mute(true)
        setIsMuted(true)
        console.log('🔇 Muted')
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Request microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    setMicPermissionStatus('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())
      setMicPermissionGranted(true)
      setMicPermissionStatus('granted')
      console.log('✅ Microphone permission granted')
      return true
    } catch (error: any) {
      console.error('❌ Microphone permission denied:', error)
      setMicPermissionGranted(false)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermissionStatus('denied')
        setDialog({
          isOpen: true,
          title: 'Microphone Permission Required',
          message: 'Please allow microphone access to use audio devices. Click the microphone icon in your browser\'s address bar and allow access, then refresh the page.',
          type: 'warning'
        })
      } else if (error.name === 'NotFoundError') {
        setMicPermissionStatus('denied')
        setDialog({
          isOpen: true,
          title: 'No Microphone Found',
          message: 'No microphone device detected. Please connect a microphone and refresh the page.',
          type: 'warning'
        })
      } else {
        setMicPermissionStatus('denied')
        setDialog({
          isOpen: true,
          title: 'Microphone Access Error',
          message: `Failed to access microphone: ${error.message || 'Unknown error'}`,
          type: 'error'
        })
      }
      return false
    }
  }

  // Load available audio devices (microphones and speakers)
  const loadAudioDevices = async (requestPermission: boolean = false) => {
    try {
      // Request permission if needed or requested
      if (requestPermission || !micPermissionGranted) {
        const permissionGranted = await requestMicPermission()
        if (!permissionGranted) {
          // Permission denied, still try to enumerate (might get some devices)
          console.log('Permission denied, attempting to enumerate devices anyway...')
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(device => device.kind === 'audioinput')
      const speakers = devices.filter(device => device.kind === 'audiooutput')
      
      // Check if we got actual device labels (means permission is granted)
      const hasDeviceLabels = mics.length > 0 && mics.some(mic => mic.label && mic.label.trim() !== '')
      
      if (hasDeviceLabels) {
        setMicPermissionGranted(true)
        setMicPermissionStatus('granted')
      } else if (mics.length === 0 && !micPermissionGranted) {
        // No devices found and permission not granted - might need permission
        setMicPermissionStatus('prompt')
      }
      
      setAvailableMicrophones(mics)
      setAvailableSpeakers(speakers)
      
      // Auto-select default devices
      if (mics.length > 0) {
        const defaultMic = mics.find(mic => mic.deviceId === 'default') || mics[0]
        if (defaultMic) {
          setSelectedMicId(defaultMic.deviceId)
        }
      }
      
      if (speakers.length > 0) {
        const defaultSpeaker = speakers.find(speaker => speaker.deviceId === 'default') || speakers[0]
        if (defaultSpeaker) {
          setSelectedSpeakerId(defaultSpeaker.deviceId)
        }
      }
    } catch (error) {
      console.error('Error loading audio devices:', error)
      setMicPermissionStatus('denied')
    }
  }

  // Apply selected audio devices to Twilio
  const applyAudioDevices = (call: Call | null = null) => {
    try {
      const device = deviceRef.current
      if (!device) return

      console.log('🎙️ Applying audio devices:', {
        selectedMic: selectedMicId,
        selectedSpeaker: selectedSpeakerId,
        hasCall: !!call,
        deviceAudioAvailable: !!(device.audio)
      })

      // CRITICAL: Apply microphone selection to the Device (BEFORE making calls)
      // This ensures the correct mic is used from the start
      if (selectedMicId && selectedMicId !== 'default' && device.audio) {
        try {
          if (typeof (device.audio as any).setInputDevice === 'function') {
            (device.audio as any).setInputDevice(selectedMicId)
              .then(() => console.log('✅ Microphone device set via Twilio API:', selectedMicId))
              .catch((err: any) => console.warn('⚠️ Error setting mic device:', err))
          }
        } catch (error) {
          console.warn('⚠️ Error setting microphone device:', error)
        }
      }

      // Apply speaker selection
      // For Twilio Voice SDK, speaker selection is typically done via HTMLAudioElement.setSinkId()
      // on the remote audio element, or through the device.audio API
      if (selectedSpeakerId && selectedSpeakerId !== 'default') {
        try {
          // Method 1: Try Twilio Voice SDK v2.x API
          if (device.audio && typeof (device.audio as any).setOutputDevice === 'function') {
            (device.audio as any).setOutputDevice(selectedSpeakerId)
              .then(() => console.log('✅ Speaker device set via Twilio API:', selectedSpeakerId))
              .catch((err: any) => console.warn('⚠️ Error setting speaker device:', err))
          }
          // Method 2: Try HTMLAudioElement.setSinkId() if available (Chrome/Edge)
          else if (call && (call as any).remoteStream) {
            const remoteAudioTracks = (call as any).remoteStream.getAudioTracks() || []
            // Note: setSinkId is set on the HTMLAudioElement, not the MediaStreamTrack
            // Twilio manages the audio element internally, so we may need to wait for it
            console.log('Speaker selection will be applied when audio element is available')
          }
        } catch (error) {
          console.warn('⚠️ Error setting speaker device:', error)
          // Some browsers/devices may not support setSinkId
        }
      }

      // If call already exists, try to update the input device on existing tracks
      if (call && selectedMicId !== 'default') {
        try {
          const localAudioTracks = (call as any)?.localStream?.getAudioTracks() || []
          if (localAudioTracks.length > 0) {
            localAudioTracks.forEach((track: MediaStreamTrack) => {
              if ('applyConstraints' in track && 'getSettings' in track) {
                const currentSettings = track.getSettings()
                console.log('🎤 Current mic settings:', currentSettings)
                // Only apply if device is different
                if (currentSettings.deviceId !== selectedMicId) {
                  console.log('🔄 Switching microphone on active call...')
                  track.applyConstraints({ deviceId: { exact: selectedMicId } } as any)
                    .then(() => console.log('✅ Microphone switched successfully'))
                    .catch((err: any) => console.warn('⚠️ Error applying mic constraints:', err))
                }
              }
            })
          }
        } catch (error) {
          console.warn('⚠️ Error setting microphone device on call:', error)
        }
      }
    } catch (error) {
      console.error('❌ Error applying audio devices:', error)
    }
  }

  const handleDialPadInput = (digit: string) => {
    setDialPadNumber(prev => prev + digit)
    setPhoneNumber(prev => prev + digit)
  }

  const handleDialPadClear = () => {
    setDialPadNumber('')
    setPhoneNumber('')
  }

  const handleGenerateVideoLink = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first')
      return
    }

    try {
      // Get the access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        alert('Session expired. Please refresh and login again.')
        return
      }

      const response = await fetch('/api/communication/video', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          patientId: selectedPatient.id,
          patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`
        })
      })

      const data = await response.json()
      if (data.success && data.meeting) {
        setVideoMeeting(data.meeting)
        fetchHistory()
        alert(`Meeting link created! Join URL: ${data.meeting.join_url}`)
      } else {
        alert(`Failed to create meeting: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating video call:', error)
      alert('Failed to create video meeting')
    }
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

  const filteredPatients = patients.filter(patient =>
    searchQuery === '' ||
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.mobile_phone?.includes(searchQuery) ||
    patient.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Close patient list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.patient-selector-container')) {
        setShowPatientList(false)
      }
    }

    if (showPatientList) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPatientList])

  return (
    <div className="min-h-screen bg-[#0a1f1f] text-white p-6">
      {/* Patient Selection Section */}
      <div className="mb-6 patient-selector-container">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Patient
        </label>
        <div className="relative">
          <div
            onClick={() => setShowPatientList(!showPatientList)}
            className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-4 py-3 cursor-pointer flex items-center justify-between hover:border-teal-500 transition-colors"
          >
            <div className="flex items-center">
              {selectedPatient ? (
                <div>
                  <p className="text-white font-medium">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </p>
                  <p className="text-sm text-gray-400">{selectedPatient.mobile_phone}</p>
                </div>
              ) : (
                <p className="text-gray-400">Choose a patient...</p>
              )}
            </div>
            <Search className="w-5 h-5 text-gray-400" />
          </div>

          {showPatientList && (
            <div className="absolute top-full mt-2 w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg max-h-96 overflow-y-auto z-20 shadow-xl">
              <div className="p-3 border-b border-[#1a3d3d] sticky top-0 bg-[#0d2626]">
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#164e4e] border border-[#1a5a5a] rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-400">Loading patients...</div>
                ) : filteredPatients.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">No patients found</div>
                ) : (
                  filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatient(patient)
                        setShowPatientList(false)
                        setSearchQuery('')
                      }}
                      className={`p-4 hover:bg-[#164e4e] cursor-pointer border-b border-[#1a3d3d] ${
                        selectedPatient?.id === patient.id ? 'bg-[#164e4e] border-l-4 border-teal-500' : ''
                      }`}
                    >
                      <p className="text-white font-medium">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{patient.mobile_phone}</p>
                      {patient.email && (
                        <p className="text-xs text-gray-500 mt-1">{patient.email}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New SMS Card */}
        <div className="bg-[#0d2626] rounded-lg p-6 border border-[#1a3d3d]">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <MessageSquare className="w-6 h-6 text-teal-400 mr-2" />
            New SMS
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">To</label>
              <input
                type="tel"
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-[#164e4e] border border-[#1a5a5a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">TEXT HERE</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message..."
                rows={6}
                className="w-full bg-[#164e4e] border border-[#1a5a5a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
            <button
              onClick={handleSendSMS}
              disabled={isSendingSMS}
              className="w-full bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] py-3 rounded-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingSMS ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0a1f1f] mr-2"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
              <Send className="w-5 h-5 mr-2" />
              Send
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dial Pad Card */}
        <div className="bg-[#0d2626] rounded-lg p-6 border border-[#1a3d3d]">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Phone className="w-6 h-6 text-teal-400 mr-2" />
            Dial Pad
          </h3>
          <div className="mb-4">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter number"
              disabled={isCalling}
              className="w-full bg-[#164e4e] border border-[#1a5a5a] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="mt-2 flex items-center justify-between">
            {callStatus && (
                <p className="text-sm text-gray-400">{callStatus}</p>
              )}
              {isCalling && callDuration > 0 && (
                <p className="text-sm font-semibold text-teal-400">{formatDuration(callDuration)}</p>
            )}
            </div>
          </div>
          
          {/* Audio Device Selection */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            {/* Microphone Selection */}
            <div className="relative">
              <label className="block text-xs text-teal-300/80 mb-1.5 font-medium">
                Microphone
                {micPermissionStatus === 'denied' && (
                  <span className="ml-1 text-red-400">⚠️</span>
                )}
              </label>
              {micPermissionStatus === 'denied' || (availableMicrophones.length === 0 && !micPermissionGranted) ? (
                <button
                  onClick={async () => {
                    await loadAudioDevices(true)
                  }}
                  disabled={micPermissionStatus === 'checking' || isCalling}
                  className="w-full bg-gradient-to-b from-[#164e4e] to-[#0f3a3a] border border-teal-500/30 rounded-lg px-3 py-2 text-sm text-teal-300 hover:border-teal-400 hover:from-[#1a5a5a] hover:to-[#134040] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {micPermissionStatus === 'checking' ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-teal-300"></div>
                      Requesting...
                    </span>
                  ) : (
                    'Grant Microphone Permission'
                  )}
                </button>
              ) : (
                <select
                  value={selectedMicId}
                  onChange={(e) => {
                    setSelectedMicId(e.target.value)
                    applyAudioDevices(activeCallRef.current)
                  }}
                  disabled={isCalling || micPermissionStatus === 'checking'}
                  className="w-full bg-gradient-to-b from-[#164e4e] to-[#0f3a3a] border border-teal-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer transition-all duration-200 hover:border-teal-400/60 hover:from-[#1a5a5a] hover:to-[#134040] shadow-sm"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236EE7B7' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1em 1em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {availableMicrophones.length === 0 ? (
                    <option value="default" className="bg-[#164e4e] text-white">No microphone found</option>
                  ) : (
                    availableMicrophones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId} className="bg-[#164e4e] text-white py-1">
                        {mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Speaker Selection */}
            <div className="relative">
              <label className="block text-xs text-teal-300/80 mb-1.5 font-medium">Speaker</label>
              <select
                value={selectedSpeakerId}
                onChange={(e) => {
                  setSelectedSpeakerId(e.target.value)
                  applyAudioDevices(activeCallRef.current)
                }}
                disabled={isCalling}
                className="w-full bg-gradient-to-b from-[#164e4e] to-[#0f3a3a] border border-teal-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer transition-all duration-200 hover:border-teal-400/60 hover:from-[#1a5a5a] hover:to-[#134040] shadow-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236EE7B7' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1em 1em',
                  paddingRight: '2.5rem'
                }}
              >
                {availableSpeakers.length === 0 ? (
                  <option value="default" className="bg-[#164e4e] text-white">Default Speaker</option>
                ) : (
                  availableSpeakers.map((speaker) => (
                    <option key={speaker.deviceId} value={speaker.deviceId} className="bg-[#164e4e] text-white py-1">
                      {speaker.label || `Speaker ${availableSpeakers.indexOf(speaker) + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleDialPadInput(String(digit))}
                disabled={isCalling}
                className="bg-[#164e4e] hover:bg-[#1a5a5a] border border-[#1a5a5a] rounded-lg py-4 text-white font-semibold text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {digit}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {isCalling ? (
              <>
            <button
                  onClick={handleToggleMute}
                  className={`flex-1 ${
                    isMuted 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-gray-600 hover:bg-gray-700'
                  } text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🔊'}
                  <span className="ml-2">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
              <button
                onClick={handleEndCall}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <Phone className="w-5 h-5 rotate-135" />
                  <span className="ml-2">End</span>
              </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleDialPadClear}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleMakeCall}
                  disabled={!phoneNumber || !isDeviceReady || isCallLoading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title={!isDeviceReady ? 'Device not ready. Please wait...' : isCallLoading ? 'Connecting...' : 'Make a call'}
                >
                  {isCallLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-5 h-5" />
                      <span className="ml-2">Call</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Create Video/Call Link Card */}
        <div className="bg-[#0d2626] rounded-lg p-6 border border-[#1a3d3d]">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Video className="w-6 h-6 text-teal-400 mr-2" />
            Create Video/Call Link
          </h3>
          {videoMeeting ? (
            <div className="space-y-4">
              <div className="bg-[#164e4e] rounded-lg p-4 border border-[#1a5a5a]">
                <p className="text-white font-medium mb-2">Meeting Created Successfully!</p>
                <a
                  href={videoMeeting.join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 underline break-all"
                >
                  {videoMeeting.join_url}
                </a>
                {videoMeeting.password && (
                  <p className="text-sm text-gray-400 mt-2">Password: {videoMeeting.password}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setVideoMeeting(null)
                  handleGenerateVideoLink()
                }}
                className="w-full bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] py-3 rounded-lg font-bold transition-colors"
              >
                Generate New Link
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateVideoLink}
              disabled={!selectedPatient}
              className="w-full bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          )}
        </div>

        {/* History Card */}
        <div className="bg-[#0d2626] rounded-lg p-6 border border-[#1a3d3d] lg:col-span-3">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Clock className="w-6 h-6 text-teal-400 mr-2" />
            Communication History
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                <p className="text-gray-400 mt-4">Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No communication history yet</p>
                <p className="text-gray-500 text-sm mt-2">Start by sending an SMS or making a call</p>
              </div>
            ) : (
              history.map((item) => {
                const patientName = item.users 
                  ? `${item.users.first_name} ${item.users.last_name}`
                  : item.to_number || 'Unknown'
                
                const getTypeIcon = () => {
                  switch (item.type) {
                    case 'call':
                      return <PhoneCall className="w-4 h-4 text-blue-400" />
                    case 'sms':
                      return <MessageSquare className="w-4 h-4 text-green-400" />
                    case 'video':
                      return <Video className="w-4 h-4 text-purple-400" />
                    case 'email':
                      return <MessageSquare className="w-4 h-4 text-orange-400" />
                    default:
                      return <MessageSquare className="w-4 h-4 text-gray-400" />
                  }
                }

                const getTypeLabel = () => {
                  switch (item.type) {
                    case 'call':
                      return item.direction === 'outbound' ? 'Outbound Call' : 'Inbound Call'
                    case 'sms':
                      return item.direction === 'outbound' ? 'Sent SMS' : 'Received SMS'
                    case 'video':
                      return 'Video Call'
                    case 'email':
                      return item.direction === 'outbound' ? 'Sent Email' : 'Received Email'
                    default:
                      return item.type
                  }
                }

                const getStatusColor = () => {
                  if (item.status === 'connected' || item.status === 'sent' || item.status === 'delivered') {
                    return 'text-green-400'
                  }
                  if (item.status === 'completed' || item.status === 'initiated') {
                    return 'text-blue-400'
                  }
                  if (item.status === 'failed' || item.status === 'error') {
                    return 'text-red-400'
                  }
                  return 'text-yellow-400'
                }

                const getStatusLabel = () => {
                  switch (item.status) {
                    case 'initiated':
                      return 'Initiated'
                    case 'connected':
                      return 'Connected'
                    case 'completed':
                      return 'Completed'
                    case 'ended':
                      return 'Ended'
                    case 'failed':
                      return 'Failed'
                    case 'error':
                      return 'Error'
                    default:
                      return item.status || 'Unknown'
                  }
                }

                return (
                <div
                  key={item.id}
                    className="p-4 bg-[#164e4e] rounded-lg border border-[#1a5a5a] hover:border-teal-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {getTypeIcon()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium text-sm">
                              {getTypeLabel()}
                            </p>
                            {item.status && (
                              <span className={`text-xs ${getStatusColor()}`}>
                                • {getStatusLabel()}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm">
                            {patientName}
                            {item.to_number && !item.users && (
                              <span className="text-gray-500"> ({item.to_number})</span>
                            )}
                          </p>
                          {item.message && (
                            <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                              {item.message}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{formatHistoryDate(item.created_at)}</span>
                            {item.duration && (item.type === 'call' || item.type === 'video') && (
                              <span>Duration: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</span>
                            )}
                            {item.type === 'call' && (
                              <>
                                {item.recording_url ? (
                                  <div className="flex items-center gap-2 bg-[#1a5a5a] rounded-md px-2 py-1">
                                    <audio
                                      ref={(el) => {
                                        if (el) audioRefs.current[item.id] = el
                                      }}
                                      src={item.recording_url}
                                      onEnded={() => setPlayingRecordingId(null)}
                                      onPlay={() => setPlayingRecordingId(item.id)}
                                      onPause={() => setPlayingRecordingId(null)}
                                      onError={(e) => {
                                        console.error('Audio playback error:', e)
                                        setDialog({
                                          isOpen: true,
                                          title: 'Playback Error',
                                          message: 'Unable to play recording. You can try downloading it instead.',
                                          type: 'error'
                                        })
                                      }}
                                      preload="metadata"
                                      crossOrigin="anonymous"
                                    />
                                    <button
                                      onClick={() => {
                                        const audio = audioRefs.current[item.id]
                                        if (audio) {
                                          if (playingRecordingId === item.id) {
                                            audio.pause()
                                            setPlayingRecordingId(null)
                                          } else {
                                            // Pause any other playing audio
                                            Object.keys(audioRefs.current).forEach((id) => {
                                              if (id !== item.id && audioRefs.current[id]) {
                                                audioRefs.current[id]?.pause()
                                              }
                                            })
                                            audio.play().catch((err) => {
                                              console.error('Error playing audio:', err)
                                              setDialog({
                                                isOpen: true,
                                                title: 'Playback Error',
                                                message: 'Unable to play recording. You can try downloading it instead.',
                                                type: 'error'
                                              })
                                            })
                                            setPlayingRecordingId(item.id)
                                          }
                                        }
                                      }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        playingRecordingId === item.id
                                          ? 'text-teal-300 bg-teal-900/30'
                                          : 'text-teal-400 hover:text-teal-300 hover:bg-teal-900/20'
                                      }`}
                                      title={playingRecordingId === item.id ? 'Pause recording' : 'Play recording'}
                                    >
                                      {playingRecordingId === item.id ? (
                                        <>
                                          <Pause className="w-4 h-4" />
                                          <span className="text-xs font-medium">Pause</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-4 h-4" />
                                          <span className="text-xs font-medium">Play</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const link = document.createElement('a')
                                        link.href = item.recording_url!
                                        link.download = `call-recording-${item.id}.mp3`
                                        link.target = '_blank'
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                                      title="Download recording"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span className="text-xs font-medium">Download</span>
                                    </button>
                                  </div>
                                ) : item.twilio_sid ? (
                                  (() => {
                                    // Check if we have a cached recording URL
                                    const cachedUrl = recordingUrlCache.current[item.twilio_sid]
                                    const isCurrentlyFetching = fetchingRecordings.current.has(item.twilio_sid)
                                    
                                    // If we have a cached URL, show play button
                                    if (cachedUrl) {
                                      return (
                                        <div className="flex items-center gap-2 bg-[#1a5a5a] rounded-md px-2 py-1">
                                          <audio
                                            ref={(el) => {
                                              if (el) audioRefs.current[item.id] = el
                                            }}
                                            src={cachedUrl}
                                            onEnded={() => setPlayingRecordingId(null)}
                                            onPlay={() => setPlayingRecordingId(item.id)}
                                            onPause={() => setPlayingRecordingId(null)}
                                            onError={(e) => {
                                              console.error('Audio playback error:', e)
                                              setDialog({
                                                isOpen: true,
                                                title: 'Playback Error',
                                                message: 'Unable to play recording. You can try downloading it instead.',
                                                type: 'error'
                                              })
                                            }}
                                            preload="metadata"
                                            crossOrigin="anonymous"
                                          />
                                          <button
                                            onClick={() => {
                                              const audio = audioRefs.current[item.id]
                                              if (audio) {
                                                if (playingRecordingId === item.id) {
                                                  audio.pause()
                                                  setPlayingRecordingId(null)
                                                } else {
                                                  // Pause any other playing audio
                                                  Object.keys(audioRefs.current).forEach((id) => {
                                                    if (id !== item.id && audioRefs.current[id]) {
                                                      audioRefs.current[id]?.pause()
                                                    }
                                                  })
                                                  audio.play().catch((err) => {
                                                    console.error('Error playing audio:', err)
                                                    setDialog({
                                                      isOpen: true,
                                                      title: 'Playback Error',
                                                      message: 'Unable to play recording. You can try downloading it instead.',
                                                      type: 'error'
                                                    })
                                                  })
                                                  setPlayingRecordingId(item.id)
                                                }
                                              }
                                            }}
                                            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                              playingRecordingId === item.id
                                                ? 'text-teal-300 bg-teal-900/30'
                                                : 'text-teal-400 hover:text-teal-300 hover:bg-teal-900/20'
                                            }`}
                                            title={playingRecordingId === item.id ? 'Pause recording' : 'Play recording'}
                                          >
                                            {playingRecordingId === item.id ? (
                                              <>
                                                <Pause className="w-4 h-4" />
                                                <span className="text-xs font-medium">Pause</span>
                                              </>
                                            ) : (
                                              <>
                                                <Play className="w-4 h-4" />
                                                <span className="text-xs font-medium">Play</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            onClick={() => {
                                              const link = document.createElement('a')
                                              link.href = cachedUrl
                                              link.download = `call-recording-${item.id}.mp3`
                                              link.target = '_blank'
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                                            title="Download recording"
                                          >
                                            <Download className="w-4 h-4" />
                                            <span className="text-xs font-medium">Download</span>
                                          </button>
                                        </div>
                                      )
                                    }
                                    
                                    // If currently fetching, show loading state
                                    if (isCurrentlyFetching) {
                                      return (
                                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                                          <span>Fetching...</span>
                                        </div>
                                      )
                                    }
                                    
                                    // Otherwise, show fetch button
                                    return (
                                      <button
                                        onClick={async () => {
                                          // Prevent multiple simultaneous fetches
                                          if (fetchingRecordings.current.has(item.twilio_sid!)) {
                                            return
                                          }
                                          
                                          fetchingRecordings.current.add(item.twilio_sid!)
                                          
                                          try {
                                            const { data: { session } } = await supabase.auth.getSession()
                                            const accessToken = session?.access_token
                                            
                                            const response = await fetch(`/api/communication/recordings?callSid=${item.twilio_sid}`, {
                                              method: 'GET',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': accessToken ? `Bearer ${accessToken}` : '',
                                              },
                                              credentials: 'include'
                                            })

                                            const data = await response.json()
                                            
                                            if (data.success && data.recordingUrl) {
                                              // Cache the recording URL
                                              recordingUrlCache.current[item.twilio_sid!] = data.recordingUrl
                                              
                                              // Update the history item with the recording URL
                                              setHistory(prev => prev.map(h => 
                                                h.id === item.id 
                                                  ? { ...h, recording_url: data.recordingUrl }
                                                  : h
                                              ))
                                              
                                              // Refresh history to persist in database
                                              fetchHistory()
                                            } else {
                                              setDialog({
                                                isOpen: true,
                                                title: 'No Recording',
                                                message: data.error || 'Recording not available yet. It may still be processing.',
                                                type: 'warning'
                                              })
                                            }
                                          } catch (error: any) {
                                            console.error('Error fetching recording:', error)
                                            setDialog({
                                              isOpen: true,
                                              title: 'Error',
                                              message: 'Failed to fetch recording. Please try again.',
                                              type: 'error'
                                            })
                                          } finally {
                                            fetchingRecordings.current.delete(item.twilio_sid!)
                                          }
                                        }}
                                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                                        title="Fetch recording from Twilio"
                                        disabled={isCurrentlyFetching}
                                      >
                                        <PhoneCall className="w-3 h-3" />
                                        <span>Fetch Recording</span>
                                      </button>
                                    )
                                  })()
                                ) : (
                                  <span className="text-xs text-gray-500 italic">
                                    Recording processing...
                                  </span>
                                )}
                              </>
                            )}
                            {item.type === 'video' && (
                              <>
                                {item.recording_url ? (
                                  <div className="flex items-center gap-2 bg-[#1a5a5a] rounded-md px-2 py-1">
                                    <video
                                      ref={(el) => {
                                        if (el) audioRefs.current[item.id] = el as any
                                      }}
                                      src={item.recording_url}
                                      onEnded={() => setPlayingRecordingId(null)}
                                      onPlay={() => setPlayingRecordingId(item.id)}
                                      onPause={() => setPlayingRecordingId(null)}
                                      onError={(e) => {
                                        console.error('Video playback error:', e)
                                        setDialog({
                                          isOpen: true,
                                          title: 'Playback Error',
                                          message: 'Unable to play recording. You can try downloading it instead.',
                                          type: 'error'
                                        })
                                      }}
                                      preload="metadata"
                                      crossOrigin="anonymous"
                                      className="hidden"
                                    />
                                    <button
                                      onClick={() => {
                                        const video = audioRefs.current[item.id] as HTMLVideoElement
                                        if (video) {
                                          if (playingRecordingId === item.id) {
                                            video.pause()
                                            setPlayingRecordingId(null)
                                          } else {
                                            // Pause any other playing media
                                            Object.keys(audioRefs.current).forEach((id) => {
                                              if (id !== item.id && audioRefs.current[id]) {
                                                const media = audioRefs.current[id]
                                                if (media) {
                                                  media.pause()
                                                }
                                              }
                                            })
                                            video.play().catch((err) => {
                                              console.error('Error playing video:', err)
                                              setDialog({
                                                isOpen: true,
                                                title: 'Playback Error',
                                                message: 'Unable to play recording. You can try downloading it instead.',
                                                type: 'error'
                                              })
                                            })
                                            setPlayingRecordingId(item.id)
                                            // Open video in new tab as fallback
                                            window.open(item.recording_url, '_blank')
                                          }
                                        }
                                      }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        playingRecordingId === item.id
                                          ? 'text-teal-300 bg-teal-900/30'
                                          : 'text-teal-400 hover:text-teal-300 hover:bg-teal-900/20'
                                      }`}
                                      title={playingRecordingId === item.id ? 'Pause recording' : 'Play recording'}
                                    >
                                      {playingRecordingId === item.id ? (
                                        <>
                                          <Pause className="w-4 h-4" />
                                          <span className="text-xs font-medium">Pause</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-4 h-4" />
                                          <span className="text-xs font-medium">Play</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const link = document.createElement('a')
                                        link.href = item.recording_url!
                                        link.download = `video-recording-${item.id}.mp4`
                                        link.target = '_blank'
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                                      title="Download recording"
                                    >
                                      <Download className="w-4 h-4" />
                                      <span className="text-xs font-medium">Download</span>
                                    </button>
                                  </div>
                                ) : item.meeting_id ? (
                                  (() => {
                                    // Check if we have a cached recording URL
                                    const cachedUrl = recordingUrlCache.current[item.meeting_id]
                                    const isCurrentlyFetching = fetchingRecordings.current.has(item.meeting_id)
                                    
                                    // If we have a cached URL, show play button
                                    if (cachedUrl) {
                                      return (
                                        <div className="flex items-center gap-2 bg-[#1a5a5a] rounded-md px-2 py-1">
                                          <video
                                            ref={(el) => {
                                              if (el) audioRefs.current[item.id] = el as any
                                            }}
                                            src={cachedUrl}
                                            onEnded={() => setPlayingRecordingId(null)}
                                            onPlay={() => setPlayingRecordingId(item.id)}
                                            onPause={() => setPlayingRecordingId(null)}
                                            onError={(e) => {
                                              console.error('Video playback error:', e)
                                              setDialog({
                                                isOpen: true,
                                                title: 'Playback Error',
                                                message: 'Unable to play recording. You can try downloading it instead.',
                                                type: 'error'
                                              })
                                            }}
                                            preload="metadata"
                                            crossOrigin="anonymous"
                                            className="hidden"
                                          />
                                          <button
                                            onClick={() => {
                                              const video = audioRefs.current[item.id] as HTMLVideoElement
                                              if (video) {
                                                if (playingRecordingId === item.id) {
                                                  video.pause()
                                                  setPlayingRecordingId(null)
                                                } else {
                                                  // Pause any other playing media
                                                  Object.keys(audioRefs.current).forEach((id) => {
                                                    if (id !== item.id && audioRefs.current[id]) {
                                                      const media = audioRefs.current[id]
                                                      if (media) {
                                                        media.pause()
                                                      }
                                                    }
                                                  })
                                                  video.play().catch((err) => {
                                                    console.error('Error playing video:', err)
                                                    setDialog({
                                                      isOpen: true,
                                                      title: 'Playback Error',
                                                      message: 'Unable to play recording. You can try downloading it instead.',
                                                      type: 'error'
                                                    })
                                                  })
                                                  setPlayingRecordingId(item.id)
                                                  // Open video in new tab as fallback
                                                  window.open(cachedUrl, '_blank')
                                                }
                                              }
                                            }}
                                            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                              playingRecordingId === item.id
                                                ? 'text-teal-300 bg-teal-900/30'
                                                : 'text-teal-400 hover:text-teal-300 hover:bg-teal-900/20'
                                            }`}
                                            title={playingRecordingId === item.id ? 'Pause recording' : 'Play recording'}
                                          >
                                            {playingRecordingId === item.id ? (
                                              <>
                                                <Pause className="w-4 h-4" />
                                                <span className="text-xs font-medium">Pause</span>
                                              </>
                                            ) : (
                                              <>
                                                <Play className="w-4 h-4" />
                                                <span className="text-xs font-medium">Play</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            onClick={() => {
                                              const link = document.createElement('a')
                                              link.href = cachedUrl
                                              link.download = `video-recording-${item.id}.mp4`
                                              link.target = '_blank'
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                                            title="Download recording"
                                          >
                                            <Download className="w-4 h-4" />
                                            <span className="text-xs font-medium">Download</span>
                                          </button>
                                        </div>
                                      )
                                    }
                                    
                                    // If currently fetching, show loading state
                                    if (isCurrentlyFetching) {
                                      return (
                                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                                          <span>Fetching...</span>
                                        </div>
                                      )
                                    }
                                    
                                    // Otherwise, show fetch button
                                    return (
                                      <button
                                        onClick={async () => {
                                          // Prevent multiple simultaneous fetches
                                          if (fetchingRecordings.current.has(item.meeting_id!)) {
                                            return
                                          }
                                          
                                          fetchingRecordings.current.add(item.meeting_id!)
                                          
                                          try {
                                            const { data: { session } } = await supabase.auth.getSession()
                                            const accessToken = session?.access_token
                                            
                                            const response = await fetch(`/api/communication/recordings?meetingId=${item.meeting_id}`, {
                                              method: 'GET',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': accessToken ? `Bearer ${accessToken}` : '',
                                              },
                                              credentials: 'include'
                                            })

                                            const data = await response.json()
                                            
                                            if (data.success && data.recordingUrl) {
                                              // Cache the recording URL
                                              recordingUrlCache.current[item.meeting_id!] = data.recordingUrl
                                              
                                              // Update the history item with the recording URL
                                              setHistory(prev => prev.map(h => 
                                                h.id === item.id 
                                                  ? { ...h, recording_url: data.recordingUrl }
                                                  : h
                                              ))
                                              
                                              // Refresh history to persist in database
                                              fetchHistory()
                                              
                                              setDialog({
                                                isOpen: true,
                                                title: 'Recording Available',
                                                message: 'Recording has been successfully retrieved and is now available for playback.',
                                                type: 'success'
                                              })
                                            } else {
                                              // Handle specific error codes
                                              let errorTitle = 'No Recording'
                                              let errorMessage = data.error || 'Recording not available yet.'
                                              
                                              if (data.code === 3301 || errorMessage.includes('Recording is not available')) {
                                                errorTitle = 'Recording Processing'
                                                errorMessage = 'Recording is not available yet. This could mean:\n\n' +
                                                  '• The meeting has not ended yet\n' +
                                                  '• Recording is still being processed (can take 5-30 minutes after meeting ends)\n' +
                                                  '• Recording was not enabled for this meeting\n\n' +
                                                  'Please wait a few minutes and try again.'
                                              } else if (errorMessage.includes('still in progress')) {
                                                errorTitle = 'Meeting In Progress'
                                                errorMessage = errorMessage
                                              }
                                              
                                              setDialog({
                                                isOpen: true,
                                                title: errorTitle,
                                                message: errorMessage,
                                                type: 'warning'
                                              })
                                            }
                                          } catch (error: any) {
                                            console.error('Error fetching recording:', error)
                                            setDialog({
                                              isOpen: true,
                                              title: 'Error',
                                              message: 'Failed to fetch recording. Please try again.',
                                              type: 'error'
                                            })
                                          } finally {
                                            fetchingRecordings.current.delete(item.meeting_id!)
                                          }
                                        }}
                                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                                        title="Fetch recording from Zoom"
                                        disabled={isCurrentlyFetching}
                                      >
                                        <Video className="w-3 h-3" />
                                        <span>Fetch Recording</span>
                                      </button>
                                    )
                                  })()
                                ) : (
                                  <span className="text-xs text-gray-500 italic">
                                    Recording processing...
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                  </div>
                </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Custom Dialog */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
      />
    </div>
  )
}

