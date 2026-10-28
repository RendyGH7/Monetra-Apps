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
import { VoiceModal } from './components/voice/VoiceModal';
import { QuickManualModal } from './components/common/QuickManualModal';
import { Toast } from './components/common/Toast';

export default function App() {
  const { activeTab, syncWithSupabaseUser, showToast } = useAppStore();

  useEffect(() => {
    // Listen for Supabase Google Auth session changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          syncWithSupabaseUser(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name || session.user.email
          );
          if (event === 'SIGNED_IN') {
            showToast('Berhasil masuk dengan akun Google.');
          }
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [syncWithSupabaseUser, showToast]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'beranda':
        return <DashboardPage />;
      case 'transaksi':
        return <TransactionsPage />;
      case 'statistik':
        return <AnalyticsPage />;
      case 'asisten':
        return <AssistantPage />;
      case 'budget':
        return <BudgetPage />;
      case 'pengaturan':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-dvh bg-[#070A0F] text-[#EEF2F6] flex relative selection:bg-[#E39A5E]/20 selection:text-[#E39A5E]">
      {/* Aurora Ambient Mesh Background */}
      <div className="aurora-mesh" aria-hidden="true">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Desktop & Tablet Sidebar */}
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
