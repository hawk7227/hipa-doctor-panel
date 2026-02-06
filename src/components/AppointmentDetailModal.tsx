'use client';

// ============================================================================
// BUGSY MODAL - v2.0
// 
// FLOW:
// 1. Click bug button → recording starts immediately (no splash)
// 2. Stop → brief processing → full-screen interview overlay
// 3. Bugsy walks around on the recording, chats with doctor
// 4. Done → success message → close
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useBugsyState } from '@/lib/bugsy';
import BugsyRecordingScreen from './screens/BugsyRecordingScreen';
import BugsyInterviewOverlay from './BugsyInterviewOverlay';
import BugsySuccessScreen from './screens/BugsySuccessScreen';
import BugsyErrorScreen from './screens/BugsyErrorScreen';
import type { BugsyModalProps, AnalysisResult } from '@/types/bugsy';
import { Bug, Sparkles, X } from 'lucide-react';

// ============================================================================
// COMPONENT
// ============================================================================

export default function BugsyModal({ isOpen, onClose, onSubmitSuccess }: BugsyModalProps) {
  const bugsy = useBugsyState();
  const [autoStarted, setAutoStarted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Auto-start recording when modal opens (no splash screen)
  useEffect(() => {
    if (isOpen && !autoStarted) {
      const userId = sessionStorage.getItem('doctor_id') || 'unknown';
      const userName = sessionStorage.getItem('doctor_name') || 'Doctor';
      bugsy.initializeContext(userId, userName, 'provider');
      bugsy.startRecording();
      setAutoStarted(true);
    }
    if (!isOpen) {
      setAutoStarted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle processing → auto-analyze → move to reflection
  useEffect(() => {
    if (bugsy.phase === 'processing') {
      const runAnalysis = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1200));

          const mockAnalysis: AnalysisResult = {
            problem_identified: bugsy.transcript.full_text || '',
            elements_involved: bugsy.markers.map(m => m.element_text?.slice(0, 30) || m.element_tag || 'element'),
            components_identified: [],
            files_identified: [],
            api_endpoints_identified: [],
            pattern_matches: [],
            similar_bugs: [],
          };

          bugsy.setAnalysis(mockAnalysis);
        } catch (error) {
          console.error('Analysis error:', error);
          bugsy.setError('Something went wrong. Please try again.');
        }
      };
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugsy.phase]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (bugsy.phase === 'submitting') return;
    setIsClosing(true);
    setTimeout(() => {
      bugsy.reset();
      setIsClosing(false);
      onClose();
    }, 200);
  }, [bugsy, onClose]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  // PHASE: Recording — just show the recording bar
  if (bugsy.phase === 'recording' || bugsy.phase === 'idle') {
    return (
      <BugsyRecordingScreen
        onStop={bugsy.stopRecording}
        context={bugsy.context}
      />
    );
  }

  // PHASE: Processing — show brief loading overlay
  if (bugsy.phase === 'processing') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30">
              <span className="text-3xl">🐛</span>
            </div>
            <div className="absolute -top-1 -right-1 bg-[#1a3d3d] rounded-full px-2 py-1 border border-teal-500/30 flex gap-1">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          <p className="text-white text-lg">Give me a sec to go over what you showed me...</p>
          <p className="text-gray-500 text-sm mt-1">Almost ready</p>
        </div>
      </div>
    );
  }

  // PHASE: Reflection / Clarifying — the full interview overlay experience
  if (bugsy.phase === 'reflection' || bugsy.phase === 'clarifying' || bugsy.phase === 'verification') {
    return (
      <BugsyInterviewOverlay
        recording={bugsy.recording}
        transcript={bugsy.transcript}
        analysis={bugsy.analysis}
        markers={bugsy.markers}
        interactions={bugsy.interactions}
        onConfirm={() => {
          bugsy.confirmReflection(true);
          // After the interview overlay finishes, auto-submit
          setTimeout(() => bugsy.submit(), 500);
        }}
        onCorrect={(corrections) => bugsy.confirmReflection(false, corrections)}
        onReRecord={() => {
          bugsy.reset();
          bugsy.startRecording();
        }}
        onAnswer={bugsy.answerQuestion}
        onClose={handleClose}
      />
    );
  }

  // PHASE: Submitting
  if (bugsy.phase === 'submitting') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 mb-4">
            <span className="text-3xl">🐛</span>
          </div>
          <p className="text-white text-lg">Sending this over to the team...</p>
        </div>
      </div>
    );
  }

  // PHASE: Success / Error — small modal
  if (bugsy.phase === 'success' || bugsy.phase === 'error') {
    return (
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative w-full max-w-md mx-4 bg-gradient-to-b from-[#0d2626] to-[#0a1f1f] rounded-2xl shadow-2xl border border-teal-500/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-teal-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
                <Bug className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-sm">Bugsy</span>
              <Sparkles className="w-3 h-3 text-yellow-400" />
            </div>
            <button onClick={handleClose} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </button>
          </div>
          {/* Content */}
          <div className="p-4">
            {bugsy.phase === 'success' ? (
              <BugsySuccessScreen
                onClose={handleClose}
                onNewReport={() => { bugsy.reset(); bugsy.startRecording(); }}
              />
            ) : (
              <BugsyErrorScreen
                error={bugsy.error}
                onRetry={() => bugsy.submit()}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}



