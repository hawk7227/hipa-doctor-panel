import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Paginated fetch — gets ALL rows past the 1000-row default limit
async function fetchAll(table: string, select: string, orderBy: string = "id") {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`[Export] ${table} error at offset ${offset}:`, error.message);
      break;
    }
    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allRows;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("[Export] Starting full export (paginated)...");

    const dcPatients = await fetchAll(
      "drchrono_patients",
      "drchrono_patient_id, first_name, last_name, email, cell_phone, date_of_birth, address, city, state, zip_code, default_pharmacy",
      "drchrono_patient_id"
    );
    console.log(`[Export] ${dcPatients.length} patients`);

    const allMeds = await fetchAll(
      "drchrono_medications",
      "drchrono_patient_id, name, dosage_quantity, dosage_unit, sig, frequency, status, date_prescribed, date_stopped_taking",
      "id"
    );
    console.log(`[Export] ${allMeds.length} medications`);

    const allAllergies = await fetchAll(
      "drchrono_allergies",
      "drchrono_patient_id, description, reaction, status, notes",
      "id"
    );
    console.log(`[Export] ${allAllergies.length} allergies`);

    // Build lookup maps
    const medsMap = new Map<number, any[]>();
    for (const m of allMeds) {
      if (!medsMap.has(m.drchrono_patient_id)) medsMap.set(m.drchrono_patient_id, []);
      medsMap.get(m.drchrono_patient_id)!.push(m);
    }

    const allergiesMap = new Map<number, any[]>();
    for (const a of allAllergies) {
      if (!allergiesMap.has(a.drchrono_patient_id)) allergiesMap.set(a.drchrono_patient_id, []);
      allergiesMap.get(a.drchrono_patient_id)!.push(a);
    }

    const patients = dcPatients.map((p: any) => {
      const dcId = p.drchrono_patient_id;
      return {
        drchrono_patient_id: dcId,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        email: (p.email || "").toLowerCase(),
        phone: p.cell_phone || "",
        date_of_birth: p.date_of_birth || "",
        address: [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(", "),
        pharmacy: p.default_pharmacy || "",
        medications: (medsMap.get(dcId) || []).map((m: any) => ({
          name: m.name || "",
          dosage: [m.dosage_quantity, m.dosage_unit].filter(Boolean).join(" ") || "",
          sig: m.sig || m.frequency || "",
          status: m.status || "unknown",
          date_prescribed: m.date_prescribed || "",
          date_stopped: m.date_stopped_taking || null,
        })),
        allergies: (allergiesMap.get(dcId) || []).map((a: any) => ({
          name: a.description || "",
          reaction: a.reaction || a.notes || "",
          status: a.status || "active",
        })),
      };
    });

    const totalMeds = patients.reduce((s: number, p: any) => s + p.medications.length, 0);
    const totalAllergies = patients.reduce((s: number, p: any) => s + p.allergies.length, 0);

    const exportData = {
      export_info: {
        generated_at: new Date().toISOString(),
        generated_by: "Medazon Health Doctor Panel",
        version: "1.0",
        duration_ms: Date.now() - startTime,
      },
      summary: {
        total_patients: patients.length,
        patients_with_medications: patients.filter((p: any) => p.medications.length > 0).length,
        total_medications: totalMeds,
        total_allergies: totalAllergies,
        total_problems: 0,
      },
      patients,
    };

    console.log(`[Export] Done: ${patients.length} patients, ${totalMeds} meds, ${totalAllergies} allergies in ${Date.now() - startTime}ms`);
    return NextResponse.json(exportData);
  } catch (err: any) {
    console.error("[Export] FATAL:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
