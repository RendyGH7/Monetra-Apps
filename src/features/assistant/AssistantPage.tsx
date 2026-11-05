import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, MicOff, Loader2, MessageSquare, Trash2, User, Copy, Check, Radio, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store';
import { stripEmoji, formatTimeShort, formatCompact } from '../../utils/format';
import { askMonetra, parseVoiceAudioWithAI } from '../../services/aiService';
import { deduplicateSpokenPhrases } from '../../utils/voiceParser';
import { MarkdownMessage } from '../../components/common/MarkdownMessage';

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

export const AssistantPage: React.FC = () => {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    profile,
    transactions,
    wallets,
    goals,
    categories,
    memories,
    addTransaction,
    addMemory,
    showToast,
    assistantInitialPrompt,
    setAssistantInitialPrompt,
    setActiveTab,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const prevMsgCountRef = useRef<number>(chatMessages.length);
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false);
  const basePromptRef = useRef<string>('');
  const sessionFinalPromptRef = useRef<string>('');

  // Clean helper to tear down SpeechRecognition callbacks and handles cleanly
  const terminateRecognition = (rec: any) => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
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

  // Pre-fill input if navigated from Insight or other prompt trigger
  useEffect(() => {
    if (assistantInitialPrompt) {
      setInput(assistantInitialPrompt);
      setAssistantInitialPrompt(null);
    }
  }, [assistantInitialPrompt, setAssistantInitialPrompt]);

  // Intelligent viewport fitting on page open & new messages
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      // When user opens the chatbot page:
      // Ensure the top of the newest message is completely visible, never cut off!
      requestAnimationFrame(() => {
        if (!container) return;
        if (chatMessages.length <= 1) {
          container.scrollTop = 0;
        } else if (lastMessageRef.current) {
          // Align cleanly to the top of the latest message with comfortable padding
          const targetTop = lastMessageRef.current.offsetTop - 16;
          container.scrollTop = Math.max(0, targetTop);
        } else {
          container.scrollTop = 0;
        }
      });
      prevMsgCountRef.current = chatMessages.length;
      return;
    }

    // Only scroll when a new message is appended or while typing:
    if (chatMessages.length > prevMsgCountRef.current || isTyping) {
      prevMsgCountRef.current = chatMessages.length;
      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [chatMessages, isTyping]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        terminateRecognition(recognitionRef.current);
        recognitionRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        streamRef.current = null;
      }
    };
  }, []);

  // Check if device is iOS (iPhone/iPad)
  const isDeviceIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  };

  // ── Dedicated Voice Prompting (Bicara bebas ke AI tanpa ngetik) ────────────
  const startVoicePrompt = async () => {
    const isMobile = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod|Android/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    // 1. Primary: Streaming Web Speech API for real-time word-by-word streaming
    const SpeechRecognition = getSpeechRecognition();

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          terminateRecognition(recognitionRef.current);
          recognitionRef.current = null;
        }
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }

        basePromptRef.current = input.trim();
        sessionFinalPromptRef.current = '';
        isListeningRef.current = true;
        setIsListening(true);

        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = !isMobile;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            const chunk = res[0]?.transcript || '';
            if (res.isFinal) {
              finalChunk += chunk + ' ';
            } else {
              interimChunk += chunk;
            }
          }
          sessionFinalPromptRef.current = finalChunk.trim();
          const currentSession = (finalChunk + interimChunk).trim();
          const fullPrompt = (basePromptRef.current + ' ' + currentSession).trim();
          setInput(fullPrompt);
        };

        recognition.onerror = (event: any) => {
          console.warn('Voice prompt error:', event?.error);
          if (event?.error === 'not-allowed') {
            showToast('Izin akses mikrofon tidak diizinkan di browser.');
            isListeningRef.current = false;
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          if (sessionFinalPromptRef.current) {
            const finalPrompt = sessionFinalPromptRef.current.trim();
            if (finalPrompt && !basePromptRef.current.toLowerCase().includes(finalPrompt.toLowerCase())) {
              basePromptRef.current = (basePromptRef.current + ' ' + finalPrompt).trim();
            }
            sessionFinalPromptRef.current = '';
          }
          // Auto-keepalive on mobile pauses with clean transition delay
          if (isListeningRef.current) {
            terminateRecognition(recognition);
            if (restartTimerRef.current) {
              clearTimeout(restartTimerRef.current);
            }
            const delay = isMobile ? 250 : 60;
            restartTimerRef.current = window.setTimeout(() => {
              if (!isListeningRef.current) return;
              try {
                startVoicePrompt();
              } catch {
                // ignore
              }
            }, delay);
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('Failed to start voice prompt:', err);
      }
    }

    // 2. Fallback Engine: MediaRecorder + Gemini Multimodal AI
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        },
      });
      streamRef.current = stream;

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(150);
      mediaRecorderRef.current = recorder;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err: any) {
      console.warn('Microphone access fallback error:', err);
      showToast('Izin akses mikrofon ditolak oleh browser.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopVoicePrompt = (autoSend = false) => {
    isListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      terminateRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const rec = mediaRecorderRef.current;
      rec.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/mp4' });
        if (blob.size > 500) {
          try {
            showToast('Memproses audio dengan AI...');
            const res = await parseVoiceAudioWithAI(blob, categories);
            if (res.transcript) {
              setInput(res.transcript);
              if (autoSend) {
                handleSend(res.transcript);
              }
            }
          } catch (e: any) {
            console.warn('Multimodal audio parse error in chat:', e);
          }
        }
      };
      try {
        rec.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    setIsListening(false);
    if (autoSend && input.trim()) {
      handleSend(input.trim());
    }
  };

  const toggleVoicePrompt = () => {
    if (isListening) {
      stopVoicePrompt();
    } else {
      startVoicePrompt();
    }
  };

  const userIncome = profile.monthly_income > 0 ? profile.monthly_income : 1500000;
  const incomeLabel = formatCompact(userIncome);

  const quickQuestions = [
    'Siapakah aku dan apa saja data yang kamu ketahui?',
    'Analisis alokasi gaji 50/30/20',
    'Berapa sisa aman belanja hari ini?',
    'Rincian saldo di semua dompet dan target tabunganku',
    'Prediksi cashflow akhir bulan (surplus atau defisit?)',
    'Tips kencan hemat agar anggaran cukup',
    `Investasi apa yang cocok untuk gaji ${incomeLabel}?`,
    'Catat makan siang 20 ribu di dompet tunai',
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Teks berhasil disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (userText: string) => {
    const cleanText = stripEmoji(userText).trim();
    if (!cleanText || isTyping || isSendingRef.current) return;
    isSendingRef.current = true;

    if (isListening) {
      stopVoicePrompt(false);
    }

    // Add user message
    addChatMessage({
      user_id: profile.id,
      role: 'user',
      content: cleanText,
    });
    setInput('');
    setIsTyping(true);

    try {
      // Query upgraded AI Engine (Google Gemini Flash or Deep Local Reasoning)
      const result = await askMonetra(cleanText, {
        profile,
        transactions,
        wallets,
        goals,
        categories,
        memories,
        chatHistory: chatMessages,
        addTransaction,
        addMemory,
      });

      addChatMessage({
        user_id: profile.id,
        role: 'assistant',
        content: result.text,
      });

      if (result.recordedTransactionCount) {
        showToast(`${result.recordedTransactionCount} transaksi otomatis dicatat oleh Monetra.`);
      }
    } catch {
      addChatMessage({
        user_id: profile.id,
        role: 'assistant',
        content:
          'Maaf, terjadi kendala saat menghubungkan ke model AI. Silakan coba tanyakan kembali atau periksa koneksi internet.',
      });
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pt-[max(var(--safe-top),0.75rem)] px-4 sm:px-8 lg:px-12 py-3 bg-[var(--bg-base)]/80 backdrop-blur-md gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Back Button - Navigasi kembali ke Beranda */}
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer -ml-1 shrink-0"
            aria-label="Kembali ke Beranda"
            title="Kembali ke Beranda"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border border-[#E39A5E]/40 shadow-md shadow-[#E39A5E]/20 shrink-0 glass-2 p-1">
            <img
              src="/finai-mascot.png"
              alt="Maskot Monetra"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] truncate font-display">
              Asisten Monetra
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] truncate hidden sm:block">
              Penalaran finansial cerdas & evaluasi riil pengeluaranmu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={clearChat}
            className="btn-danger h-8 px-2.5 sm:px-3 rounded-xl border border-transparent hover:border-[#EE5D6C]/30 text-[var(--text-tertiary)] hover:text-[#EE5D6C] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Bersihkan Percakapan"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline font-medium">Bersihkan</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area with Global Themed Scrollbar */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 sm:py-6 custom-scrollbar"
      >
        <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 my-auto select-none">
            <div className="relative mb-4 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border-2 border-[#E39A5E]/35 shadow-xl shadow-[#E39A5E]/20 glass-2 mx-auto transition-transform duration-300 group-hover:scale-105 p-2">
                <img
                  src="/finai-mascot.png"
                  alt="Maskot Monetra"
                  className="w-full h-full object-contain drop-shadow-md"
                />
              </div>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Halo! Saya Monetra
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mt-1.5 leading-relaxed">
              Asisten keuangan cerdas pribadimu. Tanyakan analisis pengeluaran, simulasi tabungan, evaluasi budget bulanan, atau curhat finansialmu secara santai.
            </p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLast = idx === chatMessages.length - 1;

            return (
              <div
                key={msg.id}
                ref={isLast ? lastMessageRef : undefined}
                className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* User / Bot Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-xs overflow-hidden ${
                    isUser
                      ? 'bg-[#E39A5E]/20 text-[#E39A5E] border border-[#E39A5E]/35 font-bold'
                      : 'border border-[#E39A5E]/30 glass-1 p-0.5'
                  }`}
                >
                  {isUser ? (
                    <User size={15} />
                  ) : (
                    <img
                      src="/finai-mascot.png"
                      alt="Monetra"
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
                    isUser
                      ? 'max-w-[88%] sm:max-w-[72%] bg-gradient-to-br from-[#E39A5E]/20 to-[#CF8143]/10 border border-[#E39A5E]/30 text-[#EEF2F6] rounded-tr-none'
                      : 'max-w-[95%] sm:max-w-[92%] glass-1 border border-[var(--glass-border)] text-[var(--text-primary)] rounded-tl-none space-y-2'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}

                  {/* Footer with Timestamp and Copy button for assistant */}
                  <div
                    className={`pt-1.5 flex items-center justify-between border-t border-white/[0.05] text-[10px] ${
                      isUser ? 'text-[#E39A5E]' : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    <span>{formatTimeShort(msg.created_at)}</span>
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="btn-ghost inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                        title="Salin jawaban Monetra"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={11} className="text-[#4FD3A4]" />
                            <span className="text-[#4FD3A4] font-medium">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isTyping && (
          <div className="flex items-center gap-2.5 text-xs text-[var(--accent)] py-2 pl-11 animate-pulse">
            <Loader2 size={14} className="animate-spin text-[#E39A5E]" />
            <span className="font-medium">Monetra sedang menganalisis data keuanganmu...</span>
          </div>
        )}
        </div>
      </div>

      {/* Bottom Input & Suggestions Area */}
      <div className="w-full bg-[var(--bg-base)]/80 backdrop-blur-lg px-4 sm:px-8 lg:px-12 pt-3 pb-[max(calc(var(--safe-bottom)+14px),1.75rem)] sm:pb-4 shrink-0 z-20">
        <div className="max-w-7xl mx-auto w-full space-y-2.5">
          {/* Quick Suggestion Chips */}
          <div className="overflow-x-auto no-scrollbar flex items-center gap-2 pb-0.5">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="chip-press group px-3.5 py-1.5 rounded-xl glass-1 border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#E39A5E]/50 whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0 transition-all"
                title={`Tanyakan: ${q}`}
              >
                <MessageSquare size={12} className="text-[#E39A5E] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span>{q}</span>
              </button>
            ))}
          </div>

          {/* Listening Status Bar */}
          {isListening && (
            <div className="px-3.5 py-2 rounded-xl bg-[#E39A5E]/15 border border-[#E39A5E]/40 flex items-center justify-between text-xs text-[#EEF2F6] animate-pulse">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EE5D6C] animate-ping shrink-0" />
                <span className="font-semibold text-[#E39A5E] shrink-0">Sedang mendengarkan...</span>
                <span className="text-[11px] text-[#A3AFBC] truncate hidden sm:inline">
                  Bicara bebas topik apapun (curhat, info pribadi, pertanyaan, dsb)
                </span>
              </div>
              <button
                type="button"
                onClick={() => stopVoicePrompt(true)}
                disabled={!input.trim()}
                className="px-2.5 py-1 rounded-lg bg-[#E39A5E] hover:bg-[#CF8143] text-[#1C0E04] text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
              >
                Selesai & Kirim
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoicePrompt}
              className={`btn-press p-2.5 sm:p-3 rounded-xl border cursor-pointer shrink-0 shadow-xs transition-all duration-200 flex items-center justify-center ${
                isListening
                  ? 'bg-[#EE5D6C]/25 border-[#EE5D6C] text-[#EE5D6C] shadow-lg shadow-[#EE5D6C]/30 animate-pulse'
                  : 'glass-2 border-[#E39A5E]/40 text-[#E39A5E] hover:bg-[#E39A5E]/15 hover:border-[#E39A5E]/60'
              }`}
              title={isListening ? 'Klik untuk berhenti merekam suara' : 'Voice Prompt: Bicara ke Monetra tanpa harus mengetik'}
            >
              {isListening ? (
                <MicOff size={18} strokeWidth={2.3} />
              ) : (
                <Mic size={18} strokeWidth={2.2} />
              )}
            </button>

            <input
              type="text"
              placeholder={
                isListening
                  ? 'Mendengarkan suaramu... silakan bicara bebas...'
                  : "Tanya apapun, curhat, cerita profilmu, atau ketik 'catat makan 20rb'..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isTyping) handleSend(input);
              }}
              className={`input-glow flex-1 h-11 sm:h-12 px-4 rounded-xl glass-1 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] border outline-none shadow-xs transition-colors duration-200 ${
                isListening ? 'border-[#EE5D6C]/60 bg-[#EE5D6C]/5' : 'border-[var(--glass-border)] focus:border-[#E39A5E]'
              }`}
            />

            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="btn-primary p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md shrink-0 flex items-center justify-center"
              title="Kirim Pesan"
            >
              <Send size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
