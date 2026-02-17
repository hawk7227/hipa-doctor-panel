// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Settings, User, Bell, Shield, Users, ClipboardList, ChevronRight,
  Lock, Mail, Building2, Clock, Calendar, Globe, DollarSign,
  Stethoscope, Brain, CheckCircle, AlertTriangle, X, RefreshCw, Save
} from 'lucide-react'

const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"

interface PracticeSettings {
  id?: string; practice_name: string; practice_phone: string; practice_fax: string; practice_email: string;
  practice_npi: string; practice_tax_id: string; address_line1: string; address_line2: string;
  city: string; state: string; zip: string; timezone: string;
  default_slot_duration: number; buffer_between_appointments: number; max_daily_appointments: number;
  allow_online_scheduling: boolean; auto_confirm_appointments: boolean; default_payment_terms: number;
  accept_insurance: boolean; accept_cash_pay: boolean;
  email_notifications: boolean; sms_notifications: boolean; reminder_hours_before: number;
  ai_scribe_enabled: boolean; ai_cdss_enabled: boolean; ai_coding_assist: boolean;
  hipaa_baa_signed: boolean; hipaa_baa_date: string | null;
}

const defaultSettings: PracticeSettings = {
  practice_name: '', practice_phone: '', practice_fax: '', practice_email: '',
  practice_npi: '', practice_tax_id: '', address_line1: '', address_line2: '',
  city: '', state: '', zip: '', timezone: 'America/New_York',
  default_slot_duration: 30, buffer_between_appointments: 0, max_daily_appointments: 40,
  allow_online_scheduling: true, auto_confirm_appointments: false, default_payment_terms: 30,
  accept_insurance: true, accept_cash_pay: true,
  email_notifications: true, sms_notifications: true, reminder_hours_before: 24,
  ai_scribe_enabled: false, ai_cdss_enabled: false, ai_coding_assist: false,
  hipaa_baa_signed: false, hipaa_baa_date: null,
}

