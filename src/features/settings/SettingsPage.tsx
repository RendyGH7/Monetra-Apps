import React, { useState, useEffect } from 'react';
import {
  Edit2,
  ShieldCheck,
  Download,
  AlertCircle,
  AlertTriangle,
  LogIn,
  LogOut,
  User,
  Check,
  RotateCcw,
  Calendar,
  ChevronUp,
  ChevronDown,
  Briefcase,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { stripEmoji } from '../../utils/format';

export const SettingsPage: React.FC = () => {
  const { profile, updateProfile, showToast, signOut, transactions, resetAllData } = useAppStore();

  const [editingProfile, setEditingProfile] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [status, setStatus] = useState(profile.internship_status || '-');
  const [salary, setSalary] = useState(String(profile.monthly_income));
  const [payDay, setPayDay] = useState(String(profile.pay_day));
  const [sideHustle, setSideHustle] = useState(profile.side_hustle_status || '-');

  // Close modal on Escape key
  useEffect(() => {
    if (!showResetConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowResetConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResetConfirm]);

  useEffect(() => {
    setStatus(profile.internship_status || '-');
    setSalary(String(profile.monthly_income));
    setPayDay(String(profile.pay_day));
    setSideHustle(profile.side_hustle_status || '-');
  }, [profile.internship_status, profile.monthly_income, profile.pay_day, profile.side_hustle_status]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      internship_status: stripEmoji(status).trim() || '-',
      monthly_income: parseInt(salary.replace(/[^\d]/g, ''), 10) || 0,
      pay_day: parseInt(payDay, 10) || 25,
      side_hustle_status: stripEmoji(sideHustle).trim() || '-',
    });
    setEditingProfile(false);
    showToast('Profil finansial berhasil diperbarui.');
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transactions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'finai_transaksi_export.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Berkas transaksi berhasil diekspor.');
  };

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
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
          Pengaturan & Memori AI
        </h1>
        <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
          Kontrol data pribadi, akun Google, dan fakta yang diingat AI tentangmu
        </p>
      </div>

      {/* Google Account & Cloud Sync Status Card */}
      <div className="glass-2 p-5 rounded-2xl border-[rgba(205,225,245,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.nama}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover border border-[#4FD3A4]/30 shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#4FD3A4]/15 border border-[#4FD3A4]/30 text-[#4FD3A4] flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-[#EEF2F6]">
              {profile.id === 'default' ? 'Keamanan Data Akun' : profile.nama}
            </h2>
            <p className="text-xs text-[#A3AFBC] mt-1 leading-relaxed">
              {profile.id === 'default'
                ? 'Data tersimpan di penyimpanan lokal browser. Sambungkan akun Google untuk backup awan otomatis.'
                : `Masuk sebagai ${profile.email || profile.nama}. Data kamu tersinkronisasi dengan akun Google.`}
            </p>
          </div>
        </div>

        <div className="shrink-0 self-end sm:self-center">
          {profile.id === 'default' ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold text-xs flex items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer shadow-md"
            >
              <LogIn size={15} />
              <span>Sambungkan Akun Google</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2 rounded-xl border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-medium hover:bg-[#EE5D6C]/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={15} />
              <span>Keluar dari Akun</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Profile Card */}
      <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">
            Profil & Alokasi Finansial
          </h2>
          <button
            type="button"
            onClick={() => setEditingProfile(!editingProfile)}
            className="text-xs text-[#E39A5E] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Edit2 size={13} />
            <span>{editingProfile ? 'Batal' : 'Edit Profil'}</span>
          </button>
        </div>

        {editingProfile ? (
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#A3AFBC]">Status</label>
              <div className="relative flex items-center mt-1">
                <span className="absolute left-3 text-[#A3AFBC] pointer-events-none">
                  <Briefcase size={14} />
                </span>
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Status (misal: Karyawan, Magang, dll)"
                  className="w-full h-10 pl-9 pr-3 rounded-xl glass-2 text-xs text-[#EEF2F6] outline-none border border-[var(--glass-border)] focus:border-[#E39A5E] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#A3AFBC]">Gaji Bulanan</label>
              <div className="relative flex items-center mt-1">
                <span className="absolute left-3 text-xs font-bold text-[#4FD3A4] pointer-events-none">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={salary ? new Intl.NumberFormat('id-ID').format(Number(salary)) : ''}
                  onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  className="w-full h-10 pl-9 pr-3 rounded-xl glass-2 text-xs text-[#EEF2F6] font-semibold num-tabular outline-none border border-[var(--glass-border)] focus:border-[#4FD3A4] transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#A3AFBC]">Tanggal Gajian</label>
                <span className="text-[10px] text-[#E39A5E] font-medium num-tabular">
                  Tiap tgl {payDay || 25}
                </span>
              </div>
              <div className="relative flex items-center mt-1">
                <div className="absolute left-3 text-[#E39A5E] flex items-center justify-center pointer-events-none">
                  <Calendar size={14} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payDay}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    const num = parseInt(val, 10);
                    if (!val) setPayDay('');
                    else if (num >= 1 && num <= 31) setPayDay(String(num));
                    else if (num > 31) setPayDay('31');
                  }}
                  placeholder="25"
                  className="w-full h-10 pl-9 pr-20 rounded-xl glass-2 text-xs text-[#EEF2F6] font-semibold num-tabular outline-none border border-[var(--glass-border)] focus:border-[#E39A5E] transition-all"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseInt(payDay, 10) || 25;
                      const next = cur > 1 ? cur - 1 : 31;
                      setPayDay(String(next));
                    }}
                    className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-[#E39A5E]/20 text-[#A3AFBC] hover:text-[#E39A5E] border border-white/[0.08] hover:border-[#E39A5E]/40 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                    title="Kurangi tanggal"
                  >
                    <ChevronDown size={13} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseInt(payDay, 10) || 25;
                      const next = cur < 31 ? cur + 1 : 1;
                      setPayDay(String(next));
                    }}
                    className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-[#E39A5E]/20 text-[#A3AFBC] hover:text-[#E39A5E] border border-white/[0.08] hover:border-[#E39A5E]/40 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                    title="Tambah tanggal"
                  >
                    <ChevronUp size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              {/* Quick shortcut chips */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-[#74808E]">Umum:</span>
                {[1, 25, 28, 30].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPayDay(String(day))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                      Number(payDay) === day
                        ? 'bg-[#E39A5E]/25 text-[#E39A5E] border border-[#E39A5E]/50 font-bold shadow-xs'
                        : 'bg-white/[0.04] text-[#A3AFBC] hover:text-[#EEF2F6] hover:bg-white/[0.08] border border-white/[0.06]'
                    }`}
                  >
                    Tgl {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-1">
              <label className="text-xs text-[#A3AFBC]">Bisnis Sampingan</label>
              <div className="relative flex items-center mt-1">
                <span className="absolute left-3 text-[#A3AFBC] pointer-events-none">
                  <TrendingUp size={14} />
                </span>
                <input
                  type="text"
                  value={sideHustle}
                  onChange={(e) => setSideHustle(e.target.value)}
                  placeholder="Bisnis Sampingan (misal: Toko Online, Freelance, atau -)"
                  className="w-full h-10 pl-9 pr-3 rounded-xl glass-2 text-xs text-[#EEF2F6] outline-none border border-[var(--glass-border)] focus:border-[#E39A5E] transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex justify-end pt-1">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-md shadow-black/25"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl glass-2">
              <p className="text-[#A3AFBC]">Status</p>
              <p className="font-semibold text-[#EEF2F6] mt-0.5">{profile.internship_status || '-'}</p>
            </div>
            <div className="p-3 rounded-xl glass-2">
              <p className="text-[#A3AFBC]">Gaji Bulanan</p>
              <p className="font-semibold text-[#4FD3A4] num-tabular mt-0.5">
                Rp {new Intl.NumberFormat('id-ID').format(profile.monthly_income)}
              </p>
            </div>
            <div className="p-3 rounded-xl glass-2">
              <p className="text-[#A3AFBC]">Tanggal Gajian</p>
              <p className="font-semibold text-[#EEF2F6] mt-0.5">Tanggal {profile.pay_day}</p>
            </div>
            <div className="p-3 rounded-xl glass-2">
              <p className="text-[#A3AFBC]">Bisnis Sampingan</p>
              <p className="font-semibold text-[#E39A5E] mt-0.5 truncate">{profile.side_hustle_status || '-'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Export & Privacy Card */}
      <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#EEF2F6]">Ekspor Cadangan Data</h2>
          <p className="text-xs text-[#A3AFBC] mt-0.5">
            Unduh seluruh riwayat transaksi ke dalam berkas JSON untuk backup mandiri
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportData}
          className="px-4 py-2 rounded-xl glass-2 border border-white/[0.1] text-xs text-[#EEF2F6] font-medium hover:border-[#E39A5E]/40 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download size={15} />
          <span>Ekspor JSON</span>
        </button>
      </div>

      {/* Danger Zone: Reset All Data */}
      <div className="glass-1 p-5 rounded-2xl border border-[#EE5D6C]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#EE5D6C]">Kosongkan Semua Data</h2>
          <p className="text-xs text-[#A3AFBC] mt-0.5">
            Hapus seluruh catatan transaksi, target, memori AI, dan kembalikan saldo ke Rp 0.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2 rounded-xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/40 text-[#EE5D6C] text-xs font-semibold hover:bg-[#EE5D6C]/25 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
        >
          <RotateCcw size={14} />
          <span>Kosongkan Data</span>
        </button>
      </div>

      {/* Modal Konfirmasi Kosongkan Data: Elegan, Bersih, dan Reassuring */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div className="w-full max-w-md bg-[var(--bg-elevated)] border border-[#EE5D6C]/30 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-in relative">
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <div className="w-14 h-14 rounded-2xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-[#EE5D6C] flex items-center justify-center shadow-lg shadow-[#EE5D6C]/15">
                <AlertTriangle size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                  Kosongkan Seluruh Data?
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                  Semua catatan transaksi, alokasi dompet, target tabungan, dan memori AI akan dikembalikan ke kondisi awal (Rp 0).
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#EE5D6C]/10 border border-[#EE5D6C]/25 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#EE5D6C]">
                <AlertCircle size={14} className="shrink-0" />
                <span>Tindakan ini permanen</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Data yang sudah dikosongkan tidak dapat dipulihkan. Jika perlu, gunakan tombol <strong>Ekspor JSON</strong> terlebih dahulu untuk menyimpan cadangan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--glass-border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  setShowResetConfirm(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EE5D6C] hover:bg-[#d94857] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-[#EE5D6C]/25 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Ya, Kosongkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
