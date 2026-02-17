// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server';
import { requireDoctor } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EMRDirectClient } from '@/lib/emrdirect';
import { Prescription, Patient, Medication } from '@/types/prescription';
import { createClient } from '@supabase/supabase-js';

// Force this API route to use Node.js runtime (required for TLS/FS modules)
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * eRx Composer API Route
 * 
 * Composes and sends electronic prescriptions via EMRDirect
 * 
 * Accepts:
 * - appointmentId: Compose prescription from appointment data
 * - prescriptionId: Compose prescription from existing prescription record
 * - recipientAddress: Direct messaging address for pharmacy/provider
 * 
 * Fetches:
 * - Patient data from users table
 * - Doctor data from doctors table
 * - Prescription/medication data
 * - Pharmacy data from appointment or prescription
 */
export async function POST(request: NextRequest) {
  const auth = await requireDoctor(request); if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { appointmentId, prescriptionId, recipientAddress } = body as {
      appointmentId?: string;
      prescriptionId?: string;
      recipientAddress: string;
    };

    // Validate required fields
    if (!recipientAddress) {
      return NextResponse.json(
        { success: false, error: 'recipientAddress is required' },
        { status: 400 }
      );
    }

    if (!appointmentId && !prescriptionId) {
      return NextResponse.json(
        { success: false, error: 'Either appointmentId or prescriptionId is required' },
        { status: 400 }
      );
    }

    // Get user from cookies or Bearer token
    const cookieStore = await cookies();
    const authHeader = request.headers.get('Authorization');
    let accessToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    // Create Supabase client
    let supabaseClient: any;
    let user = null;
    let userError = null;

    if (accessToken) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
      
      const { data, error } = await supabaseClient.auth.getUser(accessToken);
      user = data?.user;
      userError = error;
    } else {
      supabaseClient = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options);
              } catch (error) {
                // Ignore cookie setting errors
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 });
              } catch (error) {
                // Ignore cookie removal errors
              }
            }
          }
        }
      );
      
      const { data, error } = await supabaseClient.auth.getUser();
      user = data?.user;
      userError = error;
    }

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', details: userError?.message || 'Auth session missing' },
        { status: 401 }
      );
    }

    // Get doctor data
    const { data: doctorData, error: doctorError } = await supabaseClient
      .from('doctors')
      .select('*')
      .eq('email', user.email)
      .single();

    if (doctorError || !doctorData) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Get NPI and DEA from environment or doctor profile
    // These could be stored in a separate table or as environment variables
    const prescriberNPI = process.env.DOCTOR_NPI || doctorData.npi || '';
    const prescriberDEA = process.env.DOCTOR_DEA || doctorData.dea || '';

    if (!prescriberNPI || !prescriberDEA) {
      console.warn('⚠️ NPI or DEA not found. Using placeholder values.');
    }

    let patientData: any = null;
    let prescriptionData: any = null;
    let appointmentData: any = null;
    let medications: Medication[] = [];

    // Fetch data based on appointmentId or prescriptionId
    if (appointmentId) {
      // Fetch appointment data
      const { data: appointment, error: appointmentError } = await supabaseClient
        .from('appointments')
        .select(`
          *,
          user_id,
          doctor_id,
          preferred_pharmacy,
          prescription_pharmacy,
          pharmacy_address,
          prescription_medication,
          prescription_sig,
          active_medication_orders,
          past_medication_orders,
          patients!appointments_patient_id_fkey(
            id,
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            location,
            preferred_pharmacy
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return NextResponse.json(
          { success: false, error: 'Appointment not found' },
          { status: 404 }
        );
      }

      appointmentData = appointment;

      // Get patient data from patients table if patient_id exists
      if (appointment.patients) {
        patientData = {
          first_name: appointment.patients.first_name || '',
          last_name: appointment.patients.last_name || '',
          email: appointment.patients.email || '',
          mobile_phone: appointment.patients.phone || '',
          date_of_birth: appointment.patients.date_of_birth || '',
          address: appointment.patients.location || '',
        };
      } else if (appointment.user_id) {
        // Fallback to users table if no patient record
        const { data: userData, error: userDataError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', appointment.user_id)
          .single();

        if (!userDataError && userData) {
          patientData = userData;
        }
      }

      // Parse medications from appointment
      // First try active_medication_orders (JSONB array)
      if (appointment.active_medication_orders) {
        try {
          const parsed = Array.isArray(appointment.active_medication_orders) 
            ? appointment.active_medication_orders 
            : JSON.parse(appointment.active_medication_orders || '[]');
          
          medications = parsed.map((m: any) => ({
            drugName: m.medication || m.drugName || m.name || '',
            strength: m.strength || '',
            dosageForm: m.dosageForm || m.form || '',
            quantity: m.quantity || 1,
            directions: m.sig || m.directions || '',
            refills: m.refills || 0,
            daysSupply: m.daysSupply || 30,
          })).filter((m: Medication) => m.drugName);
        } catch (e) {
          console.warn('Failed to parse active_medication_orders:', e);
        }
      }
      
      // Fallback to prescription_medication and prescription_sig fields
      if (medications.length === 0 && appointment.prescription_medication && appointment.prescription_sig) {
        medications = [{
          drugName: appointment.prescription_medication,
          strength: '', // Extract from medication string if possible
          dosageForm: '', // Extract from medication string if possible
          quantity: 1, // Default, should be parsed from sig
          directions: appointment.prescription_sig,
          refills: 0,
          daysSupply: 30, // Default
        }];
      }

      // Get pharmacy info from appointment
      prescriptionData = {
        pharmacyName: appointment.prescription_pharmacy || appointment.preferred_pharmacy || null,
        pharmacyAddress: appointment.pharmacy_address || null,
        pharmacyPhone: null, // Not stored in appointments table
      };
    } else if (prescriptionId) {
      // Fetch prescription data
      const { data: prescription, error: prescriptionError } = await supabaseClient
        .from('prescriptions')
        .select(`
          *,
          patient_id,
          doctor_id,
          appointment_id
        `)
        .eq('id', prescriptionId)
        .single();

      if (prescriptionError || !prescription) {
        return NextResponse.json(
          { success: false, error: 'Prescription not found' },
          { status: 404 }
        );
      }

      prescriptionData = prescription;

      // Get patient data from patients table (patient_id now references patients.id, not users.id)
      if (prescription.patient_id) {
        const { data: patientRecord, error: patientError } = await supabaseClient
          .from('patients')
          .select('*')
          .eq('id', prescription.patient_id)
          .single();

        if (patientError || !patientRecord) {
          console.error('Patient lookup error:', { 
            patient_id: prescription.patient_id, 
            error: patientError 
          });
          return NextResponse.json(
            { success: false, error: 'Patient not found', details: `Patient with ID ${prescription.patient_id} not found in patients table` },
            { status: 404 }
          );
        }

        // Map patient record to patientData format
        patientData = {
          first_name: patientRecord.first_name || '',
          last_name: patientRecord.last_name || '',
          email: patientRecord.email || '',
          mobile_phone: patientRecord.mobile_phone || patientRecord.phone || '',
          date_of_birth: patientRecord.date_of_birth || '',
          address: patientRecord.address || patientRecord.location || '',
        };
      }

      // Parse medication from prescription
      // The prescription table stores medication as text, sig as text, quantity as text
      // Try to parse quantity - it might be stored as text like "30 tablets" or just "30"
      let quantity = 1;
      if (prescription.quantity) {
        const qtyMatch = prescription.quantity.toString().match(/\d+/);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[0]);
        }
      }
      
      medications = [{
        drugName: prescription.medication || '',
        strength: '', // Not stored separately - could be extracted from medication string
        dosageForm: '', // Not stored separately - could be extracted from medication string
        quantity: quantity,
        directions: prescription.sig || '',
        refills: prescription.refills || 0,
        daysSupply: 30, // Default, calculate from quantity if possible
      }];
    }

    // Validate patient data
    if (!patientData || !patientData.first_name || !patientData.last_name) {
      return NextResponse.json(
        { success: false, error: 'Patient data incomplete' },
        { status: 400 }
      );
    }

    // Validate medications
    if (medications.length === 0 || !medications[0].drugName) {
      return NextResponse.json(
        { success: false, error: 'No medications found in prescription' },
        { status: 400 }
      );
    }

    // Parse address if stored as text
    let address = '';
    let city = '';
    let state = '';
    let zipCode = '';

    if (patientData.address) {
      // Try to parse address - format may vary
      const addressParts = patientData.address.split(',');
      if (addressParts.length >= 3) {
        address = addressParts[0].trim();
        city = addressParts[1].trim();
        const stateZip = addressParts[2].trim().split(' ');
        state = stateZip[0] || '';
        zipCode = stateZip.slice(1).join(' ') || '';
      } else {
        address = patientData.address;
      }
    }

    // Determine gender from data or default
    let gender: 'M' | 'F' | 'Other' = 'Other';
    // You might have gender stored elsewhere or infer from other data

    // Compose Prescription object
    const prescription: Prescription = {
      patient: {
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        dateOfBirth: patientData.date_of_birth || '',
        gender: gender,
        address: address || 'Not provided',
        city: city || 'Not provided',
        state: state || 'Not provided',
        zipCode: zipCode || 'Not provided',
        phone: patientData.mobile_phone || '',
        email: patientData.email || undefined,
      },
      medications: medications,
      prescriberId: doctorData.id,
      prescriberName: `${doctorData.first_name} ${doctorData.last_name}`,
      prescriberNPI: prescriberNPI || 'NOT_PROVIDED',
      prescriberDEA: prescriberDEA || 'NOT_PROVIDED',
      pharmacyName: prescriptionData?.pharmacyName || null,
      pharmacyAddress: prescriptionData?.pharmacyAddress || null,
      pharmacyPhone: prescriptionData?.pharmacyPhone || null,
      notes: prescriptionData?.notes || null,
    };

    // Initialize EMRDirect client
    const client = new EMRDirectClient();

    // Send prescription
    const result = await client.sendPrescription(prescription, recipientAddress);

    // Save message to database
    // Update prescription record if prescriptionId was provided
    if (prescriptionId) {
      const updateData: any = {
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
      };

      await supabaseClient
        .from('prescriptions')
        .update(updateData)
        .eq('id', prescriptionId);
    }

    // Log the prescription send attempt
    // You might want to create a prescription_messages table for detailed logging
    const messageLog = {
      patient_first_name: prescription.patient.firstName,
      patient_last_name: prescription.patient.lastName,
      patient_dob: prescription.patient.dateOfBirth || null,
      patient_gender: prescription.patient.gender || null,
      patient_address: prescription.patient.address || null,
      patient_city: prescription.patient.city || null,
      patient_state: prescription.patient.state || null,
      patient_zip: prescription.patient.zipCode || null,
      patient_phone: prescription.patient.phone || null,
      patient_email: prescription.patient.email || null,
      prescriber_id: prescription.prescriberId || null,
      prescriber_name: prescription.prescriberName,
      prescriber_npi: prescription.prescriberNPI || null,
      prescriber_dea: prescription.prescriberDEA || null,
      pharmacy_name: prescription.pharmacyName || null,
      pharmacy_address: prescription.pharmacyAddress || null,
      pharmacy_phone: prescription.pharmacyPhone || null,
      recipient_address: recipientAddress,
      message_subject: `eRx: ${prescription.patient.firstName} ${prescription.patient.lastName}`,
      medications: JSON.stringify(prescription.medications),
      status: result.success ? 'sent' : 'failed',
      success: result.success,
      message_id: result.messageId || null,
      error_message: result.error || null,
      response_details: result.details ? JSON.stringify(result.details) : null,
      sent_at: new Date().toISOString(),
      appointment_id: appointmentId || null,
      prescription_id: prescriptionId || null,
    };

    // Try to insert into a prescription_messages table if it exists
    // If it doesn't exist, we'll just log it
    try {
      const { error: logError } = await supabaseClient
        .from('prescription_messages')
        .insert(messageLog);

      if (logError) {
        console.warn('⚠️ Could not save to prescription_messages table:', logError.message);
        // Continue anyway - the prescription was sent
      }
    } catch (error) {
      console.warn('⚠️ prescription_messages table may not exist:', error);
      // Continue anyway
    }

    if (result.success) {
      return NextResponse.json({
        ...result,
        prescription: prescription,
      }, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('Error in eRx Composer:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

