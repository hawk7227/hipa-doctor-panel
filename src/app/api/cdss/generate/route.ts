import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

// Extended CDSS Input interface to include all data sources
interface CDSSInput {
  // Original fields
  chief_complaint: string
  symptoms: string
  duration: string
  severity: string
  allergies: string
  red_flags: string[]
  transcription?: string | null
  
  // NEW: Comprehensive data sources from frontend
  reasonForVisit?: string
  patientIntake?: {
    hasDrugAllergies: boolean
    allergies: string
    hasOngoingMedicalIssues: boolean
    ongoingMedicalIssuesDetails: string
    hasRecentSurgeries: boolean
    recentSurgeriesDetails: string
  }
  activeProblems?: string[]
  resolvedProblems?: Array<{ problem: string; resolvedDate: string }>
  medicationHistory?: Array<{ medication: string; provider: string; date: string }>
  prescriptionLogs?: Array<{ medication: string; quantity: string; pharmacy: string; date: string; status: string }>
  activeMedicationOrders?: Array<{ medication: string; sig: string; status: string }>
  pastMedicationOrders?: Array<{ medication: string; sig: string; date: string }>
  currentPrescriptions?: Array<{ medication: string; sig: string; qty: string; refills: string; notes: string }>
  rosGeneral?: string
  vitals?: { bp?: string; hr?: string; temp?: string }
  patientInfo?: { dateOfBirth?: string; location?: string }
  currentSoapNotes?: { subjective: string; rosGeneral: string; assessmentPlan: string }
}

interface CDSSResponse {
  classification: {
    category: string
    description: string
  }
  risk_level: 'low_risk' | 'moderate_risk' | 'high_risk' | 'urgent_escalation'
  risk_factors: string[]
  templates: {
    hpi: string
    ros_general: string
    assessment: string
    plan: string
  }
  medication_suggestions: {
    medications: Array<{
      medication: string
      sig: string
      quantity: string
      refills: number
      notes: string
      rationale?: string
      guidelines?: string
    }>
    safety_notes: string[]
    alternatives?: string[]
  }
  soap_note: {
    chief_complaint: string
    hpi: string
    ros: string
    assessment: string
    plan: string
  }
  // NEW: Additional analysis fields
  allergy_alerts?: string[]
  interaction_alerts?: string[]
  clinical_pearls?: string[]
  follow_up_recommendations?: string
  analysis_summary?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  console.log('🔄 CDSS API: Request received')
  
