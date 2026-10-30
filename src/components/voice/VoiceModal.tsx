import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, Trash2, Volume2, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { useAppStore } from '../../store';
import { parseVoiceInput } from '../../utils/voiceParser';
import { parseVoiceInputWithAI } from '../../services/aiService';
import { ParsedVoiceItem } from '../../types';
import { formatCurrency, stripEmoji } from '../../utils/format';
import { CategoryIcon } from '../common/CategoryIcon';

// Web Speech API interface fallback
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

  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Timer while recording
  useEffect(() => {
    if (recordState === 'recording') {
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordState]);

  // Cleanup speech recognition on unmount or modal close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  if (!voiceModalOpen) return null;

  // ── Start Real Voice Recording via Web Speech API ──────────────────────────
  const handleStartRecording = () => {
    setErrorMessage(null);
    setLiveTranscript('');

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setErrorMessage(
        'Browser Anda belum mendukung Web Speech API bawaan. Anda dapat mengetik kalimat transaksi langsung pada kolom di bawah.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setRecordState('recording');
      };

      recognition.onresult = (event: any) => {
        let full = '';
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript + ' ';
        }
        const clean = full.trim();
        if (clean) {
          setLiveTranscript(clean);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage(
            'Izin akses mikrofon ditolak oleh browser. Silakan klik ikon gembok/pengaturan di address bar browser untuk mengizinkan mikrofon.'
          );
          handleStopStream();
          setRecordState('idle');
        } else if (event.error === 'no-speech') {
          // Keep recording, user might be taking a pause
        } else if (event.error === 'network') {
          setErrorMessage(
            'Layanan pengenalan suara browser memerlukan koneksi internet. Anda juga bisa mengetik kalimatnya langsung.'
          );
        }
      };

      recognition.onend = () => {
        // Recognition naturally stopped or finished
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      setErrorMessage('Gagal mengaktifkan mikrofon: ' + (err.message || 'Error tidak diketahui'));
      setRecordState('idle');
    }
  };

  const handleStopStream = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  // ── Stop Recording & Parse Text ───────────────────────────────────────────
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

  const handleStopRecording = () => {
    handleStopStream();
    const spoken = liveTranscript.trim();

    if (!spoken) {
      setRecordState('idle');
      setErrorMessage(
        'Suara tidak terdeteksi atau mikrofon tidak menangkap ucapan. Coba ulangi dengan suara lebih jelas, atau gunakan kolom ketik di bawah.'
      );
      return;
    }

    processTranscription(spoken);
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
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === item.category.toLowerCase()
      ) || categories.find((c) => c.type === item.type);
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
    handleStopStream();
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
      <div className="animate-slide-up sm:animate-scale-in glass-3 w-full max-w-lg overflow-hidden border border-[var(--glass-border)] max-h-[92dvh] flex flex-col">
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
                  className="btn-primary w-24 h-24 rounded-full bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-xl shadow-black/50 border-4 border-[rgba(235,245,255,0.3)] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
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
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EE5D6C]/20 border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EE5D6C] animate-ping" />
                <span>Merekam: 00:{seconds < 10 ? `0${seconds}` : seconds}</span>
              </div>

              {/* Animated Waveform Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-16">
                {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 60, 85].map((h, i) => (
                  <div
                    key={i}
                    className="waveform-bar w-1.5 rounded-full bg-[#EE5D6C]"
                    style={{
                      height: `${h}%`,
                      ['--delay' as string]: `${i * 0.06}s`,
                    }}
                  />
                ))}
              </div>

              {/* Live speech transcription text box */}
              <div className="p-4 rounded-xl glass-1 border border-[#EE5D6C]/30 min-h-[64px] flex items-center justify-center text-center">
                {liveTranscript ? (
                  <p className="text-sm font-medium text-[#EEF2F6] leading-relaxed">
                    &quot;{liveTranscript}&quot;
                  </p>
                ) : (
                  <p className="text-xs text-[#A3AFBC] italic">
                    Silakan bicara sekarang, kata-kata Anda akan muncul di sini...
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="btn-press px-7 py-3 rounded-xl bg-[#EE5D6C] hover:bg-[#E0343F] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-[#EE5D6C]/30 transition-all"
                >
                  <Check size={18} />
                  <span>Selesai Bicara</span>
                </button>
              </div>
            </div>
          )}

          {recordState === 'processing' && (
            <div className="text-center space-y-4 py-12">
              <div className="w-12 h-12 rounded-full border-2 border-[#E39A5E] border-t-transparent animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#EEF2F6]">
                Memproses rekaman suara dengan Monetra...
              </p>
              <p className="text-xs text-[#A3AFBC]">Memisahkan rincian belanja, kategori finansial, dan nominal uang</p>
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
                    <p>Tidak ada nominal transaksi yang terdeteksi dari kalimat tersebut.</p>
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
