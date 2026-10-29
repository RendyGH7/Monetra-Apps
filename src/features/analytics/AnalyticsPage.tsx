import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { useAppStore } from '../../store';
import { formatCurrency, formatCompact } from '../../utils/format';
import { Heart, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, BarChart3, ArrowRight } from 'lucide-react';

// ─── Type ────────────────────────────────────────────────────────────────────
type Period = 'week' | 'month' | 'year';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function startOfWeek(d: Date) {
  const c = startOfDay(new Date(d));
  c.setDate(c.getDate() - c.getDay()); // Sunday
  return c;
}

/** ISO week number (Mon-start) */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return Math.ceil((((t as any) - (jan4 as any)) / 86400000 + 1) / 7);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-2 px-3 py-2 rounded-xl border border-[rgba(205,225,245,0.2)] text-xs space-y-1 shadow-xl">
      <p className="text-[#A3AFBC] font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill || p.stroke || '#EEF2F6' }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const AnalyticsPage: React.FC = () => {
  const { transactions, categories, profile } = useAppStore();
  const [period, setPeriod] = useState<Period>('week');
  const [chartMetric, setChartMetric] = useState<'all' | 'expense' | 'income'>('all');

  const chartPalette = [
    '#E39A5E', '#4FD3A4', '#6FA8D6', '#EE5D6C',
    '#CDBFA3', '#4FA8A0', '#B5603A', '#8A9AA8',
  ];

  // ── Date window calculations ─────────────────────────────────────────────
  const now = new Date();

  const windows = useMemo(() => {
    const todayStart = startOfDay(now);

    if (period === 'week') {
      const weekStart = startOfWeek(now);
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekStart);
      return { current: weekStart, prevStart: prevWeekStart, prevEnd: prevWeekEnd };
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(monthStart);
      return { current: monthStart, prevStart: prevMonthStart, prevEnd: prevMonthEnd };
    }
    // year
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(yearStart);
    return { current: yearStart, prevStart: prevYearStart, prevEnd: prevYearEnd };
  }, [period, now.toDateString()]);

  // ── Filter transactions for current & previous period ────────────────────
  const currentTx = useMemo(() =>
    transactions.filter((t) => new Date(t.occurred_at) >= windows.current),
    [transactions, windows]
  );

  const prevTx = useMemo(() =>
    transactions.filter((t) => {
      const d = new Date(t.occurred_at);
      return d >= windows.prevStart && d < windows.prevEnd;
    }),
    [transactions, windows]
  );

  const currentExpense = currentTx.filter((t) => t.type === 'expense');
  const currentIncome = currentTx.filter((t) => t.type === 'income');

  const totalExpense = currentExpense.reduce((s, t) => s + t.amount, 0);
  const totalIncome = currentIncome.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const prevExpense = prevTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevIncome = prevTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  // ── Trend deltas ─────────────────────────────────────────────────────────
  const expenseDelta = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;
  const incomeDelta = prevIncome > 0 ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100) : null;

  // ── Periodic Statistics Calculation (Mingguan / Bulanan / Tahunan) ─────────
  const periodStats = useMemo(() => {
    const today = new Date();

    if (period === 'week') {
      const dayOfWeek = (today.getDay() + 6) % 7;
      const startOfWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek, 0, 0, 0);
      const endOfWeekDate = new Date(startOfWeekDate);
      endOfWeekDate.setDate(endOfWeekDate.getDate() + 7);

      const prevStart = new Date(startOfWeekDate);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(startOfWeekDate);

      const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const fullDayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const daysData = dayLabels.map((lbl, idx) => {
        const dObj = new Date(startOfWeekDate);
        dObj.setDate(dObj.getDate() + idx);
        return {
          label: lbl,
          fullLabel: `${fullDayNames[idx]}, ${dObj.getDate()} ${dObj.toLocaleDateString('id-ID', { month: 'short' })}`,
          expense: 0,
          income: 0,
          isCurrent: idx === dayOfWeek,
        };
      });

      let totalExp = 0;
      let totalInc = 0;
      let prevExp = 0;

      transactions.forEach((t) => {
        const d = new Date(t.occurred_at);
        if (d >= startOfWeekDate && d < endOfWeekDate) {
          const dIdx = (d.getDay() + 6) % 7;
          if (t.type === 'expense') {
            totalExp += t.amount;
            daysData[dIdx].expense += t.amount;
          } else {
            totalInc += t.amount;
            daysData[dIdx].income += t.amount;
          }
        } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
          prevExp += t.amount;
        }
      });

      const delta = prevExp > 0 ? Math.round(((totalExp - prevExp) / prevExp) * 100) : null;
      const avg = Math.round(totalExp / 7);

      return {
        title: 'Minggu Ini',
        chartSubtitle: 'Harian (7 Hari)',
        totalExpense: totalExp,
        totalIncome: totalInc,
        net: totalInc - totalExp,
        chartData: daysData,
        delta,
        prevLabel: 'minggu lalu',
        avgLabel: 'Rata-rata/hari',
        avgValue: avg,
      };
    }

    if (period === 'month') {
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

      let totalExp = 0;
      let totalInc = 0;
      let prevExp = 0;

      transactions.forEach((t) => {
        const d = new Date(t.occurred_at);
        if (d >= startOfMonth && d < endOfMonth) {
          const dayNum = d.getDate();
          const idx = dayNum - 1;
          if (idx >= 0 && idx < monthData.length) {
            if (t.type === 'expense') {
              totalExp += t.amount;
              monthData[idx].expense += t.amount;
            } else {
              totalInc += t.amount;
              monthData[idx].income += t.amount;
            }
          }
        } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
          prevExp += t.amount;
        }
      });

      const delta = prevExp > 0 ? Math.round(((totalExp - prevExp) / prevExp) * 100) : null;
      const avg = Math.round(totalExp / Math.max(1, today.getDate()));

      return {
        title: 'Bulan Ini',
        chartSubtitle: `Harian (${daysInMonth} Hari)`,
        totalExpense: totalExp,
        totalIncome: totalInc,
        net: totalInc - totalExp,
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

    let totalExp = 0;
    let totalInc = 0;
    let prevExp = 0;

    transactions.forEach((t) => {
      const d = new Date(t.occurred_at);
      if (d >= startOfYear && d < endOfYear) {
        const mIdx = d.getMonth();
        if (t.type === 'expense') {
          totalExp += t.amount;
          monthsData[mIdx].expense += t.amount;
        } else {
          totalInc += t.amount;
          monthsData[mIdx].income += t.amount;
        }
      } else if (d >= prevStart && d < prevEnd && t.type === 'expense') {
        prevExp += t.amount;
      }
    });

    const delta = prevExp > 0 ? Math.round(((totalExp - prevExp) / prevExp) * 100) : null;
    const avg = Math.round(totalExp / (today.getMonth() + 1));

    return {
      title: 'Tahun Ini',
      chartSubtitle: 'Bulanan (12 Bulan)',
      totalExpense: totalExp,
      totalIncome: totalInc,
      net: totalInc - totalExp,
      chartData: monthsData,
      delta,
      prevLabel: 'tahun lalu',
      avgLabel: 'Rata-rata/bulan',
      avgValue: avg,
    };
  }, [transactions, period]);

  // Minimalist Custom Tooltip matching Photo 1
  const MinimalChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-2 border border-[var(--glass-border)] rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[155px]">
          <p className="font-semibold text-[var(--text-primary)] border-b border-[var(--glass-border)] pb-1.5 text-[11px]">
            {data.fullLabel || data.label}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E39A5E]" />
                Pengeluaran
              </span>
              <span className="font-semibold text-[var(--text-primary)] num-tabular">
                {formatCurrency(data.expense || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[var(--text-secondary)]">
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

  // ── Daily spending line (week only) ──────────────────────────────────────
  const weeklyAvg = totalExpense > 0 ? Math.round(totalExpense / 7) : 0;

  // ── Category donut ───────────────────────────────────────────────────────
  const catSums: Record<string, number> = {};
  currentExpense.forEach((t) => {
    const c = categories.find((cat) => cat.id === t.category_id);
    const name = c?.name || 'Lainnya';
    catSums[name] = (catSums[name] || 0) + t.amount;
  });
  const pieData = Object.entries(catSums)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: chartPalette[i % chartPalette.length] }));

  // ── 50/30/20 ─────────────────────────────────────────────────────────────
  let needsSum = 0, wantsSum = 0, savingsSum = 0;
  currentExpense.forEach((t) => {
    const c = categories.find((cat) => cat.id === t.category_id);
    if (c?.need_want === 'need') needsSum += t.amount;
    else if (c?.need_want === 'want') wantsSum += t.amount;
    else if (c?.need_want === 'saving') savingsSum += t.amount;
    else needsSum += t.amount;
  });
  const needsPct = totalExpense > 0 ? Math.round((needsSum / totalExpense) * 100) : 0;
  const wantsPct = totalExpense > 0 ? Math.round((wantsSum / totalExpense) * 100) : 0;
  const savingsPct = totalExpense > 0 ? Math.round((savingsSum / totalExpense) * 100) : 0;

  // ── Health score ─────────────────────────────────────────────────────────
  const datingSum = catSums['Kencan & Pacaran'] || 0;
  const datingPct = profile.monthly_income > 0 ? Math.round((datingSum / profile.monthly_income) * 100) : 0;
  let score = 75;
  if (datingPct > 50) score -= 20;
  else if (datingPct > 35) score -= 10;
  if (totalExpense > profile.monthly_income) score -= 25;
  score = Math.max(20, Math.min(100, score));

  // ── Top expenses ─────────────────────────────────────────────────────────
  const topExpenses = [...currentExpense].sort((a, b) => b.amount - a.amount).slice(0, 5);

  // ── Period labels ─────────────────────────────────────────────────────────
  const periodLabel = period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Tahun Ini';
  const prevPeriodLabel = period === 'week' ? 'minggu lalu' : period === 'month' ? 'bulan lalu' : 'tahun lalu';

  // ── Summary stats for top row ─────────────────────────────────────────────
  const statCards = [
    {
      label: 'Total Pengeluaran',
      value: totalExpense,
      delta: expenseDelta,
      color: '#EE5D6C',
      // For expense, lower is better so invert the visual meaning
      positiveIsBetter: false,
    },
    {
      label: 'Total Pemasukan',
      value: totalIncome,
      delta: incomeDelta,
      color: '#4FD3A4',
      positiveIsBetter: true,
    },
    {
      label: 'Saldo Bersih',
      value: netBalance,
      delta: null,
      color: netBalance >= 0 ? '#4FD3A4' : '#EE5D6C',
      positiveIsBetter: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* ── Header + Period Tabs ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
            Statistik & Analisis
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
            Pola konsumsi {periodLabel.toLowerCase()} dan evaluasi kesehatan finansial
          </p>
        </div>

        <div className="flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs self-start sm:self-auto">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${
                period === p
                  ? 'bg-[#E39A5E]/15 text-[#E39A5E] font-semibold border border-[#E39A5E]/30 shadow-xs'
                  : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              {p === 'week' ? 'Mingguan' : p === 'month' ? 'Bulanan' : 'Tahunan'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Stat Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const isUp = (s.delta ?? 0) > 0;
          const isDown = (s.delta ?? 0) < 0;
          const isGood = s.positiveIsBetter ? isUp : isDown;
          const isBad = s.positiveIsBetter ? isDown : isUp;

          return (
            <div
              key={s.label}
              className="card-lift glass-2 p-5 rounded-2xl border border-[rgba(205,225,245,0.13)] space-y-2"
            >
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#A3AFBC]">
                {s.label}
              </span>
              <p
                className="font-display font-bold text-2xl num-tabular"
                style={{ color: s.color }}
              >
                {formatCurrency(Math.abs(s.value))}
              </p>
              {s.delta !== null ? (
                <div className="flex items-center gap-1 text-[11px]">
                  {isUp ? (
                    <ArrowUpRight size={13} className={isGood ? 'text-[#4FD3A4]' : 'text-[#EE5D6C]'} />
                  ) : isDown ? (
                    <ArrowDownRight size={13} className={isGood ? 'text-[#4FD3A4]' : 'text-[#EE5D6C]'} />
                  ) : (
                    <Minus size={13} className="text-[#74808E]" />
                  )}
                  <span
                    className={
                      isGood ? 'text-[#4FD3A4]' : isBad ? 'text-[#EE5D6C]' : 'text-[#74808E]'
                    }
                  >
                    {Math.abs(s.delta ?? 0)}% vs {prevPeriodLabel}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#74808E]">Pemasukan dikurangi pengeluaran</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Minimalist Periodic Statistics (Mingguan / Bulanan / Tahunan) ── */}
      <div className="card-lift glass-2 p-5 rounded-2xl border border-[var(--glass-border)] space-y-4">
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
            {(['week', 'month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`chip-press px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-180 ${
                  period === p
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
                  <linearGradient id="analyticsExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E39A5E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E39A5E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="analyticsIncGrad" x1="0" y1="0" x2="0" y2="1">
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
                  interval={period === 'month' ? 4 : 0}
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
                    fill="url(#analyticsExpGrad)"
                    dot={period === 'month' ? false : { r: 3, fill: '#E39A5E', strokeWidth: 1.5, stroke: '#1C0E04' }}
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
                    strokeDasharray={period === 'month' ? undefined : '2 2'}
                    fill="url(#analyticsIncGrad)"
                    dot={period === 'month' ? false : { r: 2.5, fill: '#4FD3A4', strokeWidth: 1, stroke: '#071F17' }}
                    activeDot={{ r: 4.5, fill: '#4FD3A4', stroke: '#EEF2F6', strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer with Trend Delta & Direct Link to Statistics Breakdown */}
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
            onClick={() => {
              const el = document.getElementById('category-distribution');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#E39A5E] hover:text-[#CF8143] font-medium transition-colors cursor-pointer group self-start sm:self-auto"
          >
            <span>Buka Analisis Lengkap</span>
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── Category Donut + 50/30/20 ────────────────────────────────────── */}
      <div id="category-distribution" className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Donut */}
        <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">Distribusi per Kategori</h2>
          {pieData.length === 0 ? (
            <div className="py-14 text-center text-xs text-[#A3AFBC]">
              Belum ada data pengeluaran pada periode ini.
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
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<CustomTooltip />}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[#74808E] uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold text-[#EEF2F6] num-tabular">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[rgba(205,225,245,0.08)]">
                {pieData.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-[#A3AFBC] truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[#74808E]">
                        {totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-[#EEF2F6] num-tabular">
                        {formatCurrency(entry.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 50/30/20 */}
        <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] lg:col-span-3 space-y-5">
          {/* Health Score */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#A3AFBC]">
                Skor Kesehatan
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display font-bold text-4xl text-[#E39A5E] num-tabular">
                  {score}
                </span>
                <span className="text-sm text-[#A3AFBC]">/ 100</span>
              </div>
              <p className="text-xs font-medium text-[#EEF2F6] mt-0.5">
                {score >= 80 ? 'Kondisi Sangat Sehat' : score >= 60 ? 'Cukup Waspada' : 'Perlu Evaluasi'}
              </p>
            </div>

            {/* Score ring visual */}
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke={score >= 80 ? '#4FD3A4' : score >= 60 ? '#E39A5E' : '#EE5D6C'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 163.4} 163.4`}
                  style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
            </div>
          </div>

          {/* 50/30/20 Bars */}
          <div className="space-y-3 pt-4 border-t border-[rgba(205,225,245,0.08)]">
            <p className="text-[11px] text-[#74808E] font-medium uppercase tracking-wide">
              Aturan 50 / 30 / 20
            </p>

            {[
              { label: 'Kebutuhan Pokok', target: 50, actual: needsPct, amount: needsSum, color: '#6FA8D6' },
              { label: 'Keinginan & Kencan', target: 30, actual: wantsPct, amount: wantsSum, color: wantsPct > 35 ? '#EE5D6C' : '#E39A5E' },
              { label: 'Tabungan & Darurat', target: 20, actual: savingsPct, amount: savingsSum, color: '#4FD3A4' },
            ].map((row) => (
              <div key={row.label} className="space-y-1 text-xs">
                <div className="flex justify-between text-[#A3AFBC]">
                  <span>{row.label}: <span className="text-[#EEF2F6] font-medium">{formatCurrency(row.amount)}</span></span>
                  <span
                    className="font-semibold"
                    style={{ color: Math.abs(row.actual - row.target) > 10 ? '#EE5D6C' : '#EEF2F6' }}
                  >
                    {row.actual}%
                    <span className="text-[#74808E] font-normal"> / {row.target}%</span>
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full progress-fill"
                    style={{ width: `${Math.min(100, row.actual)}%`, background: row.color }}
                  />
                  {/* Target marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                    style={{ left: `${row.target}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dating Analysis + Top 5 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dating Analysis */}
        <div className="glass-2 p-5 rounded-2xl border border-[rgba(205,225,245,0.13)] space-y-3">
          <div className="flex items-center gap-2">
            <Heart size={17} className="text-[#B5603A]" />
            <h2 className="text-sm font-semibold text-[#EEF2F6]">Analisis Pos Kencan</h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A3AFBC]">Total kencan {periodLabel.toLowerCase()}</span>
              <span className="font-bold text-[#E39A5E] num-tabular">{formatCurrency(datingSum)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A3AFBC]">Porsi dari gaji</span>
              <span
                className={`font-bold num-tabular ${datingPct > 40 ? 'text-[#EE5D6C]' : 'text-[#4FD3A4]'}`}
              >
                {datingPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A3AFBC]">Batas ideal per minggu</span>
              <span className="font-semibold text-[#4FD3A4]">Rp 150.000 - 200.000</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[rgba(205,225,245,0.08)]">
            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full progress-fill"
                style={{
                  width: `${Math.min(100, datingPct * 2)}%`,
                  background: datingPct > 40 ? '#EE5D6C' : '#E39A5E',
                }}
              />
            </div>
            <p className="text-[10px] text-[#74808E] mt-1.5 leading-relaxed">
              {datingPct <= 30
                ? 'Pengeluaran kencan terkendali. Pertahankan pola ini.'
                : datingPct <= 40
                ? 'Mendekati batas aman. Pertimbangkan aktivitas kencan hemat.'
                : 'Porsi kencan melebihi 40% gaji. Rekomendasi: kurangi frekuensi atau cari alternatif hemat.'}
            </p>
          </div>
        </div>

        {/* Top 5 Expenses */}
        <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] space-y-4">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">
            Top 5 Pengeluaran Terbesar
            <span className="text-[#74808E] font-normal text-xs ml-1.5">— {periodLabel}</span>
          </h2>

          {topExpenses.length === 0 ? (
            <p className="text-xs text-[#A3AFBC] py-8 text-center">Belum ada data pada periode ini.</p>
          ) : (
            <div className="space-y-2">
              {topExpenses.map((tx, idx) => {
                const cat = categories.find((c) => c.id === tx.category_id);
                const pct = totalExpense > 0 ? Math.round((tx.amount / totalExpense) * 100) : 0;
                return (
                  <div
                    key={tx.id}
                    className="animate-row-in flex items-center gap-3"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <span className="w-5 text-[11px] font-bold text-[#A3AFBC] text-right shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-medium text-[#EEF2F6] truncate">{tx.note}</span>
                        <span className="text-[#EE5D6C] font-semibold num-tabular shrink-0">
                          -{formatCurrency(tx.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full progress-fill"
                            style={{
                              width: `${pct}%`,
                              background: chartPalette[idx % chartPalette.length],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#74808E] shrink-0 w-12 text-right">
                          {pct}% · {cat?.name || 'Lainnya'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
