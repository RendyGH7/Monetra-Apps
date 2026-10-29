import { Category, UserProfile, Wallet, Transaction, Goal, AIMemory } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', color: '#E39A5E', need_want: 'need' },
  { id: 'cat-transport', name: 'Transportasi', type: 'expense', icon: 'car', color: '#6FA8D6', need_want: 'need' },
  { id: 'cat-bill', name: 'Tagihan & Pulsa', type: 'expense', icon: 'receipt', color: '#EE5D6C', need_want: 'need' },
  { id: 'cat-shopping', name: 'Belanja Harian', type: 'expense', icon: 'shopping-bag', color: '#CDBFA3', need_want: 'need' },
  { id: 'cat-entertainment', name: 'Hiburan', type: 'expense', icon: 'clapperboard', color: '#4FA8A0', need_want: 'want' },
  { id: 'cat-date', name: 'Kencan & Pacaran', type: 'expense', icon: 'heart', color: '#B5603A', need_want: 'want' },
  { id: 'cat-saving', name: 'Tabungan & Dana Darurat', type: 'expense', icon: 'piggy-bank', color: '#4FD3A4', need_want: 'saving' },
  { id: 'cat-salary', name: 'Gaji Pokok', type: 'income', icon: 'wallet', color: '#4FD3A4', need_want: 'saving' },
  { id: 'cat-side', name: 'Pemasukan Lainnya', type: 'income', icon: 'gamepad-2', color: '#E39A5E', need_want: 'saving' },
  { id: 'cat-other', name: 'Lainnya', type: 'expense', icon: 'circle-ellipsis', color: '#8A9AA8', need_want: 'want' },
];

export const INITIAL_WALLETS: Wallet[] = [
  { id: 'wallet-cash', user_id: 'default', name: 'Dompet Tunai', type: 'cash', balance: 0 },
  { id: 'wallet-bank', user_id: 'default', name: 'Rekening Bank', type: 'bank', balance: 0 },
  { id: 'wallet-ewallet', user_id: 'default', name: 'E-Wallet', type: 'ewallet', balance: 0 },
];

export const INITIAL_PROFILE: UserProfile = {
  id: 'default',
  nama: 'Rendy',
  email: '',
  currency: 'IDR',
  pay_day: 25,
  monthly_income: 0,
  internship_status: '-',
  side_hustle_status: '-',
  dating_budget_est: 0,
  daily_spend_min: 0,
  daily_spend_max: 0,
  ai_tone: 'santai',
  onboarded: true,
};

export const INITIAL_MEMORIES: AIMemory[] = [];

export const INITIAL_GOALS: Goal[] = [];

// Empty initial transactions because user has not recorded anything yet
export const INITIAL_TRANSACTIONS: Transaction[] = [];
