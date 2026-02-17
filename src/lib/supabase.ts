// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, // RE-ENABLED: keeps session alive, refreshes token before expiry
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'doctor-panel'
    },
    // Resilient fetch with retry + longer timeout
    fetch: (url, options = {}) => {
      const timeout = 45000 // 45 seconds (was 30 — too aggressive for cold starts)
      const maxRetries = 2

      const attemptFetch = async (attempt: number): Promise<Response> => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal
          })
          return response
        } catch (error: any) {
          if (error.name === 'AbortError') {
            if (attempt < maxRetries) {
              console.log(`[Supabase] Timeout on attempt ${attempt + 1}, retrying...`)
              return attemptFetch(attempt + 1)
            }
            throw new Error('Request timeout after retries - please try again')
          }
          if (error.message === 'Failed to fetch' && attempt < maxRetries) {
            // Network blip — wait and retry
            console.log(`[Supabase] Network error on attempt ${attempt + 1}, retrying in 2s...`)
            await new Promise(r => setTimeout(r, 2000))
            return attemptFetch(attempt + 1)
          }
          throw error
        } finally {
          clearTimeout(timeoutId)
        }
      }

      return attemptFetch(0)
    }
  }
})

// Handle auth state changes with auto-recovery
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Supabase Auth]', event, session ? 'session active' : 'no session')

    if (event === 'TOKEN_REFRESHED') {
      console.log('[Supabase Auth] Token refreshed successfully')
    }

    if (event === 'SIGNED_OUT') {
      console.log('[Supabase Auth] Session ended — redirecting to login')
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
  })

  // Session health check — runs every 5 minutes
  // If session is dead, redirect to login instead of showing "Unauthorized" on every panel
  setInterval(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && !window.location.pathname.includes('/login')) {
        console.log('[Supabase Health] No active session — attempting refresh')
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          console.log('[Supabase Health] Refresh failed — session expired')
          // Don't auto-redirect, just log. The auth fallback chain in _shared.ts handles API calls.
        }
      }
    } catch {
      // Silent fail — don't break the app over a health check
    }
  }, 5 * 60 * 1000) // Every 5 minutes
}

// Database types
export interface Doctor {
  id: string
  first_name: string
  last_name: string
  email: string
  specialty: string
  license_number: string
  phone?: string
  bio?: string
  experience_years: number
  education?: string
  languages?: string[]
  insurance_accepted?: string[]
  availability_schedule?: any
  consultation_fee?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  location?: string | null
  timezone?: string
  has_drug_allergies?: boolean
  has_recent_surgeries?: boolean
  recent_surgeries_details?: string | null
  has_ongoing_medical_issues?: boolean
  ongoing_medical_issues_details?: string | null
  chief_complaint?: string | null
  ros_general?: string | null
  allergies?: string | null
  current_medications?: string | null
  active_problems?: string | null
  vitals_bp?: string | null
  vitals_hr?: string | null
  vitals_temp?: string | null
  preferred_pharmacy?: string | null
  sms_enabled?: boolean
  email_enabled?: boolean
  call_enabled?: boolean
  communication_links?: any
  video_link?: string | null
  phone_link?: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  doctor_id?: string
  patient_id?: string | null
  service_type: string
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
  payment_intent_id?: string
  payment_status: 'authorized' | 'captured' | 'cancelled'
  visit_type?: 'async' | 'video' | 'phone'
  requested_date_time?: string
  zoom_meeting_url?: string
  zoom_meeting_id?: string
  zoom_meeting_password?: string
  notes?: string
  chart_locked: boolean | null
  updated_at: string
  patients?: Patient | null
}

export interface AppointmentWithUser extends Appointment {
  // Legacy - keeping for backward compatibility, but patient info is now in appointment directly
}

export interface MedicalRecord {
  id: string
  user_id: string
  appointment_id?: string
  record_type: 'prescription' | 'lab_result' | 'imaging' | 'visit_summary' | 'other'
  title: string
  description?: string
  file_url?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  ai_summary?: string
  is_shared: boolean
  shared_with_doctor_id?: string
  created_at: string
  updated_at: string
}

export interface MedicalRecordWithUser extends MedicalRecord {
  users: {
    first_name: string
    last_name: string
    email: string
  }
  appointments?: {
    id: string
    created_at: string
  }
}

export interface PaymentRecord {
  id: string
  appointment_id: string
  payment_intent_id: string
  amount: number
  currency: string
  status: 'authorized' | 'captured' | 'cancelled'
  stripe_payment_intent_id: string
  created_at: string
  updated_at: string
}

export interface PaymentRecordWithAppointment extends PaymentRecord {
  appointments: {
    id: string
    status: string
    created_at: string
    patients?: {
      first_name?: string
      last_name?: string
    } | null
  }
}

export interface Notification {
  id: string
  user_id: string
  type: 'appointment_reminder' | 'appointment_confirmed' | 'appointment_cancelled' | 'payment_reminder' | 'general'
  title: string
  message: string
  is_read: boolean
  scheduled_for?: string
  sent_at?: string
  created_at: string
}

export interface AppointmentMessage {
  id: string
  appointment_id: string
  sender_id: string
  sender_type: 'doctor' | 'user'
  message_text: string
  message_type: 'text' | 'system' | 'notification'
  is_read: boolean
  read_at?: string
  created_at: string
  updated_at: string
}

export interface AppointmentDocument {
  id: string
  appointment_id: string
  message_id?: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_type: 'doctor' | 'patient'
  created_at: string
}
