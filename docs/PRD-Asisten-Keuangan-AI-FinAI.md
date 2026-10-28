# PRD – Asisten Keuangan AI (FinAI)

Product Requirements Document · Versi 1.0 · Oktober 2026

Stack: React + TypeScript (TSX) · Tailwind CSS · Supabase · Gemini API · Dibangun di Antigravity (agent Gemini)

## 1. Ringkasan Produk

**FinAI** adalah aplikasi pencatat dan pengatur keuangan pribadi yang berperan sebagai **asisten keuangan pintar**, bukan sekadar buku kas statis. Pengguna cukup **berbicara lewat voice note (VN)** untuk menceritakan pengeluaran dan pemasukan hari itu. AI memahami ucapan, memecahnya menjadi transaksi terstruktur, mengkategorikannya, lalu menyimpannya. AI juga menganalisis pola pengeluaran, memberi saran sepanjang bulan, dan **mengingat kebiasaan serta preferensi tiap pengguna**.

Setiap pengguna masuk dengan **akun Google**, sehingga data dan memori AI terpisah aman antar pengguna.

**Contoh VN:** *"**Tadi pagi sarapan nasi uduk 15 ribu, siang makan bareng teman 45 ribu, isi bensin 50 ribu, terus transfer buat listrik 200 ribu. Gajian masuk juga 5 juta.**"*

→ AI mencatat 5 transaksi (3 kategori makanan/transport, 1 tagihan, 1 pemasukan), menampilkan ringkasan untuk dikonfirmasi, lalu menyimpannya.

## 2. Masalah yang Diselesaikan

| Masalah pengguna | Dampak |
| --- | --- |
| Mencatat manual itu malas dan sering terlupa | Data keuangan tidak lengkap, uang "hilang tanpa jejak" |
| Aplikasi pencatat biasa hanya menyimpan angka | Pengguna tidak paham pola dan tidak tahu harus berbuat apa |
| Kategori pengeluaran tidak konsisten | Pembagian pengeluaran tidak akurat |
| Tidak ada yang mengingatkan sebelum budget jebol | Pengeluaran melebihi rencana di akhir bulan |
| Tidak ada saran yang dipersonalisasi | Pengguna sulit memperbaiki kebiasaan finansial |

## 3. Tujuan dan Metrik Keberhasilan

**Tujuan produk**

- Mencatat transaksi sesingkat mungkin (target < 15 detik dari buka aplikasi sampai tersimpan).
- Membuat pengguna benar-benar paham ke mana uangnya pergi dengan pembagian kategori yang akurat.
- Memberi saran proaktif dan personal sepanjang bulan.
- Mendukung banyak pengguna dengan data dan memori AI yang terisolasi per akun Google.

**Metrik keberhasilan**

| Metrik | Target (3 bulan setelah rilis) |
| --- | --- |
| Akurasi transkripsi + ekstraksi transaksi dari VN | ≥ 90% transaksi benar tanpa edit |
| Akurasi auto-kategorisasi | ≥ 90% |
| Pengguna aktif mencatat ≥ 5 hari/minggu | ≥ 40% dari pengguna aktif |
| Retensi hari ke-30 | ≥ 35% |
| Waktu rata-rata pencatatan via VN | < 15 detik |
| Pengguna yang mengikuti ≥ 1 saran AI per bulan | ≥ 50% |

## 4. Target Pengguna

**Persona 1 – Rina, 24, karyawan baru.** Gaji pas-pasan, sering bingung kenapa uang habis sebelum tanggal 25. Butuh pencatatan cepat dan peringatan dini.

**Persona 2 – Dimas, 29, freelancer.** Pemasukan tidak tetap. Butuh pemisahan pemasukan/pengeluaran, proyeksi arus kas, dan dana darurat.

**Persona 3 – Sari, 35, ibu rumah tangga.** Mengelola belanja bulanan keluarga. Lebih nyaman bicara daripada mengetik, butuh pembagian pos yang jelas.

