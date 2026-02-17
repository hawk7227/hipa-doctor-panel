// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// BUGSY GUIDED TOUR — First-time onboarding
// Animated spotlight tooltips walk through each recording tool.
// Stored in localStorage so it only auto-shows once.
// Can be replayed from the "?" help button anytime.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  MousePointer2, MapPin, Pencil, ArrowUpRight, Circle,
  RectangleHorizontal, Highlighter, Type, Palette,
  Pause, Play, Mic, MicOff, Square, Undo2, Trash2,
  Eye, MessageSquare, ChevronRight, ChevronLeft, X,
  Sparkles, Maximize2,
} from 'lucide-react';

// ============================================================================
// TOUR STEPS
// ============================================================================

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  tip?: string;
  animation?: 'click' | 'draw' | 'drag' | 'pulse' | 'type';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Bugsy! 🐛',
    description: 'Your screen is now being recorded. Use these tools to show exactly where the bug is. Talk while you click — your voice is recorded too.',
    icon: Sparkles,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
    tip: 'You can pause recording anytime while reviewing tools',
    animation: 'pulse',
  },
  {
    id: 'click',
    title: 'Click Mode',
    description: 'Click anywhere on the page to drop a numbered yellow marker. Each click is tracked with its position and the element you clicked on.',
    icon: MousePointer2,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
    tip: 'Hover over any marker to see what element it captured. Click the red X to remove it.',
    animation: 'click',
  },
  {
    id: 'pin',
    title: 'Pin Mode',
    description: 'Like click mode, but places blue pins. Use this to mark spots that aren\'t clickable — empty areas, missing elements, or spots where something should be.',
    icon: MapPin,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    tip: 'Great for saying "there should be a button HERE"',
    animation: 'click',
  },
  {
    id: 'draw',
    title: 'Freehand Draw',
    description: 'Draw freely on the screen to circle problems, underline text, or scribble notes. Your drawings are captured in the recording.',
    icon: Pencil,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/20',
    tip: 'Use the color picker to change colors',
    animation: 'draw',
  },
  {
    id: 'shapes',
    title: 'Shapes: Arrow, Circle, Rectangle',
    description: 'Draw precise arrows pointing at problems, circles around broken areas, or rectangles to highlight entire sections.',
    icon: ArrowUpRight,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/20',
    tip: 'Click and drag to create shapes. They snap to clean proportions.',
    animation: 'drag',
  },
  {
    id: 'highlight',
    title: 'Highlight Region',
    description: 'Drag to create a semi-transparent highlight over an area. Useful for marking entire sections that have issues.',
    icon: Highlighter,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    animation: 'drag',
  },
  {
    id: 'text',
    title: 'Text Labels',
    description: 'Click anywhere to drop a text label. Type your note and press Enter. Great for adding "THIS IS BROKEN" or "should say X not Y" directly on screen.',
    icon: Type,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
    tip: 'Press Escape to cancel, Enter to place',
    animation: 'type',
  },
  {
    id: 'controls',
    title: 'Recording Controls',
    description: 'Pause/Resume the recording anytime. Toggle your microphone on/off. Undo your last action. Clear all annotations. Toggle marker visibility. Show live transcript.',
    icon: Pause,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
    tip: 'When done, click the red Stop button to finish and review your report.',
    animation: 'pulse',
  },
];

const STORAGE_KEY = 'bugsy_tour_completed';

// ============================================================================
// COMPONENT
// ============================================================================

interface BugsyTourProps {
  isOpen: boolean;
  onClose: () => void;
  isReplay?: boolean;  // true when opened from "?" button (don't auto-dismiss)
}

