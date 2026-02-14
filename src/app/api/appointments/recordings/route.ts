import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { dailyService } from "@/lib/daily";

import { requireAuth } from '@/lib/api-auth'
export async function GET(req: NextRequest) {
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  console.log("📹 STEP 1: Get appointment recordings API called (Daily.co)");
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );

  try {
   
  const auth = await requireAuth(req)
  if ('error' in auth && auth.error) return auth.error
  const request = req
 const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointmentId");

    console.log("📋 STEP 2: Parsing request parameters");
    console.log("   └─ Appointment ID:", appointmentId);

    if (!appointmentId) {
      console.error("❌ STEP 2 FAILED: Missing appointment ID");
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 },
      );
    }

    console.log("✅ STEP 2 COMPLETE: Request parameters parsed successfully");

    console.log("📋 STEP 3: Fetching appointment from database");

    // Get appointment details - check for Daily.co room info
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, dailyco_room_name, recording_url")
      .eq("id", appointmentId)
      .single();

    if (appointmentError) {
      console.error("❌ STEP 3 FAILED: Database error fetching appointment");
      console.error("   └─ Error:", appointmentError.message);
      return NextResponse.json(
        { error: `Database error: ${appointmentError.message}` },
        { status: 500 },
      );
    }

    if (!appointment) {
      console.error("❌ STEP 3 FAILED: Appointment not found");
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    console.log("✅ STEP 3 COMPLETE: Appointment found in database");
    console.log(
      "   └─ Daily.co Room Name:",
      appointment.dailyco_room_name || "NONE",
    );
    console.log("   └─ Has cached recording_url:", !!appointment.recording_url);

    console.log("📋 STEP 4: Checking if recording already cached");
    if (appointment.recording_url) {
      console.log(
        "✅ STEP 4 COMPLETE: Recording already exists in database (cached)",
      );
      return NextResponse.json({
        success: true,
        recordingUrl: appointment.recording_url,
        cached: true,
      });
    }
    console.log("   └─ No cached recording, proceeding to fetch from Daily.co");

    console.log("📋 STEP 5: Validating Daily.co room name");
    if (!appointment.dailyco_room_name) {
      console.log("⚠️ STEP 5 FAILED: No Daily.co room found");
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message: "No Daily.co meeting found for this appointment",
      });
    }
    console.log(
      "✅ STEP 5 COMPLETE: Room name validated:",
      appointment.dailyco_room_name,
    );

    console.log("📋 STEP 6: Checking Daily.co API credentials");
    if (!process.env.DAILY_API_KEY) {
      console.warn("⚠️ STEP 6 FAILED: Daily.co API key not configured");
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message: "Daily.co API not configured",
      });
    }
    console.log("✅ STEP 6 COMPLETE: Daily.co API credentials configured");

    console.log("📋 STEP 7: Fetching recordings from Daily.co API");
    console.log("   └─ Room Name:", appointment.dailyco_room_name);

    try {
      const recordingsData = await dailyService.getRecordings(
        appointment.dailyco_room_name,
      );

      console.log(
        "✅ STEP 7 COMPLETE: Successfully retrieved recordings from Daily.co API",
      );
      console.log("   └─ Total recordings:", recordingsData.total_count);

      console.log("📋 STEP 8: Processing recording files");

      if (recordingsData.data && recordingsData.data.length > 0) {
        console.log("📋 STEP 8.1: Analyzing all recording files");
        recordingsData.data.forEach((recording, index) => {
          console.log(`   └─ Recording ${index + 1}:`, {
            id: recording.id,
            status: recording.status,
            duration: recording.duration,
            start_ts: new Date(recording.start_ts * 1000).toISOString(),
          });
        });

        // Get the most recent finished recording
        const finishedRecordings = recordingsData.data.filter(
          (r) => r.status === "finished",
        );

        if (finishedRecordings.length === 0) {
          console.log(
            "⚠️ STEP 8 WARNING: Recordings exist but none are finished yet",
          );
          return NextResponse.json({
            success: true,
            recordingUrl: null,
            message:
              "Recording is still processing. Please try again in a few minutes.",
            recordings: recordingsData.data,
          });
        }

        // Get the most recent recording
        const latestRecording = finishedRecordings.sort(
          (a, b) => b.start_ts - a.start_ts,
        )[0];

        console.log("✅ STEP 8 COMPLETE: Latest recording identified");
        console.log("   └─ Recording ID:", latestRecording.id);
        console.log("   └─ Status:", latestRecording.status);
        console.log("   └─ Duration:", latestRecording.duration, "seconds");

        console.log("📋 STEP 9: Getting access link for recording");

        // Get access link for the recording
        const accessLinkData = await dailyService.getRecordingAccessLink(
          latestRecording.id,
        );
        const recordingUrl = accessLinkData.download_link;

        console.log("✅ STEP 9 COMPLETE: Access link retrieved");
        console.log("   └─ Download link available:", !!recordingUrl);

        console.log("📋 STEP 10: Saving recording URL to database");

        // Save recording URL to database
        const { error: updateError } = await supabase
          .from("appointments")
          .update({ recording_url: recordingUrl })
          .eq("id", appointmentId);

        if (updateError) {
          console.error("❌ STEP 10 FAILED: Error saving recording URL");
          console.error("   └─ Error:", updateError.message);
        } else {
          console.log("✅ STEP 10 COMPLETE: Recording URL saved to database");
        }

        console.log("📋 STEP 11: Preparing response");

        return NextResponse.json({
          success: true,
          recordingUrl,
          duration: latestRecording.duration,
          startTime: new Date(latestRecording.start_ts * 1000).toISOString(),
          allRecordings: recordingsData.data,
        });
      } else {
        console.log("⚠️ STEP 8 FAILED: No recordings found");
        return NextResponse.json({
          success: true,
          recordingUrl: null,
          message:
            "No recordings available yet. Recordings may take a few minutes to process after the meeting ends.",
        });
      }
    } catch (dailyErr: unknown) {
      const dailyError = dailyErr as Error;
      console.error(
        "❌ STEP 7 FAILED: Error fetching recordings from Daily.co",
      );
      console.error("   └─ Error:", dailyError.message);
      return NextResponse.json({
        success: true,
        recordingUrl: null,
        message:
          "Unable to fetch recordings. Meeting may not have started yet or recordings may still be processing.",
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("❌ FATAL ERROR: Unexpected error in get recordings API");
    console.error("   └─ Error:", error.message);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
