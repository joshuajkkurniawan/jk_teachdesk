/**
 * dev/server.js — menjalankan aplikasi SECARA LOKAL tanpa Google.
 *
 *   node dev/server.js        → buka http://localhost:8080
 *
 * Cara kerja: file .gs di src/ dimuat ke sandbox Node (vm) bersama tiruan
 * (mock) SpreadsheetApp, PropertiesService, dll. Data disimpan di
 * dev/.data.json. google.script.run di browser diganti fetch('/rpc').
 *
 * AI: jalankan dengan REAL_AI=1 agar panggilan AI benar-benar dikirim ke
 * Gemini/Claude memakai key yang Anda simpan di Pengaturan (atau env
 * GEMINI_API_KEY / ANTHROPIC_API_KEY). Tanpa itu, dipakai jawaban tiruan.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SRC = path.join(__dirname, '..', 'src');
const DATA = path.join(__dirname, '.data.json');
const PORT = Number(process.env.PORT || 8080);

// ------------------------------------------------------------------ mock Sheets
let store = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : { sheets: {}, props: {} };
const persist = () => fs.writeFileSync(DATA, JSON.stringify(store));

function colToNum(c) { return c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0); }

function makeRange(sheet, r, c, nr, nc) {
  const grid = () => store.sheets[sheet];
  return {
    getValues() {
      const g = grid(), out = [];
      for (let i = 0; i < nr; i++) {
        const row = [];
        for (let j = 0; j < nc; j++) row.push(((g[r - 1 + i] || [])[c - 1 + j]) ?? '');
        out.push(row);
      }
      return out;
    },
    setValues(vals) {
      if (vals.length !== nr || vals[0].length !== nc) throw new Error(`setValues dimensi salah: ${vals.length}x${vals[0].length} vs ${nr}x${nc}`);
      const g = grid();
      vals.forEach((row, i) => {
        g[r - 1 + i] = g[r - 1 + i] || [];
        row.forEach((v, j) => { g[r - 1 + i][c - 1 + j] = v === null || v === undefined ? '' : String(v); });
      });
      persist();
      return this;
    },
    clearContent() {
      const g = grid();
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (g[r - 1 + i]) g[r - 1 + i][c - 1 + j] = '';
      // buang baris kosong di ekor
      while (g.length && g[g.length - 1].every((v) => v === '')) g.pop();
      persist();
      return this;
    },
    setFontWeight() { return this; }, setBackground() { return this; }, setNumberFormat() { return this; },
  };
}

function makeSheet(name) {
  const grid = () => store.sheets[name];
  const lastRow = () => { const g = grid(); let n = g.length; while (n && (g[n - 1] || []).every((v) => v === '')) n--; return n; };
  const lastCol = () => grid().reduce((m, row) => { let n = row.length; while (n && row[n - 1] === '') n--; return Math.max(m, n); }, 0);
  return {
    getName: () => name,
    getLastRow: lastRow,
    getLastColumn: lastCol,
    getMaxRows: () => 1000,
    setFrozenRows() {},
    getDataRange() { return makeRange(name, 1, 1, Math.max(lastRow(), 1), Math.max(lastCol(), 1)); },
    getRange(a, b, c, d) {
      if (typeof a === 'string') { const m = a.match(/^([A-Z]+):([A-Z]+)$/); return makeRange(name, 1, colToNum(m[1]), 1000, colToNum(m[2]) - colToNum(m[1]) + 1); }
      return makeRange(name, a, b, c || 1, d || 1);
    },
  };
}

const spreadsheet = {
  getId: () => 'local-dev',
  getUrl: () => 'file://' + DATA,
  getSheetByName: (n) => (store.sheets[n] ? makeSheet(n) : null),
  insertSheet: (n) => { store.sheets[n] = []; persist(); return makeSheet(n); },
  getSheets: () => Object.keys(store.sheets).map(makeSheet),
  deleteSheet: (s) => { delete store.sheets[s.getName()]; persist(); },
};

// ------------------------------------------------------------------ mock layanan lain
const props = {
  getProperty: (k) => (k in store.props ? store.props[k] : (/_API_KEY$/.test(k) ? process.env[k] || null : null)),
  setProperty: (k, v) => { store.props[k] = v; persist(); },
  deleteProperty: (k) => { delete store.props[k]; persist(); },
};

function fakeClaude(body) {
  const prompt = body.messages[0].content;
  if (body.output_config && body.output_config.format) {
    const ids = [...prompt.matchAll(/id=(\w+) \| ([^|]+)\|/g)];
    return { deskripsi: ids.map((m) => ({ siswaId: m[1], deskripsi: `(Contoh lokal) ${m[2].trim()} menunjukkan penguasaan yang baik dalam materi praktik, perlu penguatan pada konsep dasar.` })) };
  }
  return `# ${prompt.split('\n')[0].replace('Buatkan dokumen: ', '')}\n\n> Ini jawaban **tiruan** dari dev server lokal (tanpa API key).\n\n## A. Informasi Umum\n\n| Komponen | Isi |\n|---|---|\n| Penyusun | Guru |\n| Fase | E |\n\n## B. Langkah\n\n1. Pendahuluan — *apersepsi*\n2. Inti\n   - Memahami\n   - Mengaplikasi\n3. Penutup\n\n\`\`\`python\nprint("Halo")\n\`\`\`\n\n---\n\nData yang dikirim:\n\n${prompt.split('\n').map((l) => '    ' + l).join('\n')}`;
}

const UrlFetchApp = {
  fetch(url, opt) {
    const body = JSON.parse(opt.payload);
    let status = 200, text;
    const gemini = url.includes('generativelanguage');
    if (process.env.REAL_AI === '1') {
      // Panggilan nyata (sinkron) lewat curl agar sama persis dengan UrlFetchApp.
      const args = ['-sS', '-w', '\n%{http_code}', url, '-X', 'POST', '-d', '@-'];
      Object.entries(Object.assign({ 'content-type': 'application/json' }, opt.headers)).forEach(([k, v]) => args.push('-H', `${k}: ${v}`));
      const out = execFileSync('curl', args, { input: opt.payload, maxBuffer: 50 * 1024 * 1024 }).toString();
      const i = out.lastIndexOf('\n');
      text = out.slice(0, i); status = Number(out.slice(i + 1));
    } else {
      const res = gemini
        ? fakeClaude({ messages: [{ content: body.contents[0].parts[0].text }], output_config: body.generationConfig.responseJsonSchema ? { format: 1 } : null })
        : fakeClaude(body);
      const out = typeof res === 'string' ? res : JSON.stringify(res);
      text = gemini
        ? JSON.stringify({ modelVersion: url.split('/models/')[1].split(':')[0] + ' (tiruan)', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'pikiran', thought: true }, { text: out }] } }] })
        : JSON.stringify({ model: body.model + ' (tiruan)', stop_reason: 'end_turn', usage: {}, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: out }] });
    }
    return { getResponseCode: () => status, getContentText: () => text };
  },
};

const DocumentApp = {
  create(name) {
    const id = crypto.randomUUID();
    const stub = new Proxy(function () {}, { get: (t, k) => (k === 'getText' ? () => '' : k === 'getNumChildren' ? () => 1 : stub), apply: () => stub });
    return { getBody: () => stub, saveAndClose() {}, getUrl: () => 'https://docs.google.com/document/d/' + id + '/edit#lokal-' + encodeURIComponent(name) };
  },
  ParagraphHeading: {}, GlyphType: {}, ElementType: {},
};

const sandbox = {
  console,
  SpreadsheetApp: { openById: () => spreadsheet, getActiveSpreadsheet: () => spreadsheet, create: () => spreadsheet },
  PropertiesService: { getScriptProperties: () => props },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, fmt) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10),
  },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  UrlFetchApp,
  DocumentApp,
  Logger: { log: console.log },
  HtmlService: { createHtmlOutputFromFile: (n) => fs.readFileSync(path.join(SRC, n + '.html'), 'utf8') },
};
vm.createContext(sandbox);
fs.readdirSync(SRC).filter((f) => f.endsWith('.gs') && !(process.env.SKIP_FILES || '').split(',').includes(f)).sort().forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
});

// ------------------------------------------------------------------ HTTP
const SHIM = `<script>
window.google = { script: { run: (function make(ok, fail) {
  return {
    withSuccessHandler: (f) => make(f, fail),
    withFailureHandler: (f) => make(ok, f),
    api: (action, payload) => fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, payload }) })
      .then((r) => r.json()).then((d) => ok && ok(d)).catch((e) => fail && fail(e)),
  };
})() } };
</script>`;

function renderIndex() {
  const read = (n) => fs.readFileSync(path.join(SRC, n + '.html'), 'utf8');
  return read('Index').replace(/<\?!=\s*include\('(\w+)'\)\s*\?>/g, (m, n) => (n === 'App' ? SHIM : '') + read(n));
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { action, payload } = JSON.parse(body);
      sandbox.DB_CACHE_ = {}; // tiap panggilan = eksekusi baru, seperti di Apps Script
      const out = sandbox.api(action, payload);
      res.writeHead(200, { 'content-type': 'application/json' });
      // JSON round-trip meniru serialisasi google.script.run
      res.end(JSON.stringify(out));
    });
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(renderIndex());
}).listen(PORT, () => console.log(`JK TeachDesk (dev) → http://localhost:${PORT}  | data: ${DATA}`));

module.exports = { sandbox };
