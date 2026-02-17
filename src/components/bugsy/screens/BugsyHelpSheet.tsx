// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client';

// ============================================================================
// BUGSY HELP SHEET — Tool cheat sheet with animated demos
// Persistent "?" button that opens a slide-out panel showing every tool.
// Each tool has an icon, name, description, and mini animated preview.
// ============================================================================

import { useState } from 'react';
import {
  HelpCircle, X, MousePointer2, MapPin, Pencil, ArrowUpRight,
  Circle, RectangleHorizontal, Highlighter, Type, Palette,
  Pause, Play, Mic, MicOff, Undo2, Trash2, Eye, EyeOff,
  MessageSquare, Square, Maximize2, Keyboard,
} from 'lucide-react';

// ============================================================================
// TOOL DATA
// ============================================================================

interface ToolInfo {
  icon: any;
  name: string;
  shortcut?: string;
  description: string;
  color: string;
  bg: string;
  demo?: 'marker' | 'pin' | 'freehand' | 'arrow' | 'circle' | 'rect' | 'highlight' | 'text';
}

const ANNOTATION_TOOLS: ToolInfo[] = [
  { icon: MousePointer2, name: 'Click', description: 'Click elements to drop numbered yellow markers that track what you clicked', color: 'text-yellow-400', bg: 'bg-yellow-500/15', demo: 'marker' },
  { icon: MapPin, name: 'Pin', description: 'Place blue pins anywhere — mark spots where elements are missing or broken', color: 'text-blue-400', bg: 'bg-blue-500/15', demo: 'pin' },
  { icon: Pencil, name: 'Freehand Draw', description: 'Draw freely to circle bugs, underline text, or sketch what\'s wrong', color: 'text-green-400', bg: 'bg-green-500/15', demo: 'freehand' },
  { icon: ArrowUpRight, name: 'Arrow', description: 'Drag to draw arrows pointing at problem areas', color: 'text-orange-400', bg: 'bg-orange-500/15', demo: 'arrow' },
  { icon: Circle, name: 'Circle', description: 'Drag to draw circles around broken UI elements', color: 'text-pink-400', bg: 'bg-pink-500/15', demo: 'circle' },
  { icon: RectangleHorizontal, name: 'Rectangle', description: 'Drag to draw boxes around entire sections', color: 'text-purple-400', bg: 'bg-purple-500/15', demo: 'rect' },
  { icon: Highlighter, name: 'Highlight', description: 'Drag to create a translucent highlight over a region', color: 'text-amber-400', bg: 'bg-amber-500/15', demo: 'highlight' },
  { icon: Type, name: 'Text Label', description: 'Click to place a text note anywhere on screen. Press Enter to confirm.', color: 'text-cyan-400', bg: 'bg-cyan-500/15', demo: 'text' },
  { icon: Palette, name: 'Color Picker', description: 'Change the drawing color — 7 colors available', color: 'text-gray-300', bg: 'bg-white/10' },
];

const CONTROL_TOOLS: ToolInfo[] = [
  { icon: Pause, name: 'Pause / Resume', description: 'Pause the recording while you think, resume when ready', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  { icon: Mic, name: 'Microphone', description: 'Toggle your microphone on/off during recording', color: 'text-green-400', bg: 'bg-green-500/15' },
  { icon: Undo2, name: 'Undo', description: 'Undo your last annotation (up to 20 levels)', color: 'text-gray-300', bg: 'bg-white/10' },
  { icon: Trash2, name: 'Clear All', description: 'Remove all markers and drawings at once', color: 'text-red-400', bg: 'bg-red-500/15' },
  { icon: Eye, name: 'Show / Hide', description: 'Toggle marker visibility without deleting them', color: 'text-teal-400', bg: 'bg-teal-500/15' },
  { icon: MessageSquare, name: 'Transcript', description: 'Show a live preview of what your voice is picking up', color: 'text-teal-400', bg: 'bg-teal-500/15' },
  { icon: Maximize2, name: 'Expand', description: 'Switch between the compact bar and full control panel', color: 'text-gray-300', bg: 'bg-white/10' },
  { icon: Square, name: 'Stop', description: 'Stop recording and go to the review screen', color: 'text-red-400', bg: 'bg-red-500/15' },
];

const SHORTCUTS = [
  { keys: 'Click anywhere', desc: 'Drop marker (in Click/Pin mode)' },
  { keys: 'Click + Drag', desc: 'Draw shape (in Draw/Arrow/Circle/Rect mode)' },
  { keys: 'Hover marker → X', desc: 'Remove individual marker' },
  { keys: 'Enter', desc: 'Confirm text label' },
  { keys: 'Escape', desc: 'Cancel text label' },
];

// ============================================================================
// COMPONENT
// ============================================================================

interface BugsyHelpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTour: () => void;
}

