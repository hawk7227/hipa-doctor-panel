// ============================================================================
// BUGSY API - Submit Bug Report
// Version: 1.0.0
// Description: Production-ready endpoint for submitting bug reports
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  BugReport,
  BugTicket,
  CreateBugReportRequest,
  BugPriority,
  PrioritySignal,
  ApiResponse,
} from '@/types/bugsy';

// ============================================================================
// SUPABASE CLIENT (Service Role for API)
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// TYPES
// ============================================================================

interface SubmitRequest {
  report: CreateBugReportRequest;
  priority: BugPriority;
  priority_signals: PrioritySignal[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the current user's doctor record from email
 */
async function getDoctorFromEmail(email: string): Promise<{ id: string; first_name: string; last_name: string } | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, first_name, last_name')
    .eq('email', email)
    .single();

  if (error || !data) {
    console.error('Error fetching doctor:', error);
    return null;
  }

  return data;
}

/**
 * Create notification for admin
 */
async function createAdminNotification(bugReportId: string, reporterName: string, title: string): Promise<void> {
  try {
    // Get admin user IDs (users with admin role)
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (!adminUsers || adminUsers.length === 0) {
      console.log('No admin users found for notification');
      return;
    }

    // Create notification for each admin
    const notifications = adminUsers.map((admin) => ({
      user_id: admin.user_id,
      user_role: 'admin',
      notification_type: 'bug_report_submitted',
      title: 'New Bug Report',
      message: `${reporterName} submitted: ${title || 'Bug Report'}`,
      reference_type: 'bug_report',
      reference_id: bugReportId,
      priority: 'normal',
      show_sound: true,
      show_badge: true,
      show_banner: true,
    }));

    const { error } = await supabase
      .from('bugsy_notifications')
      .insert(notifications);

    if (error) {
      console.error('Error creating admin notifications:', error);
    }
  } catch (err) {
    console.error('Error in createAdminNotification:', err);
  }
}

/**
 * Log audit event
 */
async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action_type: action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}

/**
 * Generate bug ticket from analysis (for admin)
 */
