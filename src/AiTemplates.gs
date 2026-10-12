/**
 * AiTemplates.gs — katalog jenis perangkat pembelajaran untuk AI Studio.
 *
 * Mau menambah jenis dokumen baru? Cukup tambahkan satu objek ke array
 * di aiTemplates_(): { id, nama, kategori, ikon, deskripsi, fields, struktur }.
 *   - fields  : kolom isian yang muncul di form (lihat F_ di bawah).
 *   - struktur: instruksi struktur output yang dikirim ke AI.
 * Form di browser dibangun otomatis dari definisi ini.
 */

// Kumpulan field yang sering dipakai ulang.
const F_ = {
  mapel: { key: 'mapel', label: 'Mata pelajaran', type: 'mapel', required: true },
  fase: { key: 'fase', label: 'Fase / Kelas', type: 'select', options: ['Fase D (Kelas VII–IX)', 'Fase E (Kelas X)', 'Fase F (Kelas XI)', 'Fase F (Kelas XII)'], required: true },
  topik: { key: 'topik', label: 'Topik / Materi pokok', type: 'text', placeholder: 'mis. Algoritma & Pemrograman — Percabangan', required: true },
  cp: { key: 'cp', label: 'Capaian Pembelajaran (opsional — tempel CP resmi)', type: 'textarea', placeholder: 'Kosongkan bila ingin AI merumuskan sesuai CP terbaru' },
  tp: { key: 'tp', label: 'Tujuan Pembelajaran (opsional)', type: 'textarea' },
  alokasi: { key: 'alokasi', label: 'Alokasi waktu', type: 'text', placeholder: 'mis. 2 × 45 menit', value: '2 × 45 menit' },
  pertemuan: { key: 'pertemuan', label: 'Jumlah pertemuan', type: 'number', value: '1' },
  model: { key: 'model', label: 'Model / pendekatan', type: 'select', options: ['Bebaskan AI memilih', 'Problem Based Learning', 'Project Based Learning', 'Discovery Learning', 'Inquiry Learning', 'Cooperative Learning', 'Flipped Classroom', 'Game Based Learning', 'Communicative Language Teaching', 'Genre Based Approach'] },
  karakteristik: { key: 'karakteristik', label: 'Karakteristik peserta didik / kondisi kelas', type: 'textarea', placeholder: 'mis. 36 siswa, sebagian belum lancar mengetik, lab komputer 20 unit, wifi terbatas' },
  bahasa: { key: 'bahasa', label: 'Bahasa output', type: 'select', options: ['Indonesia', 'English', 'Bilingual (Indonesia + English)'] },
  tambahan: { key: 'tambahan', label: 'Instruksi tambahan', type: 'textarea', placeholder: 'mis. sertakan diferensiasi untuk siswa yang cepat & lambat' },
  semester: { key: 'semester', label: 'Semester', type: 'select', options: ['Ganjil', 'Genap', 'Ganjil & Genap'] },
  jpm: { key: 'jpm', label: 'JP per minggu', type: 'number', value: '2' },
};

