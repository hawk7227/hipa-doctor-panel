'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import MedicalRecordsView from './MedicalRecordsView'
import AIChatHistory from './AIChatHistory'
import AppointmentChat from './AppointmentChat'
import ZoomMeetingEmbed from './ZoomMeetingEmbed'
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Video, 
  FileText,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Download,
  Eye,
  MessageCircle,
  Pill,
  Mic,
  MicOff,
  Send,
  Plus,
  FileImage,
  History,
  ChevronRight,
  Activity,
  Shield,
  Clock3,
  Calendar as CalendarIcon,
  RotateCcw,
  GripVertical,
  Save,
  PhoneCall,
  MessageSquare,
  Maximize2,
  Minimize2,
  Brain,
  Sparkles
} from 'lucide-react'
import type { Device, Call } from '@twilio/voice-sdk'

interface Appointment {
  id: string
  service_type: string
  status: string
  visit_type: string
  requested_date_time: string | null
  zoom_meeting_url: string | null
  zoom_meeting_id: string | null
  zoom_meeting_password: string | null
  zoom_start_url: string | null
  notes: string | null
  created_at: string
  provider_accepted_at: string | null
  preferred_pharmacy: string | null
  allergies: string | null
  subjective_notes: string | null
  objective_notes: string | null
  assessment_notes: string | null
  plan_notes: string | null
  diagnosis_codes: string | null
  current_medications: string | null

  active_problems: string | null
  recent_surgeries_details: string | null
  ongoing_medical_issues_details: string | null
  vitals_bp: string | null
  vitals_hr: string | null
  vitals_temp: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  patient_email: string | null
  patient_phone: string | null
  patient_dob: string | null
  patient_location: string | null
  doctor_id: string | null
  user_id: string | null
  chief_complaint: string | null
  ros_general: string | null
  signed_at: string | null
  signed_by: string | null
  is_locked: boolean | null
  cdss_auto_generated: boolean | null
  resolved_problems: any[] | null
  medication_history: any[] | null
  active_medication_orders: any[] | null
  past_medication_orders: any[] | null
  prescription_logs: any[] | null
  payment_status: string | null
  payment_intent_id: string | null
  doctors: {
    first_name: string
    last_name: string
    specialty: string
    timezone?: string
  } | null
}

interface AppointmentDetailModalProps {
  appointmentId: string | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: () => void
  onSmsSent?: (message: string) => void
}

// Utility function to convert appointment time to doctor's timezone
function convertToTimezone(dateString: string, timezone: string): Date {
  const date = new Date(dateString)
  // Convert to the specified timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = parseInt(getValue('year'))
  const month = parseInt(getValue('month')) - 1
  const day = parseInt(getValue('day'))
  const hour = parseInt(getValue('hour'))
  const minute = parseInt(getValue('minute'))
  const second = parseInt(getValue('second'))
  
  // Create a new Date in local timezone with the values from doctor's timezone
  const converted = new Date(year, month, day, hour, minute, second)
  
  return converted
}

// Utility function to format date for datetime-local input in a specific timezone
function formatDateForDateTimeLocal(dateString: string, timezone: string): string {
  const date = new Date(dateString)
  // Get the date/time components in the target timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  
  const getValue = (type: string) => parts.find(part => part.type === type)?.value || '0'
  
  const year = getValue('year')
  const month = getValue('month').padStart(2, '0')
  const day = getValue('day').padStart(2, '0')
  const hour = getValue('hour').padStart(2, '0')
  const minute = getValue('minute').padStart(2, '0')
  
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  return `${year}-${month}-${day}T${hour}:${minute}`
}

// Utility function to convert datetime-local string (treated as timezone time) to UTC ISO string
function convertDateTimeLocalToUTC(dateTimeLocal: string, timezone: string): string {
  // Parse the datetime-local string (format: YYYY-MM-DDTHH:mm)
  const [datePart, timePart] = dateTimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  
  // Create a formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Start with a UTC date that's approximately correct
  // For America/New_York: EST is UTC-5, EDT is UTC-4
  // Rough DST check: second Sunday in March to first Sunday in November
  let baseUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  
  // Estimate offset (EDT: -4, EST: -5)
  const monthNum = month
  const isLikelyDST = (monthNum >= 4 && monthNum <= 10) || 
                      (monthNum === 3 && day >= 8) || 
                      (monthNum === 11 && day <= 7)
  const estimatedOffsetHours = isLikelyDST ? 4 : 5
  
  // Adjust UTC time by adding the offset (since we want UTC that represents this time in timezone)
  baseUTC = new Date(baseUTC.getTime() + estimatedOffsetHours * 60 * 60 * 1000)
  
  // Now fine-tune by checking if formatting matches
  // Try a range around the estimated time
  for (let adjust = -3; adjust <= 3; adjust++) {
    const testUTC = new Date(baseUTC.getTime() + adjust * 60 * 60 * 1000)
    const formatted = formatter.format(testUTC)
    
    // Parse formatted string: "MM/DD/YYYY, HH:mm"
    const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/)
    if (match) {
      const [, m, d, y, h, min] = match.map(Number)
      if (m === month && d === day && y === year && h === hour && min === minute) {
        return testUTC.toISOString()
      }
    }
  }
  
  // If no match found, try a wider range (for edge cases)
  for (let adjust = -12; adjust <= 12; adjust++) {
    const testUTC = new Date(baseUTC.getTime() + adjust * 60 * 60 * 1000)
    const formatted = formatter.format(testUTC)
    const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/)
    if (match) {
      const [, m, d, y, h, min] = match.map(Number)
      if (m === month && d === day && y === year && h === hour && min === minute) {
        return testUTC.toISOString()
      }
    }
  }
  
  // Fallback: return the estimated UTC (should rarely reach here)
  return baseUTC.toISOString()
}

