"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Database, Download, RefreshCw, CheckCircle, AlertTriangle, Wifi, WifiOff } from "lucide-react";

interface ExportHistory {
  generated_at: string;
  summary: any;
  patient_count: number;
  medication_count: number;
}

export default function DataExportPage() {
  const [exportInfo, setExportInfo] = useState<ExportHistory | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    const { data } = await supabase
      .from("patient_data_exports")
      .select("summary, generated_at, patient_count, medication_count")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();
    if (data) setExportInfo(data);
  };

  const runSync = async () => {
    setSyncing(true); setError(null);
    try {
      const res = await fetch("/api/export-patient-data");
      const data = await res.json();
      if (data.patients) {
        const pts = data.patients;
        await supabase.from("patient_data_exports").upsert({
          id: "00000000-0000-0000-0000-000000000001",
          export_type: "full_patient_data",
          generated_at: new Date().toISOString(),
          summary: {
            total_patients: pts.length,
            total_medications: pts.reduce((s: number, p: any) => s + (p.medications?.length || 0), 0),
            total_allergies: pts.reduce((s: number, p: any) => s + (p.allergies?.length || 0), 0),
            total_problems: pts.reduce((s: number, p: any) => s + (p.problems?.length || 0), 0),
            total_appointments: pts.reduce((s: number, p: any) => s + (p.appointments?.length || 0), 0),
          },
          patient_count: pts.length,
          medication_count: pts.reduce((s: number, p: any) => s + (p.medications?.length || 0), 0),
          data: pts,
        });
        await loadStatus();
      }
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  const downloadJson = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export-patient-data");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `medazon-full-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
    setDownloading(false);
  };

  const s = exportInfo?.summary || {};
  const genAt = exportInfo?.generated_at;
  const isStale = genAt ? (Date.now() - new Date(genAt).getTime()) > 24 * 60 * 60 * 1000 : true;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> Patient Data Export</h1>
          <p className="text-sm text-gray-400 mt-1">Full backup of all patient records — works without DrChrono or internet</p>
        </div>
        <div className="flex items-center gap-2">
          {!isStale ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 text-sm rounded-full font-bold"><Wifi className="w-4 h-4" /> Healthy</span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 text-sm rounded-full font-bold"><WifiOff className="w-4 h-4" /> Stale</span>
          )}
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Patients" value={s.total_patients || exportInfo?.patient_count || 0} color="text-white" bg="bg-emerald-600/10" />
        <StatCard label="Medications" value={s.total_medications || exportInfo?.medication_count || 0} color="text-teal-400" bg="bg-teal-600/10" />
        <StatCard label="Allergies" value={s.total_allergies || 0} color="text-amber-400" bg="bg-amber-600/10" />
        <StatCard label="Problems" value={s.total_problems || 0} color="text-purple-400" bg="bg-purple-600/10" />
        <StatCard label="Appointments" value={s.total_appointments || 0} color="text-blue-400" bg="bg-blue-600/10" />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button onClick={runSync} disabled={syncing} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
          <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing All Data..." : "Sync & Save to Database"}
        </button>
        <button onClick={downloadJson} disabled={downloading} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
          <Download className="w-5 h-5" />
          {downloading ? "Downloading..." : "Download JSON File"}
        </button>
      </div>

      {/* Last backup info */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Backup Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Last backup</span><span className="text-white">{genAt ? new Date(genAt).toLocaleString() : "Never"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Backup age</span><span className={isStale ? "text-red-400" : "text-green-400"}>{genAt ? timeAgo(genAt) : "N/A"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Auto-sync</span><span className="text-teal-400">Daily at midnight (cron)</span></div>
        </div>
      </div>

      {/* What's included */}
      <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-3">What&apos;s backed up</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Patient demographics (name, DOB, email, phone, address)</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Medications (name, dosage, sig, status, dates)</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Allergies (name, reaction, severity, status)</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Problems/diagnoses (name, ICD code, status)</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Appointment history (date, reason, status, doctor)</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> 3-tier fallback (live → database → static file)</div>
        </div>
        <div className="mt-4 p-3 bg-teal-900/20 border border-teal-500/30 rounded-lg">
          <p className="text-xs text-teal-300">🛡️ All data is accessible even if DrChrono goes down, Supabase is unreachable, or you have no internet. The static JSON file is baked into both the patient and doctor apps.</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} border border-[#1a3d3d]/50 rounded-xl p-5 text-center`}>
      <div className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}
