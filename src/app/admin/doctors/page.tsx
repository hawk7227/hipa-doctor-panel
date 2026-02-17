// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Doctor {
  id: string
  first_name: string
  last_name: string
  email: string
  specialty: string
  license_number: string
  phone: string
  bio: string
  experience_years: number
  education: string
  languages: string[]
  insurance_accepted: string[]
  consultation_fee: number
  is_approved: boolean
  submitted_at: string
  approved_at: string | null
  rejection_reason: string | null
}

export default function AdminDoctorsPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')

  useEffect(() => {
    if (isAuthenticated) {
      fetchDoctors()
    }
  }, [filter, isAuthenticated])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'sk') {
      setIsAuthenticated(true)
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password')
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      let query = supabase.from('doctors').select('*').order('submitted_at', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('is_approved', false)
      } else if (filter === 'approved') {
        query = query.eq('is_approved', true)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
        return
      }

      setDoctors(data || [])
    } catch (error) {
      setError('Failed to fetch doctors')
      console.error('Error fetching doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (doctorId: string) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          rejection_reason: null
        })
        .eq('id', doctorId)

      if (error) {
        setError(error.message)
        return
      }

      setSuccess('Doctor approved successfully')
      fetchDoctors()
    } catch (error) {
      setError('Failed to approve doctor')
      console.error('Error approving doctor:', error)
    }
  }

  const handleReject = async (doctorId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({
          is_approved: false,
          rejection_reason: reason,
          approved_at: null
        })
        .eq('id', doctorId)

      if (error) {
        setError(error.message)
        return
      }

      setSuccess('Doctor rejected successfully')
      fetchDoctors()
    } catch (error) {
      setError('Failed to reject doctor')
      console.error('Error rejecting doctor:', error)
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Admin Access
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter admin password to continue
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handlePasswordSubmit}>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <div className="text-red-600 text-sm text-center">
                {passwordError}
              </div>
            )}
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Access Admin Panel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Doctor Management</h1>
          <p className="mt-2 text-gray-600">Review and approve doctor applications</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'pending', label: 'Pending Approval', count: doctors.filter(d => !d.is_approved).length },
                { key: 'approved', label: 'Approved', count: doctors.filter(d => d.is_approved).length },
                { key: 'all', label: 'All Doctors', count: doctors.length }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid gap-6">
            {doctors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No doctors found</p>
              </div>
            ) : (
              doctors.map((doctor) => (
                <div key={doctor.id} className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Dr. {doctor.first_name} {doctor.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{doctor.email}</p>
                      <p className="text-sm text-gray-600">{doctor.specialty}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        doctor.is_approved
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doctor.is_approved ? 'Approved' : 'Pending'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted: {formatDate(doctor.submitted_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">License Number</p>
                      <p className="text-sm text-gray-900">{doctor.license_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-sm text-gray-900">{doctor.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Experience</p>
                      <p className="text-sm text-gray-900">{doctor.experience_years} years</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Consultation Fee</p>
                      <p className="text-sm text-gray-900">
                        {doctor.consultation_fee ? formatCurrency(doctor.consultation_fee) : 'Not set'}
                      </p>
                    </div>
                  </div>

                  {doctor.bio && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700">Bio</p>
                      <p className="text-sm text-gray-900">{doctor.bio}</p>
                    </div>
                  )}

                  {doctor.education && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700">Education</p>
                      <p className="text-sm text-gray-900">{doctor.education}</p>
                    </div>
                  )}

                  {doctor.languages && doctor.languages.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700">Languages</p>
                      <p className="text-sm text-gray-900">{doctor.languages.join(', ')}</p>
                    </div>
                  )}

                  {doctor.insurance_accepted && doctor.insurance_accepted.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700">Insurance Accepted</p>
                      <p className="text-sm text-gray-900">{doctor.insurance_accepted.join(', ')}</p>
                    </div>
                  )}

                  {doctor.rejection_reason && (
                    <div className="mb-4 p-3 bg-red-50 rounded-md">
                      <p className="text-sm font-medium text-red-700">Rejection Reason</p>
                      <p className="text-sm text-red-600">{doctor.rejection_reason}</p>
                    </div>
                  )}

                  {!doctor.is_approved && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleApprove(doctor.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:')
                          if (reason) {
                            handleReject(doctor.id, reason)
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
