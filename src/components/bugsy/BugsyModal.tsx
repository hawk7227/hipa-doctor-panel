'use client';

// ============================================================================
// BUGSY MODAL - Main Interview Container
// Version: 1.0.0
// Description: Full-screen modal containing all Bugsy interview phases
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { X, Bug, Sparkles, ArrowLeft } from 'lucide-react';
import { useBugsyState } from '@/lib/bugsy';
import BugsyIdleScreen from './screens/BugsyIdleScreen';
import BugsyRecordingScreen from './screens/BugsyRecordingScreen';
import BugsyProcessingScreen from './screens/BugsyProcessingScreen';
import BugsyReflectionScreen from './screens/BugsyReflectionScreen';
import BugsyClarifyScreen from './screens/BugsyClarifyScreen';
import BugsyVerificationScreen from './screens/BugsyVerificationScreen';
import BugsySuccessScreen from './screens/BugsySuccessScreen';
import BugsyErrorScreen from './screens/BugsyErrorScreen';
import type { BugsyModalProps, AnalysisResult } from '@/types/bugsy';

// ============================================================================
// COMPONENT
// ============================================================================

export default function BugsyModal({ isOpen, onClose, onSubmitSuccess }: BugsyModalProps) {
  // Bugsy state machine
  const bugsy = useBugsyState();
  
  // Local state
  const [isClosing, setIsClosing] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize context when modal opens
  useEffect(() => {
    if (isOpen) {
      // Get user info from session/context
      const userId = sessionStorage.getItem('doctor_id') || 'unknown';
      const userName = sessionStorage.getItem('doctor_name') || 'Doctor';
      bugsy.initializeContext(userId, userName, 'provider');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle processing phase - trigger analysis
  useEffect(() => {
    if (bugsy.phase === 'processing') {
      // Simulate analysis (in production, call the /api/bugsy/analyze endpoint)
      const runAnalysis = async () => {
        try {
          // For now, create a mock analysis result
          // In production, you would call:
          // const response = await fetch('/api/bugsy/analyze', { ... })
          
          await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
          
          const mockAnalysis: AnalysisResult = {
            problem_identified: bugsy.transcript.full_text || 'User reported an issue',
            elements_involved: bugsy.markers.map(m => m.element_tag || 'element'),
            components_identified: ['Unknown Component'],
            files_identified: [],
            api_endpoints_identified: [],
            pattern_matches: [],
            similar_bugs: [],
          };
          
          bugsy.setAnalysis(mockAnalysis);
        } catch (error) {
          console.error('Analysis error:', error);
          bugsy.setError('Failed to analyze recording. Please try again.');
        }
      };
      
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugsy.phase]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClose = useCallback(() => {
    // Don't allow closing during submission
    if (bugsy.phase === 'submitting') return;

    setIsClosing(true);
    setTimeout(() => {
      bugsy.reset();
      setIsClosing(false);
      onClose();
    }, 200);
  }, [bugsy.phase, onClose, bugsy]);

  const handleBack = useCallback(() => {
    if (bugsy.canGoBack) {
      bugsy.goBack();
    }
  }, [bugsy]);

  const handleSuccess = useCallback(
    (reportId: string) => {
      if (onSubmitSuccess) {
        onSubmitSuccess(reportId);
      }
    },
    [onSubmitSuccess]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getPhaseTitle = (): string => {
    switch (bugsy.phase) {
      case 'idle':
        return 'Report a Bug';
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'reflection':
        return 'Let me confirm...';
      case 'clarifying':
        return 'Quick questions';
      case 'verification':
        return 'Review & Submit';
      case 'submitting':
        return 'Submitting...';
      case 'success':
        return 'Success!';
      case 'error':
        return 'Oops!';
      default:
        return 'Bugsy';
    }
  };

  const renderScreen = () => {
    switch (bugsy.phase) {
      case 'idle':
        return <BugsyIdleScreen onStart={bugsy.startRecording} />;
      case 'recording':
        // Handled separately in render to avoid modal wrapper
        return null;
      case 'processing':
        return <BugsyProcessingScreen />;
      case 'reflection':
        return (
          <BugsyReflectionScreen
            transcript={bugsy.transcript}
            analysis={bugsy.analysis}
            markers={bugsy.markers}
            onConfirm={() => bugsy.confirmReflection(true)}
            onCorrect={(corrections) => bugsy.confirmReflection(false, corrections)}
            onReRecord={() => {
              bugsy.reset();
              bugsy.startRecording();
            }}
          />
        );
      case 'clarifying':
        return (
          <BugsyClarifyScreen
            gaps={bugsy.gaps}
            analysis={bugsy.analysis}
            answers={bugsy.answers}
            confidence={bugsy.confidence}
            onAnswer={bugsy.answerQuestion}
            onComplete={() => bugsy.setAnswers(bugsy.answers)}
          />
        );
      case 'verification':
        return (
          <BugsyVerificationScreen
            context={bugsy.context}
            transcript={bugsy.transcript}
            analysis={bugsy.analysis}
            answers={bugsy.answers}
            confidence={bugsy.confidence}
            onEdit={handleBack}
            onSubmit={bugsy.submit}
          />
        );
      case 'submitting':
        return <BugsyProcessingScreen message="Submitting your report..." />;
      case 'success':
        return (
          <BugsySuccessScreen
            onClose={handleClose}
            onNewReport={() => bugsy.reset()}
          />
        );
      case 'error':
        return (
          <BugsyErrorScreen
            error={bugsy.error}
            onRetry={() => bugsy.submit()}
            onClose={handleClose}
          />
        );
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  // During recording, only render the recording screen (which shows its own minimized bar)
  if (bugsy.phase === 'recording') {
    return (
      <BugsyRecordingScreen
        onStop={bugsy.stopRecording}
        context={bugsy.context}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] mx-4 bg-gradient-to-b from-[#0d2626] to-[#0a1f1f] rounded-2xl shadow-2xl border border-teal-500/20 flex flex-col overflow-hidden transition-transform duration-200 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-500/20 bg-[#0a1f1f]/50">
          <div className="flex items-center gap-3">
            {bugsy.canGoBack && bugsy.phase !== 'idle' && (
              <button
                onClick={handleBack}
                className="p-1.5 hover:bg-teal-500/20 rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-teal-400" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Bug className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white">Bugsy</span>
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                </div>
                <span className="text-xs text-teal-400">{getPhaseTitle()}</span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          {bugsy.phase !== 'submitting' && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
            style={{
              width: `${Math.min(100, bugsy.confidence.score)}%`,
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderScreen()}
        </div>

        {/* Confidence Footer (shown during interview) */}
        {['reflection', 'clarifying', 'verification'].includes(bugsy.phase) && (
          <div className="px-6 py-3 border-t border-teal-500/20 bg-[#0a1f1f]/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Report Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      bugsy.confidence.score >= 90
                        ? 'bg-green-500'
                        : bugsy.confidence.score >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${bugsy.confidence.score}%` }}
                  />
                </div>
                <span
                  className={`font-bold ${
                    bugsy.confidence.score >= 90
                      ? 'text-green-400'
                      : bugsy.confidence.score >= 70
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {bugsy.confidence.score}%
                </span>
              </div>
            </div>
            {bugsy.confidence.score < 90 && (
              <p className="text-xs text-gray-500 mt-1">
                Need {90 - bugsy.confidence.score}% more confidence to submit
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
