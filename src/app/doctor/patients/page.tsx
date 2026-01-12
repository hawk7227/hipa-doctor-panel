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

      setPatients(processedPatients)
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
            since: ''
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

        // Fetch medication history
        const { data: medHistoryData } = await supabase
          .from('medication_history')
          .select('*')
          .eq('patient_id', patientId)
          .order('start_date', { ascending: false })

        const parsedMedHistory = medHistoryData?.map((m, idx) => ({
              id: m.id || `mh-${idx}`,
          medication: m.medication_name || '',
          provider: 'External Provider',
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

        // Fetch past medication orders
        const { data: pastOrdersData } = await supabase
          .from('medication_orders')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })

        const parsedPastOrders = pastOrdersData?.map((m, idx) => ({
          id: m.id || `pmo-${idx}`,
          medication: m.medication_name || '',
          sig: m.dosage || '',
          date: m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : ''
        })) || []

        // Get latest appointment for prescription logs
        const { data: latestAppointment } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let parsedPrescriptionLogs: Array<any> = []
        if (latestAppointment) {
          const { data: prescriptionLogsData } = await supabase
            .from('prescription_logs')
            .select('*')
            .eq('appointment_id', latestAppointment.id)
            .order('action_at', { ascending: false })

          if (prescriptionLogsData && prescriptionLogsData.length > 0) {
            parsedPrescriptionLogs = prescriptionLogsData.map((p, idx) => {
              const notes = p.notes || ''
              const medMatch = notes.match(/(.+?)\s*-\s*Qty:/)
              const qtyMatch = notes.match(/Qty:\s*(.+?)\s*-/)
              const pharmMatch = notes.match(/Pharmacy:\s*(.+)/)
              
              return {
                id: p.id || `pl-${idx}`,
                date: p.action_at ? new Date(p.action_at).toISOString().split('T')[0] : '',
                medication: medMatch ? medMatch[1].trim() : '',
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
          appointments_count: selectedPatient?.appointments_count || 0,
          last_appointment: selectedPatient?.last_appointment || '',
          last_appointment_status: selectedPatient?.last_appointment_status || '',
          appointments: selectedPatient?.appointments || [],
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
      const searchLower = searchTerm.toLowerCase()
      const matches = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
        return (
          fullName.includes(searchLower) ||
          patient.first_name.toLowerCase().includes(searchLower) ||
          patient.last_name.toLowerCase().includes(searchLower) ||
          patient.email.toLowerCase().includes(searchLower)
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
    // Optionally scroll to the patient in the list
    setTimeout(() => {
      const element = document.getElementById(`patient-${patient.id}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('bg-teal-500/20')
        setTimeout(() => {
          element.classList.remove('bg-teal-500/20')
        }, 2000)
      }
    }, 100)
  }

  const filteredPatients = patients.filter(patient => {
    // First filter by search term
    const matchesSearch = 
      patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase())

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
    <div className="w-full max-w-none">
      <div className="space-y-4 sm:space-y-6">
        {/* Header Card */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">Patient Records</h1>
              <p className="text-gray-400 mt-2">
                {currentDoctor ? 
                  `View and manage patients for Dr. ${currentDoctor.first_name} ${currentDoctor.last_name}` :
                  'View and manage your patient information'
                }
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={() => {
                  setShowAllRecords(!showAllRecords)
                  if (!showAllRecords) {
                    setRecordFilter('all')
                  }
                }}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {showAllRecords ? (
                  <>
                    <X className="w-4 h-4" />
                    Show Appointments
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Show All Records
                  </>
                )}
              </button>
              {currentDoctor && (
                <div className="bg-blue-50 rounded-lg p-2 text-left lg:text-right">
                  <p className="text-xs text-black">Current Doctor</p>
                  <p className="text-sm font-semibold text-black">
                    Dr. {currentDoctor.first_name} {currentDoctor.last_name}
                  </p>
                  <p className="text-xs text-black">{currentDoctor.specialty}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search patients by name or email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-xl max-h-80 overflow-y-auto"
                  >
                    {searchSuggestions.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handleSuggestionClick(patient)}
                        className="px-4 py-3 hover:bg-[#164e4e] cursor-pointer transition-colors border-b border-[#1a3d3d] last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#164e4e] flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-white">
                              {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              {patient.email}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => setShowSuggestions(false)}
              className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </div>

        {/* Patient Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-400">Total Patients</p>
                <p className="text-xl sm:text-2xl font-semibold text-white">{patients.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-400">Active Patients</p>
                <p className="text-xl sm:text-2xl font-semibold text-white">
                  {patients.filter(p => {
                    const lastVisit = new Date(p.last_appointment)
                    const thirtyDaysAgo = new Date()
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                    return lastVisit >= thirtyDaysAgo
                  }).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-400">New This Month</p>
                <p className="text-xl sm:text-2xl font-semibold text-white">
                  {patients.filter(p => {
                    const created = new Date(p.created_at)
                    const thirtyDaysAgo = new Date()
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                    return created >= thirtyDaysAgo
                  }).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-400">Avg. Appointments</p>
                <p className="text-xl sm:text-2xl font-semibold text-white">
                  {patients.length > 0 ? 
                    (patients.reduce((sum, p) => sum + p.appointments_count, 0) / patients.length).toFixed(1) : 
                    '0'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Record Filter Tabs - Only show when All Records is visible */}
        {showAllRecords && (
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4 sm:p-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setRecordFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recordFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#164e4e] text-gray-300 hover:bg-[#1a5a5a]'
                }`}
              >
                All Records ({recordCounts.all})
              </button>
              <button
                onClick={() => setRecordFilter('prescription')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recordFilter === 'prescription'
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#164e4e] text-gray-300 hover:bg-[#1a5a5a]'
                }`}
              >
                Prescriptions ({recordCounts.prescription})
              </button>
              <button
                onClick={() => setRecordFilter('lab_result')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recordFilter === 'lab_result'
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#164e4e] text-gray-300 hover:bg-[#1a5a5a]'
                }`}
              >
                Lab Records ({recordCounts.lab_result})
              </button>
              <button
                onClick={() => setRecordFilter('visit_summary')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recordFilter === 'visit_summary'
                    ? 'bg-teal-500 text-white'
                    : 'bg-[#164e4e] text-gray-300 hover:bg-[#1a5a5a]'
                }`}
              >
                Visit Summaries ({recordCounts.visit_summary})
              </button>
            </div>
          </div>
        )}

        {/* Upcoming Appointments Section */}
        {!showAllRecords && (
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d]">
            <div className="p-4 sm:p-6 border-b border-[#1a3d3d]">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
                  Upcoming Appointments
                </h2>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No upcoming appointments
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-3 sm:p-4 bg-[#164e4e] rounded-lg border border-[#1a5a5a] hover:border-teal-500 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedAppointmentId(appointment.id)
                        setShowAppointmentModal(true)
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-[#0d2626] flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-white">
                                {appointment.patient 
                                  ? `${appointment.patient.first_name.charAt(0)}${appointment.patient.last_name.charAt(0)}`
                                  : 'P'
                                }
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium truncate">
                                {appointment.patient
                                  ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
                                  : 'Unknown Patient'}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-400 truncate">
                                {appointment.patient?.email || 'No email'}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-300 ml-0 sm:ml-12">
                            {appointment.requested_date_time ? (
                              <p>
                                {new Date(appointment.requested_date_time).toLocaleString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            ) : (
                              <p>Date TBD</p>
                            )}
                            {appointment.visit_type && (
                              <p className="text-xs text-gray-400 mt-1">
                                Visit Type: {appointment.visit_type}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
                          <span className={`px-2 sm:px-3 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            appointment.status === 'accepted'
                              ? 'bg-green-600 text-white'
                              : 'bg-yellow-600 text-white'
                          }`}>
                            {appointment.status}
                          </span>
                          <button className="text-teal-400 hover:text-teal-300 text-xs sm:text-sm whitespace-nowrap">
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patients List Card */}
        {showAllRecords && (
          <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d]">
            <div className="p-4 sm:p-6 border-b border-[#1a3d3d]">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-lg font-semibold text-white">
                  {recordFilter === 'all' && 'All Medical Records'}
                  {recordFilter === 'prescription' && 'Prescriptions'}
                  {recordFilter === 'lab_result' && 'Lab Records'}
                  {recordFilter === 'visit_summary' && 'Visit Summaries'}
                  {' '}({filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'})
                </h2>
                <div className="text-sm text-gray-400">
                  {recordFilter === 'all' && `Total Records: ${recordCounts.all}`}
                  {recordFilter === 'prescription' && `Total Prescriptions: ${recordCounts.prescription}`}
                  {recordFilter === 'lab_result' && `Total Lab Results: ${recordCounts.lab_result}`}
                  {recordFilter === 'visit_summary' && `Total Visit Summaries: ${recordCounts.visit_summary}`}
                </div>
              </div>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-[#1a3d3d]">
              <thead className="bg-[#0a1f1f]">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Appointments
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#0d2626] divide-y divide-[#1a3d3d]">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p className="text-lg font-medium text-white">No medical records found</p>
                        <p className="text-sm text-gray-400">
                          {recordFilter === 'all' 
                            ? 'No patients match your search criteria'
                            : `No patients found with ${recordFilter === 'prescription' ? 'prescriptions' : recordFilter === 'lab_result' ? 'lab records' : 'visit summaries'}`
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr 
                      id={`patient-${patient.id}`}
                      key={patient.id} 
                      className="hover:bg-[#164e4e] transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-[#164e4e] flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 min-w-0 flex-1">
                            <div className="text-sm font-medium text-white truncate">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              ID: {patient.id.slice(0, 8)}...
                            </div>
                            <div className="text-xs text-gray-400 sm:hidden truncate">
                              {patient.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                        <div className="text-sm text-white truncate">{patient.email}</div>
                        <div className="text-sm text-gray-400 truncate">{patient.mobile_phone}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                        <div className="text-sm text-white">{patient.appointments_count}</div>
                        {(() => {
                          const records = patientRecordMap.get(patient.id)
                          if (!records) return null
                          return (
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {records.prescription > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">
                                  Rx: {records.prescription}
                                </span>
                              )}
                              {records.lab_result > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">
                                  Lab: {records.lab_result}
                                </span>
                              )}
                              {records.visit_summary > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-yellow-600 text-white rounded">
                                  Visit: {records.visit_summary}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <button 
                          onClick={() => handleViewPatient(patient)}
                          className="flex items-center gap-1 text-white hover:text-cyan-400 text-xs sm:text-sm whitespace-nowrap px-2 py-1 rounded hover:bg-cyan-500/20 transition-colors"
                          title="View Patient Details"
                        >
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Patient Detail Modal */}
      {showPatientModal && selectedPatient && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/20 shadow-2xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 z-10 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Patient Details: {selectedPatient.first_name} {selectedPatient.last_name}
                </h2>
                <button
                  onClick={() => {
                    setShowPatientModal(false)
                    setIsEditing(false)
                    setSelectedPatient(null)
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-white/10 bg-slate-800/50">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'chart'
                      ? 'text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Patient Chart
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingChart && activeTab === 'chart' ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
                </div>
              ) : isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                      <input
                        type="text"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={editForm.mobile_phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, mobile_phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Date of Birth</label>
                      <input
                        type="date"
                        value={editForm.date_of_birth}
                        onChange={(e) => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Address</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-white/20 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleEditPatient}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Patient Information */}
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Patient Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400">First Name</label>
                        <p className="text-white font-medium">{selectedPatient.first_name}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Last Name</label>
                        <p className="text-white font-medium">{selectedPatient.last_name}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Email</label>
                        <p className="text-white">{selectedPatient.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Phone</label>
                        <p className="text-white">{selectedPatient.mobile_phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Date of Birth</label>
                        <p className="text-white">{selectedPatient.date_of_birth ? formatDate(selectedPatient.date_of_birth) : 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Address</label>
                        <p className="text-white">{selectedPatient.address || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Total Appointments</label>
                        <p className="text-white font-semibold">{selectedPatient.appointments_count}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Last Appointment</label>
                        <p className="text-white">{formatDate(selectedPatient.last_appointment)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Appointments List */}
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Appointments ({selectedPatient.appointments.length})</h3>
                    {selectedPatient.appointments.length === 0 ? (
                      <p className="text-gray-400">No appointments found</p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {selectedPatient.appointments.map((appointment) => (
                          <div
                            key={appointment.id}
                            className="bg-slate-700/50 rounded-lg p-4 border border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer"
                            onClick={() => handleViewAppointment(appointment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-white font-semibold">
                                    {appointment.service_type?.replace('_', ' ') || 'Appointment'}
                                  </span>
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                    appointment.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                    appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {appointment.status}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-400">
                                  <p>Visit Type: {appointment.visit_type || 'N/A'}</p>
                                  {appointment.requested_date_time && (
                                    <p>Date: {formatDateTime(appointment.requested_date_time)}</p>
                                  )}
                                  <p>Created: {formatDateTime(appointment.created_at)}</p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewAppointment(appointment.id)
                                }}
                                className="ml-4 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Patient
                    </button>
                    <button
                      onClick={handleDeletePatient}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete Patient
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Patient Header */}
                  {patientChartData && (
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Name</div>
                          <div className="font-bold text-white text-base">
                            {patientChartData.first_name} {patientChartData.last_name}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Email</div>
                          <div className="text-white text-sm break-all">{patientChartData.email || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Phone</div>
                          <div className="text-white text-sm">{patientChartData.mobile_phone || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">DOB</div>
                          <div className="text-white text-sm">{patientChartData.date_of_birth ? formatDate(patientChartData.date_of_birth) : 'N/A'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 lg:col-span-2">
                          <div className="text-xs text-gray-400 mb-1">Address</div>
                          <div className="text-white text-sm break-words">{patientChartData.address || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Preferred Pharmacy</div>
                          <div className="text-white font-bold text-sm">
                            {patientChartData.preferred_pharmacy || 'Not specified'}
                          </div>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <div className="text-xs text-gray-400 mb-3">Patient Intake</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Allergies</div>
                              <div className="text-white text-sm">{patientChartData.allergies || 'NKDA'}</div>
                            </div>
                            {patientChartData.active_problems && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Active Problems</div>
                                <div className="text-white text-sm">{patientChartData.active_problems}</div>
                              </div>
                            )}
                            {patientChartData.current_medications && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Current Medications</div>
                                <div className="text-white text-sm">{patientChartData.current_medications}</div>
                              </div>
                            )}
                            {patientChartData.recent_surgeries_details && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Recent Surgeries</div>
                                <div className="text-white text-sm">{patientChartData.recent_surgeries_details}</div>
                              </div>
                            )}
                            {patientChartData.ongoing_medical_issues_details && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Ongoing Medical Issues</div>
                                <div className="text-white text-sm">{patientChartData.ongoing_medical_issues_details}</div>
                              </div>
                            )}
                            {(patientChartData.vitals_bp || patientChartData.vitals_hr || patientChartData.vitals_temp) && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Vitals</div>
                                <div className="text-white text-sm">
                                  {patientChartData.vitals_bp && `BP: ${patientChartData.vitals_bp}`}
                                  {patientChartData.vitals_hr && ` HR: ${patientChartData.vitals_hr}`}
                                  {patientChartData.vitals_temp && ` Temp: ${patientChartData.vitals_temp}`}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Problems & Medications */}
                  <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-cyan-400" />
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
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add
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
                          {activeProblems.length === 0 && (
                            <p className="text-xs text-gray-400">No active problems</p>
                          )}
                        </div>
                      </div>

                      {/* Resolved Problems */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-white">Resolved Problems</label>
                          <button
                            onClick={handleAddResolvedProblem}
                            disabled={!newResolvedProblem.problem.trim() || savingProblems}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add
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
                          {resolvedProblems.length === 0 && (
                            <p className="text-xs text-gray-400">No resolved problems</p>
                          )}
                        </div>
                      </div>

                      {/* Medication History */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-white">Medication History (Surescripts)</label>
                          <button
                            onClick={handleAddMedicationHistory}
                            disabled={!newMedHistory.medication.trim() || savingProblems}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add
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
                          {medicationHistory.length === 0 && (
                            <p className="text-xs text-gray-400">No medication history</p>
                          )}
                        </div>
                      </div>

                      {/* Active Medication Orders */}
                      <div>
                        <label className="text-sm font-semibold text-white block mb-2">Active Medication Orders</label>
                        <div className="space-y-2">
                          {activeMedOrders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                              <span className="text-sm text-white">
                                {order.medication}{order.sig && ` — ${order.sig}`} — {order.status}
                              </span>
                            </div>
                          ))}
                          {activeMedOrders.length === 0 && (
                            <p className="text-xs text-gray-400">No active orders</p>
                          )}
                        </div>
                      </div>

                      {/* Past Medication Orders */}
                      <div>
                        <label className="text-sm font-semibold text-white block mb-2">Past Medication Orders</label>
                        <div className="space-y-2">
                          {pastMedOrders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg border border-white/10">
                              <span className="text-sm text-white">
                                {order.medication}{order.sig && ` — ${order.sig}`}{order.date && ` — ${order.date}`}
                              </span>
                            </div>
                          ))}
                          {pastMedOrders.length === 0 && (
                            <p className="text-xs text-gray-400">No past orders</p>
                          )}
                        </div>
                      </div>

                      {/* Prescription Logs */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-white">Prescription Logs</label>
                          <button
                            onClick={handleAddPrescriptionLog}
                            disabled={!newPrescriptionLog.medication.trim() || savingProblems}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add
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
                          {prescriptionLogs.length === 0 && (
                            <p className="text-xs text-gray-400">No prescription logs</p>
                          )}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      <AppointmentDetailModal
        appointmentId={selectedAppointmentId}
        isOpen={showAppointmentModal}
        onClose={() => {
          setShowAppointmentModal(false)
          setSelectedAppointmentId(null)
        }}
        onStatusChange={handleAppointmentStatusChange}
      />
    </div>
  )
}
