import { UserProfile, Transaction, AIMemory, ChatMessage, ParsedVoiceItem, TransactionType, NeedWantType, Wallet, Goal, Category } from '../types';
import { formatCurrency, stripEmoji, getWIBParts, getNowWIBParts, formatDateTimeWIB } from '../utils/format';
import { parseVoiceInput } from '../utils/voiceParser';

export const GEMINI_API_KEY_STORAGE = 'finai_gemini_api_key';
export const DEFAULT_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_KEY;
  const stored = localStorage.getItem(GEMINI_API_KEY_STORAGE);
  if (stored && stored.trim()) return stored.trim();
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  if (envKey && envKey.trim()) return envKey.trim();
  return DEFAULT_GEMINI_KEY;
}

export function saveStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key.trim()) {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
  }
}

export interface AIContext {
  profile: UserProfile;
  transactions: Transaction[];
  wallets?: Wallet[];
  goals?: Goal[];
  categories?: Category[];
  memories: AIMemory[];
  chatHistory: ChatMessage[];
  addTransaction?: (tx: Omit<Transaction, 'id' | 'created_at'>) => void;
  addMemory?: (mem: Omit<AIMemory, 'id' | 'updated_at'>) => void;
}

export interface AIResponseResult {
  text: string;
  source: 'gemini' | 'local_brain';
  recordedTransactionCount?: number;
}

/**
 * Main AI Engine for FinAI:
 * 1. Checks if transaction command is typed (e.g. "catat makan 20rb") -> parses & auto-records!
 * 2. If Google Gemini API key is configured -> sends to Gemini 3.5 Flash with deep financial context and auto-learning tags.
 * 3. Fallback -> runs deep Contextual Financial Reasoning Engine.
 */
