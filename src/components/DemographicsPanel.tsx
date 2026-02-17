// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import DraggableOverlayWrapper from './DraggableOverlayWrapper'
import { User, Edit, Save, X, Loader2 } from 'lucide-react'

interface DemographicsPanelProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName?: string
}

interface PatientDemo {
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: string | null
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  race: string | null
  ethnicity: string | null
  preferred_language: string | null
  social_security_number: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  employer: string | null
  employer_address: string | null
  primary_care_physician: string | null
  referring_doctor: string | null
  responsible_party_name: string | null
  responsible_party_phone: string | null
  responsible_party_relation: string | null
  chart_id: string | null
  patient_status: string | null
  [key: string]: string | null
}

interface FieldDef {
  key: string
  label: string
  type?: string
  sensitive?: boolean
}

const FIELD_GROUPS: { label: string; fields: FieldDef[] }[] = [
  {
    label: 'Personal Information',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'gender', label: 'Gender' },
      { key: 'race', label: 'Race' },
      { key: 'ethnicity', label: 'Ethnicity' },
      { key: 'preferred_language', label: 'Preferred Language' },
      { key: 'social_security_number', label: 'SSN', sensitive: true },
    ],
  },
  {
    label: 'Contact Information',
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'cell_phone', label: 'Cell Phone' },
      { key: 'home_phone', label: 'Home Phone' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'zip_code', label: 'ZIP Code' },
    ],
  },
  {
    label: 'Emergency Contact',
    fields: [
      { key: 'emergency_contact_name', label: 'Name' },
      { key: 'emergency_contact_phone', label: 'Phone' },
      { key: 'emergency_contact_relation', label: 'Relation' },
    ],
  },
  {
    label: 'Provider Information',
    fields: [
      { key: 'primary_care_physician', label: 'Primary Care Physician' },
      { key: 'referring_doctor', label: 'Referring Doctor' },
      { key: 'chart_id', label: 'Chart ID' },
      { key: 'patient_status', label: 'Status' },
    ],
  },
  {
    label: 'Employment',
    fields: [
      { key: 'employer', label: 'Employer' },
      { key: 'employer_address', label: 'Employer Address' },
    ],
  },
  {
    label: 'Responsible Party',
    fields: [
      { key: 'responsible_party_name', label: 'Name' },
      { key: 'responsible_party_phone', label: 'Phone' },
      { key: 'responsible_party_relation', label: 'Relation' },
    ],
  },
]

export default function DemographicsPanel({ isOpen, onClose, patientId, patientName }: DemographicsPanelProps) {
  const [data, setData] = useState<PatientDemo | null>(null)
  const [editData, setEditData] = useState<Partial<PatientDemo>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSSN, setShowSSN] = useState(false)

  const fetchData = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const { data: drPatient } = await supabase
        .from('drchrono_patients')
        .select('*')
        .eq('drchrono_patient_id', patientId)
        .single()

      if (drPatient) {
        setData(drPatient as unknown as PatientDemo)
      } else {
        const { data: localPatient } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single()
        if (localPatient) setData(localPatient as unknown as PatientDemo)
      }
    } catch (err) {
      console.error('Error fetching demographics:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  const handleEdit = () => {
    if (data) setEditData({ ...data })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('drchrono_patients')
        .update(editData)
        .eq('drchrono_patient_id', patientId)
      if (error) throw error
      setData(prev => {
        if (!prev) return prev
        const updated = { ...prev }
        for (const k of Object.keys(editData)) {
          updated[k] = editData[k] ?? null
        }
        return updated
      })
      setEditing(false)
    } catch (err) {
      console.error('Error saving demographics:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setEditData({})
  }

  const renderValue = (field: FieldDef, value: string | null) => {
    if (editing) {
      return (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={editData[field.key] || ''}
          onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-cyan-500/50 focus:outline-none"
        />
      )
    }
    if (field.sensitive && value) {
      return (
        <span className="text-white/80 text-xs">
          {showSSN ? value : '•••-••-' + (value?.slice(-4) || '••••')}
          <button onClick={() => setShowSSN(v => !v)} className="ml-2 text-cyan-400 text-[10px] hover:underline">
            {showSSN ? 'Hide' : 'Show'}
          </button>
        </span>
      )
    }
    return <span className="text-white/80 text-xs">{value || '—'}</span>
  }

  return (
    <DraggableOverlayWrapper
      panelId="demographics"
      isOpen={isOpen}
      onClose={onClose}
      title="Demographics"
      subtitle={patientName}
      icon={<User className="w-4 h-4" />}
      defaultTheme="slate"
      defaultWidth={520}
      headerActions={
        !editing ? (
          <button onClick={handleEdit} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors" title="Edit">
            <Edit className="w-3.5 h-3.5 text-white/60" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-green-500/30 transition-colors" title="Save">
              {saving ? <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" /> : <Save className="w-3.5 h-3.5 text-green-400" />}
            </button>
            <button onClick={handleCancel} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/30 transition-colors" title="Cancel">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )
      }
    >
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : !data ? (
          <div className="text-center py-8 text-white/40 text-sm">No demographic data found</div>
        ) : (
          FIELD_GROUPS.map(group => (
            <div key={group.label}>
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{group.label}</h4>
              <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5">
                {group.fields.map(field => (
                  <div key={field.key} className="flex items-center justify-between px-3 py-2">
                    <span className="text-white/50 text-xs w-36 flex-shrink-0">{field.label}</span>
                    {renderValue(field, data[field.key])}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </DraggableOverlayWrapper>
  )
}
