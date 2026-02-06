// ============================================================================
// BUGSY API - Analyze Bug Report
// Version: 1.0.0
// Description: Analyzes recording, transcript, and interactions to generate insights
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  AnalysisResult,
  InteractionEvent,
  ScreenMarker,
  PatternMatch,
  SimilarBug,
  ConfidenceBreakdown,
  ApiResponse,
} from '@/types/bugsy';
import { extractKeywords, calculateConfidence } from '@/lib/bugsy/constants';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// TYPES
// ============================================================================

interface AnalyzeRequest {
  transcript: string;
  interactions: InteractionEvent[];
  markers: ScreenMarker[];
  page_url: string;
  user_id: string;
}

interface AnalyzeResponse {
  analysis: AnalysisResult;
  confidence: {
    score: number;
    breakdown: ConfidenceBreakdown;
  };
  suggested_questions: string[];
}

// ============================================================================
// PAGE TO COMPONENT MAPPING
// ============================================================================

const PAGE_COMPONENT_MAP: Record<string, { components: string[]; files: string[]; handlers: string[] }> = {
  '/doctor/appointments': {
    components: ['AppointmentsPage', 'AppointmentDetailModal', 'CreateAppointmentDialog', 'Calendar'],
    files: [
      'src/app/doctor/appointments/page.tsx',
      'src/components/AppointmentDetailModal.tsx',
      'src/components/CreateAppointmentDialog.tsx',
    ],
    handlers: ['handleSave', 'handleCreate', 'handleCancel', 'handleReschedule', 'handleStatusChange'],
  },
  '/doctor/patients': {
    components: ['PatientsPage', 'PatientCard', 'PatientDetailModal'],
    files: [
      'src/app/doctor/patients/page.tsx',
      'src/components/PatientCard.tsx',
    ],
    handlers: ['handleSearch', 'handleFilter', 'handleViewPatient', 'handleEditPatient'],
  },
  '/doctor/dashboard': {
    components: ['DashboardPage', 'StatsCard', 'RecentActivity', 'UpcomingAppointments'],
    files: [
      'src/app/doctor/dashboard/page.tsx',
    ],
    handlers: ['handleRefresh', 'handleViewAll'],
  },
  '/doctor/communication': {
    components: ['CommunicationPage', 'MessageList', 'MessageComposer', 'GmailStyleEmailPanel'],
    files: [
      'src/app/doctor/communication/page.tsx',
      'src/components/GmailStyleEmailPanel.tsx',
      'src/components/EnhancedSMSPanel.tsx',
    ],
    handlers: ['handleSend', 'handleReply', 'handleArchive', 'handleDelete'],
  },
  '/doctor/availability': {
    components: ['AvailabilityPage', 'AvailabilityCalendar', 'TimeSlotEditor'],
    files: [
      'src/app/doctor/availability/page.tsx',
    ],
    handlers: ['handleSaveAvailability', 'handleAddSlot', 'handleRemoveSlot'],
  },
  '/doctor/profile': {
    components: ['ProfilePage', 'ProfileForm', 'CredentialsSection'],
    files: [
      'src/app/doctor/profile/page.tsx',
    ],
    handlers: ['handleUpdateProfile', 'handleUploadPhoto', 'handleSaveCredentials'],
  },
  '/doctor/billing': {
    components: ['BillingPage', 'InvoiceList', 'PaymentHistory'],
    files: [
      'src/app/doctor/billing/page.tsx',
    ],
    handlers: ['handleViewInvoice', 'handleDownload', 'handleFilter'],
  },
  '/doctor/records': {
    components: ['RecordsPage', 'MedicalRecordsView', 'MedicalRecordsUpload'],
    files: [
      'src/app/doctor/records/page.tsx',
      'src/components/MedicalRecordsView.tsx',
      'src/components/MedicalRecordsUpload.tsx',
    ],
    handlers: ['handleUpload', 'handleView', 'handleShare', 'handleDelete'],
  },
  '/doctor/bug-reports': {
    components: ['BugReportsPage', 'BugReportCard', 'BugReportDetail'],
    files: [
      'src/app/doctor/bug-reports/page.tsx',
    ],
    handlers: ['handleViewReport', 'handlePlayVideo'],
  },
};

// ============================================================================
// ELEMENT KEYWORD MAPPING
// ============================================================================

