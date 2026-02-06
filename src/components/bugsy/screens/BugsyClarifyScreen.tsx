'use client';

// ============================================================================
// BUGSY CLARIFY SCREEN - Quick Questions to Fill Gaps
// Version: 1.0.0
// ============================================================================

import { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import type { GapTracking, AnalysisResult, DoctorAnswers, ConfidenceData } from '@/types/bugsy';
import { CLARIFYING_QUESTIONS, getRequiredQuestions } from '@/lib/bugsy';

interface BugsyClarifyScreenProps {
  gaps: GapTracking;
  analysis: AnalysisResult;
  answers: DoctorAnswers;
  confidence: ConfidenceData;
  onAnswer: (questionKey: string, answer: string | string[] | null) => void;
  onComplete: () => void;
}

export default function BugsyClarifyScreen({
  gaps,
  analysis,
  answers,
  confidence,
  onAnswer,
  onComplete,
}: BugsyClarifyScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const requiredQuestions = getRequiredQuestions(gaps);

  // Auto-advance when confidence is high enough
  useEffect(() => {
    if (confidence.score >= 90) {
      onComplete();
    }
  }, [confidence.score, onComplete]);

  // Get current question config
  const currentQuestionKey = requiredQuestions[currentQuestionIndex];
  const questionConfig = CLARIFYING_QUESTIONS[currentQuestionKey as keyof typeof CLARIFYING_QUESTIONS];

  // Auto-complete if no questions needed
  useEffect(() => {
    if (!questionConfig || requiredQuestions.length === 0) {
      onComplete();
    }
  }, [questionConfig, requiredQuestions.length, onComplete]);

  // Early return after hooks
  if (!questionConfig || requiredQuestions.length === 0) {
    return null;
  }

  const handleAnswer = (answer: string) => {
    onAnswer(currentQuestionKey, answer);

    // Move to next question or complete
    if (currentQuestionIndex < requiredQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onAnswer(currentQuestionKey, null);

    if (currentQuestionIndex < requiredQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const progress = ((currentQuestionIndex + 1) / requiredQuestions.length) * 100;

  return (
    <div className="flex flex-col p-6 min-h-[400px]">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">
            Question {currentQuestionIndex + 1} of {requiredQuestions.length}
          </span>
          <span className="text-teal-400 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bugsy Asking */}
      <div className="flex gap-4 mb-8">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-[#1a3d3d] rounded-2xl rounded-tl-none p-4">
            <p className="text-white text-lg font-medium">{questionConfig.question}</p>
            <div className="flex items-center gap-1 text-xs text-teal-400 mt-2">
              <Sparkles className="w-3 h-3" />
              <span>This helps me understand better</span>
            </div>
          </div>
        </div>
      </div>

      {/* Answer Options */}
      <div className="flex-1 space-y-3 mb-6">
        {questionConfig.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswer(option.value)}
            className="w-full p-4 bg-[#0a1f1f] hover:bg-[#1a3d3d] border border-teal-500/20 hover:border-teal-500/50 rounded-xl transition-all duration-200 text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-white font-medium group-hover:text-teal-400 transition-colors">
                {option.label}
              </span>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ))}
      </div>

      {/* Skip Option */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <button
          onClick={handleSkip}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip this question
        </button>

        {/* Confidence indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Confidence:</span>
          <div className="flex items-center gap-1">
            <div
              className={`w-8 h-2 rounded-full ${
                confidence.score >= 90
                  ? 'bg-green-500'
                  : confidence.score >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
            <span
              className={`text-sm font-bold ${
                confidence.score >= 90
                  ? 'text-green-400'
                  : confidence.score >= 70
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {confidence.score}%
            </span>
          </div>
        </div>
      </div>

      {/* Already answered indicator */}
      {currentQuestionIndex > 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span>{currentQuestionIndex} question{currentQuestionIndex > 1 ? 's' : ''} answered</span>
        </div>
      )}
    </div>
  );
}
