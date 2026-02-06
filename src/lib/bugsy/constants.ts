// ============================================================================
// BUGSY AI SYSTEM - Constants and Utilities
// Version: 1.0.0
// Description: Core constants, configuration, and utility functions
// ============================================================================

import type {
  BugPriority,
  BugReportStatus,
  InterviewPhase,
  ConfidenceBreakdown,
  InteractionEvent,
  ScreenMarker,
  TranscriptSegment,
  GapTracking,
  DoctorAnswers,
  PatternMatch,
  AnalysisResult,
  PrioritySignal,
} from '@/types/bugsy';

// ============================================================================
// CONSTANTS
// ============================================================================

export const BUGSY_CONFIG = {
  // Confidence thresholds
  MINIMUM_CONFIDENCE_TO_SUBMIT: 90,
  
  // Recording limits
  MAX_RECORDING_DURATION_SECONDS: 300, // 5 minutes
  MIN_RECORDING_DURATION_SECONDS: 3,
  
  // File limits
  MAX_ATTACHMENT_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  ALLOWED_VIDEO_TYPES: ['video/webm', 'video/mp4', 'video/quicktime'],
  ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  
  // Interview settings
  MAX_CLARIFYING_QUESTIONS: 3,
  
  // Analysis settings
  PATTERN_MATCH_THRESHOLD: 0.6,
  SIMILAR_BUG_THRESHOLD: 0.7,
  
  // UI settings
  WIDGET_POSITIONS: ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const,
  DEFAULT_WIDGET_POSITION: 'bottom-right' as const,
} as const;

export const CONFIDENCE_WEIGHTS = {
  PROBLEM_CLARITY: {
    transcript_exists: 10,
    problem_identified: 10,
    has_clicks: 5,
  },
  LOCATION_CLARITY: {
    page_url_exists: 5,
    elements_identified: 5,
    components_identified: 5,
    has_markers: 5,
  },
  STEPS_CLARITY: {
    multiple_clicks: 10,
    has_transcript_segments: 5,
    reflection_confirmed: 5,
  },
  EXPECTED_BEHAVIOR: {
    fully_known: 20,
    partially_known: 10,
  },
  CONTEXT: {
    error_message_known: 5,
    frequency_known: 5,
    worked_before_known: 5,
  },
  PATTERN_BONUS: {
    max_boost: 15,
  },
} as const;

export const PRIORITY_KEYWORDS = {
  critical: [
    "can't",
    "cannot",
    "stuck",
    "blocked",
    "blocking",
    "urgent",
    "emergency",
    "patient waiting",
    "help",
    "broken completely",
    "nothing works",
    "locked out",
    "critical",
  ],
  high: [
    "important",
    "need",
    "asap",
    "not working",
    "broken",
    "fails",
    "error",
  ],
} as const;

export const CORE_FUNCTIONS = [
  'login',
  'logout',
  'save',
  'submit',
  'patient',
  'appointment',
  'prescri',
  'medical',
  'record',
  'schedule',
  'book',
] as const;

export const STATUS_LABELS: Record<BugReportStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  fixed: 'Fixed',
  wont_fix: "Won't Fix",
  duplicate: 'Duplicate',
};

export const STATUS_COLORS: Record<BugReportStatus, string> = {
  new: 'bg-blue-500',
  investigating: 'bg-yellow-500',
  fixed: 'bg-green-500',
  wont_fix: 'bg-gray-500',
  duplicate: 'bg-purple-500',
};

export const PRIORITY_LABELS: Record<BugPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_COLORS: Record<BugPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export const PRIORITY_ICONS: Record<BugPriority, string> = {
  critical: '🔴',
  high: '🟡',
  medium: '🟢',
  low: '⚪',
};

export const INTERVIEW_PHASE_LABELS: Record<InterviewPhase, string> = {
  idle: 'Ready',
  recording: 'Recording',
  processing: 'Processing',
  reflection: 'Confirming',
  clarifying: 'Questions',
  verification: 'Review',
  submitting: 'Submitting',
  success: 'Complete',
  error: 'Error',
};

