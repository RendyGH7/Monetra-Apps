# DESIGN.md - FinAI (Asisten Keuangan AI)

Dokumen desain UI/UX untuk agent Gemini di Antigravity. Stack: React + TypeScript (TSX), Tailwind CSS, Supabase. Dokumen ini adalah sumber kebenaran visual dan interaksi. Baca bersama PRD.

---

## 0. ATURAN MUTLAK (BACA PERTAMA)

1. **DILARANG KERAS memakai emoji atau emoticon dalam bentuk apa pun.** Tidak di teks antarmuka, tombol, notifikasi, pesan AI, placeholder, empty state, data seed, nama kategori, komentar kode, maupun commit message. Ini juga berlaku untuk output Asisten AI: system prompt AI wajib memuat larangan emoji, dan frontend wajib menyaring (strip) karakter emoji dari respons AI sebelum ditampilkan (lihat bagian 15).
2. Semua ikon adalah **SVG garis tipis** (bukan font emoji, bukan karakter Unicode bergambar).
3. Semua aset (logo, ilustrasi, pola, latar) dibuat sendiri oleh agent sebagai SVG/CSS, atau diambil dari sumber internet yang berlisensi bebas. Tidak boleh ada aset berbentuk emoji, stiker, atau clipart.
4. Tema visual: **Glassmorphism** yang bersih, minimalis, elegan, modern, dan futuristik. Kaca dipakai sebagai bahasa visual, bukan dekorasi berlebihan.
5. Aplikasi harus **responsif penuh** di mobile, tablet, dan laptop/desktop. Tidak boleh ada scroll horizontal pada halaman, elemen terpotong, atau tombol yang terlalu kecil.
6. Warna harus kuat, canggih, dan anti-slop: palet "Titanium & Ember" (bagian 2 dan 3). Tidak boleh ada ungu/indigo, gradien multi-warna, neon, atau pelangi.

---

## 1. FILOSOFI DESAIN

| Prinsip | Arti dalam praktik |
|---|---|
| Jelas sebelum cantik | Pengguna paham fungsi tiap layar dalam 3 detik tanpa tutorial. |
| Satu aksi utama per layar | Selalu ada satu tombol yang menonjol (biasanya mikrofon). |
| Tenang dan lega | Banyak ruang kosong, sedikit elemen, hirarki tegas. |
| Angka adalah bintang | Nominal uang selalu paling terbaca, memakai angka tabular. |
| Ramah semua kalangan | Teks cukup besar, kontras kuat, bahasa sederhana, bisa dipakai dari remaja sampai orang tua. |
| Kaca yang bermakna | Kaca menandai lapisan: makin penting/aktif, makin terang dan kontras. |
| Cepat terasa | Interaksi memberi respons visual di bawah 100 ms, transisi halus. |

Kata kunci rasa: tenang, kuat, premium, cerdas, tepercaya, ringan.

---

## 2. ARAH WARNA BARU: "TITANIUM & EMBER" (ANTI-SLOP)

Palet sebelumnya (obsidian hijau dan brass kuning) diganti agar tampil lebih tajam, lebih dingin, dan lebih canggih, tanpa jatuh ke tampilan generik produk AI (biru-ungu, gradien dua warna, kilau neon).

**Konsep:** dasar biru-hitam titanium (ink steel) yang sangat dalam, kaca bernuansa baja dingin yang jernih seperti es, dan satu aksen **ember copper (tembaga membara)** yang hangat dan tegas. Dingin dan hangat saling mengunci: titanium memberi kesan teknologi dan presisi, tembaga memberi kesan nilai, energi, dan kualitas. Kontras suhu warna inilah yang membuat kaca terlihat hidup tanpa perlu neon. Hasilnya kuat, mahal, tepercaya, dan jelas berbeda dari template AI umum.

**Aturan anti-slop (wajib):**

1. DILARANG memakai ungu, indigo, violet, magenta, atau biru-ungu di bagian mana pun. Biru hanya boleh berupa biru baja (steel) yang condong ke abu-abu, tidak pernah biru listrik.
2. DILARANG memakai gradien multi-warna (misalnya biru ke ungu, cyan ke magenta). Gradien hanya boleh satu rona (tonal), misalnya tembaga terang ke tembaga gelap.
3. DILARANG efek neon, glow berpendar tebal, dan bayangan berwarna menyala. Cahaya hanya berupa highlight tipis pada tepi kaca.
4. Satu aksen saja (ember copper). Warna lain hanya untuk makna data (pemasukan, pengeluaran, peringatan).
5. Jangan memakai putih murni #FFFFFF atau hitam murni #000000 untuk teks dan latar besar; gunakan token di bawah agar terasa lebih premium.
6. Tidak ada pelangi pada grafik; gunakan palet data yang kalem pada bagian 3.5.