export async function askMonetra(
  userPrompt: string,
  context: AIContext
): Promise<AIResponseResult> {
  const cleanPrompt = stripEmoji(userPrompt).trim();
  const lowerPrompt = cleanPrompt.toLowerCase();
  const apiKey = getStoredGeminiKey();

  // ── 1. Check if user is asking to record an expense or income via chat ────
  const recordIntentWords = ['catat', 'tulis', 'masukin', 'input', 'tadi beli', 'tadi habis', 'bayar'];
  const hasRecordIntent = recordIntentWords.some((w) => lowerPrompt.startsWith(w) || lowerPrompt.includes(w));
  const parsedItems = parseVoiceInput(cleanPrompt);

  if (hasRecordIntent && parsedItems.length > 0 && context.addTransaction) {
    const defaultWalletId = context.wallets?.[0]?.id || 'wallet-cash';

    parsedItems.forEach((item) => {
      // Find matching wallet if mentioned
      let targetWalletId = defaultWalletId;
      if (context.wallets) {
        if (lowerPrompt.includes('bank') || lowerPrompt.includes('bca') || lowerPrompt.includes('mandiri')) {
          const w = context.wallets.find((x) => x.name.toLowerCase().includes('bank'));
          if (w) targetWalletId = w.id;
        } else if (lowerPrompt.includes('gopay') || lowerPrompt.includes('ovo') || lowerPrompt.includes('e-wallet') || lowerPrompt.includes('dana')) {
          const w = context.wallets.find((x) => x.name.toLowerCase().includes('wallet') || x.name.toLowerCase().includes('gopay'));
          if (w) targetWalletId = w.id;
        } else if (lowerPrompt.includes('tunai') || lowerPrompt.includes('cash')) {
          const w = context.wallets.find((x) => x.name.toLowerCase().includes('tunai') || x.name.toLowerCase().includes('cash'));
          if (w) targetWalletId = w.id;
        }
      }

      // Match category properly based on item.category and item.type
      const matchedCat = context.categories?.find(
        (c) => c.name.toLowerCase() === item.category.toLowerCase()
      ) || context.categories?.find((c) => c.type === item.type);

      const targetCatId =
        matchedCat?.id ||
        (item.type === 'income' ? 'cat-side' : 'cat-food');

      context.addTransaction!({
        user_id: context.profile.id,
        type: item.type,
        amount: item.amount,
        note: item.note,
        occurred_at: item.occurred_at,
        source: 'text',
        category_id: targetCatId,
        wallet_id: targetWalletId,
      });
    });

    const recordedList = parsedItems
      .map((it) => `- ${it.note}: ${formatCurrency(it.amount)} (${it.category})`)
      .join('\n');

    return {
      text: `Siap! Saya sudah mencatat ${parsedItems.length} transaksi ke dalam pembukuanmu:\n${recordedList}\n\nSaldo dompet dan grafik di Beranda telah diperbarui secara otomatis. Ada transaksi lain yang ingin dicatat?`,
      source: 'local_brain',
      recordedTransactionCount: parsedItems.length,
    };
  }

  // ── 2. If Gemini API Key is available -> query Google Gemini ──────────────
  if (apiKey) {
    try {
      const geminiReply = await queryGeminiAPI(cleanPrompt, apiKey, context);
      if (geminiReply) {
        return {
          text: stripEmoji(geminiReply),
          source: 'gemini',
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local reasoning:', err);
    }
  }

  // ── 3. Advanced Local Financial Reasoning Engine ─────────────────────────
  const localReply = smartLocalFinancialReasoning(cleanPrompt, context);
  return {
    text: stripEmoji(localReply),
    source: 'local_brain',
  };
}

// ─── Query Google Gemini REST API ──────────────────────────────────────────
async function queryGeminiAPI(
  userPrompt: string,
  apiKey: string,
  context: AIContext
): Promise<string> {
  const { profile, transactions, memories, chatHistory, wallets, goals } = context;

  const nowWIB = getNowWIBParts();
  const currentMonth = nowWIB.month;
  const currentYear = nowWIB.year;

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

  const datingExpense = thisMonthTx
    .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
    .reduce((sum, t) => sum + t.amount, 0);

  const catMap = new Map<string, Category>();
  context.categories?.forEach((c) => catMap.set(c.id, c));

  const getNeedWant = (t: Transaction): NeedWantType => {
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

  // 50/30/20 breakdown
  const needsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && getNeedWant(t) === 'need')
    .reduce((sum, t) => sum + t.amount, 0);
  const wantsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && getNeedWant(t) === 'want')
    .reduce((sum, t) => sum + t.amount, 0);
  const savingsExpense = thisMonthTx
    .filter((t) => t.type === 'expense' && getNeedWant(t) === 'saving')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = profile.monthly_income || 1500000;
  const targetNeeds = Math.round(monthlyIncome * 0.5);
  const targetWants = Math.round(monthlyIncome * 0.3);
  const targetSavings = Math.round(monthlyIncome * 0.2);

  const todayDate = nowWIB.date;
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;
  const safeDailySpend = Math.max(0, Math.round(netBalance / daysLeft));

  const daysElapsed = Math.max(1, todayDate);
  const dailyBurnRate = Math.round(totalExpense / daysElapsed);
  const projectedMonthEndBalance = netBalance - (dailyBurnRate * daysLeft);

  const walletsSummary = (wallets && wallets.length > 0)
    ? wallets.map((w) => `${w.name}: ${formatCurrency(w.balance)}`).join(', ')
    : 'Belum ada rincian dompet';
  const totalWallets = (wallets || []).reduce((sum, w) => sum + w.balance, 0);

  const goalsSummary = (goals && goals.length > 0)
    ? goals.map((g) => `${g.name}: ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)} (${Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100)}%)`).join(' | ')
    : 'Belum ada target tabungan';

  const categorySpendingList = (context.categories || [])
    .map((c) => {
      const txs = thisMonthTx.filter((t) => t.category_id === c.id && t.type === 'expense');
      const sum = txs.reduce((acc, t) => acc + t.amount, 0);
      return sum > 0 ? `${c.name}: ${formatCurrency(sum)} (${txs.length}x)` : null;
    })
    .filter(Boolean);
  const categorySpendingSummary = categorySpendingList.length > 0 ? categorySpendingList.join(' | ') : 'Belum ada pengeluaran per kategori bulan ini';

  const catTotals: Record<string, number> = {};
  thisMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
    const c = catMap.get(t.category_id || '')?.name || 'Lainnya';
    catTotals[c] = (catTotals[c] || 0) + t.amount;
  });
  const topSpentEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const topSpentSummary = topSpentEntries.length > 0
    ? topSpentEntries.slice(0, 3).map(([name, amt]) => `${name}: ${formatCurrency(amt)} (${Math.round((amt / Math.max(1, totalExpense)) * 100)}%)`).join(', ')
    : 'Belum ada data pengeluaran';

  const recentTxSummary = transactions
    .slice(0, 15)
    .map((t) => {
      const cat = catMap.get(t.category_id || '')?.name || 'Umum';
      const wName = (wallets || []).find((w) => w.id === t.wallet_id)?.name || 'Dompet';
      return `- ${formatDateTimeWIB(t.occurred_at)} | ${t.note} | ${cat} | ${wName} | ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}`;
    })
    .join('\n');

  const systemInstructionText = `
Kamu adalah Monetra, pusat kecerdasan finansial (Core Financial Brain) berstandar Private Wealth & Financial Analyst untuk akun pengguna saat ini.
Kamu memiliki akses menyeluruh ke profil pengguna, status saldo riil, rincian dompet, target tabungan, pengeluaran kategori, histori transaksi terperinci, dan memori jangka panjang.

WAKTU & ZONA SAAT INI (INDONESIA WIB / UTC+7):
- Hari & Tanggal: ${nowWIB.dayName}, ${nowWIB.date} ${nowWIB.monthName} ${nowWIB.year}
- Jam & Menit: ${nowWIB.timeString} WIB (Waktu Indonesia Barat)
- Tahun: ${nowWIB.year}, Bulan: ${nowWIB.monthName} (Bulan ke-${nowWIB.month + 1})
Setiap kali pengguna menanyakan waktu, jam, tanggal, atau hari, selalu jawab persis mengikuti Waktu Indonesia Barat (WIB) ini.

PROFIL PENGGUNA:
- Nama: ${profile.nama}
- Email Akun: ${profile.email || 'Lokal / Terisolasi'}
- Status: ${profile.internship_status || 'Anak Magang'}
- Gaji/Pemasukan Bulanan: ${formatCurrency(monthlyIncome)} per bulan
- Siklus Gajian: Tiap tanggal ${payDay} (${daysLeft} hari lagi menuju gajian)
- Sisa Saldo Bulan Ini: ${formatCurrency(netBalance)}
- Batas Aman Belanja Harian: ${formatCurrency(safeDailySpend)}/hari
- Total Pengeluaran Bulan Ini: ${formatCurrency(totalExpense)}
- Pos Pengeluaran Terbesar: ${topSpentSummary}
- Pengeluaran Kencan Bulan Ini: ${formatCurrency(datingExpense)} (Budget estimasi: ${formatCurrency(profile.dating_budget_est || 600000)})
- Bisnis Sampingan: ${profile.side_hustle_status || 'Belum aktif'}

ANALISIS ALOKASI 50/30/20 REAL-TIME:
- Kebutuhan (Needs 50%): Aktual ${formatCurrency(needsExpense)} / Target ${formatCurrency(targetNeeds)} (${Math.round((needsExpense / Math.max(1, targetNeeds)) * 100)}%) -> Status: ${needsExpense > targetNeeds ? 'OVERBUDGET (Perlu Penghematan)' : 'TERKENDALI'}
- Keinginan (Wants 30%): Aktual ${formatCurrency(wantsExpense)} / Target ${formatCurrency(targetWants)} (${Math.round((wantsExpense / Math.max(1, targetWants)) * 100)}%) -> Status: ${wantsExpense > targetWants ? 'OVERBUDGET (Rem Jajan Segera)' : 'TERKENDALI'}
- Tabungan/Investasi (Savings 20%): Aktual ${formatCurrency(savingsExpense)} / Target ${formatCurrency(targetSavings)} (${Math.round((savingsExpense / Math.max(1, targetSavings)) * 100)}%) -> Status: ${savingsExpense >= targetSavings ? 'TARGET TERCAPAI' : 'BELUM TERCAPAI'}

PROYEKSI CASHFLOW & KESEHATAN KEUANGAN:
- Rata-rata laju belanja (Burn Rate): ${formatCurrency(dailyBurnRate)}/hari
- Proyeksi sisa saldo akhir bulan: ${formatCurrency(projectedMonthEndBalance)} (${projectedMonthEndBalance >= 0 ? 'Surplus Sehat' : 'POTENSI DEFISIT / KRITIS'})

DATA DOMPET & DISTRIBUSI SALDO:
- ${walletsSummary} (Total likuiditas: ${formatCurrency(totalWallets || netBalance)})

PENGELUARAN PER KATEGORI (BULAN INI):
- ${categorySpendingSummary}

TARGET TABUNGAN & GOALS:
- ${goalsSummary}

MEMORI & FAKTA PRIBADI YANG DIINGAT AI:
${memories.length > 0 ? memories.map((m) => `- ${m.content}`).join('\n') : '- Belum ada catatan khusus'}

HISTORI TRANSAKSI TERAKHIR:
${recentTxSummary || 'Belum ada transaksi'}

TUGAS BELAJAR MEMORI OTOMATIS:
Pengguna dapat berbicara atau curhat bebas mengenai hal apapun (pekerjaan, pasangan, keluarga, kendaraan, tempat tinggal, hobi, dsb).
Setiap kali ada informasi atau fakta pribadi baru yang diungkapkan pengguna, WAJIB sertakan tag rahasia berikut di baris paling akhir responsmu:
[AUTO_LEARN: <fakta ringkas yang dipelajari>]
Contoh: [AUTO_LEARN: Pengguna kost di daerah Kebon Jeruk seharga 850rb/bulan]
Fakta ini otomatis disimpan ke memori akun pengguna secara privat.

PRINSIP & STANDAR ANALISIS WAJIB (SANGAT PENTING):
1. JANGAN PERNAH MENJAWAB MONOTON, PENDEK, ATAU DENGAN TEMPLATE KLISE! Berikan analisis cerdas, spesifik, dan komprehensif untuk SETIAP hal yang pengguna tanyakan atau katakan.
2. SELALU LAKUKAN ANALISIS & BEDAH MASALAH:
   - Jika pengguna bertanya tentang rencananya membeli sesuatu (misal barang, makanan, nongkrong, cicilan, ganti gadget): Hitung dampaknya secara matematis terhadap sisa saldo (${formatCurrency(netBalance)}), jatah belanja harian (${formatCurrency(safeDailySpend)}/hari), dan sisa hari ke gajian (${daysLeft} hari). Nyatakan dengan tegas apakah AMAN, BERISIKO, atau HARUS DITUNDA.
   - Jika pengguna bertanya tentang kondisi keuangannya: Berikan diagnosa menyeluruh (alokasi 50/30/20, pos pengeluaran paling boros, dan proyeksi akhir bulan).
   - Jika pengguna curhat atau bercerita: Berikan empati tulus lalu sambungkan dengan sudut pandang finansial taktis yang cerdas.
3. SERTAKAN ANGKA-ANGKA KONKRET: Selalu sebutkan angka rupiah riil, persentase alokasi, saldo dompet terkait, dan estimasi hemat/rugi. Hindari kata-kata mengambang tanpa data.
4. STRUKTUR FORMAT MARKDOWN YANG BERSIH & RAPI:
   - Gunakan format teks tebal (**bold**), bullet point, atau penomoran agar sangat mudah dibaca.
   - Buat bagian yang jelas: Analisis Situasi -> Rincian Data/Kalkulasi -> Dampak Finansial -> Rekomendasi Langkah Nyata.
5. ZERO-EMOJI POLICY MUTLAK: Sesuai aturan desain Monetra, DILARANG KERAS menggunakan emoji apa pun dalam respon. Gunakan ketegasan kata dan struktur tipografi yang elegan.
`;

  // Format past messages for Gemini ensuring strict turn alternation and valid structure
  const rawHistory: { role: 'user' | 'model'; text: string }[] = [];
  const recentHistory = chatHistory.slice(-6);
  recentHistory.forEach((msg) => {
    if (msg.content && msg.content.trim()) {
      rawHistory.push({
        role: msg.role === 'user' ? 'user' : 'model',
        text: msg.content.trim(),
      });
    }
  });

  // Always append current user prompt
  rawHistory.push({
    role: 'user',
    text: userPrompt.trim(),
  });

  // Sanitize to strictly alternate turns: user -> model -> user
  const contentsPayload: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const item of rawHistory) {
    if (contentsPayload.length === 0) {
      if (item.role === 'user') {
        contentsPayload.push({ role: 'user', parts: [{ text: item.text }] });
      }
    } else {
      const prev = contentsPayload[contentsPayload.length - 1];
      if (prev.role === item.role) {
        prev.parts[0].text += `\n\n${item.text}`;
      } else {
        contentsPayload.push({ role: item.role, parts: [{ text: item.text }] });
      }
    }
  }

  // Fallback if empty
  if (contentsPayload.length === 0) {
    contentsPayload.push({ role: 'user', parts: [{ text: userPrompt.trim() }] });
  }

  // Prioritize reliable, active Gemini 3.8 / latest models with fallback
  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
        signal: AbortSignal.timeout(8000), // Max 8s timeout so UI never hangs
      });

      if (response.ok) {
        const result = await response.json();
        const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          // Extract auto-learning facts if present
          const autoLearnRegex = /\[AUTO_LEARN:\s*([^\]]+)\]/gi;
          let match;
          while ((match = autoLearnRegex.exec(textOutput)) !== null) {
            const fact = match[1]?.trim();
            if (fact && context.addMemory) {
              context.addMemory({
                user_id: context.profile.id,
                type: 'context',
                content: fact,
                importance: 3,
              });
            }
          }
          const cleanOutput = textOutput.replace(autoLearnRegex, '').trim();
          return cleanOutput;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        lastError = new Error(errorData.error?.message || `HTTP ${response.status}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Tidak ada respon teks dari model Gemini.');
}

// ─── Smart Local Financial Reasoning Engine ────────────────────────────────
function smartLocalFinancialReasoning(
  cleanPrompt: string,
  context: AIContext
): string {
  const { profile, transactions, wallets, goals, memories } = context;
  const lower = cleanPrompt.toLowerCase().trim();
  const firstName = profile.nama.split(' ')[0] || 'kamu';

  const nowWIB = getNowWIBParts();
  const currentMonth = nowWIB.month;
  const currentYear = nowWIB.year;

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

  const datingExpense = thisMonthTx
    .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
    .reduce((sum, t) => sum + t.amount, 0);

  const todayDate = nowWIB.date;
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;
  const safeDaily = Math.max(0, Math.round(netBalance / daysLeft));

  const monthlyIncome = profile.monthly_income || 1500000;
  const localCatMap = new Map<string, Category>();
  context.categories?.forEach((c) => localCatMap.set(c.id, c));

  const resolveNeedWant = (t: Transaction): NeedWantType => {
    if (t.type === 'income') return 'saving';
    if (t.category_id && localCatMap.has(t.category_id)) {
      return localCatMap.get(t.category_id)!.need_want;
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

  // Time / Date inquiry response in WIB
  if (
    lower.includes('jam berapa') ||
    lower.includes('pukul berapa') ||
    lower.includes('waktu sekarang') ||
    lower.includes('tanggal berapa') ||
    lower.includes('hari apa') ||
    lower.includes('bulan apa') ||
    lower.includes('tahun berapa')
  ) {
    return `Saat ini hari **${nowWIB.dayName}**, tanggal **${nowWIB.date} ${nowWIB.monthName} ${nowWIB.year}**, pukul **${nowWIB.timeString} WIB** (Waktu Indonesia Barat). Ada transaksi atau hal keuangan yang ingin kamu periksa?`;
  }

  // Auto-detect and store facts in local brain (isolated by user_id/Google account)
  let newlyLearnedFact: string | null = null;
  if (context.addMemory) {
    const isPersonalFact =
      /(?:saya|aku|motor|pacar|kos|kost|mobil|kerja|hobi|gaji|tabungan|target|keluarga|teman|kuliah|kantor|laptop|hp|rumah|suka|senang|capek|lelah)\b/i.test(lower) &&
      !lower.startsWith('siapakah ') &&
      !lower.startsWith('siapa ') &&
      !lower.startsWith('apa ') &&
      !lower.startsWith('berapa ') &&
      !lower.startsWith('bagaimana ') &&
      !lower.startsWith('kenapa ') &&
      !lower.includes('?') &&
      cleanPrompt.length >= 6 &&
      cleanPrompt.length <= 160;

    if (isPersonalFact) {
      const exists = (memories || []).some((m) => m.content.toLowerCase() === cleanPrompt.toLowerCase());
      if (!exists) {
        newlyLearnedFact = cleanPrompt;
        context.addMemory({
          user_id: profile.id,
          type: 'context',
          content: cleanPrompt,
          importance: 3,
        });
      }
    }
  }

  // Response for newly shared personal facts
  if (newlyLearnedFact) {
    return `Terima kasih sudah berbagi, ${firstName}! Saya sudah mencatat dan menyimpan fakta ini ke dalam memori pribadi akun kamu: **"${newlyLearnedFact}"**.\n\nSaya akan mengingatnya di setiap percakapan kita berikutnya. Ada hal lain yang ingin kamu ceritakan atau tanyakan?`;
  }

  // 1. Siapakah Aku / Data Pengguna / Profil Terhubung
  if (
    lower.includes('siapakah aku') ||
    lower.includes('siapa aku') ||
    lower.includes('siapa saya') ||
    lower.includes('tentang aku') ||
    lower.includes('tentang saya') ||
    lower.includes('profil saya') ||
    lower.includes('data saya') ||
    lower.includes('kamu tahu apa tentang')
  ) {
    const walletList = (wallets && wallets.length > 0)
      ? wallets.map((w) => `- ${w.name}: ${formatCurrency(w.balance)}`).join('\n')
      : `- Saldo aktif: ${formatCurrency(netBalance)}`;

    const goalList = (goals && goals.length > 0)
      ? goals.map((g) => `- ${g.name}: ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)} (${Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100)}%)`).join('\n')
      : '- Belum ada target tabungan aktif';

    const memoryList = (memories && memories.length > 0)
      ? memories.map((m) => `- ${m.content}`).join('\n')
      : '- Memori otomatis akan bertambah saat kita sering berinteraksi.';

    return `Tentu saja saya mengenalmu sangat baik, ${profile.nama}! Saya Monetra, pusat kecerdasan finansialmu yang terhubung langsung ke akun Google kamu (${profile.email || 'Akun Terverifikasi'}).\n\nIdentitas & Profil:\n- Nama: ${profile.nama}\n- Akun Google: ${profile.email || 'Terisolasi Aman'}\n- Status: ${profile.internship_status || 'Anak Magang'} (Gaji ${formatCurrency(profile.monthly_income || 1500000)}/bulan)\n- Tanggal Gajian: Tiap tanggal ${payDay} (${daysLeft} hari lagi)\n\nRincian Dompet & Sumber Dana:\n${walletList}\n\nTarget Tabungan Aktif:\n${goalList}\n\nMemori Pribadi yang Saya Ingat:\n${memoryList}\n\nKondisi Keuangan Saat Ini:\n- Sisa aman belanja harian: ${formatCurrency(safeDaily)}/hari\n- Pengeluaran kencan bulan ini: ${formatCurrency(datingExpense)} dari batas ${formatCurrency(profile.dating_budget_est || 600000)}\n\nSemua data ini tersimpan eksklusif untuk akun Google kamu. Ada yang ingin kita evaluasi hari ini?`;
  }

  // 2. Sapaan Kasual & Formal (hi, hai, hello, halo, pagi, dsb)
  const isGreeting =
    /^(hi|hai|hello|helo|hey|halo|hy|hola|assalamualaikum|pagi|siang|sore|malam|oy|bro|sis|min|monetra|finai|tes|test)\b/i.test(lower) ||
    lower === 'hi' ||
    lower === 'hai' ||
    lower === 'halo' ||
    lower === 'hey' ||
    lower === 'hello';

  if (isGreeting) {
    return `Halo ${firstName}! Senang bisa menyapamu. Saya Monetra yang terhubung ke seluruh dompet, target, dan transaksi akunmu. Ada yang ingin kamu cek atau catat hari ini?`;
  }

  // 3. Tanya Dompet / Rincian Saldo
  if (lower.includes('dompet') || lower.includes('rekening') || lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('atm')) {
    if (wallets && wallets.length > 0) {
      const wList = wallets.map((w) => `- ${w.name}: ${formatCurrency(w.balance)}`).join('\n');
      const totalW = wallets.reduce((sum, w) => sum + w.balance, 0);
      return `Berikut rincian saldo di semua dompetmu saat ini:\n${wList}\n\nTotal Saldo Gabungan: ${formatCurrency(totalW)}\nBatas aman belanja harian: ${formatCurrency(safeDaily)}/hari sampai tanggal ${payDay}.`;
    }
  }

  // 4. Tanya Target Tabungan / Goals
  if (lower.includes('target') || lower.includes('nabung') || lower.includes('goals') || lower.includes('tabungan')) {
    if (goals && goals.length > 0) {
      const gList = goals
        .map((g) => `- ${g.name}: ${formatCurrency(g.current_amount)} dari target ${formatCurrency(g.target_amount)} (${Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100)}%)`)
        .join('\n');
      return `Berikut progres target tabungan aktifmu:\n${gList}\n\nSaran Monetra: Sisihkan setidaknya 20% dari gaji magang tiap tanggal gajian (${payDay}) untuk mempercepat pencapaian targetmu!`;
    }
  }

  // 5. Tanya Kabar & Basa-basi
  if (lower.includes('apa kabar') || lower.includes('gimana kabar') || lower.includes('lagi apa') || lower.includes('sehat')) {
    return `Kabar saya sangat baik dan selalu siap memantau keuanganmu, ${firstName}! Posisi keuanganmu saat ini terpantau dengan sisa saldo ${formatCurrency(netBalance)} menjelang gajian tanggal ${payDay}. Ada transaksi baru yang ingin dicatat atau ada hal yang ingin didiskusikan?`;
  }

  // 6. Terima Kasih & Apresiasi
  if (/^(makasih|terima kasih|thanks|tq|thank you|makasii)/i.test(lower) || lower.includes('makasih') || lower.includes('terima kasih')) {
    return `Sama-sama, ${firstName}! Senang bisa mendampingi pengelolaan keuanganmu. Jaga terus ritme keuanganmu, dan jangan ragu panggil saya kapan saja!`;
  }

  // 7. Afirmasi & Respon Singkat
  if (/^(ok|oke|siap|sip|mantap|keren|yoi|baiklah|oke deh)\b/i.test(lower)) {
    return `Siap, ${firstName}! Tetap semangat magang dan bijak dalam mengelola pengeluaran ya. Kalau butuh saran atau mau catat sesuatu, saya selalu ada di sini!`;
  }

  // 8. Alokasi 50/30/20 & Evaluasi Budget
  if (lower.includes('50/30/20') || lower.includes('50 30 20') || lower.includes('alokasi') || lower.includes('pos keuangan') || lower.includes('budget') || lower.includes('anggaran')) {
    const targetNeeds = Math.round(monthlyIncome * 0.5);
    const targetWants = Math.round(monthlyIncome * 0.3);
    const targetSavings = Math.round(monthlyIncome * 0.2);

    const needsPct = Math.round((needsExpense / Math.max(1, targetNeeds)) * 100);
    const wantsPct = Math.round((wantsExpense / Math.max(1, targetWants)) * 100);
    const savingsPct = Math.round((savingsExpense / Math.max(1, targetSavings)) * 100);

    return `Analisis Alokasi 50/30/20 untuk gaji ${formatCurrency(monthlyIncome)}:\n\n1. Kebutuhan Pokok (Needs 50% = ${formatCurrency(targetNeeds)}):\n   - Terpakai: ${formatCurrency(needsExpense)} (${needsPct}%)\n   - Status: ${needsExpense > targetNeeds ? 'Melebihi budget kebutuhan' : 'Aman terkendali'}\n\n2. Keinginan & Hiburan (Wants 30% = ${formatCurrency(targetWants)}):\n   - Terpakai: ${formatCurrency(wantsExpense)} (${wantsPct}%)\n   - Termasuk kencan: ${formatCurrency(datingExpense)}\n   - Status: ${wantsExpense > targetWants ? 'Perlu rem jajan & nongkrong' : 'Masih dalam batas wajar'}\n\n3. Tabungan & Dana Darurat (Savings 20% = ${formatCurrency(targetSavings)}):\n   - Teralokasi: ${formatCurrency(savingsExpense)} (${savingsPct}%)\n   - Rekomendasi: Selalu sisihkan ${formatCurrency(targetSavings)} langsung di awal gajian tanggal ${payDay}.`;
  }

  // 9. Prediksi Cashflow & Akhir Bulan (Surplus / Defisit)
  if (lower.includes('prediksi') || lower.includes('forecast') || lower.includes('akhir bulan') || lower.includes('surplus') || lower.includes('defisit') || lower.includes('bertahan')) {
    const daysElapsed = Math.max(1, todayDate);
    const burnRate = Math.round(totalExpense / daysElapsed);
    const projectedEnd = netBalance - (burnRate * daysLeft);

    if (projectedEnd >= 0) {
      return `Proyeksi Cashflow Positif untuk ${firstName}:\n- Rata-rata belanja harianmu: ${formatCurrency(burnRate)}/hari\n- Sisa saldo saat ini: ${formatCurrency(netBalance)}\n- Jarak ke gajian: ${daysLeft} hari (tanggal ${payDay})\n- Estimasi sisa saldo akhir bulan: **${formatCurrency(projectedEnd)}** (Surplus)\n\nKerja bagus! Jika ritme belanjamu dipertahankan maksimal ${formatCurrency(safeDaily)} per hari, kamu akan menyambut tanggal gajian dengan surplus dompet yang sehat.`;
    } else {
      return `Peringatan Cashflow Akhir Bulan untuk ${firstName}:\n- Rata-rata pengeluaran harianmu saat ini: ${formatCurrency(burnRate)}/hari\n- Sisa saldo aktif: ${formatCurrency(netBalance)}\n- Hari tersisa ke gajian: ${daysLeft} hari\n- Jika ritme ini berlanjut, diproyeksikan defisit sebesar: ${formatCurrency(Math.abs(projectedEnd))}.\n\nSolusi Monetra:\n1. Turunkan batas belanja harian menjadi maksimal ${formatCurrency(safeDaily)} per hari.\n2. Tunda jajan kopi dan hangout sampai tanggal ${payDay}.\n3. Pilih menu warteg atau masak sendiri untuk menghemat Rp 15.000 - Rp 25.000 per hari.`;
    }
  }

  // 10. Pengeluaran Terbesar / Boros di Mana
  if (lower.includes('terbesar') || lower.includes('paling boros') || lower.includes('boros di mana') || lower.includes('habis buat apa') || lower.includes('kemana uang')) {
    const catTotals: Record<string, number> = {};
    thisMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
      const c = t.category_id || 'Lainnya';
      catTotals[c] = (catTotals[c] || 0) + t.amount;
    });
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const topCatName = context.categories?.find((c) => c.id === sorted[0][0])?.name || sorted[0][0];
      const topCatAmount = sorted[0][1];
      const pct = Math.round((topCatAmount / Math.max(1, totalExpense)) * 100);
      return `Analisis Pengeluaran Bulan Ini untuk ${firstName}:\n- Total pengeluaran tercatat: ${formatCurrency(totalExpense)}\n- Pos terbesar: **${topCatName}** sebesar ${formatCurrency(topCatAmount)} (${pct}% dari seluruh pengeluaranmu).\n- Pengeluaran kencan: ${formatCurrency(datingExpense)}\n\nSaran Monetra: Fokuskan kontrol anggaran pada pos "${topCatName}" agar sisa saldo ${formatCurrency(netBalance)} bertahan aman hingga gajian tanggal ${payDay}.`;
    }
  }

  // 11. Tips Hemat Makan / Warteg / Kuliner
  if (lower.includes('tips hemat') || lower.includes('makan hemat') || lower.includes('warteg') || lower.includes('kuliner') || lower.includes('masak')) {
    return `Strategi Makan Hemat ala Monetra untuk Anak Magang:\n1. Menu Warteg Juara: Nasi + sayur matang + orek tempe + telur dadar/ceplok biasanya hanya Rp 12.000 - Rp 15.000, sudah padat gizi dan kenyang.\n2. Bawa Tumbler Air Putih: Menghemat pengeluaran air mineral botolan atau es teh manis Rp 5.000 - Rp 10.000 setiap hari (hemat Rp 150.000 - Rp 300.000 per bulan!).\n3. Masak Nasi Sendiri di Kos: Beli beras 5kg (sekitar Rp 75.000), di kos tinggal beli lauk pauk matang di luar.\n4. Kopi Saset Berkualitas: Ganti es kopi susu kafe (Rp 20.000 - Rp 28.000) dengan seduh kopi saset favorit di kantor/kos (hanya Rp 2.000 per cangkir).`;
  }

  // 12. Side Hustle / Ide Tambahan Penghasilan
  if (lower.includes('side hustle') || lower.includes('penghasilan tambahan') || lower.includes('sampingan') || lower.includes('cari uang tambahan') || lower.includes('cuan tambahan')) {
    return `Rekomendasi Side Hustle Realistis untuk Anak Magang:\n1. Jual/Trade Item Game (Roblox / MLBB): Menjual item virtual, joki harian, atau trading skin digital yang minim modal.\n2. Jasa Desain Canva & Template Medsos: Membantu UMKM sekitar membuat banner promosi atau feed Instagram (tarif Rp 25.000 - Rp 50.000 per desain).\n3. Admin Olshop / Freelance Data Entry: Tugas fleksibel yang bisa dikerjakan di malam hari setelah jam kantor.\n4. Menulis / Copywriting Pendek: Bantuan caption atau artikel blog SEO pemula.\nHasil sampingan Rp 300.000 - Rp 500.000 per bulan akan langsung mendongkrak saldo tabunganmu!`;
  }

  // 13. Bokek / Boros / Khawatir Uang Menipis
  if (lower.includes('bokek') || lower.includes('boros') || lower.includes('uang abis') || lower.includes('duit abis') || lower.includes('habis uang') || lower.includes('pusing')) {
    return `Tenang ${firstName}, jangan panik. Mari kita evaluasi bersama:\n- Sisa saldo aktifmu saat ini: ${formatCurrency(netBalance)}\n- Jarak gajian tanggal ${payDay}: ${daysLeft} hari lagi\n- Batas aman bertahan per hari: ${formatCurrency(safeDaily)}\n\nLangkah penyelamatan ala Monetra:\n1. Tahan dulu pengeluaran hiburan dan jajan kafe di luar rencana.\n2. Maksimalkan makan warteg atau menu hemat (budget Rp 15.000 - Rp 20.000 per hari).\n3. Untuk agenda kencan, pilih aktivitas hemat seperti jalan sore di taman atau nonton film di kos.\nKamu pasti bisa melewatinya sampai tanggal gajian tiba!`;
  }

  // 9. Dana Darurat
  if (lower.includes('darurat') || lower.includes('emergency')) {
    return `Panduan Dana Darurat untuk anak magang (gaji ${formatCurrency(profile.monthly_income)}):\n- Target awal yang realistis: Rp 500.000 - Rp 1.000.000.\n- Tempat penyimpanan: Simpan di rekening bank digital terpisah atau Reksadana Pasar Uang yang likuid (bisa ditarik kapan saja dan bebas biaya admin bulanan).\n- Aturan pakai: Hanya boleh dipakai untuk situasi darurat riil (misal motor mogok, berobat mendadak, atau kebutuhan keluarga mendesak), bukan untuk belanja diskon atau nongkrong.`;
  }

  // 10. Batas Aman Belanja & Sisa Saldo
  if (lower.includes('aman') || lower.includes('hari ini') || lower.includes('sisa saldo') || lower.includes('saldo') || lower.includes('uangku') || lower.includes('sisa uang') || lower.includes('berapa duit')) {
    return `Berdasarkan kalkulasi terkini:\n- Sisa saldo aktif bulan ini: ${formatCurrency(netBalance)}\n- Jarak ke gajian berikutnya: ${daysLeft} hari (tanggal ${payDay})\n- Batas aman belanja harian: ${formatCurrency(safeDaily)} per hari\n\nMengingat kebiasaan makan siang harianmu hemat di kisaran Rp 10.000 hingga Rp 20.000, cashflow harianmu masih dalam zona aman.`;
  }

  // 11. Analisis Pacaran & Kencan
  if (lower.includes('kencan') || lower.includes('pacar') || lower.includes('date') || lower.includes('doi') || lower.includes('ngedate') || lower.includes('nonton')) {
    const dateBudget = profile.dating_budget_est || 600000;
    const isOver = datingExpense > dateBudget;
    return `Evaluasi pos kencan untuk ${firstName}:\n- Pengeluaran kencan bulan ini: ${formatCurrency(datingExpense)}\n- Target batas bulanan: ${formatCurrency(dateBudget)}\n- Status: ${isOver ? 'Melebihi target awal' : 'Masih dalam batas aman'}\n\nSaran Monetra:\nKarena kamu rutin bertemu 3-4 kali seminggu, variasikan jadwal kencan dengan aktivitas hemat seperti jalan santai di taman kota, memasak menu favorit berdua di kos, atau movie marathon via streaming. Cara ini menjaga hubungan tetap hangat tanpa membuat dompet magang kempis.`;
  }

  // 12. Investasi, Reksadana, Saham, Emas, Kripto
  if (lower.includes('investasi') || lower.includes('reksadana') || lower.includes('saham') || lower.includes('crypto') || lower.includes('kripto') || lower.includes('emas') || lower.includes('bibit') || lower.includes('bareksa')) {
    return `Rekomendasi investasi untuk anak magang (gaji ${formatCurrency(profile.monthly_income)}):\n1. Prioritas Pertama: Amankan dana darurat minimal Rp 500.000 - Rp 1.000.000 di rekening terpisah atau e-wallet likuid.\n2. Reksadana Pasar Uang (RPU): Pilihan terbaik untuk pemula (bisa mulai dari Rp 10.000 di platform resmi seperti Bibit/Bareksa). Risikonya sangat rendah dan imbal hasilnya stabil 4-6% per tahun di atas bunga tabungan biasa.\n3. Emas Digital: Cocok untuk tabungan jangka menengah (1-3 tahun) sebagai pelindung inflasi.\n4. Saham & Kripto: Pelajari fundamentalnya terlebih dahulu dan hanya gunakan uang dingin (maksimal 5% dari tabungan) karena volatilitasnya tinggi.`;
  }

  // 13. Pinjol, Paylater, Utang
  if (lower.includes('pinjol') || lower.includes('paylater') || lower.includes('utang') || lower.includes('kredit') || lower.includes('cicilan')) {
    return `Peringatan penting seputar Paylater & Pinjol untuk ${firstName}:\n- Bunga paylater berkisar 2% - 4% per bulan (bisa mencapai 30% - 50% per tahun). Dengan gaji magang Rp 1.500.000, cicilan sekecil apapun akan langsung membebani cashflow bulanan.\n- Risiko BI Checking / SLIK OJK: Keterlambatan bayar walau hanya Rp 50.000 dapat merusak reputasi kreditmu saat nanti ingin mengajukan KPR atau bekerja di sektor perbankan.\n- Prinsip Monetra: Hindari paylater untuk konsumsi harian atau nongkrong. Jika uang tunai belum cukup, tunda pembelian sampai tabungan terkumpul.`;
  }

  // 14. Evaluasi Rencana Belanja / Affordability Simulation
  const buyWords = ['beli', 'checkout', 'belanja', 'ambil', 'ganti hp', 'ganti laptop', 'cicil'];
  const hasBuyIntent = buyWords.some((w) => lower.includes(w));
  if (hasBuyIntent) {
    // Attempt to extract nominal if mentioned (e.g. 500rb, 1jt, 300000, 2 juta)
    let amountFound = 0;
    const jtMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/);
    const rbMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)/);
    const numMatch = lower.match(/(?:rp\.?|rp\s*)?(\d{4,9})/);

    if (jtMatch) {
      amountFound = Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
    } else if (rbMatch) {
      amountFound = Math.round(parseFloat(rbMatch[1].replace(',', '.')) * 1000);
    } else if (numMatch) {
      amountFound = parseInt(numMatch[1], 10);
    }

    if (amountFound > 0) {
      const pctOfBalance = Math.round((amountFound / Math.max(1, netBalance)) * 100);
      const remainingAfterBuy = netBalance - amountFound;
      const newDailySpend = Math.max(0, Math.round(remainingAfterBuy / daysLeft));
      const isAffordable = remainingAfterBuy >= (safeDaily * 5); // Must have at least 5 days buffer

      return `Analisis Kelayakan Finansial Pembelian ${formatCurrency(amountFound)}:\n\n1. Evaluasi Likuiditas Dompet:\n- Sisa saldo aktif saat ini: ${formatCurrency(netBalance)}\n- Nominal rencana belanja: ${formatCurrency(amountFound)} (${pctOfBalance}% dari total saldomu)\n- Sisa saldo setelah pembelian: ${formatCurrency(remainingAfterBuy)}\n\n2. Dampak Terhadap Belanja Harian (${daysLeft} hari menuju gajian):\n- Batas aman belanja saat ini: ${formatCurrency(safeDaily)}/hari\n- Batas aman belanja baru jika dibeli: ${formatCurrency(newDailySpend)}/hari (berkurang ${formatCurrency(safeDaily - newDailySpend)}/hari)\n\n3. Keputusan & Rekomendasi Monetra:\n- Status: ${isAffordable ? 'Cukup Aman (Tetap Disiplin)' : 'BERISIKO TINGGI (Potensi Defisit Menjelang Gajian)'}\n${isAffordable
        ? `- Jika barang ini sangat mendesak (Kebutuhan), kamu boleh membelinya asalkan membatasi jajan harian maksimal ${formatCurrency(newDailySpend)} per hari.\n- Pastikan dana darurat dan pos tabungan tidak ikut terpakai.`
        : `- Jangan beli sekarang! Pembelian ini akan menguras ${pctOfBalance}% saldo aktifmu dan membuat jatah harianmu tersisa hanya ${formatCurrency(newDailySpend)}/hari.\n- Rekomendasi: Masukkan barang ini ke Target Impian (Goals) di Monetra dan sisihkan secara bertahap tiap tanggal gajian (${payDay}).`}`;
    }
  }

  // 15. Evaluasi & Audit Keuangan Komprehensif
  if (lower.includes('analisis') || lower.includes('evaluasi') || lower.includes('audit') || lower.includes('kondisi') || lower.includes('kesehatan') || lower.includes('keuangan saya')) {
    const daysElapsed = Math.max(1, todayDate);
    const burnRate = Math.round(totalExpense / daysElapsed);
    const projectedEnd = netBalance - (burnRate * daysLeft);

    const targetNeeds = Math.round(monthlyIncome * 0.5);
    const targetWants = Math.round(monthlyIncome * 0.3);
    const targetSavings = Math.round(monthlyIncome * 0.2);

    return `Audit Komprehensif Kesehatan Finansial ${firstName}:\n\n1. Likuiditas & Posisi Saldo:\n- Total Saldo Bersih: ${formatCurrency(netBalance)}\n- Sisa Hari ke Gajian: ${daysLeft} hari (tanggal ${payDay})\n- Batas Aman Belanja Harian: ${formatCurrency(safeDaily)}/hari\n\n2. Rapor Alokasi 50/30/20:\n- Kebutuhan Pokok (50%): ${formatCurrency(needsExpense)} / ${formatCurrency(targetNeeds)} (${Math.round((needsExpense / Math.max(1, targetNeeds)) * 100)}%)\n- Keinginan & Gaya Hidup (30%): ${formatCurrency(wantsExpense)} / ${formatCurrency(targetWants)} (${Math.round((wantsExpense / Math.max(1, targetWants)) * 100)}%)\n- Tabungan & Investasi (20%): ${formatCurrency(savingsExpense)} / ${formatCurrency(targetSavings)} (${Math.round((savingsExpense / Math.max(1, targetSavings)) * 100)}%)\n\n3. Laju Belanja (Burn Rate) & Proyeksi:\n- Rata-rata belanja harian: ${formatCurrency(burnRate)}/hari\n- Estimasi sisa saldo akhir bulan: ${formatCurrency(projectedEnd)} (${projectedEnd >= 0 ? 'Surplus Terjaga' : 'Potensi Defisit'})\n\n4. Rekomendasi Strategis:\n- ${wantsExpense > targetWants ? 'Fokus utama minggu ini: rem pengeluaran nongkrong/kopi agar jatah harian tidak tergerus.' : 'Pengeluaran gaya hidup masih terkendali dengan baik, pertahankan!'}\n- Alokasikan minimal 20% langsung ke rekening tabungan di awal gajian tanggal ${payDay}.`;
  }

  // 16. Dynamic Analytical Fallback (Zero Monotony, Highly Specific)
  const targetNeeds = Math.round(monthlyIncome * 0.5);
  const targetWants = Math.round(monthlyIncome * 0.3);
  const targetSavings = Math.round(monthlyIncome * 0.2);

  return `Analisis Finansial Terkait Pertanyaanmu, ${firstName}:\n\nMenanggapi hal yang kamu sampaikan ("${cleanPrompt}"), berikut rincian analisis data finansialmu saat ini:\n\n1. Posisi Keuangan Terkini:\n- Saldo Aktif: ${formatCurrency(netBalance)}\n- Batas Aman Belanja Harian: ${formatCurrency(safeDaily)} per hari\n- Hitung Mundur Gajian: ${daysLeft} hari lagi (tanggal ${payDay})\n\n2. Rincian Alokasi Anggaran:\n- Kebutuhan (Needs 50%): ${formatCurrency(needsExpense)} dari plafon ${formatCurrency(targetNeeds)}\n- Keinginan (Wants 30%): ${formatCurrency(wantsExpense)} dari plafon ${formatCurrency(targetWants)}\n- Tabungan (Savings 20%): ${formatCurrency(savingsExpense)} dari target ${formatCurrency(targetSavings)}\n\n3. Catatan & Langkah Rekomendasi:\n- Pertahankan ritme belanja maksimal di angka ${formatCurrency(safeDaily)}/hari agar cashflow tetap positif sampai tanggal gajian.\n- Jika ada transaksi pengeluaran atau pemasukan baru, kamu bisa langsung ketik atau ucapkan dengan suara (misal: "catat makan siang 25 ribu") untuk saya bukukan otomatis.`;
}

/**
 * Intelligent AI voice transaction parser:
 * 1. If Gemini API key is configured -> sends to Google Gemini 2.0 / 1.5 Flash for natural language comprehension.
 * 2. If no API key or call fails -> uses enhanced smart local parser.
 */
export async function parseVoiceInputWithAI(
  spokenText: string,
  categories: { id: string; name: string }[] = []
): Promise<ParsedVoiceItem[]> {
  const apiKey = getStoredGeminiKey();

  if (apiKey) {
    try {
      const categoryNames = categories.map((c) => c.name).join(', ') || 'Makanan & Minuman, Transportasi, Kencan & Pacaran, Tagihan & Pulsa, Hiburan, Tabungan & Dana Darurat, Gaji Magang';
      const prompt = `Kamu adalah AI parser pencatatan transaksi keuangan cerdas bahasa Indonesia dengan sensitivitas tinggi terhadap ucapan manusia.
