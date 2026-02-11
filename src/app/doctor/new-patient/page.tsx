"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { UserPlus, ArrowLeft, Check } from "lucide-react"
import Link from "next/link"
import Dialog from "@/components/Dialog"

export default function NewPatientPage() {
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string; type: "success" | "error" | "warning" | "info"
  }>({ isOpen: false, title: "", message: "", type: "info" })
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    date_of_birth: "", location: "", preferred_pharmacy: "", allergies: "",
  })

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setDialog({ isOpen: true, title: "Required Fields", message: "First name and last name are required.", type: "warning" })
      return
    }
    setSaving(true)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error("Not logged in")
      if (form.email || form.phone) {
        const conds: string[] = []
        if (form.email.trim()) conds.push(`email.eq.${form.email.trim()}`)
        if (form.phone.trim()) conds.push(`phone.eq.${form.phone.trim()}`)
        const { data: existing } = await supabase.from("patients").select("id, first_name, last_name").or(conds.join(",")).maybeSingle()
        if (existing) {
          setDialog({ isOpen: true, title: "Patient Already Exists", message: `${existing.first_name} ${existing.last_name} already exists.`, type: "warning" })
          setSaving(false); return
        }
      }
      const insertData: any = { first_name: form.first_name.trim(), last_name: form.last_name.trim() }
      if (form.email.trim()) insertData.email = form.email.trim()
      if (form.phone.trim()) insertData.phone = form.phone.trim()
      if (form.date_of_birth) insertData.date_of_birth = form.date_of_birth
      if (form.location.trim()) insertData.location = form.location.trim()
      if (form.preferred_pharmacy.trim()) insertData.preferred_pharmacy = form.preferred_pharmacy.trim()
      if (form.allergies.trim()) insertData.allergies = form.allergies.trim()
      const { data, error } = await supabase.from("patients").insert([insertData]).select("id, first_name, last_name").single()
      if (error) throw error
      setDialog({ isOpen: true, title: "Patient Created", message: `${data.first_name} ${data.last_name} added.`, type: "success" })
      setForm({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", location: "", preferred_pharmacy: "", allergies: "" })
    } catch (err: any) {
      console.error(err)
      setDialog({ isOpen: true, title: "Error", message: err.message || "Failed.", type: "error" })
    } finally { setSaving(false) }
  }

  const ic = "w-full px-3 py-2.5 bg-[#111820] border border-[#1E2A3A] rounded-xl text-[#E8ECF1] text-sm outline-none focus:border-[#00D4AA]/50 transition-colors placeholder-[#4A5568] [color-scheme:dark]"

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/doctor/patients" className="p-2 rounded-xl bg-[#151D28] border border-[#1E2A3A] text-[#7B8CA3] hover:text-[#E8ECF1]">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,170,0.12)] flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-[#00D4AA]" />
        </div>
        <h2 className="text-lg font-semibold text-[#E8ECF1]">New Patient</h2>
      </div>
      <div className="bg-[#151D28] border border-[#1E2A3A] rounded-2xl overflow-hidden">
        <form onSubmit={handleSave}>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">First Name <span className="text-[#FF4757]">*</span></label>
                <input type="text" required value={form.first_name} onChange={e => updateField("first_name", e.target.value)} placeholder="First Name" className={ic} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Last Name <span className="text-[#FF4757]">*</span></label>
                <input type="text" required value={form.last_name} onChange={e => updateField("last_name", e.target.value)} placeholder="Last Name" className={ic} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Email</label>
                <input type="email" value={form.email} onChange={e => updateField("email", e.target.value)} placeholder="patient@email.com" className={ic} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Phone</label>
                <input type="tel" value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+14805551234" className={ic} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Date of Birth</label>
                <input type="date" value={form.date_of_birth} onChange={e => updateField("date_of_birth", e.target.value)} className={ic} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Location</label>
                <input type="text" value={form.location} onChange={e => updateField("location", e.target.value)} placeholder="City, State" className={ic} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Preferred Pharmacy</label>
              <input type="text" value={form.preferred_pharmacy} onChange={e => updateField("preferred_pharmacy", e.target.value)} placeholder="Pharmacy name and location" className={ic} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 block">Allergies</label>
              <textarea rows={3} value={form.allergies} onChange={e => updateField("allergies", e.target.value)} placeholder="List any known allergies..." className={ic + " resize-none"} />
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[#1E2A3A] flex gap-3">
            <Link href="/doctor/patients" className="flex-1 px-4 py-2.5 text-center text-sm bg-[#1A2332] border border-[#1E2A3A] text-[#7B8CA3] rounded-xl hover:border-[#2A3A4F]">Cancel</Link>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-[#00D4AA] text-[#0B0F14] rounded-xl font-semibold hover:bg-[#00B894] disabled:opacity-50">
              {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0B0F14]/30 border-t-[#0B0F14]" />Saving...</> : <><Check className="w-4 h-4" />Save Patient</>}
            </button>
          </div>
        </form>
      </div>
      <Dialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} title={dialog.title} message={dialog.message} type={dialog.type} />
    </div>
  )
}
