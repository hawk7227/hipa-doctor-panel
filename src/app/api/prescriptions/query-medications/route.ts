// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { NextRequest, NextResponse } from 'next/server';
import { requireDoctor } from '@/lib/api-auth'
import { PHIQueryClient } from '@/lib/emrdirect';

// Force this API route to use Node.js runtime (required for TLS/FS modules)
export const runtime = 'nodejs';

/**
 * Query Patient Medications API Route
 * 
 * Queries patient medication history via PHIQUERY FHIR R4 API
 * 
 * Query params:
 * - patientId: Patient identifier for FHIR query
 */
export async function GET(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {
   
 const searchParams = req.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    // Initialize PHIQUERY client
    const client = new PHIQueryClient();

    // Query patient medications
    const result = await client.queryPatientMedications(patientId);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('Error querying medications:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

