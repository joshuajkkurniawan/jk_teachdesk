/**
 * SiGuru.gs — jembatan ke aplikasi Jurnal Mengajar SiGuru (Piket Mengajar MAN 15).
 *
 * TeachDesk TIDAK mengubah kode SiGuru. TeachDesk membuka spreadsheet SiGuru
 * langsung (keduanya milik akun yang sama) dan memakai format yang persis sama
 * dengan simpanLaporanAjar() di SiGuru, sehingga jurnal dari TeachDesk dianggap
 * "Sudah Lapor" oleh SiGuru.
 *
 * Sheet SiGuru yang dipakai:
 *   Data Guru        : NIP | Nama | Username | Password | Mapel | Hari Piket   (hanya dibaca: kolom NIP & Nama)
 *   Jadwal Mengajar  : NIP | Hari | Kelas | Jam Ke | Mapel                      (dibaca)
 *   Log Mengajar     : Waktu | Tanggal | NIP | Nama | Kelas | Jam Ke | Mapel | Materi |
 *                      Izin/Alpa | Sakit | Ref. Baik | Ref. Belum | Ref. Menantang | Foto   (dibaca & ditulis)
 *   Dispensasi       : Tanggal | Keterangan | ...                               (dibaca)
 *   DATA_SISWA (spreadsheet siswa): NAMA SISWA | NISN | KELAS/ROMBEL ...         (dibaca)
 */

const SG_LOG_COLS = 14;

function sgCfg_() {
  const s = settingsGet_();
  if (s.siguruAktif === 'false') throw new Error('Integrasi SiGuru dimatikan di Pengaturan.');
  if (!s.siguruSpreadsheetId || !s.siguruNip) throw new Error('ID spreadsheet & NIP SiGuru belum diisi di Pengaturan.');
  return s;
}

function sgBook_(id) {
  try { return SpreadsheetApp.openById(id); } catch (e) {
    throw new Error('Tidak bisa membuka spreadsheet SiGuru (' + id + '). Pastikan ID benar dan akun ini punya akses. Detail: ' + e.message);
  }
}

function sgSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan di spreadsheet SiGuru. Buka aplikasi SiGuru sekali agar sheet dibuat.');
  return sh;
}

function sgRows_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getDisplayValues().slice(1);
}

const sgTrim_ = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };
const sgKey_ = function (kelas, mapel) { return sgTrim_(kelas).toUpperCase() + '|' + sgTrim_(mapel).toLowerCase(); };

/** yyyy-MM-dd → dd/MM/yyyy (format tanggal SiGuru) */
function sgTanggal_(iso) {
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
/** dd/MM/yyyy → yyyy-MM-dd */
function sgIso_(tgl) {
  const p = String(tgl).trim().split('/');
  return p.length === 3 ? p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2) : '';
}
function sgHari_(iso) {
  const p = String(iso).split('-').map(Number);
  return HARI_ID[new Date(p[0], p[1] - 1, p[2]).getDay()];
}
function sgToday_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

/** Data guru & jadwal milik NIP di SiGuru. */
function sgGuruJadwal_(ss, nip) {
  let nama = '', mapelUtama = '';
  sgRows_(sgSheet_(ss, 'Data Guru')).forEach(function (r) {
    if (sgTrim_(r[0]) === nip) { nama = sgTrim_(r[1]); mapelUtama = sgTrim_(r[4]); }
  });
  const jadwal = sgRows_(sgSheet_(ss, 'Jadwal Mengajar'))
    .filter(function (r) { return sgTrim_(r[0]) === nip; })
    .map(function (r) { return { hari: sgTrim_(r[1]), kelas: sgTrim_(r[2]), jamKe: sgTrim_(r[3]), mapel: sgTrim_(r[4]) }; });
  return { nama: nama, mapelUtama: mapelUtama, jadwal: jadwal };
}

// ============================================================ CEK KONEKSI

