import React, { useState } from 'react';
import {
  Home,
  ListOrdered,
  BarChart3,
  Bot,
  Target,
  Settings,
  Mic,
  Sun,
  Moon,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';

export const SidebarNav: React.FC = () => {
  const { activeTab, setActiveTab, setVoiceModalOpen, theme, toggleTheme, profile, authUser, showToast, signOut } =
    useAppStore();
  const [avatarError, setAvatarError] = useState(false);

  const navItems = [
    { key: 'beranda' as const, label: 'Beranda', icon: Home },
    { key: 'transaksi' as const, label: 'Transaksi', icon: ListOrdered },
    { key: 'statistik' as const, label: 'Statistik & Analisis', icon: BarChart3 },
    { key: 'asisten' as const, label: 'Asisten Keuangan AI', icon: Bot },
    { key: 'budget' as const, label: 'Budget & Target', icon: Target },
    { key: 'pengaturan' as const, label: 'Pengaturan & Memori', icon: Settings },
  ];

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        showToast('Login Google: ' + error.message);
      }
    } catch {
      showToast('Gagal membuka otentikasi Google');
    }
  };

  return (
    <aside
      aria-label="Navigasi desktop"
      className="hidden md:flex flex-col justify-between w-20 lg:w-64 h-screen sticky top-0 z-30 p-4 border-r border-[rgba(205,225,245,0.13)] bg-[#070A0F]/80 backdrop-blur-md"
    >
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] text-[#1C0E04] flex items-center justify-center shadow-md shadow-black/40 border border-[rgba(235,245,255,0.3)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13h2l2-6 3 12 3-8 2 4h2l3-7 3 5h2" />
            </svg>
          </div>
          <div className="hidden lg:block">
            <span className="font-display font-bold text-lg tracking-tight text-[#EEF2F6]">
              FinAI
            </span>
            <p className="text-[11px] text-[#A3AFBC]">Asisten Keuangan</p>
          </div>
        </div>

        {/* Quick Voice Note CTA on Desktop */}
        <div className="px-1 hidden lg:block">
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="btn-primary w-full h-11 px-4 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-black/30 cursor-pointer"
          >
            <Mic size={18} strokeWidth={2.2} />
            <span>Rekam Pengeluaran</span>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`group relative w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl cursor-pointer overflow-hidden ${
                  isActive
                    ? 'glass-2 border-[#E39A5E]/30 text-[#EEF2F6] font-semibold'
                    : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
                }`}
                style={{ transition: 'color 0.15s ease, background 0.15s ease' }}
                title={item.label}
              >
                {/* Left active accent bar */}
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-[#E39A5E]"
                  style={{
                    height: isActive ? '60%' : '0%',
                    transition: 'height 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
                {/* Hover fill for inactive items */}
                {!isActive && (
                  <span
                    className="absolute inset-0 rounded-xl bg-white/[0.04] opacity-0 group-hover:opacity-100"
                    style={{ transition: 'opacity 0.15s ease' }}
                  />
                )}
                <div
                  className={isActive ? 'text-[#E39A5E]' : 'group-hover:text-[#EEF2F6]'}
                  style={{ transition: 'color 0.15s ease' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} style={{ transition: 'stroke-width 0.15s ease' }} />
                </div>
                <span className="hidden lg:inline text-sm tracking-tight text-left relative z-10">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile and Settings section */}
      <div className="space-y-3 pt-4 border-t border-[rgba(205,225,245,0.1)]">
        {/* Theme toggle */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="icon-spin-hover btn-ghost p-2 rounded-lg text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
            title="Ganti Tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* User Card */}
        <div className="glass-1 p-2.5 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {profile.avatar_url && !avatarError ? (
              <img
                src={profile.avatar_url}
                alt={profile.nama}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-lg object-cover border border-[#E39A5E]/40 shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center font-bold text-xs shrink-0">
                {(profile.nama || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold text-[#EEF2F6] truncate">
                {profile.nama}
              </p>
              <p className="text-[10px] text-[#A3AFBC] truncate">
                {profile.email || profile.internship_status}
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            {profile.id === 'default' && !authUser ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="btn-ghost text-xs text-[#E39A5E] hover:underline flex items-center gap-1 font-medium cursor-pointer px-1 py-0.5 rounded"
                title="Hubungkan Google"
              >
                <LogIn size={14} />
                <span>Masuk</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signOut}
                className="btn-danger text-xs text-[#A3AFBC] hover:text-[#EE5D6C] flex items-center gap-1 cursor-pointer p-1.5 rounded-lg"
                title="Keluar"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
