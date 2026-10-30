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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';

export const SidebarNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setVoiceModalOpen,
    theme,
    toggleTheme,
    profile,
    authUser,
    showToast,
    signOut,
    sidebarCollapsed,
    toggleSidebar,
  } = useAppStore();
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
      className={`hidden md:flex flex-col justify-between h-screen sticky top-0 z-30 border-r border-[var(--glass-border)] bg-[var(--bg-base)]/90 backdrop-blur-md transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative px-3 py-4 select-none ${
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Floating edge collapse/expand button on the side border */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[var(--bg-base)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[#E39A5E] hover:border-[#E39A5E]/70 hover:bg-[#E39A5E]/10 flex items-center justify-center shadow-lg shadow-black/25 z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 cursor-pointer group"
        title={sidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
        aria-label={sidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
      >
        <ChevronLeft
          size={14}
          strokeWidth={2.2}
          className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            sidebarCollapsed ? 'rotate-180 text-[#E39A5E]' : 'group-hover:-translate-x-0.5'
          }`}
        />
      </button>

      <div className="space-y-6">
        {/* Brand Logo & Header */}
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-1 pt-1`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={sidebarCollapsed ? toggleSidebar : undefined}
              className={`w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-black/40 border border-[rgba(235,245,255,0.25)] shrink-0 flex items-center justify-center transition-all ${
                sidebarCollapsed ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
              }`}
              title={sidebarCollapsed ? 'Buka Sidebar' : 'FinAI'}
            >
              <img src="/favicon.svg" alt="Logo FinAI" className="w-full h-full object-cover" />
            </button>
            <div
              className={`overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                sidebarCollapsed
                  ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                  : 'max-w-[160px] opacity-100 translate-x-0'
              }`}
            >
              <span className="font-display font-bold text-lg tracking-tight text-[var(--text-primary)] whitespace-nowrap block">
                FinAI
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">Asisten Keuangan</p>
            </div>
          </div>
        </div>

        {/* Quick Voice Note CTA */}
        <div className="px-0.5">
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className={`btn-primary h-11 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] font-semibold text-sm flex items-center shadow-md shadow-black/30 cursor-pointer overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              sidebarCollapsed ? 'w-12 mx-auto justify-center px-0' : 'w-full px-3.5 justify-start gap-2.5'
            }`}
            title="Rekam Pengeluaran Suara"
          >
            <div className="shrink-0 flex items-center justify-center">
              <Mic size={18} strokeWidth={2.2} />
            </div>
            <span
              className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                sidebarCollapsed
                  ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                  : 'max-w-[160px] opacity-100 translate-x-0'
              }`}
            >
              Rekam Pengeluaran
            </span>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`sidebar-nav-btn h-11 rounded-xl flex items-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isActive ? 'is-active' : ''
                } ${
                  sidebarCollapsed ? 'w-12 mx-auto justify-center px-0' : 'w-full px-3 justify-start gap-3'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {/* Left active accent bar */}
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-[#E39A5E]"
                  style={{
                    height: isActive ? '60%' : '0%',
                    transition: 'height 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div className="nav-icon shrink-0 w-5 h-5 flex items-center justify-center">
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} style={{ transition: 'stroke-width 0.15s ease' }} />
                </div>
                <span
                  className={`text-sm tracking-tight text-left relative z-10 whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    sidebarCollapsed
                      ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                      : 'max-w-[160px] opacity-100 translate-x-0'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile and Settings section */}
      <div className="space-y-2 pt-3 border-t border-[rgba(205,225,245,0.1)]">
        {/* Theme toggle */}
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-1`}>
          <button
            type="button"
            onClick={toggleTheme}
            className={`icon-spin-hover btn-ghost rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0 ${
              sidebarCollapsed ? 'w-11 h-10 flex items-center justify-center p-0' : 'p-2'
            }`}
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {!sidebarCollapsed && (
            <span className="text-[11px] text-[var(--text-secondary)] font-medium whitespace-nowrap overflow-hidden">
              {theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}
            </span>
          )}
        </div>

        {/* User Card */}
        <div
          onClick={() => {
            if (sidebarCollapsed) setActiveTab('pengaturan');
          }}
          className={`glass-1 ${
            sidebarCollapsed
              ? 'w-11 h-11 mx-auto p-0 justify-center cursor-pointer hover:border-[#E39A5E]/50 hover:bg-white/[0.04]'
              : 'w-full p-2.5 flex-row justify-between gap-2.5'
          } rounded-xl flex items-center transition-all duration-200 overflow-hidden group`}
          title={sidebarCollapsed ? `${profile.nama} · Buka Pengaturan` : undefined}
        >
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
            {profile.avatar_url && !avatarError ? (
              <img
                src={profile.avatar_url}
                alt={profile.nama}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-lg object-cover border border-[#E39A5E]/40 shrink-0 shadow-sm group-hover:border-[#E39A5E]/70 transition-colors"
                title={`${profile.nama} (${profile.email || 'Akun Google'})`}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center font-bold text-xs shrink-0 group-hover:border-[#E39A5E]/60 transition-colors"
                title={`${profile.nama} (${profile.email || 'Akun Google'})`}
              >
                {(profile.nama || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {profile.nama}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">
                  {profile.email || profile.internship_status}
                </p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="shrink-0">
              {profile.id === 'default' && !authUser ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="btn-ghost text-xs text-[#E39A5E] hover:underline flex items-center gap-1 font-medium cursor-pointer px-1 py-0.5 rounded whitespace-nowrap"
                  title="Hubungkan Google"
                >
                  <LogIn size={14} />
                  <span>Masuk</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signOut}
                  className="btn-danger text-xs text-[var(--text-secondary)] hover:text-[#EE5D6C] flex items-center gap-1 cursor-pointer p-1.5 rounded-lg"
                  title="Keluar dari Akun"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
