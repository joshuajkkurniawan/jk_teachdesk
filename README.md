# JK TeachDesk — Super App Guru

Web app untuk guru (Informatika, Bahasa Inggris, pembina Ekskul Band), dibangun dengan
**Google Apps Script + Google Sheets**. Gratis di-hosting, data tersimpan di Google Drive Anda sendiri.

| Modul | Fitur |
|---|---|
| 👥 **Siswa** | CRUD, cari & filter per kelas, **impor massal dengan copy-paste dari Excel/Sheets**, status aktif/mutasi, ekspor CSV |
| 🏫 **Kelas & Ekskul** | Rombel mapel (anggota otomatis dari data kelas) atau ekskul (anggota dipilih manual, lintas kelas) |
| ✅ **Presensi & Jurnal** | Satu pertemuan = jurnal mengajar + presensi (H/T/S/I/A), default semua hadir, rekap % kehadiran, ekspor CSV |
| 📊 **Penilaian** | Buku nilai bergaya spreadsheet: asesmen berbobot (tugas, kuis, UH, praktik, proyek, STS/SAS/SAT), skor maks bebas, KKTP, nilai akhir otomatis, navigasi Enter, validasi rentang nilai, ekspor CSV |
| ✨ **AI Studio** | 22 jenis perangkat: Modul Ajar (Pembelajaran Mendalam), RPP 1 lembar, ATP, Analisis CP→TP, KKTP, Prota, Promes, LKPD, Bahan Ajar, Outline Slide, Ice Breaking, PjBL, Bank Soal + kunci, Kisi-kisi, Rubrik, Asesmen Diagnostik, Proker Ekskul Band, Rencana Latihan Band, Materi Teori Musik, Surat Ortu, Refleksi Guru, Prompt Bebas |
| 📝 **Deskripsi rapor (AI)** | Dari nilai nyata + TP tiap asesmen → deskripsi capaian per siswa |
| 🗂️ **Arsip Dokumen** | Simpan, edit (Markdown), ekspor ke **Google Docs** (heading, tabel, daftar, kode ikut terformat) |
| ⚙️ **Pengaturan** | Profil guru & sekolah (otomatis masuk identitas dokumen AI), model AI, tema terang/gelap |

---

## 1. Pasang di Google (± 10 menit)

### Cara A — Copy-paste manual (paling mudah)

