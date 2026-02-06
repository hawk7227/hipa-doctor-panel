'use client';

// ============================================================================
// BUGSY CHARACTER - Animated 2D SVG Bug
// Moves to positions, blinks, talks, bounces, points
// ============================================================================

import { useEffect, useState, useRef, CSSProperties } from 'react';

export type BugsyMood = 'idle' | 'walking' | 'talking' | 'thinking' | 'happy' | 'pointing' | 'listening';

interface BugsyCharacterProps {
  x: number;
  y: number;
  mood?: BugsyMood;
  size?: number;
  facingRight?: boolean;
  className?: string;
}

export default function BugsyCharacter({
  x,
  y,
  mood = 'idle',
  size = 80,
  facingRight = true,
  className = '',
}: BugsyCharacterProps) {
  const [blinking, setBlinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const talkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Blink randomly
  useEffect(() => {
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 150);
    };
    const interval = setInterval(() => {
      if (Math.random() > 0.5) blink();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Mouth animation when talking
  useEffect(() => {
    if (mood === 'talking') {
      talkIntervalRef.current = setInterval(() => {
        setMouthOpen(prev => !prev);
      }, 120);
    } else {
      setMouthOpen(false);
      if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
    }
    return () => {
      if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
    };
  }, [mood]);

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: x - size / 2,
    top: y - size,
    width: size,
    height: size,
    transition: mood === 'walking' ? 'left 0.8s ease-in-out, top 0.8s ease-in-out' : 'left 0.3s ease, top 0.3s ease',
    transform: `scaleX(${facingRight ? 1 : -1})`,
    zIndex: 9999,
    pointerEvents: 'none' as const,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
  };

  const bounceClass =
    mood === 'idle' ? 'animate-bugsy-bounce' :
    mood === 'thinking' ? 'animate-bugsy-think' :
    mood === 'happy' ? 'animate-bugsy-wiggle' :
    '';

  return (
    <>
      {/* Inject keyframes */}
      <style jsx global>{`
        @keyframes bugsy-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bugsy-think {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(-3deg); }
          75% { transform: translateY(-2px) rotate(3deg); }
        }
        @keyframes bugsy-wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes bugsy-walk-legs {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
        }
        @keyframes bugsy-antenna-sway {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
        .animate-bugsy-bounce { animation: bugsy-bounce 1.5s ease-in-out infinite; }
        .animate-bugsy-think { animation: bugsy-think 2s ease-in-out infinite; }
        .animate-bugsy-wiggle { animation: bugsy-wiggle 0.4s ease-in-out 3; }
        .animate-bugsy-walk-legs { animation: bugsy-walk-legs 0.3s ease-in-out infinite; }
        .animate-bugsy-antenna { animation: bugsy-antenna-sway 2s ease-in-out infinite; }
      `}</style>

      <div style={containerStyle} className={className}>
        <div className={bounceClass} style={{ width: '100%', height: '100%' }}>
          <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
            {/* Body segments (caterpillar) */}
            {/* Back segment */}
            <ellipse cx="62" cy="68" rx="18" ry="15"
              fill="#2dd4a8" stroke="#1a9a7a" strokeWidth="1.5"
            />
            {/* Middle segment */}
            <ellipse cx="45" cy="64" rx="19" ry="16"
              fill="#34d9b0" stroke="#1a9a7a" strokeWidth="1.5"
            />
            {/* Front/head segment */}
            <ellipse cx="28" cy="58" rx="21" ry="18"
              fill="#3ee0b8" stroke="#1a9a7a" strokeWidth="1.5"
            />

            {/* Belly highlight */}
            <ellipse cx="28" cy="62" rx="12" ry="8"
              fill="#6eecd0" opacity="0.4"
            />
            <ellipse cx="45" cy="68" rx="10" ry="6"
              fill="#6eecd0" opacity="0.3"
            />

            {/* Legs */}
            <g className={mood === 'walking' ? 'animate-bugsy-walk-legs' : ''} style={{ transformOrigin: '45px 75px' }}>
              {/* Front legs */}
              <line x1="22" y1="72" x2="15" y2="85" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="30" y1="74" x2="25" y2="87" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
              {/* Middle legs */}
              <line x1="42" y1="76" x2="38" y2="89" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="50" y1="76" x2="52" y2="89" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
              {/* Back legs */}
              <line x1="58" y1="76" x2="60" y2="88" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="66" y1="74" x2="72" y2="86" stroke="#1a9a7a" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Antennae */}
            <g className="animate-bugsy-antenna" style={{ transformOrigin: '22px 48px' }}>
              <path d="M 22 48 Q 14 30 8 22" stroke="#1a9a7a" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="8" cy="22" r="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            </g>
            <g className="animate-bugsy-antenna" style={{ transformOrigin: '32px 46px', animationDelay: '0.5s' }}>
              <path d="M 32 46 Q 36 28 42 20" stroke="#1a9a7a" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="42" cy="20" r="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            </g>

            {/* Eyes */}
            {blinking ? (
              <>
                <line x1="20" y1="55" x2="26" y2="55" stroke="#0f5c4a" strokeWidth="2" strokeLinecap="round" />
                <line x1="32" y1="53" x2="38" y2="53" stroke="#0f5c4a" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Left eye */}
                <ellipse cx="23" cy="54" rx="5" ry="5.5" fill="white" stroke="#0f5c4a" strokeWidth="1" />
                <circle cx="24" cy="54" r="2.5" fill="#0f5c4a" />
                <circle cx="25" cy="53" r="1" fill="white" />
                {/* Right eye */}
                <ellipse cx="35" cy="52" rx="5" ry="5.5" fill="white" stroke="#0f5c4a" strokeWidth="1" />
                <circle cx="36" cy="52" r="2.5" fill="#0f5c4a" />
                <circle cx="37" cy="51" r="1" fill="white" />
              </>
            )}

            {/* Mouth */}
            {mouthOpen ? (
              <ellipse cx="29" cy="64" rx="4" ry="3" fill="#0f5c4a" />
            ) : (
              <path d="M 25 63 Q 29 67 33 63" stroke="#0f5c4a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            )}

            {/* Cheek blush */}
            <circle cx="17" cy="60" r="3" fill="#f9a8d4" opacity="0.3" />
            <circle cx="40" cy="58" r="3" fill="#f9a8d4" opacity="0.3" />

            {/* Pointing indicator (when mood is pointing) */}
            {mood === 'pointing' && (
              <g>
                <circle cx="8" cy="22" r="5" fill="#fbbf24" opacity="0.4">
                  <animate attributeName="r" values="3;6;3" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </svg>
        </div>
      </div>
    </>
  );
}
