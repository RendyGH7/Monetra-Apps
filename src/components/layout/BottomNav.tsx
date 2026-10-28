import React from 'react';
import { Home, ListOrdered, BarChart3, Bot, Mic } from 'lucide-react';
import { useAppStore } from '../../store';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setVoiceModalOpen } = useAppStore();

  const navItems = [
    { key: 'beranda' as const, label: 'Beranda', icon: Home },
    { key: 'transaksi' as const, label: 'Transaksi', icon: ListOrdered },
    { key: 'mic' as const, label: 'Bicara', icon: Mic, isMic: true },
    { key: 'statistik' as const, label: 'Statistik', icon: BarChart3 },
    { key: 'asisten' as const, label: 'Asisten', icon: Bot },
  ];

  return (
    <nav
      aria-label="Navigasi bawah ponsel"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2"
    >
      <div className="glass-3 max-w-lg mx-auto flex items-center justify-around h-16 px-2 relative border border-[rgba(205,225,245,0.13)]">
        {navItems.map((item) => {
          if (item.isMic) {
            return (
              <div key="mic-center" className="relative -top-5 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setVoiceModalOpen(true)}
                  aria-label="Rekam Pengeluaran Suara"
                  className="w-[66px] h-[66px] rounded-full bg-gradient-to-b from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-lg shadow-black/40 border-2 border-[rgba(235,245,255,0.25)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                  <Mic size={28} strokeWidth={2.2} />
                </button>
                <span className="text-[10px] font-medium text-[#E39A5E] mt-0.5 tracking-tight">
                  Bicara
                </span>
              </div>
            );
          }

          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-colors ${
                isActive ? 'text-[#E39A5E]' : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-[rgba(227,154,94,0.15)]' : ''
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
              </div>
              <span className={`text-[11px] mt-0.5 ${isActive ? 'font-semibold text-[#EEF2F6]' : 'font-normal'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