**Persona 4 – Budi, 21, mahasiswa.** Uang saku terbatas. Butuh budget harian sederhana dan tantangan hemat.

## 5. Ruang Lingkup

**Termasuk (MVP + fase lanjutan):** login Google, pencatatan via VN/teks/foto struk/manual, AI chat, memori AI per pengguna, dashboard, budget, tabungan, analisis dan saran bulanan, notifikasi, ekspor data.

**Tidak termasuk (v1):** koneksi langsung ke rekening bank/e-wallet, pembayaran atau transfer uang, fitur investasi, mode keluarga/berbagi.

## 6. Arsitektur Teknis

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React + TypeScript (TSX), Vite, Tailwind CSS, React Router, TanStack Query, Zustand, Recharts |
| Auth | Supabase Auth dengan Google OAuth |
| Database | Supabase Postgres dengan Row Level Security (RLS) |
| Penyimpanan file | Supabase Storage (audio VN sementara, foto struk) |
| Backend logic | Supabase Edge Functions (Deno/TypeScript) |
| AI | Gemini API (input audio, teks, dan gambar; function calling; output JSON terstruktur) |
| Memori AI | Tabel Postgres + pgvector untuk pencarian semantik |
| Notifikasi | Web Push / PWA, Supabase Cron (pg_cron) |
| Hosting | Vercel / Netlify (PWA) |

**Prinsip penting:** API key Gemini **tidak boleh** ada di frontend. Semua pemanggilan AI lewat Supabase Edge Function yang memverifikasi JWT pengguna.

**Alur pencatatan VN:**

- Pengguna menekan tombol mikrofon dan merekam VN (MediaRecorder API).
- Audio diunggah ke Supabase Storage (bucket privat) atau dikirim langsung ke Edge Function.
- Edge Function mengirim audio + konteks pengguna (kategori miliknya, memori relevan, tanggal hari ini) ke Gemini.
- Gemini mengembalikan JSON: transkrip + daftar transaksi (jumlah, kategori, tipe, tanggal, catatan, tingkat keyakinan).
- Aplikasi menampilkan **kartu konfirmasi**; pengguna bisa edit atau langsung simpan.
- Transaksi disimpan, memori AI diperbarui, audio dihapus sesuai kebijakan privasi.

## 7. Fitur Utama

Prioritas: **P0** = wajib MVP, **P1** = segera setelah MVP, **P2** = pengembangan lanjutan.

### 7.1 Autentikasi dan Akun (P0)

- Registrasi dan login dengan **Google** (satu tombol, tanpa password).
- Akun dibuat otomatis saat login pertama; profil diambil dari Google (nama, foto, email).
- Onboarding singkat: mata uang (default IDR), tanggal gajian, pemasukan bulanan perkiraan, target keuangan, gaya bahasa AI (santai/formal).
- Logout, hapus akun, dan **hapus seluruh data dan memori AI** (kontrol privasi penuh).
- Seluruh data dilindungi RLS berdasarkan `auth.uid()`.

### 7.2 Pencatatan via Voice Note (P0, fitur utama)

- Tombol mikrofon besar di layar utama (tekan-tahan atau tekan-mulai/tekan-selesai).
- Bahasa utama: **Bahasa Indonesia** termasuk gaya santai dan campuran ("goceng", "ceban", "15rb", "dua puluh ribu", "sejuta").
- Satu VN bisa memuat **banyak transaksi sekaligus**, termasuk pemasukan.
- Memahami konteks waktu: "tadi pagi", "kemarin", "Senin lalu".
- Memahami koreksi: "eh maksudnya 25 ribu bukan 15".
- Menampilkan transkrip + kartu transaksi untuk konfirmasi; ada skor keyakinan, item yang meragukan ditandai dan AI bertanya balik.
- Jika jumlah atau kategori ambigu, AI bertanya singkat ("Bensin 50 ribu itu motor atau mobil?").
- Rekaman maksimal 2 menit; audio dihapus otomatis setelah diproses (opsi simpan oleh pengguna).
- Mode **VN harian**: pengingat malam hari "Ceritakan pengeluaran hari ini" agar tidak ada yang terlewat.

