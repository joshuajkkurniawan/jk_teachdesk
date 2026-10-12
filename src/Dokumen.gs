/**
 * Dokumen.gs — arsip hasil AI + ekspor ke Google Docs.
 */

const CHUNK_ = 40000;

function dokList_() {
  return dbAll_('Dokumen').sort(function (a, b) { return b.diubah.localeCompare(a.diubah); });
}

function dokGet_(p) {
  const d = dbFind_('Dokumen', p.id);
  if (!d) throw new Error('Dokumen tidak ditemukan.');
  d.konten = dbWhere_('DokumenIsi', function (x) { return x.dokumenId === d.id; })
    .sort(function (a, b) { return Number(a.urut) - Number(b.urut); })
    .map(function (x) { return x.isi; }).join('');
  try { d.input = JSON.parse(d.input || '{}'); } catch (e) { d.input = {}; }
  return d;
}

/** p = { id?, jenis, judul, mapel, kelas, input, konten } */
function dokSave_(p) {
  if (!p.judul) throw new Error('Judul dokumen wajib diisi.');
  const konten = String(p.konten || '');
  const data = {
    jenis: p.jenis || 'bebas', judul: String(p.judul).trim(), mapel: p.mapel || '', kelas: p.kelas || '',
    input: typeof p.input === 'string' ? p.input : JSON.stringify(p.input || {}),
    cuplikan: konten.replace(/[#*|>`_-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
    diubah: now_(),
  };
  let saved;
  if (p.id) {
    saved = dbUpdate_('Dokumen', p.id, data);
  } else {
    data.dibuat = data.diubah;
    saved = dbInsert_('Dokumen', data);
  }
  dbDeleteWhere_('DokumenIsi', function (x) { return x.dokumenId === saved.id; });
  const chunks = [];
  for (let i = 0; i < konten.length; i += CHUNK_) {
    chunks.push({ dokumenId: saved.id, urut: String(chunks.length), isi: konten.slice(i, i + CHUNK_) });
  }
  dbInsertMany_('DokumenIsi', chunks);
  return saved;
}

function dokDelete_(p) {
  dbDeleteWhere_('DokumenIsi', function (x) { return x.dokumenId === p.id; });
  dbDelete_('Dokumen', p.id);
  return true;
}

/** Ekspor dokumen ke Google Docs (dibuat ulang setiap ekspor). */
function dokExport_(p) {
  const d = dokGet_(p);
  const doc = DocumentApp.create(d.judul);
  const body = doc.getBody();
  body.setMarginTop(56).setMarginBottom(56).setMarginLeft(64).setMarginRight(56);
  markdownToDoc_(body, d.konten);
  doc.saveAndClose();
  const url = doc.getUrl();
  dbUpdate_('Dokumen', d.id, { docUrl: url });
  return { url: url };
}

// ------------------- Markdown → Google Docs -------------------

function markdownToDoc_(body, md) {
  const lines = String(md).replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blok kode ```
    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      const t = body.appendTable([[code.join('\n')]]);
      t.setBorderColor('#cccccc');
      t.getCell(0, 0).setBackgroundColor('#f5f5f5').editAsText().setFontFamily('Courier New').setFontSize(9);
      continue;
    }

    // Tabel Markdown
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const raw = lines[i++].trim();
        if (/^\|[\s:|-]+\|?$/.test(raw)) continue; // baris pemisah |---|
        rows.push(raw.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim().replace(/<br\s*\/?>/gi, '\n'); }));
      }
      const width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      rows.forEach(function (r) { while (r.length < width) r.push(''); });
      const plain = rows.map(function (r) { return r.map(stripInline_); });
      const table = body.appendTable(plain);
      table.setBorderColor('#999999');
      rows.forEach(function (r, ri) {
        r.forEach(function (c, ci) {
          const cell = table.getCell(ri, ci);
          applyInline_(cell.editAsText(), c);
          cell.editAsText().setFontSize(10);
          if (ri === 0) cell.setBackgroundColor('#e8eefc').editAsText().setBold(true);
        });
      });
      continue;
    }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const levels = [DocumentApp.ParagraphHeading.HEADING1, DocumentApp.ParagraphHeading.HEADING2, DocumentApp.ParagraphHeading.HEADING3,
        DocumentApp.ParagraphHeading.HEADING4, DocumentApp.ParagraphHeading.HEADING5, DocumentApp.ParagraphHeading.HEADING6];
      const p = body.appendParagraph('');
      p.setHeading(levels[m[1].length - 1]);
      applyInline_(p.editAsText(), m[2]);
    } else if ((m = line.match(/^(\s*)[-*+]\s+(?:\[( |x)\]\s+)?(.*)$/))) {
      const li = body.appendListItem('');
      li.setGlyphType(DocumentApp.GlyphType.BULLET).setNestingLevel(Math.min(Math.floor(m[1].length / 2), 8));
      applyInline_(li.editAsText(), (m[2] !== undefined ? (m[2] === 'x' ? '☑ ' : '☐ ') : '') + m[3]);
    } else if ((m = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/))) {
      // Nomor ditulis manual agar penomoran sama persis dengan teks AI.
      const p = body.appendParagraph('');
      p.setIndentStart(18 + 18 * Math.floor(m[1].length / 2)).setIndentFirstLine(0);
      applyInline_(p.editAsText(), m[2] + '. ' + m[3]);
    } else if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      body.appendHorizontalRule();
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      const p = body.appendParagraph('');
      p.setIndentStart(24).setIndentFirstLine(24);
      applyInline_(p.editAsText(), m[1]);
      p.editAsText().setItalic(true).setForegroundColor('#555555');
    } else if (line.trim() !== '') {
      const p = body.appendParagraph('');
      applyInline_(p.editAsText(), line);
    }
    i++;
  }
  // Dokumen baru selalu diawali 1 paragraf kosong — buang jika masih kosong.
  try {
    const head = body.getChild(0);
    if (body.getNumChildren() > 1 && head.getType() === DocumentApp.ElementType.PARAGRAPH && head.asParagraph().getText() === '') {
      head.removeFromParent();
    }
  } catch (e) { /* abaikan: Docs kadang menolak menghapus paragraf tertentu */ }
}

function stripInline_(s) {
  return String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');
}

/** Menulis teks ke elemen Text sambil menerapkan **tebal**, *miring*, dan `kode`. */
function applyInline_(textEl, raw) {
  const re = /(\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*)/g;
  let out = '', last = 0, m;
  const styles = [];
  while ((m = re.exec(raw))) {
    out += raw.slice(last, m.index);
    const content = m[2] || m[3] || m[4];
    const type = m[2] ? 'b' : m[3] ? 'c' : 'i';
    styles.push({ start: out.length, end: out.length + content.length - 1, type: type });
    out += content;
    last = re.lastIndex;
  }
  out += raw.slice(last);
  textEl.setText(out);
  if (!out) return;
  textEl.setBold(false).setItalic(false);
  styles.forEach(function (st) {
    if (st.end < st.start) return;
    if (st.type === 'b') textEl.setBold(st.start, st.end, true);
    if (st.type === 'i') textEl.setItalic(st.start, st.end, true);
    if (st.type === 'c') textEl.setFontFamily(st.start, st.end, 'Courier New');
  });
}
