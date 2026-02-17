// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ═══════════════════════════════════════════════════════════════
// SAVE PATIENT EXPORT — Stores JSON backup in Supabase
// POST /api/save-patient-export
// Body: { data: { export_info, summary, patients } }
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json();

    if (!data || !data.patients) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const exportRecord = {
      export_type: "full_patient_data",
      generated_at: data.export_info?.generated_at || new Date().toISOString(),
      summary: data.summary,
      patient_count: data.summary?.total_patients || 0,
      medication_count: data.summary?.total_medications || 0,
      data: data.patients, // The full patient array
    };

    // Try to save to patient_data_exports table
    // If table doesn't exist, save to a generic documents/settings table
    const { data: saved, error } = await supabase
      .from("patient_data_exports")
      .insert(exportRecord)
      .select("id, generated_at")
      .single();

    if (error) {
      // Table might not exist — try creating it first
      if (error.message.includes("relation") || error.code === "42P01") {
        console.log("[SaveExport] Table doesn't exist, creating...");

        // Create the table via raw SQL
        const { error: createErr } = await supabase.rpc("exec_sql", {
          sql: `
            CREATE TABLE IF NOT EXISTS patient_data_exports (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              export_type text NOT NULL DEFAULT 'full_patient_data',
              generated_at timestamptz NOT NULL DEFAULT now(),
              summary jsonb,
              patient_count integer DEFAULT 0,
              medication_count integer DEFAULT 0,
              data jsonb NOT NULL,
              created_at timestamptz DEFAULT now()
            );
            ALTER TABLE patient_data_exports DISABLE ROW LEVEL SECURITY;
          `,
        });

        if (createErr) {
          console.error("[SaveExport] Can't create table via RPC:", createErr.message);
          // Last resort: save as JSON in storage or return the data for manual save
          return NextResponse.json({
            error: "Table 'patient_data_exports' does not exist. Please create it in Supabase SQL Editor.",
            sql: `CREATE TABLE IF NOT EXISTS patient_data_exports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  export_type text NOT NULL DEFAULT 'full_patient_data',
  generated_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb,
  patient_count integer DEFAULT 0,
  medication_count integer DEFAULT 0,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE patient_data_exports DISABLE ROW LEVEL SECURITY;`,
          }, { status: 500 });
        }

        // Retry insert
        const { data: retried, error: retryErr } = await supabase
          .from("patient_data_exports")
          .insert(exportRecord)
          .select("id, generated_at")
          .single();

        if (retryErr) {
          return NextResponse.json({ error: retryErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: retried?.id, generated_at: retried?.generated_at });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[SaveExport] Saved export: ${saved?.id} with ${exportRecord.patient_count} patients`);
    return NextResponse.json({ success: true, id: saved?.id, generated_at: saved?.generated_at });
  } catch (err: any) {
    console.error("[SaveExport] FATAL:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