### 7.3 Metode Pencatatan Lain (P0/P1)

- **Chat teks bebas** ke AI: "tadi beli kopi 28rb" (P0).
- **Input manual cepat** dengan form ringkas dan tombol nominal cepat (P0).
- **Scan struk/foto** dengan ekstraksi toko, item, total, pajak oleh Gemini Vision (P1).
- **Transaksi berulang**: tagihan listrik, internet, langganan, cicilan (P1).
- **Tempel notifikasi atau screenshot mutasi** e-wallet/bank untuk diparse (P1).
- **Tombol undo** setelah menyimpan dan riwayat perubahan (P0).

### 7.4 Asisten AI Cerdas (P0)

Asisten AI berupa antarmuka chat + suara yang punya akses ke data pengguna lewat *function calling*. Kemampuan:

| Kemampuan | Contoh |
| --- | --- |
| Mencatat | "Catat makan siang 35 ribu" |
| Menjawab data | "Berapa total jajan saya minggu ini?" |
| Membandingkan | "Bandingkan pengeluaran bulan ini dengan bulan lalu" |
| Mengedit/menghapus | "Ubah transaksi kopi tadi jadi 30 ribu" |
| Menganalisis | "Kenapa bulan ini boros?" |
| Menyarankan | "Bagaimana supaya bisa nabung 1 juta bulan ini?" |
| Simulasi | "Kalau saya kurangi ngopi jadi 3x seminggu, hemat berapa?" |
| Perencanaan | "Buatkan budget bulan depan dari gaji 6 juta" |

**Aturan perilaku AI:**

- Tidak pernah mengarang angka; semua angka berasal dari database lewat tool call.
- Selalu konfirmasi sebelum menyimpan, mengubah, atau menghapus data (kecuali pengguna mengaktifkan mode auto-simpan untuk transaksi dengan keyakinan tinggi).
- Tidak menghakimi; nada suportif dan praktis.
- Tidak memberi nasihat investasi spesifik; hanya edukasi dan perencanaan anggaran.
- Menjawab dalam bahasa yang dipakai pengguna.

**Daftar tool yang dipanggil AI:** `add_transactions`, `update_transaction`, `delete_transaction`, `query_transactions`, `get_summary`, `get_budget_status`, `create_budget`, `create_goal`, `get_recurring`, `save_memory`, `search_memory`.

### 7.5 Memori AI per Pengguna (P0)

AI mengingat pengguna secara personal dan **terpisah per akun Google**.

**Jenis memori:**

- **Profil:** pekerjaan, tanggal gajian, jumlah tanggungan, target keuangan.
- **Kebiasaan:** "sering ngopi di pagi hari", "belanja bulanan tiap tanggal 1".
- **Alias/kosakata:** "Warung Bu Tini" = Makanan; "Gojek" = Transportasi; "si Doi" = Hadiah/Sosial.
- **Preferensi:** gaya bahasa, kategori favorit, waktu pengingat.
- **Koreksi:** jika pengguna mengoreksi kategori, AI belajar untuk selanjutnya.
- **Konteks peristiwa:** "sedang menabung untuk laptop", "bulan ini ada acara nikahan".

**Mekanisme:**

- Setelah tiap interaksi, AI mengekstrak fakta baru yang layak diingat (`save_memory`).
- Memori disimpan dengan embedding (pgvector).
- Setiap permintaan baru: `search_memory` mengambil memori paling relevan untuk disisipkan ke prompt.
- Memori lama yang bertentangan diperbarui, bukan digandakan.
- Pengguna bisa **melihat, mengedit, dan menghapus** memorinya di halaman "Yang AI Ketahui Tentang Saya".

