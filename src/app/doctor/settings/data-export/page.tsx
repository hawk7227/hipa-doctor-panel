// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
"use client";

import { useState } from "react";

interface ExportSummary {
  total_patients: number;
  patients_with_medications: number;
  total_medications: number;
  total_allergies: number;
  total_problems: number;
}

export default function DataExportPage() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/export-patient-data");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Export failed");
      }

      const data = await res.json();
      setSummary(data.summary);
      setLastExport(data.export_info.generated_at);

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medazon-patient-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also save to localStorage as backup
      try {
        localStorage.setItem("medazon_patient_export", JSON.stringify(data));
        localStorage.setItem("medazon_patient_export_date", new Date().toISOString());
      } catch {
        console.log("Export too large for localStorage, file saved instead");
      }
    } catch (err: any) {
      setError(err.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSupabase = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/export-patient-data");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();

      // Save to Supabase as a document record
      const saveRes = await fetch("/api/save-patient-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || "Save failed");
      }

      const result = await saveRes.json();
      setSummary(data.summary);
      setLastExport(data.export_info.generated_at);
      alert(`✅ Saved to database! ${data.summary.total_patients} patients, ${data.summary.total_medications} medications backed up.`);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">📦 Patient Data Export</h1>
      <p className="text-gray-400 mb-6">
        Export all patient records with medications, allergies, and problems to a JSON file.
        This creates a local backup independent of DrChrono.
      </p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={handleExport}
          disabled={loading}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Exporting...
            </>
          ) : (
            <>💾 Download JSON File</>
          )}
        </button>

        <button
          onClick={handleSaveToSupabase}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? "Saving..." : "☁️ Save to Database"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
          ❌ {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-[#0d1218] border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-teal-400 mb-4">✅ Export Complete</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[#11161c] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{summary.total_patients.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">Patients</div>
            </div>
            <div className="bg-[#11161c] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-teal-400">{summary.patients_with_medications.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">With Medications</div>
            </div>
            <div className="bg-[#11161c] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{summary.total_medications.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">Medications</div>
            </div>
            <div className="bg-[#11161c] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{summary.total_allergies.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">Allergies</div>
            </div>
            <div className="bg-[#11161c] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{summary.total_problems.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">Problems</div>
            </div>
          </div>
          {lastExport && (
            <p className="text-xs text-gray-500 mt-4">Generated: {new Date(lastExport).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-[#0d1218] border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-300 mb-3">What&apos;s included in the export:</h3>
        <ul className="text-sm text-gray-400 space-y-2">
          <li>• <strong className="text-white">Patient demographics</strong> — name, email, phone, DOB, address</li>
          <li>• <strong className="text-white">Medications</strong> — name, dosage, sig, status, dates prescribed/stopped</li>
          <li>• <strong className="text-white">Allergies</strong> — description, reaction, status</li>
          <li>• <strong className="text-white">Problems</strong> — diagnosis name, status, onset date</li>
        </ul>
        <div className="mt-4 p-3 bg-teal-900/20 border border-teal-500/30 rounded-lg">
          <p className="text-xs text-teal-300">
            🛡️ This export works independently of DrChrono. Once saved, you can access patient data
            even if the DrChrono API is down or unavailable. Run this export regularly to keep your backup current.
          </p>
        </div>
      </div>
    </div>
  );
}
