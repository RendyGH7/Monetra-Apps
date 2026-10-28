import { UserProfile, Transaction, AIMemory, ChatMessage, ParsedVoiceItem, TransactionType, NeedWantType } from '../types';
import { formatCurrency, stripEmoji } from '../utils/format';
import { parseVoiceInput } from '../utils/voiceParser';

export const GEMINI_API_KEY_STORAGE = 'finai_gemini_api_key';

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
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
  memories: AIMemory[];
  chatHistory: ChatMessage[];
  addTransaction?: (tx: Omit<Transaction, 'id' | 'created_at'>) => void;
}

export interface AIResponseResult {
  text: string;
  source: 'gemini' | 'local_brain';
  recordedTransactionCount?: number;
}

/**
 * Main AI Engine for FinAI:
 * 1. Checks if transaction command is typed (e.g. "catat makan 20rb") -> parses & auto-records!
 * 2. If Google Gemini API key is configured -> sends to Gemini 1.5 / 2.0 Flash with rich financial context.
 * 3. Fallback -> runs deep Contextual Financial Reasoning Engine.
 */
export async function askFinAI(
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
    parsedItems.forEach((item) => {
      context.addTransaction!({
        user_id: context.profile.id,
        type: item.type,
        amount: item.amount,
        note: item.note,
        occurred_at: item.occurred_at,
        source: 'text',
        category_id: 'cat-food',
        wallet_id: 'wallet-cash',
      });
    });

    const recordedList = parsedItems
      .map((it) => `- ${it.note}: ${formatCurrency(it.amount)} (${it.category})`)
      .join('\n');

    return {
      text: `Siap! Saya sudah mencatat ${parsedItems.length} transaksi ke dalam pembukuanmu:\n${recordedList}\n\nSaldo dan grafik di Beranda telah diperbarui otomatis. Ada yang ingin dicatat lagi?`,
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
  const { profile, transactions, memories, chatHistory } = context;

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

  const datingExpense = thisMonthTx
    .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
    .reduce((sum, t) => sum + t.amount, 0);

  const recentTxSummary = transactions
    .slice(0, 5)
    .map((t) => `${t.note}: ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)} (${t.occurred_at.split('T')[0]})`)
    .join(', ');

  const systemInstructionText = `
Kamu adalah FinAI, asisten keuangan pribadi AI yang sangat pintar, hangat, dan berwawasan luas.
Kamu memiliki pengetahuan mendalam tentang keuangan, ekonomi makro, investasi, pengelolaan gaji magang, serta kehidupan nyata anak muda di Indonesia.

PROFIL PENGGUNA:
- Nama: ${profile.nama}
- Email: ${profile.email || 'Belum terhubung'}
- Status: ${profile.internship_status || 'Anak Magang'}
- Gaji Magang: ${formatCurrency(profile.monthly_income || 1500000)} per bulan
- Gajian tiap tanggal: ${profile.pay_day || 25}
- Sisa Saldo Bulan Ini: ${formatCurrency(netBalance)}
- Total Pengeluaran Bulan Ini: ${formatCurrency(totalExpense)}
- Pengeluaran Kencan Bulan Ini: ${formatCurrency(datingExpense)} (Estimasi budget: ${formatCurrency(profile.dating_budget_est || 600000)})
- Side Hustle: ${profile.side_hustle_status || 'Belum aktif'}

MEMORI PRIBADI TENTANG PENGGUNA:
${memories.map((m) => `- ${m.content}`).join('\n')}

TRANSAKSI TERAKHIR:
${recentTxSummary || 'Belum ada transaksi'}

PANDUAN MENJAWAB:
1. Gunakan Bahasa Indonesia yang luwes, santai, bersahabat namun berbobot dan solutif (seperti konsultan keuangan pribadi sekaligus teman diskusi yang suportif).
2. Panggil nama pengguna (${profile.nama.split(' ')[0]}) saat menyapa atau memberikan saran personal.
3. Hubungkan saran dengan situasi riil keuangan pengguna (gaji magang, sisa saldo, atau kebiasaan kencan).
4. Kamu dapat menjawab pertanyaan seputar pengetahuan internet dan ekonomi umum (saham, reksadana, inflasi, BI rate, kripto, perbandingan bank, tips karier magang, perbandingan harga kos/makan di kota besar).
5. Format jawaban dengan rapi menggunakan poin-poin jika menjelaskan langkah atau tips.
6. Hindari penggunaan tanda baca em dash.
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

  // Add the current user prompt
  contentsPayload.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
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
            maxOutputTokens: 1000,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          return textOutput;
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
  const { profile, transactions } = context;
  const lower = cleanPrompt.toLowerCase().trim();
  const firstName = profile.nama.split(' ')[0] || 'kamu';

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

  const datingExpense = thisMonthTx
    .filter((t) => t.note.toLowerCase().includes('date') || t.note.toLowerCase().includes('pacar'))
    .reduce((sum, t) => sum + t.amount, 0);

  const todayDate = now.getDate();
  const payDay = profile.pay_day || 25;
  let daysLeft = payDay > todayDate ? payDay - todayDate : 30 - todayDate + payDay;
  if (daysLeft <= 0) daysLeft = 1;
  const safeDaily = Math.max(0, Math.round(netBalance / daysLeft));

  // 1. Sapaan Kasual & Formal (hi, hai, hello, halo, pagi, dsb)
  const isGreeting =
    /^(hi|hai|hello|helo|hey|halo|hy|hola|assalamualaikum|pagi|siang|sore|malam|oy|bro|sis|min|finai|tes|test)\b/i.test(lower) ||
    lower === 'hi' ||
    lower === 'hai' ||
    lower === 'halo' ||
    lower === 'hey' ||
    lower === 'hello';

  if (isGreeting) {
    return `Halo ${firstName}! Senang bisa ngobrol denganmu. Ada yang bisa saya bantu seputar keuanganmu hari ini? Kamu bisa cek batas aman belanja harian, analisis budget kencan, atau ketik transaksi pengeluaran baru langsung di sini!`;
  }

  // 2. Tanya Kabar & Basa-basi
  if (lower.includes('apa kabar') || lower.includes('gimana kabar') || lower.includes('lagi apa') || lower.includes('sehat')) {
    return `Kabar saya sangat baik dan selalu siap memantau keuanganmu, ${firstName}! Posisi keuanganmu saat ini terpantau stabil dengan sisa saldo ${formatCurrency(netBalance)} menjelang gajian tanggal ${payDay}. Ada transaksi baru yang ingin dicatat atau ada hal yang ingin didiskusikan?`;
  }

  // 3. Terima Kasih & Apresiasi
  if (/^(makasih|terima kasih|thanks|tq|thank you|makasii)/i.test(lower) || lower.includes('makasih') || lower.includes('terima kasih')) {
    return `Sama-sama, ${firstName}! Senang bisa membantumu. Jaga terus ritme keuanganmu, dan jangan ragu panggil saya kapan saja kalau butuh pertimbangan finansial!`;
  }

  // 4. Afirmasi & Respon Singkat
  if (/^(ok|oke|siap|sip|mantap|keren|yoi|baiklah|oke deh)\b/i.test(lower)) {
    return `Siap, ${firstName}! Tetap semangat magang dan bijak dalam mengelola pengeluaran ya. Kalau butuh saran atau mau catat sesuatu, saya selalu ada di sini!`;
  }

  // 5. Bokek / Boros / Khawatir Uang Menipis
  if (lower.includes('bokek') || lower.includes('boros') || lower.includes('uang abis') || lower.includes('duit abis') || lower.includes('habis uang') || lower.includes('pusing')) {
    return `Tenang ${firstName}, jangan panik. Mari kita evaluasi bersama:\n- Sisa saldo aktifmu saat ini: ${formatCurrency(netBalance)}\n- Jarak gajian tanggal ${payDay}: ${daysLeft} hari lagi\n- Batas aman bertahan per hari: ${formatCurrency(safeDaily)}\n\nLangkah penyelamatan ala FinAI:\n1. Tahan dulu pengeluaran hiburan dan jajan kafe di luar rencana.\n2. Maksimalkan makan warteg atau menu hemat (budget Rp 15.000 - Rp 20.000 per hari).\n3. Untuk agenda kencan, pilih aktivitas hemat seperti jalan sore di taman atau nonton film di kos.\nKamu pasti bisa melewatinya sampai tanggal gajian tiba!`;
  }

  // 6. Dana Darurat
  if (lower.includes('darurat') || lower.includes('emergency')) {
    return `Panduan Dana Darurat untuk anak magang (gaji ${formatCurrency(profile.monthly_income)}):\n- Target awal yang realistis: Rp 500.000 - Rp 1.000.000.\n- Tempat penyimpanan: Simpan di rekening bank digital terpisah atau Reksadana Pasar Uang yang likuid (bisa ditarik kapan saja dan bebas biaya admin bulanan).\n- Aturan pakai: Hanya boleh dipakai untuk situasi darurat riil (misal motor mogok, berobat mendadak, atau kebutuhan keluarga mendesak), bukan untuk belanja diskon atau nongkrong.`;
  }

  // 7. Siapa Kamu / Kemampuan FinAI
  if (lower.includes('siapa kamu') || lower.includes('kamu siapa') || lower.includes('tentang kamu') || lower.includes('bisa apa') || lower.includes('finai itu apa')) {
    return `Saya FinAI, asisten keuangan cerdas pribadi kamu. Saya dirancang khusus untuk memonitor keuangan anak magang seperti kamu (gaji pokok ${formatCurrency(profile.monthly_income)}), menjaga keseimbangan antara makan harian dan budget kencan bareng pacar, serta memberikan saran finansial yang realistis. Kamu bisa bertanya apa saja seputar tips hemat, investasi pemula, atau langsung mencatat pengeluaran via chat dan suara.`;
  }

  // 8. Batas Aman Belanja & Sisa Saldo
  if (lower.includes('aman') || lower.includes('hari ini') || lower.includes('sisa saldo') || lower.includes('saldo') || lower.includes('uangku') || lower.includes('sisa uang') || lower.includes('berapa duit')) {
    return `Berdasarkan kalkulasi terkini:\n- Sisa saldo aktif bulan ini: ${formatCurrency(netBalance)}\n- Jarak ke gajian berikutnya: ${daysLeft} hari (tanggal ${payDay})\n- Batas aman belanja harian: ${formatCurrency(safeDaily)} per hari\n\nMengingat kebiasaan makan siang harianmu hemat di kisaran Rp 10.000 hingga Rp 20.000, cashflow harianmu masih dalam zona aman.`;
  }

  // 9. Analisis Pacaran & Kencan
  if (lower.includes('kencan') || lower.includes('pacar') || lower.includes('date') || lower.includes('doi') || lower.includes('ngedate') || lower.includes('nonton')) {
    const dateBudget = profile.dating_budget_est || 600000;
    const isOver = datingExpense > dateBudget;
    return `Evaluasi pos kencan untuk ${firstName}:\n- Pengeluaran kencan bulan ini: ${formatCurrency(datingExpense)}\n- Target batas bulanan: ${formatCurrency(dateBudget)}\n- Status: ${isOver ? 'Melebihi target awal' : 'Masih dalam batas aman'}\n\nSaran FinAI:\nKarena kamu rutin bertemu 3-4 kali seminggu, variasikan jadwal kencan dengan aktivitas hemat seperti jalan santai di taman kota, memasak menu favorit berdua di kos, atau movie marathon via streaming. Cara ini menjaga hubungan tetap hangat tanpa membuat dompet magang kempis.`;
  }

  // 10. Investasi, Reksadana, Saham, Emas, Kripto
  if (lower.includes('investasi') || lower.includes('reksadana') || lower.includes('saham') || lower.includes('crypto') || lower.includes('kripto') || lower.includes('emas') || lower.includes('bibit') || lower.includes('bareksa')) {
    return `Rekomendasi investasi untuk anak magang (gaji ${formatCurrency(profile.monthly_income)}):\n1. Prioritas Pertama: Amankan dana darurat minimal Rp 500.000 - Rp 1.000.000 di rekening terpisah atau e-wallet likuid.\n2. Reksadana Pasar Uang (RPU): Pilihan terbaik untuk pemula (bisa mulai dari Rp 10.000 di platform resmi seperti Bibit/Bareksa). Risikonya sangat rendah dan imbal hasilnya stabil 4-6% per tahun di atas bunga tabungan biasa.\n3. Emas Digital: Cocok untuk tabungan jangka menengah (1-3 tahun) sebagai pelindung inflasi.\n4. Saham & Kripto: Pelajari fundamentalnya terlebih dahulu dan hanya gunakan uang dingin (maksimal 5% dari tabungan) karena volatilitasnya tinggi.`;
  }

  // 11. Pinjol, Paylater, Utang
  if (lower.includes('pinjol') || lower.includes('paylater') || lower.includes('utang') || lower.includes('kredit') || lower.includes('cicilan')) {
    return `Peringatan penting seputar Paylater & Pinjol untuk ${firstName}:\n- Bunga paylater berkisar 2% - 4% per bulan (bisa mencapai 30% - 50% per tahun). Dengan gaji magang Rp 1.500.000, cicilan sekecil apapun akan langsung membebani cashflow bulanan.\n- Risiko BI Checking / SLIK OJK: Keterlambatan bayar walau hanya Rp 50.000 dapat merusak reputasi kreditmu saat nanti ingin mengajukan KPR atau bekerja di sektor perbankan.\n- Prinsip FinAI: Hindari paylater untuk konsumsi harian atau nongkrong. Jika uang tunai belum cukup, tunda pembelian sampai tabungan terkumpul.`;
  }

  // 12. Tips Mengatur Gaji Magang / Aturan 50-30-20
  if (lower.includes('tips') || lower.includes('gaji') || lower.includes('50/30/20') || lower.includes('kelola') || lower.includes('mengatur') || lower.includes('nabung') || lower.includes('menabung')) {
    const salary = profile.monthly_income || 1500000;
    const needs = Math.round(salary * 0.5);
    const wants = Math.round(salary * 0.3);
    const savings = Math.round(salary * 0.2);

    return `Strategi alokasi gaji magang Rp ${salary.toLocaleString('id-ID')} ala FinAI:\n- 50% Kebutuhan Pokok (${formatCurrency(needs)}): Makan harian hemat (Rp 15.000/hari x 30 = Rp 450.000), sisa Rp 300.000 untuk transport & bensin.\n- 30% Keinginan & Kencan (${formatCurrency(wants)}): Budget kencan dan nongkrong hemat dibagi rata sekitar Rp 100.000 - Rp 110.000 per minggu.\n- 20% Tabungan Darurat (${formatCurrency(savings)}): Langsung disisihkan di awal tiap tanggal gajian (${payDay}) sebelum digunakan untuk kebutuhan lain.`;
  }

  // 13. Side Hustle / Cari Uang Tambahan
  if (lower.includes('side hustle') || lower.includes('tambahan') || lower.includes('roblox') || lower.includes('mlbb') || lower.includes('cari duit') || lower.includes('freelance')) {
    return `Berdasarkan memorimu yang pernah jualan item Roblox & akun MLBB:\n- Aktifkan kembali bisnis digital game: Margin jual beli item game sangat menarik bagi sesama gamer dan bisa dikerjakan di luar jam magang tanpa modal besar.\n- Manfaatkan skill magangmu: Kamu juga bisa menawarkan jasa freelance kecil-kecilan (seperti entri data, desain media sosial sederhana, atau micro-task digital).\n- Tambahan penghasilan Rp 300.000 - Rp 500.000 per bulan dari side hustle akan langsung melonggarkan budget kencanmu secara signifikan!`;
  }

  // 14. Pertanyaan Umum / Fallback Cerdas
  return `Pertanyaan yang bagus, ${firstName}! Sebagai asisten keuangan pribadimu, saya selalu siap mendampingi pengelolaan finansialmu.\n\nRingkasan status dompetmu saat ini:\n- Saldo aktif: ${formatCurrency(netBalance)}\n- Batas aman belanja: ${formatCurrency(safeDaily)}/hari (menuju gajian tgl ${payDay})\n\nKamu bisa tanyakan hal seperti:\n- "Berapa sisa aman belanja hari ini?"\n- "Tips kencan hemat agar gaji magang cukup"\n- "Rekomendasi investasi pemula untuk gaji 1.5 juta"\n- Atau ketik "catat makan warteg 20rb" untuk mencatat pengeluaran baru.`;
}
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

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
          const parsed = JSON.parse(textOut);
          if (Array.isArray(parsed) && parsed.length > 0) {
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
        }
      }
    } catch (e) {
      console.warn('Gemini voice parsing API error, falling back to smart local parser:', e);
    }
  }

  // Fallback to high-accuracy smart local parser
  return parseVoiceInput(spokenText);
}

