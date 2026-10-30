import React from 'react';
import { useAppStore } from '../../store';

export const FloatingMascot: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  // Di desktop navigasi asisten tersedia di sidebar.
  // Saat sedang membuka halaman asisten di mobile, tombol mengambang disembunyikan agar tidak menutupi input chat & tombol kirim.
  if (activeTab === 'asisten') {
    return null;
  }

  return (
    <aside
      aria-label="Akses Cepat Asisten Monetra"
      className="md:hidden fixed bottom-[104px] right-3.5 z-40 flex flex-col items-end select-none pointer-events-none"
    >
      <div className="relative pointer-events-auto group">
        {/* Tombol Maskot Mengambang dengan Gerakan Hidup */}
        <button
          type="button"
          onClick={() => setActiveTab('asisten')}
          aria-label="Buka Chatbot Monetra"
          className="relative flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 active:scale-90 hover:scale-110"
        >
          {/* Karakter Maskot dengan Animasi Melayang Organik (Float & Tilt) */}
          <div className="animate-mascot-float relative w-15 h-15 sm:w-16 sm:h-16 drop-shadow-[0_10px_20px_rgba(227,154,94,0.4)] filter transition-all duration-300">
            {/* Ambient aura glow lembut di belakang maskot */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#E39A5E]/25 to-[#4FD3A4]/15 blur-lg -z-10 animate-pulse" />

            {/* Gambar Maskot Monetra */}
            <img
              src="/finai-mascot.png"
              alt="Maskot Monetra Chatbot"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Indikator status online di pojok kanan atas dengan efek ping */}
            <span className="absolute top-0.5 right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4FD3A4] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4FD3A4] border-2 border-[var(--bg-base)] shadow-xs" />
            </span>
          </div>

          {/* Bayangan Hover / Pijar Thruster Mengembang di Bawah Maskot */}
          <div className="animate-mascot-shadow w-9 h-2 rounded-full bg-gradient-to-r from-transparent via-[#E39A5E]/50 to-transparent blur-[2px] mt-0.5" />
        </button>
      </div>
    </aside>
  );
};
