import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useAppStore } from '../../store';
import { TransactionType, NeedWantType } from '../../types';
import { stripEmoji } from '../../utils/format';

export const QuickManualModal: React.FC = () => {
  const { quickManualOpen, setQuickManualOpen, addTransaction, categories, wallets } = useAppStore();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-food');
  const [walletId, setWalletId] = useState(wallets[0]?.id || 'wallet-cash');

  if (!quickManualOpen) return null;

  const quickAmounts = [10000, 20000, 50000, 100000, 150000, 200000];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount.replace(/[^\d]/g, ''), 10);
    if (!num || num <= 0) return;

    const cat = categories.find((c) => c.id === categoryId);
    const needWant: NeedWantType = cat?.need_want || 'need';

    addTransaction({
      user_id: 'default',
      type,
      amount: num,
      note: stripEmoji(note || cat?.name || 'Transaksi Manual'),
      category_id: categoryId,
      wallet_id: walletId,
      occurred_at: new Date().toISOString(),
      source: 'manual',
      confidence: 1.0,
    });

    setAmount('');
    setNote('');
    setQuickManualOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) setQuickManualOpen(false); }}
    >
      <div className="animate-slide-up sm:animate-scale-in glass-3 w-full max-w-md overflow-hidden border border-[rgba(205,225,245,0.18)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(205,225,245,0.1)]">
          <h2 className="text-base font-semibold text-[#EEF2F6]">Catat Transaksi Manual</h2>
          <button
            type="button"
            onClick={() => setQuickManualOpen(false)}
            className="btn-ghost p-1.5 rounded-lg text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`chip-press py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                type === 'expense'
                  ? 'bg-[#EE5D6C] text-white shadow-sm'
                  : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`chip-press py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                type === 'income'
                  ? 'bg-[#4FD3A4] text-[#1C0E04] shadow-sm'
                  : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              Pemasukan
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3AFBC]">Nominal (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="0"
              value={amount ? new Intl.NumberFormat('id-ID').format(parseInt(amount.replace(/[^\d]/g, '') || '0', 10)) : ''}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              className="input-glow w-full h-12 px-4 rounded-xl glass-2 text-xl font-bold font-display text-[#EEF2F6] border border-white/[0.08] outline-none"
            />
          </div>

          {/* Quick amount chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="chip-press px-2.5 py-1 rounded-lg glass-1 text-xs text-[#A3AFBC] hover:text-[#EEF2F6] border border-transparent hover:border-[#E39A5E]/40 cursor-pointer"
                style={{ transition: 'border-color 0.15s ease, color 0.15s ease' }}
              >
                Rp {new Intl.NumberFormat('id-ID').format(q)}
              </button>
            ))}
          </div>

          {/* Note input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3AFBC]">Keterangan / Catatan</label>
            <input
              type="text"
              placeholder="Contoh: Makan siang warteg, bensin motor"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-glow w-full h-11 px-4 rounded-xl glass-1 text-sm text-[#EEF2F6] border border-white/[0.08] outline-none"
            />
          </div>

          {/* Category selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3AFBC]">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-glow w-full h-11 px-3 rounded-xl glass-1 text-sm text-[#EEF2F6] bg-[var(--bg-elevated)] border border-white/[0.08] outline-none cursor-pointer"
            >
              {categories
                .filter((c) => c.type === type)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Wallet selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3AFBC]">Sumber Dana / Dompet</label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="input-glow w-full h-11 px-3 rounded-xl glass-1 text-sm text-[#EEF2F6] bg-[var(--bg-elevated)] border border-white/[0.08] outline-none cursor-pointer"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (Saldo: Rp {new Intl.NumberFormat('id-ID').format(w.balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickManualOpen(false)}
              className="btn-ghost px-4 py-2.5 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs text-[#EEF2F6] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold cursor-pointer shadow-md shadow-black/40 flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>Simpan Transaksi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
