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
    const defaultCatId = context.categories?.[0]?.id || 'cat-food';

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

      context.addTransaction!({
        user_id: context.profile.id,
        type: item.type,
        amount: item.amount,
        note: item.note,
        occurred_at: item.occurred_at,
        source: 'text',
        category_id: defaultCatId,
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

  const todayDate = nowWIB.date;
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;
  const safeDailySpend = Math.max(0, Math.round(netBalance / daysLeft));

  const walletsSummary = (wallets && wallets.length > 0)
    ? wallets.map((w) => `${w.name}: ${formatCurrency(w.balance)}`).join(', ')
    : 'Belum ada rincian dompet';
  const totalWallets = (wallets || []).reduce((sum, w) => sum + w.balance, 0);

  const goalsSummary = (goals && goals.length > 0)
    ? goals.map((g) => `${g.name}: ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)} (${Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100)}%)`).join(' | ')
    : 'Belum ada target tabungan';

  const recentTxSummary = transactions
    .slice(0, 6)
    .map((t) => `${t.note}: ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)} (${formatDateTimeWIB(t.occurred_at)})`)
    .join(', ');

  const systemInstructionText = `
Kamu adalah Monetra, pusat kecerdasan finansial (Core Financial Brain) yang tersambung ke seluruh bagian proyek ini untuk akun pengguna saat ini.
Kamu memiliki akses ke data profil, akun Google, rincian dompet dan saldo, target tabungan, histori transaksi, serta memori otomatis.

WAKTU & ZONA SAAT INI (INDONESIA WIB / UTC+7):
- Hari & Tanggal: ${nowWIB.dayName}, ${nowWIB.date} ${nowWIB.monthName} ${nowWIB.year}
- Jam & Menit: ${nowWIB.timeString} WIB (Waktu Indonesia Barat)
- Tahun: ${nowWIB.year}, Bulan: ${nowWIB.monthName} (Bulan ke-${nowWIB.month + 1})
Setiap kali pengguna menanyakan waktu, jam, menit, hari, tanggal, bulan, atau tahun, selalu jawab persis mengikuti Waktu Indonesia Barat (WIB) ini.

PROFIL PENGGUNA:
- Nama: ${profile.nama}
- Email Akun Google: ${profile.email || 'Lokal / Terisolasi'}
- Status: ${profile.internship_status || 'Anak Magang'}
- Gaji Magang: ${formatCurrency(profile.monthly_income || 1500000)} per bulan
- Gajian tiap tanggal: ${profile.pay_day || 25} (${daysLeft} hari lagi menuju gajian)
- Sisa Saldo Bulan Ini: ${formatCurrency(netBalance)}
- Batas Aman Belanja Harian: ${formatCurrency(safeDailySpend)}/hari
- Total Pengeluaran Bulan Ini: ${formatCurrency(totalExpense)}
- Pengeluaran Kencan Bulan Ini: ${formatCurrency(datingExpense)} (Budget: ${formatCurrency(profile.dating_budget_est || 600000)})
- Bisnis Sampingan: ${profile.side_hustle_status || 'Belum aktif'}

DATA DOMPET & SALDO AKTIF:
- ${walletsSummary} (Total saldo dompet: ${formatCurrency(totalWallets || netBalance)})

TARGET TABUNGAN AKTIF:
- ${goalsSummary}

MEMORI YANG TELAH DIINGAT AI:
${memories.length > 0 ? memories.map((m) => `- ${m.content}`).join('\n') : '- Belum ada catatan khusus'}

TRANSAKSI TERAKHIR:
${recentTxSummary || 'Belum ada transaksi'}

TUGAS BELAJAR MEMORI OTOMATIS:
Pengguna dapat berbicara bebas menggunakan suara (Voice Prompt) mengenai topik apa saja, termasuk hal pribadi atau curhat yang tidak ada kaitannya dengan transaksi keuangan.
Setiap kali pengguna membagikan informasi baru tentang dirinya (seperti pekerjaan, curhat, pacar/pasangan, kendaraan, tempat tinggal/kost, hobi, kebiasaan, laptop/gadget, atau target hidup), kamu WAJIB mencantumkan tag rahasia berikut di paling akhir responmu:
[AUTO_LEARN: <fakta ringkas yang perlu diingat AI secara permanen>]
Contoh: [AUTO_LEARN: Pengguna memiliki motor Honda Vario merah]
Contoh: [AUTO_LEARN: Pacar pengguna bernama Sarah]
Contoh: [AUTO_LEARN: Pengguna kost di daerah Kebon Jeruk dengan biaya 850rb per bulan]
Fakta ini otomatis disimpan di memori eksklusif akun pengguna saat ini.

PANDUAN MENJAWAB:
1. Gunakan Bahasa Indonesia yang cerdas, ramah, luwes, dan berwawasan luas.
2. Jika pengguna bertanya "siapakah aku?" atau menanyakan data dirinya, jawab dengan lengkap profilnya, akun Google-nya, saldo tiap dompetnya, target tabungannya, dan apa saja yang telah kamu pelajari tentangnya.
3. Hubungkan setiap saran dengan situasi riil keuangan pengguna (saldo aktif, dompet, target tabungan, dan hari gajian).
4. Hindari penggunaan tanda baca em dash.
`;

  // Format past messages for Gemini
  const contentsPayload: any[] = [];

  // Add last 6 messages for context
  const recentHistory = chatHistory.slice(-6);
  recentHistory.forEach((msg) => {
    contentsPayload.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  });

  // Add current user prompt
  contentsPayload.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
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

  // 8. Bokek / Boros / Khawatir Uang Menipis
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

  // 14. Pertanyaan Umum / Fallback Cerdas
  return `Pertanyaan yang bagus, ${firstName}! Sebagai pusat kecerdasan finansialmu, saya tersambung ke seluruh dompet, target, dan transaksimu.\n\nRingkasan status dompetmu saat ini:\n- Saldo aktif: ${formatCurrency(netBalance)}\n- Batas aman belanja: ${formatCurrency(safeDaily)}/hari (menuju gajian tgl ${payDay})\n\nKamu bisa tanyakan hal seperti:\n- "Siapakah aku dan apa saja data yang kamu ketahui?"\n- "Berapa rincian saldo di semua dompetku?"\n- "Apa saja target tabungan saya saat ini?"\n- "Tips kencan hemat agar gaji magang cukup"\n- Atau ketik "catat makan siang 20rb di dompet tunai" untuk mencatat pengeluaran.`;
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
      const prompt = `Kamu adalah AI parser pencatatan transaksi keuangan bahasa Indonesia.
Tugas: Ekstrak SEMUA transaksi dari ucapan pengguna menjadi format JSON array murni tanpa markdown, tanpa backticks.
Format JSON array:
[
  {
    "type": "expense" | "income",
    "amount": number (integer positif),
    "category": string (pilih yang paling cocok dari: [${categoryNames}]),
    "note": string (deskripsi ringkas rapi, contoh "Makan warteg", "Beli bensin")
  }
]
Kalimat yang diucapkan: "${spokenText}"`;

      const modelsToTry = [
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite',
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
            return items;
          }
    } catch (e) {
      console.warn('Gemini voice parsing API error, falling back to smart local parser:', e);
    }
  }

  // Fallback to high-accuracy smart local parser
  return parseVoiceInput(spokenText);
}

// Backwards-compatibility alias
export const askFinAI = askMonetra;

