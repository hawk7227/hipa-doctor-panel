// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  UserPlus, ChevronRight, ChevronLeft, User, Heart, Shield,
  Phone, MapPin, Building2, CheckCircle, AlertTriangle, X, RefreshCw,
  Mail, Calendar, FileText, Save
} from 'lucide-react'

const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const STEPS = ['Demographics', 'Contact', 'Insurance', 'Medical', 'Review']

export default function NewPatientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({
    first_name: '', last_name: '', middle_name: '', preferred_name: '',
    date_of_birth: '', gender: '', sex_at_birth: '', pronouns: '',
    race: '', ethnicity: '', preferred_language: 'English', marital_status: '',
    email: '', phone_number: '', address_line1: '', address_line2: '', city: '', state: '', zip: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    preferred_pharmacy: '', preferred_pharmacy_phone: '',
    ins_payer: '', ins_subscriber_id: '', ins_group: '', ins_plan: '', ins_subscriber_rel: 'self',
    allergies: '', problems: '', medications: '', surgical_history: '',
    smoking_status: 'never', alcohol_use: 'none',
  })

  useEffect(() => {
    const init = async () => {
      try { const au = await getCurrentUser(); if (!au?.doctor?.id) { router.push('/login'); return }; setDoctorId(au.doctor.id) } catch { router.push('/login') }
      finally { setLoading(false) }
    }; init()
  }, [router])

  const upd = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }))

  const savePatient = async () => {
    if (!doctorId || !f.first_name || !f.last_name) return
    setSaving(true); setError(null)
    try {
      // Create patient
      const { data: patient, error: pErr } = await supabase.from('patients').insert({
        doctor_id: doctorId, first_name: f.first_name, last_name: f.last_name,
        middle_name: f.middle_name || null, preferred_name: f.preferred_name || null,
        date_of_birth: f.date_of_birth || null, gender: f.gender || null,
        sex_at_birth: f.sex_at_birth || null, pronouns: f.pronouns || null,
        race: f.race || null, ethnicity: f.ethnicity || null,
        preferred_language: f.preferred_language, marital_status: f.marital_status || null,
        email: f.email || null, phone_number: f.phone_number || null,
        address_line1: f.address_line1 || null, address_line2: f.address_line2 || null,
        city: f.city || null, state: f.state || null, zip: f.zip || null,
        emergency_contact_name: f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        emergency_contact_relation: f.emergency_contact_relation || null,
        preferred_pharmacy: f.preferred_pharmacy || null,
        preferred_pharmacy_phone: f.preferred_pharmacy_phone || null,
        status: 'active', consent_hipaa: false, portal_access: false,
      }).select().single()
      if (pErr) throw pErr
      if (!patient) throw new Error('Failed to create patient')

      // Insurance
      if (f.ins_payer) {
        await supabase.from('patient_insurance').insert({
          patient_id: patient.id, doctor_id: doctorId, insurance_type: 'primary',
          payer_name: f.ins_payer, subscriber_id: f.ins_subscriber_id || null,
          group_number: f.ins_group || null, plan_name: f.ins_plan || null,
          subscriber_relationship: f.ins_subscriber_rel, is_active: true,
        })
      }

      // Allergies (comma-separated)
      if (f.allergies.trim()) {
        const items = f.allergies.split(',').map(a => a.trim()).filter(Boolean)
        if (items.length > 0) {
          await supabase.from('patient_allergies').insert(items.map(a => ({
            patient_id: patient.id, doctor_id: doctorId, allergen: a, allergen_name: a,
            status: 'active', severity: 'moderate', source: 'patient_reported',
          })))
        }
      }

      // Problems (comma-separated)
      if (f.problems.trim()) {
        const items = f.problems.split(',').map(p => p.trim()).filter(Boolean)
        if (items.length > 0) {
          await supabase.from('patient_problems').insert(items.map(p => ({
            patient_id: patient.id, doctor_id: doctorId, description: p,
            status: 'active', source: 'patient_reported',
          })))
        }
      }

      // Social history
      await supabase.from('patient_social_history').insert({
        patient_id: patient.id, doctor_id: doctorId,
        smoking_status: f.smoking_status, alcohol_use: f.alcohol_use,
      })

      router.push(`/doctor/patients?highlight=${patient.id}`)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const canProceed = step === 0 ? (f.first_name && f.last_name) : true

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><UserPlus className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">New Patient Registration</h1><p className="text-xs text-gray-500">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p></div></div>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 mt-3">{STEPS.map((s, i) => (
          <button key={s} onClick={() => i <= step && setStep(i)} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-[#1a3d3d]/50'} ${i < step ? 'cursor-pointer' : ''}`} />
        ))}</div>
        <div className="flex justify-between mt-1">{STEPS.map((s, i) => <span key={s} className={`text-[9px] ${i <= step ? 'text-emerald-400' : 'text-gray-600'}`}>{s}</span>)}</div>
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}

      <div className="p-4 max-w-2xl mx-auto">
        {/* STEP 0: Demographics */}
        {step === 0 && (
          <div className="space-y-4">
            <Sec title="Name" icon={User}>
              <div className="grid grid-cols-3 gap-3">
                <FL label="First Name *"><input value={f.first_name} onChange={e => upd('first_name', e.target.value)} className={INP} placeholder="John" /></FL>
                <FL label="Middle"><input value={f.middle_name} onChange={e => upd('middle_name', e.target.value)} className={INP} /></FL>
                <FL label="Last Name *"><input value={f.last_name} onChange={e => upd('last_name', e.target.value)} className={INP} placeholder="Doe" /></FL>
              </div>
              <FL label="Preferred Name"><input value={f.preferred_name} onChange={e => upd('preferred_name', e.target.value)} className={INP} placeholder="Nickname" /></FL>
            </Sec>
            <Sec title="Demographics" icon={Calendar}>
              <div className="grid grid-cols-2 gap-3">
                <FL label="Date of Birth"><input type="date" value={f.date_of_birth} onChange={e => upd('date_of_birth', e.target.value)} className={INP} /></FL>
                <FL label="Gender"><select value={f.gender} onChange={e => upd('gender', e.target.value)} className={INP}><option value="">Select...</option>{['Male','Female','Non-binary','Other','Prefer not to say'].map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}</select></FL>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FL label="Sex at Birth"><select value={f.sex_at_birth} onChange={e => upd('sex_at_birth', e.target.value)} className={INP}><option value="">Select...</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></FL>
                <FL label="Pronouns"><select value={f.pronouns} onChange={e => upd('pronouns', e.target.value)} className={INP}><option value="">Select...</option>{['He/Him','She/Her','They/Them','Other'].map(p => <option key={p} value={p}>{p}</option>)}</select></FL>
                <FL label="Language"><input value={f.preferred_language} onChange={e => upd('preferred_language', e.target.value)} className={INP} /></FL>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FL label="Race"><select value={f.race} onChange={e => upd('race', e.target.value)} className={INP}><option value="">Select...</option>{['White','Black','Asian','American Indian','Pacific Islander','Other','Prefer not to say'].map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}</select></FL>
                <FL label="Ethnicity"><select value={f.ethnicity} onChange={e => upd('ethnicity', e.target.value)} className={INP}><option value="">Select...</option><option value="hispanic">Hispanic/Latino</option><option value="non-hispanic">Non-Hispanic</option><option value="unknown">Unknown</option></select></FL>
                <FL label="Marital Status"><select value={f.marital_status} onChange={e => upd('marital_status', e.target.value)} className={INP}><option value="">Select...</option>{['Single','Married','Divorced','Widowed','Separated','Domestic Partner'].map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}</select></FL>
              </div>
            </Sec>
          </div>
        )}

        {/* STEP 1: Contact */}
        {step === 1 && (
          <div className="space-y-4">
            <Sec title="Contact" icon={Phone}>
              <div className="grid grid-cols-2 gap-3">
                <FL label="Email"><input type="email" value={f.email} onChange={e => upd('email', e.target.value)} className={INP} placeholder="patient@email.com" /></FL>
                <FL label="Phone"><input value={f.phone_number} onChange={e => upd('phone_number', e.target.value)} className={INP} placeholder="(555) 123-4567" /></FL>
              </div>
            </Sec>
            <Sec title="Address" icon={MapPin}>
              <FL label="Address Line 1"><input value={f.address_line1} onChange={e => upd('address_line1', e.target.value)} className={INP} /></FL>
              <FL label="Address Line 2"><input value={f.address_line2} onChange={e => upd('address_line2', e.target.value)} className={INP} /></FL>
              <div className="grid grid-cols-3 gap-3">
                <FL label="City"><input value={f.city} onChange={e => upd('city', e.target.value)} className={INP} /></FL>
                <FL label="State"><input value={f.state} onChange={e => upd('state', e.target.value)} className={INP} maxLength={2} /></FL>
                <FL label="ZIP"><input value={f.zip} onChange={e => upd('zip', e.target.value)} className={INP} /></FL>
              </div>
            </Sec>
            <Sec title="Emergency Contact" icon={Heart}>
              <div className="grid grid-cols-3 gap-3">
                <FL label="Name"><input value={f.emergency_contact_name} onChange={e => upd('emergency_contact_name', e.target.value)} className={INP} /></FL>
                <FL label="Phone"><input value={f.emergency_contact_phone} onChange={e => upd('emergency_contact_phone', e.target.value)} className={INP} /></FL>
                <FL label="Relation"><input value={f.emergency_contact_relation} onChange={e => upd('emergency_contact_relation', e.target.value)} className={INP} placeholder="Spouse, Parent..." /></FL>
              </div>
            </Sec>
            <Sec title="Pharmacy" icon={Building2}>
              <div className="grid grid-cols-2 gap-3">
                <FL label="Pharmacy Name"><input value={f.preferred_pharmacy} onChange={e => upd('preferred_pharmacy', e.target.value)} className={INP} /></FL>
                <FL label="Pharmacy Phone"><input value={f.preferred_pharmacy_phone} onChange={e => upd('preferred_pharmacy_phone', e.target.value)} className={INP} /></FL>
              </div>
            </Sec>
          </div>
        )}

        {/* STEP 2: Insurance */}
        {step === 2 && (
          <Sec title="Primary Insurance" icon={Shield}>
            <FL label="Insurance Company"><input value={f.ins_payer} onChange={e => upd('ins_payer', e.target.value)} className={INP} placeholder="Blue Cross Blue Shield" /></FL>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Subscriber / Member ID"><input value={f.ins_subscriber_id} onChange={e => upd('ins_subscriber_id', e.target.value)} className={INP} /></FL>
              <FL label="Group Number"><input value={f.ins_group} onChange={e => upd('ins_group', e.target.value)} className={INP} /></FL>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Plan Name"><input value={f.ins_plan} onChange={e => upd('ins_plan', e.target.value)} className={INP} /></FL>
              <FL label="Relationship to Subscriber"><select value={f.ins_subscriber_rel} onChange={e => upd('ins_subscriber_rel', e.target.value)} className={INP}><option value="self">Self</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option></select></FL>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Additional insurance can be added from the patient chart after registration.</p>
          </Sec>
        )}

        {/* STEP 3: Medical */}
        {step === 3 && (
          <div className="space-y-4">
            <Sec title="Medical History" icon={Heart}>
              <FL label="Known Allergies (comma-separated)"><textarea value={f.allergies} onChange={e => upd('allergies', e.target.value)} className={`${INP} h-16 resize-none`} placeholder="Penicillin, Sulfa, Latex..." /></FL>
              <FL label="Active Problems / Conditions"><textarea value={f.problems} onChange={e => upd('problems', e.target.value)} className={`${INP} h-16 resize-none`} placeholder="Hypertension, Type 2 Diabetes..." /></FL>
              <FL label="Current Medications"><textarea value={f.medications} onChange={e => upd('medications', e.target.value)} className={`${INP} h-16 resize-none`} placeholder="Metformin 500mg BID, Lisinopril 10mg daily..." /></FL>
              <FL label="Past Surgical History"><textarea value={f.surgical_history} onChange={e => upd('surgical_history', e.target.value)} className={`${INP} h-12 resize-none`} placeholder="Appendectomy 2015, Knee arthroscopy 2020..." /></FL>
            </Sec>
            <Sec title="Social History" icon={User}>
              <div className="grid grid-cols-2 gap-3">
                <FL label="Smoking"><select value={f.smoking_status} onChange={e => upd('smoking_status', e.target.value)} className={INP}><option value="never">Never</option><option value="former">Former</option><option value="current">Current</option></select></FL>
                <FL label="Alcohol"><select value={f.alcohol_use} onChange={e => upd('alcohol_use', e.target.value)} className={INP}><option value="none">None</option><option value="social">Social</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option></select></FL>
              </div>
            </Sec>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">Review Patient Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <RV label="Name" value={`${f.first_name} ${f.middle_name ? f.middle_name + ' ' : ''}${f.last_name}`} />
                <RV label="DOB" value={f.date_of_birth || '—'} />
                <RV label="Gender" value={f.gender || '—'} />
                <RV label="Language" value={f.preferred_language} />
                <RV label="Email" value={f.email || '—'} />
                <RV label="Phone" value={f.phone_number || '—'} />
                <RV label="Address" value={f.address_line1 ? `${f.address_line1}, ${f.city} ${f.state} ${f.zip}` : '—'} />
                <RV label="Emergency" value={f.emergency_contact_name || '—'} />
                <RV label="Insurance" value={f.ins_payer || 'None entered'} />
                <RV label="Member ID" value={f.ins_subscriber_id || '—'} />
                <RV label="Allergies" value={f.allergies || 'None reported'} />
                <RV label="Problems" value={f.problems || 'None reported'} />
                <RV label="Smoking" value={f.smoking_status} />
                <RV label="Alcohol" value={f.alcohol_use} />
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#1a3d3d]/30">
          <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" />Back</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => canProceed && setStep(step + 1)} disabled={!canProceed} className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">Next<ChevronRight className="w-3.5 h-3.5" /></button>
          ) : (
            <button onClick={savePatient} disabled={saving || !f.first_name || !f.last_name} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40">{saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{saving ? 'Creating...' : 'Create Patient'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Sec({ title, icon: I, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4 space-y-3"><h3 className="text-xs font-semibold text-gray-300 flex items-center gap-2"><I className="w-3.5 h-3.5 text-emerald-400" />{title}</h3>{children}</div>
}
function FL({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-[11px] text-gray-400 mb-1">{label}</label>{children}</div> }
function RV({ label, value }: { label: string; value: string }) { return <div><span className="text-gray-500">{label}:</span> <span className="text-gray-200">{value}</span></div> }
