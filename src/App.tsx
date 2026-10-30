import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from './store';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { SidebarNav } from './components/layout/SidebarNav';
import { BottomNav } from './components/layout/BottomNav';
import { FloatingMascot } from './components/layout/FloatingMascot';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { AssistantPage } from './features/assistant/AssistantPage';
import { BudgetPage } from './features/budget/BudgetPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AuthScreen } from './features/auth/AuthScreen';
import { VoiceModal } from './components/voice/VoiceModal';
import { QuickManualModal } from './components/common/QuickManualModal';
import { Toast } from './components/common/Toast';

export default function App() {
  const {
    activeTab,
    authLoading,
    authUser,
    theme,
    profile,
    setActiveTab,
    toggleTheme,
    setAuthLoading,
    setAuthUser,
    syncWithSupabaseUser,
    showToast,
  } = useAppStore();

  // ── Sync theme to html document ─────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Resolve Supabase session on first load ──────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    try {
      // 1. Check current session immediately
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const u = session.user;
          const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
          const avatarUrl = u.user_metadata?.avatar_url || u.user_metadata?.picture;
          setAuthUser({ id: u.id, email: u.email, name, avatar_url: avatarUrl });
          syncWithSupabaseUser(u.id, u.email, name, avatarUrl);
        }
        setAuthLoading(false);
      }).catch(() => {
        setAuthLoading(false);
      });

      // 2. Subscribe to future auth changes (sign-in after OAuth redirect, sign-out)
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          const u = session.user;
          const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
          const avatarUrl = u.user_metadata?.avatar_url || u.user_metadata?.picture;
          setAuthUser({ id: u.id, email: u.email, name, avatar_url: avatarUrl });
          syncWithSupabaseUser(u.id, u.email, name, avatarUrl);
          if (event === 'SIGNED_IN') {
            showToast('Berhasil masuk dengan akun Google.');
          }
        } else {
          setAuthUser(null);
          if (event === 'SIGNED_OUT') {
            showToast('Kamu telah keluar dari akun.');
          }
        }
        setAuthLoading(false);
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    } catch {
      setAuthLoading(false);
    }
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'beranda':     return <DashboardPage />;
      case 'transaksi':   return <TransactionsPage />;
      case 'statistik':   return <AnalyticsPage />;
      case 'asisten':     return <AssistantPage />;
      case 'budget':      return <BudgetPage />;
      case 'pengaturan':  return <SettingsPage />;
      default:            return <DashboardPage />;
    }
  };

  // ── Loading state — while Supabase resolves the session ─────────────────
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070A0F]">
        <div className="aurora-mesh" aria-hidden="true">
          <div className="aurora-orb-1" />
          <div className="aurora-orb-2" />
          <div className="aurora-orb-3" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] flex items-center justify-center shadow-lg shadow-black/40 border border-[rgba(235,245,255,0.3)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C0E04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 13h2l2-6 3 12 3-8 2 4h2l3-7 3 5h2" />
            </svg>
          </div>
          <div className="w-6 h-6 rounded-full border-2 border-[#E39A5E]/30 border-t-[#E39A5E] animate-spin" />
        </div>
      </div>
    );
  }

  // ── Login screen — if no authenticated user ───────────────────────────
  if (!authUser) {
    return (
      <>
        <AuthScreen
          onContinueAsGuest={() => {
            setAuthUser({ id: 'guest', name: 'Tamu' });
            syncWithSupabaseUser('guest', 'tamu@monetra.app', 'Tamu Monetra');
          }}
        />
        <Toast />
      </>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] flex relative selection:bg-[#E39A5E]/20 selection:text-[#E39A5E] transition-colors duration-200">
      {/* Aurora Ambient Mesh Background */}
      <div className="aurora-mesh" aria-hidden="true">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Desktop Sidebar */}
      <SidebarNav />

      {/* Mobile Top App Bar (Header HP) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 px-4 py-2.5 bg-[var(--bg-base)]/85 border-b border-[var(--glass-border)] flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-black/25 border border-[rgba(235,245,255,0.2)] shrink-0 flex items-center justify-center">
            <img src="/favicon.svg" alt="Logo FinAI" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xs font-bold font-display text-[var(--text-primary)] leading-tight tracking-tight">FinAI</h1>
            <p className="text-[10px] text-[var(--text-secondary)] leading-none">
              {activeTab === 'beranda'
                ? 'Beranda'
                : activeTab === 'transaksi'
                ? 'Transaksi'
                : activeTab === 'statistik'
                ? 'Statistik & Analisis'
                : activeTab === 'asisten'
                ? 'Asisten FinAI'
                : activeTab === 'budget'
                ? 'Budget & Target'
                : 'Pengaturan & Akun'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            className="w-9 h-9 rounded-xl glass-2 border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Visual Separator */}
          <div className="w-[1px] h-4.5 bg-[var(--glass-border)]" aria-hidden="true" />

          {/* User Profile Avatar -> Tap to open Pengaturan / Akun */}
          <button
            type="button"
            onClick={() => setActiveTab('pengaturan')}
            aria-label="Buka Akun & Pengaturan"
            className={`w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 ${
              activeTab === 'pengaturan'
                ? 'ring-2 ring-[#E39A5E] ring-offset-2 ring-offset-[var(--bg-base)] shadow-md shadow-[#E39A5E]/25 scale-105'
                : 'border border-[var(--glass-border)] hover:border-[#E39A5E]/50'
            }`}
            title="Buka Akun & Pengaturan"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nama} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center font-bold text-xs">
                {(profile.nama || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 z-10 px-4 sm:px-6 md:px-8 pt-16 md:pt-6 pb-28 sm:pb-32 md:pb-8">
        {renderActiveView()}
      </main>

      {/* Mobile Floating Bottom Nav & Chatbot Mascot */}
      <BottomNav />
      <FloatingMascot />

      {/* Global Modals & Toast */}
      <VoiceModal />
      <QuickManualModal />
      <Toast />
    </div>
  );
}
