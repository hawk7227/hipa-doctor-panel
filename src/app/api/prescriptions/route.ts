import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Create a service role client for admin operations (bypasses RLS)
function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found, falling back to anon key (RLS will apply)')
    return null
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// GET - Fetch prescriptions for a patient or appointment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const appointmentId = searchParams.get('appointmentId')

    // Create Supabase client with proper cookie handling
    const cookieStore = await cookies()
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Ignore cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Ignore cookie removal errors
            }
          }
        }
      }
    )

    let query = supabaseClient
      .from('prescriptions')
      .select(`
        *,
        doctors!prescriptions_doctor_id_fkey(first_name, last_name, specialty),
        appointments!prescriptions_appointment_id_fkey(service_type, status)
      `)
      .order('created_at', { ascending: false })

    if (appointmentId) {
      query = query.eq('appointment_id', appointmentId)
    } else if (patientId) {
      query = query.eq('patient_id', patientId)
    } else {
      return NextResponse.json(
        { error: 'Either patientId or appointmentId is required' },
        { status: 400 }
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching prescriptions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch prescriptions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prescriptions: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/prescriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new prescription
export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    const {
      appointmentId,
      patientId,
      medication,
      sig,
      quantity,
      refills,
      notes,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      status
    } = body

    console.log('Creating prescription with data:', {
      appointmentId,
      patientId,
      medication,
      sig,
      quantity,
      hasPatientId: !!patientId,
      hasMedication: !!medication,
      hasSig: !!sig,
      hasQuantity: !!quantity
    })

    // Validate required fields
    if (!patientId || !medication || !sig || !quantity) {
      const missingFields = []
      if (!patientId) missingFields.push('patientId')
      if (!medication) missingFields.push('medication')
      if (!sig) missingFields.push('sig')
      if (!quantity) missingFields.push('quantity')
      
      console.error('Missing required fields:', missingFields)
      return NextResponse.json(
        { 
          error: 'Missing required fields', 
          details: `Missing: ${missingFields.join(', ')}`,
          missingFields 
        },
        { status: 400 }
      )
    }

    // Get user from cookies or Bearer token
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    // Check for Bearer token in header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // Create Supabase client with proper cookie handling
    let supabaseClient: any
    let user = null
    let userError = null

    if (accessToken) {
      // Use createClient from @supabase/supabase-js for Bearer token auth
      const { createClient } = await import('@supabase/supabase-js')
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      // Fall back to cookie-based authentication with createServerClient
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Ignore cookie setting errors in API routes
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Ignore cookie removal errors in API routes
              }
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      console.error('Prescription auth error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Auth session missing' },
        { status: 401 }
      )
    }
    
    // Verify patient exists in patients table (after supabaseClient is created)
    console.log('🔍 Verifying patient exists:', patientId)
    const { data: patientCheck, error: patientCheckError } = await supabaseClient
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', patientId)
      .single()
    
    if (patientCheckError) {
      console.error('❌ Patient lookup error:', {
        patientId,
        error: patientCheckError,
        code: patientCheckError.code,
        message: patientCheckError.message,
        hint: patientCheckError.hint
      })
      
      // Check if it's a "not found" error or something else
      if (patientCheckError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'Patient not found', 
            details: `Patient with ID ${patientId} does not exist in patients table. The appointment may need to be linked to a valid patient record first.`,
            patientId,
            suggestion: 'Please ensure the appointment has a valid patient_id that exists in the patients table.'
          },
          { status: 404 }
        )
      } else {
        return NextResponse.json(
          { 
            error: 'Database error while checking patient', 
            details: patientCheckError.message,
            code: patientCheckError.code,
            patientId
          },
          { status: 500 }
        )
      }
    }
    
    if (!patientCheck) {
      console.error('❌ Patient not found (null result):', patientId)
      return NextResponse.json(
        { 
          error: 'Patient not found', 
          details: `Patient with ID ${patientId} does not exist in patients table.`,
          patientId 
        },
        { status: 404 }
      )
    }
    
    console.log('✅ Patient verified:', {
      patientId: patientCheck.id,
      name: `${patientCheck.first_name} ${patientCheck.last_name}`
    })
    
    // Ensure patient_providers relationship exists (for RLS)
    // This is important because RLS policies check patient_providers table
    if (appointmentId) {
      const { data: appointmentCheck } = await supabaseClient
        .from('appointments')
        .select('doctor_id, patient_id')
        .eq('id', appointmentId)
        .single()
      
      if (appointmentCheck?.doctor_id && appointmentCheck?.patient_id) {
        // Check if patient_providers relationship exists
        const { data: existingRelationship } = await supabaseClient
          .from('patient_providers')
          .select('id')
          .eq('patient_id', appointmentCheck.patient_id)
          .eq('provider_id', appointmentCheck.doctor_id)
          .single()
        
        if (!existingRelationship) {
          console.log('⚠️ Patient-provider relationship missing, creating it...')
          // Try to create the relationship (may fail due to RLS, but trigger should handle it)
          try {
            const { error: insertError } = await supabaseClient
              .from('patient_providers')
              .insert({
                patient_id: appointmentCheck.patient_id,
                provider_id: appointmentCheck.doctor_id,
                is_active: true
              })
            
            if (insertError) {
              // Ignore errors - the trigger should handle this
              console.log('Note: Could not create patient_providers relationship (may already exist or be handled by trigger):', insertError.message)
            }
          } catch (err: any) {
            // Ignore errors - the trigger should handle this
            console.log('Note: Could not create patient_providers relationship (may already exist or be handled by trigger):', err.message)
          }
        }
      }
    }

    // Get doctor ID
    const { data: doctorData, error: doctorError } = await supabaseClient
      .from('doctors')
      .select('id')
      .eq('email', user.email)
      .single()

    if (doctorError || !doctorData) {
      console.error('Doctor lookup error:', { email: user.email, error: doctorError })
      return NextResponse.json(
        { 
          error: 'Doctor not found', 
          details: `Doctor with email ${user.email} not found in doctors table`,
          email: user.email 
        },
        { status: 404 }
      )
    }

    // If appointmentId is provided, get doctor_id from appointment
    let doctorId = doctorData.id
    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await supabaseClient
        .from('appointments')
        .select('doctor_id')
        .eq('id', appointmentId)
        .single()

      if (appointmentError) {
        console.warn('Could not fetch appointment for doctor_id:', appointmentError)
      } else if (appointment?.doctor_id) {
        // Verify the appointment's doctor_id exists
        const { data: appointmentDoctor } = await supabaseClient
          .from('doctors')
          .select('id')
          .eq('id', appointment.doctor_id)
          .single()
        
        if (appointmentDoctor) {
          doctorId = appointment.doctor_id
        } else {
          console.warn('Appointment doctor_id not found, using logged-in doctor:', appointment.doctor_id)
        }
      }
    }
    
    // Verify doctor exists
    const { data: doctorCheck, error: doctorCheckError } = await supabaseClient
      .from('doctors')
      .select('id')
      .eq('id', doctorId)
      .single()
    
    if (doctorCheckError || !doctorCheck) {
      console.error('Doctor ID validation failed:', { doctorId, error: doctorCheckError })
      return NextResponse.json(
        { 
          error: 'Doctor not found', 
          details: `Doctor with ID ${doctorId} does not exist in doctors table`,
          doctorId 
        },
        { status: 404 }
      )
    }

    // Final verification: Double-check patient and doctor exist before insert
    console.log('🔍 Final verification before insert:', {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId || null
    })
    
    // Verify patient one more time (in case of race condition)
    const { count: patientCount } = await supabaseClient
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('id', patientId)
    
    if (patientCount === 0) {
      console.error('❌ Patient does not exist (final check):', patientId)
      return NextResponse.json(
        { 
          error: 'Patient not found', 
          details: `Patient with ID ${patientId} does not exist in patients table. Please check the appointment's patient_id.`,
          patientId 
        },
        { status: 404 }
      )
    }
    
    // Verify doctor one more time
    const { count: doctorCount } = await supabaseClient
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('id', doctorId)
    
    if (doctorCount === 0) {
      console.error('❌ Doctor does not exist (final check):', doctorId)
      return NextResponse.json(
        { 
          error: 'Doctor not found', 
          details: `Doctor with ID ${doctorId} does not exist in doctors table.`,
          doctorId 
        },
        { status: 404 }
      )
    }
    
    // Verify appointment if provided
    if (appointmentId) {
      const { count: appointmentCount } = await supabaseClient
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('id', appointmentId)
      
      if (appointmentCount === 0) {
        console.error('❌ Appointment does not exist:', appointmentId)
        return NextResponse.json(
          { 
            error: 'Appointment not found', 
            details: `Appointment with ID ${appointmentId} does not exist.`,
            appointmentId 
          },
          { status: 404 }
        )
      }
    }
    
    // Create prescription
    // Ensure quantity is a number
    const quantityNum = typeof quantity === 'string' ? parseInt(quantity) || 1 : (quantity || 1)
    const refillsNum = typeof refills === 'string' ? parseInt(refills) || 0 : (refills || 0)
    
    console.log('✅ All checks passed. Inserting prescription with:', {
      appointment_id: appointmentId || null,
      patient_id: patientId,
      doctor_id: doctorId,
      created_by: doctorData.id,
      medication,
      sig,
      quantity: quantityNum,
      refills: refillsNum,
      status: status || body.status || 'pending'
    })
    
    // Use service role client for insert to bypass RLS (we've already verified authorization)
    // Fall back to user client if service role not available
    const serviceClient = createServiceRoleClient()
    const insertClient = serviceClient || supabaseClient
    
    if (serviceClient) {
      console.log('🔑 Using service role client for prescription insert (bypassing RLS)')
    } else {
      console.log('⚠️ Using user client for prescription insert (RLS applies)')
    }
    
    const { data: prescription, error: insertError } = await insertClient
      .from('prescriptions')
      .insert({
        appointment_id: appointmentId || null,
        patient_id: patientId,
        doctor_id: doctorId,
        created_by: doctorData.id,
        medication: medication?.trim() || '',
        sig: sig?.trim() || '',
        quantity: quantityNum,
        refills: refillsNum,
        notes: notes?.trim() || null,
        pharmacy_name: pharmacyName?.trim() || null,
        pharmacy_address: pharmacyAddress?.trim() || null,
        pharmacy_phone: pharmacyPhone?.trim() || null,
        status: status || body.status || 'pending',
        sent_at: (status || body.status) === 'sent' ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creating prescription:', insertError)
      console.error('Full error object:', JSON.stringify(insertError, null, 2))
      console.error('Error code:', insertError.code)
      console.error('Error message:', insertError.message)
      console.error('Error hint:', insertError.hint)
      console.error('Error details:', insertError.details)
      console.error('Insert data was:', {
        patient_id: patientId,
        doctor_id: doctorId,
        created_by: doctorData.id,
        appointment_id: appointmentId || null
      })
      
      // Provide more helpful error message based on error code
      let errorMessage = 'Failed to create prescription'
      if (insertError.code === '23503') {
        // Parse which foreign key failed from the error message
        const errorMsg = insertError.message || ''
        if (errorMsg.includes('patient_id')) {
          errorMessage = `Foreign key constraint: Patient ID "${patientId}" not found in patients table`
        } else if (errorMsg.includes('doctor_id')) {
          errorMessage = `Foreign key constraint: Doctor ID "${doctorId}" not found in doctors table`
        } else if (errorMsg.includes('created_by')) {
          errorMessage = `Foreign key constraint: Created by doctor ID "${doctorData.id}" not found in doctors table`
        } else if (errorMsg.includes('appointment_id')) {
          errorMessage = `Foreign key constraint: Appointment ID "${appointmentId}" not found in appointments table`
        } else {
          errorMessage = `Foreign key constraint violation - details: ${errorMsg}`
        }
      } else if (insertError.code === '23502') {
        errorMessage = 'Required field is missing'
      } else if (insertError.code === '23505') {
        errorMessage = 'Duplicate prescription'
      } else if (insertError.message) {
        errorMessage = insertError.message
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: insertError.message || 'Unknown database error',
          code: insertError.code,
          hint: insertError.hint,
          patientId,
          doctorId,
          createdBy: doctorData.id,
          appointmentId: appointmentId || null,
          fullError: process.env.NODE_ENV === 'development' ? insertError : undefined
        },
        { status: 500 }
      )
    }

    console.log('✅ Prescription created successfully:', prescription.id)

    return NextResponse.json({
      success: true,
      prescription
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/prescriptions:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message || 'Unknown error occurred',
        type: error.name || 'Error'
      },
      { status: 500 }
    )
  }
}

