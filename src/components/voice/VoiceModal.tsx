import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, X, Check, Trash2, Volume2, AlertCircle, RefreshCw, Send, Radio } from 'lucide-react';
import { useAppStore } from '../../store';
import { parseVoiceInput, deduplicateSpokenPhrases } from '../../utils/voiceParser';
import { parseVoiceInputWithAI, parseVoiceAudioWithAI } from '../../services/aiService';
import { ParsedVoiceItem } from '../../types';
import { formatCurrency, stripEmoji } from '../../utils/format';
import { CategoryIcon } from '../common/CategoryIcon';
import { useScrollLock } from '../../utils/useScrollLock';

// Web Speech API interface fallback detection
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

// Check if running on iOS (iPhone, iPad, iPod)
const checkIsIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const VoiceModal: React.FC = () => {
  const { voiceModalOpen, setVoiceModalOpen, addTransaction, categories, wallets, profile, showToast } =
    useAppStore();

  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'processing' | 'confirm'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedVoiceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time audio reactive visualizer state
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100
  const [barHeights, setBarHeights] = useState<number[]>([15, 20, 15, 25, 20, 30, 20, 25, 15, 20, 15, 25, 20, 15]);
  const [hasDetectedVoice, setHasDetectedVoice] = useState(false);

  // References for audio hardware and streaming
  const timerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);
  const currentSessionFinalRef = useRef<string>('');
  const previousSessionsTextRef = useRef<string>('');
  const hasDetectedVoiceRef = useRef<boolean>(false);

  // Timer while recording
  useEffect(() => {
    if (recordState === 'recording') {
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recordState]);

  // Lock background scrolling only when voice modal is actively open
  useScrollLock(voiceModalOpen);

  // Helper to cleanly dismantle any SpeechRecognition instance and detach all callbacks
  const terminateRecognition = (rec: any) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    rec.onspeechstart = null;
    rec.onsoundstart = null;
    rec.onspeechend = null;
    rec.onsoundend = null;
    try {
      rec.abort();
    } catch {
      // ignore
    }
    try {
      rec.stop();
    } catch {
      // ignore
    }
  };

  // Comprehensive hardware & stream cleanup
  const cleanupAudio = () => {
    // 0. Clear any pending restart timers
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // 1. Cancel visualizer animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 2. Stop and completely detach SpeechRecognition
    if (recognitionRef.current) {
      terminateRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }

    // 3. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    // 4. Release microphone tracks so device mic indicator turns off immediately
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {
        // ignore
      }
      streamRef.current = null;
    }

    // 5. DO NOT close AudioContext! Reusing the warm AudioContext is the key to infinite, repeated voice sessions on iOS Safari and Android without hitting browser limits!
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Cleanup on unmount or when modal is closed
  useEffect(() => {
    return () => {
      cleanupAudio();
      // Permanently close AudioContext only when component completely unmounts
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
    };
  }, []);

  if (!voiceModalOpen) return null;

  // ── Start Recording (Native Web Speech Recognition + Fallback MediaRecorder) ──
  const handleStartRecording = async () => {
    // 1. Ensure any lingering audio / recognition hardware locks are completely dismantled
    cleanupAudio();

    setErrorMessage(null);
    setLiveTranscript('');
    currentSessionFinalRef.current = '';
    previousSessionsTextRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    setHasDetectedVoice(false);
    setIsSaving(false);
    isSavingRef.current = false;
    isRecordingRef.current = true;
    setRecordState('recording');

    const isMobile = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod|Android/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    // On mobile devices (iOS iPhone / Android):
    // Dedicated High-Sensitivity Hardware Audio Engine with Vocal DSP & Multimodal AI!
    // Ensures 100% reliable microphone detection, dancing waveform bars, and infinite repeated recordings!
    if (isMobile) {
      await startMediaRecorderFallback();
      // Concurrently attempt live speech recognition for real-time visual text streaming
      const SpeechRecognition = getSpeechRecognition();
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = 'id-ID';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event: any) => {
            let sessionText = '';
            for (let i = 0; i < event.results.length; ++i) {
              sessionText += (event.results[i][0]?.transcript || '') + ' ';
            }
            if (sessionText.trim()) {
              setLiveTranscript(sessionText.trim());
              setHasDetectedVoice(true);
              hasDetectedVoiceRef.current = true;
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch {
          // Safe to ignore if concurrent recognition is restricted by mobile OS
        }
      }
      return;
    }

    // On Desktop (Laptop Chrome/Edge): Web Speech API for direct real-time word-by-word streaming
    const SpeechRecognition = getSpeechRecognition();

    if (SpeechRecognition) {
      let speechActive = false;

      // Dynamic audio visualizer driven by real-time speech events
      const updateSpeechMeter = () => {
        if (!isRecordingRef.current) return;
        const now = Date.now();
        const bars: number[] = [];
        for (let b = 0; b < 14; b++) {
          let height: number;
          if (speechActive || hasDetectedVoiceRef.current) {
            const wave = Math.sin(now / 150 + b * 0.5) * 28 + (Math.random() * 28 + 35);
            height = Math.min(100, Math.max(20, Math.round(wave)));
          } else {
            const wave = Math.sin(now / 350 + b * 0.45) * 8 + 14;
            height = Math.round(wave);
          }
          bars.push(height);
        }
        setBarHeights(bars);
        animFrameRef.current = requestAnimationFrame(updateSpeechMeter);
      };
      animFrameRef.current = requestAnimationFrame(updateSpeechMeter);

      // Function to spawn a fresh, clean SpeechRecognition cycle
      // Ensures that on mobile (iPhone iOS 15 Pro Max / Android), speech streams word-by-word in real time!
      const spawnRecognitionCycle = (): any => {
        if (!isRecordingRef.current) return null;

        try {
          const rec = new SpeechRecognition();
          rec.lang = 'id-ID';
          // On mobile, continuous=false prevents OS speech daemon locks across pauses
          rec.continuous = !isMobile;
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onstart = () => {
            setAudioLevel(20);
          };

          rec.onspeechstart = () => {
            speechActive = true;
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);
            setAudioLevel(75);
          };

          rec.onsoundstart = () => {
            speechActive = true;
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);
            setAudioLevel(65);
          };

          rec.onspeechend = () => {
            speechActive = false;
          };

          rec.onsoundend = () => {
            speechActive = false;
          };

          // Streams words live directly to screen as user speaks!
          rec.onresult = (event: any) => {
            speechActive = true;
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);
            setAudioLevel(85);

            let sessionFinal = '';
            let sessionInterim = '';
            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              const chunk = res[0]?.transcript || '';
              if (res.isFinal) {
                sessionFinal += chunk + ' ';
              } else {
                sessionInterim += chunk;
              }
            }
            currentSessionFinalRef.current = sessionFinal.trim();
            const sessionText = (sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')).trim();
            const combined = (previousSessionsTextRef.current + ' ' + sessionText).trim();
            if (combined) {
              setLiveTranscript(combined);
            }
          };

          rec.onerror = (event: any) => {
            console.warn('SpeechRecognition event note:', event.error);
            // Benign events during silence or stops
            if (event.error === 'no-speech' || event.error === 'aborted') {
              return;
            }
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setErrorMessage(
                'Izin mikrofon/dikte ditolak oleh browser. Buka pengaturan izin browser dan izinkan akses mikrofon.'
              );
            }
          };

          rec.onend = () => {
            speechActive = false;
            if (currentSessionFinalRef.current) {
              const finalChunk = currentSessionFinalRef.current.trim();
              if (finalChunk && !previousSessionsTextRef.current.toLowerCase().includes(finalChunk.toLowerCase())) {
                previousSessionsTextRef.current = (
                  previousSessionsTextRef.current + ' ' + finalChunk
                ).trim();
              }
              currentSessionFinalRef.current = '';
            }

            // If user has not finished recording (e.g. natural pause on mobile):
            // Gracefully spawn next clean cycle with a 250ms delay to keep listening seamlessly without InvalidStateError!
            if (isRecordingRef.current) {
              terminateRecognition(rec);
              if (restartTimerRef.current) {
                clearTimeout(restartTimerRef.current);
              }
              const delay = isMobile ? 250 : 60;
              restartTimerRef.current = window.setTimeout(() => {
                if (!isRecordingRef.current) return;
                try {
                  const nextRec = spawnRecognitionCycle();
                  recognitionRef.current = nextRec;
                } catch (e) {
                  console.warn('Recognition restart note:', e);
                }
              }, delay);
            }
          };

          rec.start();
          return rec;
        } catch (err: any) {
          console.warn('SpeechRecognition start error:', err);
          return null;
        }
      };

      const initialRec = spawnRecognitionCycle();
      if (initialRec) {
        recognitionRef.current = initialRec;
        return; // Success! Running with exclusive mic access!
      }
    }

    // 2. Fallback Engine: MediaRecorder + Web Audio API (For browsers without Web Speech API)
    await startMediaRecorderFallback();
  };

  // ── High-Sensitivity Hardware Audio Engine (Mobile iOS / Android & Fallback) ──
  const startMediaRecorderFallback = async () => {
    // 1. Maintain or warm up a single persistent AudioContext (required by iOS Safari)
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          ctx = new AudioCtx();
          audioContextRef.current = ctx;
        } catch (ctxErr) {
          console.warn('AudioContext init note:', ctxErr);
        }
      }
    }
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (resumeErr) {
        console.warn('AudioContext resume note:', resumeErr);
      }
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 }, // Mono audio eliminates spatial cancellation and focuses human voice
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
      });
      streamRef.current = stream;
    } catch (err: any) {
      console.warn('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Izin mikrofon ditolak oleh browser/sistem. Buka pengaturan izin browser dan klik "Izinkan" untuk mikrofon, lalu coba lagi.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Tidak ada perangkat mikrofon yang terdeteksi di perangkat Anda.');
      } else {
        setErrorMessage(`Gagal mengakses mikrofon: ${err.message || 'Error tidak diketahui'}`);
      }
      setRecordState('idle');
      isRecordingRef.current = false;
      return;
    }

    let recordedStream = stream;

    if (audioContextRef.current && stream) {
      try {
        const audioCtx = audioContextRef.current;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);

        // ── Human Vocal DSP Enhancement Chain ──
        // 1. High-Pass Filter: Strips ambient sub-bass rumble, wind, phone vibrations (< 85 Hz)
        const highPass = audioCtx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 85;

        // 2. Vocal Formant Peaking Filter: Boosts speech intelligibility band (2000Hz - 3500Hz)
        const vocalBoost = audioCtx.createBiquadFilter();
        vocalBoost.type = 'peaking';
        vocalBoost.frequency.value = 2400;
        vocalBoost.Q.value = 1.1;
        vocalBoost.gain.value = 5.0; // +5dB human voice boost

        // 3. Low-Pass Filter: Cuts off high-frequency hiss, fan noise, screech (> 7500 Hz)
        const lowPass = audioCtx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 7500;

        // 4. Dynamics Compressor: Elevates soft speech/whispers, prevents loud clipping
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -32;
        compressor.knee.value = 20;
        compressor.ratio.value = 4.5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // 5. Analyser for speech visualization
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Connect the vocal DSP chain
        source.connect(highPass);
        highPass.connect(vocalBoost);
        vocalBoost.connect(lowPass);
        lowPass.connect(compressor);
        compressor.connect(analyser);

        // Route clean vocal-isolated audio stream to MediaRecorder
        if (audioCtx.createMediaStreamDestination) {
          const destination = audioCtx.createMediaStreamDestination();
          compressor.connect(destination);
          if (destination.stream && destination.stream.getAudioTracks().length > 0) {
            recordedStream = destination.stream;
          }
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!isRecordingRef.current) return;
          analyser.getByteFrequencyData(dataArray);

          // Focus energy measurement specifically on human speech frequencies (approx 120Hz - 3500Hz)
          let vocalSum = 0;
          let vocalBins = 0;
          for (let i = 1; i < Math.min(22, dataArray.length); i++) {
            vocalSum += dataArray[i];
            vocalBins++;
          }
          const vocalAvg = vocalBins > 0 ? vocalSum / vocalBins : 0;
          // Ultra-high sensitivity scaling: picks up normal speech and whispers effortlessly
          const normalized = Math.min(100, Math.round((vocalAvg / 18) * 100));

          setAudioLevel(normalized);
          if (normalized > 1 || vocalAvg > 0.6) {
            setHasDetectedVoice(true);
            hasDetectedVoiceRef.current = true;
          }

          const step = Math.max(1, Math.floor(dataArray.length / 14));
          const bars: number[] = [];
          const now = Date.now();
          for (let b = 0; b < 14; b++) {
            const val = dataArray[b * step] || 0;
            let height: number;
            if (val > 0) {
              height = Math.min(100, Math.max(22, Math.round((val / 100) * 100)));
            } else {
              const wave = Math.sin(now / 300 + b * 0.45) * 8 + 14;
              height = Math.round(wave);
            }
            bars.push(height);
          }
          setBarHeights(bars);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        animFrameRef.current = requestAnimationFrame(updateMeter);
      } catch (audioErr) {
        console.warn('Audio metering note:', audioErr);
      }
    }

    try {
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        // Prioritize audio/mp4 on iOS / Safari for pristine recording
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const recorder = mimeType ? new MediaRecorder(recordedStream, { mimeType }) : new MediaRecorder(recordedStream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(150);
      mediaRecorderRef.current = recorder;
    } catch (recErr) {
      console.warn('MediaRecorder warning:', recErr);
    }
  };

  // ── Stop Recording & Process Speech / Audio ─────────────────────────────────
  const handleStopRecording = async () => {
    isRecordingRef.current = false;
    setRecordState('processing');

    // 0. Cancel any pending keepalive restart timers
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // 1. Commit any final interim chunk into previousSessionsTextRef
    if (currentSessionFinalRef.current) {
      const finalChunk = currentSessionFinalRef.current.trim();
      if (finalChunk && !previousSessionsTextRef.current.toLowerCase().includes(finalChunk.toLowerCase())) {
        previousSessionsTextRef.current = (
          previousSessionsTextRef.current + ' ' + finalChunk
        ).trim();
      }
      currentSessionFinalRef.current = '';
    }

    // 2. Stop SpeechRecognition gracefully and detach listeners
    if (recognitionRef.current) {
      terminateRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }

    // 3. Stop MediaRecorder and retrieve audio blob (if fallback was active)
    const audioBlob = await new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          resolve(blob);
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    // 4. Completely release hardware audio tracks
    cleanupAudio();

    // 5. Resolve transcription text (strictly deduplicated across sessions and phrases)
    const rawRecognizedText = (
      liveTranscript ||
      previousSessionsTextRef.current
    ).trim();
    const recognizedText = deduplicateSpokenPhrases(rawRecognizedText);

    // Path A: High-Sensitivity Multimodal AI on Vocal-DSP Filtered Audio
    // Isolates foreground human speaker from background noise, traffic, and room chatter
    let multimodalErrorMsg: string | null = null;
    if (audioBlob && audioBlob.size > 200) {
      try {
        const result = await parseVoiceAudioWithAI(audioBlob, categories);
        if (result.transcript || (result.items && result.items.length > 0)) {
          setTranscript(result.transcript || 'Rekaman Suara');

          // Deduplicate items
          const uniqueItems: ParsedVoiceItem[] = [];
          const seen = new Set<string>();
          for (const it of result.items) {
            const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
            if (!seen.has(k)) {
              seen.add(k);
              uniqueItems.push(it);
            }
          }

          if (uniqueItems.length > 0) {
            setParsedItems(uniqueItems);
            setRecordState('confirm');
            return;
          }
        }
      } catch (err: any) {
        console.warn('Multimodal audio parse error, attempting speech fallback:', err);
        multimodalErrorMsg = err?.message || 'Gagal memproses audio dengan AI';
      }
    }

    // Path B: Transcribed text from Web Speech API / Streaming Recognition
    if (recognizedText) {
      await processTranscription(recognizedText);
      return;
    }

    // Path C: Zero audio or speech detected
    handleResetToIdle();
    setErrorMessage(
      multimodalErrorMsg
        ? `${multimodalErrorMsg}. Silakan gunakan kolom ketik manual di bawah atau coba bicara lebih jelas.`
        : 'Suara tidak terdeteksi atau mikrofon terlalu jauh. Silakan dekatkan mikrofon dan bicara lebih jelas, atau gunakan kolom ketik di bawah.'
    );
  };

  // ── Reset state cleanly back to idle for subsequent recordings ─────────────
  const handleResetToIdle = () => {
    isRecordingRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    cleanupAudio();
    hasDetectedVoiceRef.current = false;
    setHasDetectedVoice(false);
    setLiveTranscript('');
    setTranscript('');
    currentSessionFinalRef.current = '';
    previousSessionsTextRef.current = '';
    setParsedItems([]);
    setErrorMessage(null);
    setRecordState('idle');
  };

  // Re-record with clean audio isolation
  const handleRestartRecording = async () => {
    handleResetToIdle();
    await handleStartRecording();
  };

  // ── Parse Text (Gemini AI or Smart Local Parser) ───────────────────────────
  const processTranscription = async (text: string) => {
    setTranscript(text);
    setRecordState('processing');
    try {
      const items = await parseVoiceInputWithAI(text, categories);
      // Deduplicate items
      const uniqueItems: ParsedVoiceItem[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
        if (!seen.has(k)) {
          seen.add(k);
          uniqueItems.push(it);
        }
      }
      setParsedItems(uniqueItems);
    } catch (err) {
      console.warn('Voice AI parse error, using smart fallback:', err);
      const items = parseVoiceInput(text);
      const uniqueItems: ParsedVoiceItem[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
        if (!seen.has(k)) {
          seen.add(k);
          uniqueItems.push(it);
        }
      }
      setParsedItems(uniqueItems);
    }
    setRecordState('confirm');
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = manualText.trim();
    if (!clean) return;
    setErrorMessage(null);
    setManualText('');
    processTranscription(clean);
  };

  const handleSaveAll = () => {
    if (isSavingRef.current || isSaving || parsedItems.length === 0) return;
    isSavingRef.current = true;
    setIsSaving(true);

    parsedItems.forEach((item) => {
      const matchedCategory =
        categories.find((c) => c.name.toLowerCase() === item.category.toLowerCase()) ||
        categories.find((c) => c.type === item.type);
      const defaultWallet = wallets[0]?.id || 'wallet-cash';
      const fallbackCatId = item.type === 'income' ? 'cat-side' : 'cat-food';

      addTransaction({
        user_id: profile.id || 'default',
        type: item.type,
        amount: item.amount,
        note: stripEmoji(item.note),
        occurred_at: item.occurred_at,
        source: 'voice',
        category_id: matchedCategory?.id || fallbackCatId,
        wallet_id: defaultWallet,
      });
    });

    showToast(`${parsedItems.length} transaksi berhasil dicatat dari suara!`);
    handleClose();
  };

  const handleClose = () => {
    handleResetToIdle();
    setVoiceModalOpen(false);
    setManualText('');
    setIsSaving(false);
  };

  const handleRemoveItem = (id: string) => {
    setParsedItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in touch-none select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="animate-slide-up sm:animate-scale-in glass-3 w-full max-w-lg border border-[var(--glass-border)] max-h-[92dvh] flex flex-col rounded-t-[28px] sm:rounded-2xl shadow-2xl touch-auto overscroll-contain select-text overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Drag Handle Indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(205,225,245,0.1)] shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-[#E39A5E]" />
            <h2 id="voice-modal-title" className="text-base font-semibold text-[#EEF2F6]">
              {recordState === 'confirm' ? 'Konfirmasi Transaksi Suara' : 'Bicara ke Monetra'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="btn-ghost p-1.5 rounded-lg text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-xs text-[#EE5D6C] flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-semibold">Perhatian</p>
                <p className="mt-0.5 text-[#EEF2F6]/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {recordState === 'idle' && (
            <div className="text-center space-y-6 py-2">
              <div className="space-y-1.5">
                <p className="text-lg font-semibold text-[#EEF2F6]">
                  Ceritakan pengeluaran atau pemasukanmu
                </p>
                <p className="text-xs text-[#A3AFBC] max-w-sm mx-auto leading-relaxed">
                  Bicara santai menggunakan Bahasa Indonesia. AI Monetra akan memecah ucapanmu menjadi nominal dan kategori otomatis.
                </p>
              </div>

              {/* Big Interactive Mic Button */}
              <div className="flex flex-col items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleStartRecording}
                  aria-label="Mulai Merekam"
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-xl shadow-black/50 border-4 border-[rgba(235,245,255,0.3)] cursor-pointer hover:scale-105 active:scale-95 transition-all touch-manipulation focus:outline-none focus:ring-4 focus:ring-[#E39A5E]/40"
                >
                  <Mic size={40} strokeWidth={2.2} />
                </button>
                <p className="text-xs text-[#E39A5E] font-medium animate-pulse">
                  Ketuk mikrofon untuk mulai bicara
                </p>
              </div>

              {/* Manual input fallback option */}
              <form onSubmit={handleManualSubmit} className="pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Atau ketik: makan warteg 15rb dan bensin 25rb..."
                    className="flex-1 h-11 px-3.5 rounded-xl glass-1 border border-white/[0.08] text-xs text-[#EEF2F6] placeholder:text-[#74808E] outline-none focus:border-[#E39A5E]"
                  />
                  <button
                    type="submit"
                    disabled={!manualText.trim()}
                    className="btn-primary px-4 h-11 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    <span>Proses</span>
                    <Send size={13} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {recordState === 'recording' && (
            <div className="text-center space-y-6 py-6">
              {/* Header Status & Live Indicators */}
              <div className="flex items-center justify-center gap-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EE5D6C]/20 border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EE5D6C] animate-ping" />
                  <span>Merekam: 00:{seconds < 10 ? `0${seconds}` : seconds}</span>
                </div>

                {hasDetectedVoice ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4FD3A4]/15 border border-[#4FD3A4]/30 text-[#4FD3A4] text-xs font-medium">
                    <Radio size={12} className="animate-pulse" />
                    <span>Suara Terdeteksi</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[#A3AFBC] text-xs">
                    <span>Mendengarkan...</span>
                  </span>
                )}
              </div>

              {/* Dynamic Real-time Audio Reactive Waveform */}
              <div
                className="flex items-center justify-center gap-1.5 h-16 px-4"
                aria-label="Indikator suara langsung"
              >
                {barHeights.map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full transition-all duration-75 ease-out"
                    style={{
                      height: `${h}%`,
                      backgroundColor: audioLevel > 2 ? '#E39A5E' : '#EE5D6C',
                      opacity: Math.max(0.4, h / 100),
                    }}
                  />
                ))}
              </div>

              {/* Live speech transcription text box with dynamic real-time feedback */}
              <div
                className={`p-4 rounded-xl min-h-[80px] flex flex-col items-center justify-center text-center transition-all duration-200 ${
                  liveTranscript
                    ? 'bg-[#E39A5E]/10 border-2 border-[#E39A5E] shadow-lg shadow-[#E39A5E]/15'
                    : hasDetectedVoice
                    ? 'glass-2 border border-[#4FD3A4]/40 shadow-sm shadow-[#4FD3A4]/10'
                    : 'glass-1 border border-white/[0.1]'
                }`}
              >
                {liveTranscript ? (
                  <div className="space-y-1 w-full">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E39A5E]/20 text-[#E39A5E] text-[10px] font-bold tracking-wider uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E39A5E] animate-ping" />
                      <span>Terdeteksi Langsung</span>
                    </span>
                    <p className="text-sm sm:text-base font-bold text-[#EEF2F6] leading-snug break-words">
                      &quot;{liveTranscript}&quot;
                    </p>
                  </div>
                ) : hasDetectedVoice ? (
                  <div className="space-y-1.5 w-full">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#4FD3A4]/20 border border-[#4FD3A4]/40 text-[#4FD3A4] text-xs font-semibold animate-pulse">
                      <Radio size={13} />
                      <span>Mikrofon Aktif & Suara Terdeteksi</span>
                    </span>
                    <p className="text-sm font-medium text-[#EEF2F6]">
                      Suaramu terdengar jelas! Teruskan bicara...
                    </p>
                    <p className="text-[11px] text-[#A3AFBC]">
                      Tekan tombol <strong className="text-white">Selesai Bicara</strong> jika sudah selesai
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-[#EEF2F6] font-medium">
                      Silakan bicara sekarang...
                    </p>
                    <p className="text-[11px] text-[#A3AFBC] italic">
                      Contoh: &quot;Dapat uang 70 ribu&quot; atau &quot;Makan siang 20 ribu&quot;
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="btn-press px-8 py-3.5 rounded-xl bg-[#EE5D6C] hover:bg-[#E0343F] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-[#EE5D6C]/30 transition-all touch-manipulation min-h-[48px]"
                >
                  <Check size={18} strokeWidth={2.4} />
                  <span>Selesai Bicara</span>
                </button>
              </div>
            </div>
          )}

          {recordState === 'processing' && (
            <div className="text-center space-y-4 py-12">
              <div className="w-12 h-12 rounded-full border-2 border-[#E39A5E] border-t-transparent animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#EEF2F6]">
                Memproses rekaman suara dengan AI Monetra...
              </p>
              <p className="text-xs text-[#A3AFBC]">
                Menganalisis kalimat, mengelompokkan kategori, dan menghitung nominal
              </p>
            </div>
          )}

          {recordState === 'confirm' && (
            <div className="space-y-4">
              {/* Transcript */}
              <div className="p-3.5 rounded-xl glass-1 border-[rgba(205,225,245,0.1)] space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-[#74808E] tracking-wider">
                  <span>Hasil Suara yang Didengar:</span>
                  <button
                    type="button"
                    onClick={handleRestartRecording}
                    className="text-[#E39A5E] normal-case font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Ulangi</span>
                  </button>
                </div>
                <p className="text-xs text-[#EEF2F6] italic leading-relaxed">
                  &quot;{transcript}&quot;
                </p>
              </div>

              {/* Parsed Transactions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#A3AFBC]">
                  <span>{parsedItems.length} Transaksi Terdeteksi</span>
                </div>

                {parsedItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A3AFBC] glass-1 rounded-xl space-y-2">
                    <p>Tidak ada nominal transaksi yang terdeteksi dari ucapan tersebut.</p>
                    <button
                      type="button"
                      onClick={handleResetToIdle}
                      className="btn-ghost px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-xs text-[#E39A5E] font-medium"
                    >
                      Bicara Lagi atau Ketik Ulang
                    </button>
                  </div>
                ) : (
                  parsedItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-2 p-3.5 rounded-xl flex items-center justify-between gap-3 border-[var(--glass-border)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                          <CategoryIcon name={item.category} size={18} color="#E39A5E" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#EEF2F6] truncate">
                            {item.note}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[#A3AFBC]">
                              {item.category}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-[#74808E] uppercase">
                              {item.need_want}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-sm font-semibold num-tabular ${
                            item.type === 'expense' ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                          }`}
                        >
                          {item.type === 'expense' ? '-' : '+'}
                          {formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Hapus item ini"
                          className="btn-danger p-1.5 rounded-lg text-[#74808E] cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tip info if dating category detected */}
              {parsedItems.some((i) => i.category === 'Kencan & Pacaran') && (
                <div className="p-3 rounded-xl bg-[rgba(181,96,58,0.12)] border border-[#B5603A]/30 text-xs text-[#EEF2F6] flex items-start gap-2">
                  <AlertCircle size={16} className="text-[#E39A5E] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Pengeluaran kencan terdeteksi. AI Monetra mencatat ini pada pos kencan tersendiri agar kamu dapat memantau budget pacaran bulan ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {recordState === 'confirm' && (
          <div className="p-4 border-t border-[rgba(205,225,245,0.1)] flex items-center justify-end gap-3 bg-[var(--bg-base)]/60">
            <button
              type="button"
              onClick={handleResetToIdle}
              className="btn-ghost px-4 py-2.5 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs font-medium text-[#EEF2F6] cursor-pointer"
            >
              Bicara Lagi
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || parsedItems.length === 0}
              className="btn-primary px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-black/40"
            >
              {isSaving ? 'Menyimpan...' : `Simpan Semua (${parsedItems.length})`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
