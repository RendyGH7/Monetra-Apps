import React, { useState, useEffect } from 'react';
import {
  Edit2,
  ShieldCheck,
  Download,
  AlertCircle,
  LogIn,
  LogOut,
  User,
  Check,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { stripEmoji } from '../../utils/format';

export const SettingsPage: React.FC = () => {
  const { profile, updateProfile, showToast, signOut, transactions } = useAppStore();

  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(profile.nama);
  const [salary, setSalary] = useState(String(profile.monthly_income));
  const [payDay, setPayDay] = useState(String(profile.pay_day));
  const [datingBudget, setDatingBudget] = useState(String(profile.dating_budget_est));

  useEffect(() => {
    setName(profile.nama);
    setSalary(String(profile.monthly_income));
    setPayDay(String(profile.pay_day));
    setDatingBudget(String(profile.dating_budget_est));
  }, [profile.nama, profile.monthly_income, profile.pay_day, profile.dating_budget_est]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      nama: stripEmoji(name),
      monthly_income: parseInt(salary.replace(/[^\d]/g, ''), 10) || 1500000,
      pay_day: parseInt(payDay, 10) || 25,
      dating_budget_est: parseInt(datingBudget.replace(/[^\d]/g, ''), 10) || 600000,
    });
    setEditingProfile(false);
    showToast('Profil finansial diperbarui.');
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#EEF2F6]">
                {profile.id === 'default' ? 'Keamanan Data Akun' : profile.nama}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4FD3A4]/20 text-[#4FD3A4] font-medium">
                {profile.id === 'default' ? 'Mode Tamu' : 'Terhubung Google'}
              </span>
            </div>
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
              <label className="text-xs text-[#A3AFBC]">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl glass-2 text-xs text-[#EEF2F6] mt-1 outline-none focus:border-[#E39A5E]"
              />
            </div>
            <div>
              <label className="text-xs text-[#A3AFBC]">Gaji Pokok Magang (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={salary}
                onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-10 px-3 rounded-xl glass-2 text-xs text-[#EEF2F6] mt-1 outline-none focus:border-[#E39A5E]"
              />
            </div>
            <div>
              <label className="text-xs text-[#A3AFBC]">Tanggal Gajian</label>
              <input
                type="number"
                min={1}
                max={31}
                value={payDay}
                onChange={(e) => setPayDay(e.target.value)}
                className="w-full h-10 px-3 rounded-xl glass-2 text-xs text-[#EEF2F6] mt-1 outline-none focus:border-[#E39A5E]"
              />
            </div>
            <div>
              <label className="text-xs text-[#A3AFBC]">Target Budget Kencan Bulanan (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={datingBudget}
                onChange={(e) => setDatingBudget(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-10 px-3 rounded-xl glass-2 text-xs text-[#EEF2F6] mt-1 outline-none focus:border-[#E39A5E]"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#E39A5E] text-[#1C0E04] text-xs font-semibold hover:brightness-105 cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl glass-2">
              <p className="text-[#A3AFBC]">Status</p>
              <p className="font-semibold text-[#EEF2F6] mt-0.5">{profile.internship_status}</p>
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
              <p className="font-semibold text-[#E39A5E] mt-0.5 truncate">{profile.side_hustle_status}</p>
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
    </div>
  );
};
