'use client';

// ============================================================================
// BUGSY RECORDING SCREEN v3.0 — Full Annotation Toolkit
// Drawing: freehand, arrows, circles, rectangles, text labels
// Markers: click tracking, pins, region highlights
// Controls: pause/resume, mic, undo stack, clear, show/hide
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Square, MousePointer2, Clock, AlertCircle,
  Maximize2, Minimize2, Pause, Play, Undo2, Trash2,
  MapPin, Highlighter, X, ChevronUp, ChevronDown,
  Eye, EyeOff, MessageSquare, Pencil, ArrowUpRight,
  Circle, RectangleHorizontal, Type, Palette,
} from 'lucide-react';
import type { InterviewContext, RecordingData, TranscriptData, InteractionEvent, ScreenMarker, Annotation } from '@/types/bugsy';
import BugsyTour, { shouldShowTour } from './BugsyTour';
import BugsyHelpSheet, { BugsyHelpButton } from './BugsyHelpSheet';

// ── Speech API types ──
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; message?: string; }
interface SpeechRecognitionResultList { length: number; [i: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { isFinal: boolean; length: number; [i: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognition extends EventTarget { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: SpeechRecognitionEvent) => void) | null; onerror: ((e: SpeechRecognitionErrorEvent) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void; }
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition; } }

// ── Types ──
type ToolMode = 'click' | 'pin' | 'highlight' | 'draw' | 'arrow' | 'circle' | 'rect' | 'text';
const COLORS = ['#facc15', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

interface DrawItem {
  id: number;
  type: 'freehand' | 'arrow' | 'circle' | 'rect' | 'text' | 'highlight';
  color: string;
  points?: { x: number; y: number }[];        // freehand
  from?: { x: number; y: number };             // arrow/rect/circle start
  to?: { x: number; y: number };               // arrow/rect/circle end
  text?: string;                                // text label
  pos?: { x: number; y: number };              // text position
}

interface BugsyRecordingScreenProps {
  onStop: (data: RecordingData, transcript: TranscriptData, interactions: InteractionEvent[], markers: ScreenMarker[]) => void;
  context: InterviewContext;
}

const MAX_DUR = 300;
const MIN_DUR = 3;

export default function BugsyRecordingScreen({ onStop, context }: BugsyRecordingScreenProps) {
  // ── Core state ──
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [markers, setMarkers] = useState<ScreenMarker[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);

  // ── UI state ──
  const [isMinimized, setIsMinimized] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [mobileTools, setMobileTools] = useState(false);
  const [tool, setTool] = useState<ToolMode>('click');
  const [drawColor, setDrawColor] = useState('#facc15');
  const [showColors, setShowColors] = useState(false);
  const [drawItems, setDrawItems] = useState<DrawItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentFreehand, setCurrentFreehand] = useState<{ x: number; y: number }[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  // ── Tour & Help ──
  const [showTour, setShowTour] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tourChecked, setTourChecked] = useState(false);

  // ── Undo stack ──
  const [undoStack, setUndoStack] = useState<Array<{ markers: ScreenMarker[]; drawItems: DrawItem[]; interactions: InteractionEvent[] }>>([]);

  // ── Refs ──
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const markerCount = useRef(0);
  const drawCount = useRef(0);
  const t0 = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const durRef = useRef(0);
  const recRef = useRef(false);
  const pauseRef = useRef(false);
  const txRef = useRef('');
  const mkRef = useRef<ScreenMarker[]>([]);
  const ixRef = useRef<InteractionEvent[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  // ── Sync ──
  useEffect(() => { durRef.current = duration; }, [duration]);
  useEffect(() => { recRef.current = isRecording; }, [isRecording]);
  useEffect(() => { pauseRef.current = isPaused; }, [isPaused]);
  useEffect(() => { txRef.current = transcript; }, [transcript]);
  useEffect(() => { mkRef.current = markers; }, [markers]);
  useEffect(() => { ixRef.current = interactions; }, [interactions]);

  // ── Auto-start ──
  useEffect(() => { startRecording(); return () => stopAll(); }, []);

  // ── Tour auto-show on first use ──
  useEffect(() => {
    if (isRecording && !tourChecked) {
      setTourChecked(true);
      if (shouldShowTour()) {
        // Small delay so recording starts first
        const t = setTimeout(() => setShowTour(true), 800);
        return () => clearTimeout(t);
      }
    }
  }, [isRecording, tourChecked]);

  // ── Timer ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => { setDuration(p => { const n = p + 1; if (n >= MAX_DUR) stopRecording(); return n; }); }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording, isPaused]);

  // ── Redraw canvas when drawItems change ──
  useEffect(() => { redrawCanvas(); }, [drawItems, currentFreehand, drawStart, isDrawing, tool]);

  // ── Resize canvas ──
  useEffect(() => {
    const resize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; redrawCanvas(); } };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Click tracking (only in click/pin mode) ──
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-bugsy-ui]')) return;
      if (tool !== 'click' && tool !== 'pin') return;
      const ts = Date.now() - t0.current;
      const xp = (e.clientX / window.innerWidth) * 100;
      const yp = (e.clientY / window.innerHeight) * 100;
      pushUndo();
      const m: ScreenMarker = {
        number: ++markerCount.current, timestamp_ms: ts,
        x_percent: xp, y_percent: yp,
        element_selector: sel(t), element_tag: t.tagName.toLowerCase(),
        element_text: t.textContent?.slice(0, 100) || undefined,
        element_id: t.id || undefined,
        action_type: tool === 'pin' ? 'pin' : 'click',
      };
      setMarkers(p => [...p, m]);
      setInteractions(p => [...p, {
        timestamp_ms: ts, action_type: tool === 'pin' ? 'pin' : 'click',
        position: { x: e.clientX, y: e.clientY, x_percent: xp, y_percent: yp },
        element: { selector: sel(t), tag: t.tagName.toLowerCase(), text: t.textContent?.slice(0, 100) || undefined, id: t.id || undefined, classes: Array.from(t.classList) },
      } as InteractionEvent]);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isRecording, isPaused, tool]);

  // ── Helpers ──
  const sel = (el: HTMLElement): string => {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') { const c = el.className.split(' ').filter(Boolean).slice(0, 2).join('.'); if (c) return `${el.tagName.toLowerCase()}.${c}`; }
    return el.tagName.toLowerCase();
  };
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const pushUndo = () => setUndoStack(s => [...s.slice(-19), { markers: [...markers], drawItems: [...drawItems], interactions: [...interactions] }]);

  // ============================================================================
  // CANVAS DRAWING
  // ============================================================================
  const redrawCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    drawItems.forEach(item => renderDrawItem(ctx, item));

    // Live freehand preview
    if (isDrawing && tool === 'draw' && currentFreehand.length > 1) {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentFreehand[0].x, currentFreehand[0].y);
      currentFreehand.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }

    // Live shape preview
    if (isDrawing && drawStart) {
      const mouse = currentFreehand[currentFreehand.length - 1];
      if (mouse) {
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        if (tool === 'arrow') { drawArrow(ctx, drawStart, mouse, drawColor); }
        else if (tool === 'circle') { const r = Math.hypot(mouse.x - drawStart.x, mouse.y - drawStart.y); ctx.beginPath(); ctx.arc(drawStart.x, drawStart.y, r, 0, Math.PI * 2); ctx.stroke(); }
        else if (tool === 'rect') { ctx.strokeRect(Math.min(drawStart.x, mouse.x), Math.min(drawStart.y, mouse.y), Math.abs(mouse.x - drawStart.x), Math.abs(mouse.y - drawStart.y)); }
        else if (tool === 'highlight') { ctx.fillStyle = drawColor + '20'; ctx.fillRect(Math.min(drawStart.x, mouse.x), Math.min(drawStart.y, mouse.y), Math.abs(mouse.x - drawStart.x), Math.abs(mouse.y - drawStart.y)); ctx.strokeRect(Math.min(drawStart.x, mouse.x), Math.min(drawStart.y, mouse.y), Math.abs(mouse.x - drawStart.x), Math.abs(mouse.y - drawStart.y)); }
        ctx.setLineDash([]);
      }
    }
  };

  const renderDrawItem = (ctx: CanvasRenderingContext2D, item: DrawItem) => {
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    switch (item.type) {
      case 'freehand':
        if (item.points && item.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(item.points[0].x, item.points[0].y);
          item.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
        break;
      case 'arrow':
        if (item.from && item.to) drawArrow(ctx, item.from, item.to, item.color);
        break;
      case 'circle':
        if (item.from && item.to) {
          const r = Math.hypot(item.to.x - item.from.x, item.to.y - item.from.y);
          ctx.beginPath(); ctx.arc(item.from.x, item.from.y, r, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      case 'rect':
        if (item.from && item.to) ctx.strokeRect(Math.min(item.from.x, item.to.x), Math.min(item.from.y, item.to.y), Math.abs(item.to.x - item.from.x), Math.abs(item.to.y - item.from.y));
        break;
      case 'highlight':
        if (item.from && item.to) {
          ctx.fillStyle = item.color + '15';
          const x = Math.min(item.from.x, item.to.x), y = Math.min(item.from.y, item.to.y);
          const w = Math.abs(item.to.x - item.from.x), h = Math.abs(item.to.y - item.from.y);
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = item.color; ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
        }
        break;
      case 'text':
        if (item.pos && item.text) {
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          const m = ctx.measureText(item.text);
          ctx.fillRect(item.pos.x - 4, item.pos.y - 16, m.width + 8, 24);
          ctx.fillStyle = item.color;
          ctx.fillText(item.text, item.pos.x, item.pos.y);
        }
        break;
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const len = 14;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - len * Math.cos(angle - Math.PI / 6), to.y - len * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - len * Math.cos(angle + Math.PI / 6), to.y - len * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  };

  // ── Canvas mouse handlers ──
  const handleCanvasDown = (e: React.MouseEvent) => {
    if (!isRecording || isPaused) return;
    if (['draw', 'arrow', 'circle', 'rect', 'highlight'].includes(tool)) {
      pushUndo();
      setIsDrawing(true);
      const pos = { x: e.clientX, y: e.clientY };
      setDrawStart(pos);
      if (tool === 'draw') setCurrentFreehand([pos]);
      else setCurrentFreehand([pos]);
    }
    if (tool === 'text') {
      setTextInput({ x: e.clientX, y: e.clientY });
      setTextValue('');
    }
  };

  const handleCanvasMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = { x: e.clientX, y: e.clientY };
    setCurrentFreehand(p => [...p, pos]);
  };

  const handleCanvasUp = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) { setIsDrawing(false); return; }
    const end = { x: e.clientX, y: e.clientY };
    const id = ++drawCount.current;

    if (tool === 'draw' && currentFreehand.length > 2) {
      setDrawItems(p => [...p, { id, type: 'freehand', color: drawColor, points: [...currentFreehand] }]);
    } else if (tool === 'arrow') {
      setDrawItems(p => [...p, { id, type: 'arrow', color: drawColor, from: drawStart, to: end }]);
    } else if (tool === 'circle') {
      setDrawItems(p => [...p, { id, type: 'circle', color: drawColor, from: drawStart, to: end }]);
    } else if (tool === 'rect') {
      setDrawItems(p => [...p, { id, type: 'rect', color: drawColor, from: drawStart, to: end }]);
    } else if (tool === 'highlight') {
      setDrawItems(p => [...p, { id, type: 'highlight', color: drawColor, from: drawStart, to: end }]);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentFreehand([]);
  };

  const handleTextSubmit = () => {
    if (textInput && textValue.trim()) {
      pushUndo();
      setDrawItems(p => [...p, { id: ++drawCount.current, type: 'text', color: drawColor, text: textValue.trim(), pos: textInput }]);
    }
    setTextInput(null);
    setTextValue('');
  };

  // ============================================================================
  // RECORDING
  // ============================================================================
  const startRecording = async () => {
    try {
      setError(null); t0.current = Date.now();
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true });
      let audio: MediaStream | null = null;
      try { audio = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); audioRef.current = audio; setIsMicActive(true);
        // Audio level monitoring
        try {
          const actx = new AudioContext();
          const src = actx.createMediaStreamSource(audio);
          const analyser = actx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          src.connect(analyser);
          audioCtxRef.current = actx;
          analyserRef.current = analyser;
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const poll = () => {
            analyser.getByteFrequencyData(dataArr);
            let sum = 0;
            for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
            const avg = sum / dataArr.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            audioAnimRef.current = requestAnimationFrame(poll);
          };
          poll();
        } catch { /* AudioContext not available */ }
      }
      catch { setIsMicActive(false); setIsMicEnabled(false); }
      const tracks = [...display.getTracks()]; if (audio) tracks.push(...audio.getTracks());
      const stream = new MediaStream(tracks); streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => onComplete();
      recorderRef.current = rec; rec.start(1000); setIsRecording(true);
      startSpeech();
      display.getVideoTracks()[0].onended = () => stopRecording();
    } catch (err) {
      console.error('Recording error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start. Please allow screen sharing.');
    }
  };

  const startSpeech = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e: SpeechRecognitionEvent) => { let f = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) f += e.results[i][0].transcript + ' '; if (f) setTranscript(p => p + f); };
    r.onerror = () => {};
    r.onend = () => { if (recRef.current && !pauseRef.current && recognitionRef.current) try { recognitionRef.current.start(); } catch {} };
    recognitionRef.current = r; r.start();
  };

  // ── Controls ──
  const togglePause = useCallback(() => {
    if (isPaused) { setIsPaused(false); recorderRef.current?.state === 'paused' && recorderRef.current.resume(); if (recognitionRef.current && isMicEnabled) try { recognitionRef.current.start(); } catch {} }
    else { setIsPaused(true); recorderRef.current?.state === 'recording' && recorderRef.current.pause(); if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {} }
  }, [isPaused, isMicEnabled]);

  const toggleMic = useCallback(() => {
    if (!audioRef.current) return;
    const next = !isMicEnabled; setIsMicEnabled(next);
    audioRef.current.getAudioTracks().forEach(t => t.enabled = next);
    setIsMicActive(next);
    if (!next && recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    else if (next && isRecording && !isPaused) startSpeech();
  }, [isMicEnabled, isRecording, isPaused]);

  const handleUndo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setMarkers(last.markers); setDrawItems(last.drawItems); setInteractions(last.interactions);
    markerCount.current = last.markers.length;
    setUndoStack(s => s.slice(0, -1));
  }, [undoStack]);

  const clearAll = useCallback(() => { pushUndo(); setMarkers([]); setDrawItems([]); setInteractions([]); markerCount.current = 0; drawCount.current = 0; }, [markers, drawItems, interactions]);

  const removeMarker = useCallback((n: number) => { pushUndo(); setMarkers(p => p.filter(m => m.number !== n)); }, [markers, drawItems, interactions]);

  const stopRecording = useCallback(() => {
    if (durRef.current < MIN_DUR) { setError(`Record at least ${MIN_DUR}s`); return; }
    setIsRecording(false); setIsPaused(false);
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  const onComplete = () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const t = txRef.current;
    const stops = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','to','of','in','for','on','with','at','by','from','as','and','but','if','or','not','so','just','this','that','am','i','my','me','it','its']);
    const kw = [...new Set(t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stops.has(w)))];
    onStop(
      { video_url: url, duration_seconds: durRef.current, file_size_bytes: blob.size },
      { full_text: t, segments: [{ time: 0, text: t, confidence: 0.9 }], keywords_found: kw },
      ixRef.current, mkRef.current
    );
    stopAll();
  };

  const stopAll = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    if (audioAnimRef.current) cancelAnimationFrame(audioAnimRef.current);
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
    audioCtxRef.current = null; analyserRef.current = null;
  };

  // ============================================================================
  // TOOL BUTTON
  // ============================================================================
  const TB = ({ m, icon: I, c, label }: { m: ToolMode; icon: any; c: string; label: string }) => (
    <button onClick={() => setTool(m)} className={`p-1.5 rounded-lg transition-all ${tool === m ? `bg-${c}-500/20 text-${c}-400 ring-1 ring-${c}-500/50` : 'hover:bg-gray-700 text-gray-400'}`} title={label} data-bugsy-ui="true"><I className="w-4 h-4" /></button>
  );

  // ============================================================================
  // RENDER — ERROR
  // ============================================================================
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-400" /></div>
        <h3 className="text-lg font-bold text-white mb-2">Recording Error</h3>
        <p className="text-gray-400 text-center mb-6 max-w-md">{error}</p>
        <button onClick={startRecording} className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg">Try Again</button>
      </div>
    );
  }

  // ============================================================================
  // DRAWING OVERLAY CANVAS + MARKERS
  // ============================================================================
  const isDrawTool = ['draw', 'arrow', 'circle', 'rect', 'highlight', 'text'].includes(tool);

  const Overlay = () => (
    <>
      {/* Drawing canvas — full-screen transparent, captures mouse for drawing tools */}
      {isRecording && (
        <canvas
          ref={canvasRef}
          className={`fixed inset-0 z-[9997] ${isDrawTool && !isPaused ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? window.innerHeight : 1080}
          onMouseDown={handleCanvasDown}
          onMouseMove={handleCanvasMove}
          onMouseUp={handleCanvasUp}
          data-bugsy-ui="true"
        />
      )}

      {/* Text input floating box */}
      {textInput && (
        <div className="fixed z-[10002]" style={{ left: textInput.x, top: textInput.y }} data-bugsy-ui="true">
          <input
            autoFocus
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') { setTextInput(null); setTextValue(''); } }}
            onBlur={handleTextSubmit}
            className="bg-black/80 text-white border border-yellow-400 rounded-lg px-3 py-1.5 text-sm font-bold outline-none min-w-[120px]"
            placeholder="Type label..."
          />
        </div>
      )}

      {/* Click markers */}
      {showOverlay && isRecording && markers.map(m => (
        <div key={`m${m.number}`} className="fixed z-[9999]" data-bugsy-ui="true" style={{ left: `${m.x_percent}%`, top: `${m.y_percent}%`, transform: 'translate(-50%,-50%)' }}>
          <div className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full bg-yellow-400/25 animate-ping pointer-events-none" style={{ animationDuration: '2s', animationIterationCount: 1 }} />
          <div className="relative group">
            <div className={`w-8 h-8 -ml-4 -mt-4 rounded-full border-2 shadow-lg flex items-center justify-center ${m.action_type === 'pin' ? 'bg-blue-500 border-blue-300 shadow-blue-500/50' : 'bg-yellow-400 border-yellow-200 shadow-yellow-400/50'}`}>
              <span className={`text-[11px] font-bold ${m.action_type === 'pin' ? 'text-white' : 'text-yellow-900'}`}>{m.number}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); removeMarker(m.number); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex" data-bugsy-ui="true"><X className="w-3 h-3" /></button>
            {m.element_text && <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-yellow-200 bg-black/80 px-2 py-0.5 rounded-md max-w-[140px] truncate pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{m.element_text.slice(0, 25)}</div>}
          </div>
        </div>
      ))}
    </>
  );

  // ============================================================================
  // MINIMIZED BAR
  // ============================================================================
  if (isMinimized && isRecording) {
    return (
      <>
        <Overlay />
        {/* Transcript popup */}
        {showTranscript && transcript.trim() && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10001] max-w-md w-full mx-4" data-bugsy-ui="true">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-2xl">
              <div className="flex items-center gap-2 mb-1.5"><MessageSquare className="w-3.5 h-3.5 text-teal-400" /><span className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold">Live Transcript</span></div>
              <p className="text-white/80 text-sm leading-relaxed max-h-[80px] overflow-y-auto">{transcript.slice(-200)}</p>
            </div>
          </div>
        )}

        {/* Color picker */}
        {showColors && (
          <div className="fixed bottom-[72px] right-4 z-[10001] bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-700 p-2 flex gap-1.5" data-bugsy-ui="true">
            {COLORS.map(c => (
              <button key={c} onClick={() => { setDrawColor(c); setShowColors(false); }} className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === c ? 'border-white scale-110' : 'border-gray-600'}`} style={{ backgroundColor: c }} data-bugsy-ui="true" />
            ))}
          </div>
        )}

        {/* Bar */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 px-3 py-2.5 flex items-center gap-1.5 flex-wrap" data-bugsy-ui="true" style={{ maxWidth: 'calc(100vw - 24px)' }}>
          {/* Pulse + timer */}
          <div className="relative flex-shrink-0"><div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />{!isPaused && <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-40" />}</div>
          <span className={`font-mono font-bold text-sm min-w-[44px] ${isPaused ? 'text-yellow-400' : 'text-white'}`}>{fmt(duration)}</span>
          <div className="w-px h-5 bg-gray-600" />

          {/* Controls */}
          <button onClick={togglePause} className={`p-1.5 rounded-lg ${isPaused ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`} data-bugsy-ui="true">{isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}</button>
          <button onClick={toggleMic} className={`p-1.5 rounded-lg ${isMicEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/50 text-gray-400'}`} data-bugsy-ui="true">{isMicEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}</button>
          {/* Mini audio level bar */}
          {isMicEnabled && isRecording && !isPaused && (
            <div className="flex items-center gap-[2px] h-4" data-bugsy-ui="true">
              {[20, 35, 50, 65, 80].map((threshold, i) => (
                <div key={i} className={`w-[3px] rounded-full transition-all duration-75 ${audioLevel >= threshold ? (threshold > 65 ? 'bg-red-400 h-4' : threshold > 45 ? 'bg-yellow-400 h-3' : 'bg-green-400 h-2') : 'bg-gray-600 h-1'}`} />
              ))}
            </div>
          )}
          <div className="w-px h-5 bg-gray-600 hidden sm:block" />

          {/* Tool buttons (desktop) */}
          <div className="hidden sm:flex items-center gap-0.5">
            <TB m="click" icon={MousePointer2} c="yellow" label="Click" />
            <TB m="pin" icon={MapPin} c="blue" label="Pin" />
            <TB m="draw" icon={Pencil} c="green" label="Draw" />
            <TB m="arrow" icon={ArrowUpRight} c="orange" label="Arrow" />
            <TB m="circle" icon={Circle} c="pink" label="Circle" />
            <TB m="rect" icon={RectangleHorizontal} c="purple" label="Rectangle" />
            <TB m="highlight" icon={Highlighter} c="amber" label="Highlight" />
            <TB m="text" icon={Type} c="cyan" label="Text" />
            <button onClick={() => setShowColors(!showColors)} className="p-1.5 rounded-lg hover:bg-gray-700" data-bugsy-ui="true"><div className="w-4 h-4 rounded-full border-2 border-gray-500" style={{ backgroundColor: drawColor }} /></button>
          </div>
          <div className="w-px h-5 bg-gray-600 hidden sm:block" />

          {/* Actions (desktop) */}
          <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-30 hidden sm:block" data-bugsy-ui="true"><Undo2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowOverlay(!showOverlay)} className={`p-1.5 rounded-lg hidden sm:block ${showOverlay ? 'text-teal-400' : 'text-gray-500'}`} data-bugsy-ui="true">{showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
          <button onClick={() => setShowTranscript(!showTranscript)} className={`p-1.5 rounded-lg hidden sm:block ${showTranscript ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400'}`} data-bugsy-ui="true"><MessageSquare className="w-3.5 h-3.5" /></button>
          <button onClick={clearAll} disabled={markers.length === 0 && drawItems.length === 0} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 disabled:opacity-30 hidden sm:block" data-bugsy-ui="true"><Trash2 className="w-3.5 h-3.5" /></button>
          <div className="w-px h-5 bg-gray-600" />

          {/* Stats */}
          <div className="text-gray-400 text-[11px] hidden md:flex items-center gap-2"><MousePointer2 className="w-3 h-3 text-yellow-400" />{markers.length}<Pencil className="w-3 h-3 text-green-400" />{drawItems.length}<Mic className="w-3 h-3 text-teal-400" />{transcript.split(' ').filter(Boolean).length}w</div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileTools(!mobileTools)} className="p-1.5 rounded-lg text-gray-400 sm:hidden" data-bugsy-ui="true">{mobileTools ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</button>
          <BugsyHelpButton onClick={() => setShowHelp(true)} />
          <button onClick={() => setIsMinimized(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400" data-bugsy-ui="true"><Maximize2 className="w-3.5 h-3.5" /></button>

          {/* Stop */}
          <button onClick={stopRecording} disabled={duration < MIN_DUR} className={`px-3 py-1.5 rounded-xl font-bold text-xs flex-shrink-0 flex items-center gap-1 ${duration >= MIN_DUR ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`} data-bugsy-ui="true"><Square className="w-3 h-3" /><span>Stop</span></button>
        </div>

        {/* Mobile tools */}
        {mobileTools && (
          <div className="fixed bottom-[68px] left-1/2 -translate-x-1/2 z-[10000] bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-700 p-2 flex flex-wrap items-center gap-1 sm:hidden max-w-[320px]" data-bugsy-ui="true">
            <TB m="click" icon={MousePointer2} c="yellow" label="Click" /><TB m="pin" icon={MapPin} c="blue" label="Pin" /><TB m="draw" icon={Pencil} c="green" label="Draw" /><TB m="arrow" icon={ArrowUpRight} c="orange" label="Arrow" /><TB m="circle" icon={Circle} c="pink" label="Circle" /><TB m="rect" icon={RectangleHorizontal} c="purple" label="Rectangle" /><TB m="highlight" icon={Highlighter} c="amber" label="Highlight" /><TB m="text" icon={Type} c="cyan" label="Text" />
            <div className="w-px h-5 bg-gray-700" />
            <button onClick={() => setShowColors(!showColors)} className="p-1.5 rounded-lg" data-bugsy-ui="true"><div className="w-4 h-4 rounded-full border-2 border-gray-500" style={{ backgroundColor: drawColor }} /></button>
            <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 text-gray-400 disabled:opacity-30" data-bugsy-ui="true"><Undo2 className="w-3.5 h-3.5" /></button>
            <button onClick={clearAll} disabled={markers.length === 0 && drawItems.length === 0} className="p-1.5 text-gray-400 disabled:opacity-30" data-bugsy-ui="true"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Guided Tour */}
        <BugsyTour isOpen={showTour} onClose={() => setShowTour(false)} />

        {/* Help Sheet */}
        <BugsyHelpSheet isOpen={showHelp} onClose={() => setShowHelp(false)} onReplayTour={() => setShowTour(true)} />
      </>
    );
  }

  // ============================================================================
  // EXPANDED FULL VIEW
  // ============================================================================
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
      {isRecording && <button onClick={() => setIsMinimized(true)} className="absolute top-4 right-4 p-2 hover:bg-teal-500/20 rounded-lg"><Minimize2 className="w-5 h-5 text-gray-400" /></button>}
      <div className="relative mb-6">
        <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isPaused ? 'bg-yellow-500/20' : 'bg-gradient-to-br from-red-500/20 to-red-600/20 animate-pulse'}`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${isPaused ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/50'}`}>
            {isPaused ? <Pause className="w-8 h-8 text-white" /> : <div className="w-4 h-4 bg-white rounded-full animate-pulse" />}
          </div>
        </div>
        <button onClick={toggleMic} className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#0d2626] ${isMicEnabled ? 'bg-green-500' : 'bg-gray-500'}`}>{isMicEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}</button>
      </div>
      <div className="flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-red-400" /><span className={`text-3xl font-mono font-bold ${isPaused ? 'text-yellow-400' : 'text-white'}`}>{fmt(duration)}</span><span className="text-sm text-gray-500">/ {fmt(MAX_DUR)}</span></div>
      <div className="text-center mb-4"><p className="text-lg text-white font-medium">{isPaused ? 'Paused' : 'Recording...'}</p><p className="text-sm text-gray-400">{isPaused ? 'Resume to continue' : 'Click, draw, and talk to show the bug'}</p></div>

      {/* Audio level indicator */}
      {isMicEnabled && isRecording && !isPaused && (
        <div className="flex items-center gap-2 mb-4 px-4">
          <Mic className={`w-4 h-4 flex-shrink-0 ${audioLevel > 10 ? 'text-green-400' : 'text-gray-500'}`} />
          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700 max-w-[200px]">
            <div
              className={`h-full rounded-full transition-all duration-75 ${audioLevel > 70 ? 'bg-red-500' : audioLevel > 40 ? 'bg-yellow-400' : audioLevel > 10 ? 'bg-green-400' : 'bg-gray-600'}`}
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 min-w-[24px]">{audioLevel > 10 ? '🔊' : '🔇'}</span>
        </div>
      )}
      <div className="flex items-center gap-4 mb-6 text-sm">
        <span className="flex items-center gap-1.5 text-gray-400"><MousePointer2 className="w-4 h-4 text-yellow-400" />{markers.length} clicks</span>
        <span className="flex items-center gap-1.5 text-gray-400"><Pencil className="w-4 h-4 text-green-400" />{drawItems.length} drawings</span>
        <span className="flex items-center gap-1.5 text-gray-400"><Mic className="w-4 h-4 text-teal-400" />{transcript.split(' ').filter(Boolean).length} words</span>
      </div>
      {/* Tool palette */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6 bg-[#0a1f1f] rounded-xl p-2 border border-teal-500/20">
        {([['click', MousePointer2, 'yellow', 'Click'], ['pin', MapPin, 'blue', 'Pin'], ['draw', Pencil, 'green', 'Draw'], ['arrow', ArrowUpRight, 'orange', 'Arrow'], ['circle', Circle, 'pink', 'Circle'], ['rect', RectangleHorizontal, 'purple', 'Rect'], ['highlight', Highlighter, 'amber', 'Highlight'], ['text', Type, 'cyan', 'Text']] as [ToolMode, any, string, string][]).map(([m, I, c, l]) => (
          <button key={m} onClick={() => setTool(m)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${tool === m ? `bg-${c}-500/20 text-${c}-400 ring-1 ring-${c}-500/40` : 'text-gray-400 hover:bg-gray-700'}`}><I className="w-3.5 h-3.5" /> {l}</button>
        ))}
        <div className="flex gap-1 ml-1">
          {COLORS.map(c => <button key={c} onClick={() => setDrawColor(c)} className={`w-5 h-5 rounded-full border ${drawColor === c ? 'border-white scale-110' : 'border-gray-600'}`} style={{ backgroundColor: c }} />)}
        </div>
      </div>
      {/* Buttons */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={togglePause} className={`px-5 py-3 rounded-xl font-bold text-white ${isPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}><div className="flex items-center gap-2">{isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}<span>{isPaused ? 'Resume' : 'Pause'}</span></div></button>
        <button onClick={stopRecording} disabled={duration < MIN_DUR} className={`px-5 py-3 rounded-xl font-bold text-white ${duration >= MIN_DUR ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 opacity-50 cursor-not-allowed'}`}><div className="flex items-center gap-2"><Square className="w-5 h-5" /><span>Stop</span></div></button>
      </div>
      <div className="flex gap-3 text-sm">
        <button onClick={handleUndo} disabled={undoStack.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
        <button onClick={clearAll} disabled={markers.length === 0 && drawItems.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
      </div>
      {duration < MIN_DUR && <p className="text-xs text-gray-500 mt-3">Record at least {MIN_DUR}s</p>}
    </div>
  );
}

