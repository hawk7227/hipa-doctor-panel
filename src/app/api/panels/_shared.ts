import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Resolve drchrono_patient_id from a local patient UUID.
 * 1. Check patients.drchrono_patient_id
 * 2. Fallback: match by email in drchrono_patients table
 * Returns null if not found.
 */
export async function getDrchronoPatientId(patientId: string): Promise<number | null> {
  try {
    // Primary: check patients table
    const { data: patient } = await db
      .from('patients')
      .select('drchrono_patient_id, email')
      .eq('id', patientId)
      .single()

    if (patient?.drchrono_patient_id) {
      return patient.drchrono_patient_id
    }

    // Fallback: match by email in drchrono_patients
    if (patient?.email) {
      const { data: dcPatient } = await db
        .from('drchrono_patients')
        .select('drchrono_patient_id')
        .eq('email', patient.email)
        .limit(1)
        .single()

      if (dcPatient?.drchrono_patient_id) {
        return dcPatient.drchrono_patient_id
      }
    }

    return null
  } catch {
    return null
  }
}

export { db }