---

## 3. PALET WARNA

### 3.1 Token warna - Dark (default)

| Token | Hex | Penggunaan |
|---|---|---|
| `--bg-base` | #070A0F | Latar dasar halaman (ink titanium) |
| `--bg-elevated` | #0D1219 | Latar lapisan di bawah kaca |
| `--glass-fill` | rgba(190,212,238,0.055) | Isi panel kaca standar |
| `--glass-fill-strong` | rgba(190,212,238,0.095) | Panel kaca aktif/hover/modal |
| `--glass-border` | rgba(205,225,245,0.13) | Border panel kaca |
| `--glass-highlight` | rgba(235,245,255,0.24) | Garis terang tipis di sisi atas panel |
| `--text-primary` | #EEF2F6 | Teks utama dan angka |
| `--text-secondary` | #A3AFBC | Teks pendukung |
| `--text-tertiary` | #74808E | Placeholder, keterangan kecil |
| `--accent` | #E39A5E | Aksen utama ember copper (tombol utama, fokus, tautan, item aktif) |
| `--accent-strong` | #CF8143 | Hover/pressed aksen |
| `--accent-deep` | #8F4F22 | Ujung gelap gradien tonal tembaga |
| `--accent-soft` | rgba(227,154,94,0.15) | Latar chip/aksen lembut |
| `--on-accent` | #1C0E04 | Teks/ikon di atas tombol tembaga |
| `--income` | #4FD3A4 | Pemasukan (jade) |
| `--expense` | #EE5D6C | Pengeluaran (karmin) |
| `--warning` | #F2C14E | Peringatan budget (kuning amber) |
| `--danger` | #E0343F | Bahaya, hapus, budget jebol |
| `--success` | #4FD3A4 | Berhasil, target tercapai |

### 3.2 Token warna - Light

Tampilan terang memakai nuansa porselen dingin keabu-abuan (mist), bukan putih menyilaukan, agar tetap mewah dan lembut di mata.

| Token | Hex |
|---|---|
| `--bg-base` | #EDF0F3 |
| `--bg-elevated` | #F6F8FA |
| `--glass-fill` | rgba(255,255,255,0.60) |
| `--glass-fill-strong` | rgba(255,255,255,0.82) |
| `--glass-border` | rgba(255,255,255,0.88) |
| `--glass-shadow-border` | rgba(16,32,48,0.09) |
| `--text-primary` | #0C131A |
| `--text-secondary` | #3F4C59 |
| `--text-tertiary` | #5E6B78 |
| `--accent` | #14212C (grafit titanium pekat, untuk tombol utama dan item aktif) |
| `--accent-strong` | #0B151E |
| `--accent-ember` | #A1501F (tembaga gelap untuk teks aksen/tautan; kontras AA di atas porselen) |
| `--accent-soft` | rgba(161,80,31,0.12) |
| `--on-accent` | #F4F6F8 |
| `--income` | #13805D |
| `--expense` | #C73A4A |
| `--warning` | #A8700A |
| `--danger` | #BD2A33 |
| `--success` | #13805D |

### 3.3 Latar aurora (mesh gradient halus)

Latar halaman terdiri dari `--bg-base` ditambah 3 orb radial sangat kabur dan beropasitas rendah, agar kaca punya sesuatu untuk "membiaskan". Orb berada dalam keluarga biru baja, teal gelap, dan tembaga, tanpa ungu atau biru listrik.

Dark:

- Orb 1: biru baja dalam #1D4E73 pada 28% opasitas, ukuran 60vmax, kiri atas.
- Orb 2: teal gelap #0E4D55 pada 20% opasitas, ukuran 50vmax, kanan bawah.
- Orb 3: tembaga #D98A52 pada 7% opasitas, ukuran 35vmax, tengah kanan.

Light:

