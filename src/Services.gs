/**
 * Services.gs — logika bisnis: Pengaturan, Siswa, Rombel (kelas/ekskul),
 * Penilaian, dan Presensi/Jurnal. Semua fungsi dipanggil lewat router api().
 */

// ======================= PENGATURAN =======================

function settingsGet_() {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  readTable_('Pengaturan').objs.forEach(function (r) { if (r.kunci) s[r.kunci] = r.nilai; });
  const props = PropertiesService.getScriptProperties();
  const mask = function (k) { return k ? k.slice(0, 6) + '…' + k.slice(-4) : ''; };
  const claude = props.getProperty('ANTHROPIC_API_KEY'), gemini = props.getProperty('GEMINI_API_KEY');
  s.hasClaudeKey = !!claude; s.claudeKeyMask = mask(claude);
  s.hasGeminiKey = !!gemini; s.geminiKeyMask = mask(gemini);
  // hasApiKey = penyedia yang AKTIF sudah punya key.
  s.hasApiKey = s.aiProvider === 'claude' ? s.hasClaudeKey : s.hasGeminiKey;
  s.aiLabel = s.aiProvider === 'claude' ? 'Claude · ' + s.aiModel : 'Gemini · ' + s.geminiModel;
  return s;
}

function settingsSave_(p) {
  const newKey = String(p.apiKey || '').trim();
  if (newKey && !/^sk-ant-/.test(newKey)) {
    throw new Error('Format API key salah. Key Claude selalu diawali "sk-ant-…" ' +
      '(yang diawali "apikey_…" adalah ID key, bukan key-nya). Buat key baru di console.anthropic.com → API Keys, lalu salin teks rahasia yang muncul sekali saja.');
  }
  const geminiKey = String(p.geminiKey || '').trim();
  if (geminiKey && (/^sk-ant-/.test(geminiKey) || geminiKey.length < 20)) {
    throw new Error('Format API key Gemini tidak dikenali. Ambil key di aistudio.google.com → Get API key.');
  }
  const allowed = Object.keys(DEFAULT_SETTINGS);
  withLock_(function () {
    const t = readTable_('Pengaturan');
    const map = {};
    t.objs.forEach(function (r) { map[r.kunci] = r.nilai; });
    allowed.forEach(function (k) { if (p[k] !== undefined) map[k] = String(p[k]).trim(); });
    const rows = Object.keys(map).map(function (k) { return { kunci: k, nilai: map[k] }; });
    rewrite_(t, rows);
    invalidate_('Pengaturan');
  });
  if (p.apiKey !== undefined && String(p.apiKey).trim()) {
    PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', String(p.apiKey).trim());
  }
  if (p.hapusApiKey) PropertiesService.getScriptProperties().deleteProperty('ANTHROPIC_API_KEY');
  if (geminiKey) PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', geminiKey);
  if (p.hapusGeminiKey) PropertiesService.getScriptProperties().deleteProperty('GEMINI_API_KEY');
  return settingsGet_();
}

// ======================= SISWA =======================

function siswaList_() {
  return dbAll_('Siswa').sort(function (a, b) {
    return (a.kelas + a.nama).localeCompare(b.kelas + b.nama, 'id');
  });
}

function siswaSave_(p) {
  if (!p.nama || !String(p.nama).trim()) throw new Error('Nama siswa wajib diisi.');
  const data = {
    nis: p.nis || '', nisn: p.nisn || '', nama: String(p.nama).trim(), jk: p.jk || '',
    kelas: String(p.kelas || '').trim().toUpperCase(), tglLahir: p.tglLahir || '',
    namaOrtu: p.namaOrtu || '', hpOrtu: p.hpOrtu || '', catatan: p.catatan || '',
    aktif: p.aktif === false || p.aktif === 'false' ? 'false' : 'true',
  };
  if (data.nis) {
    const dup = dbAll_('Siswa').filter(function (s) { return s.nis === data.nis && s.id !== p.id; })[0];
    if (dup) throw new Error('NIS ' + data.nis + ' sudah dipakai oleh ' + dup.nama + '.');
  }
  if (p.id) return dbUpdate_('Siswa', p.id, data);
  data.dibuat = now_();
  return dbInsert_('Siswa', data);
}

