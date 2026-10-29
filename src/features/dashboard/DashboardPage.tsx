import React, { useState, useMemo } from 'react';
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
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useAppStore } from '../../store';
import { formatCurrency, formatTimeShort, formatCompact } from '../../utils/format';
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

  const todayDate = now.getDate();
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;

  const safeDailySpend = Math.max(0, Math.round(netBalance / daysLeft));

  const expenseByCategory: Record<string, number> = {};
  thisMonthTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const name = cat?.name || 'Lainnya';
      expenseByCategory[name] = (expenseByCategory[name] || 0) + t.amount;
    });

  const chartPalette = [
    '#E39A5E', '#4FD3A4', '#6FA8D6', '#EE5D6C',
    '#CDBFA3', '#4FA8A0', '#B5603A', '#8A9AA8',
  ];

  const pieData = Object.entries(expenseByCategory).map(([name, value], i) => ({
    name,
    value,
    color: chartPalette[i % chartPalette.length],
  }));

  const dateSpending = expenseByCategory['Kencan & Pacaran'] || 0;
  const dateBudgetMonth = profile.dating_budget_est || 600000;
  const isDatingOver = dateSpending > dateBudgetMonth;

  type StatPeriod = 'week' | 'month' | 'year';
  const [statPeriod, setStatPeriod] = useState<StatPeriod>('week');
  const [chartMetric, setChartMetric] = useState<'all' | 'expense' | 'income'>('all');

  const periodStats = useMemo(() => {
    const today = new Date();

    if (statPeriod === 'week') {
      const dayOfWeek = (today.getDay() + 6) % 7;
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const prevStart = new Date(startOfWeek);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(startOfWeek);

      const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const fullDayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const daysData = dayLabels.map((lbl, idx) => {
        const dObj = new Date(startOfWeek);
        dObj.setDate(dObj.getDate() + idx);
        return {
          label: lbl,
          fullLabel: `${fullDayNames[idx]}, ${dObj.getDate()} ${dObj.toLocaleDateString('id-ID', { month: 'short' })}`,
          expense: 0,
          income: 0,
          isCurrent: idx === dayOfWeek,
        };
      });

      let totalExpense = 0;
      let totalIncome = 0;
      let prevExpense = 0;

      transactions.forEach((t) => {
        const d = new Date(t.occurred_at);
        if (d >= startOfWeek && d < endOfWeek) {
          const dIdx = (d.getDay() + 6) % 7;
          if (t.type === 'expense') {
            totalExpense += t.amount;
            daysData[dIdx].expense += t.amount;
          } else {
            totalIncome += t.amount;
            daysData[dIdx].income += t.amount;
          }
        } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
          prevExpense += t.amount;
        }
      });

      const delta = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;
      const avg = Math.round(totalExpense / 7);

      return {
        title: 'Minggu Ini',
        chartSubtitle: 'Harian (7 Hari)',
        totalExpense,
        totalIncome,
        net: totalIncome - totalExpense,
        chartData: daysData,
        delta,
        prevLabel: 'minggu lalu',
        avgLabel: 'Rata-rata/hari',
        avgValue: avg,
      };
    }

    if (statPeriod === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(startOfMonth);

      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const monthData = Array.from({ length: daysInMonth }, (_, idx) => {
        const dayNum = idx + 1;
        const dObj = new Date(today.getFullYear(), today.getMonth(), dayNum);
        const dayName = dObj.toLocaleDateString('id-ID', { weekday: 'short' });
        return {
          label: `${dayNum}`,
          fullLabel: `${dayName}, ${dayNum} ${today.toLocaleDateString('id-ID', { month: 'short' })}`,
          expense: 0,
          income: 0,
          isCurrent: dayNum === today.getDate(),
        };
      });

      let totalExpense = 0;
      let totalIncome = 0;
      let prevExpense = 0;

      transactions.forEach((t) => {
        const d = new Date(t.occurred_at);
        if (d >= startOfMonth && d < endOfMonth) {
          const dayNum = d.getDate();
          const idx = dayNum - 1;
          if (idx >= 0 && idx < monthData.length) {
            if (t.type === 'expense') {
              totalExpense += t.amount;
              monthData[idx].expense += t.amount;
            } else {
              totalIncome += t.amount;
              monthData[idx].income += t.amount;
            }
          }
        } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
          prevExpense += t.amount;
        }
      });

      const delta = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;
      const avg = Math.round(totalExpense / Math.max(1, today.getDate()));

      return {
        title: 'Bulan Ini',
        chartSubtitle: `Harian (${daysInMonth} Hari)`,
        totalExpense,
        totalIncome,
        net: totalIncome - totalExpense,
        chartData: monthData,
        delta,
        prevLabel: 'bulan lalu',
        avgLabel: 'Rata-rata/hari',
        avgValue: avg,
      };
    }

    // year
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear() + 1, 0, 1);
    const prevStart = new Date(today.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(startOfYear);

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsFull = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const monthsData = monthsShort.map((lbl, idx) => ({
      label: lbl,
      fullLabel: `${monthsFull[idx]} ${today.getFullYear()}`,
      expense: 0,
      income: 0,
      isCurrent: idx === today.getMonth(),
    }));

    let totalExpense = 0;
    let totalIncome = 0;
    let prevExpense = 0;

    transactions.forEach((t) => {
      const d = new Date(t.occurred_at);
      if (d >= startOfYear && d < endOfYear) {
        const mIdx = d.getMonth();
        if (t.type === 'expense') {
          totalExpense += t.amount;
          monthsData[mIdx].expense += t.amount;
        } else {
          totalIncome += t.amount;
          monthsData[mIdx].income += t.amount;
        }
      } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
        prevExpense += t.amount;
      }
    });

    const delta = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;
    const avg = Math.round(totalExpense / (today.getMonth() + 1));

    return {
      title: 'Tahun Ini',
      chartSubtitle: 'Bulanan (12 Bulan)',
      totalExpense,
      totalIncome,
      net: totalIncome - totalExpense,
      chartData: monthsData,
      delta,
      prevLabel: 'tahun lalu',
      avgLabel: 'Rata-rata/bulan',
      avgValue: avg,
    };
  }, [transactions, statPeriod]);

  // Minimalist Custom Tooltip for Dashboard Line Chart
  const MinimalChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-2 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[155px]">
          <p className="font-semibold text-[#EEF2F6] border-b border-white/[0.08] pb-1.5 text-[11px]">
            {data.fullLabel || data.label}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[#A3AFBC]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E39A5E]" />
                Pengeluaran
              </span>
              <span className="font-semibold text-[#EEF2F6] num-tabular">
                {formatCurrency(data.expense || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[#A3AFBC]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4FD3A4]" />
                Pemasukan
              </span>
              <span className="font-semibold text-[#4FD3A4] num-tabular">
                {formatCurrency(data.income || 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Top Greeting and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
            Halo, {profile.nama}
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Gaji magang Rp 1.500.000 · Gajian tiap tanggal {profile.pay_day} · {daysLeft} hari menuju gajian
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setQuickManualOpen(true)}
            className="btn-press px-3.5 py-2 rounded-xl glass-2 border border-[var(--glass-border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[#E39A5E]/40 flex items-center gap-2 cursor-pointer shadow-xs"
            title="Catat Transaksi Manual Cepat"
          >
            <div className="w-5 h-5 rounded-md bg-[#E39A5E]/15 text-[#E39A5E] flex items-center justify-center">
              <Plus size={13} strokeWidth={2.5} />
            </div>
            <span>Catat Cepat</span>
          </button>
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="btn-primary px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-black/25"
            title="Rekam Pengeluaran via Suara"
          >
            <Mic size={15} strokeWidth={2.4} />
            <span>Bicara</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: Balance + Safe Daily */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Balance Card */}
        <div className="card-lift glass-2 p-5 rounded-2xl flex flex-col justify-between border-[rgba(205,225,245,0.14)] md:col-span-2">
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
        <div className="card-lift glass-1 p-5 rounded-2xl flex flex-col justify-between border-[rgba(205,225,245,0.12)]">
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
                className="h-full bg-gradient-to-r from-[#4FD3A4] to-[#E39A5E] rounded-full progress-fill"
                style={{ width: `${Math.min(100, Math.max(10, (netBalance / (profile.monthly_income || 1500000)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-[#74808E] mt-1 text-right">
              {daysLeft} hari lagi
            </p>
          </div>
        </div>
      </div>

      {/* ── Minimalist Periodic Statistics (Mingguan / Bulanan / Tahunan) ── */}
      <div className="card-hover-subtle glass-2 p-5 rounded-2xl border border-[var(--glass-border)] space-y-4">
        {/* Header with Title and Minimalist Period Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#EEF2F6]">
                Statistik {periodStats.title}
              </h2>
              <p className="text-[11px] text-[#A3AFBC]">
                Tren detail arus kas dan evaluasi pengeluaran
              </p>
            </div>
          </div>

          {/* Minimalist Clean Period Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs self-start sm:self-auto gap-1">
            {(['week', 'month', 'year'] as StatPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setStatPeriod(p)}
                className={`chip-press px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-180 ${
                  statPeriod === p
                    ? 'bg-[#E39A5E] text-[#1C0E04] shadow-md shadow-[#E39A5E]/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
                }`}
              >
                {p === 'week' ? 'Mingguan' : p === 'month' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Statistical Area & Line Chart */}
        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#A3AFBC] mb-2 px-1 gap-2">
            <span className="text-[11px] text-[var(--text-tertiary)]">
              Tren {periodStats.chartSubtitle}
            </span>
            <div className="flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-[11px] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric('all')}
                className={`chip-press px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'all'
                    ? 'bg-white/[0.14] text-[var(--text-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('expense')}
                className={`chip-press px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  chartMetric === 'expense'
                    ? 'bg-[#E39A5E]/20 text-[#E39A5E] font-semibold border border-[#E39A5E]/40 shadow-xs'
                    : 'text-[var(--text-tertiary)] hover:text-[#E39A5E]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#E39A5E]" />
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('income')}
                className={`chip-press px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  chartMetric === 'income'
                    ? 'bg-[#4FD3A4]/20 text-[#4FD3A4] font-semibold border border-[#4FD3A4]/40 shadow-xs'
                    : 'text-[var(--text-tertiary)] hover:text-[#4FD3A4]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4FD3A4]" />
                Pemasukan
              </button>
            </div>
          </div>

          <div className="h-44 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={periodStats.chartData} margin={{ top: 8, right: 12, left: -2, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E39A5E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E39A5E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashIncGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FD3A4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4FD3A4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#74808E', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={statPeriod === 'month' ? 4 : 0}
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fill: '#74808E', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<MinimalChartTooltip />} />
                {(chartMetric === 'all' || chartMetric === 'expense') && (
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Pengeluaran"
                    stroke="#E39A5E"
                    strokeWidth={2.2}
                    fill="url(#dashExpGrad)"
                    dot={statPeriod === 'month' ? false : { r: 3, fill: '#E39A5E', strokeWidth: 1.5, stroke: '#1C0E04' }}
                    activeDot={{ r: 5, fill: '#E39A5E', stroke: '#EEF2F6', strokeWidth: 2 }}
                  />
                )}
                {(chartMetric === 'all' || chartMetric === 'income') && (
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Pemasukan"
                    stroke="#4FD3A4"
                    strokeWidth={1.8}
                    strokeDasharray={statPeriod === 'month' ? undefined : '2 2'}
                    fill="url(#dashIncGrad)"
                    dot={statPeriod === 'month' ? false : { r: 2.5, fill: '#4FD3A4', strokeWidth: 1, stroke: '#071F17' }}
                    activeDot={{ r: 4.5, fill: '#4FD3A4', stroke: '#EEF2F6', strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer with Trend Delta & Direct Link to Statistics */}
        <div className="pt-3 border-t border-[rgba(205,225,245,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#A3AFBC]">
          <div className="flex items-center gap-1.5">
            {periodStats.delta !== null ? (
              <>
                <span
                  className={`font-semibold num-tabular flex items-center gap-0.5 ${
                    periodStats.delta > 0 ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                  }`}
                >
                  {periodStats.delta > 0 ? `+${periodStats.delta}%` : `${periodStats.delta}%`}
                </span>
                <span>pengeluaran vs {periodStats.prevLabel}</span>
              </>
            ) : (
              <span>Belum ada data pembanding {periodStats.prevLabel}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('statistik')}
            className="btn-press group self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-[#E39A5E]/30 bg-[#E39A5E]/10 text-xs text-[#E39A5E] hover:bg-[#E39A5E]/20 hover:border-[#E39A5E]/50 flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
            title="Buka halaman statistik lengkap"
          >
            <span>Buka Analisis Lengkap</span>
            <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* AI Daily Insight Card */}
      <div className="card-lift glass-2 p-4 sm:p-5 rounded-2xl border-[rgba(205,225,245,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          className="btn-primary group self-end sm:self-center shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E39A5E] to-[#CF8143] text-[#1C0E04] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-black/25"
          title="Buka Asisten FinAI"
        >
          <Sparkles size={14} className="transition-transform duration-300 group-hover:rotate-12" />
          <span>Tanya FinAI</span>
          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>

      {/* Analytics & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Category Donut Chart */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EEF2F6]">Distribusi Pengeluaran</h2>
            <button
              type="button"
              onClick={() => setActiveTab('statistik')}
              className="btn-press text-xs font-semibold text-[#E39A5E] bg-[#E39A5E]/10 hover:bg-[#E39A5E]/20 border border-[#E39A5E]/25 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              title="Buka Analisis Kategori"
            >
              <span>Lihat Detail</span>
              <ChevronRight size={13} />
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[#A3AFBC] uppercase">Total</span>
                  <span className="text-xs font-bold text-[#EEF2F6] num-tabular">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
              </div>

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

        {/* Recent Transactions List */}
        <div className="glass-1 p-5 rounded-2xl border-[rgba(205,225,245,0.12)] lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#EEF2F6]">Transaksi Terbaru</h2>
            <button
              type="button"
              onClick={() => setActiveTab('transaksi')}
              className="btn-press text-xs font-semibold text-[#E39A5E] bg-[#E39A5E]/10 hover:bg-[#E39A5E]/20 border border-[#E39A5E]/25 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              title="Buka Halaman Transaksi"
            >
              <span>Semua Transaksi ({transactions.length})</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="space-y-2.5">
            {transactions.slice(0, 5).map((tx, idx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const isExpense = tx.type === 'expense';

              return (
                <div
                  key={tx.id}
                  onClick={() => setActiveTab('transaksi')}
                  className="group animate-row-in card-interactive glass-2 p-3 rounded-xl flex items-center justify-between gap-3 border border-[rgba(205,225,245,0.1)] hover:border-[#E39A5E]/40 cursor-pointer"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                  title="Klik untuk membuka riwayat transaksi"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <CategoryIcon
                        name={cat?.name || 'circle-ellipsis'}
                        size={17}
                        color={cat?.color || '#A3AFBC'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-[#EEF2F6] truncate group-hover:text-[#E39A5E] transition-colors">
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

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-semibold num-tabular ${
                        isExpense ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </span>
                    <ChevronRight size={14} className="text-[#A3AFBC] opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
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
