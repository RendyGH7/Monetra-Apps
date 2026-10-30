import { ParsedVoiceItem, NeedWantType, TransactionType } from '../types';
import { stripEmoji } from './format';

/**
 * Words to number parser for common Indonesian numbers and slang.
 */
function parseIndonesianWordsToNumber(text: string): number {
  const words = text.toLowerCase().trim().split(/\s+/);
  const map: Record<string, number> = {
    nol: 0,
    satu: 1,
    se: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
    sepuluh: 10,
    sebelas: 11,
    seratus: 100,
    seribu: 1000,
    sejuta: 1000000,
    goceng: 5000,
    ceban: 10000,
    gocap: 50000,
    cepek: 100000,
    seceng: 1000,
    gopek: 500,
    noceng: 2000,
  };

  let total = 0;
  let current = 0;

  for (const w of words) {
    if (map[w] !== undefined) {
      if (w === 'seratus') current = (current || 1) * 100;
      else if (w === 'seribu') {
        total += (current || 1) * 1000;
        current = 0;
      } else if (w === 'sejuta') {
        total += (current || 1) * 1000000;
        current = 0;
      } else {
        current += map[w];
      }
    } else if (w === 'belas') {
      current += 10;
    } else if (w === 'puluh') {
      current *= 10;
    } else if (w === 'ratus') {
      current *= 100;
    } else if (w === 'ribu' || w === 'rebu') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (w === 'juta') {
      total += (current || 1) * 1000000;
      current = 0;
    }
  }

  return total + current;
}

/**
 * Normalizes any matched nominal string (e.g. "Rp20.000", "20.000", "20rb", "20k", "dua puluh ribu", "ceban")
 */
export function normalizeNominal(str: string): number {
  str = str.trim().toLowerCase();

  // Strip currency prefixes like "rp", "rp.", "idr"
  const cleanStr = str.replace(/^(?:rp\.?|idr)\s*/i, '').trim();

  // Slang checks
  if (cleanStr === 'goceng') return 5000;
  if (cleanStr === 'ceban') return 10000;
  if (cleanStr === 'gocap') return 50000;
  if (cleanStr === 'cepek') return 100000;
  if (cleanStr === 'seceng') return 1000;
  if (cleanStr === 'gopek') return 500;
  if (cleanStr === 'noceng') return 2000;
  if (cleanStr === 'sejuta') return 1000000;

  // Indonesian word numbers like "dua puluh ribu"
  if (/^[a-z\s]+$/.test(cleanStr)) {
    const wordVal = parseIndonesianWordsToNumber(cleanStr);
    if (wordVal > 0) return wordVal;
  }

  // e.g. "1.5jt", "1,5 juta", "2jt"
  const jtMatch = cleanStr.match(/^([\d.,]+)\s*(?:jt|juta)$/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(val * 1000000);
  }

  // e.g. "20rb", "20 ribu", "20 rebu", "20k"
  const rbMatch = cleanStr.match(/^([\d.,]+)\s*(?:rb|ribu|k|rebu)$/i);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    return Math.round(val * 1000);
  }

  // Dot / comma thousand separator format, e.g. "20.000" or "1.500.000"
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleanStr)) {
    return parseInt(cleanStr.replace(/[.,]/g, ''), 10);
  }

  // Plain digits
  const plainNum = cleanStr.replace(/[^\d]/g, '');
  if (plainNum) {
    const val = parseInt(plainNum, 10);
    // If user says "20" in Indonesian context when talking about food, usually it means 20k, but let's preserve exact numbers >= 100
    return val;
  }

  return 0;
}

/**
 * Intelligent Local AI parser for spoken or typed Indonesian financial inputs.
 * Detects multiple transactions, slang, Indonesian words, categories, and clean notes.
 */