function siguruStatus_() {
  const s = sgCfg_();
  const ss = sgBook_(s.siguruSpreadsheetId);
  const g = sgGuruJadwal_(ss, s.siguruNip);
  if (!g.nama) throw new Error('NIP ' + s.siguruNip + ' tidak ditemukan di sheet "Data Guru" SiGuru.');
  let siswa = null;
  if (s.siguruSiswaId) {
    try {
      const sh = sgBook_(s.siguruSiswaId).getSheetByName('DATA_SISWA');
      siswa = sh ? Math.max(sh.getLastRow() - 1, 0) : 'sheet DATA_SISWA tidak ada';
    } catch (e) { siswa = 'tidak bisa dibuka'; }
  }
  const kelas = {};
  g.jadwal.forEach(function (j) { kelas[sgKey_(j.kelas, j.mapel)] = j.kelas + ' · ' + j.mapel; });
  return {
    nama: g.nama, mapelUtama: g.mapelUtama, jumlahJadwal: g.jadwal.length,
    kelas: Object.keys(kelas).map(function (k) { return kelas[k]; }).sort(),
    siswaSiGuru: siswa, url: ss.getUrl(),
  };
}

// ============================================================ TARIK KELAS, JADWAL & SISWA

/**
 * Membuat/memperbarui Rombel untuk setiap pasangan (kelas, mapel) di jadwal SiGuru,
 * menyalin jadwal (hari + jam ke), dan mengimpor siswa kelas-kelas tsb dari DATA_SISWA.
 */
function siguruTarik_() {
  const s = sgCfg_();
  const ss = sgBook_(s.siguruSpreadsheetId);
  const g = sgGuruJadwal_(ss, s.siguruNip);
  if (!g.jadwal.length) throw new Error('Tidak ada jadwal untuk NIP ' + s.siguruNip + ' di sheet "Jadwal Mengajar" SiGuru.');

  // 1) Rombel per (kelas, mapel)
  const urutHari = function (h) { const i = HARI_ID.indexOf(h); return i === -1 ? 9 : i; };
  const grup = {};
  g.jadwal.forEach(function (j) { (grup[sgKey_(j.kelas, j.mapel)] = grup[sgKey_(j.kelas, j.mapel)] || []).push(j); });
  const ada = {};
  dbAll_('Rombel').forEach(function (r) { if (r.siguruKelas) ada[sgKey_(r.siguruKelas, r.siguruMapel)] = r; });

  let rombelBaru = 0, rombelUpdate = 0;
  const rombelByKey = {};
  Object.keys(grup).forEach(function (k) {
    const slots = grup[k].sort(function (a, b) { return urutHari(a.hari) - urutHari(b.hari) || a.jamKe.localeCompare(b.jamKe); });
    const teksJadwal = slots.map(function (j) { return j.hari + ' jam ' + j.jamKe; }).join(' · ');
    const first = slots[0];
    if (ada[k]) {
      rombelByKey[k] = dbUpdate_('Rombel', ada[k].id, { jadwal: teksJadwal, siguruKelas: first.kelas, siguruMapel: first.mapel });
      rombelUpdate++;
    } else {
      rombelByKey[k] = dbInsert_('Rombel', {
        nama: first.kelas + ' ' + first.mapel, mapel: first.mapel, tipe: 'Mapel', kelas: first.kelas.toUpperCase(),
        tahunAjaran: s.tahunAjaran, semester: s.semester, kktp: '', jadwal: teksJadwal, catatan: 'Ditarik dari SiGuru',
        dibuat: now_(), siguruKelas: first.kelas, siguruMapel: first.mapel,
      });
      rombelBaru++;
    }
  });

  // 2) Salinan jadwal lokal (untuk "Jadwal hari ini" & pilihan jam ke di form presensi)
  dbDeleteWhere_('JadwalSiGuru', function () { return true; });
  dbInsertMany_('JadwalSiGuru', g.jadwal.map(function (j) {
    return { rombelId: rombelByKey[sgKey_(j.kelas, j.mapel)].id, hari: j.hari, jamKe: j.jamKe, kelas: j.kelas, mapel: j.mapel };
  }));

  // 3) Siswa dari DATA_SISWA untuk kelas yang diajar
  const hasilSiswa = s.siguruSiswaId ? sgTarikSiswa_(s.siguruSiswaId, g.jadwal) : { baru: 0, update: 0, catatan: 'ID spreadsheet siswa kosong' };

  // 4) Profil guru
  const patch = {};
  if (g.nama) patch.namaGuru = g.nama;
  patch.nip = s.siguruNip;
  const mapel = {};
  mapelOptionsFrom_(s.mapelList).concat(g.jadwal.map(function (j) { return j.mapel; })).forEach(function (m) { mapel[m] = true; });
  patch.mapelList = Object.keys(mapel).join(', ');
  settingsSave_(patch);

  return { rombelBaru: rombelBaru, rombelUpdate: rombelUpdate, jadwal: g.jadwal.length, siswa: hasilSiswa, nama: g.nama };
}

