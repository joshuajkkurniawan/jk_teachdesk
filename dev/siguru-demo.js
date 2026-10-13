/**
 * dev/siguru-demo.js — tiruan spreadsheet SiGuru untuk dev server lokal.
 * Struktur sheet & kolom sama persis dengan initDatabase() di Code.gs SiGuru.
 * Hanya dibuat jika belum ada di dev/.data.json (hapus file itu untuk reset).
 */
const SIGURU_ID = '1eJSZvX7ebwnIAzAeya0JUd2t4LFU70RQf9b1GJk1da8';
const SISWA_ID = '1y0XvwjgJCqcdK9lt709vHsIQyGoOEq7zcUZDwQ_ldcg';
const NIP = '200107262025051003';

function tglKemarin() {
  const d = new Date(Date.now() + 7 * 3600e3 - 86400e3);
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
}

exports.seed = function (store, newSheet) {
  if (store.books[SIGURU_ID]) return;
  const put = (book, name, rows) => { newSheet(book, name); store.books[book].sheets[name] = rows; };
  const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(Date.now() + 7 * 3600e3).getUTCDay()];

  put(SIGURU_ID, 'Data Guru', [
    ['NIP', 'Nama Lengkap', 'Username', 'Password', 'Mata Pelajaran Utama', 'Hari Piket'],
    ['000', 'Waka Kurikulum', 'admin', 'admin', 'Manajemen', 'Waka'],
    [NIP, 'Joshua Kurniawan, S.Pd.', 'joshua', 'rahasia', 'Informatika', 'Rabu'],
    ['199309152025051004', 'Guru Lain, S.Pd.', 'gurulain', 'x', 'Matematika', 'Senin'],
  ]);
  put(SIGURU_ID, 'Master Mapel', [['Nama Mata Pelajaran (Otomatis & Manual)'], ['Informatika'], ['Bahasa Inggris'], ['Matematika Wajib']]);
  put(SIGURU_ID, 'Jadwal Mengajar', [
    ['NIP', 'Hari', 'Kelas', 'Jam Ke', 'Mata Pelajaran'],
    [NIP, 'Senin', 'X-1', '1-2', 'Informatika'],
    [NIP, 'Rabu', 'X-1', '3-4', 'Informatika'],
    [NIP, hariIni, 'X-2', '1-2', 'Informatika'],
    [NIP, hariIni, 'XI-1', '5-6', 'Bahasa Inggris'],
    [NIP, 'Kamis', 'XI-1', '1-2', 'Bahasa Inggris'],
    ['199309152025051004', 'Senin', 'X-1', '3-4', 'Matematika Wajib'],
  ]);
  put(SIGURU_ID, 'Log Mengajar', [
    ['Waktu Submit', 'Tanggal', 'NIP', 'Nama Guru', 'Kelas', 'Jam Ke', 'Mapel', 'Materi Diajarkan', 'Siswa Izin/Alpa', 'Siswa Sakit',
      'Refleksi: Sudah Baik', 'Refleksi: Belum Baik', 'Refleksi: Menantang', 'Foto Eviden (URL)'],
    ['07:45', tglKemarin(), NIP, 'Joshua Kurniawan, S.Pd.', 'X-1', '1-2', 'Informatika', 'Pengenalan algoritma',
      'Siti Aminah (Alpa), Bayu (Izin)', 'Rudi Hartono', 'Siswa antusias', 'Waktu kurang', 'Lab sempat mati listrik', 'https://drive.google.com/uc?id=demo'],
    ['08:00', tglKemarin(), '199309152025051004', 'Guru Lain, S.Pd.', 'X-1', '3-4', 'Matematika Wajib', 'Fungsi', 'Nihil', 'Nihil', 'ok', 'ok', '', ''],
  ]);
  put(SIGURU_ID, 'Log Piket', [['Waktu Submit', 'Tanggal', 'Nama Pelapor', 'Guru Terlambat', 'Guru Tidak Hadir', 'Guru Pengganti/Inval', 'Rekap Siswa Tdk Hadir & Terlambat', 'Kejadian Penting & Tindak Lanjut']]);
  put(SIGURU_ID, 'Dispensasi', [['Tanggal', 'Keterangan', 'Jenis', 'Dibuat Oleh', 'Waktu Input'], ['25/12/2026', 'Hari Raya Natal', 'Libur Nasional', 'Sistem', '']]);

  put(SISWA_ID, 'DATA_SISWA', [
    ['NO', 'NISN', 'NAMA SISWA', 'L/P', 'KELAS'],
    ['1', '0081111111', 'Andi Pratama', 'L', 'X-1'],
    ['2', '0081111112', 'Siti Aminah', 'P', 'X-1'],
    ['3', '0081111113', 'Rudi Hartono', 'L', 'X-1'],
    ['4', '0081111114', 'Bayu', 'L', 'X-1'],
    ['5', '0082222221', 'Citra Lestari', 'P', 'X-2'],
    ['6', '0082222222', 'Dimas Saputra', 'L', 'X-2'],
    ['7', '0083333331', 'Eka Putri', 'P', 'XI-1'],
    ['8', '0083333332', 'Fajar Nugroho', 'L', 'XI-1'],
    ['9', '0084444441', 'Siswa Kelas Lain', 'P', 'XII-3'],
  ]);
};
