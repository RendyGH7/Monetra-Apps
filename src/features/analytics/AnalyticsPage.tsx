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
import {
  Heart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  ArrowRight,
  PieChart as DonutIcon,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  Target,
  Plus,
} from 'lucide-react';
import { CategoryIcon } from '../../components/common/CategoryIcon';
import {
  formatCurrency,
  formatCompact,
  formatDateIndo,
  formatTimeShort,
  getWIBParts,
  getNowWIBParts,
  getWIBStartOfWeek,
  getWIBStartOfMonth,
  getWIBStartOfYear,
  getDaysInWIBMonth,
  DAYS_SHORT_ID,
  MONTHS_ID,
  MONTHS_SHORT_ID,
} from '../../utils/format';

// ─── Type ────────────────────────────────────────────────────────────────────
type Period = 'week' | 'month' | 'year';

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
  const {
    transactions,
    categories,
    profile,
    wallets,
    setActiveTab,
    setAssistantInitialPrompt,
    setQuickManualOpen,
  } = useAppStore();
  const [period, setPeriod] = useState<Period>('week');
  const [chartMetric, setChartMetric] = useState<'all' | 'expense' | 'income'>('all');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);

  const chartPalette = [
    '#E39A5E', '#4FD3A4', '#6FA8D6', '#EE5D6C',
    '#CDBFA3', '#4FA8A0', '#B5603A', '#8A9AA8',
  ];

  // ── Date window calculations (WIB UTC+7) ──────────────────────────────────
  const nowWIB = getNowWIBParts();

  const windows = useMemo(() => {
    if (period === 'week') {
      const weekStart = getWIBStartOfWeek();
      const prevWeekStart = weekStart - 7 * 86400000;
      const prevWeekEnd = weekStart;
      return { current: weekStart, prevStart: prevWeekStart, prevEnd: prevWeekEnd };
    }
    if (period === 'month') {
      const monthStart = getWIBStartOfMonth();
      const prevYear = nowWIB.month === 0 ? nowWIB.year - 1 : nowWIB.year;
      const prevMonth = nowWIB.month === 0 ? 11 : nowWIB.month - 1;
      const prevMonthStart = Date.UTC(prevYear, prevMonth, 1) - (7 * 3600 * 1000);
      const prevMonthEnd = monthStart;
      return { current: monthStart, prevStart: prevMonthStart, prevEnd: prevMonthEnd };
    }
    // year
    const yearStart = getWIBStartOfYear();
    const prevYearStart = Date.UTC(nowWIB.year - 1, 0, 1) - (7 * 3600 * 1000);
    const prevYearEnd = yearStart;
    return { current: yearStart, prevStart: prevYearStart, prevEnd: prevYearEnd };
  }, [period]);

  // ── Filter transactions for current & previous period (WIB) ──────────────
  const currentTx = useMemo(() =>
    transactions.filter((t) => new Date(t.occurred_at).getTime() >= windows.current),
    [transactions, windows]
  );

  const prevTx = useMemo(() =>
    transactions.filter((t) => {
      const ms = new Date(t.occurred_at).getTime();
      return ms >= windows.prevStart && ms < windows.prevEnd;
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

  // ── Periodic Statistics Calculation (Mingguan / Bulanan / Tahunan in WIB) ──
  const periodStats = useMemo(() => {
    const todayWIB = getNowWIBParts();

    if (period === 'week') {
      const startOfWeek = getWIBStartOfWeek();
      const endOfWeek = startOfWeek + 7 * 86400000;
      const prevStart = startOfWeek - 7 * 86400000;
      const prevEnd = startOfWeek;

      const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const fullDayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const currentDayIdx = (todayWIB.day + 6) % 7; // Monday = 0

      const daysData = dayLabels.map((lbl, idx) => {
        const dParts = getWIBParts(startOfWeek + idx * 86400000);
        return {
          label: lbl,
          fullLabel: `${fullDayNames[idx]}, ${dParts.date} ${dParts.monthShort}`,
          expense: 0,
          income: 0,
          isCurrent: idx === currentDayIdx,
        };
      });

      let totalExp = 0;
      let totalInc = 0;
      let prevExp = 0;

      transactions.forEach((t) => {
        const tMs = new Date(t.occurred_at).getTime();
        if (tMs >= startOfWeek && tMs < endOfWeek) {
          const tParts = getWIBParts(t.occurred_at);
          const dIdx = (tParts.day + 6) % 7;
          if (t.type === 'expense') {
            totalExp += t.amount;
            daysData[dIdx].expense += t.amount;
          } else {
            totalInc += t.amount;
            daysData[dIdx].income += t.amount;
          }
        } else if (tMs >= prevStart && tMs < prevEnd && t.type === 'expense') {
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
      const startOfMonth = getWIBStartOfMonth();
      const daysInMonth = getDaysInWIBMonth(todayWIB.year, todayWIB.month);
      const nextMonthYear = todayWIB.month === 11 ? todayWIB.year + 1 : todayWIB.year;
      const nextMonthNum = todayWIB.month === 11 ? 0 : todayWIB.month + 1;
      const endOfMonth = Date.UTC(nextMonthYear, nextMonthNum, 1) - (7 * 3600 * 1000);

      const prevYear = todayWIB.month === 0 ? todayWIB.year - 1 : todayWIB.year;
      const prevMonth = todayWIB.month === 0 ? 11 : todayWIB.month - 1;
      const prevStart = Date.UTC(prevYear, prevMonth, 1) - (7 * 3600 * 1000);
      const prevEnd = startOfMonth;

      const monthData = Array.from({ length: daysInMonth }, (_, idx) => {
        const dayNum = idx + 1;
        const dParts = getWIBParts(Date.UTC(todayWIB.year, todayWIB.month, dayNum) - (7 * 3600 * 1000));
        return {
          label: `${dayNum}`,
          fullLabel: `${dParts.dayShort}, ${dayNum} ${todayWIB.monthShort}`,
          expense: 0,
          income: 0,
          isCurrent: dayNum === todayWIB.date,
        };
      });

      let totalExp = 0;
      let totalInc = 0;
      let prevExp = 0;

      transactions.forEach((t) => {
        const tParts = getWIBParts(t.occurred_at);
        if (tParts.year === todayWIB.year && tParts.month === todayWIB.month) {
          const dayNum = tParts.date;
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
        } else {
          const tMs = new Date(t.occurred_at).getTime();
          if (tMs >= prevStart && tMs < prevEnd && t.type === 'expense') {
            prevExp += t.amount;
          }
        }
      });

      const delta = prevExp > 0 ? Math.round(((totalExp - prevExp) / prevExp) * 100) : null;
      const avg = Math.round(totalExp / Math.max(1, todayWIB.date));

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
    const startOfYear = getWIBStartOfYear();
    const endOfYear = Date.UTC(todayWIB.year + 1, 0, 1) - (7 * 3600 * 1000);
    const prevStart = Date.UTC(todayWIB.year - 1, 0, 1) - (7 * 3600 * 1000);
    const prevEnd = startOfYear;

    const monthsData = MONTHS_SHORT_ID.map((lbl, idx) => ({
      label: lbl,
      fullLabel: `${MONTHS_ID[idx]} ${todayWIB.year}`,
      expense: 0,
      income: 0,
      isCurrent: idx === todayWIB.month,
    }));

    let totalExp = 0;
    let totalInc = 0;
    let prevExp = 0;

    transactions.forEach((t) => {
      const tParts = getWIBParts(t.occurred_at);
      if (tParts.year === todayWIB.year) {
        const mIdx = tParts.month;
        if (t.type === 'expense') {
          totalExp += t.amount;
          monthsData[mIdx].expense += t.amount;
        } else {
          totalInc += t.amount;
          monthsData[mIdx].income += t.amount;
        }
      } else {
        const tMs = new Date(t.occurred_at).getTime();
        if (tMs >= prevStart && tMs < prevEnd && t.type === 'expense') {
          prevExp += t.amount;
        }
      }
    });

    const delta = prevExp > 0 ? Math.round(((totalExp - prevExp) / prevExp) * 100) : null;
    const avg = Math.round(totalExp / (todayWIB.month + 1));

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
  const top5Sum = topExpenses.reduce((acc, t) => acc + t.amount, 0);
  const top5SharePct = totalExpense > 0 ? Math.round((top5Sum / totalExpense) * 100) : 0;

  // ── AI Financial Diagnosis 50/30/20 ──────────────────────────────────────
  const healthAdvice = useMemo(() => {
    if (totalExpense === 0) {
      return {
        badge: 'Belum Ada Transaksi',
        badgeColor: 'text-[#A3AFBC] bg-white/[0.06] border-white/10',
        text: 'Belum ada transaksi tercatat di periode ini. Mulai catat untuk melihat analisis kesehatan keuanganmu.',
        prompt: 'Monetra, bagaimana panduan awal menerapkan aturan keuangan 50/30/20 yang tepat untuk saya?',
      };
    }
    if (savingsPct === 0) {
      return {
        badge: 'Tabungan Perlu Ditambah',
        badgeColor: 'text-[#EE5D6C] bg-[#EE5D6C]/15 border-[#EE5D6C]/30',
        text: 'Belum ada dana dialokasikan ke tabungan/investasi. Sisihkan minimal 20% agar skor naik ke 85+.',
        prompt: `Monetra, pengeluaran saya saat ini Rp ${formatCurrency(totalExpense)} dan belum ada tabungan disisihkan. Berikan langkah praktis menyisihkan 20% tabungan!`,
      };
    }
    if (wantsPct > 35) {
      return {
        badge: 'Pos Keinginan Tinggi',
        badgeColor: 'text-[#E39A5E] bg-[#E39A5E]/15 border-[#E39A5E]/30',
        text: `Pengeluaran gaya hidup mencapai ${wantsPct}% (di atas batas 30%). Tekan jajan/hiburan untuk memperkuat tabungan darurat.`,
        prompt: `Monetra, porsi keinginan saya mencapai ${wantsPct}%. Bagaimana tips memangkas pos hiburan tanpa merasa terlalu ketat?`,
      };
    }
    if (needsPct > 60) {
      return {
        badge: 'Kebutuhan Mendominasi',
        badgeColor: 'text-[#6FA8D6] bg-[#6FA8D6]/15 border-[#6FA8D6]/30',
        text: `Kebutuhan pokok menyerap ${needsPct}% pengeluaran. Cek kembali tagihan rutin untuk efisiensi belanja esensial.`,
        prompt: `Monetra, kebutuhan esensial saya ${needsPct}%. Bagaimana cara mengefisiensikan belanja bulanan?`,
      };
    }
    return {
      badge: 'Alokasi Sangat Sehat',
      badgeColor: 'text-[#4FD3A4] bg-[#4FD3A4]/15 border-[#4FD3A4]/30',
      text: 'Distribusi keuanganmu sangat seimbang dan disiplin sesuai kaidah 50/30/20. Terus pertahankan pola ini!',
      prompt: 'Monetra, keuangan saya saat ini sangat sehat. Berikan strategi investasi lanjutan untuk meningkatkan aset!',
    };
  }, [totalExpense, savingsPct, wantsPct, needsPct]);

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
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#EEF2F6]">
          Statistik & Analisis
        </h1>
        <p className="text-xs sm:text-sm text-[#A3AFBC] mt-0.5">
          Pola konsumsi {periodLabel.toLowerCase()} dan evaluasi kesehatan finansial
        </p>
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
        <div className="card-hover-subtle glass-2 p-5 rounded-2xl border border-[var(--glass-border)] lg:col-span-2 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] flex items-center justify-center shrink-0">
                <DonutIcon size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Distribusi per Kategori</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">{periodLabel} · {pieData.length} Kategori</p>
              </div>
            </div>
          </div>

          {pieData.length === 0 ? (
            <div className="py-14 text-center text-xs text-[var(--text-secondary)] space-y-1">
              <p className="font-medium text-[var(--text-primary)]">Belum ada data pengeluaran pada periode ini</p>
              <p className="text-[11px]">Transaksi yang dicatat akan dikelompokkan otomatis di sini</p>
            </div>
          ) : (
            <>
              <div className="h-60 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={74}
                      outerRadius={100}
                      paddingAngle={4}
                      cornerRadius={6}
                      dataKey="value"
                      stroke="transparent"
                      onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                      onMouseLeave={() => setActiveCategoryIndex(null)}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={activeCategoryIndex === null || activeCategoryIndex === index ? 1 : 0.4}
                          style={{
                            transition: 'opacity 0.2s ease, transform 0.2s ease',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data: any = payload[0];
                          return (
                            <div className="glass-2 border border-[var(--glass-border)] rounded-xl px-3 py-2 shadow-xl backdrop-blur-md text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.color }} />
                                <span>{data.name}</span>
                              </div>
                              <p className="text-[var(--text-secondary)]">
                                Pengeluaran: <strong className="text-[var(--text-primary)] num-tabular">{formatCurrency(data.value)}</strong>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-200 select-none">
                  {activeCategoryIndex !== null && pieData[activeCategoryIndex] ? (
                    <div className="flex flex-col items-center justify-center text-center px-4 max-w-[136px]">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] truncate max-w-[125px]">
                        {pieData[activeCategoryIndex].name}
                      </span>
                      <span className="font-display font-bold text-sm sm:text-base text-[var(--text-primary)] num-tabular tracking-tight mt-0.5">
                        {formatCurrency(pieData[activeCategoryIndex].value)}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 num-tabular"
                        style={{
                          backgroundColor: `${pieData[activeCategoryIndex].color}25`,
                          color: pieData[activeCategoryIndex].color,
                        }}
                      >
                        {totalExpense > 0 ? Math.round((pieData[activeCategoryIndex].value / totalExpense) * 100) : 0}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center px-4">
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] tracking-wide">
                        Total
                      </span>
                      <span className="font-display font-bold text-base sm:text-lg text-[var(--text-primary)] num-tabular tracking-tight mt-0.5">
                        {formatCurrency(totalExpense)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Rows with Icons and Progress Bar */}
              <div className="space-y-1.5 pt-3 border-t border-[rgba(205,225,245,0.08)]">
                {pieData.slice(0, 5).map((entry, idx) => {
                  const pct = totalExpense > 0 ? Math.round((entry.value / totalExpense) * 100) : 0;
                  const isHovered = activeCategoryIndex === idx;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setActiveCategoryIndex(idx)}
                      onMouseLeave={() => setActiveCategoryIndex(null)}
                      className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                        isHovered
                          ? 'bg-white/[0.08] shadow-xs'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: `${entry.color}15`,
                              borderColor: `${entry.color}35`,
                              color: entry.color,
                            }}
                          >
                            <CategoryIcon name={entry.name} size={14} color={entry.color} />
                          </div>
                          <span className="font-medium text-[var(--text-primary)] truncate max-w-[120px] sm:max-w-[140px]">
                            {entry.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md num-tabular"
                            style={{
                              backgroundColor: `${entry.color}18`,
                              color: entry.color,
                            }}
                          >
                            {pct}%
                          </span>
                          <span className="font-semibold text-xs text-[var(--text-primary)] num-tabular">
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      </div>

                      {/* Micro Progress Bar */}
                      <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: entry.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 50/30/20 Card: Upgraded with Interactive AI Diagnosis & Budget Link */}
        <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] lg:col-span-3 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Health Score Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#A3AFBC]">
                  Skor Kesehatan Finansial
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display font-bold text-4xl text-[#E39A5E] num-tabular">
                    {score}
                  </span>
                  <span className="text-sm text-[#A3AFBC]">/ 100</span>
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${healthAdvice.badgeColor}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{healthAdvice.badge}</span>
                  </span>
                </div>
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

            {/* 50/30/20 Bars with Target Caps */}
            <div className="space-y-3 pt-3 border-t border-[rgba(205,225,245,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#74808E] font-medium uppercase tracking-wide">
                  Aturan 50 / 30 / 20
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('budget')}
                  className="text-[11px] text-[#E39A5E] hover:text-[#f3b584] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Buka Halaman Budget & Target"
                >
                  <Target size={12} />
                  <span>Atur Target</span>
                  <ChevronRight size={12} />
                </button>
              </div>

              {[
                {
                  label: 'Kebutuhan Pokok',
                  target: 50,
                  actual: needsPct,
                  amount: needsSum,
                  color: '#6FA8D6',
                  status: needsPct > 60 ? 'Over' : needsPct > 45 ? 'Optimal' : 'Aman',
                },
                {
                  label: 'Keinginan & Lifestyle',
                  target: 30,
                  actual: wantsPct,
                  amount: wantsSum,
                  color: wantsPct > 35 ? '#EE5D6C' : '#E39A5E',
                  status: wantsPct > 35 ? 'Over' : 'Terkontrol',
                },
                {
                  label: 'Tabungan & Darurat',
                  target: 20,
                  actual: savingsPct,
                  amount: savingsSum,
                  color: '#4FD3A4',
                  status: savingsPct >= 20 ? 'Tercapai' : 'Perlu Tambah',
                },
              ].map((row) => (
                <div key={row.label} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[#A3AFBC]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{row.label}:</span>
                      <span className="text-[#EEF2F6] font-medium num-tabular">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded font-semibold num-tabular"
                        style={{
                          backgroundColor: `${row.color}18`,
                          color: row.color,
                        }}
                      >
                        {row.actual}%
                        <span className="opacity-70 font-normal"> / {row.target}%</span>
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full progress-fill transition-all duration-500"
                      style={{ width: `${Math.min(100, row.actual)}%`, background: row.color }}
                    />
                    {/* Target marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/40 shadow-xs"
                      style={{ left: `${row.target}%` }}
                      title={`Target ideal: ${row.target}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connected AI Diagnosis Callout */}
          <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EEF2F6]">
                <Sparkles size={13} className="text-[#E39A5E]" />
                <span>Rekomendasi AI</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssistantInitialPrompt(healthAdvice.prompt);
                  setActiveTab('asisten');
                }}
                className="text-[11px] font-semibold text-[#E39A5E] hover:text-[#f3b584] inline-flex items-center gap-1 transition-colors cursor-pointer"
                title="Buka Asisten Keuangan AI dengan prompt rekomendasi ini"
              >
                <span>Tanya AI</span>
                <ArrowRight size={12} />
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {healthAdvice.text}
            </p>
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

        {/* Top 5 Expenses: Upgraded with Clean Typography, Badges, and Full App Interactivity */}
        <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#EEF2F6]">
                  Top 5 Pengeluaran Terbesar
                </h2>
                <p className="text-[11px] text-[#A3AFBC] mt-0.5">
                  Pos belanja dengan nominal tertinggi pada {periodLabel.toLowerCase()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('transaksi')}
                className="text-xs font-semibold text-[#E39A5E] hover:text-[#f3b584] inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Buka Halaman Riwayat Transaksi"
              >
                <span>Lihat Semua</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {topExpenses.length === 0 ? (
              <div className="py-8 text-center space-y-2 select-none">
                <p className="text-xs text-[#A3AFBC]">Belum ada data pengeluaran pada periode ini.</p>
                <button
                  type="button"
                  onClick={() => setQuickManualOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E39A5E]/15 border border-[#E39A5E]/30 text-[#E39A5E] text-xs font-semibold hover:bg-[#E39A5E]/25 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>Catat Transaksi Pertama</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topExpenses.map((tx, idx) => {
                  const cat = categories.find((c) => c.id === tx.category_id);
                  const walletObj = wallets.find((w) => w.id === tx.wallet_id);
                  const pct = totalExpense > 0 ? Math.round((tx.amount / totalExpense) * 100) : 0;
                  const itemColor = cat?.color || chartPalette[idx % chartPalette.length];

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setActiveTab('transaksi')}
                      className="animate-row-in group p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-[#E39A5E]/30 transition-all cursor-pointer"
                      style={{ animationDelay: `${idx * 0.04}s` }}
                      title="Klik untuk membuka riwayat transaksi"
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-[#E39A5E]/20 text-[#E39A5E] border border-[#E39A5E]/30 shadow-xs'
                              : idx === 1
                              ? 'bg-white/10 text-[#EEF2F6] border border-white/15'
                              : idx === 2
                              ? 'bg-[#B5603A]/20 text-[#B5603A] border border-[#B5603A]/30'
                              : 'bg-white/5 text-[#74808E]'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Category Icon */}
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0 border border-white/[0.06]">
                          <CategoryIcon name={cat?.icon || 'circleellipsis'} color={itemColor} size={15} />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-xs text-[#EEF2F6] truncate group-hover:text-[#E39A5E] transition-colors">
                              {tx.note || cat?.name || 'Pengeluaran'}
                            </span>
                            <span className="text-[#EE5D6C] font-semibold text-xs num-tabular shrink-0">
                              -{formatCurrency(tx.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#A3AFBC] mt-1 gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{cat?.name || 'Lainnya'}</span>
                              <span className="text-[#74808E]">·</span>
                              <span className="text-[#74808E] truncate">{walletObj?.name || 'Dompet'}</span>
                              <span className="text-[#74808E]">·</span>
                              <span className="text-[#74808E] shrink-0">{formatDateIndo(tx.occurred_at, false)}</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#E39A5E] num-tabular bg-[#E39A5E]/10 px-1.5 py-0.5 rounded shrink-0">
                              {pct}%
                            </span>
                          </div>

                          {/* Smooth Progress Bar */}
                          <div className="w-full h-1 rounded-full bg-white/[0.07] overflow-hidden mt-1.5">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(4, pct)}%`,
                                backgroundColor: itemColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connected Context Footer: Spending Share + AI Deep Dive */}
          {topExpenses.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-[var(--text-secondary)]">
                <span>Total 5 pos ini: </span>
                <span className="font-bold text-[#EEF2F6] num-tabular">{formatCurrency(top5Sum)}</span>
                <span className="text-[#A3AFBC] text-[11px]"> ({top5SharePct}% belanja)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const itemsSummary = topExpenses
                    .map((t, i) => `${i + 1}. ${t.note || 'Pengeluaran'} (${formatCurrency(t.amount)})`)
                    .join(', ');
                  setAssistantInitialPrompt(
                    `Monetra, berikut adalah 5 pengeluaran terbesarku periode ini: ${itemsSummary}. Totalnya ${formatCurrency(top5Sum)} (${top5SharePct}% dari seluruh pengeluaran). Berikan analisis mendalam dan strategi penghematannya!`
                  );
                  setActiveTab('asisten');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E39A5E] hover:text-[#f3b584] transition-colors cursor-pointer self-start sm:self-center"
                title="Minta AI mengevaluasi dan memberikan tips penghematan untuk pengeluaran terbesar ini"
              >
                <Sparkles size={13} />
                <span>Analisis via AI</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
