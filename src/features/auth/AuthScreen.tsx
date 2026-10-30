import React, { useState } from 'react';
import { ArrowRight, UserCheck, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Google "G" SVG resmi — tajam dan presisi
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

interface AuthScreenProps {
  onContinueAsGuest: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onContinueAsGuest }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (authError) {
        setError('Gagal menghubungkan ke Google. Silakan coba lagi.');
        setLoading(false);
      }
    } catch {
      setError('Terjadi kendala saat membuka otentikasi. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#070A0F] overflow-hidden select-none">
      {/* ── Background: Subtle Ambient Aurora Glow (Minimal & Non-distracting) ── */}
      <div className="aurora-mesh" aria-hidden="true">
        <div className="aurora-orb-1 opacity-60" />
        <div className="aurora-orb-2 opacity-40" />
      </div>

      {/* Subtle Dot Grid */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Ambient Center Glow */}
      <div
        className="absolute w-[480px] h-[480px] rounded-full bg-[#E39A5E]/10 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* ── Main Auth Card: Clean, Minimalist & Focused ── */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        <div className="glass-3 p-7 sm:p-9 rounded-3xl border border-[rgba(227,154,94,0.22)] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-6">
          {/* Brand Logo & Clean Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl shadow-black/50 border border-[rgba(235,245,255,0.2)] bg-[#0E131A] p-1 flex items-center justify-center transition-transform hover:scale-105 duration-200">
              <img src="/favicon.svg" alt="Logo Monetra" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-1">
              <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
                Masuk ke Monetra
              </h1>
              <p className="text-xs sm:text-sm text-[#A3AFBC] leading-relaxed">
                Kelola keuangan pribadi cerdas berbasis suara dan AI.
              </p>
            </div>
          </div>

          {/* Primary Action: Google Login */}
          <div className="space-y-3">
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-press group relative w-full h-12 rounded-xl bg-white text-[#1C0E04] font-semibold text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-md shadow-black/30 hover:shadow-[0_4px_20px_rgba(227,154,94,0.35)] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-[#1C0E04]/30 border-t-[#1C0E04] animate-spin" />
                  <span className="text-xs">Menghubungkan ke Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <span>Lanjutkan dengan Google</span>
                  <ArrowRight size={15} className="text-[#1C0E04]/60 group-hover:translate-x-0.5 transition-transform ml-0.5" />
                </>
              )}
            </button>

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-xs text-[#EE5D6C] text-center">
                {error}
              </div>
            )}
          </div>

          {/* Clean Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[11px] text-[#74808E]">atau</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Secondary Action: Guest Mode */}
          <div>
            <button
              id="btn-guest-continue"
              type="button"
              onClick={onContinueAsGuest}
              className="btn-ghost w-full h-11 rounded-xl glass-2 border border-white/[0.1] hover:border-[#E39A5E]/40 hover:bg-[#E39A5E]/10 text-xs font-semibold text-[#EEF2F6] cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <UserCheck size={14} className="text-[#E39A5E]" />
              <span>Lanjutkan sebagai Tamu</span>
            </button>
          </div>

          {/* Minimalist Trust & Privacy Caption */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[11px] text-[#74808E]">
            <Shield size={12} className="text-[#4FD3A4]" />
            <span>Data tersinkronisasi aman di cloud akun Google kamu</span>
          </div>
        </div>
      </div>
    </div>
  );
};
