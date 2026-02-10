'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

const C = {
  bg: "#0B0F14", surface: "#111820", surfaceHover: "#1A2332", card: "#151D28",
  border: "#1E2A3A", borderLight: "#2A3A4F",
  accent: "#00D4AA", accentDim: "rgba(0,212,170,0.12)",
  warning: "#FFB020", danger: "#FF4757", info: "#3B82F6",
  text: "#E8ECF1", textMuted: "#7B8CA3", textDim: "#4A5568", white: "#FFFFFF",
  success: "#22C55E", successDim: "rgba(34,197,94,0.12)",
  dangerDim: "rgba(255,71,87,0.12)", warningDim: "rgba(255,176,32,0.12)", infoDim: "rgba(59,130,246,0.12)",
  purple: "#A78BFA", purpleDim: "rgba(167,139,250,0.12)",
}

interface Assistant {
  id: string; doctor_id: string; first_name: string; last_name: string; email: string;
  phone: string | null; role: string; is_active: boolean; permissions: any;
  temp_password: string | null; must_change_password: boolean;
  last_login_at: string | null; created_at: string; updated_at: string;
}

const DEFAULT_PERMISSIONS = {
  dashboard: true, appointments: { view: true, create: true, edit: true, cancel: false },
  patients: { view: true, create: true, edit: false, view_records: false },
  medical_records: { view: false, create: false, edit: false },
  prescriptions: { view: false, create: false, send: false },
  billing: { view: false, create: false, refund: false },
  communication: { view: true, send: true }, profile: { view: true, edit: false },
  availability: { view: true, edit: false }, reports: { view: false, export: false }
}

const PERM_LABELS: Record<string, { label: string; desc: string; subs?: Record<string, string> }> = {
  dashboard: { label: 'Dashboard', desc: 'Main dashboard' },
  appointments: { label: 'Appointments', desc: 'Manage appointments', subs: { view: 'View', create: 'Create', edit: 'Edit', cancel: 'Cancel' } },
  patients: { label: 'Patients', desc: 'Manage patients', subs: { view: 'View', create: 'Add', edit: 'Edit', view_records: 'Records' } },
  medical_records: { label: 'Medical Records', desc: 'Record access', subs: { view: 'View', create: 'Create', edit: 'Edit' } },
  prescriptions: { label: 'Prescriptions', desc: 'eRx access', subs: { view: 'View', create: 'Create', send: 'Send' } },
  billing: { label: 'Billing', desc: 'Financials', subs: { view: 'View', create: 'Create', refund: 'Refund' } },
  communication: { label: 'Messaging', desc: 'Patient comms', subs: { view: 'View', send: 'Send' } },
  profile: { label: 'Profile', desc: 'Settings', subs: { view: 'View', edit: 'Edit' } },
  availability: { label: 'Availability', desc: 'Schedule', subs: { view: 'View', edit: 'Edit' } },
  reports: { label: 'Reports', desc: 'Analytics', subs: { view: 'View', export: 'Export' } }
}

const ROLES = [{ v: 'assistant', l: 'Assistant' }, { v: 'nurse', l: 'Nurse' }, { v: 'office_manager', l: 'Office Manager' }]

