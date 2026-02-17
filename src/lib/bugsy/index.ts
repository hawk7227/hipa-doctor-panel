// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ============================================================================
// BUGSY AI SYSTEM - Library Index
// Version: 1.0.0
// Description: Central export point for all Bugsy utilities and hooks
// ============================================================================

// Constants and utilities
export {
  // Config
  BUGSY_CONFIG,
  CONFIDENCE_WEIGHTS,
  PRIORITY_KEYWORDS,
  CORE_FUNCTIONS,
  
  // Labels and colors
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_ICONS,
  INTERVIEW_PHASE_LABELS,
  
  // Bugsy character
  BUGSY_EXPRESSIONS,
  BUGSY_MESSAGES,
  
  // Clarifying questions
  CLARIFYING_QUESTIONS,
  
  // Utility functions
  calculateConfidence,
  inferPriority,
  isClinicHours,
  extractKeywords,
  formatDuration,
  formatFileSize,
  formatRelativeTime,
  generateId,
  debounce,
  throttle,
  safeJsonParse,
  getPageNameFromUrl,
  truncateText,
  determineGaps,
  getRequiredQuestions,
  isReadyToSubmit,
  getConfidenceColor,
  getConfidenceBarColor,
  translateVocabulary,
  generateReflectionText,
  buildStepsFromInteractions,
  getBrowserInfo,
  getScreenSize,
} from './constants';

// Types
export type { ClarifyingQuestionOption, ClarifyingQuestion } from './constants';

// Hooks
export { useBugsyState } from './useBugsyState';
export type { UseBugsyStateReturn } from './useBugsyState';
