// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY SUCCESS SCREEN - Completion Celebration
// Version: 1.0.0
// ============================================================================

import { useEffect, useState } from 'react';
import { CheckCircle, PartyPopper, Bug, Plus, X } from 'lucide-react';

interface BugsySuccessScreenProps {
  onClose: () => void;
  onNewReport: () => void;
}

export default function BugsySuccessScreen({ onClose, onNewReport }: BugsySuccessScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px] relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
              }}
            >
              <div
                className={`w-2 h-2 ${
                  ['bg-teal-400', 'bg-yellow-400', 'bg-green-400', 'bg-pink-400', 'bg-blue-400'][
                    i % 5
                  ]
                }`}
                style={{
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Success Icon */}
      <div className="relative mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 animate-bounce-once">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-[#0d2626] animate-wiggle">
          <PartyPopper className="w-5 h-5 text-yellow-900" />
        </div>
      </div>

      {/* Success Message */}
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Report Submitted! 🎉
      </h2>
      <p className="text-gray-400 text-center max-w-md mb-2">
        Thanks for reporting this bug! Our team will review it and get back to you.
      </p>

      {/* Bugsy Thank You */}
      <div className="flex items-center gap-3 bg-[#1a3d3d] rounded-2xl px-4 py-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
          <Bug className="w-5 h-5 text-white" />
        </div>
        <p className="text-teal-300 text-sm">
          <span className="font-bold">Bugsy says:</span> "Great job! I'll make sure this gets fixed!"
        </p>
      </div>

      {/* What Happens Next */}
      <div className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4 mb-8 w-full max-w-md">
        <h4 className="text-sm font-medium text-gray-400 mb-3">What happens next?</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-6 h-6 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 text-xs font-bold">1</span>
            </div>
            <span className="text-gray-300">Our team reviews your report</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-6 h-6 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 text-xs font-bold">2</span>
            </div>
            <span className="text-gray-300">We'll investigate and work on a fix</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-6 h-6 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 text-xs font-bold">3</span>
            </div>
            <span className="text-gray-300">You'll be notified when it's resolved</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={onNewReport}
          className="flex-1 py-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Report Another
        </button>

        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes bounce-once {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-10deg);
          }
          75% {
            transform: rotate(10deg);
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out 0.3s;
        }
      `}</style>
    </div>
  );
}
