// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sendPasswordResetOTP, verifyPasswordResetOTP, updatePasswordAfterReset, signOut } from '@/lib/auth'

type Step = 'email' | 'otp' | 'newPassword'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // First check if the email belongs to a doctor
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', email)
        .single()

      if (doctorError || !doctor) {
        setError('No account found with this email address.')
        return
      }

      // Check if doctor is approved
      if (!doctor.is_approved) {
        setError('Your account is pending approval. Please contact support.')
        return
      }

      // Send OTP for password recovery
      const { error: otpError } = await sendPasswordResetOTP(email)

      if (otpError) {
        setError((otpError as Error).message || 'Failed to send OTP. Please try again.')
        return
      }

      setStep('otp')
      setSuccess('OTP code sent to your email! Please check your inbox and enter the code below.')
    } catch (error) {
      setError('An unexpected error occurred')
      console.error('OTP send error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!otpToken || otpToken.length !== 6) {
        setError('Please enter a valid 6-digit OTP code')
        return
      }

      // Verify OTP for password recovery
      // Using email type - this will sign the user in temporarily so they can update password
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpToken,
        type: 'email'
      })

      if (verifyError) {
        setError((verifyError as Error).message || 'Invalid OTP code. Please try again.')
        return
      }

      if (data?.user) {
        setStep('newPassword')
        setSuccess('OTP verified! Please set your new password.')
      }
    } catch (error) {
      setError('An unexpected error occurred')
      console.error('OTP verification error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate passwords
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      // Update password
      const { data, error: updateError } = await updatePasswordAfterReset(newPassword)

      if (updateError) {
        setError((updateError as Error).message || 'Failed to update password. Please try again.')
        return
      }

      // Sign out after password update
      await signOut()

      setSuccess('Password updated successfully! Redirecting to login...')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      setError('An unexpected error occurred')
      console.error('Password update error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-900">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            {step === 'email' && 'Enter your email to receive an OTP code'}
            {step === 'otp' && 'Enter the OTP code sent to your email'}
            {step === 'newPassword' && 'Set your new password'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-2">
          <div className={`flex items-center ${step === 'email' ? 'text-red-500' : step === 'otp' || step === 'newPassword' ? 'text-green-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'email' ? 'bg-red-600' : 'bg-green-600'}`}>
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <span className="ml-2 text-sm">Email</span>
          </div>
          <div className={`w-12 h-0.5 ${step === 'otp' || step === 'newPassword' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          <div className={`flex items-center ${step === 'otp' ? 'text-red-500' : step === 'newPassword' ? 'text-green-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'otp' ? 'bg-red-600' : step === 'newPassword' ? 'bg-green-600' : 'bg-gray-600'}`}>
              <span className="text-white text-sm font-bold">2</span>
            </div>
            <span className="ml-2 text-sm">OTP</span>
          </div>
          <div className={`w-12 h-0.5 ${step === 'newPassword' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          <div className={`flex items-center ${step === 'newPassword' ? 'text-red-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'newPassword' ? 'bg-red-600' : 'bg-gray-600'}`}>
              <span className="text-white text-sm font-bold">3</span>
            </div>
            <span className="ml-2 text-sm">Password</span>
          </div>
        </div>

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-900 p-4 border border-red-700">
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-900 p-4 border border-green-700">
                <div className="text-sm text-green-300">{success}</div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending OTP...
                  </div>
                ) : (
                  'Send OTP Code'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
            <div>
              <label htmlFor="otp-token" className="block text-sm font-medium text-gray-300 mb-2">
                Enter OTP Code
              </label>
              <input
                id="otp-token"
                name="otp-token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-400 text-center">
                Enter the 6-digit code sent to {email}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-900 p-4 border border-red-700">
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-900 p-4 border border-green-700">
                <div className="text-sm text-green-300">{success}</div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtpToken('')
                  setError('')
                  setSuccess('')
                }}
                className="flex-1 py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Resend OTP
              </button>
              <button
                type="submit"
                disabled={loading || otpToken.length !== 6}
                className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </div>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 'newPassword' && (
          <form className="mt-8 space-y-6" onSubmit={handleSetNewPassword}>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm pr-10"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm pr-10"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-900 p-4 border border-red-700">
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-900 p-4 border border-green-700">
                <div className="text-sm text-green-300">{success}</div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('otp')
                  setNewPassword('')
                  setConfirmPassword('')
                  setError('')
                  setSuccess('')
                }}
                className="flex-1 py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </div>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-red-500 hover:text-red-400 font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

