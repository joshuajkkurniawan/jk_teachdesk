/**
 * Config.gs — konstanta aplikasi & skema database (Google Sheets).
 *
 * Setiap key di SCHEMA = satu sheet (tab). Array-nya = header kolom.
 * Mau menambah kolom? Tambahkan di AKHIR array — kolom baru otomatis
 * dibuat saat aplikasi dibuka berikutnya (lihat ensureHeaders_ di Db.gs).
 */
const APP_NAME = 'JK TeachDesk';
const APP_VERSION = '1.0.0';

const SCHEMA = {
  Siswa: ['id', 'nis', 'nisn', 'nama', 'jk', 'kelas', 'tglLahir', 'namaOrtu', 'hpOrtu', 'catatan', 'aktif', 'dibuat'],
  // tipe: 'Mapel' | 'Ekskul'. Jika `kelas` diisi, anggota = semua siswa aktif di kelas tsb.
  // Jika kosong (mis. Ekskul Band), anggota diatur manual lewat sheet Anggota.
  Rombel: ['id', 'nama', 'mapel', 'tipe', 'kelas', 'tahunAjaran', 'semester', 'kktp', 'jadwal', 'catatan', 'dibuat',
    'siguruKelas', 'siguruMapel'],   // diisi bila rombel ditarik dari SiGuru (teks kelas & mapel persis seperti di SiGuru)
  Anggota: ['id', 'rombelId', 'siswaId'],
  Asesmen: ['id', 'rombelId', 'judul', 'jenis', 'tanggal', 'bobot', 'maks', 'tp', 'catatan', 'dibuat'],
  Nilai: ['id', 'asesmenId', 'siswaId', 'nilai', 'catatan', 'diubah'],
  // Pertemuan = jurnal mengajar; Presensi = status tiap siswa di pertemuan tsb.
  Pertemuan: ['id', 'rombelId', 'tanggal', 'pertemuanKe', 'materi', 'catatan', 'dibuat',
    'jamKe', 'refBaik', 'refBelum', 'refTantangan', 'siguruSync'],
  // Salinan jadwal mengajar dari SiGuru (ditimpa setiap kali "Tarik dari SiGuru").
  JadwalSiGuru: ['id', 'rombelId', 'hari', 'jamKe', 'kelas', 'mapel'],
  Presensi: ['id', 'pertemuanId', 'siswaId', 'status', 'keterangan'],
  Dokumen: ['id', 'jenis', 'judul', 'mapel', 'kelas', 'input', 'cuplikan', 'docUrl', 'dibuat', 'diubah'],
  // Isi dokumen AI dipotong per 40.000 karakter (batas 1 sel Sheets = 50.000).
  DokumenIsi: ['id', 'dokumenId', 'urut', 'isi'],
  Pengaturan: ['kunci', 'nilai'],
};

const JENIS_ASESMEN = ['Tugas', 'Kuis', 'Ulangan Harian', 'Praktik', 'Proyek', 'Portofolio', 'STS', 'SAS', 'SAT', 'Lainnya'];

const STATUS_PRESENSI = {
  H: 'Hadir',
  T: 'Terlambat',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alpa',
};

const DEFAULT_SETTINGS = {
  namaGuru: 'Joshua Kurniawan, S.Pd.',
  nip: '200107262025051003',
  sekolah: '',
  kota: '',
  kepalaSekolah: '',
  nipKepsek: '',
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  mapelList: 'Informatika, Bahasa Inggris, Ekskul Band',
  kurikulum: 'Kurikulum Merdeka dengan pendekatan Pembelajaran Mendalam (mindful, meaningful, joyful learning) dan 8 dimensi Profil Lulusan',
  kktpDefault: '75',
  aiProvider: 'gemini',          // 'gemini' | 'claude'
  geminiModel: 'gemini-3.5-flash',
  aiModel: 'claude-opus-5-5',    // model Claude
  aiEffort: 'medium',
  // Integrasi SiGuru (Jurnal Mengajar / Piket MAN 15) — ID diambil dari Code.gs SiGuru.
  siguruAktif: 'true',
  siguruSpreadsheetId: '1eJSZvX7ebwnIAzAeya0JUd2t4LFU70RQf9b1GJk1da8',
  siguruSiswaId: '1y0XvwjgJCqcdK9lt709vHsIQyGoOEq7zcUZDwQ_ldcg',
  siguruNip: '200107262025051003',
};

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
