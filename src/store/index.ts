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

interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

interface AppState {
  activeTab: 'beranda' | 'transaksi' | 'statistik' | 'asisten' | 'budget' | 'pengaturan';
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
  authLoading: boolean;
  authUser: AuthUser | null;
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
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (message: string, onUndo?: () => void) => void;
  clearToast: () => void;
  setVoiceModalOpen: (open: boolean) => void;
  setQuickManualOpen: (open: boolean) => void;
  setAuthLoading: (v: boolean) => void;
  setAuthUser: (user: AuthUser | null) => void;
  assistantInitialPrompt: string | null;
  setAssistantInitialPrompt: (prompt: string | null) => void;

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
  resetAllData: () => void;

  syncWithSupabaseUser: (userId: string, email?: string, name?: string, avatarUrl?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const GLOBAL_THEME_KEY = 'finai_theme_pref';
const RESET_EMPTY_FLAG = 'finai_reset_empty_v2';

// One-time purge of legacy dummy/seed data so the app starts completely clean & empty
try {
  if (typeof window !== 'undefined' && localStorage.getItem(RESET_EMPTY_FLAG) !== 'true') {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('finai_user_') || k.startsWith('finai_state_')) {
        localStorage.removeItem(k);
      }
    });
    localStorage.setItem(RESET_EMPTY_FLAG, 'true');
  }
} catch {
  // Ignore storage errors in restricted contexts
}


export function getUserStorageKey(userId?: string | null): string {
  if (!userId || userId === 'guest' || userId === 'default') return 'monetra_user_guest';
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `monetra_user_${cleanId}`;
}

export function loadUserData(userId?: string | null): Partial<AppState> | null {
  try {
    const key = getUserStorageKey(userId);
    let raw = localStorage.getItem(key);
    // Backward compatibility with previous keys
    if (!raw && userId) {
      const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
      raw =
        localStorage.getItem(`finai_user_${cleanId}`) ||
        localStorage.getItem(`monetra_user_${cleanId}`) ||
        localStorage.getItem('finai_user_guest');
    }
    if (raw) {
      return JSON.parse(raw);
    }
    return null;
  } catch {
    return null;
  }
}

// In-memory debounce timer for Supabase cloud sync
let cloudSyncTimer: any = null;

export async function syncToCloud(userId: string | null | undefined, dataToPersist: any): Promise<void> {
  if (!userId || userId === 'guest' || userId === 'default') return;

  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
  }

  cloudSyncTimer = setTimeout(async () => {
    try {
      const timestamp = new Date().toISOString();
      const payload = {
        ...dataToPersist,
        _synced_at: timestamp,
      };

      // 1. Primary: Save to Supabase PostgreSQL table 'monetra_user_data'
      try {
        const { error } = await supabase
          .from('monetra_user_data')
          .upsert(
            {
              user_id: userId,
              data: payload,
              updated_at: timestamp,
            },
            { onConflict: 'user_id' }
          );

        if (!error) {
          return;
        }
      } catch {
        // Table might not exist yet, fallback to auth user_metadata below
      }

      // 2. Zero-config Fallback: Save directly to Supabase Auth user_metadata
      // This works immediately across all devices even without running SQL migrations
      await supabase.auth.updateUser({
        data: {
          monetra_cloud_data: payload,
          monetra_cloud_updated_at: timestamp,
        },
      });
    } catch (e) {
      console.warn('Monetra cloud sync warning:', e);
    }
  }, 400);
}

export async function loadFromCloud(userId: string | null | undefined): Promise<any | null> {
  if (!userId || userId === 'guest' || userId === 'default') return null;

  try {
    // 1. Try loading from Supabase table 'monetra_user_data'
    try {
      const { data, error } = await supabase
        .from('monetra_user_data')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.data) {
        return data.data;
      }
    } catch {
      // Table might not exist yet, fallback to user_metadata
    }

    // 2. Try loading from Supabase Auth user_metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.monetra_cloud_data) {
      return user.user_metadata.monetra_cloud_data;
    }
  } catch (e) {
    console.warn('Monetra cloud load error:', e);
  }

  return null;
}

export function saveUserData(userId: string | null | undefined, state: AppState): void {
  try {
    const key = getUserStorageKey(userId);
    const dataToPersist = {
      profile: state.profile,
      categories: state.categories,
      wallets: state.wallets,
      transactions: state.transactions,
      goals: state.goals,
      memories: state.memories,
      chatMessages: state.chatMessages,
    };

    // 1. Save locally for instant offline caching
    localStorage.setItem(key, JSON.stringify(dataToPersist));

    // 2. Sync to Supabase Cloud for cross-device access (laptop <-> mobile)
    if (userId && userId !== 'guest' && userId !== 'default') {
      syncToCloud(userId, dataToPersist);
    }
  } catch (e) {
    console.warn('Failed to save user data:', e);
  }
}

