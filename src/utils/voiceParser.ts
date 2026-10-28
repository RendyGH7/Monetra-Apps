import { ParsedVoiceItem, NeedWantType, TransactionType } from '../types';
import { stripEmoji } from './format';

export function parseVoiceInput(transcriptRaw: string): ParsedVoiceItem[] {
  const text = stripEmoji(transcriptRaw).toLowerCase();
  const items: ParsedVoiceItem[] = [];

  // Match Indonesian numbers & slang
  function normalizeNominal(str: string): number {
    str = str.trim();
    if (str === 'goceng') return 5000;
    if (str === 'ceban') return 10000;
    if (str === 'gopek') return 500;
    if (str === 'seceng') return 1000;
    if (str === 'sejuta') return 1000000;

    // e.g. "15rb", "15 ribu", "1.5jt", "1,5 juta", "50k", "50000"
    const jtMatch = str.match(/([\d.,]+)\s*(?:jt|juta)/);
    if (jtMatch) {
      const val = parseFloat(jtMatch[1].replace(',', '.'));
      return Math.round(val * 1000000);
    }

    const rbMatch = str.match(/([\d.,]+)\s*(?:rb|ribu|k)/);
    if (rbMatch) {
      const val = parseFloat(rbMatch[1].replace(',', '.'));
      return Math.round(val * 1000);
    }

    const plainNum = str.replace(/[^\d]/g, '');
    if (plainNum) {
      return parseInt(plainNum, 10);
    }

    return 0;
  }

  // Split sentence by comma, 'terus', 'lalu', 'dan', 'sama'
  const segments = text
    .split(/[,;\n]|(?:\b(?:terus|lalu|kemudian|sama|dan juga|dan)\b)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const now = new Date().toISOString();

  for (const seg of segments) {
    // Look for numbers or currency keywords
    const numberRegex = /(\d+[\d.,]*\s*(?:jt|juta|rb|ribu|k)|\b(?:goceng|ceban|gopek|seceng|sejuta)\b|\b\d{4,9}\b)/i;
    const match = seg.match(numberRegex);
    if (!match) continue;

    const nominalStr = match[0];
    const amount = normalizeNominal(nominalStr);
    if (amount <= 0) continue;

    let type: TransactionType = 'expense';
    let category = 'Makanan & Minuman';
    let needWant: NeedWantType = 'need';
    let confidence = 0.95;

    // Detect income
    if (seg.includes('gaji') || seg.includes('gajian') || seg.includes('masuk') || seg.includes('dapat duit') || seg.includes('terima')) {
      type = 'income';
      category = 'Gaji Magang';
      needWant = 'saving';
    } else if (seg.includes('roblox') || seg.includes('mlbb') || seg.includes('jual') || seg.includes('orderan')) {
      type = 'income';
      category = 'Bisnis Roblox & MLBB';
      needWant = 'saving';
    } else if (
      seg.includes('pacar') ||
      seg.includes('kencan') ||
      seg.includes('date') ||
      seg.includes('nonton') ||
      seg.includes('berdua') ||
      seg.includes('doi')
    ) {
      category = 'Kencan & Pacaran';
      needWant = 'want';
      confidence = 0.98;
    } else if (
      seg.includes('bensin') ||
      seg.includes('gojek') ||
      seg.includes('grab') ||
      seg.includes('angkot') ||
      seg.includes('parkir') ||
      seg.includes('tol')
    ) {
      category = 'Transportasi';
      needWant = 'need';
    } else if (
      seg.includes('pulsa') ||
      seg.includes('kuota') ||
      seg.includes('listrik') ||
      seg.includes('air') ||
      seg.includes('wifi')
    ) {
      category = 'Tagihan & Pulsa';
      needWant = 'need';
    } else if (
      seg.includes('game') ||
      seg.includes('topup') ||
      seg.includes('steam') ||
      seg.includes('skin') ||
      seg.includes('kafe')
    ) {
      category = 'Hiburan';
      needWant = 'want';
    } else if (
      seg.includes('nabung') ||
      seg.includes('tabungan') ||
      seg.includes('simpan')
    ) {
      category = 'Tabungan & Dana Darurat';
      needWant = 'saving';
    } else {
      category = 'Makanan & Minuman';
      needWant = 'need';
    }

    // Clean note
    let note = seg
      .replace(nominalStr, '')
      .replace(/\b(?:beli|bayar|tadi|pagi|siang|malam|sore|buat|uang|sebesar|seharga)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!note) {
      note = category;
    }

    // Capitalize first letter
    note = note.charAt(0).toUpperCase() + note.slice(1);

    items.push({
      id: 'parsed-' + Math.random().toString(36).slice(2, 7),
      type,
      amount,
      category,
      note,
      occurred_at: now,
      need_want: needWant,
      confidence,
    });
  }

  return items;
}