function siswaDelete_(p) {
  dbDelete_('Siswa', p.id);
  dbDeleteWhere_('Anggota', function (a) { return a.siswaId === p.id; });
  dbDeleteWhere_('Nilai', function (n) { return n.siswaId === p.id; });
  dbDeleteWhere_('Presensi', function (n) { return n.siswaId === p.id; });
  return true;
}

/**
 * Impor massal. rows = [{nis, nisn, nama, jk, kelas, ...}] (hasil paste dari Excel).
 * Jika NIS sudah ada → data diperbarui; jika belum → ditambahkan.
 */
function siswaImport_(p) {
  const rows = (p.rows || []).filter(function (r) { return r.nama && String(r.nama).trim(); });
  const byNis = {};
  dbAll_('Siswa').forEach(function (s) { if (s.nis) byNis[s.nis] = s; });
  let baru = 0, update = 0;
  const upserts = rows.map(function (r) {
    const o = {
      nis: String(r.nis || '').trim(), nisn: String(r.nisn || '').trim(), nama: String(r.nama).trim(),
      jk: String(r.jk || '').trim().toUpperCase().charAt(0), kelas: String(r.kelas || p.kelas || '').trim().toUpperCase(),
      tglLahir: r.tglLahir || '', namaOrtu: r.namaOrtu || '', hpOrtu: String(r.hpOrtu || ''), aktif: 'true',
    };
    if (o.nis && byNis[o.nis]) { o.id = byNis[o.nis].id; update++; } else { o.dibuat = now_(); baru++; }
    return o;
  });
  dbUpsertMany_('Siswa', upserts);
  return { baru: baru, update: update };
}

function kelasList_() {
  const set = {};
  dbAll_('Siswa').forEach(function (s) { if (s.kelas) set[s.kelas] = true; });
  return Object.keys(set).sort();
}

// ======================= ROMBEL (Kelas Mapel / Ekskul) =======================

function rombelList_() {
  const siswa = dbAll_('Siswa');
  const anggota = dbAll_('Anggota');
  return dbAll_('Rombel').map(function (r) {
    r.jumlahSiswa = anggotaRombel_(r, siswa, anggota).length;
    return r;
  }).sort(function (a, b) { return (a.mapel + a.nama).localeCompare(b.mapel + b.nama, 'id'); });
}

function rombelSave_(p) {
  if (!p.nama) throw new Error('Nama rombel wajib diisi.');
  const data = {
    nama: String(p.nama).trim(), mapel: p.mapel || '', tipe: p.tipe || 'Mapel',
    kelas: String(p.kelas || '').trim().toUpperCase(), tahunAjaran: p.tahunAjaran || '',
    semester: p.semester || '', kktp: p.kktp || '', jadwal: p.jadwal || '', catatan: p.catatan || '',
  };
  if (p.id) return dbUpdate_('Rombel', p.id, data);
  data.dibuat = now_();
  return dbInsert_('Rombel', data);
}

function rombelDelete_(p) {
  const asesmenIds = dbWhere_('Asesmen', function (a) { return a.rombelId === p.id; }).map(function (a) { return a.id; });
  const pertemuanIds = dbWhere_('Pertemuan', function (a) { return a.rombelId === p.id; }).map(function (a) { return a.id; });
  dbDeleteWhere_('Nilai', function (n) { return asesmenIds.indexOf(n.asesmenId) !== -1; });
  dbDeleteWhere_('Presensi', function (n) { return pertemuanIds.indexOf(n.pertemuanId) !== -1; });
  dbDeleteWhere_('Asesmen', function (a) { return a.rombelId === p.id; });
  dbDeleteWhere_('Pertemuan', function (a) { return a.rombelId === p.id; });
  dbDeleteWhere_('Anggota', function (a) { return a.rombelId === p.id; });
  dbDelete_('Rombel', p.id);
  return true;
}

