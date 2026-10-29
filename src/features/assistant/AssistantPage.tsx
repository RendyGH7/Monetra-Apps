import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, Sparkles, Trash2, User, Copy, Check } from 'lucide-react';
import { useAppStore } from '../../store';
import { stripEmoji, formatTimeShort } from '../../utils/format';
import { askFinAI } from '../../services/aiService';
import { MarkdownMessage } from '../../components/common/MarkdownMessage';

export const AssistantPage: React.FC = () => {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    setVoiceModalOpen,
    profile,
    transactions,
    wallets,
    goals,
    categories,
    memories,
    addTransaction,
    addMemory,
    showToast,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const quickQuestions = [
    'Siapakah aku dan apa saja data yang kamu ketahui?',
    'Berapa sisa aman belanja hari ini?',
    'Rincian saldo di semua dompet dan target tabunganku',
    'Tips kencan hemat agar gaji magang cukup',
    'Catat makan siang 20 ribu di dompet tunai',
    'Investasi apa yang cocok untuk gaji magang 1.5 juta?',
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Teks berhasil disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      // Query upgraded AI Engine (Google Gemini 3.5 Flash or Deep Local Reasoning)
      const result = await askFinAI(cleanText, {
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
        showToast(`${result.recordedTransactionCount} transaksi otomatis dicatat oleh FinAI.`);
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
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-4rem)] flex flex-col glass-2 rounded-2xl border border-[var(--glass-border)] shadow-xl p-3 sm:p-5 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(205,225,245,0.1)] gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-[#E39A5E]/20">
            <Bot size={20} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] truncate">
                Asisten FinAI
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#4FD3A4]/15 border border-[#4FD3A4]/35 text-[#4FD3A4] text-[10px] font-semibold flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4FD3A4] animate-pulse" />
                <span>Online</span>
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              Terhubung ke seluruh dompet, target tabungan, dan akun Google
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={clearChat}
            className="btn-danger p-2 rounded-xl border border-transparent hover:border-[#EE5D6C]/30 text-[var(--text-tertiary)] hover:text-[#EE5D6C] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Bersihkan Percakapan"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Bersihkan</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area with Global Themed Scrollbar */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1.5 sm:pr-2">
        {chatMessages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* User / Bot Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-xs ${
                  isUser
                    ? 'bg-[#E39A5E]/20 text-[#E39A5E] border border-[#E39A5E]/35 font-bold'
                    : 'bg-white/[0.08] text-[var(--accent)] border border-white/[0.12]'
                }`}
              >
                {isUser ? <User size={15} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
                  isUser
                    ? 'max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-[#E39A5E]/20 to-[#CF8143]/10 border border-[#E39A5E]/30 text-[#EEF2F6] rounded-tr-none'
                    : 'max-w-[92%] sm:max-w-[88%] glass-1 border border-[var(--glass-border)] text-[var(--text-primary)] rounded-tl-none space-y-2'
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
                      title="Salin jawaban FinAI"
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
        })}

        {isTyping && (
          <div className="flex items-center gap-2.5 text-xs text-[var(--accent)] py-2 pl-11 animate-pulse">
            <Sparkles size={14} className="animate-spin text-[#E39A5E]" />
            <span className="font-medium">FinAI sedang menganalisis data keuanganmu...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="py-2 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0 border-t border-[rgba(205,225,245,0.08)]">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(q)}
            className="chip-press group px-3.5 py-1.5 rounded-xl glass-1 border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#E39A5E]/50 whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
            title={`Tanyakan: ${q}`}
          >
            <Sparkles size={12} className="text-[#E39A5E] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="pt-2 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setVoiceModalOpen(true)}
          className="btn-press p-2.5 rounded-xl glass-2 border border-[#E39A5E]/40 text-[#E39A5E] hover:bg-[#E39A5E]/15 hover:border-[#E39A5E]/60 cursor-pointer shrink-0 shadow-xs"
          title="Bicara via Suara"
        >
          <Mic size={18} strokeWidth={2.2} />
        </button>

        <input
          type="text"
          placeholder="Tanya tips keuangan, evaluasi budget, atau ketik 'catat makan 20rb'..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(input);
          }}
          className="input-glow flex-1 h-11 px-4 rounded-xl glass-1 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] border border-[var(--glass-border)] focus:border-[#E39A5E] outline-none shadow-xs"
        />

        <button
          type="button"
          onClick={() => handleSend(input)}
          disabled={!input.trim()}
          className="btn-primary p-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md shrink-0 flex items-center justify-center"
          title="Kirim Pesan"
        >
          <Send size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
};

