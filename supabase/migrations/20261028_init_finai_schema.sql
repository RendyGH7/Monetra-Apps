-- FinAI Supabase Migration Schema
-- Versi 1.0 - Oktober 2026
-- Aman dengan Row Level Security (RLS) terisolasi per akun Google

-- 1. Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nama text not null default 'Pengguna FinAI',
  avatar_url text,
  currency text default 'IDR',
  pay_day int default 25,
  monthly_income bigint default 1500000,
  internship_status text default 'Anak Magang',
  side_hustle_status text default 'Jual Item Roblox & Akun MLBB (Off)',
  dating_budget_est bigint default 1200000,
  daily_spend_min bigint default 10000,
  daily_spend_max bigint default 20000,
  ai_tone text default 'santai',
  onboarded boolean default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- 2. Wallets
create table if not exists public.wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'ewallet')),
  balance bigint default 0,
  created_at timestamptz default now()
);

alter table public.wallets enable row level security;
create policy "Users can operate on own wallets" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Categories (zero emoji)
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  parent_id uuid references public.categories(id),
  type text not null check (type in ('expense', 'income')),
  icon text not null default 'circle-ellipsis',
  color text not null default '#8A9AA8',
  need_want text check (need_want in ('need', 'want', 'saving')),
  created_at timestamptz default now()
);

alter table public.categories enable row level security;
create policy "Read global and own categories" on public.categories for select using (user_id is null or auth.uid() = user_id);
create policy "Modify own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Transactions
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  wallet_id uuid references public.wallets(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('expense', 'income')),
  amount bigint not null check (amount > 0),
  note text not null,
  merchant text,
  occurred_at timestamptz default now() not null,
  source text default 'voice' check (source in ('voice', 'text', 'manual', 'receipt')),
  confidence float default 1.0,
  voice_session_id uuid,
  tags text[] default array[]::text[],
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;
create policy "Users operate own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_transactions_user_date on public.transactions(user_id, occurred_at desc);

-- 5. Budgets
create table if not exists public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade,
  month text not null,
  amount bigint not null check (amount > 0),
  created_at timestamptz default now()
);

alter table public.budgets enable row level security;
create policy "Users operate own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Goals
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  target_amount bigint not null check (target_amount > 0),
  current_amount bigint default 0,
  deadline date,
  created_at timestamptz default now()
);

alter table public.goals enable row level security;
create policy "Users operate own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. Debts
create table if not exists public.debts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  person text not null,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  amount bigint not null check (amount > 0),
  due_date date,
  settled boolean default false,
  created_at timestamptz default now()
);

alter table public.debts enable row level security;
create policy "Users operate own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. AI Memories
create table if not exists public.ai_memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  content text not null,
  importance int default 1,
  last_used_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_memories enable row level security;
create policy "Users operate own ai_memories" on public.ai_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9. Chat Messages
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  thread_id text default 'default',
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Users operate own chat_messages" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
