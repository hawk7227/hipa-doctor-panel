import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export function useDoctorNotes(
  appointmentId: string | null,
  appointment?: any,
  activeProblems?: any[],
  resolvedProblems?: any[],
  medicationHistory?: any[],
  activeMedOrders?: any[],
  pastMedOrders?: any[],
  prescriptionLogs?: any[],
  rxList?: any[],
  onMedicationsAutoAdded?: (medications: any[]) => void
) {
  const [doctorNotes, setDoctorNotes] = useState('')
  const [soapNotes, setSoapNotes] = useState({
    chiefComplaint: '',
    rosGeneral: '',
    assessmentPlan: ''
  })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [soapSaveStatus, setSoapSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  
  // CDSS state
  const [cdssResponse, setCdssResponse] = useState<any>(null)
  const [isGeneratingCDSS, setIsGeneratingCDSS] = useState(false)
  const [showCDSSResults, setShowCDSSResults] = useState(false)
  const [isApplyingCDSS, setIsApplyingCDSS] = useState(false)
  const [cdssError, setCdssError] = useState<string | null>(null)
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('prompt')
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('default')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Refs for debouncing and avoiding callback recreation
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const soapNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const soapNotesRef = useRef(soapNotes)
  const isInitialLoadRef = useRef(true)

  // Keep refs in sync with state
  useEffect(() => {
    soapNotesRef.current = soapNotes
  }, [soapNotes])

  // Save doctor notes to Supabase (debounced)
  const handleSaveDoctorNotes = useCallback(async (notes: string) => {
    if (!appointmentId) return

    // Clear existing timeout
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current)
    }

    // Debounce save operation
    saveNotesTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('appointments')
          .update({ notes: notes || null })
          .eq('id', appointmentId)

        if (error) {
          console.error('Error saving doctor notes:', error)
        }
      } catch (err) {
        console.error('Error saving doctor notes:', err)
      }
    }, 1000) // 1 second debounce
  }, [appointmentId])

  // Trigger auto-save function (defined before handleSoapNotesChange)
  const triggerAutoSave = useCallback(() => {
    if (isInitialLoadRef.current) {
      return
    }

    if (!appointmentId) {
      return
    }

    if (soapNotesTimeoutRef.current) {
      clearTimeout(soapNotesTimeoutRef.current)
    }

    soapNotesTimeoutRef.current = setTimeout(() => {
      autoSaveSoapNotesRef.current()
    }, 1000)
  }, [appointmentId])

  // Optimized SOAP notes input handler - direct state update for responsive typing
  const handleSoapNotesChange = useCallback((field: keyof typeof soapNotes, value: string) => {
    // Update ref immediately for auto-save to use latest value
    const updatedNotes = { ...soapNotesRef.current, [field]: value }
    soapNotesRef.current = updatedNotes
    
    // Immediate UI update (synchronous) - no startTransition for input responsiveness
    setSoapNotes(updatedNotes)

    // Trigger debounced auto-save
    triggerAutoSave()
  }, [triggerAutoSave])

  // Auto-save SOAP notes to database (debounced)
  const autoSaveSoapNotes = useCallback(async () => {
    if (!appointmentId || isInitialLoadRef.current) {
      return
    }

    const currentNotes = soapNotesRef.current
    setSoapSaveStatus('saving')

    try {
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single()

      if (!appointmentData?.patient_id) {
        throw new Error('Patient ID not found')
      }

      const notesToUpsert = []

      if (currentNotes.chiefComplaint) {
        notesToUpsert.push({
          patient_id: appointmentData.patient_id,
          appointment_id: appointmentId,
          note_type: 'chief_complaint',
          content: currentNotes.chiefComplaint
        })
        notesToUpsert.push({
          patient_id: appointmentData.patient_id,
          appointment_id: appointmentId,
          note_type: 'subjective',
          content: currentNotes.chiefComplaint
        })
      }

      if (currentNotes.rosGeneral) {
        notesToUpsert.push({
          patient_id: appointmentData.patient_id,
          appointment_id: appointmentId,
          note_type: 'ros',
          content: currentNotes.rosGeneral
        })
      }

      if (currentNotes.assessmentPlan) {
        const parts = currentNotes.assessmentPlan.split('\n\n').filter(p => p.trim())

        if (parts.length >= 2) {
          notesToUpsert.push({
            patient_id: appointmentData.patient_id,
            appointment_id: appointmentId,
            note_type: 'assessment',
            content: parts[0].trim()
          })
          notesToUpsert.push({
            patient_id: appointmentData.patient_id,
            appointment_id: appointmentId,
            note_type: 'plan',
            content: parts.slice(1).join('\n\n').trim()
          })
        } else if (parts.length === 1) {
          notesToUpsert.push({
            patient_id: appointmentData.patient_id,
            appointment_id: appointmentId,
            note_type: 'plan',
            content: parts[0].trim()
          })
        }
      }

      if (notesToUpsert.length > 0) {
        const { error } = await supabase
          .from('clinical_notes')
          .upsert(notesToUpsert, {
            onConflict: 'appointment_id,note_type'
          })

        if (error) throw error
      }

      setSoapSaveStatus('saved')
      setTimeout(() => {
        setSoapSaveStatus('idle')
      }, 2000)
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error auto-saving SOAP notes:', err)
      }
      setSoapSaveStatus('idle')
    }
  }, [appointmentId])

  const autoSaveSoapNotesRef = useRef(autoSaveSoapNotes)
  useEffect(() => {
    autoSaveSoapNotesRef.current = autoSaveSoapNotes
  }, [autoSaveSoapNotes])

  const [surgeriesDetails, setSurgeriesDetails] = useState<string>('')

  // Initialize SOAP notes from clinical notes (normalized table)
  const initializeSoapNotes = useCallback((clinicalNotes: any[], appointmentData?: any) => {
    let chiefComplaint = ''
    let rosGeneral = ''
    let assessmentPlan = ''
    let surgeries = ''

    // Helper to check if content is about surgeries
    const isSurgeryNote = (content: string): boolean => {
      if (!content) return false
      const lowerContent = content.toLowerCase()
      return lowerContent.includes('recent surgeries') || 
             lowerContent.includes('surgery') || 
             lowerContent.includes('surgeries:') ||
             lowerContent.startsWith('recent surgeries:')
    }

    if (clinicalNotes && clinicalNotes.length > 0) {
      clinicalNotes.forEach(note => {
        if (note.note_type === 'chief_complaint') {
          chiefComplaint = note.content || ''
        } else if (note.note_type === 'ros') {
          rosGeneral = note.content || ''
        } else if (note.note_type === 'assessment') {
          assessmentPlan = note.content || ''
        } else if (note.note_type === 'plan') {
          assessmentPlan = assessmentPlan ? `${assessmentPlan}\n\n${note.content}` : note.content || ''
        } else if (note.note_type === 'surgeries') {
          // Extract surgeries from normalized clinical_notes table
          surgeries = note.content || ''
        } else if (note.note_type === 'subjective' && !chiefComplaint) {
          // Only use subjective as fallback if no chief_complaint exists
          // BUT exclude surgery notes
          if (!isSurgeryNote(note.content || '')) {
            chiefComplaint = note.content || ''
          }
        }
      })
    } else if (appointmentData) {
      // Fallback to old fields for backward compatibility
      chiefComplaint = appointmentData.chief_complaint || appointmentData.patients?.chief_complaint || ''
      rosGeneral = appointmentData.ros_general || appointmentData.patients?.ros_general || ''
      assessmentPlan = appointmentData.assessment_notes && appointmentData.plan_notes 
        ? `${appointmentData.assessment_notes}\n\n${appointmentData.plan_notes}`
        : appointmentData.assessment_notes || appointmentData.plan_notes || ''
    }

    // Set surgeries from clinical_notes or fallback
    if (surgeries) {
      setSurgeriesDetails(surgeries)
    } else if (appointmentData) {
      setSurgeriesDetails(
        appointmentData.patients?.recent_surgeries_details || 
        appointmentData.recent_surgeries_details || 
        ''
      )
    }

    isInitialLoadRef.current = true
    setSoapNotes({
      chiefComplaint,
      rosGeneral,
      assessmentPlan
    })
    setTimeout(() => {
      isInitialLoadRef.current = false
    }, 500)
  }, [])

  // Generate CDSS response
  const generateCDSSResponse = useCallback(async (apptId: string, isAutoGenerate: boolean = false, currentRxList?: any[]) => {
    if (!apptId || !appointment) {
      console.error('❌ CDSS: Missing appointment ID or appointment data')
      setIsGeneratingCDSS(false) // Clear loading state on early return
      return
    }

    console.log('🔄 CDSS: Starting generation for appointment:', apptId)
    // Set loading state IMMEDIATELY before any async operations
    setIsGeneratingCDSS(true)
    setCdssError(null)
    setShowCDSSResults(false)
    console.log('✅ CDSS: Loading state set to true')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.')
      }

      console.log('✅ CDSS: Authentication successful')

      // Get patient intake data from appointment
      const hasDrugAllergies = appointment.has_drug_allergies ?? appointment.patients?.has_drug_allergies ?? false
      const hasOngoingMedicalIssues = appointment.has_ongoing_medical_issues ?? appointment.patients?.has_ongoing_medical_issues ?? false
      const hasRecentSurgeries = appointment.has_recent_surgeries ?? appointment.patients?.has_recent_surgeries ?? false
      const allergiesText = appointment.patients?.allergies_list && appointment.patients.allergies_list.length > 0
        ? appointment.patients.allergies_list.join(', ')
        : appointment.allergies || ''

      const cdssInputData = {
        appointmentId: apptId,
        isAutoGenerate,
        // Chief Complaint & Reason for Visit
        chiefComplaint: appointment.chief_complaint || appointment.patients?.chief_complaint || '',
        reasonForVisit: appointment.subjective_notes || '',
        // Patient Intake Data
        patientIntake: {
          hasDrugAllergies: hasDrugAllergies,
          allergies: allergiesText,
          hasOngoingMedicalIssues: hasOngoingMedicalIssues,
          ongoingMedicalIssuesDetails: appointment.ongoing_medical_issues_details || appointment.patients?.ongoing_medical_issues_details || '',
          hasRecentSurgeries: hasRecentSurgeries,
          recentSurgeriesDetails: appointment.recent_surgeries_details || appointment.patients?.recent_surgeries_details || '',
        },
        // Active Problems (array of strings)
        activeProblems: activeProblems?.map(p => p.problem) || [],
        // Resolved Problems (with resolved date)
        resolvedProblems: resolvedProblems?.map(p => ({
          problem: p.problem,
          resolvedDate: p.resolvedDate || p.resolved_date || ''
        })) || [],
        // Medication History (with provider and date)
        medicationHistory: medicationHistory?.map(m => ({
          medication: m.medication,
          provider: m.provider || '',
          date: m.date || ''
        })) || [],
        // Prescription Logs
        prescriptionLogs: prescriptionLogs?.map(log => ({
          medication: log.medication,
          quantity: log.quantity,
          pharmacy: log.pharmacy,
          date: log.date,
          status: log.status
        })) || [],
        // Active Medication Orders
        activeMedicationOrders: activeMedOrders?.map(order => ({
          medication: order.medication,
          sig: order.sig,
          status: order.status
        })) || [],
        // Past Medication Orders
        pastMedicationOrders: pastMedOrders?.map(order => ({
          medication: order.medication,
          sig: order.sig,
          date: order.date
        })) || [],
        // Current Prescriptions in eRx Composer
        currentPrescriptions: (currentRxList || rxList)?.map((rx: any) => ({
          medication: rx.medication,
          sig: rx.sig,
          qty: rx.qty,
          refills: rx.refills,
          notes: rx.notes
        })) || [],
        // ROS General
        rosGeneral: appointment.ros_general || appointment.patients?.ros_general || '',
        // Vitals
        vitals: {
          bp: appointment.vitals_bp || appointment.patients?.vitals_bp,
          hr: appointment.vitals_hr || appointment.patients?.vitals_hr,
          temp: appointment.vitals_temp || appointment.patients?.vitals_temp,
        },
        // Patient Demographics
        patientInfo: {
          dateOfBirth: appointment.patients?.date_of_birth,
          location: appointment.patients?.location,
        },
        // Current SOAP Notes
        currentSoapNotes: {
          subjective: soapNotes.chiefComplaint,
          rosGeneral: soapNotes.rosGeneral,
          assessmentPlan: soapNotes.assessmentPlan,
        }
      }

      console.log('📤 CDSS: Sending request to API with data:', {
        appointmentId: apptId,
        hasChiefComplaint: !!cdssInputData.chiefComplaint,
        hasReasonForVisit: !!cdssInputData.reasonForVisit,
        activeProblemsCount: cdssInputData.activeProblems.length,
        medicationHistoryCount: cdssInputData.medicationHistory.length
      })

      // Add timeout to prevent hanging (increased to 120 seconds for OpenAI API)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error('⏱️ CDSS: Request timeout after 120 seconds')
        controller.abort()
      }, 120000) // 120 second timeout (OpenAI can be slow)

      console.log('🌐 CDSS: Making fetch request to /api/cdss/generate')
      const response = await fetch('/api/cdss/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify(cdssInputData),
        signal: controller.signal
      }).catch((fetchError: any) => {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The API is taking too long to respond. Please try again.')
        }
        throw fetchError
      })

      clearTimeout(timeoutId)

      console.log('📥 CDSS: Received response, status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to generate CDSS response`
        console.error('❌ CDSS: API error:', errorMessage, errorData)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('✅ CDSS: Successfully received response:', {
        hasClassification: !!data.classification,
        hasRiskLevel: !!data.risk_level,
        hasMedications: !!(data.medication_suggestions?.medications?.length)
      })
      
      // Clear loading state immediately
      setIsGeneratingCDSS(false)
      
      // Update response data in transition for smooth UI update
      startTransition(() => {
      setCdssResponse(data)
      setShowCDSSResults(true)
        setCdssError(null)
      })
      
      console.log('✅ CDSS: State updated with response data')
      
      if (isAutoGenerate) {
        await supabase
          .from('appointments')
          .update({ cdss_auto_generated: true })
          .eq('id', apptId)
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate CDSS response. Please try again.'
      console.error('❌ CDSS: Error generating CDSS:', {
        message: err.message,
        name: err.name,
        stack: err.stack?.substring(0, 300)
      })
      // Update error state
      startTransition(() => {
        setCdssError(errorMessage)
        setShowCDSSResults(false)
        setCdssResponse(null)
        setIsGeneratingCDSS(false) // Clear loading state on error
      })
    } finally {
      // Always ensure loading state is cleared (safety net)
      setIsGeneratingCDSS(false)
      console.log('🏁 CDSS: Generation process finished')
    }
  }, [appointment, activeProblems, resolvedProblems, medicationHistory, activeMedOrders, pastMedOrders, prescriptionLogs, rxList, soapNotes])

  // Check for existing CDSS response and auto-generate if needed
  const checkAndLoadCDSS = useCallback(async (apptId: string, apptData?: any) => {
    console.log('🚀 CDSS checkAndLoadCDSS: Called', {
      appointmentId: apptId,
      hasApptData: !!apptData,
      hasAppointment: !!appointment
    })
    
    if (!apptId) {
      console.log('❌ CDSS checkAndLoadCDSS: No appointment ID provided')
      return
    }

    try {
      const appointmentData = apptData || appointment
      
      console.log('🔍 CDSS checkAndLoadCDSS: Checking for existing CDSS on appointment load...', {
        appointmentId: apptId,
        hasAppointmentData: !!appointmentData,
        cdssAutoGenerated: appointmentData?.cdss_auto_generated,
        hasChiefComplaint: !!appointmentData?.chief_complaint,
        hasSubjectiveNotes: !!appointmentData?.subjective_notes,
        hasNotes: !!appointmentData?.notes
      })
      
      // ALWAYS check for existing CDSS response first (regardless of flag)
      console.log('📡 CDSS checkAndLoadCDSS: Querying database for existing CDSS...')
      const { data: existingCDSS, error: cdssError } = await supabase
        .from('cdss_responses')
        .select('*')
        .eq('appointment_id', apptId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('📊 CDSS checkAndLoadCDSS: Database query result:', {
        hasData: !!existingCDSS,
        hasError: !!cdssError,
        error: cdssError,
        dataKeys: existingCDSS ? Object.keys(existingCDSS) : null,
        hasResponseData: !!(existingCDSS?.response_data),
        responseDataType: existingCDSS?.response_data ? typeof existingCDSS.response_data : null,
        isObject: existingCDSS?.response_data ? (typeof existingCDSS.response_data === 'object') : null,
        appointmentId: existingCDSS?.appointment_id,
        created_at: existingCDSS?.created_at,
        id: existingCDSS?.id
      })

      if (existingCDSS && !cdssError && existingCDSS.response_data) {
        console.log('✅ CDSS checkAndLoadCDSS: Found existing response, loading it automatically...', {
          hasClassification: !!(existingCDSS.response_data.classification),
          hasRiskLevel: !!(existingCDSS.response_data.risk_level),
          hasMedications: !!(existingCDSS.response_data.medication_suggestions?.medications?.length),
          responseDataPreview: JSON.stringify(existingCDSS.response_data).substring(0, 200)
        })
        
        // Load existing CDSS response - update state immediately (not in transition)
console.log('🔄 CDSS checkAndLoadCDSS: Updating state with existing response...')

// 🔥🔥🔥 IMPORTANT FIX: DIRECTLY USE response_data
const actualResponseData = existingCDSS.response_data;

setCdssResponse(actualResponseData); // ✅ Direct response_data
setShowCDSSResults(true);
setCdssError(null);

console.log('✅ CDSS checkAndLoadCDSS: State updated successfully', {
  hasCdssResponse: !!actualResponseData,
  showCDSSResults: true,
  // 🔥 NEW: Check what keys are in the response
  cdssResponseKeys: actualResponseData ? Object.keys(actualResponseData) : []
})
        
        // Update flag if not already set (to prevent future auto-generation)
        if (!appointmentData?.cdss_auto_generated) {
          console.log('📝 CDSS checkAndLoadCDSS: Updating cdss_auto_generated flag...')
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ cdss_auto_generated: true })
            .eq('id', apptId)
          
          if (updateError) {
            console.error('⚠️ CDSS checkAndLoadCDSS: Failed to update flag:', updateError)
          } else {
            console.log('✅ CDSS checkAndLoadCDSS: Flag updated successfully')
          }
        }
        
        console.log('✅ CDSS checkAndLoadCDSS: Completed - existing data loaded')
        return // Don't auto-generate if existing data found
      }

      console.log('⚠️ CDSS checkAndLoadCDSS: No existing response found', {
        hasExistingCDSS: !!existingCDSS,
        hasError: !!cdssError,
        hasResponseData: !!(existingCDSS?.response_data)
      })

      // Only auto-generate if no existing CDSS found and appointment has required data
      if (appointmentData && !appointmentData.cdss_auto_generated && 
          (appointmentData.chief_complaint || appointmentData.subjective_notes || appointmentData.notes)) {
        console.log('🔄 CDSS checkAndLoadCDSS: No existing response found, auto-generating...', {
          hasChiefComplaint: !!appointmentData.chief_complaint,
          hasSubjectiveNotes: !!appointmentData.subjective_notes,
          hasNotes: !!appointmentData.notes
        })
        await generateCDSSResponse(apptId, true) // Pass true to indicate auto-generation
      } else {
        console.log('ℹ️ CDSS checkAndLoadCDSS: No existing response and conditions not met for auto-generation', {
          hasAppointmentData: !!appointmentData,
          cdssAutoGenerated: appointmentData?.cdss_auto_generated,
          hasRequiredData: !!(appointmentData?.chief_complaint || appointmentData?.subjective_notes || appointmentData?.notes)
        })
      }
    } catch (error: any) {
      // Don't show error to user, just log it (auto-generation should be silent)
      console.error('❌ CDSS checkAndLoadCDSS: Error checking/loading CDSS:', {
        error: error.message,
        stack: error.stack?.substring(0, 300),
        name: error.name
      })
    }
  }, [appointment, generateCDSSResponse])

  // Load existing CDSS response from database
  const loadExistingCDSS = useCallback(async (apptId: string) => {
    if (!apptId) {
      console.log('❌ CDSS loadExistingCDSS: No appointment ID provided')
      return false
    }

    try {
      console.log('🔍 CDSS loadExistingCDSS: Checking for existing CDSS response...', { appointmentId: apptId })
      const { data: existingCDSS, error: cdssError } = await supabase
        .from('cdss_responses')
        .select('*')
        .eq('appointment_id', apptId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('📊 CDSS loadExistingCDSS: Database query result:', {
        hasData: !!existingCDSS,
        hasError: !!cdssError,
        error: cdssError,
        dataKeys: existingCDSS ? Object.keys(existingCDSS) : null,
        hasResponseData: !!(existingCDSS?.response_data),
        responseDataType: existingCDSS?.response_data ? typeof existingCDSS.response_data : null,
        appointmentId: existingCDSS?.appointment_id,
        created_at: existingCDSS?.created_at
      })


      if (existingCDSS && !cdssError && existingCDSS.response_data) {
        console.log('✅ CDSS loadExistingCDSS: Found existing response, loading it...', {
          hasClassification: !!(existingCDSS.response_data.classification),
          hasRiskLevel: !!(existingCDSS.response_data.risk_level),
          hasMedications: !!(existingCDSS.response_data.medication_suggestions?.medications?.length),
          // 🔥 NEW: Add response_data preview
          responseDataPreview: JSON.stringify(existingCDSS.response_data).substring(0, 200)
        })
        
        // 🔥🔥🔥 IMPORTANT FIX: DIRECTLY USE response_data
        const actualResponseData = existingCDSS.response_data;
        
        // Update state with the actual response data
        setCdssResponse(actualResponseData); // ✅ Direct response_data
        setShowCDSSResults(true);
        setCdssError(null);
        
        console.log('✅ CDSS loadExistingCDSS: State updated successfully', {
          hasCdssResponse: !!actualResponseData,
          showCDSSResults: true,
          // 🔥 NEW: Check what keys are in the response
          cdssResponseKeys: actualResponseData ? Object.keys(actualResponseData) : []
        });

          // 🔥 YEH 3 LINES ADD KARO
  console.log('🔥 SETTING STATE:');
  console.log('1. setCdssResponse() - calling');
  setCdssResponse(actualResponseData);
  console.log('2. setShowCDSSResults(true) - calling');
  setShowCDSSResults(true); // ✅ Yeh line important hai!
  console.log('3. setCdssError(null) - calling');
  setCdssError(null);
  
        
        return true; // Indicates existing data was loaded
      } else {
        console.log('⚠️ CDSS loadExistingCDSS: No existing response found or invalid data', {
          hasExistingCDSS: !!existingCDSS,
          hasError: !!cdssError,
          hasResponseData: !!(existingCDSS?.response_data)
        })
      }
      return false // No existing data
    } catch (error: any) {
      console.error('❌ CDSS loadExistingCDSS: Error loading existing response:', {
        error: error.message,
        stack: error.stack?.substring(0, 200)
      })
      return false
    }
  }, [])

  // Manual CDSS generation (loads existing if available, otherwise generates new)
  const handleGenerateCDSS = useCallback(async (currentRxList?: any[]) => {
    console.log('👆 CDSS handleGenerateCDSS: Called', {
      appointmentId,
      isGeneratingCDSS,
      hasCurrentRxList: !!currentRxList
    })
    
    if (!appointmentId) {
      console.error('❌ CDSS handleGenerateCDSS: No appointment ID for manual generation')
      return
    }
    
    // Prevent multiple simultaneous requests
    if (isGeneratingCDSS) {
      console.log('⚠️ CDSS handleGenerateCDSS: Generation already in progress, ignoring request')
      return
    }
    
    console.log('👆 CDSS handleGenerateCDSS: Manual generation triggered by user')
    
    // First, try to load existing CDSS response
    console.log('🔍 CDSS handleGenerateCDSS: Checking for existing CDSS before generating...')
    const hasExisting = await loadExistingCDSS(appointmentId)
    console.log('📊 CDSS handleGenerateCDSS: loadExistingCDSS returned:', { hasExisting })
    
    if (hasExisting) {
      console.log('✅ CDSS handleGenerateCDSS: Loaded existing response, no need to generate new one')
      return // Existing data loaded, no need to generate
    }
    
    // No existing data, generate new CDSS
    console.log('🔄 CDSS handleGenerateCDSS: No existing response found, generating new one...')
    // Set loading state immediately for instant UI feedback
    setIsGeneratingCDSS(true)
    setCdssError(null)
    setShowCDSSResults(false)
    
    try {
    await generateCDSSResponse(appointmentId, false, currentRxList)
    } catch (err: any) {
      // Error is already handled in generateCDSSResponse, just log here
      console.error('❌ CDSS handleGenerateCDSS: Manual generation failed:', err)
      // Ensure loading state is cleared on error
      setIsGeneratingCDSS(false)
    }
  }, [appointmentId, generateCDSSResponse, isGeneratingCDSS, loadExistingCDSS])

  // Auto-apply CDSS suggestions if fields are empty (called automatically when CDSS response is loaded)
  const autoApplyCDSSIfEmpty = useCallback(async () => {
    if (!cdssResponse || !appointment) return

    // Check if any fields need to be filled
    const needsRos = !soapNotesRef.current.rosGeneral || soapNotesRef.current.rosGeneral.trim() === ''
    const needsAssessmentPlan = !soapNotesRef.current.assessmentPlan || soapNotesRef.current.assessmentPlan.trim() === ''
    const needsMedications = cdssResponse.medication_suggestions?.medications && cdssResponse.medication_suggestions.medications.length > 0

    // Only auto-apply if at least one field is empty
    if (!needsRos && !needsAssessmentPlan && !needsMedications) {
      console.log('ℹ️ Auto-apply CDSS: All fields already filled, skipping auto-apply')
      return
    }

    console.log('🔄 Auto-apply CDSS: Auto-filling empty fields', {
      needsRos,
      needsAssessmentPlan,
      needsMedications
    })

    setIsApplyingCDSS(true)

    try {
      // Build the new SOAP notes - only fill empty fields
      const newSoapNotes = {
        chiefComplaint: soapNotesRef.current.chiefComplaint, // Don't auto-fill chief complaint
        rosGeneral: needsRos 
          ? (cdssResponse.soap_note?.ros || cdssResponse.templates?.ros_general || '')
          : soapNotesRef.current.rosGeneral,
        assessmentPlan: needsAssessmentPlan
          ? `${cdssResponse.soap_note?.assessment || cdssResponse.templates?.assessment || ''}\n\n${cdssResponse.soap_note?.plan || cdssResponse.templates?.plan || ''}`.trim()
          : soapNotesRef.current.assessmentPlan
      }
      
      // Update the ref FIRST (so auto-save uses the correct values)
      soapNotesRef.current = newSoapNotes
      
      // Apply to SOAP notes UI
      setSoapNotes(newSoapNotes)
      
      // Immediately save SOAP notes to database (don't wait for user edit)
      // Mark as not initial load so auto-save will work
      isInitialLoadRef.current = false
      
      // Call auto-save directly to persist to database
      await autoSaveSoapNotesRef.current()

      // Auto-add medications to rxList if they exist in CDSS response
      // The callback will handle duplicate checking
      if (needsMedications && onMedicationsAutoAdded) {
        const medicationsToAdd = cdssResponse.medication_suggestions.medications.map((med: any, index: number) => ({
          id: `rx-cdss-${Date.now()}-${index}-${Math.random()}`,
          db_id: undefined, // Will be saved when user sends eRx
          medication: med.medication,
          sig: med.sig || 'As directed',
          qty: med.quantity || '30',
          refills: (med.refills || 0).toString(),
          notes: med.notes || '',
          pharmacy: ''
        }))
        
        console.log('💊 Auto-apply CDSS: Adding medications to rxList', {
          medicationsCount: medicationsToAdd.length,
          medications: medicationsToAdd.map((m: { medication: string }) => m.medication)
        })
        
        onMedicationsAutoAdded(medicationsToAdd)
      } else if (needsMedications && !onMedicationsAutoAdded) {
        console.warn('⚠️ Auto-apply CDSS: Medications found but onMedicationsAutoAdded callback not provided')
      }

      console.log('✅ Auto-apply CDSS: Successfully auto-filled empty fields')
    } catch (error: any) {
      console.error('❌ Auto-apply CDSS: Error auto-applying CDSS suggestions:', error)
      // Don't throw error - auto-apply should be silent
    } finally {
      setIsApplyingCDSS(false)
    }
  }, [cdssResponse, appointment, onMedicationsAutoAdded])

  // Apply CDSS suggestions (manual apply - fills all fields)
  const handleApplyCDSS = useCallback(async (onMedicationsAdded?: (medications: any[]) => void) => {
    if (!cdssResponse || !appointment) return

    setIsApplyingCDSS(true)

    try {
      // Build the new SOAP notes
      const newSoapNotes = {
        chiefComplaint: cdssResponse.soap_note?.chief_complaint || soapNotesRef.current.chiefComplaint,
        rosGeneral: cdssResponse.soap_note?.ros || cdssResponse.templates?.ros_general || soapNotesRef.current.rosGeneral,
        assessmentPlan: `${cdssResponse.soap_note?.assessment || cdssResponse.templates?.assessment || ''}\n\n${cdssResponse.soap_note?.plan || cdssResponse.templates?.plan || ''}`.trim() || soapNotesRef.current.assessmentPlan
      }
      
      // Update the ref FIRST (so auto-save uses the correct values)
      soapNotesRef.current = newSoapNotes
      
      // Apply to SOAP notes UI
      setSoapNotes(newSoapNotes)
      
      // Immediately save SOAP notes to database (don't wait for user edit)
      // Mark as not initial load so auto-save will work
      isInitialLoadRef.current = false
      
      // Call auto-save directly to persist to database
      await autoSaveSoapNotesRef.current()

      // Save medication suggestions
      if (cdssResponse.medication_suggestions?.medications && cdssResponse.medication_suggestions.medications.length > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        // Get patient_id from appointment - check both direct patient_id and nested patients.id
        const patientId = appointment.patient_id || appointment.patients?.id
        
        console.log('💊 ApplyCDSS: Saving prescriptions', {
          appointmentId: appointment.id,
          patientId,
          hasDirectPatientId: !!appointment.patient_id,
          hasNestedPatientId: !!appointment.patients?.id,
          medicationsCount: cdssResponse.medication_suggestions.medications.length
        })

        if (!patientId) {
          console.error('❌ ApplyCDSS: Patient ID not found in appointment', {
            appointmentKeys: Object.keys(appointment),
            hasPatients: !!appointment.patients,
            patientsKeys: appointment.patients ? Object.keys(appointment.patients) : null
          })
          throw new Error('Patient ID not found in appointment. Please ensure this appointment is linked to a valid patient.')
        }

        const savedMedications: any[] = []
        const prescriptionErrors: string[] = []
        
        for (const med of cdssResponse.medication_suggestions.medications) {
          try {
            console.log('💊 ApplyCDSS: Saving medication', {
              medication: med.medication,
              sig: med.sig,
              quantity: med.quantity
            })
            
            const response = await fetch('/api/prescriptions', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': accessToken ? `Bearer ${accessToken}` : '',
              },
              credentials: 'include',
              body: JSON.stringify({
                appointmentId: appointment.id,
                patientId: patientId,
                medication: med.medication,
                sig: med.sig || 'As directed',
                quantity: med.quantity || '30',
                refills: med.refills || 0,
                notes: med.notes || cdssResponse.medication_suggestions.safety_notes?.join('; ') || null,
                pharmacyName: appointment?.preferred_pharmacy || null,
                status: 'pending'
              })
            })

            if (!response.ok) {
              // Read the actual error from the API response
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
              const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}`
              console.error(`❌ ApplyCDSS: Failed to save prescription for ${med.medication}:`, {
                status: response.status,
                error: errorData,
                patientId,
                appointmentId: appointment.id
              })
              prescriptionErrors.push(`${med.medication}: ${errorMessage}`)
              continue
            }

            const data = await response.json()
            const savedPrescription = data.prescription
            
            console.log('✅ ApplyCDSS: Prescription saved successfully', {
              medication: med.medication,
              prescriptionId: savedPrescription.id
            })

            savedMedications.push({
              id: savedPrescription.id,
              db_id: savedPrescription.id,
              medication: med.medication,
              sig: med.sig || 'As directed',
              qty: med.quantity || '30',
              refills: (med.refills || 0).toString(),
              notes: med.notes || ''
            })
          } catch (error: any) {
            console.error(`❌ ApplyCDSS: Error saving medication ${med.medication}:`, error)
            prescriptionErrors.push(`${med.medication}: ${error.message || 'Network error'}`)
          }
        }

        // Log summary of prescription saving
        console.log('💊 ApplyCDSS: Prescription save summary', {
          total: cdssResponse.medication_suggestions.medications.length,
          saved: savedMedications.length,
          errors: prescriptionErrors.length,
          errorDetails: prescriptionErrors
        })

        if (savedMedications.length > 0 && onMedicationsAdded) {
          onMedicationsAdded(savedMedications)
        }
        
        // If some prescriptions failed, show a warning but don't block the SOAP notes apply
        if (prescriptionErrors.length > 0 && savedMedications.length === 0) {
          // All prescriptions failed - throw an error
          throw new Error(`Failed to save prescriptions: ${prescriptionErrors.join('; ')}`)
        } else if (prescriptionErrors.length > 0) {
          // Some prescriptions failed - log warning but continue
          console.warn('⚠️ ApplyCDSS: Some prescriptions failed to save:', prescriptionErrors)
        }
      }

      setShowCDSSResults(false)
    } catch (error: any) {
      console.error('Error applying CDSS suggestions:', error)
      throw error
    } finally {
      setIsApplyingCDSS(false)
    }
  }, [cdssResponse, appointment, setSoapNotes])

  // Auto-apply CDSS when response is loaded and fields are empty
  const autoApplyRef = useRef(false) // Track if we've already auto-applied for this response
  const cdssResponseIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Only auto-apply if:
    // 1. CDSS response exists
    // 2. We haven't already auto-applied for this response
    // 3. Appointment is loaded
    if (cdssResponse && appointment && appointmentId) {
      const currentResponseId = cdssResponse.id || JSON.stringify(cdssResponse).substring(0, 100)
      
      // Check if this is a new response (different from last one we processed)
      if (cdssResponseIdRef.current !== currentResponseId) {
        cdssResponseIdRef.current = currentResponseId
        autoApplyRef.current = false // Reset flag for new response
        
        // Auto-apply immediately (reduced delay for faster UX)
        const timeoutId = setTimeout(() => {
          if (!autoApplyRef.current) {
            console.log('🔄 Auto-apply CDSS: Triggering auto-apply for new CDSS response')
            autoApplyCDSSIfEmpty().then(() => {
              autoApplyRef.current = true
              console.log('✅ Auto-apply CDSS: Successfully completed')
            }).catch(err => {
              console.error('❌ Auto-apply CDSS: Error in auto-apply:', err)
              autoApplyRef.current = true // Mark as attempted even on error to prevent retries
            })
          }
        }, 200) // Reduced from 1000ms to 200ms for faster auto-fill
        
        return () => clearTimeout(timeoutId)
      }
    }
  }, [cdssResponse, appointment, appointmentId, autoApplyCDSSIfEmpty])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current)
      }
      if (soapNotesTimeoutRef.current) {
        clearTimeout(soapNotesTimeoutRef.current)
      }
    }
  }, [])

  return {
    doctorNotes,
    soapNotes,
    isSavingDraft,
    isSigning,
    soapSaveStatus,
    surgeriesDetails,
    cdssResponse,
    isGeneratingCDSS,
    showCDSSResults,
    isApplyingCDSS,
    cdssError,
    isRecording,
    isTranscribing,
    micPermission,
    setDoctorNotes,
    setSoapNotes,
    setIsSavingDraft,
    setIsSigning,
    setSurgeriesDetails,
    setShowCDSSResults,
    setCdssError,
    handleSaveDoctorNotes,
    handleSoapNotesChange,
    initializeSoapNotes,
    handleGenerateCDSS,
    handleApplyCDSS,
    generateCDSSResponse,
    checkAndLoadCDSS
  }
}