const ELEMENT_KEYWORDS: Record<string, { type: string; component?: string; handler?: string }> = {
  'save': { type: 'button', handler: 'handleSave' },
  'submit': { type: 'button', handler: 'handleSubmit' },
  'cancel': { type: 'button', handler: 'handleCancel' },
  'close': { type: 'button', handler: 'handleClose' },
  'delete': { type: 'button', handler: 'handleDelete' },
  'edit': { type: 'button', handler: 'handleEdit' },
  'create': { type: 'button', handler: 'handleCreate' },
  'add': { type: 'button', handler: 'handleAdd' },
  'send': { type: 'button', handler: 'handleSend' },
  'search': { type: 'input', handler: 'handleSearch' },
  'filter': { type: 'dropdown', handler: 'handleFilter' },
  'dropdown': { type: 'dropdown', handler: 'handleSelect' },
  'select': { type: 'dropdown', handler: 'handleSelect' },
  'checkbox': { type: 'checkbox', handler: 'handleToggle' },
  'toggle': { type: 'toggle', handler: 'handleToggle' },
  'modal': { type: 'modal', component: 'Modal' },
  'popup': { type: 'modal', component: 'Modal' },
  'dialog': { type: 'modal', component: 'Dialog' },
  'form': { type: 'form', handler: 'handleSubmit' },
  'calendar': { type: 'calendar', component: 'Calendar' },
  'date': { type: 'datepicker', handler: 'handleDateChange' },
  'time': { type: 'timepicker', handler: 'handleTimeChange' },
};

// ============================================================================
// PROBLEM PATTERN DETECTION
// ============================================================================

