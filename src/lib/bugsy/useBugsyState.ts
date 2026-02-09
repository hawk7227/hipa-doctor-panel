// ============================================================================
// BUGSY STATE MACHINE v2.0 — Confidence gate REMOVED
// Flow: record → process → verify → submit (no AI blocking)
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  InterviewPhase, InterviewContext, RecordingData, TranscriptData,
  InteractionEvent, ScreenMarker, AnalysisResult, GapTracking,
  DoctorAnswers, ConfidenceData, CreateBugReportRequest,
} from '@/types/bugsy';
import {
  BUGSY_CONFIG, calculateConfidence, inferPriority, isClinicHours,
  determineGaps, getRequiredQuestions, getPageNameFromUrl,
  getBrowserInfo, getScreenSize, generateId, buildStepsFromInteractions,
} from './constants';

export interface UseBugsyStateReturn {
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
  isReadyToSubmit: boolean;
  requiredQuestions: string[];
  canGoBack: boolean;
  error: string | null;
  initializeContext: (userId: string, userName: string, userRole: 'provider' | 'assistant') => void;
  startRecording: () => void;
  stopRecording: (data: RecordingData, transcript: TranscriptData, interactions: InteractionEvent[], markers: ScreenMarker[]) => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  confirmReflection: (confirmed: boolean, corrections?: string[]) => void;
  answerQuestion: (questionKey: string, answer: string | string[] | null) => void;
  setAnswers: (answers: Partial<DoctorAnswers>) => void;
  goBack: () => void;
  submit: () => Promise<{ success: boolean; reportId?: string; error?: string }>;
  reset: () => void;
  setError: (error: string | null) => void;
}

const getInitialContext = (): InterviewContext => ({ user_id: '', user_name: '', user_role: 'provider', page_url: '', page_name: '', browser: '', session_id: '', screen_size: { width: 0, height: 0 }, timestamp: new Date().toISOString() });
const getInitialRecording = (): RecordingData => ({ video_url: null, duration_seconds: 0, file_size_bytes: 0 });
const getInitialTranscript = (): TranscriptData => ({ full_text: '', segments: [], keywords_found: [] });
const getInitialAnalysis = (): AnalysisResult => ({ problem_identified: '', elements_involved: [], components_identified: [], files_identified: [], api_endpoints_identified: [], pattern_matches: [], similar_bugs: [] });
const getInitialGaps = (): GapTracking => ({ problem_statement: 'unknown', expected_behavior: false, error_message: 'unknown', frequency: 'unknown', worked_before: 'unknown', steps_clear: false });
const getInitialAnswers = (): DoctorAnswers => ({ expected_behavior: [], error_message: null, frequency: null, worked_before: null, additional_notes: '', corrections: [], reflection_confirmed: false });
const getInitialConfidence = (): ConfidenceData => ({ score: 0, breakdown: { problem_clarity: 0, location_clarity: 0, steps_clarity: 0, expected_clarity: 0, context_clarity: 0, pattern_bonus: 0, total: 0 }, minimum_required: BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT, ready_to_submit: false });

