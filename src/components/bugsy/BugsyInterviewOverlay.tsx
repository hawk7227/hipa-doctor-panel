'use client';

// ============================================================================
// BUGSY INTERVIEW OVERLAY
// Version: 1.0.0
//
// Full-screen overlay experience:
// - Recording plays back as background video
// - Bugsy walks to where the doctor clicked
// - Chat bubbles appear at those locations
// - Doctor responds via quick-reply buttons or text input
// - Feels like texting with a character that lives on your screen
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, RotateCcw } from 'lucide-react';
import BugsyCharacter from './BugsyCharacter';
import type { BugsyMood } from './BugsyCharacter';
import ChatBubble from './ChatBubble';
import type { ChatMessage } from './ChatBubble';
import type {
  TranscriptData,
  AnalysisResult,
  ScreenMarker,
  InteractionEvent,
  RecordingData,
} from '@/types/bugsy';

interface BugsyInterviewOverlayProps {
  recording: RecordingData;
  transcript: TranscriptData;
  analysis: AnalysisResult;
  markers: ScreenMarker[];
  interactions: InteractionEvent[];
  onConfirm: () => void;
  onCorrect: (corrections: string[]) => void;
  onReRecord: () => void;
  onAnswer: (questionKey: string, answer: string | string[] | null) => void;
  onClose: () => void;
}

// ============================================================================
// INTERVIEW STEP DEFINITIONS
// ============================================================================

type InterviewStep =
  | 'greeting'
  | 'reflect'
  | 'confirm'
  | 'ask_expected'
  | 'ask_frequency'
  | 'ask_anything_else'
  | 'thanks'
  | 'done';

