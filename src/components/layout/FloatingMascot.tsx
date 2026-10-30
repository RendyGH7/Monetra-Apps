import React from 'react';
import { useAppStore } from '../../store';
import { Sparkles } from 'lucide-react';

export const FloatingMascot: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  // Di desktop navigasi asisten tersedia di sidebar.
  // Saat sedang membuka halaman asisten di mobile, tombol mengambang disembunyikan agar tidak menutupi input chat & tombol kirim.
  if (activeTab === 'asisten') {
    return null;
  }

  return (
    <aside
      aria-label="Akses Cepat Asisten FinAI"
      className="md:hidden fixed bottom-[78px] right-3 z-40 flex flex-col items-end select-none pointer-events-none"
    >
      <div className="relative pointer-events-auto group">
        {/* Mini badge ajakan interaksi */}
        <div className="absolute -top-7 right-0 bg-[var(--bg-card)]/95 border border-[#E39A5E]/40 text-[#E39A5E] text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-lg backdrop-blur-md whitespace-nowrap flex items-center gap-1">
          <Sparkles size={10} className="text-[#E39A5E]" />
          <span>Tanya FinAI</span>
        </div>

        {/* Tombol Maskot Mengambang */}
        <button
          type="button"
          onClick={() => setActiveTab('asisten')}
          aria-label="Buka Chatbot FinAI"
          className="relative flex items-center justify-center cursor-pointer transition-transform duration-200 active:scale-90 group-hover:scale-105"
        >
          {/* Ambient glow lembut di belakang maskot */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#E39A5E]/30 to-[#CF8143]/10 blur-md -z-10 animate-pulse" />

          {/* Ilustrasi Maskot Tanpa Background */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_8px_16px_rgba(227,154,94,0.35)] filter transition-all duration-300">
            <img
              src="/finai-mascot.png"
              alt="Maskot FinAI Chatbot"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* Indikator status online */}
          <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-[#4FD3A4] border-2 border-[var(--bg-base)] shadow-sm animate-pulse" />
        </button>
      </div>
    </aside>
  );
};
