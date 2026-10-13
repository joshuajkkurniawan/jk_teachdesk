/**
 * Code.gs — titik masuk Web App & router API.
 *
 * Browser memanggil SATU fungsi saja: api(action, payload).
 *   google.script.run.withSuccessHandler(cb).api('siswa.list', {})
 * Daftar aksi ada di routes_() di bawah — mudah dibaca & ditambah.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Dipakai di Index.html: <?!= include('Styles') ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * Daftar aksi → [nama fungsi, file asalnya].
 * Fungsi dicari SAAT DIPANGGIL (bukan sekaligus), jadi bila satu file belum
 * disalin/tersimpan, aksi lain tetap jalan dan pesan error menyebut file-nya.
 */
const ROUTES = {
  'app.bootstrap': ['bootstrap_', 'Code.gs'],
  'dashboard': ['dashboard_', 'Services.gs'],

  'settings.get': ['settingsGet_', 'Services.gs'],
  'settings.save': ['settingsSave_', 'Services.gs'],

  'siswa.list': ['siswaList_', 'Services.gs'],
  'siswa.save': ['siswaSave_', 'Services.gs'],
  'siswa.delete': ['siswaDelete_', 'Services.gs'],
  'siswa.import': ['siswaImport_', 'Services.gs'],
  'kelas.list': ['kelasList_', 'Services.gs'],

  'rombel.list': ['rombelList_', 'Services.gs'],
  'rombel.save': ['rombelSave_', 'Services.gs'],
  'rombel.delete': ['rombelDelete_', 'Services.gs'],
  'rombel.members': ['rombelMembers_', 'Services.gs'],
  'rombel.setMembers': ['rombelSetMembers_', 'Services.gs'],

  'nilai.gradebook': ['gradebook_', 'Services.gs'],
  'nilai.saveBulk': ['nilaiSaveBulk_', 'Services.gs'],
  'asesmen.save': ['asesmenSave_', 'Services.gs'],
  'asesmen.delete': ['asesmenDelete_', 'Services.gs'],

  'presensi.list': ['pertemuanList_', 'Services.gs'],
  'presensi.form': ['presensiForm_', 'Services.gs'],
  'presensi.save': ['presensiSave_', 'Services.gs'],
  'presensi.delete': ['pertemuanDelete_', 'Services.gs'],
  'presensi.rekap': ['presensiRekap_', 'Services.gs'],

  'ai.generate': ['aiGenerate_', 'Ai.gs'],
  'ai.deskripsiRapor': ['aiDeskripsiRapor_', 'Ai.gs'],
  'ai.test': ['aiTest_', 'Ai.gs'],

  'dok.list': ['dokList_', 'Dokumen.gs'],
  'dok.get': ['dokGet_', 'Dokumen.gs'],
  'dok.save': ['dokSave_', 'Dokumen.gs'],
  'dok.delete': ['dokDelete_', 'Dokumen.gs'],
  'dok.export': ['dokExport_', 'Dokumen.gs'],

  'siguru.status': ['siguruStatus_', 'SiGuru.gs'],
  'siguru.tarik': ['siguruTarik_', 'SiGuru.gs'],
  'siguru.hariIni': ['siguruHariIni_', 'SiGuru.gs'],
  'siguru.kirim': ['siguruKirim_', 'SiGuru.gs'],
  'siguru.tarikJurnal': ['siguruTarikJurnal_', 'SiGuru.gs'],
};

function bootstrap_() {
  return {
    app: { nama: APP_NAME, versi: APP_VERSION },
    settings: settingsGet_(), rombel: rombelList_(), kelas: kelasList_(),
    katalog: aiCatalog_(), jenisAsesmen: JENIS_ASESMEN, statusPresensi: STATUS_PRESENSI,
    dbUrl: db_().getUrl(),
  };
}

function resolve_(action) {
  const r = ROUTES[action];
  if (!r) throw new Error('Aksi tidak dikenal: ' + action);
  const fn = globalThis[r[0]];
  if (typeof fn !== 'function') {
    throw new Error('Fungsi ' + r[0] + ' tidak ditemukan. Pastikan file ' + r[1] +
      ' sudah disalin UTUH, disimpan (Ctrl+S), lalu buat versi deployment baru. ' +
      'Jalankan cekInstalasi() di editor untuk memeriksa semua file.');
  }
  return fn;
}

/** Satu-satunya fungsi yang dipanggil dari browser. Selalu mengembalikan {ok, data|error}. */
function api(action, payload) {
  try {
    return { ok: true, data: resolve_(action)(payload || {}) };
  } catch (e) {
    console.error(action, e && e.stack ? e.stack : e);
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

/**
 * Jalankan dari editor Apps Script (pilih cekInstalasi → Run) untuk
 * memeriksa apakah semua file & fungsi sudah terpasang dengan benar.
 */
function cekInstalasi() {
  const missing = {};
  const extra = [['aiCatalog_', 'AiTemplates.gs'], ['aiTemplates_', 'AiTemplates.gs'],
    ['dbAll_', 'Db.gs'], ['sheet_', 'Db.gs'], ['callAi_', 'Ai.gs'], ['callGemini_', 'Ai.gs'], ['markdownToDoc_', 'Dokumen.gs']];
  Object.keys(ROUTES).map(function (k) { return ROUTES[k]; }).concat(extra).forEach(function (r) {
    if (typeof globalThis[r[0]] !== 'function') (missing[r[1]] = missing[r[1]] || []).push(r[0]);
  });
  ['SCHEMA', 'DEFAULT_SETTINGS'].forEach(function (c) {
    try { eval(c); } catch (e) { (missing['Config.gs'] = missing['Config.gs'] || []).push(c); }
  });
  ['Index', 'Styles', 'App', 'Vendor'].forEach(function (h) {
    try { HtmlService.createHtmlOutputFromFile(h); } catch (e) { (missing[h + '.html'] = missing[h + '.html'] || []).push('(file HTML)'); }
  });
  const files = Object.keys(missing);
  const msg = files.length
    ? '❌ Ada yang belum lengkap:\n' + files.map(function (f) { return '- ' + f + ': ' + missing[f].join(', '); }).join('\n') +
      '\nSalin ulang file tersebut secara utuh dari repo, simpan, lalu jalankan cekInstalasi() lagi.'
    : '✅ Semua file & fungsi lengkap. Jangan lupa: Deploy → Manage deployments → Edit → New version.';
  Logger.log(msg);
  return msg;
}
