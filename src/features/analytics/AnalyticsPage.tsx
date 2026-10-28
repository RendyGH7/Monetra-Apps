import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useAppStore } from '../../store';
import { formatCurrency } from '../../utils/format';
import { ShieldCheck, Heart, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { transactions, categories, profile } = useAppStore();
  const [period, setPeriod] = useState<'month' | 'all'>('month');

  const expenseTx = transactions.filter((t) => t.type === 'expense');

  // Breakdown by Category
  const catSums: Record<string, number> = {};
  expenseTx.forEach((t) => {
    const c = categories.find((cat) => cat.id === t.category_id);
    const name = c?.name || 'Lainnya';
    catSums[name] = (catSums[name] || 0) + t.amount;
  });

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

  const pieData = Object.entries(catSums).map(([name, value], i) => ({
    name,
    value,
    color: chartPalette[i % chartPalette.length],
  }));

  const totalExpense = expenseTx.reduce((sum, t) => sum + t.amount, 0);

  // 50/30/20 rule breakdown: Needs vs Wants vs Savings
  let needsSum = 0;
  let wantsSum = 0;
  let savingsSum = 0;

  expenseTx.forEach((t) => {
    const c = categories.find((cat) => cat.id === t.category_id);
    if (c?.need_want === 'need') needsSum += t.amount;
    else if (c?.need_want === 'want') wantsSum += t.amount;
    else if (c?.need_want === 'saving') savingsSum += t.amount;
    else needsSum += t.amount;
  });

  const needsPct = totalExpense > 0 ? Math.round((needsSum / totalExpense) * 100) : 50;
  const wantsPct = totalExpense > 0 ? Math.round((wantsSum / totalExpense) * 100) : 30;
  const savingsPct = totalExpense > 0 ? Math.round((savingsSum / totalExpense) * 100) : 20;

  // Dating specific analysis
  const datingSum = catSums['Kencan & Pacaran'] || 0;
  const datingPctOfIncome = profile.monthly_income > 0 ? Math.round((datingSum / profile.monthly_income) * 100) : 0;

  // Calculate Health Score (0 - 100)
  // Higher if dating <= 40% of income, daily spend is in control, and net balance is positive
  let score = 75;
  if (datingPctOfIncome > 50) score -= 20;
  else if (datingPctOfIncome > 35) score -= 10;
  if (totalExpense > profile.monthly_income) score -= 25;
  score = Math.max(20, Math.min(100, score));

  // Top 5 largest expenses
  const topExpenses = [...expenseTx].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
            Statistik & Analisis
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Analisis pola konsumsi dan evaluasi kesehatan finansial
          </p>
        </div>

        {/* Period Segmented Control */}
        <div className="glass-1 p-1 rounded-xl flex items-center border border-white/[0.08] text-xs">
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              period === 'month'
                ? 'bg-[#E39A5E] text-[#1C0E04] font-semibold'
                : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              period === 'all'
                ? 'bg-[#E39A5E] text-[#1C0E04] font-semibold'
                : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
            }`}
          >
            Semua Waktu
          </button>
        </div>
      </div>

      {/* Financial Health Score & 50/30/20 Rule */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <div className="glass-2 p-5 rounded-2xl border-[rgba(205,225,245,0.14)] flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#A3AFBC]">
              Skor Kesehatan Keuangan
            </span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-display font-bold text-4xl sm:text-5xl text-[#E39A5E] num-tabular">
                {score}
              </span>
              <span className="text-sm text-[#A3AFBC]">/ 100</span>
            </div>
            <p className="text-xs text-[#EEF2F6] font-medium pt-1">
              {score >= 80 ? 'Kondisi Sangat Sehat' : score >= 60 ? 'Cukup Waspada' : 'Perlu Evaluasi Pengeluaran'}
            </p>
          </div>

          <div className="pt-4 border-t border-[rgba(205,225,245,0.1)] text-[11px] text-[#A3AFBC] space-y-1">
            <p>· Gaji magang: Rp 1.500.000</p>
            <p>· Porsi kencan: {datingPctOfIncome}% dari total gaji</p>
          </div>
        </div>

        {/* 50/30/20 Rule Card */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EEF2F6]">
              Rasio Kebutuhan, Keinginan & Tabungan (Aturan 50/30/20)
            </h2>
          </div>

          <div className="space-y-3">
            {/* Needs Bar */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#A3AFBC]">
                <span>Kebutuhan Pokok (Makan, Transport, Pulsa): {formatCurrency(needsSum)}</span>
                <span className="font-semibold text-[#EEF2F6]">{needsPct}% (Target 50%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full bg-[#6FA8D6] rounded-full" style={{ width: `${Math.min(100, needsPct)}%` }} />
              </div>
            </div>

            {/* Wants Bar (Includes Dating) */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#A3AFBC]">
                <span>Keinginan & Kencan (Pacaran, Kafe, Game): {formatCurrency(wantsSum)}</span>
                <span className="font-semibold text-[#EEF2F6]">{wantsPct}% (Target 30%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className={`h-full rounded-full ${wantsPct > 35 ? 'bg-[#EE5D6C]' : 'bg-[#E39A5E]'}`}
                  style={{ width: `${Math.min(100, wantsPct)}%` }}
                />
              </div>
            </div>

            {/* Savings Bar */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#A3AFBC]">
                <span>Tabungan & Dana Darurat: {formatCurrency(savingsSum)}</span>
                <span className="font-semibold text-[#EEF2F6]">{savingsPct}% (Target 20%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full bg-[#4FD3A4] rounded-full" style={{ width: `${Math.min(100, savingsPct)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dating Specific Deep Dive Card */}
      <div className="glass-2 p-5 rounded-2xl border-[rgba(205,225,245,0.14)] space-y-3">
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-[#B5603A]" />
          <h2 className="text-sm font-semibold text-[#EEF2F6]">
            Analisis Pos Kencan & Hubungan
          </h2>
        </div>
        <p className="text-xs text-[#A3AFBC] leading-relaxed">
          Kamu rutin nge-date 3 hingga 4 kali seminggu dengan biaya Rp 50.000 sampai Rp 200.000 per sesi.
          Total kencan bulan ini: <span className="text-[#E39A5E] font-semibold num-tabular">{formatCurrency(datingSum)}</span>.
          Dengan gaji magang Rp 1.500.000, batas ideal kencan per minggu adalah <span className="text-[#4FD3A4] font-semibold">Rp 150.000 - Rp 200.000</span> agar tabungan tidak tergerus.
        </p>
      </div>

      {/* Charts & Top Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-4">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">Distribusi per Kategori</h2>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
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
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[rgba(205,225,245,0.08)]">
            {pieData.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-[#A3AFBC] truncate">{entry.name}</span>
                </div>
                <span className="font-semibold text-[#EEF2F6] num-tabular">
                  {formatCurrency(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Expenses */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] space-y-4">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">Top 5 Pengeluaran Terbesar</h2>
          <div className="space-y-2">
            {topExpenses.map((tx, idx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              return (
                <div
                  key={tx.id}
                  className="glass-2 p-3 rounded-xl flex items-center justify-between gap-3 border-[rgba(205,225,245,0.08)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-white/[0.04] text-[11px] font-bold text-[#A3AFBC] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-[#EEF2F6] truncate">
                        {tx.note}
                      </p>
                      <p className="text-[11px] text-[#A3AFBC]">
                        {cat?.name || 'Lainnya'}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs sm:text-sm font-semibold text-[#EE5D6C] num-tabular shrink-0">
                    -{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
