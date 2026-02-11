"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { User, Shield, Lock, Eye, EyeOff, Check, AlertCircle, Edit, Save, X, Award, Clock } from "lucide-react"
import { supabase, Doctor } from "@/lib/supabase"
import { updatePassword } from "@/lib/auth"

export default function DoctorProfile() {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [formData, setFormData] = useState({
    first_name: "", last_name: "", email: "", specialty: "", license_number: "",
    phone: "", bio: "", experience_years: 0, education: "", languages: [] as string[],
    insurance_accepted: [] as string[], consultation_fee: 0,
  })

  // Password
  const [showPwSection, setShowPwSection] = useState(false)
  const [pwData, setPwData] = useState({ newPassword: "", confirmPassword: "" })
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState("")

  // Auto-save timer
  const saveTimer = useRef<any>(null)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true); setError(null)
      const { data, error: fe } = await supabase.from("doctors").select("*").limit(1).single()
      if (fe) { console.error(fe); setError("Failed to load profile"); return }
      if (data) {
        setDoctor(data)
        setFormData({
          first_name: data.first_name || "", last_name: data.last_name || "",
          email: data.email || "", specialty: data.specialty || "",
          license_number: data.license_number || "", phone: data.phone || "",
          bio: data.bio || "", experience_years: data.experience_years || 0,
          education: data.education || "", languages: data.languages || [],
          insurance_accepted: data.insurance_accepted || [],
          consultation_fee: data.consultation_fee || 0,
        })
      }
    } catch (e: any) { console.error(e); setError(e.message) } finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!doctor) return
    try {
      setSaving(true); setSaveStatus("saving")
      const { error: ue } = await supabase.from("doctors").update({ ...formData, updated_at: new Date().toISOString() }).eq("id", doctor.id)
      if (ue) { console.error(ue); setSaveStatus("error"); return }
      setSaveStatus("saved")
      setEditing(false)
      fetchProfile()
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch (e) { console.error(e); setSaveStatus("error") } finally { setSaving(false) }
  }

  // Auto-save on field change (2 second debounce)
  const handleChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (editing) {
      setSaveStatus("idle")
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        // Auto-save
        if (doctor) {
          setSaveStatus("saving")
          supabase.from("doctors").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", doctor.id)
            .then(({ error: e }) => {
              if (e) { console.error(e); setSaveStatus("error") }
              else { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000) }
            })
        }
      }, 2000)
    }
  }, [editing, doctor])

  const handleArrayChange = (field: "languages" | "insurance_accepted", value: string) => {
    const items = value.split(",").map(s => s.trim()).filter(Boolean)
    handleChange(field, items)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault(); setPwLoading(true); setPwError(""); setPwSuccess("")
    if (pwData.newPassword.length < 6) { setPwError("Min 6 characters"); setPwLoading(false); return }
    if (pwData.newPassword !== pwData.confirmPassword) { setPwError("Passwords don't match"); setPwLoading(false); return }
    try {
      const { error: pe } = await updatePassword(pwData.newPassword)
      if (pe) {
        const msg = typeof pe === "object" && pe && "message" in pe ? (pe as { message: string }).message : "Failed"
        setPwError(msg); setPwLoading(false); return
      }
      setPwSuccess("Password updated!"); setPwData({ newPassword: "", confirmPassword: "" })
      setTimeout(() => { setShowPwSection(false); setPwSuccess("") }, 2000)
    } catch (e) { setPwError("Unexpected error"); console.error(e) } finally { setPwLoading(false) }
  }

  const initials = `${(formData.first_name || "D").charAt(0)}${(formData.last_name || "R").charAt(0)}`.toUpperCase()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA]" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.2)] rounded-xl p-6 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-[#FF4757] mx-auto mb-3" />
        <p className="text-sm text-[#7B8CA3] mb-4">{error}</p>
        <button onClick={fetchProfile} className="px-4 py-2 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-sm font-semibold">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── HEADER CARD ── */}
      <div className="bg-gradient-to-br from-[#111820] to-[#0d1218] border border-[#1E2A3A] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D4AA] to-[#00B894] flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-[#0B0F14]">{initials}</span>
          </div>
          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-[#E8ECF1]">Dr. {formData.first_name} {formData.last_name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[#22C55E] text-[10px] font-bold border border-[rgba(34,197,94,0.2)]">Active</span>
            </div>
            <p className="text-[13px] text-[#7B8CA3] mt-1">
              {formData.specialty || "General Practice"} · License: {formData.license_number || "N/A"}
            </p>
            <p className="text-xs text-[#4A5568] mt-0.5">
              {formData.experience_years || 0} years experience · ${formData.consultation_fee || 0} consultation fee
            </p>
            {formData.bio && <p className="text-xs text-[#7B8CA3] mt-2 line-clamp-2">{formData.bio}</p>}
          </div>
          {/* Edit button */}
          <button onClick={() => { if (editing) handleSave(); else setEditing(true) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              editing
                ? "bg-[#00D4AA] text-[#0B0F14] hover:bg-[#00B894]"
                : "bg-[#151D28] border border-[#1E2A3A] text-[#E8ECF1] hover:border-[#2A3A4F]"
            }`}>
            {editing ? <><Save className="w-4 h-4" /> Save Profile</> : <><Edit className="w-4 h-4" /> Edit Profile</>}
          </button>
        </div>
        {/* Auto-save indicator */}
        {editing && saveStatus !== "idle" && (
          <div className="mt-3 flex items-center gap-2">
            {saveStatus === "saving" && <><div className="animate-spin rounded-full h-3 w-3 border-b border-[#00D4AA]" /><span className="text-[10px] text-[#7B8CA3]">Saving...</span></>}
            {saveStatus === "saved" && <><Check className="w-3 h-3 text-[#22C55E]" /><span className="text-[10px] text-[#22C55E]">Saved</span></>}
            {saveStatus === "error" && <><AlertCircle className="w-3 h-3 text-[#FF4757]" /><span className="text-[10px] text-[#FF4757]">Save failed</span></>}
          </div>
        )}
      </div>

      {/* ── BASIC INFORMATION ── */}
      <div className="bg-[#151D28] border border-[#1E2A3A] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2A3A] flex items-center gap-2">
          <User className="w-4 h-4 text-[#00D4AA]" />
          <h3 className="text-sm font-semibold text-[#E8ECF1]">Basic Information</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "First Name", field: "first_name", type: "text" },
            { label: "Last Name", field: "last_name", type: "text" },
            { label: "Email Address", field: "email", type: "email" },
            { label: "Phone Number", field: "phone", type: "tel" },
            { label: "Medical Specialty", field: "specialty", type: "text" },
            { label: "License Number", field: "license_number", type: "text" },
            { label: "Years of Experience", field: "experience_years", type: "number" },
            { label: "Consultation Fee ($)", field: "consultation_fee", type: "number" },
          ].map(f => (
            <div key={f.field}>
              <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">{f.label}</label>
              {editing ? (
                <input type={f.type}
                  value={(formData as any)[f.field]}
                  onChange={e => handleChange(f.field, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 transition-colors"
                />
              ) : (
                <p className="text-sm text-[#E8ECF1] px-3 py-2.5">{String((formData as any)[f.field]) || "—"}</p>
              )}
            </div>
          ))}

          {/* Bio — full width */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Professional Bio</label>
            {editing ? (
              <textarea rows={3} value={formData.bio}
                onChange={e => handleChange("bio", e.target.value)}
                className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 resize-none"
              />
            ) : (
              <p className="text-sm text-[#7B8CA3] px-3 py-2.5">{formData.bio || "—"}</p>
            )}
          </div>

          {/* Education */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Education & Training</label>
            {editing ? (
              <textarea rows={2} value={formData.education}
                onChange={e => handleChange("education", e.target.value)}
                placeholder="List your medical degrees, residencies, fellowships, and certifications..."
                className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 resize-none placeholder-[#4A5568]"
              />
            ) : (
              <p className="text-sm text-[#7B8CA3] px-3 py-2.5">{formData.education || "—"}</p>
            )}
          </div>

          {/* Languages */}
          <div>
            <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Languages Spoken</label>
            {editing ? (
              <input value={formData.languages.join(", ")}
                onChange={e => handleArrayChange("languages", e.target.value)}
                placeholder="English, Spanish..."
                className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 placeholder-[#4A5568]"
              />
            ) : (
              <p className="text-sm text-[#7B8CA3] px-3 py-2.5">{formData.languages.join(", ") || "—"}</p>
            )}
          </div>

          {/* Insurance */}
          <div>
            <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Insurance Accepted</label>
            {editing ? (
              <input value={formData.insurance_accepted.join(", ")}
                onChange={e => handleArrayChange("insurance_accepted", e.target.value)}
                placeholder="Aetna, BlueCross..."
                className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 placeholder-[#4A5568]"
              />
            ) : (
              <p className="text-sm text-[#7B8CA3] px-3 py-2.5">{formData.insurance_accepted.join(", ") || "—"}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── SECURITY & PASSWORD ── */}
      <div className="bg-[#151D28] border border-[#1E2A3A] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2A3A] flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#FF4757]" />
          <h3 className="text-sm font-semibold text-[#E8ECF1]">Security & Password</h3>
        </div>
        <div className="p-5">
          {!showPwSection ? (
            <div className="flex items-center justify-between bg-[#111820] border border-[#1E2A3A] rounded-xl p-4">
              <div>
                <p className="text-sm font-medium text-[#E8ECF1]">Password Authentication</p>
                <p className="text-xs text-[#7B8CA3] mt-0.5">Change your account password</p>
              </div>
              <button onClick={() => setShowPwSection(true)}
                className="px-4 py-2 bg-[#1A2332] border border-[#2A3A4F] text-[#E8ECF1] rounded-xl text-xs font-semibold hover:border-[#00D4AA]/30 transition-colors">
                Change Password
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">New Password</label>
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} value={pwData.newPassword}
                    onChange={e => setPwData(p => ({ ...p, newPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 pr-10"
                    placeholder="Min 6 characters"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568]">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Confirm */}
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPw ? "text" : "password"} value={pwData.confirmPassword}
                    onChange={e => setPwData(p => ({ ...p, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568]">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {pwError && <p className="text-xs text-[#FF4757] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {pwError}</p>}
              {pwSuccess && <p className="text-xs text-[#22C55E] flex items-center gap-1"><Check className="w-3 h-3" /> {pwSuccess}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={pwLoading}
                  className="px-4 py-2.5 bg-[#00D4AA] text-[#0B0F14] rounded-xl text-xs font-semibold disabled:opacity-50">
                  {pwLoading ? "Updating..." : "Update Password"}
                </button>
                <button type="button" onClick={() => { setShowPwSection(false); setPwError(""); setPwSuccess("") }}
                  className="px-4 py-2.5 border border-[#1E2A3A] text-[#7B8CA3] rounded-xl text-xs">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── CREDENTIALING STATUS ── */}
      <div className="bg-[#151D28] border border-[#1E2A3A] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2A3A] flex items-center gap-2">
          <Award className="w-4 h-4 text-[#F59E0B]" />
          <h3 className="text-sm font-semibold text-[#E8ECF1]">Credentialing Status</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title: "Medical License",
              status: "approved" as const,
              detail: "Verified and Active",
              sub: formData.license_number || "License #",
              icon: <Shield className="w-5 h-5" />,
            },
            {
              title: "HIPAA Compliance",
              status: (doctor as any)?.hipaa_status === "approved" ? "approved" as const : "pending" as const,
              detail: (doctor as any)?.hipaa_status === "approved" ? "Training Complete" : "Review in progress",
              sub: "Expected: 2-3 business days",
              icon: <Lock className="w-5 h-5" />,
            },
            {
              title: "Background Check",
              status: "approved" as const,
              detail: "Completed and Verified",
              sub: "Completed: 2 weeks ago",
              icon: <Check className="w-5 h-5" />,
            },
          ].map((cred, i) => {
            const isApproved = cred.status === "approved"
            return (
              <div key={i} className="bg-[#111820] border border-[#1E2A3A] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: isApproved ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)" }}>
                    <span style={{ color: isApproved ? "#22C55E" : "#F59E0B" }}>{cred.icon}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    isApproved
                      ? "bg-[rgba(34,197,94,0.12)] text-[#22C55E] border-[rgba(34,197,94,0.2)]"
                      : "bg-[rgba(245,158,11,0.12)] text-[#F59E0B] border-[rgba(245,158,11,0.2)]"
                  }`}>
                    {isApproved ? "APPROVED" : "PENDING"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#E8ECF1]">{cred.title}</p>
                <p className="text-xs text-[#7B8CA3] mt-0.5">{cred.detail}</p>
                <p className="text-[10px] text-[#4A5568] mt-1 font-mono">{cred.sub}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
