import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, Sparkles, Trash2, User } from 'lucide-react';
import { useAppStore } from '../../store';
import { stripEmoji, formatCurrency } from '../../utils/format';

export const AssistantPage: React.FC = () => {
  const { chatMessages, addChatMessage, clearChat, setVoiceModalOpen, profile, transactions, memories } =
    useAppStore();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const quickQuestions = [
    'Berapa sisa aman belanja hari ini?',
    'Analisis budget kencan saya minggu ini',
    'Tips hemat kencan dengan gaji magang 1.5 juta',
    'Apakah tabungan darurat saya sudah cukup?',
  ];

  const handleSend = (userText: string) => {
    const cleanText = stripEmoji(userText).trim();
    if (!cleanText) return;

    addChatMessage({
      user_id: profile.id,
      role: 'user',
      content: cleanText,
    });
    setInput('');
    setIsTyping(true);

    // AI Financial Intelligence Response Engine
    setTimeout(() => {
      let aiReply = '';
      const lower = cleanText.toLowerCase();

      const totalExpense = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const datingExpense = transactions
        .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
        .reduce((sum, t) => sum + t.amount, 0);

      if (lower.includes('aman') || lower.includes('hari ini')) {
        const remaining = (profile.monthly_income || 1500000) - totalExpense;
        const safeDaily = Math.max(0, Math.round(remaining / 15));
        aiReply = `Berdasarkan sisa saldo bulan ini (${formatCurrency(remaining)}), batas aman belanja harian kamu adalah ${formatCurrency(safeDaily)} per hari. Mengingat kamu rutin makan hemat di kisaran Rp 10.000 hingga Rp 20.000, batas ini masih sangat aman.`;
      } else if (lower.includes('kencan') || lower.includes('pacar') || lower.includes('date')) {
        aiReply = `Kamu rutin nge-date 3 sampai 4 kali seminggu dengan biaya Rp 50.000 sampai Rp 200.000 per sesi. Dari gaji magang Rp 1.500.000, pengeluaran kencan tercatat bulan ini sudah mencapai ${formatCurrency(datingExpense)}. Saran saya: coba variasikan sesi kencan dengan aktivitas hemat seperti jalan sore di taman kota, masak berdua di kos, atau movie night hemat, sehingga kamu tetap bisa rutin bertemu tanpa membuat budget bulanan defisit.`;
      } else if (lower.includes('tips') || lower.includes('gaji')) {
        aiReply = `Dengan gaji magang Rp 1.500.000:\n1. Alokasi makan harian: Rp 450.000 (Rp 15.000 x 30 hari).\n2. Alokasi kencan: batasi maksimal Rp 600.000 per bulan (rata-rata Rp 150.000 per minggu untuk 3-4 kali kencan hemat).\n3. Alokasi transport & pulsa: Rp 200.000.\n4. Tabungan darurat: minimal Rp 250.000 disisihkan di awal gajian tanggal ${profile.pay_day}.`;
      } else if (lower.includes('tabungan') || lower.includes('darurat')) {
        aiReply = `Target dana darurat kamu adalah Rp 1.000.000. Saat ini sudah terkumpul sebagian. Menabung rutin Rp 150.000 setiap tanggal gajian (${profile.pay_day}) akan membuat target ini tercapai dalam beberapa bulan ke depan.`;
      } else {
        aiReply = `Saya mencatat pertanyaanmu. Dari data keuangan magangmu (gaji Rp 1.500.000), total pengeluaran saat ini adalah ${formatCurrency(totalExpense)}. Pengeluaran pribadi harianmu sudah sangat bagus di angka Rp 10.000 - Rp 20.000. Kunci utamamu adalah menjaga variasi biaya kencan agar tidak tembus di atas Rp 150.000 per minggu.`;
      }

      addChatMessage({
        user_id: profile.id,
        role: 'assistant',
        content: stripEmoji(aiReply),
      });
      setIsTyping(false);
    }, 900);
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100dvh-7rem)] flex flex-col pb-20 md:pb-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[rgba(205,225,245,0.1)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center font-bold text-sm">
            <Bot size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#EEF2F6]">Asisten FinAI</h1>
            <p className="text-[11px] text-[#A3AFBC]">
              Mengetahui profil magang, gaya belanja, dan kebiasaan kencanmu
            </p>
          </div>
        </div>

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
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#EEF2F6] rounded-tr-none'
                    : 'glass-2 border-[rgba(205,225,245,0.14)] text-[#EEF2F6] rounded-tl-none space-y-2'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-[#A3AFBC] italic pl-10">
            <Sparkles size={13} className="animate-spin text-[#E39A5E]" />
            <span>FinAI sedang menganalisis data...</span>
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
            className="px-3 py-1.5 rounded-xl glass-1 border border-white/[0.08] text-[11px] text-[#A3AFBC] hover:text-[#EEF2F6] hover:border-[#E39A5E]/40 whitespace-nowrap transition-colors cursor-pointer"
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
          className="p-2.5 rounded-xl glass-2 border border-[#E39A5E]/30 text-[#E39A5E] hover:bg-[#E39A5E]/15 transition-colors cursor-pointer"
          title="Bicara via Suara"
        >
          <Mic size={18} />
        </button>

        <input
          type="text"
          placeholder="Ketik pertanyaan atau catat pengeluaran di sini..."
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
          className="p-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] disabled:opacity-40 hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-md"
          title="Kirim"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
