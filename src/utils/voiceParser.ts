import { ParsedVoiceItem, NeedWantType, TransactionType } from '../types';
import { stripEmoji } from './format';

/**
 * Deduplicates repeated adjacent or identical spoken phrases that may be emitted
 * by Web Speech API speech-to-text restarts on mobile browsers.
 * Example: "saya dapat uang 70.000 saya dapat uang 70.000" -> "saya dapat uang 70.000"
 */
export function deduplicateSpokenPhrases(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Check if the entire string consists of two identical halves
  const half = Math.floor(trimmed.length / 2);
  const firstHalf = trimmed.slice(0, half).trim();
  const secondHalf = trimmed.slice(half).trim();
  if (firstHalf && firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
    return firstHalf;
  }

  // Token-based phrase deduplication
  const words = trimmed.split(/\s+/);
  if (words.length >= 4) {
    const mid = Math.floor(words.length / 2);
    const leftPhrase = words.slice(0, mid).join(' ').toLowerCase();
    const rightPhrase = words.slice(mid).join(' ').toLowerCase();
    if (leftPhrase === rightPhrase) {
      return words.slice(0, mid).join(' ');
    }
  }

  return trimmed;
}

/**
 * Words to number parser for common Indonesian numbers and slang.
 * Accurately parses compound words: "tujuh puluh ribu" (70,000), "seratus lima puluh ribu" (150,000), etc.
 */
export function parseIndonesianWordsToNumber(text: string): number {
  const words = text
    .toLowerCase()
    .trim()
    .replace(/[-]/g, ' ')
    .split(/\s+/);

  const units: Record<string, number> = {
    nol: 0,
    kosong: 0,
    se: 1,
    satu: 1,
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
    seceng: 1000,
    noceng: 2000,
    goceng: 5000,
    ceban: 10000,
    gocap: 50000,
    cepek: 100000,
    gopek: 500,
  };

  let total = 0;
  let subTotal = 0; // block for current thousand/million
  let current = 0;

  for (const w of words) {
    if (units[w] !== undefined) {
      if (w === 'seratus') {
        subTotal += 100;
      } else if (w === 'seribu') {
        total += (subTotal || 1) * 1000;
        subTotal = 0;
        current = 0;
      } else if (w === 'sejuta') {
        total += (subTotal || 1) * 1000000;
        subTotal = 0;
        current = 0;
      } else {
        current += units[w];
      }
    } else if (w === 'belas') {
      current = (current || 1) + 10;
    } else if (w === 'puluh') {
      current = (current || 1) * 10;
    } else if (w === 'ratus') {
      subTotal += (current || 1) * 100;
      current = 0;
    } else if (w === 'ribu' || w === 'rebu') {
      subTotal += current;
      total += (subTotal || 1) * 1000;
      subTotal = 0;
      current = 0;
    } else if (w === 'juta') {
      subTotal += current;
      total += (subTotal || 1) * 1000000;
      subTotal = 0;
      current = 0;
    }
  }

  return total + subTotal + current;
}

/**
 * Normalizes any matched nominal string (e.g. "Rp20.000", "20.000", "20rb", "20k", "dua puluh ribu", "ceban")
 */
export function normalizeNominal(str: string): number {
  str = str.trim().toLowerCase();

  // Strip currency prefixes like "rp", "rp.", "idr"
  const cleanStr = str.replace(/^(?:rp\.?|idr)\s*/i, '').trim();

  // Direct Indonesian slang checks
  if (cleanStr === 'goceng') return 5000;
  if (cleanStr === 'ceban') return 10000;
  if (cleanStr === 'gocap') return 50000;
  if (cleanStr === 'cepek') return 100000;
  if (cleanStr === 'seceng') return 1000;
  if (cleanStr === 'gopek') return 500;
  if (cleanStr === 'noceng') return 2000;
  if (cleanStr === 'sejuta') return 1000000;

  // Indonesian word numbers like "tujuh puluh ribu", "dua puluh ribu", "seratus ribu"
  if (/^[a-z\s]+$/.test(cleanStr)) {
    const wordVal = parseIndonesianWordsToNumber(cleanStr);
    if (wordVal > 0) return wordVal;
  }

  // e.g. "1.5jt", "1,5 juta", "2jt", "1 jt"
  const jtMatch = cleanStr.match(/^([\d.,]+)\s*(?:jt|juta)$/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(val * 1000000);
  }

  // e.g. "20rb", "20 ribu", "20 rebu", "20k", "70 k", "70.000 rb"
  const rbMatch = cleanStr.match(/^([\d.,]+)\s*(?:rb|ribu|k|rebu)$/i);
  if (rbMatch) {
    const numPart = rbMatch[1].replace(/\./g, '').replace(',', '.');
    const val = parseFloat(numPart);
    return Math.round(val * 1000);
  }

  // Dot / comma thousand separator format, e.g. "70.000" or "1.500.000"
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleanStr)) {
    return parseInt(cleanStr.replace(/[.,]/g, ''), 10);
  }

  // Plain digits (e.g. "70000", "25000")
  const plainNum = cleanStr.replace(/[^\d]/g, '');
  if (plainNum) {
    const val = parseInt(plainNum, 10);
    return val;
  }

  return 0;
}

