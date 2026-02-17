// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY VERIFICATION SCREEN v2.0 — Review & Submit
// ============================================================================

import { useState, useRef } from 'react';
import {
  CheckCircle, Send, RotateCcw, Monitor, MessageCircle,
  Target, Clock, FileText, Play, Pause, Volume2, VolumeX, SkipBack,
} from 'lucide-react';
import type { InterviewContext, TranscriptData, AnalysisResult, DoctorAnswers, ConfidenceData } from '@/types/bugsy';

interface BugsyVerificationScreenProps {
  context: InterviewContext;
  transcript: TranscriptData;
  analysis: AnalysisResult;
  answers: DoctorAnswers;
  confidence: ConfidenceData;
  onEdit: () => void;
  onSubmit: () => Promise<{ success: boolean; reportId?: string; error?: string }>;
  videoUrl?: string | null;
}

export default function BugsyVerificationScreen({ context, transcript, analysis, answers, confidence, onEdit, onSubmit, videoUrl }: BugsyVerificationScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notes, setNotes] = useState(answers.additional_notes || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true); setSubmitError(null);
    try {
      const result = await onSubmit();
      if (!result.success) { setSubmitError(result.error || 'Failed to submit.'); setIsSubmitting(false); }
    } catch { setSubmitError('Something went wrong.'); setIsSubmitting(false); }
  };

  const togglePlay = () => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); setIsPlaying(!isPlaying); };
  const toggleMute = () => { if (!videoRef.current) return; videoRef.current.muted = !isMuted; setIsMuted(!isMuted); };
  const restart = () => { if (!videoRef.current) return; videoRef.current.currentTime = 0; videoRef.current.play(); setIsPlaying(true); };

  return (
    <div className="flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"><FileText className="w-6 h-6 text-white" /></div>
        <div><h3 className="text-lg font-bold text-white">Review Your Report</h3><p className="text-sm text-gray-400">Watch your recording and submit when ready</p></div>
      </div>

      {/* Video — native controls fallback for audio */}
      {videoUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-teal-500/20 bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full max-h-[280px] object-contain bg-black"
            controls
            playsInline
            preload="metadata"
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>
      )}

      {/* Transcript */}
      {transcript.full_text?.trim() && (
        <div className="mb-6 bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4">
          <div className="flex items-center gap-2 mb-2"><Volume2 className="w-4 h-4 text-teal-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">What you said</span></div>
          <p className="text-white text-sm leading-relaxed italic">&ldquo;{transcript.full_text}&rdquo;</p>
        </div>
      )}

      {/* Ready badge */}
      <div className="mb-6 p-4 rounded-xl border bg-green-500/10 border-green-500/30">
        <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-green-400 font-medium">Report is ready to submit!</span></div>
      </div>

      {/* Summary */}
      <div className="space-y-3 mb-6">
        {[
          { icon: Monitor, label: 'Page', value: context.page_name || context.page_url || 'Current page', color: 'text-blue-400' },
          { icon: MessageCircle, label: 'Problem', value: analysis.problem_identified || transcript.full_text?.slice(0, 120) || 'Described in recording', color: 'text-purple-400' },
          { icon: Target, label: 'Expected', value: answers.expected_behavior?.length ? answers.expected_behavior.join(', ') : 'Not specified', color: 'text-green-400' },
        ].map((item, i) => (
          <div key={i} className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${item.color}`}><item.icon className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0"><span className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</span><p className="text-white mt-1 break-words">{item.value}</p></div>
            </div>
          </div>
        ))}
        {answers.frequency && (
          <div className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4">
            <div className="flex items-start gap-3"><Clock className="w-5 h-5 text-orange-400 mt-0.5" /><div><span className="text-xs text-gray-500 uppercase tracking-wide">Frequency</span><p className="text-white mt-1">{answers.frequency === 'always' ? 'Every time' : answers.frequency === 'sometimes' ? 'Sometimes' : 'First time'}</p></div></div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="text-sm text-gray-400 mb-2 block">Additional notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else..." className="w-full bg-[#0a1f1f] border border-teal-500/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none" rows={2} />
      </div>

      {/* Error */}
      {submitError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-red-400 text-sm">{submitError}</p></div>}

      {/* Actions */}
      <div className="flex gap-3 mt-auto">
        <button onClick={onEdit} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />Re-record</button>
        <button onClick={handleSubmit} disabled={isSubmitting} className={`flex-[2] py-4 font-bold rounded-xl flex items-center justify-center gap-2 ${!isSubmitting ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg shadow-green-500/30 hover:scale-[1.02]' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
          {isSubmitting ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : <><Send className="w-5 h-5" /> Submit Report</>}
        </button>
      </div>
    </div>
  );
}