async function generateBugTicket(
  bugReportId: string,
  report: CreateBugReportRequest,
  analysis?: {
    problem_identified?: string;
    components_identified?: string[];
    files_identified?: string[];
    api_endpoints_identified?: string[];
    pattern_matches?: Array<{ pattern_name: string; similarity: number }>;
  }
): Promise<string | null> {
  try {
    // Build markdown ticket for developers
    const ticketParts: string[] = [];
    
    ticketParts.push(`## Bug Report #${bugReportId.slice(0, 8)}`);
    ticketParts.push('');
    ticketParts.push(`**Page:** ${report.page_name || report.page_url}`);
    ticketParts.push(`**URL:** ${report.page_url}`);
    ticketParts.push('');
    
    // What happened
    ticketParts.push('### Problem');
    ticketParts.push(report.what_happened || report.description || 'Not specified');
    ticketParts.push('');
    
    // Expected behavior
    if (report.expected_behavior) {
      ticketParts.push('### Expected Behavior');
      ticketParts.push(report.expected_behavior);
      ticketParts.push('');
    }
    
    // Steps to reproduce
    if (report.steps_to_reproduce && report.steps_to_reproduce.length > 0) {
      ticketParts.push('### Steps to Reproduce');
      report.steps_to_reproduce.forEach((step) => {
        ticketParts.push(`${step.step}. ${step.action}`);
      });
      ticketParts.push('');
    }
    
    // Files identified
    if (analysis?.files_identified && analysis.files_identified.length > 0) {
      ticketParts.push('### Files Identified');
      analysis.files_identified.forEach((file) => {
        ticketParts.push(`- ${file}`);
      });
      ticketParts.push('');
    }
    
    // API endpoints
    if (analysis?.api_endpoints_identified && analysis.api_endpoints_identified.length > 0) {
      ticketParts.push('### API Endpoints');
      analysis.api_endpoints_identified.forEach((endpoint) => {
        ticketParts.push(`- ${endpoint}`);
      });
      ticketParts.push('');
    }
    
    // Pattern matches
    if (analysis?.pattern_matches && analysis.pattern_matches.length > 0) {
      ticketParts.push('### Similar Patterns');
      analysis.pattern_matches.forEach((match) => {
        ticketParts.push(`- ${match.pattern_name} (${Math.round(match.similarity * 100)}% similar)`);
      });
      ticketParts.push('');
    }
    
    // Browser info
    if (report.browser_info) {
      ticketParts.push('### Environment');
      ticketParts.push(`- Browser: ${report.browser_info}`);
      if (report.screen_size) {
        ticketParts.push(`- Screen: ${report.screen_size.width}x${report.screen_size.height}`);
      }
      ticketParts.push('');
    }
    
    const fullTicketMarkdown = ticketParts.join('\n');
    
    // Insert bug ticket
    const { data: ticket, error } = await supabase
      .from('bug_tickets')
      .insert({
        bug_report_id: bugReportId,
        user_description: report.description,
        bugsy_interpretation: analysis?.problem_identified,
        page_url: report.page_url,
        components_identified: analysis?.components_identified || [],
        files_identified: analysis?.files_identified || [],
        handlers_identified: [],
        api_endpoints_identified: analysis?.api_endpoints_identified || [],
        pattern_matches: analysis?.pattern_matches || [],
        similar_past_bugs: [],
        full_ticket_markdown: fullTicketMarkdown,
        verification_steps: report.steps_to_reproduce?.map((step, i) => ({
          step: i + 1,
          action: step.action,
          expected_result: step.expected_result || 'Should work correctly',
        })) || [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating bug ticket:', error);
      return null;
    }

    return ticket?.id || null;
  } catch (err) {
    console.error('Error in generateBugTicket:', err);
    return null;
  }
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<BugReport>>> {
  try {
    // Parse request body
    const body: SubmitRequest = await request.json();
    const { report, priority, priority_signals } = body;

    // Validate required fields
    if (!report.description && !report.what_happened) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Description or what_happened is required',
          },
        },
        { status: 400 }
      );
    }

    if (!report.page_url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Page URL is required',
          },
        },
        { status: 400 }
      );
    }

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    let doctorId: string | null = null;
    let reporterName = 'Unknown User';
    let reporterRole: 'provider' | 'assistant' = 'provider';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      // Verify token and get user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user?.email) {
        const doctor = await getDoctorFromEmail(user.email);
        if (doctor) {
          doctorId = doctor.id;
          reporterName = `Dr. ${doctor.first_name} ${doctor.last_name}`;
        }
      }
    }

    // If no auth, try to get doctor from interview data
    if (!doctorId && report.bugsy_interview_data?.context?.user_id) {
      doctorId = report.bugsy_interview_data.context.user_id;
      reporterName = report.bugsy_interview_data.context.user_name || 'Unknown User';
      reporterRole = report.bugsy_interview_data.context.user_role || 'provider';
    }

    // If still no doctor ID, this is an error
    if (!doctorId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Could not identify the reporter. Please ensure you are logged in.',
          },
        },
        { status: 401 }
      );
    }

    // Generate title from description
    const title = report.what_happened
      ? report.what_happened.slice(0, 100)
      : report.description.slice(0, 100);

    // Build the bug report record
    const bugReportData = {
      doctor_id: doctorId,
      reporter_name: reporterName,
      reporter_role: reporterRole,
      title,
      description: report.description || report.what_happened || '',
      what_happened: report.what_happened,
      expected_behavior: report.expected_behavior,
      steps_to_reproduce: report.steps_to_reproduce || [],
      page_url: report.page_url,
      page_name: report.page_name,
      github_file_path: `src/app${report.page_url}/page.tsx`,
      browser_info: report.browser_info,
      screen_size: report.screen_size,
      session_id: report.bugsy_interview_data?.context?.session_id,
      recording_url: report.recording_url,
      recording_duration_seconds: report.recording_duration_seconds,
      transcript: report.transcript,
      transcript_segments: report.transcript_segments || [],
      markers: report.markers || [],
      interactions: report.interactions || [],
      attachments: report.attachments || [],
      status: 'new',
      priority,
      priority_inferred: true,
      priority_signals,
      confidence_score: report.confidence_score,
      confidence_breakdown: report.confidence_breakdown,
      bugsy_interview_data: report.bugsy_interview_data,
      admin_read: false,
    };

    // Insert bug report
    const { data: insertedReport, error: insertError } = await supabase
      .from('bug_reports')
      .insert(bugReportData)
      .select('*')
      .single();

    if (insertError) {
      console.error('Error inserting bug report:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to save bug report',
            details: { error: insertError.message },
          },
        },
        { status: 500 }
      );
    }

    // Generate bug ticket for admin/developers
    if (insertedReport) {
      const analysisData = report.bugsy_interview_data?.analysis;
      await generateBugTicket(insertedReport.id, report, analysisData);
      
      // Create admin notification
      await createAdminNotification(insertedReport.id, reporterName, title);
      
      // Log audit event
      await logAuditEvent(
        doctorId,
        'bug_report_submit',
        'bug_report',
        insertedReport.id,
        {
          page_url: report.page_url,
          priority,
          confidence_score: report.confidence_score,
        }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: insertedReport as BugReport,
    });

  } catch (err) {
    console.error('Error in bug report submit:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
          details: { error: err instanceof Error ? err.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER (List bug reports)
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '20');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const doctorId = searchParams.get('doctor_id');

    // Build query
    let query = supabase
      .from('bug_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    // Apply pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching bug reports:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch bug reports',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });

  } catch (err) {
    console.error('Error in bug reports GET:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