- Orb 1: mist biru #B4C9DB pada 35% opasitas, kiri atas.
- Orb 2: pasir tembaga #EBCDB0 pada 40% opasitas, kanan bawah.
- Orb 3: perla abu #CBD5DD pada 30% opasitas, tengah.

Aturan: maksimal 3 orb, blur 120 px, animasi drift sangat pelan (60 detik, ease-in-out, infinite). Hormati `prefers-reduced-motion`. Tambahkan lapisan noise SVG 3 persen opasitas di atas latar untuk tekstur kaca.

### 3.4 Aturan pemakaian warna

- Rasio: 82 persen netral, 12 persen tembaga, 6 persen semantik.
- Tembaga dipakai hemat dan bermakna: tombol utama, item navigasi aktif, fokus, angka kunci, dan garis aksen. Jika semuanya tembaga, tidak ada yang istimewa.
- Pemasukan selalu jade, pengeluaran selalu karmin, di seluruh aplikasi, agar konsisten. Tembaga tidak pernah dipakai untuk data pemasukan atau pengeluaran.
- Tombol utama dark: isi tembaga solid atau gradien tonal tembaga (#E39A5E ke #CF8143) dengan teks `--on-accent`. Tombol utama light: isi grafit titanium pekat dengan teks `--on-accent`.
- Jangan pernah mengandalkan warna saja untuk makna; sertakan label, tanda plus/minus, atau ikon.
- Semua pasangan teks/latar wajib memenuhi **WCAG AA** (kontras teks biasa minimal 4.5:1, teks besar 3:1), diuji pada kondisi terburuk di atas kaca.

### 3.5 Warna grafik kategori (kalem, kuat, tanpa pelangi)

Urutan 8 warna data: #E39A5E (tembaga), #4FD3A4 (jade), #6FA8D6 (biru baja), #EE5D6C (karmin), #CDBFA3 (pasir), #4FA8A0 (teal), #B5603A (karat), #8A9AA8 (slate). Untuk lebih dari 8 kategori, gabungkan sisanya menjadi "Lainnya" berwarna slate #8A9AA8. Pada light mode, gunakan versi satu tingkat lebih gelap agar kontras terjaga.

---

## 4. TIPOGRAFI

| Peran | Font | Catatan |
|---|---|---|
| Judul dan angka besar | **Plus Jakarta Sans** (600, 700) | Modern, hangat, sangat terbaca |
| Isi dan UI | **Inter** (400, 500, 600) | Netral dan jernih |
| Angka nominal | Inter dengan `font-variant-numeric: tabular-nums` | Digit sejajar rapi |

Muat lewat Google Fonts dengan `display=swap`, sediakan fallback `system-ui, -apple-system, Segoe UI, sans-serif`.

### Skala (fluid, memakai clamp agar otomatis menyesuaikan layar)

| Token | Ukuran | Line-height | Pemakaian |
|---|---|---|---|
| `display` | clamp(2rem, 1.4rem + 2.6vw, 3.25rem) | 1.1 | Saldo/angka utama dashboard |
| `h1` | clamp(1.5rem, 1.2rem + 1.2vw, 2rem) | 1.2 | Judul halaman |
| `h2` | clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem) | 1.25 | Judul seksi |
| `h3` | 1.125rem | 1.3 | Judul kartu |
| `body` | 1rem (16px) | 1.55 | Isi |
| `small` | 0.875rem | 1.5 | Keterangan |
| `caption` | 0.75rem | 1.4 | Label kecil (minimal 12px) |

Aturan: teks isi tidak boleh kurang dari 16px di mobile untuk mencegah zoom otomatis pada input iOS. Panjang baris maksimal 70 karakter. Nominal uang selalu ditulis format Indonesia: `Rp 1.234.567`.

---

## 5. SPASI, RADIUS, BAYANGAN

- Skala spasi kelipatan 4 px: 4, 8, 12, 16, 24, 32, 48, 64.
- Padding kartu: 16 px (mobile), 20 px (tablet), 24 px (desktop).
- Gap antar kartu: 12 px (mobile), 16 px (tablet), 20 px (desktop).
- Radius: kontrol kecil 12 px, kartu 20 px, panel besar/modal 28 px, tombol pil dan chip 999 px.
- Target sentuh minimum **44 x 44 px**.
- Bayangan lembut berlapis, bukan hitam pekat:
  - Dark: `0 8px 32px rgba(0,0,0,0.35)`, ditambah `inset 0 1px 0 var(--glass-highlight)`.
  - Light: `0 8px 32px rgba(16,32,48,0.10)`, ditambah `inset 0 1px 0 rgba(255,255,255,0.9)`.

