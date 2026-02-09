// ============================================================================
// BUGSY AI SYSTEM - Interview State Machine Hook
// Version: 1.0.0
// Description: Manages the complete Bugsy interview flow state
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  InterviewPhase,
  BugsyInterviewData,
  InterviewContext,
  RecordingData,
  TranscriptData,
  InteractionEvent,
  ScreenMarker,
  AnalysisResult,
  GapTracking,
  DoctorAnswers,
  ConfidenceData,
  PatternMatch,
  BugReport,
  CreateBugReportRequest,
} from '@/types/bugsy';
import {
  BUGSY_CONFIG,
  calculateConfidence,
  inferPriority,
  isClinicHours,
  determineGaps,
  getRequiredQuestions,
  isReadyToSubmit,
  getPageNameFromUrl,
  getBrowserInfo,
  getScreenSize,
  generateId,
  buildStepsFromInteractions,
} from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface UseBugsyStateReturn {
  // Current state
  phase: InterviewPhase;
  context: InterviewContext;
  recording: RecordingData;
  transcript: TranscriptData;
  interactions: InteractionEvent[];
  markers: ScreenMarker[];
  analysis: AnalysisResult;
  gaps: GapTracking;
  answers: DoctorAnswers;
  confidence: ConfidenceData;
  
  // Computed values
  isReadyToSubmit: boolean;
  requiredQuestions: string[];
  canGoBack: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  initializeContext: (userId: string, userName: string, userRole: 'provider' | 'assistant') => void;
  startRecording: () => void;
  stopRecording: (data: RecordingData, transcriptData: TranscriptData, capturedInteractions: InteractionEvent[], capturedMarkers: ScreenMarker[]) => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  confirmReflection: (confirmed: boolean, corrections?: string[]) => void;
  answerQuestion: (questionKey: string, answer: string | string[] | null) => void;
  setAnswers: (answers: Partial<DoctorAnswers>) => void;
  skipToVerification: () => void;
  goBack: () => void;
  submit: () => Promise<{ success: boolean; reportId?: string; error?: string }>;
  reset: () => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const getInitialContext = (): InterviewContext => ({
  page_url: typeof window !== 'undefined' ? window.location.pathname : '',
  page_name: typeof window !== 'undefined' ? getPageNameFromUrl(window.location.pathname) : '',
  user_id: '',
  user_name: '',
  user_role: 'provider',
  session_id: generateId('session'),
  browser: typeof window !== 'undefined' ? getBrowserInfo() : '',
  screen_size: typeof window !== 'undefined' ? getScreenSize() : { width: 0, height: 0 },
  timestamp: new Date().toISOString(),
  page_elements: [],
  recent_actions: [],
  known_issues: [],
});

const getInitialRecording = (): RecordingData => ({
  video_url: null,
  duration_seconds: 0,
  file_size_bytes: 0,
});

const getInitialTranscript = (): TranscriptData => ({
  full_text: '',
  segments: [],
  keywords_found: [],
});

const getInitialAnalysis = (): AnalysisResult => ({
  problem_identified: '',
  elements_involved: [],
  components_identified: [],
  files_identified: [],
  api_endpoints_identified: [],
  pattern_matches: [],
  similar_bugs: [],
});

const getInitialGaps = (): GapTracking => ({
  expected_behavior: 'unknown',
  error_message: 'unknown',
  frequency: 'unknown',
  worked_before: 'unknown',
});

const getInitialAnswers = (): DoctorAnswers => ({
  reflection_confirmed: false,
  corrections: [],
  expected_behavior: [],
  error_message: null,
  frequency: null,
  worked_before: null,
  additional_notes: '',
});

const getInitialConfidence = (): ConfidenceData => ({
  score: 0,
  breakdown: {
    problem_clarity: 0,
    location_clarity: 0,
    steps_clarity: 0,
    expected_clarity: 0,
    context_clarity: 0,
    pattern_bonus: 0,
    total: 0,
  },
  minimum_required: BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT,
  ready_to_submit: false,
});

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBugsyState(): UseBugsyStateReturn {
  // Core state
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [context, setContext] = useState<InterviewContext>(getInitialContext);
  const [recording, setRecording] = useState<RecordingData>(getInitialRecording);
  const [transcript, setTranscript] = useState<TranscriptData>(getInitialTranscript);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [markers, setMarkers] = useState<ScreenMarker[]>([]);
  const [analysis, setAnalysisState] = useState<AnalysisResult>(getInitialAnalysis);
  const [gaps, setGaps] = useState<GapTracking>(getInitialGaps);
  const [answers, setAnswersState] = useState<DoctorAnswers>(getInitialAnswers);
  const [confidence, setConfidence] = useState<ConfidenceData>(getInitialConfidence);
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking phase history
  const phaseHistoryRef = useRef<InterviewPhase[]>([]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const canGoBack = phase !== 'idle' && phase !== 'recording' && phase !== 'submitting' && phase !== 'success';
  const requiredQuestions = getRequiredQuestions(gaps);

  // ============================================================================
  // CONFIDENCE RECALCULATION
  // ============================================================================

  const recalculateConfidence = useCallback(() => {
    const breakdown = calculateConfidence({
      transcript: transcript.full_text,
      problemIdentified: !!analysis.problem_identified,
      clicks: interactions,
      markers,
      pageUrl: context.page_url,
      elementsIdentified: analysis.elements_involved,
      componentsIdentified: analysis.components_identified,
      transcriptSegments: transcript.segments,
      reflectionConfirmed: answers.reflection_confirmed,
      expectedBehaviorKnown: gaps.expected_behavior,
      errorMessageKnown: gaps.error_message,
      frequencyKnown: gaps.frequency === 'known',
      workedBeforeKnown: gaps.worked_before === 'known',
      patternMatches: analysis.pattern_matches,
    });

    setConfidence({
      score: breakdown.total,
      breakdown,
      minimum_required: BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT,
      ready_to_submit: breakdown.total >= BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT,
    });
  }, [transcript, analysis, interactions, markers, context.page_url, answers.reflection_confirmed, gaps]);

  // Recalculate confidence when relevant state changes
  useEffect(() => {
    recalculateConfidence();
  }, [recalculateConfidence]);

  // Update gaps when answers change
  useEffect(() => {
    const newGaps = determineGaps(answers);
    setGaps(newGaps);
  }, [answers]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const initializeContext = useCallback((userId: string, userName: string, userRole: 'provider' | 'assistant') => {
    setContext((prev) => ({
      ...prev,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      page_url: typeof window !== 'undefined' ? window.location.pathname : '',
      page_name: typeof window !== 'undefined' ? getPageNameFromUrl(window.location.pathname) : '',
      browser: typeof window !== 'undefined' ? getBrowserInfo() : '',
      screen_size: typeof window !== 'undefined' ? getScreenSize() : { width: 0, height: 0 },
      timestamp: new Date().toISOString(),
    }));
  }, []);

  const startRecording = useCallback(() => {
    phaseHistoryRef.current.push(phase);
    setPhase('recording');
    setError(null);
  }, [phase]);

  const stopRecording = useCallback((
    data: RecordingData,
    transcriptData: TranscriptData,
    capturedInteractions: InteractionEvent[],
    capturedMarkers: ScreenMarker[]
  ) => {
    // Validate minimum recording duration
    if (data.duration_seconds < BUGSY_CONFIG.MIN_RECORDING_DURATION_SECONDS) {
      setError('Recording too short. Please record for at least 3 seconds.');
      setPhase('idle');
      return;
    }

    setRecording(data);
    setTranscript(transcriptData);
    setInteractions(capturedInteractions);
    setMarkers(capturedMarkers);
    
    // Move to processing phase
    phaseHistoryRef.current.push(phase);
    setPhase('processing');
  }, [phase]);

  const setAnalysis = useCallback((newAnalysis: AnalysisResult) => {
    setAnalysisState(newAnalysis);
    
    // Move to reflection phase after analysis
    phaseHistoryRef.current.push(phase);
    setPhase('reflection');
  }, [phase]);

  const confirmReflection = useCallback((confirmed: boolean, corrections?: string[]) => {
    if (confirmed) {
      setAnswersState((prev) => ({
        ...prev,
        reflection_confirmed: true,
      }));
      
      // Check if we need clarifying questions
      const currentGaps = determineGaps(answers);
      const questionsNeeded = getRequiredQuestions(currentGaps);
      
      if (questionsNeeded.length > 0) {
        phaseHistoryRef.current.push(phase);
        setPhase('clarifying');
      } else {
        // Skip to verification if no questions needed
        phaseHistoryRef.current.push(phase);
        setPhase('verification');
      }
    } else {
      // Doctor said "not quite" - record corrections and stay in reflection
      // or go back to recording
      if (corrections && corrections.length > 0) {
        setAnswersState((prev) => ({
          ...prev,
          corrections: [...prev.corrections, ...corrections],
        }));
      }
      // Could add logic here to re-record or adjust reflection
    }
  }, [answers, phase]);

  const answerQuestion = useCallback((questionKey: string, answer: string | string[] | null) => {
    setAnswersState((prev) => {
      const updated = { ...prev };
      
      switch (questionKey) {
        case 'expected_behavior':
          updated.expected_behavior = Array.isArray(answer) ? answer : answer ? [answer] : [];
          break;
        case 'error_message':
          updated.error_message = answer as string | null;
          break;
        case 'frequency':
          updated.frequency = answer as 'always' | 'sometimes' | 'first_time' | null;
          break;
        case 'worked_before':
          updated.worked_before = answer as 'yes' | 'no' | 'unknown' | null;
          break;
        default:
          break;
      }
      
      return updated;
    });
  }, []);

  const setAnswers = useCallback((newAnswers: Partial<DoctorAnswers>) => {
    setAnswersState((prev) => ({
      ...prev,
      ...newAnswers,
    }));
    
    // Check if we're done with clarifying questions
    const updatedAnswers = { ...answers, ...newAnswers };
    const newGaps = determineGaps(updatedAnswers);
    const remainingQuestions = getRequiredQuestions(newGaps);
    
    // If no more questions needed and we're in clarifying phase, move to verification
    if (phase === 'clarifying' && remainingQuestions.length === 0) {
      phaseHistoryRef.current.push(phase);
      setPhase('verification');
    }
  }, [answers, phase]);

  // Skip directly to verification — bypasses reflection/clarifying
  const skipToVerification = useCallback(() => {
    phaseHistoryRef.current.push(phase);
    setPhase('verification');
  }, [phase]);

  const goBack = useCallback(() => {
    const previousPhase = phaseHistoryRef.current.pop();
    if (previousPhase) {
      setPhase(previousPhase);
    }
  }, []);

  const submit = useCallback(async (): Promise<{ success: boolean; reportId?: string; error?: string }> => {
    // Submit is always allowed — no confidence/answer requirements

    phaseHistoryRef.current.push(phase);
    setPhase('submitting');
    setError(null);

    try {
      // Infer priority
      const { priority, signals } = inferPriority({
        transcript: transcript.full_text,
        problemIdentified: analysis.problem_identified,
        failedClicks: interactions.filter((i) => i.result?.success === false).length,
        pageUrl: context.page_url,
        isClinicHours: isClinicHours(),
      });

      // Build the report
      const reportData: CreateBugReportRequest = {
        description: analysis.problem_identified || transcript.full_text.slice(0, 500),
        page_url: context.page_url,
        page_name: context.page_name,
        what_happened: analysis.problem_identified,
        expected_behavior: answers.expected_behavior.join('. '),
        steps_to_reproduce: buildStepsFromInteractions(interactions),
        recording_url: recording.video_url || undefined,
        recording_duration_seconds: recording.duration_seconds,
        transcript: transcript.full_text,
        transcript_segments: transcript.segments,
        markers,
        interactions,
        attachments: recording.video_url ? [{
          id: generateId('attachment'),
          type: 'video',
          url: recording.video_url,
          name: `recording-${Date.now()}.webm`,
          size: recording.file_size_bytes,
          mime_type: 'video/webm',
          duration_seconds: recording.duration_seconds,
          created_at: new Date().toISOString(),
        }] : [],
        confidence_score: confidence.score,
        confidence_breakdown: confidence.breakdown,
        bugsy_interview_data: {
          phase: 'success',
          context,
          recording,
          transcript,
          interactions,
          markers,
          analysis,
          gaps,
          answers,
          confidence,
        },
        browser_info: context.browser,
        screen_size: context.screen_size,
      };

      // Submit to API
      const response = await fetch('/api/bugsy/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report: reportData,
          priority,
          priority_signals: signals,
        }),
      });

      const result = await response.json();

      if (result.success && result.data?.id) {
        setPhase('success');
        return { success: true, reportId: result.data.id };
      } else {
        throw new Error(result.error || 'Failed to submit bug report');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while submitting';
      setError(errorMessage);
      setPhase('error');
      return { success: false, error: errorMessage };
    }
  }, [
    confidence,
    phase,
    transcript,
    analysis,
    interactions,
    context,
    recording,
    markers,
    answers,
    gaps,
  ]);

  const reset = useCallback(() => {
    setPhase('idle');
    setContext(getInitialContext());
    setRecording(getInitialRecording());
    setTranscript(getInitialTranscript());
    setInteractions([]);
    setMarkers([]);
    setAnalysisState(getInitialAnalysis());
    setGaps(getInitialGaps());
    setAnswersState(getInitialAnswers());
    setConfidence(getInitialConfidence());
    setError(null);
    phaseHistoryRef.current = [];
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    phase,
    context,
    recording,
    transcript,
    interactions,
    markers,
    analysis,
    gaps,
    answers,
    confidence,
    
    // Computed
    isReadyToSubmit: confidence.ready_to_submit,
    requiredQuestions,
    canGoBack,
    
    // Error
    error,
    
    // Actions
    initializeContext,
    startRecording,
    stopRecording,
    setAnalysis,
    confirmReflection,
    answerQuestion,
    setAnswers,
    skipToVerification,
    goBack,
    submit,
    reset,
    setError,
  };
}

export default useBugsyState;