/** Daftar siswa aktif anggota rombel, urut nama. */
function anggotaRombel_(rombel, siswaAll, anggotaAll) {
  siswaAll = siswaAll || dbAll_('Siswa');
  let list;
  if (rombel.kelas) {
    list = siswaAll.filter(function (s) { return s.kelas === rombel.kelas; });
  } else {
    const ids = {};
    (anggotaAll || dbAll_('Anggota')).forEach(function (a) { if (a.rombelId === rombel.id) ids[a.siswaId] = true; });
    list = siswaAll.filter(function (s) { return ids[s.id]; });
  }
  return list.filter(function (s) { return s.aktif !== 'false'; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
}

function rombelMembers_(p) {
  const r = mustRombel_(p.rombelId);
  return { rombel: r, siswa: anggotaRombel_(r) };
}

function rombelSetMembers_(p) {
  const r = mustRombel_(p.rombelId);
  if (r.kelas) throw new Error('Anggota rombel ini otomatis mengikuti kelas ' + r.kelas + '.');
  dbDeleteWhere_('Anggota', function (a) { return a.rombelId === r.id; });
  dbInsertMany_('Anggota', (p.siswaIds || []).map(function (id) { return { rombelId: r.id, siswaId: id }; }));
  return anggotaRombel_(r).length;
}

function mustRombel_(id) {
  const r = dbFind_('Rombel', id);
  if (!r) throw new Error('Rombel tidak ditemukan.');
  return r;
}

// ======================= PENILAIAN =======================

function num_(v, def) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? def : n;
}

/**
 * Buku nilai satu rombel.
 * Nilai akhir = rata-rata berbobot dari (nilai / maks × 100) × bobot asesmen.
 * Asesmen yang belum diisi untuk seorang siswa tidak ikut dihitung.
 */
function gradebook_(p) {
  const rombel = mustRombel_(p.rombelId);
  const settings = settingsGet_();
  const kktp = num_(rombel.kktp, num_(settings.kktpDefault, 75));
  const siswa = anggotaRombel_(rombel);
  const asesmen = dbWhere_('Asesmen', function (a) { return a.rombelId === rombel.id; })
    .sort(function (a, b) { return (a.tanggal + a.dibuat).localeCompare(b.tanggal + b.dibuat); });
  const ids = {};
  asesmen.forEach(function (a) { ids[a.id] = a; });
  const nilai = {}; // nilai[siswaId][asesmenId] = '85'
  dbAll_('Nilai').forEach(function (n) {
    if (!ids[n.asesmenId]) return;
    (nilai[n.siswaId] = nilai[n.siswaId] || {})[n.asesmenId] = n.nilai;
  });
  const rekap = siswa.map(function (s) {
    let total = 0, bobot = 0;
    asesmen.forEach(function (a) {
      const v = (nilai[s.id] || {})[a.id];
      if (v === undefined || v === '') return;
      const b = num_(a.bobot, 1), m = num_(a.maks, 100) || 100;
      total += (num_(v, 0) / m * 100) * b;
      bobot += b;
    });
    const akhir = bobot ? Math.round(total / bobot * 10) / 10 : null;
    return { siswaId: s.id, akhir: akhir, tuntas: akhir === null ? null : akhir >= kktp };
  });
  return { rombel: rombel, kktp: kktp, siswa: siswa, asesmen: asesmen, nilai: nilai, rekap: rekap, jenis: JENIS_ASESMEN };
}

function asesmenSave_(p) {
  mustRombel_(p.rombelId);
  if (!p.judul) throw new Error('Judul asesmen wajib diisi.');
  const data = {
    rombelId: p.rombelId, judul: String(p.judul).trim(), jenis: p.jenis || 'Tugas',
    tanggal: p.tanggal || '', bobot: String(num_(p.bobot, 1)), maks: String(num_(p.maks, 100)),
    tp: p.tp || '', catatan: p.catatan || '',
  };
  if (p.id) return dbUpdate_('Asesmen', p.id, data);
  data.dibuat = now_();
  return dbInsert_('Asesmen', data);
}

function asesmenDelete_(p) {
  dbDeleteWhere_('Nilai', function (n) { return n.asesmenId === p.id; });
  dbDelete_('Asesmen', p.id);
  return true;
}

/** entries = [{asesmenId, siswaId, nilai}] — nilai kosong = hapus. */
function nilaiSaveBulk_(p) {
  const entries = p.entries || [];
  const maks = {};
  dbAll_('Asesmen').forEach(function (a) { maks[a.id] = num_(a.maks, 100) || 100; });
  const existing = {};
  dbAll_('Nilai').forEach(function (n) { existing[n.asesmenId + '|' + n.siswaId] = n; });
  const upserts = [], hapus = {};
  entries.forEach(function (e) {
    const key = e.asesmenId + '|' + e.siswaId;
    const v = String(e.nilai === null || e.nilai === undefined ? '' : e.nilai).trim().replace(',', '.');
    if (v !== '' && isNaN(Number(v))) throw new Error('Nilai tidak valid: "' + e.nilai + '"');
    if (maks[e.asesmenId] === undefined) throw new Error('Asesmen tidak ditemukan.');
    if (v !== '' && (Number(v) < 0 || Number(v) > maks[e.asesmenId])) {
      throw new Error('Nilai ' + v + ' di luar rentang 0–' + maks[e.asesmenId] + '.');
    }
    if (v === '') { if (existing[key]) hapus[existing[key].id] = true; return; }
    upserts.push({ id: existing[key] ? existing[key].id : undefined, asesmenId: e.asesmenId, siswaId: e.siswaId, nilai: v, diubah: now_() });
  });
  if (Object.keys(hapus).length) dbDeleteWhere_('Nilai', function (n) { return hapus[n.id]; });
  dbUpsertMany_('Nilai', upserts);
  return { tersimpan: upserts.length, dihapus: Object.keys(hapus).length };
}

// ======================= PRESENSI & JURNAL =======================

function pertemuanList_(p) {
  const rombel = mustRombel_(p.rombelId);
  const list = dbWhere_('Pertemuan', function (x) { return x.rombelId === rombel.id; });
  const pres = dbAll_('Presensi');
  list.forEach(function (x) {
    const c = { H: 0, T: 0, S: 0, I: 0, A: 0 };
    pres.forEach(function (r) { if (r.pertemuanId === x.id && c[r.status] !== undefined) c[r.status]++; });
    x.ringkasan = c;
  });
  list.sort(function (a, b) { return (b.tanggal + b.dibuat).localeCompare(a.tanggal + a.dibuat); });
  return { rombel: rombel, pertemuan: list };
}

/** Data form presensi. Tanpa pertemuanId → form baru (semua Hadir). */
function presensiForm_(p) {
  const rombel = mustRombel_(p.rombelId);
  const siswa = anggotaRombel_(rombel);
  let pertemuan, status = {};
  if (p.pertemuanId) {
    pertemuan = dbFind_('Pertemuan', p.pertemuanId);
    dbWhere_('Presensi', function (r) { return r.pertemuanId === p.pertemuanId; })
      .forEach(function (r) { status[r.siswaId] = { status: r.status, keterangan: r.keterangan }; });
  } else {
    const count = dbWhere_('Pertemuan', function (x) { return x.rombelId === rombel.id; }).length;
    pertemuan = { rombelId: rombel.id, tanggal: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), pertemuanKe: String(count + 1), materi: '', catatan: '' };
  }
  return { rombel: rombel, siswa: siswa, pertemuan: pertemuan, status: status, kode: STATUS_PRESENSI };
}

