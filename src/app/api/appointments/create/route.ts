// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
import { PROVIDER_TIMEZONE } from '@/lib/constants'
import { NextRequest, NextResponse } from "next/server";
import { requireDoctor } from '@/lib/api-auth'
import { supabase } from "@/lib/supabase";
import { zoomService } from "@/lib/zoom";
import { sendAdminNotification } from "@/lib/email";
import { dailyService } from "@/lib/daily";

export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  console.log("📋 Create appointment API called");

  try {
   
 const body = await req.json();
    console.log("📤 Request body:", body);

    const {
      doctorId,
      requestedDateTime, // Legacy support
      year,
      month,
      day,
      hours,
      minutes,
      visitType,
      patientFirstName,
      patientLastName,
      patientEmail,
      patientPhone,
      patientDob,
      patientLocation,
      serviceType,
      notes,
      preferredPharmacy,
      allergies,
      userId, // Allow user_id to be passed directly if available
    } = body;

    if (!doctorId || !visitType) {
      console.error("❌ Missing required fields:", { doctorId, visitType });
      return NextResponse.json(
        { error: "Doctor ID and visit type are required" },
        { status: 400 },
      );
    }

    console.log("📋 Creating appointment with doctorId:", doctorId);

    // Validate date/time components
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hours === undefined ||
      minutes === undefined
    ) {
      if (!requestedDateTime) {
        return NextResponse.json(
          { error: "Date/time information is required" },
          { status: 400 },
        );
      }
    }

    if (!patientFirstName || !patientLastName) {
      return NextResponse.json(
        { error: "Patient first name and last name are required" },
        { status: 400 },
      );
    }

    // Get doctor details including timezone
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("first_name, last_name, timezone")
      .eq("id", doctorId)
      .single();

    if (doctorError || !doctor) {
      console.error("❌ Doctor not found:", doctorError);
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    // CRITICAL: Provider timezone is ALWAYS America/Phoenix per industry standard requirements
    // This must match the calendar's hardcoded timezone
    const doctorTimezone = PROVIDER_TIMEZONE;

    // Try to find user_id from patient email if provided (or use passed userId)
    let finalUserId: string | null = userId || null;
    if (!finalUserId && patientEmail) {
      console.log("🔍 Looking up user by email:", patientEmail);
      try {
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("email", patientEmail)
          .maybeSingle();

        if (!userError && user) {
          finalUserId = user.id;
          console.log("✅ Found user_id:", finalUserId);
        } else {
          console.log(
            "ℹ️ No user found with email:",
            patientEmail,
            "- appointment will be created without user_id",
          );
        }
      } catch (userLookupError) {
        console.warn("⚠️ Error looking up user by email:", userLookupError);
        // Continue without user_id - appointments can exist without user accounts
      }
    } else if (finalUserId) {
      console.log("✅ Using provided user_id:", finalUserId);
    } else {
      console.log(
        "ℹ️ No patient email or user_id provided - appointment will be created without user_id",
      );
    }

    // Find or create patient record
    let patientId: string | null = null;
    if (patientEmail || patientPhone) {
      console.log("🔍 Looking up or creating patient...");
      try {
        // Try to find existing patient by email or phone
        const { data: existingPatient, error: patientError } = await supabase
          .from("patients")
          .select("id")
          .or(`email.eq.${patientEmail || ""},phone.eq.${patientPhone || ""}`)
          .maybeSingle();

        if (!patientError && existingPatient) {
          patientId = existingPatient.id;
          console.log("✅ Found existing patient:", patientId);

          // Update patient information if provided
          await supabase
            .from("patients")
            .update({
              first_name: patientFirstName,
              last_name: patientLastName,
              email: patientEmail || undefined,
              phone: patientPhone || undefined,
              date_of_birth: patientDob || undefined,
              location: patientLocation || undefined,
              preferred_pharmacy: preferredPharmacy || undefined,
              allergies: allergies || undefined,
              user_id: finalUserId || undefined,
            })
            .eq("id", patientId);
        } else {
          // Create new patient
          const { data: newPatient, error: createError } = await supabase
            .from("patients")
            .insert([
              {
                user_id: finalUserId,
                first_name: patientFirstName,
                last_name: patientLastName,
                email: patientEmail || null,
                phone: patientPhone || null,
                date_of_birth: patientDob || null,
                location: patientLocation || null,
                preferred_pharmacy: preferredPharmacy || null,
                allergies: allergies || null,
              },
            ])
            .select("id")
            .single();

          if (!createError && newPatient) {
            patientId = newPatient.id;
            console.log("✅ Created new patient:", patientId);
          } else {
            console.warn("⚠️ Error creating patient:", createError);
          }
        }
      } catch (patientLookupError) {
        console.warn(
          "⚠️ Error looking up/creating patient:",
          patientLookupError,
        );
        // Continue without patient_id - appointment can be created without patient record
      }
    }

    // Construct the date/time in the doctor's timezone
    let requestedDateTimeISO: string;
    if (
      year !== undefined &&
      month !== undefined &&
      day !== undefined &&
      hours !== undefined &&
      minutes !== undefined
    ) {
      // Use a helper function to convert local time to UTC in doctor's timezone
      // We'll find the UTC time that, when displayed in doctor's timezone, shows our selected time

      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: doctorTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Calculate timezone offset for the specific date
      // Use a known UTC time and see what it represents in doctor's timezone
      const testUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Noon UTC on the target date
      const testParts = formatter.formatToParts(testUTC);
      const getTestValue = (type: string) =>
        testParts.find((part) => part.type === type)?.value || "0";
      const testHour = parseInt(getTestValue("hour"));

      // Calculate offset: if 12:00 UTC shows as testHour in doctor's timezone
      // Example: UTC-5 means 12:00 UTC = 7:00 AM local, so offset = 12 - 7 = 5
      // To convert local time to UTC: UTC = local + offset
      // So if we want 5:00 AM local in UTC-5, we need 5 + 5 = 10:00 UTC
      const tzOffsetHours = 12 - testHour;

      // Create UTC date: add the offset to local time to get UTC
      const finalUTC = new Date(
        Date.UTC(year, month - 1, day, hours + tzOffsetHours, minutes, 0),
      );

      // Verify it's correct
      const verifyParts = formatter.formatToParts(finalUTC);
      const getVerifyValue = (type: string) =>
        verifyParts.find((part) => part.type === type)?.value || "0";
      const verifyDay = parseInt(getVerifyValue("day"));
      const verifyHour = parseInt(getVerifyValue("hour"));
      const verifyMinute = parseInt(getVerifyValue("minute"));

      // If not exact match, fine-tune
      if (
        verifyDay !== day ||
        verifyHour !== hours ||
        verifyMinute !== minutes
      ) {
        const dayDiff = day - verifyDay;
        const hourDiff = hours - verifyHour;
        const minuteDiff = minutes - verifyMinute;

        finalUTC.setUTCDate(finalUTC.getUTCDate() + dayDiff);
        finalUTC.setUTCHours(finalUTC.getUTCHours() + hourDiff);
        finalUTC.setUTCMinutes(finalUTC.getUTCMinutes() + minuteDiff);
      }

      requestedDateTimeISO = finalUTC.toISOString();

      console.log("📅 Date conversion:", {
        input: { year, month, day, hours, minutes },
        output: requestedDateTimeISO,
        verify: { day: verifyDay, hour: verifyHour, minute: verifyMinute },
        doctorTimezone,
      });
    } else {
      requestedDateTimeISO = requestedDateTime;
    }

    // Create Zoom meeting if visit type is video
    // let zoomMeeting = null
    // if (visitType === 'video') {
    //   console.log('📹 Creating Zoom meeting for video appointment...')
    //   try {
    //     if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET || !process.env.ZOOM_ACCOUNT_ID) {
    //       console.warn('⚠️ Zoom API credentials not configured. Skipping meeting creation.')
    //     } else {
    //       const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name}`

    //       const meetingParams = {
    //         topic: `Appointment with ${doctorName}`,
    //         start_time: requestedDateTimeISO,
    //         duration: 30,
    //         timezone: doctorTimezone,
    //         waiting_room: true
    //       }

    //       console.log('📋 Zoom meeting parameters:', meetingParams)
    //       zoomMeeting = await zoomService.createMeeting(meetingParams)
    //       console.log('✅ Zoom meeting created successfully:', zoomMeeting?.id)
    //     }
    //   } catch (zoomError) {
    //     console.error('❌ Zoom meeting creation failed:', zoomError)
    //     // Continue without Zoom meeting
    //   }
    // }

    // Create video meeting if visit type is video
    let zoomMeeting = null;
    let dailyMeeting = null;

    if (visitType === "video") {
      // Create Daily.co meeting
      console.log("📹 Creating Daily.co meeting for video appointment...");
      try {
        if (!process.env.DAILY_API_KEY) {
          console.warn(
            "⚠️ Daily.co API key not configured. Skipping Daily.co meeting creation.",
          );
        } else {
            const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name}`
    
            const dailyMeetingParams = {
              privacy: 'private' as const,
              properties: {
                enable_screenshare: true,
                enable_chat: true,
                enable_knocking: true,
                enable_prejoin_ui: true,
                start_audio_off: false,
                start_video_off: false,
                enable_recording: 'cloud', // Enable cloud recording
              }
            }
            
            console.log('📋 Daily.co meeting parameters:', dailyMeetingParams)
            dailyMeeting = await dailyService.createRoom(dailyMeetingParams)
            console.log('✅ Daily.co meeting created successfully:', dailyMeeting?.url)
            
            // Create owner token for doctor (host with recording permissions)
            const ownerToken = await dailyService.createMeetingToken({
              properties: {
                room_name: dailyMeeting.name,
                is_owner: true,
                user_name: doctorName,
                start_cloud_recording: false // Doctor can manually start recording
              }
            })
            
            console.log('✅ Daily.co owner token created for doctor')
            
            // Store the owner token for the doctor
            dailyMeeting.owner_token = ownerToken.token
          }
      } catch (dailyError) {
        console.error("❌ Daily.co meeting creation failed:", dailyError);
        // Continue without Daily.co meeting
      }

      // Also create Zoom meeting (if you want to keep both options)
      // console.log("📹 Creating Zoom meeting for video appointment...");
      // try {
      //   if (
      //     !process.env.ZOOM_API_KEY ||
      //     !process.env.ZOOM_API_SECRET ||
      //     !process.env.ZOOM_ACCOUNT_ID
      //   ) {
      //     console.warn(
      //       "⚠️ Zoom API credentials not configured. Skipping meeting creation.",
      //     );
      //   } else {
      //     const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name}`;

      //     const meetingParams = {
      //       topic: `Appointment with ${doctorName}`,
      //       start_time: requestedDateTimeISO,
      //       duration: 30,
      //       timezone: doctorTimezone,
      //       waiting_room: true,
      //     };

      //     console.log("📋 Zoom meeting parameters:", meetingParams);
      //     zoomMeeting = await zoomService.createMeeting(meetingParams);
      //     console.log("✅ Zoom meeting created successfully:", zoomMeeting?.id);
      //   }
      // } catch (zoomError) {
      //   console.error("❌ Zoom meeting creation failed:", zoomError);
      //   // Continue without Zoom meeting
      // }
    }

    // Create appointment with auto-approved status
    // CRITICAL: Ensure doctor_id is always set - appointments without doctor_id won't appear on calendar
    if (!doctorId) {
      console.error(
        "❌ ERROR: doctorId is null or undefined! Cannot create appointment without doctor_id.",
      );
      return NextResponse.json(
        { error: "Doctor ID is required to create appointment" },
        { status: 400 },
      );
    }

    const appointmentData: any = {
      doctor_id: doctorId, // CRITICAL: Must always be set for calendar to display appointment
      patient_id: patientId, // Link to patient record
      user_id: finalUserId, // Add user_id if found or provided
      requested_date_time: requestedDateTimeISO,
      visit_type: visitType,
      service_type: serviceType || "consultation",
      status: "accepted", // Auto-approve
      preferred_pharmacy: preferredPharmacy || null,
      allergies: allergies || null,
      notes: notes || null,
      provider_accepted_at: new Date().toISOString(),
      // Note: created_at and updated_at are typically auto-generated by the database
      // Only include them if your database schema doesn't have defaults
    };

    console.log("📋 Appointment data to be created:", {
      doctor_id: appointmentData.doctor_id,
      user_id: appointmentData.user_id || "null",
      has_patient_email: !!appointmentData.patient_email,
      has_patient_phone: !!appointmentData.patient_phone,
      visit_type: appointmentData.visit_type,
      service_type: appointmentData.service_type,
      status: appointmentData.status,
    });

    // Add Daily.co meeting details if created
    if (dailyMeeting) {
      appointmentData.dailyco_meeting_url = dailyMeeting.url
      appointmentData.dailyco_room_name = dailyMeeting.name // Store room name
      appointmentData.dailyco_owner_token = dailyMeeting.owner_token // Store doctor's host token
    }

    // Add Zoom meeting details if created
    // if (zoomMeeting) {
    //   appointmentData.zoom_meeting_url = zoomMeeting.join_url;
    //   appointmentData.zoom_start_url = zoomMeeting.start_url;
    //   appointmentData.zoom_meeting_id = zoomMeeting.id.toString();
    //   appointmentData.zoom_meeting_password = zoomMeeting.password;
    // }

    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert([appointmentData])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error creating appointment:", insertError);
      return NextResponse.json(
        { error: `Failed to create appointment: ${insertError.message}` },
        { status: 500 },
      );
    }

    console.log("✅ Appointment created successfully:", appointment.id);

    // Send admin notification about new appointment
    try {
      const appointmentDate = requestedDateTimeISO
        ? new Date(requestedDateTimeISO).toLocaleString()
        : "Date to be confirmed";
      await sendAdminNotification(
        "New Appointment Created",
        `A new appointment has been created in the system.`,
        {
          "Appointment ID": appointment.id,
          Doctor: `${doctor.first_name} ${doctor.last_name}`,
          Patient: `${patientFirstName} ${patientLastName}`,
          "Patient Email": patientEmail || "Not provided",
          "Date & Time": appointmentDate,
          "Visit Type": visitType,
          "Service Type": serviceType || "consultation",
          Status: "accepted",
        },
      );
    } catch (notificationError) {
      console.warn(
        "⚠️ Failed to send admin notification for appointment:",
        notificationError,
      );
      // Don't fail the appointment creation if notification fails
    }

    return NextResponse.json(
      {
        success: true,
        appointment,
        dailyMeeting: dailyMeeting
          ? {
              name: dailyMeeting.name,
              url: dailyMeeting.url,
              owner_token: dailyMeeting.owner_token,
            }
          : null,
        zoomMeeting: zoomMeeting
          ? zoomMeeting
          : null,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("❌ Error in create appointment API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
