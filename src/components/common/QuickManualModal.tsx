import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  Wallet as WalletIcon,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { TransactionType, NeedWantType } from '../../types';
import { stripEmoji, formatCurrency } from '../../utils/format';
import { CategoryIcon } from './CategoryIcon';

export const QuickManualModal: React.FC = () => {
  const { quickManualOpen, setQuickManualOpen, addTransaction, categories, wallets, showToast } =
    useAppStore();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-food');
  const [walletId, setWalletId] = useState(wallets[0]?.id || 'wallet-cash');

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update category when switching type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const available = categories.filter((c) => c.type === newType);
    if (available.length > 0) {
      setCategoryId(available[0].id);
    }
  };

  if (!quickManualOpen) return null;

  const quickAmounts = [
    { label: '10rb', value: 10000 },
    { label: '20rb', value: 20000 },
    { label: '50rb', value: 50000 },
    { label: '100rb', value: 100000 },
    { label: '200rb', value: 200000 },
    { label: '500rb', value: 500000 },
  ];

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCategory = categories.find((c) => c.id === categoryId) || filteredCategories[0];
  const selectedWallet = wallets.find((w) => w.id === walletId) || wallets[0];

  const getWalletIcon = (name: string) => {
    const l = name.toLowerCase();
    if (l.includes('bank') || l.includes('bca') || l.includes('mandiri')) return <CreditCard size={15} />;
    if (l.includes('e-wallet') || l.includes('gopay') || l.includes('ovo') || l.includes('dana'))
      return <Smartphone size={15} />;
    return <Banknote size={15} />;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amount.replace(/[^\d]/g, ''), 10);
    if (!num || num <= 0) return;

    const needWant: NeedWantType = selectedCategory?.need_want || (type === 'income' ? 'saving' : 'need');

    addTransaction({
      user_id: 'default',
      type,
      amount: num,
      note: stripEmoji(note || selectedCategory?.name || 'Transaksi Manual'),
      category_id: selectedCategory?.id || categoryId,
      wallet_id: selectedWallet?.id || walletId,
      occurred_at: new Date().toISOString(),
      source: 'manual',
      confidence: 1.0,
    });

    showToast(`Transaksi ${formatCurrency(num)} berhasil dicatat.`);
    setAmount('');
    setNote('');
    setQuickManualOpen(false);
  };

  const numAmount = parseInt(amount.replace(/[^\d]/g, '') || '0', 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) setQuickManualOpen(false);
      }}
    >
      <div className="animate-slide-up sm:animate-scale-in bg-[var(--bg-elevated)] w-full max-w-lg overflow-hidden border border-[var(--glass-border)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-base)]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center shrink-0">
              <PlusCircle size={17} />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-1 leading-tight">
                Catat Transaksi Manual
              </h2>
              <p className="text-xs text-ink-2 mt-0.5">
                Masukkan rincian pengeluaran atau pemasukan baru
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuickManualOpen(false)}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink-1 hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Type Toggle: Pengeluaran vs Pemasukan */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-base)] border border-[var(--glass-border)]">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                type === 'expense'
                  ? 'bg-[var(--expense)]/15 border border-[var(--expense)]/30 text-[var(--expense)] shadow-sm'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
            >
              <TrendingDown size={14} />
              <span>Pengeluaran</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                type === 'income'
                  ? 'bg-[var(--income)]/15 border border-[var(--income)]/30 text-[var(--income)] shadow-sm'
                  : 'text-ink-2 hover:text-ink-1'
              }`}
            >
              <TrendingUp size={14} />
              <span>Pemasukan</span>
            </button>
          </div>

          {/* Amount input with prefix and clear button */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-2">
              Nominal Transaksi
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-base font-bold text-[var(--accent)] select-none pointer-events-none">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={numAmount > 0 ? new Intl.NumberFormat('id-ID').format(numAmount) : ''}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-12 pl-12 pr-10 rounded-xl bg-[var(--bg-base)] text-xl sm:text-2xl font-bold font-display text-ink-1 border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none transition-all placeholder:text-ink-3"
              />
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="absolute right-3 p-1 rounded-md text-ink-3 hover:text-ink-1 cursor-pointer"
                  title="Hapus nominal"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Quick amount chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {quickAmounts.map((q) => {
              const isSelected = numAmount === q.value;
              return (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => setAmount(String(q.value))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] font-semibold shadow-sm'
                      : 'bg-[var(--bg-base)] border border-[var(--glass-border)] text-ink-2 hover:text-ink-1 hover:border-[var(--accent)]/40'
                  }`}
                >
                  +{q.label}
                </button>
              );
            })}
          </div>

          {/* Note input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-2">
              Keterangan / Catatan
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-ink-3 pointer-events-none">
                <FileText size={15} />
              </span>
              <input
                type="text"
                placeholder="Contoh: Makan siang warteg, bensin motor"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-[var(--bg-base)] text-xs sm:text-sm text-ink-1 border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none transition-colors placeholder:text-ink-3"
              />
            </div>
          </div>

          {/* Custom Category Dropdown */}
          <div className="space-y-1.5 relative" ref={categoryRef}>
            <label className="text-xs font-medium text-ink-2">Kategori</label>
            <button
              type="button"
              onClick={() => {
                setCategoryDropdownOpen(!categoryDropdownOpen);
                setWalletDropdownOpen(false);
              }}
              className="w-full h-11 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--glass-border)] flex items-center justify-center shrink-0">
                  <CategoryIcon name={selectedCategory?.name || 'Makanan & Minuman'} size={15} color="var(--accent)" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-ink-1 truncate">
                  {selectedCategory?.name || 'Pilih Kategori'}
                </span>
                {selectedCategory?.need_want && (
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-ink-3 border border-[var(--glass-border)] shrink-0">
                    {selectedCategory.need_want}
                  </span>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`text-ink-2 transition-transform ${categoryDropdownOpen ? 'rotate-180 text-[var(--accent)]' : ''}`}
              />
            </button>

            {/* Floating Dropdown List */}
            {categoryDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl bg-[var(--bg-elevated)] border border-[var(--glass-border)] shadow-2xl p-1.5 max-h-56 overflow-y-auto custom-scrollbar space-y-0.5 animate-scale-in">
                {filteredCategories.map((cat) => {
                  const isCur = cat.id === selectedCategory?.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                          : 'text-ink-1 hover:bg-[var(--bg-base)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-[var(--bg-base)] flex items-center justify-center shrink-0">
                          <CategoryIcon name={cat.name} size={14} color={isCur ? 'var(--accent)' : 'var(--text-secondary)'} />
                        </div>
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cat.need_want && (
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-ink-3 border border-[var(--glass-border)]">
                            {cat.need_want}
                          </span>
                        )}
                        {isCur && <Check size={14} className="text-[var(--accent)]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Wallet Dropdown */}
          <div className="space-y-1.5 relative" ref={walletRef}>
            <label className="text-xs font-medium text-ink-2">
              Sumber Dana / Dompet
            </label>
            <button
              type="button"
              onClick={() => {
                setWalletDropdownOpen(!walletDropdownOpen);
                setCategoryDropdownOpen(false);
              }}
              className="w-full h-11 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--income)] flex items-center justify-center shrink-0">
                  {getWalletIcon(selectedWallet?.name || '')}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-medium text-ink-1 truncate">
                    {selectedWallet?.name || 'Pilih Dompet'}
                  </span>
                  <span className="text-[11px] text-[var(--income)] font-medium num-tabular">
                    (Saldo: {formatCurrency(selectedWallet?.balance || 0)})
                  </span>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-ink-2 transition-transform ${walletDropdownOpen ? 'rotate-180 text-[var(--accent)]' : ''}`}
              />
            </button>

            {/* Floating Wallet Dropdown List */}
            {walletDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl bg-[var(--bg-elevated)] border border-[var(--glass-border)] shadow-2xl p-1.5 max-h-52 overflow-y-auto custom-scrollbar space-y-0.5 animate-scale-in">
                {wallets.map((w) => {
                  const isCur = w.id === selectedWallet?.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setWalletId(w.id);
                        setWalletDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                          : 'text-ink-1 hover:bg-[var(--bg-base)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-[var(--bg-base)] text-[var(--income)] flex items-center justify-center shrink-0">
                          {getWalletIcon(w.name)}
                        </div>
                        <span className="truncate">{w.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-[var(--income)] num-tabular">
                          {formatCurrency(w.balance)}
                        </span>
                        {isCur && <Check size={14} className="text-[var(--accent)]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setQuickManualOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[var(--glass-border)] text-xs font-medium text-ink-2 hover:text-ink-1 hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0}
              className="btn-primary px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold cursor-pointer shadow-md shadow-black/20 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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