---

## 6. RESEP KACA (GLASSMORPHISM)

Tiga tingkat kaca, dipakai berdasarkan peran lapisan:

| Tingkat | Fill | Blur | Pemakaian |
|---|---|---|---|
| Glass 1 (permukaan) | `--glass-fill` | 20 px | Kartu biasa, daftar |
| Glass 2 (aktif) | `--glass-fill-strong` | 28 px | Kartu terpilih, hover, panel AI |
| Glass 3 (overlay) | fill kuat + bayangan besar | 40 px | Modal, bottom sheet, dropdown, navigasi |

Kelas dasar yang harus dibuat sebagai komponen/utility Tailwind:

```css
.glass {
  background: var(--glass-fill);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  backdrop-filter: blur(20px) saturate(140%);
  border-radius: 20px;
}
```

Aturan penting:

- Border selalu 1 px translusen, ditambah highlight tipis di sisi atas untuk kesan tepi kaca.
- Jangan menumpuk lebih dari 2 lapis kaca yang saling menimpa (performa dan keterbacaan).
- **Fallback:** gunakan `@supports not (backdrop-filter: blur(1px))` dan ganti dengan fill solid `--bg-elevated` berwarna 92 persen opak.
- **Performa mobile:** turunkan blur menjadi 12 px pada perangkat lemah (`prefers-reduced-transparency` atau deteksi frame rate rendah) dan batasi jumlah elemen berkaca yang bergulir.
- **Keterbacaan:** teks di atas kaca tidak boleh bergantung pada latar di belakang; pastikan fill cukup untuk menjaga kontras.
- Tambahkan opsi di Pengaturan: "Kurangi efek kaca" untuk aksesibilitas.

---

## 7. IKONOGRAFI DAN ASET

- **Pustaka ikon:** `lucide-react` (garis 1.75 px, sudut membulat) sebagai standar tunggal. Alternatif jika ikon tidak tersedia: Phosphor (varian regular). Jangan campur gaya.
- Ukuran ikon: 20 px (UI), 24 px (navigasi), 32 px (empty state). Warna mengikuti `currentColor`.
- Ikon kategori: setiap kategori punya ikon garis dan warna dari palet grafik, ditempatkan di dalam lingkaran kaca 40 px. Contoh pemetaan: Makanan (utensils), Transportasi (car), Tagihan (receipt), Belanja (shopping-bag), Kesehatan (heart-pulse), Pendidikan (graduation-cap), Hiburan (clapperboard), Tabungan (piggy-bank), Gaji (wallet), Lainnya (circle-ellipsis).
- **Logo:** dibuat manual sebagai SVG: simbol sederhana berupa lingkaran kaca dengan gelombang suara yang menyatu menjadi garis grafik naik. Satu warna aksen, tanpa teks di dalam simbol. Sediakan versi mono untuk favicon.
- **Ilustrasi empty state:** SVG geometris minimalis (lingkaran, garis, orb gradien) dibuat sendiri, bukan karakter kartun, bukan emoji.
- **Foto/gambar:** tidak wajib. Jika dipakai, ambil dari Unsplash atau Pexels (lisensi bebas), bertema abstrak, tekstur, atau arsitektur, diberi overlay gelap agar selaras. Simpan atribusi di `/public/credits.md`.
- Semua aset disimpan di `/src/assets` (SVG diimpor sebagai komponen React), dioptimalkan dengan SVGO, dan memiliki `aria-hidden="true"` bila dekoratif.

---

## 8. TATA LETAK RESPONSIF

### 8.1 Breakpoint (mobile-first)

| Nama | Lebar | Perangkat |
|---|---|---|
| base | 0 - 639 px | Ponsel |
| `sm` | 640 px | Ponsel besar/landscape |
| `md` | 768 px | Tablet |
| `lg` | 1024 px | Laptop kecil/tablet landscape |
| `xl` | 1280 px | Laptop/desktop |
| `2xl` | 1536 px | Layar lebar |

### 8.2 Pola navigasi per perangkat

