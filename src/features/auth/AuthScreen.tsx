import React, { useState } from 'react';
import { Mic, ShieldCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Google "G" SVG — inline untuk menghindari dependensi tambahan
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
        setError('Gagal menghubungkan ke Google. Periksa koneksi dan coba lagi.');
        setLoading(false);
      }
      // On success: browser redirects, nothing else needed
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  };

  const features = [
    { icon: TrendingUp, text: 'Pantau pengeluaran harian secara real-time' },
    { icon: Mic, text: 'Catat transaksi cukup dengan bicara' },
    { icon: ShieldCheck, text: 'Data terenkripsi dan terlindungi RLS Supabase' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh bg-[#070A0F] overflow-hidden">
      {/* Aurora ambient background */}
      <div className="aurora-mesh" aria-hidden="true">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Left panel — desktop only branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] flex items-center justify-center shadow-lg shadow-black/40 border border-[rgba(235,245,255,0.3)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C0E04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 13h2l2-6 3 12 3-8 2 4h2l3-7 3 5h2" />
            </svg>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-[#EEF2F6]">FinAI</span>
        </div>

        {/* Headline copy */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-display font-bold text-4xl xl:text-5xl leading-tight tracking-tight text-[#EEF2F6]">
              Keuangan magang<br />
              <span className="text-[#E39A5E]">tetap aman</span>,<br />
              kencan tetap jalan.
            </h1>
            <p className="text-[#A3AFBC] text-base leading-relaxed max-w-sm">
              Asisten keuangan pribadi yang memahami ritme hidup sebagai mahasiswa magang dengan gaji terbatas.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[#A3AFBC]">
                <div className="w-7 h-7 rounded-lg bg-[#E39A5E]/15 border border-[#E39A5E]/30 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-[#E39A5E]" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom badge */}
        <div className="flex items-center gap-2 text-[11px] text-[#74808E]">
          <ShieldCheck size={13} className="text-[#4FD3A4]" />
          <span>Data disimpan aman dengan Supabase Row Level Security</span>
        </div>
      </div>

      {/* Right panel — login card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        <div className="animate-scale-in w-full max-w-sm">
          {/* Card */}
          <div className="glass-3 p-8 rounded-3xl border border-[rgba(205,225,245,0.18)] space-y-7 shadow-2xl">
            {/* Mobile brand */}
            <div className="lg:hidden flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E39A5E] to-[#CF8143] flex items-center justify-center shadow-lg shadow-black/40 border border-[rgba(235,245,255,0.3)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1C0E04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 13h2l2-6 3 12 3-8 2 4h2l3-7 3 5h2" />
                </svg>
              </div>
              <div>
                <p className="font-display font-bold text-2xl text-[#EEF2F6] tracking-tight">FinAI</p>
                <p className="text-xs text-[#A3AFBC]">Asisten Keuangan Mahasiswa Magang</p>
              </div>
            </div>

            {/* Login header */}
            <div className="space-y-1">
              <h2 className="font-display font-bold text-xl text-[#EEF2F6] tracking-tight">
                Masuk ke akunmu
              </h2>
              <p className="text-xs text-[#A3AFBC] leading-relaxed">
                Data transaksimu tersinkron di semua perangkat dan tidak hilang saat logout.
              </p>
            </div>

            {/* Google login button */}
            <div className="space-y-3">
              <button
                id="btn-google-login"
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="btn-press relative w-full h-12 rounded-xl bg-white text-[#1C0E04] font-semibold text-sm flex items-center justify-center gap-3 cursor-pointer shadow-md shadow-black/30 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ transition: 'filter 0.15s ease, transform 0.1s ease' }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.filter = 'brightness(0.96)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-[#1C0E04]/30 border-t-[#1C0E04] animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon size={20} />
                    <span>Lanjutkan dengan Google</span>
                  </>
                )}
              </button>

              {/* Error message */}
              {error && (
                <div className="animate-slide-up p-3 rounded-xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-xs text-[#EE5D6C] text-center">
                  {error}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgba(205,225,245,0.1)]" />
              <span className="text-[11px] text-[#74808E]">atau</span>
              <div className="flex-1 h-px bg-[rgba(205,225,245,0.1)]" />
            </div>

            {/* Guest mode */}
            <div className="space-y-2">
              <button
                id="btn-guest-continue"
                type="button"
                onClick={onContinueAsGuest}
                className="btn-ghost w-full h-11 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs font-medium text-[#EEF2F6] cursor-pointer flex items-center justify-center gap-2"
              >
                Lanjutkan Tanpa Login
              </button>
              <p className="text-[10px] text-[#74808E] text-center leading-relaxed">
                Data mode tamu hanya tersimpan di perangkat ini dan tidak tersinkron.
              </p>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-[#74808E] text-center mt-5 leading-relaxed px-4">
            Dengan masuk, kamu menyetujui penggunaan data untuk tujuan pribadi dalam aplikasi ini.
          </p>
        </div>
      </div>
    </div>
  );
};
