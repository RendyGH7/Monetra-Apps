import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Mic,
  Sparkles,
  Trash2,
  User,
  Key,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { stripEmoji } from '../../utils/format';
import { askFinAI, getStoredGeminiKey, saveStoredGeminiKey } from '../../services/aiService';

export const AssistantPage: React.FC = () => {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    setVoiceModalOpen,
    profile,
    transactions,
    memories,
    addTransaction,
    showToast,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [activeApiKey, setActiveApiKey] = useState(getStoredGeminiKey());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const quickQuestions = [
    'Halo FinAI, apa kabar keuangan saya?',
    'Berapa sisa aman belanja hari ini?',
    'Tips kencan hemat agar gaji magang cukup',
    'Investasi apa yang cocok untuk gaji magang 1.5 juta?',
    'Catat tadi makan siang 20 ribu',
    'Jelaskan cara bagi uang aturan 50/30/20',
  ];

  const handleSend = async (userText: string) => {
    const cleanText = stripEmoji(userText).trim();
    if (!cleanText) return;

    // Add user message
    addChatMessage({
      user_id: profile.id,
      role: 'user',
      content: cleanText,
    });
    setInput('');
    setIsTyping(true);

    try {
      // Query upgraded AI Engine (Google Gemini or Deep Local Reasoning)
      const result = await askFinAI(cleanText, {
        profile,
        transactions,
        memories,
        chatHistory: chatMessages,
        addTransaction,
      });

      addChatMessage({
        user_id: profile.id,
        role: 'assistant',
        content: result.text,
      });

      if (result.recordedTransactionCount) {
        showToast(`${result.recordedTransactionCount} transaksi otomatis dicatat oleh FinAI.`);
      }
    } catch (err: any) {
      addChatMessage({
        user_id: profile.id,
        role: 'assistant',
        content:
          'Maaf, terjadi kendala saat menghubungkan ke model AI. Silakan coba tanyakan kembali atau periksa koneksi internet.',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = apiKeyInput.trim();
    saveStoredGeminiKey(clean);
    setActiveApiKey(clean);
    setApiKeyModalOpen(false);
    setApiKeyInput('');
    if (clean) {
      showToast('Model Google Gemini AI berhasil diaktifkan!');
    } else {
      showToast('API Key dilepas. Beralih ke FinAI Brain Lokal.');
    }
  };

  const handleDisconnectApiKey = () => {
    saveStoredGeminiKey('');
    setActiveApiKey('');
    setApiKeyModalOpen(false);
    setApiKeyInput('');
    showToast('Koneksi Gemini AI dilepas.');
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100dvh-7rem)] flex flex-col pb-20 md:pb-6 relative">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[rgba(205,225,245,0.1)] gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center font-bold text-sm shrink-0">
            <Bot size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[#EEF2F6] truncate">Asisten FinAI</h1>
              {activeApiKey ? (
                <span
                  onClick={() => setApiKeyModalOpen(true)}
                  className="px-2 py-0.5 rounded-full bg-[#4FD3A4]/15 border border-[#4FD3A4]/30 text-[#4FD3A4] text-[10px] font-medium flex items-center gap-1 cursor-pointer hover:bg-[#4FD3A4]/25 shrink-0"
                  title="Klik untuk pengaturan Gemini"
                >
                  <Sparkles size={11} />
                  <span>Gemini Flash Aktif</span>
                </span>
              ) : (
                <span
                  onClick={() => setApiKeyModalOpen(true)}
                  className="px-2 py-0.5 rounded-full bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] text-[10px] font-medium flex items-center gap-1 cursor-pointer hover:bg-[#E39A5E]/25 shrink-0"
                  title="Klik untuk menyambungkan Google Gemini"
                >
                  <Key size={11} />
                  <span>FinAI Brain</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#A3AFBC] truncate">
              {activeApiKey
                ? 'Terhubung ke Google Gemini dengan wawasan internet dan keuangan penuh'
                : 'Mengetahui profil magang, gaya belanja, dan kebiasaan kencanmu'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setApiKeyModalOpen(true)}
            className="btn-ghost px-2.5 py-1.5 rounded-xl glass-1 border border-white/[0.08] text-xs text-[#EEF2F6] flex items-center gap-1.5 cursor-pointer"
            title="Pengaturan Model AI"
          >
            <Key size={13} className="text-[#E39A5E]" />
            <span className="hidden sm:inline">{activeApiKey ? 'Kunci Gemini' : 'Sambungkan Gemini'}</span>
          </button>

          <button
            type="button"
            onClick={clearChat}
            className="p-1.5 rounded-lg text-[#74808E] hover:text-[#EE5D6C] hover:bg-white/[0.04] transition-colors cursor-pointer text-xs flex items-center gap-1"
            title="Bersihkan Percakapan"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Bersihkan</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {chatMessages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                  isUser
                    ? 'bg-[#E39A5E]/20 text-[#E39A5E] border border-[#E39A5E]/30'
                    : 'bg-white/[0.06] text-[#EEF2F6] border border-white/[0.1]'
                }`}
              >
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#EEF2F6] rounded-tr-none'
                    : 'glass-2 border-[var(--glass-border)] text-[#EEF2F6] rounded-tl-none space-y-2'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-[#A3AFBC] italic pl-10">
            <Sparkles size={13} className="animate-spin text-[#E39A5E]" />
            <span>FinAI sedang memikirkan jawaban terbaik...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(q)}
            className="chip-press px-3 py-1.5 rounded-xl glass-1 border border-white/[0.08] text-[11px] text-[#A3AFBC] hover:text-[#EEF2F6] hover:border-[#E39A5E]/40 whitespace-nowrap transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="pt-2 border-t border-[rgba(205,225,245,0.1)] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVoiceModalOpen(true)}
          className="p-2.5 rounded-xl glass-2 border border-[#E39A5E]/30 text-[#E39A5E] hover:bg-[#E39A5E]/15 transition-colors cursor-pointer shrink-0"
          title="Bicara via Suara"
        >
          <Mic size={18} />
        </button>

        <input
          type="text"
          placeholder="Tanya tips keuangan, evaluasi budget, atau ketik 'catat makan 20rb'..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(input);
          }}
          className="flex-1 h-11 px-4 rounded-xl glass-1 text-xs sm:text-sm text-[#EEF2F6] placeholder:text-[#74808E] border border-white/[0.08] focus:border-[#E39A5E] outline-none"
        />

        <button
          type="button"
          onClick={() => handleSend(input)}
          disabled={!input.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] disabled:opacity-40 hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-md shrink-0"
          title="Kirim"
        >
          <Send size={18} />
        </button>
      </div>

      {/* ── Modal Pengaturan Google Gemini AI ────────────────────────────── */}
      {apiKeyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setApiKeyModalOpen(false);
          }}
        >
          <div className="animate-scale-in glass-3 w-full max-w-md overflow-hidden border border-[var(--glass-border)] p-6 space-y-5 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(205,225,245,0.1)]">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#E39A5E]" />
                <h2 className="text-sm font-semibold text-[#EEF2F6]">
                  Hubungkan Google Gemini AI (Gratis)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="btn-ghost p-1 rounded-lg text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#A3AFBC] leading-relaxed">
              <p>
                Dengan menghubungkan API Key Google Gemini, FinAI akan memiliki wawasan tak terbatas dari internet, penalaran ekonomi mendalam, serta kemampuan menjawab pertanyaan apapun dengan sangat pintar.
              </p>

              <div className="p-3 rounded-xl bg-[#E39A5E]/10 border border-[#E39A5E]/20 space-y-1.5">
                <p className="font-semibold text-[#EEF2F6] flex items-center gap-1">
                  <span>Cara mendapatkan API Key gratis dari Google:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#A3AFBC]">
                  <li>Buka Google AI Studio di browser Anda.</li>
                  <li>Login akun Google dan klik tombol <strong>Create API Key</strong>.</li>
                  <li>Salin dan tempelkan kuncinya pada kolom di bawah.</li>
                </ol>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E39A5E] hover:underline pt-1"
                >
                  <span>Buka Google AI Studio (Gratis)</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#EEF2F6]">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl glass-1 border border-white/[0.12] text-xs text-[#EEF2F6] placeholder:text-[#74808E] outline-none focus:border-[#E39A5E] font-mono"
                />
                {activeApiKey && (
                  <p className="text-[10px] text-[#4FD3A4] flex items-center gap-1 pt-0.5">
                    <Check size={12} />
                    <span>API Key saat ini aktif tersimpan di browser Anda.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[rgba(205,225,245,0.1)] gap-2">
                {activeApiKey ? (
                  <button
                    type="button"
                    onClick={handleDisconnectApiKey}
                    className="btn-danger px-3 py-2 rounded-xl text-xs text-[#EE5D6C] font-medium cursor-pointer"
                  >
                    Lepas Kunci
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApiKeyModalOpen(false)}
                    className="btn-ghost px-4 py-2 rounded-xl border border-white/[0.08] text-xs text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!apiKeyInput.trim()}
                    className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    Simpan & Aktifkan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
