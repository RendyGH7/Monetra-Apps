export function stripEmoji(text: string): string {
  if (!text) return '';
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u200D\uFE0F\uFE0E]/g, '')
    .trim();
}

export function formatCurrency(amount: number): string {
  const safeAmount = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(safeAmount));

  return safeAmount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1).replace('.0', '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  }
  if (abs >= 1_000) {
    return `${(amount / 1_000).toFixed(0)} rb`;
  }
  return String(amount);
}

// ─── Indonesia WIB (UTC+7) Date & Time System ──────────────────────────────
export const WIB_OFFSET_HOURS = 7;
export const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000;

export const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
export const MONTHS_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

export interface WIBParts {
  year: number;
  month: number; // 0-11
  date: number; // 1-31
  day: number; // 0 (Minggu) - 6 (Sabtu)
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
  dateString: string; // 'YYYY-MM-DD'
  timeString: string; // 'HH:mm'
  dayName: string; // e.g. 'Kamis'
  dayShort: string; // e.g. 'Kam'
  monthName: string; // e.g. 'Oktober'
  monthShort: string; // e.g. 'Okt'
}

/**
 * Returns exact date, time, year, month, week, day, hour, minute in WIB (Asia/Jakarta, UTC+7).
 */
export function getWIBParts(input?: Date | string | number | null): WIBParts {
  let epochMs: number;
  if (!input) {
    epochMs = Date.now();
  } else if (input instanceof Date) {
    epochMs = input.getTime();
  } else if (typeof input === 'number') {
    epochMs = input;
  } else {
    // If it's a date-only string like '2026-10-29', parse in WIB directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      const [y, m, d] = input.trim().split('-').map(Number);
      epochMs = Date.UTC(y, m - 1, d) - WIB_OFFSET_MS;
    } else {
      const parsed = new Date(input).getTime();
      epochMs = isNaN(parsed) ? Date.now() : parsed;
    }
  }

  // Mathematically shift epoch by +7h so UTC methods reflect exact WIB wall-clock
  const wib = new Date(epochMs + WIB_OFFSET_MS);

  const year = wib.getUTCFullYear();
  const month = wib.getUTCMonth();
  const date = wib.getUTCDate();
  const day = wib.getUTCDay();
  const hours = wib.getUTCHours();
  const minutes = wib.getUTCMinutes();
  const seconds = wib.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateString = `${year}-${pad(month + 1)}-${pad(date)}`;
  const timeString = `${pad(hours)}:${pad(minutes)}`;

  return {
    year,
    month,
    date,
    day,
    hours,
    minutes,
    seconds,
    dateString,
    timeString,
    dayName: DAYS_ID[day],
    dayShort: DAYS_SHORT_ID[day],
    monthName: MONTHS_ID[month],
    monthShort: MONTHS_SHORT_ID[month],
  };
}

export function getNowWIBParts(): WIBParts {
  return getWIBParts(Date.now());
}

export function getWIBDateString(input?: Date | string | number | null): string {
  return getWIBParts(input).dateString;
}

export function getWIBTimeString(input?: Date | string | number | null): string {
  return getWIBParts(input).timeString;
}

export function formatDateIndo(dateStr?: string | Date | number | null, includeDayName = true): string {
  if (!dateStr) return '';
  const w = getWIBParts(dateStr);
  if (includeDayName) {
    return `${w.dayName}, ${w.date} ${w.monthName} ${w.year}`;
  }
  return `${w.date} ${w.monthName} ${w.year}`;
}

export function formatTimeShort(dateStr?: string | Date | number | null, includeZone = false): string {
  if (!dateStr) return '';
  const w = getWIBParts(dateStr);
  return includeZone ? `${w.timeString} WIB` : w.timeString;
}

export function formatDateTimeWIB(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '';
  const w = getWIBParts(dateStr);
  return `${w.date} ${w.monthShort} ${w.year}, ${w.timeString} WIB`;
}

/**
 * UTC Epoch millisecond representing 00:00:00.000 WIB for given date.
 */
export function getWIBStartOfDay(input?: Date | string | number | null): number {
  const w = getWIBParts(input);
  return Date.UTC(w.year, w.month, w.date) - WIB_OFFSET_MS;
}

/**
 * UTC Epoch millisecond representing 23:59:59.999 WIB for given date.
 */
export function getWIBEndOfDay(input?: Date | string | number | null): number {
  const w = getWIBParts(input);
  return Date.UTC(w.year, w.month, w.date + 1) - WIB_OFFSET_MS - 1;
}

/**
 * UTC Epoch millisecond representing Monday 00:00:00.000 WIB for given date's week.
 */
export function getWIBStartOfWeek(input?: Date | string | number | null): number {
  const w = getWIBParts(input);
  const dayFromMon = (w.day + 6) % 7; // Senin = 0, ..., Minggu = 6
  return Date.UTC(w.year, w.month, w.date - dayFromMon) - WIB_OFFSET_MS;
}

/**
 * UTC Epoch millisecond representing 1st of month 00:00:00.000 WIB.
 */
export function getWIBStartOfMonth(input?: Date | string | number | null): number {
  const w = getWIBParts(input);
  return Date.UTC(w.year, w.month, 1) - WIB_OFFSET_MS;
}

/**
 * UTC Epoch millisecond representing Jan 1st 00:00:00.000 WIB.
 */
export function getWIBStartOfYear(input?: Date | string | number | null): number {
  const w = getWIBParts(input);
  return Date.UTC(w.year, 0, 1) - WIB_OFFSET_MS;
}

/**
 * Number of days in specified WIB month.
 */
export function getDaysInWIBMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Friendly Indonesian greeting according to current WIB hour.
 */
export function getWIBGreeting(): string {
  const { hours } = getNowWIBParts();
  if (hours >= 4 && hours < 11) return 'Selamat Pagi';
  if (hours >= 11 && hours < 15) return 'Selamat Siang';
  if (hours >= 15 && hours < 18.5) return 'Selamat Sore';
  return 'Selamat Malam';
}