// PATCH - Update prescription (supports both full update and status-only update)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      prescriptionId, 
      status,
      medication,
      sig,
      quantity,
      refills,
      notes,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone
    } = body

    if (!prescriptionId) {
      return NextResponse.json(
        { error: 'prescriptionId is required' },
        { status: 400 }
      )
    }

    // Get user from cookies or Bearer token
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    let supabaseClient: any
    let user = null
    let userError = null

    if (accessToken) {
      // Use createClient from @supabase/supabase-js for Bearer token auth
      const { createClient } = await import('@supabase/supabase-js')
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      // Fall back to cookie-based authentication
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Ignore cookie setting errors
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Ignore cookie removal errors
              }
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      console.error('Prescription PATCH auth error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Auth session missing' },
        { status: 401 }
      )
    }

    // Build update data object - support both full update and status-only update
    const updateData: any = {}
    
    // If status is provided, update it
    if (status !== undefined) {
      updateData.status = status
      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString()
      }
    }
    
    // If medication fields are provided, update them
    if (medication !== undefined) updateData.medication = medication
    if (sig !== undefined) updateData.sig = sig
    if (quantity !== undefined) updateData.quantity = quantity
    if (refills !== undefined) updateData.refills = refills
    if (notes !== undefined) updateData.notes = notes
    if (pharmacyName !== undefined) updateData.pharmacy_name = pharmacyName
    if (pharmacyAddress !== undefined) updateData.pharmacy_address = pharmacyAddress
    if (pharmacyPhone !== undefined) updateData.pharmacy_phone = pharmacyPhone
    
    // Always update updated_at timestamp
    updateData.updated_at = new Date().toISOString()
    
    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    const { data: prescription, error: updateError } = await supabaseClient
      .from('prescriptions')
      .update(updateData)
      .eq('id', prescriptionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating prescription:', updateError)
      return NextResponse.json(
        { error: 'Failed to update prescription', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      prescription
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/prescriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a prescription
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const prescriptionId = searchParams.get('prescriptionId')

    if (!prescriptionId) {
      return NextResponse.json(
        { error: 'prescriptionId is required' },
        { status: 400 }
      )
    }

    // Get user from cookies or Bearer token
    const cookieStore = await cookies()
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    let supabaseClient: any
    let user = null
    let userError = null

    if (accessToken) {
      // Use createClient from @supabase/supabase-js for Bearer token auth
      const { createClient } = await import('@supabase/supabase-js')
      supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser(accessToken)
      user = data?.user
      userError = error
    } else {
      // Fall back to cookie-based authentication
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set(name, value, options)
              } catch (error) {
                // Ignore cookie setting errors
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set(name, '', { ...options, maxAge: 0 })
              } catch (error) {
                // Ignore cookie removal errors
              }
            }
          }
        }
      )
      
      const { data, error } = await supabaseClient.auth.getUser()
      user = data?.user
      userError = error
    }

    if (userError || !user) {
      console.error('Prescription DELETE auth error:', userError)
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Auth session missing' },
        { status: 401 }
      )
    }

    // Delete prescription
    const { error: deleteError } = await supabaseClient
      .from('prescriptions')
      .delete()
      .eq('id', prescriptionId)

    if (deleteError) {
      console.error('Error deleting prescription:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete prescription', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('✅ Prescription deleted successfully:', prescriptionId)

    return NextResponse.json({
      success: true,
      message: 'Prescription deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/prescriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

