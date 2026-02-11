"use client"

import { useState } from "react"

interface DaySchedule { day: string; enabled: boolean; startTime: string; endTime: string }
interface Override { id: string; title: string; date: string; startTime: string; endTime: string; type: "blocked" | "personal" | "available" }

export default function MobileAvailability() {
  const [activeTab, setActiveTab] = useState<"week" | "month" | "settings">("week")
  const [weeklyHours, setWeeklyHours] = useState<DaySchedule[]>([
    { day: "Monday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
    { day: "Tuesday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
    { day: "Wednesday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
    { day: "Thursday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
    { day: "Friday", enabled: true, startTime: "9:00 AM", endTime: "3:00 PM" },
    { day: "Saturday", enabled: false, startTime: "", endTime: "" },
    { day: "Sunday", enabled: false, startTime: "", endTime: "" },
  ])
  const overrides: Override[] = [
    { id: "1", title: "Doctor's Appointment", date: "Jan 25, 2025", startTime: "2:00 PM", endTime: "4:00 PM", type: "blocked" },
    { id: "2", title: "Conference Call", date: "Jan 28, 2025", startTime: "10:00 AM", endTime: "11:00 AM", type: "personal" },
    { id: "3", title: "Extended Hours", date: "Jan 30, 2025", startTime: "5:00 PM", endTime: "7:00 PM", type: "available" },
  ]
  const toggleDay = (i: number) => { const u = [...weeklyHours]; u[i].enabled = !u[i].enabled; setWeeklyHours(u) }
  const overrideColor = (t: string) => {
    switch (t) {
      case "blocked": return { bg: "rgba(255,71,87,0.1)", border: "#FF4757", text: "#FF4757" }
      case "personal": return { bg: "rgba(129,140,248,0.1)", border: "#818CF8", text: "#818CF8" }
      case "available": return { bg: "rgba(0,212,170,0.1)", border: "#00D4AA", text: "#00D4AA" }
      default: return { bg: "#151D28", border: "#1E2A3A", text: "#7B8CA3" }
    }
  }
  return (
    <div style={{ minHeight: "100vh", background: "#0B0F14", color: "#E8ECF1", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "16px", paddingTop: "calc(16px + env(safe-area-inset-top))", background: "#111820", borderBottom: "1px solid #1E2A3A" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#E8ECF1", margin: 0 }}>Availability</h1>
        <p style={{ fontSize: "13px", color: "#7B8CA3", marginTop: "4px" }}>Manage your schedule</p>
      </div>
      <div style={{ display: "flex", gap: "8px", padding: "12px 16px", background: "#111820", borderBottom: "1px solid #1E2A3A" }}>
        {(["week", "month", "settings"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "10px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
            background: activeTab === tab ? "#00D4AA" : "#151D28", color: activeTab === tab ? "#0B0F14" : "#7B8CA3",
          }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "16px" }}>
        <button style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "18px 16px", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: "14px", cursor: "pointer", color: "#00D4AA" }}>
          <span style={{ fontSize: "20px" }}>✓</span>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Add Available</span>
        </button>
        <button style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "18px 16px", background: "#151D28", border: "1px solid #1E2A3A", borderRadius: "14px", cursor: "pointer", color: "#FF4757" }}>
          <span style={{ fontSize: "20px" }}>✕</span>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Block Time</span>
        </button>
      </div>
      <div style={{ padding: "0 16px 8px" }}><h2 style={{ fontSize: "15px", fontWeight: 700, color: "#E8ECF1", margin: 0 }}>Weekly Hours</h2></div>
      <div style={{ background: "#151D28", margin: "0 16px 16px", borderRadius: "14px", border: "1px solid #1E2A3A", overflow: "hidden" }}>
        {weeklyHours.map((s, i) => (
          <div key={s.day} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < weeklyHours.length - 1 ? "1px solid #1E2A3A" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8ECF1" }}>{s.day}</div>
              <div style={{ fontSize: "12px", color: s.enabled ? "#00D4AA" : "#4A5568", marginTop: "2px" }}>{s.enabled ? `${s.startTime} - ${s.endTime}` : "Off"}</div>
            </div>
            <button onClick={() => toggleDay(i)} style={{ width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer", position: "relative", background: s.enabled ? "#00D4AA" : "#1E2A3A" }}>
              <span style={{ position: "absolute", top: "2px", left: s.enabled ? "24px" : "2px", width: "22px", height: "22px", borderRadius: "50%", background: s.enabled ? "#0B0F14" : "#4A5568", transition: "left 0.2s" }} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 16px 8px" }}><h2 style={{ fontSize: "15px", fontWeight: 700, color: "#E8ECF1", margin: 0 }}>Upcoming Overrides</h2></div>
      <div style={{ background: "#151D28", margin: "0 16px 80px", borderRadius: "14px", border: "1px solid #1E2A3A", overflow: "hidden" }}>
        {overrides.map((o, i) => {
          const c = overrideColor(o.type)
          return (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderBottom: i < overrides.length - 1 ? "1px solid #1E2A3A" : "none" }}>
              <div style={{ width: "3px", height: "36px", borderRadius: "2px", background: c.border }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8ECF1" }}>{o.title}</div>
                <div style={{ fontSize: "12px", color: "#7B8CA3", marginTop: "2px" }}>{o.date} · {o.startTime} - {o.endTime}</div>
              </div>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, background: c.bg, color: c.text }}>{o.type}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
