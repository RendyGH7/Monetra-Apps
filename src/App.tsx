import React, { useEffect } from 'react';
import { useAppStore } from './store';
import { supabase } from './lib/supabase';
import { SidebarNav } from './components/layout/SidebarNav';
import { BottomNav } from './components/layout/BottomNav';
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
    setAuthLoading,
    setAuthUser,
    syncWithSupabaseUser,
    showToast,
  } = useAppStore();

  // ── Resolve Supabase session on first load ──────────────────────────────
  useEffect(() => {
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
        <AuthScreen onContinueAsGuest={() => setAuthUser({ id: 'guest' })} />
        <Toast />
      </>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-[#070A0F] text-[#EEF2F6] flex relative selection:bg-[#E39A5E]/20 selection:text-[#E39A5E]">
      {/* Aurora Ambient Mesh Background */}
      <div className="aurora-mesh" aria-hidden="true">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Desktop Sidebar */}
      <SidebarNav />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 z-10 px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-8">
        {renderActiveView()}
      </main>

      {/* Mobile Floating Bottom Nav */}
      <BottomNav />

      {/* Global Modals & Toast */}
      <VoiceModal />
      <QuickManualModal />
      <Toast />
    </div>
  );
}
