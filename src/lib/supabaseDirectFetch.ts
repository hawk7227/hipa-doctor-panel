// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
/**
 * Direct Fetch Utility - Bypass Supabase Client for Critical Queries
 * 
 * This bypasses the Supabase client library which is causing 20-80 second delays.
 * Direct REST API calls to PostgREST are fast (138ms) but Supabase client adds 20-80s.
 * 
 * Use this for critical queries that need to be fast.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface DirectFetchOptions {
  table: string
  select?: string
  filters?: Record<string, any>
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
  single?: boolean
}

/**
 * Direct fetch to PostgREST API (bypasses Supabase client)
 */
export async function directFetch<T = any>(options: DirectFetchOptions): Promise<{ data: T | null; error: any }> {
  try {
    const { table, select = '*', filters = {}, orderBy, limit, single = false } = options
    
    // Build query string
    const params = new URLSearchParams()
    if (select !== '*') {
      params.append('select', select)
    }
    
    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, `eq.${value}`)
      }
    })
    
    // Add ordering
    if (orderBy) {
      const order = orderBy.ascending !== false ? 'asc' : 'desc'
      params.append('order', `${orderBy.column}.${order}`)
    }
    
    // Add limit
    if (limit) {
      params.append('limit', limit.toString())
    }
    
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': single ? 'return=representation' : 'return=representation'
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      return { data: null, error: { message: error, status: response.status } }
    }
    
    const data = await response.json()
    
    if (single) {
      return { data: Array.isArray(data) && data.length > 0 ? data[0] : null, error: null }
    }
    
    return { data: data as T, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message, code: 'FETCH_ERROR' } }
  }
}

/**
 * Direct fetch with joins (for appointments with doctors/patients)
 */
export async function directFetchWithJoins(
  appointmentId: string
): Promise<{ data: any; error: any }> {
  try {
    // Build the select with joins
    const select = `*,doctors!appointments_doctor_id_fkey(first_name,last_name,specialty,timezone),patients!appointments_patient_id_fkey(id,first_name,last_name,email,phone,date_of_birth,location,allergies,current_medications,active_problems,recent_surgeries_details,ongoing_medical_issues_details,vitals_bp,vitals_hr,vitals_temp,preferred_pharmacy,chief_complaint,ros_general,has_drug_allergies,has_ongoing_medical_issues,has_recent_surgeries)`
    
    const url = `${SUPABASE_URL}/rest/v1/appointments?id=eq.${appointmentId}&select=${encodeURIComponent(select)}&limit=1`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      return { data: null, error: { message: error, status: response.status } }
    }
    
    const data = await response.json()
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null
    
    return { data: result, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message, code: 'FETCH_ERROR' } }
  }
}

