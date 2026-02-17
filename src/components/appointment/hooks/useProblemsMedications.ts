// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export function useProblemsMedications(appointmentId: string | null, patientId: string | null) {
  const [activeProblems, setActiveProblems] = useState<Array<{id: string, problem: string, since: string}>>([])
  const [resolvedProblems, setResolvedProblems] = useState<Array<{id: string, problem: string, resolvedDate: string}>>([])
  const [medicationHistory, setMedicationHistory] = useState<Array<{id: string, medication: string, provider: string, date: string}>>([])
  const [activeMedOrders, setActiveMedOrders] = useState<Array<{id: string, medication: string, sig: string, status: string}>>([])
  const [pastMedOrders, setPastMedOrders] = useState<Array<{id: string, medication: string, sig: string, date: string}>>([])
  const [prescriptionLogs, setPrescriptionLogs] = useState<Array<{id: string, date: string, medication: string, quantity: string, pharmacy: string, status: string}>>([])
  const [surgeriesDetails, setSurgeriesDetails] = useState<string>('')
  const [medicalIssuesDetails, setMedicalIssuesDetails] = useState<string>('')
  const [savingProblems, setSavingProblems] = useState(false)

  const isSavingRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save function
  const saveProblemsAndMedications = useCallback(async () => {
    if (!appointmentId || !patientId) return
    
    if (isSavingRef.current) {
      return
    }
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save operation
    saveTimeoutRef.current = setTimeout(async () => {
      isSavingRef.current = true
      setSavingProblems(true)
      
      try {
        // Save Active Problems
        await supabase
          .from('problems')
          .delete()
          .eq('patient_id', patientId)
          .eq('status', 'active')

        if (activeProblems.length > 0) {
          await supabase
            .from('problems')
            .insert(activeProblems.map(p => ({
              patient_id: patientId,
              problem_name: p.problem,
              status: 'active'
            })))
        }

        // Save Resolved Problems
        await supabase
          .from('problems')
          .delete()
          .eq('patient_id', patientId)
          .eq('status', 'resolved')

        if (resolvedProblems.length > 0) {
          await supabase
            .from('problems')
            .insert(resolvedProblems.map(p => ({
              patient_id: patientId,
              problem_name: p.problem,
              status: 'resolved'
            })))
        }

        // Save Medication History
        if (medicationHistory.length > 0) {
          await supabase
            .from('medication_history')
            .delete()
            .eq('patient_id', patientId)

          await supabase
            .from('medication_history')
            .insert(medicationHistory.map(med => ({
              patient_id: patientId,
              medication_name: med.medication,
              start_date: med.date ? new Date(med.date).toISOString().split('T')[0] : null
            })))
        }

        // Save Active Medication Orders
        await supabase
          .from('medication_orders')
          .delete()
          .eq('patient_id', patientId)
          .eq('status', 'active')

        if (activeMedOrders.length > 0) {
          await supabase
            .from('medication_orders')
            .insert(activeMedOrders.map(order => ({
              patient_id: patientId,
              appointment_id: appointmentId,
              medication_name: order.medication,
              dosage: order.sig,
              status: 'active'
            })))
        }

        // Save Past Medication Orders
        if (pastMedOrders.length > 0) {
          await supabase
            .from('medication_orders')
            .insert(pastMedOrders.map(order => ({
              patient_id: patientId,
              appointment_id: appointmentId,
              medication_name: order.medication,
              dosage: order.sig,
              status: 'completed'
            })))
        }

        // Save Prescription Logs (only new ones with 'pl-' prefix)
        const logsToInsert = prescriptionLogs.filter(log => log.id && log.id.startsWith('pl-'))
        if (logsToInsert.length > 0) {
          const mapStatusToAction = (status: string): string => {
            const statusLower = status.toLowerCase()
            if (statusLower === 'sent') return 'sent'
            if (statusLower === 'filled') return 'filled'
            if (statusLower === 'cancelled' || statusLower === 'canceled') return 'cancelled'
            if (statusLower === 'modified') return 'modified'
            return 'created'
          }

          const { data: insertedLogs } = await supabase
            .from('prescription_logs')
            .insert(logsToInsert.map(log => ({
              appointment_id: appointmentId,
              action: mapStatusToAction(log.status),
              action_at: log.date ? new Date(log.date).toISOString() : new Date().toISOString(),
              notes: `${log.medication || ''} - Qty: ${log.quantity || ''} - Pharmacy: ${log.pharmacy || ''}`
            })))
            .select()

          if (insertedLogs && insertedLogs.length > 0) {
            const capitalizeAction = (action: string): string => {
              if (!action) return 'Sent'
              return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase()
            }

            setPrescriptionLogs(prev => {
              const tempIdToInsertedMap = new Map<string, any>()
              logsToInsert.forEach((log, index) => {
                if (insertedLogs[index]) {
                  tempIdToInsertedMap.set(log.id, insertedLogs[index])
                }
              })

              return prev.map(log => {
                if (!log.id.startsWith('pl-')) {
                  return log
                }

                const inserted = tempIdToInsertedMap.get(log.id)
                if (inserted) {
                  return {
                    id: inserted.id,
                    date: inserted.action_at ? new Date(inserted.action_at).toISOString().split('T')[0] : log.date,
                    medication: log.medication,
                    quantity: log.quantity,
                    pharmacy: log.pharmacy,
                    status: capitalizeAction(inserted.action) || log.status
                  }
                }
                return log
              })
            })
          }
        }
      } catch (err: any) {
        console.error('Error saving problems and medications:', err)
      } finally {
        isSavingRef.current = false
        setSavingProblems(false)
      }
    }, 1000) // 1 second debounce
  }, [appointmentId, patientId, activeProblems, resolvedProblems, medicationHistory, activeMedOrders, pastMedOrders, prescriptionLogs])

  // Load problems and medications from database
  const loadProblemsAndMedications = useCallback(async (patientId: string) => {
    try {
      const [
        { data: activeProblemsData },
        { data: resolvedProblemsData },
        { data: medHistoryData },
        { data: activeOrdersData },
        { data: pastOrdersData }
      ] = await Promise.all([
        supabase.from('problems').select('*').eq('patient_id', patientId).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('problems').select('*').eq('patient_id', patientId).eq('status', 'resolved').order('created_at', { ascending: false }),
        supabase.from('medication_history').select('*').eq('patient_id', patientId).order('start_date', { ascending: false }),
        supabase.from('medication_orders').select('*').eq('patient_id', patientId).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('medication_orders').select('*').eq('patient_id', patientId).eq('status', 'completed').order('created_at', { ascending: false })
      ])

      if (activeProblemsData && Array.isArray(activeProblemsData) && activeProblemsData.length > 0) {
        setActiveProblems(activeProblemsData.map((p, idx) => ({
          id: p.id || `ap-${idx}`,
          problem: p.problem_name || '',
          since: ''
        })))
        
        // Set medicalIssuesDetails from normalized problems table
        const issuesText = activeProblemsData.map(p => p.problem_name || '').filter(Boolean).join(', ')
        setMedicalIssuesDetails(issuesText)
      }

      if (resolvedProblemsData && Array.isArray(resolvedProblemsData) && resolvedProblemsData.length > 0) {
        setResolvedProblems(resolvedProblemsData.map((p, idx) => ({
          id: p.id || `rp-${idx}`,
          problem: p.problem_name || '',
          resolvedDate: p.resolved_date ? new Date(p.resolved_date).toISOString().split('T')[0] : ''
        })))
      }

      if (medHistoryData && Array.isArray(medHistoryData) && medHistoryData.length > 0) {
        setMedicationHistory(medHistoryData.map((m, idx) => ({
          id: m.id || `mh-${idx}`,
          medication: m.medication_name || '',
          provider: 'External Provider',
          date: m.start_date ? new Date(m.start_date).toISOString().split('T')[0] : ''
        })))
      }

      if (activeOrdersData && Array.isArray(activeOrdersData) && activeOrdersData.length > 0) {
        setActiveMedOrders(activeOrdersData.map((m, idx) => ({
          id: m.id || `amo-${idx}`,
          medication: m.medication_name || '',
          sig: m.dosage || '',
          status: m.status || 'Sent'
        })))
      }

      if (pastOrdersData && Array.isArray(pastOrdersData) && pastOrdersData.length > 0) {
        setPastMedOrders(pastOrdersData.map((m, idx) => ({
          id: m.id || `pmo-${idx}`,
          medication: m.medication_name || '',
          sig: m.dosage || '',
          date: m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : ''
        })))
      }
    } catch (err) {
      console.error('Error loading problems and medications:', err)
    }
  }, [])

  // NEW API: Handlers now receive values directly from the component's local state
  const handleAddActiveProblem = useCallback((problem: string, since: string) => {
    const startTime = performance.now()
    console.log('[useProblemsMedications] handleAddActiveProblem called', { problem, since, timestamp: Date.now() })
    const newItem = {
      id: `ap-${Date.now()}`,
      problem,
      since
    }
    setActiveProblems(prev => {
      const newList = [...prev, newItem]
      const endTime = performance.now()
      console.log(`[useProblemsMedications] setActiveProblems took ${(endTime - startTime).toFixed(2)}ms`, {
        prevLength: prev.length,
        newLength: newList.length,
        timestamp: Date.now()
      })
      return newList
    })
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleRemoveActiveProblem = useCallback((id: string) => {
    setActiveProblems(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleAddResolvedProblem = useCallback((problem: string, resolvedDate: string) => {
    const newItem = {
      id: `rp-${Date.now()}`,
      problem,
      resolvedDate
    }
    setResolvedProblems(prev => [...prev, newItem])
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleRemoveResolvedProblem = useCallback((id: string) => {
    setResolvedProblems(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleAddMedicationHistory = useCallback((medication: string, provider: string, date: string) => {
    const newItem = {
      id: `mh-${Date.now()}`,
      medication,
      provider: provider || 'External Provider',
      date
    }
    setMedicationHistory(prev => [...prev, newItem])
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleRemoveMedicationHistory = useCallback((id: string) => {
    setMedicationHistory(prev => prev.filter(m => m.id !== id))
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleAddPrescriptionLog = useCallback((medication: string, quantity: string, pharmacy: string, date: string) => {
    const newItem = {
      id: `pl-${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      medication,
      quantity,
      pharmacy,
      status: 'Sent'
    }
    setPrescriptionLogs(prev => [...prev, newItem])
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  const handleRemovePrescriptionLog = useCallback((id: string) => {
    setPrescriptionLogs(prev => prev.filter(p => p.id !== id))
    saveProblemsAndMedications()
  }, [saveProblemsAndMedications])

  useEffect(() => {
    if (patientId) {
      // TIER 2: Defer Problems & Medications loading slightly
      // User sees Patient Header and SOAP Notes first, so we can delay this by 200-300ms
      // This allows the critical data to render first
      const loadTimeout = setTimeout(() => {
        loadProblemsAndMedications(patientId)
      }, 250) // 250ms delay - enough for Patient Header and SOAP Notes to render
      
      return () => clearTimeout(loadTimeout)
    } else {
      setActiveProblems([])
      setResolvedProblems([])
      setMedicationHistory([])
      setActiveMedOrders([])
      setPastMedOrders([])
      setPrescriptionLogs([])
    }
  }, [patientId, loadProblemsAndMedications])

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    activeProblems,
    resolvedProblems,
    medicationHistory,
    activeMedOrders,
    pastMedOrders,
    prescriptionLogs,
    surgeriesDetails,
    medicalIssuesDetails,
    savingProblems,
    setActiveProblems,
    setResolvedProblems,
    setMedicationHistory,
    setActiveMedOrders,
    setPastMedOrders,
    setPrescriptionLogs,
    setSurgeriesDetails,
    setMedicalIssuesDetails,
    handleAddActiveProblem,
    handleRemoveActiveProblem,
    handleAddResolvedProblem,
    handleRemoveResolvedProblem,
    handleAddMedicationHistory,
    handleRemoveMedicationHistory,
    handleAddPrescriptionLog,
    handleRemovePrescriptionLog,
    loadProblemsAndMedications
  }
}
