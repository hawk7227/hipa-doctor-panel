"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import DailyIframe from "@daily-co/daily-js";

// =============================================
// TYPES
// =============================================
interface DailyMeetingEmbedProps {
  appointment: {
    id: string;
    dailyco_meeting_url: string | null;
    dailyco_room_name: string | null;
    dailyco_owner_token: string | null;
    requested_date_time: string | null;
    recording_url?: string | null;
  } | null;
  patientName?: string;
  patientPhone?: string;
  currentUser?: {
    email?: string;
    name?: string;
  } | null;
  isCustomizeMode?: boolean;
  sectionProps?: Record<string, unknown>;
  sectionId?: string;
  onTranscriptUpdate?: (transcript: string) => void;
  onSOAPGenerated?: (soap: SOAPNote) => void;
}

interface TranscriptEntry {
  id: string;
  speaker: "patient" | "doctor" | "system";
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface BillingCode {
  code: string;
  description: string;
  confidence: number;
  type: "icd10" | "cpt";
}

// Daily Frame type
type DailyFrame = ReturnType<typeof DailyIframe.createFrame>;

// =============================================
// PANEL STATES
// =============================================
type PanelState = "closed" | "expanded" | "minimized";
type ActiveTab = "transcript" | "soap" | "codes" | "instructions";
type CallState = "idle" | "joining" | "joined" | "error" | "left";

// =============================================
// MAIN COMPONENT
// =============================================
export default function DailyMeetingEmbed({
  appointment,
  patientName = "Patient",
  patientPhone = "",
  currentUser,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = "daily-meeting-info",
  onTranscriptUpdate,
  onSOAPGenerated,
}: DailyMeetingEmbedProps) {
  // =============================================
  // PORTAL & MOUNTING
  // =============================================
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsMobile(window.innerWidth < 768);

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    // Create portal container
    const existing = document.getElementById("medazon-video-portal");
    if (existing) {
      setPortalContainer(existing);
    } else {
      const container = document.createElement("div");
      container.id = "medazon-video-portal";
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483647;
      `;
      document.body.appendChild(container);
      setPortalContainer(container);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup portal on unmount
  useEffect(() => {
    return () => {
      const el = document.getElementById("medazon-video-portal");
      if (el && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    };
  }, []);

  // =============================================
  // PANEL STATE
  // =============================================
  const [panelState, setPanelState] = useState<PanelState>("closed");
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 950, height: 680 });
  const [isDragging, setIsDragging] = useState(false);
  const posRef = useRef(position);
  const sizeRef = useRef(size);

  useEffect(() => { posRef.current = position; }, [position]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // =============================================
  // DAILY.CO STATE - Single Frame Connection
  // =============================================
  const dailyFrameRef = useRef<DailyFrame | null>(null);
  const prebuiltContainerRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [callState, setCallState] = useState<CallState>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [participantCount, setParticipantCount] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "low" | "very-low">("good");

  // =============================================
  // AI SCRIBE STATE
  // =============================================
  const [activeTab, setActiveTab] = useState<ActiveTab>("transcript");
  const [isAIScribeActive, setIsAIScribeActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [soapNote, setSoapNote] = useState<SOAPNote>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [billingCodes, setBillingCodes] = useState<BillingCode[]>([]);
  const [patientInstructions, setPatientInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // =============================================
  // DIALPAD STATE
  // =============================================
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialNumber, setDialNumber] = useState(patientPhone || "");
  const [isDialing, setIsDialing] = useState(false);

  // Keep dialNumber in sync with patientPhone prop
  useEffect(() => {
    if (patientPhone) {
      setDialNumber(patientPhone);
    }
  }, [patientPhone]);

  // =============================================
  // COUNTDOWN
  // =============================================
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  useEffect(() => {
    if (!appointment?.requested_date_time) return;
    const updateTimer = () => {
      const diff = new Date(appointment.requested_date_time!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }
      setTimeRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        isPast: false,
      });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [appointment?.requested_date_time]);

  const joinUrl = useMemo(() => appointment?.dailyco_meeting_url || "", [appointment?.dailyco_meeting_url]);

  // =============================================
  // DRAG & RESIZE HANDLERS
  // =============================================
  const startDrag = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = posRef.current;

    const onMove = (ev: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(startPos.x + ev.clientX - startX, window.innerWidth - 100)),
        y: Math.max(0, Math.min(startPos.y + ev.clientY - startY, window.innerHeight - 50)),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [isMobile]);

  const startResize = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = sizeRef.current;

    const onMove = (ev: MouseEvent) => {
      setSize({
        width: Math.max(700, Math.min(startSize.width + ev.clientX - startX, window.innerWidth - posRef.current.x)),
        height: Math.max(450, Math.min(startSize.height + ev.clientY - startY, window.innerHeight - posRef.current.y)),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [isMobile]);

  // =============================================
  // DAILY PREBUILT INITIALIZATION
  // =============================================
  const initializeDailyPrebuilt = useCallback(async () => {
    if (!joinUrl) {
      setCallError("No meeting URL available");
      setCallState("error");
      return;
    }

    if (!prebuiltContainerRef.current) {
      setCallError("Video container not ready");
      setCallState("error");
      return;
    }

    try {
      setCallState("joining");
      setCallError(null);

      // Cleanup existing frame if any
      if (dailyFrameRef.current) {
        try {
          await dailyFrameRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying existing frame:", e);
        }
        dailyFrameRef.current = null;
      }

      // Clear container
      prebuiltContainerRef.current.innerHTML = "";

      // Create Daily Prebuilt Frame with dark theme
      const frame = DailyIframe.createFrame(prebuiltContainerRef.current, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "12px",
          background: "#0a0e14",
        },
        showLeaveButton: true,
        showFullscreenButton: true,
        showLocalVideo: true,
        showParticipantsBar: true,
        ...(({ prejoinUI: false }) as any),
        // Dark theme customization
        theme: {
          colors: {
            accent: "#06b6d4", // Cyan accent (Medazon brand)
            accentText: "#ffffff",
            background: "#0a0e14", // Dark background
            backgroundAccent: "#1a2332", // Slightly lighter for cards
            baseText: "#ffffff",
            border: "#2d3748",
            mainAreaBg: "#0a0e14",
            mainAreaBgAccent: "#0f1419",
            mainAreaText: "#ffffff",
            supportiveText: "#94a3b8",
          },
        },
        // Layout configuration
        layoutConfig: {
          grid: {
            maxTilesPerPage: 9,
            minTilesPerPage: 1,
          },
        },
      });

      dailyFrameRef.current = frame;

      // ========== EVENT HANDLERS ==========
      
      // Meeting joined
      frame.on("joined-meeting", () => {
        console.log("Daily: joined-meeting");
        setCallState("joined");
        setCallError(null);
        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallSeconds((prev) => prev + 1);
        }, 1000);
        // Get initial participant count
        const participants = frame.participants();
        setParticipantCount(Object.keys(participants).length);
      });

      // Meeting left
      frame.on("left-meeting", () => {
        console.log("Daily: left-meeting");
        setCallState("left");
        setCallSeconds(0);
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
      });

      // Participant events
      frame.on("participant-joined", (event) => {
        console.log("Daily: participant-joined", event?.participant?.user_name);
        const participants = frame.participants();
        setParticipantCount(Object.keys(participants).length);
      });

      frame.on("participant-left", (event) => {
        console.log("Daily: participant-left", event?.participant?.user_name);
        const participants = frame.participants();
        setParticipantCount(Object.keys(participants).length);
      });

      // Recording events
      frame.on("recording-started", () => {
        console.log("Daily: recording-started");
        setIsRecording(true);
      });

      frame.on("recording-stopped", () => {
        console.log("Daily: recording-stopped");
        setIsRecording(false);
      });

      // Transcription events
      frame.on("transcription-started", () => {
        console.log("Daily: transcription-started");
        setIsAIScribeActive(true);
      });

      frame.on("transcription-stopped", () => {
        console.log("Daily: transcription-stopped");
        setIsAIScribeActive(false);
      });

      // Transcription message
      frame.on("transcription-message", (event) => {
        console.log("Daily: transcription-message", event);
        if (event?.text) {
          const newEntry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            speaker: event.participantId === frame.participants()?.local?.session_id ? "doctor" : "patient",
            text: event.text,
            timestamp: new Date(),
            isFinal: (event as unknown as { is_final?: boolean }).is_final ?? true,
          };
          setTranscript((prev) => [...prev, newEntry]);
          onTranscriptUpdate?.(event.text);
        }
      });

      // Network quality
      frame.on("network-quality-change", (event) => {
        console.log("Daily: network-quality-change", event?.threshold);
        if (event?.threshold) {
          setNetworkQuality(event.threshold as "good" | "low" | "very-low");
        }
      });

      // Error handling
      frame.on("error", (event) => {
        console.error("Daily: error", event);
        setCallError(event?.errorMsg || "An error occurred");
        setCallState("error");
      });

      frame.on("camera-error", (event) => {
        console.error("Daily: camera-error", event);
      });

      // ========== JOIN THE MEETING ==========
      console.log("Daily: Joining meeting...", joinUrl);
      
      await frame.join({
        url: joinUrl,
        token: appointment?.dailyco_owner_token || undefined,
        userName: currentUser?.name || "Dr. Provider",
      });

      console.log("Daily: Join call completed");

    } catch (error) {
      console.error("Failed to initialize Daily:", error);
      setCallError(error instanceof Error ? error.message : "Failed to join meeting");
      setCallState("error");
    }
  }, [joinUrl, appointment?.dailyco_owner_token, currentUser?.name, onTranscriptUpdate]);

  // =============================================
  // CALL CONTROLS - All use dailyFrameRef
  // =============================================
  const toggleMute = useCallback(async () => {
    const frame = dailyFrameRef.current;
    if (!frame) return;
    
    try {
      const newMutedState = !isMuted;
      frame.setLocalAudio(!newMutedState);
      setIsMuted(newMutedState);
    } catch (error) {
      console.error("Toggle mute error:", error);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    const frame = dailyFrameRef.current;
    if (!frame) return;
    
    try {
      const newVideoOffState = !isVideoOff;
      frame.setLocalVideo(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
    } catch (error) {
      console.error("Toggle video error:", error);
    }
  }, [isVideoOff]);

  const toggleRecording = useCallback(async () => {
    const frame = dailyFrameRef.current;
    if (!frame || callState !== "joined") return;
    
    try {
      if (isRecording) {
        await frame.stopRecording();
      } else {
        await frame.startRecording({ layout: { preset: "default" } });
      }
    } catch (error) {
      console.error("Recording error:", error);
      alert("Recording requires a paid Daily.co plan with cloud recording enabled.");
    }
  }, [isRecording, callState]);

  const toggleTranscription = useCallback(async () => {
    const frame = dailyFrameRef.current;
    if (!frame || callState !== "joined") return;
    
    try {
      if (isAIScribeActive) {
        await frame.stopTranscription();
      } else {
        await frame.startTranscription();
      }
    } catch (error) {
      console.error("Transcription error:", error);
      alert("Transcription requires a paid Daily.co plan.");
    }
  }, [isAIScribeActive, callState]);

  const dialOut = useCallback(async () => {
    const frame = dailyFrameRef.current;
    if (!frame || !dialNumber || callState !== "joined") return;
    
    setIsDialing(true);
    try {
      await frame.startDialOut({ phoneNumber: dialNumber });
      setShowDialpad(false);
    } catch (error) {
      console.error("Dial-out error:", error);
      alert("Dial-out requires account approval from Daily.co. Contact help@daily.co");
    } finally {
      setIsDialing(false);
    }
  }, [dialNumber, callState]);

  const leaveCall = useCallback(async () => {
    const frame = dailyFrameRef.current;
    
    if (frame) {
      try {
        await frame.leave();
        await frame.destroy();
      } catch (e) {
        console.warn("Error leaving call:", e);
      }
      dailyFrameRef.current = null;
    }
    
    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Reset state
    setCallState("idle");
    setCallSeconds(0);
    setIsRecording(false);
    setIsAIScribeActive(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setPanelState("closed");
  }, []);

  // =============================================
  // AI GENERATION
  // =============================================
  const generateSOAP = useCallback(async () => {
    if (transcript.length === 0) return;
    setIsGenerating(true);
    
    // Simulate AI - replace with actual API
    setTimeout(() => {
      const mockSOAP: SOAPNote = {
        subjective: `Patient ${patientName} presents with symptoms discussed during the consultation. ${transcript.slice(0, 2).map(t => t.text).join(" ")}`,
        objective: "Vital signs within normal limits. Patient appears in no acute distress. Physical examination findings documented.",
        assessment: "Based on reported symptoms and clinical findings, assessment documented above.",
        plan: "1. Continue current treatment plan as discussed.\n2. Follow-up appointment in 2 weeks.\n3. Patient education provided regarding condition management.",
      };
      setSoapNote(mockSOAP);
      onSOAPGenerated?.(mockSOAP);
      setIsGenerating(false);
      setActiveTab("soap");
    }, 1500);
  }, [transcript, patientName, onSOAPGenerated]);

  const generateCodes = useCallback(async () => {
    if (transcript.length === 0 && !soapNote.assessment) return;
    setIsGenerating(true);
    
    // Simulate AI - replace with actual API
    setTimeout(() => {
      const mockCodes: BillingCode[] = [
        { code: "99213", description: "Office visit, established patient, low complexity", confidence: 0.95, type: "cpt" },
        { code: "R51.9", description: "Headache, unspecified", confidence: 0.88, type: "icd10" },
        { code: "Z00.00", description: "General adult medical examination", confidence: 0.82, type: "icd10" },
      ];
      setBillingCodes(mockCodes);
      setIsGenerating(false);
      setActiveTab("codes");
    }, 1500);
  }, [transcript, soapNote]);

  const generateInstructions = useCallback(async () => {
    setIsGenerating(true);
    
    // Simulate AI - replace with actual API
    setTimeout(() => {
      const instructions = `**Post-Visit Instructions for ${patientName}**

**Diagnosis/Reason for Visit:**
Based on today's consultation.

**Medications:**
- Continue current medications as prescribed
- Take as directed

**Follow-Up Care:**
- Schedule follow-up appointment in 2 weeks
- Call the office if symptoms worsen

**Warning Signs - Seek Immediate Care If:**
- High fever (>101°F / 38.3°C)
- Difficulty breathing
- Severe or worsening pain
- Any concerning changes

**Lifestyle Recommendations:**
- Rest as needed
- Stay well hydrated
- Avoid strenuous activity

Questions? Call us at (XXX) XXX-XXXX`;
      setPatientInstructions(instructions);
      setIsGenerating(false);
      setActiveTab("instructions");
    }, 1500);
  }, [patientName]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dailyFrameRef.current) {
        dailyFrameRef.current.destroy().catch(console.error);
        dailyFrameRef.current = null;
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, []);

  // =============================================
  // HELPERS
  // =============================================
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isInCall = callState === "joined";

  // =============================================
  // RENDER: TRIGGER BUTTON
  // =============================================
  const renderTriggerButton = () => (
    <div key={sectionId} {...(sectionProps as React.HTMLAttributes<HTMLDivElement>)} className="relative">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video Consultation
          </h3>
          {appointment?.dailyco_room_name && (
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full uppercase font-mono">
              {appointment.dailyco_room_name}
            </span>
          )}
        </div>

        {timeRemaining && (
          <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-cyan-500/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{timeRemaining.isPast ? "Status" : "Starts in"}</span>
              <span className={`text-lg font-bold font-mono ${timeRemaining.isPast ? "text-green-400" : "text-cyan-400"}`}>
                {timeRemaining.isPast ? "Ready to start" : `${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => setPanelState("expanded")}
          disabled={!joinUrl}
          className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all font-medium shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Open Video Consultation
        </button>
      </div>
    </div>
  );

  // =============================================
  // RENDER: MINIMIZED BAR
  // =============================================
  const renderMinimizedBar = () => (
    <div
      className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 rounded-full shadow-2xl cursor-move"
      style={{
        position: "absolute",
        left: isMobile ? "50%" : position.x,
        bottom: isMobile ? 20 : "auto",
        top: isMobile ? "auto" : position.y,
        transform: isMobile ? "translateX(-50%)" : "none",
      }}
      onMouseDown={startDrag}
    >
      {isRecording && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
      <span className="text-white font-mono text-sm">{formatTime(callSeconds)}</span>
      <span className="text-gray-400 text-sm hidden sm:block">{patientName}</span>
      
      <button onClick={toggleMute} className={`p-2 rounded-full ${isMuted ? "bg-red-500" : "bg-slate-700"}`}>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
      
      <button onClick={() => setPanelState("expanded")} className="p-2 bg-cyan-600 rounded-full hover:bg-cyan-500">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );

  // =============================================
  // RENDER: EXPANDED PANEL (OPTION C LAYOUT)
  // =============================================
  const renderExpandedPanel = () => (
    <div
      className={`pointer-events-auto flex ${isMobile ? "flex-col" : "flex-row"} bg-[#0a0e14] rounded-2xl shadow-2xl overflow-hidden border-2 border-cyan-500/30`}
      style={{
        position: "absolute",
        left: isMobile ? 0 : position.x,
        top: isMobile ? 0 : position.y,
        width: isMobile ? "100%" : size.width,
        height: isMobile ? "100%" : size.height,
        cursor: isDragging ? "grabbing" : "default",
        boxShadow: "0 25px 80px rgba(6, 182, 212, 0.15), 0 10px 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* ============================================= */}
      {/* LEFT SIDE: VIDEO AREA + CONTROLS */}
      {/* ============================================= */}
      <div className={`${isMobile ? "h-[50%]" : "flex-1"} flex flex-col bg-[#0f1419] min-w-0`}>
        {/* Header with branding */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0a0e14] to-[#0f1419] border-b border-slate-700/50 cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={startDrag}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center flex-shrink-0">
              <span className="text-orange-500 font-bold tracking-wider">MEDAZON</span>
              <span className="text-white font-bold mx-1">+</span>
              <span className="text-teal-400 font-bold tracking-wider">HEALTH</span>
            </div>
            
            {isInCall && (
              <div className="flex items-center gap-2 ml-4 bg-slate-800/50 px-3 py-1 rounded-full flex-shrink-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
                <span className="text-white text-sm font-mono">{formatTime(callSeconds)}</span>
                <span className="text-gray-500 text-sm">• {participantCount}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {!isMobile && <span className="text-slate-500 text-xs mr-2">Drag to move</span>}
            <button onClick={() => setPanelState("minimized")} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Minimize">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button onClick={leaveCall} className="p-2 hover:bg-red-500/30 rounded-lg text-white" title="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="flex-1 relative min-h-0">
          {/* Pre-call state */}
          {callState === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Ready to Start</h3>
                <p className="text-gray-400 mb-6">Join the video consultation with {patientName}</p>
                <button
                  onClick={initializeDailyPrebuilt}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all font-semibold shadow-lg shadow-green-500/30"
                >
                  Join Video Call
                </button>
              </div>
            </div>
          )}

          {/* Joining state */}
          {callState === "joining" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center p-6">
                <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-white text-xl font-semibold mb-2">Connecting...</h3>
                <p className="text-gray-400">Setting up your video consultation</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {callState === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Connection Error</h3>
                <p className="text-red-400 mb-4">{callError || "Failed to join the meeting"}</p>
                <button
                  onClick={initializeDailyPrebuilt}
                  className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Daily Prebuilt iframe container */}
          <div 
            ref={prebuiltContainerRef} 
            className="absolute inset-0"
            style={{ 
              display: (callState === "joining" || callState === "joined") ? "block" : "none",
              background: "#0f1419"
            }}
          />
        </div>

        {/* Bottom Controls */}
        {isInCall && (
          <div className="flex items-center justify-center gap-2 p-3 bg-[#0a0e14] border-t border-slate-700/50 flex-shrink-0">
            <button onClick={toggleMute} className={`p-3 rounded-full transition-all ${isMuted ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600"}`} title={isMuted ? "Unmute" : "Mute"}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMuted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>

            <button onClick={toggleVideo} className={`p-3 rounded-full transition-all ${isVideoOff ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600"}`} title={isVideoOff ? "Turn on camera" : "Turn off camera"}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            <button onClick={() => setShowDialpad(!showDialpad)} className={`p-3 rounded-full transition-all ${showDialpad ? "bg-cyan-600" : patientPhone ? "bg-green-600 hover:bg-green-500" : "bg-slate-700 hover:bg-slate-600"}`} title={patientPhone ? `Call ${patientName}` : "Dialpad"}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>

            <button onClick={toggleRecording} className={`p-3 rounded-full transition-all ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600"}`} title={isRecording ? "Stop Recording" : "Start Recording"}>
              <svg className="w-5 h-5 text-white" fill={isRecording ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" strokeWidth={2} />
              </svg>
            </button>

            <button onClick={leaveCall} className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-all" title="End Call">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* RIGHT SIDE: AI PANEL */}
      {/* ============================================= */}
      <div className={`${isMobile ? "h-[50%]" : "w-[320px]"} flex flex-col bg-[#0f1419] border-l border-slate-700/50 flex-shrink-0`}>
        {/* AI Scribe Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isAIScribeActive ? "bg-purple-500 animate-pulse" : "bg-slate-500"}`} />
              <span className="text-white font-semibold">AI Scribe</span>
              <span className="text-xs text-gray-500">Powered by Deepgram</span>
            </div>
            <button
              onClick={toggleTranscription}
              disabled={!isInCall}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                isAIScribeActive ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              {isAIScribeActive ? "Stop" : "Start"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 flex-shrink-0">
          {(["transcript", "soap", "codes", "instructions"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                activeTab === tab ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {tab === "transcript" && "📝 Transcript"}
              {tab === "soap" && "📋 SOAP"}
              {tab === "codes" && "🏷️ Codes"}
              {tab === "instructions" && "📄 Instructions"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          {/* TRANSCRIPT */}
          {activeTab === "transcript" && (
            <div className="space-y-3">
              {transcript.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
                    {isAIScribeActive ? (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{isAIScribeActive ? "Listening for speech..." : "Start AI Scribe to capture conversation"}</p>
                </div>
              ) : (
                transcript.map((entry) => (
                  <div key={entry.id} className={`p-3 rounded-lg ${entry.speaker === "doctor" ? "bg-blue-500/10 border-l-2 border-blue-500" : "bg-pink-500/10 border-l-2 border-pink-500"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${entry.speaker === "doctor" ? "text-blue-400" : "text-pink-400"}`}>
                        {entry.speaker === "doctor" ? "Dr." : patientName}
                      </span>
                      <span className="text-xs text-gray-500">{entry.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{entry.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* SOAP */}
          {activeTab === "soap" && (
            <div className="space-y-4">
              {soapNote.subjective ? (
                (["subjective", "objective", "assessment", "plan"] as const).map((section) => (
                  <div key={section} className={`p-3 rounded-lg border-l-4 ${
                    section === "subjective" ? "border-green-500 bg-green-500/10" :
                    section === "objective" ? "border-blue-500 bg-blue-500/10" :
                    section === "assessment" ? "border-yellow-500 bg-yellow-500/10" :
                    "border-red-500 bg-red-500/10"
                  }`}>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">{section.charAt(0).toUpperCase()} - {section}</h4>
                    <textarea
                      value={soapNote[section]}
                      onChange={(e) => setSoapNote(prev => ({ ...prev, [section]: e.target.value }))}
                      className="w-full bg-transparent text-white text-sm leading-relaxed resize-none border-0 focus:ring-0 p-0"
                      rows={3}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={generateSOAP}
                    disabled={transcript.length === 0 || isGenerating}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isGenerating ? "Generating..." : "🤖 Generate SOAP Note"}
                  </button>
                  <p className="text-gray-500 text-xs mt-3">Requires transcript data</p>
                </div>
              )}
            </div>
          )}

          {/* CODES */}
          {activeTab === "codes" && (
            <div className="space-y-3">
              {billingCodes.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Suggested Billing Codes</h4>
                  </div>
                  {billingCodes.map((code) => (
                    <div key={code.code} className={`p-3 rounded-lg border ${code.type === "cpt" ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-mono font-bold ${code.type === "cpt" ? "text-green-400" : "text-cyan-400"}`}>{code.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-gray-300">{code.type.toUpperCase()}</span>
                      </div>
                      <p className="text-white text-sm">{code.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${code.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(code.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={generateCodes}
                    disabled={(transcript.length === 0 && !soapNote.assessment) || isGenerating}
                    className="px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isGenerating ? "Generating..." : "🏷️ Generate ICD-10/CPT Codes"}
                  </button>
                  <p className="text-gray-500 text-xs mt-3">AI-suggested billing codes</p>
                </div>
              )}
            </div>
          )}

          {/* INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <div>
              {patientInstructions ? (
                <div className="space-y-3">
                  <textarea
                    value={patientInstructions}
                    onChange={(e) => setPatientInstructions(e.target.value)}
                    className="w-full h-64 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm leading-relaxed resize-none focus:outline-none focus:border-cyan-500"
                  />
                  <button className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 font-medium">
                    📧 Send to Patient
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={generateInstructions}
                    disabled={isGenerating}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isGenerating ? "Generating..." : "📄 Generate Instructions"}
                  </button>
                  <p className="text-gray-500 text-xs mt-3">Patient take-home instructions</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Action Footer */}
        <div className="p-3 border-t border-slate-700/50 flex gap-2 flex-shrink-0">
          <button onClick={generateSOAP} disabled={transcript.length === 0 || isGenerating} className="flex-1 py-2 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 font-medium">
            SOAP
          </button>
          <button onClick={generateCodes} disabled={(transcript.length === 0 && !soapNote.assessment) || isGenerating} className="flex-1 py-2 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 font-medium">
            Codes
          </button>
          <button onClick={generateInstructions} disabled={isGenerating} className="flex-1 py-2 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 font-medium">
            Instructions
          </button>
        </div>
      </div>

      {/* Dialpad Modal - One Click Call */}
      {showDialpad && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDialpad(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Patient Info Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{patientName.charAt(0).toUpperCase()}</span>
              </div>
              <h3 className="text-white font-bold text-lg">{patientName}</h3>
              <p className="text-gray-400 text-sm">Call patient&apos;s phone</p>
            </div>

            {/* Phone Number Display */}
            <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-600">
              <input
                type="tel"
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full bg-transparent text-white text-center text-xl font-mono focus:outline-none"
              />
            </div>

            {/* One-Click Call Button */}
            <button
              onClick={dialOut}
              disabled={isDialing || !dialNumber}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg shadow-green-500/30 mb-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isDialing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {patientName.split(" ")[0]}
                </>
              )}
            </button>

            {/* Dialpad Grid (collapsed by default, expandable) */}
            <details className="group">
              <summary className="text-gray-400 text-sm text-center cursor-pointer hover:text-white transition-colors list-none flex items-center justify-center gap-1">
                <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Edit number
              </summary>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => setDialNumber((prev) => prev + digit)}
                    className="py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-lg font-semibold active:scale-95 transition-transform"
                  >
                    {digit}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                className="w-full mt-2 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm"
              >
                ⌫ Backspace
              </button>
            </details>

            {/* Cancel */}
            <button 
              onClick={() => setShowDialpad(false)} 
              className="w-full mt-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resize Handle */}
      {!isMobile && (
        <div
          className="absolute right-0 bottom-0 w-6 h-6 cursor-se-resize bg-cyan-600/50 rounded-tl-lg hover:bg-cyan-500 transition-colors flex items-center justify-center"
          onMouseDown={startResize}
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </div>
  );

  // =============================================
  // MAIN RENDER
  // =============================================
  const renderFloatingContent = () => {
    // When minimized but in a call, we need to keep the expanded panel mounted (but hidden)
    // so the Daily iframe doesn't get destroyed
    const showMinimizedBar = panelState === "minimized";
    const keepExpandedMounted = panelState === "expanded" || (panelState === "minimized" && isInCall);
    const isExpandedVisible = panelState === "expanded";
    
    return (
      <>
        {showMinimizedBar && renderMinimizedBar()}
        {keepExpandedMounted && (
          <div 
            style={{ 
              visibility: isExpandedVisible ? "visible" : "hidden",
              pointerEvents: isExpandedVisible ? "auto" : "none",
            }}
          >
            {renderExpandedPanel()}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {renderTriggerButton()}

      {isMounted && portalContainer && panelState !== "closed" && createPortal(renderFloatingContent(), portalContainer)}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `}</style>
    </>
  );
}














// force rebuild
