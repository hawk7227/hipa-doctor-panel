'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── DESIGN SYSTEM (matches MedazonEnterprise) ───
const C = {
  bg: "#0B0F14", surface: "#111820", surfaceHover: "#1A2332", card: "#151D28",
  border: "#1E2A3A", borderLight: "#2A3A4F",
  accent: "#00D4AA", accentDim: "rgba(0,212,170,0.12)", accentGlow: "rgba(0,212,170,0.25)",
  warning: "#FFB020", danger: "#FF4757", info: "#3B82F6",
  text: "#E8ECF1", textMuted: "#7B8CA3", textDim: "#4A5568", white: "#FFFFFF",
  success: "#22C55E", successDim: "rgba(34,197,94,0.12)",
  dangerDim: "rgba(255,71,87,0.12)", warningDim: "rgba(255,176,32,0.12)", infoDim: "rgba(59,130,246,0.12)",
  purple: "#A78BFA", purpleDim: "rgba(167,139,250,0.12)",
}

interface DoctorApplication {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  specialty: string; license_number: string; experience_years: number; education: string | null;
  bio: string | null; languages: string[] | null; consultation_fee: number | null;
  status: string; password_hash: string | null; submitted_at: string; created_at: string;
  reviewed_by: string | null; reviewed_at: string | null; rejection_reason: string | null;
}
interface ActivityLog {
  id: string; user_type: string; user_email: string | null; user_name: string | null;
  action: string; resource_type: string | null; description: string | null;
  ip_address: string | null; page_url: string | null; metadata: any; created_at: string;
}
interface LoginSession {
  id: string; user_type: string; email: string | null; user_name: string | null;
  is_active: boolean; ip_address: string | null; user_agent: string | null;
  geo_location: any; logged_in_at: string; last_activity_at: string; logged_out_at: string | null;
}
interface PasswordResetLog {
  id: string; user_type: string; email: string; status: string;
  ip_address: string | null; requested_at: string; completed_at: string | null;
}
interface DoctorRecord {
  id: string; first_name: string; last_name: string; email: string; specialty: string;
  license_number: string; is_approved: boolean; phone: string | null; created_at: string;
}