  try {
    // Authentication
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    console.log('🔐 CDSS API: Authentication check', { hasAccessToken: !!accessToken })

    let supabaseClient: any
    let user = null
    let userError = null

    if (accessToken) {
      const { createClient } = await import('@supabase/supabase-js')
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      )
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Ignore cookie setting errors
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Ignore cookie removal errors
              }
            }
          }
        }
      )
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      console.error('❌ CDSS API: Unauthorized', { userError })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ CDSS API: User authenticated', { userId: user.id })

    // Get appointment ID from request
    const body = await request.json()
    const { appointmentId, isAutoGenerate } = body

    console.log('📋 CDSS API: Request data', { appointmentId, isAutoGenerate })

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Appointment ID is required' },
        { status: 400 }
      )
    }

    // Fetch appointment data from Supabase (including transcription)
    const { data: appointment, error: appointmentError } = await supabaseClient
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Fetch clinical notes from normalized table
    const { data: clinicalNotes } = await supabaseClient
      .from('clinical_notes')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true })

    // Extract notes from clinical_notes table
    let subjectiveNotes = appointment.subjective_notes || ''
    let chiefComplaint = appointment.chief_complaint || ''

    if (clinicalNotes && clinicalNotes.length > 0) {
      clinicalNotes.forEach((note: any) => {
        if (note.note_type === 'chief_complaint' || note.note_type === 'subjective') {
          chiefComplaint = note.content || ''
          subjectiveNotes = note.content || ''
        }
      })
    }

    // Get transcription if available
    const transcription = appointment.transcription || null

    // Combine all text sources for fallback extraction
    const allTextSources = [
      chiefComplaint,
      subjectiveNotes,
      appointment.notes,
      transcription
    ].filter(Boolean).join('\n\n')

    // Build comprehensive CDSS input from frontend data + database fallbacks
    const cdssInput: CDSSInput = {
      // Primary fields - prefer frontend data, fallback to database
      chief_complaint: body.chiefComplaint || chiefComplaint || extractFromText(allTextSources, 'chief_complaint') || '',
      symptoms: body.reasonForVisit || subjectiveNotes || extractFromText(allTextSources, 'symptoms') || '',
      duration: extractDuration(allTextSources),
      severity: extractSeverity(allTextSources),
      allergies: body.patientIntake?.allergies || appointment.allergies || 'NKDA',
      red_flags: extractRedFlags(allTextSources),
      transcription: transcription,
      
      // NEW: Comprehensive data from frontend
      reasonForVisit: body.reasonForVisit || '',
      patientIntake: body.patientIntake || {
        hasDrugAllergies: appointment.has_drug_allergies || false,
        allergies: appointment.allergies || '',
        hasOngoingMedicalIssues: appointment.has_ongoing_medical_issues || false,
        ongoingMedicalIssuesDetails: appointment.ongoing_medical_issues_details || '',
        hasRecentSurgeries: appointment.has_recent_surgeries || false,
        recentSurgeriesDetails: appointment.recent_surgeries_details || ''
      },
      activeProblems: body.activeProblems || [],
      resolvedProblems: body.resolvedProblems || [],
      medicationHistory: body.medicationHistory || [],
      prescriptionLogs: body.prescriptionLogs || [],
      activeMedicationOrders: body.activeMedicationOrders || [],
      pastMedicationOrders: body.pastMedicationOrders || [],
      currentPrescriptions: body.currentPrescriptions || [],
      rosGeneral: body.rosGeneral || appointment.ros_general || '',
      vitals: body.vitals || {
        bp: appointment.vitals_bp,
        hr: appointment.vitals_hr,
        temp: appointment.vitals_temp
      },
      patientInfo: body.patientInfo || {},
      currentSoapNotes: body.currentSoapNotes || {}
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY
    const promptId = process.env.OPENAI_PROMPT_ID
    
    console.log('🔑 CDSS API: Checking API keys', { 
      hasApiKey: !!openaiApiKey, 
      hasPromptId: !!promptId 
    })
    
    if (!openaiApiKey) {
      console.error('❌ CDSS API: OpenAI API key not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }
    
    if (!promptId) {
      console.error('❌ CDSS API: OpenAI Prompt ID not configured')
      return NextResponse.json(
        { error: 'OpenAI Prompt ID not configured' },
        { status: 500 }
      )
    }

    // If this is an auto-generate request, check if CDSS has already been auto-generated
    if (isAutoGenerate && appointment.cdss_auto_generated) {
      // Check if CDSS response exists in database
      const { data: existingCDSS, error: cdssCheckError } = await supabaseClient
        .from('cdss_responses')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // If CDSS exists, return it
      if (existingCDSS && !cdssCheckError && existingCDSS.response_data) {
        return NextResponse.json(existingCDSS.response_data)
      }
      
      // If flag is set but no response exists, return error (shouldn't happen)
      return NextResponse.json(
        { error: 'CDSS already auto-generated but response not found' },
        { status: 404 }
      )
    }

    // // Check if CDSS response already exists for this appointment
    // const { data: existingCDSS, error: cdssCheckError } = await supabaseClient
    //   .from('cdss_responses')
    //   .select('*')
    //   .eq('appointment_id', appointmentId)
    //   .order('created_at', { ascending: false })
    //   .limit(1)
    //   .maybeSingle()

    // // If CDSS exists, return it
    // if (existingCDSS && !cdssCheckError && existingCDSS.response_data) {
    //   return NextResponse.json(existingCDSS.response_data)
    // }

    // Generate CDSS response using OpenAI with comprehensive data
    console.log('🤖 CDSS API: Calling OpenAI to generate response')
    const cdssResponse = await generateCDSSResponse(cdssInput, openaiApiKey)
    console.log('✅ CDSS API: OpenAI response received', {
      hasClassification: !!cdssResponse.classification,
      hasRiskLevel: !!cdssResponse.risk_level
    })

    // Save CDSS response to database
    console.log('💾 CDSS API: Saving response to database')
    const { error: saveError } = await supabaseClient
      .from('cdss_responses')
      .insert({
        appointment_id: appointmentId,
        response_data: cdssResponse,
        created_by: user.id
      })

    if (saveError) {
      console.error('⚠️ CDSS API: Failed to save response', saveError)
      // Still return the response even if save fails
    } else {
      console.log('✅ CDSS API: Response saved to database')
      // If this was an auto-generate request, set the flag in appointments table
      if (isAutoGenerate) {
        const { error: flagError } = await supabaseClient
          .from('appointments')
          .update({ cdss_auto_generated: true })
          .eq('id', appointmentId)
        if (flagError) {
          console.error('⚠️ CDSS API: Failed to set auto-generated flag', flagError)
        }
      }
    }

    console.log('✅ CDSS API: Returning response to client')
    return NextResponse.json(cdssResponse)

  } catch (error: any) {
    console.error('❌ CDSS API: Error in POST handler', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to extract information from text (for fallback when fields are empty)
function extractFromText(text: string, type: 'chief_complaint' | 'symptoms'): string {
  if (!text) return ''
  
  // For chief complaint, look for patterns like "complains of", "presents with", etc.
  if (type === 'chief_complaint') {
    const patterns = [
      /(?:chief complaint|presents? with|complains? of|concerned about)[:\s]+([^.\n]+)/i,
      /(?:reason for visit|main concern)[:\s]+([^.\n]+)/i
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  }
  
  // For symptoms, return first few sentences or lines
  if (type === 'symptoms') {
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10)
    if (sentences.length > 0) {
      return sentences.slice(0, 3).join('. ').trim()
    }
  }
  
  return ''
}

// Helper function to extract duration from text
function extractDuration(text: string): string {
  if (!text) return ''
  
  // Look for common duration patterns
  const durationPatterns = [
    /\b(\d+)\s*(day|days|week|weeks|month|months|year|years|hour|hours|minute|minutes)\b/gi,
    /\b(for|since|over|about)\s+(\d+)\s*(day|days|week|weeks|month|months|year|years|hour|hours)\b/gi,
    /\b(acute|chronic|recent|long-standing)\b/gi
  ]

  for (const pattern of durationPatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return ''
}

// Helper function to extract severity from text
function extractSeverity(text: string): string {
  if (!text) return ''
  
  const severityKeywords = {
    severe: ['severe', 'severe pain', 'severe symptoms', 'severe discomfort', 'intense', 'excruciating'],
    moderate: ['moderate', 'moderate pain', 'moderate symptoms', 'moderate discomfort', 'moderate severity'],
    mild: ['mild', 'mild pain', 'mild symptoms', 'mild discomfort', 'slight', 'minor']
  }

  const lowerText = text.toLowerCase()
  
  for (const [severity, keywords] of Object.entries(severityKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return severity
      }
    }
  }

  return 'moderate' // default
}

// Helper function to extract red flags from text
function extractRedFlags(text: string): string[] {
  if (!text) return []
  
  const redFlagKeywords = [
    'chest pain', 'shortness of breath', 'difficulty breathing',
    'severe headache', 'loss of consciousness', 'severe abdominal pain',
    'high fever', 'severe bleeding', 'severe trauma',
    'neurological symptoms', 'severe allergic reaction', 'anaphylaxis',
    'severe dehydration', 'severe infection', 'sepsis'
  ]

  const lowerText = text.toLowerCase()
  const foundFlags: string[] = []

  for (const flag of redFlagKeywords) {
    if (lowerText.includes(flag)) {
      foundFlags.push(flag)
    }
  }

  return foundFlags
}

// Build comprehensive clinical context for OpenAI
function buildClinicalContext(input: CDSSInput): string {
  const sections: string[] = []

  // Chief Complaint & Reason for Visit
  sections.push(`## CHIEF COMPLAINT / REASON FOR VISIT`)
  sections.push(`Chief Complaint: ${input.chief_complaint || 'Not specified'}`)
  if (input.symptoms) {
    sections.push(`Additional Symptoms: ${input.symptoms}`)
  }
  if (input.duration) {
    sections.push(`Duration: ${input.duration}`)
  }
  if (input.severity) {
    sections.push(`Severity: ${input.severity}`)
  }

  // Patient Intake Answers
  if (input.patientIntake) {
    sections.push(`\n## PATIENT INTAKE RESPONSES`)
    sections.push(`Drug Allergies: ${input.patientIntake.hasDrugAllergies ? `YES - ${input.patientIntake.allergies}` : 'None reported (NKDA)'}`)
    sections.push(`Ongoing Medical Issues: ${input.patientIntake.hasOngoingMedicalIssues ? `YES - ${input.patientIntake.ongoingMedicalIssuesDetails}` : 'None reported'}`)
    sections.push(`Recent Surgeries: ${input.patientIntake.hasRecentSurgeries ? `YES - ${input.patientIntake.recentSurgeriesDetails}` : 'None reported'}`)
  }

  // Red Flags
  if (input.red_flags && input.red_flags.length > 0) {
    sections.push(`\n## RED FLAGS IDENTIFIED`)
    input.red_flags.forEach(flag => sections.push(`⚠️ ${flag}`))
  }

  // Active Problems
  if (input.activeProblems && input.activeProblems.length > 0) {
    sections.push(`\n## ACTIVE PROBLEMS`)
    input.activeProblems.forEach(problem => sections.push(`- ${problem}`))
  }

  // Resolved Problems
  if (input.resolvedProblems && input.resolvedProblems.length > 0) {
    sections.push(`\n## RESOLVED PROBLEMS (Historical)`)
    input.resolvedProblems.forEach(p => sections.push(`- ${p.problem} (resolved: ${p.resolvedDate})`))
  }

  // Current Prescriptions in eRx Composer
  if (input.currentPrescriptions && input.currentPrescriptions.length > 0) {
    sections.push(`\n## PRESCRIPTIONS BEING ORDERED (Current Session)`)
    input.currentPrescriptions.forEach(rx => {
      sections.push(`- ${rx.medication}: ${rx.sig} | Qty: ${rx.qty} | Refills: ${rx.refills}${rx.notes ? ` | Notes: ${rx.notes}` : ''}`)
    })
  }

  // Active Medication Orders
  if (input.activeMedicationOrders && input.activeMedicationOrders.length > 0) {
    sections.push(`\n## ACTIVE MEDICATION ORDERS`)
    input.activeMedicationOrders.forEach(order => {
      sections.push(`- ${order.medication}: ${order.sig} | Status: ${order.status}`)
    })
  }

  // Medication History
  if (input.medicationHistory && input.medicationHistory.length > 0) {
    sections.push(`\n## MEDICATION HISTORY (Surescripts/Historical)`)
    input.medicationHistory.forEach(med => {
      sections.push(`- ${med.medication} | Provider: ${med.provider} | Date: ${med.date}`)
    })
  }

  // Past Medication Orders
  if (input.pastMedicationOrders && input.pastMedicationOrders.length > 0) {
    sections.push(`\n## PAST MEDICATION ORDERS`)
    input.pastMedicationOrders.forEach(order => {
      sections.push(`- ${order.medication}: ${order.sig} | Date: ${order.date}`)
    })
  }

  // Prescription Logs
  if (input.prescriptionLogs && input.prescriptionLogs.length > 0) {
    sections.push(`\n## PRESCRIPTION LOGS`)
    input.prescriptionLogs.forEach(log => {
      sections.push(`- ${log.date}: ${log.medication} #${log.quantity} @ ${log.pharmacy} | Status: ${log.status}`)
    })
  }

  // ROS General
  if (input.rosGeneral) {
    sections.push(`\n## REVIEW OF SYSTEMS`)
    sections.push(input.rosGeneral)
  }

  // Vitals
  if (input.vitals && (input.vitals.bp || input.vitals.hr || input.vitals.temp)) {
    sections.push(`\n## VITALS`)
    if (input.vitals.bp) sections.push(`Blood Pressure: ${input.vitals.bp}`)
    if (input.vitals.hr) sections.push(`Heart Rate: ${input.vitals.hr}`)
    if (input.vitals.temp) sections.push(`Temperature: ${input.vitals.temp}`)
  }

  // Patient Demographics
  if (input.patientInfo && (input.patientInfo.dateOfBirth || input.patientInfo.location)) {
    sections.push(`\n## PATIENT DEMOGRAPHICS`)
    if (input.patientInfo.dateOfBirth) {
      const age = calculateAge(input.patientInfo.dateOfBirth)
      sections.push(`Age: ${age} years old`)
    }
    if (input.patientInfo.location) {
      sections.push(`Location: ${input.patientInfo.location}`)
    }
  }

  // Transcription
  if (input.transcription) {
    sections.push(`\n## VISIT TRANSCRIPTION`)
    sections.push(input.transcription)
  }

  // Current SOAP Notes
  if (input.currentSoapNotes && (input.currentSoapNotes.subjective || input.currentSoapNotes.assessmentPlan)) {
    sections.push(`\n## CURRENT SOAP NOTES (In Progress)`)
    if (input.currentSoapNotes.subjective) sections.push(`Subjective: ${input.currentSoapNotes.subjective}`)
    if (input.currentSoapNotes.rosGeneral) sections.push(`ROS: ${input.currentSoapNotes.rosGeneral}`)
    if (input.currentSoapNotes.assessmentPlan) sections.push(`Assessment/Plan: ${input.currentSoapNotes.assessmentPlan}`)
  }

  return sections.join('\n')
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

// Generate CDSS response using OpenAI
async function generateCDSSResponse(input: CDSSInput, apiKey: string): Promise<CDSSResponse> {
  const promptId = process.env.OPENAI_PROMPT_ID
  
  // Build comprehensive clinical context
  const clinicalContext = buildClinicalContext(input)

  // Prepare payload - include both structured data and clinical context
  const userPayload = {
    chief_complaint: input.chief_complaint || 'Not provided',
    symptoms: input.symptoms || 'Not provided',
    duration: input.duration || 'Not provided',
    severity: input.severity || 'Not provided',
    allergies: input.allergies || 'NKDA',
    red_flags: input.red_flags.length > 0 ? input.red_flags : ['None identified'],
    transcription: input.transcription || null,
    // Include comprehensive clinical context
    clinical_context: clinicalContext,
    // Include structured data for analysis
    patient_intake: input.patientIntake,
    active_problems: input.activeProblems,
    medication_history: input.medicationHistory,
    current_prescriptions: input.currentPrescriptions,
    active_medication_orders: input.activeMedicationOrders
  }

  try {
    const client = new OpenAI({ apiKey })

    // Try using Prompt API if promptId is configured
    if (promptId) {
      try {
        console.log('📡 OpenAI: Trying Prompt API (responses.create) with prompt ID:', promptId.substring(0, 15) + '...')
        const inputMessages = [
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(userPayload) }]
          }
        ]

        const response = await Promise.race([
          client.responses.create({
            prompt: { id: promptId },
            input: inputMessages
          } as any),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Prompt API timeout')), 90000)
          )
        ]) as any

        const outputText = (response as any).output_text ||
          (() => {
            try {
              const firstItem = (response as any).output?.[0]
              const firstContent = firstItem?.content?.[0]
              return firstContent?.text || ''
            } catch { return '' }
          })()

        if (outputText) {
          console.log('✅ OpenAI: Prompt API succeeded')
          const cdssResponse: CDSSResponse = JSON.parse(outputText)
          return validateAndEnrichResponse(cdssResponse, input)
        }
      } catch (promptError: any) {
        console.log('⚠️ OpenAI: Prompt API failed, falling back to Chat Completions:', promptError.message)
      }
    }

    // Fallback to Chat Completions API with comprehensive system prompt
    console.log('📡 OpenAI: Using Chat Completions API (fallback)')
    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a Clinical Decision Support System (CDSS) for a telemedicine platform specializing in UTI and STD treatment.

ANALYZE the comprehensive patient data provided and generate:
1. Risk classification and assessment
2. Medication recommendations based on IDSA/CDC/AAFP guidelines
3. Drug interaction and allergy alerts
4. SOAP note templates
5. Clinical pearls and safety notes

CRITICAL REQUIREMENTS:
- ALWAYS check allergies before recommending medications
- Review medication history to avoid duplicates/interactions
- Consider active problems and current medications
- Flag any contraindications or concerns
- Follow evidence-based guidelines

Respond in JSON format:
{
  "analysis_summary": "Brief clinical analysis summary",
  "classification": { "category": "...", "description": "..." },
  "risk_level": "low_risk|moderate_risk|high_risk|urgent_escalation",
  "risk_factors": ["..."],
  "allergy_alerts": ["warnings based on reported allergies"],
  "interaction_alerts": ["drug interaction warnings"],
  "templates": { "hpi": "...", "ros_general": "...", "assessment": "...", "plan": "..." },
  "medication_suggestions": {
    "medications": [{ "medication": "...", "sig": "...", "quantity": "...", "refills": 0, "notes": "...", "rationale": "...", "guidelines": "..." }],
    "safety_notes": ["..."],
    "alternatives": ["..."]
  },
  "soap_note": { "chief_complaint": "...", "hpi": "...", "ros": "...", "assessment": "...", "plan": "..." },
  "clinical_pearls": ["..."],
  "follow_up_recommendations": "..."
}`
        },
        {
          role: 'user',
          content: `Please analyze this patient case:\n\n${clinicalContext}\n\nStructured Data: ${JSON.stringify(userPayload)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    })

    const responseText = completion.choices[0].message.content || '{}'
    console.log('✅ OpenAI: Chat Completions API succeeded')
    const cdssResponse: CDSSResponse = JSON.parse(responseText)
    return validateAndEnrichResponse(cdssResponse, input)

  } catch (error: any) {
    console.error('❌ OpenAI: CDSS Generation Error:', error)
    return generateFallbackResponse(input)
  }
}

