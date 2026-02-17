// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client';

// ============================================================================
// CHAT BUBBLE - SMS-style floating message bubble
// Appears at specific screen positions tied to recording timeline
// ============================================================================

import { useEffect, useState, CSSProperties } from 'react';

export interface ChatMessage {
  id: string;
  from: 'bugsy' | 'doctor';
  text: string;
  x: number;        // percent position on screen
  y: number;        // percent position on screen
  timestamp?: number; // ms into recording
  options?: string[]; // clickable response options
}

interface ChatBubbleProps {
  message: ChatMessage;
  onOptionClick?: (option: string) => void;
  animateIn?: boolean;
}

export default function ChatBubble({ message, onOptionClick, animateIn = true }: ChatBubbleProps) {
  const [visible, setVisible] = useState(!animateIn);
  const [typing, setTyping] = useState(animateIn && message.from === 'bugsy');

  useEffect(() => {
    if (animateIn) {
      if (message.from === 'bugsy') {
        // Show typing indicator, then reveal
        const typingTimer = setTimeout(() => {
          setTyping(false);
          setVisible(true);
        }, 800 + Math.random() * 400);
        return () => clearTimeout(typingTimer);
      } else {
        const timer = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [animateIn, message.from]);

  const isBugsy = message.from === 'bugsy';

  // Position bubble near the relevant screen location
  // Clamp so it doesn't go off-screen
  const clampedX = Math.max(5, Math.min(message.x, 65));
  const clampedY = Math.max(5, Math.min(message.y, 75));

  const bubbleStyle: CSSProperties = {
    position: 'absolute',
    left: `${clampedX}%`,
    top: `${clampedY}%`,
    maxWidth: '320px',
    minWidth: '120px',
    zIndex: 10001,
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    opacity: visible || typing ? 1 : 0,
    transform: visible || typing ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
    pointerEvents: 'auto' as const,
  };

  // Typing indicator
  if (typing) {
    return (
      <div style={bubbleStyle}>
        <div className="bg-[#1a3d3d] rounded-2xl rounded-bl-sm px-4 py-3 border border-teal-500/30 shadow-lg shadow-black/30 inline-flex gap-1.5">
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div style={bubbleStyle}>
      <div
        className={`rounded-2xl px-4 py-3 shadow-lg shadow-black/30 border ${
          isBugsy
            ? 'bg-[#1a3d3d] border-teal-500/30 rounded-bl-sm text-white'
            : 'bg-teal-500 border-teal-400/50 rounded-br-sm text-white ml-auto'
        }`}
      >
        {/* Sender label */}
        <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
          isBugsy ? 'text-teal-400' : 'text-teal-100'
        }`}>
          {isBugsy ? '🐛 Bugsy' : 'You'}
        </span>

        {/* Message text */}
        <p className="text-sm leading-relaxed">{message.text}</p>

        {/* Quick reply options */}
        {message.options && message.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.options.map((option) => (
              <button
                key={option}
                onClick={() => onOptionClick?.(option)}
                className="px-3 py-1.5 text-xs font-medium bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 hover:text-white rounded-full border border-teal-500/30 hover:border-teal-400 transition-all duration-200 cursor-pointer"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Little tail/arrow */}
      <div
        className={`absolute w-3 h-3 rotate-45 ${
          isBugsy
            ? 'bg-[#1a3d3d] border-l border-b border-teal-500/30 -bottom-1.5 left-4'
            : 'bg-teal-500 border-r border-b border-teal-400/50 -bottom-1.5 right-4'
        }`}
      />
    </div>
  );
}
