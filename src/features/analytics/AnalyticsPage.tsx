import React, { useMemo, useState } from 'react';
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
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { useAppStore } from '../../store';
import { formatCurrency, formatCompact } from '../../utils/format';
import { Heart, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

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
  const [period, setPeriod] = useState<Period>('month');

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

  // ── Bar chart data ───────────────────────────────────────────────────────
  const barData = useMemo(() => {
    if (period === 'week') {
      // 7 days: Sun → Sat of current week
      const weekStart = startOfWeek(now);
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dayEnd = new Date(day);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const expense = transactions
          .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= day && new Date(t.occurred_at) < dayEnd)
          .reduce((s, t) => s + t.amount, 0);
        const income = transactions
          .filter((t) => t.type === 'income' && new Date(t.occurred_at) >= day && new Date(t.occurred_at) < dayEnd)
          .reduce((s, t) => s + t.amount, 0);
        return { label: DAYS_ID[day.getDay()], pengeluaran: expense, pemasukan: income };
      });
    }

    if (period === 'month') {
      // Per-week of current month (W1, W2, W3, W4, W5)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const weeks: { label: string; pengeluaran: number; pemasukan: number }[] = [];
      let cursor = new Date(monthStart);
      let wNum = 1;
      while (cursor < monthEnd) {
        const wStart = new Date(cursor);
        const wEnd = new Date(cursor);
        wEnd.setDate(wEnd.getDate() + 7);
        const expense = transactions
          .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= wStart && new Date(t.occurred_at) < wEnd)
          .reduce((s, t) => s + t.amount, 0);
        const income = transactions
          .filter((t) => t.type === 'income' && new Date(t.occurred_at) >= wStart && new Date(t.occurred_at) < wEnd)
          .reduce((s, t) => s + t.amount, 0);
        weeks.push({ label: `M${wNum}`, pengeluaran: expense, pemasukan: income });
        cursor.setDate(cursor.getDate() + 7);
        wNum++;
      }
      return weeks;
    }

    // Year: 12 months
    return Array.from({ length: 12 }, (_, i) => {
      const mStart = new Date(now.getFullYear(), i, 1);
      const mEnd = new Date(now.getFullYear(), i + 1, 1);
      const expense = transactions
        .filter((t) => t.type === 'expense' && new Date(t.occurred_at) >= mStart && new Date(t.occurred_at) < mEnd)
        .reduce((s, t) => s + t.amount, 0);
      const income = transactions
        .filter((t) => t.type === 'income' && new Date(t.occurred_at) >= mStart && new Date(t.occurred_at) < mEnd)
        .reduce((s, t) => s + t.amount, 0);
      return { label: MONTHS_ID[i], pengeluaran: expense, pemasukan: income };
    });
  }, [transactions, period, now.toDateString()]);

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

        <div className="glass-1 p-1 rounded-xl flex items-center gap-0.5 border border-white/[0.08] text-xs self-start sm:self-auto">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`chip-press px-3 py-1.5 rounded-lg font-medium cursor-pointer ${
                period === p
                  ? 'bg-[#E39A5E] text-[#1C0E04] font-semibold'
                  : 'text-[#A3AFBC] hover:text-[#EEF2F6]'
              }`}
            >
              {p === 'week' ? 'Minggu' : p === 'month' ? 'Bulan' : 'Tahun'}
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

      {/* ── Bar Chart: Income vs Expense over time ───────────────────────── */}
      <div className="glass-1 p-5 rounded-2xl border border-[rgba(205,225,245,0.12)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#EEF2F6]">
            Pengeluaran vs Pemasukan —{' '}
            <span className="text-[#A3AFBC] font-normal">
              {period === 'week' ? 'Per hari' : period === 'month' ? 'Per minggu' : 'Per bulan'}
            </span>
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-[#A3AFBC]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#EE5D6C' }} />
              Keluar
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#4FD3A4' }} />
              Masuk
            </span>
          </div>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barGap={3} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(205,225,245,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#74808E', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fill: '#74808E', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pemasukan" name="Pemasukan" fill="#4FD3A4" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#EE5D6C" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily budget reference line info for week view */}
        {period === 'week' && profile.monthly_income > 0 && (
          <p className="text-[11px] text-[#74808E] pt-1 border-t border-[rgba(205,225,245,0.07)]">
            Rata-rata harian: <span className="text-[#E39A5E] font-semibold">{formatCurrency(weeklyAvg)}</span>
            {' '}· Target harian: <span className="text-[#4FD3A4] font-semibold">{formatCurrency(Math.round(profile.monthly_income / 30))}</span>
          </p>
        )}
      </div>

      {/* ── Category Donut + 50/30/20 ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
