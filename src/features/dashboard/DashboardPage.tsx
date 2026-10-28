import React from 'react';
import {
  Mic,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppStore } from '../../store';
import { formatCurrency, formatTimeShort } from '../../utils/format';
import { CategoryIcon } from '../../components/common/CategoryIcon';

export const DashboardPage: React.FC = () => {
  const {
    profile,
    transactions,
    categories,
    setVoiceModalOpen,
    setQuickManualOpen,
    setActiveTab,
  } = useAppStore();

  // Calculate monthly summaries
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTx = transactions.filter((t) => {
    const d = new Date(t.occurred_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = thisMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = thisMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Calculate Sisa Aman Hari Ini
  // Days until next pay_day (e.g. 25th)
  const todayDate = now.getDate();
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;

  // Safe daily spend = Remaining balance / daysLeft
  const safeDailySpend = Math.max(0, Math.round(netBalance / daysLeft));

  // Category breakdown for Pie Chart
  const expenseByCategory: Record<string, number> = {};
  thisMonthTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const name = cat?.name || 'Lainnya';
      expenseByCategory[name] = (expenseByCategory[name] || 0) + t.amount;
    });

  // Chart data matching Design.md 8 colors
  const chartPalette = [
    '#E39A5E', // tembaga
    '#4FD3A4', // jade
    '#6FA8D6', // biru baja
    '#EE5D6C', // karmin
    '#CDBFA3', // pasir
    '#4FA8A0', // teal
    '#B5603A', // karat / date
    '#8A9AA8', // slate
  ];

  const pieData = Object.entries(expenseByCategory).map(([name, value], i) => ({
    name,
    value,
    color: chartPalette[i % chartPalette.length],
  }));

  // Dating category spending check
  const dateSpending = expenseByCategory['Kencan & Pacaran'] || 0;
  const dateBudgetMonth = profile.dating_budget_est || 600000;
  const isDatingOver = dateSpending > dateBudgetMonth;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Top Greeting and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
              Halo, {profile.nama}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Gaji magang Rp 1.500.000 · Gajian tiap tanggal {profile.pay_day} · {daysLeft} hari menuju gajian
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuickManualOpen(true)}
            className="px-3 py-2 rounded-xl glass-1 border border-white/[0.08] text-xs font-medium text-[#EEF2F6] hover:bg-white/[0.05] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Catat Cepat</span>
          </button>
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-semibold hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-black/30"
          >
            <Mic size={15} strokeWidth={2.2} />
            <span>Bicara</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: Balance + Safe Daily + Dating Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Balance Card (Glass 2) */}
        <div className="glass-2 p-5 rounded-2xl flex flex-col justify-between border-[rgba(205,225,245,0.14)] md:col-span-2">
          <div className="space-y-1">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#A3AFBC]">
              Sisa Saldo Bulan Ini
            </span>
            <div className="font-display font-bold text-3xl sm:text-4xl text-[#EEF2F6] num-tabular">
              {formatCurrency(netBalance)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-5 mt-4 border-t border-[rgba(205,225,245,0.1)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#4FD3A4]/15 border border-[#4FD3A4]/30 flex items-center justify-center text-[#4FD3A4]">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[11px] text-[#A3AFBC]">Total Pemasukan</p>
                <p className="text-sm font-semibold text-[#4FD3A4] num-tabular">
                  +{formatCurrency(totalIncome)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EE5D6C]/15 border border-[#EE5D6C]/30 flex items-center justify-center text-[#EE5D6C]">
                <TrendingDown size={16} />
              </div>
              <div>
                <p className="text-[11px] text-[#A3AFBC]">Total Pengeluaran</p>
                <p className="text-sm font-semibold text-[#EE5D6C] num-tabular">
                  -{formatCurrency(totalExpense)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sisa Aman Hari Ini */}
        <div className="glass-1 p-5 rounded-2xl flex flex-col justify-between border-[rgba(205,225,245,0.12)]">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold tracking-wider text-[#A3AFBC]">
                Sisa Aman Hari Ini
              </span>
              <Calendar size={15} className="text-[#E39A5E]" />
            </div>
            <div className="font-display font-bold text-2xl text-[#E39A5E] num-tabular">
              {formatCurrency(safeDailySpend)}
            </div>
            <p className="text-[11px] text-[#A3AFBC] leading-relaxed pt-1">
              Batas belanja per hari agar gajimu cukup sampai tanggal {profile.pay_day}.
            </p>
          </div>

          <div className="pt-3">
            <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4FD3A4] to-[#E39A5E] rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(10, (netBalance / (profile.monthly_income || 1500000)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-[#74808E] mt-1 text-right">
              {daysLeft} hari lagi
            </p>
          </div>
        </div>
      </div>

      {/* AI Daily Insight Card tailored to user real situation */}
      <div className="glass-2 p-4 sm:p-5 rounded-2xl border-[rgba(205,225,245,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={18} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E39A5E]">
                Insight AI Hari Ini
              </span>
              {isDatingOver && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#EE5D6C]/20 text-[#EE5D6C] font-medium flex items-center gap-1">
                  <AlertTriangle size={11} />
                  <span>Pos Kencan Melebihi Batas</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#EEF2F6] leading-relaxed">
              Total pengeluaran kencan bulan ini mencapai <span className="font-semibold text-[#E39A5E] num-tabular">{formatCurrency(dateSpending)}</span> ({Math.round((dateSpending / (profile.monthly_income || 1500000)) * 100)}% dari gaji magang). Pertahankan makan harian di batas Rp 15.000 agar cashflow tetap aman.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('asisten')}
          className="self-end sm:self-center shrink-0 px-3.5 py-2 rounded-xl glass-1 border border-[#E39A5E]/30 text-xs font-medium text-[#E39A5E] hover:bg-[#E39A5E]/10 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Tanya Asisten AI</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Analytics & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Category Donut Chart (2 columns on desktop) */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EEF2F6]">Distribusi Pengeluaran</h2>
            <button
              type="button"
              onClick={() => setActiveTab('statistik')}
              className="text-xs text-[#E39A5E] hover:underline cursor-pointer"
            >
              Lihat Detail
            </button>
          </div>

          {pieData.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#A3AFBC]">
              Belum ada data pengeluaran bulan ini.
            </div>
          ) : (
            <>
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Pengeluaran']}
                      contentStyle={{
                        backgroundColor: '#0D1219',
                        borderColor: 'rgba(205,225,245,0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#EEF2F6',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[#A3AFBC] uppercase">Total</span>
                  <span className="text-xs font-bold text-[#EEF2F6] num-tabular">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
              </div>

              {/* Legend list */}
              <div className="space-y-1.5 pt-2 border-t border-[rgba(205,225,245,0.08)]">
                {pieData.slice(0, 4).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-[#A3AFBC] truncate max-w-[130px]">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-[#EEF2F6] num-tabular">
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Transactions List (3 columns on desktop) */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EEF2F6]">Transaksi Terbaru</h2>
            <button
              type="button"
              onClick={() => setActiveTab('transaksi')}
              className="text-xs text-[#E39A5E] hover:underline cursor-pointer"
            >
              Semua Transaksi ({transactions.length})
            </button>
          </div>

          <div className="space-y-2.5">
            {transactions.slice(0, 5).map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const isExpense = tx.type === 'expense';

              return (
                <div
                  key={tx.id}
                  className="glass-2 p-3 rounded-xl flex items-center justify-between gap-3 border-[rgba(205,225,245,0.1)] hover:border-[#E39A5E]/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <CategoryIcon
                        name={cat?.name || 'circle-ellipsis'}
                        size={17}
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
                        <span className="text-[10px] text-[#74808E]">
                          {formatTimeShort(tx.occurred_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-semibold num-tabular ${
                        isExpense ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
