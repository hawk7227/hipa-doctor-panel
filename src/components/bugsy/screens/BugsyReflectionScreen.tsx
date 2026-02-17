// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY REFLECTION SCREEN - AI Playback & Confirmation
// Version: 1.0.0
// ============================================================================

import { useState } from 'react';
import { Check, X, RefreshCw, Edit3, MessageCircle, MapPin, Sparkles } from 'lucide-react';
import type { TranscriptData, AnalysisResult, ScreenMarker } from '@/types/bugsy';

interface BugsyReflectionScreenProps {
  transcript: TranscriptData;
  analysis: AnalysisResult;
  markers: ScreenMarker[];
  onConfirm: () => void;
  onCorrect: (corrections: string[]) => void;
  onReRecord: () => void;
}

export default function BugsyReflectionScreen({
  transcript,
  analysis,
  markers,
  onConfirm,
  onCorrect,
  onReRecord,
}: BugsyReflectionScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [corrections, setCorrections] = useState('');

  const handleCorrect = () => {
    if (corrections.trim()) {
      onCorrect([corrections.trim()]);
    }
    setIsEditing(false);
  };

  // Build reflection summary
  const buildReflectionText = (): string => {
    const parts: string[] = [];

    if (analysis.problem_identified) {
      parts.push(`You're having trouble with ${analysis.problem_identified}.`);
    } else if (transcript.full_text) {
      // Extract key issue from transcript
      const text = transcript.full_text.toLowerCase();
      if (text.includes("can't") || text.includes('cannot')) {
        parts.push("It sounds like something isn't working as expected.");
      } else if (text.includes('error') || text.includes('wrong')) {
        parts.push("You encountered an error or something went wrong.");
      } else if (text.includes('stuck') || text.includes('frozen')) {
        parts.push("The interface appears to be stuck or unresponsive.");
      } else {
        parts.push("You're experiencing an issue with the system.");
      }
    }

    if (analysis.elements_involved?.length > 0) {
      const element = analysis.elements_involved[0];
      parts.push(`This happened when interacting with the ${element}.`);
    } else if (markers.length > 0) {
      parts.push(`I noticed you clicked on ${markers.length} element${markers.length > 1 ? 's' : ''}.`);
    }

    if (analysis.components_identified?.length > 0) {
      parts.push(`This seems related to the ${analysis.components_identified[0]} component.`);
    }

    return parts.join(' ') || "I've captured your report. Let me make sure I understood correctly.";
  };

  return (
    <div className="flex flex-col p-6">
      {/* Bugsy Avatar with speech bubble */}
      <div className="flex gap-4 mb-6">
        <div className="flex-shrink-0">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-2xl">🐛</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-[#1a3d3d] rounded-2xl rounded-tl-none p-4 relative">
            <div className="flex items-start gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
              <p className="text-white leading-relaxed">{buildReflectionText()}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-teal-400">
              <Sparkles className="w-3 h-3" />
              <span>AI-generated summary</span>
            </div>
          </div>
        </div>
      </div>

      {/* What I Captured */}
      <div className="bg-[#0a1f1f] rounded-xl border border-teal-500/20 p-4 mb-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-400" />
          What I captured
        </h4>

        <div className="space-y-3">
          {/* Transcript */}
          {transcript.full_text && (
            <div className="bg-[#0d2626] rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">Your words:</span>
              <p className="text-gray-300 text-sm italic">"{transcript.full_text}"</p>
            </div>
          )}

          {/* Click markers */}
          {markers.length > 0 && (
            <div className="bg-[#0d2626] rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-2">Click points:</span>
              <div className="flex flex-wrap gap-2">
                {markers.slice(0, 5).map((marker, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs rounded"
                  >
                    {marker.element_tag || 'element'} #{marker.number}
                  </span>
                ))}
                {markers.length > 5 && (
                  <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                    +{markers.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Identified components */}
          {analysis.components_identified?.length > 0 && (
            <div className="bg-[#0d2626] rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-2">Related components:</span>
              <div className="flex flex-wrap gap-2">
                {analysis.components_identified.map((comp, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Correction Input */}
      {isEditing && (
        <div className="bg-[#0a1f1f] rounded-xl border border-yellow-500/20 p-4 mb-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Correct my understanding
          </h4>
          <textarea
            value={corrections}
            onChange={(e) => setCorrections(e.target.value)}
            placeholder="Tell me what I got wrong or add more details..."
            className="w-full bg-[#0d2626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCorrect}
              disabled={!corrections.trim()}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              Save Correction
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 mt-auto pt-4">
        <button
          onClick={onConfirm}
          className="w-full py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Yes, that's right!
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Not quite right
          </button>

          <button
            onClick={onReRecord}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Re-record
          </button>
        </div>
      </div>
    </div>
  );
}
