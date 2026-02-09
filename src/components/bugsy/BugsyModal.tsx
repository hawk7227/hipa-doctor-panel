'use client';

// ============================================================================
// BUGSY MODAL v2.0 — Auto-record → Review → Submit
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { X, Bug, Sparkles, ArrowLeft } from 'lucide-react';
import { useBugsyState } from '@/lib/bugsy';
import BugsyIdleScreen from './screens/BugsyIdleScreen';
import BugsyRecordingScreen from './screens/BugsyRecordingScreen';
import BugsyProcessingScreen from './screens/BugsyProcessingScreen';
import BugsyVerificationScreen from './screens/BugsyVerificationScreen';
import BugsySuccessScreen from './screens/BugsySuccessScreen';
import BugsyErrorScreen from './screens/BugsyErrorScreen';
// Keep imports to avoid build errors if files exist
import BugsyReflectionScreen from './screens/BugsyReflectionScreen';
import BugsyClarifyScreen from './screens/BugsyClarifyScreen';
import type { BugsyModalProps, AnalysisResult } from '@/types/bugsy';

export default function BugsyModal({ isOpen, onClose, onSubmitSuccess }: BugsyModalProps) {
  const bugsy = useBugsyState();
  const [isClosing, setIsClosing] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  // Auto-start recording on open
  useEffect(() => {
    if (isOpen && !autoStarted) {
      const userId = sessionStorage.getItem('doctor_id') || 'unknown';
      const userName = sessionStorage.getItem('doctor_name') || 'Doctor';
      bugsy.initializeContext(userId, userName, 'provider');
      bugsy.startRecording();
      setAutoStarted(true);
    }
    if (!isOpen) setAutoStarted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Processing → build basic analysis, skip AI
  useEffect(() => {
    if (bugsy.phase === 'processing') {
      (async () => {
        try {
          await new Promise(r => setTimeout(r, 500));
          const a: AnalysisResult = {
            problem_identified: bugsy.transcript.full_text || 'User reported an issue',
            elements_involved: bugsy.markers.map(m => m.element_text?.slice(0, 30) || m.element_tag || 'element'),
            components_identified: [], files_identified: [], api_endpoints_identified: [], pattern_matches: [], similar_bugs: [],
          };
          bugsy.setAnalysis(a);
        } catch (err) { console.error('Processing error:', err); bugsy.setError('Failed to process recording.'); }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugsy.phase]);

  // Skip reflection
  useEffect(() => { if (bugsy.phase === 'reflection') bugsy.confirmReflection(true); }, [bugsy.phase]);

  // Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) handleClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [isOpen]);

  // Body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (bugsy.phase === 'submitting') return;
    setIsClosing(true);
    setTimeout(() => { bugsy.reset(); setIsClosing(false); onClose(); }, 200);
  }, [bugsy.phase, onClose, bugsy]);

  const handleReRecord = useCallback(() => { bugsy.reset(); bugsy.startRecording(); }, [bugsy]);

  if (!isOpen) return null;

  // Recording = just the recording screen overlay
  if (bugsy.phase === 'recording') return <BugsyRecordingScreen onStop={bugsy.stopRecording} context={bugsy.context} />;

  const title = (() => {
    switch (bugsy.phase) {
      case 'idle': return 'Report a Bug';
      case 'processing': case 'reflection': return 'Processing...';
      case 'clarifying': case 'verification': return 'Review & Submit';
      case 'submitting': return 'Submitting...';
      case 'success': return 'Submitted!';
      case 'error': return 'Oops!';
      default: return 'Bugsy';
    }
  })();

  const screen = (() => {
    switch (bugsy.phase) {
      case 'idle': return <BugsyIdleScreen onStart={bugsy.startRecording} />;
      case 'processing': case 'reflection': return <BugsyProcessingScreen />;
      case 'clarifying': case 'verification':
        return <BugsyVerificationScreen context={bugsy.context} transcript={bugsy.transcript} analysis={bugsy.analysis} answers={bugsy.answers} confidence={{ ...bugsy.confidence, score: 100, ready_to_submit: true }} onEdit={handleReRecord} onSubmit={bugsy.submit} videoUrl={bugsy.recording?.video_url || null} />;
      case 'submitting': return <BugsyProcessingScreen message="Submitting your report..." />;
      case 'success': return <BugsySuccessScreen onClose={handleClose} onNewReport={() => bugsy.reset()} />;
      case 'error': return <BugsyErrorScreen error={bugsy.error} onRetry={() => bugsy.submit()} onClose={handleClose} />;
      default: return null;
    }
  })();

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative w-full max-w-2xl max-h-[90vh] mx-4 bg-gradient-to-b from-[#0d2626] to-[#0a1f1f] rounded-2xl shadow-2xl border border-teal-500/20 flex flex-col overflow-hidden transition-transform duration-200 ${isClosing ? 'scale-95' : 'scale-100'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-500/20 bg-[#0a1f1f]/50">
          <div className="flex items-center gap-3">
            {bugsy.canGoBack && bugsy.phase !== 'idle' && <button onClick={() => bugsy.goBack()} className="p-1.5 hover:bg-teal-500/20 rounded-lg"><ArrowLeft className="w-5 h-5 text-teal-400" /></button>}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30"><Bug className="w-5 h-5 text-white" /></div>
              <div><div className="flex items-center gap-1"><span className="font-bold text-white">Bugsy</span><Sparkles className="w-3 h-3 text-yellow-400" /></div><span className="text-xs text-teal-400">{title}</span></div>
            </div>
          </div>
          {bugsy.phase !== 'submitting' && <button onClick={handleClose} className="p-2 hover:bg-red-500/20 rounded-lg group"><X className="w-5 h-5 text-gray-400 group-hover:text-red-400" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto">{screen}</div>
      </div>
    </div>
  );
}
