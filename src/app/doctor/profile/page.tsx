'use client'

import { useEffect, useState } from 'react'
import { supabase, Doctor } from '@/lib/supabase'
import { updatePassword } from '@/lib/auth'

export default function DoctorProfile() {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    specialty: '',
    license_number: '',
    phone: '',
    bio: '',
    experience_years: 0,
    education: '',
    languages: [] as string[],
    insurance_accepted: [] as string[],
    consultation_fee: 0
  })

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    fetchDoctorProfile()
  }, [])

  const fetchDoctorProfile = async () => {
    try {
      // For demo purposes, we'll use the first doctor
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .limit(1)
        .single()

      if (error) {
        console.error('Error fetching doctor profile:', error)
        return
      }

      if (data) {
        setDoctor(data)
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          specialty: data.specialty || '',
          license_number: data.license_number || '',
          phone: data.phone || '',
          bio: data.bio || '',
          experience_years: data.experience_years || 0,
          education: data.education || '',
          languages: data.languages || [],
          insurance_accepted: data.insurance_accepted || [],
          consultation_fee: data.consultation_fee || 0
        })
      }
    } catch (error) {
      console.error('Error fetching doctor profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (!doctor) return

      const { error } = await supabase
        .from('doctors')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctor.id)

      if (error) {
        console.error('Error updating doctor profile:', error)
        return
      }

      setEditing(false)
      fetchDoctorProfile()
    } catch (error) {
      console.error('Error updating doctor profile:', error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayInputChange = (field: 'languages' | 'insurance_accepted', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item)
    setFormData(prev => ({
      ...prev,
      [field]: items
    }))
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    // Validate passwords
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      setPasswordLoading(false)
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match')
      setPasswordLoading(false)
      return
    }

    try {
      const { error } = await updatePassword(passwordData.newPassword)

      if (error) {
        const errorMessage = typeof error === 'object' && error && 'message' in error 
          ? (error as { message: string }).message 
          : 'Failed to update password'
        setPasswordError(errorMessage)
        setPasswordLoading(false)
        return
      }

      setPasswordSuccess('Password updated successfully!')
      setPasswordData({ newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        setShowPasswordSection(false)
        setPasswordSuccess('')
      }, 2000)
    } catch (error) {
      setPasswordError('An unexpected error occurred')
      console.error('Password update error:', error)
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-full overflow-hidden bg-slate-50 min-h-screen">
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 rounded-xl border border-slate-600 shadow-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Profile & Credentials</h1>
              <p className="text-slate-200 mt-2">Manage your professional profile and credentials</p>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                editing 
                  ? 'bg-white text-slate-700 hover:bg-slate-50 shadow-md' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-md'
              }`}
            >
              {editing ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Profile Overview Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar Section */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center shadow-lg ring-4 ring-slate-100">
                <span className="text-white text-2xl sm:text-3xl font-bold">
                  {formData.first_name?.charAt(0)}{formData.last_name?.charAt(0)}
                </span>
              </div>
            </div>
            
            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    Dr. {formData.first_name} {formData.last_name}
                  </h2>
                  <p className="text-lg text-slate-700 font-semibold mt-1">{formData.specialty}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{formData.experience_years} years experience</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="font-medium">${formData.consultation_fee}/consultation</span>
                    </div>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                    Active
                  </span>
                  <p className="text-xs text-slate-700 font-semibold">License: {formData.license_number}</p>
                </div>
              </div>
              
              {/* Bio Preview */}
              {formData.bio && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-800 leading-relaxed line-clamp-3">{formData.bio}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter your first name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter your last name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter your email address"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter your phone number"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Medical Specialty
              </label>
              <input
                type="text"
                value={formData.specialty}
                onChange={(e) => handleInputChange('specialty', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="e.g., Cardiology, Neurology, etc."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                License Number
              </label>
              <input
                type="text"
                value={formData.license_number}
                onChange={(e) => handleInputChange('license_number', e.target.value)}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter your medical license number"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Years of Experience
              </label>
              <input
                type="number"
                value={formData.experience_years}
                onChange={(e) => handleInputChange('experience_years', parseInt(e.target.value))}
                disabled={!editing}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                placeholder="Enter years of experience"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Consultation Fee ($)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-500 text-sm font-medium">$</span>
                </div>
                <input
                  type="number"
                  value={formData.consultation_fee}
                  onChange={(e) => handleInputChange('consultation_fee', parseInt(e.target.value))}
                  disabled={!editing}
                  className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
        </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Professional Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!editing}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 resize-none bg-white"
                placeholder="Tell patients about your background, expertise, and approach to care..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Education & Training
              </label>
              <textarea
                value={formData.education}
                onChange={(e) => handleInputChange('education', e.target.value)}
                disabled={!editing}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 resize-none bg-white"
                placeholder="List your medical degrees, residencies, fellowships, and certifications..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Languages Spoken
              </label>
              <input
                type="text"
                value={formData.languages.join(', ')}
                onChange={(e) => handleArrayInputChange('languages', e.target.value)}
                disabled={!editing}
                placeholder="English, Spanish, French, etc."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
              />
              <p className="text-xs text-slate-600 font-medium">Separate multiple languages with commas</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Insurance Accepted
              </label>
              <input
                type="text"
                value={formData.insurance_accepted.join(', ')}
                onChange={(e) => handleArrayInputChange('insurance_accepted', e.target.value)}
                disabled={!editing}
                placeholder="Blue Cross, Aetna, Cigna, etc."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all duration-200 bg-white"
              />
              <p className="text-xs text-slate-600 font-medium">Separate multiple insurance providers with commas</p>
            </div>
          </div>

          {editing && (
            <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
              <button
                onClick={() => setEditing(false)}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold bg-white shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl hover:from-slate-800 hover:to-slate-900 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                Save Changes
              </button>
            </div>
          )}
      </div>

        {/* Security & Password Management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 sm:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Security & Password</h2>
            </div>
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-all duration-200 text-sm font-medium shadow-md"
            >
              {showPasswordSection ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {!showPasswordSection ? (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Password Authentication</h3>
                  <p className="text-sm text-slate-700 font-medium">Keep your account secure with a strong password</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Minimum 6 characters</li>
                      <li>Use a unique password you don&apos;t use elsewhere</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 transition-all duration-200 bg-white text-slate-900 pr-10"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showNewPassword ? (
                      <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 transition-all duration-200 bg-white text-slate-900 pr-10"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>



              {passwordError && (
                <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-red-800">{passwordError}</div>
                  </div>
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-green-800">{passwordSuccess}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-3 px-6 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update Password'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false)
                    setPasswordData({ newPassword: '', confirmPassword: '' })
                    setPasswordError('')
                    setPasswordSuccess('')
                  }}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Credentialing Status */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Credentialing Status</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-200 rounded-full shadow-sm">
                  Approved
                </span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Medical License</h3>
              <p className="text-sm text-slate-700 font-medium">Verified and Active</p>
              <p className="text-xs text-emerald-800 mt-2 font-bold">License: {formData.license_number}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="px-3 py-1 text-xs font-semibold text-amber-800 bg-amber-200 rounded-full shadow-sm">
                  Pending
                </span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">HIPAA Compliance</h3>
              <p className="text-sm text-slate-700 font-medium">Review in progress</p>
              <p className="text-xs text-amber-800 mt-2 font-bold">Expected: 2-3 business days</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-200 rounded-full shadow-sm">
                  Approved
                </span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Background Check</h3>
              <p className="text-sm text-slate-700 font-medium">Completed and Verified</p>
              <p className="text-xs text-emerald-800 mt-2 font-bold">Completed: 2 weeks ago</p>
            </div>
          </div>
        </div>

        
      </div>
    </div>
  )
}
