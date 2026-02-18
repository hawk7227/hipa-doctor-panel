'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Sparkles, Edit3, Download, Send, Eye, RefreshCw, Check,
  ChevronDown, Search, Clock, Trash2, Copy, Mail, Printer, X,
  Briefcase, Stethoscope, Shield, Plane, GraduationCap, Heart
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// LetterGeneratorTab — AI/Manual letter generation with templates
// Sub-tab of Chart Management. Enterprise-grade.
// ═══════════════════════════════════════════════════════════════

interface LetterTemplate {
  id: string
  letter_type: string
  name: string
  description: string
  body_template: string
  variables: string[]
  is_system: boolean
  category: string
}

interface MedicalLetter {
  id: string
  patient_id: string
  letter_type: string
  subject: string
  recipient_name: string
  body_text: string
  status: string
  ai_generated: boolean
  signed_at: string | null
  pdf_url: string | null
  created_at: string
  patients?: { first_name: string; last_name: string } | null
}

interface PatientOption {
  id: string
  first_name: string
  last_name: string
  email: string
  dob?: string
}

const CATEGORY_ICONS: Record<string, any> = {
  employment: Briefcase,
  referral: Stethoscope,
  insurance: Shield,
  legal: Shield,
  travel: Plane,
  school: GraduationCap,
  general: Heart,
}

const LETTER_TYPE_LABELS: Record<string, string> = {
  work_excuse: 'Work/School Excuse',
  referral: 'Specialist Referral',
  return_clearance: 'Return to Work/School',
  fmla: 'FMLA Certification',
  prior_auth: 'Prior Authorization',
  disability_ada: 'Disability/ADA',
  esa: 'ESA Letter',
  care_transfer: 'Care Transfer',
  travel_medical: 'Travel Medical',
  jury_duty: 'Jury Duty Excuse',
  fitness_duty: 'Fitness/Sports Clearance',
  school_form: 'School Health Form',
  medical_necessity: 'Medical Necessity',
  other: 'Custom Letter',
}

