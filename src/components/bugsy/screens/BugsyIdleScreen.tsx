// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY IDLE SCREEN - Welcome & Start Recording
// Version: 1.0.0
// ============================================================================

import { Mic, Monitor, MessageCircle, Sparkles, Shield } from 'lucide-react';

interface BugsyIdleScreenProps {
  onStart: () => void;
}

export default function BugsyIdleScreen({ onStart }: BugsyIdleScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      {/* Bugsy Avatar */}
      <div className="relative mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-xl shadow-teal-500/30 animate-pulse">
          <span className="text-5xl">🐛</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-[#0d2626]">
          <Sparkles className="w-4 h-4 text-yellow-900" />
        </div>
      </div>

      {/* Welcome Message */}
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Hi! I'm Bugsy 👋
      </h2>
      <p className="text-gray-400 text-center max-w-md mb-8">
        I'll help you report bugs quickly and accurately. Just show me what went wrong!
      </p>

      {/* How it Works */}
      <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-lg">
        <div className="flex flex-col items-center text-center p-3">
          <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-2">
            <Monitor className="w-6 h-6 text-teal-400" />
          </div>
          <span className="text-xs text-gray-400">Show me the bug</span>
        </div>
        <div className="flex flex-col items-center text-center p-3">
          <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-2">
            <Mic className="w-6 h-6 text-teal-400" />
          </div>
          <span className="text-xs text-gray-400">Tell me what happened</span>
        </div>
        <div className="flex flex-col items-center text-center p-3">
          <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-2">
            <MessageCircle className="w-6 h-6 text-teal-400" />
          </div>
          <span className="text-xs text-gray-400">I'll handle the rest</span>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        className="group relative px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-teal-500/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Mic className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-lg">Start Recording</div>
            <div className="text-xs text-teal-200 font-normal">Screen + Voice</div>
          </div>
        </div>

        {/* Pulse Animation */}
        <div className="absolute inset-0 rounded-xl bg-teal-400 animate-ping opacity-20 pointer-events-none" />
      </button>

      {/* Privacy Note */}
      <div className="flex items-center gap-2 mt-6 text-xs text-gray-500">
        <Shield className="w-3 h-3" />
        <span>Recording stays within Medazon. Never shared externally.</span>
      </div>
    </div>
  );
}