| Perangkat | Navigasi |
|---|---|
| Mobile (< 768) | **Bottom navigation** kaca mengambang: Beranda, Transaksi, **tombol Mikrofon di tengah (lebih besar, menonjol)**, Statistik, Asisten. Respek safe-area (`env(safe-area-inset-bottom)`). |
| Tablet (768 - 1023) | **Sidebar rail** ramping di kiri (ikon + label kecil), konten dua kolom. |
| Laptop/Desktop (>= 1024) | **Sidebar penuh** 260 px (logo, menu, profil), area konten tengah, **panel Asisten AI** tetap di kanan pada >= 1280 px. |

### 8.3 Sistem grid

- Kontainer: lebar maksimum 1440 px, padding horizontal 16 / 24 / 32 px (mobile / tablet / desktop), diposisikan tengah.
- Gunakan CSS Grid dan Flexbox, satuan relatif (`rem`, `%`, `fr`, `clamp`). Hindari lebar tetap dalam piksel untuk wadah.
- Dashboard memakai **bento grid**: 1 kolom (mobile), 2 kolom (tablet), 12 kolom fleksibel (desktop).
- Gunakan `min-h-dvh` (bukan `100vh`) agar tidak bermasalah dengan bilah alamat browser mobile.
- Tabel lebar berubah menjadi daftar kartu pada mobile; tabel hanya muncul di `md` ke atas.
- Gambar dan grafik memakai `max-width: 100%`; grafik dibungkus `ResponsiveContainer`.
- Teks panjang memakai `truncate` atau `line-clamp`, tidak pernah meluap.
- Modal pada mobile menjadi **bottom sheet** penuh lebar dengan pegangan geser; pada desktop menjadi dialog tengah (maks 560 px).

### 8.4 Matriks uji wajib

Uji pada lebar 360, 390, 430, 768, 834, 1024, 1280, 1440, 1920 px, orientasi portrait dan landscape, serta browser Chrome, Safari (iOS), dan Firefox. Tidak ada scroll horizontal, tidak ada tumpang tindih, nominal tidak terpotong.

---

## 9. KOMPOSISI LAYAR UTAMA

### 9.1 Login

- Satu kartu kaca di tengah di atas latar aurora. Logo, judul satu baris ("Kelola uangmu dengan suara"), subjudul satu kalimat, satu tombol besar **Masuk dengan Google** (logo Google resmi SVG), dan tautan kebijakan privasi kecil.
- Di desktop, bagi dua: kiri pitch singkat dengan 3 poin manfaat (ikon garis), kanan kartu login.

### 9.2 Onboarding (3 langkah, bisa dilewati)

Progress bar kaca tipis di atas. Langkah: (1) profil dasar dan tanggal gajian, (2) target keuangan, (3) coba VN pertama dengan contoh kalimat. Satu pertanyaan per layar, tombol Lanjut besar, tombol Lewati teks kecil.

### 9.3 Beranda (Dashboard)

Urutan dari atas ke bawah pada mobile (di desktop menjadi bento grid):

1. Sapaan singkat dan nama, tombol notifikasi.
2. **Kartu Saldo Bulan Ini** (Glass 2): sisa uang (angka `display`), dua chip kecil pemasukan dan pengeluaran.
3. **Sisa Aman Hari Ini**: satu angka besar dengan bar progres tipis.
4. **Tombol Mikrofon** besar, menjadi titik fokus (lihat 10.1).
5. **Insight AI Hari Ini**: satu kalimat bernada ramah dengan satu tombol aksi.
6. Donat pengeluaran per kategori dengan legenda.
7. Status budget (maksimal 3 kategori teratas, tautan "Lihat semua").
8. Transaksi terbaru (5 item).

### 9.4 Transaksi

Bilah pencarian kaca, chip filter yang bisa digeser horizontal (periode, kategori, dompet), daftar dikelompokkan per hari dengan subtotal harian. Geser kiri untuk hapus, ketuk untuk edit. Empty state ramah dengan ajakan merekam VN.

### 9.5 Statistik

Pemilih periode (segmented control), kartu: donat kategori, tren garis, kalender heatmap, perbandingan bulan lalu, rasio Kebutuhan/Keinginan/Tabungan, skor Kesehatan Keuangan (indikator lingkar). Setiap kartu punya judul, satu kalimat penjelasan "apa artinya ini", dan bisa diperluas.

