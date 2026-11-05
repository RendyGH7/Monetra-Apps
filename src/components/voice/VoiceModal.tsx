import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  X,
  Check,
  Trash2,
  Volume2,
  AlertCircle,
  RefreshCw,
  Send,
  Radio,
  Keyboard,
} from 'lucide-react';
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
  const [showManualInput, setShowManualInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedVoiceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time audio reactive visualizer state (36-bar acoustic frequency waveform)
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: 36 }, (_, i) => {
      const envelope = Math.sin(((i + 1) / 37) * Math.PI);
      return Math.max(8, Math.round(envelope * 22));
    })
  );
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

  // ── Start Recording (Native Web Speech Recognition + Hardware Audio Engine) ──
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

    // 1. Start High-Sensitivity Hardware Audio Engine with Vocal DSP & AnalyserNode
    // Operates on BOTH Desktop and Mobile so the acoustic soundwave reacts dynamically in real-time to vocal input!
    await startMediaRecorderFallback();

    // 2. Concurrently spawn Web Speech Recognition for live real-time text streaming
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      // Function to spawn a fresh, clean SpeechRecognition cycle
      // Ensures real-time word-by-word streaming without interfering with the hardware audio analyser
      const spawnRecognitionCycle = (): any => {
        if (!isRecordingRef.current) return null;

        try {
          const rec = new SpeechRecognition();
          rec.lang = 'id-ID';
          // On mobile, continuous=false prevents OS speech daemon locks across pauses
          rec.continuous = !isMobile;
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onstart = () => {};

          rec.onspeechstart = () => {
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);
          };

          rec.onsoundstart = () => {
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);
          };

          rec.onspeechend = () => {};
          rec.onsoundend = () => {};

          // Streams words live directly to screen as user speaks!
          rec.onresult = (event: any) => {
            hasDetectedVoiceRef.current = true;
            setHasDetectedVoice(true);

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
            if (currentSessionFinalRef.current) {
              const finalChunk = currentSessionFinalRef.current.trim();
              if (finalChunk && !previousSessionsTextRef.current.toLowerCase().includes(finalChunk.toLowerCase())) {
                previousSessionsTextRef.current = (
                  previousSessionsTextRef.current + ' ' + finalChunk
                ).trim();
              }
              currentSessionFinalRef.current = '';
            }

            // If user has not finished recording:
            // Gracefully spawn next clean cycle with a delay to keep listening seamlessly without InvalidStateError!
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
      }
    }
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

        // ── Human Vocal DSP Enhancement Chain (Ultra-High Sensitivity) ──
        // 1. High-Pass Filter: Strips ambient sub-bass rumble, wind, phone vibrations (< 70 Hz)
        const highPass = audioCtx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 70;

        // 2. Vocal Formant Peaking Filter: Boosts speech intelligibility band (1800Hz - 3400Hz) by +7.5dB
        const vocalBoost = audioCtx.createBiquadFilter();
        vocalBoost.type = 'peaking';
        vocalBoost.frequency.value = 2200;
        vocalBoost.Q.value = 1.0;
        vocalBoost.gain.value = 7.5; // +7.5dB human voice boost for high sensitivity

        // 3. Low-Pass Filter: Cuts off high-frequency hiss, fan noise, screech (> 7500 Hz)
        const lowPass = audioCtx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 7500;

        // 4. Dynamics Compressor: Elevates soft speech & whispers to high clarity
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -38;
        compressor.knee.value = 25;
        compressor.ratio.value = 6.0;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.2;

        // 5. Analyser for speech visualization
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.65;
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

          // Focus energy measurement specifically on human speech frequencies (approx 150Hz - 3800Hz, bins 1 to 16)
          let vocalSum = 0;
          let vocalBins = 0;
          for (let i = 1; i <= 16; i++) {
            vocalSum += dataArray[i];
            vocalBins++;
          }
          const vocalAvg = vocalBins > 0 ? vocalSum / vocalBins : 0;
          // Ultra-high sensitivity scaling: picks up normal speech and whispers effortlessly
          const normalized = Math.min(100, Math.round((vocalAvg / 50) * 100));

          setAudioLevel(normalized);

          // Dynamic speaking state: truly dynamic per frame so bars dance with every word & rest on pause
          const isSpeakingNow = vocalAvg > 4.0;
          if (isSpeakingNow) {
            setHasDetectedVoice(true);
            hasDetectedVoiceRef.current = true;
          }

          const totalBars = 36;
          const bars: number[] = [];
          const now = Date.now();
          const vocalEnergy = Math.min(1.0, Math.max(0, (vocalAvg - 3.5) / 55));

          for (let b = 0; b < totalBars; b++) {
            // Symmetrical sinusoidal envelope (0 at tips, 1.0 at center)
            const envelope = Math.sin(((b + 1) / (totalBars + 1)) * Math.PI);
            // Distance from center (0 at middle, 1 at ends)
            const distFromCenter = Math.abs(b - 17.5) / 17.5;

            let height: number;
            if (isSpeakingNow) {
              // Map frequency bins symmetrically from center outward
              const binIndex = Math.min(26, Math.max(1, Math.round(2 + (1 - distFromCenter) * 14 + ((b % 2) * 2))));
              const binAmp = (dataArray[binIndex] || 0) / 255;

              // Combined vocal amplitude: responsive to frequency harmonics + overall vocal power
              const vocalFactor = binAmp * 0.65 + vocalEnergy * 0.35;
              // Organic micro-wave motion for fluid living aesthetics
              const shimmer = Math.sin(now / 90 + b * 0.5) * 5;

              // Height jumps dynamically with speech, shaped by the luxury symmetrical envelope
              const dynamicHeight = 12 + (vocalFactor * 78 + shimmer) * envelope;
              // Constrained between 8% and 92% (NEVER plateaus at a flat 100% block)
              height = Math.max(8, Math.min(92, Math.round(dynamicHeight)));
            } else {
              // Calm resting wave during silence or natural breath pauses between sentences
              const idlePulse = Math.sin(now / 350 + b * 0.35) * 6 + 10;
              height = Math.max(6, Math.min(22, Math.round(idlePulse * envelope)));
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

    // ── FAST-TRACK PATH: Real-Time Web Speech Recognition (0 second wait!) ──
    // If the browser already captured the words in real-time, process immediately without uploading raw audio!
    if (recognizedText && recognizedText.length >= 2) {
      await processTranscription(recognizedText);
      return;
    }

    // ── FALLBACK PATH: Multimodal AI Audio Parsing ──
    // Only used if browser real-time speech didn't catch text (e.g. mobile Safari)
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

    // Zero audio or speech detected
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

  // ── Fast-Track Parse Text (Instant Local + Rapid AI Race) ───────────────────
  const processTranscription = async (text: string) => {
    setTranscript(text);
    setRecordState('processing');

    // 1. Instant local NLP parsing (0ms execution)
    const localItems = parseVoiceInput(text);

    try {
      // 2. Race Gemini Flash-Lite with a tight 2200ms timeout
      const aiPromise = parseVoiceInputWithAI(text, categories);
      const timeoutPromise = new Promise<ParsedVoiceItem[]>((_, reject) =>
        setTimeout(() => reject(new Error('AI parsing timeout')), localItems.length > 0 ? 2200 : 4000)
      );

      const items = await Promise.race([aiPromise, timeoutPromise]);
      const finalItems = items && items.length > 0 ? items : localItems;

      const uniqueItems: ParsedVoiceItem[] = [];
      const seen = new Set<string>();
      for (const it of finalItems) {
        const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
        if (!seen.has(k)) {
          seen.add(k);
          uniqueItems.push(it);
        }
      }
      setParsedItems(uniqueItems);
    } catch {
      // Fast fallback to instant local extraction
      const uniqueItems: ParsedVoiceItem[] = [];
      const seen = new Set<string>();
      for (const it of localItems) {
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
      className="fixed inset-0 z-[120] w-screen h-dvh bg-[#070A0F] text-[#EEF2F6] flex flex-col justify-between overflow-hidden animate-fade-in select-none"
    >
      {/* Luxury Atmospheric Background Ambient Glow (Inspired by Reference Visual) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Warm Ember-Copper Radial Glow from Top/Center */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] sm:w-[1100px] h-[550px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(227,154,94,0.26)_0%,rgba(207,129,67,0.12)_45%,transparent_75%)] blur-3xl pointer-events-none" />
        {/* Subtle Base Ember Reflection */}
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[450px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(227,154,94,0.1)_0%,transparent_70%)] blur-3xl pointer-events-none" />
      </div>

      {/* Top Header Bar */}
      <div className="relative z-20 w-full pt-[max(var(--safe-top),1rem)] px-5 sm:px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E39A5E]/20 to-[#CF8143]/10 border border-[#E39A5E]/40 p-1 flex items-center justify-center shadow-md shadow-[#E39A5E]/20">
            <img src="/finai-mascot.png" alt="Monetra" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <div>
            <h1 id="voice-modal-title" className="font-display font-bold text-sm sm:text-base tracking-tight text-[#EEF2F6] leading-none">
              Monetra
            </h1>
            <span className="text-[10px] text-[#E39A5E] font-medium tracking-wider uppercase mt-0.5 block">
              {recordState === 'recording'
                ? hasDetectedVoice
                  ? 'Suara Terdeteksi · DSP Aktif'
                  : 'Mendengarkan...'
                : recordState === 'processing'
                ? 'AI Processing'
                : recordState === 'confirm'
                ? 'Konfirmasi Transaksi'
                : 'Voice Intelligence'}
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full glass-2 border border-white/[0.12] hover:border-[#E39A5E]/50 text-[#A3AFBC] hover:text-[#EEF2F6] flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md"
          aria-label="Tutup Voice AI"
          title="Tutup (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      {/* Middle Interactive Zone */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-2 overflow-y-auto custom-scrollbar">
        {/* Error Banner if any */}
        {errorMessage && (
          <div className="w-full max-w-lg mb-2 p-3.5 rounded-xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-xs text-[#EE5D6C] flex items-start gap-2.5 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <p className="font-semibold">Perhatian</p>
              <p className="mt-0.5 text-[#EEF2F6]/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Central Audio Soundwave ("Asset Nada Suara") - Stays prominent across recording, idle & processing */}
        {recordState !== 'confirm' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
            {/* Visualizer Wave Bars */}
            <div
              className="w-full max-w-sm sm:max-w-lg md:max-w-2xl flex items-center justify-center gap-[3px] sm:gap-[4px] md:gap-[6px] h-24 sm:h-32 md:h-40 px-2"
              aria-label="Visualisasi nada suara pengguna"
            >
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 sm:w-2 md:w-2.5 rounded-full transition-all duration-75 ease-out"
                  style={{
                    height: `${Math.max(6, Math.min(100, h))}%`,
                    background:
                      recordState === 'recording' && (hasDetectedVoice || audioLevel > 5)
                        ? 'linear-gradient(180deg, #FFE0B2 0%, #E39A5E 45%, #CF8143 100%)'
                        : recordState === 'recording'
                        ? 'linear-gradient(180deg, #E39A5E 0%, #B5603A 100%)'
                        : recordState === 'processing'
                        ? 'linear-gradient(180deg, #4FD3A4 0%, #20A577 100%)'
                        : 'linear-gradient(180deg, rgba(227,154,94,0.7) 0%, rgba(207,129,67,0.3) 100%)',
                    boxShadow:
                      recordState === 'recording' && (hasDetectedVoice || audioLevel > 5)
                        ? '0 0 16px rgba(227, 154, 94, 0.75), 0 0 4px rgba(255, 224, 178, 0.9)'
                        : '0 0 8px rgba(227, 154, 94, 0.3)',
                    opacity: Math.max(0.35, h / 100),
                  }}
                />
              ))}
            </div>

            {/* Live Status Indicators under the soundwave */}
            <div className="mt-4 flex items-center gap-2">
              {recordState === 'recording' && (
                <>
                  <span className="px-3 py-1 rounded-full bg-[#EE5D6C]/20 border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#EE5D6C] animate-ping" />
                    <span>00:{seconds < 10 ? `0${seconds}` : seconds}</span>
                  </span>
                  {hasDetectedVoice ? (
                    <span className="px-3 py-1 rounded-full bg-[#4FD3A4]/15 border border-[#4FD3A4]/35 text-[#4FD3A4] text-xs font-semibold flex items-center gap-1.5 animate-pulse shadow-sm">
                      <Radio size={12} />
                      <span>Suara Terdeteksi</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-[#A3AFBC] text-xs font-medium">
                      Mendengarkan...
                    </span>
                  )}
                </>
              )}
              {recordState === 'idle' && (
                <span className="px-3.5 py-1 rounded-full bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] text-xs font-medium tracking-wide">
                  Siap Mendengarkan Suara
                </span>
              )}
            </div>
          </div>
        )}

        {/* Lower Floating Cockpit Card ("Bicara ke Monetra") */}
        <div className="w-full max-w-lg sm:max-w-xl my-auto">
          {recordState === 'idle' && (
            <div className="p-4 sm:p-5 rounded-2xl glass-2 border border-[rgba(205,225,245,0.12)] shadow-xl space-y-2.5 text-left backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#EEF2F6]">Bicara ke Monetra</h3>
                <button
                  type="button"
                  onClick={() => setShowManualInput((prev) => !prev)}
                  className="text-[11px] text-[#A3AFBC] hover:text-[#EEF2F6] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Keyboard size={13} />
                  <span>{showManualInput ? 'Tutup Teks' : 'Ketik Manual'}</span>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#A3AFBC] leading-relaxed">
                Sebutkan transaksi pengeluaran atau pemasukan Anda secara langsung. Monetra akan mencatat dan mengalokasikannya secara otomatis.
              </p>

              {/* Optional Manual Fallback Input */}
              {showManualInput && (
                <form onSubmit={handleManualSubmit} className="pt-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Ketik transaksi di sini..."
                      className="flex-1 h-9 px-3.5 rounded-xl glass-1 border border-white/[0.1] text-xs text-[#EEF2F6] placeholder:text-[#74808E] outline-none focus:border-[#E39A5E]"
                    />
                    <button
                      type="submit"
                      disabled={!manualText.trim()}
                      className="btn-primary px-3.5 h-9 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-md"
                    >
                      <span>Kirim</span>
                      <Send size={11} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {recordState === 'recording' && (
            <div className="p-4 sm:p-5 rounded-2xl glass-2 border border-[rgba(205,225,245,0.14)] shadow-xl space-y-2.5 text-left backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#EEF2F6]">Bicara ke Monetra</h3>
                <span className="text-[11px] text-[#E39A5E] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EE5D6C] animate-ping" />
                  <span>Mendengarkan</span>
                </span>
              </div>

              {liveTranscript ? (
                <p className="text-sm sm:text-base font-semibold text-[#EEF2F6] leading-relaxed break-words">
                  &quot;{liveTranscript}&quot;
                </p>
              ) : hasDetectedVoice ? (
                <p className="text-xs sm:text-sm text-[#4FD3A4] font-medium leading-relaxed">
                  Suara terdeteksi, silakan lanjutkan...
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-[#A3AFBC] leading-relaxed">
                  Silakan sebutkan transaksi Anda...
                </p>
              )}
            </div>
          )}

          {recordState === 'processing' && (
            <div className="p-6 rounded-2xl glass-2 border border-[rgba(205,225,245,0.16)] shadow-2xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-[#E39A5E] border-t-transparent animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#EEF2F6]">Memproses rekaman suara dengan AI Monetra...</p>
              <p className="text-xs text-[#A3AFBC]">Menganalisis kalimat, mengelompokkan kategori, dan menghitung nominal</p>
            </div>
          )}

          {recordState === 'confirm' && (
            <div className="w-full max-w-xl mx-auto space-y-3.5 text-left">
              {/* Transcript Preview */}
              <div className="p-3.5 rounded-xl glass-1 border-[rgba(205,225,245,0.12)] space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-[#74808E] tracking-wider">
                  <span>Hasil Suara yang Didengar:</span>
                  <button
                    type="button"
                    onClick={handleRestartRecording}
                    className="text-[#E39A5E] normal-case font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Ulangi Bicara</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-[#EEF2F6] italic leading-relaxed font-medium">
                  &quot;{transcript}&quot;
                </p>
              </div>

              {/* Transactions List */}
              <div className="space-y-2 max-h-[45dvh] overflow-y-auto custom-scrollbar pr-1">
                <div className="flex items-center justify-between text-xs text-[#A3AFBC]">
                  <span>{parsedItems.length} Transaksi Terdeteksi</span>
                </div>
                {parsedItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A3AFBC] glass-1 rounded-xl space-y-2">
                    <p>Tidak ada nominal transaksi yang terdeteksi dari ucapan tersebut.</p>
                    <button
                      type="button"
                      onClick={handleResetToIdle}
                      className="btn-ghost px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-xs text-[#E39A5E] font-medium cursor-pointer"
                    >
                      Bicara Lagi atau Ketik Ulang
                    </button>
                  </div>
                ) : (
                  parsedItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-2 p-3.5 rounded-xl flex items-center justify-between gap-3 border-[rgba(205,225,245,0.16)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                          <CategoryIcon name={item.category} size={18} color="#E39A5E" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#EEF2F6] truncate">{item.note}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[#A3AFBC]">{item.category}</span>
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
                          className="btn-danger p-1.5 rounded-lg text-[#74808E] hover:text-[#EE5D6C] cursor-pointer"
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
      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-20 w-full px-5 pb-[max(var(--safe-bottom),1.5rem)] pt-3 flex flex-col items-center justify-center shrink-0">
        {recordState === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleStartRecording}
              aria-label="Mulai Merekam Suara"
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-2xl shadow-[#E39A5E]/40 border-2 border-[rgba(255,255,255,0.4)] ring-8 ring-[#E39A5E]/15 hover:scale-105 active:scale-95 transition-all cursor-pointer touch-manipulation focus:outline-none"
            >
              <Mic size={34} strokeWidth={2.3} />
            </button>
            <span className="text-xs text-[#E39A5E] font-medium tracking-wide mt-1">
              Ketuk untuk Bicara
            </span>
          </div>
        )}

        {recordState === 'recording' && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleStopRecording}
              className="btn-primary h-13 px-8 rounded-2xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] font-bold text-sm sm:text-base flex items-center gap-2 shadow-2xl shadow-[#E39A5E]/35 hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation transition-all"
            >
              <Check size={20} strokeWidth={2.4} />
              <span>Selesai Bicara</span>
            </button>
          </div>
        )}

        {recordState === 'confirm' && (
          <div className="w-full max-w-xl flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetToIdle}
              className="btn-ghost px-4 py-2.5 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs font-medium text-[#EEF2F6] hover:bg-white/[0.06] cursor-pointer"
            >
              Bicara Lagi
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || parsedItems.length === 0}
              className="btn-primary px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-lg shadow-black/40"
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
