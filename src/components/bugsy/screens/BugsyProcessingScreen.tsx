// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY PROCESSING SCREEN - Loading/Analyzing State
// Version: 1.0.0
// ============================================================================

import { useState, useEffect } from 'react';
import { Brain, Sparkles, Search, FileText, Zap } from 'lucide-react';

interface BugsyProcessingScreenProps {
  message?: string;
}

const PROCESSING_STEPS = [
  { icon: Search, text: 'Analyzing your recording...' },
  { icon: FileText, text: 'Transcribing your voice...' },
  { icon: Brain, text: 'Understanding the problem...' },
  { icon: Zap, text: 'Finding similar bugs...' },
];

export default function BugsyProcessingScreen({ message }: BugsyProcessingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dots, setDots] = useState('');

  // Cycle through steps
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % PROCESSING_STEPS.length);
    }, 2000);

    return () => clearInterval(stepInterval);
  }, []);

  // Animate dots
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  const CurrentIcon = PROCESSING_STEPS[currentStep].icon;

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      {/* Animated Brain */}
      <div className="relative mb-8">
        {/* Outer ring */}
        <div className="w-32 h-32 rounded-full border-4 border-teal-500/20 animate-spin-slow" />

        {/* Middle ring */}
        <div className="absolute inset-2 rounded-full border-4 border-teal-500/30 animate-spin-reverse" />

        {/* Inner circle */}
        <div className="absolute inset-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/40">
          <div className="relative">
            <Brain className="w-12 h-12 text-white animate-pulse" />
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 animate-bounce" />
          </div>
        </div>

        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin-slow">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-teal-400 rounded-full" />
        </div>
        <div className="absolute inset-0 animate-spin-reverse">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
        </div>
      </div>

      {/* Current Step */}
      <div className="flex items-center gap-3 mb-4">
        <CurrentIcon className="w-5 h-5 text-teal-400 animate-pulse" />
        <span className="text-lg text-white font-medium">
          {message || PROCESSING_STEPS[currentStep].text}
        </span>
      </div>

      {/* Loading dots */}
      <div className="text-2xl text-teal-400 font-bold h-8">{dots}</div>

      {/* Progress indicators */}
      <div className="flex gap-2 mt-6">
        {PROCESSING_STEPS.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentStep
                ? 'bg-teal-400 scale-125'
                : index < currentStep
                ? 'bg-teal-600'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Fun message */}
      <p className="text-sm text-gray-500 mt-8 text-center max-w-xs">
        Bugsy is reading your report with the focus of a thousand developers...
      </p>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 6s linear infinite;
        }
      `}</style>
    </div>
  );
}