function mapelOptionsFrom_(list) {
  return String(list || '').split(',').map(function (x) { return x.trim(); }).filter(String);
}

function sgTarikSiswa_(siswaSsId, jadwal) {
  const sh = sgBook_(siswaSsId).getSheetByName('DATA_SISWA');
  if (!sh) return { baru: 0, update: 0, catatan: 'sheet DATA_SISWA tidak ditemukan' };
  const raw = sh.getDataRange().getDisplayValues();
  if (raw.length < 2) return { baru: 0, update: 0 };
  // Header dibaca dengan aturan yang sama seperti SiGuru (prosesLogin).
  const h = raw[0].map(function (x) { return sgTrim_(x).toUpperCase(); });
  const iNama = h.indexOf('NAMA SISWA'), iNisn = h.indexOf('NISN');
  const iKelas = h.findIndex(function (x) { return x.indexOf('KELAS') !== -1 || x.indexOf('ROMBEL') !== -1; });
  const iNis = h.findIndex(function (x) { return x === 'NIS' || x === 'NO INDUK' || x === 'NOMOR INDUK'; });
  const iJk = h.findIndex(function (x) { return x === 'JK' || x === 'L/P' || x.indexOf('KELAMIN') !== -1; });
  if (iNama === -1 || iKelas === -1) return { baru: 0, update: 0, catatan: 'kolom NAMA SISWA / KELAS tidak ditemukan' };

  const kelasDiajar = {};
  jadwal.forEach(function (j) { kelasDiajar[sgTrim_(j.kelas).toUpperCase()] = true; });

  const lokal = dbAll_('Siswa');
  const byNisn = {}, byNamaKelas = {};
  lokal.forEach(function (x) {
    if (x.nisn) byNisn[x.nisn] = x;
    byNamaKelas[x.nama.toUpperCase() + '|' + x.kelas] = x;
  });
  let baru = 0, update = 0;
  const upserts = [];
  raw.slice(1).forEach(function (r) {
    const nama = sgTrim_(r[iNama]), kelas = sgTrim_(r[iKelas]).toUpperCase();
    if (!nama || !kelasDiajar[kelas]) return;
    const nisn = iNisn !== -1 ? sgTrim_(r[iNisn]) : '';
    const jkRaw = iJk !== -1 ? sgTrim_(r[iJk]).toUpperCase() : '';
    const o = { nama: nama, kelas: kelas, nisn: nisn, aktif: 'true' };
    if (iNis !== -1) o.nis = sgTrim_(r[iNis]);
    if (jkRaw) o.jk = jkRaw.charAt(0) === 'P' ? 'P' : 'L';
    const ex = (nisn && byNisn[nisn]) || byNamaKelas[nama.toUpperCase() + '|' + kelas];
    if (ex) { o.id = ex.id; update++; } else { o.dibuat = now_(); baru++; }
    upserts.push(o);
  });
  dbUpsertMany_('Siswa', upserts);
  return { baru: baru, update: update };
}

// ============================================================ JADWAL HARI INI

/** Jadwal SiGuru hari ini + status jurnal di SiGuru & TeachDesk. */
function siguruHariIni_(p) {
  const s = settingsGet_();
  const iso = (p && p.tanggal) || sgToday_();
  const hari = sgHari_(iso);
  const slots = dbWhere_('JadwalSiGuru', function (j) { return j.hari.toLowerCase() === hari.toLowerCase(); })
    .sort(function (a, b) { return a.jamKe.localeCompare(b.jamKe, 'id', { numeric: true }); });
  if (!slots.length) return { hari: hari, tanggal: iso, slots: [], tersambung: s.siguruAktif !== 'false' };

  const pertemuan = dbWhere_('Pertemuan', function (x) { return x.tanggal === iso; });
  let logSiGuru = [], dispensasi = null, error = '';
  try {
    const cfg = sgCfg_();
    const ss = sgBook_(cfg.siguruSpreadsheetId);
    const tgl = sgTanggal_(iso);
    logSiGuru = sgRows_(sgSheet_(ss, 'Log Mengajar'))
      .filter(function (r) { return sgTrim_(r[1]) === tgl && sgTrim_(r[2]) === cfg.siguruNip; })
      .map(function (r) { return { kelas: sgTrim_(r[4]), jamKe: sgTrim_(r[5]) }; });
    const dsp = ss.getSheetByName('Dispensasi');
    if (dsp) sgRows_(dsp).forEach(function (r) { if (sgTrim_(r[0]) === tgl) dispensasi = sgTrim_(r[1]); });
  } catch (e) { error = e.message; }

  return {
    hari: hari, tanggal: iso, dispensasi: dispensasi, error: error, tersambung: !error,
    slots: slots.map(function (j) {
      const pt = pertemuan.filter(function (x) { return x.rombelId === j.rombelId && x.jamKe === j.jamKe; })[0];
      return {
        rombelId: j.rombelId, kelas: j.kelas, mapel: j.mapel, jamKe: j.jamKe,
        pertemuanId: pt ? pt.id : '',
        sudahSiGuru: logSiGuru.some(function (l) { return l.kelas === j.kelas && l.jamKe === j.jamKe; }),
      };
    }),
  };
}

