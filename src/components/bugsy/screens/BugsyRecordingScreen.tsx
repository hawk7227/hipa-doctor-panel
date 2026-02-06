'use client';

// ============================================================================
// BUGSY RECORDING SCREEN - Screen & Voice Capture
// Version: 1.1.0 - Minimized recording bar
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, MousePointer2, Clock, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import type { InterviewContext, RecordingData, TranscriptData, InteractionEvent, ScreenMarker } from '@/types/bugsy';

// ============================================================================
// WEB SPEECH API TYPE DECLARATIONS
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface BugsyRecordingScreenProps {
  onStop: (
    data: RecordingData,
    transcript: TranscriptData,
    interactions: InteractionEvent[],
    markers: ScreenMarker[]
  ) => void;
  context: InterviewContext;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_DURATION_SECONDS = 300; // 5 minutes
const MIN_DURATION_SECONDS = 3;

// ============================================================================
// COMPONENT
// ============================================================================

export default function BugsyRecordingScreen({ onStop, context }: BugsyRecordingScreenProps) {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [markers, setMarkers] = useState<ScreenMarker[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized!

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const markerCountRef = useRef(0);
  const startTimeRef = useRef<number>(0);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Start recording when component mounts
  useEffect(() => {
    startRecording();

    return () => {
      stopAllStreams();
    };
  }, []);

  // Timer for duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= MAX_DURATION_SECONDS) {
            handleStopRecording();
          }
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Click tracking
  useEffect(() => {
    if (!isRecording) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const timestamp = Date.now() - startTimeRef.current;

      // Create marker
      const marker: ScreenMarker = {
        number: ++markerCountRef.current,
        timestamp_ms: timestamp,
        x_percent: (e.clientX / window.innerWidth) * 100,
        y_percent: (e.clientY / window.innerHeight) * 100,
        element_selector: getSelector(target),
        element_tag: target.tagName.toLowerCase(),
        element_text: target.textContent?.slice(0, 100) || undefined,
        element_id: target.id || undefined,
        action_type: 'click',
      };

      setMarkers((prev) => [...prev, marker]);

      // Create interaction
      const interaction: InteractionEvent = {
        timestamp_ms: timestamp,
        action_type: 'click',
        position: {
          x: e.clientX,
          y: e.clientY,
          x_percent: (e.clientX / window.innerWidth) * 100,
          y_percent: (e.clientY / window.innerHeight) * 100,
        },
        element: {
          selector: getSelector(target),
          tag: target.tagName.toLowerCase(),
          text: target.textContent?.slice(0, 100) || undefined,
          id: target.id || undefined,
          classes: Array.from(target.classList),
        },
      };

      setInteractions((prev) => [...prev, interaction]);
    };

    // Capture clicks on the main document
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [isRecording]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(Boolean).slice(0, 2).join('.');
      if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
    }
    return element.tagName.toLowerCase();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  const startRecording = async () => {
    try {
      setError(null);
      startTimeRef.current = Date.now();

      // Request screen capture with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
        },
        audio: true,
      });

      // Request microphone
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        setIsMicActive(true);
      } catch (micError) {
        console.warn('Microphone not available:', micError);
        setIsMicActive(false);
      }

      // Combine streams
      const tracks = [...displayStream.getTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getTracks());
      }

      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        handleRecordingComplete();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Capture in 1-second chunks
      setIsRecording(true);

      // Start speech recognition
      startSpeechRecognition();

      // Handle screen share stop
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start recording. Please allow screen sharing.'
      );
    }
  };

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // Restart if still recording
      if (isRecording && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Ignore errors when restarting
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopRecording = useCallback(() => {
    if (duration < MIN_DURATION_SECONDS) {
      setError(`Please record for at least ${MIN_DURATION_SECONDS} seconds`);
      return;
    }

    setIsRecording(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, [duration]);

  const handleRecordingComplete = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });

    // In production, upload to storage and get URL
    // For now, create object URL
    const videoUrl = URL.createObjectURL(blob);

    const recordingData: RecordingData = {
      video_url: videoUrl,
      duration_seconds: duration,
      file_size_bytes: blob.size,
    };

    const transcriptData: TranscriptData = {
      full_text: transcript,
      segments: [
        {
          time: 0,
          text: transcript,
          confidence: 0.9,
        },
      ],
      keywords_found: extractKeywords(transcript),
    };

    onStop(recordingData, transcriptData, interactions, markers);
    stopAllStreams();
  };

  const extractKeywords = (text: string): string[] => {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
      'that', 'these', 'those', 'am', 'i', 'my', 'me', 'it', 'its',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  };

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Recording Error</h3>
        <p className="text-gray-400 text-center mb-6 max-w-md">{error}</p>
        <button
          onClick={startRecording}
          className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ============================================================================
  // MINIMIZED RECORDING BAR
  // ============================================================================
  if (isMinimized && isRecording) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-2xl shadow-red-500/50 px-6 py-3 flex items-center gap-4 border-2 border-red-400">
        {/* Recording pulse */}
        <div className="relative">
          <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
          <div className="absolute inset-0 w-4 h-4 bg-white rounded-full animate-ping opacity-50" />
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-bold text-lg">{formatTime(duration)}</span>
        </div>

        {/* Mic indicator */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isMicActive ? 'bg-green-500' : 'bg-gray-500'}`}>
          {isMicActive ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-white" />}
        </div>

        {/* Stats */}
        <div className="text-white/80 text-sm hidden sm:block">
          {markers.length} clicks • {transcript.split(' ').filter(Boolean).length} words
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          title="Expand"
        >
          <Maximize2 className="w-4 h-4 text-white" />
        </button>

        {/* Stop button */}
        <button
          onClick={handleStopRecording}
          disabled={duration < MIN_DURATION_SECONDS}
          className={`px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
            duration >= MIN_DURATION_SECONDS
              ? 'bg-white text-red-600 hover:bg-gray-100'
              : 'bg-white/50 text-red-400 cursor-not-allowed'
          }`}
        >
          Stop
        </button>
      </div>
    );
  }

  // ============================================================================
  // FULL RECORDING SCREEN
  // ============================================================================
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      {/* Minimize button */}
      {isRecording && (
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-4 p-2 hover:bg-teal-500/20 rounded-lg transition-colors"
          title="Minimize to bar"
        >
          <Minimize2 className="w-5 h-5 text-gray-400" />
        </button>
      )}

      {/* Recording Indicator */}
      <div className="relative mb-6">
        <div className="w-32 h-32 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center animate-pulse">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
            <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
          </div>
        </div>

        {/* Mic Status */}
        <div
          className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#0d2626] ${
            isMicActive ? 'bg-green-500' : 'bg-gray-500'
          }`}
        >
          {isMicActive ? (
            <Mic className="w-5 h-5 text-white" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-red-400" />
        <span className="text-3xl font-mono font-bold text-white">{formatTime(duration)}</span>
        <span className="text-sm text-gray-500">/ {formatTime(MAX_DURATION_SECONDS)}</span>
      </div>

      {/* Status */}
      <div className="text-center mb-6">
        <p className="text-lg text-white font-medium mb-1">Recording in progress...</p>
        <p className="text-sm text-gray-400">
          Show me the problem and tell me what's wrong
        </p>
        <p className="text-xs text-teal-400 mt-2">
          💡 Click the minimize button above to show a small bar
        </p>
      </div>

      {/* Live Stats */}
      <div className="flex items-center gap-6 mb-8 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <MousePointer2 className="w-4 h-4 text-teal-400" />
          <span>{markers.length} clicks tracked</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Mic className="w-4 h-4 text-teal-400" />
          <span>{transcript.split(' ').filter(Boolean).length} words captured</span>
        </div>
      </div>

      {/* Stop Button */}
      <button
        onClick={handleStopRecording}
        disabled={duration < MIN_DURATION_SECONDS}
        className={`group px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 ${
          duration >= MIN_DURATION_SECONDS
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 hover:scale-105'
            : 'bg-gray-600 cursor-not-allowed opacity-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Square className="w-5 h-5" />
          <span>Stop Recording</span>
        </div>
      </button>

      {duration < MIN_DURATION_SECONDS && (
        <p className="text-xs text-gray-500 mt-3">
          Record for at least {MIN_DURATION_SECONDS} seconds
        </p>
      )}
    </div>
  );
}


