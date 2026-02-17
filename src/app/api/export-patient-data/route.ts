// ═══════════════════════════════════════════════════════════════
// PATIENT DATA EXPORT API — Full backup of all patients + medications
//
// GET /api/export-patient-data
// Returns: JSON file with all patients, medications, allergies, problems
//
// This creates a local backup independent of DrChrono API
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for large datasets

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PatientExport {
  id: string;
  drchrono_patient_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address: string;
  medications: {
    name: string;
    dosage: string;
    sig: string;
    status: string;
    date_prescribed: string;
    date_stopped: string | null;
    source: string;
  }[];
  allergies: {
    name: string;
    reaction: string;
    status: string;
    source: string;
  }[];
  problems: {
    name: string;
    status: string;
    date_onset: string;
    source: string;
  }[];
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // ── 1. Get all DrChrono patients ──────────────────────────
    console.log("[Export] Starting full patient data export...");

    const { data: dcPatients, error: pErr } = await supabase
      .from("drchrono_patients")
      .select("drchrono_patient_id, first_name, last_name, email, cell_phone, date_of_birth, address, city, state, zip_code")
      .order("last_name", { ascending: true });

    if (pErr) {
      console.error("[Export] Patient query error:", pErr.message);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    console.log(`[Export] Found ${dcPatients?.length || 0} DrChrono patients`);

    // ── 2. Get ALL medications at once (bulk) ────────────────
    const { data: allMeds, error: mErr } = await supabase
      .from("drchrono_medications")
      .select("drchrono_patient_id, name, dosage_quantity, dosage_unit, sig, frequency, status, date_prescribed, date_stopped_taking")
      .order("date_prescribed", { ascending: false });

    if (mErr) console.error("[Export] Medications error:", mErr.message);
    console.log(`[Export] Found ${allMeds?.length || 0} total medications`);

    // ── 3. Get ALL allergies at once (bulk) ──────────────────
    const { data: allAllergies, error: aErr } = await supabase
      .from("drchrono_allergies")
      .select("drchrono_patient_id, description, reaction, status, notes")
      .order("description", { ascending: true });

    if (aErr) console.error("[Export] Allergies error:", aErr.message);
    console.log(`[Export] Found ${allAllergies?.length || 0} total allergies`);

    // ── 4. Get ALL problems at once (bulk) ───────────────────
    const { data: allProblems, error: prErr } = await supabase
      .from("drchrono_problems")
      .select("drchrono_patient_id, name, status, date_onset, date_diagnosis")
      .order("name", { ascending: true });

    if (prErr) console.error("[Export] Problems error:", prErr.message);
    console.log(`[Export] Found ${allProblems?.length || 0} total problems`);

    // ── 5. Build lookup maps by drchrono_patient_id ──────────
    const medsMap = new Map<number, typeof allMeds>();
    for (const m of allMeds || []) {
      const id = m.drchrono_patient_id;
      if (!medsMap.has(id)) medsMap.set(id, []);
      medsMap.get(id)!.push(m);
    }

    const allergiesMap = new Map<number, typeof allAllergies>();
    for (const a of allAllergies || []) {
      const id = a.drchrono_patient_id;
      if (!allergiesMap.has(id)) allergiesMap.set(id, []);
      allergiesMap.get(id)!.push(a);
    }

    const problemsMap = new Map<number, typeof allProblems>();
    for (const p of allProblems || []) {
      const id = p.drchrono_patient_id;
      if (!problemsMap.has(id)) problemsMap.set(id, []);
      problemsMap.get(id)!.push(p);
    }

    // ── 6. Build export array ────────────────────────────────
    const patients: PatientExport[] = (dcPatients || []).map((p) => {
      const dcId = p.drchrono_patient_id;
      const patientMeds = medsMap.get(dcId) || [];
      const patientAllergies = allergiesMap.get(dcId) || [];
      const patientProblems = problemsMap.get(dcId) || [];

      return {
        id: String(dcId),
        drchrono_patient_id: dcId,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        email: p.email || "",
        phone: p.cell_phone || "",
        date_of_birth: p.date_of_birth || "",
        address: [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(", "),
        medications: patientMeds.map((m: any) => ({
          name: m.name || "",
          dosage: [m.dosage_quantity, m.dosage_unit].filter(Boolean).join(" ") || "",
          sig: m.sig || m.frequency || "",
          status: m.status || "unknown",
          date_prescribed: m.date_prescribed || "",
          date_stopped: m.date_stopped_taking || null,
          source: "DrChrono",
        })),
        allergies: patientAllergies.map((a: any) => ({
          name: a.description || "",
          reaction: a.reaction || a.notes || "",
          status: a.status || "active",
          source: "DrChrono",
        })),
        problems: patientProblems.map((pr: any) => ({
          name: pr.name || "",
          status: pr.status || "active",
          date_onset: pr.date_onset || pr.date_diagnosis || "",
          source: "DrChrono",
        })),
      };
    });

    // ── 7. Build summary stats ───────────────────────────────
    const totalMeds = patients.reduce((sum, p) => sum + p.medications.length, 0);
    const totalAllergies = patients.reduce((sum, p) => sum + p.allergies.length, 0);
    const totalProblems = patients.reduce((sum, p) => sum + p.problems.length, 0);
    const patientsWithMeds = patients.filter(p => p.medications.length > 0).length;

    const exportData = {
      export_info: {
        generated_at: new Date().toISOString(),
        generated_by: "Medazon Health Doctor Panel",
        version: "1.0",
        duration_ms: Date.now() - startTime,
      },
      summary: {
        total_patients: patients.length,
        patients_with_medications: patientsWithMeds,
        total_medications: totalMeds,
        total_allergies: totalAllergies,
        total_problems: totalProblems,
      },
      patients,
    };

    console.log(`[Export] Complete: ${patients.length} patients, ${totalMeds} meds, ${totalAllergies} allergies in ${Date.now() - startTime}ms`);

    return NextResponse.json(exportData);
  } catch (err: any) {
    console.error("[Export] FATAL:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