// ============================================================================
// BUGSY CHARACTER EXPRESSIONS
// ============================================================================

export const BUGSY_EXPRESSIONS = {
  neutral: '(• •)',
  thinking: '(◉ ◉)',
  happy: '(◠ ◠)',
  confused: '(？•)',
  empathetic: '(• ᴗ•)',
  celebrating: '(◠ ◠) 🎉',
} as const;

export const BUGSY_MESSAGES = {
  // Start screen
  greeting: (name: string) => 
    `Hi ${name}! Show me what's going wrong - I'll record your screen and listen.`,
  
  // Recording
  listening: "Listening... (I'll ask questions when you're done)",
  
  // Processing
  processing: "Let me review what you showed me...",
  
  // Reflection
  reflection_intro: "Okay, let me make sure I understood:",
  reflection_confirm: "Is that right?",
  reflection_not_quite: "No problem! What did I get wrong?",
  
  // Clarifying
  clarifying_intro: "Great! Just a couple quick questions:",
  
  // Verification
  verification_intro: "Perfect! Here's the complete report:",
  
  // Success
  success_message: "All done! I've sent this to the team.",
  success_followup: "You'll get a notification when there's an update.",
  
  // Emotional responses
  frustration_response: "I'm sorry this is giving you trouble. Let me capture this so we can get it fixed for you.",
  confusion_response: "No worries - let's take it step by step.",
  urgency_response: "I can see this is urgent. Let me capture this quickly so it can be prioritized.",
} as const;

// ============================================================================
// CLARIFYING QUESTIONS
// ============================================================================

export interface ClarifyingQuestionOption {
  label: string;
  value: string;
  allowInput?: boolean;
}

export interface ClarifyingQuestion {
  question: string;
  options: ClarifyingQuestionOption[];
}

