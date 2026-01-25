"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Video, Play, Clock, X, Maximize2, Minimize2, Move, Signal, SignalLow, SignalZero } from "lucide-react";
import DailyIframe, { DailyCall, DailyParticipant } from "@daily-co/daily-js";

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
  currentUser?: {
    email?: string;
  } | null;
  isCustomizeMode?: boolean;
  sectionProps?: Record<string, unknown>;
  sectionId?: string;
}

// =============================================
// FLOATING OVERLAY PANEL COMPONENT
// =============================================
export default function DailyMeetingEmbed({
  appointment,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = "daily-meeting-info",
}: DailyMeetingEmbedProps) {
  // =============================================
  // PORTAL MOUNT STATE (SSR-safe)
  // =============================================
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Create portal container on mount - appended to body to escape all stacking contexts
    const existingContainer = document.getElementById('video-consultation-portal');
    if (existingContainer) {
      setPortalContainer(existingContainer);
      return;
    }
    
    const container = document.createElement('div');
    container.id = 'video-consultation-portal';
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

    return () => {
      // Only remove if we created it and it's still in the DOM
      const el = document.getElementById('video-consultation-portal');
      if (el && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    };
  }, []);

  // =============================================
  // FLOATING PANEL STATE
  // =============================================
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 60 });
  const [size, setSize] = useState({ width: 550, height: 850 });
  const posRef = useRef(position);
  const sizeRef = useRef(size);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { posRef.current = position; }, [position]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // =============================================
  // DAILY.CO SDK STATE
  // =============================================
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [callState, setCallState] = useState<'idle' | 'joining' | 'joined' | 'left' | 'error'>('idle');
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [networkQuality, setNetworkQuality] = useState<'good' | 'low' | 'very-low'>('good');
  const [callError, setCallError] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const dailyContainerRef = useRef<HTMLDivElement>(null);

  // =============================================
  // RECORDING STATE
  // =============================================
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>("");
  const [allRecordings, setAllRecordings] = useState<Array<{
    id: string;
    duration: number;
    startTime: string;
    download_link?: string;
  }>>([]);

  // =============================================
  // COUNTDOWN STATE
  // =============================================
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  const joinUrl = useMemo(() => {
    if (!appointment?.dailyco_meeting_url) return "";
    return appointment.dailyco_meeting_url;
  }, [appointment?.dailyco_meeting_url]);

  // =============================================
  // DRAG HANDLERS
  // =============================================
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = posRef.current;

    const onMove = (ev: MouseEvent) => {
      const nextX = startPos.x + (ev.clientX - startX);
      const nextY = startPos.y + (ev.clientY - startY);
      setPosition({
        x: Math.max(0, Math.min(nextX, window.innerWidth - 100)),
        y: Math.max(0, Math.min(nextY, window.innerHeight - 50)),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = sizeRef.current;
    const onMove = (ev: MouseEvent) => {
      setSize({
        width: Math.max(400, startSize.width + ev.clientX - startX),
        height: Math.max(500, startSize.height + ev.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // =============================================
  // DAILY.CO INITIALIZATION
  // =============================================
  const initializeDaily = useCallback(async (roomUrl: string) => {
    if (!roomUrl) return;

    try {
      setCallState('joining');
      setCallError(null);

      // Cleanup existing
      if (callObject) {
        await callObject.destroy();
      }

      const newCallObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });

      // Event handlers
      newCallObject.on('joining-meeting', () => {
        setCallState('joining');
      });

      newCallObject.on('joined-meeting', () => {
        setCallState('joined');
        setIsInCall(true);
        // Start timer
        callTimerRef.current = setInterval(() => {
          setCallSeconds(prev => prev + 1);
        }, 1000);
        
        const allParticipants = newCallObject.participants();
        setParticipants(allParticipants);
        
        // Set up local video
        const localVideo = allParticipants.local?.tracks?.video;
        if (localVideoRef.current && localVideo?.track) {
          const stream = new MediaStream([localVideo.track]);
          localVideoRef.current.srcObject = stream;
        }
      });

      newCallObject.on('left-meeting', () => {
        setCallState('left');
        setIsInCall(false);
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
        }
      });

      newCallObject.on('participant-joined', (event) => {
        if (!event?.participant) return;
        setParticipants(prev => ({
          ...prev,
          [event.participant.session_id]: event.participant
        }));
      });

      newCallObject.on('participant-left', (event) => {
        if (!event?.participant) return;
        setParticipants(prev => {
          const updated = { ...prev };
          delete updated[event.participant.session_id];
          return updated;
        });
      });

      newCallObject.on('participant-updated', (event) => {
        if (!event?.participant) return;
        setParticipants(prev => ({
          ...prev,
          [event.participant.session_id]: event.participant
        }));
        
        const remoteVideo = event.participant.tracks?.video;
        if (!event.participant.local && remoteVideoRef.current && remoteVideo?.track) {
          const stream = new MediaStream([remoteVideo.track]);
          remoteVideoRef.current.srcObject = stream;
        }
      });

      newCallObject.on('network-quality-change', (event) => {
        if (event?.threshold) {
          setNetworkQuality(event.threshold as 'good' | 'low' | 'very-low');
        }
      });

      newCallObject.on('error', (event) => {
        console.error('Daily.co error:', event);
        setCallState('error');
        setCallError((event as { errorMsg?: string })?.errorMsg || 'An error occurred');
      });

      setCallObject(newCallObject);

      // Join
      await newCallObject.join({
        url: roomUrl,
        token: appointment?.dailyco_owner_token || undefined,
        userName: 'Dr. Provider'
      });

    } catch (err) {
      console.error('Failed to initialize Daily.co:', err);
      setCallError(err instanceof Error ? err.message : 'Failed to join meeting');
      setCallState('error');
    }
  }, [callObject, appointment?.dailyco_owner_token]);

  // =============================================
  // CALL CONTROLS
  // =============================================
  const toggleMute = useCallback(async () => {
    if (callObject) {
      const newMuteState = !isMuted;
      await callObject.setLocalAudio(!newMuteState);
      setIsMuted(newMuteState);
    }
  }, [callObject, isMuted]);

  const toggleVideo = useCallback(async () => {
    if (callObject) {
      const newVideoOffState = !isVideoOff;
      await callObject.setLocalVideo(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
    }
  }, [callObject, isVideoOff]);

  const leaveCall = useCallback(async () => {
    if (callObject) {
      await callObject.leave();
      await callObject.destroy();
      setCallObject(null);
      setIsInCall(false);
      setCallState('idle');
      setCallSeconds(0);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }
  }, [callObject]);

  // =============================================
  // RECORDING FETCH
  // =============================================
  const fetchRecordingInfo = useCallback(async () => {
    if (!appointment?.id) return;
    setRecordingLoading(true);
    try {
      const response = await fetch(
        `/api/appointments/recordings?appointmentId=${appointment.id}`,
      );
      const data = await response.json();
      if (data.success && data.recordingUrl) {
        setRecordingUrl(data.recordingUrl);
        setRecordingStatus("Recording available");
        if (data.allRecordings) {
          setAllRecordings(
            data.allRecordings.map((rec: { id: string; duration: number; start_ts: number }) => ({
              id: rec.id,
              duration: rec.duration,
              startTime: new Date(rec.start_ts * 1000).toISOString(),
              download_link: data.recordingUrl,
            })),
          );
        }
      } else {
        setRecordingStatus(data.message || "No recording found");
      }
    } catch {
      setRecordingStatus("Error checking recording status.");
    } finally {
      setRecordingLoading(false);
    }
  }, [appointment?.id]);

  // =============================================
  // COUNTDOWN TIMER
  // =============================================
  useEffect(() => {
    if (!appointment?.requested_date_time) return;
    const updateTimer = () => {
      const diff = new Date(appointment.requested_date_time!).getTime() - new Date().getTime();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObject) {
        callObject.destroy().catch(console.error);
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callObject]);

  // =============================================
  // HELPERS
  // =============================================
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCountdown = () => {
    if (!timeRemaining) return null;
    if (timeRemaining.isPast) return "Meeting has started";
    return `${timeRemaining.days > 0 ? timeRemaining.days + "d " : ""}${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
  };

  const remoteParticipant = Object.values(participants).find(p => !p.local);
  const remoteParticipantName = remoteParticipant?.user_name || 'Patient';

  const NetworkIcon = networkQuality === 'good' ? Signal : networkQuality === 'low' ? SignalLow : SignalZero;

  // =============================================
  // RENDER - TRIGGER BUTTON (in dashboard)
  // =============================================
  const renderTriggerButton = () => (
    <div key={sectionId} {...(sectionProps as React.HTMLAttributes<HTMLDivElement>)} className="relative">
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/10">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all font-medium shadow-lg shadow-cyan-500/25"
        >
          <Video className="h-5 w-5" />
          <span>Open Video Consultation</span>
          {appointment?.dailyco_room_name && (
            <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded uppercase">
              {appointment.dailyco_room_name}
            </span>
          )}
        </button>
        {timeRemaining && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-cyan-400" />
            <span className="text-gray-400">
              {timeRemaining.isPast ? "Status:" : "Starts in:"}
            </span>
            <span className="text-cyan-400 font-mono font-bold">{formatCountdown()}</span>
          </div>
        )}
      </div>
    </div>
  );

  // =============================================
  // RENDER - FLOATING OVERLAY PANEL (via Portal)
  // =============================================
  const floatingPanel = (
    <div
      className="absolute pointer-events-auto bg-[#0f1318] rounded-2xl shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 56 : size.height,
        border: '2px solid rgba(6, 182, 212, 0.5)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 60px rgba(6, 182, 212, 0.3)',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* ============================================= */}
      {/* DRAG BORDER - All sides */}
      {/* ============================================= */}
      {/* Top drag bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-2 cursor-move hover:bg-cyan-500/20 transition-colors"
        onMouseDown={startDrag}
      />
      {/* Left drag bar */}
      <div 
        className="absolute top-0 left-0 bottom-0 w-2 cursor-move hover:bg-cyan-500/20 transition-colors"
        onMouseDown={startDrag}
      />
      {/* Right drag bar */}
      <div 
        className="absolute top-0 right-0 bottom-0 w-2 cursor-move hover:bg-cyan-500/20 transition-colors"
        onMouseDown={startDrag}
      />
      {/* Bottom drag bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-2 cursor-move hover:bg-cyan-500/20 transition-colors"
        onMouseDown={startDrag}
      />

      {/* ============================================= */}
      {/* HEADER - Medazon Style */}
      {/* ============================================= */}
      <div 
        className="flex items-center justify-between px-4 h-[56px] bg-gradient-to-r from-[#0f1318] to-[#1a1f2e] border-b border-cyan-500/30 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <span className="text-orange-500 font-bold text-lg tracking-wider">MEDAZON</span>
            <span className="text-white font-bold text-lg mx-1">+</span>
            <span className="text-teal-400 font-bold text-lg tracking-wider">HEALTH</span>
          </div>
          {isInCall && (
            <div className="flex items-center gap-2 ml-3 bg-slate-800/50 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-sm font-mono">{formatTime(callSeconds)}</span>
              <NetworkIcon className={`h-4 w-4 ${networkQuality === 'good' ? 'text-green-400' : networkQuality === 'low' ? 'text-yellow-400' : 'text-red-400'}`} />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-xs mr-2 flex items-center gap-1">
            <Move className="h-3 w-3" />
            Drag to move
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isInCall) leaveCall();
              setIsOpen(false);
            }}
            className="p-2 hover:bg-red-500/30 rounded-lg transition-colors text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ============================================= */}
      {/* CONTENT - Only shown when not minimized */}
      {/* ============================================= */}
      {!isMinimized && (
        <div className="h-[calc(100%-56px)] overflow-y-auto custom-scrollbar bg-[#1a1f2e]">
          {/* Status Bar */}
          {timeRemaining && (
            <div className="mx-4 mt-4 p-3 bg-slate-800/50 rounded-lg border border-cyan-500/30">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span className="text-sm text-gray-400">
                  {timeRemaining.isPast ? "Status:" : "Starts in:"}
                </span>
                <span className="text-lg font-bold text-cyan-400 font-mono ml-auto">
                  {formatCountdown()}
                </span>
              </div>
            </div>
          )}

          {/* Start Call Button */}
          {!isInCall && (
            <div className="mx-4 mt-4">
              <button
                onClick={() => joinUrl && initializeDaily(joinUrl)}
                disabled={!joinUrl || callState === 'joining'}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all font-medium shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Video className="h-5 w-5" />
                <span>{callState === 'joining' ? 'Connecting...' : 'Start Video Call'}</span>
              </button>
              {appointment?.dailyco_room_name && (
                <div className="text-center text-sm text-gray-400 mt-2">
                  Room: <span className="text-white font-bold uppercase">{appointment.dailyco_room_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {callState === 'error' && callError && (
            <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{callError}</p>
              <button
                onClick={() => joinUrl && initializeDaily(joinUrl)}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* ============================================= */}
          {/* VIDEO AREA */}
          {/* ============================================= */}
          {isInCall && (
            <div className="mx-4 mt-4">
              {/* Main Video (Remote/Patient) */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700" style={{ height: '380px' }}>
                {remoteParticipant?.tracks?.video?.track ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-pink-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                        <span className="text-white text-3xl font-semibold">
                          {remoteParticipantName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white text-lg">{remoteParticipantName}</p>
                      <p className="text-slate-400 text-sm mt-1">Waiting to connect...</p>
                    </div>
                  </div>
                )}

                {/* Local Video (Self) - Picture in Picture */}
                <div className="absolute bottom-3 right-3 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
                  {participants.local?.tracks?.video?.track && !isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-24 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-24 h-20 flex items-center justify-center">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">You</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Call Duration Overlay */}
                <div className="absolute top-3 left-3 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-sm font-mono">{formatTime(callSeconds)}</span>
                </div>
              </div>

              {/* ============================================= */}
              {/* CALL CONTROLS */}
              {/* ============================================= */}
              <div className="flex items-center justify-center gap-3 mt-4 p-3 bg-slate-800/50 rounded-xl">
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full transition-all ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}
                  title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                >
                  {isVideoOff ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={leaveCall}
                  className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-all"
                  title="End call"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ============================================= */}
          {/* RECORDINGS SECTION */}
          {/* ============================================= */}
          <div className="mx-4 mt-6 mb-4">
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-md font-bold text-white mb-3 flex items-center gap-2">
                <Play className="h-4 w-4 text-green-400" />
                Meeting Recordings
              </h4>

              <div className="text-sm text-gray-400 mb-3">
                {recordingLoading
                  ? "Checking..."
                  : recordingStatus || "Recordings appear here after the meeting ends."}
              </div>

              {allRecordings.length > 0 && (
                <div className="space-y-2 mb-4">
                  {allRecordings.map((recording, index) => (
                    <div
                      key={recording.id}
                      className="p-3 bg-slate-800/50 rounded-lg border border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white">
                            Recording #{allRecordings.length - index}
                          </div>
                          <div className="text-xs text-gray-400">
                            Duration: {Math.floor(recording.duration / 60)}m {recording.duration % 60}s
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(recording.startTime).toLocaleString()}
                          </div>
                        </div>
                        {index === 0 && recordingUrl && (
                          <a
                            href={recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            <Play className="h-3 w-3" /> View
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {recordingUrl && allRecordings.length === 0 && (
                <a
                  href={recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-3"
                >
                  <Play className="h-4 w-4" /> View Recording
                </a>
              )}

              <button
                onClick={fetchRecordingInfo}
                disabled={recordingLoading || !appointment?.id}
                className="text-xs px-3 py-1.5 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50"
              >
                {recordingLoading ? "Checking..." : "Refresh Recording Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resize Handle - Bottom Right */}
      {!isMinimized && (
        <div
          className="absolute right-0 bottom-0 w-6 h-6 cursor-se-resize bg-cyan-600/60 rounded-tl-lg hover:bg-cyan-500 transition-colors flex items-center justify-center"
          onMouseDown={startResize}
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </div>
  );

  if (!isOpen) return renderTriggerButton();

  return (
    <>
      {renderTriggerButton()}
      
      {/* Render floating panel via Portal to document.body - escapes all parent stacking contexts */}
      {isMounted && portalContainer && createPortal(floatingPanel, portalContainer)}

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `}</style>
    </>
  );
}







