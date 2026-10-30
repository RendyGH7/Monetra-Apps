import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Mic,
  X,
  Edit3,
  Wallet as WalletIcon,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../../store';
import {
  formatCurrency,
  formatDateIndo,
  formatTimeShort,
  formatDateTimeWIB,
  getWIBDateString,
  stripEmoji,
} from '../../utils/format';
import { CategoryIcon } from '../../components/common/CategoryIcon';
import { Transaction, TransactionType, Category } from '../../types';

export const TransactionsPage: React.FC = () => {
  const {
    transactions,
    categories,
    wallets,
    deleteTransaction,
    updateTransaction,
    setQuickManualOpen,
    setVoiceModalOpen,
    showToast,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal States
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Chips horizontal scroll state
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Helper to reliably find category object for any transaction
  const getTxCategory = (tx: Transaction): Category | undefined => {
    if (!tx.category_id) {
      return categories.find((c) => c.type === tx.type) || categories[0];
    }
    return (
      categories.find((c) => c.id === tx.category_id) ||
      categories.find((c) => c.name.toLowerCase() === tx.category_id?.toLowerCase()) ||
      categories.find((c) => c.type === tx.type) ||
      categories[0]
    );
  };

  const checkScrollState = () => {
    if (chipsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = chipsScrollRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
    }
  };

  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [categories, selectedType]);

  const scrollChips = (direction: 'left' | 'right') => {
    if (chipsScrollRef.current) {
      const offset = direction === 'left' ? -200 : 200;
      chipsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScrollState, 200);
    }
  };

  // Handle switching transaction type tabs
  const handleTypeChange = (newType: TransactionType | 'all') => {
    setSelectedType(newType);
    if (newType === 'all') {
      setSelectedCategory('all');
    } else if (selectedCategory !== 'all') {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat && cat.type !== newType) {
        setSelectedCategory('all');
      }
    }
  };

  // Available categories for currently active type
  const availableCategories = useMemo(() => {
    if (selectedType === 'all') return categories;
    return categories.filter((c) => c.type === selectedType);
  }, [categories, selectedType]);

  // Count transactions per type for badge counts
  const totalExpenseCount = useMemo(
    () => transactions.filter((t) => t.type === 'expense').length,
    [transactions]
  );
  const totalIncomeCount = useMemo(
    () => transactions.filter((t) => t.type === 'income').length,
    [transactions]
  );

  // Helper to count transactions for each category under current type
  const getCategoryTxCount = (catId: string) => {
    return transactions.filter((t) => {
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      const txCat = getTxCategory(t);
      return txCat?.id === catId;
    }).length;
  };

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSearch('');
    setSelectedType('all');
    setSelectedCategory('all');
  };

  const isFilterActive = search.trim() !== '' || selectedType !== 'all' || selectedCategory !== 'all';

  // Smart filtered transaction list
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Filter by Type
      if (selectedType !== 'all' && t.type !== selectedType) return false;

      // 2. Filter by Category (robust matching by ID or Name)
      if (selectedCategory !== 'all') {
        const txCat = getTxCategory(t);
        if (txCat?.id !== selectedCategory) return false;
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const txCat = getTxCategory(t);
        const w = wallets.find((w) => w.id === t.wallet_id);

        // Numeric search (supports "200.000", "200rb", "200k", "200000")
        const cleanDigits = q.replace(/[^\d]/g, '');
        const matchesDigits = cleanDigits.length >= 2 && t.amount.toString().includes(cleanDigits);

        return (
          t.note.toLowerCase().includes(q) ||
          (t.merchant && t.merchant.toLowerCase().includes(q)) ||
          (txCat && txCat.name.toLowerCase().includes(q)) ||
          (w && w.name.toLowerCase().includes(q)) ||
          matchesDigits
        );
      }
      return true;
    });
  }, [transactions, selectedType, selectedCategory, search, categories, wallets]);

  // Group by WIB date
  const grouped: Record<string, Transaction[]> = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    filtered.forEach((t) => {
      const dStr = getWIBDateString(t.occurred_at);
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(t);
    });
    return map;
  }, [filtered]);

  // Sort dates descending (newest first)
  const sortedDates = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  }, [grouped]);

  // Open detail / edit modal
  const openDetailModal = (tx: Transaction) => {
    setViewingTx(tx);
    setEditNote(tx.note);
    setEditAmount(tx.amount.toString());
    setIsEditing(false);
  };

  // Handle saving changes
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTx) return;
    const num = parseInt(editAmount.replace(/[^\d]/g, ''), 10);
    if (!num || num <= 0) {
      showToast('Nominal transaksi harus lebih dari 0.');
      return;
    }
    updateTransaction(viewingTx.id, {
      note: stripEmoji(editNote) || viewingTx.note,
      amount: num,
    });
    setViewingTx({
      ...viewingTx,
      note: stripEmoji(editNote) || viewingTx.note,
      amount: num,
    });
    setIsEditing(false);
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (!txToDelete) return;
    deleteTransaction(txToDelete.id);
    if (viewingTx && viewingTx.id === txToDelete.id) {
      setViewingTx(null);
    }
    setTxToDelete(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-4 md:pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
            Riwayat Transaksi
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Total {transactions.length} transaksi tercatat dalam sistem
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            style={{ borderRadius: '0.75rem' }}
            className="btn-ghost flex-1 sm:flex-initial h-10 px-4 !rounded-xl glass-1 border border-white/[0.08] text-xs font-semibold text-[#EEF2F6] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap transition-all shadow-xs"
            title="Rekam Pengeluaran via Suara"
          >
            <Mic size={16} className="text-[#E39A5E]" strokeWidth={2.4} />
            <span>Rekam Suara</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickManualOpen(true)}
            style={{ borderRadius: '0.75rem' }}
            className="btn-primary flex-1 sm:flex-initial h-10 px-4 !rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-black/30 whitespace-nowrap transition-all"
            title="Tambah Transaksi Manual"
          >
            <Plus size={16} strokeWidth={2.4} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* ── FILTER & SEARCH SECTION ────────────────────────────────────────── */}
      <div className="glass-1 p-3.5 sm:p-4 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3AFBC]" />
          <input
            type="text"
            placeholder="Cari transaksi, kafe, warteg, dompet, nominal (cth: 20rb), atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow w-full h-10 pl-10 pr-9 rounded-xl glass-2 text-xs sm:text-sm text-[#EEF2F6] placeholder:text-[#74808E] border border-white/[0.08] outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 1: Primary Type Tabs (Semua / Pengeluaran / Pemasukan) */}
        <div className="flex items-center gap-2 border-b border-[rgba(205,225,245,0.08)] pb-2.5">
          {[
            {
              label: 'Semua Tipe',
              value: 'all' as const,
              count: transactions.length,
              activeClass: 'bg-[#E39A5E] text-[#1C0E04] border-transparent font-bold',
            },
            {
              label: 'Pengeluaran',
              value: 'expense' as const,
              count: totalExpenseCount,
              activeClass: 'bg-[#EE5D6C] text-white border-transparent font-bold',
            },
            {
              label: 'Pemasukan',
              value: 'income' as const,
              count: totalIncomeCount,
              activeClass: 'bg-[#4FD3A4] text-[#1C0E04] border-transparent font-bold',
            },
          ].map((chip) => {
            const isActive = selectedType === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => handleTypeChange(chip.value)}
                className={`chip-press px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all border ${
                  isActive
                    ? `${chip.activeClass} shadow-md`
                    : 'glass-2 border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#E39A5E]/40 font-medium'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive
                      ? 'bg-black/20 text-current'
                      : 'bg-white/[0.06] text-[#A3AFBC]'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Category Chips with Protected Scroll Controls (No Overlap) */}
        <div className="relative flex items-center">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-2 bg-gradient-to-r from-[#0D1219] via-[#0D1219]/90 to-transparent">
              <button
                type="button"
                onClick={() => scrollChips('left')}
                className="w-7 h-7 rounded-full glass-3 border border-[#E39A5E]/40 text-[#E39A5E] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Geser Kiri"
              >
                <ChevronLeft size={15} />
              </button>
            </div>
          )}

          <div
            ref={chipsScrollRef}
            onScroll={checkScrollState}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 text-xs w-full scroll-smooth"
          >
            {/* "Semua Kategori" Chip */}
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`chip-press px-3 py-1.5 rounded-xl shrink-0 text-xs cursor-pointer shadow-xs transition-all border flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-[#E39A5E]/20 text-[#E39A5E] font-semibold border-[#E39A5E]/60 shadow-sm'
                  : 'glass-2 border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#E39A5E]/40 font-medium'
              }`}
            >
              <Filter size={12} className={selectedCategory === 'all' ? 'text-[#E39A5E]' : 'text-[#A3AFBC]'} />
              <span>Semua Kategori</span>
            </button>

            {/* Individual Category Chips */}
            {availableCategories.map((c) => {
              const isSelected = selectedCategory === c.id;
              const count = getCategoryTxCount(c.id);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? 'all' : c.id)}
                  className={`chip-press px-3 py-1.5 rounded-xl shrink-0 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all border ${
                    isSelected
                      ? 'bg-[#E39A5E]/25 text-[#E39A5E] font-semibold border-[#E39A5E]/70 shadow-sm ring-1 ring-[#E39A5E]/40'
                      : 'glass-2 border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#E39A5E]/40 font-medium'
                  }`}
                >
                  <CategoryIcon name={c.name} size={13} color={c.color} />
                  <span>{c.name}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected
                          ? 'bg-[#E39A5E]/30 text-[#E39A5E]'
                          : 'bg-white/[0.06] text-[#A3AFBC]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-2 bg-gradient-to-l from-[#0D1219] via-[#0D1219]/90 to-transparent">
              <button
                type="button"
                onClick={() => scrollChips('right')}
                className="w-7 h-7 rounded-full glass-3 border border-[#E39A5E]/40 text-[#E39A5E] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Geser Kanan"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Active Filter Indicator & Instant Reset Bar */}
        {isFilterActive && (
          <div className="flex items-center justify-between pt-1 text-xs text-[#A3AFBC] border-t border-[rgba(205,225,245,0.06)]">
            <span className="flex items-center gap-1.5">
              <span>Menampilkan <strong className="text-[#EEF2F6]">{filtered.length}</strong> dari {transactions.length} transaksi</span>
              {selectedCategory !== 'all' && (
                <span className="text-[#E39A5E] font-medium">
                  · Kategori: {categories.find((c) => c.id === selectedCategory)?.name}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#E39A5E] hover:text-[#EEF2F6] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* ── GROUPED TRANSACTIONS LIST ──────────────────────────────────────── */}
      {sortedDates.length === 0 ? (
        <div className="glass-1 p-10 sm:p-12 rounded-2xl text-center space-y-3.5 border-[rgba(205,225,245,0.12)]">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[#A3AFBC] flex items-center justify-center mx-auto">
            <Filter size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#EEF2F6]">
              {transactions.length === 0
                ? 'Belum ada transaksi yang dicatat'
                : 'Tidak ada transaksi yang cocok dengan filter saat ini'}
            </p>
            <p className="text-xs text-[#A3AFBC] max-w-md mx-auto">
              {transactions.length === 0
                ? 'Mulai catat transaksi pertama kamu dengan tombol mikrofon atau tombol Tambah Manual.'
                : 'Coba pilih kategori lain, ubah tipe transaksi, atau reset filter untuk melihat semua riwayat.'}
            </p>
          </div>
          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold cursor-pointer shadow-md"
            >
              <RotateCcw size={13} />
              <span>Tampilkan Semua Transaksi</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const rawDayItems = grouped[dateStr];
            // Sort day items newest time first
            const dayItems = [...rawDayItems].sort(
              (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
            );

            const dayTotalExpense = dayItems
              .filter((i) => i.type === 'expense')
              .reduce((sum, i) => sum + i.amount, 0);

            const dayTotalIncome = dayItems
              .filter((i) => i.type === 'income')
              .reduce((sum, i) => sum + i.amount, 0);

            return (
              <div key={dateStr} className="space-y-2.5">
                {/* Date Header with Both Income & Expense Totals */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#E39A5E]" />
                    <span className="text-xs font-semibold text-[#EEF2F6]">
                      {formatDateIndo(dateStr)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold num-tabular">
                    {dayTotalIncome > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-[#4FD3A4]/15 border border-[#4FD3A4]/35 text-[#4FD3A4]">
                        + {formatCurrency(dayTotalIncome)}
                      </span>
                    )}
                    {dayTotalExpense > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-[#EE5D6C]/15 border border-[#EE5D6C]/35 text-[#EE5D6C]">
                        - {formatCurrency(dayTotalExpense)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Items List */}
                <div className="glass-1 rounded-2xl overflow-hidden divide-y divide-[rgba(205,225,245,0.06)] border border-[rgba(205,225,245,0.12)]">
                  {dayItems.map((tx, rowIdx) => {
                    const cat = getTxCategory(tx);
                    const wallet = wallets.find((w) => w.id === tx.wallet_id);
                    const isExpense = tx.type === 'expense';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => openDetailModal(tx)}
                        className="group relative p-3.5 sm:p-4 flex items-center justify-between gap-3 animate-row-in card-interactive rounded-xl border border-transparent hover:border-[#E39A5E]/30 cursor-pointer transition-colors"
                        style={{
                          animationDelay: `${rowIdx * 0.03}s`,
                        }}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <CategoryIcon
                              name={cat?.name || 'circle-ellipsis'}
                              size={19}
                              color={cat?.color || '#A3AFBC'}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-[#EEF2F6] truncate group-hover:text-[#E39A5E] transition-colors">
                              {tx.note}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-[#A3AFBC]">
                                {cat?.name || 'Lainnya'}
                              </span>
                              {wallet && (
                                <span className="text-[10px] text-[#A3AFBC] px-1.5 py-0.2 rounded bg-white/[0.04] border border-white/[0.06]">
                                  {wallet.name}
                                </span>
                              )}
                              {tx.merchant && (
                                <span className="text-[10px] text-[#74808E]">
                                  · {tx.merchant}
                                </span>
                              )}
                              <span className="text-[10px] text-[#74808E]">
                                · {formatTimeShort(tx.occurred_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs sm:text-sm font-semibold num-tabular ${
                              isExpense ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                            }`}
                          >
                            {isExpense ? '-' : '+'}
                            {formatCurrency(tx.amount)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTxToDelete(tx);
                            }}
                            aria-label="Hapus transaksi"
                            className="btn-danger p-2 rounded-xl text-[#74808E] hover:text-[#EE5D6C] hover:bg-[#EE5D6C]/15 border border-transparent hover:border-[#EE5D6C]/30 transition-all cursor-pointer shadow-xs"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DETAIL & EDIT MODAL ────────────────────────────────────────────── */}
      {viewingTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingTx(null);
          }}
        >
          <div className="bg-[var(--bg-elevated)] w-full max-w-md overflow-hidden border border-[var(--glass-border)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-base)]/40">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    viewingTx.type === 'expense'
                      ? 'bg-[#EE5D6C]/15 border-[#EE5D6C]/30 text-[#EE5D6C]'
                      : 'bg-[#4FD3A4]/15 border-[#4FD3A4]/30 text-[#4FD3A4]'
                  }`}
                >
                  {viewingTx.type === 'expense' ? (
                    <ArrowDownLeft size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#EEF2F6]">
                    Detail Transaksi
                  </h3>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      viewingTx.type === 'expense'
                        ? 'bg-[#EE5D6C]/20 text-[#EE5D6C]'
                        : 'bg-[#4FD3A4]/20 text-[#4FD3A4]'
                    }`}
                  >
                    {viewingTx.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg text-[#A3AFBC] hover:text-[#E39A5E] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    title="Edit Transaksi"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingTx(null)}
                  className="p-1.5 rounded-lg text-[#A3AFBC] hover:text-[#EEF2F6] hover:bg-white/[0.04] transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#A3AFBC] block mb-1">
                      Catatan Transaksi
                    </label>
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="input-glow w-full h-10 px-3.5 rounded-xl glass-2 text-sm text-[#EEF2F6] border border-white/[0.1] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#A3AFBC] block mb-1">
                      Nominal (Rp)
                    </label>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="input-glow w-full h-10 px-3.5 rounded-xl glass-2 text-sm text-[#EEF2F6] border border-white/[0.1] outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3.5 py-2 rounded-xl glass-2 text-xs font-medium text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Amount Display */}
                  <div className="text-center py-2 border-b border-[rgba(205,225,245,0.08)]">
                    <div
                      className={`text-2xl sm:text-3xl font-display font-bold num-tabular ${
                        viewingTx.type === 'expense' ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                      }`}
                    >
                      {viewingTx.type === 'expense' ? '-' : '+'}
                      {formatCurrency(viewingTx.amount)}
                    </div>
                    <p className="text-sm font-medium text-[#EEF2F6] mt-1">
                      {viewingTx.note}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="glass-2 p-3 rounded-xl border border-[rgba(205,225,245,0.08)]">
                      <div className="flex items-center gap-1.5 text-[#A3AFBC] mb-1">
                        <Clock size={13} />
                        <span>Waktu Transaksi</span>
                      </div>
                      <p className="font-medium text-[#EEF2F6]">
                        {formatDateTimeWIB(viewingTx.occurred_at)}
                      </p>
                    </div>

                    <div className="glass-2 p-3 rounded-xl border border-[rgba(205,225,245,0.08)]">
                      <div className="flex items-center gap-1.5 text-[#A3AFBC] mb-1">
                        <WalletIcon size={13} />
                        <span>Sumber Dana</span>
                      </div>
                      <p className="font-medium text-[#EEF2F6]">
                        {wallets.find((w) => w.id === viewingTx.wallet_id)?.name || 'Dompet Tunai'}
                      </p>
                    </div>

                    <div className="glass-2 p-3 rounded-xl border border-[rgba(205,225,245,0.08)]">
                      <div className="flex items-center gap-1.5 text-[#A3AFBC] mb-1">
                        <Tag size={13} />
                        <span>Kategori</span>
                      </div>
                      <p className="font-medium text-[#EEF2F6]">
                        {getTxCategory(viewingTx)?.name || 'Lainnya'}
                      </p>
                    </div>

                    <div className="glass-2 p-3 rounded-xl border border-[rgba(205,225,245,0.08)]">
                      <div className="flex items-center gap-1.5 text-[#A3AFBC] mb-1">
                        <Check size={13} />
                        <span>Kebutuhan / Keinginan</span>
                      </div>
                      <p className="font-medium text-[#EEF2F6] capitalize">
                        {(() => {
                          const cat = getTxCategory(viewingTx);
                          const nw = cat?.need_want;
                          if (nw === 'need') return 'Kebutuhan Pokok (Need)';
                          if (nw === 'want') return 'Keinginan (Want)';
                          return 'Tabungan (Saving)';
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[rgba(205,225,245,0.08)]">
                    <button
                      type="button"
                      onClick={() => setTxToDelete(viewingTx)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-[#EE5D6C] hover:bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Hapus Transaksi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewingTx(null)}
                      className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold cursor-pointer shadow-md"
                    >
                      Selesai
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM DELETE CONFIRMATION MODAL ───────────────────────────────── */}
      {txToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTxToDelete(null);
          }}
        >
          <div className="bg-[var(--bg-elevated)] w-full max-w-sm rounded-2xl border border-[rgba(238,93,108,0.3)] shadow-2xl p-5 text-center space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 text-[#EE5D6C] flex items-center justify-center mx-auto shadow-md shadow-[#EE5D6C]/10">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-[#EEF2F6]">
                Hapus Transaksi?
              </h4>
              <p className="text-xs text-[#A3AFBC] leading-relaxed">
                Apakah kamu yakin ingin menghapus catatan{' '}
                <span className="font-semibold text-[#EEF2F6]">
                  "{txToDelete.note}"
                </span>{' '}
                sebesar{' '}
                <span className="font-semibold text-[#EEF2F6]">
                  {formatCurrency(txToDelete.amount)}
                </span>
                ? Saldo dompet akan disesuaikan otomatis.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="h-10 px-4 rounded-xl glass-2 border border-[var(--glass-border)] text-xs font-semibold text-[#EEF2F6] hover:bg-white/[0.04] cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#EE5D6C] to-[#E0343F] text-white text-xs font-bold cursor-pointer shadow-lg shadow-[#EE5D6C]/30 hover:brightness-110 active:scale-95 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