export default function BugsyHelpSheet({ isOpen, onClose, onReplayTour }: BugsyHelpSheetProps) {
  const [tab, setTab] = useState<'tools' | 'controls' | 'tips'>('tools');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10004] flex items-end sm:items-center justify-center sm:justify-end" data-bugsy-ui="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:w-[380px] max-h-[85vh] sm:max-h-[90vh] sm:mr-4 bg-[#111119] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] sm:animate-[slideIn_0.3s_ease-out]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center"><HelpCircle className="w-4 h-4 text-teal-400" /></div>
            <div><h3 className="text-sm font-bold text-white">Recording Tools</h3><p className="text-[10px] text-gray-500">Quick reference guide</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          {([['tools', 'Annotation'], ['controls', 'Controls'], ['tips', 'Tips']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === key ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-500 hover:text-gray-300'}`}>{label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tab === 'tools' && ANNOTATION_TOOLS.map((t, i) => (
            <ToolCard key={i} tool={t} />
          ))}

          {tab === 'controls' && CONTROL_TOOLS.map((t, i) => (
            <ToolCard key={i} tool={t} />
          ))}

          {tab === 'tips' && (
            <div className="space-y-4">
              {/* Shortcuts */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Keyboard className="w-3 h-3" /> Quick Actions</h4>
                <div className="space-y-1.5">
                  {SHORTCUTS.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="text-[11px] bg-gray-800 px-2 py-0.5 rounded font-mono text-gray-300 whitespace-nowrap">{s.keys}</span>
                      <span className="text-xs text-gray-400">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best practices */}
              <div>
                <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Best Practices</h4>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>🗣 <strong className="text-white">Talk while you click</strong> — voice + visual is the best bug report</p>
                  <p>🎯 <strong className="text-white">Click the broken element</strong> — markers capture what you clicked on</p>
                  <p>✏️ <strong className="text-white">Draw arrows</strong> to point at specific problems</p>
                  <p>📝 <strong className="text-white">Add text labels</strong> like "should say X" or "this button doesn't work"</p>
                  <p>⏸ <strong className="text-white">Pause anytime</strong> to think about what to show next</p>
                  <p>↩️ <strong className="text-white">Undo mistakes</strong> — don't worry about messy annotations</p>
                </div>
              </div>

              {/* Replay tour */}
              <button onClick={() => { onClose(); onReplayTour(); }} className="w-full py-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors">
                <Play className="w-4 h-4" /> Replay Guided Tour
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ============================================================================
// TOOL CARD with mini animation
// ============================================================================

function ToolCard({ tool }: { tool: ToolInfo }) {
  const Icon = tool.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-colors group">
      <div className={`w-9 h-9 rounded-lg ${tool.bg} flex items-center justify-center flex-shrink-0 border border-white/[0.04]`}>
        <Icon className={`w-4 h-4 ${tool.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{tool.name}</span>
          {tool.demo && <MiniDemo type={tool.demo} color={tool.color} />}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tool.description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MINI ANIMATED DEMOS — tiny previews next to each tool
// ============================================================================

function MiniDemo({ type, color }: { type: string; color: string }) {
  const base = "w-12 h-5 rounded overflow-hidden bg-gray-800/50 flex items-center justify-center";

  switch (type) {
    case 'marker':
      return <div className={base}><div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" style={{ animationDuration: '2s' }} /><div className="w-3 h-3 rounded-full bg-yellow-400/40 ml-0.5 animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} /></div>;
    case 'pin':
      return <div className={base}><div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDuration: '2s' }} /></div>;
    case 'freehand':
      return (
        <div className={base}>
          <svg width="40" height="16" viewBox="0 0 40 16"><path d="M 4 12 C 10 2, 20 14, 30 6 L 36 4" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="40"><animate attributeName="stroke-dashoffset" from="40" to="0" dur="2s" repeatCount="indefinite" /></path></svg>
        </div>
      );
    case 'arrow':
      return (
        <div className={base}>
          <svg width="40" height="16" viewBox="0 0 40 16"><line x1="4" y1="12" x2="32" y2="4" stroke="#f97316" strokeWidth="1.5" strokeDasharray="30" strokeDashoffset="30"><animate attributeName="stroke-dashoffset" from="30" to="0" dur="1.5s" repeatCount="indefinite" /></line><polygon points="32,4 26,6 28,8" fill="#f97316" opacity="0"><animate attributeName="opacity" from="0" to="1" dur="1.5s" repeatCount="indefinite" /></polygon></svg>
        </div>
      );
    case 'circle':
      return (
        <div className={base}>
          <svg width="40" height="16" viewBox="0 0 40 16"><circle cx="20" cy="8" r="6" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="38" strokeDashoffset="38"><animate attributeName="stroke-dashoffset" from="38" to="0" dur="2s" repeatCount="indefinite" /></circle></svg>
        </div>
      );
    case 'rect':
      return (
        <div className={base}>
          <svg width="40" height="16" viewBox="0 0 40 16"><rect x="6" y="2" width="28" height="12" rx="2" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="80" strokeDashoffset="80"><animate attributeName="stroke-dashoffset" from="80" to="0" dur="2s" repeatCount="indefinite" /></rect></svg>
        </div>
      );
    case 'highlight':
      return (
        <div className={base}>
          <div className="w-8 h-3 bg-amber-400/20 border border-amber-400/40 rounded-sm animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
      );
    case 'text':
      return (
        <div className={base}>
          <span className="text-[8px] font-bold text-cyan-400 animate-pulse" style={{ animationDuration: '2s' }}>Bug!</span>
        </div>
      );
    default:
      return null;
  }
}

// ============================================================================
// HELP BUTTON — Persistent "?" button shown on recording bar
// ============================================================================

interface HelpButtonProps {
  onClick: () => void;
}

export function BugsyHelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-teal-500/20 text-gray-400 hover:text-teal-400 transition-colors"
      title="Help — Recording Tools Guide"
      data-bugsy-ui="true"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );
}
