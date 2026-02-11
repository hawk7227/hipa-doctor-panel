'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Phone, Mail, Calendar, Eye, Edit, Trash2, X, Activity, Plus, Pill, Search } from 'lucide-react'
import AppointmentDetailModal from '@/components/AppointmentDetailModal'

interface Patient {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile_phone: string
  date_of_birth: string
  address: string
  created_at: string
  appointments_count: number
  last_appointment: string
  last_appointment_status: string
  appointments: Array<{
    id: string
    status: string
    service_type: string
    visit_type: string
    created_at: string
    requested_date_time: string | null
  }>
  // Track merged patient IDs for data operations
  merged_patient_ids?: string[]
  // Medical chart fields
  allergies?: string | null
  current_medications?: string | null
  active_problems?: string | null
  recent_surgeries_details?: string | null
  ongoing_medical_issues_details?: string | null
  vitals_bp?: string | null
  vitals_hr?: string | null
  vitals_temp?: string | null
  preferred_pharmacy?: string | null
  chief_complaint?: string | null
  ros_general?: string | null
  resolved_problems?: any[] | null
  medication_history?: any[] | null
  active_medication_orders?: any[] | null
  past_medication_orders?: any[] | null
  prescription_logs?: any[] | null
}

export default function DoctorPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentDoctor, setCurrentDoctor] = useState<any>(null)
  const [searchSuggestions, setSearchSuggestions] = useState<Patient[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [recordFilter, setRecordFilter] = useState<'all' | 'prescription' | 'lab_result' | 'visit_summary'>('all')
  const [recordCounts, setRecordCounts] = useState<{
    all: number
    prescription: number
    lab_result: number
    visit_summary: number
  }>({
    all: 0,
    prescription: 0,
    lab_result: 0,
    visit_summary: 0
  })
  const [patientRecordMap, setPatientRecordMap] = useState<Map<string, {
    prescription: number
    lab_result: number
    visit_summary: number
  }>>(new Map())
  const [upcomingAppointments, setUpcomingAppointments] = useState<Array<{
    id: string
    requested_date_time: string | null
    status: string
    visit_type: string | null
    patient: {
      first_name: string
      last_name: string
      email: string
    } | null
  }>>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [patientChartData, setPatientChartData] = useState<Patient | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'chart'>('overview')
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_phone: '',
    date_of_birth: '',
    address: ''
  })
  
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

  useEffect(() => {
    fetchCurrentDoctor()
    fetchPatients()
  }, [])

  useEffect(() => {
    if (currentDoctor) {
      fetchUpcomingAppointmentsForDoctor(currentDoctor.id)
      fetchPatientRecordCounts()
    }
  }, [currentDoctor])

  const fetchPatientRecordCounts = async () => {
    if (!currentDoctor || patients.length === 0) return

    try {
      // Get all patient IDs
      const patientIds = patients.map(p => p.id)
      
      if (patientIds.length === 0) return

      // Batch queries to avoid very long URLs (chunk size: 50)
      const BATCH_SIZE = 50
      const batches: string[][] = []
      for (let i = 0; i < patientIds.length; i += BATCH_SIZE) {
        batches.push(patientIds.slice(i, i + BATCH_SIZE))
      }

      // Fetch medical records for this doctor's patients (using user_id) - batched
      let medicalRecords: any[] = []
      let recordsError: any = null
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('medical_records')
          .select('user_id, record_type')
          .eq('is_shared', true)
          .in('user_id', batch)
        if (data) medicalRecords.push(...data)
        if (error && !recordsError) recordsError = error
      }

      // Fetch prescriptions for this doctor's patients (using patient_id) - batched
      let prescriptions: any[] = []
      let prescriptionsError: any = null
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('prescriptions')
          .select('patient_id')
          .eq('doctor_id', currentDoctor.id)
          .in('patient_id', batch)
        if (data) prescriptions.push(...data)
        if (error && !prescriptionsError) prescriptionsError = error
      }

      // Fetch appointments for this doctor's patients (for visit summaries) - batched
      let appointments: any[] = []
      let appointmentsError: any = null
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, patient_id')
          .eq('doctor_id', currentDoctor.id)
          .in('patient_id', batch)
        if (data) appointments.push(...data)
        if (error && !appointmentsError) appointmentsError = error
      }

      if (recordsError) {
        console.error('Error fetching medical records:', recordsError.message || recordsError.code || recordsError)
      }
      if (prescriptionsError) {
        console.error('Error fetching prescriptions:', prescriptionsError.message || prescriptionsError.code || prescriptionsError)
      }
      if (appointmentsError) {
        console.error('Error fetching appointments:', appointmentsError.message || appointmentsError.code || appointmentsError)
      }

      // Count records by type and patient
      const recordMap = new Map<string, {
        prescription: number
        lab_result: number
        visit_summary: number
      }>()

      // Initialize all patients in the map
      patientIds.forEach(id => {
        recordMap.set(id, { prescription: 0, lab_result: 0, visit_summary: 0 })
      })

      // Process medical records (user_id maps to patient id)
      if (medicalRecords && Array.isArray(medicalRecords)) {
        medicalRecords.forEach((record: any) => {
          const patientId = record?.user_id
          if (!patientId || !recordMap.has(patientId)) return

          const counts = recordMap.get(patientId)!
          if (record.record_type === 'prescription') counts.prescription++
          if (record.record_type === 'lab_result') counts.lab_result++
          if (record.record_type === 'visit_summary') counts.visit_summary++
        })
      }

      // Process prescriptions (prescriptions table uses patient_id)
      if (prescriptions && Array.isArray(prescriptions)) {
        prescriptions.forEach((prescription: any) => {
          const patientId = prescription?.patient_id
          if (!patientId || !recordMap.has(patientId)) return

          const counts = recordMap.get(patientId)!
          counts.prescription++
        })
      }

      // Process appointment documents for visit summaries - batched
      if (appointments && Array.isArray(appointments) && appointments.length > 0) {
        const appointmentIds = appointments.map((a: any) => a?.id).filter(Boolean)
        const appointmentToPatient = new Map(appointments.map((a: any) => [a?.id, a?.patient_id]))
        
        if (appointmentIds.length > 0) {
          // Batch appointment IDs too
          const appointmentBatches: string[][] = []
          for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
            appointmentBatches.push(appointmentIds.slice(i, i + BATCH_SIZE))
          }

          let appointmentDocs: any[] = []
          let docsError: any = null
          for (const batch of appointmentBatches) {
            const { data, error } = await supabase
              .from('files')
              .select('appointment_id, file_type')
              .eq('is_shared', true)
              .in('appointment_id', batch)
              .or('file_type.eq.visit_summary,file_type.eq.summary')
            if (data) appointmentDocs.push(...data)
            if (error && !docsError) docsError = error
          }

          if (docsError) {
            console.error('Error fetching appointment documents:', docsError.message || docsError.code || docsError)
          }

          if (!docsError && appointmentDocs && Array.isArray(appointmentDocs)) {
            appointmentDocs.forEach((doc: any) => {
              const patientId = appointmentToPatient.get(doc?.appointment_id)
              if (patientId && recordMap.has(patientId)) {
                const counts = recordMap.get(patientId)!
                counts.visit_summary++
              }
            })
          }
        }
      }

      setPatientRecordMap(recordMap)

      // Calculate total counts - count actual number of records, not patients
      let totalPrescriptions = 0
      let totalLabResults = 0
      let totalVisitSummaries = 0

      recordMap.forEach((counts) => {
        totalPrescriptions += counts.prescription
        totalLabResults += counts.lab_result
        totalVisitSummaries += counts.visit_summary
      })

      // Total all records count
      const totalAllRecords = totalPrescriptions + totalLabResults + totalVisitSummaries

      const counts = {
        all: totalAllRecords, // Total number of all records
        prescription: totalPrescriptions, // Total number of prescription records
        lab_result: totalLabResults, // Total number of lab result records
        visit_summary: totalVisitSummaries // Total number of visit summary records
      }

      setRecordCounts(counts)
    } catch (error: any) {
      console.error('Unexpected error in fetchPatientRecordCounts:', error?.message || error?.toString() || error)
      console.error('Error fetching patient record counts:', error)
    }
  }

  const fetchCurrentDoctor = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: doctor, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('email', user.email)
          .single()
        
        if (doctor) {
          setCurrentDoctor(doctor)
          // Fetch upcoming appointments after doctor is set
          fetchUpcomingAppointmentsForDoctor(doctor.id)
        }
      }
    } catch (error) {
      console.error('Error fetching current doctor:', error)
    }
  }

  const fetchUpcomingAppointmentsForDoctor = async (doctorId: string) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          requested_date_time,
          status,
          visit_type,
          patients!appointments_patient_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('doctor_id', doctorId)
        .in('status', ['accepted', 'pending'])
        .gte('requested_date_time', todayEnd.toISOString())
        .order('requested_date_time', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Error fetching upcoming appointments:', error)
        return
      }

      const formattedAppointments = (appointments || []).map((apt: any) => ({
        id: apt.id,
        requested_date_time: apt.requested_date_time,
        status: apt.status,
        visit_type: apt.visit_type,
        patient: apt.patients ? {
          first_name: apt.patients.first_name || '',
          last_name: apt.patients.last_name || '',
          email: apt.patients.email || ''
        } : null
      }))

      setUpcomingAppointments(formattedAppointments)
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error)
    }
  }

  // Consolidate patients by email - merges duplicates into single records
  const consolidatePatientsByEmail = (patients: Patient[]): Patient[] => {
    const emailMap = new Map<string, Patient>()
    
    patients.forEach(patient => {
      const email = patient.email?.toLowerCase().trim()
      if (!email) {
        // Keep patients without email as-is
        emailMap.set(patient.id, patient)
        return
      }
      
      const existing = emailMap.get(email)
      if (!existing) {
        emailMap.set(email, {
          ...patient,
          merged_patient_ids: [patient.id]
        })
      } else {
        // Merge appointments from duplicate patient
        const mergedAppointments = [...(existing.appointments || []), ...(patient.appointments || [])]
        // Sort by created_at descending
        mergedAppointments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        // Keep the most complete/recent patient info
        const useNewer = new Date(patient.created_at) > new Date(existing.created_at)
        
        emailMap.set(email, {
          ...existing,
          // Use newer patient's basic info if available
          first_name: (useNewer && patient.first_name) ? patient.first_name : existing.first_name,
          last_name: (useNewer && patient.last_name) ? patient.last_name : existing.last_name,
          mobile_phone: patient.mobile_phone || existing.mobile_phone,
          date_of_birth: patient.date_of_birth || existing.date_of_birth,
          address: patient.address || existing.address,
          // Merge appointments
          appointments: mergedAppointments,
          appointments_count: mergedAppointments.length,
          // Use most recent appointment info
          last_appointment: mergedAppointments[0]?.created_at || existing.last_appointment,
          last_appointment_status: mergedAppointments[0]?.status || existing.last_appointment_status,
          // Track all merged patient IDs
          merged_patient_ids: [...(existing.merged_patient_ids || [existing.id]), patient.id]
        })
      }
    })
    
    return Array.from(emailMap.values())
  }

  const fetchPatients = async () => {
    try {
      // Get all patients with their appointments
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          location,
          created_at,
          appointments:appointments!appointments_patient_id_fkey (
            id,
            status,
            service_type,
            visit_type,
            created_at,
            requested_date_time
          )
        `)
        .order('created_at', { ascending: false })

      if (patientsError) {
        console.error('Error fetching patients:', patientsError)
        return
      }

      // Process patients with their appointments
      const processedPatients = (patientsData || []).map(patient => {
        const appointments = (patient.appointments as any[]) || []
        const sortedAppointments = appointments.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        
        return {
          id: patient.id,
          first_name: patient.first_name || '',
          last_name: patient.last_name || '',
          email: patient.email || '',
          mobile_phone: patient.phone || '',
          date_of_birth: patient.date_of_birth || '',
          address: patient.location || '',
          created_at: patient.created_at || '',
          appointments_count: appointments.length,
          last_appointment: sortedAppointments[0]?.created_at || patient.created_at,
          last_appointment_status: sortedAppointments[0]?.status || '',
          appointments: sortedAppointments.map(apt => ({
            id: apt.id,
            status: apt.status,
            service_type: apt.service_type,
            visit_type: apt.visit_type,
            created_at: apt.created_at,
            requested_date_time: apt.requested_date_time
          }))
        }
      })

      // Consolidate patients by email to merge duplicates
      const consolidatedPatients = consolidatePatientsByEmail(processedPatients)
      setPatients(consolidatedPatients)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch record counts when patients or doctor changes
  useEffect(() => {
    if (currentDoctor && patients.length > 0) {
      const timer = setTimeout(() => {
        fetchPatientRecordCounts()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentDoctor?.id, patients.length])

  // Refresh record counts when filter changes
  useEffect(() => {
    if (showAllRecords && currentDoctor && patients.length > 0) {
      fetchPatientRecordCounts()
    }
  }, [recordFilter, showAllRecords])

  const fetchPatientChart = async (patientId: string) => {
    setIsLoadingChart(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          location,
          created_at,
          allergies,
          current_medications,
          active_problems,
          recent_surgeries_details,
          ongoing_medical_issues_details,
          vitals_bp,
          vitals_hr,
          vitals_temp,
          preferred_pharmacy,
          chief_complaint,
          ros_general
        `)
        .eq('id', patientId)
        .single()

      if (error) throw error

      if (data) {
        // Fetch ALL appointments for this patient (complete history)
        const { data: allAppointmentsData } = await supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })

        // Fetch active problems from normalized table
        const { data: activeProblemsData } = await supabase
          .from('problems')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        let parsedActiveProblems: Array<{id: string, problem: string, since: string}> = []
        if (activeProblemsData && activeProblemsData.length > 0) {
          parsedActiveProblems = activeProblemsData.map((p, idx) => ({
            id: p.id || `ap-${idx}`,
            problem: p.problem_name || '',
            since: p.onset_date ? new Date(p.onset_date).toISOString().split('T')[0] : ''
          }))
        } else if (data.active_problems) {
          // Fallback to old field for backward compatibility
          try {
            const parsed = typeof data.active_problems === 'string' ? JSON.parse(data.active_problems) : data.active_problems
            if (Array.isArray(parsed)) {
              parsedActiveProblems = parsed.map((p: any, idx: number) => ({
                id: p.id || `ap-${idx}`,
                problem: typeof p === 'string' ? p : p.problem || p,
                since: typeof p === 'string' ? '' : p.since || ''
              }))
            } else if (typeof parsed === 'string') {
              parsedActiveProblems = [{id: 'ap-0', problem: parsed, since: ''}]
            }
          } catch {
            parsedActiveProblems = [{id: 'ap-0', problem: data.active_problems, since: ''}]
          }
        }

        // Fetch resolved problems
        const { data: resolvedProblemsData } = await supabase
          .from('problems')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'resolved')
          .order('created_at', { ascending: false })

        const parsedResolvedProblems = resolvedProblemsData?.map((p, idx) => ({
          id: p.id || `rp-${idx}`,
          problem: p.problem_name || '',
          resolvedDate: p.resolved_date ? new Date(p.resolved_date).toISOString().split('T')[0] : ''
        })) || []

        // Fetch ALL medication history
        const { data: medHistoryData } = await supabase
          .from('medication_history')
          .select('*')
          .eq('patient_id', patientId)
          .order('start_date', { ascending: false })

        const parsedMedHistory = medHistoryData?.map((m, idx) => ({
          id: m.id || `mh-${idx}`,
          medication: m.medication_name || '',
          provider: m.prescriber || 'External Provider',
          date: m.start_date ? new Date(m.start_date).toISOString().split('T')[0] : ''
        })) || []

        // Fetch active medication orders
        const { data: activeOrdersData } = await supabase
          .from('medication_orders')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        const parsedActiveOrders = activeOrdersData?.map((m, idx) => ({
          id: m.id || `amo-${idx}`,
          medication: m.medication_name || '',
          sig: m.dosage || '',
          status: m.status || 'Sent'
        })) || []

        // Fetch ALL past/completed medication orders
        const { data: pastOrdersData } = await supabase
          .from('medication_orders')
          .select('*')
          .eq('patient_id', patientId)
          .in('status', ['completed', 'discontinued', 'expired'])
          .order('created_at', { ascending: false })

        const parsedPastOrders = pastOrdersData?.map((m, idx) => ({
          id: m.id || `pmo-${idx}`,
          medication: m.medication_name || '',
          sig: m.dosage || '',
          date: m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : ''
        })) || []

        // Fetch ALL prescription logs from ALL appointments (not just latest)
        let parsedPrescriptionLogs: Array<any> = []
        if (allAppointmentsData && allAppointmentsData.length > 0) {
          const appointmentIds = allAppointmentsData.map(apt => apt.id)
          
          const { data: allPrescriptionLogsData } = await supabase
            .from('prescription_logs')
            .select('*')
            .in('appointment_id', appointmentIds)
            .order('action_at', { ascending: false })

          if (allPrescriptionLogsData && allPrescriptionLogsData.length > 0) {
            parsedPrescriptionLogs = allPrescriptionLogsData.map((p, idx) => {
              const notes = p.notes || ''
              const medMatch = notes.match(/(.+?)\s*-\s*Qty:/)
              const qtyMatch = notes.match(/Qty:\s*(.+?)\s*-/)
              const pharmMatch = notes.match(/Pharmacy:\s*(.+)/)
              
              return {
                id: p.id || `pl-${idx}`,
                date: p.action_at ? new Date(p.action_at).toISOString().split('T')[0] : '',
                medication: medMatch ? medMatch[1].trim() : notes,
                quantity: qtyMatch ? qtyMatch[1].trim() : '',
                pharmacy: pharmMatch ? pharmMatch[1].trim() : '',
                status: p.action || 'Sent'
              }
            })
          }
        }

        setActiveProblems(parsedActiveProblems)
        setResolvedProblems(parsedResolvedProblems)
        setMedicationHistory(parsedMedHistory)
        setActiveMedOrders(parsedActiveOrders)
        setPastMedOrders(parsedPastOrders)
        setPrescriptionLogs(parsedPrescriptionLogs)

        // Fetch surgeries from clinical_notes (normalized table)
        const { data: surgeriesData } = await supabase
          .from('clinical_notes')
          .select('content')
          .eq('patient_id', patientId)
          .eq('note_type', 'surgeries')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Fetch medical issues from problems table (active problems)
        const medicalIssuesText = parsedActiveProblems.length > 0
          ? parsedActiveProblems.map(p => p.problem).filter(Boolean).join(', ')
          : ''

        setPatientChartData({
          ...data,
          mobile_phone: data.phone || '',
          address: data.location || '',
          appointments_count: allAppointmentsData?.length || selectedPatient?.appointments_count || 0,
          last_appointment: allAppointmentsData?.[0]?.created_at || selectedPatient?.last_appointment || '',
          last_appointment_status: allAppointmentsData?.[0]?.status || selectedPatient?.last_appointment_status || '',
          appointments: allAppointmentsData?.map(apt => ({
            id: apt.id,
            status: apt.status,
            service_type: apt.service_type,
            visit_type: apt.visit_type,
            created_at: apt.created_at,
            requested_date_time: apt.requested_date_time
          })) || selectedPatient?.appointments || [],
          // Use normalized data with fallback to old fields
          recent_surgeries_details: surgeriesData?.content || data.recent_surgeries_details || '',
          ongoing_medical_issues_details: medicalIssuesText || data.ongoing_medical_issues_details || ''
        })
      }
    } catch (error) {
      console.error('Error fetching patient chart:', error)
    } finally {
      setIsLoadingChart(false)
    }
  }

  // Debounced search for suggestions
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timeoutId = setTimeout(() => {
      const searchLower = searchTerm.toLowerCase().trim()
      // Strip non-digits for phone matching
      const searchDigits = searchLower.replace(/[\s\-\(\)\+\.]/g, '')
      const isPhoneSearch = /^\d{3,}$/.test(searchDigits)
      // Check if DOB search (MM/DD/YYYY or similar)
      const isDOBSearch = /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(searchLower) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(searchLower)
      // Check "Last, First" format
      const hasComma = searchLower.includes(',')
      let firstName = '', lastName = ''
      if (hasComma) {
        const parts = searchLower.split(',').map(s => s.trim())
        lastName = parts[0] || ''
        firstName = parts[1] || ''
      }

      const matches = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()

        // Phone search
        if (isPhoneSearch) {
          const patientDigits = (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '')
          return patientDigits.includes(searchDigits)
        }

        // DOB search
        if (isDOBSearch) {
          const dob = patient.date_of_birth || ''
          const dobFormatted = dob ? new Date(dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''
          return dob.includes(searchLower) || dobFormatted.includes(searchLower)
        }

        // "Last, First" search
        if (hasComma && lastName) {
          const matchLast = patient.last_name.toLowerCase().includes(lastName)
          const matchFirst = !firstName || patient.first_name.toLowerCase().includes(firstName)
          return matchLast && matchFirst
        }

        // Default: name + email + phone + DOB combined search
        return (
          fullName.includes(searchLower) ||
          patient.first_name.toLowerCase().includes(searchLower) ||
          patient.last_name.toLowerCase().includes(searchLower) ||
          patient.email.toLowerCase().includes(searchLower) ||
          (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '').includes(searchDigits && searchDigits.length >= 3 ? searchDigits : '___NOMATCH___') ||
          (patient.date_of_birth || '').includes(searchLower)
        )
      }).slice(0, 10) // Limit to 10 suggestions
      
      setSearchSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    }, 200) // 200ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, patients])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