/** Slot jadwal (hari + jam ke) untuk satu rombel — dipakai form presensi. */
function siguruSlotRombel_(rombelId) {
  return dbWhere_('JadwalSiGuru', function (j) { return j.rombelId === rombelId; })
    .map(function (j) { return { hari: j.hari, jamKe: j.jamKe }; });
}

// ============================================================ KIRIM JURNAL KE SIGURU

/** Ringkas presensi TeachDesk ke format kolom Izin/Alpa & Sakit SiGuru. */
function sgRingkasPresensi_(pertemuanId) {
  const siswa = {};
  dbAll_('Siswa').forEach(function (x) { siswa[x.id] = x.nama; });
  const izin = [], sakit = [];
  dbWhere_('Presensi', function (r) { return r.pertemuanId === pertemuanId; }).forEach(function (r) {
    const nama = siswa[r.siswaId];
    if (!nama) return;
    if (r.status === 'S') sakit.push(nama);
    else if (r.status === 'I') izin.push(nama + ' (Izin)');
    else if (r.status === 'A') izin.push(nama + ' (Alpa)');
  });
  return { izin: izin.length ? izin.join(', ') : 'Nihil', sakit: sakit.length ? sakit.join(', ') : 'Nihil' };
}

/**
 * Menulis/memperbarui baris Log Mengajar SiGuru untuk satu pertemuan.
 * Bila sudah ada baris dengan tanggal + NIP + kelas + jam ke yang sama → ditimpa
 * (foto eviden lama dipertahankan); bila belum → ditambahkan, sama seperti appendRow SiGuru.
 */
function siguruKirim_(p) {
  const s = sgCfg_();
  const pt = dbFind_('Pertemuan', p.pertemuanId);
  if (!pt) throw new Error('Pertemuan tidak ditemukan.');
  const r = mustRombel_(pt.rombelId);
  if (!r.siguruKelas) throw new Error('Rombel "' + r.nama + '" tidak terhubung ke SiGuru. Tarik kelas dari SiGuru di Pengaturan.');
  if (!pt.jamKe) throw new Error('Isi "Jam ke" agar jurnal bisa dicocokkan dengan jadwal SiGuru.');
  if (!pt.materi || !pt.refBaik || !pt.refBelum) throw new Error('SiGuru mewajibkan Materi, Refleksi "sudah baik" dan "belum baik".');

  const ss = sgBook_(s.siguruSpreadsheetId);
  const sh = sgSheet_(ss, 'Log Mengajar');
  const g = sgGuruJadwal_(ss, s.siguruNip);
  const tgl = sgTanggal_(pt.tanggal);
  const pres = sgRingkasPresensi_(pt.id);
  const jam = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm');

  return withLock_(function () {
    const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, SG_LOG_COLS).getDisplayValues() : [];
    let rowNum = -1, fotoLama = '';
    for (let i = rows.length - 1; i >= 0; i--) {
      if (sgTrim_(rows[i][1]) === tgl && sgTrim_(rows[i][2]) === s.siguruNip &&
          sgTrim_(rows[i][4]) === r.siguruKelas && sgTrim_(rows[i][5]) === pt.jamKe) {
        rowNum = i + 2; fotoLama = rows[i][13] || ''; break;
      }
    }
    // Urutan & format kolom = simpanLaporanAjar() di Code.gs SiGuru.
    const row = [jam, tgl, s.siguruNip, g.nama || s.namaGuru, r.siguruKelas, "'" + pt.jamKe, r.siguruMapel,
      pt.materi, pres.izin, pres.sakit, pt.refBaik, pt.refBelum, pt.refTantangan || '', fotoLama];
    if (rowNum > 0) sh.getRange(rowNum, 1, 1, SG_LOG_COLS).setValues([row]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, SG_LOG_COLS).setValues([row]);
    dbUpdate_('Pertemuan', pt.id, { siguruSync: now_() });
    return { mode: rowNum > 0 ? 'diperbarui' : 'ditambahkan', tanggal: tgl, kelas: r.siguruKelas, jamKe: pt.jamKe };
  });
}