### 9.6 Asisten AI

Mobile: layar penuh. Desktop: panel kanan tetap atau halaman dua kolom. Isi: area percakapan, gelembung pengguna (warna aksen lembut) dan gelembung AI (kaca), baris saran cepat berbentuk chip ("Ringkas minggu ini", "Kenapa bulan ini boros?"), bilah input dengan tombol mikrofon dan kirim. Hasil tindakan AI muncul sebagai **kartu terstruktur** di dalam percakapan (kartu transaksi, kartu ringkasan), bukan teks panjang.

### 9.7 Budget dan Target

Daftar kartu per kategori dengan bar progres berwarna sesuai status (aman, waspada, melebihi). Tombol "Atur dengan bantuan AI" yang menonjol. Target tabungan memakai cincin progres.

### 9.8 Laporan, Profil dan Pengaturan

Laporan: kartu ringkasan mingguan/bulanan dengan tombol ekspor. Pengaturan dikelompokkan dalam daftar kaca bersekat (Akun, Tampilan, Notifikasi, Kategori, Dompet, Privasi, Memori AI). Halaman "Yang AI Ketahui Tentang Saya" menampilkan memori sebagai kartu yang bisa diedit atau dihapus.

---

## 10. KOMPONEN

### 10.1 Tombol Mikrofon (komponen paling penting)

