/**
 * Ai.gs — integrasi AI via UrlFetchApp. Dua penyedia:
 *   - Gemini (Google AI Studio) → callGemini_   key: GEMINI_API_KEY
 *   - Claude (Anthropic)        → callClaude_   key: ANTHROPIC_API_KEY
 * Pilih penyedia di menu Pengaturan. Semua fitur memanggil callAi_.
 *
 * API key disimpan di Script Properties, TIDAK pernah dikirim ke browser.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
// Dicoba berurutan bila model pilihan sibuk (503), kuota habis (429), atau sudah tidak tersedia (404).
const GEMINI_CADANGAN = ['gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3-flash-preview'];

/** Pintu tunggal AI: memanggil penyedia yang aktif di Pengaturan. */
function callAi_(opts) {
  return settingsGet_().aiProvider === 'claude' ? callClaude_(opts) : callGemini_(opts);
}

/**
 * Memanggil Gemini generateContent dan mengembalikan teks jawaban.
 * opts: { system, prompt, maxTokens, schema }
 */
function callGemini_(opts) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('API key Gemini belum diatur. Buka menu Pengaturan → AI.');
  const s = settingsGet_();
  const body = {
    contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
    // Gemini 3.x ikut menghitung token "berpikir" di batas ini, jadi beri ruang besar.
    generationConfig: { maxOutputTokens: opts.maxTokens || 32768 },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseJsonSchema = opts.schema;
  }

  const models = [s.geminiModel || DEFAULT_SETTINGS.geminiModel].concat(GEMINI_CADANGAN)
    .filter(function (m, i, arr) { return m && arr.indexOf(m) === i; });
  let lastErr = null;
  for (let i = 0; i < models.length; i++) {
    const res = UrlFetchApp.fetch(GEMINI_URL + encodeURIComponent(models[i]) + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    let json;
    try { json = JSON.parse(res.getContentText()); } catch (e) { json = null; }
    if (code === 200) return parseGemini_(json, models[i]);

    const msg = json && json.error ? json.error.message : res.getContentText().slice(0, 300);
    if (code === 400 && /API key/i.test(msg)) throw new Error('API key Gemini tidak valid. Periksa kembali di Pengaturan.');
    if (code === 401 || code === 403) throw new Error('API key Gemini ditolak (' + code + '): ' + msg.slice(0, 200));
    if (code === 429 || code === 404 || code >= 500) {
      lastErr = { code: code, model: models[i] };
      console.warn('Gemini ' + models[i] + ' → ' + code + ', mencoba model cadangan');
      continue;
    }
    throw new Error('Gagal memanggil Gemini (' + code + '): ' + msg.slice(0, 300));
  }
  if (lastErr && lastErr.code === 429) {
    throw new Error('Kuota gratis Gemini habis untuk semua model (429). Tunggu beberapa menit (batas per menit) atau besok (batas harian), atau aktifkan billing di Google AI Studio.');
  }
  throw new Error('Semua model Gemini sedang sibuk. Coba lagi 1–2 menit lagi. (' + (lastErr ? lastErr.code + ' ' + lastErr.model : '') + ')');
}

function parseGemini_(json, model) {
  const cand = (json.candidates || [])[0];
  if (!cand) {
    const block = json.promptFeedback && json.promptFeedback.blockReason;
    throw new Error(block ? 'Permintaan diblokir filter keamanan Gemini (' + block + '). Ubah kata-kata pada isian.' : 'Gemini tidak mengembalikan jawaban. Coba lagi.');
  }
  if (/SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(cand.finishReason || '')) {
    throw new Error('Jawaban dihentikan filter Gemini (' + cand.finishReason + '). Coba ubah kata-kata pada isian.');
  }
  const text = ((cand.content && cand.content.parts) || [])
    .filter(function (p) { return p.text && !p.thought; })
    .map(function (p) { return p.text; })
    .join('').trim();
  if (!text) throw new Error('Gemini tidak mengembalikan teks. Coba lagi.');
  return { text: text, truncated: cand.finishReason === 'MAX_TOKENS', usage: json.usageMetadata, model: json.modelVersion || model };
}

/**
 * Memanggil Claude Messages API dan mengembalikan teks jawaban.
 * opts: { system, prompt, maxTokens, schema }
 *   - schema (opsional): JSON Schema → jawaban dijamin JSON valid (structured outputs).
 */
