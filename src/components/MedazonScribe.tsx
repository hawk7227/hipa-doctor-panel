// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mic, MicOff, Square, Loader2,
  FileText, Check, X, ChevronDown, ChevronUp,
  Copy, RotateCcw, Stethoscope
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MedazonScribeProps {
  appointmentId?: string | null
  patientId?: string | null
  patientName?: string
  doctorName?: string
  doctorId?: string
  /** TRUE = video call active or phone call connected. Scribe auto-starts when true, auto-stops when false. */
  callActive: boolean
  /** Callback when SOAP notes are generated/updated — push to appointment clinical notes */
  onSoapGenerated?: (soap: SoapNotes) => void
  /** Callback when ICD-10 codes are suggested */
  onCodesGenerated?: (codes: string[]) => void
  /** Whether the scribe panel is visible (scribe runs regardless) */
  visible?: boolean
}

export interface SoapNotes {
  subjective: string
  objective: string
  assessment: string
  plan: string
  icd10Codes: string[]
  patientInstructions: string
}

interface TranscriptEntry {
  id: string
  speaker: 'doctor' | 'patient' | 'unknown'
  text: string
  timestamp: number
}

type ScribeStatus = 'idle' | 'listening' | 'paused' | 'processing' | 'done' | 'error'

// ═══════════════════════════════════════════════════════════════
// SPEAKER DETECTION
// ═══════════════════════════════════════════════════════════════