1. Buka [sheets.new](https://sheets.new) → beri nama, mis. **TeachDesk DB**.
2. Menu **Extensions → Apps Script**.
3. Buat file sesuai folder `src/` (nama harus sama, tanpa ekstensi):
   - **Script** (`+` → *Script*): `Code`, `Config`, `Db`, `Services`, `Ai`, `AiTemplates`, `Dokumen`
   - **HTML** (`+` → *HTML*): `Index`, `Styles`, `App`, `Vendor`
   - Salin isi tiap file dari repo ini. Hapus isi bawaan `Code.gs` dulu.
4. ⚙️ **Project Settings** → centang *Show "appsscript.json"* → salin isi `src/appsscript.json`.
5. Di editor, pilih fungsi **`setupDatabase`** → **Run** → izinkan akses (Review permissions → akun Anda → *Advanced* → *Go to project* → *Allow*).
   Cek spreadsheet: tab `Siswa`, `Rombel`, `Nilai`, dst. sudah muncul.
6. **Deploy → New deployment** → ⚙️ *Web app* →
   - *Execute as*: **Me**
   - *Who has access*: **Only myself**
   → **Deploy** → buka URL `/exec`. Bookmark di HP & laptop. 🎉

> Setelah mengubah kode: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (URL tetap sama).
> Untuk tes cepat tanpa deploy ulang, pakai URL **Test deployments** (`/dev`).

### Cara B — Pakai `clasp` (untuk yang suka terminal)

```bash
npm i -g @google/clasp
clasp login
# buat spreadsheet dulu, lalu ambil Script ID dari Apps Script → Project Settings
cp .clasp.json.example .clasp.json   # isi scriptId
clasp push
```
Lanjutkan dari langkah 5 Cara A.

## 2. Hubungkan AI (Claude)

1. Buat API key di [console.anthropic.com](https://console.anthropic.com/settings/keys) (isi saldo; bayar per pemakaian).
2. Di aplikasi: **Pengaturan → AI** → tempel key → **Simpan** → **Tes koneksi**.
3. Pilih model:
   - **Claude Opus 5.5** (default) — kualitas terbaik untuk modul ajar & soal.
   - **Claude Sonnet 5.5** — lebih cepat & hemat.
   - **Claude Haiku 5.5** — paling hemat untuk tugas ringan (surat ortu, ice breaking).

Key disimpan di *Script Properties* (server), tidak pernah dikirim ke browser.

## 3. Alur kerja harian yang disarankan

1. **Awal semester** — Pengaturan profil → impor siswa (copy dari Dapodik/Excel) → buat rombel
   (`X-1 Informatika`, `XI-2 Bahasa Inggris`, `Ekskul Band` → pilih anggota).
2. **Perencanaan** — AI Studio: Analisis CP → ATP → Prota/Promes → Modul Ajar per topik. Simpan ke arsip, ekspor ke Docs.
3. **Setiap mengajar** — Beranda → *Isi presensi hari ini* → tulis materi (jurnal) → tandai yang tidak hadir → Simpan.
4. **Setiap asesmen** — Penilaian → *+ Asesmen* (isi TP-nya!) → ketik nilai, Enter untuk turun → Simpan.
5. **Akhir semester** — *Deskripsi rapor (AI)* → periksa & edit → CSV untuk e-Rapor. Rekap presensi → CSV.

## 4. Coba & kembangkan secara lokal (learning by doing)

Tidak perlu deploy untuk bereksperimen — ada **dev server** yang meniru Google Sheets:

```bash
npm run dev            # → http://localhost:8080
# AI sungguhan (opsional):
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Data lokal tersimpan di `dev/.data.json` (hapus file itu untuk reset). Tanpa API key, AI mengembalikan jawaban tiruan.

### Peta kode

```
src/
├── Code.gs         doGet() + router api(action, payload) ← SATU pintu dari browser
├── Config.gs       SCHEMA tabel (= tab spreadsheet), konstanta, pengaturan default
├── Db.gs           "ORM" mini di atas Sheets: dbAll_, dbInsert_, dbUpdate_, dbUpsertMany_ …
├── Services.gs     logika: siswa, rombel, nilai, presensi, dashboard
├── Ai.gs           panggilan Claude API (UrlFetchApp) + deskripsi rapor (structured output JSON)
├── AiTemplates.gs  katalog 22 jenis perangkat ← tambah jenis baru di sini
├── Dokumen.gs      arsip dokumen + konverter Markdown → Google Docs
├── Index.html      kerangka halaman
├── Styles.html     CSS (token warna, dark mode, responsif HP)
├── App.html        seluruh front-end (vanilla JS): VIEWS.dashboard, VIEWS.siswa, …
└── Vendor.html     marked + DOMPurify (dibundel, tanpa CDN)
dev/server.js       dev server lokal + mock SpreadsheetApp
```

### Latihan pengembangan (mulai dari yang mudah)

1. **Tambah jenis perangkat AI** — salin satu objek di `AiTemplates.gs` (mis. `ice_breaking`), ganti `id`, `nama`, `fields`, `struktur`. Form muncul otomatis.
2. **Tambah kolom siswa** (mis. `alamat`) — tambahkan di akhir `SCHEMA.Siswa` (`Config.gs`), lalu di `SISWA_FIELDS` (`App.html`) dan `siswaSave_` (`Services.gs`). Kolom sheet dibuat otomatis.
3. **Tambah aksi API** — buat fungsi `namaFungsi_(p)` di `Services.gs`, daftarkan di `routes_()` (`Code.gs`), panggil dari browser dengan `call('nama.aksi', {...})`.
4. **Tambah halaman** — buat `VIEWS.namahalaman = async (el) => { … }` di `App.html` + tombol `data-view` di `Index.html`.

## 5. Catatan teknis

- **Keamanan**: web app berjalan sebagai akun Anda dan hanya bisa diakses Anda (*Only myself*). Semua input di-escape sebelum dirender; hasil AI disanitasi DOMPurify.
- **Batas Apps Script**: satu eksekusi maks. 6 menit. Jika dokumen sangat panjang gagal/terpotong, pecah permintaan (mis. per pertemuan) atau turunkan *effort*.
- **Data** disimpan sebagai teks (NIS `00123` tetap utuh). Backup: *File → Make a copy* pada spreadsheet.
- **Isi dokumen AI** dipotong per 40.000 karakter di tab `DokumenIsi` (batas sel Sheets 50.000).