type Tab = 'hub' | 'practice'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('hub')
  const [ps, setPs] = useState<PracticeSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const au = await getCurrentUser()
        if (!au?.doctor?.id) { router.push('/login'); return }
        setDoctorId(au.doctor.id)
        const { data } = await supabase.from('practice_settings').select('*').eq('doctor_id', au.doctor.id).single()
        if (data) setPs({ ...defaultSettings, ...data })
      } catch { /* might not exist yet */ }
      finally { setLoading(false) }
    }; init()
  }, [router])

  const savePractice = async () => {
    if (!doctorId) return; setSaving(true); setError(null)
    try {
      const payload = { ...ps, doctor_id: doctorId }; delete (payload as any).id
      const { data: existing } = await supabase.from('practice_settings').select('id').eq('doctor_id', doctorId).single()
      if (existing) {
        const { error: e } = await supabase.from('practice_settings').update(payload).eq('doctor_id', doctorId)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('practice_settings').insert(payload)
        if (e) throw e
      }
      setSuccess('Settings saved'); setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  const links = [
    { href: '/doctor/profile', icon: User, color: 'text-blue-400', bg: 'bg-blue-600/10', label: 'Profile & Credentials', sub: 'NPI, DEA, license, specialties' },
    { href: '#practice', icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-600/10', label: 'Practice Settings', sub: 'Name, address, scheduling, billing', onClick: () => setTab('practice') },
    { href: '/doctor/settings/staff', icon: Users, color: 'text-purple-400', bg: 'bg-purple-600/10', label: 'Staff Management', sub: 'Roles, permissions, schedules' },
    { href: '/doctor/availability', icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-600/10', label: 'Availability', sub: 'Working hours, slot configuration' },
    { href: '/doctor/settings/audit', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-600/10', label: 'Audit Log', sub: 'HIPAA compliance, access tracking' },
    { href: '/doctor/chart-management', icon: ClipboardList, color: 'text-teal-400', bg: 'bg-teal-600/10', label: 'Chart Management', sub: 'Notes, cosign, chart closure' },
    { href: '/doctor/billing', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-600/10', label: 'Billing Settings', sub: 'Fee schedule, claims, payments' },
  ]

  if (tab === 'practice') return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><button onClick={() => setTab('hub')} className="p-1 hover:bg-[#0a1f1f] rounded"><ChevronRight className="w-4 h-4 text-gray-400 rotate-180" /></button><Building2 className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Practice Settings</h1><p className="text-xs text-gray-500">Configure your practice details</p></div></div>
          <button onClick={savePractice} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40"><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {success && <div className="mx-4 mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
      <div className="p-4 space-y-6 max-w-2xl">
        <Sec title="Practice Info">
          <FL label="Practice Name"><input value={ps.practice_name} onChange={e => setPs({...ps, practice_name: e.target.value})} className={INP} placeholder="Medazon Health" /></FL>
          <div className="grid grid-cols-3 gap-3"><FL label="Phone"><input value={ps.practice_phone} onChange={e => setPs({...ps, practice_phone: e.target.value})} className={INP} /></FL><FL label="Fax"><input value={ps.practice_fax} onChange={e => setPs({...ps, practice_fax: e.target.value})} className={INP} /></FL><FL label="Email"><input value={ps.practice_email} onChange={e => setPs({...ps, practice_email: e.target.value})} className={INP} /></FL></div>
          <div className="grid grid-cols-2 gap-3"><FL label="NPI"><input value={ps.practice_npi} onChange={e => setPs({...ps, practice_npi: e.target.value})} className={INP} /></FL><FL label="Tax ID"><input value={ps.practice_tax_id} onChange={e => setPs({...ps, practice_tax_id: e.target.value})} className={INP} /></FL></div>
        </Sec>
        <Sec title="Address">
          <FL label="Address Line 1"><input value={ps.address_line1} onChange={e => setPs({...ps, address_line1: e.target.value})} className={INP} /></FL>
          <FL label="Address Line 2"><input value={ps.address_line2} onChange={e => setPs({...ps, address_line2: e.target.value})} className={INP} /></FL>
          <div className="grid grid-cols-3 gap-3"><FL label="City"><input value={ps.city} onChange={e => setPs({...ps, city: e.target.value})} className={INP} /></FL><FL label="State"><input value={ps.state} onChange={e => setPs({...ps, state: e.target.value})} className={INP} maxLength={2} /></FL><FL label="ZIP"><input value={ps.zip} onChange={e => setPs({...ps, zip: e.target.value})} className={INP} /></FL></div>
          <FL label="Timezone"><select value={ps.timezone} onChange={e => setPs({...ps, timezone: e.target.value})} className={INP}>{['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix'].map(t => <option key={t} value={t}>{t.replace('America/', '').replace(/_/g, ' ')}</option>)}</select></FL>
        </Sec>
        <Sec title="Scheduling">
          <div className="grid grid-cols-3 gap-3">
            <FL label="Slot Duration (min)"><input type="number" value={ps.default_slot_duration} onChange={e => setPs({...ps, default_slot_duration: parseInt(e.target.value)||30})} className={INP} /></FL>
            <FL label="Buffer (min)"><input type="number" value={ps.buffer_between_appointments} onChange={e => setPs({...ps, buffer_between_appointments: parseInt(e.target.value)||0})} className={INP} /></FL>
            <FL label="Max Daily"><input type="number" value={ps.max_daily_appointments} onChange={e => setPs({...ps, max_daily_appointments: parseInt(e.target.value)||40})} className={INP} /></FL>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Tog label="Online Scheduling" checked={ps.allow_online_scheduling} onChange={v => setPs({...ps, allow_online_scheduling: v})} />
            <Tog label="Auto-Confirm" checked={ps.auto_confirm_appointments} onChange={v => setPs({...ps, auto_confirm_appointments: v})} />
          </div>
        </Sec>
        <Sec title="Billing">
          <FL label="Payment Terms (days)"><input type="number" value={ps.default_payment_terms} onChange={e => setPs({...ps, default_payment_terms: parseInt(e.target.value)||30})} className={INP} /></FL>
          <div className="flex items-center gap-4 mt-2"><Tog label="Accept Insurance" checked={ps.accept_insurance} onChange={v => setPs({...ps, accept_insurance: v})} /><Tog label="Accept Cash Pay" checked={ps.accept_cash_pay} onChange={v => setPs({...ps, accept_cash_pay: v})} /></div>
        </Sec>
        <Sec title="Notifications">
          <div className="grid grid-cols-3 gap-3 items-end">
            <Tog label="Email" checked={ps.email_notifications} onChange={v => setPs({...ps, email_notifications: v})} />
            <Tog label="SMS" checked={ps.sms_notifications} onChange={v => setPs({...ps, sms_notifications: v})} />
            <FL label="Reminder (hrs before)"><input type="number" value={ps.reminder_hours_before} onChange={e => setPs({...ps, reminder_hours_before: parseInt(e.target.value)||24})} className={INP} /></FL>
          </div>
        </Sec>
        <Sec title="AI Features">
          <div className="flex items-center gap-4"><Tog label="AI Scribe" checked={ps.ai_scribe_enabled} onChange={v => setPs({...ps, ai_scribe_enabled: v})} /><Tog label="CDSS Alerts" checked={ps.ai_cdss_enabled} onChange={v => setPs({...ps, ai_cdss_enabled: v})} /><Tog label="AI Coding Assist" checked={ps.ai_coding_assist} onChange={v => setPs({...ps, ai_coding_assist: v})} /></div>
        </Sec>
        <Sec title="Compliance">
          <div className="flex items-center gap-4"><Tog label="HIPAA BAA Signed" checked={ps.hipaa_baa_signed} onChange={v => setPs({...ps, hipaa_baa_signed: v})} /></div>
          {ps.hipaa_baa_signed && <FL label="BAA Date"><input type="date" value={ps.hipaa_baa_date?.split('T')[0] || ''} onChange={e => setPs({...ps, hipaa_baa_date: e.target.value})} className={INP} /></FL>}
        </Sec>
      </div>
    </div>
  )

  // HUB view
  return (
    <div className="min-h-screen bg-[#030f0f] text-white">
      <div className="px-4 pt-4 pb-3 border-b border-[#1a3d3d]/30">
        <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">Settings</h1><p className="text-xs text-gray-500">Practice configuration & administration</p></div></div>
      </div>
      <div className="p-4 space-y-2 max-w-2xl">
        {links.map(l => l.onClick ? (
          <button key={l.label} onClick={l.onClick} className="w-full flex items-center gap-3 p-3 bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg hover:border-[#1a3d3d] transition-colors text-left">
            <div className={`p-2 rounded-lg ${l.bg}`}><l.icon className={`w-4 h-4 ${l.color}`} /></div>
            <div className="flex-1"><div className="text-sm font-medium">{l.label}</div><div className="text-[11px] text-gray-500">{l.sub}</div></div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        ) : (
          <Link key={l.label} href={l.href} className="flex items-center gap-3 p-3 bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg hover:border-[#1a3d3d] transition-colors">
            <div className={`p-2 rounded-lg ${l.bg}`}><l.icon className={`w-4 h-4 ${l.color}`} /></div>
            <div className="flex-1"><div className="text-sm font-medium">{l.label}</div><div className="text-[11px] text-gray-500">{l.sub}</div></div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4 space-y-3"><h3 className="text-xs font-semibold text-gray-300 mb-1">{title}</h3>{children}</div> }
function FL({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-[11px] text-gray-400 mb-1">{label}</label>{children}</div> }
function Tog({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 cursor-pointer"><div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${checked ? 'bg-emerald-600' : 'bg-gray-700'}`} onClick={() => onChange(!checked)}><div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : ''}`} /></div><span className="text-[11px] text-gray-300">{label}</span></label>
}