const DOCTOR_PATTERNS = /\b(prescri|diagnos|recommend|mg\b|dosage|medication|labs?\b|blood\s*work|refer|exam|symptom|assess|milligram|twice\s*daily|three\s*times|BID|TID|QD|PRN|differential|history\s*of|present\s*illness|chief\s*complaint|follow[\s-]*up|vitals?|auscultation|palpation|let me|I'll order|we'll start|I'm going to)\b/i

function guessSpeaker(text: string): 'doctor' | 'patient' {
  return DOCTOR_PATTERNS.test(text) ? 'doctor' : 'patient'
}

// ═══════════════════════════════════════════════════════════════
// PROGRESSIVE SOAP INTERVAL (seconds)
// ═══════════════════════════════════════════════════════════════

const SOAP_INTERVAL_MS = 60_000 // Generate running SOAP draft every 60s
const CHUNK_INTERVAL_MS = 5_000 // Send audio to Whisper every 5s
const MIN_TRANSCRIPT_FOR_SOAP = 3 // Minimum transcript entries before generating SOAP
const AUTO_SAVE_DELAY_MS = 3_000 // Debounce auto-save

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MedazonScribe({
  appointmentId,
  patientId,
  patientName = 'Patient',
  doctorName = 'Doctor',
  doctorId,
  callActive,
  onSoapGenerated,
  onCodesGenerated,
  visible = true,
}: MedazonScribeProps) {

  // ─── State ───
  const [status, setStatus] = useState<ScribeStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [soapNotes, setSoapNotes] = useState<SoapNotes | null>(null)
  const [editedSoap, setEditedSoap] = useState<SoapNotes | null>(null)
  const [soapEditing, setSoapEditing] = useState(false)
  const [generatingSoap, setGeneratingSoap] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [showTranscript, setShowTranscript] = useState(true)
  const [showSoap, setShowSoap] = useState(true)
  const [savedToast, setSavedToast] = useState(false)
  const [manualStop, setManualStop] = useState(false)

  // ─── Refs ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const soapIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>(`scribe-${Date.now()}`)
  const transcriptRef = useRef<TranscriptEntry[]>([]) // mirror for intervals
  const soapCountRef = useRef(0)
  const hasAutoSavedRef = useRef(false)

  // Keep transcript ref in sync
  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  // ─── Auto-scroll ───
  useEffect(() => { if (visible) transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript, visible])

  // ─── Duration timer ───
  useEffect(() => {
    if (status === 'listening') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  // ─── Cleanup ───
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
    if (soapIntervalRef.current) clearInterval(soapIntervalRef.current)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // AUTH HELPER
  // ═══════════════════════════════════════════════════════════════

  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // SEND AUDIO CHUNK TO WHISPER
  // ═══════════════════════════════════════════════════════════════

  const sendChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []
    if (blob.size < 2000) return // skip silence

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'chunk.webm')
      const auth = await getAuth()
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: auth ? { Authorization: auth } : {},
        body: formData,
      })
      if (!res.ok) return
      const { text } = await res.json()
      if (text && text.trim().length > 2) {
        const entry: TranscriptEntry = {
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker: guessSpeaker(text),
          text: text.trim(),
          timestamp: Date.now(),
        }
        setTranscript(prev => [...prev, entry])
      }
    } catch { /* silent */ }
  }, [getAuth])

  // ═══════════════════════════════════════════════════════════════
  // PROGRESSIVE SOAP GENERATION
  // ═══════════════════════════════════════════════════════════════

  const generateSoap = useCallback(async (isFinal: boolean = false) => {
    const entries = transcriptRef.current
    if (entries.length < MIN_TRANSCRIPT_FOR_SOAP) return
    if (generatingSoap) return

    setGeneratingSoap(true)
    const fullTranscript = entries.map(t => `[${t.speaker === 'doctor' ? doctorName : patientName}]: ${t.text}`).join('\n')

    try {
      let stylePrefs = ''
      if (doctorId) {
        try {
          const { data } = await supabase.from('doctor_preferences').select('preference_value').eq('doctor_id', doctorId).eq('preference_key', 'soap_style').single()
          if (data?.preference_value) stylePrefs = JSON.stringify(data.preference_value)
        } catch { /* no prefs yet */ }
      }

      const auth = await getAuth()
      const res = await fetch('/api/scribe/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ transcript: fullTranscript, patientName, doctorName, appointmentId, stylePreferences: stylePrefs || undefined }),
      })

      if (!res.ok) return

      const data = await res.json()
      const soap: SoapNotes = {
        subjective: data.subjective || '',
        objective: data.objective || '',
        assessment: data.assessment || '',
        plan: data.plan || '',
        icd10Codes: data.icd10Codes || [],
        patientInstructions: data.patientInstructions || '',
      }

      setSoapNotes(soap)
      if (!soapEditing) setEditedSoap({ ...soap })
      soapCountRef.current++

      // Push to clinical notes live
      if (onSoapGenerated) onSoapGenerated(soap)
      if (onCodesGenerated && soap.icd10Codes.length > 0) onCodesGenerated(soap.icd10Codes)

      // Auto-save on final generation
      if (isFinal) {
        autoSave(soap, entries)
      }
    } catch { /* silent */ }
    finally { setGeneratingSoap(false) }
  }, [doctorId, doctorName, patientName, appointmentId, onSoapGenerated, onCodesGenerated, getAuth, soapEditing, generatingSoap])

  // ═══════════════════════════════════════════════════════════════
  // AUTO-SAVE + LEARN
  // ═══════════════════════════════════════════════════════════════

  const autoSave = useCallback(async (soap: SoapNotes, entries: TranscriptEntry[]) => {
    if (hasAutoSavedRef.current) return
    hasAutoSavedRef.current = true

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || doctorId

      await supabase.from('scribe_sessions').upsert({
        session_id: sessionIdRef.current,
        appointment_id: appointmentId,
        doctor_id: userId,
        patient_id: patientId,
        raw_transcript: entries.map(t => `[${t.speaker}]: ${t.text}`).join('\n'),
        soap_subjective: soap.subjective,
        soap_objective: soap.objective,
        soap_assessment: soap.assessment,
        soap_plan: soap.plan,
        icd10_codes: soap.icd10Codes,
        patient_instructions: soap.patientInstructions,
        duration_seconds: duration,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })

      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 3000)
    } catch { /* silent */ }
  }, [appointmentId, doctorId, patientId, duration])

  // Manual save after edits — also learns style
  const handleManualSave = useCallback(async () => {
    if (!editedSoap || !appointmentId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || doctorId

      // Save updated SOAP
      await supabase.from('scribe_sessions').upsert({
        session_id: sessionIdRef.current,
        appointment_id: appointmentId,
        doctor_id: userId,
        patient_id: patientId,
        raw_transcript: transcript.map(t => `[${t.speaker}]: ${t.text}`).join('\n'),
        soap_subjective: editedSoap.subjective,
        soap_objective: editedSoap.objective,
        soap_assessment: editedSoap.assessment,
        soap_plan: editedSoap.plan,
        icd10_codes: editedSoap.icd10Codes,
        patient_instructions: editedSoap.patientInstructions,
        duration_seconds: duration,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })

      // Push edited SOAP to clinical notes
      if (onSoapGenerated) onSoapGenerated(editedSoap)

      // Learn style from edits
      if (userId && soapNotes) {
        const hasEdits = soapNotes.subjective !== editedSoap.subjective ||
          soapNotes.objective !== editedSoap.objective ||
          soapNotes.assessment !== editedSoap.assessment ||
          soapNotes.plan !== editedSoap.plan

        if (hasEdits) {
          try {
            const { data: existing } = await supabase.from('doctor_preferences').select('preference_value').eq('doctor_id', userId).eq('preference_key', 'soap_style').single()
            const prev = (existing?.preference_value as any) || { editCount: 0, patterns: [] }
            const patterns = Array.isArray(prev.patterns) ? prev.patterns : []
            patterns.push({
              date: new Date().toISOString(),
              originalLength: { s: soapNotes.subjective.length, o: soapNotes.objective.length, a: soapNotes.assessment.length, p: soapNotes.plan.length },
              editedLength: { s: editedSoap.subjective.length, o: editedSoap.objective.length, a: editedSoap.assessment.length, p: editedSoap.plan.length },
              editedSubjective: editedSoap.subjective.slice(0, 500),
              editedAssessment: editedSoap.assessment.slice(0, 500),
              editedPlan: editedSoap.plan.slice(0, 500),
            })
            await supabase.from('doctor_preferences').upsert({
              doctor_id: userId,
              preference_key: 'soap_style',
              preference_value: { editCount: (prev.editCount || 0) + 1, patterns: patterns.slice(-10) },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'doctor_id,preference_key' })
          } catch { /* silent */ }
        }
      }

      setSoapEditing(false)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 3000)
    } catch { /* silent */ }
  }, [editedSoap, appointmentId, doctorId, patientId, transcript, duration, soapNotes, onSoapGenerated])

  // ═══════════════════════════════════════════════════════════════
  // START MIC CAPTURE
  // ═══════════════════════════════════════════════════════════════

  const startMic = useCallback(async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(1000)

      // Send chunks every 5s
      chunkIntervalRef.current = setInterval(sendChunks, CHUNK_INTERVAL_MS)

      // Progressive SOAP every 60s
      soapIntervalRef.current = setInterval(() => generateSoap(false), SOAP_INTERVAL_MS)

      setStatus('listening')
      setDuration(0)
      setManualStop(false)
      hasAutoSavedRef.current = false
      sessionIdRef.current = `scribe-${Date.now()}`
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setMicError('Mic access denied. Allow mic in browser settings.')
      else if (err.name === 'NotFoundError') setMicError('No microphone found.')
      else setMicError(err.message || 'Mic error')
      setStatus('error')
    }
  }, [sendChunks, generateSoap])

  // ═══════════════════════════════════════════════════════════════
  // STOP MIC
  // ═══════════════════════════════════════════════════════════════

  const stopMic = useCallback(async () => {
    // Stop intervals
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null }
    if (soapIntervalRef.current) { clearInterval(soapIntervalRef.current); soapIntervalRef.current = null }

    // Send final chunks
    await sendChunks()

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setStatus('done')

    // Final SOAP generation + auto-save
    setTimeout(() => generateSoap(true), 1500)
  }, [sendChunks, generateSoap])

  // ═══════════════════════════════════════════════════════════════
  // AUTO-START / AUTO-STOP based on callActive prop
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (callActive && status === 'idle' && !manualStop) {
      startMic()
    }
    if (!callActive && status === 'listening') {
      stopMic()
    }
  }, [callActive, status, manualStop, startMic, stopMic])

  // Manual stop (prevents auto-restart)
  const handleManualStop = useCallback(() => {
    setManualStop(true)
    stopMic()
  }, [stopMic])

  // Manual restart
  const handleRestart = useCallback(() => {
    setManualStop(false)
    setTranscript([])
    setSoapNotes(null)
    setEditedSoap(null)
    setDuration(0)
    setSoapEditing(false)
    hasAutoSavedRef.current = false
    soapCountRef.current = 0
    if (callActive) startMic()
    else setStatus('idle')
  }, [callActive, startMic])

  // ═══════════════════════════════════════════════════════════════
  // TOGGLE SPEAKER
  // ═══════════════════════════════════════════════════════════════

  const toggleSpeaker = useCallback((id: string) => {
    setTranscript(prev => prev.map(t => t.id === id ? { ...t, speaker: t.speaker === 'doctor' ? 'patient' : 'doctor' } : t))
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const copyText = (t: string) => { navigator.clipboard?.writeText(t) }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (!visible) return null

  return (
    <div className="flex flex-col h-full overflow-hidden relative">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Medazon Scribe</span>
          {status === 'listening' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-0.5 bg-emerald-400 rounded-full animate-pulse" style={{ height: `${4 + Math.random() * 8}px`, animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-[9px] font-bold text-emerald-400 font-mono">{fmt(duration)}</span>
            </div>
          )}
          {status === 'paused' && <span className="text-[9px] font-bold text-yellow-400 px-2 py-0.5 bg-yellow-500/20 rounded-full">PAUSED</span>}
          {status === 'done' && <span className="text-[9px] font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded-full">COMPLETE</span>}
          {status === 'error' && <span className="text-[9px] font-bold text-red-400 px-2 py-0.5 bg-red-500/20 rounded-full">ERROR</span>}
        </div>
        <div className="flex items-center gap-1">
          {status === 'listening' && (
            <button onClick={handleManualStop} className="w-6 h-6 rounded-lg flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all" title="Stop scribe">
              <Square className="w-3 h-3" />
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button onClick={handleRestart} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/30 hover:text-white/50 transition-all" title="New session">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          {status === 'idle' && !callActive && (
            <span className="text-[9px] text-white/25">Starts when call begins</span>
          )}
          {generatingSoap && <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />}
        </div>
      </div>

      {/* ── MIC ERROR ── */}
      {micError && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
          <MicOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-red-300 flex-1">{micError}</div>
          <button onClick={() => { setMicError(null); setStatus('idle') }} className="text-red-400/50 hover:text-red-400"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Waiting state */}
        {status === 'idle' && transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-4 py-6">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mb-2">
              <Mic className="w-5 h-5 text-emerald-400/50" />
            </div>
            <p className="text-[10px] text-white/30 text-center max-w-[200px] leading-relaxed">
              Scribe will auto-start when the call begins and progressively build your SOAP notes.
            </p>
          </div>
        )}

        {/* ── LIVE TRANSCRIPT ── */}
        {transcript.length > 0 && (
          <div className="px-3 py-2">
            <button onClick={() => setShowTranscript(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 hover:text-white/60 mb-2 transition-all w-full">
              {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="flex-1 text-left">Transcript ({transcript.length})</span>
              {status === 'listening' && <span className="text-[8px] text-emerald-400/40">LIVE</span>}
            </button>
            {showTranscript && (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {transcript.map(entry => (
                  <div key={entry.id} className="flex gap-2">
                    <button onClick={() => toggleSpeaker(entry.id)} title="Click to swap speaker"
                      className={`flex-shrink-0 w-5 h-5 rounded-full text-[7px] font-bold flex items-center justify-center transition-all cursor-pointer ${entry.speaker === 'doctor' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                      {entry.speaker === 'doctor' ? 'Dr' : 'Pt'}
                    </button>
                    <p className="text-[10px] text-white/60 leading-relaxed flex-1">{entry.text}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        )}

        {/* ── SOAP NOTES (progressive) ── */}
        {editedSoap && (
          <div className="px-3 py-2 border-t border-white/5">
            <button onClick={() => setShowSoap(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 hover:text-white/60 mb-2 transition-all w-full">
              <FileText className="w-3 h-3" />
              <span className="flex-1 text-left">SOAP Notes</span>
              {status === 'listening' && <span className="text-[8px] text-purple-400/40">UPDATING</span>}
              {!soapEditing ? (
                <button onClick={(e) => { e.stopPropagation(); setSoapEditing(true) }} className="text-[8px] text-purple-400 hover:text-purple-300 font-bold px-1">Edit</button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleManualSave() }} className="flex items-center gap-0.5 text-[8px] text-emerald-400 hover:text-emerald-300 font-bold px-1">
                  <Check className="w-2.5 h-2.5" />Save
                </button>
              )}
            </button>

            {showSoap && (
              <div className="space-y-1.5">
                {([
                  { key: 'subjective', label: 'S', color: 'text-emerald-400/70', bg: 'border-emerald-500/20' },
                  { key: 'objective', label: 'O', color: 'text-yellow-400/70', bg: 'border-yellow-500/20' },
                  { key: 'assessment', label: 'A', color: 'text-orange-400/70', bg: 'border-orange-500/20' },
                  { key: 'plan', label: 'P', color: 'text-cyan-400/70', bg: 'border-cyan-500/20' },
                ] as const).map(section => (
                  <div key={section.key} className={`rounded-lg border ${section.bg} p-2`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${section.color}`}>{section.label}</span>
                    {soapEditing ? (
                      <textarea
                        value={editedSoap[section.key]}
                        onChange={e => setEditedSoap(prev => prev ? { ...prev, [section.key]: e.target.value } : prev)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white resize-none focus:outline-none focus:border-purple-500/50 min-h-[50px] mt-1"
                      />
                    ) : (
                      <div className="text-[10px] text-white/60 whitespace-pre-wrap leading-relaxed mt-0.5 min-h-[14px]">
                        {editedSoap[section.key] || <span className="text-white/15 italic">...</span>}
                      </div>
                    )}
                  </div>
                ))}

                {/* ICD-10 */}
                {editedSoap.icd10Codes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="text-[8px] text-white/20 font-bold uppercase mr-1">ICD-10:</span>
                    {editedSoap.icd10Codes.map((code, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/20 rounded text-[8px] font-mono text-purple-300">{code}</span>
                    ))}
                  </div>
                )}

                {/* Patient instructions */}
                {editedSoap.patientInstructions && (
                  <div className="p-2 bg-blue-500/10 border border-blue-500/15 rounded-lg mt-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-bold text-blue-400/50 uppercase">Patient Instructions</span>
                      <button onClick={() => copyText(editedSoap.patientInstructions)} className="text-[8px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"><Copy className="w-2.5 h-2.5" />Copy</button>
                    </div>
                    <div className="text-[9px] text-white/50 whitespace-pre-wrap leading-relaxed">{editedSoap.patientInstructions}</div>
                  </div>
                )}

                {/* Copy all */}
                <button onClick={() => copyText(`SUBJECTIVE:\n${editedSoap.subjective}\n\nOBJECTIVE:\n${editedSoap.objective}\n\nASSESSMENT:\n${editedSoap.assessment}\n\nPLAN:\n${editedSoap.plan}`)}
                  className="w-full py-1.5 text-[9px] text-white/20 hover:text-white/40 font-bold transition-all flex items-center justify-center gap-1">
                  <Copy className="w-2.5 h-2.5" />Copy full SOAP
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SAVED TOAST ── */}
      {savedToast && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-xl shadow-lg z-50 flex items-center gap-1 whitespace-nowrap">
          <Check className="w-3 h-3" />Auto-saved & learning your style
        </div>
      )}
    </div>
  )
}
