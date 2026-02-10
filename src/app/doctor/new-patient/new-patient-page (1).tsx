'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { UserPlus, ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'
import Dialog from '@/components/Dialog'

export default function NewPatientPage() {
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', type: 'info' })

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    location: '',
    preferred_pharmacy: '',
    allergies: '',
  })

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setDialog({ isOpen: true, title: 'Required Fields', message: 'First name and last name are required.', type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('Not logged in')

      // Check for existing patient by email or phone to avoid duplicates
      if (form.email || form.phone) {
        const conditions = []
        if (form.email.trim()) conditions.push(`email.eq.${form.email.trim()}`)
        if (form.phone.trim()) conditions.push(`phone.eq.${form.phone.trim()}`)
        
        const { data: existing } = await supabase
          .from('patients')
          .select('id, first_name, last_name')
          .or(conditions.join(','))
          .maybeSingle()

        if (existing) {
          setDialog({
            isOpen: true,
            title: 'Patient Already Exists',
            message: `A patient named ${existing.first_name} ${existing.last_name} already exists with this ${form.email ? 'email' : 'phone number'}. You can find them on the Patients page.`,
            type: 'warning'
          })
          setSaving(false)
          return
        }
      }

      // Insert new patient
      const insertData: any = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      }
      if (form.email.trim()) insertData.email = form.email.trim()
      if (form.phone.trim()) insertData.phone = form.phone.trim()
      if (form.date_of_birth) insertData.date_of_birth = form.date_of_birth
      if (form.location.trim()) insertData.location = form.location.trim()
      if (form.preferred_pharmacy.trim()) insertData.preferred_pharmacy = form.preferred_pharmacy.trim()
      if (form.allergies.trim()) insertData.allergies = form.allergies.trim()

      const { data, error } = await supabase
        .from('patients')
        .insert([insertData])
        .select('id, first_name, last_name')
        .single()

      if (error) throw error

      setDialog({
        isOpen: true,
        title: 'Patient Created',
        message: `${data.first_name} ${data.last_name} has been added successfully.`,
        type: 'success'
      })

      // Reset form
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        location: '',
        preferred_pharmacy: '',
        allergies: '',
      })
    } catch (err: any) {
      console.error('Error creating patient:', err)
      setDialog({
        isOpen: true,
        title: 'Error',
        message: err.message || 'Failed to create patient.',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071515] to-[#0a1e1e] text-white">
      {/* Top Bar */}
      <div className="border-b border-[#1a3d3d]/60 bg-[#0a1a1a]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Link href="/doctor/patients" className="p-1.5 rounded-lg hover:bg-[#164e4e]/50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </Link>
          <UserPlus className="w-5 h-5 text-teal-400" />
          <h1 className="text-base font-semibold text-white">New Patient</h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSave} className="space-y-5">

          {/* Name Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">First Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                placeholder="First Name"
                required
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Last Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                placeholder="Last Name"
                required
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="patient@email.com"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+14805551234"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
            </div>
          </div>

          {/* DOB + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="City, State"
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
            </div>
          </div>

          {/* Pharmacy */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Preferred Pharmacy</label>
            <input
              type="text"
              value={form.preferred_pharmacy}
              onChange={(e) => updateField('preferred_pharmacy', e.target.value)}
              placeholder="Pharmacy name and location"
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-600"
            />
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Allergies</label>
            <textarea
              value={form.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              placeholder="List any known allergies..."
              rows={3}
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 resize-none placeholder-gray-600"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#1a3d3d]/40">
            <Link
              href="/doctor/patients"
              className="flex-1 px-4 py-2.5 text-center text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />Saving...</>
              ) : (
                <><Check className="w-4 h-4" />Save Patient</>
              )}
            </button>
          </div>
        </form>
      </div>

      <Dialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} title={dialog.title} message={dialog.message} type={dialog.type} />
    </div>
  )
}
