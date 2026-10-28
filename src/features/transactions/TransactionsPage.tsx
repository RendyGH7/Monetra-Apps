import React, { useState } from 'react';
import { Search, Plus, Trash2, Calendar, Mic } from 'lucide-react';
import { useAppStore } from '../../store';
import { formatCurrency, formatDateIndo, formatTimeShort } from '../../utils/format';
import { CategoryIcon } from '../../components/common/CategoryIcon';
import { TransactionType } from '../../types';

export const TransactionsPage: React.FC = () => {
  const { transactions, categories, deleteTransaction, setQuickManualOpen, setVoiceModalOpen } =
    useAppStore();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = transactions.filter((t) => {
    if (selectedType !== 'all' && t.type !== selectedType) return false;
    if (selectedCategory !== 'all' && t.category_id !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const cat = categories.find((c) => c.id === t.category_id);
      return (
        t.note.toLowerCase().includes(q) ||
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (cat && cat.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const grouped: Record<string, typeof transactions> = {};
  filtered.forEach((t) => {
    const dStr = t.occurred_at.split('T')[0];
    if (!grouped[dStr]) grouped[dStr] = [];
    grouped[dStr].push(t);
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="btn-ghost px-3 py-2 rounded-xl glass-1 border border-white/[0.08] text-xs font-medium text-[#EEF2F6] flex items-center gap-1.5 cursor-pointer"
          >
            <Mic size={15} className="text-[#E39A5E]" />
            <span>Rekam Suara</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickManualOpen(true)}
            className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-black/30"
          >
            <Plus size={15} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-1 p-3 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3AFBC]" />
          <input
            type="text"
            placeholder="Cari transaksi, kafe, warteg, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow w-full h-10 pl-10 pr-4 rounded-xl glass-2 text-xs sm:text-sm text-[#EEF2F6] placeholder:text-[#74808E] border border-white/[0.08] outline-none"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {[
            { label: 'Semua Tipe', value: 'all' as const, activeClass: 'bg-[#E39A5E] text-[#1C0E04]' },
            { label: 'Pengeluaran', value: 'expense' as const, activeClass: 'bg-[#EE5D6C] text-white' },
            { label: 'Pemasukan', value: 'income' as const, activeClass: 'bg-[#4FD3A4] text-[#1C0E04]' },
          ].map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setSelectedType(chip.value)}
              className={`chip-press px-3 py-1.5 rounded-lg shrink-0 font-medium cursor-pointer ${
                selectedType === chip.value
                  ? chip.activeClass
                  : 'glass-2 text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              {chip.label}
            </button>
          ))}

          <span className="text-[#74808E] px-1">|</span>

          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === c.id ? 'all' : c.id)}
              className={`chip-press px-3 py-1.5 rounded-lg shrink-0 font-medium flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-white/[0.15] text-[#EEF2F6] border border-[#E39A5E]/40'
                  : 'glass-2 text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              <CategoryIcon name={c.name} size={13} color={c.color} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Transaction List */}
      {sortedDates.length === 0 ? (
        <div className="glass-1 p-12 rounded-2xl text-center space-y-3 border-[rgba(205,225,245,0.12)]">
          <p className="text-sm font-medium text-[#EEF2F6]">Tidak ada transaksi yang cocok</p>
          <p className="text-xs text-[#A3AFBC]">
            Coba ubah kata kunci pencarian atau rekam transaksi baru menggunakan tombol mikrofon.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dayItems = grouped[dateStr];
            const dayTotalExpense = dayItems
              .filter((i) => i.type === 'expense')
              .reduce((sum, i) => sum + i.amount, 0);

            return (
              <div key={dateStr} className="space-y-2.5">
                {/* Date header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#E39A5E]" />
                    <span className="text-xs font-semibold text-[#EEF2F6]">
                      {formatDateIndo(dateStr)}
                    </span>
                  </div>
                  {dayTotalExpense > 0 && (
                    <span className="text-xs font-medium text-[#A3AFBC] num-tabular">
                      Keluar: {formatCurrency(dayTotalExpense)}
                    </span>
                  )}
                </div>

                {/* Day Items */}
                <div className="glass-1 rounded-2xl overflow-hidden divide-y divide-[rgba(205,225,245,0.06)] border border-[rgba(205,225,245,0.12)]">
                  {dayItems.map((tx, rowIdx) => {
                    const cat = categories.find((c) => c.id === tx.category_id);
                    const isExpense = tx.type === 'expense';

                    return (
                      <div
                        key={tx.id}
                        className="group relative p-3.5 sm:p-4 flex items-center justify-between gap-3 animate-row-in"
                        style={{
                          animationDelay: `${rowIdx * 0.04}s`,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        {/* Left accent reveal on hover */}
                        <span
                          className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#E39A5E] opacity-0 group-hover:opacity-100 rounded-r-full"
                          style={{ transition: 'opacity 0.2s ease' }}
                        />

                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                            <CategoryIcon
                              name={cat?.name || 'circle-ellipsis'}
                              size={19}
                              color={cat?.color || '#A3AFBC'}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-[#EEF2F6] truncate">
                              {tx.note}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#A3AFBC]">
                                {cat?.name || 'Lainnya'}
                              </span>
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
                            onClick={() => deleteTransaction(tx.id)}
                            aria-label="Hapus transaksi"
                            className="btn-danger p-1.5 rounded-lg text-[#74808E] cursor-pointer"
                            title="Hapus"
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
    </div>
  );
};