Tugas: Pahami ucapan pengguna (bahkan jika ada kata terpotong atau tercampur suara lain), lalu ekstrak SEMUA transaksi menjadi format JSON array murni tanpa markdown.
Pahami istilah angka: "rebu/ribu", "jt/juta", "k", "goceng" (5000), "ceban" (10000), "seceng" (1000), "noceng" (2000), "goban" (50000), "cepek" (100000), "setengah juta" (500000).
Format JSON array:
[
  {
    "type": "expense" | "income",
    "amount": number (integer positif rupiah),
    "category": string (pilih yang paling cocok dari: [${categoryNames}]),
    "note": string (deskripsi ringkas rapi, contoh "Makan siang", "Beli bensin")
  }
]
Kalimat yang diucapkan: "${spokenText}"`;

      const modelsToTry = [
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
      ];
      let parsed: any = null;

      for (const model of modelsToTry) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
              signal: AbortSignal.timeout(6000), // Max 6s timeout
            }
          );

          if (res.ok) {
            const data = await res.json();
            const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOut) {
              const json = JSON.parse(textOut);
              if (Array.isArray(json) && json.length > 0) {
                parsed = json;
                break;
              }
            }
          }
        } catch {
          // try next model
        }
      }

      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            const now = new Date().toISOString();
            const items: ParsedVoiceItem[] = parsed
              .map((item: any) => {
                const itemType: TransactionType = item.type === 'income' ? 'income' : 'expense';
                const needWant: NeedWantType =
                  itemType === 'income'
                    ? 'saving'
                    : item.category === 'Kencan & Pacaran' || item.category === 'Hiburan'
                    ? 'want'
                    : 'need';

                return {
                  id: 'parsed-' + Math.random().toString(36).slice(2, 7),
                  type: itemType,
                  amount: Math.abs(Number(item.amount)) || 0,
                  category: String(item.category || 'Makanan & Minuman'),
                  note: stripEmoji(item.note || 'Transaksi'),
                  occurred_at: now,
                  need_want: needWant,
                  confidence: 0.99,
                };
              })
              .filter((item: ParsedVoiceItem) => item.amount > 0);

            // Deduplicate items that have identical type, amount, and note
            const uniqueItems: ParsedVoiceItem[] = [];
            const seen = new Set<string>();
            for (const it of items) {
              const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
              if (!seen.has(k)) {
                seen.add(k);
                uniqueItems.push(it);
              }
            }
            return uniqueItems;
          }
    } catch (e) {
      console.warn('Gemini voice parsing API error, falling back to smart local parser:', e);
    }
  }

  // Fallback to high-accuracy smart local parser with deduplication
  const localItems = parseVoiceInput(spokenText);
  const uniqueLocal: ParsedVoiceItem[] = [];
  const seenLocal = new Set<string>();
  for (const it of localItems) {
    const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
    if (!seenLocal.has(k)) {
      seenLocal.add(k);
      uniqueLocal.push(it);
    }
  }
  return uniqueLocal;
}

/**
 * Multimodal AI voice transaction parser from recorded Audio Blob:
 * Converts audio blob (WebM/MP4/WAV) to base64 and prompts Gemini Multimodal to:
 * 1. Transcribe the audio verbatim in Indonesian.
 * 2. Extract transactions directly into structured JSON items.
 */
export async function parseVoiceAudioWithAI(
  audioBlob: Blob,
  categories: { id: string; name: string }[] = []
): Promise<{ transcript: string; items: ParsedVoiceItem[] }> {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) {
    throw new Error('API Key Gemini belum tersedia untuk memproses audio.');
  }

  // Convert Blob to base64 safely with 32KB chunking
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  const base64Data = btoa(binary);

  const categoryNames =
    categories.map((c) => c.name).join(', ') ||
    'Makanan & Minuman, Transportasi, Kencan & Pacaran, Tagihan & Pulsa, Hiburan, Tabungan & Dana Darurat, Gaji Magang';

  const systemPrompt = `Kamu adalah AI Voice Extraction dan Financial Parser paling mutakhir, dirancang khusus dengan sensitivitas tinggi terhadap SUARA MANUSIA (User).