// Validate and enrich CDSS response
function validateAndEnrichResponse(response: CDSSResponse, input: CDSSInput): CDSSResponse {
  // Add allergy alerts if allergies reported
  if (input.patientIntake?.hasDrugAllergies && input.patientIntake.allergies) {
    const allergyAlert = `⚠️ PATIENT HAS DRUG ALLERGIES: ${input.patientIntake.allergies}`
    response.allergy_alerts = response.allergy_alerts || []
    if (!response.allergy_alerts.includes(allergyAlert)) {
      response.allergy_alerts.unshift(allergyAlert)
    }
  }

  return {
    classification: response.classification || { category: 'General', description: 'Requires clinical review' },
    risk_level: response.risk_level || 'moderate_risk',
    risk_factors: response.risk_factors || [],
    allergy_alerts: response.allergy_alerts || [],
    interaction_alerts: response.interaction_alerts || [],
    templates: response.templates || { hpi: '', ros_general: '', assessment: '', plan: '' },
    medication_suggestions: response.medication_suggestions || { medications: [], safety_notes: [] },
    soap_note: response.soap_note || { chief_complaint: input.chief_complaint, hpi: '', ros: '', assessment: '', plan: '' },
    clinical_pearls: response.clinical_pearls || [],
    follow_up_recommendations: response.follow_up_recommendations || '',
    analysis_summary: response.analysis_summary || ''
  }
}