const handleSuggestionClick = (patient: Patient) => {
  setSearchTerm(`${patient.first_name} ${patient.last_name}`)
  setShowSuggestions(false)
  // Open patient chart directly when selecting from dropdown
  handleViewPatient(patient)
}

  const filteredPatients = patients.filter(patient => {
    // First filter by search term — searches name, email, phone, DOB
    const searchLower = searchTerm.toLowerCase().trim()
    const searchDigits = searchLower.replace(/[\s\-\(\)\+\.]/g, '')
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
    const patientPhone = (patient.mobile_phone || '').replace(/[\s\-\(\)\+\.]/g, '')
    
    const matchesSearch = !searchLower ||
      fullName.includes(searchLower) ||
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower) ||
      patient.email.toLowerCase().includes(searchLower) ||
      (searchDigits.length >= 3 && patientPhone.includes(searchDigits)) ||
      (patient.date_of_birth || '').includes(searchLower)

    if (!matchesSearch) return false

    // Then filter by record type if not 'all'
    if (recordFilter === 'all') return true

    const patientRecords = patientRecordMap.get(patient.id)
    if (!patientRecords) return false

    // Filter by specific record type - show patients that have at least one record of that type
    if (recordFilter === 'prescription' && patientRecords.prescription > 0) return true
    if (recordFilter === 'lab_result' && patientRecords.lab_result > 0) return true
    if (recordFilter === 'visit_summary' && patientRecords.visit_summary > 0) return true

    return false
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setEditForm({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      mobile_phone: patient.mobile_phone,
      date_of_birth: patient.date_of_birth,
      address: patient.address
    })
    setIsEditing(false)
    setActiveTab('overview')
    setShowPatientModal(true)
    fetchPatientChart(patient.id)
  }

  const handleEditPatient = async () => {
    if (!selectedPatient) return

    try {
      // Update patient information in patients table
      const { error } = await supabase
        .from('patients')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          phone: editForm.mobile_phone,
          date_of_birth: editForm.date_of_birth,
          location: editForm.address
        })
        .eq('id', selectedPatient.id)

      if (error) throw error

      // Refresh patients list
      await fetchPatients()
      setIsEditing(false)
      setShowPatientModal(false)
      alert('Patient information updated successfully')
    } catch (error: any) {
      console.error('Error updating patient:', error)
      alert('Failed to update patient: ' + error.message)
    }
  }

  const handleDeletePatient = async () => {
    if (!selectedPatient) return

    if (!confirm(`Are you sure you want to delete patient ${selectedPatient.first_name} ${selectedPatient.last_name}? This will delete the patient record. Note: Appointments will remain but will have no patient reference.`)) {
      return
    }

    setIsDeleting(true)
    try {
      // Delete patient record (appointments will remain with null patient_id due to ON DELETE SET NULL)
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', selectedPatient.id)

      if (error) throw error

      // Refresh patients list
      await fetchPatients()
      setShowPatientModal(false)
      setSelectedPatient(null)
      alert('Patient deleted successfully')
    } catch (error: any) {
      console.error('Error deleting patient:', error)
      alert('Failed to delete patient: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewAppointment = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId)
    setShowAppointmentModal(true)
    setShowPatientModal(false)
  }

  // Open clinical panel for any patient - creates appointment if needed
  const handleOpenClinicalPanel = async (patient: Patient) => {
    if (patient.appointments && patient.appointments.length > 0) {
      // Patient has appointments - open the most recent one
      const sortedAppointments = [...patient.appointments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      handleViewAppointment(sortedAppointments[0].id)
    } else {
      // No appointments - create a pending General Consultation
      try {
        const { data: newAppointment, error } = await supabase
          .from('appointments')
          .insert({
            patient_id: patient.id,
            doctor_id: currentDoctor?.id,
            status: 'pending',
            service_type: 'General Consultation',
            visit_type: 'video',
            requested_date_time: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error

        if (newAppointment) {
          // Update local state with new appointment
          const updatedPatient = {
            ...patient,
            appointments: [{
              id: newAppointment.id,
              status: newAppointment.status,
              service_type: newAppointment.service_type,
              visit_type: newAppointment.visit_type,
              created_at: newAppointment.created_at,
              requested_date_time: newAppointment.requested_date_time
            }],
            appointments_count: 1,
            last_appointment: newAppointment.created_at,
            last_appointment_status: newAppointment.status
          }
          setSelectedPatient(updatedPatient)
          
          // Open the clinical panel with the new appointment
          handleViewAppointment(newAppointment.id)
        }
      } catch (error) {
        console.error('Error creating appointment for clinical panel:', error)
        alert('Failed to open clinical panel. Please try again.')
      }
    }
  }

  const handleAppointmentStatusChange = () => {
    fetchPatients()
  }

  // Problems & Medications handlers
  const handleAddActiveProblem = () => {
    if (!newActiveProblem.problem.trim() || !selectedPatient) return
    const newProblem = {
      id: `ap-${Date.now()}`,
      problem: newActiveProblem.problem,
      since: newActiveProblem.since
    }
    setActiveProblems([...activeProblems, newProblem])
    setNewActiveProblem({problem: '', since: ''})
    saveProblemsAndMedications()
  }

  const handleRemoveActiveProblem = (id: string) => {
    setActiveProblems(activeProblems.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }

  const handleAddResolvedProblem = () => {
    if (!newResolvedProblem.problem.trim() || !selectedPatient) return
    const newProblem = {
      id: `rp-${Date.now()}`,
      problem: newResolvedProblem.problem,
      resolvedDate: newResolvedProblem.resolvedDate
    }
    setResolvedProblems([...resolvedProblems, newProblem])
    setNewResolvedProblem({problem: '', resolvedDate: ''})
    saveProblemsAndMedications()
  }

  const handleRemoveResolvedProblem = (id: string) => {
    setResolvedProblems(resolvedProblems.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }

  const handleAddMedicationHistory = () => {
    if (!newMedHistory.medication.trim() || !selectedPatient) return
    const newMed = {
      id: `mh-${Date.now()}`,
      medication: newMedHistory.medication,
      provider: newMedHistory.provider,
      date: newMedHistory.date
    }
    setMedicationHistory([...medicationHistory, newMed])
    setNewMedHistory({medication: '', provider: '', date: ''})
    saveProblemsAndMedications()
  }

  const handleRemoveMedicationHistory = (id: string) => {
    setMedicationHistory(medicationHistory.filter(m => m.id !== id))
    saveProblemsAndMedications()
  }

  const handleAddPrescriptionLog = () => {
    if (!newPrescriptionLog.medication.trim() || !selectedPatient) return
    const newLog = {
      id: `pl-${Date.now()}`,
      date: newPrescriptionLog.date,
      medication: newPrescriptionLog.medication,
      quantity: newPrescriptionLog.quantity,
      pharmacy: newPrescriptionLog.pharmacy,
      status: 'sent'
    }
    setPrescriptionLogs([...prescriptionLogs, newLog])
    setNewPrescriptionLog({medication: '', quantity: '', pharmacy: '', date: ''})
    saveProblemsAndMedications()
  }

  const handleRemovePrescriptionLog = (id: string) => {
    setPrescriptionLogs(prescriptionLogs.filter(l => l.id !== id))
    saveProblemsAndMedications()
  }

  const saveProblemsAndMedications = async () => {
    if (!selectedPatient) return
    setSavingProblems(true)
    try {
      const patientId = selectedPatient.id

      // 1. Save Active Problems
      // Delete existing active problems for this patient
      await supabase
        .from('problems')
        .delete()
        .eq('patient_id', patientId)
        .eq('status', 'active')

      // Insert new active problems
      if (activeProblems.length > 0) {
        const { error: problemsError } = await supabase
          .from('problems')
          .insert(activeProblems.map(p => ({
            patient_id: patientId,
            problem_name: p.problem,
            status: 'active'
          })))
        
        if (problemsError) throw problemsError
      }

      // 2. Save Resolved Problems
      // Delete existing resolved problems for this patient
      await supabase
        .from('problems')
        .delete()
        .eq('patient_id', patientId)
        .eq('status', 'resolved')

      // Insert new resolved problems
      if (resolvedProblems.length > 0) {
        const { error: resolvedError } = await supabase
          .from('problems')
          .insert(resolvedProblems.map(p => ({
            patient_id: patientId,
            problem_name: p.problem || '',
            status: 'resolved'
          })))
        
        if (resolvedError) throw resolvedError
      }

      // 3. Save Medication History
      if (medicationHistory.length > 0) {
        // Delete existing medication history for this patient
        await supabase
          .from('medication_history')
          .delete()
          .eq('patient_id', patientId)

        // Insert new medication history
        const { error: medHistoryError } = await supabase
          .from('medication_history')
          .insert(medicationHistory.map(med => ({
            patient_id: patientId,
            medication_name: med.medication || '',
            start_date: med.date ? new Date(med.date).toISOString().split('T')[0] : null
          })))
        
        if (medHistoryError) throw medHistoryError
      }

      // 4. Save Active Medication Orders
      // Delete existing active orders for this patient
      await supabase
        .from('medication_orders')
        .delete()
        .eq('patient_id', patientId)
        .eq('status', 'active')

      // Insert new active orders
      if (activeMedOrders.length > 0) {
        // Get latest appointment for appointment_id
      const { data: latestAppointment } = await supabase
        .from('appointments')
        .select('id')
          .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

        const { error: activeOrdersError } = await supabase
          .from('medication_orders')
          .insert(activeMedOrders.map(order => ({
            patient_id: patientId,
            appointment_id: latestAppointment?.id || null,
            medication_name: order.medication || '',
            dosage: order.sig || '',
            frequency: '',
            status: 'active'
          })))
        
        if (activeOrdersError) throw activeOrdersError
      }

      // 5. Save Past Medication Orders
      if (pastMedOrders.length > 0) {
        // Get latest appointment for appointment_id
        const { data: latestAppointment } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const { error: pastOrdersError } = await supabase
          .from('medication_orders')
          .insert(pastMedOrders.map(order => ({
            patient_id: patientId,
            appointment_id: latestAppointment?.id || null,
            medication_name: order.medication || '',
            dosage: order.sig || '',
            frequency: '',
            status: 'completed'
          })))
        
        if (pastOrdersError) throw pastOrdersError
      }

      // 6. Save Prescription Logs (if latest appointment exists)
      if (prescriptionLogs.length > 0) {
        const { data: latestAppointment } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestAppointment) {
          const { error: logsError } = await supabase
            .from('prescription_logs')
            .insert(prescriptionLogs.map(log => ({
              prescription_id: null,
              appointment_id: latestAppointment.id,
              action: log.status || 'created',
              action_at: log.date ? new Date(log.date).toISOString() : new Date().toISOString(),
              notes: `${log.medication || ''} - Qty: ${log.quantity || ''} - Pharmacy: ${log.pharmacy || ''}`
            })))
          
          if (logsError) throw logsError
        }
      }

      // Refresh chart data
      await fetchPatientChart(selectedPatient.id)
    } catch (error: any) {
      console.error('Error saving problems and medications:', error)
      alert('Failed to save: ' + error.message)
    } finally {
      setSavingProblems(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }


  return (
    <div className="flex gap-4 h-[calc(100vh-56px)] -mt-4 lg:-mt-6 -mx-4 lg:-mx-6">

      {/* ═══ LEFT PANEL — Patient List ═══ */}
      <div className={`${selectedPatient ? "hidden lg:flex lg:w-[380px]" : "flex-1"} flex-col flex-shrink-0 bg-[#111820] border-r border-[#1E2A3A] overflow-hidden`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1E2A3A] flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#E8ECF1]">Patients</h2>
          <span className="text-xs text-[#7B8CA3] font-mono">{patients.length} total</span>
          <div className="flex-1" />
          <a href="/doctor/new-patient" className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00D4AA] text-[#0B0F14] hover:bg-[#00B894] transition-colors">
            + New Patient
          </a>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#1E2A3A] relative">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0B0F14] rounded-xl border border-[#1E2A3A] focus-within:border-[#00D4AA]/40">
            <svg className="w-4 h-4 text-[#4A5568] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search by name, condition, or ID..."
              className="w-full bg-transparent text-xs text-[#E8ECF1] outline-none placeholder-[#4A5568]"
            />
          </div>
          {/* Suggestions dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div ref={suggestionsRef} className="absolute left-3 right-3 top-full mt-1 bg-[#151D28] border border-[#1E2A3A] rounded-xl shadow-2xl z-20 max-h-[200px] overflow-auto">
              {searchSuggestions.slice(0, 6).map((s, i) => (
                <button key={s.id || i} onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-[#1A2332] border-b border-[#1E2A3A] last:border-b-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                    style={{ background: `hsl(${(i * 60) % 360}, 60%, 30%)` }}>
                    {(s.first_name || "?").charAt(0)}{(s.last_name || "?").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#E8ECF1] truncate">{s.first_name} {s.last_name}</p>
                    <p className="text-[10px] text-[#4A5568]">{s.email || s.mobile_phone || ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00D4AA]" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-8 h-8 text-[#4A5568] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" /></svg>
              <p className="text-[#7B8CA3] text-sm">No patients found</p>
            </div>
          ) : (
            filteredPatients.map((patient, i) => {
              const isSelected = selectedPatient?.id === patient.id
              const initials = `${(patient.first_name || "?").charAt(0)}${(patient.last_name || "?").charAt(0)}`.toUpperCase()
              const recCount = patientRecordMap.get(patient.id)
              const totalRecs = recCount ? ((recCount as any).lab_results || (recCount as any).lab_result || 0) + ((recCount as any).prescriptions || (recCount as any).prescription || 0) + ((recCount as any).visit_summaries || (recCount as any).visit_summary || 0) : 0
              return (
                <button key={patient.id || i} onClick={() => handleViewPatient(patient)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-[#1E2A3A] transition-colors ${
                    isSelected ? "bg-[#1A2332]" : "hover:bg-[#1A2332]/50"
                  }`}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 relative"
                    style={{ background: `hsl(${(i * 60) % 360}, 60%, 30%)` }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#E8ECF1] truncate">{patient.first_name} {patient.last_name}</p>
                    <p className="text-[11px] text-[#7B8CA3]">
                      {patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()}y` : ""} 
                      {patient.email ? ` · ${patient.email}` : ""}
                    </p>
                  </div>
                  {totalRecs > 0 && (
                    <span className="text-[10px] text-[#4A5568] font-mono">{totalRecs} rec</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Patient Detail ═══ */}
      {selectedPatient ? (
        <div className="flex-1 overflow-auto bg-[#0B0F14]">
          {/* Detail header */}
          <div className="sticky top-0 bg-[#151D28] border-b border-[#1E2A3A] px-5 py-3.5 flex items-center gap-3 z-10">
            {/* Mobile back */}
            <button onClick={() => { setSelectedPatient(null); setShowPatientModal(false) }}
              className="lg:hidden p-2 rounded-lg bg-[#111820] border border-[#1E2A3A] text-[#7B8CA3] mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
              {(selectedPatient.first_name || "?").charAt(0)}{(selectedPatient.last_name || "?").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-[#E8ECF1]">{selectedPatient.first_name} {selectedPatient.last_name}</span>
              </div>
              <p className="text-xs text-[#7B8CA3]">
                {selectedPatient.date_of_birth ? `${selectedPatient.date_of_birth.includes("T") ? selectedPatient.date_of_birth.split("T")[0] : selectedPatient.date_of_birth}` : "No DOB"} 
                {selectedPatient.email ? ` · ${selectedPatient.email}` : ""}
                {selectedPatient.mobile_phone ? ` · ${selectedPatient.mobile_phone}` : ""}
              </p>
            </div>
            {/* Action buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => handleOpenClinicalPanel(selectedPatient)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[rgba(34,197,94,0.12)] text-[#22C55E] border border-[rgba(34,197,94,0.2)] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M23 7l-7 5 7 5V7zM1 5a2 2 0 012-2h11a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5z" /></svg>
                Visit
              </button>
              <button onClick={() => { setIsEditing(!isEditing) }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[rgba(59,130,246,0.12)] text-[#3B82F6] border border-[rgba(59,130,246,0.2)]">
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>

          {/* Allergy banner */}
          {selectedPatient.allergies && (
            <div className="px-5 py-2 bg-[rgba(255,71,87,0.08)] border-b border-[rgba(255,71,87,0.2)] flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#FF4757] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span className="text-xs text-[#FF4757] font-medium">Allergies: {selectedPatient.allergies}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-[#1E2A3A] px-5 bg-[#111820]">
            {(["overview", "chart"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${
                  activeTab === t ? "border-[#00D4AA] text-[#00D4AA]" : "border-transparent text-[#7B8CA3] hover:text-[#E8ECF1]"
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Edit form or patient info */}
                {isEditing ? (
                  <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#7B8CA3] uppercase tracking-wider mb-2">Edit Patient</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "First Name", field: "first_name" },
                        { label: "Last Name", field: "last_name" },
                        { label: "Email", field: "email" },
                        { label: "Phone", field: "phone" },
                        { label: "DOB", field: "date_of_birth" },
                        { label: "Location", field: "location" },
                        { label: "Pharmacy", field: "preferred_pharmacy" },
                        { label: "Allergies", field: "allergies" },
                      ].map(f => (
                        <div key={f.field}>
                          <label className="text-[10px] text-[#4A5568] mb-1 block">{f.label}</label>
                          <input value={(editForm as any)[f.field] || ""}
                            onChange={e => setEditForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                            className="w-full px-3 py-2 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none focus:border-[#00D4AA]/50"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleEditPatient} className="px-4 py-2 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-xs font-semibold">Save</button>
                      <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-[#1E2A3A] text-[#7B8CA3] rounded-lg text-xs">Cancel</button>
                      <button onClick={handleDeletePatient} disabled={isDeleting}
                        className="ml-auto px-4 py-2 bg-[rgba(255,71,87,0.12)] text-[#FF4757] border border-[rgba(255,71,87,0.2)] rounded-lg text-xs font-semibold">
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#7B8CA3] uppercase tracking-wider mb-3">Patient Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Email", value: selectedPatient.email },
                        { label: "Phone", value: selectedPatient.mobile_phone },
                        { label: "DOB", value: selectedPatient.date_of_birth },
                        { label: "Location", value: selectedPatient.address },
                        { label: "Pharmacy", value: selectedPatient.preferred_pharmacy },
                        { label: "Allergies", value: selectedPatient.allergies },
                      ].map((f, i) => (
                        <div key={i}>
                          <p className="text-[10px] text-[#4A5568]">{f.label}</p>
                          <p className="text-xs text-[#E8ECF1] mt-0.5">{f.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointments */}
                {selectedPatient.appointments && selectedPatient.appointments.length > 0 && (
                  <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1E2A3A]">
                      <p className="text-xs font-semibold text-[#7B8CA3] uppercase tracking-wider">Appointments</p>
                    </div>
                    {selectedPatient.appointments.slice(0, showAllRecords ? 50 : 5).map((apt: any, i: number) => (
                      <button key={apt.id || i} onClick={() => handleViewAppointment(apt.id)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 border-b border-[#1E2A3A] last:border-b-0 hover:bg-[#1A2332] transition-colors">
                        <span className="text-xs text-[#7B8CA3] font-mono w-20 flex-shrink-0">
                          {apt.requested_date_time ? new Date(apt.requested_date_time).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#E8ECF1] truncate">{apt.service_type || apt.visit_type || "Visit"}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          apt.status === "completed" ? "bg-green-500/10 text-green-400" :
                          apt.status === "accepted" ? "bg-blue-500/10 text-blue-400" :
                          apt.status === "pending" ? "bg-yellow-500/10 text-yellow-400" :
                          apt.status === "cancelled" ? "bg-gray-500/10 text-gray-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>{apt.status}</span>
                        {apt.chart_locked && (
                          <svg className="w-3 h-3 text-[#F59E0B] flex-shrink-0" fill="#F59E0B" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={2}><path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" /></svg>
                        )}
                      </button>
                    ))}
                    {selectedPatient.appointments.length > 5 && (
                      <button onClick={() => setShowAllRecords(!showAllRecords)}
                        className="w-full px-4 py-2 text-xs text-[#00D4AA] hover:bg-[#1A2332] transition-colors">
                        {showAllRecords ? "Show less" : `Show all ${selectedPatient.appointments.length} appointments`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "chart" && (
              <div className="space-y-5">
                {isLoadingChart ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00D4AA]" />
                  </div>
                ) : (
                  <>
                    {/* Active Problems */}
                    <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold text-[#7B8CA3] uppercase tracking-wider">Active Problems</p>
                      </div>
                      {activeProblems.length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No active problems</p>
                      ) : (
                        activeProblems.map((p, i) => (
                          <div key={p.id || i} className="flex items-center gap-2 py-1.5 px-2.5 bg-[#111820] rounded-lg mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FF4757] flex-shrink-0" />
                            <span className="text-xs text-[#E8ECF1] flex-1">{p.problem}</span>
                            <span className="text-[9px] text-[#4A5568] font-mono">{p.since}</span>
                            <button onClick={() => handleRemoveActiveProblem(p.id)} className="text-[#4A5568] hover:text-[#FF4757]">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                      {/* Add new */}
                      <div className="flex gap-2 mt-2">
                        <input value={newActiveProblem.problem} onChange={e => setNewActiveProblem(prev => ({ ...prev, problem: e.target.value }))}
                          placeholder="Problem (e.g. Recurrent UTI)" className="flex-1 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <input value={newActiveProblem.since} onChange={e => setNewActiveProblem(prev => ({ ...prev, since: e.target.value }))}
                          placeholder="Since" className="w-24 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <button onClick={handleAddActiveProblem} className="px-3 py-1.5 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-xs font-semibold">Add</button>
                      </div>
                    </div>

                    {/* Medications */}
                    <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-[#7B8CA3] uppercase tracking-wider mb-3">Medication History</p>
                      {medicationHistory.length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No medication history</p>
                      ) : (
                        medicationHistory.map((m, i) => (
                          <div key={m.id || i} className="flex items-center gap-2 py-1.5 px-2.5 bg-[#111820] rounded-lg mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                            <span className="text-xs text-[#E8ECF1] flex-1">{m.medication}</span>
                            <span className="text-[9px] text-[#4A5568]">{m.provider}</span>
                            <span className="text-[9px] text-[#4A5568] font-mono">{m.date}</span>
                            <button onClick={() => handleRemoveMedicationHistory(m.id)} className="text-[#4A5568] hover:text-[#FF4757]">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                      <div className="flex gap-2 mt-2">
                        <input value={newMedHistory.medication} onChange={e => setNewMedHistory(prev => ({ ...prev, medication: e.target.value }))}
                          placeholder="Medication" className="flex-1 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <input value={newMedHistory.provider} onChange={e => setNewMedHistory(prev => ({ ...prev, provider: e.target.value }))}
                          placeholder="Provider" className="w-24 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <button onClick={handleAddMedicationHistory} className="px-3 py-1.5 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-xs font-semibold">Add</button>
                      </div>
                    </div>

                    {/* Prescription Logs */}
                    <div className="bg-[#151D28] border border-[#1E2A3A] rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-[#7B8CA3] uppercase tracking-wider mb-3">Prescription Logs</p>
                      {prescriptionLogs.length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No prescription logs</p>
                      ) : (
                        prescriptionLogs.map((log, i) => (
                          <div key={log.id || i} className="flex items-center gap-2 py-1.5 px-2.5 bg-[#111820] rounded-lg mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] flex-shrink-0" />
                            <span className="text-xs text-[#E8ECF1] flex-1">{log.medication} — {log.quantity}</span>
                            <span className="text-[9px] text-[#4A5568]">{log.pharmacy}</span>
                            <span className="text-[9px] text-[#4A5568] font-mono">{log.date}</span>
                            <button onClick={() => handleRemovePrescriptionLog(log.id)} className="text-[#4A5568] hover:text-[#FF4757]">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                      <div className="flex gap-2 mt-2">
                        <input value={newPrescriptionLog.medication} onChange={e => setNewPrescriptionLog(prev => ({ ...prev, medication: e.target.value }))}
                          placeholder="Medication" className="flex-1 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <input value={newPrescriptionLog.quantity} onChange={e => setNewPrescriptionLog(prev => ({ ...prev, quantity: e.target.value }))}
                          placeholder="Qty" className="w-16 px-2.5 py-1.5 bg-[#111820] border border-[#1E2A3A] rounded-lg text-[#E8ECF1] text-xs outline-none" />
                        <button onClick={handleAddPrescriptionLog} className="px-3 py-1.5 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-xs font-semibold">Add</button>
                      </div>
                    </div>

                    {/* Save all button */}
                    <button onClick={saveProblemsAndMedications} disabled={savingProblems}
                      className="w-full py-2.5 bg-[#00D4AA] text-[#0B0F14] rounded-xl text-sm font-semibold disabled:opacity-50">
                      {savingProblems ? "Saving..." : "Save All Changes"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No patient selected placeholder (desktop) */
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0B0F14]">
          <div className="text-center">
            <svg className="w-10 h-10 text-[#4A5568] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" /></svg>
            <p className="text-sm text-[#7B8CA3]">Select a patient to view details</p>
          </div>
        </div>
      )}

      {/* ═══ APPOINTMENT DETAIL MODAL ═══ */}
      {showAppointmentModal && selectedAppointmentId && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAppointmentModal(false); setSelectedAppointmentId(null) }} />
          <div className="relative z-10 h-full">
            <AppointmentDetailModal
              appointmentId={selectedAppointmentId}
              isOpen={showAppointmentModal}
              onClose={() => { setShowAppointmentModal(false); setSelectedAppointmentId(null) }}
              onStatusChange={handleAppointmentStatusChange}
              doctorId={currentDoctor?.id}
              doctorName={currentDoctor ? `Dr. ${currentDoctor.first_name || ""} ${currentDoctor.last_name || ""}`.trim() : undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}
