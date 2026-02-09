'use client';

// ============================================================================
// BUGSY VERIFICATION SCREEN - Final Review Before Submit
// Version: 1.0.0
// ============================================================================

import { useState } from 'react';
import {
  CheckCircle,
  Send,
  Edit3,
  AlertTriangle,
  Monitor,
  MessageCircle,
  Target,
  Sparkles,
  Clock,
  FileText,
} from 'lucide-react';
import type {
  InterviewContext,
  TranscriptData,
  AnalysisResult,
  DoctorAnswers,
  ConfidenceData,
} from '@/types/bugsy';

interface BugsyVerificationScreenProps {
  context: InterviewContext;
  transcript: TranscriptData;
  analysis: AnalysisResult;
  answers: DoctorAnswers;
  confidence: ConfidenceData;
  onEdit: () => void;
  onSubmit: () => Promise<{ success: boolean; reportId?: string; error?: string }>;
}

export default function BugsyVerificationScreen({
  context,
  transcript,
  analysis,
  answers,
  confidence,
  onEdit,
  onSubmit,
}: BugsyVerificationScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState(answers.additional_notes || '');

  const canSubmit = true; // Doctor can always submit — no confidence gate

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build summary items
  const summaryItems = [
    {
      icon: Monitor,
      label: 'Page',
      value: context.page_name || context.page_url,
      color: 'text-blue-400',
    },
    {
      icon: MessageCircle,
      label: 'Problem',
      value: analysis.problem_identified || transcript.full_text?.slice(0, 100) || 'Described in recording',
      color: 'text-purple-400',
    },
    {
      icon: Target,
      label: 'Expected',
      value: answers.expected_behavior?.join(', ') || 'Not specified',
      color: 'text-green-400',
    },
  ];

  return (
    <div className="flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Review Your Report</h3>
          <p className="text-sm text-gray-400">Make sure everything looks good</p>
        </div>
      </div>

      {/* Ready Badge */}
      <div className="mb-6 p-4 rounded-xl border bg-green-500/10 border-green-500/30">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400">
            Report is ready to submit!
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="space-y-3 mb-6">
        {summaryItems.map((item, index) => (
          <div
            key={index}
            className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4"
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {item.label}
                </span>
                <p className="text-white mt-1 break-words">{item.value}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Additional details */}
        {answers.frequency && (
          <div className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-orange-400 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  Frequency
                </span>
                <p className="text-white mt-1">
                  {answers.frequency === 'always'
                    ? 'Happens every time'
                    : answers.frequency === 'sometimes'
                    ? 'Happens sometimes'
                    : 'First time seeing this'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Notes */}
      <div className="mb-6">
        <label className="text-sm text-gray-400 mb-2 block">
          Additional notes (optional)
        </label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Anything else you want to add..."
          className="w-full bg-[#0a1f1f] border border-teal-500/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-auto">
        <button
          onClick={onEdit}
          className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`flex-[2] py-4 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
            !isSubmitting
              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg shadow-green-500/30 hover:scale-[1.02]'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}