export default function DoctorAssistantsPage() {
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fd, setFd] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'assistant', password: '', permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) })
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})

  useEffect(() => { init() }, [])

  const init = async () => {
    const u = await getCurrentUser()
    if (!u?.doctor) { setError('Please log in.'); setLoading(false); return }
    setDoctorId(u.doctor.id); fetch(u.doctor.id)
  }

  const fetch = async (id: string) => {
    setLoading(true); setError(null)
    const { data, error: e } = await supabase.from('doctor_assistants').select('*').eq('doctor_id', id).order('created_at', { ascending: false })
    if (e) { setError('Failed to load'); console.error(e) } else setAssistants(data || [])
    setLoading(false)
  }

  const save = async () => {
    if (!doctorId) return
    if (!fd.first_name.trim() || !fd.last_name.trim() || !fd.email.trim()) { setError('Name and email required'); return }
    if (!editingId && (!fd.password || fd.password.length < 6)) { setError('Password min 6 chars'); return }
    setSaving(true); setError(null)
    const payload: any = { doctor_id: doctorId, first_name: fd.first_name.trim(), last_name: fd.last_name.trim(), email: fd.email.trim().toLowerCase(), phone: fd.phone.trim() || null, role: fd.role, permissions: fd.permissions, is_active: true, updated_at: new Date().toISOString() }
    if (fd.password) { payload.temp_password = fd.password; payload.must_change_password = true }
    if (!editingId) payload.created_by = doctorId
    const { error: e } = editingId ? await supabase.from('doctor_assistants').update(payload).eq('id', editingId) : await supabase.from('doctor_assistants').insert(payload)
    if (e) { setError(e.message); setSaving(false); return }
    setSuccess(editingId ? 'Updated' : 'Created'); reset(); fetch(doctorId); setTimeout(() => setSuccess(null), 3000); setSaving(false)
  }

  const reset = () => { setShowForm(false); setEditingId(null); setFd({ first_name: '', last_name: '', email: '', phone: '', role: 'assistant', password: '', permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) }); setError(null) }

  const updPerm = (sec: string, sub?: string) => { setFd(p => { const perms = { ...p.permissions }; if (sub) { perms[sec] = { ...perms[sec], [sub]: !perms[sec][sub] } } else { perms[sec] = !perms[sec] }; return { ...p, permissions: perms } }) }

  const inputStyle = { width: '100%', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: 'inherit' }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80, background: C.bg, minHeight: '100vh' }}><div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.surface}, ${C.card})`, borderRadius: 16, border: `1px solid ${C.border}`, padding: '24px 32px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Assistant Accounts</h1><p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>Create and manage staff with granular permissions</p></div>
          {!showForm && <button onClick={() => { reset(); setShowForm(true) }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #00B894)`, color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Assistant</button>}
        </div>

        {success && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: C.success, fontSize: 13, fontWeight: 600 }}>{success}</div>}
        {error && !showForm && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: C.dangerDim, border: `1px solid ${C.danger}30`, color: C.danger, fontSize: 13, fontWeight: 600 }}>{error}</div>}

        {showForm && (
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editingId ? 'Edit Assistant' : 'New Assistant'}</h2>
            {error && <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, background: C.dangerDim, border: `1px solid ${C.danger}30`, color: C.danger, fontSize: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[['First Name *', 'first_name', 'text'], ['Last Name *', 'last_name', 'text'], ['Email *', 'email', 'email'], ['Phone', 'phone', 'tel']].map(([label, key, type]) => (
                <div key={key as string}><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>{label}</label><input type={type as string} value={(fd as any)[key as string]} onChange={e => setFd(p => ({...p, [key as string]: e.target.value}))} style={inputStyle} /></div>
              ))}
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>Role</label><select value={fd.role} onChange={e => setFd(p => ({...p, role: e.target.value}))} style={inputStyle}>{ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>{editingId ? 'New Password' : 'Password *'}</label><input type="text" value={fd.password} onChange={e => setFd(p => ({...p, password: e.target.value}))} style={inputStyle} placeholder={editingId ? 'Blank = keep' : 'Min 6 chars'} /><p style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>You control this password.</p></div>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>Permissions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {Object.entries(PERM_LABELS).map(([k, cfg]) => (
                <div key={k} style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cfg.subs ? 10 : 0 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13 }}>{cfg.label}</div><div style={{ fontSize: 11, color: C.textDim }}>{cfg.desc}</div></div>
                    {!cfg.subs && <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}><input type="checkbox" checked={!!fd.permissions[k]} onChange={() => updPerm(k)} style={{ opacity: 0, width: 0, height: 0 }} /><span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: fd.permissions[k] ? C.accent : C.border, borderRadius: 12, transition: '0.3s' }}><span style={{ position: 'absolute', left: fd.permissions[k] ? 22 : 2, top: 2, width: 20, height: 20, background: '#fff', borderRadius: 10, transition: '0.3s' }} /></span></label>}
                  </div>
                  {cfg.subs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{Object.entries(cfg.subs).map(([sk, sl]) => { const on = !!fd.permissions[k]?.[sk]; return <button key={sk} onClick={() => updPerm(k, sk)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${on ? `${C.accent}50` : C.border}`, background: on ? C.accentDim : 'transparent', color: on ? C.accent : C.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{sl}</button> })}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.accent}, #00B894)`, color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
              <button onClick={reset} style={{ padding: '10px 24px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* List */}
        {assistants.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: 60, background: C.card, borderRadius: 16, border: `1px dashed ${C.borderLight}` }}><p style={{ color: C.textMuted, fontWeight: 700, fontSize: 16 }}>No assistants yet</p><p style={{ color: C.textDim, fontSize: 13 }}>Create accounts with controlled access</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assistants.map(a => (
              <div key={a.id} style={{ background: C.card, borderRadius: 14, border: `1px solid ${a.is_active ? C.border : `${C.danger}30`}`, padding: '16px 20px', opacity: a.is_active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{a.first_name} {a.last_name}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: a.role === 'office_manager' ? C.purpleDim : a.role === 'nurse' ? C.infoDim : `${C.textDim}30`, color: a.role === 'office_manager' ? C.purple : a.role === 'nurse' ? C.info : C.textMuted }}>{a.role.replace('_', ' ')}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: a.is_active ? 'rgba(34,197,94,0.12)' : C.dangerDim, color: a.is_active ? C.success : C.danger }}>{a.is_active ? 'Active' : 'Disabled'}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0' }}>{a.email}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {Object.entries(a.permissions || {}).map(([k, v]) => { const has = typeof v === 'boolean' ? v : Object.values(v as any).some(Boolean); return has ? <span key={k} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accent }}>{k}</span> : null })}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                      {a.temp_password && <span style={{ fontSize: 11, color: C.textDim }}>PW: <button onClick={() => setShowPw(p => ({...p, [a.id]: !p[a.id]}))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{showPw[a.id] ? a.temp_password : '••••••'}</button></span>}
                      {a.last_login_at && <span style={{ fontSize: 11, color: C.textDim }}>Last login: {new Date(a.last_login_at).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {[
                      { label: 'Edit', fn: () => { setEditingId(a.id); setFd({ first_name: a.first_name, last_name: a.last_name, email: a.email, phone: a.phone || '', role: a.role, password: '', permissions: a.permissions || JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) }); setShowForm(true) }, bg: `${C.textDim}30`, c: C.textMuted, b: C.border },
                      { label: 'Reset PW', fn: () => { const p = prompt('New password (min 6):'); if (p && p.length >= 6) { supabase.from('doctor_assistants').update({ temp_password: p, must_change_password: true }).eq('id', a.id).then(() => { setSuccess(`PW reset for ${a.first_name}`); fetch(doctorId!); setTimeout(() => setSuccess(null), 3000) }) } }, bg: C.warningDim, c: C.warning, b: `${C.warning}30` },
                      { label: a.is_active ? 'Disable' : 'Enable', fn: () => { if (confirm(`${a.is_active ? 'Disable' : 'Enable'} ${a.first_name}?`)) { supabase.from('doctor_assistants').update({ is_active: !a.is_active }).eq('id', a.id).then(() => fetch(doctorId!)) } }, bg: a.is_active ? C.dangerDim : 'rgba(34,197,94,0.12)', c: a.is_active ? C.danger : C.success, b: a.is_active ? `${C.danger}30` : `${C.success}30` },
                      { label: 'Delete', fn: () => { if (confirm(`Delete ${a.first_name}?`)) { supabase.from('doctor_assistants').delete().eq('id', a.id).then(() => fetch(doctorId!)) } }, bg: C.dangerDim, c: C.danger, b: `${C.danger}30` },
                    ].map(btn => <button key={btn.label} onClick={btn.fn} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${btn.b}`, background: btn.bg, color: btn.c, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{btn.label}</button>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}
