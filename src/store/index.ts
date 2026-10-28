import { create } from 'zustand';
import {
  UserProfile,
  Transaction,
  Category,
  Wallet,
  Goal,
  AIMemory,
  ChatMessage,
  TransactionType,
  NeedWantType,
} from '../types';
import {
  INITIAL_PROFILE,
  INITIAL_CATEGORIES,
  INITIAL_WALLETS,
  INITIAL_TRANSACTIONS,
  INITIAL_GOALS,
  INITIAL_MEMORIES,
} from '../data/initialData';
import { supabase } from '../lib/supabase';
import { stripEmoji } from '../utils/format';

interface AppState {
  activeTab: 'beranda' | 'transaksi' | 'statistik' | 'asisten' | 'budget' | 'pengaturan';
  theme: 'dark' | 'light';
  profile: UserProfile;
  categories: Category[];
  wallets: Wallet[];
  transactions: Transaction[];
  goals: Goal[];
  memories: AIMemory[];
  chatMessages: ChatMessage[];
  voiceModalOpen: boolean;
  quickManualOpen: boolean;
  toast: { message: string; onUndo?: () => void } | null;
  lastDeletedTransaction: Transaction | null;

  setActiveTab: (tab: AppState['activeTab']) => void;
  toggleTheme: () => void;
  showToast: (message: string, onUndo?: () => void) => void;
  clearToast: () => void;
  setVoiceModalOpen: (open: boolean) => void;
  setQuickManualOpen: (open: boolean) => void;

  updateProfile: (updates: Partial<UserProfile>) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => void;
  deleteTransaction: (id: string) => void;
  undoDeleteTransaction: () => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;

  addCategory: (cat: Omit<Category, 'id'>) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoalProgress: (id: string, amount: number) => void;

