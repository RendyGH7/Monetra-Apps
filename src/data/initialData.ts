import { Category, UserProfile, Wallet, Transaction, Goal, AIMemory } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', color: '#E39A5E', need_want: 'need' },
  { id: 'cat-date', name: 'Kencan & Pacaran', type: 'expense', icon: 'heart', color: '#B5603A', need_want: 'want' },
  { id: 'cat-transport', name: 'Transportasi', type: 'expense', icon: 'car', color: '#6FA8D6', need_want: 'need' },
  { id: 'cat-bill', name: 'Tagihan & Pulsa', type: 'expense', icon: 'receipt', color: '#EE5D6C', need_want: 'need' },
  { id: 'cat-shopping', name: 'Belanja Harian', type: 'expense', icon: 'shopping-bag', color: '#CDBFA3', need_want: 'need' },
  { id: 'cat-entertainment', name: 'Hiburan', type: 'expense', icon: 'clapperboard', color: '#4FA8A0', need_want: 'want' },
  { id: 'cat-saving', name: 'Tabungan & Dana Darurat', type: 'expense', icon: 'piggy-bank', color: '#4FD3A4', need_want: 'saving' },
  { id: 'cat-salary', name: 'Gaji Magang', type: 'income', icon: 'wallet', color: '#4FD3A4', need_want: 'saving' },
  { id: 'cat-side', name: 'Bisnis Roblox & MLBB', type: 'income', icon: 'gamepad-2', color: '#E39A5E', need_want: 'saving' },
  { id: 'cat-other', name: 'Lainnya', type: 'expense', icon: 'circle-ellipsis', color: '#8A9AA8', need_want: 'want' },
];

export const INITIAL_WALLETS: Wallet[] = [
  { id: 'wallet-cash', user_id: 'default', name: 'Dompet Tunai', type: 'cash', balance: 180000 },
  { id: 'wallet-bank', user_id: 'default', name: 'Rekening Bank', type: 'bank', balance: 950000 },
  { id: 'wallet-ewallet', user_id: 'default', name: 'E-Wallet', type: 'ewallet', balance: 370000 },
];

export const INITIAL_PROFILE: UserProfile = {
  id: 'default',
  nama: 'Rendy (Anak Magang)',
  email: 'rendy@intern.finai.id',
  currency: 'IDR',
  pay_day: 25,
  monthly_income: 1500000,
  internship_status: 'Anak Magang',
  side_hustle_status: 'Jual Item Roblox & Akun MLBB (Sedang Off)',
  dating_budget_est: 600000,
  daily_spend_min: 10000,
  daily_spend_max: 20000,
  ai_tone: 'santai',
  onboarded: true,
};

export const INITIAL_MEMORIES: AIMemory[] = [
  {
    id: 'mem-1',
    user_id: 'default',
    type: 'profile',
    content: 'Pekerjaan: Anak magang dengan gaji pokok Rp 1.500.000 per bulan. Gajian tiap tanggal 25.',
    importance: 5,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    user_id: 'default',
    type: 'habit',
    content: 'Pengeluaran pribadi harian hemat sekitar Rp 10.000 hingga Rp 20.000 untuk makan siang/jajan kecil.',
    importance: 4,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    user_id: 'default',
    type: 'context',
    content: 'Punya pacar, rutin nge-date 3 hingga 4 kali seminggu dengan biaya Rp 50.000 hingga Rp 200.000 sekali kencan. Prioritas pengawasan budget kencan agar tidak melampaui gaji magang.',
    importance: 5,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mem-4',
    user_id: 'default',
    type: 'alias',
    content: 'Bisnis sampingan: Jualan item Roblox dan akun Mobile Legends, status saat ini sedang off jualan.',
    importance: 3,
    updated_at: new Date().toISOString(),
  },
];

export const INITIAL_GOALS: Goal[] = [
  {
    id: 'goal-1',
    user_id: 'default',
    name: 'Dana Darurat Magang',
    target_amount: 1000000,
    current_amount: 450000,
    deadline: '2026-12-31',
  },
  {
    id: 'goal-2',
    user_id: 'default',
    name: 'Modal Restok Akun & Item Game',
    target_amount: 500000,
    current_amount: 150000,
    deadline: '2027-01-31',
  },
];

// Seed realistic transactions reflecting user routine
export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    user_id: 'default',
    type: 'income',
    amount: 1500000,
    note: 'Gaji Pokok Magang',
    occurred_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    source: 'manual',
    category_id: 'cat-salary',
    wallet_id: 'wallet-bank',
  },
  {
    id: 'tx-2',
    user_id: 'default',
    type: 'expense',
    amount: 85000,
    note: 'Nge-date makan malam berdua di kafe',
    merchant: 'Kopi Tuku & Roti',
    occurred_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    source: 'voice',
    category_id: 'cat-date',
    wallet_id: 'wallet-ewallet',
  },
  {
    id: 'tx-3',
    user_id: 'default',
    type: 'expense',
    amount: 15000,
    note: 'Makan siang nasi warteg magang',
    occurred_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    source: 'manual',
    category_id: 'cat-food',
    wallet_id: 'wallet-cash',
  },
  {
    id: 'tx-4',
    user_id: 'default',
    type: 'expense',
    amount: 25000,
    note: 'Bensin motor bolak-balik magang',
    occurred_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    source: 'voice',
    category_id: 'cat-transport',
    wallet_id: 'wallet-cash',
  },
  {
    id: 'tx-5',
    user_id: 'default',
    type: 'expense',
    amount: 120000,
    note: 'Nonton bioskop & jajan popcorn bareng pacar',
    merchant: 'Cinema XXI',
    occurred_at: new Date().toISOString(),
    source: 'voice',
    category_id: 'cat-date',
    wallet_id: 'wallet-ewallet',
  },
];
