// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// EXPORT FALLBACK — Shared helper for all doctor panel APIs
// Tries: 1) Supabase patient_data_exports  2) Static JSON file
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { join } from "path";

let cachedPatients: any[] | null = null;

function loadStaticFile(): any[] | null {
  if (cachedPatients) return cachedPatients;
  try {
    const filePath = join(process.cwd(), "public", "data", "patient-medications.json");
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      cachedPatients = data.patients || [];
      console.log(`[ExportFallback] Loaded static: ${cachedPatients!.length} patients`);
      return cachedPatients;
    }
  } catch (e) { console.log("[ExportFallback] Static error:", (e as Error).message); }
  return null;
}

async function findPatient(db: any, patients: any[], dcId: number | null, patientId: string): Promise<any | null> {
  let match = dcId ? patients.find((p: any) => p.drchrono_patient_id === dcId) : null;
  if (!match) {
    try {
      const { data: pt } = await db.from("patients").select("email").eq("id", patientId).single();
      if (pt?.email) match = patients.find((p: any) => p.email === pt.email.toLowerCase());
    } catch {}
  }
  return match;
}

async function loadPatients(db: any): Promise<any[] | null> {
  // Try Supabase first
  try {
    const { data: exportRow } = await db
      .from("patient_data_exports")
      .select("data")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();
    if (exportRow?.data) return exportRow.data as any[];
  } catch {}

  // Try static file
  return loadStaticFile();
}

// ── Medications fallback ─────────────────────────────────────
export async function getExportMedications(db: any, dcId: number | null, patientId: string): Promise<any[]> {
  const patients = await loadPatients(db);
  if (!patients) return [];
  const match = await findPatient(db, patients, dcId, patientId);
  if (!match?.medications?.length) return [];
  console.log(`[ExportFallback] meds: ${match.medications.length} for ${patientId}`);
  return match.medications.map((m: any, i: number) => ({
    id: `export-${i}`, drchrono_patient_id: match.drchrono_patient_id,
    name: m.name, dosage_quantity: m.dosage?.split(" ")[0] || "", dosage_unit: m.dosage?.split(" ").slice(1).join(" ") || "",
    sig: m.sig || "", status: m.status || "active", date_prescribed: m.date_prescribed || "", date_stopped_taking: m.date_stopped || null, _source: "export",
  }));
}

// ── Allergies fallback ───────────────────────────────────────
export async function getExportAllergies(db: any, dcId: number | null, patientId: string): Promise<any[]> {
  const patients = await loadPatients(db);
  if (!patients) return [];
  const match = await findPatient(db, patients, dcId, patientId);
  if (!match?.allergies?.length) return [];
  console.log(`[ExportFallback] allergies: ${match.allergies.length} for ${patientId}`);
  return match.allergies.map((a: any, i: number) => ({
    id: `export-${i}`, drchrono_patient_id: match.drchrono_patient_id,
    description: a.name, reaction: a.reaction || "", status: a.status || "active", onset_date: a.onset_date || "", _source: "export",
  }));
}

// ── Problems fallback ────────────────────────────────────────
export async function getExportProblems(db: any, dcId: number | null, patientId: string): Promise<any[]> {
  const patients = await loadPatients(db);
  if (!patients) return [];
  const match = await findPatient(db, patients, dcId, patientId);
  if (!match?.problems?.length) return [];
  console.log(`[ExportFallback] problems: ${match.problems.length} for ${patientId}`);
  return match.problems.map((p: any, i: number) => ({
    id: `export-${i}`, drchrono_patient_id: match.drchrono_patient_id,
    name: p.name, status: p.status || "active", date_onset: p.date_onset || "", date_diagnosis: p.date_onset || "", date_changed: p.date_changed || "", _source: "export",
  }));
}

// ── Appointments fallback ────────────────────────────────────
export async function getExportAppointments(db: any, dcId: number | null, patientId: string): Promise<any[]> {
  const patients = await loadPatients(db);
  if (!patients) return [];
  const match = await findPatient(db, patients, dcId, patientId);
  if (!match?.appointments?.length) return [];
  console.log(`[ExportFallback] appointments: ${match.appointments.length} for ${patientId}`);
  return match.appointments.map((ap: any, i: number) => ({
    id: `export-${i}`, drchrono_patient_id: match.drchrono_patient_id,
    scheduled_time: ap.scheduled_time, duration: ap.duration, status: ap.status,
    reason: ap.reason || "", office: ap.office || "", doctor: ap.doctor || "", notes: ap.notes || "", _source: "export",
  }));
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: 3-tier data fallback system
// Built: 2026-02-17 | Used by all 6 panel APIs
//
// Tier 1: Live DrChrono query (handled by panel API itself)
// Tier 2: Supabase patient_data_exports table (this file)
// Tier 3: Static /public/data/patient-medications.json (this file)
//
// Functions: getExportMedications(), getExportAllergies(),
//   getExportProblems(), getExportAppointments()
//
// WIRING: Used by /api/panels/medications, /api/panels/allergies,
//   /api/panels/problems, /api/panels/patient-appointments,
//   /api/panels/medication-history, /api/panels/prescriptions
// ═══════════════════════════════════════════════════════════════