AKUSTIK & SENSITIVITAS SUARA MANUSIA:
1. Rekaman ini berasal dari perangkat mobile (HP) di lingkungan nyata yang mungkin memiliki suara bising (suara latar, dengung AC/kipas, bising kendaraan, TV, musik, atau suara orang lain di kejauhan).
2. FOKUS UTAMA & SENSITIVITAS TINGGI: Kamu memiliki algoritma isolasi vokal cerdas yang memusatkan perhatian 100% pada SUARA MANUSIA UTAMA (User yang berbicara di dekat mikrofon HP).
3. ISOLASI DARI GANGGUAN SUARA:
   - Abaikan semua suara latar belakang, dengung, bising kendaraan, ketukan, musik, atau gumaman orang lain yang jauh.
   - Tangkap dengan sangat peka dan teliti setiap kata, bisikan, desah, atau ucapan lembut yang dikeluarkan user.
   - Bahkan jika suara user bercampur atau sedikit tertumpuk dengan suara lain, utamakan ucapan user terdekat.
4. PEMAHAMAN BAHASA & SLANG RUPIAH INDONESIA:
   - Pahami kalimat cepat, pengucapan informal, bahasa sehari-hari, dan dialek Indonesia.
   - Pahami penyebutan angka rupiah: "ribu/rebu", "ratus", "juta/jt", "k", "seceng" (1.000), "goceng" (5.000), "ceban" (10.000), "noceng" (2.000), "gocap" (50.000), "cepek" (100.000), "setengah juta" (500.000), dll.
   - Contoh ucapan: "Makan siang dua puluh lima ribu", "Beli bensin 30 rebu", "Dapat uang jajan seratus ribu", "Ngopi ceban".

