// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// DAILY AUTO-EXPORT CRON — Runs once per day via Vercel Cron
//
// GET /api/cron-export
// Fetches all patients + meds + allergies + problems + appointments
// Saves to patient_data_exports table
// Configure in vercel.json: { "crons": [{ "path": "/api/cron-export", "schedule": "0 6 * * *" }] }
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchAll(table: string, select: string, orderBy: string = "id") {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error(`[Cron] ${table} error:`, error.message); break; }
    if (data && data.length > 0) { allRows = allRows.concat(data); offset += data.length; hasMore = data.length === PAGE_SIZE; }
    else hasMore = false;
  }
  return allRows;
}

function buildMap(rows: any[], key: string): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const r of rows) { const k = r[key]; if (!map.has(k)) map.set(k, []); map.get(k)!.push(r); }
  return map;
}

export async function GET(req: NextRequest) {
  // Optional: verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without secret for manual triggers
    console.log("[Cron] No secret check — manual trigger");
  }

  const startTime = Date.now();
  try {
    const allPatients = await fetchAll("patients", "id, first_name, last_name, email, phone, date_of_birth, location, preferred_pharmacy", "id");
    const allMeds = await fetchAll("patient_medications", "patient_id, medication_name, dosage, frequency, status, created_at", "id");
    const allAllergies = await fetchAll("patient_allergies", "patient_id, allergen, reaction, severity, status, created_at", "id");
    const allProblems = await fetchAll("patient_problems", "patient_id, problem_name, icd_code, status, onset_date, created_at", "id");
    const allAppts = await fetchAll("appointments", "patient_id, requested_date_time, status, visit_type, chief_complaint, doctor_id, notes", "id");

    const medsMap = buildMap(allMeds, "patient_id");
    const allergiesMap = buildMap(allAllergies, "patient_id");
    const problemsMap = buildMap(allProblems, "patient_id");
    const apptsMap = buildMap(allAppts, "patient_id");

    const patients = allPatients.map((p: any) => {
      const pId = p.id;
      return {
        patient_id: pId,
        first_name: p.first_name || "", last_name: p.last_name || "",
        email: (p.email || "").toLowerCase(), phone: p.phone || "",
        date_of_birth: p.date_of_birth || "",
        address: p.location || "",
        pharmacy: p.preferred_pharmacy || "",
        medications: (medsMap.get(pId) || []).map((m: any) => ({ name: m.medication_name || "", dosage: m.dosage || "", sig: m.frequency || "", status: m.status || "unknown", date_prescribed: m.created_at || "" })),
        allergies: (allergiesMap.get(pId) || []).map((a: any) => ({ name: a.allergen || a.reaction || "", severity: a.severity || "", status: a.status || "active", onset_date: a.created_at || "" })),
        problems: (problemsMap.get(pId) || []).map((pr: any) => ({ name: pr.problem_name || "", icd_code: pr.icd_code || "", status: pr.status || "active", date_diagnosis: pr.onset_date || "" })),
        appointments: (apptsMap.get(pId) || []).map((ap: any) => ({ scheduled_time: ap.requested_date_time || "", status: ap.status || "", reason: ap.chief_complaint || "", visit_type: ap.visit_type || "", notes: ap.notes || "" })),
      };
    });

    const totalMeds = patients.reduce((s: number, p: any) => s + p.medications.length, 0);
    const totalAllergies = patients.reduce((s: number, p: any) => s + p.allergies.length, 0);
    const totalProblems = patients.reduce((s: number, p: any) => s + p.problems.length, 0);
    const totalAppts = patients.reduce((s: number, p: any) => s + p.appointments.length, 0);

    const summary = { total_patients: patients.length, total_medications: totalMeds, total_allergies: totalAllergies, total_problems: totalProblems, total_appointments: totalAppts };

    await supabase.from("patient_data_exports").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      export_type: "full_patient_data",
      generated_at: new Date().toISOString(),
      summary, patient_count: patients.length, medication_count: totalMeds,
      data: patients,
    });

    const duration = Date.now() - startTime;
    console.log(`[Cron] Export done: ${patients.length} patients, ${totalMeds} meds, ${totalAllergies} allergies, ${totalProblems} problems, ${totalAppts} appts in ${duration}ms`);
    return NextResponse.json({ success: true, summary, duration_ms: duration });
  } catch (err: any) {
    console.error("[Cron] FATAL:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// ═══ BUILD_HISTORY ═══════════════════════════════════════════
// This file: Daily auto-sync cron job
// Built: 2026-02-17 | Runs at 6AM UTC via Vercel Cron
//
// Fetches all 5 data types with 1000-row pagination:
//   patients, medications, allergies, problems, appointments
// Saves to patient_data_exports (UUID: 00000000-0000-0000-0000-000000000001)
//
// FIX-004 (2026-02-17): Dashboard now calls this instead of
//   downloading 7MB to browser and re-uploading
//
// WIRING: Called by dashboard Sync Now button + Vercel Cron
// TABLES: patients, patient_medications, patient_allergies,
//         patient_problems, appointments, patient_data_exports
// ═══════════════════════════════════════════════════════════════
