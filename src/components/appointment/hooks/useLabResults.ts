import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface LabResult {
  id: string
  test_name: string
  result_value: string | null
  status: 'pending' | 'preliminary' | 'final' | 'corrected'
  created_at: string
  patient_id: string
  appointment_id?: string | null
  order_id?: string | null
  // UI-only fields (not in DB, computed for display)
  unit?: string | null
  reference_range?: string | null
  ordered_by?: string | null
  displayStatus?: 'normal' | 'abnormal' | 'critical' // For UI display only
}

export function useLabResults(appointmentId: string | null, patientId: string | null) {
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [isLoadingLabs, setIsLoadingLabs] = useState(false)
  const [showLabResults, setShowLabResults] = useState(false)

  const loadLabResults = useCallback(async () => {
    if (!patientId) return
    
    setIsLoadingLabs(true)
    try {
      // Fetch from lab_results table (matches DATABASE_STRUCTURE_VERIFICATION.md schema)
      const { data, error } = await supabase
        .from('lab_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        // If table doesn't exist (PGRST116), use mock data for demo
        if (error.code === 'PGRST116' || error.code === '42P01') {
          console.log('lab_results table not found, using mock data')
          // Mock data for demo (remove in production when lab integration is ready)
          // Note: Using correct status values from DB schema: 'pending', 'preliminary', 'final', 'corrected'
          setLabResults([
            {
              id: 'mock-1',
              test_name: 'Urinalysis',
              result_value: 'Positive for nitrites',
              status: 'final',
              created_at: new Date().toISOString(),
              patient_id: patientId,
              appointment_id: appointmentId,
              order_id: null,
              // UI-only fields
              unit: null,
              reference_range: 'Negative',
              ordered_by: 'Dr. Smith',
              displayStatus: 'abnormal'
            },
            {
              id: 'mock-2',
              test_name: 'WBC in Urine',
              result_value: '50-100 /HPF',
              status: 'final',
              created_at: new Date().toISOString(),
              patient_id: patientId,
              appointment_id: appointmentId,
              order_id: null,
              // UI-only fields
              unit: '/HPF',
              reference_range: '0-5',
              ordered_by: 'Dr. Smith',
              displayStatus: 'abnormal'
            },
            {
              id: 'mock-3',
              test_name: 'Urine Culture',
              result_value: 'E. coli >100,000 CFU/mL',
              status: 'final',
              created_at: new Date().toISOString(),
              patient_id: patientId,
              appointment_id: appointmentId,
              order_id: null,
              // UI-only fields
              unit: null,
              reference_range: 'No growth',
              ordered_by: 'Dr. Smith',
              displayStatus: 'abnormal'
            }
          ])
        } else {
          console.error('Error loading lab results:', error)
        }
      } else       if (data && data.length > 0) {
        // Transform database results to match interface
        // Note: lab_results table only has: id, patient_id, order_id, test_name, result_value, status, created_at
        const transformedResults: LabResult[] = data.map((item: any) => {
          // Parse result_value to extract unit and reference range if stored in format like "50-100 /HPF (Ref: 0-5)"
          const resultValue = item.result_value || ''
          let unit: string | null = null
          let referenceRange: string | null = null
          let displayStatus: 'normal' | 'abnormal' | 'critical' = 'normal'
          
          // Try to parse if result_value contains structured data
          if (resultValue.includes('(Ref:')) {
            const refMatch = resultValue.match(/\(Ref:\s*([^)]+)\)/)
            if (refMatch) referenceRange = refMatch[1].trim()
          }
          if (resultValue.includes('/')) {
            const parts = resultValue.split('/')
            if (parts.length > 1) unit = '/' + parts[parts.length - 1].split(' ')[0]
          }
          
          // Determine display status based on result_value content (for UI)
          if (resultValue.toLowerCase().includes('positive') || 
              resultValue.toLowerCase().includes('abnormal') ||
              resultValue.toLowerCase().includes('critical')) {
            displayStatus = resultValue.toLowerCase().includes('critical') ? 'critical' : 'abnormal'
          }
          
          return {
            id: item.id,
            test_name: item.test_name,
            result_value: item.result_value || null,
            status: (item.status || 'pending') as 'pending' | 'preliminary' | 'final' | 'corrected',
            created_at: item.created_at || new Date().toISOString(),
            patient_id: item.patient_id,
            appointment_id: item.appointment_id || null,
            order_id: item.order_id || null,
            // UI-only computed fields
            unit,
            reference_range: referenceRange,
            ordered_by: 'Dr. Unknown', // Not in DB, set default
            displayStatus
          }
        })
        setLabResults(transformedResults)
      } else {
        // No results found, show empty state
        setLabResults([])
      }
      setShowLabResults(true)
    } catch (error) {
      console.error('Error loading lab results:', error)
    } finally {
      setIsLoadingLabs(false)
    }
  }, [patientId, appointmentId])

  return {
    labResults,
    isLoadingLabs,
    showLabResults,
    setShowLabResults,
    loadLabResults
  }
}