export function useBugsyState(): UseBugsyStateReturn {
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
  const phaseHistoryRef = useRef<InterviewPhase[]>([]);

  const canGoBack = phase !== 'idle' && phase !== 'recording' && phase !== 'submitting' && phase !== 'success';
  const requiredQuestions = getRequiredQuestions(gaps);

  const recalculateConfidence = useCallback(() => {
    const breakdown = calculateConfidence({ transcript: transcript.full_text, problemIdentified: !!analysis.problem_identified, clicks: interactions, markers, pageUrl: context.page_url, elementsIdentified: analysis.elements_involved, componentsIdentified: analysis.components_identified, transcriptSegments: transcript.segments, reflectionConfirmed: answers.reflection_confirmed, expectedBehaviorKnown: gaps.expected_behavior, errorMessageKnown: gaps.error_message, frequencyKnown: gaps.frequency === 'known', workedBeforeKnown: gaps.worked_before === 'known', patternMatches: analysis.pattern_matches });
    setConfidence({ score: breakdown.total, breakdown, minimum_required: BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT, ready_to_submit: breakdown.total >= BUGSY_CONFIG.MINIMUM_CONFIDENCE_TO_SUBMIT });
  }, [transcript, analysis, interactions, markers, context.page_url, answers.reflection_confirmed, gaps]);

  useEffect(() => { recalculateConfidence(); }, [recalculateConfidence]);
  useEffect(() => { setGaps(determineGaps(answers)); }, [answers]);

  const initializeContext = useCallback((userId: string, userName: string, userRole: 'provider' | 'assistant') => {
    setContext(prev => ({ ...prev, user_id: userId, user_name: userName, user_role: userRole, session_id: generateId('session'), page_url: typeof window !== 'undefined' ? window.location.pathname : '', page_name: typeof window !== 'undefined' ? getPageNameFromUrl(window.location.pathname) : '', browser: typeof window !== 'undefined' ? getBrowserInfo() : '', screen_size: typeof window !== 'undefined' ? getScreenSize() : { width: 0, height: 0 }, timestamp: new Date().toISOString() }));
  }, []);

  const startRecording = useCallback(() => { phaseHistoryRef.current.push(phase); setPhase('recording'); setError(null); }, [phase]);

  const stopRecording = useCallback((data: RecordingData, transcriptData: TranscriptData, capturedInteractions: InteractionEvent[], capturedMarkers: ScreenMarker[]) => {
    if (data.duration_seconds < BUGSY_CONFIG.MIN_RECORDING_DURATION_SECONDS) { setError('Recording too short.'); setPhase('idle'); return; }
    setRecording(data); setTranscript(transcriptData); setInteractions(capturedInteractions); setMarkers(capturedMarkers);
    phaseHistoryRef.current.push(phase); setPhase('processing');
  }, [phase]);

  const setAnalysis = useCallback((a: AnalysisResult) => { setAnalysisState(a); phaseHistoryRef.current.push(phase); setPhase('reflection'); }, [phase]);

  const confirmReflection = useCallback((confirmed: boolean, corrections?: string[]) => {
    if (confirmed) {
      setAnswersState(prev => ({ ...prev, reflection_confirmed: true }));
      const currentGaps = determineGaps(answers);
      const needed = getRequiredQuestions(currentGaps);
      phaseHistoryRef.current.push(phase);
      setPhase(needed.length > 0 ? 'clarifying' : 'verification');
    } else if (corrections?.length) {
      setAnswersState(prev => ({ ...prev, corrections: [...prev.corrections, ...corrections] }));
    }
  }, [answers, phase]);

  const answerQuestion = useCallback((key: string, answer: string | string[] | null) => {
    setAnswersState(prev => {
      const u = { ...prev };
      if (key === 'expected_behavior') u.expected_behavior = Array.isArray(answer) ? answer : answer ? [answer] : [];
      else if (key === 'error_message') u.error_message = answer as string | null;
      else if (key === 'frequency') u.frequency = answer as any;
      else if (key === 'worked_before') u.worked_before = answer as any;
      return u;
    });
  }, []);

  const setAnswers = useCallback((newAnswers: Partial<DoctorAnswers>) => {
    setAnswersState(prev => ({ ...prev, ...newAnswers }));
    const updated = { ...answers, ...newAnswers };
    const newGaps = determineGaps(updated);
    if (phase === 'clarifying' && getRequiredQuestions(newGaps).length === 0) { phaseHistoryRef.current.push(phase); setPhase('verification'); }
  }, [answers, phase]);

  const goBack = useCallback(() => { const p = phaseHistoryRef.current.pop(); if (p) setPhase(p); }, []);

  // ── SUBMIT — NO CONFIDENCE GATE ──
  const submit = useCallback(async (): Promise<{ success: boolean; reportId?: string; error?: string }> => {
    phaseHistoryRef.current.push(phase); setPhase('submitting'); setError(null);
    try {
      const { priority, signals } = inferPriority({ transcript: transcript.full_text, problemIdentified: analysis.problem_identified, failedClicks: interactions.filter(i => i.result?.success === false).length, pageUrl: context.page_url, isClinicHours: isClinicHours() });
      const reportData: CreateBugReportRequest = {
        description: analysis.problem_identified || transcript.full_text.slice(0, 500),
        page_url: context.page_url, page_name: context.page_name,
        what_happened: analysis.problem_identified,
        expected_behavior: answers.expected_behavior.join('. '),
        steps_to_reproduce: buildStepsFromInteractions(interactions),
        recording_url: recording.video_url || undefined,
        recording_duration_seconds: recording.duration_seconds,
        transcript: transcript.full_text, transcript_segments: transcript.segments,
        markers, interactions,
        attachments: recording.video_url ? [{ id: generateId('attachment'), type: 'video', url: recording.video_url, name: `recording-${Date.now()}.webm`, size: recording.file_size_bytes, mime_type: 'video/webm', duration_seconds: recording.duration_seconds, created_at: new Date().toISOString() }] : [],
        confidence_score: confidence.score, confidence_breakdown: confidence.breakdown,
        bugsy_interview_data: { phase: 'success', context, recording, transcript, interactions, markers, analysis, gaps, answers, confidence },
        browser_info: context.browser, screen_size: context.screen_size,
      };
      const response = await fetch('/api/bugsy/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: reportData, priority, priority_signals: signals }) });
      const result = await response.json();
      if (result.success && result.data?.id) { setPhase('success'); return { success: true, reportId: result.data.id }; }
      else throw new Error(result.error || 'Failed to submit');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission error';
      setError(msg); setPhase('error'); return { success: false, error: msg };
    }
  }, [confidence, phase, transcript, analysis, interactions, context, recording, markers, answers, gaps]);

  const reset = useCallback(() => {
    setPhase('idle'); setContext(getInitialContext()); setRecording(getInitialRecording()); setTranscript(getInitialTranscript()); setInteractions([]); setMarkers([]); setAnalysisState(getInitialAnalysis()); setGaps(getInitialGaps()); setAnswersState(getInitialAnswers()); setConfidence(getInitialConfidence()); setError(null); phaseHistoryRef.current = [];
  }, []);

  return {
    phase, context, recording, transcript, interactions, markers, analysis, gaps, answers, confidence,
    isReadyToSubmit: true, // Always ready — doctor decides
    requiredQuestions, canGoBack, error,
    initializeContext, startRecording, stopRecording, setAnalysis, confirmReflection, answerQuestion, setAnswers, goBack, submit, reset, setError,
  };
}

export default useBugsyState;
