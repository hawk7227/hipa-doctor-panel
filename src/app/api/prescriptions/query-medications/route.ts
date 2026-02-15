import { NextRequest, NextResponse } from 'next/server';
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