export default function BugsyTour({ isOpen, onClose, isReplay = false }: BugsyTourProps) {
  const [step, setStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Mark complete
  const complete = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onClose();
  }, [onClose]);

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { if (step < TOUR_STEPS.length - 1) nextStep(); else complete(); }
      if (e.key === 'ArrowLeft' && step > 0) prevStep();
      if (e.key === 'Escape') complete();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, step]);

  // Animate on step change
  useEffect(() => { setIsAnimating(true); const t = setTimeout(() => setIsAnimating(false), 400); return () => clearTimeout(t); }, [step]);

  const nextStep = () => { if (step < TOUR_STEPS.length - 1) setStep(s => s + 1); };
  const prevStep = () => { if (step > 0) setStep(s => s - 1); };

  if (!isOpen) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center" data-bugsy-ui="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={complete} />

      {/* Card */}
      <div className={`relative w-full max-w-lg mx-4 transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="bg-gradient-to-b from-[#141420] to-[#0e0e18] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-800">
            <div className="h-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-500 ease-out" style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }} />
          </div>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${current.iconBg} flex items-center justify-center border border-white/[0.06]`}>
                <Icon className={`w-6 h-6 ${current.iconColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{current.title}</h3>
                <span className="text-xs text-gray-500">Step {step + 1} of {TOUR_STEPS.length}</span>
              </div>
            </div>
            <button onClick={complete} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>

          {/* Animation area */}
          <div className="px-6 pb-3">
            <div className="h-28 bg-[#0a0a12] rounded-xl border border-white/[0.04] flex items-center justify-center overflow-hidden relative">
              {current.animation === 'click' && <ClickAnimation color={current.iconColor} />}
              {current.animation === 'draw' && <DrawAnimation />}
              {current.animation === 'drag' && <DragAnimation icon={current.id} />}
              {current.animation === 'pulse' && <PulseAnimation icon={Icon} color={current.iconColor} />}
              {current.animation === 'type' && <TypeAnimation />}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-2">
            <p className="text-sm text-gray-300 leading-relaxed">{current.description}</p>
          </div>

          {/* Tip */}
          {current.tip && (
            <div className="px-6 pb-3">
              <div className="flex items-start gap-2 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-teal-300">{current.tip}</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 pb-6 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-teal-400' : i < step ? 'w-1.5 bg-teal-400/50' : 'w-1.5 bg-gray-700'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={prevStep} className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {isFirst && !isReplay && (
                <button onClick={complete} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 rounded-lg transition-colors">Skip tour</button>
              )}
              <button
                onClick={() => { if (isLast) complete(); else nextStep(); }}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                {isLast ? 'Start Recording' : 'Next'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANIMATIONS — Pure CSS/React, no external libs
// ============================================================================

function ClickAnimation({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Fake UI element */}
      <div className="bg-gray-700/50 rounded-lg px-6 py-2 text-gray-400 text-xs border border-gray-600/50">Save Changes</div>
      {/* Animated cursor */}
      <div className="absolute animate-[cursorMove_3s_ease-in-out_infinite]">
        <MousePointer2 className={`w-5 h-5 ${color} drop-shadow-lg`} />
      </div>
      {/* Click ripple */}
      <div className="absolute animate-[clickRipple_3s_ease-in-out_infinite]">
        <div className="w-8 h-8 rounded-full bg-yellow-400/30 animate-ping" style={{ animationDelay: '1.2s' }} />
      </div>
      {/* Marker appearing */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[markerAppear_3s_ease-in-out_infinite]">
        <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-200 flex items-center justify-center shadow-lg shadow-yellow-400/50">
          <span className="text-[9px] font-bold text-yellow-900">1</span>
        </div>
      </div>
      <style jsx>{`
        @keyframes cursorMove { 0%,20% { transform: translate(-40px,30px); opacity: 1; } 40%,60% { transform: translate(0px,0px); opacity: 1; } 70%,100% { transform: translate(0px,0px); opacity: 0; } }
        @keyframes clickRipple { 0%,40% { transform: scale(0); opacity: 0; } 45% { transform: scale(1); opacity: 0.5; } 60%,100% { transform: scale(2); opacity: 0; } }
        @keyframes markerAppear { 0%,50% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 55% { transform: translate(-50%,-50%) scale(1.3); opacity: 1; } 65%,100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

function DrawAnimation() {
  return (
    <div className="relative w-full h-full">
      <svg className="w-full h-full" viewBox="0 0 400 112">
        <path d="M 60 80 C 100 30, 160 90, 200 50 C 240 10, 300 70, 340 40" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" className="animate-[drawPath_3s_ease-in-out_infinite]" strokeDasharray="400" strokeDashoffset="400">
          <animate attributeName="stroke-dashoffset" from="400" to="0" dur="2s" repeatCount="indefinite" />
        </path>
        {/* Cursor following the path */}
        <circle r="4" fill="#22c55e" opacity="0.8">
          <animateMotion dur="2s" repeatCount="indefinite" path="M 60 80 C 100 30, 160 90, 200 50 C 240 10, 300 70, 340 40" />
        </circle>
      </svg>
    </div>
  );
}

function DragAnimation({ icon }: { icon: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="animate-[shapeGrow_3s_ease-in-out_infinite] origin-top-left">
        {icon === 'shapes' ? (
          <svg width="120" height="60" viewBox="0 0 120 60">
            <line x1="10" y1="50" x2="110" y2="10" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            <polygon points="110,10 100,20 106,22" fill="#f97316" />
          </svg>
        ) : (
          <div className="w-32 h-16 border-2 border-amber-400 bg-amber-400/10 rounded-lg" />
        )}
      </div>
      <div className="absolute animate-[dragCursor_3s_ease-in-out_infinite]">
        <MousePointer2 className="w-4 h-4 text-white/70" />
      </div>
      <style jsx>{`
        @keyframes shapeGrow { 0%,15% { transform: scale(0); opacity: 0; } 20% { transform: scale(0.1); opacity: 1; } 70% { transform: scale(1); opacity: 1; } 85%,100% { transform: scale(1); opacity: 0; } }
        @keyframes dragCursor { 0%,15% { transform: translate(-50px, 20px); } 70% { transform: translate(50px, -15px); } 85%,100% { transform: translate(50px, -15px); opacity: 0; } }
      `}</style>
    </div>
  );
}

function PulseAnimation({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div className="relative flex items-center justify-center gap-4">
      <div className="flex items-center gap-2 bg-gray-800/80 rounded-xl px-3 py-2 border border-gray-700/50">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white text-xs font-mono font-bold">01:23</span>
      </div>
      <div className="bg-yellow-500/20 rounded-lg p-2 animate-bounce" style={{ animationDuration: '2s' }}>
        <Pause className="w-4 h-4 text-yellow-400" />
      </div>
      <div className="bg-green-500/20 rounded-lg p-2">
        <Mic className="w-4 h-4 text-green-400 animate-pulse" />
      </div>
      <div className="bg-red-500 rounded-xl px-3 py-1.5 animate-pulse" style={{ animationDuration: '3s' }}>
        <span className="text-white text-xs font-bold flex items-center gap-1"><Square className="w-3 h-3" /> Stop</span>
      </div>
    </div>
  );
}

function TypeAnimation() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-black/80 border border-cyan-400 rounded-lg px-3 py-1.5 flex items-center">
        <span className="text-cyan-300 text-sm font-bold animate-[typeText_3s_steps(12)_infinite] overflow-hidden whitespace-nowrap" style={{ width: '0ch' }}>THIS IS BROKEN</span>
        <span className="text-cyan-400 animate-pulse ml-0.5">|</span>
      </div>
      <style jsx>{`
        @keyframes typeText { 0% { width: 0ch; } 10% { width: 0ch; } 80% { width: 14ch; } 100% { width: 14ch; } }
      `}</style>
    </div>
  );
}

// ============================================================================
// UTILITY — check if tour should auto-show
// ============================================================================

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return false; // SSR or no localStorage
  }
}
