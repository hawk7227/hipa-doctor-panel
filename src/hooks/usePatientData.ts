'use client'

import { useState, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════
// usePatientData — Patient-only data hook
//
// Fetches patient via API route (not direct Supabase)
// Returns enriched patient with DrChrono merge + appointments
// Interface names match DB columns exactly
// ═══════════════════════════════════════════════════════════════

export interface PatientAppointment {
  id: string
  status: string
  visit_type: string | null
  chief_complaint: string | null
  requested_date_time: string | null
  chart_status: string | null
}

export interface PatientData {
  // Core fields (patients table)
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  mobile_phone: string | null
  date_of_birth: string | null
  gender: string | null
  location: string | null
  preferred_pharmacy: string | null
  preferred_language: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  created_at: string
  updated_at: string | null
  // DrChrono enrichment
  address: string | null
  emergency_contact_relation: string | null
  primary_insurance: any | null
  secondary_insurance: any | null
  employer: string | null
  chart_id: string | null
  drchrono_patient_id: number | null
  drchrono_chart_id: string | null
  drchrono_synced: boolean
  drchrono_last_synced: string | null
  race: string | null
  ethnicity: string | null
  // Appointments
  appointments: PatientAppointment[]
  appointments_count: number
}

export function usePatientData(patientId: string | null) {
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPatient = useCallback(async () => {
    if (!patientId) {
      setPatient(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/patients/${patientId}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || `Failed to load patient (${res.status})`)
        setPatient(null)
      } else {
        setPatient(json.data)
        setError(null)
      }
    } catch (err: any) {
      console.error('[usePatientData] Fetch error:', err)
      setError(err.message || 'Network error loading patient')
      setPatient(null)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  return { patient, loading, error, refetch: fetchPatient }
}
