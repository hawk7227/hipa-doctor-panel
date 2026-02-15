'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, signInWithPassword, sendOTP, verifyOTP } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

function LoginPageInner() {
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/doctor/appointments'

  const doRedirect = (path?: string) => {
    const dest = path || redirectTo
    // Use window.location for reliable redirect (router.push can fail with encoded URLs)
    window.location.href = dest
  }

  // Check if user is already authenticated
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const user = await getCurrentUser()
      if (user) {
        // User is already authenticated, redirect to appointments
        doRedirect()
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
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
        setError('Access denied. Only registered doctors can access this panel.')
        return
      }

      // Check if doctor is approved
      if (!doctor.is_approved) {
        setError('Your account is pending approval. Please wait for admin approval or contact support.')
        return
      }

      // Sign in with password
      const { data, error: signInError } = await signInWithPassword(email, password)

      if (signInError) {
        setError((signInError as Error).message || 'Invalid email or password')
        return
      }

      if (data?.user) {
        logAudit({ action: 'LOGIN', resourceType: 'system', description: `Password login: ${email}` })
        setSuccess('Login successful! Redirecting...')
        setTimeout(() => {
          doRedirect()
        }, 1000)
      }
    } catch (error) {
      setError('An unexpected error occurred')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setOtpSent(false)
    setOtpToken('')

    try {
      // First check if the email belongs to a doctor
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', email)
        .single()

      if (doctorError || !doctor) {
        setError('Access denied. Only registered doctors can access this panel.')
        return
      }

      // Check if doctor is approved
      if (!doctor.is_approved) {
        setError('Your account is pending approval. Please wait for admin approval or contact support.')
        return
      }

      // Send OTP via email
      const { error: otpError } = await sendOTP(email)

      if (otpError) {
        setError((otpError as Error).message || 'Failed to send OTP. Please try again.')
        return
      }

      setOtpSent(true)
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

      // Verify OTP
      const { data, error: verifyError } = await verifyOTP(email, otpToken)

      if (verifyError) {
        setError((verifyError as Error).message || 'Invalid OTP code. Please try again.')
        return
      }

      if (data?.user) {
        logAudit({ action: 'LOGIN', resourceType: 'system', description: `OTP login: ${email}` })
        setSuccess('Login successful! Redirecting...')
        setTimeout(() => {
          doRedirect()
        }, 1000)
      }
    } catch (error) {
      setError('An unexpected error occurred')
      console.error('OTP verification error:', error)
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Doctor Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Sign in to access your doctor panel
          </p>
        </div>

        {/* Login Method Toggle */}
        <div className="bg-gray-800 rounded-lg p-1 flex gap-1">
          <button
            onClick={() => {
              setLoginMethod('password')
              setOtpSent(false)
              setOtpToken('')
              setError('')
              setSuccess('')
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
              loginMethod === 'password'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => {
              setLoginMethod('otp')
              setOtpSent(false)
              setOtpToken('')
              setError('')
              setSuccess('')
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
              loginMethod === 'otp'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            OTP Code
          </button>
        </div>

        {/* Password Login Form */}
        {loginMethod === 'password' && (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordLogin}>
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <a href="/forgot-password" className="font-medium text-red-500 hover:text-red-400">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        )}

        {/* OTP Form */}
        {loginMethod === 'otp' && (
          <div className="mt-8 space-y-6">
            {!otpSent ? (
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label htmlFor="email-otp" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email-otp"
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
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
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
                      setOtpSent(false)
                      setOtpToken('')
                      setError('')
                      setSuccess('')
                    }}
                    className="flex-1 py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Change Email
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
                      'Verify OTP'
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="text-sm text-red-500 hover:text-red-400 font-medium disabled:opacity-50"
                  >
                    Resend OTP Code
                  </button>
                </div>
              </form>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-300">
                Secure login with OTP Code - No password required
              </p>
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="mt-2 text-sm text-gray-300">
            New doctor?{' '}
            <a href="/doctor-signup" className="text-red-500 hover:text-red-400 font-medium">
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900" />}>
      <LoginPageInner />
    </Suspense>
  )
}