export const CLARIFYING_QUESTIONS: Record<string, ClarifyingQuestion> = {
  expected_behavior: {
    question: "What should happen when this works correctly?",
    options: [
      { label: "Popup closes and updates the page", value: "closes_and_updates" },
      { label: "Shows a confirmation message", value: "shows_confirmation" },
      { label: "Both - closes and shows confirmation", value: "both" },
      { label: "Something else", value: "other", allowInput: true },
    ],
  },
  error_message: {
    question: "Did you see any error message?",
    options: [
      { label: "No, nothing at all", value: "none" },
      { label: "Yes (please describe)", value: "yes", allowInput: true },
      { label: "Not sure / didn't notice", value: "not_sure" },
    ],
  },
  frequency: {
    question: "Does this happen every time?",
    options: [
      { label: "Every time I try", value: "always" },
      { label: "Sometimes", value: "sometimes" },
      { label: "This is the first time", value: "first_time" },
    ],
  },
  worked_before: {
    question: "Has this worked correctly before?",
    options: [
      { label: "Yes, it used to work", value: "yes" },
      { label: "No, it's never worked for me", value: "no" },
      { label: "I'm not sure / first time trying", value: "unknown" },
    ],
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate confidence score based on interview state
 */
export function calculateConfidence(params: {
  transcript: string;
  problemIdentified: boolean;
  clicks: InteractionEvent[];
  markers: ScreenMarker[];
  pageUrl: string;
  elementsIdentified: string[];
  componentsIdentified: string[];
  transcriptSegments: TranscriptSegment[];
  reflectionConfirmed: boolean;
  expectedBehaviorKnown: 'known' | 'unknown' | 'partial';
  errorMessageKnown: 'known' | 'unknown' | 'none';
  frequencyKnown: boolean;
  workedBeforeKnown: boolean;
  patternMatches: PatternMatch[];
}): ConfidenceBreakdown {
  let problemClarity = 0;
  let locationClarity = 0;
  let stepsClarity = 0;
  let expectedClarity = 0;
  let contextClarity = 0;
  let patternBonus = 0;

  // Problem clarity (max 25)
  if (params.transcript && params.transcript.length > 20) {
    problemClarity += CONFIDENCE_WEIGHTS.PROBLEM_CLARITY.transcript_exists;
  }
  if (params.problemIdentified) {
    problemClarity += CONFIDENCE_WEIGHTS.PROBLEM_CLARITY.problem_identified;
  }
  if (params.clicks.length > 0) {
    problemClarity += CONFIDENCE_WEIGHTS.PROBLEM_CLARITY.has_clicks;
  }

  // Location clarity (max 20)
  if (params.pageUrl) {
    locationClarity += CONFIDENCE_WEIGHTS.LOCATION_CLARITY.page_url_exists;
  }
  if (params.elementsIdentified.length > 0) {
    locationClarity += CONFIDENCE_WEIGHTS.LOCATION_CLARITY.elements_identified;
  }
  if (params.componentsIdentified.length > 0) {
    locationClarity += CONFIDENCE_WEIGHTS.LOCATION_CLARITY.components_identified;
  }
  if (params.markers.length > 0) {
    locationClarity += CONFIDENCE_WEIGHTS.LOCATION_CLARITY.has_markers;
  }

  // Steps clarity (max 20)
  if (params.clicks.length >= 2) {
    stepsClarity += CONFIDENCE_WEIGHTS.STEPS_CLARITY.multiple_clicks;
  }
  if (params.transcriptSegments.length > 0) {
    stepsClarity += CONFIDENCE_WEIGHTS.STEPS_CLARITY.has_transcript_segments;
  }
  if (params.reflectionConfirmed) {
    stepsClarity += CONFIDENCE_WEIGHTS.STEPS_CLARITY.reflection_confirmed;
  }

  // Expected behavior (max 20)
  if (params.expectedBehaviorKnown === 'known') {
    expectedClarity += CONFIDENCE_WEIGHTS.EXPECTED_BEHAVIOR.fully_known;
  } else if (params.expectedBehaviorKnown === 'partial') {
    expectedClarity += CONFIDENCE_WEIGHTS.EXPECTED_BEHAVIOR.partially_known;
  }

  // Context (max 15)
  if (params.errorMessageKnown !== 'unknown') {
    contextClarity += CONFIDENCE_WEIGHTS.CONTEXT.error_message_known;
  }
  if (params.frequencyKnown) {
    contextClarity += CONFIDENCE_WEIGHTS.CONTEXT.frequency_known;
  }
  if (params.workedBeforeKnown) {
    contextClarity += CONFIDENCE_WEIGHTS.CONTEXT.worked_before_known;
  }

  // Pattern bonus (up to 15)
  if (params.patternMatches.length > 0) {
    const bestMatch = params.patternMatches[0];
    patternBonus = Math.min(bestMatch.confidence_boost, CONFIDENCE_WEIGHTS.PATTERN_BONUS.max_boost);
  }

  const total = Math.min(
    problemClarity + locationClarity + stepsClarity + expectedClarity + contextClarity + patternBonus,
    100
  );

  return {
    problem_clarity: problemClarity,
    location_clarity: locationClarity,
    steps_clarity: stepsClarity,
    expected_clarity: expectedClarity,
    context_clarity: contextClarity,
    pattern_bonus: patternBonus,
    total,
  };
}

/**
 * Infer priority from transcript and context (no question asked)
 */
export function inferPriority(params: {
  transcript: string;
  problemIdentified: string;
  failedClicks: number;
  pageUrl: string;
  isClinicHours: boolean;
}): { priority: BugPriority; signals: PrioritySignal[] } {
  const signals: PrioritySignal[] = [];
  let urgencyScore = 0;

  const transcriptLower = params.transcript.toLowerCase();
  const problemLower = params.problemIdentified.toLowerCase();

  // Check critical keywords
  const hasCriticalKeyword = PRIORITY_KEYWORDS.critical.some((kw) =>
    transcriptLower.includes(kw.toLowerCase())
  );
  if (hasCriticalKeyword) {
    urgencyScore += 30;
    signals.push({
      signal: 'Critical keyword detected in transcript',
      weight: 30,
      matched: true,
    });
  }

  // Check if core function is affected
  const coreAffected = CORE_FUNCTIONS.some((fn) => problemLower.includes(fn));
  if (coreAffected) {
    urgencyScore += 25;
    signals.push({
      signal: 'Core function affected',
      weight: 25,
      matched: true,
    });
  }

  // Multiple failed attempts
  if (params.failedClicks >= 2) {
    urgencyScore += 15;
    signals.push({
      signal: 'Multiple failed attempts detected',
      weight: 15,
      matched: true,
      details: `${params.failedClicks} failed clicks`,
    });
  }

  // During clinic hours
  if (params.isClinicHours) {
    urgencyScore += 10;
    signals.push({
      signal: 'Submitted during clinic hours',
      weight: 10,
      matched: true,
    });
  }

  // In active appointment/call
  if (params.pageUrl.includes('/call') || params.pageUrl.includes('/video')) {
    urgencyScore += 20;
    signals.push({
      signal: 'In active appointment/call',
      weight: 20,
      matched: true,
    });
  }

  // Determine priority
  let priority: BugPriority;
  if (urgencyScore >= 50) {
    priority = 'critical';
  } else if (urgencyScore >= 25) {
    priority = 'high';
  } else {
    priority = 'medium';
  }

  return { priority, signals };
}

/**
 * Check if current time is during clinic hours (8am-6pm weekdays)
 */
export function isClinicHours(date: Date = new Date()): boolean {
  const day = date.getDay();
  const hour = date.getHours();
  
  // Weekday (Monday = 1, Friday = 5)
  const isWeekday = day >= 1 && day <= 5;
  
  // Between 8am and 6pm
  const isDuringHours = hour >= 8 && hour < 18;
  
  return isWeekday && isDuringHours;
}

/**
 * Extract keywords from transcript for pattern matching
 */
export function extractKeywords(transcript: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how', 'this', 'that', 'these', 'those',
    'then', 'than', 'so', 'just', 'also', 'very', 'too', 'here', 'there',
  ]);

  const words = transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Get unique words
  return [...new Set(words)];
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format relative time (e.g., "5 min ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return then.toLocaleDateString();
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get page name from URL path
 */
export function getPageNameFromUrl(url: string): string {
  const path = url.split('?')[0].split('#')[0];
  const segments = path.split('/').filter(Boolean);
  
  // Map common paths to friendly names
  const pathMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'appointments': 'Appointments',
    'patients': 'Patients',
    'communication': 'Communication',
    'records': 'Medical Records',
    'prescriptions': 'Prescriptions',
    'billing': 'Billing',
    'profile': 'Profile',
    'availability': 'Availability',
    'bug-reports': 'Bug Reports',
    'admin-bugs': 'Admin Bug Reports',
  };

  const lastSegment = segments[segments.length - 1];
  
  // Check if it's a dynamic route (e.g., [id])
  if (lastSegment && lastSegment.startsWith('[')) {
    const parentSegment = segments[segments.length - 2];
    return pathMap[parentSegment] || parentSegment || 'Unknown Page';
  }

  return pathMap[lastSegment] || lastSegment || 'Unknown Page';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Determine which gaps need to be filled based on current state
 */
export function determineGaps(
  answers: Partial<DoctorAnswers>
): GapTracking {
  return {
    expected_behavior: answers.expected_behavior && answers.expected_behavior.length > 0
      ? 'known'
      : 'unknown',
    error_message: answers.error_message !== undefined
      ? (answers.error_message === null ? 'none' : 'known')
      : 'unknown',
    frequency: answers.frequency !== null && answers.frequency !== undefined
      ? 'known'
      : 'unknown',
    worked_before: answers.worked_before !== null && answers.worked_before !== undefined
      ? 'known'
      : 'unknown',
  };
}

/**
 * Get questions that need to be asked based on gaps
 */
export function getRequiredQuestions(gaps: GapTracking): string[] {
  const questions: string[] = [];
  
  // Always ask about expected behavior if unknown (most important)
  if (gaps.expected_behavior === 'unknown') {
    questions.push('expected_behavior');
  }
  
  // Ask about error message if unknown
  if (gaps.error_message === 'unknown') {
    questions.push('error_message');
  }
  
  // Only ask about frequency and worked_before if we have room
  // (limit to MAX_CLARIFYING_QUESTIONS)
  if (questions.length < BUGSY_CONFIG.MAX_CLARIFYING_QUESTIONS) {
    if (gaps.frequency === 'unknown') {
      questions.push('frequency');
    }
  }
  
  if (questions.length < BUGSY_CONFIG.MAX_CLARIFYING_QUESTIONS) {
    if (gaps.worked_before === 'unknown') {
      questions.push('worked_before');
    }
  }
  
  return questions;
}

/**
 * Check if report is ready to submit
 */
export function isReadyToSubmit(confidence: number): boolean {
  return confidence >= BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT;
}

/**
 * Get CSS class for confidence score color
 */
export function getConfidenceColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Get CSS class for confidence bar background
 */
export function getConfidenceBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-yellow-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Translate user vocabulary to system terms
 */
export function translateVocabulary(
  text: string, 
  vocabulary: Array<{ user_term: string; system_term: string }>
): string {
  let result = text.toLowerCase();
  
  // Sort by length (longer terms first) to avoid partial replacements
  const sortedVocab = [...vocabulary].sort(
    (a, b) => b.user_term.length - a.user_term.length
  );
  
  for (const { user_term, system_term } of sortedVocab) {
    const regex = new RegExp(`\\b${escapeRegExp(user_term)}\\b`, 'gi');
    result = result.replace(regex, system_term);
  }
  
  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate reflection text from analysis
 */
export function generateReflectionText(params: {
  pageUrl: string;
  pageName: string;
  transcript: string;
  problemIdentified: string;
  elementsInvolved: string[];
  markers: ScreenMarker[];
}): string {
  const parts: string[] = [];
  
  parts.push(`You were on the ${params.pageName} page`);
  
  if (params.problemIdentified) {
    parts.push(`and ${params.problemIdentified}`);
  }
  
  if (params.elementsInvolved.length > 0) {
    const elements = params.elementsInvolved.slice(0, 2).join(' and ');
    parts.push(`involving the ${elements}`);
  }
  
  if (params.markers.length > 0) {
    parts.push(`You pointed at ${params.markers.length} element${params.markers.length > 1 ? 's' : ''}`);
  }
  
  return parts.join('. ') + '.';
}

/**
 * Build steps to reproduce from interactions
 */
export function buildStepsFromInteractions(
  interactions: InteractionEvent[]
): Array<{ step: number; action: string; element?: string }> {
  const steps: Array<{ step: number; action: string; element?: string }> = [];
  let stepNumber = 1;
  
  // Filter to meaningful interactions (clicks, types, submits)
  const meaningfulInteractions = interactions.filter(
    (i) => i.action_type === 'click' || i.action_type === 'type'
  );
  
  for (const interaction of meaningfulInteractions) {
    let action = '';
    
    if (interaction.action_type === 'click') {
      const elementText = interaction.element?.text || interaction.element?.tag || 'element';
      action = `Click ${elementText}`;
    } else if (interaction.action_type === 'type' && interaction.input_value) {
      const elementText = interaction.element?.tag || 'field';
      action = `Type in ${elementText}`;
    }
    
    if (action) {
      steps.push({
        step: stepNumber++,
        action,
        element: interaction.element?.selector,
      });
    }
  }
  
  return steps;
}

/**
 * Get browser info string
 */
export function getBrowserInfo(): string {
  if (typeof window === 'undefined') return 'Unknown';
  
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
  }
  
  return `${browser} on ${navigator.platform}`;
}

/**
 * Get screen size
 */
export function getScreenSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
