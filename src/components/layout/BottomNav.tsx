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
      className="md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-none"
    >
      <div className="pointer-events-auto glass-3 rounded-[24px] border border-[var(--glass-border)] shadow-2xl backdrop-blur-xl flex items-center justify-between h-[66px] px-1 relative">
        {navItems.map((item) => {
          if (item.isMic) {
            return (
              <div key="mic-center" className="flex-1 flex flex-col items-center justify-center relative -top-3.5">
                <button
                  type="button"
                  onClick={() => setVoiceModalOpen(true)}
                  aria-label="Rekam Pengeluaran Suara"
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-lg shadow-[#E39A5E]/35 border-2 border-[rgba(235,245,255,0.3)] ring-4 ring-[var(--bg-base)] active:scale-90 transition-transform duration-150 cursor-pointer"
                  title="Bicara untuk Catat Transaksi"
                >
                  <Mic size={22} strokeWidth={2.4} />
                </button>
                <span className="text-[10px] font-bold text-[#E39A5E] tracking-tight mt-1">
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
              className="flex-1 h-full flex flex-col items-center justify-center py-1 select-none cursor-pointer relative group transition-transform active:scale-92"
            >
              {/* Icon Container with smooth active glow */}
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] scale-105'
                    : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  style={{ transition: 'stroke-width 0.15s ease' }}
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-colors duration-150 ${
                  isActive
                    ? 'font-bold text-[var(--accent)]'
                    : 'font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </span>

              {/* Minimalist active dot */}
              <span
                className="w-1 h-1 rounded-full bg-[var(--accent)] mt-0.5 transition-all duration-200"
                style={{
                  transform: isActive ? 'scale(1)' : 'scale(0)',
                  opacity: isActive ? 1 : 0,
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
