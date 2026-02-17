// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

interface SignupForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
  license_number: string
  npi_number: string
  specialty: string
  practice_name: string
  practice_address: string
  practice_city: string
  practice_state: string
  practice_zip: string
  consultation_fee: string
  bio: string
}

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<SignupForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    license_number: '',
    npi_number: '',
    specialty: '',
    practice_name: '',
    practice_address: '',
    practice_city: '',
    practice_state: '',
    practice_zip: '',
    consultation_fee: '',
    bio: '',
  })

  function updateForm(field: keyof SignupForm, value: string) {
    setForm({ ...form, [field]: value })
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await getSupabase().auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: 'doctor',
          },
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      // 2. Insert into doctors table
      const { error: insertError } = await getSupabase()
        .from('doctors')
        .insert({
          auth_user_id: authData.user.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          license_number: form.license_number || null,
          npi_number: form.npi_number || null,
          specialty: form.specialty || null,
          practice_name: form.practice_name || null,
          practice_address: form.practice_address || null,
          practice_city: form.practice_city || null,
          practice_state: form.practice_state || null,
          practice_zip: form.practice_zip || null,
          consultation_fee: form.consultation_fee ? parseFloat(form.consultation_fee) : null,
          bio: form.bio || null,
          is_approved: false,
          created_at: new Date().toISOString(),
        })

      if (insertError) {
        console.log('Doctor insert error:', insertError)
        setError('Failed to save application. Please try again.')
        setLoading(false)
        return
      }

      // 3. Notify admin (non-blocking)
      try {
        await fetch('/api/admin/notify-doctor-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'doctor_application',
            name: form.first_name + ' ' + form.last_name,
            email: form.email,
          }),
        })
      } catch (notifyErr) {
        console.log('Admin notification failed (non-blocking):', notifyErr)
      }

      // Sign out — doctor cannot login until approved
      await getSupabase().auth.signOut()

      setSubmitted(true)
    } catch (err) {
      console.log('Signup error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050810', color: '#E8ECF1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          maxWidth: 500, textAlign: 'center', padding: 48,
          background: 'rgba(17,24,32,0.9)', borderRadius: 24,
          border: '1px solid rgba(30,42,58,0.8)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: 'rgba(34,197,94,0.15)', color: '#22C55E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Application Submitted!</h2>
          <p style={{ color: '#7B8CA3', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            Thank you, Dr. {form.last_name}. Your application is under review.
            You will receive an email at <strong style={{ color: '#E8ECF1' }}>{form.email}</strong> once your account is approved.
          </p>
          <p style={{ color: '#7B8CA3', fontSize: 13, marginBottom: 24 }}>
            Typical review time: <strong style={{ color: '#F59E0B' }}>24-48 hours</strong>
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block', padding: '12px 32px',
              borderRadius: 12, background: '#00D4AA', color: '#050810',
              fontWeight: 700, textDecoration: 'none',
            }}
          >
            Back to Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050810', color: '#E8ECF1',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        padding: '16px 32px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #00D4AA, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>MedazonHealth</span>
        </div>
        <a href="/login" style={{ color: '#00D4AA', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Already have an account? Sign In
        </a>
      </nav>

      {/* Form */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Provider Application</h1>
        <p style={{ color: '#7B8CA3', fontSize: 15, marginBottom: 32 }}>
          Complete the form below. Your application will be reviewed by our admin team.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Personal Info */}
          <SectionHeader title="Personal Information" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <Field label="First Name" required value={form.first_name} onChange={(v) => updateForm('first_name', v)} placeholder="Jane" />
            <Field label="Last Name" required value={form.last_name} onChange={(v) => updateForm('last_name', v)} placeholder="Smith" />
            <Field label="Email" required type="email" value={form.email} onChange={(v) => updateForm('email', v)} placeholder="jane@practice.com" />
            <Field label="Phone" required value={form.phone} onChange={(v) => updateForm('phone', v)} placeholder="(555) 123-4567" />
            <Field label="Password" required type="password" value={form.password} onChange={(v) => updateForm('password', v)} placeholder="Min 8 characters" />
            <Field label="Confirm Password" required type="password" value={form.confirm_password} onChange={(v) => updateForm('confirm_password', v)} placeholder="Confirm password" />
          </div>

          {/* Professional Info */}
          <SectionHeader title="Professional Information" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <Field label="Medical License #" value={form.license_number} onChange={(v) => updateForm('license_number', v)} placeholder="FL-12345" />
            <Field label="NPI Number" value={form.npi_number} onChange={(v) => updateForm('npi_number', v)} placeholder="1234567890" />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Specialty" value={form.specialty} onChange={(v) => updateForm('specialty', v)} placeholder="Family Medicine, Urgent Care, etc." />
            </div>
          </div>

          {/* Practice Info */}
          <SectionHeader title="Practice Details" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Practice Name" value={form.practice_name} onChange={(v) => updateForm('practice_name', v)} placeholder="Smith Medical Group" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Practice Address" value={form.practice_address} onChange={(v) => updateForm('practice_address', v)} placeholder="123 Medical Dr" />
            </div>
            <Field label="City" value={form.practice_city} onChange={(v) => updateForm('practice_city', v)} placeholder="Phoenix" />
            <Field label="State" value={form.practice_state} onChange={(v) => updateForm('practice_state', v)} placeholder="AZ" />
            <Field label="ZIP Code" value={form.practice_zip} onChange={(v) => updateForm('practice_zip', v)} placeholder="85001" />
            <Field label="Consultation Fee ($)" value={form.consultation_fee} onChange={(v) => updateForm('consultation_fee', v)} placeholder="75.00" type="number" />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#7B8CA3', display: 'block', marginBottom: 4 }}>Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => updateForm('bio', e.target.value)}
              rows={4}
              style={{ ...fieldInputStyle, resize: 'vertical' }}
              placeholder="Brief professional background..."
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '12px 16px',
              marginBottom: 16, fontSize: 14, color: '#EF4444',
            }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <a
              href="/login"
              style={{
                flex: 1, padding: '14px 0', borderRadius: 12, textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)', color: '#7B8CA3',
                textDecoration: 'none', fontSize: 15, fontWeight: 600,
              }}
            >
              Back to Login
            </a>
            <button
              type="submit"
              disabled={loading || !form.first_name || !form.last_name || !form.email || !form.phone || !form.password || !form.confirm_password}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 12, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15,
                background: 'linear-gradient(135deg, #00D4AA, #06B6D4)', color: '#050810',
                opacity: (loading || !form.first_name || !form.last_name || !form.email || !form.phone || !form.password || !form.confirm_password) ? 0.5 : 1,
              }}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, color: '#7B8CA3', fontSize: 12 }}>
            <span style={{ color: '#EF4444' }}>*</span> Required fields. Your application will be reviewed before approval.
          </p>
        </form>
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, required, type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8CA3', display: 'block', marginBottom: 4 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={fieldInputStyle}
      />
    </div>
  )
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#E8ECF1',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
