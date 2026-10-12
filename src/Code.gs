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

function routes_() {
  return {
    'app.bootstrap': function () {
      return {
        app: { nama: APP_NAME, versi: APP_VERSION },
        settings: settingsGet_(), rombel: rombelList_(), kelas: kelasList_(),
        katalog: aiCatalog_(), jenisAsesmen: JENIS_ASESMEN, statusPresensi: STATUS_PRESENSI,
        dbUrl: db_().getUrl(),
      };
    },
    'dashboard': dashboard_,

    'settings.get': settingsGet_,
    'settings.save': settingsSave_,

    'siswa.list': siswaList_,
    'siswa.save': siswaSave_,
    'siswa.delete': siswaDelete_,
    'siswa.import': siswaImport_,
    'kelas.list': kelasList_,

    'rombel.list': rombelList_,
    'rombel.save': rombelSave_,
    'rombel.delete': rombelDelete_,
    'rombel.members': rombelMembers_,
    'rombel.setMembers': rombelSetMembers_,

    'nilai.gradebook': gradebook_,
    'nilai.saveBulk': nilaiSaveBulk_,
    'asesmen.save': asesmenSave_,
    'asesmen.delete': asesmenDelete_,

    'presensi.list': pertemuanList_,
    'presensi.form': presensiForm_,
    'presensi.save': presensiSave_,
    'presensi.delete': pertemuanDelete_,
    'presensi.rekap': presensiRekap_,

    'ai.generate': aiGenerate_,
    'ai.deskripsiRapor': aiDeskripsiRapor_,
    'ai.test': aiTest_,

    'dok.list': dokList_,
    'dok.get': dokGet_,
    'dok.save': dokSave_,
    'dok.delete': dokDelete_,
    'dok.export': dokExport_,
  };
}

/** Satu-satunya fungsi yang dipanggil dari browser. Selalu mengembalikan {ok, data|error}. */
function api(action, payload) {
  try {
    const fn = routes_()[action];
    if (!fn) throw new Error('Aksi tidak dikenal: ' + action);
    return { ok: true, data: fn(payload || {}) };
  } catch (e) {
    console.error(action, e && e.stack ? e.stack : e);
    return { ok: false, error: (e && e.message) || String(e) };
  }
}
