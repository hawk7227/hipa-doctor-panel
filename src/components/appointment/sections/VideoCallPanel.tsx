'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Circle, Square, Copy, Send, RotateCcw, Keyboard, Sparkles, Download, Trash2, ChevronRight } from 'lucide-react';

interface VideoCallPanelProps {
  patientName: string;
  patientPhone: string;
  doctorName?: string;
  onClose: () => void;
  onSaveTranscript?: (transcript: string) => void;
  onSaveSOAP?: (soap: { subjective: string; objective: string; assessment: string; plan: string }) => void;
}

export default function VideoCallPanel({
  patientName,
  patientPhone,
  doctorName = 'Dr. Smith',
  onClose,
  onSaveTranscript,
  onSaveSOAP
}: VideoCallPanelProps) {
  // =============================================
  // STATE
  // =============================================
  const [callSeconds, setCallSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [currentRoomUrl, setCurrentRoomUrl] = useState('');
  const [isDialingOut, setIsDialingOut] = useState(false);
  const [dialoutSessionId, setDialoutSessionId] = useState<string | null>(null);
  const [isAIScribeActive, setIsAIScribeActive] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  
  // UI visibility states
  const [showKnockIndicator, setShowKnockIndicator] = useState(false);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [showRecIndicator, setShowRecIndicator] = useState(false);
  const [showDialoutStatus, setShowDialoutStatus] = useState(false);
  const [dialoutStatusText, setDialoutStatusText] = useState('');
  const [showAIScribeStatus, setShowAIScribeStatus] = useState(false);
  const [showAIListening, setShowAIListening] = useState(false);
  const [showTranscriptActions, setShowTranscriptActions] = useState(false);
  const [showCallStatus, setShowCallStatus] = useState(false);
  const [callStatusText, setCallStatusText] = useState('Connecting...');
  const [showPrevisitContent, setShowPrevisitContent] = useState(true);
  const [showDialpadModal, setShowDialpadModal] = useState(false);
  const [showMagicEditModal, setShowMagicEditModal] = useState(false);
  
  // Tab states
  const [activeAITab, setActiveAITab] = useState('transcript');
  const [showSOAPContent, setShowSOAPContent] = useState(false);
  const [showSOAPActions, setShowSOAPActions] = useState(false);
  const [showCodesContent, setShowCodesContent] = useState(false);
  const [showCodesActions, setShowCodesActions] = useState(false);
  const [showInstructionsContent, setShowInstructionsContent] = useState(false);
  const [showInstructionsActions, setShowInstructionsActions] = useState(false);
  
  // Form states
  const [videoLink, setVideoLink] = useState('');
  const [dialpadNumber, setDialpadNumber] = useState(patientPhone || '+15551234567');
  const [dialpadExtension, setDialpadExtension] = useState('');
  const [dialpadWait, setDialpadWait] = useState('5');
  const [magicEditInput, setMagicEditInput] = useState('');
  const [listeningStatus, setListeningStatus] = useState('Listening...');
  
  // Button states
  const [muteActive, setMuteActive] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callBtnText, setCallBtnText] = useState('Call');
  const [callBtnClass, setCallBtnClass] = useState('bg-green-600 hover:bg-green-700');
  
  // Refs
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcriptAreaRef = useRef<HTMLDivElement>(null);
  const toastContainerRef = useRef<HTMLDivElement>(null);

  const TRANSCRIPTION_INTERVAL_MS = 5000;
  const API_ENDPOINT = '/api/transcribe';

  // Get patient initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const patientInitials = getInitials(patientName);
  const doctorInitials = getInitials(doctorName);

  const sampleTranscript = [
    { speaker: 'doctor', text: "Good morning, how are you feeling today?" },
    { speaker: 'patient', text: "Hi doctor. I've been having some burning when I urinate for the past three days." },
    { speaker: 'doctor', text: "I'm sorry to hear that. Can you tell me more about your symptoms? Any frequency or urgency?" },
    { speaker: 'patient', text: "Yes, I feel like I need to go all the time, and there's some pressure in my lower belly." },
    { speaker: 'doctor', text: "Have you noticed any blood in your urine or had any fever?" },
    { speaker: 'patient', text: "No blood that I've seen, and I don't think I have a fever." },
    { speaker: 'doctor', text: "Any back pain or flank pain?" },
    { speaker: 'patient', text: "No, just the burning and the pressure down low." },
    { speaker: 'doctor', text: "Have you had UTIs before?" },
    { speaker: 'patient', text: "Yes, I had one about six months ago. They gave me Macrobid and it worked well." },
    { speaker: 'doctor', text: "Good to know. Given your symptoms and history, this sounds like a straightforward UTI. I'm going to prescribe Macrobid again since it worked well for you before." }
  ];

  // =============================================
  // TOAST
  // =============================================
  const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const container = toastContainerRef.current;
    if (!container) return;
    
    const colors: Record<string, string> = {
      success: 'bg-green-600',
      error: 'bg-red-600',
      info: 'bg-purple-600',
      warning: 'bg-amber-600'
    };
    
    const toast = document.createElement('div');
    toast.className = `px-5 py-3 rounded-xl shadow-lg text-white ${colors[type] || colors.success} border border-slate-600`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // =============================================
  // AI SCRIBE FUNCTIONS
  // =============================================
  const toggleAIScribe = async () => {
    if (!isAIScribeActive) {
      await startAIScribe();
    } else {
      await stopAIScribe();
    }
  };

  const startAIScribe = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      audioStreamRef.current = stream;
      
      if (transcriptAreaRef.current) {
        transcriptAreaRef.current.innerHTML = '';
      }
      setWordCount(0);
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          processAudioChunks();
        }
      };
      
      recorder.start();
      setIsAIScribeActive(true);
      
      transcriptionIntervalRef.current = setInterval(async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, TRANSCRIPTION_INTERVAL_MS);
      
      setShowAIScribeStatus(true);
      setShowAIListening(true);
      setShowTranscriptActions(true);
      
      addSystemMessage('🎙️ Medazon AI Scribe activated - listening...');
      showToast('🎙️ AI Scribe activated', 'info');
      
    } catch (error: any) {
      console.error('Error starting AI Scribe:', error);
      
      if (error.name === 'NotAllowedError') {
        showToast('⚠️ Microphone access denied', 'error');
        addSystemMessage('❌ Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        showToast('⚠️ No microphone found', 'error');
        addSystemMessage('❌ No microphone found. Please connect a microphone and try again.');
      } else {
        showToast('⚠️ Could not start scribe - using demo mode', 'warning');
        setIsDemoMode(true);
        startDemoTranscription();
      }
    }
  };

  const stopAIScribe = async () => {
    setIsAIScribeActive(false);
    
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (isDemoMode) {
      stopDemoTranscription();
      setIsDemoMode(false);
    }
    
    setShowAIScribeStatus(false);
    setShowAIListening(false);
    
    addSystemMessage('⏹️ Medazon AI Scribe stopped');
    showToast('AI Scribe stopped');
  };

  const processAudioChunks = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    
    if (audioBlob.size < 1000) {
      return;
    }
    
    try {
      setListeningStatus('Processing...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }
      
      const data = await response.json();
      
      if (data.text && data.text.trim()) {
        addTranscriptEntry(data.text.trim());
      }
      
      setListeningStatus('Listening...');
      
    } catch (error: any) {
      console.error('Transcription error:', error);
      
      if (!isDemoMode && error.message !== 'Transcription failed') {
        showToast('⚠️ API unavailable - demo mode', 'warning');
        setIsDemoMode(true);
        startDemoTranscription();
      }
      
      setListeningStatus('Listening...');
    }
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const detectSpeaker = (text: string): boolean => {
    const doctorPatterns = [
      /^(hi|hello|good morning|good afternoon)/i,
      /how are you/i,
      /can you tell me/i,
      /have you (noticed|experienced|had)/i,
      /any (pain|fever|symptoms|blood)/i,
      /i('m| am) going to prescribe/i,
      /let me/i,
      /i recommend/i,
      /based on/i,
      /your (test|results|symptoms)/i
    ];
    
    return doctorPatterns.some(pattern => pattern.test(text));
  };

  const addTranscriptEntry = (text: string) => {
    const area = transcriptAreaRef.current;
    if (!area) return;
    
    const isLikelyDoctor = detectSpeaker(text);
    const initials = isLikelyDoctor ? doctorInitials : patientInitials;
    const bgColor = isLikelyDoctor ? 'bg-blue-600' : 'bg-pink-500';
    const label = isLikelyDoctor ? doctorName : patientName;
    const textColor = isLikelyDoctor ? 'blue' : 'pink';
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    const div = document.createElement('div');
    div.className = 'transcript-new flex gap-3';
    div.innerHTML = `
      <div class="w-8 h-8 ${bgColor} rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all" title="Click to change speaker">
        <span class="text-white text-xs font-semibold">${initials}</span>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-${textColor}-400 text-xs font-semibold">${label}</span>
          <span class="text-slate-600 text-[10px]">${timestamp}</span>
        </div>
        <p class="text-slate-300 text-sm">${escapeHtml(text)}</p>
      </div>
    `;
    
    const avatar = div.querySelector('.rounded-full');
    if (avatar) {
      avatar.addEventListener('click', () => toggleSpeaker(avatar as HTMLElement));
    }
    
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    
    const newWordCount = wordCount + text.split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(newWordCount);
  };

  const addSystemMessage = (message: string) => {
    const area = transcriptAreaRef.current;
    if (!area) return;
    
    const div = document.createElement('div');
    div.className = 'transcript-new text-center py-2';
    div.innerHTML = `<span class="text-slate-500 text-xs">${message}</span>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  };

  const toggleSpeaker = (element: HTMLElement) => {
    const entry = element.closest('.flex.gap-3');
    if (!entry) return;
    
    const avatar = entry.querySelector('.rounded-full');
    const label = entry.querySelector('.font-semibold');
    
    if (!avatar || !label) return;
    
    const isDoctor = avatar.classList.contains('bg-blue-600');
    
    if (isDoctor) {
      avatar.classList.remove('bg-blue-600');
      avatar.classList.add('bg-pink-500');
      const span = avatar.querySelector('span');
      if (span) span.textContent = patientInitials;
      label.textContent = patientName;
      label.classList.remove('text-blue-400');
      label.classList.add('text-pink-400');
    } else {
      avatar.classList.remove('bg-pink-500');
      avatar.classList.add('bg-blue-600');
      const span = avatar.querySelector('span');
      if (span) span.textContent = doctorInitials;
      label.textContent = doctorName;
      label.classList.remove('text-pink-400');
      label.classList.add('text-blue-400');
    }
    
    showToast('Speaker updated');
  };

  // Demo mode functions
  const startDemoTranscription = () => {
    setIsAIScribeActive(true);
    setShowAIScribeStatus(true);
    setShowAIListening(true);
    setShowTranscriptActions(true);
    setTranscriptIndex(0);
    
    if (transcriptAreaRef.current) {
      transcriptAreaRef.current.innerHTML = '';
    }
    setWordCount(0);
    
    addSystemMessage('🎙️ AI Scribe activated (Demo Mode)');
    
    transcriptIntervalRef.current = setInterval(() => {
      setTranscriptIndex(prev => {
        if (prev >= sampleTranscript.length) {
          if (transcriptIntervalRef.current) {
            clearInterval(transcriptIntervalRef.current);
          }
          addSystemMessage('📝 Demo transcript complete');
          return prev;
        }
        
        const entry = sampleTranscript[prev];
        const isDoctor = entry.speaker === 'doctor';
        const initials = isDoctor ? doctorInitials : patientInitials;
        const bgColor = isDoctor ? 'bg-blue-600' : 'bg-pink-500';
        const label = isDoctor ? doctorName : patientName;
        const textColor = isDoctor ? 'blue' : 'pink';
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        
        const area = transcriptAreaRef.current;
        if (area) {
          const div = document.createElement('div');
          div.className = 'transcript-new flex gap-3';
          div.innerHTML = `
            <div class="w-8 h-8 ${bgColor} rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
              <span class="text-white text-xs font-semibold">${initials}</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-${textColor}-400 text-xs font-semibold">${label}</span>
                <span class="text-slate-600 text-[10px]">${timestamp}</span>
              </div>
              <p class="text-slate-300 text-sm">${entry.text}</p>
            </div>
          `;
          
          const avatar = div.querySelector('.rounded-full');
          if (avatar) {
            avatar.addEventListener('click', () => toggleSpeaker(avatar as HTMLElement));
          }
          
          area.appendChild(div);
          area.scrollTop = area.scrollHeight;
          
          setWordCount(wc => wc + entry.text.split(/\s+/).filter(w => w.length > 0).length);
        }
        
        return prev + 1;
      });
    }, 2500);
  };

  const stopDemoTranscription = () => {
    if (transcriptIntervalRef.current) {
      clearInterval(transcriptIntervalRef.current);
      transcriptIntervalRef.current = null;
    }
  };

  // =============================================
  // VIDEO LINK / ROOM
  // =============================================
  const generateNewLink = () => {
    const roomId = 'medazon-' + Math.random().toString(36).substring(2, 10);
    const newUrl = `https://medazonhealth.daily.co/${roomId}`;
    setCurrentRoomUrl(newUrl);
    setVideoLink(newUrl);
    showToast('🔗 New video link generated');
    return newUrl;
  };

  // =============================================
  // DIAL-OUT
  // =============================================
  const openDialPad = () => {
    setDialpadNumber(patientPhone || '+15551234567');
    setShowDialpadModal(true);
  };

  const closeDialPad = () => {
    setShowDialpadModal(false);
  };

  const dialPadPress = (digit: string) => {
    setDialpadNumber(prev => prev + digit);
  };

  const clearDialPadNumber = () => {
    setDialpadNumber('');
  };

  const usePatientNumber = () => {
    setDialpadNumber(patientPhone || '+15551234567');
    showToast('📱 Patient number loaded');
  };

  const initiateDialOut = async () => {
    if (!dialpadNumber) {
      showToast('⚠️ Enter a phone number', 'error');
      return;
    }
    
    setIsDialingOut(true);
    setShowDialoutStatus(true);
    setDialoutStatusText('Dialing...');
    closeDialPad();
    
    showToast('📞 Calling ' + dialpadNumber, 'info');
    
    // Simulate dial-out connection
    setTimeout(() => {
      setDialoutStatusText('Ringing...');
      setTimeout(() => {
        setDialoutStatusText('Connected');
        setIsInCall(true);
        startTimer();
        showToast('✅ Call connected');
      }, 2000);
    }, 1500);
  };

  const hangUpDialOut = () => {
    setIsDialingOut(false);
    setShowDialoutStatus(false);
    setDialoutSessionId(null);
  };

  // =============================================
  // PATIENT KNOCK / ADMIT
  // =============================================
  const simulatePatientKnock = () => {
    setShowKnockIndicator(true);
    showToast('🚪 Patient is knocking...', 'info');
  };

  const admitPatient = () => {
    setShowKnockIndicator(false);
    setShowWaitingRoom(true);
    setIsInCall(true);
    startTimer();
    showToast('✅ Patient admitted');
  };

  const denyPatient = () => {
    setShowKnockIndicator(false);
    showToast('❌ Patient denied entry', 'warning');
  };

  // =============================================
  // TIMER
  // =============================================
  const startTimer = () => {
    setCallSeconds(0);
    callTimerRef.current = setInterval(() => {
      setCallSeconds(prev => prev + 1);
    }, 1000);
  };

  // =============================================
  // CALL CONTROLS
  // =============================================
  const toggleMute = () => {
    setMuteActive(!muteActive);
    showToast(!muteActive ? '🔇 Muted' : '🎤 Unmuted');
  };

  const toggleVideoCamera = () => {
    setVideoOff(!videoOff);
    showToast(!videoOff ? '📷 Camera off' : '📹 Camera on');
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setShowRecIndicator(!isRecording);
    showToast(!isRecording ? '⏺️ Recording' : '⏹️ Stopped');
  };

  const endCall = () => {
    if (!isInCall && !isDialingOut) {
      handleClose();
      return;
    }
    
    if (confirm('End this call?')) {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setIsInCall(false);
      setIsRecording(false);
      if (isDialingOut) hangUpDialOut();
      if (isAIScribeActive) stopAIScribe();
      
      setShowRecIndicator(false);
      setShowKnockIndicator(false);
      setShowWaitingRoom(false);
      setShowDialoutStatus(false);
      setCallSeconds(0);
      showToast('📞 Call ended');
    }
  };

  const sendSMS = () => {
    if (!currentRoomUrl) generateNewLink();
    showToast('📱 SMS sent to patient');
  };

  const copyLink = () => {
    if (!videoLink) {
      showToast('⚠️ Generate a link first', 'error');
      return;
    }
    navigator.clipboard.writeText(videoLink);
    showToast('📋 Link copied!');
  };

  const quickResetCall = () => {
    if (confirm('Reset call? This will end current call, generate new link, and resend to patient.')) {
      showToast('🔄 Resetting...', 'info');
      setTimeout(() => {
        if (isInCall) {
          if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
          }
          setIsInCall(false);
        }
        generateNewLink();
        showToast('✅ Reset complete!');
      }, 1000);
    }
  };

  const handleClose = () => {
    if (isInCall || isAIScribeActive) {
      if (confirm('End call and close video panel?')) {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        if (isAIScribeActive) stopAIScribe();
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // =============================================
  // SOAP / TABS
  // =============================================
  const switchTab = (tab: string) => {
    setActiveAITab(tab);
    
    // Reset all content visibility
    setShowSOAPContent(false);
    setShowSOAPActions(false);
    setShowCodesContent(false);
    setShowCodesActions(false);
    setShowInstructionsContent(false);
    setShowInstructionsActions(false);
    
    if (tab === 'soap' && wordCount > 0) {
      setTimeout(() => {
        setShowSOAPContent(true);
        setShowSOAPActions(true);
      }, 500);
    } else if (tab === 'codes' && wordCount > 0) {
      setTimeout(() => {
        setShowCodesContent(true);
        setShowCodesActions(true);
      }, 500);
    } else if (tab === 'instructions' && wordCount > 0) {
      setTimeout(() => {
        setShowInstructionsContent(true);
        setShowInstructionsActions(true);
      }, 500);
    }
  };

  const openMagicEdit = () => {
    setShowMagicEditModal(true);
  };

  const closeMagicEdit = () => {
    setShowMagicEditModal(false);
    setMagicEditInput('');
  };

  const applyMagicSuggestion = (suggestion: string) => {
    setMagicEditInput(suggestion);
  };

  const executeMagicEdit = () => {
    if (!magicEditInput.trim()) {
      showToast('⚠️ Enter what to change', 'warning');
      return;
    }
    showToast('✨ Applying changes...', 'info');
    setTimeout(() => {
      showToast('✅ Changes applied!');
      closeMagicEdit();
    }, 1500);
  };

  const exportTranscript = () => {
    const area = transcriptAreaRef.current;
    if (!area) return;
    
    const entries = area.querySelectorAll('.flex.gap-3');
    
    if (entries.length === 0) {
      showToast('⚠️ No transcript to export', 'warning');
      return;
    }
    
    let transcriptText = `MEDAZON AI SCRIBE - TRANSCRIPT\n`;
    transcriptText += `Date: ${new Date().toLocaleDateString()}\n`;
    transcriptText += `Patient: ${patientName}\n`;
    transcriptText += `${'='.repeat(50)}\n\n`;
    
    entries.forEach(entry => {
      const speaker = entry.querySelector('.font-semibold')?.textContent || 'Unknown';
      const time = entry.querySelector('.text-slate-600')?.textContent || '';
      const text = entry.querySelector('p.text-slate-300')?.textContent || '';
      
      if (text) {
        transcriptText += `[${time}] ${speaker}:\n${text}\n\n`;
      }
    });
    
    transcriptText += `${'='.repeat(50)}\n`;
    transcriptText += `Total Words: ${wordCount}\n`;
    transcriptText += `Generated by Medazon AI Scribe`;
    
    // Call callback if provided
    if (onSaveTranscript) {
      onSaveTranscript(transcriptText);
    }
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('📥 Transcript exported');
  };

  const clearTranscript = () => {
    if (confirm('Clear the entire transcript?')) {
      if (transcriptAreaRef.current) {
        transcriptAreaRef.current.innerHTML = '';
      }
      setWordCount(0);
      addSystemMessage('🗑️ Transcript cleared');
      showToast('Transcript cleared');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current);
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <>
      <style>{`
        /* Custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        
        /* Animations */
        .knock-pulse { animation: knockPulse 1.5s ease-in-out infinite; }
        @keyframes knockPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        .transcript-new {
          animation: transcriptFade 0.3s ease-out;
        }
        @keyframes transcriptFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .pulse-ring {
          animation: pulseRing 2s ease-out infinite;
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        .dialpad-btn:active { transform: scale(0.95); background-color: #475569; }
        .dialpad-btn:hover { background-color: #475569; }
        
        .tab-active { 
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3);
        }
        
        .ai-glow {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
        }
        
        .soap-s { border-left-color: #22c55e; }
        .soap-o { border-left-color: #3b82f6; }
        .soap-a { border-left-color: #f59e0b; }
        .soap-p { border-left-color: #ef4444; }
      `}</style>

      <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        {/* MAIN LAYOUT: Video Panel + AI Scribe Side Panel */}
        <div className="flex flex-col lg:flex-row">
          
          {/* ============================================= */}
          {/* LEFT: VIDEO VISIT PANEL */}
          {/* ============================================= */}
          <div className="flex-1 lg:max-w-[700px] bg-[#1a1f2e] border-r border-slate-700">
            
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-[#0f1318] border-b border-slate-700">
              <div className="flex items-center">
                <span className="text-orange-500 font-bold text-base sm:text-xl tracking-wider">MEDAZON</span>
                <span className="text-white font-bold text-base sm:text-xl mx-1 sm:mx-1.5">+</span>
                <span className="text-teal-400 font-bold text-base sm:text-xl tracking-wider">HEALTH</span>
              </div>
              
              {/* AI Scribe Status */}
              <div className="flex items-center gap-2">
                {showAIScribeStatus && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-600/20 border border-purple-500/50 rounded-lg">
                    <div className="relative">
                      <span className="w-2 h-2 bg-purple-500 rounded-full block"></span>
                      <span className="absolute inset-0 w-2 h-2 bg-purple-500 rounded-full pulse-ring"></span>
                    </div>
                    <span className="text-purple-400 text-xs font-medium">AI Scribe Active</span>
                  </div>
                )}
                
                <button onClick={handleClose} className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-red-600 rounded transition-colors" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Patient Info Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#12161f]">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 bg-green-500 rounded-full"></span>
                <span className="text-white font-semibold text-sm sm:text-base">{patientName}</span>
                <span className="text-slate-500 text-xs sm:text-sm hidden sm:inline">•</span>
                <span className="text-slate-400 text-xs sm:text-sm hidden sm:inline">{patientPhone}</span>
                <span className="text-slate-400 text-sm font-mono">{formatTime(callSeconds)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {showRecIndicator && (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-red-500 font-medium text-xs sm:text-sm">REC</span>
                  </div>
                )}
                
                {showDialoutStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xs sm:text-sm">{dialoutStatusText}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Area */}
            <div className="relative bg-[#0a0d12] h-[240px] sm:h-[280px] md:h-[320px]">
              {/* Patient Video (Center) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-pink-500 rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                    <span className="text-white text-3xl sm:text-4xl font-semibold">{patientInitials}</span>
                  </div>
                  <p className="text-white text-base sm:text-lg">{patientName}</p>
                </div>
              </div>

              {/* KNOCK Indicator */}
              {showKnockIndicator && (
                <div className="absolute top-3 left-3 right-3 sm:right-auto bg-blue-600/20 border border-blue-500/50 rounded-xl p-3 knock-pulse">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">{patientInitials}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{patientName}</p>
                        <p className="text-blue-400 text-xs">is knocking to join...</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={admitPatient} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 font-medium">✓ Admit</button>
                      <button onClick={denyPatient} className="flex-1 sm:flex-none px-4 py-2 bg-red-600/20 text-red-400 text-xs sm:text-sm rounded-lg hover:bg-red-600/40 border border-red-500/50">✕ Deny</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Waiting Room Indicator */}
              {showWaitingRoom && (
                <div className="absolute top-3 left-3 bg-green-600/20 border border-green-500/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-green-400 text-xs sm:text-sm">Patient connected</span>
                  </div>
                </div>
              )}

              {/* Self View */}
              <div className="absolute bottom-3 right-3 bg-slate-800/90 rounded-xl p-2 flex flex-col items-center border border-slate-700">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm sm:text-base font-semibold">{doctorInitials}</span>
                </div>
                <p className="text-white text-[10px] sm:text-xs mt-1">You</p>
              </div>

              {/* Call Status Overlay */}
              {showCallStatus && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-white font-medium">{callStatusText}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Control Bar */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4 bg-[#12161f] border-t border-slate-700">
              <button 
                onClick={toggleMute} 
                className={`p-2.5 sm:p-3 rounded-xl transition-colors ${muteActive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={muteActive ? 'Unmute' : 'Mute'}
              >
                {muteActive ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </button>
              
              <button 
                onClick={toggleVideoCamera} 
                className={`p-2.5 sm:p-3 rounded-xl transition-colors ${videoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={videoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {videoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
              </button>
              
              <button 
                onClick={toggleRecording} 
                className={`p-2.5 sm:p-3 rounded-xl transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <Square className="w-5 h-5 text-white" /> : <Circle className="w-5 h-5 text-white" />}
              </button>
              
              <button 
                onClick={toggleAIScribe} 
                className={`p-2.5 sm:p-3 rounded-xl transition-colors ${isAIScribeActive ? 'bg-purple-600 hover:bg-purple-700 ai-glow' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={isAIScribeActive ? 'Stop AI Scribe' : 'Start AI Scribe'}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </button>
              
              <button 
                onClick={openDialPad} 
                className="p-2.5 sm:p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
                title="Dial pad"
              >
                <Keyboard className="w-5 h-5 text-white" />
              </button>
              
              <button 
                onClick={endCall} 
                className="p-2.5 sm:p-3 bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                title="End call"
              >
                <PhoneOff className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Pre-visit Actions */}
            {showPrevisitContent && !isInCall && (
              <div className="px-3 sm:px-4 py-3 bg-[#1a1f2e] border-t border-slate-700">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Generate or paste video link..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <button onClick={generateNewLink} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">
                      Generate
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyLink} className="flex-1 sm:flex-none px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center justify-center gap-1">
                      <Copy className="w-4 h-4" /> Copy
                    </button>
                    <button onClick={sendSMS} className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm flex items-center justify-center gap-1">
                      <Send className="w-4 h-4" /> SMS
                    </button>
                    <button onClick={quickResetCall} className="flex-1 sm:flex-none px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center justify-center gap-1">
                      <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={simulatePatientKnock} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs border border-blue-500/50">
                    🚪 Simulate Knock
                  </button>
                  <button onClick={openDialPad} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs border border-green-500/50">
                    📞 Call Patient
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================= */}
          {/* RIGHT: AI SCRIBE PANEL */}
          {/* ============================================= */}
          <div className="flex-1 lg:min-w-[400px] bg-[#0f1318] flex flex-col max-h-[700px]">
            
            {/* AI Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-white font-semibold">Medazon AI Scribe</span>
              </div>
              {showAIListening && (
                <div className="flex items-center gap-2 px-2 py-1 bg-purple-600/20 rounded-lg">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-3 bg-purple-500 rounded-full animate-pulse"></span>
                    <span className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-1 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                  <span className="text-purple-400 text-xs">{listeningStatus}</span>
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex px-2 py-2 gap-1 bg-[#12161f] border-b border-slate-700 overflow-x-auto">
              <button 
                onClick={() => switchTab('transcript')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeAITab === 'transcript' ? 'tab-active text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                📝 Transcript
              </button>
              <button 
                onClick={() => switchTab('soap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeAITab === 'soap' ? 'tab-active text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                🏥 SOAP Note
              </button>
              <button 
                onClick={() => switchTab('codes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeAITab === 'codes' ? 'tab-active text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                💊 Codes
              </button>
              <button 
                onClick={() => switchTab('instructions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeAITab === 'instructions' ? 'tab-active text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                📋 Instructions
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              
              {/* Transcript Tab */}
              {activeAITab === 'transcript' && (
                <div className="flex-1 flex flex-col">
                  <div 
                    ref={transcriptAreaRef}
                    className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar"
                  >
                    {/* Transcript entries will be added here dynamically */}
                    {!isAIScribeActive && wordCount === 0 && (
                      <div className="text-center py-8">
                        <Sparkles className="w-12 h-12 text-purple-500/30 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Start AI Scribe to begin transcription</p>
                        <p className="text-slate-600 text-xs mt-1">Click the ✨ button in the control bar</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Transcript Actions */}
                  {showTranscriptActions && (
                    <div className="px-4 py-3 bg-[#12161f] border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs">{wordCount} words</span>
                        <div className="flex gap-2">
                          <button onClick={exportTranscript} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs flex items-center gap-1">
                            <Download className="w-3 h-3" /> Export
                          </button>
                          <button onClick={clearTranscript} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs flex items-center gap-1 border border-red-500/50">
                            <Trash2 className="w-3 h-3" /> Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SOAP Note Tab */}
              {activeAITab === 'soap' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    {wordCount === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">SOAP note will generate from transcript</p>
                        <p className="text-slate-600 text-xs mt-1">Start recording first</p>
                      </div>
                    ) : showSOAPContent ? (
                      <div className="space-y-4">
                        <div className="soap-s border-l-4 pl-3 py-2 bg-green-600/10 rounded-r-lg">
                          <h4 className="text-green-400 font-semibold text-sm mb-1">Subjective</h4>
                          <p className="text-slate-300 text-sm">Patient reports burning sensation during urination for the past 3 days. Associated symptoms include urinary frequency, urgency, and suprapubic pressure. Denies hematuria, fever, or flank pain. History of UTI 6 months ago treated successfully with Macrobid.</p>
                        </div>
                        <div className="soap-o border-l-4 pl-3 py-2 bg-blue-600/10 rounded-r-lg">
                          <h4 className="text-blue-400 font-semibold text-sm mb-1">Objective</h4>
                          <p className="text-slate-300 text-sm">Telehealth visit. Patient appears comfortable. Vital signs not obtained (telehealth). No CVA tenderness reported by patient.</p>
                        </div>
                        <div className="soap-a border-l-4 pl-3 py-2 bg-amber-600/10 rounded-r-lg">
                          <h4 className="text-amber-400 font-semibold text-sm mb-1">Assessment</h4>
                          <p className="text-slate-300 text-sm">Uncomplicated urinary tract infection (cystitis) - N39.0</p>
                        </div>
                        <div className="soap-p border-l-4 pl-3 py-2 bg-red-600/10 rounded-r-lg">
                          <h4 className="text-red-400 font-semibold text-sm mb-1">Plan</h4>
                          <p className="text-slate-300 text-sm">1. Nitrofurantoin (Macrobid) 100mg BID x 5 days<br/>2. Increase fluid intake<br/>3. Return if symptoms worsen or do not improve in 48-72 hours<br/>4. Seek emergency care if fever, flank pain, or vomiting develop</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-slate-400 text-sm">Generating SOAP note...</p>
                      </div>
                    )}
                  </div>
                  
                  {showSOAPActions && (
                    <div className="px-4 py-3 bg-[#12161f] border-t border-slate-700">
                      <div className="flex gap-2">
                        <button onClick={openMagicEdit} className="flex-1 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3" /> Magic Edit
                        </button>
                        <button className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                          <ChevronRight className="w-3 h-3" /> Push to EHR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Codes Tab */}
              {activeAITab === 'codes' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    {wordCount === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">Codes will generate from transcript</p>
                      </div>
                    ) : showCodesContent ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-cyan-400 font-mono text-sm">N39.0</span>
                            <span className="text-green-400 text-xs px-2 py-0.5 bg-green-600/20 rounded">ICD-10</span>
                          </div>
                          <p className="text-slate-300 text-sm">Urinary tract infection, site not specified</p>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-cyan-400 font-mono text-sm">99213</span>
                            <span className="text-blue-400 text-xs px-2 py-0.5 bg-blue-600/20 rounded">CPT</span>
                          </div>
                          <p className="text-slate-300 text-sm">Office visit, established patient, low complexity</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-slate-400 text-sm">Generating codes...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions Tab */}
              {activeAITab === 'instructions' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    {wordCount === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">Instructions will generate from transcript</p>
                      </div>
                    ) : showInstructionsContent ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <h4 className="text-cyan-400 font-semibold text-sm mb-2">💊 Medication</h4>
                          <p className="text-slate-300 text-sm">Take Nitrofurantoin (Macrobid) 100mg twice daily for 5 days. Take with food to reduce stomach upset.</p>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <h4 className="text-cyan-400 font-semibold text-sm mb-2">💧 Hydration</h4>
                          <p className="text-slate-300 text-sm">Drink at least 8 glasses of water daily. Avoid caffeine and alcohol which can irritate the bladder.</p>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <h4 className="text-cyan-400 font-semibold text-sm mb-2">⚠️ Warning Signs</h4>
                          <p className="text-slate-300 text-sm">Seek immediate care if you develop: fever over 101°F, back or flank pain, blood in urine, nausea/vomiting, or symptoms worsen after 48 hours.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-slate-400 text-sm">Generating instructions...</p>
                      </div>
                    )}
                  </div>
                  
                  {showInstructionsActions && (
                    <div className="px-4 py-3 bg-[#12161f] border-t border-slate-700">
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium">
                          📄 Print
                        </button>
                        <button className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium">
                          📱 Send to Patient
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DIALPAD MODAL */}
        {showDialpadModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1a1f2e] rounded-2xl border border-slate-600 w-full max-w-xs shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-900/50 to-teal-900/50 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-green-400" />
                  <span className="text-white font-semibold text-sm">Dial Out</span>
                </div>
                <button onClick={closeDialPad} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-4 pt-4 pb-2">
                <div className="bg-slate-800 rounded-xl border border-slate-600 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 text-xs">Phone Number</span>
                    <button onClick={usePatientNumber} className="text-cyan-400 text-xs hover:text-cyan-300">👤 Patient</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="tel" 
                      value={dialpadNumber} 
                      onChange={(e) => setDialpadNumber(e.target.value)} 
                      placeholder="+1 (555) 000-0000" 
                      className="flex-1 bg-transparent text-white text-xl font-mono tracking-wider outline-none" 
                    />
                    <button onClick={clearDialPadNumber} className="p-2 text-slate-400 hover:text-red-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">Ext:</span>
                      <input 
                        type="text" 
                        value={dialpadExtension} 
                        onChange={(e) => setDialpadExtension(e.target.value)} 
                        placeholder="Optional" 
                        maxLength={20} 
                        className="flex-1 bg-transparent text-white text-sm font-mono outline-none" 
                      />
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">Wait:</span>
                      <select 
                        value={dialpadWait} 
                        onChange={(e) => setDialpadWait(e.target.value)} 
                        className="bg-transparent text-white text-sm outline-none"
                      >
                        <option value="2" className="bg-slate-800">2s</option>
                        <option value="5" className="bg-slate-800">5s</option>
                        <option value="10" className="bg-slate-800">10s</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                    <button 
                      key={digit}
                      onClick={() => dialPadPress(digit)} 
                      className="dialpad-btn h-12 bg-slate-700 rounded-xl flex flex-col items-center justify-center"
                    >
                      <span className="text-white text-lg font-semibold">{digit}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={closeDialPad} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={initiateDialOut} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" />
                  Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAGIC EDIT MODAL */}
        {showMagicEditModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1a1f2e] rounded-2xl border border-slate-600 w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-white font-semibold text-sm">Magic Edit</h3>
                    <p className="text-slate-400 text-xs">AI-powered note modification</p>
                  </div>
                </div>
                <button onClick={closeMagicEdit} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-slate-400 text-sm mb-3">What would you like to change?</p>
                <textarea 
                  value={magicEditInput} 
                  onChange={(e) => setMagicEditInput(e.target.value)} 
                  rows={3} 
                  placeholder="e.g., Make the plan section more detailed, add differential diagnoses, shorten the subjective section..." 
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => applyMagicSuggestion('more detailed')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">More detailed</button>
                  <button onClick={() => applyMagicSuggestion('more concise')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">More concise</button>
                  <button onClick={() => applyMagicSuggestion('add differentials')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">Add differentials</button>
                  <button onClick={() => applyMagicSuggestion('formal tone')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">Formal tone</button>
                </div>
              </div>
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={closeMagicEdit} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={executeMagicEdit} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-medium">Apply Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <div ref={toastContainerRef} className="fixed bottom-6 left-1/2 transform -translate-x-1/2 space-y-2 z-50"></div>
      </div>
    </>
  );
}
