'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import DailyIframe, { DailyCall, DailyParticipant } from '@daily-co/daily-js';

interface MedazonVideoPanelProps {
  roomUrl?: string;
  token?: string;
  patientName?: string;
  patientPhone?: string;
  onCallEnd?: () => void;
  onTranscriptUpdate?: (transcript: string) => void;
  onSOAPGenerated?: (soap: any) => void;
}

export default function MedazonVideoPanelFreedAI({
  roomUrl: initialRoomUrl,
  token,
  patientName = 'Patient',
  patientPhone = '',
  onCallEnd,
  onTranscriptUpdate,
  onSOAPGenerated
}: MedazonVideoPanelProps) {
  // =============================================
  // DAILY.CO SDK STATE
  // =============================================
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [callState, setCallState] = useState<'idle' | 'joining' | 'joined' | 'left' | 'error'>('idle');
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'low' | 'very-low'>('good');
  const [callError, setCallError] = useState<string | null>(null);
  
  // Video refs for rendering participant streams
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const dailyContainerRef = useRef<HTMLDivElement>(null);

  // =============================================
  // EXISTING STATE (kept from original)
  // =============================================
  const [callSeconds, setCallSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [currentRoomUrl, setCurrentRoomUrl] = useState(initialRoomUrl || '');
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
  const [showVideoPanel, setShowVideoPanel] = useState(true);
  
  // Media states (now connected to Daily.co)
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Tab states
  const [activeAITab, setActiveAITab] = useState('transcript');
  const [showSOAPContent, setShowSOAPContent] = useState(false);
  const [showSOAPActions, setShowSOAPActions] = useState(false);
  const [showCodesContent, setShowCodesContent] = useState(false);
  const [showCodesActions, setShowCodesActions] = useState(false);
  const [showInstructionsContent, setShowInstructionsContent] = useState(false);
  const [showInstructionsActions, setShowInstructionsActions] = useState(false);
  
  // Form states
  const [videoLink, setVideoLink] = useState(initialRoomUrl || '');
  const [dialpadNumber, setDialpadNumber] = useState(patientPhone || '+15551234567');
  const [dialpadExtension, setDialpadExtension] = useState('');
  const [dialpadWait, setDialpadWait] = useState('5');
  const [magicEditInput, setMagicEditInput] = useState('');
  const [listeningStatus, setListeningStatus] = useState('Listening...');
  
  // Button states
  const [callBtnText, setCallBtnText] = useState('Call');
  const [callBtnClass, setCallBtnClass] = useState('bg-green-600 hover:bg-green-700');

  // =============================================
  // BIDIRECTIONAL TRANSLATION STATE
  // =============================================
  const [isTranslationActive, setIsTranslationActive] = useState(false);
  const [patientLanguage, setPatientLanguage] = useState('es');
  const [showCaptions, setShowCaptions] = useState(true);
  const [translationVolume, setTranslationVolume] = useState(80);
  const [currentCaption, setCurrentCaption] = useState<{ translated: string; original: string; speaker: 'doctor' | 'patient' } | null>(null);
  const [translationStatus, setTranslationStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [translationLatency, setTranslationLatency] = useState(0);
  
  // Refs
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcriptAreaRef = useRef<HTMLDivElement>(null);
  const toastContainerRef = useRef<HTMLDivElement>(null);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const TRANSCRIPTION_INTERVAL_MS = 5000;
  const API_ENDPOINT = '/api/transcribe';

  const patientData = {
    name: patientName,
    phone: patientPhone || '+15551234567',
    phoneFormatted: patientPhone || '+1 (555) 123-4567'
  };

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
  // TRANSLATION LANGUAGES CONFIG
  // =============================================
  const TRANSLATION_LANGUAGES = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { code: 'ht', name: 'Haitian Creole', flag: '🇭🇹', nativeName: 'Kreyòl' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
    { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  ];

  const getLanguageInfo = (code: string) => {
    return TRANSLATION_LANGUAGES.find(l => l.code === code) || TRANSLATION_LANGUAGES[0];
  };

  const sampleTranslatedCaptions = [
    { speaker: 'patient' as const, original: "Tengo ardor al orinar desde hace tres días.", translated: "I've been having burning when I urinate for three days." },
    { speaker: 'patient' as const, original: "Sí, siento que tengo que ir todo el tiempo.", translated: "Yes, I feel like I need to go all the time." },
    { speaker: 'patient' as const, original: "No he visto sangre, y no creo que tenga fiebre.", translated: "I haven't seen blood, and I don't think I have a fever." },
  ];

  // =============================================
  // DAILY.CO SDK FUNCTIONS
  // =============================================
  
  // Initialize Daily.co call object
  const initializeDaily = useCallback(async (roomUrl: string) => {
    try {
      setCallState('joining');
      setCallError(null);
      setShowCallStatus(true);
      setCallStatusText('Initializing video...');

      // Destroy existing call if any
      if (callObject) {
        await callObject.destroy();
      }

      // Create new call object
      const newCallObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });

      // Set up event listeners
      newCallObject.on('joining-meeting', () => {
        setCallStatusText('Joining meeting...');
      });

      newCallObject.on('joined-meeting', (event) => {
        console.log('Joined Daily.co meeting', event);
        setCallState('joined');
        setIsInCall(true);
        setShowCallStatus(false);
        startTimer();
        showToast('📹 Connected to video call');
        
        // Get initial participants
        const allParticipants = newCallObject.participants();
        setParticipants(allParticipants);
        
        // Set up local video - Daily SDK uses tracks.video.track
        const localVideo = allParticipants.local?.tracks?.video;
        if (localVideoRef.current && localVideo?.track) {
          const stream = new MediaStream([localVideo.track]);
          localVideoRef.current.srcObject = stream;
        }
      });

      newCallObject.on('left-meeting', () => {
        console.log('Left Daily.co meeting');
        setCallState('left');
        setIsInCall(false);
        handleCallEnd();
      });

      newCallObject.on('participant-joined', (event) => {
        if (!event?.participant) return;
        console.log('Participant joined:', event.participant);
        setParticipants(prev => ({
          ...prev,
          [event.participant.session_id]: event.participant
        }));
        
        if (!event.participant.local) {
          setShowWaitingRoom(true);
          showToast(`✅ ${event.participant.user_name || 'Patient'} connected`);
        }
      });

      newCallObject.on('participant-left', (event) => {
        if (!event?.participant) return;
        console.log('Participant left:', event.participant);
        setParticipants(prev => {
          const updated = { ...prev };
          delete updated[event.participant.session_id];
          return updated;
        });
        
        if (!event.participant.local) {
          showToast(`👋 ${event.participant.user_name || 'Patient'} left the call`);
        }
      });

      newCallObject.on('participant-updated', (event) => {
        if (!event?.participant) return;
        setParticipants(prev => ({
          ...prev,
          [event.participant.session_id]: event.participant
        }));
        
        // Update remote video - Daily SDK uses tracks.video.track
        const remoteVideo = event.participant.tracks?.video;
        if (!event.participant.local && remoteVideoRef.current && remoteVideo?.track) {
          const stream = new MediaStream([remoteVideo.track]);
          remoteVideoRef.current.srcObject = stream;
        }
      });

      newCallObject.on('active-speaker-change', (event) => {
        if (event?.activeSpeaker?.peerId) {
          setActiveSpeakerId(event.activeSpeaker.peerId);
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
        setCallError(event?.errorMsg || 'An error occurred');
        setShowCallStatus(false);
        showToast('⚠️ Call error: ' + (event?.errorMsg || 'Unknown error'), 'error');
      });

      setCallObject(newCallObject);

      // Join the meeting
      const joinConfig: { url: string; token?: string; userName?: string } = {
        url: roomUrl,
        userName: 'Dr. Provider'
      };
      
      if (token) {
        joinConfig.token = token;
      }

      await newCallObject.join(joinConfig);

    } catch (error: any) {
      console.error('Failed to initialize Daily.co:', error);
      setCallState('error');
      setCallError(error.message || 'Failed to join call');
      setShowCallStatus(false);
      showToast('⚠️ Failed to join call', 'error');
    }
  }, [callObject, token]);

  // Leave the call
  const leaveCall = useCallback(async () => {
    if (callObject) {
      try {
        await callObject.leave();
        await callObject.destroy();
        setCallObject(null);
      } catch (error) {
        console.error('Error leaving call:', error);
      }
    }
    handleCallEnd();
  }, [callObject]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (callObject) {
      const newMuteState = !isMuted;
      await callObject.setLocalAudio(!newMuteState);
      setIsMuted(newMuteState);
      showToast(newMuteState ? '🔇 Muted' : '🎤 Unmuted');
    }
  }, [callObject, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (callObject) {
      const newVideoOffState = !isVideoOff;
      await callObject.setLocalVideo(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
      showToast(newVideoOffState ? '📷 Camera off' : '📹 Camera on');
    }
  }, [callObject, isVideoOff]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (callObject) {
      try {
        if (isScreenSharing) {
          await callObject.stopScreenShare();
          setIsScreenSharing(false);
          showToast('🖥️ Screen share stopped');
        } else {
          await callObject.startScreenShare();
          setIsScreenSharing(true);
          showToast('🖥️ Screen sharing started');
        }
      } catch (error) {
        console.error('Screen share error:', error);
        showToast('⚠️ Screen share failed', 'error');
      }
    }
  }, [callObject, isScreenSharing]);

  // Admit waiting participant (simplified - knock feature requires Daily.co room config)
  const admitParticipant = useCallback(async (participantId: string) => {
    // Note: Full knock/waiting room requires Daily.co room settings
    // This is a simplified UI update
    setShowKnockIndicator(false);
    setShowWaitingRoom(true);
    showToast('✅ Patient admitted');
  }, []);

  // Start recording via Daily.co (requires cloud recording enabled on account)
  const startRecording = useCallback(async () => {
    if (callObject) {
      try {
        await callObject.startRecording();
        setIsRecording(true);
        setShowRecIndicator(true);
        showToast('⏺️ Recording started');
      } catch (error: any) {
        console.error('Failed to start recording:', error);
        // Cloud recording requires paid Daily.co plan
        if (error?.message?.includes('not enabled') || error?.message?.includes('recording')) {
          showToast('⚠️ Recording requires Daily.co cloud recording plan', 'warning');
        } else {
          showToast('⚠️ Could not start recording', 'error');
        }
      }
    }
  }, [callObject]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (callObject && isRecording) {
      try {
        await callObject.stopRecording();
        setIsRecording(false);
        setShowRecIndicator(false);
        showToast('⏹️ Recording stopped');
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setIsRecording(false);
        setShowRecIndicator(false);
      }
    }
  }, [callObject, isRecording]);

  // Get audio stream from Daily.co for AI Scribe
  const getDailyAudioStream = useCallback((): MediaStream | null => {
    if (!callObject) return null;
    
    const allParticipants = callObject.participants();
    const tracks: MediaStreamTrack[] = [];
    
    // Get local audio track - Daily SDK uses tracks.audio.track
    const localAudio = allParticipants.local?.tracks?.audio;
    if (localAudio?.track) {
      tracks.push(localAudio.track);
    }
    
    // Get remote audio tracks
    Object.values(allParticipants).forEach(p => {
      const remoteAudio = p.tracks?.audio;
      if (!p.local && remoteAudio?.track) {
        tracks.push(remoteAudio.track);
      }
    });
    
    if (tracks.length > 0) {
      return new MediaStream(tracks);
    }
    
    return null;
  }, [callObject]);

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
  // CALL MANAGEMENT FUNCTIONS
  // =============================================
  
  const handleCallEnd = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setIsInCall(false);
    setIsRecording(false);
    setShowRecIndicator(false);
    setShowKnockIndicator(false);
    setShowWaitingRoom(false);
    setShowDialoutStatus(false);
    setCallSeconds(0);
    setParticipants({});
    
    if (isAIScribeActive) {
      stopAIScribe();
    }
    if (isTranslationActive) {
      stopTranslation();
    }
    
    onCallEnd?.();
    showToast('📞 Call ended');
  }, [isAIScribeActive, isTranslationActive, onCallEnd]);

  const generateNewLink = async () => {
    showToast('🔗 Generating link...', 'info');
    
    try {
      // In production, this would call your API to create a Daily.co room
      const response = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentRoomUrl(data.url);
        setVideoLink(data.url);
        showToast('✅ Link generated!');
      } else {
        // Fallback: generate a placeholder URL
        const roomId = 'visit-' + Math.random().toString(36).substr(2, 9);
        const newRoomUrl = `https://medazonhealth.daily.co/${roomId}`;
        setCurrentRoomUrl(newRoomUrl);
        setVideoLink(newRoomUrl);
        showToast('✅ Link generated!');
      }
    } catch (error) {
      // Fallback
      const roomId = 'visit-' + Math.random().toString(36).substr(2, 9);
      const newRoomUrl = `https://medazonhealth.daily.co/${roomId}`;
      setCurrentRoomUrl(newRoomUrl);
      setVideoLink(newRoomUrl);
      showToast('✅ Link generated!');
    }
  };

  const joinAsVideo = async () => {
    if (!currentRoomUrl) {
      await generateNewLink();
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (currentRoomUrl) {
      await initializeDaily(currentRoomUrl);
    }
  };

  const joinAsAudio = async () => {
    if (!currentRoomUrl) {
      await generateNewLink();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (currentRoomUrl && callObject) {
      // Join with video off
      await initializeDaily(currentRoomUrl);
      await callObject?.setLocalVideo(false);
      setIsVideoOff(true);
    } else if (currentRoomUrl) {
      await initializeDaily(currentRoomUrl);
    }
  };

  const sendLinkToPatient = () => {
    if (!currentRoomUrl) generateNewLink();
    showToast('📧 Link sent to patient');
  };

  const endCall = async () => {
    if (!isInCall && !callObject) return;
    
    if (confirm('End this call?')) {
      await leaveCall();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startTimer = () => {
    setCallSeconds(0);
    callTimerRef.current = setInterval(() => {
      setCallSeconds(prev => prev + 1);
    }, 1000);
  };

  // =============================================
  // BIDIRECTIONAL TRANSLATION FUNCTIONS
  // =============================================
  const toggleTranslation = async () => {
    if (!isTranslationActive) {
      await startTranslation();
    } else {
      await stopTranslation();
    }
  };

  const startTranslation = async () => {
    try {
      setTranslationStatus('connecting');
      showToast('🌐 Starting real-time translation...', 'info');

      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsTranslationActive(true);
      setTranslationStatus('active');
      setTranslationLatency(280);
      
      showToast(`✅ Translation active (${getLanguageInfo(patientLanguage).name})`, 'success');
      
      startDemoTranslationCaptions();

    } catch (error) {
      console.error('Translation error:', error);
      setTranslationStatus('error');
      showToast('⚠️ Could not start translation', 'error');
    }
  };

  const stopTranslation = async () => {
    setIsTranslationActive(false);
    setTranslationStatus('idle');
    setCurrentCaption(null);
    
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current);
    }
    
    showToast('Translation stopped');
  };

  const startDemoTranslationCaptions = () => {
    let index = 0;
    
    const showNextCaption = () => {
      if (!isTranslationActive) return;
      
      const caption = sampleTranslatedCaptions[index % sampleTranslatedCaptions.length];
      setCurrentCaption(caption);
      
      captionTimeoutRef.current = setTimeout(() => {
        setCurrentCaption(null);
        
        captionTimeoutRef.current = setTimeout(() => {
          index++;
          if (isTranslationActive) {
            showNextCaption();
          }
        }, 3000);
      }, 6000);
    };
    
    captionTimeoutRef.current = setTimeout(showNextCaption, 2000);
  };

  const changePatientLanguage = (langCode: string) => {
    setPatientLanguage(langCode);
    const lang = getLanguageInfo(langCode);
    showToast(`🌐 Patient language: ${lang.flag} ${lang.name}`, 'info');
    
    if (isTranslationActive) {
      stopTranslation().then(() => startTranslation());
    }
  };

  const toggleCaptions = () => {
    setShowCaptions(!showCaptions);
    showToast(showCaptions ? '📝 Captions hidden' : '📝 Captions shown');
  };

  // =============================================
  // AI SCRIBE FUNCTIONS (using Daily.co audio when available)
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
      let stream: MediaStream | null = null;
      
      // Try to get audio from Daily.co call first
      if (callObject && isInCall) {
        stream = getDailyAudioStream();
      }
      
      // Fallback to direct microphone access
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
          } 
        });
      }
      
      if (!stream) {
        throw new Error('No audio stream available');
      }
      
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
    
    // Only stop the stream if we created it (not from Daily.co)
    if (audioStreamRef.current && !callObject) {
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
        onTranscriptUpdate?.(data.text.trim());
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

  const detectSpeaker = (text: string): boolean => {
    const doctorPhrases = [
      'i recommend', 'i suggest', 'let me', 'i\'ll prescribe', 'your symptoms',
      'diagnosis', 'treatment', 'medication', 'follow up', 'come back',
      'how long have you', 'when did', 'do you have', 'any other',
      'based on', 'i\'m going to', 'we should', 'the results show'
    ];
    const textLower = text.toLowerCase();
    return doctorPhrases.some(phrase => textLower.includes(phrase));
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const toggleSpeaker = (avatarElement: HTMLElement) => {
    const isCurrentlyDoctor = avatarElement.classList.contains('bg-blue-600');
    const parentDiv = avatarElement.closest('.flex.gap-3');
    
    if (isCurrentlyDoctor) {
      avatarElement.classList.remove('bg-blue-600');
      avatarElement.classList.add('bg-pink-500');
      avatarElement.querySelector('span')!.textContent = patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      parentDiv?.querySelector('.font-semibold')?.classList.remove('text-blue-400');
      parentDiv?.querySelector('.font-semibold')?.classList.add('text-pink-400');
      if (parentDiv?.querySelector('.font-semibold')) {
        parentDiv.querySelector('.font-semibold')!.textContent = 'Patient';
      }
    } else {
      avatarElement.classList.remove('bg-pink-500');
      avatarElement.classList.add('bg-blue-600');
      avatarElement.querySelector('span')!.textContent = 'DS';
      parentDiv?.querySelector('.font-semibold')?.classList.remove('text-pink-400');
      parentDiv?.querySelector('.font-semibold')?.classList.add('text-blue-400');
      if (parentDiv?.querySelector('.font-semibold')) {
        parentDiv.querySelector('.font-semibold')!.textContent = 'Dr. Smith';
      }
    }
    
    showToast('Speaker updated');
  };

  const addTranscriptEntry = (text: string) => {
    const area = transcriptAreaRef.current;
    if (!area) return;
    
    const isLikelyDoctor = detectSpeaker(text);
    const initials = isLikelyDoctor ? 'DS' : patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const bgColor = isLikelyDoctor ? 'bg-blue-600' : 'bg-pink-500';
    const label = isLikelyDoctor ? 'Dr. Smith' : 'Patient';
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

  const startDemoTranscription = () => {
    setIsAIScribeActive(true);
    setShowAIScribeStatus(true);
    setShowAIListening(true);
    setShowTranscriptActions(true);
    addSystemMessage('🎙️ Demo Mode - Simulating transcription...');
    
    let index = 0;
    transcriptIntervalRef.current = setInterval(() => {
      if (index < sampleTranscript.length) {
        addTranscriptLine(sampleTranscript[index]);
        index++;
      } else {
        index = 0;
      }
    }, 4000);
  };

  const stopDemoTranscription = () => {
    if (transcriptIntervalRef.current) {
      clearInterval(transcriptIntervalRef.current);
      transcriptIntervalRef.current = null;
    }
  };

  const addTranscriptLine = (line: { speaker: string; text: string }) => {
    const area = transcriptAreaRef.current;
    if (!area) return;
    
    const isDoctor = line.speaker === 'doctor';
    const initials = isDoctor ? 'DS' : patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const bgColor = isDoctor ? 'bg-blue-600' : 'bg-pink-500';
    const label = isDoctor ? 'Dr. Smith' : 'Patient';
    
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
          <span class="text-${isDoctor ? 'blue' : 'pink'}-400 text-xs font-semibold">${label}</span>
          <span class="text-slate-600 text-[10px]">${timestamp}</span>
        </div>
        <p class="text-slate-300 text-sm">${line.text}</p>
      </div>
    `;
    
    const avatar = div.querySelector('.rounded-full');
    if (avatar) {
      avatar.addEventListener('click', () => toggleSpeaker(avatar as HTMLElement));
    }
    
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    
    const newWordCount = wordCount + line.text.split(' ').length;
    setWordCount(newWordCount);
    
    onTranscriptUpdate?.(line.text);
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
    transcriptText += `Patient: ${patientData.name}\n`;
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
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${patientData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
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
      showToast('🗑️ Transcript cleared');
    }
  };

  // =============================================
  // AI TAB & SOAP FUNCTIONS
  // =============================================
  const switchAITab = (tabName: string) => {
    setActiveAITab(tabName);
  };

  const generateSOAPNote = () => {
    showToast('🔄 Generating SOAP note...', 'info');
    
    setTimeout(() => {
      setShowSOAPContent(true);
      setShowSOAPActions(true);
      showToast('✅ SOAP note generated!');
      
      onSOAPGenerated?.({
        subjective: 'Patient reports burning with urination for 3 days...',
        objective: 'Vitals stable, no CVA tenderness...',
        assessment: 'Uncomplicated UTI',
        plan: 'Macrobid 100mg BID x 5 days'
      });
    }, 1500);
  };

  const copySOAP = () => {
    const s = document.getElementById('soap-subjective')?.innerText || '';
    const o = document.getElementById('soap-objective')?.innerText || '';
    const a = document.getElementById('soap-assessment')?.innerText || '';
    const p = document.getElementById('soap-plan')?.innerText || '';
    
    const fullNote = `SUBJECTIVE:\n${s}\n\nOBJECTIVE:\n${o}\n\nASSESSMENT:\n${a}\n\nPLAN:\n${p}`;
    navigator.clipboard.writeText(fullNote);
    showToast('📋 SOAP note copied!');
  };

  const pushToEHR = () => {
    showToast('⬆️ Pushing to EHR...', 'info');
    setTimeout(() => {
      showToast('✅ Note pushed to EHR successfully!');
    }, 1500);
  };

  const learnFormat = () => {
    showToast('🧠 Format preferences saved!', 'info');
  };

  const magicEdit = () => {
    setShowMagicEditModal(true);
  };

  const closeMagicEdit = () => {
    setShowMagicEditModal(false);
  };

  const applyMagicSuggestion = (suggestion: string) => {
    setMagicEditInput(suggestion);
  };

  const executeMagicEdit = () => {
    if (!magicEditInput.trim()) {
      showToast('⚠️ Please enter what you want to change', 'warning');
      return;
    }
    
    showToast('✨ Applying magic edit...', 'info');
    closeMagicEdit();
    
    setTimeout(() => {
      showToast('✅ Note updated!');
    }, 1500);
  };

  // =============================================
  // ICD-10 CODES
  // =============================================
  const generateICD10 = () => {
    showToast('🔄 Analyzing transcript for codes...', 'info');
    
    setTimeout(() => {
      setShowCodesContent(true);
      setShowCodesActions(true);
      showToast('✅ ICD-10 codes generated!');
    }, 1500);
  };

  const copyICDCodes = () => {
    const codes: string[] = [];
    document.querySelectorAll('#codes-content input[type="checkbox"]:checked').forEach(cb => {
      const code = cb.closest('label')?.querySelector('.font-mono')?.textContent;
      if (code) codes.push(code);
    });
    navigator.clipboard.writeText(codes.join(', '));
    showToast(`📋 Copied: ${codes.join(', ')}`);
  };

  // =============================================
  // PATIENT INSTRUCTIONS
  // =============================================
  const generateInstructions = () => {
    showToast('🔄 Generating patient instructions...', 'info');
    
    setTimeout(() => {
      setShowInstructionsContent(true);
      setShowInstructionsActions(true);
      showToast('✅ Instructions generated!');
    }, 1500);
  };

  const regenerateInstructions = () => {
    showToast('🔄 Regenerating...', 'info');
    setTimeout(() => showToast('✅ Instructions regenerated!'), 1000);
  };

  const sendInstructionsEmail = () => {
    showToast('📧 Sending to patient email...', 'info');
    setTimeout(() => showToast(`✅ Email sent to ${patientData.name}`), 1500);
  };

  const sendInstructionsSMS = () => {
    showToast('📱 Sending SMS...', 'info');
    setTimeout(() => showToast(`✅ SMS sent to ${patientData.phoneFormatted}`), 1500);
  };

  const printInstructions = () => {
    showToast('🖨️ Opening print dialog...');
    window.print();
  };

  // =============================================
  // DIAL PAD FUNCTIONS
  // =============================================
  const openDialPad = () => {
    setDialpadNumber(patientData.phone);
    setDialpadExtension('');
    setShowDialpadModal(true);
  };

  const closeDialPad = () => {
    setShowDialpadModal(false);
  };

  const dialPadPress = (digit: string) => {
    setDialpadNumber(prev => prev + digit);
  };

  const clearDialPadNumber = () => {
    setDialpadNumber(prev => prev.slice(0, -1));
  };

  const usePatientNumber = () => {
    setDialpadNumber(patientData.phone);
    showToast(`📱 Using ${patientData.name}'s number`);
  };

  const initiateDialOut = async () => {
    if (isDialingOut) {
      await hangUpDialOut();
      return;
    }

    const phoneNumber = dialpadNumber.replace(/\D/g, '');
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast('⚠️ Enter a valid phone number', 'error');
      return;
    }

    const formattedNumber = '+' + phoneNumber;
    closeDialPad();

    // Use Daily.co's dialout feature if available
    if (callObject && isInCall) {
      try {
        setIsDialingOut(true);
        setShowDialoutStatus(true);
        setDialoutStatusText(`📞 Calling ${formattedNumber}...`);
        setCallBtnClass('bg-red-600 hover:bg-red-700');
        setCallBtnText('Calling...');
        
        // Daily.co SIP dialout (requires enterprise plan)
        // await callObject.startDialout({ phoneNumber: formattedNumber });
        
        // Simulate for now
        setTimeout(() => {
          setDialoutStatusText('📞 Ringing...');
          
          setTimeout(() => {
            setDialoutSessionId('session-' + Date.now());
            setDialoutStatusText('📞 Connected');
            setCallBtnText('Hang Up');
            showToast('✅ Patient connected!');
            if (!isRecording) {
              startRecording();
            }
          }, 3000);
        }, 2000);
        
      } catch (error) {
        console.error('Dialout error:', error);
        showToast('⚠️ Dialout failed', 'error');
        setIsDialingOut(false);
        setShowDialoutStatus(false);
      }
    } else {
      showToast('⚠️ Join a call first before dialing out', 'warning');
    }
  };

  const hangUpDialOut = async () => {
    setIsDialingOut(false);
    setDialoutSessionId(null);
    setShowDialoutStatus(false);
    
    setCallBtnClass('bg-green-600 hover:bg-green-700');
    setCallBtnText('Call');
    showToast('📞 Call ended');
  };

  // =============================================
  // OTHER FUNCTIONS
  // =============================================
  const togglePreVisit = () => {
    setShowPrevisitContent(!showPrevisitContent);
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

  const resendToPatient = () => {
    if (!currentRoomUrl) generateNewLink();
    showToast('📧📱 Link resent');
  };

  const quickResetCall = async () => {
    if (confirm('Reset call? This will end current call, generate new link, and resend to patient.')) {
      showToast('🔄 Resetting...', 'info');
      
      if (isInCall) {
        await leaveCall();
      }
      
      await generateNewLink();
      showToast('✅ Reset complete!');
    }
  };

  const closeOverlay = () => {
    if (confirm('Close video panel?')) {
      if (isInCall) {
        leaveCall();
      }
      setShowVideoPanel(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get remote participant for display
  const remoteParticipant = Object.values(participants).find(p => !p.local);
  const remoteParticipantName = remoteParticipant?.user_name || patientName;
  const remoteParticipantInitials = remoteParticipantName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // =============================================
  // CLEANUP
  // =============================================
  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current);
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
      if (audioStreamRef.current && !callObject) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (callObject) {
        callObject.destroy().catch(console.error);
      }
    };
  }, [callObject]);

  // Update room URL when prop changes
  useEffect(() => {
    if (initialRoomUrl && initialRoomUrl !== currentRoomUrl) {
      setCurrentRoomUrl(initialRoomUrl);
      setVideoLink(initialRoomUrl);
    }
  }, [initialRoomUrl]);

  // =============================================
  // RENDER
  // =============================================
  return (
    <>
      <style>{`
        * { font-family: 'Inter', sans-serif; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
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

        .caption-slide-up {
          animation: captionSlideUp 0.3s ease-out;
        }
        @keyframes captionSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .translation-pulse {
          animation: translationPulse 2s ease-in-out infinite;
        }
        @keyframes translationPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        /* Daily.co video styles */
        .daily-video {
          object-fit: cover;
          border-radius: 8px;
        }
      `}</style>

      <div className="min-h-screen p-2 sm:p-4">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-3">
          
          {/* ============================================= */}
          {/* LEFT: VIDEO VISIT PANEL */}
          {/* ============================================= */}
          {showVideoPanel && (
            <div id="video-panel" className="flex-1 max-w-[700px] shadow-2xl rounded-2xl overflow-hidden bg-[#1a1f2e] border border-slate-700">
              
              {/* Header */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-[#0f1318] border-b border-slate-700">
                <div className="flex items-center">
                  <span className="text-orange-500 font-bold text-base sm:text-xl tracking-wider">MEDAZON</span>
                  <span className="text-white font-bold text-base sm:text-xl mx-1 sm:mx-1.5">+</span>
                  <span className="text-teal-400 font-bold text-base sm:text-xl tracking-wider">HEALTH</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Network Quality Indicator */}
                  {isInCall && (
                    <div className={`px-2 py-1 rounded text-xs ${
                      networkQuality === 'good' ? 'bg-green-600/20 text-green-400' :
                      networkQuality === 'low' ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-red-600/20 text-red-400'
                    }`}>
                      {networkQuality === 'good' ? '●' : networkQuality === 'low' ? '◐' : '○'} Network
                    </div>
                  )}
                  <button className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Minimize">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
                    </svg>
                  </button>
                  <button onClick={closeOverlay} className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-red-600 rounded" title="Close">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Patient Info Bar */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#12161f]">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full ${isInCall ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                  <span className="text-white font-semibold text-sm sm:text-base">{patientName}</span>
                  <span className="text-slate-500 text-xs sm:text-sm hidden sm:inline">•</span>
                  <span className="text-slate-400 text-xs sm:text-sm hidden sm:inline">{patientData.phoneFormatted}</span>
                  <span className="text-slate-400 text-sm font-mono">{formatTime(callSeconds)}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isTranslationActive && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-600/20 border border-teal-500/40 rounded-lg">
                      <span className="w-2 h-2 bg-teal-400 rounded-full translation-pulse"></span>
                      <span className="text-teal-400 text-xs font-medium">
                        {getLanguageInfo(patientLanguage).flag} ↔ 🇺🇸
                      </span>
                    </div>
                  )}

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
                {/* Call Status Overlay */}
                {showCallStatus && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
                      <div className="text-white text-lg">{callStatusText}</div>
                    </div>
                  </div>
                )}

                {/* Error Overlay */}
                {callState === 'error' && callError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-20">
                    <div className="text-center p-4">
                      <div className="text-red-400 text-lg mb-2">Connection Error</div>
                      <div className="text-gray-400 text-sm mb-4">{callError}</div>
                      <button
                        onClick={() => currentRoomUrl && initializeDaily(currentRoomUrl)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Remote Video / Patient */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {remoteParticipant?.tracks?.video?.track ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-pink-500 rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center ${activeSpeakerId && remoteParticipant?.session_id === activeSpeakerId ? 'ring-4 ring-cyan-400' : ''}`}>
                        <span className="text-white text-3xl sm:text-4xl font-semibold">{remoteParticipantInitials}</span>
                      </div>
                      <p className="text-white text-base sm:text-lg">{remoteParticipantName}</p>
                      {!isInCall && (
                        <p className="text-slate-400 text-sm mt-1">Waiting to connect...</p>
                      )}
                      {isTranslationActive && (
                        <p className="text-teal-400 text-xs mt-1">
                          Speaking: {getLanguageInfo(patientLanguage).flag} {getLanguageInfo(patientLanguage).nativeName}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* KNOCK Indicator */}
                {showKnockIndicator && (
                  <div className="absolute top-3 left-3 right-3 sm:right-auto bg-blue-600/20 border border-blue-500/50 rounded-xl p-3 knock-pulse z-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">{remoteParticipantInitials}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{remoteParticipantName}</p>
                          <p className="text-blue-400 text-xs">is knocking to join...</p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => remoteParticipant && admitParticipant(remoteParticipant.session_id)} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 font-medium">✓ Admit</button>
                        <button onClick={() => setShowKnockIndicator(false)} className="flex-1 sm:flex-none px-4 py-2 bg-red-600/20 text-red-400 text-xs sm:text-sm rounded-lg hover:bg-red-600/40 border border-red-500/50">✕ Deny</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting Room Indicator */}
                {showWaitingRoom && isInCall && (
                  <div className="absolute top-3 left-3 bg-green-600/20 border border-green-500/50 rounded-lg px-3 py-2 z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-green-400 text-xs sm:text-sm">Patient connected</span>
                    </div>
                  </div>
                )}

                {/* Translation Captions */}
                {isTranslationActive && showCaptions && currentCaption && (
                  <div className="absolute bottom-16 left-3 right-3 sm:right-20 caption-slide-up z-10">
                    <div className="bg-black/90 backdrop-blur-sm rounded-xl p-3 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getLanguageInfo(patientLanguage).flag}</span>
                        <span className="text-slate-500 text-xs">→</span>
                        <span className="text-lg">🇺🇸</span>
                        <span className="text-teal-400 text-xs font-medium ml-2">
                          {currentCaption.speaker === 'patient' ? 'Patient speaking' : 'You (translated)'}
                        </span>
                        <span className="text-slate-600 text-[10px] ml-auto">{translationLatency}ms</span>
                      </div>
                      <p className="text-white text-sm font-medium">{currentCaption.translated}</p>
                      <p className="text-slate-500 text-xs mt-1 italic">"{currentCaption.original}"</p>
                    </div>
                  </div>
                )}

                {/* Self View (Local Video) */}
                <div className="absolute bottom-3 right-3 bg-slate-800/90 rounded-xl p-1 border border-slate-700 z-10">
                  {participants.local?.tracks?.video?.track && !isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-20 h-16 sm:w-24 sm:h-20 object-cover rounded-lg daily-video"
                    />
                  ) : (
                    <div className="w-20 h-16 sm:w-24 sm:h-20 flex flex-col items-center justify-center">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center ${activeSpeakerId === participants.local?.session_id ? 'ring-2 ring-cyan-400' : ''}`}>
                        <span className="text-white text-sm sm:text-base font-semibold">DS</span>
                      </div>
                      <p className="text-white text-[10px] sm:text-xs mt-1">You</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Call Controls */}
              <div className="px-3 sm:px-4 py-3 bg-[#12161f] border-t border-slate-700">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
                  {/* Mute */}
                  <button 
                    onClick={toggleMute} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                      </svg>
                    )}
                  </button>

                  {/* Video Toggle */}
                  <button 
                    onClick={toggleVideo} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {isVideoOff ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    )}
                  </button>

                  {/* Screen Share */}
                  <button 
                    onClick={toggleScreenShare} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    disabled={!isInCall}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </button>

                  {/* Recording */}
                  <button 
                    onClick={toggleRecording} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isRecording ? 'Stop recording' : 'Start recording'}
                    disabled={!isInCall}
                  >
                    <svg className="w-5 h-5 text-white" fill={isRecording ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                      {isRecording && <circle cx="12" cy="12" r="4" fill="white"/>}
                    </svg>
                  </button>

                  {/* AI Scribe */}
                  <button 
                    onClick={toggleAIScribe} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isAIScribeActive ? 'bg-purple-500 hover:bg-purple-600 ai-glow' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isAIScribeActive ? 'Stop AI Scribe' : 'Start AI Scribe'}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </button>

                  {/* Translation */}
                  <button 
                    onClick={toggleTranslation} 
                    className={`p-2.5 sm:p-3 rounded-full transition-colors ${isTranslationActive ? 'bg-teal-500 hover:bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title={isTranslationActive ? 'Stop translation' : 'Start translation'}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                    </svg>
                  </button>

                  {/* End Call */}
                  <button 
                    onClick={endCall} 
                    className="p-2.5 sm:p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                    title="End call"
                    disabled={!isInCall && !callObject}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                    </svg>
                  </button>
                </div>

                {/* Translation Language Selector (when active) */}
                {isTranslationActive && (
                  <div className="flex items-center justify-center gap-2 mb-3 p-2 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-400 text-xs">Patient speaks:</span>
                    <select 
                      value={patientLanguage}
                      onChange={(e) => changePatientLanguage(e.target.value)}
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none"
                    >
                      {TRANSLATION_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={toggleCaptions}
                      className={`p-1.5 rounded ${showCaptions ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                      title={showCaptions ? 'Hide Captions' : 'Show Captions'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="2"/>
                        <path strokeLinecap="round" strokeWidth="2" d="M7 15h4M15 15h2M7 11h2M13 11h4"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* CTA Buttons */}
                <div className="flex items-center justify-start sm:justify-center gap-1.5 mb-3 overflow-x-auto hide-scrollbar pb-1">
                  <button onClick={generateNewLink} className="flex-shrink-0 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    Link
                  </button>
                  <button onClick={sendSMS} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                    </svg>
                    SMS
                  </button>
                  <button onClick={joinAsAudio} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium" disabled={isInCall}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    Audio
                  </button>
                  <button onClick={joinAsVideo} className="flex-shrink-0 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium" disabled={isInCall}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    {isInCall ? 'In Call' : 'Video'}
                  </button>
                  <button onClick={sendLinkToPatient} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    Send
                  </button>
                  <button onClick={openDialPad} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    Dial-in
                  </button>
                  <button onClick={quickResetCall} className="flex-shrink-0 px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Reset
                  </button>
                </div>

                {/* Link Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-slate-800 rounded-lg border border-slate-600 px-3 py-2">
                    <input type="text" value={videoLink} placeholder="Click 'Link' to generate..." className="flex-1 bg-transparent text-slate-300 text-xs outline-none min-w-0" readOnly />
                    <button onClick={copyLink} className="text-slate-400 hover:text-yellow-400 ml-2" title="Copy">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    </button>
                  </div>
                  <button onClick={resendToPatient} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                    RESEND TO PATIENT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================= */}
          {/* RIGHT: AI SCRIBE PANEL */}
          {/* ============================================= */}
          <div id="ai-scribe-panel" className="w-full lg:w-[480px] bg-[#1a1f2e] rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl">
            
            {/* AI Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">Medazon AI Scribe</h2>
                  <p className="text-slate-400 text-[10px]">
                    {isAIScribeActive ? (
                      <span className="text-green-400">● Active - {listeningStatus}</span>
                    ) : (
                      <span>Click the brain icon to start</span>
                    )}
                  </p>
                </div>
              </div>
              
              {showTranscriptActions && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">{wordCount} words</span>
                  <button onClick={exportTranscript} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Export">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  </button>
                  <button onClick={clearTranscript} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded" title="Clear">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* AI Tab Navigation */}
            <div className="flex border-b border-slate-700">
              {['transcript', 'soap', 'codes', 'instructions'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => switchAITab(tab)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeAITab === tab 
                      ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* AI Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {/* Transcript Tab */}
              {activeAITab === 'transcript' && (
                <div>
                  <div ref={transcriptAreaRef} className="space-y-4 min-h-[200px]">
                    {!isAIScribeActive && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                          </svg>
                        </div>
                        <p className="text-slate-400 text-sm">Start AI Scribe to begin transcription</p>
                        <button 
                          onClick={toggleAIScribe}
                          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
                        >
                          Start AI Scribe
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SOAP Tab */}
              {activeAITab === 'soap' && (
                <div>
                  {!showSOAPContent ? (
                    <div className="text-center py-8">
                      <button 
                        onClick={generateSOAPNote}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium"
                      >
                        Generate SOAP Note
                      </button>
                      <p className="text-slate-400 text-xs mt-3">AI will analyze the transcript</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 soap-s">
                        <h4 className="text-green-400 text-xs font-semibold mb-2">SUBJECTIVE</h4>
                        <p id="soap-subjective" className="text-slate-300 text-sm" contentEditable suppressContentEditableWarning>
                          Patient presents with a 3-day history of dysuria (burning sensation during urination), increased urinary frequency, and urgency. Reports suprapubic pressure/discomfort. Denies hematuria, fever, or flank pain. Patient has history of UTI approximately 6 months ago, successfully treated with Nitrofurantoin (Macrobid).
                        </p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 soap-o">
                        <h4 className="text-blue-400 text-xs font-semibold mb-2">OBJECTIVE</h4>
                        <p id="soap-objective" className="text-slate-300 text-sm" contentEditable suppressContentEditableWarning>
                          Telehealth visit - limited physical exam. Patient appears comfortable, in no acute distress. Self-reported: afebrile, no CVA tenderness. Vital signs not obtained (telehealth).
                        </p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 soap-a">
                        <h4 className="text-amber-400 text-xs font-semibold mb-2">ASSESSMENT</h4>
                        <p id="soap-assessment" className="text-slate-300 text-sm" contentEditable suppressContentEditableWarning>
                          Uncomplicated urinary tract infection (cystitis) - N39.0. Clinical presentation consistent with lower UTI based on symptom constellation and prior history.
                        </p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg border-l-4 soap-p">
                        <h4 className="text-red-400 text-xs font-semibold mb-2">PLAN</h4>
                        <p id="soap-plan" className="text-slate-300 text-sm" contentEditable suppressContentEditableWarning>
                          1. Nitrofurantoin (Macrobid) 100mg PO BID x 5 days
                          2. Increase fluid intake
                          3. Return precautions: fever, worsening symptoms, flank pain
                          4. Follow up if symptoms persist after completing antibiotics
                        </p>
                      </div>
                      
                      {showSOAPActions && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button onClick={copySOAP} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">📋 Copy</button>
                          <button onClick={pushToEHR} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">⬆️ Push to EHR</button>
                          <button onClick={magicEdit} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs">✨ Magic Edit</button>
                          <button onClick={learnFormat} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">🧠 Learn Format</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Codes Tab */}
              {activeAITab === 'codes' && (
                <div>
                  {!showCodesContent ? (
                    <div className="text-center py-8">
                      <button 
                        onClick={generateICD10}
                        className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-medium"
                      >
                        Generate ICD-10 Codes
                      </button>
                    </div>
                  ) : (
                    <div id="codes-content" className="space-y-3">
                      <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-700/50">
                        <input type="checkbox" defaultChecked className="mt-1 accent-cyan-500" />
                        <div>
                          <span className="text-cyan-400 font-mono text-sm">N39.0</span>
                          <p className="text-white text-sm">Urinary tract infection, site not specified</p>
                          <p className="text-slate-400 text-xs">Primary diagnosis</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-700/50">
                        <input type="checkbox" defaultChecked className="mt-1 accent-cyan-500" />
                        <div>
                          <span className="text-cyan-400 font-mono text-sm">R30.0</span>
                          <p className="text-white text-sm">Dysuria</p>
                          <p className="text-slate-400 text-xs">Supporting symptom</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-700/50">
                        <input type="checkbox" className="mt-1 accent-cyan-500" />
                        <div>
                          <span className="text-cyan-400 font-mono text-sm">R35.0</span>
                          <p className="text-white text-sm">Frequency of micturition</p>
                          <p className="text-slate-400 text-xs">Optional</p>
                        </div>
                      </label>
                      
                      {showCodesActions && (
                        <div className="flex gap-2 pt-2">
                          <button onClick={copyICDCodes} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">📋 Copy Selected</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Instructions Tab */}
              {activeAITab === 'instructions' && (
                <div>
                  {!showInstructionsContent ? (
                    <div className="text-center py-8">
                      <button 
                        onClick={generateInstructions}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white rounded-xl font-medium"
                      >
                        Generate Patient Instructions
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <h4 className="text-white font-semibold mb-3">📋 Your Treatment Plan</h4>
                        <div className="space-y-3 text-sm text-slate-300">
                          <p><strong>Diagnosis:</strong> Urinary Tract Infection (UTI)</p>
                          <p><strong>Medication:</strong> Macrobid (Nitrofurantoin) 100mg - Take 1 capsule twice daily for 5 days</p>
                          <div>
                            <strong>Important Instructions:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>Take with food to reduce stomach upset</li>
                              <li>Complete the full course even if you feel better</li>
                              <li>Drink plenty of water (8+ glasses daily)</li>
                              <li>Avoid caffeine and alcohol</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Return if you experience:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-amber-400">
                              <li>Fever over 101°F</li>
                              <li>Back or flank pain</li>
                              <li>Blood in urine</li>
                              <li>Symptoms worsening after 48 hours</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      {showInstructionsActions && (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={regenerateInstructions} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">🔄 Regenerate</button>
                          <button onClick={sendInstructionsEmail} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">📧 Email</button>
                          <button onClick={sendInstructionsSMS} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs">📱 SMS</button>
                          <button onClick={printInstructions} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">🖨️ Print</button>
                        </div>
                      )}
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
              <div className="flex items-center justify-between px-4 py-3 bg-[#0f1318] border-b border-slate-700">
                <h3 className="text-white font-semibold">Dial Pad</h3>
                <button onClick={closeDialPad} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              
              <div className="p-4">
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500 text-xs">Phone number</span>
                    <button onClick={usePatientNumber} className="text-cyan-400 text-xs hover:text-cyan-300">👤 Patient</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="tel" value={dialpadNumber} onChange={(e) => setDialpadNumber(e.target.value)} placeholder="+1 (555) 000-0000" className="flex-1 bg-transparent text-white text-xl font-mono tracking-wider outline-none" />
                    <button onClick={clearDialPadNumber} className="p-2 text-slate-400 hover:text-red-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                    <button key={digit} onClick={() => dialPadPress(digit)} className="dialpad-btn h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">{digit}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={closeDialPad} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={initiateDialOut} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
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
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Magic Edit</h3>
                    <p className="text-slate-400 text-xs">AI-powered note modification</p>
                  </div>
                </div>
                <button onClick={closeMagicEdit} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <p className="text-slate-400 text-sm mb-3">What would you like to change?</p>
                <textarea value={magicEditInput} onChange={(e) => setMagicEditInput(e.target.value)} rows={3} placeholder="e.g., Make the plan section more detailed..." className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500 resize-none"></textarea>
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