- Mobile: lingkaran 68 px di tengah bottom nav, menonjol keluar sedikit dari bilah, gradien tonal tembaga (#E39A5E ke #CF8143) dengan cincin kaca di sekelilingnya, ikon mikrofon berwarna `--on-accent`. Tanpa glow berwarna.
- Desktop: tombol besar di kartu khusus "Rekam pengeluaran hari ini" dan pintasan keyboard (spasi).
- **Status visual yang jelas:**
  - Siap: cincin tembaga tenang dengan denyut sangat halus.
  - Merekam: warna berubah ke karmin lembut (`--expense`), **gelombang suara hidup** (visualizer SVG berdasarkan amplitudo), timer, teks "Merekam, ketuk lagi untuk selesai".
  - Memproses: animasi orb berputar halus dan teks "Memahami ceritamu".
  - Selesai: transisi halus menuju kartu konfirmasi.
- Izin mikrofon ditolak: pesan ramah dengan langkah singkat mengaktifkannya, bukan error mentah.
- Wajib punya alternatif ketik yang selalu terlihat di dekatnya.

### 10.2 Kartu Konfirmasi VN

Muncul sebagai bottom sheet (mobile) atau panel (desktop): transkrip di atas (bisa diedit), lalu daftar transaksi hasil ekstraksi, tiap baris berisi ikon kategori, nominal, catatan, tanggal, dan chip kategori yang bisa diubah dengan satu ketukan. Baris dengan keyakinan rendah diberi garis tepi `--warning` yang teredam dan pertanyaan klarifikasi AI. Tombol **Simpan semua** besar di bawah, **Batal** sekunder.

### 10.3 Tombol

| Varian | Gaya |
|---|---|
| Primer | Dark: isi tembaga (gradien tonal), teks `--on-accent`. Light: isi grafit titanium pekat, teks `--on-accent`. Tinggi 48 px, radius pil |
| Sekunder | Kaca dengan border, teks utama |
| Ghost | Tanpa isi, teks aksen |
| Bahaya | Isi `--danger` teredam, dipakai hanya untuk hapus |

Semua tombol punya status: hover (naik 1 px, kaca lebih terang), pressed (skala 0.98), focus (cincin 2 px `--accent` dengan offset), disabled (opasitas 45 persen), loading (spinner kecil, lebar tetap).

### 10.4 Input dan Form

Input tinggi 48 px, kaca dengan border, label di atas (bukan hanya placeholder), pesan error di bawah dengan ikon dan teks jelas. Input nominal: besar, otomatis format `Rp`, keyboard numerik di mobile (`inputmode="numeric"`). Pemilih tanggal dan kategori memakai bottom sheet di mobile.

### 10.5 Kartu Transaksi (baris daftar)

Ikon kategori dalam lingkaran, nama/catatan (satu baris, truncate), kategori dan waktu sebagai teks kecil, nominal rata kanan: pengeluaran berwarna `--expense` dengan tanda minus, pemasukan berwarna `--income` dengan tanda plus. Tinggi minimum 64 px.

### 10.6 Grafik (Recharts)

Latar transparan, garis grid sangat tipis (`rgba(255,255,255,0.06)`), tanpa border tebal, tooltip berbentuk kaca kecil, animasi masuk 600 ms. Donat dengan angka total di tengah. Selalu sertakan legenda atau label langsung, dan versi teks ringkas untuk pembaca layar.

### 10.7 Navigasi

Item aktif ditandai dengan pil kaca terang di belakang ikon, ikon berwarna aksen, dan label tebal. Bottom nav selalu menampilkan label teks di bawah ikon agar mudah dipahami semua kalangan.

### 10.8 Umpan Balik Sistem

- Toast kaca di atas (desktop kanan atas, mobile atas tengah), hilang otomatis 4 detik, ada tombol Urungkan untuk aksi yang bisa dibatalkan.
- Skeleton shimmer lembut saat memuat, bukan spinner layar penuh.
- Empty state: ilustrasi SVG kecil, satu kalimat penjelas, satu tombol aksi.
- Error: bahasa manusiawi, jelaskan apa yang terjadi dan apa yang bisa dilakukan, sediakan tombol Coba lagi.

---

## 11. PRINSIP UX AGAR MUDAH DIPAHAMI

1. **Hirarki aksi:** satu aksi utama (rekam), aksi kedua (ketik/catat manual), sisanya tersembunyi namun mudah ditemukan.
2. **Label jelas, bukan jargon.** Pakai "Pemasukan", "Pengeluaran", "Sisa uang"; hindari istilah teknis. Ikon selalu disertai teks pada navigasi dan aksi penting.
3. **Pengungkapan bertahap:** tampilkan ringkasan dulu, detail muncul saat diketuk.
4. **Petunjuk kontekstual:** tooltip singkat dan penanda "Baru" pada fitur yang belum pernah dipakai, hilang setelah dilihat. Tour onboarding maksimal 4 sorotan, bisa dilewati.
5. **Contoh yang bisa ditiru:** di layar VN tampilkan contoh kalimat yang bisa diketuk untuk dicoba ("Tadi sarapan 15 ribu dan beli bensin 50 ribu").
6. **Selalu bisa dibatalkan:** setelah menyimpan ada Urungkan; hapus meminta konfirmasi.
7. **Konsistensi:** posisi tombol, warna pemasukan/pengeluaran, dan pola kartu sama di seluruh aplikasi.
8. **Mikrokopi hangat dan lugas,** tanpa emoji dan tanpa nada menghakimi. Contoh: "Pengeluaran makan minggu ini naik 18 persen. Mau lihat rinciannya?"
9. **Jalan pintas pengguna mahir:** pintasan keyboard di desktop (N untuk transaksi baru, spasi untuk rekam, / untuk cari), perintah cepat di input AI.
10. **Ramah semua usia:** opsi ukuran teks (Normal, Besar, Sangat besar) yang menskalakan seluruh antarmuka.

---

## 12. MOTION

- Durasi: 150 ms (mikro), 250 ms (transisi komponen), 400 ms (transisi layar). Easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Gerak bermakna: kartu muncul dengan naik 8 px dan fade, bottom sheet meluncur dari bawah, angka berubah dengan animasi hitung halus.
- Latar aurora bergerak sangat pelan; elemen UI tidak berkedip atau memantul berlebihan.
- Wajib menghormati `prefers-reduced-motion`: matikan animasi dekoratif dan ganti transisi dengan fade sederhana.

---

## 13. AKSESIBILITAS

- Kontras WCAG AA minimum, diuji pada dark dan light.
- Seluruh fungsi dapat dipakai dengan keyboard; urutan fokus logis; cincin fokus selalu terlihat.
- Elemen interaktif memakai tag semantik (`button`, `nav`, `main`, `form`), label ARIA untuk ikon tanpa teks, `aria-live="polite"` untuk hasil AI dan toast.
- Fungsi VN selalu punya alternatif teks. Transkrip bisa dibaca dan diedit.
- Target sentuh minimal 44 px, jarak antar target minimal 8 px.
- Dukungan `prefers-reduced-motion`, `prefers-reduced-transparency`, dan `prefers-color-scheme` (default mengikuti sistem, bisa dioverride).

---

## 14. IMPLEMENTASI TAILWIND

Definisikan token sebagai CSS variables pada `:root` dan `[data-theme="light"]`, lalu petakan di `tailwind.config.ts`:

```ts
// tailwind.config.ts (ringkas)
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        elevated: 'var(--bg-elevated)',
        accent: { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)', deep: 'var(--accent-deep)', soft: 'var(--accent-soft)', on: 'var(--on-accent)' },
        income: 'var(--income)',
        expense: 'var(--expense)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        ink: { 1: 'var(--text-primary)', 2: 'var(--text-secondary)', 3: 'var(--text-tertiary)' },
      },
      borderRadius: { xl2: '20px', xl3: '28px' },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: { glass: '20px', glass2: '28px', glass3: '40px' },
    },
  },
}
```

Struktur komponen yang disarankan: `components/ui` (Button, GlassCard, Input, Chip, Sheet, Toast, Skeleton, Tabs, ProgressRing), `components/layout` (AppShell, SidebarNav, BottomNav, AssistantPanel), `components/finance` (TransactionRow, CategoryIcon, BudgetBar, ConfirmCard), `components/voice` (MicButton, Waveform). Semua komponen bertipe TypeScript ketat, menerima `className`, dan responsif secara bawaan.

---

## 15. PENANGANAN LARANGAN EMOJI (TEKNIS)

1. System prompt Gemini wajib berisi: "Jangan pernah menggunakan emoji, emoticon, atau karakter bergambar dalam jawaban apa pun."
2. Buat utilitas `stripEmoji(text)` di frontend dan di Edge Function, memakai regex properti Unicode `\p{Extended_Pictographic}` (flag `u`) beserta penghapus penggabung (zero-width joiner dan variation selector). Terapkan pada semua teks dari AI, nama kategori buatan pengguna, dan catatan transaksi sebelum ditampilkan atau disimpan.
3. Tambahkan aturan lint/pemeriksaan CI yang gagal jika kode sumber, data seed, atau berkas teks mengandung karakter emoji.
4. Seluruh ikon dan ilustrasi berupa SVG, tidak pernah karakter Unicode bergambar.

---

## 16. KINERJA UI

- Target Lighthouse mobile: Performance >= 90, Accessibility >= 95.
- Pecah kode per rute (`React.lazy`), muat grafik secara lazy.
- Batasi elemen `backdrop-filter` yang aktif bersamaan; hindari blur pada elemen yang sering digulir bila tidak perlu.
- Gambar dalam format WebP/AVIF, SVG dioptimalkan, font dengan `display=swap` dan subset Latin.
- Animasi hanya pada properti `transform` dan `opacity`.

---

## 17. CHECKLIST PENERIMAAN UNTUK AGENT

Sebelum menyatakan sebuah layar selesai, pastikan semua poin berikut terpenuhi:

- Tidak ada emoji atau emoticon di mana pun (UI, data, kode, respons AI).
- Tampil sempurna pada 360 px hingga 1920 px, tanpa scroll horizontal.
- Navigasi sesuai perangkat (bottom nav, rail, sidebar) dan tombol mikrofon menonjol di mobile.
- Dark dan light mode berfungsi, kontras AA terpenuhi.
- Efek kaca konsisten (3 tingkat), ada fallback tanpa `backdrop-filter`.
- Setiap layar punya status loading (skeleton), kosong, dan error yang ramah.
- Semua tombol punya status hover, pressed, focus, disabled, loading.
- Nominal memakai format `Rp` Indonesia dan angka tabular; pemasukan jade, pengeluaran karmin; tembaga hanya untuk aksen.
- Dapat dioperasikan penuh dengan keyboard dan pembaca layar.
- Animasi menghormati `prefers-reduced-motion`.
- Pengguna baru dapat mencatat pengeluaran pertama lewat VN dalam kurang dari 60 detik tanpa panduan.

---

## 18. REFERENSI

Inspirasi gaya (hanya sebagai rujukan arah, bukan untuk disalin): sistem desain glassmorphism fintech gelap di perpustakaan Superdesign (Luminous Ethereal, Blucap Glass Edition, Goldlight), studi kasus UI fintech AI oleh Gudrix Agency di Behance, serta UI kit Fortuna untuk aplikasi keuangan mobile. Ikon: Lucide (lucide.dev). Font: Plus Jakarta Sans dan Inter (Google Fonts).