function callClaude_(opts) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('API key Claude belum diatur. Buka menu Pengaturan → AI.');
  const s = settingsGet_();
  const body = {
    model: s.aiModel || DEFAULT_SETTINGS.aiModel,
    max_tokens: opts.maxTokens || 16000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
    thinking: { type: 'adaptive' },
    output_config: { effort: s.aiEffort || 'medium' },
  };
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (/opus|sonnet/.test(body.model)) {
    // Jika model utama menolak (false positive filter keamanan), API otomatis
    // mencoba model cadangan yang direkomendasikan Anthropic.
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  if (opts.schema) body.output_config.format = { type: 'json_schema', schema: opts.schema };

  const res = UrlFetchApp.fetch(ANTHROPIC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  let json;
  try { json = JSON.parse(res.getContentText()); } catch (e) { json = null; }
  if (code !== 200) {
    const msg = json && json.error ? json.error.message : res.getContentText().slice(0, 300);
    if (code === 401) throw new Error('API key tidak valid (401). Periksa kembali di Pengaturan.');
    if (code === 429) throw new Error('Batas pemakaian API tercapai (429). Coba lagi sebentar lagi.');
    if (code === 529 || code >= 500) throw new Error('Server AI sedang sibuk (' + code + '). Coba lagi.');
    throw new Error('Gagal memanggil AI (' + code + '): ' + msg);
  }
  if (json.stop_reason === 'refusal') {
    throw new Error('AI menolak permintaan ini. Coba ubah kata-kata pada isian Anda.');
  }
  const text = (json.content || [])
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join('\n').trim();
  if (!text) throw new Error('AI tidak mengembalikan teks. Coba lagi.');
  return { text: text, truncated: json.stop_reason === 'max_tokens', usage: json.usage, model: json.model };
}

function systemPrompt_(s) {
  return [
    'Anda adalah asisten perangkat pembelajaran untuk guru di Indonesia.',
    'Profil guru: ' + (s.namaGuru || '(nama guru)') + (s.nip ? ', NIP ' + s.nip : '') +
      ', mengajar ' + (s.mapelList || '') + ' di ' + (s.sekolah || '(nama sekolah)') + (s.kota ? ', ' + s.kota : '') + '.',
    'Tahun ajaran ' + s.tahunAjaran + ', semester ' + s.semester + '.',
    'Kerangka kurikulum: ' + s.kurikulum + '.',
    'Dimensi Profil Lulusan: keimanan & ketakwaan terhadap Tuhan YME, kewargaan, penalaran kritis, kreativitas, kolaborasi, kemandirian, kesehatan, komunikasi.',
    '',
    'Aturan output:',
    '- Tulis dalam Markdown rapi: judul (#, ##, ###), daftar, dan TABEL Markdown untuk data tabular.',
    '- Langsung berikan dokumennya tanpa kata pengantar seperti "Berikut adalah...".',
    '- Isi identitas dengan data profil di atas; gunakan placeholder [....] hanya untuk data yang benar-benar tidak diketahui.',
    '- Konten harus akurat, kontekstual Indonesia, siap pakai di kelas, dan sesuai tingkat perkembangan peserta didik.',
    '- Untuk mata pelajaran Bahasa Inggris: materi, soal, dan teks untuk siswa ditulis dalam bahasa Inggris kecuali diminta lain; instruksi untuk guru boleh bahasa Indonesia.',
    '- Untuk Informatika: gunakan contoh kode yang benar dan bisa dijalankan (sebutkan bahasanya, mis. Python), dalam blok kode.',
  ].join('\n');
}

/** p = { jenis: 'modul_ajar', fields: { mapel: ..., ... }, rombelId? } */
function aiGenerate_(p) {
  const tpl = aiTemplates_().filter(function (t) { return t.id === p.jenis; })[0];
  if (!tpl) throw new Error('Jenis perangkat tidak dikenal.');
  const f = p.fields || {};
  tpl.fields.forEach(function (fd) {
    if (fd.required && !String(f[fd.key] || '').trim()) throw new Error('Isian "' + fd.label + '" wajib diisi.');
  });
  const s = settingsGet_();

  const isian = tpl.fields
    .filter(function (fd) { return String(f[fd.key] || '').trim() && f[fd.key] !== 'Bebaskan AI memilih'; })
    .map(function (fd) { return '- ' + fd.label + ': ' + String(f[fd.key]).trim(); });

  let prompt;
  if (tpl.id === 'bebas') {
    prompt = f.permintaan;
  } else {
    prompt = [
      'Buatkan dokumen: ' + tpl.nama + '.',
      '',
      'Data dari guru:',
      isian.join('\n') || '- (tidak ada)',
      '',
      'Struktur yang wajib ada:',
      tpl.struktur.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'),
    ].join('\n');
  }
  if (p.rombelId) {
    const r = dbFind_('Rombel', p.rombelId);
    if (r) prompt += '\n\nKelas sasaran: ' + r.nama + ' (' + anggotaRombel_(r).length + ' peserta didik).';
  }

  const out = callAi_({ system: systemPrompt_(s), prompt: prompt });
  const judul = tpl.id === 'bebas' ? f.judul : tpl.nama + ' — ' + (f.topik || f.lagu || f.tugas || f.mapel || f.tujuan || '').toString().slice(0, 80);
  return {
    judul: judul.replace(/ — $/, ''),
    konten: out.text + (out.truncated ? '\n\n> ⚠️ Jawaban terpotong karena terlalu panjang. Kurangi cakupan lalu buat ulang.' : ''),
    jenis: tpl.id, jenisNama: tpl.nama, mapel: f.mapel || (tpl.kategori === 'Ekskul Band' ? 'Ekskul Band' : ''),
    kelas: f.fase || '', input: f, usage: out.usage,
  };
}

/**
 * Deskripsi capaian rapor per siswa berdasarkan nilai nyata di buku nilai.
 * p = { rombelId, catatan? }
 */
function aiDeskripsiRapor_(p) {
  const gb = gradebook_({ rombelId: p.rombelId });
  if (!gb.siswa.length) throw new Error('Rombel ini belum punya siswa.');
  if (!gb.asesmen.length) throw new Error('Belum ada asesmen/nilai di rombel ini.');
  const s = settingsGet_();
  const baris = gb.siswa.map(function (sw, i) {
    const detail = gb.asesmen.map(function (a) {
      const v = (gb.nilai[sw.id] || {})[a.id];
      return a.judul + (a.tp ? ' [' + a.tp + ']' : '') + '=' + (v === undefined || v === '' ? '-' : v + '/' + (a.maks || 100));
    }).join('; ');
    return (i + 1) + '. id=' + sw.id + ' | ' + sw.nama + ' | akhir=' + (gb.rekap[i].akhir === null ? '-' : gb.rekap[i].akhir) + ' | ' + detail;
  });
  const prompt = [
    'Susun deskripsi capaian kompetensi rapor untuk mapel ' + (gb.rombel.mapel || gb.rombel.nama) + ', rombel ' + gb.rombel.nama + '. KKTP = ' + gb.kktp + '.',
    'Untuk setiap siswa tulis 1–2 kalimat (maks. 300 karakter) dengan pola rapor Kurikulum Merdeka:',
    '"Menunjukkan penguasaan yang baik/sangat baik dalam ..." untuk TP/asesmen dengan nilai tertinggi, dan "Perlu bantuan/penguatan dalam ..." untuk yang terendah.',
    'Gunakan bahasa positif, spesifik pada materi, tanpa menyebut angka nilai.',
    p.catatan ? 'Catatan guru: ' + p.catatan : '',
    '',
    'Data (judul asesmen [TP] = nilai/maks):',
    baris.join('\n'),
  ].join('\n');
  const schema = {
    type: 'object',
    properties: {
      deskripsi: {
        type: 'array',
        items: {
          type: 'object',
          properties: { siswaId: { type: 'string' }, deskripsi: { type: 'string' } },
          required: ['siswaId', 'deskripsi'],
          additionalProperties: false,
        },
      },
    },
    required: ['deskripsi'],
    additionalProperties: false,
  };
  const out = callAi_({ system: systemPrompt_(s), prompt: prompt, schema: schema });
  const parsed = JSON.parse(out.text);
  const map = {};
  parsed.deskripsi.forEach(function (d) { map[d.siswaId] = d.deskripsi; });
  return gb.siswa.map(function (sw, i) {
    return { siswaId: sw.id, nama: sw.nama, nis: sw.nis, akhir: gb.rekap[i].akhir, deskripsi: map[sw.id] || '' };
  });
}

function aiTest_() {
  const out = callAi_({ system: 'Jawab sangat singkat dalam bahasa Indonesia.', prompt: 'Sapa seorang guru dalam satu kalimat.', maxTokens: 4000 });
  return { pesan: out.text, model: out.model };
}
