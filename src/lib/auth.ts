import { supabase } from './supabase'
import { Doctor } from './supabase'

export interface AuthUser {
  id: string
  email: string
  doctor?: Doctor
}

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    // Get doctor data
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', user.email!)
      .single()

    if (doctorError) {
      console.error('Error fetching doctor data:', doctorError)
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      doctor
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export const sendOTP = async (email: string) => {
  try {
    // For OTP, we don't include emailRedirectTo - that would send a magic link instead
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false // Only allow existing users
      }
    })
    return { error }
  } catch (error) {
    return { error }
  }
}

export const sendMagicLink = async (email: string) => {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://hipa-doctor-panel.vercel.app/doctor/appointments'
      }
    })
    
    return { error }
  } catch (error) {
    return { error }
  }
}

export const verifyOTP = async (email: string, token: string) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
  }
  return !error
}

export const signOutAndRedirect = async () => {
  await signOut()
  window.location.href = '/login'
}

// Password authentication
export const signInWithPassword = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export const signUpWithPassword = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://hipa-doctor-panel.vercel.app/doctor/appointments'
      }
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export const updatePassword = async (newPassword: string) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export const resetPasswordForEmail = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://hipa-doctor-panel.vercel.app/doctor/profile?tab=password'
    })
    return { error }
  } catch (error) {
    return { error }
  }
}

// Send OTP for password recovery
export const sendPasswordResetOTP = async (email: string) => {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Only allow existing users
        // Use 'recovery' type for password reset
      }
    })
    return { error }
  } catch (error) {
    return { error }
  }
}

// Verify OTP for password recovery
export const verifyPasswordResetOTP = async (email: string, token: string) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery' // Use recovery type for password reset
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

// Update password after OTP verification (user must be authenticated via OTP first)
export const updatePasswordAfterReset = async (newPassword: string) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}