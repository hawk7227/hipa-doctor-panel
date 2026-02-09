// ============================================================================
// BUGSY API - Submit Bug Report
// Version: 2.1.0 — Fixed: blob URL handling, error serialization
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT (Service Role for API)
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables for Bugsy submit');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// POST - Submit Bug Report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { report, priority, priority_signals } = body;

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Missing report data' },
        { status: 400 }
      );
    }

    // ── Get doctor identity ──
    let doctorId: string | null = null;
    let reporterName = 'Unknown User';
    let reporterRole: 'provider' | 'assistant' | 'admin' = 'provider';

    // Try auth header first
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          doctorId = user.id;
          const { data: doctor } = await supabase
            .from('doctors')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();
          if (doctor) {
            reporterName = `Dr. ${doctor.first_name} ${doctor.last_name}`;
          }
        }
      } catch (authErr) {
        console.error('Auth error:', authErr);
      }
    }

    // Fallback: get doctor from interview data
    if (!doctorId && report.bugsy_interview_data?.context?.user_id) {
      doctorId = report.bugsy_interview_data.context.user_id;
      reporterName = report.bugsy_interview_data.context.user_name || 'Unknown User';
      const contextRole = report.bugsy_interview_data.context.user_role;
      if (contextRole === 'provider' || contextRole === 'assistant' || contextRole === 'admin') {
        reporterRole = contextRole;
      }
    }

    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'Could not identify doctor. Please ensure you are logged in.' },
        { status: 401 }
      );
    }

    // ── Clean recording_url — blob: URLs cannot be stored ──
    let recordingUrl = report.recording_url || null;
    if (recordingUrl && recordingUrl.startsWith('blob:')) {
      console.log('Bugsy: Skipping blob URL for recording_url (not storable)');
      recordingUrl = null;
    }

    // ── Generate title ──
    const title = (report.what_happened || report.description || 'Bug report').slice(0, 200);

    // ── Build insert data — only columns that exist in bug_reports table ──
    const bugReportData: Record<string, any> = {
      doctor_id: doctorId,
      reporter_name: reporterName,
      reporter_role: reporterRole,
      title,
      description: report.description || report.what_happened || '',
      page_url: report.page_url || '',
      page_name: report.page_name || '',
      browser_info: report.browser_info || '',
      screen_size: report.screen_size || null,
      status: 'new',
      priority: priority || 'medium',
      priority_inferred: true,
      priority_signals: priority_signals || [],
      admin_read: false,

      // Recording — only if non-blob URL
      recording_url: recordingUrl,
      recording_duration_seconds: report.recording_duration_seconds || null,

      // Transcript
      transcript: report.transcript || null,
      transcript_segments: report.transcript_segments || [],

      // Markers & interactions (JSONB columns)
      markers: report.markers || [],
      interactions: report.interactions || [],
      attachments: report.attachments || [],

      // Confidence
      confidence_score: report.confidence_score || null,
      confidence_breakdown: report.confidence_breakdown || null,

      // Full interview data (JSONB)
      bugsy_interview_data: report.bugsy_interview_data
        ? {
            ...report.bugsy_interview_data,
            // Strip blob URL from stored interview data too
            recording: report.bugsy_interview_data.recording
              ? { ...report.bugsy_interview_data.recording, video_url: null }
              : null,
          }
        : null,
    };

    // ── Optional columns — only include if they exist in the table ──
    // These may or may not exist depending on your migration version
    if (report.what_happened !== undefined) bugReportData.what_happened = report.what_happened;
    if (report.expected_behavior !== undefined) bugReportData.expected_behavior = report.expected_behavior;
    if (report.steps_to_reproduce !== undefined) bugReportData.steps_to_reproduce = report.steps_to_reproduce || [];
    if (report.bugsy_interview_data?.context?.session_id) {
      bugReportData.session_id = report.bugsy_interview_data.context.session_id;
    }

    // ── Insert ──
    console.log('Bugsy: Inserting bug report for doctor:', doctorId);

    const { data: insertedReport, error: insertError } = await supabase
      .from('bug_reports')
      .insert(bugReportData)
      .select('*')
      .single();

    if (insertError) {
      console.error('Bugsy insert error:', JSON.stringify(insertError));

      // If a column doesn't exist, try minimal insert
      if (insertError.message?.includes('column') || insertError.code === '42703') {
        console.log('Bugsy: Retrying with minimal columns...');
        const minimalData: Record<string, any> = {
          doctor_id: doctorId,
          description: bugReportData.description,
          page_url: bugReportData.page_url,
          page_name: bugReportData.page_name,
          browser_info: bugReportData.browser_info,
          status: 'new',
          priority: priority || 'medium',
          admin_read: false,
          recording_url: recordingUrl,
          recording_duration_seconds: report.recording_duration_seconds || null,
          transcript: report.transcript || null,
          markers: report.markers || [],
          interactions: report.interactions || [],
          attachments: report.attachments || [],
          confidence_score: report.confidence_score || null,
          bugsy_interview_data: bugReportData.bugsy_interview_data,
        };

        const { data: retryReport, error: retryError } = await supabase
          .from('bug_reports')
          .insert(minimalData)
          .select('*')
          .single();

        if (retryError) {
          console.error('Bugsy minimal insert also failed:', JSON.stringify(retryError));
          return NextResponse.json(
            { success: false, error: retryError.message || 'Failed to save bug report' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: retryReport });
      }

      return NextResponse.json(
        { success: false, error: insertError.message || 'Failed to save bug report' },
        { status: 500 }
      );
    }

    console.log('Bugsy: Report saved successfully:', insertedReport?.id);

    return NextResponse.json({ success: true, data: insertedReport });

  } catch (err) {
    console.error('Bugsy submit unexpected error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}


