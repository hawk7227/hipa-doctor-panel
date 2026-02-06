'use client';

// ============================================================================
// BUGSY INTERVIEW OVERLAY - v3.0
//
// - Bugsy WAITS for doctor input before advancing
// - Bugsy WALKS to where doctor clicked
// - Bugsy SPEAKS with calm TTS voice
// - Doctor has text + voice input bar
// - Yellow click markers that persist/toggle on screen
// - Messages clear between steps
// - Quick-action widgets for doctor
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, RotateCcw, Mic, MicOff, Crosshair, Trash2, Flag, AlertTriangle } from 'lucide-react';
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

// ============================================================================
// TYPES
// ============================================================================

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

type InterviewStep =
  | 'greeting'
  | 'reflect'
  | 'confirm'
  | 'ask_expected'
  | 'ask_frequency'
  | 'ask_anything'
  | 'thanks';

interface ClickPin {
  id: string;
  x: number; // percent
  y: number; // percent
  label?: string;
}

// ============================================================================
// TTS — Bugsy speaks in a calm, helpful voice
// ============================================================================

let voicesLoaded = false;

function speakText(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  utterance.volume = 0.8;

  const voices = window.speechSynthesis.getVoices();
  // Try to find a calm, friendly female voice
  const preferred = voices.find(v =>
    v.name.includes('Samantha') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Microsoft Zira') ||
    v.name.includes('Karen') ||
    v.name.includes('Moira') ||
    (v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
  ) || voices.find(v => v.lang.startsWith('en'));

  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// Preload voices
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { voicesLoaded = true; };
}

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

  // ── State ──────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<InterviewStep>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bugsyPos, setBugsyPos] = useState({ x: 50, y: 85 });
  const [bugsyMood, setBugsyMood] = useState<BugsyMood>('idle');
  const [bugsyFacing, setBugsyFacing] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [waitingForDoctor, setWaitingForDoctor] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [clickPins, setClickPins] = useState<ClickPin[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);

  // ── Refs ───────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const messageIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<InterviewStep>('greeting');
  const bugsyPosRef = useRef({ x: 50, y: 85 });
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep refs synced
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { bugsyPosRef.current = bugsyPos; }, [bugsyPos]);

  const nextMsgId = () => `msg-${++messageIdRef.current}`;

  // ── Initialize click pins from recording markers ──
  useEffect(() => {
    if (markers.length > 0) {
      const initialPins: ClickPin[] = markers.map((m, i) => ({
        id: `rec-${i}`,
        x: m.x_percent,
        y: m.y_percent,
        label: m.element_text?.slice(0, 20) || `Click ${i + 1}`,
      }));
      setClickPins(initialPins);
    }
  }, [markers]);

  // ── Start interview ────────────────────────────────
  useEffect(() => {
    // Load voices first, then start
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    const timer = setTimeout(() => runStep('greeting'), 800);
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // BUGSY MOVEMENT
  // ============================================================================

  const moveBugsyTo = useCallback((xPct: number, yPct: number, callback?: () => void) => {
    const currentX = bugsyPosRef.current.x;
    setBugsyMood('walking');
    setBugsyFacing(xPct > currentX);
    setBugsyPos({ x: xPct, y: yPct });
    bugsyPosRef.current = { x: xPct, y: yPct };
    setTimeout(() => {
      setBugsyMood('idle');
      callback?.();
    }, 1100);
  }, []);

  // ============================================================================
  // MESSAGE HELPERS
  // ============================================================================

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addBugsyMessage = useCallback((text: string, xPct: number, yPct: number, options?: string[]) => {
    const msg: ChatMessage = {
      id: nextMsgId(),
      from: 'bugsy',
      text,
      x: Math.max(2, Math.min(xPct, 58)),
      y: Math.max(3, Math.min(yPct, 62)),
      options,
    };
    setMessages(prev => [...prev, msg]);
    setBugsyMood('talking');

    // Bugsy speaks the message
    speakText(text);

    setTimeout(() => setBugsyMood('idle'), 1500);
    return msg.id;
  }, []);

  const addDoctorMessage = useCallback((text: string) => {
    const pos = bugsyPosRef.current;
    const msg: ChatMessage = {
      id: nextMsgId(),
      from: 'doctor',
      text,
      x: Math.min(pos.x + 18, 60),
      y: Math.max(pos.y - 18, 5),
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  // ============================================================================
  // MARKER POSITION HELPER
  // ============================================================================

  const getMarkerPos = useCallback((index: number) => {
    const m = markers[index];
    if (m) return { x: m.x_percent, y: m.y_percent };
    const defaults = [
      { x: 35, y: 45 }, { x: 55, y: 50 },
      { x: 40, y: 55 }, { x: 50, y: 40 },
    ];
    return defaults[index % defaults.length];
  }, [markers]);

  const getBubblePos = useCallback((bugsyX: number, bugsyY: number) => {
    return {
      x: bugsyX > 50 ? bugsyX - 38 : bugsyX + 8,
      y: bugsyY > 50 ? bugsyY - 22 : bugsyY - 15,
    };
  }, []);

  // ============================================================================
  // STEP RUNNER — greeting & reflect auto-advance, everything else WAITS
  // ============================================================================

  const runStep = useCallback((step: InterviewStep) => {
    setCurrentStep(step);
    setShowInput(false);
    setWaitingForDoctor(false);

    switch (step) {

      case 'greeting': {
        clearMessages();
        moveBugsyTo(50, 72, () => {
          const bp = getBubblePos(50, 72);
          addBugsyMessage(
            "Hey! Thanks for showing me that. Give me a second to go over it...",
            bp.x, bp.y
          );
          // Auto-advance after Bugsy finishes speaking (~3s)
          setTimeout(() => runStep('reflect'), 3500);
        });
        break;
      }

      case 'reflect': {
        clearMessages();
        const pos = getMarkerPos(0);

        // Play back the recording
        if (videoRef.current && recording.video_url) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }

        // Walk to where doctor clicked
        moveBugsyTo(pos.x, pos.y, () => {
          setBugsyMood('pointing');

          const doctorWords = transcript.full_text?.trim();
          let reflectionText: string;

          if (doctorWords && doctorWords.length > 10) {
            reflectionText = `OK so you said: "${doctorWords}"`;
          } else if (markers.length > 0) {
            const items = markers.map(m => m.element_text?.trim()).filter(Boolean).slice(0, 2);
            reflectionText = items.length > 0
              ? `I see you were clicking on ${items.map(c => `"${c}"`).join(' and ')} over here`
              : `I see you were pointing at this area`;
          } else {
            reflectionText = `I captured your screen. Tell me what the issue was.`;
          }

          const bp = getBubblePos(pos.x, pos.y);
          addBugsyMessage(reflectionText, bp.x, bp.y);

          // Auto-advance to confirm after speech finishes (~4s)
          setTimeout(() => {
            if (videoRef.current) videoRef.current.pause();
            runStep('confirm');
          }, 4500);
        });
        break;
      }

      case 'confirm': {
        // Don't clear — keep reflection visible briefly
        const pos = getMarkerPos(0);
        const bp = getBubblePos(pos.x, pos.y);

        // Clear after brief delay so doctor sees reflection
        setTimeout(() => {
          clearMessages();
          addBugsyMessage(
            "Did I get that right?",
            bp.x, bp.y + 5,
            ["Yes, that's right", "Not exactly, let me explain"]
          );
          setShowInput(true);
          setWaitingForDoctor(true);
        }, 800);
        break;
      }

      case 'ask_expected': {
        clearMessages();
        const pos = getMarkerPos(1);

        moveBugsyTo(pos.x, pos.y, () => {
          const bp = getBubblePos(pos.x, pos.y);
          addBugsyMessage(
            "What were you expecting to happen there?",
            bp.x, bp.y,
          );
          setShowInput(true);
          setWaitingForDoctor(true);
        });
        break;
      }

      case 'ask_frequency': {
        clearMessages();
        const pos = getMarkerPos(2);

        moveBugsyTo(pos.x, pos.y, () => {
          const bp = getBubblePos(pos.x, pos.y);
          addBugsyMessage(
            "Does this happen every time, or just sometimes?",
            bp.x, bp.y,
            ["Every time", "Sometimes", "First time"]
          );
          setShowInput(true);
          setWaitingForDoctor(true);
        });
        break;
      }

      case 'ask_anything': {
        clearMessages();
        moveBugsyTo(50, 65, () => {
          const bp = getBubblePos(50, 65);
          addBugsyMessage(
            "Anything else you want me to pass along?",
            bp.x, bp.y,
            ["Nope, that's everything", "Yes, one more thing"]
          );
          setShowInput(true);
          setWaitingForDoctor(true);
        });
        break;
      }

      case 'thanks': {
        clearMessages();
        setShowInput(false);
        moveBugsyTo(50, 70, () => {
          setBugsyMood('happy');
          const bp = getBubblePos(50, 70);
          addBugsyMessage(
            "Got it! I'll send this over to the team. Thanks for taking the time!",
            bp.x, bp.y,
          );
          setTimeout(() => onConfirm(), 3000);
        });
        break;
      }
    }
  }, [markers, transcript, recording, moveBugsyTo, getMarkerPos, getBubblePos, clearMessages, addBugsyMessage, onConfirm]);

  // ============================================================================
  // DOCTOR RESPONSE HANDLERS
  // ============================================================================

  const advanceFromStep = useCallback((step: InterviewStep) => {
    const order: InterviewStep[] = ['greeting', 'reflect', 'confirm', 'ask_expected', 'ask_frequency', 'ask_anything', 'thanks'];
    const idx = order.indexOf(step);
    const next = order[idx + 1] || 'thanks';
    setTimeout(() => runStep(next), 1200);
  }, [runStep]);

  const handleOptionClick = useCallback((option: string) => {
    if (!waitingForDoctor) return;

    // Remove options from last message
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, options: undefined } : m
    ));

    addDoctorMessage(option);
    setBugsyMood('listening');
    setWaitingForDoctor(false);
    setShowInput(false);

    const step = currentStepRef.current;

    if (step === 'confirm') {
      if (option.toLowerCase().includes('not') || option.toLowerCase().includes('explain')) {
        setTimeout(() => {
          clearMessages();
          const bp = getBubblePos(bugsyPosRef.current.x, bugsyPosRef.current.y);
          addBugsyMessage("No problem — tell me what actually happened.", bp.x, bp.y);
          setShowInput(true);
          setWaitingForDoctor(true);
        }, 1200);
      } else {
        advanceFromStep('confirm');
      }
    } else if (step === 'ask_frequency') {
      onAnswer('frequency',
        option.includes('Every') ? 'always' :
        option.includes('Sometimes') ? 'sometimes' : 'first_time'
      );
      advanceFromStep('ask_frequency');
    } else if (step === 'ask_anything') {
      if (option.toLowerCase().includes('yes') || option.toLowerCase().includes('one more')) {
        setTimeout(() => {
          clearMessages();
          const bp = getBubblePos(bugsyPosRef.current.x, bugsyPosRef.current.y);
          addBugsyMessage("Sure, go ahead!", bp.x, bp.y);
          setShowInput(true);
          setWaitingForDoctor(true);
        }, 800);
      } else {
        setTimeout(() => runStep('thanks'), 1000);
      }
    } else {
      advanceFromStep(step);
    }
  }, [waitingForDoctor, addDoctorMessage, clearMessages, addBugsyMessage, getBubblePos, onAnswer, advanceFromStep, runStep]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim() || !waitingForDoctor) return;

    const text = textInput.trim();
    addDoctorMessage(text);
    setBugsyMood('listening');
    setTextInput('');
    setShowInput(false);
    setWaitingForDoctor(false);

    const step = currentStepRef.current;

    if (step === 'confirm') {
      onCorrect([text]);
      advanceFromStep('confirm');
    } else if (step === 'ask_expected') {
      onAnswer('expected_behavior', text);
      advanceFromStep('ask_expected');
    } else if (step === 'ask_anything') {
      onAnswer('additional_notes', text);
      setTimeout(() => runStep('thanks'), 1200);
    } else {
      advanceFromStep(step);
    }
  }, [textInput, waitingForDoctor, addDoctorMessage, onCorrect, onAnswer, advanceFromStep, runStep]);

  // ============================================================================
  // VOICE INPUT (Doctor speaks)
  // ============================================================================

  const toggleVoiceInput = useCallback(() => {
    if (isVoiceListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsVoiceListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      setTextInput(finalText || interimText);
    };

    recognition.onend = () => {
      setIsVoiceListening(false);
      // Auto-submit if we got text
      setTimeout(() => {
        if (textInput.trim()) {
          handleTextSubmit();
        }
      }, 300);
    };

    recognition.onerror = () => {
      setIsVoiceListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsVoiceListening(true);
  }, [isVoiceListening, textInput, handleTextSubmit]);

  // ============================================================================
  // CLICK PINS — Doctor can drop/remove yellow markers on screen
  // ============================================================================

  const handleScreenClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicking near an existing pin to remove it
    const existing = clickPins.find(p =>
      Math.abs(p.x - xPct) < 3 && Math.abs(p.y - yPct) < 3
    );

    if (existing) {
      setClickPins(prev => prev.filter(p => p.id !== existing.id));
    } else {
      const newPin: ClickPin = {
        id: `pin-${Date.now()}`,
        x: xPct,
        y: yPct,
        label: `Pin ${clickPins.length + 1}`,
      };
      setClickPins(prev => [...prev, newPin]);
    }
  }, [pinMode, clickPins]);

  const clearAllPins = useCallback(() => {
    setClickPins([]);
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  const bugsyPixelX = typeof window !== 'undefined' ? (bugsyPos.x / 100) * window.innerWidth : 960;
  const bugsyPixelY = typeof window !== 'undefined' ? (bugsyPos.y / 100) * window.innerHeight : 800;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9998] bg-black"
      onClick={handleScreenClick}
      style={{ cursor: pinMode ? 'crosshair' : 'default' }}
    >
      {/* ── Video Background ─────────────────────────── */}
      {recording.video_url && (
        <video
          ref={videoRef}
          src={recording.video_url}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          style={{ opacity: 0.5, filter: 'brightness(0.4)' }}
        />
      )}

      {/* ── Dark gradient ────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* ── Yellow Click Pins ────────────────────────── */}
      {clickPins.map((pin) => (
        <div
          key={pin.id}
          className="absolute z-[10000] pointer-events-none"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer pulse ring */}
          <div className="absolute inset-0 w-10 h-10 -ml-5 -mt-5 rounded-full bg-yellow-400/20 animate-ping" />
          {/* Inner circle */}
          <div className="relative w-8 h-8 -ml-4 -mt-4 rounded-full bg-yellow-400 border-2 border-yellow-200 shadow-lg shadow-yellow-400/50 flex items-center justify-center">
            <div className="w-3 h-3 bg-yellow-100 rounded-full" />
          </div>
          {/* Label */}
          {pin.label && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-yellow-300 bg-black/70 px-1.5 py-0.5 rounded">
              {pin.label}
            </div>
          )}
        </div>
      ))}

      {/* ── Top bar: Close + Re-record ───────────────── */}
      <div className="absolute top-4 left-4 right-4 z-[10002] flex items-center justify-between pointer-events-none">
        <button
          onClick={(e) => { e.stopPropagation(); onReRecord(); }}
          className="pointer-events-auto px-3 py-2 bg-black/60 hover:bg-black/80 rounded-lg transition-colors border border-white/10 flex items-center gap-2 text-white/60 hover:text-white text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Show again
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="pointer-events-auto p-2.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors border border-white/10"
        >
          <X className="w-5 h-5 text-white/70 hover:text-white" />
        </button>
      </div>

      {/* ── Widget bar (right side) ──────────────────── */}
      {showWidgets && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[10002] flex flex-col gap-2 pointer-events-none">
          {/* Pin mode toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setPinMode(!pinMode); }}
            className={`pointer-events-auto p-3 rounded-xl transition-all border shadow-lg ${
              pinMode
                ? 'bg-yellow-500 border-yellow-400 text-black shadow-yellow-500/30'
                : 'bg-black/60 border-white/10 text-white/60 hover:text-white hover:bg-black/80'
            }`}
            title={pinMode ? 'Stop pinning' : 'Drop pins on screen'}
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {/* Clear pins */}
          {clickPins.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearAllPins(); }}
              className="pointer-events-auto p-3 rounded-xl bg-black/60 border border-white/10 text-white/60 hover:text-red-400 hover:bg-black/80 transition-all shadow-lg"
              title="Clear all pins"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Priority flag */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnswer('priority', 'high');
              // Visual feedback
              const btn = e.currentTarget;
              btn.classList.add('!bg-red-500', '!border-red-400', '!text-white');
              setTimeout(() => btn.classList.remove('!bg-red-500', '!border-red-400', '!text-white'), 1500);
            }}
            className="pointer-events-auto p-3 rounded-xl bg-black/60 border border-white/10 text-white/60 hover:text-orange-400 hover:bg-black/80 transition-all shadow-lg"
            title="Mark as urgent"
          >
            <AlertTriangle className="w-5 h-5" />
          </button>

          {/* Pin count badge */}
          {clickPins.length > 0 && (
            <div className="pointer-events-none text-center text-xs text-yellow-400 font-bold">
              {clickPins.length} pin{clickPins.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Chat Bubbles ─────────────────────────────── */}
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          onOptionClick={handleOptionClick}
          animateIn={true}
        />
      ))}

      {/* ── Bugsy Character ──────────────────────────── */}
      <BugsyCharacter
        x={bugsyPixelX}
        y={bugsyPixelY}
        mood={bugsyMood}
        size={90}
        facingRight={bugsyFacing}
      />

      {/* ── Doctor Input Bar (text + voice) ──────────── */}
      {showInput && (
        <div className="absolute bottom-0 left-0 right-0 z-[10002] pointer-events-auto">
          <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8 pb-5 px-4">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-2 bg-[#1a3d3d] border border-teal-500/30 rounded-2xl px-4 py-2 shadow-lg shadow-black/30">
                {/* Voice button */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleVoiceInput(); }}
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                    isVoiceListening
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                      : 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                  }`}
                  title={isVoiceListening ? 'Stop listening' : 'Speak your answer'}
                >
                  {isVoiceListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
                  placeholder={isVoiceListening ? 'Listening...' : 'Type or tap the mic to speak...'}
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none py-2"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Send button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleTextSubmit(); }}
                  disabled={!textInput.trim()}
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                    textInput.trim()
                      ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                      : 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {/* Helper text */}
              <p className="text-center text-gray-600 text-xs mt-2">
                {isVoiceListening ? '🔴 Speak now — I\'m listening' : 'Type your answer or tap 🎤 to speak'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Pin mode overlay indicator ───────────────── */}
      {pinMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[10003] bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-yellow-500/30 flex items-center gap-2 pointer-events-none">
          <Crosshair className="w-4 h-4" />
          Click to drop a pin — click a pin to remove it
        </div>
      )}
    </div>
  );
}