// ============================================================ TARIK JURNAL DARI SIGURU

/**
 * Mengimpor jurnal yang Anda isi langsung di SiGuru menjadi Pertemuan + Presensi
 * di TeachDesk (yang sudah ada di TeachDesk tidak ditimpa).
 */
function siguruTarikJurnal_() {
  const s = sgCfg_();
  const ss = sgBook_(s.siguruSpreadsheetId);
  const rombel = {};
  dbAll_('Rombel').forEach(function (r) { if (r.siguruKelas) rombel[sgKey_(r.siguruKelas, r.siguruMapel)] = r; });
  if (!Object.keys(rombel).length) throw new Error('Belum ada kelas dari SiGuru. Klik "Tarik kelas, jadwal & siswa" dulu.');

  const existing = {};
  dbAll_('Pertemuan').forEach(function (x) { existing[x.rombelId + '|' + x.tanggal + '|' + x.jamKe] = true; });
  const siswa = dbAll_('Siswa');

  // Baris terakhir menang (SiGuru menambah baris baru saat jurnal diralat).
  const terbaru = {};
  sgRows_(sgSheet_(ss, 'Log Mengajar')).forEach(function (row) {
    if (sgTrim_(row[2]) !== s.siguruNip) return;
    const r = rombel[sgKey_(row[4], row[6])];
    const iso = sgIso_(row[1]);
    if (!r || !iso) return;
    terbaru[r.id + '|' + iso + '|' + sgTrim_(row[5])] = { r: r, iso: iso, row: row };
  });

  let ditambah = 0, dilewati = 0, tidakDikenal = [];
  Object.keys(terbaru).sort().forEach(function (k) {
    if (existing[k]) { dilewati++; return; }
    const x = terbaru[k], row = x.row;
    const anggota = anggotaRombel_(x.r, siswa);
    const byNama = {};
    anggota.forEach(function (a) { byNama[a.nama.toUpperCase()] = a; });
    const status = {}, catatan = [];
    const tandai = function (teks, kode) {
      const nama = teks.replace(/\s*\((Izin|Alpa|Sakit)\)\s*$/i, '').trim();
      const a = byNama[nama.toUpperCase()];
      if (a) status[a.id] = kode; else { catatan.push(teks); tidakDikenal.push(teks); }
    };
    sgTrim_(row[8]).split(',').map(sgTrim_).filter(function (t) { return t && t.toLowerCase() !== 'nihil'; })
      .forEach(function (t) { tandai(t, /\(Alpa\)/i.test(t) ? 'A' : 'I'); });
    sgTrim_(row[9]).split(',').map(sgTrim_).filter(function (t) { return t && t.toLowerCase() !== 'nihil'; })
      .forEach(function (t) { tandai(t, 'S'); });

    const ke = dbWhere_('Pertemuan', function (p) { return p.rombelId === x.r.id; }).length + 1;
    const pt = dbInsert_('Pertemuan', {
      rombelId: x.r.id, tanggal: x.iso, pertemuanKe: String(ke), materi: sgTrim_(row[7]),
      catatan: catatan.length ? 'Tidak dikenali dari SiGuru: ' + catatan.join(', ') : '', dibuat: now_(),
      jamKe: sgTrim_(row[5]), refBaik: sgTrim_(row[10]), refBelum: sgTrim_(row[11]), refTantangan: sgTrim_(row[12]),
      siguruSync: now_(),
    });
    dbInsertMany_('Presensi', anggota.map(function (a) {
      return { pertemuanId: pt.id, siswaId: a.id, status: status[a.id] || 'H', keterangan: status[a.id] ? 'dari SiGuru' : '' };
    }));
    ditambah++;
  });
  return { ditambah: ditambah, dilewati: dilewati, tidakDikenal: tidakDikenal.slice(0, 20) };
}