function aiTemplates_() {
  return [
    // ---------------- PERENCANAAN ----------------
    {
      id: 'modul_ajar', nama: 'Modul Ajar (RPP Lengkap)', kategori: 'Perencanaan', ikon: '📘',
      deskripsi: 'Modul ajar lengkap berbasis Pembelajaran Mendalam: identitas, TP, langkah memahami–mengaplikasi–merefleksi, asesmen, LKPD ringkas.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.cp, F_.tp, F_.alokasi, F_.pertemuan, F_.model, F_.karakteristik, F_.bahasa, F_.tambahan],
      struktur: [
        'A. Informasi Umum: identitas (penyusun, satuan pendidikan, fase/kelas, mapel, alokasi), kompetensi awal, dimensi Profil Lulusan yang disasar, sarana-prasarana, target peserta didik, model pembelajaran.',
        'B. Komponen Inti: Capaian Pembelajaran, Tujuan Pembelajaran (ABCD), pemahaman bermakna, pertanyaan pemantik, praktik pedagogis, kemitraan pembelajaran, lingkungan & pemanfaatan digital.',
        'C. Langkah pembelajaran PER PERTEMUAN dalam tabel (Tahap | Kegiatan Guru | Kegiatan Siswa | Waktu) dengan tahapan Pembelajaran Mendalam: Memahami → Mengaplikasi → Merefleksi, beri label prinsip berkesadaran/bermakna/menggembirakan.',
        'D. Asesmen: diagnostik (awal), formatif (proses), sumatif (akhir) beserta instrumen & rubrik singkat (tabel).',
        'E. Diferensiasi: pengayaan & remedial.',
        'F. Lampiran: LKPD ringkas, bahan bacaan guru & siswa, glosarium, daftar pustaka.',
      ],
    },
    {
      id: 'rpp_1lembar', nama: 'RPP 1 Lembar', kategori: 'Perencanaan', ikon: '📝',
      deskripsi: 'Rencana pembelajaran ringkas yang efisien: tujuan, langkah, asesmen — muat dalam 1 halaman.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.tp, F_.alokasi, F_.model, F_.bahasa, F_.tambahan],
      struktur: ['Identitas singkat', 'Tujuan Pembelajaran (maks. 3)', 'Langkah: Pendahuluan, Inti, Penutup (poin-poin padat dengan alokasi menit)', 'Asesmen (teknik & instrumen)', 'Media/sumber belajar', 'Total panjang ±1 halaman A4.'],
    },
    {
      id: 'atp', nama: 'Alur Tujuan Pembelajaran (ATP)', kategori: 'Perencanaan', ikon: '🧭',
      deskripsi: 'Turunkan CP menjadi TP yang berurutan beserta alokasi JP & lingkup materi.',
      fields: [F_.mapel, F_.fase, F_.cp, F_.jpm, F_.semester, F_.tambahan],
      struktur: ['Ringkasan elemen CP', 'Tabel ATP: No | Elemen | Tujuan Pembelajaran | Lingkup Materi | Alokasi JP | Dimensi Profil Lulusan | Semester', 'Kode TP (mis. TP 10.1) agar bisa dirujuk modul ajar', 'Catatan urutan logis (prasyarat antar-TP).'],
    },
    {
      id: 'analisis_cp', nama: 'Analisis CP → TP', kategori: 'Perencanaan', ikon: '🔍',
      deskripsi: 'Bedah kalimat CP menjadi kompetensi, konten, dan rumusan TP.',
      fields: [F_.mapel, F_.fase, F_.cp, F_.tambahan],
      struktur: ['Tabel: Elemen | Kalimat CP | Kompetensi (kata kerja) | Konten/Materi | Rumusan TP', 'Gunakan kata kerja operasional dan level kognitif yang sesuai.'],
    },
    {
      id: 'kktp', nama: 'KKTP (Kriteria Ketercapaian TP)', kategori: 'Perencanaan', ikon: '🎯',
      deskripsi: 'Kriteria/indikator ketercapaian TP lengkap dengan interval nilai & tindak lanjut.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.tp, F_.tambahan],
      struktur: ['Pilih pendekatan (deskripsi kriteria / rubrik / interval nilai) dan jelaskan alasannya', 'Tabel kriteria per TP', 'Interval nilai & tindak lanjut (remedial/pengayaan).'],
    },
    {
      id: 'prota', nama: 'Program Tahunan (Prota)', kategori: 'Perencanaan', ikon: '📅',
      deskripsi: 'Distribusi TP/materi dan JP selama satu tahun ajaran.',
      fields: [F_.mapel, F_.fase, F_.cp, F_.jpm, F_.tambahan],
      struktur: ['Asumsi minggu efektif per semester (jelaskan)', 'Tabel Prota: Semester | TP/Materi | Alokasi JP | Keterangan', 'Total JP per semester & tahun.'],
    },
    {
      id: 'promes', nama: 'Program Semester (Promes)', kategori: 'Perencanaan', ikon: '🗓️',
      deskripsi: 'Sebaran materi per bulan & minggu dalam satu semester.',
      fields: [F_.mapel, F_.fase, F_.semester, F_.cp, F_.jpm, F_.tambahan],
      struktur: ['Tabel Promes: TP/Materi | JP | kolom bulan (Juli–Desember atau Januari–Juni) dengan minggu 1–4/5 bertanda ✓', 'Sertakan minggu asesmen (STS/SAS/SAT) dan cadangan.'],
    },
    // ---------------- BAHAN & AKTIVITAS ----------------
    {
      id: 'lkpd', nama: 'LKPD (Lembar Kerja Peserta Didik)', kategori: 'Bahan & Aktivitas', ikon: '🧩',
      deskripsi: 'Lembar kerja siap cetak: petunjuk, aktivitas bertahap, pertanyaan refleksi.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.tp, F_.alokasi, { key: 'bentuk', label: 'Bentuk aktivitas', type: 'select', options: ['Individu', 'Berpasangan', 'Kelompok'] }, F_.bahasa, F_.tambahan],
      struktur: ['Judul, identitas (nama/kelas/kelompok), tujuan', 'Petunjuk kerja', 'Aktivitas 1..n bertahap (dari mudah ke menantang) dengan ruang jawaban', 'Pertanyaan refleksi', 'Kunci/rambu jawaban untuk guru di bagian paling akhir dengan judul "Untuk Guru".'],
    },
    {
      id: 'bahan_ajar', nama: 'Bahan Ajar / Ringkasan Materi', kategori: 'Bahan & Aktivitas', ikon: '📚',
      deskripsi: 'Materi bacaan siswa yang runtut, dengan contoh, ilustrasi teks, dan latihan.',
      fields: [F_.mapel, F_.fase, F_.topik, { key: 'kedalaman', label: 'Kedalaman', type: 'select', options: ['Ringkas (1–2 halaman)', 'Sedang (3–5 halaman)', 'Mendalam'] }, F_.bahasa, F_.tambahan],
      struktur: ['Peta konsep (daftar berjenjang)', 'Uraian materi dengan subjudul, contoh kontekstual Indonesia', 'Kotak "Tahukah kamu?"', 'Rangkuman', 'Latihan singkat + kunci.'],
    },
    {
      id: 'slide', nama: 'Outline Slide Presentasi', kategori: 'Bahan & Aktivitas', ikon: '🖥️',
      deskripsi: 'Kerangka slide per halaman + catatan pembicara + saran visual.',
      fields: [F_.mapel, F_.fase, F_.topik, { key: 'jumlahSlide', label: 'Jumlah slide', type: 'number', value: '12' }, F_.bahasa, F_.tambahan],
      struktur: ['Untuk setiap slide: "## Slide n — Judul", poin isi (maks 5), saran visual/gambar, catatan pembicara.', 'Sertakan slide pembuka pemantik dan slide kuis interaktif.'],
    },
    {
      id: 'ice_breaking', nama: 'Ice Breaking & Pemantik', kategori: 'Bahan & Aktivitas', ikon: '🎲',
      deskripsi: 'Ide kegiatan pembuka yang relevan dengan topik dan menggembirakan.',
      fields: [F_.mapel, F_.fase, F_.topik, { key: 'durasi', label: 'Durasi', type: 'text', value: '5–10 menit' }, F_.tambahan],
      struktur: ['5 ide kegiatan; tiap ide: nama, tujuan, alat, langkah, kaitan ke materi, variasi untuk kelas besar.'],
    },
    {
      id: 'proyek', nama: 'Rancangan Proyek (PjBL)', kategori: 'Bahan & Aktivitas', ikon: '🛠️',
      deskripsi: 'Proyek berbasis masalah nyata lengkap dengan timeline, produk, dan rubrik.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.pertemuan, F_.karakteristik, F_.tambahan],
      struktur: ['Pertanyaan pemantik/driving question', 'Deskripsi produk & kriteria sukses', 'Timeline per pertemuan (tabel)', 'Pembagian peran kelompok', 'Rubrik penilaian proyek (tabel 4 level)', 'Rencana pameran/presentasi.'],
    },
    // ---------------- ASESMEN ----------------
    {
      id: 'soal', nama: 'Bank Soal + Kunci', kategori: 'Asesmen', ikon: '❓',
      deskripsi: 'Soal PG, PG kompleks, menjodohkan, isian, dan uraian lengkap dengan kunci & pembahasan.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.tp,
        { key: 'jumlahPG', label: 'Jumlah PG', type: 'number', value: '10' },
        { key: 'jumlahPGK', label: 'Jumlah PG Kompleks', type: 'number', value: '0' },
        { key: 'jumlahIsian', label: 'Jumlah Isian singkat', type: 'number', value: '0' },
        { key: 'jumlahUraian', label: 'Jumlah Uraian', type: 'number', value: '3' },
        { key: 'level', label: 'Sebaran level kognitif', type: 'select', options: ['Seimbang (LOTS–MOTS–HOTS)', 'Dominan HOTS', 'Dasar (LOTS)'] },
        F_.bahasa, F_.tambahan],
      struktur: ['Bagian Soal (siap dibagikan ke siswa, tanpa kunci), berstimulus kontekstual bila sesuai.', 'Bagian "Kunci Jawaban & Pembahasan" terpisah di akhir.', 'Tabel pedoman penskoran uraian.', 'Setiap soal diberi label level kognitif (L1/L2/L3) di bagian kunci.'],
    },
    {
      id: 'kisi', nama: 'Kisi-kisi Soal', kategori: 'Asesmen', ikon: '🗂️',
      deskripsi: 'Kisi-kisi asesmen sumatif (STS/SAS/SAT) yang terpetakan ke TP.',
      fields: [F_.mapel, F_.fase, { key: 'jenisAsesmen', label: 'Jenis asesmen', type: 'select', options: ['STS', 'SAS', 'SAT', 'Ulangan Harian'] }, { key: 'cakupan', label: 'Cakupan materi / TP', type: 'textarea', required: true }, { key: 'jumlah', label: 'Jumlah & bentuk soal', type: 'text', value: '30 PG, 5 uraian' }, F_.tambahan],
      struktur: ['Tabel: No | TP | Materi | Indikator soal | Level kognitif | Bentuk soal | No. soal', 'Rekap proporsi level kognitif.'],
    },
    {
      id: 'rubrik', nama: 'Rubrik Penilaian', kategori: 'Asesmen', ikon: '📏',
      deskripsi: 'Rubrik analitik untuk tugas, praktik, presentasi, atau penampilan musik.',
      fields: [F_.mapel, F_.fase, { key: 'tugas', label: 'Tugas / kinerja yang dinilai', type: 'text', required: true, placeholder: 'mis. Membuat program kalkulator sederhana dengan Python' }, { key: 'level', label: 'Jumlah level', type: 'select', options: ['4 level', '3 level', '5 level'] }, F_.bahasa, F_.tambahan],
      struktur: ['Tabel rubrik: Aspek | bobot | deskriptor per level (konkret & teramati)', 'Rumus konversi skor ke nilai 0–100', 'Format umpan balik singkat.'],
    },
    {
      id: 'diagnostik', nama: 'Asesmen Diagnostik', kategori: 'Asesmen', ikon: '🩺',
      deskripsi: 'Diagnostik kognitif & non-kognitif (gaya belajar, minat, kesiapan) + tindak lanjut.',
      fields: [F_.mapel, F_.fase, F_.topik, F_.tambahan],
      struktur: ['Diagnostik non-kognitif (angket 8–10 butir)', 'Diagnostik kognitif (8–10 soal prasyarat + kunci)', 'Tabel interpretasi hasil & pengelompokan (belum paham / sebagian / paham)', 'Rencana tindak lanjut per kelompok.'],
    },
    // ---------------- EKSKUL BAND ----------------
    {
      id: 'proker_band', nama: 'Program Kerja Ekskul Band', kategori: 'Ekskul Band', ikon: '🎸',
      deskripsi: 'Program kerja setahun: visi, target, jadwal latihan, event, anggaran.',
      fields: [{ key: 'anggota', label: 'Jumlah & komposisi anggota', type: 'text', placeholder: 'mis. 15 siswa: 3 vokal, 3 gitar, 2 bass, 3 drum, 4 keyboard' }, { key: 'fasilitas', label: 'Fasilitas yang tersedia', type: 'textarea' }, { key: 'event', label: 'Target event / lomba', type: 'textarea' }, F_.tambahan],
      struktur: ['Latar belakang, visi, misi, tujuan', 'Struktur organisasi', 'Kalender kegiatan per bulan (tabel)', 'Target kompetensi per instrumen (pemula/menengah)', 'Rencana anggaran sederhana (tabel)', 'Indikator keberhasilan & evaluasi.'],
    },
    {
      id: 'latihan_band', nama: 'Rencana Sesi Latihan Band', kategori: 'Ekskul Band', ikon: '🥁',
      deskripsi: 'Rencana latihan per sesi: pemanasan, teknik, aransemen lagu, evaluasi.',
      fields: [{ key: 'lagu', label: 'Lagu / repertoar', type: 'text', required: true }, { key: 'durasi', label: 'Durasi sesi', type: 'text', value: '120 menit' }, { key: 'level', label: 'Level band', type: 'select', options: ['Pemula', 'Menengah', 'Mahir'] }, { key: 'anggota', label: 'Formasi', type: 'text', placeholder: 'mis. vokal, 2 gitar, bass, drum, keyboard' }, F_.tambahan],
      struktur: ['Tujuan sesi', 'Timeline latihan (tabel Waktu | Kegiatan | Fokus per instrumen)', 'Analisis lagu: struktur (intro–verse–chorus–bridge), kunci & progresi akor, tempo BPM', 'Pembagian peran/aransemen per instrumen', 'Latihan teknik pemanasan per instrumen', 'Checklist evaluasi penampilan.'],
    },
    {
      id: 'materi_musik', nama: 'Materi Teori / Teknik Musik', kategori: 'Ekskul Band', ikon: '🎹',
      deskripsi: 'Materi singkat teori musik atau teknik instrumen beserta latihannya.',
      fields: [{ key: 'topik', label: 'Topik', type: 'text', required: true, placeholder: 'mis. Membaca chord & progresi I–V–vi–IV' }, { key: 'instrumen', label: 'Instrumen', type: 'select', options: ['Semua', 'Vokal', 'Gitar', 'Bass', 'Drum', 'Keyboard/Piano'] }, { key: 'level', label: 'Level', type: 'select', options: ['Pemula', 'Menengah', 'Mahir'] }, F_.tambahan],
      struktur: ['Penjelasan konsep sederhana', 'Contoh (notasi teks/chord chart/tab bila relevan)', 'Latihan bertahap', 'Tantangan & tips praktik di rumah.'],
    },
    // ---------------- ADMINISTRASI & KOMUNIKASI ----------------
    {
      id: 'surat_ortu', nama: 'Pesan / Surat untuk Orang Tua', kategori: 'Administrasi', ikon: '✉️',
      deskripsi: 'Pesan WhatsApp/surat resmi yang sopan: pemberitahuan, panggilan, apresiasi.',
      fields: [{ key: 'tujuan', label: 'Tujuan pesan', type: 'select', options: ['Pemberitahuan kegiatan', 'Ketidakhadiran siswa', 'Apresiasi prestasi', 'Undangan pertemuan', 'Perkembangan belajar'] }, { key: 'detail', label: 'Detail (nama siswa, tanggal, dsb.)', type: 'textarea', required: true }, { key: 'format', label: 'Format', type: 'select', options: ['Pesan WhatsApp', 'Surat resmi'] }],
      struktur: ['Bahasa sopan, hangat, jelas, tidak menghakimi', 'Untuk WhatsApp: ringkas, ada salam pembuka & penutup', 'Untuk surat: format surat dinas sekolah (kop, nomor, perihal, isi, tanda tangan).'],
    },
    {
      id: 'refleksi', nama: 'Refleksi Guru & Tindak Lanjut', kategori: 'Administrasi', ikon: '🪞',
      deskripsi: 'Refleksi pembelajaran terstruktur dari catatan jurnal Anda.',
      fields: [F_.mapel, { key: 'catatan', label: 'Catatan kejadian di kelas', type: 'textarea', required: true }, F_.tambahan],
      struktur: ['Apa yang berjalan baik', 'Tantangan & kemungkinan penyebab', 'Pertanyaan refleksi', 'Rencana perbaikan konkret untuk pertemuan berikutnya.'],
    },
    {
      id: 'bebas', nama: 'Prompt Bebas', kategori: 'Administrasi', ikon: '✨',
      deskripsi: 'Tulis permintaan Anda sendiri — AI tetap memakai profil sekolah & kurikulum Anda.',
      fields: [{ key: 'judul', label: 'Judul dokumen', type: 'text', required: true }, { key: 'permintaan', label: 'Permintaan', type: 'textarea', required: true, rows: 8 }],
      struktur: [],
    },
  ];
}

/** Versi ringan katalog untuk browser. */
function aiCatalog_() {
  return aiTemplates_().map(function (t) {
    return { id: t.id, nama: t.nama, kategori: t.kategori, ikon: t.ikon, deskripsi: t.deskripsi, fields: t.fields };
  });
}
