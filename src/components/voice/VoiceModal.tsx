import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, Edit3, Trash2, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { parseVoiceInput } from '../../utils/voiceParser';
import { ParsedVoiceItem } from '../../types';
import { formatCurrency, stripEmoji } from '../../utils/format';
import { CategoryIcon } from '../common/CategoryIcon';

export const VoiceModal: React.FC = () => {
  const { voiceModalOpen, setVoiceModalOpen, addTransaction, categories, wallets } = useAppStore();

  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'processing' | 'confirm'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedVoiceItem[]>([]);
  const timerRef = useRef<number | null>(null);

  // Suggested voice templates based on user real background
  const examplePhrases = [
    'Tadi pagi sarapan nasi uduk 15 ribu sama isi bensin motor 25 ribu',
    'Nge-date nonton bioskop bareng pacar habis 120 ribu di Cinema XXI',
    'Beli kopi sachet 10 ribu pas istirahat magang',
    'Gaji pokok magang masuk 1.5 juta rupiah',
  ];

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

  if (!voiceModalOpen) return null;

  const handleStartRecording = () => {
    setRecordState('recording');
  };

  const handleStopRecording = () => {
    setRecordState('processing');
    // Simulate real voice transcription & Gemini processing
    setTimeout(() => {
      const sampleText = 'Tadi siang makan nasi warteg 15 ribu terus beli bensin 25 ribu bolak-balik magang';
      setTranscript(sampleText);
      const items = parseVoiceInput(sampleText);
      setParsedItems(items);
      setRecordState('confirm');
    }, 1200);
  };

  const handleSelectExample = (text: string) => {
    setTranscript(text);
    setRecordState('processing');
    setTimeout(() => {
      const items = parseVoiceInput(text);
      setParsedItems(items);
      setRecordState('confirm');
    }, 500);
  };

  const handleSaveAll = () => {
    parsedItems.forEach((item) => {
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === item.category.toLowerCase()
      );
      const defaultWallet = wallets[0]?.id || 'wallet-cash';

      addTransaction({
        user_id: 'default',
        type: item.type,
        amount: item.amount,
        note: stripEmoji(item.note),
        occurred_at: item.occurred_at,
        source: 'voice',
        category_id: matchedCategory?.id || 'cat-food',
        wallet_id: defaultWallet,
      });
    });

    handleClose();
  };

  const handleClose = () => {
    setVoiceModalOpen(false);
    setRecordState('idle');
    setTranscript('');
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
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="animate-slide-up sm:animate-scale-in glass-3 w-full max-w-lg overflow-hidden border border-[rgba(205,225,245,0.18)] max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(205,225,245,0.1)]">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-[#E39A5E]" />
            <h2 id="voice-modal-title" className="text-base font-semibold text-[#EEF2F6]">
              {recordState === 'confirm' ? 'Konfirmasi Transaksi' : 'Bicara ke FinAI'}
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
          {recordState === 'idle' && (
            <div className="text-center space-y-6 py-4">
              <div className="space-y-1.5">
                <p className="text-lg font-semibold text-[#EEF2F6]">
                  Ceritakan pengeluaran atau pemasukanmu
                </p>
                <p className="text-xs text-[#A3AFBC] max-w-sm mx-auto leading-relaxed">
                  Bicara santai menggunakan Bahasa Indonesia. AI akan memecah ucapanmu menjadi beberapa transaksi otomatis.
                </p>
              </div>

              {/* Big Interactive Mic Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleStartRecording}
                  aria-label="Mulai Merekam"
                  className="btn-primary w-24 h-24 rounded-full bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-xl shadow-black/60 border-4 border-[rgba(235,245,255,0.3)] cursor-pointer"
                >
                  <Mic size={40} strokeWidth={2.2} />
                </button>
              </div>
              <p className="text-xs text-[#E39A5E] font-medium">Ketuk mikrofon untuk mulai</p>

              {/* Example phrases to try */}
              <div className="pt-4 border-t border-[rgba(205,225,245,0.1)] text-left space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#74808E]">
                  Atau coba contoh kalimat ini:
                </span>
                <div className="space-y-1.5">
                  {examplePhrases.map((phrase, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectExample(phrase)}
                      className="chip-press w-full text-left p-2.5 rounded-xl glass-1 text-xs text-[#A3AFBC] hover:text-[#EEF2F6] flex items-center justify-between cursor-pointer border border-transparent hover:border-[#E39A5E]/40"
                      style={{ transition: 'border-color 0.15s ease, color 0.15s ease' }}
                    >
                      <span className="truncate pr-2">&quot;{phrase}&quot;</span>
                      <Sparkles size={14} className="text-[#E39A5E] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {recordState === 'recording' && (
            <div className="text-center space-y-6 py-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EE5D6C]/20 border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-[#EE5D6C] animate-ping" />
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

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="btn-press px-6 py-3 rounded-xl bg-[#EE5D6C] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-black/40"
                  style={{ transition: 'filter 0.15s ease, transform 0.1s ease' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
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
              <p className="text-sm font-semibold text-[#EEF2F6]">Memahami ceritamu...</p>
              <p className="text-xs text-[#A3AFBC]">AI sedang memisahkan rincian transaksi</p>
            </div>
          )}

          {recordState === 'confirm' && (
            <div className="space-y-4">
              {/* Transcript */}
              <div className="p-3.5 rounded-xl glass-1 border-[rgba(205,225,245,0.1)] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#74808E] tracking-wider">
                  Hasil Transkripsi:
                </span>
                <p className="text-xs text-[#EEF2F6] italic leading-relaxed">
                  &quot;{transcript}&quot;
                </p>
              </div>

              {/* Parsed Transactions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#A3AFBC]">
                  <span>{parsedItems.length} Transaksi Ditemukan</span>
                  <span className="text-[#4FD3A4] font-medium flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Akurasi 98%</span>
                  </span>
                </div>

                {parsedItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#A3AFBC]">
                    Tidak ada transaksi yang terdeteksi. Silakan coba lagi.
                  </div>
                ) : (
                  parsedItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-2 p-3.5 rounded-xl flex items-center justify-between gap-3 border-[rgba(205,225,245,0.12)]"
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
                    Pengeluaran kencan terdeteksi. AI mencatat ini sebagai pos tersendiri agar kamu bisa memantau sisa budget pacaran minggu ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {recordState === 'confirm' && (
          <div className="p-4 border-t border-[rgba(205,225,245,0.1)] flex items-center justify-end gap-3 bg-[#070A0F]/60">
            <button
              type="button"
              onClick={() => setRecordState('idle')}
              className="btn-ghost px-4 py-2.5 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs font-medium text-[#EEF2F6] cursor-pointer"
            >
              Ulangi Rekam
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
