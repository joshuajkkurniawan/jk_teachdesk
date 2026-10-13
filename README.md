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

### Jika muncul error (mis. "dashboard_ is not defined")

1. Di editor Apps Script, pilih fungsi **`cekInstalasi`** → **Run** → lihat *Execution log*.
   Fungsi ini menyebut file mana yang belum lengkap.
2. Salin ulang file itu **utuh** (Ctrl+A di GitHub → *Raw* → Ctrl+A, Ctrl+C), tempel menggantikan seluruh isi lama, lalu **Ctrl+S**.
   Pastikan file `.gs` dibuat sebagai *Script* dan file `.html` sebagai *HTML*, dengan nama persis sama.
3. Jika editor menandai error sintaks (garis merah), biasanya ada bagian yang terpotong saat menyalin.
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL `/exec` hanya memakai versi yang sudah di-deploy, jadi perubahan tidak muncul tanpa langkah ini.

## 2. Hubungkan AI (Gemini atau Claude)

Pilih penyedia di **Pengaturan → AI → Penyedia AI**. Key disimpan di *Script Properties* (server) dan tidak pernah dikirim ke browser.

### Google Gemini (default, ada kuota gratis)
1. Buat key di [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Tempel di **API key Gemini** → **Simpan pengaturan AI** → **Tes koneksi**.
3. Model:
   - **Gemini 3.5 Flash** (default): seimbang, cukup untuk modul ajar dan soal.
   - **Flash Lite**: paling cepat, kuota gratis paling longgar.
   - **Gemini Pro**: kuota gratisnya 0, jadi hanya bisa dipakai jika billing aktif.
4. Jika model sibuk (503) atau kuota per menit habis (429), aplikasi otomatis mencoba model Flash cadangan.

### Anthropic Claude (berbayar)
1. Buat key di [console.anthropic.com](https://console.anthropic.com/settings/keys) dan isi saldo.
   Key yang benar diawali **`sk-ant-`** dan hanya ditampilkan sekali. Teks `apikey_…` di daftar key adalah ID, bukan key.
2. Pilih model: **Opus 5.5** (terbaik), **Sonnet 5.5** (cepat), **Haiku 5.5** (hemat).

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
REAL_AI=1 npm run dev  # memakai key yang disimpan di Pengaturan lokal
```

Data lokal tersimpan di `dev/.data.json` (hapus file itu untuk reset). Tanpa API key, AI mengembalikan jawaban tiruan.

### Peta kode

```
src/
├── Code.gs         doGet() + router api(action, payload) ← SATU pintu dari browser
├── Config.gs       SCHEMA tabel (= tab spreadsheet), konstanta, pengaturan default
├── Db.gs           "ORM" mini di atas Sheets: dbAll_, dbInsert_, dbUpdate_, dbUpsertMany_ …
├── Services.gs     logika: siswa, rombel, nilai, presensi, dashboard
├── Ai.gs           callAi_ → Gemini / Claude (UrlFetchApp), model cadangan, deskripsi rapor (JSON)
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