export default function AppointmentDetailModal({ 
  appointmentId, 
  isOpen, 
  onClose, 
  onStatusChange,
  onSmsSent
}: AppointmentDetailModalProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [newDateTime, setNewDateTime] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Enhanced modal state
  const [showCommunication, setShowCommunication] = useState(false)
  const [doctorStatus, setDoctorStatus] = useState(true)
  const [smartAlerts, setSmartAlerts] = useState<string[]>(['ID Verified'])
  
  // eRx state
  const [rxData, setRxData] = useState({
    medication: '',
    sig: '',
    qty: '',
    refills: '0',
    notes: ''
  })
  const [rxHistory, setRxHistory] = useState<any[]>([])
  const [rxList, setRxList] = useState<Array<{
    id: string
    db_id?: string
    medication: string
    sig: string
    qty: string
    refills: string
    notes: string
  }>>([])
  const [showRxHistory, setShowRxHistory] = useState(false)
  const [sendingRx, setSendingRx] = useState(false)
  const [addingRx, setAddingRx] = useState(false)
  const [recipientAddress, setRecipientAddress] = useState('') // Direct messaging address for pharmacy/provider
  
  // Doctor notes state
  const [doctorNotes, setDoctorNotes] = useState('')
  
  // SOAP notes state
  const [activeTab, setActiveTab] = useState<'SOAP' | 'Orders' | 'Files' | 'Notes' | 'Billing' | 'Audit'>('SOAP')
  const [soapNotes, setSoapNotes] = useState({
    chiefComplaint: '',
    rosGeneral: '',
    assessmentPlan: ''
  })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [soapSaveStatus, setSoapSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const soapNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoadRef = useRef(true)
  
  // CDSS state
  const [cdssResponse, setCdssResponse] = useState<any>(null)
  const [isGeneratingCDSS, setIsGeneratingCDSS] = useState(false)
  const [showCDSSResults, setShowCDSSResults] = useState(false)
  const [isApplyingCDSS, setIsApplyingCDSS] = useState(false)
  const [appointmentDocuments, setAppointmentDocuments] = useState<any[]>([])
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null)
  
  // Billing state
  const [paymentRecords, setPaymentRecords] = useState<any[]>([])
  const [loadingBilling, setLoadingBilling] = useState(false)
  
  // Problems & Medications state
  const [activeProblems, setActiveProblems] = useState<Array<{id: string, problem: string, since: string}>>([])
  const [resolvedProblems, setResolvedProblems] = useState<Array<{id: string, problem: string, resolvedDate: string}>>([])
  const [medicationHistory, setMedicationHistory] = useState<Array<{id: string, medication: string, provider: string, date: string}>>([])
  const [activeMedOrders, setActiveMedOrders] = useState<Array<{id: string, medication: string, sig: string, status: string}>>([])
  const [pastMedOrders, setPastMedOrders] = useState<Array<{id: string, medication: string, sig: string, date: string}>>([])
  const [prescriptionLogs, setPrescriptionLogs] = useState<Array<{id: string, date: string, medication: string, quantity: string, pharmacy: string, status: string}>>([])
  
  // Form states for adding new items
  const [newActiveProblem, setNewActiveProblem] = useState({problem: '', since: ''})
  const [newResolvedProblem, setNewResolvedProblem] = useState({problem: '', resolvedDate: ''})
  const [newMedHistory, setNewMedHistory] = useState({medication: '', provider: '', date: ''})
  const [newPrescriptionLog, setNewPrescriptionLog] = useState({medication: '', quantity: '', pharmacy: '', date: ''})
  const [savingProblems, setSavingProblems] = useState(false)
  
  // Recording status message (moved to ZoomMeetingEmbed component)
  
  // Voice recording state for doctor notes
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [audioLevels, setAudioLevels] = useState<number[]>([])
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('prompt')
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('default')
  const [showMicSelector, setShowMicSelector] = useState(false)
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null)
  const [audioDownloadUrl, setAudioDownloadUrl] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const isRecordingRef = useRef(false)
  
  // Communication state
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
  
  // Twilio Device
  const twilioDeviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const callDurationRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  
  // Communication History state
  const [communicationHistory, setCommunicationHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})
  
  // Customization state
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [leftPanelSections, setLeftPanelSections] = useState<string[]>([])
  const [rightPanelSections, setRightPanelSections] = useState<string[]>([])
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [dragOverPanel, setDragOverPanel] = useState<'left' | 'right' | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null)
  
  // Default section order - split between left and right panels
  const defaultLeftPanel = [
    'patient-header',
    'erx-composer',
    'medical-records',
    'sms-section',
    'call-section',
    'problems-medications'
  ]
  const defaultRightPanel = [
    'doctor-notes',
    'meeting-info',
    'communication-history'
  ]

  // Load saved layout from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedLayout = localStorage.getItem('appointment-modal-layout')
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout)
          if (parsed.left && parsed.right) {
            // Ensure required sections are available (add if missing)
            let leftSections = parsed.left || []
            let rightSections = parsed.right || []
            
            // If patient-header is not in either panel, add it to left panel at the beginning
            if (!leftSections.includes('patient-header') && !rightSections.includes('patient-header')) {
              leftSections = ['patient-header', ...leftSections]
            }
            
            // If communication-history is not in either panel, add it to right panel
            if (!leftSections.includes('communication-history') && !rightSections.includes('communication-history')) {
              rightSections = [...rightSections, 'communication-history']
            }
            
            // If problems-medications is not in either panel, add it to left panel
            if (!leftSections.includes('problems-medications') && !rightSections.includes('problems-medications')) {
              leftSections = [...leftSections, 'problems-medications']
            }
            
            setLeftPanelSections(leftSections)
            setRightPanelSections(rightSections)
          } else {
            // Legacy format - migrate to new format
            setLeftPanelSections(defaultLeftPanel)
            setRightPanelSections(defaultRightPanel)
          }
        } catch (e) {
          console.error('Error parsing saved layout:', e)
          setLeftPanelSections(defaultLeftPanel)
          setRightPanelSections(defaultRightPanel)
        }
      } else {
        setLeftPanelSections(defaultLeftPanel)
        setRightPanelSections(defaultRightPanel)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && appointmentId) {
      // Reset list when opening new appointment
      setRxList([])
      // Reset SMS and call fields
      setSmsTo('')
      setCallPhoneNumber('')
      setSmsMessage('')
      // Reset recipient address
      setRecipientAddress('')
      fetchAppointmentDetails().then(() => {
        // Fetch prescriptions after appointment is loaded
        fetchPrescriptionHistory()
      })
      fetchCurrentUser()
      fetchAppointmentMessages()
      setupMessagesSubscription()
      
      // Check microphone permission when modal opens
      checkMicPermission()
      loadAvailableMicrophones()
    } else {
      // Clear list when modal closes
      setRxList([])
      // Clear SMS and call fields
      setSmsTo('')
      setCallPhoneNumber('')
      setSmsMessage('')
      // Clear recipient address
      setRecipientAddress('')
    }
    
    // Cleanup subscription when modal closes
    return () => {
      if (messagesSubscriptionRef.current) {
        messagesSubscriptionRef.current.unsubscribe()
        messagesSubscriptionRef.current = null
      }
      
      // Cleanup Twilio device
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
      
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause()
        remoteAudioRef.current.srcObject = null
        remoteAudioRef.current = null
      }
    }
  }, [isOpen, appointmentId])

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchAppointmentDetails = async () => {
    if (!appointmentId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors!appointments_doctor_id_fkey(first_name, last_name, specialty, timezone)
        `)
        .eq('id', appointmentId)
        .single()

      if (error) {
        throw error
      }

      console.log('✅ Fetched appointment data:', data)
      console.log('Patient name:', data?.patient_first_name, data?.patient_last_name)
      console.log('Patient email:', data?.patient_email)
      console.log('Patient phone:', data?.patient_phone)
      if (data.requested_date_time) {
        // Format appointment time in doctor's timezone (New York) for the datetime input
        const doctorTimezone = data.doctors?.timezone || 'America/New_York'
        const formattedDate = formatDateForDateTimeLocal(data.requested_date_time, doctorTimezone)
        setNewDateTime(formattedDate)
      }
      
      // Load doctor notes from database
      if (data.notes) {
        setDoctorNotes(data.notes)
      }
      
      // Load SOAP notes from database
      // Set initial load flag to prevent auto-save on load
      isInitialLoadRef.current = true
      setSoapNotes({
        chiefComplaint: data.chief_complaint || data.subjective_notes || '',
        rosGeneral: data.ros_general || '',
        assessmentPlan: data.assessment_notes && data.plan_notes 
          ? `${data.assessment_notes}\n\n${data.plan_notes}`
          : data.assessment_notes || data.plan_notes || ''
      })
      // Reset flag after a short delay to allow auto-save on subsequent changes
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 500)
      
      setAppointment(data)
      
      // Check for existing CDSS response and auto-generate if needed
      if (data.chief_complaint || data.subjective_notes || data.notes) {
        await checkAndLoadCDSS(appointmentId, data)
      }
      
      // Set phone number for SMS and call (auto-populate from patient)
      setSmsTo(data.patient_phone || '')
      setCallPhoneNumber(data.patient_phone || '')
      
      // Load appointment documents
      fetchAppointmentDocuments()
      
      // Load billing/payment records
      fetchBillingInformation()
      
      // Initialize Twilio device
      initializeTwilioDevice()
      
      // Fetch communication history for this patient
      if (data.patient_phone) {
        fetchCommunicationHistory(data.patient_phone)
      }
      
      // Load Problems & Medications from database
      if (data.active_problems) {
        try {
          const parsed = typeof data.active_problems === 'string' ? JSON.parse(data.active_problems) : data.active_problems
          if (Array.isArray(parsed)) {
            setActiveProblems(parsed.map((p, idx) => ({id: p.id || `ap-${idx}`, problem: p.problem || p, since: p.since || ''})))
          } else if (typeof parsed === 'string') {
            // Legacy format - single string, convert to array
            setActiveProblems([{id: 'ap-0', problem: parsed, since: ''}])
          }
        } catch (e) {
          // If it's a plain string, convert to array format
          setActiveProblems([{id: 'ap-0', problem: data.active_problems, since: ''}])
        }
      }
      
      if (data.resolved_problems) {
        try {
          const parsed = Array.isArray(data.resolved_problems) ? data.resolved_problems : JSON.parse(data.resolved_problems || '[]')
          setResolvedProblems(parsed.map((p: any, idx: number) => ({id: p.id || `rp-${idx}`, problem: p.problem || p, resolvedDate: p.resolvedDate || p.date || ''})))
        } catch (e) {
          setResolvedProblems([])
        }
      }
      
      if (data.medication_history) {
        try {
          const parsed = Array.isArray(data.medication_history) ? data.medication_history : JSON.parse(data.medication_history || '[]')
          setMedicationHistory(parsed.map((m: any, idx: number) => ({id: m.id || `mh-${idx}`, medication: m.medication || m, provider: m.provider || 'External Provider', date: m.date || ''})))
        } catch (e) {
          setMedicationHistory([])
        }
      }
      
      if (data.active_medication_orders) {
        try {
          const parsed = Array.isArray(data.active_medication_orders) ? data.active_medication_orders : JSON.parse(data.active_medication_orders || '[]')
          setActiveMedOrders(parsed.map((m: any, idx: number) => ({id: m.id || `amo-${idx}`, medication: m.medication || m, sig: m.sig || '', status: m.status || 'Sent'})))
        } catch (e) {
          setActiveMedOrders([])
        }
      }
      
      if (data.past_medication_orders) {
        try {
          const parsed = Array.isArray(data.past_medication_orders) ? data.past_medication_orders : JSON.parse(data.past_medication_orders || '[]')
          setPastMedOrders(parsed.map((m: any, idx: number) => ({id: m.id || `pmo-${idx}`, medication: m.medication || m, sig: m.sig || '', date: m.date || ''})))
        } catch (e) {
          setPastMedOrders([])
        }
      }
      
      if (data.prescription_logs) {
        try {
          const parsed = Array.isArray(data.prescription_logs) ? data.prescription_logs : JSON.parse(data.prescription_logs || '[]')
          setPrescriptionLogs(parsed.map((p: any, idx: number) => ({id: p.id || `pl-${idx}`, date: p.date || '', medication: p.medication || p, quantity: p.quantity || '', pharmacy: p.pharmacy || '', status: p.status || 'Sent'})))
        } catch (e) {
          setPrescriptionLogs([])
        }
      }
      
      
      // Recording information is now handled by ZoomMeetingEmbed component
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAppointmentAction = async (action: 'accept' | 'reject' | 'complete') => {
    if (!appointmentId) return

    setActionLoading(action)

    try {
      if (action === 'complete') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)

        if (error) throw error
      } else {
        const response = await fetch(`/api/appointments/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Action failed')
        }
      }

      onStatusChange()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReschedule = async () => {
    if (!appointmentId || !newDateTime) {
      setError('Please select a new date and time')
      return
    }

    setRescheduleLoading(true)
    setError(null)

    try {
      // Convert the datetime-local value (treated as New York time) to UTC
      const doctorTimezone = appointment?.doctors?.timezone || 'America/New_York'
      const utcDateTime = convertDateTimeLocalToUTC(newDateTime, doctorTimezone)
      
      const response = await fetch('/api/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId, 
          newDateTime: utcDateTime
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reschedule appointment')
      }

      const data = await response.json()
      console.log('✅ Appointment rescheduled successfully:', data)

      // Refresh appointment details
      await fetchAppointmentDetails()

      setShowRescheduleForm(false)
      setNewDateTime('')
      setSmartAlerts(prev => [...prev, 'Appointment rescheduled'])
      onStatusChange()
    } catch (err: any) {
      console.error('❌ Error rescheduling appointment:', err)
      setError(err.message || 'Failed to reschedule appointment')
    } finally {
      setRescheduleLoading(false)
    }
  }


  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const doctorTimezone = appointment?.doctors?.timezone || 'America/New_York'
    const appointmentDate = convertToTimezone(dateString, doctorTimezone)
    return appointmentDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const fetchPrescriptionHistory = async () => {
    // Use appointmentId if available (it's a prop, always available when dialog is open)
    const targetAppointmentId = appointmentId
    
    if (!targetAppointmentId) {
      console.log('No appointmentId available for fetching prescriptions')
      return
    }
    
    try {
      // Query Supabase directly for better reliability - only by appointment_id
      let query = supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .eq('appointment_id', targetAppointmentId)
      
      const { data: prescriptions, error } = await query
      
      if (error) {
        console.error('Error fetching prescriptions from Supabase:', error)
        setError(`Failed to fetch prescriptions: ${error.message}`)
        return
      }
      
      if (!prescriptions || prescriptions.length === 0) {
        console.log(`No prescriptions found for appointment ${targetAppointmentId}`)
        setRxHistory([])
        setRxList([])
        return
      }
      
      console.log(`✅ Fetched ${prescriptions.length} prescriptions from Supabase for appointment ${targetAppointmentId}`)
      
      // Separate sent prescriptions (history) from pending ones (draft list)
      const sentPrescriptions = prescriptions.filter((rx: any) => rx.status === 'sent' || rx.status === 'filled')
      const pendingPrescriptions = prescriptions.filter((rx: any) => rx.status === 'pending')
      
      setRxHistory(sentPrescriptions)
      
      // Load sent prescriptions into active medication orders
      const activeOrders = sentPrescriptions.map((rx: any) => ({
        id: rx.id,
        medication: rx.medication || '',
        sig: rx.sig || '',
        status: rx.status === 'filled' ? 'Filled' : 'Sent'
      }))
      setActiveMedOrders(prev => {
        // Merge with existing, avoiding duplicates
        const existingIds = new Set(prev.map(o => o.id))
        const newOrders = activeOrders.filter(o => !existingIds.has(o.id))
        return [...prev, ...newOrders]
      })
      
      // Load into prescription logs
      const logs = sentPrescriptions.map((rx: any) => ({
        id: rx.id,
        date: rx.sent_at ? new Date(rx.sent_at).toISOString().split('T')[0] : new Date(rx.created_at).toISOString().split('T')[0],
        medication: rx.medication || '',
        quantity: rx.quantity || '',
        pharmacy: rx.pharmacy_name || 'N/A',
        status: rx.status === 'filled' ? 'Filled' : 'Sent'
      }))
      setPrescriptionLogs(prev => {
        const existingIds = new Set(prev.map(l => l.id))
        const newLogs = logs.filter(l => !existingIds.has(l.id))
        return [...prev, ...newLogs]
      })
      
      // Always load pending prescriptions into the list when dialog opens
      // Format them exactly as they appear when added manually
      if (pendingPrescriptions.length > 0) {
        const formattedPrescriptions = pendingPrescriptions.map((rx: any) => ({
          id: rx.id,
          db_id: rx.id,
          medication: rx.medication || '',
          sig: rx.sig || '',
          qty: rx.quantity || '',
          refills: rx.refills?.toString() || '0',
          notes: rx.notes || ''
        }))
        console.log(`✅ Loading ${formattedPrescriptions.length} pending prescriptions into list:`, formattedPrescriptions)
        setRxList(formattedPrescriptions)
      } else {
        // Clear list if no pending prescriptions (to avoid stale data)
        console.log('No pending prescriptions found, clearing list')
        setRxList([])
      }
    } catch (error: any) {
      console.error('Error fetching prescription history:', error)
      setError(`Failed to fetch prescriptions: ${error.message}`)
    }
  }

  const handleAddToRxList = async () => {
    if (!rxData.medication || !rxData.sig || !rxData.qty) {
      setError('Please fill in medication, dosage (sig), and quantity')
      return
    }

    if (!appointment?.id) {
      setError('Appointment information not available')
      return
    }

    setAddingRx(true)
    setError(null)

    try {
      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Get patient ID from appointment
      if (!appointment?.user_id) {
        throw new Error('Patient ID not found in appointment')
      }

      // Save to database immediately with "pending" status
      const response = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({
          appointmentId: appointment?.id,
          patientId: appointment.user_id, // Use user_id from appointment
          medication: rxData.medication,
          sig: rxData.sig,
          quantity: rxData.qty,
          refills: parseInt(rxData.refills) || 0,
          notes: rxData.notes || null,
          pharmacyName: appointment?.preferred_pharmacy || null,
          pharmacyAddress: null,
          pharmacyPhone: null,
          status: 'pending' // Save as draft/pending
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save prescription')
      }

      const data = await response.json()
      const savedPrescription = data.prescription

      // Add to local list with database ID
      const newRx = {
        id: savedPrescription.id,
        db_id: savedPrescription.id,
        medication: rxData.medication,
        sig: rxData.sig,
        qty: rxData.qty,
        refills: rxData.refills,
        notes: rxData.notes
      }

      setRxList(prev => [...prev, newRx])
      
      // Reset form for next medication
      setRxData({
        medication: '',
        sig: '',
        qty: '',
        refills: '0',
        notes: ''
      })
      
      console.log('✅ Prescription added to list and saved to database:', savedPrescription.id)
      
    } catch (error: any) {
      console.error('Error adding prescription:', error)
      setError(error.message || 'Failed to add prescription')
    } finally {
      setAddingRx(false)
    }
  }

  const handleRemoveFromRxList = async (id: string, dbId?: string) => {
    // If it has a database ID, delete from database
    if (dbId) {
      try {
        // Get access token for authentication
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        const response = await fetch(`/api/prescriptions?prescriptionId=${dbId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include'
        })

        if (!response.ok) {
          console.error('Failed to delete prescription from database')
          // Still remove from UI even if DB delete fails
        } else {
          console.log('✅ Prescription removed from database:', dbId)
        }
      } catch (error) {
        console.error('Error deleting prescription:', error)
        // Still remove from UI even if DB delete fails
      }
    }

    // Remove from local list
    setRxList(prev => prev.filter(rx => rx.id !== id))
  }

  const handleClearRxList = async () => {
    // Delete all pending prescriptions from database
    const dbIds = rxList.filter(rx => rx.db_id).map(rx => rx.db_id!)
    
    if (dbIds.length > 0) {
      try {
        // Get access token for authentication
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        await Promise.all(
          dbIds.map(dbId =>
            fetch(`/api/prescriptions?prescriptionId=${dbId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': accessToken ? `Bearer ${accessToken}` : '',
              },
              credentials: 'include'
            })
          )
        )
        console.log('✅ All prescriptions removed from database')
      } catch (error) {
        console.error('Error clearing prescriptions:', error)
      }
    }

    setRxList([])
  }

  // Enhanced functionality methods
  const handleSendERx = async () => {
    if (!appointment?.id) {
      setError('Appointment information not available')
      return
    }

    // Validate recipient address
    if (!recipientAddress || !recipientAddress.trim()) {
      setError('Please enter a recipient Direct messaging address (e.g., pharmacy@example.direct.com)')
      return
    }

    // Validate Direct address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientAddress.trim())) {
      setError('Invalid Direct address format. Must be in format: user@domain.com')
      return
    }

    // If there's a list, send all medications in the list
    const medicationsToSend = rxList.length > 0 ? rxList : [
      { 
        id: 'single',
        medication: rxData.medication,
        sig: rxData.sig,
        qty: rxData.qty,
        refills: rxData.refills,
        notes: rxData.notes
      }
    ]

    // Validate if sending single medication without list
    if (rxList.length === 0) {
      if (!rxData.medication || !rxData.sig || !rxData.qty) {
        setError('Please fill in medication, dosage (sig), and quantity, or add to list first')
        return
      }
    }

    if (medicationsToSend.length === 0) {
      setError('No medications to send')
      return
    }

    setSendingRx(true)
    setError(null)

    try {
      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // First, ensure all medications are saved to database
      const prescriptionIds: string[] = []
      
      for (const rx of medicationsToSend) {
        if (rx.db_id) {
          // Already saved, use existing ID
          prescriptionIds.push(rx.db_id)
        } else {
          // Create new prescription with "pending" status first
          if (!appointment?.user_id) {
            throw new Error('Patient ID not found in appointment')
          }

          const createResponse = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            },
            credentials: 'include',
            body: JSON.stringify({
              appointmentId: appointment?.id,
              patientId: appointment.user_id,
              medication: rx.medication,
              sig: rx.sig,
              quantity: rx.qty,
              refills: parseInt(rx.refills) || 0,
              notes: rx.notes || null,
              pharmacyName: appointment?.preferred_pharmacy || null,
              pharmacyAddress: null,
              pharmacyPhone: null,
              status: 'pending'
            })
          })

          if (!createResponse.ok) {
            const errorData = await createResponse.json()
            throw new Error(errorData.error || 'Failed to create prescription')
          }

          const createData = await createResponse.json()
          prescriptionIds.push(createData.prescription.id)
        }
      }

      // Now send via eRx Composer API
      // Send each prescription separately via EMRDirect
      const sendPromises = prescriptionIds.map(async (prescriptionId) => {
        const response = await fetch('/api/prescriptions/erx-compose', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          credentials: 'include',
          body: JSON.stringify({
            prescriptionId: prescriptionId,
            recipientAddress: recipientAddress.trim()
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to send prescription via EMRDirect')
        }

        return response.json()
      })

      const results = await Promise.all(sendPromises)
      const failed = results.filter(r => !r.success)

      if (failed.length > 0) {
        const errorMessages = failed.map(r => r.error || 'Unknown error').join('; ')
        throw new Error(`${failed.length} prescription(s) failed to send: ${errorMessages}`)
      }

      console.log(`✅ ${medicationsToSend.length} prescription(s) sent successfully via EMRDirect`)
      
      setSmartAlerts(prev => [...prev, `${medicationsToSend.length} eRx sent via EMRDirect`])
      
      // Add to active medication orders
      const newOrders = medicationsToSend.map(rx => ({
        id: `amo-${Date.now()}-${Math.random()}`,
        medication: rx.medication,
        sig: rx.sig,
        status: 'Sent'
      }))
      setActiveMedOrders(prev => [...prev, ...newOrders])
      
      // Add to prescription logs
      const newLogs = medicationsToSend.map(rx => ({
        id: `pl-${Date.now()}-${Math.random()}`,
        date: new Date().toISOString().split('T')[0],
        medication: rx.medication,
        quantity: rx.qty,
        pharmacy: appointment?.preferred_pharmacy || recipientAddress.trim(),
        status: 'Sent'
      }))
      setPrescriptionLogs(prev => [...prev, ...newLogs])
      
      // Save to database
      await saveProblemsAndMedications()
      
      // Reset form and list
      setRxData({
        medication: '',
        sig: '',
        qty: '',
        refills: '0',
        notes: ''
      })
      setRxList([])
      
      // Refresh prescription history
      await fetchPrescriptionHistory()
      
    } catch (error: any) {
      console.error('Error sending eRx:', error)
      setError(error.message || 'Failed to send prescription')
    } finally {
      setSendingRx(false)
    }
  }

  // Debounce timer ref for auto-save
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Save doctor notes to Supabase
  const handleSaveDoctorNotes = useCallback(async (notes: string) => {
    if (!appointmentId) return

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ notes: notes || null })
        .eq('id', appointmentId)

      if (error) {
        console.error('Error saving doctor notes:', error)
        setError('Failed to save doctor notes')
      } else {
        // Update local appointment state
        setAppointment(prev => prev ? { ...prev, notes } : null)
      }
    } catch (err) {
      console.error('Error saving doctor notes:', err)
      setError('Failed to save doctor notes')
    }
  }, [appointmentId])

  // Fetch appointment documents
  const fetchAppointmentDocuments = async () => {
    if (!appointmentId) return
    
    try {
      const { data, error } = await supabase
        .from('appointment_documents')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Convert file paths to signed URLs for private buckets
      const documentsWithSignedUrls = await Promise.all(
        (data || []).map(async (doc) => {
          // If file_url is already a full URL (legacy), check if it needs conversion
          if (doc.file_url && (doc.file_url.startsWith('http://') || doc.file_url.startsWith('https://'))) {
            // If it's a Supabase URL but might be broken, try to extract the path
            // Supabase URLs typically look like: https://project.supabase.co/storage/v1/object/public/bucket/path
            const urlMatch = doc.file_url.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
            if (urlMatch) {
              // Extract the path and create a signed URL
              const filePath = decodeURIComponent(urlMatch[1]) // Decode URL encoding
              const { data: urlData, error: urlError } = await supabase.storage
                .from('appointment-documents')
                .createSignedUrl(filePath, 3600) // 1 hour expiry
              
              if (urlError) {
                console.error('Error creating signed URL from legacy URL:', urlError)
                // Try the raw path as fallback
                return doc
              }
              
              if (urlData?.signedUrl) {
                return { ...doc, file_url: urlData.signedUrl }
              }
            }
            // If URL extraction fails, return original (might be external URL)
            return doc
          }
          
          // If file_url is a storage path (new format), create signed URL
          if (doc.file_url && !doc.file_url.startsWith('http')) {
            const { data: urlData, error: urlError } = await supabase.storage
              .from('appointment-documents')
              .createSignedUrl(doc.file_url, 3600) // 1 hour expiry
            
            if (urlError) {
              console.error('Error creating signed URL:', urlError)
              return doc
            }
            
            if (urlData?.signedUrl) {
              return { ...doc, file_url: urlData.signedUrl }
            }
          }
          
          return doc
        })
      )
      
      setAppointmentDocuments(documentsWithSignedUrls)
    } catch (err: any) {
      console.error('Error fetching documents:', err)
    }
  }

  // Fetch billing/payment information for this appointment
  const fetchBillingInformation = async () => {
    if (!appointmentId) return
    
    try {
      setLoadingBilling(true)
      
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching payment records:', error)
        return
      }
      
      setPaymentRecords(data || [])
    } catch (err: any) {
      console.error('Error fetching billing information:', err)
    } finally {
      setLoadingBilling(false)
    }
  }

  // Auto-save SOAP notes to database
  const autoSaveSoapNotes = useCallback(async () => {
    if (!appointmentId || appointment?.is_locked || isInitialLoadRef.current) {
      return
    }
    
    setSoapSaveStatus('saving')
    
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          chief_complaint: soapNotes.chiefComplaint || null,
          ros_general: soapNotes.rosGeneral || null,
          subjective_notes: soapNotes.chiefComplaint || null,
          assessment_notes: soapNotes.assessmentPlan.split('\n\n')[0] || null,
          plan_notes: soapNotes.assessmentPlan.split('\n\n').slice(1).join('\n\n') || soapNotes.assessmentPlan || null
        })
        .eq('id', appointmentId)
      
      if (error) throw error
      
      setSoapSaveStatus('saved')
      setAppointment(prev => prev ? {
        ...prev,
        chief_complaint: soapNotes.chiefComplaint,
        ros_general: soapNotes.rosGeneral
      } : null)
      
      // Reset status to idle after 2 seconds
      setTimeout(() => {
        setSoapSaveStatus('idle')
      }, 2000)
    } catch (err: any) {
      console.error('Error auto-saving SOAP notes:', err)
      setSoapSaveStatus('idle')
      // Don't show error to user for auto-save failures, just log it
    }
  }, [appointmentId, appointment?.is_locked, soapNotes])

  // Debounced auto-save effect
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoadRef.current) {
      return
    }

    // Don't auto-save if appointment is locked or no appointment ID
    if (!appointmentId || appointment?.is_locked) {
      return
    }

    // Clear existing timeout
    if (soapNotesTimeoutRef.current) {
      clearTimeout(soapNotesTimeoutRef.current)
    }

    // Set new timeout for auto-save (1 second after user stops typing)
    soapNotesTimeoutRef.current = setTimeout(() => {
      autoSaveSoapNotes()
    }, 1000)

    // Cleanup timeout on unmount
    return () => {
      if (soapNotesTimeoutRef.current) {
        clearTimeout(soapNotesTimeoutRef.current)
      }
    }
  }, [soapNotes.chiefComplaint, soapNotes.rosGeneral, soapNotes.assessmentPlan, appointmentId, appointment?.is_locked, autoSaveSoapNotes])

  // Sign & Lock notes
  const handleSignAndLock = async () => {
    if (!appointmentId || !currentUser) return
    
    setIsSigning(true)
    setError(null)
    
    try {
      // Get doctor ID
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', currentUser.email)
        .single()
      
      if (!doctorData) {
        throw new Error('Doctor not found')
      }
      
      // Save notes and lock
      const { error } = await supabase
        .from('appointments')
        .update({
          chief_complaint: soapNotes.chiefComplaint || null,
          ros_general: soapNotes.rosGeneral || null,
          subjective_notes: soapNotes.chiefComplaint || null,
          assessment_notes: soapNotes.assessmentPlan.split('\n\n')[0] || null,
          plan_notes: soapNotes.assessmentPlan.split('\n\n').slice(1).join('\n\n') || soapNotes.assessmentPlan || null,
          signed_at: new Date().toISOString(),
          signed_by: doctorData.id,
          is_locked: true
        })
        .eq('id', appointmentId)
      
      if (error) throw error
      
      setSmartAlerts(prev => [...prev, 'Notes signed and locked'])
      setAppointment(prev => prev ? {
        ...prev,
        chief_complaint: soapNotes.chiefComplaint,
        ros_general: soapNotes.rosGeneral,
        signed_at: new Date().toISOString(),
        signed_by: doctorData.id,
        is_locked: true
      } : null)
      
      // Refresh appointment details
      await fetchAppointmentDetails()
    } catch (err: any) {
      console.error('Error signing notes:', err)
      setError('Failed to sign and lock notes')
    } finally {
      setIsSigning(false)
    }
  }

  // Check for existing CDSS response and auto-generate if needed
  const checkAndLoadCDSS = async (apptId: string, apptData?: any) => {
    try {
      const appointmentData = apptData || appointment
      
      // Check if CDSS has already been auto-generated for this appointment
      if (appointmentData?.cdss_auto_generated) {
        console.log('✅ CDSS already auto-generated, checking for existing response...')
        
        // Check if CDSS response exists in database
        const { data: existingCDSS, error: cdssError } = await supabase
          .from('cdss_responses')
          .select('*')
          .eq('appointment_id', apptId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingCDSS && !cdssError && existingCDSS.response_data) {
          // Load existing CDSS response
          setCdssResponse(existingCDSS.response_data)
          setShowCDSSResults(true)
          console.log('✅ Loaded existing CDSS response')
        }
        return // Don't auto-generate if flag is already set
      }

      // Check if CDSS response exists in database
      const { data: existingCDSS, error: cdssError } = await supabase
        .from('cdss_responses')
        .select('*')
        .eq('appointment_id', apptId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingCDSS && !cdssError && existingCDSS.response_data) {
        // Load existing CDSS response and mark as auto-generated
        setCdssResponse(existingCDSS.response_data)
        setShowCDSSResults(true)
        
        // Update flag to prevent future auto-generation
        await supabase
          .from('appointments')
          .update({ cdss_auto_generated: true })
          .eq('id', apptId)
        
        console.log('✅ Loaded existing CDSS response')
        return
      }

      // Auto-generate CDSS if it doesn't exist, flag is not set, and appointment has required data
      if (appointmentData && (appointmentData.chief_complaint || appointmentData.subjective_notes || appointmentData.notes)) {
        console.log('🔄 Auto-generating CDSS response (first time)...')
        await generateCDSSResponse(apptId, true) // Pass true to indicate auto-generation
      }
    } catch (error: any) {
      console.error('Error checking CDSS:', error)
      // Don't show error to user, just log it
    }
  }

  // Generate CDSS response
  const generateCDSSResponse = async (apptId: string, isAutoGenerate: boolean = false) => {
    setIsGeneratingCDSS(true)
    setError(null)

    try {
      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const response = await fetch('/api/cdss/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({ appointmentId: apptId, isAutoGenerate })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to generate CDSS response')
      }

      const data = await response.json()
      setCdssResponse(data)
      setShowCDSSResults(true)
      
      if (isAutoGenerate) {
        // Mark as auto-generated in database
        await supabase
          .from('appointments')
          .update({ cdss_auto_generated: true })
          .eq('id', apptId)
        console.log('✅ CDSS auto-generated and flag set')
      } else {
        setSmartAlerts(prev => [...prev, 'CDSS analysis generated'])
      }
    } catch (err: any) {
      console.error('Error generating CDSS:', err)
      setError(err.message || 'Failed to generate CDSS response')
    } finally {
      setIsGeneratingCDSS(false)
    }
  }

  // Manual CDSS generation (when user clicks button)
  const handleGenerateCDSS = async () => {
    if (!appointmentId) return
    await generateCDSSResponse(appointmentId, false) // Manual generation, don't set auto flag
  }

  // Apply CDSS suggestions to SOAP notes
  const handleApplyCDSS = async () => {
    if (!cdssResponse || !appointment) return

    setIsApplyingCDSS(true)
    setError(null)

    try {
      // Apply to SOAP notes
      setSoapNotes(prev => ({
        chiefComplaint: cdssResponse.soap_note?.chief_complaint || prev.chiefComplaint,
        rosGeneral: cdssResponse.soap_note?.ros || cdssResponse.templates?.ros_general || prev.rosGeneral,
        assessmentPlan: `${cdssResponse.soap_note?.assessment || cdssResponse.templates?.assessment || ''}\n\n${cdssResponse.soap_note?.plan || cdssResponse.templates?.plan || ''}`.trim() || prev.assessmentPlan
      }))

      // Save medication suggestions to database and add to eRx list
      if (cdssResponse.medication_suggestions?.classes && cdssResponse.medication_suggestions.classes.length > 0) {
        // Get access token for authentication
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!appointment?.user_id) {
          throw new Error('Patient ID not found in appointment')
        }

        // Check for existing medications to avoid duplicates
        const existingMedications = rxList.map(rx => rx.medication.toLowerCase())

        // Save each medication suggestion to database
        const savedMedications: Array<{
          id: string
          db_id: string
          medication: string
          sig: string
          qty: string
          refills: string
          notes: string
        }> = []
        for (let index = 0; index < cdssResponse.medication_suggestions.classes.length; index++) {
          const medClass = cdssResponse.medication_suggestions.classes[index]
          
          // Skip if already exists
          if (existingMedications.includes(medClass.toLowerCase())) {
            continue
          }

          try {
            const response = await fetch('/api/prescriptions', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': accessToken ? `Bearer ${accessToken}` : '',
              },
              credentials: 'include',
              body: JSON.stringify({
                appointmentId: appointment.id,
                patientId: appointment.user_id,
                medication: medClass, // Medication class name
                sig: 'As directed', // Default SIG - doctor can edit
                quantity: '30', // Default quantity - doctor can edit
                refills: 0, // Default refills - doctor can edit
                notes: cdssResponse.medication_suggestions.safety_notes?.[index] || null, // Add safety notes if available
                pharmacyName: appointment?.preferred_pharmacy || null,
                pharmacyAddress: null,
                pharmacyPhone: null,
                status: 'pending' // Save as draft/pending
              })
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
              console.error(`Failed to save medication ${medClass}:`, errorData)
              continue // Skip this medication but continue with others
            }

            const data = await response.json()
            const savedPrescription = data.prescription

            // Add to local list with database ID
            const newMed: {
              id: string
              db_id: string
              medication: string
              sig: string
              qty: string
              refills: string
              notes: string
            } = {
              id: savedPrescription.id,
              db_id: savedPrescription.id,
              medication: medClass,
              sig: 'As directed',
              qty: '30',
              refills: '0',
              notes: cdssResponse.medication_suggestions.safety_notes?.[index] || ''
            }
            savedMedications.push(newMed)
          } catch (error: any) {
            console.error(`Error saving medication ${medClass}:`, error)
            // Continue with other medications even if one fails
          }
        }

        // Add all saved medications to rxList
        if (savedMedications.length > 0) {
          setRxList(prev => [...prev, ...savedMedications])
          setSmartAlerts(prev => [...prev, `${savedMedications.length} medication(s) added from CDSS`])
        }
      }

      setSmartAlerts(prev => [...prev, 'CDSS suggestions applied to SOAP notes and eRx list'])
      setShowCDSSResults(false)
    } catch (error: any) {
      console.error('Error applying CDSS suggestions:', error)
      setError(error.message || 'Failed to apply CDSS suggestions')
    } finally {
      setIsApplyingCDSS(false)
    }
  }

  // Upload document
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !appointmentId || !currentUser) return
    
    setUploadingDocument(true)
    setError(null)
    
    try {
      // Get doctor ID
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id')
        .eq('email', currentUser.email)
        .single()
      
      if (!doctorData) {
        throw new Error('Doctor not found')
      }
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `appointment-documents/${appointmentId}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('appointment-documents')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      // Store the file path (not public URL) since bucket is private
      // We'll generate signed URLs when fetching
      
      // Save to database with file path
      const { error: dbError } = await supabase
        .from('appointment_documents')
        .insert({
          appointment_id: appointmentId,
          uploaded_by_id: doctorData.id,
          uploaded_by_type: 'doctor',
          document_name: file.name,
          document_type: file.type || 'application/octet-stream',
          file_url: filePath, // Store the path, not a broken public URL
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          is_shared: true
        })
      
      if (dbError) throw dbError
      
      // Refresh documents list
      await fetchAppointmentDocuments()
      setSmartAlerts(prev => [...prev, `Document "${file.name}" uploaded`])
      
      // Clear file input
      if (event.target) {
        event.target.value = ''
      }
    } catch (err: any) {
      console.error('Error uploading document:', err)
      setError(`Failed to upload document: ${err.message}`)
    } finally {
      setUploadingDocument(false)
    }
  }

  // Check microphone permissions
  const checkMicPermission = async () => {
    try {
      // Check if permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
        return result.state
      } else {
        // Fallback: try to access mic to check permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
          setMicPermission('granted')
          return 'granted'
        } catch (err: any) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setMicPermission('denied')
            return 'denied'
          }
          setMicPermission('prompt')
          return 'prompt'
        }
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error)
      setMicPermission('prompt')
      return 'prompt'
    }
  }

  // Load available microphones
  const loadAvailableMicrophones = async () => {
    try {
      // Request permission first to enumerate devices
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
      }).catch(() => {
        // Permission not granted yet, that's okay
      })

      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(device => device.kind === 'audioinput')
      
      if (mics.length > 0) {
        setAvailableMics(mics)
        
        // Auto-select default mic (first available mic or one with 'default' deviceId)
        const defaultMic = mics.find(mic => mic.deviceId === 'default') || mics[0]
        if (defaultMic) {
          setSelectedMicId(defaultMic.deviceId)
        }
      }
    } catch (error) {
      console.error('Error loading microphones:', error)
    }
  }

  // Request microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    setMicPermission('checking')
    try {
      // Request microphone access with permission prompt
      const constraints: MediaStreamConstraints = {
        audio: selectedMicId === 'default' ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          deviceId: { exact: selectedMicId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Immediately stop the stream since we just wanted to check/request permission
      stream.getTracks().forEach(track => track.stop())
      
      setMicPermission('granted')
      
      // Reload mics after permission granted
      await loadAvailableMicrophones()
      
      return true
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermission('denied')
        setError('Microphone permission denied. Please enable microphone access in your browser settings and try again.')
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone device.')
      } else {
        setError(`Failed to access microphone: ${error.message}`)
      }
      
      setMicPermission('denied')
      return false
    }
  }

  // Handle voice recording for doctor notes
  const handleStartRecording = async () => {
    try {
      // First check permission status
      const permission = await checkMicPermission()
      
      // If permission is denied, show error and return
      if (permission === 'denied') {
        setError('Microphone access is denied. Please enable microphone permissions in your browser settings (click the lock icon in the address bar) and refresh the page.')
        return
      }
      
      // If permission is not granted, request it
      if (permission !== 'granted') {
        const granted = await requestMicPermission()
        if (!granted) {
          return
        }
      }

      // Build audio constraints with selected microphone
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false, // Disable to ensure raw audio capture
        noiseSuppression: false, // Disable to ensure raw audio capture
        autoGainControl: true,
        sampleRate: 44100, // Standard sample rate
        channelCount: 1 // Mono
      }
      
      // If a specific mic is selected (not 'default'), use it
      if (selectedMicId !== 'default' && selectedMicId) {
        audioConstraints.deviceId = { exact: selectedMicId }
      }
      
      console.log('Requesting audio with constraints:', audioConstraints)
      
      // Request microphone access for recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints
      })
      
      // Reload mics in case new devices were added
      loadAvailableMicrophones()
      
      // Verify stream has audio tracks
      const audioTracks = stream.getAudioTracks()
      console.log('Audio stream obtained:', {
        trackCount: audioTracks.length,
        trackSettings: audioTracks[0]?.getSettings(),
        trackState: audioTracks[0]?.readyState,
        enabled: audioTracks[0]?.enabled,
        muted: audioTracks[0]?.muted
      })
      
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream')
      }
      
      // Ensure track is enabled and not muted
      audioTracks.forEach(track => {
        track.enabled = true
        console.log('Audio track state:', {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings()
        })
      })
      
      setAudioStream(stream)
      
      // Create AudioContext for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.1 // Lower value for more responsive visualization
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      source.connect(analyser)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      
      // Small delay to ensure audio context is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify audio is flowing through the analyser
      const testBuffer = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(testBuffer)
      const hasSignal = testBuffer.some(value => value > 0)
      console.log('Audio signal detected:', hasSignal)
      
      if (!hasSignal) {
        console.warn('No audio signal detected in analyser - microphone may not be working')
      }
      
      // Start visualization
      startVisualization(analyser)
      
      // Create MediaRecorder with proper mime type
      let options: MediaRecorderOptions = {}
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ]
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { mimeType }
          break
        }
      }
      
      const recorder = new MediaRecorder(stream, options)
      
      console.log('MediaRecorder created:', {
        state: recorder.state,
        mimeType: recorder.mimeType,
        audioBitsPerSecond: recorder.audioBitsPerSecond,
        videoBitsPerSecond: recorder.videoBitsPerSecond
      })

      recorder.ondataavailable = (event) => {
        console.log('Data available:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: Date.now()
        })
        
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
          console.log('✅ Chunk added. Total chunks:', recordingChunksRef.current.length, 'Total size:', 
            recordingChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes')
        } else {
          console.warn('⚠️ Received empty or zero-size data chunk')
        }
      }
      
      // Monitor recording state
      recorder.onstart = () => {
        console.log('Recording started')
      }
      
      recorder.onpause = () => {
        console.log('Recording paused')
      }
      
      recorder.onresume = () => {
        console.log('Recording resumed')
      }

      recorder.onstop = async () => {
        isRecordingRef.current = false
        
        // Stop visualization
        stopVisualization()
        
        // Stop audio stream
        stream.getTracks().forEach(track => track.stop())
        
        // Close audio context (only if not already closed)
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try {
            await audioContextRef.current.close()
          } catch (error) {
            console.warn('Error closing AudioContext:', error)
          }
          audioContextRef.current = null
        }
        
        const chunks = recordingChunksRef.current
        if (chunks.length > 0) {
          const mimeType = recorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(chunks, { type: mimeType })
          
          // Save audio blob for download
          setRecordedAudioBlob(audioBlob)
          const url = URL.createObjectURL(audioBlob)
          setAudioDownloadUrl(url)
          
          console.log('Audio recording saved:', {
            size: audioBlob.size,
            type: audioBlob.type,
            duration: chunks.length * 0.1 // approximate duration based on chunks
          })
          
          await handleTranscribeAudio(audioBlob)
        } else {
          setError('No audio data captured. Please try again.')
        }
        
        // Clear chunks for next recording
        recordingChunksRef.current = []
      }

      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        setError('Recording error occurred')
        handleStopRecording()
      }

      // Clear chunks array
      recordingChunksRef.current = []
      
      // Verify stream has active tracks
      const activeTracks = stream.getAudioTracks().filter(track => track.readyState === 'live')
      if (activeTracks.length === 0) {
        throw new Error('No active audio tracks found. Please check your microphone connection.')
      }
      
      console.log('Starting recording with', activeTracks.length, 'active audio track(s)')
      console.log('Audio track settings:', activeTracks[0].getSettings())
      console.log('MediaRecorder state before start:', recorder.state)
      console.log('MediaRecorder mimeType:', recorder.mimeType)
      
      // Check if MediaRecorder supports the stream
      if (recorder.state === 'inactive') {
        // Start recording with shorter timeslice for more frequent data
        recorder.start(50) // Capture data every 50ms for better responsiveness
        
        console.log('MediaRecorder started, state:', recorder.state)
        
        setMediaRecorder(recorder)
        setIsRecording(true)
        isRecordingRef.current = true
        
        // Set initial empty audio levels so visualization shows
        setAudioLevels(Array(20).fill(0.15))
        
        // Monitor for audio data
        let dataCheckCount = 0
        const checkInterval = setInterval(() => {
          dataCheckCount++
          if (recordingChunksRef.current.length > 0) {
            console.log('✅ Audio data confirmed:', recordingChunksRef.current.length, 'chunks, total size:', 
              recordingChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes')
            clearInterval(checkInterval)
          } else if (dataCheckCount > 20) { // After 1 second (20 * 50ms)
            console.warn('⚠️ No audio data received after 1 second')
            console.warn('Recording state:', recorder.state)
            console.warn('Stream active tracks:', stream.getAudioTracks().map(t => ({
              id: t.id,
              label: t.label,
              enabled: t.enabled,
              muted: t.muted,
              readyState: t.readyState
            })))
            clearInterval(checkInterval)
            
            // Try to request data manually
            if (recorder.state === 'recording') {
              try {
                recorder.requestData()
                console.log('Requested data manually from MediaRecorder')
              } catch (e) {
                console.error('Error requesting data:', e)
              }
            }
          }
        }, 50)
      } else {
        throw new Error(`MediaRecorder is not in inactive state: ${recorder.state}`)
      }
    } catch (error: any) {
      console.error('Error starting recording:', error)
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.')
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError(`Failed to start recording: ${error.message}`)
      }
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
      isRecordingRef.current = false
      
      // Clean up stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
        setAudioStream(null)
      }
      
      setMediaRecorder(null)
      stopVisualization()
    }
  }

  // Start audio visualization
  const startVisualization = (analyser: AnalyserNode) => {
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const timeDataArray = new Uint8Array(bufferLength)

    const updateVisualization = () => {
      if (animationFrameRef.current === null || !isRecordingRef.current) return

      // Get both frequency and time domain data for better visualization
      analyser.getByteFrequencyData(dataArray)
      analyser.getByteTimeDomainData(timeDataArray)
      
      // Create levels array for visualization (using 20 bars)
      const levels: number[] = []
      const step = Math.floor(bufferLength / 20)
      
      // Use frequency data for visualization
      for (let i = 0; i < 20; i++) {
        const index = i * step
        let value = dataArray[index] || 0
        
        // Add some amplification for better visibility (not too much)
        value = Math.min(255, value * 1.5)
        
        // Normalize to 0-1 and ensure minimum height for visibility
        const normalized = value / 255
        levels.push(Math.max(0.15, normalized)) // Minimum 15% height so bars are always visible
      }
      
      // Also check if there's actual audio input by checking time domain data
      let hasAudioInput = false
      for (let i = 0; i < timeDataArray.length; i++) {
        if (timeDataArray[i] !== 128) { // 128 is silence in time domain
          hasAudioInput = true
          break
        }
      }
      
      // If no audio detected, show minimal bars to indicate mic is working
      if (!hasAudioInput && levels.every(level => level <= 0.2)) {
        // Show a subtle pulse to indicate mic is active
        levels[10] = 0.3 + Math.sin(Date.now() / 200) * 0.1
      }
      
      setAudioLevels(levels)
      animationFrameRef.current = requestAnimationFrame(updateVisualization)
    }

    // Set initial frame
    animationFrameRef.current = requestAnimationFrame(updateVisualization)
  }

  // Stop audio visualization
  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setAudioLevels([])
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVisualization()
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close().catch((error) => {
            console.warn('Error closing AudioContext in cleanup:', error)
          })
        } catch (error) {
          console.warn('Error closing AudioContext:', error)
        }
        audioContextRef.current = null
      }
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current)
      }
      // Cleanup auto-scroll interval
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      // Cleanup audio download URL
      if (audioDownloadUrl) {
        URL.revokeObjectURL(audioDownloadUrl)
      }
    }
  }, [audioStream, audioDownloadUrl])

const handleTranscribeAudio = async (audioBlob: Blob) => {
  setIsTranscribing(true);
  setError(null);

  try {
    // 1️⃣ STEP ONE — Send audio to Whisper
    const whisperForm = new FormData();
    whisperForm.append("audio", audioBlob, "recording.webm");

    const whisperRes = await fetch("/api/scribe/transcribe", {
      method: "POST",
      body: whisperForm
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => null);
      throw new Error(err?.error || "Whisper transcription failed.");
    }

    const whisperData = await whisperRes.json();
    const rawText = whisperData.text?.trim() || "";

    if (!rawText) {
      throw new Error("No transcript returned from Whisper.");
    }

    // 2️⃣ STEP TWO — Send transcript to GPT-5 Medical to structure it
    const structRes = await fetch("/api/scribe/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText })
    });

    if (!structRes.ok) {
      const err = await structRes.json().catch(() => null);
      throw new Error(err?.error || "Medical structuring failed.");
    }

    const structData = await structRes.json();
    const structured = structData.structured?.trim() || "";

    if (!structured) {
      throw new Error("No structured medical note returned.");
    }

    // 3️⃣ STEP THREE — Insert into doctor notes + auto-save
    setDoctorNotes(prev => {
      const next = prev ? `${prev}\n\n${structured}` : structured;
      handleSaveDoctorNotes(next);
      return next;
    });

  } catch (error: any) {
    console.error("❌ AI Scribe Error:", error);
    setError(error.message || "Failed to generate clinical note.");
  } finally {
    setIsTranscribing(false);
  }
};


  const fetchAppointmentMessages = async () => {
    if (!appointmentId) return
    
    setIsLoadingMessages(true)
    try {
      const response = await fetch(`/api/appointments/messages?appointmentId=${appointmentId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.messages) {
          // Transform messages to match UI format
          const transformedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.message_text,
            sender: msg.sender_type === 'doctor' ? 'doctor' : 'patient',
            timestamp: new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: msg.message_type === 'system' ? 'System' : 'SMS',
            raw: msg // Keep raw data for reference
          }))
          setMessages(transformedMessages)
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const setupMessagesSubscription = () => {
    if (!appointmentId) return
    
    // Clean up existing subscription
    if (messagesSubscriptionRef.current) {
      messagesSubscriptionRef.current.unsubscribe()
    }

    // Subscribe to new messages for this appointment
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
          console.log('New message received:', payload)
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
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !appointmentId || !appointment) return
    
    setIsSendingMessage(true)
    const messageText = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX
    
    try {
      // Get current user and doctor
      const user = await getCurrentUser()
      if (!user || !user.doctor) {
        console.error('Doctor not found')
        setIsSendingMessage(false)
        return
      }

      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      // Send SMS if patient has phone number
      let smsSent = false
      if (appointment.patient_phone) {
        try {
          const smsResponse = await fetch('/api/communication/sms', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            },
            credentials: 'include',
            body: JSON.stringify({
              to: appointment.patient_phone,
              message: messageText,
              patientId: null // No user_id in appointments table
            })
          })

          if (smsResponse.ok) {
            smsSent = true
            console.log('✅ SMS sent successfully')
          } else {
            console.error('SMS sending failed:', await smsResponse.text())
          }
        } catch (smsError) {
          console.error('Error sending SMS:', smsError)
        }
      }

      // Also save to appointment_messages table for chat history
      try {
        const messageResponse = await fetch('/api/appointments/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
          },
          body: JSON.stringify({
            appointmentId: appointmentId,
            senderId: user.doctor.id,
            senderType: 'doctor',
            messageText: messageText,
            messageType: smsSent ? 'text' : 'text' // Mark as text type
          })
        })

        if (!messageResponse.ok) {
          console.error('Failed to save message to appointment_messages')
        }
      } catch (msgError) {
        console.error('Error saving message:', msgError)
      }

      // Optimistically add message to UI (will be replaced by subscription)
      const tempMessage = {
        id: Date.now().toString(),
        text: messageText,
        sender: 'doctor',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        type: smsSent ? 'SMS' : 'Text'
      }
      setMessages(prev => [...prev, tempMessage])
      
    } catch (error) {
      console.error('Error sending message:', error)
      // Restore message if sending failed
      setNewMessage(messageText)
    } finally {
      setIsSendingMessage(false)
    }
  }

  // Phone number validation
  const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
    if (!phone || !phone.trim()) {
      return { valid: false, error: 'Phone number is required' }
    }
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '')
    if (!cleaned.startsWith('+')) {
      if (!/^\d+$/.test(cleaned)) {
        return { valid: false, error: 'Phone number must include country code. Format: +1234567890' }
      }
    }
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    const digitsAfterPlus = formatted.substring(1)
    if (!/^\d+$/.test(digitsAfterPlus)) {
      return { valid: false, error: 'Phone number can only contain numbers and +' }
    }
    if (digitsAfterPlus.length < 10 || digitsAfterPlus.length > 15) {
      return { valid: false, error: 'Phone number must be 10-15 digits (including country code)' }
    }
    return { valid: true }
  }

  // Initialize Twilio Device
  const initializeTwilioDevice = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        setCallStatus('Please login to make calls')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        setCallStatus('Session expired')
        return
      }

      const response = await fetch('/api/communication/twilio-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ identity: user.email })
      })

      if (!response.ok) {
        setCallStatus('Failed to initialize')
        return
      }

      const data = await response.json()
      const { token } = data
      
      if (!token) {
        setCallStatus('Failed to get token')
        return
      }

      const TwilioSDK = await import('@twilio/voice-sdk')
      const Device = TwilioSDK.Device || (TwilioSDK as any).default || TwilioSDK

      if (typeof Device !== 'function') {
        throw new Error('Failed to import Twilio Device class')
      }

      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any,
        enableRingtones: true,
        allowIncomingWhileBusy: false
      } as any)

      device.on('registered', () => {
        setCallStatus('Ready')
        setIsDeviceReady(true)
      })

      device.on('error', (error: any) => {
        setCallStatus(`Error: ${error.message || error}`)
        setIsDeviceReady(false)
      })

      twilioDeviceRef.current = device
      device.register()
    } catch (error: any) {
      console.error('Error initializing Twilio device:', error)
      setCallStatus('Failed to initialize')
    }
  }

  // Setup call handlers
  const setupCallHandlers = (call: Call) => {
    call.on('accept', () => {
      setCallStatus('Call connected')
      setIsCalling(true)
      setCallDuration(0)
      
      // Start call duration timer
      callDurationRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)

      // Setup remote audio
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
      } catch (error) {
        console.error('Error setting up remote audio:', error)
      }
    })

    call.on('disconnect', () => {
      setCallStatus('Call ended')
      setIsCalling(false)
      activeCallRef.current = null
      
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current)
        callDurationRef.current = null
      }
      setCallDuration(0)

      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause()
        remoteAudioRef.current.srcObject = null
      }
    })

    call.on('error', (error: any) => {
      setCallStatus(`Error: ${error.message || 'Call failed'}`)
      setIsCalling(false)
      activeCallRef.current = null
    })
  }

  // Handle Send SMS
  const handleSendSMS = async () => {
    if (isSendingSMS || !smsTo || !smsMessage.trim()) {
      setError('Please enter phone number and message')
      return
    }

    const phoneValidation = validatePhoneNumber(smsTo)
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'Invalid phone number')
      return
    }

    setIsSendingSMS(true)
    setError(null)

    try {
      const user = await getCurrentUser()
      if (!user) {
        setError('Please log in to send SMS')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      let formattedTo = smsTo.trim()
      if (!formattedTo.startsWith('+')) {
        formattedTo = `+${formattedTo}`
      }

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
          patientId: appointment?.user_id || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SMS')
      }

      if (data.success) {
        setSmartAlerts(prev => [...prev, 'SMS sent successfully'])
        setSmsMessage('')
        fetchAppointmentMessages()
        // Refresh communication history
        if (appointment?.patient_phone) {
          setTimeout(() => {
            fetchCommunicationHistory(appointment.patient_phone!)
          }, 1000) // Wait 1 second for SMS record to be saved
        }
        // Notify parent component about successful SMS send
        if (onSmsSent) {
          onSmsSent('SMS sent successfully')
        }
      } else {
        throw new Error(data.error || 'Failed to send SMS')
      }
    } catch (error: any) {
      console.error('Error sending SMS:', error)
      setError(error.message || 'Failed to send SMS')
    } finally {
      setIsSendingSMS(false)
    }
  }

  // Handle Make Call
  const handleMakeCall = async () => {
    if (isCallLoading || isCalling || !callPhoneNumber) {
      return
    }

    const phoneValidation = validatePhoneNumber(callPhoneNumber)
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'Invalid phone number')
      return
    }

    if (!twilioDeviceRef.current) {
      setError('Device not ready. Please wait...')
      return
    }

    setIsCallLoading(true)
    setError(null)

    try {
      const device = twilioDeviceRef.current
      
      if (device.state !== 'registered') {
        setCallStatus('Waiting for device...')
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Device timeout')), 10000)
          const checkReady = () => {
            if (device.state === 'registered') {
              clearTimeout(timeout)
              resolve()
            } else {
              setTimeout(checkReady, 100)
            }
          }
          device.once('registered', () => {
            clearTimeout(timeout)
            resolve()
          })
          checkReady()
        })
      }

      setCallStatus('Connecting...')
      const formattedNumber = callPhoneNumber.startsWith('+') 
        ? callPhoneNumber 
        : `+${callPhoneNumber}`

      const call = await device.connect({
        params: { To: formattedNumber },
        rtcConstraints: { audio: true }
      } as any)

      activeCallRef.current = call
      setupCallHandlers(call)
      setIsCallLoading(false)
    } catch (error: any) {
      console.error('Error making call:', error)
      setError(error.message || 'Failed to make call')
      setIsCallLoading(false)
      setIsCalling(false)
      setCallStatus('Call failed')
    }
  }

  // Handle End Call
  const handleEndCall = () => {
    if (activeCallRef.current) {
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
    
    // Refresh communication history after call ends
    if (appointment?.patient_phone) {
      setTimeout(() => {
        fetchCommunicationHistory(appointment.patient_phone!)
      }, 2000) // Wait 2 seconds for call record to be saved
    }
  }

  // Handle Toggle Mute
  const handleToggleMute = () => {
    if (activeCallRef.current) {
      if (isMuted) {
        activeCallRef.current.mute(false)
        setIsMuted(false)
      } else {
        activeCallRef.current.mute(true)
        setIsMuted(true)
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Fetch communication history filtered by patient phone number
  const fetchCommunicationHistory = async (patientPhone: string) => {
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

      if (!response.ok) {
        console.error('Failed to fetch history:', response.status)
        setCommunicationHistory([])
        return
      }

      const data = await response.json()
      
      if (data.success && data.history) {
        // Filter history by patient phone number (normalize phone numbers for comparison)
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
        
        console.log(`✅ Loaded ${filteredHistory.length} communication history records for patient`)
        setCommunicationHistory(filteredHistory)
      } else {
        setCommunicationHistory([])
      }
    } catch (error) {
      console.error('❌ Error fetching communication history:', error)
      setCommunicationHistory([])
    } finally {
      setLoadingHistory(false)
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

  // Save Problems & Medications to Supabase
  const saveProblemsAndMedications = async () => {
    if (!appointmentId) return
    
    setSavingProblems(true)
    setError(null)
    
    try {
      // Convert active_problems from array to string format for backward compatibility
      const activeProblemsString = activeProblems.length > 0 
        ? activeProblems.map(p => p.problem).join(', ')
        : null
      
      const { error } = await supabase
        .from('appointments')
        .update({
          active_problems: activeProblemsString,
          resolved_problems: resolvedProblems.length > 0 ? resolvedProblems : [],
          medication_history: medicationHistory.length > 0 ? medicationHistory : [],
          active_medication_orders: activeMedOrders.length > 0 ? activeMedOrders : [],
          past_medication_orders: pastMedOrders.length > 0 ? pastMedOrders : [],
          prescription_logs: prescriptionLogs.length > 0 ? prescriptionLogs : []
        })
        .eq('id', appointmentId)
      
      if (error) throw error
      
      setSmartAlerts(prev => [...prev, 'Problems & Medications saved'])
      setAppointment(prev => prev ? {
        ...prev,
        active_problems: activeProblemsString,
        resolved_problems: resolvedProblems,
        medication_history: medicationHistory,
        active_medication_orders: activeMedOrders,
        past_medication_orders: pastMedOrders,
        prescription_logs: prescriptionLogs
      } : null)
    } catch (err: any) {
      console.error('Error saving problems and medications:', err)
      setError('Failed to save problems and medications')
    } finally {
      setSavingProblems(false)
    }
  }

  // Add Active Problem
  const handleAddActiveProblem = () => {
    if (!newActiveProblem.problem.trim()) return
    const newItem = {
      id: `ap-${Date.now()}`,
      problem: newActiveProblem.problem.trim(),
      since: newActiveProblem.since.trim()
    }
    setActiveProblems(prev => [...prev, newItem])
    setNewActiveProblem({problem: '', since: ''})
    saveProblemsAndMedications()
  }

  // Remove Active Problem
  const handleRemoveActiveProblem = (id: string) => {
    setActiveProblems(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }

  // Add Resolved Problem
  const handleAddResolvedProblem = () => {
    if (!newResolvedProblem.problem.trim()) return
    const newItem = {
      id: `rp-${Date.now()}`,
      problem: newResolvedProblem.problem.trim(),
      resolvedDate: newResolvedProblem.resolvedDate.trim()
    }
    setResolvedProblems(prev => [...prev, newItem])
    setNewResolvedProblem({problem: '', resolvedDate: ''})
    saveProblemsAndMedications()
  }

  // Remove Resolved Problem
  const handleRemoveResolvedProblem = (id: string) => {
    setResolvedProblems(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }

  // Add Medication History
  const handleAddMedicationHistory = () => {
    if (!newMedHistory.medication.trim()) return
    const newItem = {
      id: `mh-${Date.now()}`,
      medication: newMedHistory.medication.trim(),
      provider: newMedHistory.provider.trim() || 'External Provider',
      date: newMedHistory.date.trim()
    }
    setMedicationHistory(prev => [...prev, newItem])
    setNewMedHistory({medication: '', provider: '', date: ''})
    saveProblemsAndMedications()
  }

  // Remove Medication History
  const handleRemoveMedicationHistory = (id: string) => {
    setMedicationHistory(prev => prev.filter(m => m.id !== id))
    saveProblemsAndMedications()
  }

  // Move prescription from active to past orders (when sent)
  const handleMoveToPastOrders = (orderId: string) => {
    const order = activeMedOrders.find(o => o.id === orderId)
    if (order) {
      setActiveMedOrders(prev => prev.filter(o => o.id !== orderId))
      setPastMedOrders(prev => [...prev, {
        ...order,
        date: new Date().toISOString().split('T')[0]
      }])
      saveProblemsAndMedications()
    }
  }

  // Add Prescription Log
  const handleAddPrescriptionLog = () => {
    if (!newPrescriptionLog.medication.trim()) return
    const newItem = {
      id: `pl-${Date.now()}`,
      date: newPrescriptionLog.date.trim() || new Date().toISOString().split('T')[0],
      medication: newPrescriptionLog.medication.trim(),
      quantity: newPrescriptionLog.quantity.trim(),
      pharmacy: newPrescriptionLog.pharmacy.trim(),
      status: 'Sent'
    }
    setPrescriptionLogs(prev => [...prev, newItem])
    setNewPrescriptionLog({medication: '', quantity: '', pharmacy: '', date: ''})
    saveProblemsAndMedications()
  }

  // Remove Prescription Log
  const handleRemovePrescriptionLog = (id: string) => {
    setPrescriptionLogs(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }

  // Auto-scroll function for drag and drop
  const handleAutoScroll = (e?: React.DragEvent) => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    
    // Use event clientY if available, otherwise use stored mouse position
    let mouseY: number
    if (e) {
      mouseY = e.clientY
      mousePositionRef.current = { x: e.clientX, y: e.clientY }
    } else if (mousePositionRef.current) {
      mouseY = mousePositionRef.current.y
    } else {
      return // No mouse position available
    }

    const scrollThreshold = 100 // Distance from edge to trigger scroll
    const scrollSpeed = 10 // Pixels to scroll per interval

    // Check if mouse is near top edge
    const distanceFromTop = mouseY - containerRect.top
    if (distanceFromTop < scrollThreshold && container.scrollTop > 0) {
      container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed)
    }

    // Check if mouse is near bottom edge
    const distanceFromBottom = containerRect.bottom - mouseY
    if (distanceFromBottom < scrollThreshold && 
        container.scrollTop < container.scrollHeight - container.clientHeight) {
      container.scrollTop = Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + scrollSpeed
      )
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    if (!isCustomizeMode) return
    setDraggedSection(sectionId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', sectionId)
    
    // Store initial mouse position
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }
  
  // Track mouse position during drag
  useEffect(() => {
    if (!draggedSection) return
    
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [draggedSection])

  // Handle body scroll lock when maximized
  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMaximized])

  // Handle Escape key to exit maximize mode
  useEffect(() => {
    if (!isOpen || !isMaximized) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isMaximized])

  const handleDragOver = (e: React.DragEvent, sectionId: string, panel?: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection || draggedSection === sectionId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSection(sectionId)
    if (panel) setDragOverPanel(panel)
    
    // Update mouse position and trigger auto-scroll
    handleAutoScroll(e)
    
    // Set up continuous auto-scroll
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
    }
    autoScrollIntervalRef.current = setInterval(() => {
      handleAutoScroll()
    }, 50)
  }

  const handlePanelDragOver = (e: React.DragEvent, panel: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPanel(panel)
    
    // Update mouse position and trigger auto-scroll
    handleAutoScroll(e)
    
    // Set up continuous auto-scroll
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
    }
    autoScrollIntervalRef.current = setInterval(() => {
      handleAutoScroll()
    }, 50)
  }

  const handleDragLeave = () => {
    setDragOverSection(null)
    setDragOverPanel(null)
    // Clear auto-scroll interval when leaving
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
    mousePositionRef.current = null
  }

  const handleDrop = (e: React.DragEvent, targetSectionId: string, targetPanel: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection || draggedSection === targetSectionId) return
    e.preventDefault()
    
    // Find which panel the dragged section is currently in
    const leftIndex = leftPanelSections.indexOf(draggedSection)
    const rightIndex = rightPanelSections.indexOf(draggedSection)
    const isInLeft = leftIndex !== -1
    const isInRight = rightIndex !== -1
    
    if (!isInLeft && !isInRight) return
    
    // Find target position
    const targetPanelSections = targetPanel === 'left' ? leftPanelSections : rightPanelSections
    const targetIndex = targetPanelSections.indexOf(targetSectionId)
    
    if (targetIndex === -1) return
    
    // Check if moving within same panel or between panels
    const isSamePanel = (isInLeft && targetPanel === 'left') || (isInRight && targetPanel === 'right')
    
    if (isSamePanel) {
      // Reorder within same panel
      const sourceIndex = targetPanel === 'left' ? leftIndex : rightIndex
      const newPanel = [...targetPanelSections]
      
      // Remove from current position
      newPanel.splice(sourceIndex, 1)
      
      // Calculate new target index (adjust if removing before target)
      const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      
      // Insert at new position
      newPanel.splice(adjustedTargetIndex, 0, draggedSection)
      
      if (targetPanel === 'left') {
        setLeftPanelSections(newPanel)
      } else {
        setRightPanelSections(newPanel)
      }
    } else {
      // Move between panels
      // Remove from source panel
      if (isInLeft) {
        const newLeft = [...leftPanelSections]
        newLeft.splice(leftIndex, 1)
        setLeftPanelSections(newLeft)
      } else {
        const newRight = [...rightPanelSections]
        newRight.splice(rightIndex, 1)
        setRightPanelSections(newRight)
      }
      
      // Add to target panel
      const newTargetPanel = [...targetPanelSections]
      newTargetPanel.splice(targetIndex, 0, draggedSection)
      
      if (targetPanel === 'left') {
        setLeftPanelSections(newTargetPanel)
      } else {
        setRightPanelSections(newTargetPanel)
      }
    }
    
    setDraggedSection(null)
    setDragOverSection(null)
    setDragOverPanel(null)
  }

  const handlePanelDrop = (e: React.DragEvent, panel: 'left' | 'right') => {
    if (!isCustomizeMode || !draggedSection) return
    e.preventDefault()
    
    // Find which panel the dragged section is currently in
    const leftIndex = leftPanelSections.indexOf(draggedSection)
    const rightIndex = rightPanelSections.indexOf(draggedSection)
    const isInLeft = leftIndex !== -1
    const isInRight = rightIndex !== -1
    
    if (!isInLeft && !isInRight) return
    
    // If already in target panel, do nothing
    if ((panel === 'left' && isInLeft) || (panel === 'right' && isInRight)) {
      setDraggedSection(null)
      setDragOverPanel(null)
      return
    }
    
    // Get target panel sections
    const targetPanelSections = panel === 'left' ? leftPanelSections : rightPanelSections
    
    // Calculate insertion index based on drop position
    let insertIndex = targetPanelSections.length // Default to end
    
    // If we have a dragOverSection in the target panel, use it to determine position
    if (dragOverSection && targetPanelSections.includes(dragOverSection)) {
      const overIndex = targetPanelSections.indexOf(dragOverSection)
      // Check if drop is above or below the section based on mouse position
      const panelElement = (e.currentTarget as HTMLElement)
      const sectionElement = panelElement.querySelector(`[data-section-id="${dragOverSection}"]`) as HTMLElement
      if (sectionElement) {
        const sectionRect = sectionElement.getBoundingClientRect()
        const sectionMiddle = sectionRect.top + sectionRect.height / 2
        const dropY = e.clientY
        
        if (dropY < sectionMiddle) {
          insertIndex = overIndex
        } else {
          insertIndex = overIndex + 1
        }
      }
    } else {
      // Fallback: calculate based on drop position relative to all sections
      const panelElement = (e.currentTarget as HTMLElement)
      const dropY = e.clientY
      
      // Find all section elements in the panel, matching them to section IDs
      const sectionElements = Array.from(panelElement.querySelectorAll('[data-section-id]'))
      
      if (sectionElements.length > 0) {
        // Match elements to their section IDs and find insertion point
        for (let i = 0; i < targetPanelSections.length; i++) {
          const sectionId = targetPanelSections[i]
          const sectionElement = Array.from(sectionElements).find(
            el => (el as HTMLElement).getAttribute('data-section-id') === sectionId
          ) as HTMLElement
          
          if (sectionElement) {
            const sectionRect = sectionElement.getBoundingClientRect()
            const sectionMiddle = sectionRect.top + sectionRect.height / 2
            
            // If drop is above the middle of this section, insert before it
            if (dropY < sectionMiddle) {
              insertIndex = i
              break
            }
          }
        }
        
        // If drop is below all sections, insertIndex remains at the end
      }
    }
    
    // Remove from source panel
    if (isInLeft) {
      const newLeft = [...leftPanelSections]
      newLeft.splice(leftIndex, 1)
      setLeftPanelSections(newLeft)
      
      // Insert at calculated position in right panel
      const newRight = [...rightPanelSections]
      newRight.splice(insertIndex, 0, draggedSection)
      setRightPanelSections(newRight)
    } else {
      const newRight = [...rightPanelSections]
      newRight.splice(rightIndex, 1)
      setRightPanelSections(newRight)
      
      // Insert at calculated position in left panel
      const newLeft = [...leftPanelSections]
      newLeft.splice(insertIndex, 0, draggedSection)
      setLeftPanelSections(newLeft)
    }
    
    setDraggedSection(null)
    setDragOverPanel(null)
  }

  const handleDragEnd = () => {
    setDraggedSection(null)
    setDragOverSection(null)
    setDragOverPanel(null)
    // Clear auto-scroll interval when drag ends
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
    mousePositionRef.current = null
  }

  const handleSaveLayout = () => {
    localStorage.setItem('appointment-modal-layout', JSON.stringify({
      left: leftPanelSections,
      right: rightPanelSections
    }))
    setIsCustomizeMode(false)
    setSmartAlerts(prev => [...prev, 'Layout saved'])
  }

  const handleCancelCustomize = () => {
    // Restore saved layout
    const savedLayout = localStorage.getItem('appointment-modal-layout')
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout)
        if (parsed.left && parsed.right) {
          setLeftPanelSections(parsed.left)
          setRightPanelSections(parsed.right)
        } else {
          setLeftPanelSections(defaultLeftPanel)
          setRightPanelSections(defaultRightPanel)
        }
      } catch (e) {
        setLeftPanelSections(defaultLeftPanel)
        setRightPanelSections(defaultRightPanel)
      }
    } else {
      setLeftPanelSections(defaultLeftPanel)
      setRightPanelSections(defaultRightPanel)
    }
    setIsCustomizeMode(false)
  }

  // Render section component
  const renderSection = (sectionId: string, panel: 'left' | 'right') => {
    const isDragging = draggedSection === sectionId
    const isDragOver = dragOverSection === sectionId
    
    const sectionProps = {
      draggable: isCustomizeMode,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, sectionId),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, sectionId, panel),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, sectionId, panel),
      onDragEnd: handleDragEnd,
      'data-section-id': sectionId,
      className: `relative ${isCustomizeMode ? 'cursor-move' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-cyan-500 ring-offset-2' : ''} transition-all`
    }

    switch (sectionId) {
      case 'patient-header':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Name</div>
                  <div className="font-bold text-white text-sm sm:text-base">
                    {appointment?.patient_first_name && appointment?.patient_last_name 
                      ? `${appointment.patient_first_name} ${appointment.patient_last_name}` 
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Email</div>
                  <div className="text-white text-sm sm:text-base break-all">{appointment?.patient_email || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Phone</div>
                  <div className="text-white text-sm sm:text-base">{appointment?.patient_phone || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">DOB</div>
                  <div className="text-white text-sm sm:text-base">{appointment?.patient_dob ? new Date(appointment.patient_dob).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2 lg:col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Address</div>
                  <div className="text-white text-sm sm:text-base break-words">{appointment?.patient_location || 'N/A'}</div>
                </div>
                <div className="sm:col-span-1 lg:col-span-1">
                  <div className="text-xs text-gray-400 mb-1">Preferred Pharmacy</div>
                  <div className="text-white font-bold text-sm sm:text-base">
                    {appointment?.preferred_pharmacy || 'Not specified'}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs text-gray-400 mb-3">Patient Intake</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {appointment?.subjective_notes && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Chief Complaint</div>
                        <div className="text-white text-sm">{appointment.subjective_notes}</div>
                      </div>
                    )}
                    {appointment?.notes && appointment.notes.includes('Onset:') && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Onset</div>
                        <div className="text-white text-sm">
                          {appointment.notes.match(/Onset:\s*([^•]+)/i)?.[1]?.trim() || 'N/A'}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Allergies</div>
                      <div className="text-white text-sm">
                        {appointment?.allergies || 'NKDA'}
                      </div>
                    </div>
                    {appointment?.active_problems && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Active Problems</div>
                        <div className="text-white text-sm">{appointment.active_problems}</div>
                      </div>
                    )}
                    {appointment?.current_medications && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Medications</div>
                        <div className="text-white text-sm">{appointment.current_medications}</div>
                      </div>
                    )}
                    {appointment?.recent_surgeries_details && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Recent Surgeries</div>
                        <div className="text-white text-sm">{appointment.recent_surgeries_details}</div>
                      </div>
                    )}
                    {appointment?.ongoing_medical_issues_details && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Ongoing Medical Issues</div>
                        <div className="text-white text-sm">{appointment.ongoing_medical_issues_details}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'erx-composer':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Pill className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                eRx Composer
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {/* Recipient Address Field */}
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">
                    Recipient Direct Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="pharmacy@example.direct.com"
                    className="w-full h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Direct messaging address for pharmacy or provider
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <span className="text-white text-sm sm:text-base">Medication:</span>
                  <input
                    type="text"
                    value={rxData.medication}
                    onChange={(e) => setRxData(prev => ({ ...prev, medication: e.target.value }))}
                    className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                  <span className="text-white text-sm sm:text-base">×</span>
                  <input
                    type="text"
                    value={rxData.sig}
                    onChange={(e) => setRxData(prev => ({ ...prev, sig: e.target.value }))}
                    placeholder="e.g., BID × 5 days"
                    className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <span className="text-white text-sm sm:text-base">Qty:</span>
                  <input
                    type="text"
                    value={rxData.qty}
                    onChange={(e) => setRxData(prev => ({ ...prev, qty: e.target.value }))}
                    className="w-16 sm:w-20 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                  <span className="text-white text-sm sm:text-base">Refills:</span>
                  <input
                    type="text"
                    value={rxData.refills}
                    onChange={(e) => setRxData(prev => ({ ...prev, refills: e.target.value }))}
                    className="w-16 sm:w-20 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                  <span className="text-white text-sm sm:text-base">Notes:</span>
                  <input
                    type="text"
                    value={rxData.notes}
                    onChange={(e) => setRxData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional instructions (e.g., Generic allowed, Take with food)"
                    className="flex-1 h-8 sm:h-9 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                </div>
                
                {/* Medication List */}
                {rxList.length > 0 && (
                  <div className="mt-4 p-3 sm:p-4 bg-slate-700/50 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-white font-semibold">
                        Medications to Send ({rxList.length})
                      </div>
                      <button
                        onClick={handleClearRxList}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {rxList.map((rx) => (
                        <div key={rx.id} className="p-2 sm:p-3 bg-slate-600/50 rounded-lg border border-white/10 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-white font-medium text-sm sm:text-base">
                              {rx.medication}
                            </div>
                            <div className="text-gray-300 text-xs">
                              <strong>Sig:</strong> {rx.sig} • <strong>Qty:</strong> {rx.qty}
                              {rx.refills !== '0' && <span> • <strong>Refills:</strong> {rx.refills}</span>}
                              {rx.notes && <span> • <strong>Notes:</strong> {rx.notes}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFromRxList(rx.id, rx.db_id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <button
                    onClick={handleAddToRxList}
                    disabled={addingRx || !rxData.medication || !rxData.sig || !rxData.qty}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                  >
                    {addingRx ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Add to List
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSendERx}
                    disabled={sendingRx || !recipientAddress.trim() || (rxList.length === 0 && (!rxData.medication || !rxData.sig || !rxData.qty))}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                    title={!recipientAddress.trim() ? 'Please enter recipient Direct address' : ''}
                  >
                    {sendingRx ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {rxList.length > 0 ? `Send ${rxList.length} eRx` : 'Send eRx'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowRxHistory(!showRxHistory)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">View Recent Prescriptions</span>
                    <span className="sm:hidden">Rx History</span>
                  </button>
                </div>
                {showRxHistory && (
                  <div className="mt-4 p-3 sm:p-4 bg-slate-700/50 rounded-lg max-h-64 overflow-y-auto">
                    <div className="text-sm text-gray-300 mb-3">
                      <strong className="text-white">Recent Prescriptions</strong>
                    </div>
                    {rxHistory.length === 0 ? (
                      <div className="text-gray-400 text-sm">No prescriptions found for this patient</div>
                    ) : (
                      <div className="space-y-3">
                        {rxHistory.map((rx) => (
                          <div key={rx.id} className="p-2 sm:p-3 bg-slate-600/50 rounded-lg border border-white/10">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-white font-semibold text-sm sm:text-base mb-1">
                                  {rx.medication}
                                </div>
                                <div className="text-gray-300 text-xs sm:text-sm mb-1">
                                  <strong>Sig:</strong> {rx.sig}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                  <span><strong>Qty:</strong> {rx.quantity}</span>
                                  {rx.refills > 0 && <span><strong>Refills:</strong> {rx.refills}</span>}
                                  <span><strong>Status:</strong> <span className={`capitalize ${rx.status === 'sent' ? 'text-green-400' : rx.status === 'filled' ? 'text-blue-400' : 'text-gray-400'}`}>{rx.status}</span></span>
                                </div>
                                {rx.notes && (
                                  <div className="mt-1 text-xs text-gray-400 italic">
                                    <strong>Notes:</strong> {rx.notes}
                                  </div>
                                )}
                                {rx.pharmacy_name && (
                                  <div className="mt-1 text-xs text-gray-400">
                                    <strong>Pharmacy:</strong> {rx.pharmacy_name}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {error && (
                  <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                    {error}
                  </div>
                )}
                </div>
              </div>
          </div>
        )
      
      case 'medical-records':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                Medical Records
              </h3>
              <p className="text-sm text-gray-400 mb-4">Access and manage shared patient medical records</p>
              {appointmentId && (
                <div className="mt-4">
                  <MedicalRecordsView         
                    appointmentId={appointmentId}
                    patientId=""
                  />
                </div>
              )}
            </div>
          </div>
        )
      
      case 'doctor-notes':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex border-b border-white/10 bg-slate-900/50">
                {(['SOAP', 'Orders', 'Files', 'Notes', 'Billing', 'Audit'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4 sm:p-6">
                {activeTab === 'SOAP' && (
                  <div className="space-y-4">
                    {appointment?.is_locked && (
                      <div className="p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-amber-400">
                          <Shield className="h-4 w-4" />
                          <span>Notes are locked and signed. Changes cannot be made.</span>
                        </div>
                      </div>
                    )}

                    {/* CDSS Section */}
                    <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-purple-400" />
                          <h3 className="text-sm font-semibold text-white">Clinical Decision Support System (CDSS)</h3>
                        </div>
                        <button
                          onClick={handleGenerateCDSS}
                          disabled={isGeneratingCDSS || appointment?.is_locked || !appointmentId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {isGeneratingCDSS ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span>Generate CDSS Analysis</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        AI-powered clinical support: classification, risk assessment, and SOAP note templates. Provider must review and finalize all suggestions.
                      </p>

                      {showCDSSResults && cdssResponse && (
                        <div className="mt-4 space-y-3 p-3 bg-slate-800/50 rounded-lg border border-purple-500/20">
                          {/* Classification & Risk */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Clinical Category</p>
                              <p className="text-sm text-white font-medium">{cdssResponse.classification?.category || 'N/A'}</p>
                              <p className="text-xs text-gray-400 mt-1">{cdssResponse.classification?.description || ''}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Risk Level</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                cdssResponse.risk_level === 'urgent_escalation' ? 'bg-red-500/20 text-red-400' :
                                cdssResponse.risk_level === 'high_risk' ? 'bg-orange-500/20 text-orange-400' :
                                cdssResponse.risk_level === 'moderate_risk' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {cdssResponse.risk_level?.replace('_', ' ').toUpperCase() || 'N/A'}
                              </span>
                              {cdssResponse.risk_factors && cdssResponse.risk_factors.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-400 mb-1">Risk Factors:</p>
                                  <ul className="text-xs text-gray-300 list-disc list-inside">
                                    {cdssResponse.risk_factors?.map((factor: string, idx: number) => (
                                      <li key={idx}>{factor}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Medication Suggestions */}
                          {cdssResponse.medication_suggestions && (
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Medication Class Suggestions</p>
                              <div className="flex flex-wrap gap-2">
                                {cdssResponse.medication_suggestions.classes?.map((medClass: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                    {medClass}
                                  </span>
                                ))}
                              </div>
                              {cdssResponse.medication_suggestions.safety_notes && cdssResponse.medication_suggestions.safety_notes.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-amber-400">⚠️ Safety Notes:</p>
                                  <ul className="text-xs text-amber-300 list-disc list-inside">
                                    {cdssResponse.medication_suggestions.safety_notes.map((note: string, idx: number) => (
                                      <li key={idx}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <button
                              onClick={handleApplyCDSS}
                              disabled={appointment?.is_locked || isApplyingCDSS}
                              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                              {isApplyingCDSS ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  <span>Applying...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Apply to SOAP Notes</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setShowCDSSResults(false)}
                              className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Chief Complaint */}
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        Chief Complaint
                      </label>
                      <textarea
                        value={soapNotes.chiefComplaint}
                        onChange={(e) => setSoapNotes(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                        disabled={appointment?.is_locked || false}
                        placeholder="Follow-up for DM2; Rx refill; fasting sugars improved."
                        className="w-full h-24 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* ROS - General and Assessment & Plan Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          ROS — General
                        </label>
                        <textarea
                          value={soapNotes.rosGeneral}
                          onChange={(e) => setSoapNotes(prev => ({ ...prev, rosGeneral: e.target.value }))}
                          disabled={appointment?.is_locked || false}
                          placeholder="No fever. No chills. Good appetite."
                          className="w-full h-32 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          Assessment & Plan
                        </label>
                        <textarea
                          value={soapNotes.assessmentPlan}
                          onChange={(e) => setSoapNotes(prev => ({ ...prev, assessmentPlan: e.target.value }))}
                          disabled={appointment?.is_locked || false}
                          placeholder="Refill metformin 500mg BID. Order A1C. Lifestyle counseling."
                          className="w-full h-32 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Auto-save status indicator */}
                    {!appointment?.is_locked && (
                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 text-sm">
                          {soapSaveStatus === 'saving' && (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>
                              <span className="text-cyan-400">Saving...</span>
                            </>
                          )}
                          {soapSaveStatus === 'saved' && (
                            <>
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              <span className="text-green-400">Saved</span>
                            </>
                          )}
                          {soapSaveStatus === 'idle' && (
                            <span className="text-gray-500 text-xs">Changes auto-save as you type</span>
                          )}
                        </div>
                        <button
                          onClick={handleSignAndLock}
                          disabled={isSigning}
                          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {isSigning ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Signing...</span>
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              <span>Sign & Lock</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'Files' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">Documents</h4>
                      {!appointment?.is_locked && (
                        <label className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer text-sm">
                          <FileImage className="h-4 w-4" />
                          <span>Upload Document</span>
                          <input
                            type="file"
                            onChange={handleDocumentUpload}
                            disabled={uploadingDocument}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                          />
                        </label>
                      )}
                    </div>

                    {uploadingDocument && (
                      <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                          <span>Uploading document...</span>
                        </div>
                      </div>
                    )}

                    {appointmentDocuments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No documents uploaded yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {appointmentDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 bg-slate-700/50 rounded-lg border border-white/10 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">
                                  {doc.document_name}
                                </div>
                                <div className="text-gray-400 text-xs">
                                  {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • {new Date(doc.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="ml-3 flex items-center gap-2">
                              <button
                                onClick={() => setSelectedDocument(doc)}
                                className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/20 rounded-md transition-colors"
                                title="View file"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    // Ensure we have a signed URL
                                    let downloadUrl = doc.file_url
                                    
                                    // If the stored URL is a path or broken public URL, generate signed URL
                                    if (!downloadUrl.startsWith('http') || downloadUrl.includes('/storage/v1/object/public/')) {
                                      let filePath = downloadUrl
                                      
                                      if (downloadUrl.includes('/storage/v1/object/public/appointment-documents/')) {
                                        const match = downloadUrl.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
                                        filePath = match ? decodeURIComponent(match[1]) : downloadUrl
                                      }
                                      
                                      const { data: urlData, error: urlError } = await supabase.storage
                                        .from('appointment-documents')
                                        .createSignedUrl(filePath, 3600)
                                      
                                      if (urlError) {
                                        console.error('Error creating signed URL for download:', urlError)
                                        throw new Error('Failed to generate download URL')
                                      }
                                      
                                      if (urlData?.signedUrl) {
                                        downloadUrl = urlData.signedUrl
                                      } else {
                                        throw new Error('Failed to generate download URL')
                                      }
                                    }
                                    
                                    const response = await fetch(downloadUrl)
                                    if (!response.ok) throw new Error('Download failed')
                                    
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = doc.document_name || 'document'
                                    document.body.appendChild(a)
                                    a.click()
                                    window.URL.revokeObjectURL(url)
                                    document.body.removeChild(a)
                                  } catch (err: any) {
                                    console.error('Download error:', err)
                                    alert(`Failed to download file: ${err.message}`)
                                  }
                                }}
                                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-600/20 rounded-md transition-colors"
                                title="Download file"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'Orders' && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Orders functionality coming soon
                  </div>
                )}

                {activeTab === 'Notes' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={doctorNotes}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setDoctorNotes(newValue)
                          
                          if (saveNotesTimeoutRef.current) {
                            clearTimeout(saveNotesTimeoutRef.current)
                          }
                          
                          saveNotesTimeoutRef.current = setTimeout(() => {
                            handleSaveDoctorNotes(newValue)
                          }, 1000)
                        }}
                        onBlur={(e) => {
                          if (saveNotesTimeoutRef.current) {
                            clearTimeout(saveNotesTimeoutRef.current)
                            saveNotesTimeoutRef.current = null
                          }
                          handleSaveDoctorNotes(e.target.value)
                        }}
                        placeholder="Additional notes (auto-saved to database)"
                        className="w-full h-64 px-3 py-2 pr-12 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                      />
                      <button
                        type="button"
                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                        disabled={isTranscribing || micPermission === 'denied'}
                        className={`absolute right-2 top-2 p-2 rounded-lg transition-colors ${
                          isRecording 
                            ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                            : isTranscribing
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : micPermission === 'denied'
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : micPermission === 'checking'
                            ? 'bg-yellow-600 text-white cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isTranscribing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : isRecording ? (
                          <MicOff className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {appointment?.notes && (
                      <div className="text-xs text-green-400">✓ Auto-saved</div>
                    )}
                  </div>
                )}

                {activeTab === 'Billing' && (
                  <div className="space-y-4">
                    {loadingBilling ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                      </div>
                    ) : (
                      <>
                        {/* Payment Summary */}
                        <div className="bg-slate-700/50 rounded-lg border border-white/10 p-4">
                          <h3 className="text-lg font-semibold text-white mb-4">Payment Summary</h3>
                          
                          {paymentRecords.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-gray-400 text-sm">No payment records found for this appointment</p>
                              {appointment?.payment_status && (
                                <div className="mt-4 p-3 bg-slate-600/50 rounded-lg">
                                  <p className="text-sm text-gray-300">
                                    <span className="font-medium">Appointment Payment Status:</span>{' '}
                                    <span className={`capitalize ${
                                      appointment.payment_status === 'captured' ? 'text-green-400' :
                                      appointment.payment_status === 'authorized' ? 'text-yellow-400' :
                                      'text-red-400'
                                    }`}>
                                      {appointment.payment_status}
                                    </span>
                                  </p>
                                  {appointment.payment_intent_id && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Payment Intent: {appointment.payment_intent_id}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {paymentRecords.map((payment) => (
                                <div
                                  key={payment.id}
                                  className="bg-slate-600/50 rounded-lg border border-white/10 p-4"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <p className="text-sm font-medium text-white">Payment Record</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {new Date(payment.created_at).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                      payment.status === 'captured' 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                      payment.status === 'authorized'
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                        'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}>
                                      {payment.status.toUpperCase()}
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                      <p className="text-xs text-gray-400">Amount</p>
                                      <p className="text-lg font-semibold text-white">
                                        {new Intl.NumberFormat('en-US', {
                                          style: 'currency',
                                          currency: payment.currency || 'USD'
                                        }).format(payment.amount / 100)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400">Currency</p>
                                      <p className="text-sm font-medium text-white">{payment.currency || 'USD'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-3 pt-3 border-t border-white/10">
                                    <p className="text-xs text-gray-400">Payment Intent ID</p>
                                    <p className="text-xs font-mono text-cyan-400 break-all">
                                      {payment.payment_intent_id || payment.stripe_payment_intent_id || 'N/A'}
                                    </p>
                                  </div>
                                  
                                  {payment.updated_at && payment.updated_at !== payment.created_at && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-500">
                                        Last updated: {new Date(payment.updated_at).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              {/* Total Summary */}
                              {paymentRecords.length > 0 && (
                                <div className="mt-4 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-cyan-400">Total Amount</p>
                                    <p className="text-xl font-bold text-white">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: paymentRecords[0]?.currency || 'USD'
                                      }).format(
                                        paymentRecords.reduce((sum, p) => sum + (p.amount || 0), 0) / 100
                                      )}
                                    </p>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {paymentRecords.length} payment record{paymentRecords.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Appointment Payment Info */}
                        {appointment && (appointment.payment_status || appointment.payment_intent_id) && (
                          <div className="bg-slate-700/50 rounded-lg border border-white/10 p-4">
                            <h3 className="text-lg font-semibold text-white mb-4">Appointment Payment Status</h3>
                            <div className="space-y-2">
                              {appointment.payment_status && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-400">Status:</span>
                                  <span className={`text-sm font-medium capitalize ${
                                    appointment.payment_status === 'captured' ? 'text-green-400' :
                                    appointment.payment_status === 'authorized' ? 'text-yellow-400' :
                                    'text-red-400'
                                  }`}>
                                    {appointment.payment_status}
                                  </span>
                                </div>
                              )}
                              {appointment.payment_intent_id && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-400">Payment Intent ID:</span>
                                  <span className="text-xs font-mono text-cyan-400 break-all">
                                    {appointment.payment_intent_id}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'Audit' && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Audit trail coming soon
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      
      case 'meeting-info':
        return (
          <ZoomMeetingEmbed
            key={sectionId}
            appointment={appointment}
            currentUser={currentUser}
            isCustomizeMode={isCustomizeMode}
            sectionProps={sectionProps}
            sectionId={sectionId}
          />
        )
      
      case 'sms-section':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                Send SMS
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">To</label>
                  <input
                    type="tel"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="Phone number (e.g., +1234567890)"
                    className="w-full h-9 sm:h-10 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">Message</label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none text-sm sm:text-base"
                  />
                </div>
                <button
                  onClick={handleSendSMS}
                  disabled={isSendingSMS || !smsTo || !smsMessage.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
                >
                  {isSendingSMS ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send SMS</span>
                    </>
                  )}
                </button>
                {error && error.includes('SMS') && (
                  <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      
      case 'call-section':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                Make Call
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={callPhoneNumber}
                    onChange={(e) => setCallPhoneNumber(e.target.value)}
                    placeholder="Phone number (e.g., +1234567890)"
                    disabled={isCalling}
                    className="w-full h-9 sm:h-10 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{callStatus}</span>
                  {isCalling && callDuration > 0 && (
                    <span className="text-teal-400 font-semibold">{formatDuration(callDuration)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isCalling ? (
                    <>
                      <button
                        onClick={handleToggleMute}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm sm:text-base font-medium ${
                          isMuted 
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                            : 'bg-gray-600 hover:bg-gray-700 text-white'
                        }`}
                      >
                        {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                      </button>
                      <button
                        onClick={handleEndCall}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
                      >
                        <Phone className="h-4 w-4 rotate-135" />
                        <span>End Call</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleMakeCall}
                      disabled={!callPhoneNumber || !isDeviceReady || isCallLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
                      title={!isDeviceReady ? 'Device not ready. Please wait...' : isCallLoading ? 'Connecting...' : 'Make a call'}
                    >
                      {isCallLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4" />
                          <span>Make Call</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {error && error.includes('call') && (
                  <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      
      case 'communication-history':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                Communication History
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                    <p className="text-gray-400 text-sm mt-2">Loading history...</p>
                  </div>
                ) : communicationHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No communication history for this patient</p>
                    <p className="text-gray-500 text-xs mt-2">Start by sending an SMS or making a call</p>
                  </div>
                ) : (
                  communicationHistory.map((item) => {
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
                        className="p-3 bg-slate-700/50 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="mt-0.5">
                              {getTypeIcon()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-white font-medium text-xs sm:text-sm">
                                  {getTypeLabel()}
                                </p>
                                {item.status && (
                                  <span className={`text-xs ${getStatusColor()}`}>
                                    • {getStatusLabel()}
                                  </span>
                                )}
                              </div>
                              {item.message && (
                                <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                                  {item.message}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>{formatHistoryDate(item.created_at)}</span>
                                {item.duration && (item.type === 'call' || item.type === 'video') && (
                                  <span>Duration: {formatDuration(item.duration)}</span>
                                )}
                              </div>
                              {item.type === 'call' && item.recording_url && (
                                <div className="flex items-center gap-2 mt-2">
                                  <audio
                                    ref={(el) => {
                                      if (el) audioRefs.current[item.id] = el
                                    }}
                                    src={item.recording_url}
                                    onEnded={() => setPlayingRecordingId(null)}
                                    onPlay={() => setPlayingRecordingId(item.id)}
                                    onPause={() => setPlayingRecordingId(null)}
                                    preload="metadata"
                                    crossOrigin="anonymous"
                                    className="hidden"
                                  />
                                  <button
                                    onClick={() => {
                                      const audio = audioRefs.current[item.id]
                                      if (audio) {
                                        if (playingRecordingId === item.id) {
                                          audio.pause()
                                          setPlayingRecordingId(null)
                                        } else {
                                          Object.keys(audioRefs.current).forEach((id) => {
                                            if (id !== item.id && audioRefs.current[id]) {
                                              audioRefs.current[id]?.pause()
                                            }
                                          })
                                          audio.play().catch(console.error)
                                          setPlayingRecordingId(item.id)
                                        }
                                      }
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                      playingRecordingId === item.id
                                        ? 'text-cyan-300 bg-cyan-900/30'
                                        : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20'
                                    }`}
                                  >
                                    {playingRecordingId === item.id ? (
                                      <>
                                        <Pause className="w-3 h-3" />
                                        <span>Pause</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3" />
                                        <span>Play</span>
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
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download</span>
                                  </button>
                                </div>
                              )}
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
        )
      
      case 'problems-medications':
        return (
          <div key={sectionId} {...sectionProps}>
            {isCustomizeMode && (
              <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                Problems & Medications
              </h3>
              
              <div className="space-y-6">
                {/* Active Problems */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Active Problems</label>
                    <button
                      onClick={handleAddActiveProblem}
                      disabled={!newActiveProblem.problem.trim() || savingProblems}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newActiveProblem.problem}
                      onChange={(e) => setNewActiveProblem(prev => ({ ...prev, problem: e.target.value }))}
                      placeholder="e.g., Type 2 Diabetes Mellitus"
                      className="flex-1 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newActiveProblem.since}
                      onChange={(e) => setNewActiveProblem(prev => ({ ...prev, since: e.target.value }))}
                      placeholder="since 2019"
                      className="w-32 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    {activeProblems.map((problem) => (
                      <div key={problem.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {problem.problem}{problem.since && ` — since ${problem.since}`}
                        </span>
                        <button
                          onClick={() => handleRemoveActiveProblem(problem.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolved Problems */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Resolved Problems</label>
                    <button
                      onClick={handleAddResolvedProblem}
                      disabled={!newResolvedProblem.problem.trim() || savingProblems}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newResolvedProblem.problem}
                      onChange={(e) => setNewResolvedProblem(prev => ({ ...prev, problem: e.target.value }))}
                      placeholder="e.g., Acne"
                      className="flex-1 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newResolvedProblem.resolvedDate}
                      onChange={(e) => setNewResolvedProblem(prev => ({ ...prev, resolvedDate: e.target.value }))}
                      placeholder="resolved 2023"
                      className="w-36 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    {resolvedProblems.map((problem) => (
                      <div key={problem.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {problem.problem}{problem.resolvedDate && ` — resolved ${problem.resolvedDate}`}
                        </span>
                        <button
                          onClick={() => handleRemoveResolvedProblem(problem.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medication History (Surescripts) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Medication History (Surescripts)</label>
                    <button
                      onClick={handleAddMedicationHistory}
                      disabled={!newMedHistory.medication.trim() || savingProblems}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      value={newMedHistory.medication}
                      onChange={(e) => setNewMedHistory(prev => ({ ...prev, medication: e.target.value }))}
                      placeholder="e.g., Atorvastatin 20mg"
                      className="col-span-2 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newMedHistory.provider}
                      onChange={(e) => setNewMedHistory(prev => ({ ...prev, provider: e.target.value }))}
                      placeholder="Provider"
                      className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="date"
                      value={newMedHistory.date}
                      onChange={(e) => setNewMedHistory(prev => ({ ...prev, date: e.target.value }))}
                      className="col-span-3 h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    {medicationHistory.map((med) => (
                      <div key={med.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {med.medication} — {med.provider}{med.date && ` — ${med.date}`}
                        </span>
                        <button
                          onClick={() => handleRemoveMedicationHistory(med.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Medication Orders */}
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Active Medication Orders (by this doctor)</label>
                  <div className="space-y-2">
                    {activeMedOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {order.medication}{order.sig && ` — ${order.sig}`} — {order.status}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMoveToPastOrders(order.id)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            title="Move to past orders"
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => {
                              setActiveMedOrders(prev => prev.filter(o => o.id !== order.id))
                              saveProblemsAndMedications()
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {activeMedOrders.length === 0 && (
                      <p className="text-xs text-gray-400">No active orders. Prescriptions sent from eRx Composer will appear here.</p>
                    )}
                  </div>
                </div>

                {/* Past Medication Orders */}
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Past Medication Orders (by this doctor)</label>
                  <div className="space-y-2">
                    {pastMedOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {order.medication}{order.sig && ` — ${order.sig}`}{order.date && ` — ${order.date}`}
                        </span>
                        <button
                          onClick={() => {
                            setPastMedOrders(prev => prev.filter(o => o.id !== order.id))
                            saveProblemsAndMedications()
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prescription Logs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Prescription Logs</label>
                    <button
                      onClick={handleAddPrescriptionLog}
                      disabled={!newPrescriptionLog.medication.trim() || savingProblems}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      type="date"
                      value={newPrescriptionLog.date}
                      onChange={(e) => setNewPrescriptionLog(prev => ({ ...prev, date: e.target.value }))}
                      className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newPrescriptionLog.medication}
                      onChange={(e) => setNewPrescriptionLog(prev => ({ ...prev, medication: e.target.value }))}
                      placeholder="Medication"
                      className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newPrescriptionLog.quantity}
                      onChange={(e) => setNewPrescriptionLog(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="Quantity"
                      className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newPrescriptionLog.pharmacy}
                      onChange={(e) => setNewPrescriptionLog(prev => ({ ...prev, pharmacy: e.target.value }))}
                      placeholder="Pharmacy"
                      className="h-8 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    {prescriptionLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                        <span className="text-sm text-white">
                          {log.date} — {log.medication} #{log.quantity} — {log.pharmacy} — {log.status}
                        </span>
                        <button
                          onClick={() => handleRemovePrescriptionLog(log.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {savingProblems && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>
                    <span>Saving...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }


  if (!isOpen) return null

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 ${
        isMaximized 
          ? 'bg-slate-900' 
          : 'bg-black/60 backdrop-blur-sm p-2 sm:p-4'
      }`}
    >
      <div 
        className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/20 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isMaximized 
            ? 'w-full h-full rounded-none' 
            : 'rounded-3xl max-w-7xl w-full max-h-[98vh]'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 sm:p-6 gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
             
              <h2 className="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-white whitespace-nowrap">
                <span className="text-cyan-400">
                  {appointment?.service_type?.replace('_', ' ') || 'Appointment'}
                </span>
                {appointment?.requested_date_time && (() => {
                  const doctorTimezone = appointment.doctors?.timezone || 'America/New_York'
                  const appointmentDate = convertToTimezone(appointment.requested_date_time, doctorTimezone)
                  return (
                    <>
                      {' • '}
                      <span className="text-cyan-400">
                        {appointmentDate.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </>
                  )
                })()}
                
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {isCustomizeMode ? (
                <>
                  <button
                    onClick={handleSaveLayout}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm"
                  >
                    <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Save Layout</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  <button
                    onClick={handleCancelCustomize}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Cancel</span>
                    <span className="sm:hidden">Cancel</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsCustomizeMode(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm"
                  >
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Customize</span>
                    <span className="sm:hidden">Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!showRescheduleForm && appointment?.requested_date_time) {
                        // Format appointment time in New York timezone for datetime-local input
                        const doctorTimezone = appointment.doctors?.timezone || 'America/New_York'
                        const formattedDate = formatDateForDateTimeLocal(appointment.requested_date_time, doctorTimezone)
                        setNewDateTime(formattedDate)
                      }
                      setShowRescheduleForm(!showRescheduleForm)
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Reschedule</span>
                    <span className="sm:hidden">Resched</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-gray-400 hover:text-white transition-colors p-2"
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Maximize2 className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>
        </div>

      

        {/* Reschedule Form */}
        {showRescheduleForm && (
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="block text-xs sm:text-sm font-medium text-white mb-2">
                  Select New Date & Time
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <input
                    type="datetime-local"
                    value={newDateTime}
                    onChange={(e) => setNewDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="flex-1 h-9 sm:h-10 px-3 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm sm:text-base"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReschedule}
                      disabled={rescheduleLoading || !newDateTime}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                    >
                      {rescheduleLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                          <span>Rescheduling...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>Confirm</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowRescheduleForm(false)
                        if (appointment?.requested_date_time) {
                          // Format appointment time in New York timezone
                          const doctorTimezone = appointment.doctors?.timezone || 'America/New_York'
                          const formattedDate = formatDateForDateTimeLocal(appointment.requested_date_time, doctorTimezone)
                          setNewDateTime(formattedDate)
                        } else {
                          setNewDateTime('')
                        }
                        setError(null)
                      }}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
                {appointment?.requested_date_time && (
                  <p className="text-xs text-gray-400 mt-2">
                    Current: {formatDate(appointment.requested_date_time)}
                  </p>
                )}
                {error && (
                  <p className="text-xs text-red-400 mt-2">{error}</p>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Scrollable Content Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
          onDragOver={(e) => {
            if (isCustomizeMode) {
              e.preventDefault()
              e.stopPropagation()
              // Trigger auto-scroll when dragging over the container
              if (draggedSection) {
                handleAutoScroll(e)
              }
            }
          }}
          onDrop={(e) => {
            if (isCustomizeMode) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {/* Dynamic Sections - Two Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6">
            {/* Left Panel */}
            <div 
              className={`space-y-6 min-h-[200px] ${isCustomizeMode && dragOverPanel === 'left' ? 'ring-2 ring-cyan-500 ring-offset-2 bg-cyan-500/10 rounded-lg p-2' : ''} transition-all`}
              onDragOver={(e) => handlePanelDragOver(e, 'left')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handlePanelDrop(e, 'left')}
            >
              {leftPanelSections.map((sectionId) => renderSection(sectionId, 'left'))}
              {isCustomizeMode && leftPanelSections.length === 0 && (
                <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-500 rounded-lg text-gray-400">
                  Drop sections here
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div 
              className={`space-y-6 min-h-[200px] ${isCustomizeMode && dragOverPanel === 'right' ? 'ring-2 ring-cyan-500 ring-offset-2 bg-cyan-500/10 rounded-lg p-2' : ''} transition-all`}
              onDragOver={(e) => handlePanelDragOver(e, 'right')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handlePanelDrop(e, 'right')}
            >
              {rightPanelSections.map((sectionId) => renderSection(sectionId, 'right'))}
              {isCustomizeMode && rightPanelSections.length === 0 && (
                <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-500 rounded-lg text-gray-400">
                  Drop sections here
                </div>
              )}
            </div>
          </div>
          </div>

        {/* Patient Communication Flyout */}
        {showCommunication && (
          <div className="fixed top-0 right-0 w-80 sm:w-96 h-full bg-gradient-to-br from-slate-800 to-slate-900 border-l border-white/10 shadow-2xl z-60 flex flex-col">
            <div className="p-4 sm:p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-bold text-white">Patient Communication</h3>
                <button
                  onClick={() => setShowCommunication(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1 overflow-y-auto">
                {isLoadingMessages ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <p className="text-gray-400 text-sm mt-2">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-2.5 sm:p-3 rounded-lg border ${
                        message.sender === 'doctor' 
                          ? 'bg-teal-600/20 border-teal-500/30 ml-auto' 
                          : 'bg-slate-700/50 border-white/10'
                      }`}
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        [{message.type}] {message.timestamp} — {message.sender === 'patient' ? 'Patient' : 'You'}
                      </div>
                      <div className="text-white text-sm sm:text-base">{message.text}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-auto">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!isSendingMessage && newMessage.trim()) {
                        handleSendMessage()
                      }
                    }
                  }}
                  placeholder={appointment?.patient_phone ? "Type a message (will send as SMS)…" : "Type a message…"}
                  disabled={isSendingMessage}
                  className="w-full h-16 sm:h-20 px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none mb-3 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !newMessage.trim()}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingMessage ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Send
                    </>
                  )}
                </button>
                <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm">
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Attach
                </button>
                </div>
                {appointment?.patient_phone && (
                  <p className="text-xs text-gray-400 mt-2">
                    Messages will be sent via SMS to {appointment.patient_phone}
                  </p>
                )}
              </div>
            </div>
        </div>
        )}

        {/* Document Viewer Modal */}
        {selectedDocument && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden border border-white/10">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{selectedDocument.document_name}</h3>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] bg-slate-900">
                {selectedDocument.mime_type?.startsWith('image/') ? (
                  <img 
                    src={selectedDocument.file_url} 
                    alt={selectedDocument.document_name}
                    className="max-w-full h-auto rounded-lg mx-auto"
                    onError={(e) => {
                      console.error('❌ Image failed to load:', selectedDocument.file_url)
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                          <div class="text-center py-8">
                            <p class="text-red-400 mb-4">Failed to load image. The file may not exist or is not accessible.</p>
                            <button 
                              onclick="window.location.reload()" 
                              class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mt-4"
                            >
                              Retry
                            </button>
                          </div>
                        `
                      }
                    }}
                  />
                ) : selectedDocument.mime_type === 'application/pdf' ? (
                  <iframe
                    src={selectedDocument.file_url}
                    className="w-full h-96 border-0 rounded-lg"
                    title={selectedDocument.document_name}
                    onError={() => {
                      console.error('❌ PDF failed to load:', selectedDocument.file_url)
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-300 mb-4">Preview not available for this file type</p>
                    <button
                      onClick={async () => {
                        try {
                          let downloadUrl = selectedDocument.file_url
                          
                          if (!downloadUrl.startsWith('http') || downloadUrl.includes('/storage/v1/object/public/')) {
                            let filePath = downloadUrl
                            
                            if (downloadUrl.includes('/storage/v1/object/public/appointment-documents/')) {
                              const match = downloadUrl.match(/\/storage\/v1\/object\/public\/appointment-documents\/(.+)$/)
                              filePath = match ? decodeURIComponent(match[1]) : downloadUrl
                            }
                            
                            const { data: urlData, error: urlError } = await supabase.storage
                              .from('appointment-documents')
                              .createSignedUrl(filePath, 3600)
                            
                            if (urlError) {
                              console.error('Error creating signed URL for download:', urlError)
                              throw new Error('Failed to generate download URL')
                            }
                            
                            if (urlData?.signedUrl) {
                              downloadUrl = urlData.signedUrl
                            } else {
                              throw new Error('Failed to generate download URL')
                            }
                          }
                          
                          const response = await fetch(downloadUrl)
                          if (!response.ok) throw new Error('Download failed')
                          
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = selectedDocument.document_name || 'document'
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (err: any) {
                          console.error('Download error:', err)
                          alert(`Failed to download file: ${err.message}`)
                        }
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