export function parseVoiceInput(transcriptRaw: string): ParsedVoiceItem[] {
  const text = stripEmoji(transcriptRaw).toLowerCase();
  const items: ParsedVoiceItem[] = [];

  // Split sentence by punctuation or conjunctions (terus, lalu, kemudian, sama, dan)
  const segments = text
    .split(/[,;\n]|(?:\b(?:terus|lalu|kemudian|dan juga|dan|sama)\b)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const now = new Date().toISOString();

  for (const seg of segments) {
    // Regex matches:
    // 1. "Rp20.000" or "Rp 20.000"
    // 2. "20.000", "150.000", "1.500.000"
    // 3. "20rb", "20 ribu", "20 rebu", "20k", "1.5jt", "2 juta"
    // 4. Slang: goceng, ceban, gocap, cepek, seceng, gopek, sejuta
    // 5. Spelled out words: "dua puluh ribu", "lima puluh ribu", etc.
    const numberRegex = /(?:(?:rp\.?|idr)\s*)?(\d+[\d.,]*(?:\s*(?:jt|juta|rb|ribu|rebu|k))?|\b(?:goceng|ceban|gopek|seceng|sejuta|gocap|noceng|cepek)\b|(?:(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s+belas|seratus|seribu)\s+)+(?:ribu|rebu|juta))/i;

    const match = seg.match(numberRegex);
    if (!match) continue;

    const nominalRaw = match[0];
    const amount = normalizeNominal(nominalRaw);
    if (amount <= 0) continue;

    let type: TransactionType = 'expense';
    let category = 'Makanan & Minuman';
    let needWant: NeedWantType = 'need';
    let confidence = 0.95;

    // Detect income vs expense
    if (
      seg.includes('gaji') ||
      seg.includes('gajian') ||
      seg.includes('salary') ||
      seg.includes('upah')
    ) {
      type = 'income';
      category = 'Gaji Pokok';
      needWant = 'saving';
    } else if (
      seg.includes('masuk') ||
      seg.includes('pemasukan') ||
      seg.includes('dapat duit') ||
      seg.includes('terima') ||
      seg.includes('transferan') ||
      seg.includes('dikasih') ||
      seg.includes('uang saku') ||
      seg.includes('roblox') ||
      seg.includes('mlbb') ||
      seg.includes('jual') ||
      seg.includes('orderan') ||
      seg.includes('bonus') ||
      seg.includes('thr')
    ) {
      type = 'income';
      category = 'Pemasukan Lainnya';
      needWant = 'saving';
    } else if (
      seg.includes('pacar') ||
      seg.includes('kencan') ||
      seg.includes('date') ||
      seg.includes('nonton') ||
      seg.includes('bioskop') ||
      seg.includes('berdua') ||
      seg.includes('doi')
    ) {
      category = 'Kencan & Pacaran';
      needWant = 'want';
      confidence = 0.98;
    } else if (
      seg.includes('bensin') ||
      seg.includes('pertalite') ||
      seg.includes('pertamax') ||
      seg.includes('gojek') ||
      seg.includes('grab') ||
      seg.includes('angkot') ||
      seg.includes('parkir') ||
      seg.includes('tol') ||
      seg.includes('ojek')
    ) {
      category = 'Transportasi';
      needWant = 'need';
    } else if (
      seg.includes('pulsa') ||
      seg.includes('kuota') ||
      seg.includes('listrik') ||
      seg.includes('pln') ||
      seg.includes('air') ||
      seg.includes('pdam') ||
      seg.includes('wifi') ||
      seg.includes('telkom') ||
      seg.includes('token')
    ) {
      category = 'Tagihan & Pulsa';
      needWant = 'need';
    } else if (
      seg.includes('belanja') ||
      seg.includes('alfa') ||
      seg.includes('alfamart') ||
      seg.includes('indomaret') ||
      seg.includes('supermarket') ||
      seg.includes('minimarket') ||
      seg.includes('pasar') ||
      seg.includes('sabun') ||
      seg.includes('odol') ||
      seg.includes('deterjen') ||
      seg.includes('shampoo') ||
      seg.includes('sampo') ||
      seg.includes('tisu') ||
      seg.includes('sembako')
    ) {
      category = 'Belanja Harian';
      needWant = 'need';
    } else if (
      seg.includes('game') ||
      seg.includes('topup') ||
      seg.includes('steam') ||
      seg.includes('skin') ||
      seg.includes('kafe') ||
      seg.includes('hangout') ||
      seg.includes('karaoke') ||
      seg.includes('jalan-jalan')
    ) {
      category = 'Hiburan';
      needWant = 'want';
    } else if (
      seg.includes('nabung') ||
      seg.includes('tabungan') ||
      seg.includes('simpan') ||
      seg.includes('investasi') ||
      seg.includes('reksadana') ||
      seg.includes('bibit') ||
      seg.includes('emas')
    ) {
      category = 'Tabungan & Dana Darurat';
      needWant = 'saving';
    } else if (
      seg.includes('makan') ||
      seg.includes('minum') ||
      seg.includes('warteg') ||
      seg.includes('padang') ||
      seg.includes('kopi') ||
      seg.includes('sarapan') ||
      seg.includes('siang') ||
      seg.includes('malam') ||
      seg.includes('jajan') ||
      seg.includes('snack') ||
      seg.includes('gorengan') ||
      seg.includes('mie') ||
      seg.includes('bakso') ||
      seg.includes('nasi')
    ) {
      category = 'Makanan & Minuman';
      needWant = 'need';
    } else {
      category = 'Lainnya';
      needWant = 'want';
    }

    // Clean up note text (remove filler words and the price tag)
    let note = seg
      .replace(nominalRaw, '')
      .replace(/\b(?:saya|habis|udah|tadi|beli|bayar|sebesar|seharga|uang|buat|pagi|siang|malam|sore|ke)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!note || note.length < 2) {
      note = category;
    } else {
      note = note.charAt(0).toUpperCase() + note.slice(1);
    }

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
