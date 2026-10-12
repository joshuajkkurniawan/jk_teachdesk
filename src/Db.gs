/**
 * Db.gs — lapisan "database" sederhana di atas Google Sheets.
 *
 * Semua data disimpan sebagai TEKS (format '@') supaya NIS "00123" tidak
 * berubah jadi 123 dan tanggal tidak berubah jadi objek Date.
 *
 * API internal (dipakai file service lain):
 *   dbAll_(table)                 -> array objek
 *   dbFind_(table, id)            -> objek | null
 *   dbInsert_(table, obj)         -> objek (dengan id)
 *   dbInsertMany_(table, objs)
 *   dbUpdate_(table, id, patch)   -> objek
 *   dbDelete_(table, id)
 *   dbDeleteWhere_(table, fn)     -> jumlah baris terhapus
 *   dbUpsertMany_(table, objs)    -> objek dengan id → update, tanpa id → insert
 */

// Cache per-eksekusi (setiap panggilan google.script.run = eksekusi baru).
var DB_CACHE_ = {};
var DB_SS_ = null;

function db_() {
  if (DB_SS_) return DB_SS_;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    DB_SS_ = SpreadsheetApp.openById(id);
  } else {
    // Script yang "terikat" ke Spreadsheet (Extensions > Apps Script) memakai file itu.
    DB_SS_ = SpreadsheetApp.getActiveSpreadsheet();
    if (!DB_SS_) {
      // Script standalone (mis. via clasp): buat spreadsheet baru sekali saja.
      DB_SS_ = SpreadsheetApp.create(APP_NAME + ' — Database');
    }
    props.setProperty('SPREADSHEET_ID', DB_SS_.getId());
  }
  return DB_SS_;
}

function sheet_(table) {
  const headers = SCHEMA[table];
  if (!headers) throw new Error('Tabel tidak dikenal: ' + table);
  const ss = db_();
  let sh = ss.getSheetByName(table);
  if (!sh) {
    sh = ss.insertSheet(table);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e8eefc');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@');
  } else {
    ensureHeaders_(sh, headers);
  }
  return sh;
}

/** Menambahkan kolom baru jika SCHEMA berubah (migrasi ringan). */
function ensureHeaders_(sh, headers) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = headers.filter(function (h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    const start = current.filter(String).length + 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#e8eefc');
    sh.getRange(1, start, sh.getMaxRows(), missing.length).setNumberFormat('@');
  }
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Membaca tabel: { header: [...], rows: [[...]] } — header dari baris 1 sheet. */
function readTable_(table) {
  if (DB_CACHE_[table]) return DB_CACHE_[table];
  const sh = sheet_(table);
  const values = sh.getDataRange().getValues();
  const header = values.shift().map(String);
  const rows = values.filter(function (r) { return r[0] !== '' && r[0] !== null; });
  const objs = rows.map(function (r) {
    const o = {};
    header.forEach(function (h, i) { if (h) o[h] = cell_(r[i]); });
    return o;
  });
  DB_CACHE_[table] = { sheet: sh, header: header, objs: objs };
  return DB_CACHE_[table];
}

function invalidate_(table) { delete DB_CACHE_[table]; }

function toRow_(header, obj) {
  return header.map(function (h) { return h ? cell_(obj[h]) : ''; });
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function now_() { return new Date().toISOString(); }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- API publik internal ----------

function dbAll_(table) {
  // Salin objek supaya pemanggil tidak mengubah cache.
  return readTable_(table).objs.map(function (o) { return Object.assign({}, o); });
}

function dbWhere_(table, fn) { return dbAll_(table).filter(fn); }

function dbFind_(table, id) {
  const found = readTable_(table).objs.filter(function (o) { return o.id === String(id); })[0];
  return found ? Object.assign({}, found) : null;
}

function dbInsert_(table, obj) {
  dbInsertMany_(table, [obj]);
  return obj;
}

function dbInsertMany_(table, objs) {
  if (!objs.length) return objs;
  return withLock_(function () {
    const t = readTable_(table);
    objs.forEach(function (o) { if (!o.id && t.header.indexOf('id') !== -1) o.id = newId_(); });
    const rows = objs.map(function (o) { return toRow_(t.header, o); });
    t.sheet.getRange(t.sheet.getLastRow() + 1, 1, rows.length, t.header.length).setValues(rows);
    invalidate_(table);
    return objs;
  });
}

function dbUpdate_(table, id, patch) {
  return withLock_(function () {
    const t = readTable_(table);
    const idx = t.objs.findIndex(function (o) { return o.id === String(id); });
    if (idx === -1) throw new Error('Data tidak ditemukan (' + table + ': ' + id + ')');
    const merged = Object.assign({}, t.objs[idx], patch, { id: String(id) });
    rowIndexOf_(t, id, function (rowNum) {
      t.sheet.getRange(rowNum, 1, 1, t.header.length).setValues([toRow_(t.header, merged)]);
    });
    invalidate_(table);
    return merged;
  });
}

/** Cari nomor baris sheet (1-based) untuk id tertentu. */
function rowIndexOf_(t, id, cb) {
  const ids = t.sheet.getRange(1, 1, t.sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return cb(i + 1);
  }
  throw new Error('Baris tidak ditemukan: ' + id);
}

function dbDelete_(table, id) {
  return dbDeleteWhere_(table, function (o) { return o.id === String(id); });
}

/** Hapus semua baris yang cocok, lalu tulis ulang tabel (1x baca, 1x tulis). */
function dbDeleteWhere_(table, fn) {
  return withLock_(function () {
    const t = readTable_(table);
    const keep = t.objs.filter(function (o) { return !fn(o); });
    const removed = t.objs.length - keep.length;
    if (removed) rewrite_(t, keep);
    invalidate_(table);
    return removed;
  });
}

function dbUpsertMany_(table, objs) {
  if (!objs.length) return [];
  return withLock_(function () {
    const t = readTable_(table);
    const byId = {};
    t.objs.forEach(function (o, i) { byId[o.id] = i; });
    const all = t.objs.slice();
    objs.forEach(function (o) {
      if (o.id && byId[o.id] !== undefined) {
        all[byId[o.id]] = Object.assign({}, all[byId[o.id]], o);
      } else {
        o.id = o.id || newId_();
        all.push(o);
      }
    });
    rewrite_(t, all);
    invalidate_(table);
    return objs;
  });
}

function rewrite_(t, objs) {
  const sh = t.sheet;
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  if (objs.length) {
    const rows = objs.map(function (o) { return toRow_(t.header, o); });
    sh.getRange(2, 1, rows.length, t.header.length).setValues(rows);
  }
}

/** Jalankan sekali dari editor Apps Script untuk membuat semua sheet. */
function setupDatabase() {
  Object.keys(SCHEMA).forEach(sheet_);
  const ss = db_();
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  Logger.log('Database siap: ' + ss.getUrl());
  return ss.getUrl();
}
