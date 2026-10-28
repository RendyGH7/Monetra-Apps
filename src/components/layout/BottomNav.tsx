import React from 'react';
import { Home, ListOrdered, BarChart3, Bot, Mic } from 'lucide-react';
import { useAppStore } from '../../store';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setVoiceModalOpen } = useAppStore();

  type NavTabKey = 'beranda' | 'transaksi' | 'statistik' | 'asisten';

  const navItems: Array<{
    key: NavTabKey | 'mic';
    label: string;
    icon: typeof Home;
    isMic?: boolean;
  }> = [
    { key: 'beranda', label: 'Beranda', icon: Home },
    { key: 'transaksi', label: 'Transaksi', icon: ListOrdered },
    { key: 'mic', label: 'Bicara', icon: Mic, isMic: true },
    { key: 'statistik', label: 'Statistik', icon: BarChart3 },
    { key: 'asisten', label: 'Asisten', icon: Bot },
  ];

  return (
    <nav
      aria-label="Navigasi bawah ponsel"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2"
    >
      <div className="glass-3 max-w-lg mx-auto flex items-center justify-around h-16 px-2 relative border border-[var(--glass-border)]">
        {navItems.map((item) => {
          if (item.isMic) {
            return (
              <div key="mic-center" className="relative -top-5 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setVoiceModalOpen(true)}
                  aria-label="Rekam Pengeluaran Suara"
                  className="btn-primary w-[66px] h-[66px] rounded-full bg-gradient-to-b from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-lg shadow-black/40 border-2 border-[rgba(235,245,255,0.25)] cursor-pointer"
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
              onClick={() => setActiveTab(item.key as NavTabKey)}
              aria-label={item.label}
              className={`chip-press relative flex flex-col items-center justify-center min-w-[56px] py-1 transition-colors ${
                isActive ? 'text-[#E39A5E]' : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              {/* Active indicator dot above icon */}
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[#E39A5E] origin-center"
                style={{
                  transform: `translateX(-50%) scaleX(${isActive ? 1 : 0})`,
                  transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                  opacity: isActive ? 1 : 0,
                }}
              />
              <div
                className="p-1 rounded-xl"
                style={{
                  background: isActive ? 'rgba(227,154,94,0.15)' : 'transparent',
                  transition: 'background 0.18s ease',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.75}
                  style={{ transition: 'stroke-width 0.15s ease' }}
                />
              </div>
              <span
                className={`text-[11px] mt-0.5 ${isActive ? 'font-semibold text-[#EEF2F6]' : 'font-normal'}`}
                style={{ transition: 'color 0.15s ease' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
