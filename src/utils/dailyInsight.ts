import { Transaction, UserProfile, Category, Wallet, Goal } from '../types';
import { formatCurrency, getWIBParts, getDaysInWIBMonth } from './format';

export interface DailyInsight {
  dateKey: string;           // Format: YYYY-MM-DD WIB
  dayName: string;           // e.g. "Kamis"
  badge: string;             // Badge title for the card
  badgeType: 'default' | 'warning' | 'celebration' | 'tip';
  message: string;           // Insight message text
  suggestedPrompt: string;   // Contextual prompt when clicking "Tanya Monetra"
}

interface GenerateInsightParams {
  currentTimestamp: number;
  profile: UserProfile;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  goals: Goal[];
}

export function getDailyInsight({
  currentTimestamp,
  profile,
  transactions,
  categories,
  wallets,
  goals,
}: GenerateInsightParams): DailyInsight {
  // 1. Compute current WIB time parts
  const todayWIB = getWIBParts(currentTimestamp);
  const dateKey = `${todayWIB.year}-${String(todayWIB.month + 1).padStart(2, '0')}-${String(todayWIB.date).padStart(2, '0')}`;
  
  // Day index: 0 = Senin, 1 = Selasa, ..., 6 = Minggu
  const dayIdx = (todayWIB.day + 6) % 7;
  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const dayName = dayNames[dayIdx];

  // 2. Compute user financial metrics
  const thisMonthTx = transactions.filter((t) => {
    const p = getWIBParts(t.occurred_at);
    return p.month === todayWIB.month && p.year === todayWIB.year;
  });

  const totalExpense = thisMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = thisMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Payday & days remaining
  const payDay = profile.pay_day || 25;
  const daysInMonth = getDaysInWIBMonth(todayWIB.year, todayWIB.month);
  let daysLeft = payDay - todayWIB.date;
  if (daysLeft < 0) daysLeft += daysInMonth;

  // Safe daily spend
  const safeDailySpend = daysLeft > 0 ? Math.max(0, Math.round(netBalance / daysLeft)) : Math.max(0, netBalance);

  // Today's expenses
  const todayExpenses = thisMonthTx
    .filter((t) => {
      const p = getWIBParts(t.occurred_at);
      return p.date === todayWIB.date && t.type === 'expense';
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Expense by category breakdown
  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  const catSpending: Record<string, { name: string; amount: number; needWant: string }> = {};
  let needsTotal = 0;
  let wantsTotal = 0;

  thisMonthTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      const catName = cat?.name || 'Lainnya';
      const needWant = cat?.need_want || 'want';

      if (!catSpending[catName]) {
        catSpending[catName] = { name: catName, amount: 0, needWant };
      }
      catSpending[catName].amount += t.amount;

      if (needWant === 'need') {
        needsTotal += t.amount;
      } else {
        wantsTotal += t.amount;
      }
    });

  const sortedCats = Object.values(catSpending).sort((a, b) => b.amount - a.amount);
  const topCat = sortedCats.length > 0 ? sortedCats[0] : null;
  const topCatPct = topCat && totalExpense > 0 ? Math.round((topCat.amount / totalExpense) * 100) : 0;
  const wantsPct = totalExpense > 0 ? Math.round((wantsTotal / totalExpense) * 100) : 0;

  // Dating category specific check
  const datingSpend = catSpending['Kencan & Pacaran']?.amount || 0;
  const datingBudget = profile.dating_budget_est || 0;
  const isDatingOver = datingBudget > 0 && datingSpend > datingBudget;

  // Total wallet balance
  const totalWalletBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  // ──────────────────────────────────────────────────────────────────────────
  // CASE A: USER HAS RECORDED TRANSACTIONS (ACTIVE FINANCIAL DATA)
  // ──────────────────────────────────────────────────────────────────────────
  if (thisMonthTx.length > 0) {
    // 1. Priority Event: Today is Payday!
    if (todayWIB.date === payDay) {
      return {
        dateKey,
        dayName,
        badge: 'Hari Gajian Tiba! 🎉',
        badgeType: 'celebration',
        message: `Selamat hari gajian, ${profile.nama}! Sebelum mulai berbelanja, jalankan prinsip "Pay Yourself First": langsung alokasikan minimal 20% (${formatCurrency(Math.round((profile.monthly_income || totalIncome || 1500000) * 0.2))}) ke pos tabungan atau dana darurat.`,
        suggestedPrompt: 'Monetra, bantu saya membuat rencana alokasi gaji hari ini dengan metode 50/30/20.',
      };
    }

    // 2. Priority Event: Near Payday (H-1 to H-3)
    if (daysLeft >= 1 && daysLeft <= 3) {
      return {
        dateKey,
        dayName,
        badge: 'Mode Siaga Akhir Bulan ⏳',
        badgeType: 'warning',
        message: `Tinggal ${daysLeft} hari lagi menuju gajian tanggal ${payDay}. Sisa anggaran belanja amanmu adalah ${formatCurrency(safeDailySpend)}/hari. Jaga pos pengeluaran harian tetap hemat agar cashflow bulan ini ditutup dengan surplus!`,
        suggestedPrompt: `Monetra, berikan strategi bertahan hemat selama ${daysLeft} hari menuju gajian.`,
      };
    }

    // 3. Priority Event: Overbudget in Dating/Entertainment
    if (isDatingOver) {
      return {
        dateKey,
        dayName,
        badge: 'Pos Kencan Melebihi Batas ⚠️',
        badgeType: 'warning',
        message: `Pengeluaran kencan bulan ini mencapai ${formatCurrency(datingSpend)}, melampaui target anggaran ${formatCurrency(datingBudget)}. Coba alternatif rekreasi santai yang ramah kantong seperti memasak bersama atau piknik santai.`,
        suggestedPrompt: 'Monetra, berikan ide kencan hemat dan seru di bawah Rp 50.000.',
      };
    }

    // 4. Priority Event: Today's Expense Spike (Over 150% of Safe Daily)
    if (todayExpenses > safeDailySpend * 1.5 && safeDailySpend > 0) {
      return {
        dateKey,
        dayName,
        badge: 'Evaluasi Belanja Hari Ini ⚠️',
        badgeType: 'warning',
        message: `Pengeluaran hari ini telah tercatat ${formatCurrency(todayExpenses)}, melampaui batas aman belanja harianmu (${formatCurrency(safeDailySpend)}). Seimbangkan kembali dengan mengerem pengeluaran non-esensial esok hari.`,
        suggestedPrompt: 'Monetra, bagaimana cara menyeimbangkan kembali anggaran setelah pengeluaran besar hari ini?',
      };
    }

    // 5. Daily Rotation Matrix based on Day of Week (Changes every midnight WIB)
    switch (dayIdx) {
      case 0: // Senin: Kickoff Pekan Baru & Alokasi Mingguan
        return {
          dateKey,
          dayName,
          badge: 'Kickoff Pekan Baru 🚀',
          badgeType: 'default',
          message: `Awal pekan baru, ${profile.nama}! Berdasarkan sisa saldo amanmu (${formatCurrency(safeDailySpend)}/hari), alokasi belanja aman selama 7 hari ke depan adalah sekitar ${formatCurrency(safeDailySpend * 7)}. Catat setiap transaksi harianmu agar cashflow tetap stabil.`,
          suggestedPrompt: `Monetra, bantu saya menyusun rencana batas pengeluaran mingguan dengan anggaran ${formatCurrency(safeDailySpend * 7)}.`,
        };

      case 1: // Selasa: Analisis Kategori Terbesar
        return {
          dateKey,
          dayName,
          badge: topCat ? `Fokus Kategori: ${topCat.name} 📊` : 'Audit Pengeluaran Mikro ☕',
          badgeType: 'default',
          message: topCat
            ? `Hingga hari ini, pengeluaran terbesar terserap pada pos ${topCat.name} sebesar ${formatCurrency(topCat.amount)} (${topCatPct}% dari total). Menekan pos ini sebesar 10% saja bisa mengamankan tambahan tabunganmu bulan ini.`
            : 'Pengeluaran mikro harian seperti kopi atau biaya transfer sering kali tak disadari. Periksa riwayat transaksimu dan eliminasi yang kurang esensial.',
          suggestedPrompt: topCat
            ? `Monetra, bagaimana tips praktis menekan pengeluaran untuk kategori ${topCat.name}?`
            : 'Monetra, bagaimana cara mengidentifikasi pengeluaran mikro yang bocor halus?',
        };

      case 2: // Rabu: Rasio Needs vs Wants
        return {
          dateKey,
          dayName,
          badge: 'Pola Belanja: Needs vs Wants ⚖️',
          badgeType: wantsPct > 45 ? 'warning' : 'default',
          message: wantsPct > 45
            ? `Porsi pengeluaran untuk pos keinginan (gaya hidup/hiburan) saat ini mencapai ${wantsPct}% (${formatCurrency(wantsTotal)}). Usahakan menyeimbangkan kembali dengan mengutamakan kebutuhan pokok dan tabungan.`
            : `Rasio kebutuhan pokok vs keinginanmu saat ini terjaga sehat (pos keinginan ${wantsPct}%). Pertahankan disiplin ini hingga akhir bulan!`,
          suggestedPrompt: 'Monetra, evaluasi transaksi saya dan tunjukkan mana pos yang bisa dihemat antara kebutuhan vs keinginan.',
        };

      case 3: // Kamis: Evaluasi Tabungan & Dompet
        return {
          dateKey,
          dayName,
          badge: goals.length > 0 ? 'Target Tabungan & Dana Impian 🎯' : 'Keseimbangan Saldo Dompet 💳',
          badgeType: 'default',
          message: goals.length > 0
            ? `Kamu memiliki ${goals.length} target tabungan aktif. Sisihkan ${formatCurrency(Math.max(10000, Math.round(safeDailySpend * 0.2)))} hari ini untuk mempercepat pencapaian target impianmu!`
            : `Total likuiditas dompetmu tercatat ${formatCurrency(totalWalletBalance)}. Pastikan saldo belanja di e-wallet terpisah dari rekening tabungan agar tidak mudah terpakai.`,
          suggestedPrompt: goals.length > 0
            ? 'Monetra, hitung perkiraan waktu penyelesaian target tabungan saya dengan sisa arus kas saat ini.'
            : 'Monetra, berikan saran alokasi saldo antara rekening bank dan e-wallet yang ideal.',
        };

      case 4: // Jumat: Strategi Weekend Anti-Boncos
        return {
          dateKey,
          dayName,
          badge: 'Strategi Akhir Pekan 🛡️',
          badgeType: 'default',
          message: `Menjelang akhir pekan, tetapkan batas maksimal belanja rekreasi dan kuliner sebelum hari Sabtu tiba. Rata-rata pengeluaran harianmu bulan ini adalah ${formatCurrency(Math.round(totalExpense / Math.max(1, todayWIB.date)))}/hari, jaga agar Sabtu-Minggu tidak boncos!`,
          suggestedPrompt: 'Monetra, berikan tips menjaga pengeluaran akhir pekan agar tetap seru tapi hemat.',
        };

      case 5: // Sabtu: Gaya Hidup & Hiburan Bijak
        return {
          dateKey,
          dayName,
          badge: 'Nongkrong & Hiburan Cerdas ✨',
          badgeType: 'default',
          message: `Nikmati akhir pekanmu dengan cerdas! Manfaatkan promo non-tunai, bandingkan menu sebelum memesan, dan utamakan pengalaman berkualitas dibanding pengeluaran impulsif.`,
          suggestedPrompt: 'Monetra, bagaimana cara bersenang-senang di akhir pekan tanpa mengorbankan target tabungan?',
        };

      case 6: // Minggu: Refleksi Arus Kas Mingguan
      default:
        return {
          dateKey,
          dayName,
          badge: 'Refleksi Mingguan Monetra 📈',
          badgeType: 'default',
          message: `Minggu ini total pengeluaranmu tercatat ${formatCurrency(totalExpense)}. Luangkan waktu sejenak malam ini untuk meninjau riwayat transaksi, evaluasi pos yang boros, dan siapkan rencana baru untuk pekan depan.`,
          suggestedPrompt: 'Monetra, bantu saya merefleksikan performa keuangan minggu ini dan evaluasi pos mana yang paling boros.',
        };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASE B: ZERO-DATA / PENGGUNA BELUM MENCATAT TRANSAKSI (7 DAILY FRESH TIPS)
  // ──────────────────────────────────────────────────────────────────────────
  // Each day of the week provides a distinct, actionable, and inspiring financial guide
  // that automatically changes every midnight at 12:00 AM WIB!
  switch (dayIdx) {
    case 0: // SENIN
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Senin: Rumus 50/30/20 📘',
        badgeType: 'tip',
        message: `Awali pekan baru dengan fondasi keuangan yang kuat! Terapkan aturan 50/30/20: 50% untuk kebutuhan pokok, 30% untuk keinginan, dan 20% langsung ke tabungan. Tekan tombol mikrofon atau catat transaksi pertamamu hari ini.`,
        suggestedPrompt: 'Monetra, jelaskan cara menerapkan aturan 50/30/20 untuk kondisi keuangan saya.',
      };

    case 1: // SELASA
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Selasa: Waspada Latte Factor ☕',
        badgeType: 'tip',
        message: `Pengeluaran kecil seperti kopi kekinian atau jajan Rp 15.000/hari bisa menumpuk jadi Rp 450.000 per bulan! Biasakan merekam transaksi mikro pertamamu agar uangmu tidak lenyap tanpa jejak.`,
        suggestedPrompt: 'Monetra, apa itu Latte Factor dan bagaimana cara menghentikan kebocoran uang kecil?',
      };

    case 2: // RABU
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Rabu: Pondasi Dana Darurat 🛡️',
        badgeType: 'tip',
        message: `Sebelum memikirkan investasi, bangunlah fondasi dana darurat minimal 3 bulan pengeluaran. Dana darurat adalah perisai utamamu saat terjadi musibah atau kondisi mendesak.`,
        suggestedPrompt: 'Monetra, berapa jumlah dana darurat ideal untuk saya dan bagaimana cara memulainya?',
      };

    case 3: // KAMIS
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Kamis: Metode Pemisahan Rekening 🏦',
        badgeType: 'tip',
        message: `Gunakan minimal dua rekening: satu untuk operasional belanja sehari-hari dan satu khusus tabungan tanpa kartu ATM aktif agar uang tabunganmu tidak mudah terpakai belanja.`,
        suggestedPrompt: 'Monetra, bagaimana cara terbaik membagi pos dompet dan rekening untuk pemula?',
      };

    case 4: // JUMAT
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Jumat: Aturan Tunggu 24 Jam ⏳',
        badgeType: 'tip',
        message: `Sering tergoda checkout belanja online menjelang akhir pekan? Terapkan aturan 24 jam: jika melihat barang non-esensial yang diinginkan, tunggu 24 jam. Biasanya keinginan membeli akan hilang dengan sendirinya.`,
        suggestedPrompt: 'Monetra, berikan tips psikologis untuk menghentikan kebiasaan belanja impulsif.',
      };

    case 5: // SABTU
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Sabtu: Rekreasi Hemat Akhir Pekan 🏕️',
        badgeType: 'tip',
        message: `Menikmati akhir pekan tidak harus menguras dompet! Berolahraga di ruang terbuka, memasak bersama orang terdekat, atau membaca buku memberikan ketenangan tanpa biaya besar.`,
        suggestedPrompt: 'Monetra, berikan ide kegiatan akhir pekan yang menyenangkan tanpa harus boros.',
      };

    case 6: // MINGGU
    default:
      return {
        dateKey,
        dayName,
        badge: 'Tips Finansial Minggu: Evaluasi & Rencana Pekan Depan 📝',
        badgeType: 'tip',
        message: `Kunci kemandirian finansial adalah konsistensi dan kesadaran (mindfulness). Luangkan 3 menit sebelum tidur malam ini untuk menyiapkan catatan keuanganmu bersama Monetra menjelang pekan baru.`,
        suggestedPrompt: 'Monetra, bagaimana cara menyusun anggaran mingguan yang mudah dipatuhi?',
      };
  }
}