/** p = { pertemuan: {...}, records: [{siswaId, status, keterangan}] } */
function presensiSave_(p) {
  const pt = p.pertemuan || {};
  mustRombel_(pt.rombelId);
  if (!pt.tanggal) throw new Error('Tanggal pertemuan wajib diisi.');
  const data = { rombelId: pt.rombelId, tanggal: pt.tanggal, pertemuanKe: pt.pertemuanKe || '', materi: pt.materi || '', catatan: pt.catatan || '' };
  let saved;
  if (pt.id) saved = dbUpdate_('Pertemuan', pt.id, data);
  else { data.dibuat = now_(); saved = dbInsert_('Pertemuan', data); }
  dbDeleteWhere_('Presensi', function (r) { return r.pertemuanId === saved.id; });
  dbInsertMany_('Presensi', (p.records || []).map(function (r) {
    return { pertemuanId: saved.id, siswaId: r.siswaId, status: STATUS_PRESENSI[r.status] ? r.status : 'H', keterangan: r.keterangan || '' };
  }));
  return saved;
}

function pertemuanDelete_(p) {
  dbDeleteWhere_('Presensi', function (r) { return r.pertemuanId === p.id; });
  dbDelete_('Pertemuan', p.id);
  return true;
}

/** Rekap kehadiran per siswa untuk satu rombel. */
function presensiRekap_(p) {
  const rombel = mustRombel_(p.rombelId);
  const siswa = anggotaRombel_(rombel);
  const pIds = {};
  dbWhere_('Pertemuan', function (x) { return x.rombelId === rombel.id; }).forEach(function (x) { pIds[x.id] = true; });
  const total = Object.keys(pIds).length;
  const counts = {};
  dbAll_('Presensi').forEach(function (r) {
    if (!pIds[r.pertemuanId]) return;
    const c = counts[r.siswaId] = counts[r.siswaId] || { H: 0, T: 0, S: 0, I: 0, A: 0 };
    if (c[r.status] !== undefined) c[r.status]++;
  });
  const rows = siswa.map(function (s) {
    const c = counts[s.id] || { H: 0, T: 0, S: 0, I: 0, A: 0 };
    const tercatat = c.H + c.T + c.S + c.I + c.A;
    return { siswa: s, c: c, persen: tercatat ? Math.round((c.H + c.T) / tercatat * 1000) / 10 : null };
  });
  return { rombel: rombel, totalPertemuan: total, rows: rows };
}