export default function LetterGeneratorTab({
  doctorId,
  doctorName,
  patientId,
  patientName,
}: {
  doctorId: string | null
  doctorName: string
  patientId?: string | null
  patientName?: string | null
}) {
  // View: 'list' | 'create' | 'edit'
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [templates, setTemplates] = useState<LetterTemplate[]>([])
  const [letters, setLetters] = useState<MedicalLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Create/Edit state
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<string>(patientId || '')
  const [selectedPatientName, setSelectedPatientName] = useState(patientName || '')
  const [letterType, setLetterType] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientOrg, setRecipientOrg] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [editingLetter, setEditingLetter] = useState<MedicalLetter | null>(null)

  // Patient search
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<PatientOption[]>([])
  const [showPatientSearch, setShowPatientSearch] = useState(false)

  // Filters
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Fetch templates and letters
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, lRes] = await Promise.all([
        fetch('/api/patient-data/letters?action=templates'),
        fetch(`/api/patient-data/letters?action=list&doctor_id=${doctorId}${patientId ? `&patient_id=${patientId}` : ''}`),
      ])
      const tJson = await tRes.json()
      const lJson = await lRes.json()
      setTemplates(tJson.data || [])
      setLetters(lJson.data || [])
    } catch (err) {
      console.error('[letters] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [doctorId, patientId])

  useEffect(() => { if (doctorId) fetchData() }, [fetchData, doctorId])

  // Search patients
  const searchPatients = async (query: string) => {
    if (query.length < 2) { setPatientResults([]); return }
    try {
      const res = await fetch(`/api/patient-data?action=search_patients&q=${encodeURIComponent(query)}`)
      const json = await res.json()
      setPatientResults(json.data || [])
    } catch (err) {
      console.error('[letters] patient search error:', err)
    }
  }

  // AI Generate
  const handleAIGenerate = async () => {
    if (!selectedPatient || !letterType) return
    setGenerating(true)
    try {
      const res = await fetch('/api/patient-data/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient,
          doctor_id: doctorId,
          doctor_name: doctorName,
          letter_type: letterType,
          template_id: selectedTemplate?.id,
          recipient_name: recipientName,
          recipient_organization: recipientOrg,
          additional_context: subject,
        }),
      })
      const json = await res.json()
      if (res.ok && json.letter_text) {
        setBodyText(json.letter_text)
      } else {
        console.error('[letters] AI generate error:', json.error)
      }
    } catch (err) {
      console.error('[letters] AI generate error:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Use template (manual mode)
  const handleUseTemplate = (template: LetterTemplate) => {
    setSelectedTemplate(template)
    setLetterType(template.letter_type)
    setBodyText(template.body_template)
    setSubject(template.name)
  }

  // Save letter
  const handleSave = async (status: 'draft' | 'signed' = 'draft') => {
    if (!selectedPatient || !bodyText.trim()) return
    setSaving(true)
    try {
      const method = editingLetter ? 'PUT' : 'POST'
      const res = await fetch('/api/patient-data/letters', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLetter?.id,
          patient_id: selectedPatient,
          doctor_id: doctorId,
          letter_type: letterType || 'other',
          template_id: selectedTemplate?.id,
          subject,
          recipient_name: recipientName,
          recipient_organization: recipientOrg,
          body_text: bodyText,
          ai_generated: mode === 'ai',
          status,
          signed_at: status === 'signed' ? new Date().toISOString() : null,
          signed_by: status === 'signed' ? doctorId : null,
        }),
      })
      if (res.ok) {
        await fetchData()
        setView('list')
        resetForm()
      }
    } catch (err) {
      console.error('[letters] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSelectedTemplate(null)
    setLetterType('')
    setRecipientName('')
    setRecipientOrg('')
    setSubject('')
    setBodyText('')
    setEditingLetter(null)
    setMode('ai')
    if (!patientId) { setSelectedPatient(''); setSelectedPatientName('') }
  }

  const handleEdit = (letter: MedicalLetter) => {
    setEditingLetter(letter)
    setSelectedPatient(letter.patient_id)
    setLetterType(letter.letter_type)
    setSubject(letter.subject || '')
    setRecipientName(letter.recipient_name || '')
    setBodyText(letter.body_text)
    setView('edit')
  }

  const filteredLetters = letters.filter(l => {
    if (filterType !== 'all' && l.letter_type !== filterType) return false
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    return true
  })

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none">
              <option value="all">All Types</option>
              {Object.entries(LETTER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none">
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="signed">Signed</option>
              <option value="sent">Sent</option>
            </select>
          </div>
          <button onClick={() => { resetForm(); setView('create') }}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors flex items-center space-x-1.5">
            <FileText className="w-3 h-3" /><span>New Letter</span>
          </button>
        </div>

        {/* Letter List */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : filteredLetters.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No letters yet</p>
            <button onClick={() => { resetForm(); setView('create') }}
              className="mt-3 px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-bold hover:bg-teal-600/30 transition-colors">
              Create Your First Letter
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLetters.map(letter => (
              <div key={letter.id} onClick={() => handleEdit(letter)}
                className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d] hover:border-teal-500/30 cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${letter.status === 'signed' ? 'bg-green-500' : letter.status === 'sent' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className="text-sm font-bold text-white">{LETTER_TYPE_LABELS[letter.letter_type] || letter.letter_type}</p>
                      <p className="text-[10px] text-gray-500">
                        {letter.patients ? `${letter.patients.first_name} ${letter.patients.last_name}` : 'Unknown Patient'}
                        {letter.recipient_name ? ` → ${letter.recipient_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {letter.ai_generated && <Sparkles className="w-3 h-3 text-purple-400" />}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${letter.status === 'signed' ? 'bg-green-500/20 text-green-400' : letter.status === 'sent' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {letter.status}
                    </span>
                    <span className="text-[10px] text-gray-600">{new Date(letter.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── CREATE / EDIT VIEW ──
  return (
    <div className="space-y-4">
      {/* Back + Mode Toggle */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setView('list'); resetForm() }}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
          <span>← Back to Letters</span>
        </button>
        <div className="flex bg-[#0a1f1f] rounded-lg p-0.5 border border-[#1a3d3d]">
          <button onClick={() => setMode('ai')}
            className={`px-3 py-1 rounded-md text-xs font-bold flex items-center space-x-1 transition-colors ${mode === 'ai' ? 'bg-purple-600/20 text-purple-400' : 'text-gray-500 hover:text-white'}`}>
            <Sparkles className="w-3 h-3" /><span>AI Generate</span>
          </button>
          <button onClick={() => setMode('manual')}
            className={`px-3 py-1 rounded-md text-xs font-bold flex items-center space-x-1 transition-colors ${mode === 'manual' ? 'bg-teal-600/20 text-teal-400' : 'text-gray-500 hover:text-white'}`}>
            <Edit3 className="w-3 h-3" /><span>Manual</span>
          </button>
        </div>
      </div>

      {/* Patient Selection */}
      {!patientId && (
        <div className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d]">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Patient</label>
          {selectedPatientName ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-white font-bold">{selectedPatientName}</span>
              <button onClick={() => { setSelectedPatient(''); setSelectedPatientName('') }}
                className="text-[10px] text-gray-500 hover:text-red-400">Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-500" />
              <input value={patientSearch}
                onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                onFocus={() => setShowPatientSearch(true)}
                className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-7 pr-3 py-1.5 text-sm text-white outline-none focus:border-teal-500/50"
                placeholder="Search patients..." />
              {showPatientSearch && patientResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d2626] border border-[#1a3d3d] rounded-lg max-h-40 overflow-y-auto z-10">
                  {patientResults.map(p => (
                    <button key={p.id} onClick={() => {
                      setSelectedPatient(p.id)
                      setSelectedPatientName(`${p.first_name} ${p.last_name}`)
                      setShowPatientSearch(false)
                      setPatientSearch('')
                    }} className="w-full text-left px-3 py-2 hover:bg-teal-600/10 text-sm text-white">
                      {p.first_name} {p.last_name} <span className="text-gray-500 text-xs">{p.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Letter Type + Template Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Letter Type</label>
          <select value={letterType} onChange={e => {
            setLetterType(e.target.value)
            const t = templates.find(t => t.letter_type === e.target.value)
            if (t && mode === 'manual') handleUseTemplate(t)
          }}
            className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50">
            <option value="">Select type...</option>
            {Object.entries(LETTER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Recipient</label>
          <input value={recipientName} onChange={e => setRecipientName(e.target.value)}
            className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50"
            placeholder="To Whom It May Concern" />
        </div>
      </div>

      {/* AI Generate Button */}
      {mode === 'ai' && (
        <button onClick={handleAIGenerate} disabled={generating || !selectedPatient || !letterType}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{generating ? 'AI is drafting your letter...' : 'Generate with AI'}</span>
        </button>
      )}

      {/* Letter Body Editor */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
          Letter Content {mode === 'ai' && bodyText && '(AI-generated — edit as needed)'}
        </label>
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
          rows={16}
          className="w-full bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-4 py-3 text-sm text-white font-mono leading-relaxed outline-none focus:border-teal-500/50 resize-none"
          placeholder={mode === 'ai' ? 'Click "Generate with AI" above to draft this letter...' : 'Type your letter here or select a template...'} />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <button onClick={() => handleSave('draft')} disabled={saving || !bodyText.trim()}
            className="px-4 py-2 rounded-lg bg-amber-600/20 text-amber-400 text-sm font-bold hover:bg-amber-600/30 transition-colors disabled:opacity-50 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" /><span>Save Draft</span>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => handleSave('signed')} disabled={saving || !bodyText.trim() || !selectedPatient}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center space-x-2">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Sign & Generate PDF</span>
          </button>
        </div>
      </div>

      {/* Template Gallery (Manual mode) */}
      {mode === 'manual' && !bodyText && (
        <div className="border-t border-[#1a3d3d] pt-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Or start from a template</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.filter(t => !letterType || t.letter_type === letterType).slice(0, 8).map(t => {
              const Icon = CATEGORY_ICONS[t.category] || FileText
              return (
                <button key={t.id} onClick={() => handleUseTemplate(t)}
                  className="bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d] hover:border-teal-500/30 text-left transition-colors">
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-xs font-bold text-white">{t.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 line-clamp-2">{t.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
