export type TransactionType = 'expense' | 'income';
export type NeedWantType = 'need' | 'want' | 'saving';
export type TransactionSource = 'voice' | 'text' | 'manual' | 'receipt';
export type WalletType = 'cash' | 'bank' | 'ewallet';

export interface UserProfile {
  id: string;
  nama: string;
  email?: string;
  avatar_url?: string;
  currency: string;
  pay_day: number;
  monthly_income: number;
  internship_status: string;
  side_hustle_status: string;
  dating_budget_est: number;
  daily_spend_min: number;
  daily_spend_max: number;
  ai_tone: 'santai' | 'formal';
  onboarded: boolean;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: WalletType;
  balance: number;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  need_want: NeedWantType;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id?: string;
  category_id?: string;
  type: TransactionType;
  amount: number;
  note: string;
  merchant?: string;
  occurred_at: string;
  source: TransactionSource;
  confidence?: number;
  tags?: string[];
  created_at?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  amount: number;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
}

export interface Debt {
  id: string;
  user_id: string;
  person: string;
  direction: 'owed_to_me' | 'i_owe';
  amount: number;
  due_date?: string;
  settled: boolean;
}

export interface AIMemory {
  id: string;
  user_id: string;
  type: 'profile' | 'habit' | 'alias' | 'preference' | 'context';
  content: string;
  importance: number;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  card_data?: {
    type: 'transactions' | 'budget_warning' | 'calculation';
    payload: unknown;
  };
}

export interface ParsedVoiceItem {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  occurred_at: string;
  need_want: NeedWantType;
  confidence: number;
}