export const useAppStore = create<AppState>((set, get) => {
  // Load initial guest or saved state
  const saved = loadUserData('guest') || {};
  const savedTheme = (localStorage.getItem(GLOBAL_THEME_KEY) as 'dark' | 'light') || saved.theme || 'dark';

  const initialState: AppState = {
    activeTab: 'beranda',
    theme: savedTheme,
    sidebarCollapsed: saved.sidebarCollapsed ?? (typeof window !== 'undefined' ? window.innerWidth < 1024 : false),
    authLoading: true,
    authUser: null,
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
          'Halo! Saya Monetra, asisten keuangan pribadimu. Belum ada transaksi yang dicatat. Tekan tombol mikrofon atau ketik pesan untuk mulai mencatat pengeluaran atau pemasukan.',
        created_at: new Date().toISOString(),
      },
    ],
    voiceModalOpen: false,
    quickManualOpen: false,
    toast: null,
    lastDeletedTransaction: null,
    assistantInitialPrompt: null,
    setAssistantInitialPrompt: (prompt) => set({ assistantInitialPrompt: prompt }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem(GLOBAL_THEME_KEY, nextTheme);
      set({ theme: nextTheme });
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
    },

    setSidebarCollapsed: (collapsed: boolean) => {
      set({ sidebarCollapsed: collapsed });
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
    setAuthLoading: (v) => set({ authLoading: v }),
    setAuthUser: (user) => set({ authUser: user }),

    updateProfile: (updates) => {
      set((state) => {
        const newProfile = { ...state.profile, ...updates };
        const next = { profile: newProfile };
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, ...next });
        return next;
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, ...next });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, ...next });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, ...next });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, categories: updated });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, goals: updated });
        return { goals: updated };
      });
      get().showToast('Target tabungan berhasil ditambahkan.');
    },

    updateGoalProgress: (id, amount) => {
      set((state) => {
        const updated = state.goals.map((g) =>
          g.id === id ? { ...g, current_amount: g.current_amount + amount } : g
        );
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, goals: updated });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, memories: updated });
        return { memories: updated };
      });
      get().showToast('Fakta memori baru disimpan oleh AI.');
    },

    deleteMemory: (id) => {
      set((state) => {
        const filtered = state.memories.filter((m) => m.id !== id);
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, memories: filtered });
        return { memories: filtered };
      });
      get().showToast('Memori AI dihapus.');
    },

    updateMemory: (id, content) => {
      set((state) => {
        const updated = state.memories.map((m) =>
          m.id === id ? { ...m, content: stripEmoji(content), updated_at: new Date().toISOString() } : m
        );
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, memories: updated });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, chatMessages: updated });
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
        const uid = state.authUser?.id || state.profile.id;
        saveUserData(uid, { ...state, chatMessages: initial });
        return { chatMessages: initial };
      });
    },

    resetAllData: () => {
      const currentAuth = get().authUser;
      const cleanProfile: UserProfile = {
        ...INITIAL_PROFILE,
        id: currentAuth?.id || 'default',
        nama: currentAuth?.name || 'Rendy',
        email: currentAuth?.email || '',
      };
      const cleanWallets: Wallet[] = [
        { id: 'wallet-cash', user_id: cleanProfile.id, name: 'Dompet Tunai', type: 'cash', balance: 0 },
        { id: 'wallet-bank', user_id: cleanProfile.id, name: 'Rekening Bank', type: 'bank', balance: 0 },
        { id: 'wallet-ewallet', user_id: cleanProfile.id, name: 'E-Wallet', type: 'ewallet', balance: 0 },
      ];
      set({
        profile: cleanProfile,
        transactions: [],
        goals: [],
        memories: [],
        wallets: cleanWallets,
        chatMessages: [
          {
            id: 'msg-reset-' + Date.now(),
            user_id: cleanProfile.id,
            role: 'assistant',
            content:
              'Semua data transaksi, target, dan riwayat telah dikosongkan. Kamu bisa mulai mencatat dari awal!',
            created_at: new Date().toISOString(),
          },
        ],
        toast: { message: 'Semua data berhasil dikosongkan' },
      });
      saveUserData(currentAuth?.id, get());
    },

    syncWithSupabaseUser: async (userId, email, name, avatarUrl) => {
      const authUserObj: AuthUser = { id: userId, email, name, avatar_url: avatarUrl };
      set({ authUser: authUserObj });

      // 1. Check local storage on this device
      const localData = loadUserData(userId);

      // 2. Fetch cloud data from Supabase (from other devices / sessions)
      const cloudData = await loadFromCloud(userId);

      const localTxCount = localData?.transactions?.length || 0;
      const cloudTxCount = cloudData?.transactions?.length || 0;

      let chosenData: any = null;

      // Logic to resolve best data across devices:
      if (cloudData && (cloudTxCount > 0 || localTxCount === 0)) {
        chosenData = cloudData;
        // If local device also had some transactions that aren't in cloud yet, merge them
        if (localTxCount > 0 && Array.isArray(localData?.transactions)) {
          const cloudIds = new Set((cloudData.transactions || []).map((t: any) => t.id));
          const missingLocals = localData.transactions.filter((t: any) => !cloudIds.has(t.id));
          if (missingLocals.length > 0) {
            chosenData.transactions = [...missingLocals, ...(cloudData.transactions || [])];
          }
        }
      } else if (localData && (localTxCount > 0 || localData.profile)) {
        // Local device has existing transactions (e.g. user entered them on laptop)
        chosenData = localData;
        // Push to cloud immediately so other devices get it!
        syncToCloud(userId, localData);
      } else if (cloudData) {
        chosenData = cloudData;
      }

      if (chosenData && chosenData.profile) {
        // Restore full state for this Google account
        const restoredProfile: UserProfile = {
          ...chosenData.profile,
          id: userId,
          email: email || chosenData.profile.email,
          nama: name || chosenData.profile.nama || 'Pengguna',
          avatar_url: avatarUrl || chosenData.profile.avatar_url,
        };

        const nextState = {
          authUser: authUserObj,
          profile: restoredProfile,
          categories: chosenData.categories || INITIAL_CATEGORIES,
          wallets: chosenData.wallets || INITIAL_WALLETS,
          transactions: chosenData.transactions || [],
          goals: chosenData.goals || [],
          memories: chosenData.memories || [
            {
              id: 'mem-google-' + userId,
              user_id: userId,
              type: 'profile' as const,
              content: `Akun Google terverifikasi: ${name || 'Pengguna'} (${email || '-'}).`,
              importance: 3,
              updated_at: new Date().toISOString(),
            },
          ],
          chatMessages: chosenData.chatMessages || [
            {
              id: 'msg-welcome-' + Date.now(),
              user_id: userId,
              role: 'assistant' as const,
              content: `Halo ${name ? name.split(' ')[0] : 'kamu'}! Seluruh data keuangan, dompet, dan transaksimu telah tersinkronisasi di cloud akun Google. Ada yang ingin kamu catat hari ini?`,
              created_at: new Date().toISOString(),
            },
          ],
        };

        set(nextState);
        saveUserData(userId, get());
        if (cloudTxCount > 0 && localTxCount === 0) {
          get().showToast(`Sinkronisasi cloud: ${cloudTxCount} transaksi berhasil dimuat dari akun Google.`);
        }
      } else {
        // First time login on any device: initialize fresh dedicated sandbox
        const cleanName = name || 'Pengguna Monetra';
        const newProfile: UserProfile = {
          ...INITIAL_PROFILE,
          id: userId,
          email: email || '',
          nama: cleanName,
          avatar_url: avatarUrl || '',
        };

        const newMemories: AIMemory[] = [];
        const newChat: ChatMessage[] = [
          {
            id: 'msg-welcome-new-' + Date.now(),
            user_id: userId,
            role: 'assistant',
            content: `Halo ${cleanName.split(' ')[0]}! Saya Monetra, asisten keuanganmu yang tersinkronisasi dengan akun Google kamu. Data transaksi akan otomatis tersimpan di cloud untuk semua perangkatmu!`,
            created_at: new Date().toISOString(),
          },
        ];

        const nextState = {
          authUser: authUserObj,
          profile: newProfile,
          categories: INITIAL_CATEGORIES,
          wallets: INITIAL_WALLETS,
          transactions: [],
          goals: [],
          memories: newMemories,
          chatMessages: newChat,
        };

        set(nextState);
        saveUserData(userId, get());
      }
    },

    signOut: async () => {
      // 1. Save state of current user before switching
      const cur = get();
      const currentUid = cur.authUser?.id || cur.profile.id;
      if (currentUid) {
        saveUserData(currentUid, cur);
      }

      // 2. Sign out from Supabase
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }

      // 3. Clear auth user and reset to clean guest state
      const guestSaved = loadUserData('guest');
      set({
        authUser: null,
        profile: guestSaved?.profile || INITIAL_PROFILE,
        categories: guestSaved?.categories || INITIAL_CATEGORIES,
        wallets: guestSaved?.wallets || INITIAL_WALLETS,
        transactions: guestSaved?.transactions || [],
        goals: guestSaved?.goals || [],
        memories: guestSaved?.memories || [],
        chatMessages: guestSaved?.chatMessages || [
          {
            id: 'msg-logged-out-' + Date.now(),
            user_id: 'guest',
            role: 'assistant',
            content: 'Kamu telah keluar dari akun. Masuk kembali dengan akun Google kamu untuk mengakses data pribadimu.',
            created_at: new Date().toISOString(),
          },
        ],
      });

      get().showToast('Kamu telah keluar dari akun.');
    },
  };

  return initialState;
});
