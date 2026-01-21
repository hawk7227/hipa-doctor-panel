"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Video, Play, GripVertical, Clock, X } from "lucide-react";

/**
 * Daily.co Meeting Component
 * Note: For a simple implementation, Daily.co works best via iframe.
 * If you need deep event handling, you can install '@daily-co/daily-js'
 */
interface DailyMeetingProps {
  roomUrl: string;
  token?: string; // Optional owner token
}

const DailyMeeting: React.FC<DailyMeetingProps> = ({ roomUrl, token }) => {
  if (!roomUrl)
    return <div className="text-white p-4">Error: No Meeting URL found.</div>;

  return (
    <iframe
      src={roomUrl}
      title="Daily.co Meeting"
      className="w-full h-full border-0 bg-slate-900"
      allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-read; clipboard-write; microphone; camera; speaker-selection;"
      allowFullScreen
    />
  );
};

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

// Reusable Floating Window Component (Maintained from your reference)
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
        className="absolute bg-black rounded-xl shadow-xl border border-white/10 pointer-events-auto overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: minimized ? 44 : size.height,
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-11 bg-slate-900 rounded-t-xl cursor-move select-none"
          onMouseDown={startDrag}
        >
          <span className="text-sm text-white font-medium">{title}</span>
          <div className="flex gap-2">
            <button
              className="text-white text-sm px-2"
              onClick={() => setMinimized((v) => !v)}
            >
              {minimized ? "▢" : "—"}
            </button>
            <button className="text-white text-sm px-2" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        {!minimized && (
          <div className="w-full h-[calc(100%-44px)] bg-black">{children}</div>
        )}
        {!minimized && (
          <div
            className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
            onMouseDown={startResize}
          />
        )}
      </div>
    </div>
  );
}

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

    try {
      const url = new URL(appointment?.dailyco_meeting_url);
      if (appointment?.dailyco_owner_token) {
        // Use 't' for Prebuilt UI tokens
        url.searchParams.set("t", appointment?.dailyco_owner_token);
      }
      return url.toString();
    } catch (e) {
      console.error("Invalid Room URL", e);
      return appointment?.dailyco_meeting_url;
    }
  }, [appointment?.dailyco_meeting_url, appointment?.dailyco_owner_token]);

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

  // Fetch recording info logic (Refactored for Daily)
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
              download_link: data.recordingUrl, // For the latest one
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
          Daily.co Meeting Information
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
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleStartMeeting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Video className="h-4 w-4" />
                <span>Join Meeting</span>
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
          ) : (
            <div className="text-sm text-gray-400">
              Meeting link will be available once the appointment is confirmed.
            </div>
          )}
        </div>

        {/* Daily.co Floating Window */}
        <FloatingWindow
          open={openMeetingModal && !!appointment?.dailyco_meeting_url}
          onClose={() => setOpenMeetingModal(false)}
          title={`Daily Meeting: ${appointment?.dailyco_room_name || ""}`}
          initialPosition={{ x: 80, y: 60 }}
          initialSize={{ width: 1000, height: 650 }}
        >
          <div className="relative w-full h-full flex flex-col">
            <div className="flex gap-2 items-center bg-slate-900 p-2 border-b border-white/5">
              <a
                href={joinUrl ?? "#"}
                target="_blank"
                className="text-xs text-blue-400 hover:underline px-2"
              >
                Join in new tab
              </a>
              <button
                onClick={() => setOpenMeetingModal(false)}
                className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1 rounded-md hover:bg-red-600 hover:text-white transition-all text-xs"
              >
                <X className="h-3 w-3" /> End Session
              </button>
            </div>

            <DailyMeeting
              roomUrl={joinUrl ?? ""}
              token={appointment?.dailyco_owner_token ?? undefined}
            />
          </div>
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