type TabType = 'applications' | 'doctors' | 'activity' | 'sessions' | 'passwords'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('applications')
  const [applications, setApplications] = useState<DoctorApplication[]>([])
  const [doctors, setDoctors] = useState<DoctorRecord[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([])
  const [passwordLogs, setPasswordLogs] = useState<PasswordResetLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<DoctorApplication | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalDoctors: 0, activeSessions: 0 })

  useEffect(() => { fetchData() }, [activeTab])

  const fetchData = async () => {
    setLoading(true); setError(null)
    try {
      const [appsRes, docsRes, sessRes] = await Promise.all([
        supabase.from('doctor_applications').select('status'),
        supabase.from('doctors').select('id'),
        supabase.from('login_sessions').select('id').eq('is_active', true)
      ])
      setStats({
        pending: appsRes.data?.filter(a => a.status === 'pending').length || 0,
        approved: appsRes.data?.filter(a => a.status === 'approved').length || 0,
        rejected: appsRes.data?.filter(a => a.status === 'rejected').length || 0,
        totalDoctors: docsRes.data?.length || 0,
        activeSessions: sessRes.data?.length || 0,
      })
      if (activeTab === 'applications') { const { data } = await supabase.from('doctor_applications').select('*').order('created_at', { ascending: false }); setApplications(data || []) }
      else if (activeTab === 'doctors') { const { data } = await supabase.from('doctors').select('*').order('created_at', { ascending: false }); setDoctors(data || []) }
      else if (activeTab === 'activity') { const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100); setActivityLogs(data || []) }
      else if (activeTab === 'sessions') { const { data } = await supabase.from('login_sessions').select('*').order('logged_in_at', { ascending: false }).limit(100); setLoginSessions(data || []) }
      else if (activeTab === 'passwords') { const { data } = await supabase.from('password_reset_logs').select('*').order('created_at', { ascending: false }).limit(100); setPasswordLogs(data || []) }
    } catch (err) { console.error('fetchData error:', err); setError('An unexpected error occurred') }
    finally { setLoading(false) }
  }

  const handleApprove = async (app: DoctorApplication) => {
    if (!confirm(`Approve Dr. ${app.first_name} ${app.last_name}?`)) return
    setProcessingId(app.id); setError(null); setSuccessMsg(null)
    try {
      const tempPassword = app.password_hash || `Medazon_${Math.random().toString(36).slice(2, 10)}!`
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: app.email, password: tempPassword, email_confirm: true, user_metadata: { role: 'doctor', first_name: app.first_name, last_name: app.last_name } })
      let userId = authData?.user?.id
      if (authError) {
        console.warn('admin.createUser failed, trying signUp:', authError.message)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: app.email, password: tempPassword, options: { data: { role: 'doctor', first_name: app.first_name, last_name: app.last_name } } })
        if (signUpError) { setError('Failed to create auth: ' + signUpError.message); setProcessingId(null); return }
        userId = signUpData?.user?.id
      }
      const { error: docError } = await supabase.from('doctors').insert({ first_name: app.first_name, last_name: app.last_name, email: app.email, phone: app.phone, specialty: app.specialty, license_number: app.license_number, experience_years: app.experience_years, education: app.education, bio: app.bio, languages: app.languages, consultation_fee: app.consultation_fee, is_approved: true, approved_at: new Date().toISOString(), submitted_at: app.submitted_at, user_id: userId || null })
      if (docError) { setError('Failed to create doctor: ' + docError.message); setProcessingId(null); return }
      await supabase.from('doctor_applications').update({ status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', app.id)
      await supabase.from('activity_logs').insert({ user_type: 'admin', action: 'doctor_application_approved', resource_type: 'doctor_application', resource_id: app.id, description: `Approved: Dr. ${app.first_name} ${app.last_name} (${app.specialty})`, metadata: { doctor_email: app.email } })
      setSuccessMsg(`Dr. ${app.first_name} ${app.last_name} approved! Email: ${app.email}`)
      setSelectedApp(null); fetchData(); setTimeout(() => setSuccessMsg(null), 5000)
    } catch (err) { console.error('Approve error:', err); setError('Unexpected error during approval') }
    finally { setProcessingId(null) }
  }

  const handleReject = async (app: DoctorApplication) => {
    if (!rejectionReason.trim()) { setError('Rejection reason required'); return }
    if (!confirm(`Reject Dr. ${app.first_name} ${app.last_name}?`)) return
    setProcessingId(app.id); setError(null)
    try {
      await supabase.from('doctor_applications').update({ status: 'rejected', rejection_reason: rejectionReason.trim(), reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', app.id)
      await supabase.from('activity_logs').insert({ user_type: 'admin', action: 'doctor_application_rejected', resource_type: 'doctor_application', resource_id: app.id, description: `Rejected: Dr. ${app.first_name} ${app.last_name}. Reason: ${rejectionReason.trim()}` })
      setSuccessMsg(`Application rejected.`); setSelectedApp(null); setRejectionReason(''); fetchData(); setTimeout(() => setSuccessMsg(null), 5000)
    } catch (err) { console.error('Reject error:', err); setError('Unexpected error') }
    finally { setProcessingId(null) }
  }

  const formatDate = (d: string) => new Date(d).toLocaleString()
  const statusBadge = (s: string) => {
    const colors = { pending: { bg: C.warningDim, text: C.warning, border: `${C.warning}30` }, approved: { bg: C.successDim, text: C.success, border: `${C.success}30` }, rejected: { bg: C.dangerDim, text: C.danger, border: `${C.danger}30` } }
    const c = colors[s as keyof typeof colors] || colors.pending
    return <span style={{ padding: '2px 10px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.text, textTransform: 'uppercase' as const }}>{s}</span>
  }

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'applications', label: 'Applications', count: stats.pending },
    { key: 'doctors', label: 'Doctors', count: stats.totalDoctors },
    { key: 'activity', label: 'Activity Log' },
    { key: 'sessions', label: 'Sessions', count: stats.activeSessions },
    { key: 'passwords', label: 'Password Logs' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, #00B894)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: C.bg }}>M</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: C.white, margin: 0 }}>Medazon Health Admin</h1>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Platform management & doctor approval</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Pending', val: stats.pending, color: C.warning },
              { label: 'Approved', val: stats.approved, color: C.success },
              { label: 'Doctors', val: stats.totalDoctors, color: C.info },
              { label: 'Active', val: stats.activeSessions, color: C.purple },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 20px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent', background: 'transparent', color: activeTab === tab.key ? C.accent : C.textMuted, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: activeTab === tab.key ? C.accentDim : `${C.textDim}30`, color: activeTab === tab.key ? C.accent : C.textMuted }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        {/* Messages */}
        {successMsg && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: C.successDim, border: `1px solid ${C.success}30`, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.success }}>{successMsg}</span>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: C.dangerDim, border: `1px solid ${C.danger}30`, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            {/* ===== APPLICATIONS ===== */}
            {activeTab === 'applications' && (
              selectedApp ? (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24 }}>
                  <button onClick={() => { setSelectedApp(null); setRejectionReason(''); setError(null) }} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>← Back to list</button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
                    <div><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dr. {selectedApp.first_name} {selectedApp.last_name}</h2><p style={{ color: C.textMuted, margin: '4px 0 0' }}>{selectedApp.specialty} · License: {selectedApp.license_number}</p></div>
                    {statusBadge(selectedApp.status)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
                      {[
                        ['Email', selectedApp.email], ['Phone', selectedApp.phone || 'N/A'], ['Experience', `${selectedApp.experience_years} years`],
                        ['Fee', selectedApp.consultation_fee ? `$${(selectedApp.consultation_fee / 100).toFixed(2)}` : 'Not set'],
                      ].map(([l, v]) => <div key={l as string}><div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div></div>)}
                      <div><div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Submitted Password</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", padding: '6px 12px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, display: 'inline-block' }}>{selectedApp.password_hash || 'None'}</div></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
                      {[['Education', selectedApp.education], ['Bio', selectedApp.bio], ['Languages', selectedApp.languages?.join(', ')], ['Submitted', formatDate(selectedApp.submitted_at)]].map(([l, v]) => <div key={l as string}><div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{l}</div><div style={{ fontSize: 13, marginTop: 4, color: C.textMuted }}>{(v as string) || 'Not provided'}</div></div>)}
                    </div>
                  </div>
                  {selectedApp.status === 'pending' && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                      <button onClick={() => handleApprove(selectedApp)} disabled={processingId === selectedApp.id} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.success}, #16A34A)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: processingId === selectedApp.id ? 0.5 : 1 }}>
                        {processingId === selectedApp.id ? 'Processing...' : 'Approve & Create Account'}
                      </button>
                      <div style={{ marginTop: 20 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Rejection Reason (required to reject)</label>
                        <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} style={{ width: '100%', padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'none' as const }} placeholder="Provide reason..." />
                        <button onClick={() => handleReject(selectedApp)} disabled={!rejectionReason.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !rejectionReason.trim() ? 0.5 : 1 }}>Reject Application</button>
                      </div>
                    </div>
                  )}
                  {selectedApp.rejection_reason && (
                    <div style={{ marginTop: 16, padding: 16, background: C.dangerDim, borderRadius: 12, border: `1px solid ${C.danger}30` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>Rejection Reason:</div>
                      <div style={{ fontSize: 13, color: C.danger, marginTop: 4, opacity: 0.8 }}>{selectedApp.rejection_reason}</div>
                    </div>
                  )}
                </div>
              ) : (
                applications.length === 0 ? (
                  <div style={{ textAlign: 'center' as const, padding: 60, background: C.card, borderRadius: 16, border: `1px solid ${C.border}` }}><p style={{ color: C.textMuted, fontWeight: 600 }}>No applications yet</p></div>
                ) : (
                  <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead><tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                        {['Doctor', 'Specialty', 'License', 'Status', 'Submitted', 'Action'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {applications.map(app => (
                          <tr key={app.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, fontSize: 14 }}>Dr. {app.first_name} {app.last_name}</div><div style={{ fontSize: 12, color: C.textMuted }}>{app.email}</div></td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: C.textMuted }}>{app.specialty}</td>
                            <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.textMuted }}>{app.license_number}</td>
                            <td style={{ padding: '12px 16px' }}>{statusBadge(app.status)}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: C.textDim }}>{formatDate(app.submitted_at)}</td>
                            <td style={{ padding: '12px 16px' }}><button onClick={() => setSelectedApp(app)} style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${C.accent}30`, background: C.accentDim, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Review</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )
            )}

            {/* ===== DOCTORS ===== */}
            {activeTab === 'doctors' && (
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {doctors.length === 0 ? <div style={{ textAlign: 'center' as const, padding: 60 }}><p style={{ color: C.textMuted }}>No doctors</p></div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead><tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                      {['Doctor', 'Specialty', 'License', 'Approved', 'Created'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{doctors.map(d => (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, fontSize: 14 }}>Dr. {d.first_name} {d.last_name}</div><div style={{ fontSize: 12, color: C.textMuted }}>{d.email}</div></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: C.textMuted }}>{d.specialty}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.textMuted }}>{d.license_number}</td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: d.is_approved ? C.successDim : C.warningDim, color: d.is_approved ? C.success : C.warning, border: `1px solid ${d.is_approved ? C.success : C.warning}30` }}>{d.is_approved ? 'Yes' : 'No'}</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: C.textDim }}>{formatDate(d.created_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* ===== ACTIVITY ===== */}
            {activeTab === 'activity' && (
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {activityLogs.length === 0 ? <div style={{ textAlign: 'center' as const, padding: 60 }}><p style={{ color: C.textMuted }}>No activity</p></div> : (
                  <div>{activityLogs.map(log => (
                    <div key={log.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: log.user_type === 'admin' ? C.purpleDim : C.infoDim, color: log.user_type === 'admin' ? C.purple : C.info }}>{log.user_type}</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{log.action.replace(/_/g, ' ')}</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>{log.description}</p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                          {log.user_email && <span style={{ fontSize: 11, color: C.textDim }}>{log.user_email}</span>}
                          {log.ip_address && <span style={{ fontSize: 11, color: C.textDim }}>IP: {log.ip_address}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim, whiteSpace: 'nowrap' as const }}>{formatDate(log.created_at)}</span>
                    </div>
                  ))}</div>
                )}
              </div>
            )}

            {/* ===== SESSIONS ===== */}
            {activeTab === 'sessions' && (
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {loginSessions.length === 0 ? <div style={{ textAlign: 'center' as const, padding: 60 }}><p style={{ color: C.textMuted }}>No sessions</p></div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead><tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                      {['User', 'Type', 'Status', 'IP', 'Login', 'Last Activity'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{loginSessions.map(s => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 700, fontSize: 13 }}>{s.user_name || 'Unknown'}</div><div style={{ fontSize: 11, color: C.textMuted }}>{s.email}</div></td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${C.textDim}30`, color: C.textMuted }}>{s.user_type}</span></td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: s.is_active ? C.successDim : `${C.textDim}30`, color: s.is_active ? C.success : C.textDim }}>{s.is_active ? 'Active' : 'Ended'}</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.textDim }}>{s.ip_address || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: C.textDim }}>{formatDate(s.logged_in_at)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: C.textDim }}>{formatDate(s.last_activity_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* ===== PASSWORDS ===== */}
            {activeTab === 'passwords' && (
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {passwordLogs.length === 0 ? <div style={{ textAlign: 'center' as const, padding: 60 }}><p style={{ color: C.textMuted }}>No password resets</p></div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead><tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                      {['Email', 'Type', 'Status', 'IP', 'Requested', 'Completed'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{passwordLogs.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{p.email}</td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${C.textDim}30`, color: C.textMuted }}>{p.user_type}</span></td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: p.status === 'completed' ? C.successDim : C.warningDim, color: p.status === 'completed' ? C.success : C.warning }}>{p.status}</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.textDim }}>{p.ip_address || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: C.textDim }}>{formatDate(p.requested_at)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: C.textDim }}>{p.completed_at ? formatDate(p.completed_at) : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