### 7.6 Kategori dan Pembagian Pengeluaran (P0)

- Kategori bawaan: Makanan & Minuman, Belanja Harian, Transportasi, Tagihan & Utilitas, Tempat Tinggal, Kesehatan, Pendidikan, Hiburan, Belanja Pribadi, Sosial & Hadiah, Donasi, Cicilan & Utang, Tabungan, Lainnya; pemasukan: Gaji, Bonus, Freelance, Usaha, Lainnya.
- Subkategori (mis. Makanan → Sarapan, Makan Siang, Kopi, Jajan, Delivery).
- Kategori dan subkategori **kustom** buatan pengguna.
- **Tag** bebas (mis. #liburan, #kantor) dan **dompet/akun** (tunai, bank, e-wallet).
- Klasifikasi **Kebutuhan / Keinginan / Tabungan** (aturan 50/30/20) ditentukan otomatis oleh AI, bisa diubah.
- Auto-kategorisasi dengan memori alias dan koreksi pengguna.

### 7.7 Dashboard dan Visualisasi (P0)

- Ringkasan bulan berjalan: pemasukan, pengeluaran, sisa, tabungan.
- Grafik donat pengeluaran per kategori dengan persentase.
- Tren harian/mingguan/bulanan (garis dan batang).
- Kalender pengeluaran (heatmap harian).
- Top 5 pengeluaran terbesar dan merchant paling sering.
- Perbandingan dengan bulan lalu.
- Rasio Kebutuhan vs Keinginan vs Tabungan.
- Filter periode, kategori, dompet, tag; pencarian transaksi.
- Skor **Kesehatan Keuangan** (0–100) dengan penjelasan faktor penyusunnya.

### 7.8 Budget dan Peringatan (P0/P1)

- Budget bulanan total dan per kategori (P0).
- Budget harian otomatis: "Sisa aman hari ini: Rp 85.000" (P0).
- Peringatan di 50%, 80%, 100% budget (P0).
- Prediksi akhir bulan: "Dengan laju sekarang, budget Makanan habis tanggal 22" (P1).
- **Rekomendasi budget oleh AI** berdasarkan riwayat 2–3 bulan (P1).
- Rollover sisa budget ke bulan berikutnya (P2).

### 7.9 Saran dan Insight Bulanan (P0/P1)

- **Insight harian** singkat setelah mencatat (P0).
- **Ringkasan mingguan** tiap Minggu: apa yang meningkat/menurun dan satu tindakan yang disarankan (P1).
- **Laporan bulanan lengkap** di akhir bulan: ke mana uang pergi, perbandingan, pencapaian, kebocoran, rencana bulan depan (P1).
- **Deteksi anomali**: pengeluaran tidak biasa, transaksi ganda, lonjakan kategori (P1).
- **Deteksi langganan terlupakan** dan kebocoran kecil ("latte factor") (P1).
- **Check-in tengah bulan**: evaluasi dan koreksi arah (P1).
- Saran harus **spesifik dan dapat ditindaklanjuti** (menyebut kategori dan nominal), bukan generik.

### 7.10 Target Tabungan (P1)

- Buat target (dana darurat, laptop, liburan) dengan nominal dan tenggat.
- AI menghitung setoran per minggu/bulan dan memantau progres.
- Simulasi "jika saya hemat X per hari, target tercapai tanggal Y".
- Rekomendasi dana darurat (3–6 bulan pengeluaran).

### 7.11 Utang dan Piutang (P1)

- Catat pinjaman, patungan, dan cicilan: siapa, berapa, jatuh tempo.
- Via VN: "Andi pinjam 100 ribu" → tercatat sebagai piutang.
- Pengingat jatuh tempo; tandai lunas.

### 7.12 Notifikasi dan Pengingat (P1)

- Pengingat VN malam hari (waktu bisa diatur).
- Pengingat tagihan dan transaksi berulang.
- Peringatan budget, ringkasan mingguan/bulanan.
- Pengingat gajian: "Waktunya alokasikan gaji bulan ini".

### 7.13 Gamifikasi dan Kebiasaan (P2)

- Streak mencatat harian, lencana, tantangan hemat mingguan.
- Tantangan "No spend day" dan progres pribadi.

### 7.14 Data dan Privasi (P0/P1)

- Ekspor CSV/Excel/PDF laporan (P1).
- Mode privat: sembunyikan nominal di layar (P1).
- Kunci aplikasi dengan PIN/biometrik (P2).
- Transparansi: halaman yang menjelaskan data apa yang dikirim ke AI.

### 7.15 Fitur Pengembangan Lanjutan (P2)

- Mode pasangan/keluarga dengan dompet bersama.
- Multi-mata uang dan perjalanan.
- Impor mutasi rekening (CSV/PDF).
- Widget layar utama dan asisten suara real-time (percakapan dua arah).
- Prediksi arus kas untuk pemasukan tidak tetap (freelancer).

## 8. Alur Pengguna Utama

**A. Pengguna baru:** buka aplikasi → Masuk dengan Google → onboarding (mata uang, gajian, target) → AI menyapa dan menawarkan VN pertama → transaksi tercatat → dashboard terisi.

**B. Pencatatan VN harian:** buka aplikasi → tekan mikrofon → bicara → lihat kartu konfirmasi → edit bila perlu → Simpan → AI memberi insight singkat ("Jajan hari ini 20% di atas rata-rata").

**C. Tanya AI:** buka tab Asisten → "Kenapa bulan ini boros?" → AI memanggil tool data → menjawab dengan angka dan 2–3 saran → pengguna bisa menjadikan saran sebagai budget atau target.

**D. Review akhir bulan:** notifikasi laporan bulanan → pengguna membaca ringkasan, pencapaian, kebocoran → AI mengusulkan budget bulan depan → pengguna menyetujui.

## 9. Struktur Layar

| Layar | Isi |
| --- | --- |
| Login | Tombol "Masuk dengan Google", penjelasan singkat |
| Beranda | Sisa saldo, sisa budget harian, tombol mikrofon besar, transaksi terbaru, insight hari ini |
| Asisten | Chat + VN, riwayat percakapan, saran cepat |
| Transaksi | Daftar, filter, pencarian, edit/hapus |
| Statistik | Donat, tren, kalender, perbandingan, skor kesehatan |
| Budget & Target | Budget per kategori, target tabungan, utang/piutang |
| Laporan | Mingguan dan bulanan, ekspor |
| Profil & Pengaturan | Kategori, dompet, notifikasi, memori AI, privasi, hapus akun |

Navigasi bawah (mobile-first): Beranda · Transaksi · **Mikrofon (tengah)** · Statistik · Asisten.

## 10. Model Data (Supabase / Postgres)

Semua tabel memiliki `user_id uuid references auth.users` dan RLS `user_id = auth.uid()`.

| Tabel | Kolom utama |
| --- | --- |
| profiles | id (= auth.uid), nama, avatar_url, currency, pay_day, monthly_income, ai_tone, onboarded, created_at |
| wallets | id, user_id, name, type (cash/bank/ewallet), balance |
| categories | id, user_id (null = bawaan), name, parent_id, type (expense/income), icon, color, need_want (need/want/saving) |
| transactions | id, user_id, wallet_id, category_id, type, amount (bigint), note, merchant, occurred_at, source (voice/text/manual/receipt), confidence, voice_session_id, tags text[], created_at |
| voice_sessions | id, user_id, transcript, audio_path, status, raw_ai_json, created_at |
| budgets | id, user_id, category_id (null = total), month, amount |
| recurring_transactions | id, user_id, template jsonb, frequency, next_run |
| goals | id, user_id, name, target_amount, current_amount, deadline |
| debts | id, user_id, person, direction (owed_to_me/i_owe), amount, due_date, settled |
| ai_memories | id, user_id, type, content, embedding vector(768), importance, last_used_at, updated_at |
| chat_messages | id, user_id, thread_id, role, content, tool_calls jsonb, created_at |
| insights | id, user_id, period, kind (daily/weekly/monthly/anomaly), content, created_at |
| notifications | id, user_id, type, payload, scheduled_at, sent_at |

**Contoh RLS:**

```sql
alter table transactions enable row level security;
create policy "own rows" on transactions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

Indeks wajib: `transactions(user_id, occurred_at desc)`, `ai_memories` dengan indeks vektor (HNSW/IVFFlat).

## 11. Desain Prompt dan Perilaku AI

**System prompt (ringkas):** AI adalah asisten keuangan pribadi berbahasa Indonesia; hanya menggunakan data dari tool; selalu konfirmasi sebelum mengubah data; menyertakan memori pengguna yang relevan; nada hangat, ringkas, tanpa menghakimi; tanggal hari ini dan zona waktu (Asia/Jakarta) selalu disertakan.

**Output ekstraksi VN (JSON terstruktur):**

```json
{
  "transcript": "...",
  "transactions": [
    {
      "type": "expense",
      "amount": 15000,
      "category": "Makanan & Minuman",
      "subcategory": "Sarapan",
      "note": "nasi uduk",
      "occurred_at": "2026-10-28T07:00:00+07:00",
      "need_want": "need",
      "confidence": 0.95
    }
  ],
  "clarifications": ["Bensin 50 ribu untuk motor atau mobil?"]
}
```

**Pedoman normalisasi angka Indonesia:** "rb/ribu" ×1.000, "jt/juta" ×1.000.000, "goceng" = 5.000, "ceban" = 10.000, "gopek" = 500, "seceng" = 1.000, "sejuta" = 1.000.000.

**Keamanan AI:** validasi output JSON dengan skema (Zod) sebelum disimpan; tolak nominal tidak masuk akal tanpa konfirmasi; batasi laju permintaan per pengguna; abaikan instruksi yang disisipkan dalam catatan transaksi (anti prompt-injection).

## 12. Kebutuhan Non-Fungsional

| Aspek | Persyaratan |
| --- | --- |
| Performa | VN 30 detik diproses dan ditampilkan < 8 detik; dashboard < 2 detik |
| Keamanan | HTTPS, RLS di semua tabel, API key hanya di Edge Function, bucket audio privat |
| Privasi | Persetujuan eksplisit sebelum kirim data ke AI, hapus akun menghapus semua data dan memori |
| Ketersediaan | PWA, tampilan offline untuk data terakhir, antrean pencatatan saat offline (P1) |
| Aksesibilitas | Kontras warna memadai, label ARIA, ukuran tombol ≥ 44px |
| Responsif | Mobile-first, nyaman di tablet dan desktop |
| Lokalisasi | Bahasa Indonesia utama, format Rp 1.234.567, zona waktu WIB |
| Biaya | Cache ringkasan, batasi panjang konteks, hapus audio setelah proses |
| Kepatuhan | Selaras dengan UU Pelindungan Data Pribadi (UU PDP) |

## 13. Roadmap Rilis

**Fase 1 – MVP (4–6 minggu)**

- Setup proyek (Vite + React TSX + Tailwind + Supabase), skema database + RLS
- Login Google dan onboarding
- Pencatatan VN, teks, dan manual dengan kartu konfirmasi
- Kategori bawaan dan kustom, daftar transaksi
- Dashboard dasar (donat, tren, ringkasan)
- Chat AI dengan tool dasar (catat, tanya data)
- Memori AI dasar (profil, alias) dan halaman kelola memori
- Budget bulanan + peringatan

**Fase 2 – Asisten Cerdas (4 minggu)**

- Insight harian, ringkasan mingguan, laporan bulanan
- Deteksi anomali dan langganan terlupakan
- Prediksi akhir bulan dan rekomendasi budget AI
- Target tabungan, utang/piutang, transaksi berulang
- Scan struk, notifikasi push, ekspor data
- Skor kesehatan keuangan

**Fase 3 – Pengembangan (berkelanjutan)**

- Gamifikasi, kunci aplikasi, mode privat
- Multi-mata uang, impor mutasi, mode keluarga
- Percakapan suara real-time dengan AI

## 14. Risiko dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| AI salah mengenali nominal atau kategori | Wajib kartu konfirmasi, skor keyakinan, pertanyaan klarifikasi, belajar dari koreksi |
| Halusinasi angka pada analisis | Semua angka dari tool/database, bukan dari memori model |
| Kebocoran data antar pengguna | RLS ketat, uji isolasi, filter user_id di setiap query Edge Function |
| Biaya API membengkak | Batas pemakaian harian, cache, model ringan untuk tugas sederhana |
| Kekhawatiran privasi suara | Hapus audio otomatis, transparansi, kontrol hapus data |
| Memori AI keliru atau usang | Halaman kelola memori, pembaruan alih-alih duplikasi, skor kepentingan |
| Aksen/bahasa daerah sulit dikenali | Fallback edit transkrip, koreksi dipelajari lewat memori |

## 15. Instruksi untuk Agent Gemini di Antigravity

Gunakan PRD ini sebagai sumber kebenaran. Kerjakan bertahap dan selalu minta konfirmasi di akhir tiap tahap:

- **Tahap 1 – Fondasi:** inisialisasi Vite React TSX + Tailwind, struktur folder (`/features/auth`, `/features/transactions`, `/features/voice`, `/features/assistant`, `/features/dashboard`, `/lib/supabase`), klien Supabase, routing, layout mobile-first dengan navigasi bawah.
- **Tahap 2 – Database:** tulis migrasi SQL untuk seluruh tabel di bagian 10, aktifkan pgvector, RLS, dan seed kategori bawaan.
- **Tahap 3 – Auth:** Google OAuth via Supabase, guard route, pembuatan profiles otomatis lewat trigger, onboarding.
- **Tahap 4 – Transaksi:** CRUD, filter, pencarian, kategori kustom.
- **Tahap 5 – VN:** komponen perekam, Edge Function `process-voice` (Gemini audio → JSON tervalidasi Zod), kartu konfirmasi, penyimpanan.
- **Tahap 6 – Asisten dan Memori:** Edge Function `assistant-chat` dengan function calling, tool di bagian 7.4, `save_memory`/`search_memory`, halaman kelola memori.
- **Tahap 7 – Dashboard dan Budget:** grafik Recharts, budget, peringatan, prediksi.
- **Tahap 8 – Insight dan Notifikasi:** cron untuk insight harian/mingguan/bulanan, push notification.
- **Tahap 9 – Polish:** PWA, aksesibilitas, uji RLS, penanganan error, loading dan empty state.

**Aturan teknis untuk agent:** TypeScript strict, tidak ada `any`; semua rahasia di environment variable Supabase; validasi input dan output AI dengan Zod; komponen kecil dan dapat dipakai ulang; setiap fitur disertai penanganan loading, error, dan empty state; teks antarmuka dalam Bahasa Indonesia.

## 16. Pertanyaan Terbuka

- Model monetisasi: gratis penuh, freemium (batas VN/bulan), atau langganan?
- Apakah VN perlu bisa dipakai tanpa internet (antre lalu proses saat online)?
- Perlu dukungan bahasa selain Indonesia di versi awal?
- Berapa lama riwayat chat dan memori disimpan secara default?
- Apakah perlu versi aplikasi native (Capacitor/React Native) selain PWA?