  addMemory: (memory: Omit<AIMemory, 'id' | 'updated_at'>) => void;
  deleteMemory: (id: string) => void;
  updateMemory: (id: string, content: string) => void;

  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'created_at'>) => void;
  clearChat: () => void;

  syncWithSupabaseUser: (userId: string, email?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'finai_state_v1';

function loadStoredState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const useAppStore = create<AppState>((set, get) => {
  const saved = loadStoredState();

  const initialState: AppState = {
    activeTab: 'beranda',
    theme: 'dark',
    profile: saved.profile || INITIAL_PROFILE,
    categories: saved.categories || INITIAL_CATEGORIES,
    wallets: saved.wallets || INITIAL_WALLETS,
    transactions: saved.transactions || INITIAL_TRANSACTIONS,
    goals: saved.goals || INITIAL_GOALS,
    memories: saved.memories || INITIAL_MEMORIES,
    chatMessages: saved.chatMessages || [
      {
        id: 'msg-init',
        user_id: 'default',
        role: 'assistant',
        content:
          'Halo Rendy. Saya FinAI, asisten keuangan pribadi kamu. Saya memantau keuangan magang dan jadwal nge-date kamu agar tetap seimbang dan aman. Kamu bisa langsung tekan tombol mikrofon atau ketik pengeluaran hari ini.',
        created_at: new Date().toISOString(),
      },
    ],
    voiceModalOpen: false,
    quickManualOpen: false,
    toast: null,
    lastDeletedTransaction: null,

    setActiveTab: (tab) => set({ activeTab: tab }),

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      set({ theme: nextTheme });
    },

    showToast: (message, onUndo) => {
      set({ toast: { message: stripEmoji(message), onUndo } });
      setTimeout(() => {
        if (get().toast?.message === stripEmoji(message)) {
          set({ toast: null });
        }
      }, 4500);
    },

    clearToast: () => set({ toast: null }),

    setVoiceModalOpen: (open) => set({ voiceModalOpen: open }),
    setQuickManualOpen: (open) => set({ quickManualOpen: open }),

    updateProfile: (updates) => {
      set((state) => {
        const newProfile = { ...state.profile, ...updates };
        const newState = { profile: newProfile };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...newState }));
        return newState;
      });
    },

    addTransaction: (txData) => {
      const cleanNote = stripEmoji(txData.note);
      const newTx: Transaction = {
        ...txData,
        id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        note: cleanNote,
        created_at: new Date().toISOString(),
      };

      set((state) => {
        const updated = [newTx, ...state.transactions];
        // Also update wallet balance
        const updatedWallets = state.wallets.map((w) => {
          if (w.id === txData.wallet_id) {
            const delta = txData.type === 'income' ? txData.amount : -txData.amount;
            return { ...w, balance: Math.max(0, w.balance + delta) };
          }
          return w;
        });

        const next = {
          transactions: updated,
          wallets: updatedWallets,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...next }));
        return next;
      });

      get().showToast(
        `${txData.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'} Rp ${new Intl.NumberFormat('id-ID').format(txData.amount)} berhasil dicatat.`
      );
    },

    deleteTransaction: (id) => {
      const tx = get().transactions.find((t) => t.id === id);
      if (!tx) return;

      set((state) => {
        const filtered = state.transactions.filter((t) => t.id !== id);
        // revert wallet balance
        const updatedWallets = state.wallets.map((w) => {
          if (w.id === tx.wallet_id) {
            const delta = tx.type === 'income' ? -tx.amount : tx.amount;
            return { ...w, balance: Math.max(0, w.balance + delta) };
          }
          return w;
        });

        const next = {
          transactions: filtered,
          wallets: updatedWallets,
          lastDeletedTransaction: tx,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...next }));
        return next;
      });

      get().showToast('Transaksi telah dihapus.', () => get().undoDeleteTransaction());
    },

    undoDeleteTransaction: () => {
      const last = get().lastDeletedTransaction;
      if (!last) return;
      get().addTransaction(last);
      set({ lastDeletedTransaction: null, toast: null });
    },

    updateTransaction: (id, updates) => {
      set((state) => {
        const nextTx = state.transactions.map((t) =>
          t.id === id ? { ...t, ...updates, note: updates.note ? stripEmoji(updates.note) : t.note } : t
        );
        const next = { transactions: nextTx };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...next }));
        return next;
      });
      get().showToast('Transaksi diperbarui.');
    },

    addCategory: (cat) => {
      const newCat: Category = {
        ...cat,
        id: 'cat-' + Date.now(),
        name: stripEmoji(cat.name),
      };
      set((state) => {
        const updated = [...state.categories, newCat];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, categories: updated }));
        return { categories: updated };
      });
    },

    addGoal: (goal) => {
      const newGoal: Goal = {
        ...goal,
        id: 'goal-' + Date.now(),
        name: stripEmoji(goal.name),
      };
      set((state) => {
        const updated = [...state.goals, newGoal];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, goals: updated }));
        return { goals: updated };
      });
      get().showToast('Target tabungan berhasil ditambahkan.');
    },

    updateGoalProgress: (id, amount) => {
      set((state) => {
        const updated = state.goals.map((g) =>
          g.id === id ? { ...g, current_amount: g.current_amount + amount } : g
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, goals: updated }));
        return { goals: updated };
      });
      get().showToast('Progres tabungan diperbarui.');
    },

    addMemory: (mem) => {
      const newMem: AIMemory = {
        ...mem,
        id: 'mem-' + Date.now(),
        content: stripEmoji(mem.content),
        updated_at: new Date().toISOString(),
      };
      set((state) => {
        const updated = [newMem, ...state.memories];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, memories: updated }));
        return { memories: updated };
      });
      get().showToast('Fakta memori baru disimpan oleh AI.');
    },

    deleteMemory: (id) => {
      set((state) => {
        const filtered = state.memories.filter((m) => m.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, memories: filtered }));
        return { memories: filtered };
      });
      get().showToast('Memori AI dihapus.');
    },

    updateMemory: (id, content) => {
      set((state) => {
        const updated = state.memories.map((m) =>
          m.id === id ? { ...m, content: stripEmoji(content), updated_at: new Date().toISOString() } : m
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, memories: updated }));
        return { memories: updated };
      });
      get().showToast('Memori AI diperbarui.');
    },

    addChatMessage: (msg) => {
      const cleanContent = stripEmoji(msg.content);
      const newMsg: ChatMessage = {
        ...msg,
        content: cleanContent,
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        created_at: new Date().toISOString(),
      };
      set((state) => {
        const updated = [...state.chatMessages, newMsg];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, chatMessages: updated }));
        return { chatMessages: updated };
      });
    },

    clearChat: () => {
      set((state) => {
        const initial = [
          {
            id: 'msg-init-cleared',
            user_id: state.profile.id,
            role: 'assistant' as const,
            content: 'Percakapan telah dibersihkan. Ada yang ingin kamu tanyakan atau catat sekarang?',
            created_at: new Date().toISOString(),
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, chatMessages: initial }));
        return { chatMessages: initial };
      });
    },

    syncWithSupabaseUser: async (userId, email, name) => {
      set((state) => ({
        profile: {
          ...state.profile,
          id: userId,
          email: email || state.profile.email,
          nama: name || state.profile.nama,
        },
      }));
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({ profile: INITIAL_PROFILE });
      get().showToast('Kamu telah keluar dari akun.');
    },
  };

  return initialState;
});
