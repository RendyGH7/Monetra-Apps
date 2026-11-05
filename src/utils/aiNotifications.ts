import { UserProfile, Transaction, Category, Wallet, Goal, AIMemory, AINotification, NeedWantType } from '../types';
import { formatCurrency, getWIBParts, getNowWIBParts, formatTimeShort } from './format';

export const NOTIFICATION_READ_STORAGE_KEY = 'monetra_read_notifications_v1';

export function getStoredReadNotificationIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredReadNotificationIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export interface NotificationGeneratorContext {
  profile: UserProfile;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  goals: Goal[];
  memories: AIMemory[];
  readIds?: string[];
}

/**
 * Dynamically evaluates the user's financial ledger and returns prioritized AI Notifications.
 * Re-computes whenever transactions, profile, or goals change.
 */
export function generateAINotifications(context: NotificationGeneratorContext): AINotification[] {
  const { profile, transactions, categories, wallets, goals, memories, readIds = [] } = context;
  const readSet = new Set(readIds);

  const notifications: AINotification[] = [];
  const nowWIB = getNowWIBParts();
  const currentMonth = nowWIB.month;
  const currentYear = nowWIB.year;
  const todayDate = nowWIB.date;

  // Filter transactions this month
  const thisMonthTx = transactions.filter((t) => {
    const p = getWIBParts(t.occurred_at);
    return p.month === currentMonth && p.year === currentYear;
  });

  const totalIncome = thisMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = thisMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Calculate Payday & Daily Safe Spend
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;
  const safeDaily = Math.max(0, Math.round(netBalance / daysLeft));

  // Today's total expense
  const todayTx = transactions.filter((t) => {
    const p = getWIBParts(t.occurred_at);
    return p.date === todayDate && p.month === currentMonth && p.year === currentYear && t.type === 'expense';
  });
  const todayExpense = todayTx.reduce((sum, t) => sum + t.amount, 0);

  // Map categories to Need/Want
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));

  const resolveNeedWant = (t: Transaction): NeedWantType => {
    if (t.type === 'income') return 'saving';
    if (t.category_id && catMap.has(t.category_id)) {
      return catMap.get(t.category_id)!.need_want;
    }
    const lowerNote = t.note.toLowerCase();
    if (lowerNote.includes('date') || lowerNote.includes('pacar') || lowerNote.includes('nonton') || lowerNote.includes('kafe')) {
      return 'want';
    }
    return 'need';
  };

  const needsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && resolveNeedWant(t) === 'need')
    .reduce((sum, t) => sum + t.amount, 0);
  const wantsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && resolveNeedWant(t) === 'want')
    .reduce((sum, t) => sum + t.amount, 0);
  const savingsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && resolveNeedWant(t) === 'saving')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = profile.monthly_income || 1500000;
  const targetNeeds = Math.round(monthlyIncome * 0.5);
  const targetWants = Math.round(monthlyIncome * 0.3);
  const targetSavings = Math.round(monthlyIncome * 0.2);

  // 1. Peringatan & Status Gajian
  const paydayId = `notif-payday-${currentYear}-${currentMonth}-${daysLeft <= 1 ? 'imminent' : 'normal'}`;
  if (todayDate === payDay) {
    notifications.push({
      id: paydayId,
      type: 'payday',
      severity: 'info',
      title: 'Hari Gajian Tiba',
      message: `Gaji bulan ini telah masuk. Segera amankan alokasi tabungan 20% (${formatCurrency(targetSavings)}) sebelum memulai pengeluaran konsumtif.`,
      timestamp: Date.now() - 1000 * 60 * 30,
      read: readSet.has(paydayId),
      actionTab: 'budget',
    });
  } else if (daysLeft <= 3) {
    notifications.push({
      id: paydayId,
      type: 'payday',
      severity: 'warning',
      title: `Hitung Mundur Gajian: ${daysLeft} Hari Lagi`,
      message: `Tanggal gajian (${payDay}) semakin dekat. Batasi pengeluaran harianmu maksimal ${formatCurrency(safeDaily)}/hari agar saldo tetap surplus.`,
      timestamp: Date.now() - 1000 * 60 * 60,
      read: readSet.has(paydayId),
      actionTab: 'beranda',
    });
  } else {
    notifications.push({
      id: paydayId,
      type: 'payday',
      severity: 'info',
      title: 'Status Siklus Gajian',
      message: `Tersisa ${daysLeft} hari menuju tanggal ${payDay}. Batas belanja harian yang aman untukmu saat ini adalah ${formatCurrency(safeDaily)}/hari.`,
      timestamp: Date.now() - 1000 * 60 * 120,
      read: readSet.has(paydayId),
      actionTab: 'beranda',
    });
  }

  // 2. Evaluasi Belanja Harian (Daily Safe Spend Alert)
  if (todayExpense > safeDaily && safeDaily > 0) {
    const dailyOverId = `notif-daily-over-${currentYear}-${currentMonth}-${todayDate}`;
    const diff = todayExpense - safeDaily;
    notifications.push({
      id: dailyOverId,
      type: 'daily_safe',
      severity: 'warning',
      title: 'Pengeluaran Hari Ini Melebihi Batas',
      message: `Hari ini kamu telah mencatat pengeluaran ${formatCurrency(todayExpense)}, melebihi jatah harian ${formatCurrency(safeDaily)} sebesar ${formatCurrency(diff)}. Rem pengeluaran besok untuk menjaga ritme.`,
      timestamp: Date.now() - 1000 * 60 * 15,
      read: readSet.has(dailyOverId),
      actionTab: 'transaksi',
    });
  }

  // 3. Peringatan Alokasi 50/30/20 (Wants / Needs Overbudget)
  if (wantsExpense > targetWants && targetWants > 0) {
    const wantsId = `notif-wants-over-${currentYear}-${currentMonth}`;
    const overAmount = wantsExpense - targetWants;
    notifications.push({
      id: wantsId,
      type: 'budget_warning',
      severity: 'danger',
      title: 'Plafon Keinginan (Wants 30%) Jebol',
      message: `Pos gaya hidup & hiburan tercatat ${formatCurrency(wantsExpense)}, melampaui plafon ${formatCurrency(targetWants)} sebesar ${formatCurrency(overAmount)}. AI menyarankan tunda nongkrong & jajan kafe minggu ini.`,
      timestamp: Date.now() - 1000 * 60 * 45,
      read: readSet.has(wantsId),
      actionTab: 'statistik',
      actionPrompt: 'Bagaimana strategi memulihkan anggaran keinginan yang melebihi batas?',
    });
  } else if (wantsExpense > targetWants * 0.8 && targetWants > 0) {
    const wantsNearId = `notif-wants-near-${currentYear}-${currentMonth}`;
    notifications.push({
      id: wantsNearId,
      type: 'budget_warning',
      severity: 'warning',
      title: 'Plafon Keinginan Mendekati Batas',
      message: `Pengeluaran keinginan telah terpakai ${Math.round((wantsExpense / targetWants) * 100)}% (${formatCurrency(wantsExpense)} dari ${formatCurrency(targetWants)}). Prioritaskan sisa dana untuk kebutuhan pokok.`,
      timestamp: Date.now() - 1000 * 60 * 90,
      read: readSet.has(wantsNearId),
      actionTab: 'statistik',
    });
  }

  // 4. Peringatan Pos Pengeluaran Terbesar Berdasarkan Catatan Riil
  const catTotals: Record<string, number> = {};
  thisMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
    const catName = catMap.get(t.category_id || '')?.name || 'Lainnya';
    catTotals[catName] = (catTotals[catName] || 0) + t.amount;
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  if (sortedCats.length > 0 && totalExpense > 0) {
    const [topName, topAmount] = sortedCats[0];
    const topPct = Math.round((topAmount / totalExpense) * 100);
    if (topPct >= 35) {
      const topCatId = `notif-topcat-${currentYear}-${currentMonth}-${topName}`;
      notifications.push({
        id: topCatId,
        type: 'spending',
        severity: 'info',
        title: `Dominasi Pengeluaran: ${topName}`,
        message: `Kategori "${topName}" menyerap ${topPct}% dari seluruh pengeluaran bulan ini (${formatCurrency(topAmount)}). Pantau pos ini agar saldo tidak tergerus cepat.`,
        timestamp: Date.now() - 1000 * 60 * 150,
        read: readSet.has(topCatId),
        actionTab: 'transaksi',
      });
    }
  }

  // 5. Evaluasi Progres Target Tabungan / Goals
  goals.forEach((g) => {
    const pct = Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100);
    const goalId = `notif-goal-${g.id}-${pct >= 100 ? 'done' : pct >= 80 ? 'near' : 'progress'}`;

    if (pct >= 100) {
      notifications.push({
        id: goalId,
        type: 'goal',
        severity: 'success',
        title: `Target Tercapai: ${g.name}`,
        message: `Luar biasa! Saldo target tabungan "${g.name}" telah terkumpul 100% (${formatCurrency(g.target_amount)}).`,
        timestamp: Date.now() - 1000 * 60 * 200,
        read: readSet.has(goalId),
        actionTab: 'budget',
      });
    } else if (pct >= 80) {
      const remaining = g.target_amount - g.current_amount;
      notifications.push({
        id: goalId,
        type: 'goal',
        severity: 'success',
        title: `Target ${g.name} Hampir Tuntas`,
        message: `Progres tabunganmu sudah mencapai ${pct}%. Tersisa ${formatCurrency(remaining)} lagi untuk mencapai impianmu!`,
        timestamp: Date.now() - 1000 * 60 * 240,
        read: readSet.has(goalId),
        actionTab: 'budget',
      });
    }
  });

  // 6. Evaluasi Pos Kencan (Dating Budget)
  const datingExpense = thisMonthTx
    .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
    .reduce((sum, t) => sum + t.amount, 0);
  const datingBudget = profile.dating_budget_est || 600000;

  if (datingExpense > datingBudget && datingBudget > 0) {
    const datingId = `notif-dating-over-${currentYear}-${currentMonth}`;
    notifications.push({
      id: datingId,
      type: 'budget_warning',
      severity: 'warning',
      title: 'Pengeluaran Kencan Melebihi Estimasi',
      message: `Pos pacaran bulan ini tercatat ${formatCurrency(datingExpense)}, melebihi batas anggaran ${formatCurrency(datingBudget)}. Coba aktivitas kencan hemat seperti piknik di taman atau masak berdua.`,
      timestamp: Date.now() - 1000 * 60 * 180,
      read: readSet.has(datingId),
      actionTab: 'asisten',
      actionPrompt: 'Berikan ide kencan hemat dan romantis untuk akhir pekan ini',
    });
  }

  // 7. Monetra AI Intelligent Advice (Saran Berbobot)
  const aiTipId = `notif-aitip-${currentYear}-${currentMonth}-${todayDate}`;
  const daysElapsed = Math.max(1, todayDate);
  const burnRate = Math.round(totalExpense / daysElapsed);
  const projectedEnd = netBalance - (burnRate * daysLeft);

  let tipMessage = 'Pencatatan konsisten setiap hari adalah fondasi kebebasan finansial.';
  if (projectedEnd >= 0) {
    tipMessage = `Laju cashflow saat ini diproyeksikan surplus ${formatCurrency(projectedEnd)} di akhir bulan. Pertahankan ritme belanja harianmu di kisaran ${formatCurrency(safeDaily)}/hari.`;
  } else {
    tipMessage = `Waspada cashflow: proyeksi saldo akhir bulan berpotensi defisit ${formatCurrency(Math.abs(projectedEnd))}. Turunkan belanja harian ke ${formatCurrency(safeDaily)}/hari untuk menyeimbangkan saldo.`;
  }

  notifications.push({
    id: aiTipId,
    type: 'ai_tip',
    severity: projectedEnd >= 0 ? 'info' : 'warning',
    title: 'Saran Finansial Monetra AI',
    message: tipMessage,
    timestamp: Date.now() - 1000 * 60 * 300,
    read: readSet.has(aiTipId),
    actionTab: 'asisten',
    actionPrompt: 'Bagaimana evaluasi laju pengeluaran saya saat ini?',
  });

  // Sort: Unread first, then highest severity, then newest timestamp
  const severityOrder: Record<string, number> = {
    danger: 3,
    warning: 2,
    success: 1,
    info: 0,
  };

  return notifications.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    const diffSev = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (diffSev !== 0) return diffSev;
    return b.timestamp - a.timestamp;
  });
}

