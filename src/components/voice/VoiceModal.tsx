import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, Trash2, Volume2, AlertCircle, RefreshCw, Send, Radio } from 'lucide-react';
import { useAppStore } from '../../store';
import { parseVoiceInput } from '../../utils/voiceParser';
import { parseVoiceInputWithAI, parseVoiceAudioWithAI } from '../../services/aiService';
import { ParsedVoiceItem } from '../../types';
import { formatCurrency, stripEmoji } from '../../utils/format';
import { CategoryIcon } from '../common/CategoryIcon';

// Web Speech API interface fallback detection
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
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

  // Real-time audio reactive visualizer state
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100
  const [barHeights, setBarHeights] = useState<number[]>([15, 20, 15, 25, 20, 30, 20, 25, 15, 20, 15, 25, 20, 15]);
  const [hasDetectedVoice, setHasDetectedVoice] = useState(false);

  // References for audio hardware and streaming
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>('');
  const maxAudioLevelRef = useRef<number>(0);

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

  // Comprehensive hardware & stream cleanup
  const cleanupAudio = () => {
    // 1. Cancel visualizer animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 2. Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
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
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }

    // 5. Close Web Audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Cleanup on unmount or when modal is closed
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  if (!voiceModalOpen) return null;

  // ── Start Robust Recording (Web Audio + MediaRecorder + SpeechRecognition) ──
  const handleStartRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    finalTranscriptRef.current = '';
    audioChunksRef.current = [];
    maxAudioLevelRef.current = 0;
    setHasDetectedVoice(false);

    // 1. Request user media (Microphone Hardware Access)
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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
      return;
    }

    // 2. Set up Web Audio API for Real Audio Metering & Responsive Visualizer
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!isRecordingRef.current) return;
          analyser.getByteFrequencyData(dataArray);

          // Calculate average volume level (0 - 100)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));

          setAudioLevel(normalized);
          if (normalized > maxAudioLevelRef.current) {
            maxAudioLevelRef.current = normalized;
          }
          if (normalized > 8) {
            setHasDetectedVoice(true);
          }

          // Generate 14 dynamic responsive bar heights
          const step = Math.max(1, Math.floor(dataArray.length / 14));
          const bars: number[] = [];
          for (let b = 0; b < 14; b++) {
            const val = dataArray[b * step] || 0;
            // Floor at 15% so bars remain visible, scale dynamically up to 100%
            const height = Math.min(100, Math.max(15, Math.round((val / 255) * 100)));
            bars.push(height);
          }
          setBarHeights(bars);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        animFrameRef.current = requestAnimationFrame(updateMeter);
      }
    } catch (audioErr) {
      console.warn('Web Audio API setup warning (visualizer will fallback):', audioErr);
    }

    // 3. Set up MediaRecorder as a rock-solid background audio recording fallback
    try {
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // Flush chunks every 250ms
      mediaRecorderRef.current = recorder;
    } catch (recErr) {
      console.warn('MediaRecorder warning:', recErr);
    }

    // 4. Mark recording active
    isRecordingRef.current = true;
    setRecordState('recording');

    // 5. Initialize Web Speech API with Seamless Keepalive for Mobile Pauses
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += transcriptChunk + ' ';
            } else {
              interim += transcriptChunk;
            }
          }
          const combined = (finalTranscriptRef.current + ' ' + interim).trim();
          if (combined) {
            setLiveTranscript(combined);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setErrorMessage(
              'Izin akses mikrofon ditolak oleh browser. Silakan klik ikon gembok di address bar browser untuk mengizinkan mikrofon.'
            );
            handleStopRecording();
          } else if (event.error === 'network') {
            // Network glitch on speech recognition server - no panic, MediaRecorder is capturing!
            console.info('SpeechRecognition network disconnect; background audio recorder active.');
          }
          // 'no-speech' is expected during pauses; do not abort recording
        };

        recognition.onend = () => {
          // Critical Mobile Fix: Mobile browsers abruptly trigger onend after 1-2s pauses.
          // If the user hasn't explicitly tapped "Selesai Bicara", seamlessly restart recognition!
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {
              // Ignore if already active or restarting
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err: any) {
        console.warn('Web Speech API start error, will rely on audio fallback:', err);
      }
    }
  };

  // ── Stop Recording & Process Speech / Audio ─────────────────────────────────
  const handleStopRecording = async () => {
    isRecordingRef.current = false;
    setRecordState('processing');

    // 1. Stop SpeechRecognition gracefully
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // 2. Stop MediaRecorder and retrieve audio blob
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

    // 3. Completely stop hardware audio tracks
    cleanupAudio();

    // 4. Resolve transcription
    const recognizedText = (finalTranscriptRef.current + ' ' + liveTranscript).trim();

    // Path A: Web Speech API transcribed the text cleanly!
    if (recognizedText) {
      await processTranscription(recognizedText);
      return;
    }

    // Path B: Web Speech API returned nothing (common on iOS or network timeout),
    // but MediaRecorder captured actual audio from the user!
    if (audioBlob && audioBlob.size > 2000 && maxAudioLevelRef.current > 4) {
      try {
        const result = await parseVoiceAudioWithAI(audioBlob, categories);
        if (result.transcript || result.items.length > 0) {
          setTranscript(result.transcript || 'Rekaman Suara');
          setParsedItems(result.items);
          setRecordState('confirm');
          return;
        }
      } catch (err) {
        console.warn('Multimodal audio parse failed, checking error:', err);
      }
    }

    // Path C: Neither text nor audio sound detected (mic muted or user didn't speak)
    setRecordState('idle');
    setErrorMessage(
      'Suara tidak terdeteksi atau mikrofon terlalu jauh. Silakan dekatkan mikrofon dan bicara lebih jelas, atau gunakan kolom ketik di bawah.'
    );
  };

  // ── Parse Text (Gemini AI or Smart Local Parser) ───────────────────────────
  const processTranscription = async (text: string) => {
    setTranscript(text);
    setRecordState('processing');
    try {
      const items = await parseVoiceInputWithAI(text, categories);
      setParsedItems(items);
    } catch (err) {
      console.warn('Voice AI parse error, using smart fallback:', err);
      const items = parseVoiceInput(text);
      setParsedItems(items);
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
    isRecordingRef.current = false;
    cleanupAudio();
    setVoiceModalOpen(false);
    setRecordState('idle');
    setTranscript('');
    setLiveTranscript('');
    setManualText('');
    setErrorMessage(null);
    setParsedItems([]);
  };

  const handleRemoveItem = (id: string) => {
    setParsedItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="animate-slide-up sm:animate-scale-in glass-3 w-full max-w-lg overflow-hidden border border-[var(--glass-border)] max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(205,225,245,0.1)]">
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
                      backgroundColor: audioLevel > 8 ? '#E39A5E' : '#EE5D6C',
                      opacity: Math.max(0.4, h / 100),
                    }}
                  />
                ))}
              </div>

              {/* Live speech transcription text box */}
              <div className="p-4 rounded-xl glass-1 border border-[#E39A5E]/30 min-h-[72px] flex flex-col items-center justify-center text-center">
                {liveTranscript ? (
                  <p className="text-sm font-medium text-[#EEF2F6] leading-relaxed">
                    &quot;{liveTranscript}&quot;
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-[#EEF2F6] font-medium">
                      Silakan bicara sekarang...
                    </p>
                    <p className="text-[11px] text-[#A3AFBC] italic">
                      Contoh: &quot;Beli makan siang 20 ribu dan bensin 30 ribu&quot;
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
                    onClick={() => setRecordState('idle')}
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
                      onClick={() => setRecordState('idle')}
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
              onClick={() => setRecordState('idle')}
              className="btn-ghost px-4 py-2.5 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs font-medium text-[#EEF2F6] cursor-pointer"
            >
              Bicara Lagi
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={parsedItems.length === 0}
              className="btn-primary px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-black/40"
            >
              Simpan Semua ({parsedItems.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