const STEP_ORDER: InterviewStep[] = [
  'greeting',
  'reflect',
  'confirm',
  'ask_expected',
  'ask_frequency',
  'ask_anything_else',
  'thanks',
  'done',
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function BugsyInterviewOverlay({
  recording,
  transcript,
  analysis,
  markers,
  interactions,
  onConfirm,
  onCorrect,
  onReRecord,
  onAnswer,
  onClose,
}: BugsyInterviewOverlayProps) {
  // State
  const [currentStep, setCurrentStep] = useState<InterviewStep>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bugsyPos, setBugsyPos] = useState({ x: 50, y: 80 }); // percent
  const [bugsyMood, setBugsyMood] = useState<BugsyMood>('idle');
  const [bugsyFacing, setBugsyFacing] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [videoTime, setVideoTime] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const messageIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const nextMsgId = () => `msg-${++messageIdRef.current}`;

  // ============================================================================
  // INITIAL SEQUENCE
  // ============================================================================

  useEffect(() => {
    // Start the interview sequence
    runStep('greeting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // VIDEO PLAYBACK
  // ============================================================================

  useEffect(() => {
    if (videoRef.current && recording.video_url) {
      videoRef.current.playbackRate = 1;
      // Don't autoplay — we control when to play based on conversation
    }
  }, [recording.video_url]);

  const playVideoSegment = useCallback((startSec: number, endSec: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = startSec;
    videoRef.current.play();
    const checkTime = () => {
      if (videoRef.current && videoRef.current.currentTime >= endSec) {
        videoRef.current.pause();
      } else {
        requestAnimationFrame(checkTime);
      }
    };
    requestAnimationFrame(checkTime);
  }, []);

  // ============================================================================
  // BUGSY MOVEMENT
  // ============================================================================

  const moveBugsyTo = useCallback((xPercent: number, yPercent: number, callback?: () => void) => {
    setBugsyMood('walking');
    setBugsyFacing(xPercent > bugsyPos.x);
    setBugsyPos({ x: xPercent, y: yPercent });
    setTimeout(() => {
      setBugsyMood('idle');
      callback?.();
    }, 900);
  }, [bugsyPos.x]);

  const moveBugsyToMarker = useCallback((markerIndex: number, callback?: () => void) => {
    const marker = markers[markerIndex];
    if (marker) {
      moveBugsyTo(marker.x_percent, marker.y_percent, callback);
    } else {
      moveBugsyTo(50, 70, callback);
    }
  }, [markers, moveBugsyTo]);

  // ============================================================================
  // ADD MESSAGE HELPER
  // ============================================================================

  const addBugsyMessage = useCallback((text: string, x: number, y: number, options?: string[]) => {
    const msg: ChatMessage = {
      id: nextMsgId(),
      from: 'bugsy',
      text,
      x,
      y,
      options,
    };
    setMessages(prev => [...prev, msg]);
    setBugsyMood('talking');
    setTimeout(() => setBugsyMood('idle'), 1500);
    return msg.id;
  }, []);

  const addDoctorMessage = useCallback((text: string, x: number, y: number) => {
    const msg: ChatMessage = {
      id: nextMsgId(),
      from: 'doctor',
      text,
      x: x + 15,
      y,
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  // ============================================================================
  // STEP RUNNER
  // ============================================================================

  const runStep = useCallback((step: InterviewStep) => {
    setCurrentStep(step);

    switch (step) {
      case 'greeting': {
        // Bugsy appears at bottom center, says hey
        setTimeout(() => {
          moveBugsyTo(50, 75, () => {
            addBugsyMessage(
              "Hey! Thanks for showing me that. Let me play back what you did and make sure I got it right.",
              30, 55
            );
            // After greeting, move to reflect
            setTimeout(() => runStep('reflect'), 2500);
          });
        }, 500);
        break;
      }

      case 'reflect': {
        // Move Bugsy to the first marker location
        const firstMarker = markers[0];
        const targetX = firstMarker?.x_percent || 40;
        const targetY = firstMarker?.y_percent || 50;

        // Play the video from beginning
        if (videoRef.current && recording.video_url) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }

        setTimeout(() => {
          moveBugsyToMarker(0, () => {
            setBugsyMood('pointing');

            // Build plain-language reflection
            const doctorWords = transcript.full_text?.trim();
            let reflectionText: string;

            if (doctorWords && doctorWords.length > 10) {
              reflectionText = `So you said: "${doctorWords}"`;
            } else if (markers.length > 0) {
              const clickedOn = markers
                .map(m => m.element_text?.trim())
                .filter(Boolean)
                .slice(0, 2);
              if (clickedOn.length > 0) {
                reflectionText = `I saw you click on ${clickedOn.map(c => `"${c}"`).join(' and ')}`;
              } else {
                reflectionText = `I saw you clicking around this area`;
              }
            } else {
              reflectionText = `I captured your screen — let me know what the issue was`;
            }

            addBugsyMessage(reflectionText, targetX > 50 ? targetX - 35 : targetX + 5, targetY - 15);

            // Pause video after a bit
            setTimeout(() => {
              if (videoRef.current) videoRef.current.pause();
              runStep('confirm');
            }, 2000);
          });
        }, 800);
        break;
      }

      case 'confirm': {
        const targetX = markers[0]?.x_percent || 40;
        const targetY = markers[0]?.y_percent || 50;

        setTimeout(() => {
          addBugsyMessage(
            "Did I get that right?",
            targetX > 50 ? targetX - 30 : targetX + 5,
            targetY + 5,
            ["Yes, that's right", "Not exactly — let me explain"]
          );
        }, 600);
        break;
      }

      case 'ask_expected': {
        moveBugsyTo(45, 65, () => {
          addBugsyMessage(
            "What were you expecting to happen instead?",
            20, 45,
          );
          setShowInput(true);
        });
        break;
      }

      case 'ask_frequency': {
        moveBugsyTo(55, 65, () => {
          addBugsyMessage(
            "Does this happen every time or just sometimes?",
            25, 45,
            ["Every time", "Sometimes", "First time I noticed"]
          );
        });
        break;
      }

      case 'ask_anything_else': {
        moveBugsyTo(50, 70, () => {
          addBugsyMessage(
            "Anything else you want me to pass along to the team?",
            20, 50,
          );
          setShowInput(true);
        });
        break;
      }

      case 'thanks': {
        setShowInput(false);
        moveBugsyTo(50, 75, () => {
          setBugsyMood('happy');
          addBugsyMessage(
            "Got it! I'll send this over to the team. Thanks for taking the time to show me! 🙌",
            20, 55,
          );
          setTimeout(() => {
            onConfirm();
          }, 2500);
        });
        break;
      }

      case 'done': {
        onClose();
        break;
      }
    }
  }, [markers, transcript, recording, moveBugsyTo, moveBugsyToMarker, addBugsyMessage, onConfirm, onClose]);

  // ============================================================================
  // HANDLE RESPONSES
  // ============================================================================

  const handleOptionClick = useCallback((option: string) => {
    // Remove the options from the last message
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, options: undefined } : m
    ));

    const responseX = bugsyPos.x + 20;
    const responseY = bugsyPos.y - 10;

    addDoctorMessage(option, responseX, responseY);
    setBugsyMood('listening');

    switch (currentStep) {
      case 'confirm': {
        if (option.includes('Not exactly') || option.includes('not')) {
          // Doctor wants to correct
          setTimeout(() => {
            addBugsyMessage("No problem — tell me what actually happened.", bugsyPos.x - 20, bugsyPos.y - 20);
            setShowInput(true);
          }, 800);
        } else {
          // Doctor confirmed
          setTimeout(() => runStep('ask_expected'), 800);
        }
        break;
      }
      case 'ask_frequency': {
        onAnswer('frequency',
          option.includes('Every') ? 'always' :
          option.includes('Sometimes') ? 'sometimes' : 'first_time'
        );
        setTimeout(() => runStep('ask_anything_else'), 800);
        break;
      }
      default: {
        // Generic next step
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextStep = STEP_ORDER[currentIndex + 1] || 'thanks';
        setTimeout(() => runStep(nextStep), 800);
        break;
      }
    }
  }, [currentStep, bugsyPos, addDoctorMessage, addBugsyMessage, onAnswer, runStep]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;

    const responseX = bugsyPos.x + 20;
    const responseY = bugsyPos.y - 10;
    addDoctorMessage(textInput.trim(), responseX, responseY);
    setBugsyMood('listening');

    switch (currentStep) {
      case 'confirm': {
        // Doctor typed a correction
        onCorrect([textInput.trim()]);
        setTextInput('');
        setShowInput(false);
        setTimeout(() => runStep('ask_expected'), 1000);
        break;
      }
      case 'ask_expected': {
        onAnswer('expected_behavior', textInput.trim());
        setTextInput('');
        setShowInput(false);
        setTimeout(() => runStep('ask_frequency'), 1000);
        break;
      }
      case 'ask_anything_else': {
        onAnswer('additional_notes' as any, textInput.trim());
        setTextInput('');
        setShowInput(false);
        setTimeout(() => runStep('thanks'), 1000);
        break;
      }
      default: {
        setTextInput('');
        setShowInput(false);
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextStep = STEP_ORDER[currentIndex + 1] || 'thanks';
        setTimeout(() => runStep(nextStep), 800);
        break;
      }
    }
  }, [textInput, currentStep, bugsyPos, addDoctorMessage, onCorrect, onAnswer, runStep]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9998] bg-black"
      style={{ cursor: 'default' }}
    >
      {/* Video background */}
      {recording.video_url && (
        <video
          ref={videoRef}
          src={recording.video_url}
          className="absolute inset-0 w-full h-full object-contain"
          muted={false}
          playsInline
          style={{ opacity: 0.6, filter: 'brightness(0.5)' }}
        />
      )}

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50 pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[10002] p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors border border-white/10"
      >
        <X className="w-5 h-5 text-white/70 hover:text-white" />
      </button>

      {/* Re-record button */}
      <button
        onClick={onReRecord}
        className="absolute top-4 left-4 z-[10002] px-3 py-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors border border-white/10 flex items-center gap-2 text-white/60 hover:text-white text-sm"
      >
        <RotateCcw className="w-4 h-4" />
        Show again
      </button>

      {/* Chat bubbles */}
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          onOptionClick={handleOptionClick}
          animateIn={true}
        />
      ))}

      {/* Bugsy character */}
      <BugsyCharacter
        x={(bugsyPos.x / 100) * (typeof window !== 'undefined' ? window.innerWidth : 1920)}
        y={(bugsyPos.y / 100) * (typeof window !== 'undefined' ? window.innerHeight : 1080)}
        mood={bugsyMood}
        size={90}
        facingRight={bugsyFacing}
      />

      {/* Text input bar at bottom */}
      {showInput && (
        <div className="absolute bottom-0 left-0 right-0 z-[10002] p-4 bg-gradient-to-t from-black/90 to-transparent">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
              placeholder="Type your answer..."
              className="flex-1 bg-[#1a3d3d] border border-teal-500/30 rounded-full px-5 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
              autoFocus
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className={`p-3 rounded-full transition-all ${
                textInput.trim()
                  ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-gray-600 text-xs mt-2">
            Press Enter to send
          </p>
        </div>
      )}
    </div>
  );
}
