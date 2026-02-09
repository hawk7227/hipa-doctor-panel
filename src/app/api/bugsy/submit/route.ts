// ============================================================================
// BUGSY API - Submit Bug Report
// Version: 2.2.0 — Fixed: attachment blob URLs, data type matching
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
// Helper: strip blob URLs from any nested object/array
// ============================================================================
function stripBlobUrls(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.startsWith('blob:') ? null : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => stripBlobUrls(item));
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = stripBlobUrls(value);
    }
    return cleaned;
  }
  return obj;
}

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

    if (!doctorId || doctorId === 'unknown' || doctorId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Could not identify doctor. Please ensure you are logged in.' },
        { status: 401 }
      );
    }

    // ── Clean recording_url — blob: URLs cannot be stored ──
    let recordingUrl = report.recording_url || null;
    if (recordingUrl && recordingUrl.startsWith('blob:')) {
      recordingUrl = null;
    }

    // ── Clean attachments — strip any blob URLs from attachment objects ──
    let cleanAttachments = report.attachments || [];
    if (Array.isArray(cleanAttachments)) {
      cleanAttachments = cleanAttachments
        .map((att: any) => {
          if (!att) return null;
          const cleaned = { ...att };
          if (cleaned.url && cleaned.url.startsWith('blob:')) {
            cleaned.url = null;
          }
          return cleaned;
        })
        .filter((att: any) => att !== null);
    }

    // ── Clean interview data — strip ALL blob URLs recursively ──
    const cleanInterviewData = report.bugsy_interview_data
      ? stripBlobUrls(report.bugsy_interview_data)
      : null;

    // ── Generate title ──
    const title = (report.what_happened || report.description || 'Bug report').slice(0, 200);

    // ── Build insert data — matches bug_reports table columns exactly ──
    const bugReportData: Record<string, any> = {
      // Identity
      doctor_id: doctorId,
      reporter_name: reporterName,
      reporter_role: reporterRole,

      // Content
      title,
      description: report.description || report.what_happened || '',
      what_happened: report.what_happened || null,
      expected_behavior: report.expected_behavior || null,
      steps_to_reproduce: report.steps_to_reproduce || null,

      // Location
      page_url: report.page_url || '',
      page_name: report.page_name || '',
      browser_info: typeof report.browser_info === 'string' ? report.browser_info : JSON.stringify(report.browser_info || ''),
      screen_size: report.screen_size || null,
      session_id: report.bugsy_interview_data?.context?.session_id || null,

      // Status
      status: 'new',
      priority: priority || 'medium',
      priority_inferred: true,
      priority_signals: priority_signals || null,
      admin_read: false,

      // Recording — null if blob URL
      recording_url: recordingUrl,
      recording_duration_seconds: report.recording_duration_seconds || null,

      // Transcript
      transcript: report.transcript || null,
      transcript_segments: report.transcript_segments || null,

      // Markers & interactions (JSONB)
      markers: report.markers || [],
      interactions: report.interactions || [],
      attachments: cleanAttachments,

      // Confidence
      confidence_score: report.confidence_score || null,
      confidence_breakdown: report.confidence_breakdown || null,

      // Full interview data (JSONB) — blob URLs stripped
      bugsy_interview_data: cleanInterviewData,
    };

    // ── Insert ──
    console.log('Bugsy: Inserting bug report for doctor:', doctorId);
    console.log('Bugsy: Columns being inserted:', Object.keys(bugReportData).join(', '));

    const { data: insertedReport, error: insertError } = await supabase
      .from('bug_reports')
      .insert(bugReportData)
      .select('id, status, priority, created_at')
      .single();

    if (insertError) {
      console.error('Bugsy insert error:', JSON.stringify(insertError));
      console.error('Bugsy insert error code:', insertError.code);
      console.error('Bugsy insert error details:', insertError.details);
      console.error('Bugsy insert error hint:', insertError.hint);

      return NextResponse.json(
        { success: false, error: `Database error: ${insertError.message}` },
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


