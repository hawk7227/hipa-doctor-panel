"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Video, Play, GripVertical, Clock, X, Mic, MicOff, VideoOff, PhoneOff, Maximize2, Minimize2 } from "lucide-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

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
  sectionProps?: any;
  sectionId?: string;
}

type FloatingWindowProps = {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
};

// Reusable Floating Window Component
export function FloatingWindow({
  title = "Window",
  open,
  onClose,
  children,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 600, height: 500 },
  minWidth = 360,
  minHeight = 240,
}: FloatingWindowProps) {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [minimized, setMinimized] = useState(false);

  const posRef = useRef(position);
  const sizeRef = useRef(size);

  useEffect(() => {
    posRef.current = position;
  }, [position]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = posRef.current;

    const onMove = (ev: MouseEvent) => {
      const nextX = startPos.x + (ev.clientX - startX);
      const nextY = startPos.y + (ev.clientY - startY);
      setPosition({
        x: Math.min(Math.max(0, nextX), window.innerWidth - 80),
        y: Math.min(Math.max(0, nextY), window.innerHeight - 60),
      });
    };
    const onUp = () => {
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
        width: Math.max(minWidth, startSize.width + ev.clientX - startX),
        height: Math.max(minHeight, startSize.height + ev.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!open) return null;

  return (
    <div id="FloatingWindow" className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute bg-black rounded-xl shadow-2xl border border-white/20 pointer-events-auto overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: minimized ? 44 : size.height,
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-11 bg-slate-900 rounded-t-xl cursor-move select-none border-b border-white/10"
          onMouseDown={startDrag}
        >
          <span className="text-sm text-white font-medium">{title}</span>
          <div className="flex gap-2">
            <button
              className="text-white text-sm px-2 hover:bg-white/10 rounded"
              onClick={() => setMinimized((v) => !v)}
            >
              {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button className="text-white text-sm px-2 hover:bg-red-500/20 rounded" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!minimized && (
          <div className="w-full h-[calc(100%-44px)] bg-black">{children}</div>
        )}
        {!minimized && (
          <div
            className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize bg-slate-700 rounded-tl"
            onMouseDown={startResize}
          />
        )}
      </div>
    </div>
  );
}

// Daily.co Meeting Component using SDK
interface DailyMeetingProps {
  roomUrl: string;
  token?: string;
  onLeave?: () => void;
}

const DailyMeetingSDK: React.FC<DailyMeetingProps> = ({ roomUrl, token, onLeave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !roomUrl) return;

    const initCall = async () => {
      try {
        setIsJoining(true);
        setError(null);

        // Destroy existing call frame if any
        if (callFrameRef.current) {
          await callFrameRef.current.destroy();
          callFrameRef.current = null;
        }

        // Create the call frame using Daily's prebuilt UI
        const callFrame = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '0',
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          showLocalVideo: true,
          showParticipantsBar: true,
        });

        callFrameRef.current = callFrame;

        // Set up event listeners
        callFrame.on('joined-meeting', () => {
          console.log('Joined Daily.co meeting');
          setIsJoining(false);
        });

        callFrame.on('left-meeting', () => {
          console.log('Left Daily.co meeting');
          onLeave?.();
        });

        callFrame.on('error', (e) => {
          console.error('Daily.co error:', e);
          setError(e?.errorMsg || 'An error occurred');
          setIsJoining(false);
        });

        callFrame.on('participant-joined', () => {
          const participants = callFrame.participants();
          setParticipantCount(Object.keys(participants).length);
        });

        callFrame.on('participant-left', () => {
          const participants = callFrame.participants();
          setParticipantCount(Object.keys(participants).length);
        });

        // Join the room
        const joinConfig: { url: string; token?: string } = { url: roomUrl };
        if (token) {
          joinConfig.token = token;
        }

        await callFrame.join(joinConfig);
        
        // Get initial participant count
        const participants = callFrame.participants();
        setParticipantCount(Object.keys(participants).length);

      } catch (err: any) {
        console.error('Failed to initialize Daily.co:', err);
        setError(err.message || 'Failed to join meeting');
        setIsJoining(false);
      }
    };

    initCall();

    // Cleanup on unmount
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy().catch(console.error);
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, token, onLeave]);

  const toggleMute = useCallback(async () => {
    if (callFrameRef.current) {
      const newMutedState = !isMuted;
      await callFrameRef.current.setLocalAudio(!newMutedState);
      setIsMuted(newMutedState);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    if (callFrameRef.current) {
      const newVideoOffState = !isVideoOff;
      await callFrameRef.current.setLocalVideo(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
    }
  }, [isVideoOff]);

  const leaveCall = useCallback(async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      onLeave?.();
    }
  }, [onLeave]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center p-6">
          <div className="text-red-400 text-lg mb-2">Failed to join meeting</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 relative">
      {/* Loading overlay */}
      {isJoining && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
            <div className="text-white text-lg">Joining meeting...</div>
            <div className="text-gray-400 text-sm mt-2">Setting up camera and microphone</div>
          </div>
        </div>
      )}
      
      {/* Daily.co frame container - this is where the prebuilt UI renders */}
      <div ref={containerRef} className="flex-1 w-full" />
      
      {/* Custom control bar (optional - Daily's prebuilt UI has its own controls) */}
      <div className="h-14 bg-slate-800 border-t border-white/10 flex items-center justify-center gap-4 px-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-600 hover:bg-slate-500'
          }`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5 text-white" /> : <Video className="h-5 w-5 text-white" />}
        </button>
        
        <button
          onClick={leaveCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="Leave meeting"
        >
          <PhoneOff className="h-5 w-5 text-white" />
        </button>
        
        <div className="ml-4 text-sm text-gray-400">
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export default function DailyMeetingEmbed({
  appointment,
  currentUser,
  isCustomizeMode = false,
  sectionProps = {},
  sectionId = "daily-meeting-info",
}: DailyMeetingEmbedProps) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>("");
  const [openMeetingModal, setOpenMeetingModal] = useState(false);
  const [allRecordings, setAllRecordings] = useState<
    Array<{
      id: string;
      duration: number;
      startTime: string;
      download_link?: string;
    }>
  >([]);
  
  const joinUrl = useMemo(() => {
    if (!appointment?.dailyco_meeting_url) return "";
    return appointment.dailyco_meeting_url;
  }, [appointment?.dailyco_meeting_url]);

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);
  
  console.log("Appointment data:", appointment);
  
  const checkMeetingStatus = useCallback(() => {
    if (!appointment?.requested_date_time) return false;
    const meetingTime = new Date(appointment.requested_date_time);
    const now = new Date();
    return (
      now >= meetingTime ||
      Math.abs(meetingTime.getTime() - now.getTime()) < 5 * 60 * 1000
    );
  }, [appointment?.requested_date_time]);

  const handleStartMeeting = () => {
    if (!appointment?.dailyco_meeting_url) {
      alert("Meeting URL is not available.");
      return;
    }
    setOpenMeetingModal(true);
  };

  const handleLeaveMeeting = useCallback(() => {
    setOpenMeetingModal(false);
  }, []);

  // Fetch recording info logic
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
        // Store all recordings if available
        if (data.allRecordings) {
          setAllRecordings(
            data.allRecordings.map((rec: any) => ({
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
    } catch (err) {
      setRecordingStatus("Error checking recording status.");
    } finally {
      setRecordingLoading(false);
    }
  }, [appointment?.id]);

  useEffect(() => {
    if (!appointment?.requested_date_time) return;
    const updateTimer = () => {
      const diff =
        new Date(appointment.requested_date_time!).getTime() -
        new Date().getTime();
      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true,
        });
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

  const formatCountdown = () => {
    if (!timeRemaining) return null;
    if (timeRemaining.isPast) return "Meeting has started";
    return `${timeRemaining.days > 0 ? timeRemaining.days + "d " : ""}${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
  };

  return (
    <div key={sectionId} {...sectionProps} className="relative">
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Video className="h-5 w-5 text-cyan-400" />
          Video Consultation
        </h3>

        {/* Countdown */}
        {timeRemaining && (
          <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-gray-400">
                {timeRemaining.isPast ? "Status:" : "Starts in:"}
              </span>
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {formatCountdown()}
            </div>
          </div>
        )}

        {/* Start Meeting Button */}
        <div className="mb-4">
          {appointment?.dailyco_meeting_url ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleStartMeeting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all font-medium shadow-lg shadow-cyan-500/25"
                >
                  <Video className="h-5 w-5" />
                  <span>Start Video Call</span>
                </button>
                {appointment?.dailyco_room_name && (
                  <div className="text-sm">
                    <span className="text-gray-400">Room: </span>
                    <span className="font-bold text-white uppercase">
                      {appointment.dailyco_room_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              Meeting link will be available once the appointment is confirmed.
            </div>
          )}
        </div>

        {/* Daily.co Floating Window with SDK */}
        <FloatingWindow
          open={openMeetingModal && !!appointment?.dailyco_meeting_url}
          onClose={handleLeaveMeeting}
          title={`Video Call: ${appointment?.dailyco_room_name || "Meeting"}`}
          initialPosition={{ x: 80, y: 60 }}
          initialSize={{ width: 1000, height: 700 }}
        >
          <DailyMeetingSDK
            roomUrl={joinUrl}
            token={appointment?.dailyco_owner_token ?? undefined}
            onLeave={handleLeaveMeeting}
          />
        </FloatingWindow>

        <hr className="border-white/10 my-4" />

        <h4 className="text-md font-bold text-white mb-2 flex items-center gap-2">
          <Play className="h-4 w-4 text-green-400" />
          Meeting Recordings
        </h4>

        <div className="text-sm text-gray-400 mb-3">
          {recordingLoading
            ? "Checking..."
            : recordingStatus ||
              "Recordings appear here after the meeting ends."}
        </div>

        {/* Display all recordings */}
        {allRecordings.length > 0 && (
          <div className="space-y-2 mb-4">
            {allRecordings.map((recording, index) => (
              <div
                key={recording.id}
                className="p-3 bg-slate-700/50 rounded-lg border border-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Recording #{allRecordings.length - index}
                    </div>
                    <div className="text-xs text-gray-400">
                      Duration: {Math.floor(recording.duration / 60)}m{" "}
                      {recording.duration % 60}s
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

        {/* Single recording view (fallback) */}
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

        <div>
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
  );
}
