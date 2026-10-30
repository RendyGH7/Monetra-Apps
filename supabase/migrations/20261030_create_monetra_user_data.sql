-- ==============================================================================
-- Monetra Multi-Device Cloud Sync Database Migration
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Buat tabel utama untuk menyimpan data terpusat setiap akun Google
CREATE TABLE IF NOT EXISTS public.monetra_user_data (
  user_id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 2. Aktifkan Row Level Security (RLS) agar data aman dan terisolasi
ALTER TABLE public.monetra_user_data ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada untuk mencegah duplikasi
DROP POLICY IF EXISTS "Users can read own data" ON public.monetra_user_data;
DROP POLICY IF EXISTS "Users can insert own data" ON public.monetra_user_data;
DROP POLICY IF EXISTS "Users can update own data" ON public.monetra_user_data;
DROP POLICY IF EXISTS "Users can manage own data" ON public.monetra_user_data;

-- 4. Buat policy akses: Hanya user yang login yang dapat membaca & menyimpan datanya sendiri
CREATE POLICY "Users can manage own data"
  ON public.monetra_user_data
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 5. Berikan izin akses ke role authenticated dan service_role
GRANT ALL ON TABLE public.monetra_user_data TO authenticated;
GRANT ALL ON TABLE public.monetra_user_data TO service_role;