/**
 * Intelligent Local AI parser for spoken or typed Indonesian financial inputs.
 * Detects multiple transactions, slang, Indonesian words, categories, and clean notes.
 */
export function parseVoiceInput(transcriptRaw: string): ParsedVoiceItem[] {
  // First, deduplicate repeated speech strings caused by browser audio restart loops
  const deduplicatedText = deduplicateSpokenPhrases(stripEmoji(transcriptRaw));
  const text = deduplicatedText.toLowerCase();
  const items: ParsedVoiceItem[] = [];

  // Split sentence by punctuation or conjunctions (terus, lalu, kemudian, sama, dan)
  const segments = text
    .split(/[,;\n]|(?:\b(?:terus|lalu|kemudian|dan juga|dan|sama)\b)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const now = new Date().toISOString();

  for (const seg of segments) {
    // Robust Regex to match:
    // 1. "Rp70.000" or "Rp 70.000" or "IDR 70.000"
    // 2. "70.000", "150.000", "1.500.000"
    // 3. "70rb", "70 ribu", "70 rebu", "70k", "1.5jt", "2 juta"
    // 4. Slang: goceng, ceban, gopek, seceng, sejuta, gocap, noceng, cepek
    // 5. Spelled out words: "tujuh puluh ribu", "lima puluh ribu", "dua puluh lima ribu", "seratus ribu", etc.
    const numberRegex =
      /(?:(?:rp\.?|idr)\s*)?(\d+[\d.,]*(?:\s*(?:jt|juta|rb|ribu|rebu|k))?|\b(?:goceng|ceban|gopek|seceng|sejuta|gocap|noceng|cepek)\b|(?:\b(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s+belas|seratus|seribu|sejuta|belas|puluh|ratus)\b[\s-]*)+(?:ribu|rebu|juta)?)/i;

    const match = seg.match(numberRegex);
    if (!match) continue;

    const nominalRaw = match[0];
    const amount = normalizeNominal(nominalRaw);
    if (amount <= 0) continue;

    let type: TransactionType = 'expense';
    let category = 'Makanan & Minuman';
    let needWant: NeedWantType = 'need';
    let confidence = 0.95;

    // Comprehensive income detection (gaji, dapat uang, dapat duit, transferan, dsb)
    const isIncome =
      seg.includes('gaji') ||
      seg.includes('gajian') ||
      seg.includes('salary') ||
      seg.includes('upah') ||
      seg.includes('honor') ||
      seg.includes('freelance') ||
      seg.includes('proyek') ||
      seg.includes('dapat') ||
      seg.includes('dapet') ||
      seg.includes('terima') ||
      seg.includes('penerimaan') ||
      seg.includes('ditransfer') ||
      seg.includes('transferan') ||
      seg.includes('dikasih') ||
      seg.includes('uang saku') ||
      seg.includes('uang jajan') ||
      seg.includes('pemasukan') ||
      seg.includes('masuk') ||
      seg.includes('roblox') ||
      seg.includes('mlbb') ||
      seg.includes('jual') ||
      seg.includes('jualan') ||
      seg.includes('orderan') ||
      seg.includes('bonus') ||
      seg.includes('thr') ||
      seg.includes('cashback') ||
      seg.includes('untung') ||
      seg.includes('cuan') ||
      seg.includes('rejeki') ||
      seg.includes('rezeki') ||
      seg.includes('nemu') ||
      seg.includes('kembalian');

    if (
      seg.includes('gaji') ||
      seg.includes('gajian') ||
      seg.includes('salary') ||
      seg.includes('upah') ||
      seg.includes('honor')
    ) {
      type = 'income';
      category = 'Gaji Pokok';
      needWant = 'saving';
      confidence = 0.99;
    } else if (isIncome) {
      type = 'income';
      category = 'Pemasukan Lainnya';
      needWant = 'saving';
      confidence = 0.98;
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
      seg.includes('indihome') ||
      seg.includes('kos') ||
      seg.includes('kost') ||
      seg.includes('sewa')
    ) {
      category = 'Tagihan & Pulsa';
      needWant = 'need';
    } else if (
      seg.includes('sabun') ||
      seg.includes('odol') ||
      seg.includes('deterjen') ||
      seg.includes('shampoo') ||
      seg.includes('sampo') ||
      seg.includes('tisu') ||
      seg.includes('sembako') ||
      seg.includes('belanja') ||
      seg.includes('indomaret') ||
      seg.includes('alfamart')
    ) {
      category = 'Belanja Harian';
      needWant = 'need';
    } else if (
      seg.includes('game') ||
      seg.includes('topup') ||
      seg.includes('steam') ||
      seg.includes('skin') ||
      seg.includes('kafe') ||
      seg.includes('cafe') ||
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
      seg.includes('ayam') ||
      seg.includes('pecel') ||
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
      .replace(/\b(?:rp\.?|idr)\b/gi, '')
      .replace(/\b(?:udah|telah|sebesar|seharga|senilai|ke|di)\b/gi, '')
      .replace(/^\s*(?:saya|aku|tadi|barusan)\s+/gi, '')
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

  // Deduplicate identical items from the same spoken utterance
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
