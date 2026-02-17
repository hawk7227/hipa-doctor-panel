// ═══════════════════════════════════════════════════════════════
// EXPORT FALLBACK — Shared helper for all doctor panel APIs
//
// Tries: 1) Supabase patient_data_exports  2) Static JSON file
// Returns medications array for a patient
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
      console.log(`[ExportFallback] Loaded static file: ${cachedPatients!.length} patients`);
      return cachedPatients;
    }
  } catch (e) {
    console.log("[ExportFallback] Static file error:", (e as Error).message);
  }
  return null;
}

export async function getExportMedications(
  db: any,
  dcId: number | null,
  patientId: string
): Promise<any[]> {
  // Try 1: Supabase export
  try {
    const { data: exportRow } = await db
      .from("patient_data_exports")
      .select("data")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (exportRow?.data) {
      const patients = exportRow.data as any[];
      let match = dcId ? patients.find((p: any) => p.drchrono_patient_id === dcId) : null;
      if (!match) {
        const { data: pt } = await db.from("patients").select("email").eq("id", patientId).single();
        if (pt?.email) match = patients.find((p: any) => p.email === pt.email.toLowerCase());
      }
      if (match?.medications?.length > 0) {
        console.log(`[ExportFallback] Supabase: ${match.medications.length} meds`);
        return formatMeds(match);
      }
    }
  } catch (e) {
    console.log("[ExportFallback] Supabase failed:", (e as Error).message);
  }

  // Try 2: Static file
  const patients = loadStaticFile();
  if (patients) {
    let match = dcId ? patients.find((p: any) => p.drchrono_patient_id === dcId) : null;
    if (!match) {
      try {
        const { data: pt } = await db.from("patients").select("email").eq("id", patientId).single();
        if (pt?.email) match = patients.find((p: any) => p.email === pt.email.toLowerCase());
      } catch {}
    }
    if (match?.medications?.length > 0) {
      console.log(`[ExportFallback] Static file: ${match.medications.length} meds`);
      return formatMeds(match);
    }
  }

  return [];
}

function formatMeds(match: any): any[] {
  return match.medications.map((m: any, i: number) => ({
    id: `export-${i}`,
    drchrono_patient_id: match.drchrono_patient_id,
    name: m.name,
    dosage_quantity: m.dosage?.split(" ")[0] || "",
    dosage_unit: m.dosage?.split(" ").slice(1).join(" ") || "",
    sig: m.sig || "",
    status: m.status || "active",
    date_prescribed: m.date_prescribed || "",
    date_stopped_taking: m.date_stopped || null,
    _source: "export",
  }));
}
