import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createZoomMeeting } from "@/lib/zoom";
import { sendSMS } from "@/lib/clicksend";
import { sendEmail, generateAppointmentEmailHTML, generateDoctorAppointmentEmailHTML } from "@/lib/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

export async function POST(request: Request) {
  try {
    const { payment_intent_id, appointmentData } = await request.json();

    if (!payment_intent_id) {
      return NextResponse.json(
        { error: "Payment intent ID is required" },
        { status: 400 }
      );
    }

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not successful", status: paymentIntent.status },
        { status: 400 }
      );
    }

    // Check if appointment already exists for this payment intent
    const supabase = createServerClient();
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id")
      .eq("payment_intent_id", payment_intent_id)
      .single();

    if (existingAppointment) {
      // Get the access token from existing appointment
      const { data: existingAppointmentWithToken } = await supabase
        .from("appointments")
        .select("id, access_token")
        .eq("id", existingAppointment.id)
        .single();

      return NextResponse.json({
        success: true,
        appointmentId: existingAppointment.id,
        accessToken: existingAppointmentWithToken?.access_token || null,
        message: "Appointment already created",
      });
    }

    // Parse appointment data
    const data = appointmentData || {};
    console.log("DATA IN create-appointment:", {data});
    // Validate patient ID
    if (!data.patientId) {
      return NextResponse.json(
        { error: "Patient ID is required" },
        { status: 400 }
      );
    }

    // Get patient data from patients table
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("id, user_id, first_name, last_name, email, phone, date_of_birth, location, timezone")
      .eq("id", data.patientId)
      .single();

    if (patientError || !patientData) {
      console.error("Error fetching patient:", patientError);
      return NextResponse.json(
        { error: "Patient not found", details: patientError?.message },
        { status: 404 }
      );
    }

    // Use patient data from database, fallback to form data if not available
    const patientFirstName = patientData.first_name || data.firstName || null;
    const patientLastName = patientData.last_name || data.lastName || null;
    const patientEmail = patientData.email || data.email || null;
    const patientPhone = patientData.phone || data.phone || null;
    const patientDob = patientData.date_of_birth || data.dateOfBirth || null;
    const patientLocation = patientData.location || data.streetAddress || null;
    const patientTimezone = patientData.timezone || data.patientTimezone || 'America/New_York';

    // Doctor ID (hardcoded as specified)
    const DOCTOR_ID = "1fd1af57-5529-4d00-a301-e653b4829efc";
    
    // Verify doctor exists, create if doesn't exist, and get full doctor info
    const { data: existingDoctor } = await supabase
      .from("doctors")
      .select("id, email, phone, first_name, last_name")
      .eq("id", DOCTOR_ID)
      .single();

    let doctorEmail = "doctor@medazonhealth.com";
    let doctorPhone = null;
    let doctorName = "Doctor";

    if (!existingDoctor) {
  

      
        return NextResponse.json(
          { error: "Failed to verify doctor"},
          { status: 500 }
        );
      
    } else {
      // Use existing doctor info
      doctorEmail = existingDoctor.email || "doctor@medazonhealth.com";
      doctorPhone = existingDoctor.phone;
      if (existingDoctor.first_name && existingDoctor.last_name) {
        doctorName = `${existingDoctor.first_name} ${existingDoctor.last_name}`;
      }
    }
    
    // Combine date and time for requested_date_time
    // Fix timezone: treat user input as time in America/New_York (EST/EDT) timezone
    let requestedDateTime = null;
    if (data.appointmentDate && data.appointmentTime) {
      // Parse date and time components
      const [year, month, day] = data.appointmentDate.split('-').map(Number);
      const [hours, minutes] = data.appointmentTime.split(':').map(Number);
      
      // Assume user input is in America/New_York timezone (EST = UTC-5, EDT = UTC-4)
      // For simplicity, we'll use EST (UTC-5) - this can be improved to detect DST
      // If user enters 5:00 AM EST, that's 10:00 AM UTC
      // So we create a UTC date with hours + 5
      const estOffsetHours = 5; // EST is UTC-5, so we add 5 hours to convert EST to UTC
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours + estOffsetHours, minutes, 0, 0));
      
      requestedDateTime = utcDate.toISOString();
    }

    // Map visit type
    const visitType = data.visitType?.toLowerCase() === "video" ? "video" : 
                      data.visitType?.toLowerCase() === "phone" ? "phone" : 
                      "async";

    // Generate access token for the appointment (64-character random token)
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    const accessToken = generateToken();

    // Prepare appointment data with all required fields
    const appointmentInsert: Record<string, unknown> = {
      // Patient and Doctor references
      user_id: patientData.user_id || data.patientId, // Use user_id from patients table
      patient_id: patientData.id, // Set patient_id from patients table
      doctor_id: DOCTOR_ID,
      
      // Payment information
      payment_intent_id: payment_intent_id,
      payment_status: "captured",
      
      // Appointment status
      status: "accepted",
      
      // Visit details
      visit_type: visitType,
      requested_date_time: requestedDateTime,
      service_type: "uti_treatment",
      
      // Patient information (use data from patients table)
      patient_first_name: patientFirstName,
      patient_last_name: patientLastName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      patient_dob: patientDob,
      patient_location: patientLocation,
      patient_timezone: patientTimezone,
      
      // Medical history
      chief_complaint: `${data.symptoms} / ${data.chief_complaint}` || null,
      has_drug_allergies: data.allergies === true,
      allergies: data.allergiesDetails || null,
      has_recent_surgeries: data.surgeries === true,
      recent_surgeries_details: data.surgeriesDetails || null,
      has_ongoing_medical_issues: data.medicalIssues === true,
      ongoing_medical_issues_details: data.medicalIssuesDetails || null,
      
      // Pharmacy
      preferred_pharmacy: data.pharmacy || null,
      pharmacy_address: data.pharmacyAddress || null,
      
      // Consent (will be set during consent flow)
      consent_accepted: false,
      
      // Access token
      access_token: accessToken,
    };

    // Insert appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert(appointmentInsert)
      .select()
      .single();

    if (error) {
      // If error is due to status constraint violation, provide helpful message
      if (error.code === '23514' && error.message?.includes('status_check')) {
        console.error("Status constraint error:", error);
        return NextResponse.json(
          { 
            error: "Database constraint error: 'approved' status not allowed",
            details: "The appointments_status_check constraint does not include 'approved' as a valid status.",
            solution: "Run the SQL migration in supabase-migrations/fix-appointments-status-constraint.sql in your Supabase SQL Editor to update the constraint."
          },
          { status: 500 }
        );
      }
      
      console.error("Error creating appointment:", error);
      return NextResponse.json(
        { error: "Failed to create appointment", details: error.message },
        { status: 500 }
      );
    }

    // Create Zoom meeting for video appointments
    let zoomMeetingUrl = null;
    let zoomStartUrl = null;
    if (visitType === "video" && requestedDateTime) {
      try {
        const patientName = patientFirstName && patientLastName 
          ? `${patientFirstName} ${patientLastName}` 
          : undefined;

        const zoomMeeting = await createZoomMeeting({
          topic: `Medical Consultation - ${patientName || "Patient"}`,
          startTime: requestedDateTime,
          duration: 30, // 30 minutes default
          timezone: patientTimezone,
          patientEmail: patientEmail || undefined,
          patientName: patientName,
        });

        zoomMeetingUrl = zoomMeeting.join_url;
        zoomStartUrl = zoomMeeting.start_url;
        
        // Log meeting details for admin panel access
        console.log("Zoom Meeting Created:", {
          meetingId: zoomMeeting.id,
          joinUrl: zoomMeeting.join_url,
          startUrl: zoomMeeting.start_url,
          password: zoomMeeting.password,
        });

        // Update appointment with Zoom meeting URLs (join URL and start URL)
        const { error: updateError } = await supabase
          .from("appointments")
          .update({ 
            zoom_meeting_url: zoomMeetingUrl,
            zoom_start_url: zoomStartUrl
          })
          .eq("id", appointment.id);

        if (updateError) {
          console.error("Error updating appointment with Zoom URL:", updateError);
          // Don't fail the request, appointment is already created
        } else {
          // Update the appointment object in the response
          appointment.zoom_meeting_url = zoomMeetingUrl;
        }
      } catch (zoomError) {
        console.error("Error creating Zoom meeting:", zoomError);
        // Don't fail the request if Zoom fails, appointment is already created
        // The meeting can be created manually later if needed
      }
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from("payment_records")
      .insert({
        appointment_id: appointment.id,
        payment_intent_id: payment_intent_id,
        stripe_payment_intent_id: payment_intent_id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: "captured",
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      // Don't fail the request, appointment is already created
    }

    // Send email and SMS notifications with appointment link
    // Get base URL from environment or request headers
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      if (process.env.NEXT_PUBLIC_VERCEL_URL) {
        baseUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
      } else {
        const headers = request.headers;
        const host = headers.get('host');
        const protocol = headers.get('x-forwarded-proto') || 'https';
        baseUrl = host ? `${protocol}://${host}` : 'https://medazonhealth.com';
      }
    }
    
    const appointmentLink = `${baseUrl}/appointment/${accessToken}`;
    const doctorPanelLink = "https://hipa-doctor-panel.vercel.app/doctor/appointments";
    
    // Format date and time for display (matching screenshot format)
    let formattedDate = "Not scheduled";
    let formattedTime = "";
    let formattedDateForSMS = "";
    if (requestedDateTime) {
      const appointmentDate = new Date(requestedDateTime);
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: data.patientTimezone || "America/New_York",
      };
      formattedDate = appointmentDate.toLocaleDateString("en-US", options);
      
      // Format for SMS (e.g., "Wednesday, November 19th")
      // Get date components in the patient's timezone
      const timeZone = data.patientTimezone || "America/New_York";
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const parts = formatter.formatToParts(appointmentDate);
      const weekday = parts.find(p => p.type === "weekday")?.value || "";
      const month = parts.find(p => p.type === "month")?.value || "";
      const day = parseInt(parts.find(p => p.type === "day")?.value || "0");
      const daySuffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                       day === 2 || day === 22 ? 'nd' : 
                       day === 3 || day === 23 ? 'rd' : 'th';
      formattedDateForSMS = `${weekday}, ${month} ${day}${daySuffix}`;
      
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: data.patientTimezone || "America/New_York",
      };
      formattedTime = appointmentDate.toLocaleTimeString("en-US", timeOptions);
    }

    const patientName = patientFirstName && patientLastName 
      ? `${patientFirstName} ${patientLastName}` 
      : "Patient";
    
    const visitTypeDisplay = visitType === "video" ? "Video Visit" : 
                            visitType === "phone" ? "Phone Visit" : 
                            "Consultation";

    // Generate SMS message for patient (used in both SMS and email)
    let patientSMSMessage = "";
    if (data.phone || data.email) {
      // Format SMS message similar to screenshot
      if (formattedDateForSMS && formattedTime) {
        patientSMSMessage = `You have a ${visitTypeDisplay} appointment with ${doctorName} on ${formattedDateForSMS} at ${formattedTime.replace(' AM', 'am').replace(' PM', 'pm')} AZ Time.`;
        if (appointmentLink) {
          patientSMSMessage += `\n\nYour appointment link is: ${appointmentLink}`;
        }
      } else {
        // Fallback to template-based message
        patientSMSMessage = generateSMSMessage({
          patientName: patientFirstName || 'there',
          fullName: patientName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          visitType: visitType,
          visitTypeDisplay: visitTypeDisplay,
          appointmentLink: appointmentLink,
          zoomMeetingUrl: null, // Don't include zoom link for patients
        });
      }
    }

    // Send email notification to patient
    if (patientEmail) {
      try {
        const emailHTML = generateAppointmentEmailHTML({
          doctorName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          visitType,
          appointmentLink,
          smsMessage: patientSMSMessage,
        });

        const emailResult = await sendEmail({
          to: patientEmail,
          subject: `Your telemedicine appointment with ${doctorName}`,
          html: emailHTML,
        });

        if (emailResult.success) {
          console.log("Appointment confirmation email sent to patient successfully");
        } else {
          console.error("Failed to send email to patient:", emailResult.error);
        }
      } catch (emailError) {
        console.error("Error sending appointment confirmation email to patient:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Send SMS notification to patient
    if (patientPhone) {
      try {
        const smsResult = await sendSMS({
          to: patientPhone,
          message: patientSMSMessage,
        });

        if (smsResult.success) {
          console.log("Appointment confirmation SMS sent to patient successfully");
        } else {
          console.error("Failed to send SMS to patient:", smsResult.error);
        }
      } catch (smsError) {
        console.error("Error sending appointment confirmation SMS to patient:", smsError);
        // Don't fail the request if SMS fails
      }
    }

    // Send email notification to doctor
    if (doctorEmail) {
      try {
        const doctorEmailHTML = generateDoctorAppointmentEmailHTML({
          patientName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          visitType,
          doctorPanelLink,
          zoomStartUrl,
          patientEmail: patientEmail || null,
          patientPhone: patientPhone || null,
        });

        const doctorEmailResult = await sendEmail({
          to: doctorEmail,
          subject: `New Appointment Scheduled - ${patientName} - ${formattedDate}`,
          html: doctorEmailHTML,
        });

        if (doctorEmailResult.success) {
          console.log("Appointment notification email sent to doctor successfully");
        } else {
          console.error("Failed to send email to doctor:", doctorEmailResult.error);
        }
      } catch (doctorEmailError) {
        console.error("Error sending appointment notification email to doctor:", doctorEmailError);
        // Don't fail the request if email fails
      }
    }

    // Send SMS notification to doctor
    if (doctorPhone) {
      try {
        let doctorSMSMessage = `New appointment scheduled: ${patientName} on ${formattedDate} at ${formattedTime}. ${visitTypeDisplay}. View: ${doctorPanelLink}`;
        if (zoomStartUrl) {
          doctorSMSMessage += `\n\n⚠️ WARNING: START meeting link (host only, do NOT share with patients) and this will start meeting instantly: ${zoomStartUrl}`;
        }
        
        
        const doctorSMSResult = await sendSMS({
          to: doctorPhone,
          message: doctorSMSMessage,
        });

        if (doctorSMSResult.success) {
          console.log("Appointment notification SMS sent to doctor successfully");
        } else {
          console.error("Failed to send SMS to doctor:", doctorSMSResult.error);
        }
      } catch (doctorSMSError) {
        console.error("Error sending appointment notification SMS to doctor:", doctorSMSError);
        // Don't fail the request if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      accessToken: appointment.access_token,
      appointment: appointment,
    });
  } catch (error: unknown) {
    console.error("Error in create-appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