const PROBLEM_PATTERNS = [
  {
    keywords: ['nothing happens', 'doesnt work', 'not working', 'no response'],
    problem: 'Action has no visible response',
    category: 'no-response',
  },
  {
    keywords: ['stays open', 'wont close', 'stuck open', 'cant close'],
    problem: 'Modal/popup not closing after action',
    category: 'modal-stuck',
  },
  {
    keywords: ['keeps spinning', 'loading forever', 'never loads', 'stuck loading'],
    problem: 'Infinite loading state',
    category: 'infinite-loading',
  },
  {
    keywords: ['wrong', 'incorrect', 'shows old', 'outdated', 'stale'],
    problem: 'Displaying incorrect or stale data',
    category: 'wrong-data',
  },
  {
    keywords: ['disappear', 'gone', 'vanish', 'lost'],
    problem: 'Content unexpectedly disappeared',
    category: 'content-lost',
  },
  {
    keywords: ['error', 'fail', 'crash', 'broke'],
    problem: 'Error or failure occurred',
    category: 'error',
  },
  {
    keywords: ['slow', 'laggy', 'takes forever', 'delay'],
    problem: 'Performance issue - slow response',
    category: 'performance',
  },
  {
    keywords: ['logged out', 'session', 'kicked out'],
    problem: 'Authentication/session issue',
    category: 'auth-issue',
  },
  {
    keywords: ['cant find', 'missing', 'where is', 'not there'],
    problem: 'Cannot locate feature or element',
    category: 'navigation',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Identify problem from transcript
 */
function identifyProblem(transcript: string): { problem: string; category: string } | null {
  const lowerTranscript = transcript.toLowerCase();
  
  for (const pattern of PROBLEM_PATTERNS) {
    const hasMatch = pattern.keywords.some(kw => lowerTranscript.includes(kw));
    if (hasMatch) {
      return { problem: pattern.problem, category: pattern.category };
    }
  }
  
  return null;
}

/**
 * Extract elements from transcript and interactions
 */
function extractElements(
  transcript: string,
  interactions: InteractionEvent[]
): string[] {
  const elements: Set<string> = new Set();
  const lowerTranscript = transcript.toLowerCase();
  
  // From transcript keywords
  for (const [keyword, info] of Object.entries(ELEMENT_KEYWORDS)) {
    if (lowerTranscript.includes(keyword)) {
      elements.add(`${keyword} ${info.type}`);
    }
  }
  
  // From interactions
  for (const interaction of interactions) {
    if (interaction.element?.text) {
      elements.add(interaction.element.text);
    }
    if (interaction.element?.tag) {
      elements.add(interaction.element.tag);
    }
  }
  
  return Array.from(elements).slice(0, 10); // Limit to 10 elements
}

/**
 * Get components and files for page
 */
function getPageComponents(pageUrl: string): { components: string[]; files: string[]; handlers: string[] } {
  // Normalize URL (remove dynamic segments)
  const normalizedUrl = pageUrl.replace(/\/[a-f0-9-]{36}/gi, '/[id]').replace(/\/\d+/g, '/[id]');
  
  // Check exact match first
  if (PAGE_COMPONENT_MAP[normalizedUrl]) {
    return PAGE_COMPONENT_MAP[normalizedUrl];
  }
  
  // Check for partial match (parent route)
  const urlParts = normalizedUrl.split('/').filter(Boolean);
  while (urlParts.length > 0) {
    const parentUrl = '/' + urlParts.join('/');
    if (PAGE_COMPONENT_MAP[parentUrl]) {
      return PAGE_COMPONENT_MAP[parentUrl];
    }
    urlParts.pop();
  }
  
  // Default
  return {
    components: [],
    files: [`src/app${normalizedUrl}/page.tsx`],
    handlers: [],
  };
}

/**
 * Identify handlers from transcript and elements
 */
function identifyHandlers(
  transcript: string,
  elements: string[],
  interactions: InteractionEvent[]
): string[] {
  const handlers: Set<string> = new Set();
  const lowerTranscript = transcript.toLowerCase();
  
  // From element keywords in transcript
  for (const [keyword, info] of Object.entries(ELEMENT_KEYWORDS)) {
    if (lowerTranscript.includes(keyword) && info.handler) {
      handlers.add(info.handler);
    }
  }
  
  // From interactions
  for (const interaction of interactions) {
    if (interaction.element_identified?.handler) {
      handlers.add(interaction.element_identified.handler);
    }
  }
  
  return Array.from(handlers);
}

/**
 * Match against known fix patterns
 */
async function matchPatterns(
  transcript: string,
  problemCategory: string | null
): Promise<PatternMatch[]> {
  try {
    const keywords = extractKeywords(transcript);
    
    // Query fix patterns from database
    const { data: patterns, error } = await supabase
      .from('bugsy_fix_patterns')
      .select('id, pattern_name, symptom_keywords, confidence_boost')
      .eq('is_active', true);
    
    if (error || !patterns) {
      console.error('Error fetching patterns:', error);
      return [];
    }
    
    const matches: PatternMatch[] = [];
    
    for (const pattern of patterns) {
      const patternKeywords = pattern.symptom_keywords as string[];
      if (!patternKeywords || patternKeywords.length === 0) continue;
      
      // Calculate similarity
      const matchedKeywords = keywords.filter(kw => 
        patternKeywords.some(pk => pk.toLowerCase().includes(kw) || kw.includes(pk.toLowerCase()))
      );
      
      if (matchedKeywords.length > 0) {
        const similarity = matchedKeywords.length / Math.max(patternKeywords.length, keywords.length);
        
        if (similarity >= 0.2) { // At least 20% match
          matches.push({
            pattern_id: pattern.id,
            pattern_name: pattern.pattern_name,
            similarity,
            confidence_boost: pattern.confidence_boost,
            matched_keywords: matchedKeywords,
          });
        }
      }
    }
    
    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);
    
    return matches.slice(0, 5); // Top 5 matches
  } catch (err) {
    console.error('Error matching patterns:', err);
    return [];
  }
}

/**
 * Find similar past bugs
 */
async function findSimilarBugs(
  transcript: string,
  pageUrl: string
): Promise<SimilarBug[]> {
  try {
    const keywords = extractKeywords(transcript);
    
    if (keywords.length === 0) return [];
    
    // Query past bugs from database
    const { data: pastBugs, error } = await supabase
      .from('bugsy_past_bugs')
      .select('id, symptom_keywords, symptom_text, root_cause, fix_description, page_url')
      .limit(100);
    
    if (error || !pastBugs) {
      console.error('Error fetching past bugs:', error);
      return [];
    }
    
    const similar: SimilarBug[] = [];
    
    for (const bug of pastBugs) {
      const bugKeywords = bug.symptom_keywords as string[];
      if (!bugKeywords || bugKeywords.length === 0) continue;
      
      // Calculate similarity
      const matchedKeywords = keywords.filter(kw =>
        bugKeywords.some(bk => bk.toLowerCase().includes(kw) || kw.includes(bk.toLowerCase()))
      );
      
      // Boost similarity if same page
      let similarity = matchedKeywords.length / Math.max(bugKeywords.length, keywords.length);
      if (bug.page_url === pageUrl) {
        similarity += 0.2;
      }
      
      if (similarity >= 0.3) { // At least 30% match
        similar.push({
          bug_id: bug.id,
          title: bug.symptom_text?.slice(0, 100) || 'Similar bug',
          similarity: Math.min(similarity, 1),
          root_cause: bug.root_cause,
          fix_applied: bug.fix_description,
          was_successful: true,
        });
      }
    }
    
    // Sort by similarity descending
    similar.sort((a, b) => b.similarity - a.similarity);
    
    return similar.slice(0, 5); // Top 5 similar
  } catch (err) {
    console.error('Error finding similar bugs:', err);
    return [];
  }
}

/**
 * Translate user vocabulary
 */
async function translateUserVocabulary(
  transcript: string,
  userId: string
): Promise<string> {
  try {
    // Get user vocabulary
    const { data: userVocab } = await supabase
      .from('bugsy_user_vocabulary')
      .select('user_term, system_term')
      .eq('user_id', userId);
    
    // Get default vocabulary
    const { data: defaultVocab } = await supabase
      .from('bugsy_default_vocabulary')
      .select('user_term, system_term')
      .eq('is_active', true);
    
    const allVocab = [...(userVocab || []), ...(defaultVocab || [])];
    
    if (allVocab.length === 0) return transcript;
    
    let translated = transcript.toLowerCase();
    
    // Sort by term length (longer first) to avoid partial replacements
    allVocab.sort((a, b) => b.user_term.length - a.user_term.length);
    
    for (const { user_term, system_term } of allVocab) {
      const regex = new RegExp(`\\b${user_term}\\b`, 'gi');
      translated = translated.replace(regex, `[${system_term}]`);
    }
    
    return translated;
  } catch (err) {
    console.error('Error translating vocabulary:', err);
    return transcript;
  }
}

/**
 * Determine which questions to ask
 */
function determineSuggestedQuestions(
  analysis: AnalysisResult,
  hasExpectedBehavior: boolean
): string[] {
  const questions: string[] = [];
  
  // Always ask about expected behavior if not clear
  if (!hasExpectedBehavior) {
    questions.push('expected_behavior');
  }
  
  // Ask about error message
  questions.push('error_message');
  
  // Ask about frequency if problem is not obvious
  if (!analysis.pattern_matches.some(p => p.similarity > 0.8)) {
    questions.push('frequency');
  }
  
  return questions.slice(0, 3); // Max 3 questions
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AnalyzeResponse>>> {
  try {
    // Parse request body
    const body: AnalyzeRequest = await request.json();
    const { transcript, interactions, markers, page_url, user_id } = body;

    // Validate required fields
    if (!transcript && interactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either transcript or interactions are required',
          },
        },
        { status: 400 }
      );
    }

    if (!page_url) {
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

    // Translate vocabulary
    const translatedTranscript = await translateUserVocabulary(transcript, user_id);

    // Identify the problem
    const problemResult = identifyProblem(translatedTranscript);
    const problemIdentified = problemResult?.problem || '';

    // Extract elements involved
    const elementsInvolved = extractElements(translatedTranscript, interactions);

    // Get components and files for this page
    const pageInfo = getPageComponents(page_url);

    // Identify handlers
    const handlersInvolved = identifyHandlers(translatedTranscript, elementsInvolved, interactions);

    // Match against patterns
    const patternMatches = await matchPatterns(translatedTranscript, problemResult?.category || null);

    // Find similar bugs
    const similarBugs = await findSimilarBugs(translatedTranscript, page_url);

    // Build analysis result
    const analysis: AnalysisResult = {
      problem_identified: problemIdentified,
      elements_involved: elementsInvolved,
      components_identified: pageInfo.components,
      files_identified: pageInfo.files,
      api_endpoints_identified: [], // Would need more context to determine
      pattern_matches: patternMatches,
      similar_bugs: similarBugs,
    };

    // Calculate confidence
    const confidenceBreakdown = calculateConfidence({
      transcript,
      problemIdentified: !!problemIdentified,
      clicks: interactions,
      markers,
      pageUrl: page_url,
      elementsIdentified: elementsInvolved,
      componentsIdentified: pageInfo.components,
      transcriptSegments: [],
      reflectionConfirmed: false,
      expectedBehaviorKnown: 'unknown',
      errorMessageKnown: 'unknown',
      frequencyKnown: false,
      workedBeforeKnown: false,
      patternMatches,
    });

    // Determine suggested questions
    const suggestedQuestions = determineSuggestedQuestions(analysis, false);

    // Return response
    return NextResponse.json({
      success: true,
      data: {
        analysis,
        confidence: {
          score: confidenceBreakdown.total,
          breakdown: confidenceBreakdown,
        },
        suggested_questions: suggestedQuestions,
      },
    });

  } catch (err) {
    console.error('Error in analyze endpoint:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred during analysis',
          details: { error: err instanceof Error ? err.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}