// Generate fallback response when AI fails
function generateFallbackResponse(input: CDSSInput): CDSSResponse {
  const allergyNotes: string[] = []
  if (input.patientIntake?.hasDrugAllergies && input.patientIntake.allergies) {
    allergyNotes.push(`⚠️ PATIENT HAS DRUG ALLERGIES: ${input.patientIntake.allergies}`)
  }

  return {
    classification: { category: 'General', description: 'Unable to generate classification. Please review manually.' },
    risk_level: input.red_flags.length > 0 ? 'high_risk' : 'moderate_risk',
    risk_factors: input.red_flags.length > 0 ? input.red_flags : ['Insufficient information'],
    allergy_alerts: allergyNotes,
    interaction_alerts: [],
    templates: {
      hpi: `Patient presents with: ${input.chief_complaint || 'symptoms'}. ${input.symptoms || ''}`,
      ros_general: 'Review of systems should be completed based on chief complaint.',
      assessment: 'Clinical assessment pending provider review.',
      plan: 'Treatment plan to be determined by provider.'
    },
    medication_suggestions: {
      medications: [],
      safety_notes: allergyNotes
    },
    soap_note: {
      chief_complaint: input.chief_complaint || '',
      hpi: `Patient presents with: ${input.chief_complaint || 'symptoms'}. ${input.symptoms || ''} Duration: ${input.duration || 'Not specified'}. Severity: ${input.severity || 'Not specified'}.`,
      ros: 'Review of systems to be completed.',
      assessment: 'Clinical assessment pending.',
      plan: 'Treatment plan pending provider review.'
    },
    clinical_pearls: [],
    follow_up_recommendations: 'Follow up as clinically indicated.',
    analysis_summary: 'CDSS analysis could not be generated. Please review patient data manually.'
  }
}