// ======================= DASHBOARD =======================

function dashboard_() {
  const rombel = rombelList_();
  const siswa = dbAll_('Siswa').filter(function (s) { return s.aktif !== 'false'; });
  const pertemuan = dbAll_('Pertemuan');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const pres = dbAll_('Presensi');
  const alpaPerSiswa = {};
  pres.forEach(function (r) { if (r.status === 'A') alpaPerSiswa[r.siswaId] = (alpaPerSiswa[r.siswaId] || 0) + 1; });
  const perhatian = siswa
    .filter(function (s) { return (alpaPerSiswa[s.id] || 0) >= 3; })
    .map(function (s) { return { nama: s.nama, kelas: s.kelas, alpa: alpaPerSiswa[s.id] }; })
    .sort(function (a, b) { return b.alpa - a.alpa; }).slice(0, 8);
  const dok = dbAll_('Dokumen').sort(function (a, b) { return b.dibuat.localeCompare(a.dibuat); }).slice(0, 5);
  const terakhir = pertemuan.sort(function (a, b) { return (b.tanggal + b.dibuat).localeCompare(a.tanggal + a.dibuat); }).slice(0, 5)
    .map(function (x) {
      const r = rombel.filter(function (y) { return y.id === x.rombelId; })[0];
      return { tanggal: x.tanggal, materi: x.materi, rombel: r ? r.nama : '-', rombelId: x.rombelId };
    });
  return {
    stat: {
      siswa: siswa.length, rombel: rombel.length, asesmen: dbAll_('Asesmen').length,
      pertemuan: pertemuan.length, dokumen: dbAll_('Dokumen').length,
      pertemuanHariIni: pertemuan.filter(function (x) { return x.tanggal === today; }).length,
    },
    perhatian: perhatian, dokumenTerbaru: dok, jurnalTerakhir: terakhir,
  };
}
