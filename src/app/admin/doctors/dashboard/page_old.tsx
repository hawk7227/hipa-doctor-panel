// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

type TabType = 'inquiries' | 'applications' | 'doctors' | 'activity' | 'sessions' | 'passwords' | 'bug_reports'

interface Inquiry {
  id: string
  full_name: string
  email: string
  phone: string
  practice_name: string | null
  practice_size: string | null
  interest_type: string
  message: string | null
  reference_number: string
  status: string
  admin_notes: string | null
  created_at: string
}

interface Doctor {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  specialty: string | null
  license_number: string | null
  npi_number: string | null
  is_approved: boolean
  created_at: string
  auth_user_id: string | null
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('inquiries')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'inquiries') {
        const { data, error: fetchErr } = await getSupabase()
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchErr) {
          console.log('Fetch inquiries error:', fetchErr)
          setError('Failed to load inquiries')
        } else {
          setInquiries(data || [])
        }
      } else if (activeTab === 'applications' || activeTab === 'doctors') {
        const { data, error: fetchErr } = await getSupabase()
          .from('doctors')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchErr) {
          console.log('Fetch doctors error:', fetchErr)
          setError('Failed to load doctors')
        } else {
          setDoctors(data || [])
        }
      }
    } catch (err) {
      console.log('Fetch error:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function updateInquiryStatus(id: string, status: string) {
    const { error: updateErr } = await getSupabase()
      .from('inquiries')
      .update({ status, admin_notes: adminNotes || null })
      .eq('id', id)

    if (updateErr) {
      console.log('Update inquiry error:', updateErr)
      alert('Failed to update status')
    } else {
      setSelectedInquiry(null)
      setAdminNotes('')
      fetchData()
    }
  }

  async function approveDoctor(doctor: Doctor) {
    const { error: updateErr } = await getSupabase()
      .from('doctors')
      .update({ is_approved: true })
      .eq('id', doctor.id)

    if (updateErr) {
      console.log('Approve doctor error:', updateErr)
      alert('Failed to approve doctor')
    } else {
      fetchData()
    }
  }

  async function rejectDoctor(doctor: Doctor) {
    const reason = prompt('Rejection reason (will be emailed to applicant):')
    if (!reason) return

    const { error: updateErr } = await getSupabase()
      .from('doctors')
      .update({ is_approved: false })
      .eq('id', doctor.id)

    if (updateErr) {
      console.log('Reject doctor error:', updateErr)
      alert('Failed to reject doctor')
    } else {
      fetchData()
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'inquiries', label: '📩 Inquiries' },
    { key: 'applications', label: '📋 Applications' },
    { key: 'doctors', label: '🩺 Doctors' },
    { key: 'activity', label: '📊 Activity Log' },
    { key: 'sessions', label: '🔑 Sessions' },
    { key: 'passwords', label: '🔒 Password Logs' },
    { key: 'bug_reports', label: '🐛 Bug Reports' },
  ]

  const filteredInquiries = statusFilter === 'all'
    ? inquiries
    : inquiries.filter((i) => i.status === statusFilter)

  const pendingDoctors = doctors.filter((d) => !d.is_approved)
  const approvedDoctors = doctors.filter((d) => d.is_approved)

  return (
    <div style={{
      minHeight: '100vh', background: '#050810', color: '#E8ECF1',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            🛡️ Medazon Admin Dashboard
          </h1>
          <p style={{ color: '#7B8CA3', fontSize: 12, margin: '4px 0 0' }}>
            Full platform access · Approvals · Bug reports · Sessions · Passwords
          </p>
        </div>
        <a href="/login" style={{ color: '#7B8CA3', fontSize: 13, textDecoration: 'none' }}>Sign Out</a>
      </div>

      {/* Tabs */}
      <div style={{
        padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 4, overflowX: 'auto',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 18px', fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? '#00D4AA' : '#7B8CA3',
              borderBottom: activeTab === tab.key ? '2px solid #00D4AA' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.key === 'inquiries' && inquiries.filter((i) => i.status === 'new').length > 0 && (
              <span style={{
                marginLeft: 6, background: '#EF4444', color: '#fff',
                borderRadius: 10, padding: '2px 7px', fontSize: 11,
              }}>
                {inquiries.filter((i) => i.status === 'new').length}
              </span>
            )}
            {tab.key === 'applications' && pendingDoctors.length > 0 && (
              <span style={{
                marginLeft: 6, background: '#F59E0B', color: '#000',
                borderRadius: 10, padding: '2px 7px', fontSize: 11,
              }}>
                {pendingDoctors.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 32 }}>
        {loading && <p style={{ color: '#7B8CA3' }}>Loading...</p>}
        {error && <p style={{ color: '#EF4444' }}>{error}</p>}

        {/* INQUIRIES TAB */}
        {activeTab === 'inquiries' && !loading && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['all', 'new', 'contacted', 'scheduled', 'converted', 'closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: statusFilter === s ? '1px solid #00D4AA' : '1px solid rgba(255,255,255,0.08)',
                    background: statusFilter === s ? 'rgba(0,212,170,0.1)' : 'transparent',
                    color: statusFilter === s ? '#00D4AA' : '#7B8CA3',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {s} {s !== 'all' && `(${inquiries.filter((i) => i.status === s).length})`}
                </button>
              ))}
            </div>

            {filteredInquiries.length === 0 && <p style={{ color: '#7B8CA3' }}>No inquiries found.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredInquiries.map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => { setSelectedInquiry(inq); setAdminNotes(inq.admin_notes || '') }}
                  style={{
                    padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    border: selectedInquiry?.id === inq.id ? '1px solid #00D4AA' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{inq.full_name}</p>
                    <p style={{ fontSize: 12, color: '#7B8CA3' }}>{inq.email} · {inq.phone}</p>
                    <p style={{ fontSize: 12, color: '#7B8CA3', marginTop: 2 }}>{inq.interest_type} · {inq.reference_number}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: inq.status === 'new' ? 'rgba(239,68,68,0.15)' : inq.status === 'converted' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: inq.status === 'new' ? '#EF4444' : inq.status === 'converted' ? '#22C55E' : '#F59E0B',
                    }}>
                      {inq.status}
                    </span>
                    <p style={{ fontSize: 11, color: '#4A5568', marginTop: 4 }}>
                      {new Date(inq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail Panel */}
            {selectedInquiry && (
              <div style={{
                marginTop: 20, padding: 24, borderRadius: 16,
                background: 'rgba(17,24,32,0.8)',
                border: '1px solid rgba(0,212,170,0.2)',
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  Inquiry Details — {selectedInquiry.full_name}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <DetailItem label="Email" value={selectedInquiry.email} />
                  <DetailItem label="Phone" value={selectedInquiry.phone} />
                  <DetailItem label="Practice" value={selectedInquiry.practice_name || 'N/A'} />
                  <DetailItem label="Size" value={selectedInquiry.practice_size || 'N/A'} />
                  <DetailItem label="Interest" value={selectedInquiry.interest_type} />
                  <DetailItem label="Reference" value={selectedInquiry.reference_number} />
                </div>
                {selectedInquiry.message && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#7B8CA3', marginBottom: 4 }}>Message:</p>
                    <p style={{ fontSize: 14, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      {selectedInquiry.message}
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8CA3', display: 'block', marginBottom: 4 }}>Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)', color: '#E8ECF1',
                      fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                    placeholder="Internal notes..."
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['contacted', 'scheduled', 'converted', 'closed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateInquiryStatus(selectedInquiry.id, s)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: s === 'converted' ? 'rgba(34,197,94,0.15)' : s === 'closed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                        color: s === 'converted' ? '#22C55E' : s === 'closed' ? '#EF4444' : '#E8ECF1',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && !loading && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Pending Applications ({pendingDoctors.length})
            </h3>
            {pendingDoctors.length === 0 && <p style={{ color: '#7B8CA3' }}>No pending applications.</p>}
            {pendingDoctors.map((doc) => (
              <div key={doc.id} style={{
                padding: '16px 20px', borderRadius: 12, marginBottom: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(245,158,11,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Dr. {doc.first_name} {doc.last_name}</p>
                  <p style={{ fontSize: 12, color: '#7B8CA3' }}>
                    {doc.email} · {doc.specialty || 'No specialty'} · License: {doc.license_number || 'N/A'}
                  </p>
                  <p style={{ fontSize: 11, color: '#4A5568', marginTop: 2 }}>
                    Applied {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => approveDoctor(doc)}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#22C55E', color: '#fff', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => rejectDoctor(doc)}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: '1px solid #EF4444', cursor: 'pointer',
                      background: 'transparent', color: '#EF4444', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DOCTORS TAB */}
        {activeTab === 'doctors' && !loading && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              All Doctors ({doctors.length})
            </h3>
            {doctors.map((doc) => (
              <div key={doc.id} style={{
                padding: '14px 20px', borderRadius: 12, marginBottom: 6,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Dr. {doc.first_name} {doc.last_name}</p>
                  <p style={{ fontSize: 12, color: '#7B8CA3' }}>{doc.email} · {doc.specialty || 'N/A'}</p>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: doc.is_approved ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  color: doc.is_approved ? '#22C55E' : '#F59E0B',
                }}>
                  {doc.is_approved ? 'Approved' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ACTIVITY LOG TAB */}
        {activeTab === 'activity' && (
          <p style={{ color: '#7B8CA3' }}>Activity log loads from audit_logs table. Connect to view login history, actions, and system events.</p>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <p style={{ color: '#7B8CA3' }}>Active sessions display. Connect to Supabase auth.sessions to view current logged-in users.</p>
        )}

        {/* PASSWORD LOGS TAB */}
        {activeTab === 'passwords' && (
          <p style={{ color: '#7B8CA3' }}>Password change history. Connect to password_logs table to track credential changes.</p>
        )}

        {/* BUG REPORTS TAB */}
        {activeTab === 'bug_reports' && (
          <div style={{ width: '100%', height: 'calc(100vh - 180px)' }}>
            <iframe
              src="/admin/bug-reports"
              style={{
                width: '100%', height: '100%', border: 'none', borderRadius: 12,
              }}
              allow="camera;microphone;fullscreen"
              title="Bug Reports"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: '#4A5568', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14 }}>{value}</p>
    </div>
  )
}
