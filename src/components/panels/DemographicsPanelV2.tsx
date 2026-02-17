// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'
import React, { useState, useEffect } from 'react'
import { User, Pencil, Save, MapPin, Phone, Mail, Shield, Heart, Globe, Building2, AlertTriangle } from 'lucide-react'
import PanelBase from '@/components/panels/PanelBase'

interface Props { isOpen: boolean; onClose: () => void; patientId: string; patientName: string }

const TABS = ['Personal', 'Contact', 'Emergency', 'Preferences'] as const

export default function DemographicsPanelV2({ isOpen, onClose, patientId, patientName }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>('Personal')
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!patientId || !isOpen) return
    setLoading(true); setError(null)
    fetch(`/api/panels/demographics?patient_id=${patientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else { setPatient(data.data?.[0] || data.data || null); setForm(data.data?.[0] || data.data || {}) }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [patientId, isOpen])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/panels/demographics', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: patientId, ...form })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else { setPatient(data.data || form); setEditing(false) }
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const Field = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</label>
      {editing ? (
        type === 'select-gender' ? (
          <select value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
            className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm mt-0.5">
            <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
          </select>
        ) : type === 'select-marital' ? (
          <select value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
            className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm mt-0.5">
            <option value="">—</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option>
          </select>
        ) : type === 'select-language' ? (
          <select value={form[field] || 'English'} onChange={e => setForm({ ...form, [field]: e.target.value })}
            className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm mt-0.5">
            <option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="Chinese">Chinese</option><option value="Arabic">Arabic</option><option value="Haitian Creole">Haitian Creole</option><option value="Portuguese">Portuguese</option><option value="Other">Other</option>
          </select>
        ) : (
          <input value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
            type={type} className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded px-2 py-1.5 text-white text-sm mt-0.5" />
        )
      ) : (
        <p className="text-sm text-white mt-0.5">{patient?.[field] || '—'}</p>
      )}
    </div>
  )

  if (!isOpen) return null

  return (
    <PanelBase title={`Demographics — ${patientName}`} icon={User} accentColor="#0ea5e9" loading={loading}
      error={error} hasData={!!patient} emptyMessage="No patient data"
      onClose={onClose} draggable={false}
      headerActions={
        editing ? (
          <div className="flex gap-1">
            <button onClick={() => { setEditing(false); setForm(patient || {}) }} className="px-2 py-1 text-[10px] text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-2 py-1 text-[10px] bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50">{saving ? '...' : 'Save'}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1 text-teal-400 hover:text-teal-300"><Pencil className="w-3.5 h-3.5" /></button>
        )
      }>
      <div className="flex flex-col h-full">
        <div className="flex border-b border-[#1a3d3d] px-3">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-sky-400 text-sky-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {tab === 'Personal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" field="first_name" />
                <Field label="Last Name" field="last_name" />
                <Field label="Middle Name" field="middle_name" />
                <Field label="Preferred Name" field="preferred_name" />
                <Field label="Date of Birth" field="date_of_birth" type="date" />
                <Field label="Gender" field="gender" type="select-gender" />
                <Field label="SSN (Last 4)" field="ssn_last_four" />
                <Field label="Marital Status" field="marital_status" type="select-marital" />
                <Field label="Race" field="race" />
                <Field label="Ethnicity" field="ethnicity" />
                <Field label="Preferred Language" field="preferred_language" type="select-language" />
              </div>
              {patient?.interpreter_needed && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400">Interpreter needed</span>
                </div>
              )}
            </div>
          )}

          {tab === 'Contact' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" field="email" type="email" />
                <Field label="Phone" field="phone" type="tel" />
                <Field label="Address" field="address" />
                <Field label="City" field="city" />
                <Field label="State" field="state" />
                <Field label="ZIP Code" field="zip_code" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employer" field="employer_name" />
                <Field label="Employer Phone" field="employer_phone" type="tel" />
              </div>
            </div>
          )}

          {tab === 'Emergency' && (
            <div className="space-y-3">
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-red-400 mb-2">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" field="emergency_contact_name" />
                  <Field label="Relationship" field="emergency_contact_relationship" />
                  <Field label="Phone" field="emergency_contact_phone" type="tel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary Care Provider" field="primary_care_provider" />
                <Field label="Referring Provider" field="referring_provider" />
              </div>
              <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Advance Directives</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">On File</label>
                    <p className="text-sm text-white mt-0.5">{patient?.advance_directive ? 'Yes' : 'No'}</p>
                  </div>
                  {patient?.advance_directive_type && <Field label="Type" field="advance_directive_type" />}
                </div>
              </div>
            </div>
          )}

          {tab === 'Preferences' && (
            <div className="space-y-3">
              <Field label="Communication Preference" field="communication_preference" />
              <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-400">HIPAA & Portal</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-500">HIPAA Consent</span><p className={`font-medium ${patient?.hipaa_consent_signed ? 'text-green-400' : 'text-red-400'}`}>{patient?.hipaa_consent_signed ? 'Signed' : 'Not Signed'}</p></div>
                  <div><span className="text-gray-500">Portal Access</span><p className={`font-medium ${patient?.portal_access_enabled ? 'text-green-400' : 'text-gray-400'}`}>{patient?.portal_access_enabled ? 'Enabled' : 'Disabled'}</p></div>
                  {patient?.hipaa_consent_date && <div><span className="text-gray-500">Consent Date</span><p className="text-white">{new Date(patient.hipaa_consent_date).toLocaleDateString()}</p></div>}
                  {patient?.portal_last_login && <div><span className="text-gray-500">Last Portal Login</span><p className="text-white">{new Date(patient.portal_last_login).toLocaleDateString()}</p></div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelBase>
  )
}
