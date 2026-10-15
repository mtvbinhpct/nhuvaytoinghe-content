// Tách từ tiếng Anh trong kho — CÙNG luật với wordAt(…, {hyphen:true}) của web
// và Dart: chữ cái Unicode, nháy/gạch nối chỉ khi kẹp giữa hai chữ.
import { DatabaseSync } from 'node:sqlite';
import { enKey } from '../../web/lib/dict/en-key.mjs';

export const TOKEN_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

export function tokenize(text) {
  return text.match(TOKEN_RE) ?? [];
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function plainText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return NAMED[e.toLowerCase()] ?? m;
    });
}

function count(map, text) {
  for (const t of tokenize(text)) {
    const k = enKey(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
}

/** Tab Đối chiếu đọc segment.en, tab Bản dịch đọc reading lang='en'. */
export function collectForms(dbPaths) {
  const compare = new Map();
  const reading = new Map();
  for (const p of dbPaths) {
    const db = new DatabaseSync(p, { readOnly: true });
    for (const { en } of db.prepare("SELECT en FROM segment WHERE en IS NOT NULL AND en <> ''").all()) {
      count(compare, plainText(en));
    }
    for (const { html } of db.prepare("SELECT html FROM reading WHERE lang = 'en'").all()) {
      count(reading, plainText(html));
    }
    db.close();
  }
  return { compare, reading };
}
