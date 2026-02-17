// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DoctorSignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    specialty: '',
    licenseNumber: '',
    phone: '',
    bio: '',
    experienceYears: '',
    education: '',
    languages: '',
    insuranceAccepted: '',
    consultationFee: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate required fields
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.specialty || !formData.licenseNumber) {
        setError('Please fill in all required fields')
        return
      }

      // Check if email already exists
      const { data: existingDoctor, error: checkError } = await supabase
        .from('doctors')
        .select('email')
        .eq('email', formData.email)
        .single()

      if (existingDoctor) {
        setError('A doctor with this email already exists')
        return
      }

      // Check if license number already exists
      const { data: existingLicense, error: licenseError } = await supabase
        .from('doctors')
        .select('license_number')
        .eq('license_number', formData.licenseNumber)
        .single()

      if (existingLicense) {
        setError('A doctor with this license number already exists')
        return
      }

      // Prepare data for insertion
      const doctorData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        specialty: formData.specialty,
        license_number: formData.licenseNumber,
        phone: formData.phone || null,
        bio: formData.bio || null,
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : 0,
        education: formData.education || null,
        languages: formData.languages ? formData.languages.split(',').map(lang => lang.trim()) : null,
        insurance_accepted: formData.insuranceAccepted ? formData.insuranceAccepted.split(',').map(ins => ins.trim()) : null,
        consultation_fee: formData.consultationFee ? parseInt(formData.consultationFee) * 100 : null, // Convert to cents
        is_approved: false, // New doctors need approval
        submitted_at: new Date().toISOString()
      }

      // Insert doctor record
      const { error: insertError } = await supabase
        .from('doctors')
        .insert([doctorData])

      if (insertError) {
        setError(insertError.message)
        return
      }

      // Send admin notification about new doctor application
      try {
        const notificationResponse = await fetch('/api/admin/notify-doctor-application', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            specialty: formData.specialty,
            licenseNumber: formData.licenseNumber,
            phone: formData.phone || undefined,
            bio: formData.bio || undefined,
            experienceYears: formData.experienceYears ? parseInt(formData.experienceYears) : undefined,
            education: formData.education || undefined,
            languages: formData.languages ? formData.languages.split(',').map(lang => lang.trim()) : undefined,
            insuranceAccepted: formData.insuranceAccepted ? formData.insuranceAccepted.split(',').map(ins => ins.trim()) : undefined,
            consultationFee: formData.consultationFee ? parseInt(formData.consultationFee) * 100 : undefined
          })
        })

        if (!notificationResponse.ok) {
          console.warn('⚠️ Failed to send admin notification, but application was submitted successfully')
        }
      } catch (notificationError) {
        console.warn('⚠️ Error sending admin notification:', notificationError)
        // Don't fail the signup if notification fails
      }

      setSuccess('Your application has been submitted successfully! You will receive an email once your account is approved by our admin team.')
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        specialty: '',
        licenseNumber: '',
        phone: '',
        bio: '',
        experienceYears: '',
        education: '',
        languages: '',
        insuranceAccepted: '',
        consultationFee: ''
      })

    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Doctor signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-600 shadow-lg">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Doctor Registration
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Join our medical platform and start helping patients
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-xl p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-800 mb-2">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-800 mb-2">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-2">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-800 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
              />
            </div>

            {/* Professional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="specialty" className="block text-sm font-semibold text-gray-800 mb-2">
                  Medical Specialty *
                </label>
                <select
                  id="specialty"
                  name="specialty"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                  value={formData.specialty}
                  onChange={handleInputChange}
                >
                  <option value="">Select Specialty</option>
                  <option value="Urology">Urology</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Family Medicine">Family Medicine</option>
                  <option value="Emergency Medicine">Emergency Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Oncology">Oncology</option>
                  <option value="Psychiatry">Psychiatry</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="licenseNumber" className="block text-sm font-semibold text-gray-800 mb-2">
                  Medical License Number *
                </label>
                <input
                  id="licenseNumber"
                  name="licenseNumber"
                  type="text"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  placeholder="Enter your license number"
                />
              </div>
            </div>

            <div>
              <label htmlFor="experienceYears" className="block text-sm font-semibold text-gray-800 mb-2">
                Years of Experience
              </label>
              <input
                id="experienceYears"
                name="experienceYears"
                type="number"
                min="0"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.experienceYears}
                onChange={handleInputChange}
                placeholder="Enter years of experience"
              />
            </div>

            <div>
              <label htmlFor="education" className="block text-sm font-semibold text-gray-800 mb-2">
                Education & Qualifications
              </label>
              <textarea
                id="education"
                name="education"
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
                value={formData.education}
                onChange={handleInputChange}
                placeholder="e.g., MD from Harvard Medical School, Fellowship in Urology at Mayo Clinic"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-semibold text-gray-800 mb-2">
                Professional Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell patients about your expertise and approach to care..."
              />
            </div>

            <div>
              <label htmlFor="languages" className="block text-sm font-semibold text-gray-800 mb-2">
                Languages Spoken
              </label>
              <input
                id="languages"
                name="languages"
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.languages}
                onChange={handleInputChange}
                placeholder="English, Spanish, French (comma-separated)"
              />
            </div>

            <div>
              <label htmlFor="insuranceAccepted" className="block text-sm font-semibold text-gray-800 mb-2">
                Insurance Accepted
              </label>
              <input
                id="insuranceAccepted"
                name="insuranceAccepted"
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.insuranceAccepted}
                onChange={handleInputChange}
                placeholder="Blue Cross, Aetna, UnitedHealth (comma-separated)"
              />
            </div>

            <div>
              <label htmlFor="consultationFee" className="block text-sm font-semibold text-gray-800 mb-2">
                Consultation Fee (USD)
              </label>
              <input
                id="consultationFee"
                name="consultationFee"
                type="number"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                value={formData.consultationFee}
                onChange={handleInputChange}
                placeholder="150.00"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4">
                <div className="text-sm font-medium text-red-800">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-50 border-2 border-green-200 p-4">
                <div className="text-sm font-medium text-green-800">{success}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Already have an account? Login
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-gray-700 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
            * Required fields. Your application will be reviewed by our admin team before approval.
          </p>
        </div>
      </div>
    </div>
  )
}
