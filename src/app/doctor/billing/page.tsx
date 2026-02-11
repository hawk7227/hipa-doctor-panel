"use client"

import { useEffect, useState } from "react"
import { DollarSign, TrendingUp, Clock, AlertCircle, Calendar, User, ChevronDown, MoreVertical } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

interface PaymentRow {
  id: string
  amount: number
  status: string
  created_at: string
  appointment_id: string
  appointments?: {
    id: string
    status: string
    created_at: string
    patients?: { first_name?: string | null; last_name?: string | null } | null
  } | null
}

export default function DoctorBilling() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [monthlyEarnings, setMonthlyEarnings] = useState(0)
  const [pendingEarnings, setPendingEarnings] = useState(0)
  const [avgPerVisit, setAvgPerVisit] = useState(0)
  const [filter, setFilter] = useState<"all" | "captured" | "pending">("all")

  useEffect(() => { fetchBilling() }, [])

  const fetchBilling = async () => {
    try {
      setLoading(true); setError(null)
      const auth = await getCurrentUser()
      if (!auth?.doctor) { setError("Auth error"); setLoading(false); return }

      const { data, error: fe } = await supabase
        .from("payment_records")
        .select("*, appointments!payment_records_appointment_id_fkey(id, status, created_at, patients!appointments_patient_id_fkey(first_name, last_name))")
        .order("created_at", { ascending: false })

      if (fe) { console.error(fe); setError("Failed to load billing"); return }

      const rows: PaymentRow[] = (data || []).map((r: any) => ({
        ...r,
        appointments: Array.isArray(r.appointments) ? r.appointments[0] : r.appointments || null,
      }))
      // Normalize nested patient join
      rows.forEach(r => {
        if (r.appointments) {
          r.appointments.patients = Array.isArray(r.appointments.patients) ? r.appointments.patients[0] : r.appointments.patients || null
        }
      })

      setPayments(rows)

      const captured = rows.filter(r => r.status === "captured")
      const total = captured.reduce((s, r) => s + (r.amount || 0), 0)
      setTotalEarnings(total)

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const monthly = captured.filter(r => new Date(r.created_at) >= thirtyDaysAgo).reduce((s, r) => s + (r.amount || 0), 0)
      setMonthlyEarnings(monthly)

      const pending = rows.filter(r => r.status !== "captured").reduce((s, r) => s + (r.amount || 0), 0)
      setPendingEarnings(pending)

      setAvgPerVisit(captured.length > 0 ? Math.round(total / captured.length) : 0)
    } catch (e: any) { console.error(e); setError(e.message) } finally { setLoading(false) }
  }

  const filtered = payments.filter(p => filter === "all" ? true : p.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA] mx-auto" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.2)] rounded-xl p-6 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-[#FF4757] mx-auto mb-3" />
        <p className="text-sm text-[#7B8CA3] mb-4">{error}</p>
        <button onClick={fetchBilling} className="px-4 py-2 bg-[#00D4AA] text-[#0B0F14] rounded-lg text-sm font-semibold">Retry</button>
      </div>
    </div>
  )

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-4">Billing & Revenue</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {[
          { label: "This Month", value: `$${monthlyEarnings.toLocaleString()}`, sub: "+12% from last", color: "#00D4AA" },
          { label: "Pending", value: `$${pendingEarnings.toLocaleString()}`, sub: `${payments.filter(p => p.status !== "captured").length} visits`, color: "#FFB020" },
          { label: "Avg per Visit", value: `$${avgPerVisit}`, sub: "Flat rate", color: "#3B82F6" },
        ].map((s, i) => (
          <div key={i} className="bg-[#151D28] rounded-[14px] p-5 border border-[#1E2A3A]">
            <p className="text-2xl font-bold text-[#E8ECF1]">{s.value}</p>
            <p className="text-xs text-[#7B8CA3] mt-0.5">{s.label}</p>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: s.color }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "captured", "pending"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-[rgba(0,212,170,0.12)] text-[#00D4AA]" : "text-[#7B8CA3] hover:bg-[#1E2A3A]/30"
            }`}>
            {f === "all" ? "All" : f === "captured" ? "Completed" : "Pending"}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#4A5568]">{filtered.length} transactions</span>
      </div>

      {/* Transactions list */}
      <div className="bg-[#151D28] rounded-[14px] border border-[#1E2A3A] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[#7B8CA3] text-sm">No transactions found</div>
        ) : (
          filtered.slice(0, 20).map((p, i) => {
            const pName = p.appointments?.patients
              ? `${p.appointments.patients.first_name || ""} ${p.appointments.patients.last_name || ""}`.trim()
              : "Unknown"
            return (
              <div key={p.id || i} className="px-5 py-3.5 flex items-center gap-4 border-b border-[#1E2A3A] last:border-b-0 hover:bg-[#1A2332] transition-colors">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: p.status === "captured" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)" }}>
                  <DollarSign className="w-4 h-4" style={{ color: p.status === "captured" ? "#22C55E" : "#F59E0B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#E8ECF1] truncate">{pName}</p>
                  <p className="text-[11px] text-[#7B8CA3]">{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#E8ECF1]">${(p.amount / 100).toFixed(2)}</p>
                  <p className="text-[10px] font-mono" style={{ color: p.status === "captured" ? "#22C55E" : "#F59E0B" }}>
                    {p.status === "captured" ? "Paid" : "Pending"}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
