'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DoctorSignupPage() {
  const [step, setStep] = useState(1) // 1=personal, 2=professional, 3=account
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    specialty: '', licenseNumber: '', experienceYears: '',
    education: '', bio: '', languages: '', insuranceAccepted: '', consultationFee: '',
    password: '', confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateStep = (stepNum: number): boolean => {
    setError('')
    if (stepNum === 1) {
      if (!formData.firstName.trim()) { setError('First name is required'); return false }
      if (!formData.lastName.trim()) { setError('Last name is required'); return false }
      if (!formData.email.trim()) { setError('Email is required'); return false }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false }
    }
    if (stepNum === 2) {
      if (!formData.specialty) { setError('Medical specialty is required'); return false }
      if (!formData.licenseNumber.trim()) { setError('License number is required'); return false }
    }
    if (stepNum === 3) {
      if (!formData.password) { setError('Password is required'); return false }
      if (formData.password.length < 8) { setError('Password must be at least 8 characters'); return false }
      if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false }
    }
    return true
  }

  const nextStep = () => {
    if (validateStep(step)) setStep(step + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(3)) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Check if email already exists in applications or doctors
      const { data: existingApp } = await supabase.from('doctor_applications').select('email').eq('email', formData.email).single()
      if (existingApp) { setError('An application with this email already exists'); setLoading(false); return }

      const { data: existingDoctor } = await supabase.from('doctors').select('email').eq('email', formData.email).single()
      if (existingDoctor) { setError('A doctor with this email already exists. Please login instead.'); setLoading(false); return }

      // Submit application (NOT creating auth account yet - admin does that on approval)
      const applicationData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        specialty: formData.specialty,
        license_number: formData.licenseNumber.trim(),
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : 0,
        education: formData.education.trim() || null,
        bio: formData.bio.trim() || null,
        languages: formData.languages ? formData.languages.split(',').map(l => l.trim()).filter(Boolean) : null,
        insurance_accepted: formData.insuranceAccepted ? formData.insuranceAccepted.split(',').map(i => i.trim()).filter(Boolean) : null,
        consultation_fee: formData.consultationFee ? Math.round(parseFloat(formData.consultationFee) * 100) : null,
        password_hash: formData.password, // Stored temporarily — admin creates real auth on approval
        status: 'pending',
        submitted_at: new Date().toISOString()
      }

      const { error: insertError } = await supabase.from('doctor_applications').insert([applicationData])
      if (insertError) { setError(insertError.message); setLoading(false); return }

      // Log the activity
      await supabase.from('activity_logs').insert({
        user_type: 'doctor',
        user_email: formData.email.trim().toLowerCase(),
        user_name: `${formData.firstName} ${formData.lastName}`,
        action: 'doctor_application_submitted',
        resource_type: 'doctor_application',
        description: `New doctor application: Dr. ${formData.firstName} ${formData.lastName} (${formData.specialty})`,
        metadata: { specialty: formData.specialty, license_number: formData.licenseNumber }
      })

      // Try to notify admin
      try {
        await fetch('/api/admin/notify-doctor-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: formData.firstName, lastName: formData.lastName, email: formData.email, specialty: formData.specialty })
        })
      } catch (notifyErr) {
        console.warn('Admin notification failed (non-critical):', notifyErr)
      }

      setSuccess('Your application has been submitted successfully! Our admin team will review your application and you will receive an email with your login credentials once approved.')
      setFormData({ firstName: '', lastName: '', email: '', phone: '', specialty: '', licenseNumber: '', experienceYears: '', education: '', bio: '', languages: '', insuranceAccepted: '', consultationFee: '', password: '', confirmPassword: '' })
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Doctor signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-400 bg-white text-base"
  const labelCls = "block text-sm font-bold text-gray-900 mb-2"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-600 shadow-lg">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Doctor Registration</h2>
          <p className="mt-2 text-base text-gray-700">Join Medazon Health and start helping patients</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {[1,2,3].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{s}</div>
              {s < 3 && <div className={`w-16 h-1 mx-1 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="text-center mb-6">
          <p className="text-sm font-semibold text-gray-600">
            {step === 1 && 'Step 1: Personal Information'}
            {step === 2 && 'Step 2: Professional Information'}
            {step === 3 && 'Step 3: Create Your Account'}
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="bg-white shadow-xl rounded-xl p-8 border border-gray-200">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
              <p className="text-base text-gray-700 mb-6">{success}</p>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
                <p className="text-sm font-semibold text-blue-800">What happens next?</p>
                <ol className="mt-2 text-sm text-blue-700 text-left space-y-1">
                  <li>1. Our admin team reviews your credentials</li>
                  <li>2. Your license and qualifications are verified</li>
                  <li>3. You receive an email with your login details</li>
                  <li>4. Log in and start seeing patients!</li>
                </ol>
              </div>
              <button onClick={() => router.push('/login')} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Go to Login</button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-xl p-8 border border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* STEP 1: Personal Info */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label htmlFor="firstName" className={labelCls}>First Name <span className="text-red-500">*</span></label><input id="firstName" name="firstName" type="text" className={inputCls} value={formData.firstName} onChange={handleInputChange} placeholder="Enter your first name" /></div>
                    <div><label htmlFor="lastName" className={labelCls}>Last Name <span className="text-red-500">*</span></label><input id="lastName" name="lastName" type="text" className={inputCls} value={formData.lastName} onChange={handleInputChange} placeholder="Enter your last name" /></div>
                  </div>
                  <div><label htmlFor="email" className={labelCls}>Email Address <span className="text-red-500">*</span></label><input id="email" name="email" type="email" className={inputCls} value={formData.email} onChange={handleInputChange} placeholder="doctor@example.com" /></div>
                  <div><label htmlFor="phone" className={labelCls}>Phone Number</label><input id="phone" name="phone" type="tel" className={inputCls} value={formData.phone} onChange={handleInputChange} placeholder="(555) 123-4567" /></div>
                </>
              )}

              {/* STEP 2: Professional Info */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="specialty" className={labelCls}>Medical Specialty <span className="text-red-500">*</span></label>
                      <select id="specialty" name="specialty" className={inputCls + " bg-white"} value={formData.specialty} onChange={handleInputChange}>
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
                    <div><label htmlFor="licenseNumber" className={labelCls}>License Number <span className="text-red-500">*</span></label><input id="licenseNumber" name="licenseNumber" type="text" className={inputCls} value={formData.licenseNumber} onChange={handleInputChange} placeholder="Enter your license number" /></div>
                  </div>
                  <div><label htmlFor="experienceYears" className={labelCls}>Years of Experience</label><input id="experienceYears" name="experienceYears" type="number" min="0" className={inputCls} value={formData.experienceYears} onChange={handleInputChange} placeholder="e.g., 10" /></div>
                  <div><label htmlFor="education" className={labelCls}>Education & Qualifications</label><textarea id="education" name="education" rows={3} className={inputCls + " resize-none"} value={formData.education} onChange={handleInputChange} placeholder="e.g., MD from Harvard Medical School, Fellowship at Mayo Clinic" /></div>
                  <div><label htmlFor="bio" className={labelCls}>Professional Bio</label><textarea id="bio" name="bio" rows={3} className={inputCls + " resize-none"} value={formData.bio} onChange={handleInputChange} placeholder="Tell patients about your expertise..." /></div>
                  <div><label htmlFor="languages" className={labelCls}>Languages Spoken</label><input id="languages" name="languages" type="text" className={inputCls} value={formData.languages} onChange={handleInputChange} placeholder="English, Spanish (comma-separated)" /></div>
                  <div><label htmlFor="consultationFee" className={labelCls}>Consultation Fee (USD)</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-gray-500 font-medium">$</span></div><input id="consultationFee" name="consultationFee" type="number" min="0" step="0.01" className={inputCls + " pl-8"} value={formData.consultationFee} onChange={handleInputChange} placeholder="150.00" /></div></div>
                </>
              )}

              {/* STEP 3: Account Creation */}
              {step === 3 && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-bold mb-1">Create your login credentials</p>
                        <p>This password will be used to log into your doctor dashboard once your application is approved.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700"><strong>Name:</strong> Dr. {formData.firstName} {formData.lastName}</p>
                    <p className="text-sm text-gray-700"><strong>Email:</strong> {formData.email}</p>
                    <p className="text-sm text-gray-700"><strong>Specialty:</strong> {formData.specialty}</p>
                    <p className="text-sm text-gray-700"><strong>License:</strong> {formData.licenseNumber}</p>
                  </div>
                  <div><label htmlFor="password" className={labelCls}>Password <span className="text-red-500">*</span></label><input id="password" name="password" type="password" className={inputCls} value={formData.password} onChange={handleInputChange} placeholder="Minimum 8 characters" /><p className="mt-1 text-xs text-gray-500">Minimum 8 characters. Use a strong, unique password.</p></div>
                  <div><label htmlFor="confirmPassword" className={labelCls}>Confirm Password <span className="text-red-500">*</span></label><input id="confirmPassword" name="confirmPassword" type="password" className={inputCls} value={formData.confirmPassword} onChange={handleInputChange} placeholder="Re-enter your password" /></div>
                </>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="text-sm font-semibold text-red-800">{error}</div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                {step > 1 ? (
                  <button type="button" onClick={() => { setStep(step - 1); setError('') }} className="px-6 py-3 text-base font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Back</button>
                ) : (
                  <button type="button" onClick={() => router.push('/login')} className="text-base font-semibold text-blue-600 hover:text-blue-700 transition-colors underline underline-offset-2">Already have an account?</button>
                )}
                {step < 3 ? (
                  <button type="button" onClick={nextStep} className="px-8 py-3 text-base font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg">Continue</button>
                ) : (
                  <button type="submit" disabled={loading} className="px-8 py-3 text-base font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg">
                    {loading ? (<div className="flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Submitting...</div>) : 'Submit Application'}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-base font-semibold text-gray-700 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
            <span className="text-red-500">*</span> Required fields. Your application will be reviewed by our admin team before approval.
          </p>
        </div>
      </div>
    </div>
  )
}