TUGAS UTAMA:
1. Field "transcript": Tuliskan kata demi kata yang diucapkan user secara verbatim, jernih, dan lengkap (hanya ucapan user, bersihkan dari gangguan suara lain).
2. Field "items": Ekstrak SEMUA transaksi pengeluaran atau pemasukan yang diucapkan user ke dalam array:
   - type: "expense" (pengeluaran/beli/bayar) atau "income" (pemasukan/gaji/terima uang).
   - amount: angka integer rupiah positif (contoh: 25000, 30000, 100000).
   - category: pilih kategori paling relevan dari: [${categoryNames}].
   - note: catatan ringkas transaksi (contoh: "Makan siang", "Beli bensin", "Uang jajan", "Kopi").

FORMAT OUTPUT JSON MURNI (tanpa markdown, tanpa code block, tanpa teks pengantar):
{
  "transcript": "teks ucapan user secara lengkap",
  "items": [
    {
      "type": "expense" | "income",
      "amount": number,
      "category": string,
      "note": string
    }
  ]
}`;

  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
  ];

  let rawMime = audioBlob.type || 'audio/webm';
  // Strip codec attributes like ;codecs=opus for Gemini API compatibility
  let cleanMime = rawMime.split(';')[0].trim() || 'audio/webm';
  // Normalize iOS Safari container mime types for Gemini multimodal audio
  if (cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') {
    cleanMime = 'audio/mp4';
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: base64Data,
                  },
                },
                { text: systemPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(12000), // Max 12s timeout for audio processing
      });

      if (res.ok) {
        const data = await res.json();
        const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOut) {
          const json = JSON.parse(textOut);
          const transcript = String(json.transcript || '').trim();
          const rawItems = Array.isArray(json.items) ? json.items : [];
          const now = new Date().toISOString();

          let items: ParsedVoiceItem[] = rawItems
            .map((item: any) => {
              const itemType: TransactionType = item.type === 'income' ? 'income' : 'expense';
              const needWant: NeedWantType =
                itemType === 'income'
                  ? 'saving'
                  : item.category === 'Kencan & Pacaran' || item.category === 'Hiburan'
                  ? 'want'
                  : 'need';

              return {
                id: 'parsed-' + Math.random().toString(36).slice(2, 7),
                type: itemType,
                amount: Math.abs(Number(item.amount)) || 0,
                category: String(item.category || 'Makanan & Minuman'),
                note: stripEmoji(item.note || 'Transaksi'),
                occurred_at: now,
                need_want: needWant,
                confidence: 0.99,
              };
            })
            .filter((item: ParsedVoiceItem) => item.amount > 0);

          // If AI detected a transcript but failed to output items, fall back to local regex parser
          if (items.length === 0 && transcript) {
            items = parseVoiceInput(transcript);
          }

          // Deduplicate items
          const uniqueItems: ParsedVoiceItem[] = [];
          const seen = new Set<string>();
          for (const it of items) {
            const k = `${it.type}-${it.amount}-${it.note.toLowerCase().trim()}`;
            if (!seen.has(k)) {
              seen.add(k);
              uniqueItems.push(it);
            }
          }

          return {
            transcript: transcript || 'Rekaman Suara',
            items: uniqueItems,
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastError = new Error(errJson.error?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memproses audio rekaman.');
}

// Backwards-compatibility alias
export const askFinAI = askMonetra;

