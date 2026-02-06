'use client';

// ============================================================================
// BUGSY ERROR SCREEN - Error Handling
// Version: 1.0.0
// ============================================================================

import { AlertCircle, RefreshCw, X, Bug, MessageCircle } from 'lucide-react';

interface BugsyErrorScreenProps {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export default function BugsyErrorScreen({ error, onRetry, onClose }: BugsyErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      {/* Error Icon */}
      <div className="relative mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 animate-pulse">
          <AlertCircle className="w-12 h-12 text-white" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-[#0d2626]">
          <span className="text-lg">😅</span>
        </div>
      </div>

      {/* Error Message */}
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Oops! Something went wrong
      </h2>
      <p className="text-gray-400 text-center max-w-md mb-4">
        {error || "We couldn't submit your report. Don't worry, these things happen!"}
      </p>

      {/* Bugsy Apology */}
      <div className="flex items-center gap-3 bg-[#1a3d3d] rounded-2xl px-4 py-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
          <Bug className="w-5 h-5 text-white" />
        </div>
        <p className="text-teal-300 text-sm">
          <span className="font-bold">Bugsy says:</span> "My bad! Let's try that again."
        </p>
      </div>

      {/* Troubleshooting Tips */}
      <div className="bg-[#0a1f1f] rounded-xl border border-red-500/20 p-4 mb-8 w-full max-w-md">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-red-400" />
          Things to try
        </h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-red-400">•</span>
            <span>Check your internet connection</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400">•</span>
            <span>Make sure you're still logged in</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400">•</span>
            <span>Try refreshing the page and starting over</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={onRetry}
          className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>

        <button
          onClick={onClose}
          className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5" />
          Close
        </button>
      </div>
    </div>
  );
}
